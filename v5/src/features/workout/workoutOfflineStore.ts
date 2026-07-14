import type {
  ActiveWorkoutSession,
  WorkoutSetInput,
} from './repositories/activeWorkoutRepository';

const ACTIVE_WORKOUT_CACHE_PREFIX = 'biotrack-v5-active-workout-cache';
const SET_OUTBOX_PREFIX = 'biotrack-v5-workout-set-outbox';
const SYNC_STATE_EVENT = 'biotrack-workout-sync-state';
const SYNC_REQUEST_EVENT = 'biotrack-workout-sync-request';

type PendingWorkoutSetWrite = {
  userId: string;
  sessionId: string;
  setId: string;
  input: WorkoutSetInput;
  queuedAt: string;
};

export type WorkoutSyncState = {
  pendingCount: number;
  syncing: boolean;
  error: string | null;
};

type WorkoutSyncStateEventDetail = {
  userId: string;
  state: WorkoutSyncState;
};

type WorkoutSyncRequestEventDetail = {
  userId: string;
};

type PersistSetWrite = (
  setId: string,
  input: WorkoutSetInput,
) => Promise<{ ok: true; data: null } | { ok: false; error: string }>;

type FlushResult =
  | { ok: true; synced: number }
  | { ok: false; error: string; synced: number };

const runtimeStateByUser = new Map<string, Omit<WorkoutSyncState, 'pendingCount'>>();
const syncPromiseByUser = new Map<string, Promise<FlushResult>>();

function cacheKey(userId: string): string {
  return `${ACTIVE_WORKOUT_CACHE_PREFIX}:${userId}`;
}

function outboxKey(userId: string): string {
  return `${SET_OUTBOX_PREFIX}:${userId}`;
}

function isWorkoutSetInput(value: unknown): value is WorkoutSetInput {
  if (!value || typeof value !== 'object') return false;
  const input = value as Partial<WorkoutSetInput>;
  return (
    (input.weight === null || typeof input.weight === 'number') &&
    typeof input.reps === 'number' &&
    (input.rpe === null || typeof input.rpe === 'number') &&
    typeof input.is_warmup === 'boolean' &&
    typeof input.is_completed === 'boolean'
  );
}

function isPendingWrite(value: unknown, userId: string): value is PendingWorkoutSetWrite {
  if (!value || typeof value !== 'object') return false;
  const entry = value as Partial<PendingWorkoutSetWrite>;
  return (
    entry.userId === userId &&
    typeof entry.sessionId === 'string' &&
    typeof entry.setId === 'string' &&
    typeof entry.queuedAt === 'string' &&
    isWorkoutSetInput(entry.input)
  );
}

function readOutbox(userId: string): PendingWorkoutSetWrite[] {
  try {
    const raw = window.localStorage.getItem(outboxKey(userId));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((entry) => isPendingWrite(entry, userId));
  } catch {
    return [];
  }
}

function writeOutbox(userId: string, entries: PendingWorkoutSetWrite[]): void {
  try {
    if (entries.length === 0) {
      window.localStorage.removeItem(outboxKey(userId));
    } else {
      window.localStorage.setItem(outboxKey(userId), JSON.stringify(entries));
    }
  } catch {
    // The current in-memory workout still remains usable when storage is unavailable.
  }
}

function emitSyncState(userId: string): void {
  window.dispatchEvent(
    new CustomEvent<WorkoutSyncStateEventDetail>(SYNC_STATE_EVENT, {
      detail: { userId, state: getWorkoutSyncState(userId) },
    }),
  );
}

function setRuntimeState(
  userId: string,
  patch: Partial<Omit<WorkoutSyncState, 'pendingCount'>>,
): void {
  const current = runtimeStateByUser.get(userId) ?? { syncing: false, error: null };
  runtimeStateByUser.set(userId, { ...current, ...patch });
  emitSyncState(userId);
}

export function getWorkoutSyncState(userId: string | undefined): WorkoutSyncState {
  if (!userId) return { pendingCount: 0, syncing: false, error: null };
  const runtime = runtimeStateByUser.get(userId) ?? { syncing: false, error: null };
  return {
    pendingCount: readOutbox(userId).length,
    syncing: runtime.syncing,
    error: runtime.error,
  };
}

export function subscribeWorkoutSyncState(
  userId: string,
  listener: (state: WorkoutSyncState) => void,
): () => void {
  const handler = (event: Event) => {
    const detail = (event as CustomEvent<WorkoutSyncStateEventDetail>).detail;
    if (detail?.userId === userId) listener(detail.state);
  };

  window.addEventListener(SYNC_STATE_EVENT, handler);
  listener(getWorkoutSyncState(userId));
  return () => window.removeEventListener(SYNC_STATE_EVENT, handler);
}

export function requestWorkoutSync(userId: string): void {
  window.dispatchEvent(
    new CustomEvent<WorkoutSyncRequestEventDetail>(SYNC_REQUEST_EVENT, {
      detail: { userId },
    }),
  );
}

export function subscribeWorkoutSyncRequests(
  userId: string,
  listener: () => void,
): () => void {
  const handler = (event: Event) => {
    const detail = (event as CustomEvent<WorkoutSyncRequestEventDetail>).detail;
    if (detail?.userId === userId) listener();
  };

  window.addEventListener(SYNC_REQUEST_EVENT, handler);
  return () => window.removeEventListener(SYNC_REQUEST_EVENT, handler);
}

export function cacheActiveWorkout(userId: string, session: ActiveWorkoutSession): void {
  try {
    window.localStorage.setItem(
      cacheKey(userId),
      JSON.stringify({ version: 1, session, cachedAt: new Date().toISOString() }),
    );
  } catch {
    // Offline recovery remains best effort when private storage is unavailable.
  }
}

export function readCachedActiveWorkout(userId: string): ActiveWorkoutSession | null {
  try {
    const raw = window.localStorage.getItem(cacheKey(userId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as {
      version?: unknown;
      session?: Partial<ActiveWorkoutSession>;
    };
    const session = parsed.session;
    if (
      parsed.version !== 1 ||
      !session ||
      session.user_id !== userId ||
      typeof session.id !== 'string' ||
      session.status !== 'in_progress' ||
      !Array.isArray(session.exercises)
    ) {
      return null;
    }
    return session as ActiveWorkoutSession;
  } catch {
    return null;
  }
}

export function clearCachedActiveWorkout(userId: string): void {
  try {
    window.localStorage.removeItem(cacheKey(userId));
  } catch {
    // Nothing else is required when storage is unavailable.
  }
}

export function queueWorkoutSetWrite(
  userId: string,
  sessionId: string,
  setId: string,
  input: WorkoutSetInput,
): void {
  const entry: PendingWorkoutSetWrite = {
    userId,
    sessionId,
    setId,
    input,
    queuedAt: new Date().toISOString(),
  };
  const next = [...readOutbox(userId).filter((item) => item.setId !== setId), entry];
  writeOutbox(userId, next);
  setRuntimeState(userId, { error: null });
}

export function applyPendingWorkoutSetWrites(
  session: ActiveWorkoutSession,
  userId: string,
): ActiveWorkoutSession {
  const entries = readOutbox(userId).filter((entry) => entry.sessionId === session.id);
  if (entries.length === 0) return session;

  const pendingBySetId = new Map(entries.map((entry) => [entry.setId, entry]));
  return {
    ...session,
    updated_at: entries.reduce(
      (latest, entry) => (entry.queuedAt > latest ? entry.queuedAt : latest),
      session.updated_at,
    ),
    exercises: session.exercises.map((exercise) => ({
      ...exercise,
      sets: exercise.sets.map((set) => {
        const pending = pendingBySetId.get(set.id);
        if (!pending) return set;
        return {
          ...set,
          weight: pending.input.weight,
          reps: pending.input.reps,
          rpe: pending.input.rpe,
          is_warmup: pending.input.is_warmup,
          is_completed: pending.input.is_completed,
          is_skipped: false,
          completed_at: pending.input.is_completed ? pending.queuedAt : null,
          updated_at: pending.queuedAt,
        };
      }),
    })),
  };
}

export function isConnectivityError(message: string): boolean {
  return (
    !navigator.onLine ||
    /failed to fetch|network request failed|networkerror|load failed|connection|offline/i.test(message)
  );
}

export async function flushPendingWorkoutSetWrites(
  userId: string,
  persist: PersistSetWrite,
): Promise<FlushResult> {
  const existing = syncPromiseByUser.get(userId);
  if (existing) return existing;

  const operation = (async (): Promise<FlushResult> => {
    if (!navigator.onLine) {
      setRuntimeState(userId, { syncing: false, error: null });
      return { ok: false, error: 'You are offline.', synced: 0 };
    }

    const entries = readOutbox(userId);
    if (entries.length === 0) {
      setRuntimeState(userId, { syncing: false, error: null });
      return { ok: true, synced: 0 };
    }

    setRuntimeState(userId, { syncing: true, error: null });
    let synced = 0;

    for (const entry of entries) {
      const result = await persist(entry.setId, entry.input);
      if (!result.ok) {
        setRuntimeState(userId, { syncing: false, error: result.error });
        return { ok: false, error: result.error, synced };
      }

      const current = readOutbox(userId);
      writeOutbox(
        userId,
        current.filter(
          (item) => !(item.setId === entry.setId && item.queuedAt === entry.queuedAt),
        ),
      );
      synced += 1;
      emitSyncState(userId);
    }

    setRuntimeState(userId, { syncing: false, error: null });
    return { ok: true, synced };
  })();

  syncPromiseByUser.set(userId, operation);
  try {
    return await operation;
  } finally {
    syncPromiseByUser.delete(userId);
  }
}
