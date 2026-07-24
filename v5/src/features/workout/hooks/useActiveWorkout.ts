import { useCallback, useEffect, useState } from 'react';
import {
  addWorkoutSet,
  cancelWorkout,
  completeWorkout,
  deleteWorkoutSet,
  loadActiveWorkout,
  resetWorkoutSet,
  restoreWorkoutSet,
  saveWorkoutExerciseNotes,
  saveWorkoutSessionDetails,
  saveWorkoutSet,
  setWorkoutSetWarmup,
  skipWorkoutSet,
  startWorkoutFromDay,
  type ActiveWorkoutSession,
  type WorkoutSessionDetailsInput,
  type WorkoutSetInput,
} from '../repositories/activeWorkoutRepository';
import {
  loadExerciseRecords,
  loadWorkoutHistory,
} from '../repositories/workoutHistoryRepository';
import { emitWorkoutCompleted } from '../workoutCompletionEvent';
import {
  applyPendingWorkoutSetWrites,
  cacheActiveWorkout,
  clearCachedActiveWorkout,
  flushPendingWorkoutSetWrites,
  getWorkoutSyncState,
  isConnectivityError,
  queueWorkoutSetWrite,
  readCachedActiveWorkout,
  subscribeWorkoutSyncRequests,
  subscribeWorkoutSyncState,
  type WorkoutSyncState,
} from '../workoutOfflineStore';

type ActiveWorkoutStatus = 'loading' | 'idle' | 'active' | 'error';

type SetMutation = () => Promise<
  { ok: true; data: null } | { ok: false; error: string }
>;

const OFFLINE_ACTION_ERROR =
  'This action needs a connection. Your current workout remains safe on this device.';

export function useActiveWorkout(userId: string | undefined) {
  const [status, setStatus] = useState<ActiveWorkoutStatus>('loading');
  const [session, setSession] = useState<ActiveWorkoutSession | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [syncNotice, setSyncNotice] = useState<string | null>(null);
  const [syncState, setSyncState] = useState<WorkoutSyncState>(() =>
    getWorkoutSyncState(userId),
  );
  const [startingDayId, setStartingDayId] = useState<string | null>(null);
  const [savingSetId, setSavingSetId] = useState<string | null>(null);
  const [addingSetExerciseId, setAddingSetExerciseId] = useState<string | null>(
    null,
  );
  const [savingSessionDetails, setSavingSessionDetails] = useState(false);
  const [savingExerciseId, setSavingExerciseId] = useState<string | null>(null);
  const [finishing, setFinishing] = useState(false);

  const reload = useCallback(
    async (silent: boolean) => {
      if (!userId) {
        setSession(null);
        setStatus('idle');
        setSyncNotice(null);
        return;
      }

      if (!silent) setStatus('loading');
      setError(null);
      const result = await loadActiveWorkout(userId);
      if (!result.ok) {
        const cached = readCachedActiveWorkout(userId);
        if (
          cached &&
          (!navigator.onLine || silent || isConnectivityError(result.error))
        ) {
          const recovered = applyPendingWorkoutSetWrites(cached, userId);
          setSession(recovered);
          setStatus('active');
          setSyncNotice(
            navigator.onLine
              ? 'BioTrack is using the last safe workout copy while it reconnects.'
              : 'Offline mode: your workout and completed sets remain available on this device.',
          );
          return;
        }

        if (silent) {
          setSyncNotice(
            'BioTrack could not refresh the workout yet. Your current screen remains unchanged.',
          );
          return;
        }

        setStatus('error');
        setError(result.error);
        return;
      }

      if (result.data) {
        const recovered = applyPendingWorkoutSetWrites(result.data, userId);
        cacheActiveWorkout(userId, recovered);
        setSession(recovered);
        setStatus('active');
        const pending = getWorkoutSyncState(userId).pendingCount;
        setSyncNotice(
          pending > 0
            ? `${pending} completed ${pending === 1 ? 'set is' : 'sets are'} waiting to sync.`
            : null,
        );
        return;
      }

      if (getWorkoutSyncState(userId).pendingCount === 0) {
        clearCachedActiveWorkout(userId);
        setSession(null);
        setStatus('idle');
        setSyncNotice(null);
        return;
      }

      const cached = readCachedActiveWorkout(userId);
      if (cached) {
        setSession(applyPendingWorkoutSetWrites(cached, userId));
        setStatus('active');
        setSyncNotice(
          'Saved sets are still waiting to sync before this workout can be closed.',
        );
      } else {
        setSession(null);
        setStatus('idle');
      }
    },
    [userId],
  );

  const syncPendingSets = useCallback(async () => {
    if (!userId) return { ok: true as const, synced: 0 };
    const result = await flushPendingWorkoutSetWrites(userId, saveWorkoutSet);
    setSyncState(getWorkoutSyncState(userId));

    if (!result.ok) {
      if (result.error !== 'You are offline.') {
        setSyncNotice(
          `BioTrack will keep retrying your saved sets. ${result.error}`,
        );
      }
      return result;
    }

    if (result.synced > 0) {
      setSyncNotice(
        `${result.synced} saved ${result.synced === 1 ? 'set has' : 'sets have'} synced successfully.`,
      );
      await reload(true);
    }
    return result;
  }, [reload, userId]);

  useEffect(() => {
    if (!userId) {
      setSyncState(getWorkoutSyncState(undefined));
      return;
    }
    return subscribeWorkoutSyncState(userId, setSyncState);
  }, [userId]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      await reload(false);
      if (!cancelled && navigator.onLine) await syncPendingSets();
    })();
    return () => {
      cancelled = true;
    };
  }, [reload, syncPendingSets]);

  useEffect(() => {
    if (!userId) return;
    const runSync = () => void syncPendingSets();
    window.addEventListener('online', runSync);
    const unsubscribe = subscribeWorkoutSyncRequests(userId, runSync);
    return () => {
      window.removeEventListener('online', runSync);
      unsubscribe();
    };
  }, [syncPendingSets, userId]);

  const start = useCallback(
    async (dayId: string) => {
      if (!navigator.onLine) {
        const result = { ok: false as const, error: OFFLINE_ACTION_ERROR };
        setError(result.error);
        return result;
      }

      setStartingDayId(dayId);
      setError(null);
      try {
        const result = await startWorkoutFromDay(dayId);
        if (!result.ok) {
          setError(result.error);
          return result;
        }
        await reload(false);
        return result;
      } finally {
        setStartingDayId(null);
      }
    },
    [reload],
  );

  const runSetMutation = useCallback(
    async (setId: string, mutation: SetMutation) => {
      if (!navigator.onLine) {
        const result = { ok: false as const, error: OFFLINE_ACTION_ERROR };
        setError(result.error);
        return result;
      }

      setSavingSetId(setId);
      setError(null);
      try {
        const result = await mutation();
        if (!result.ok) {
          setError(result.error);
          return result;
        }
        await reload(true);
        return result;
      } finally {
        setSavingSetId(null);
      }
    },
    [reload],
  );

  const saveSet = useCallback(
    async (setId: string, input: WorkoutSetInput) => {
      if (!userId || !session) {
        const result = {
          ok: false as const,
          error: 'No active workout was found.',
        };
        setError(result.error);
        return result;
      }

      const sessionId = session.id;
      const queueLocally = () => {
        queueWorkoutSetWrite(userId, sessionId, setId, input);
        setSession((current) => {
          if (!current || current.id !== sessionId) return current;
          const recovered = applyPendingWorkoutSetWrites(current, userId);
          cacheActiveWorkout(userId, recovered);
          return recovered;
        });
        const pending = getWorkoutSyncState(userId).pendingCount;
        setSyncNotice(
          `Saved on this device. ${pending} ${pending === 1 ? 'set is' : 'sets are'} waiting for a connection.`,
        );
        return { ok: true as const, data: null };
      };

      setSavingSetId(setId);
      setError(null);
      try {
        if (!navigator.onLine) return queueLocally();

        const result = await saveWorkoutSet(setId, input);
        if (!result.ok) {
          if (isConnectivityError(result.error)) return queueLocally();
          setError(result.error);
          return result;
        }

        await reload(true);
        return result;
      } finally {
        setSavingSetId(null);
      }
    },
    [reload, session, userId],
  );

  const toggleWarmup = useCallback(
    (setId: string, isWarmup: boolean) =>
      runSetMutation(setId, () => setWorkoutSetWarmup(setId, isWarmup)),
    [runSetMutation],
  );

  const skipSet = useCallback(
    (setId: string) => runSetMutation(setId, () => skipWorkoutSet(setId)),
    [runSetMutation],
  );

  const restoreSet = useCallback(
    (setId: string) => runSetMutation(setId, () => restoreWorkoutSet(setId)),
    [runSetMutation],
  );

  const resetSet = useCallback(
    (setId: string) => runSetMutation(setId, () => resetWorkoutSet(setId)),
    [runSetMutation],
  );

  const removeSet = useCallback(
    (setId: string) => runSetMutation(setId, () => deleteWorkoutSet(setId)),
    [runSetMutation],
  );

  const addSet = useCallback(
    async (
      sessionExerciseId: string,
      setNumber: number,
      weightUnit: 'lb' | 'kg',
    ) => {
      if (!navigator.onLine) {
        const result = { ok: false as const, error: OFFLINE_ACTION_ERROR };
        setError(result.error);
        return result;
      }

      setAddingSetExerciseId(sessionExerciseId);
      setError(null);
      try {
        const result = await addWorkoutSet(
          sessionExerciseId,
          setNumber,
          weightUnit,
        );
        if (!result.ok) {
          setError(result.error);
          return result;
        }
        await reload(true);
        return result;
      } finally {
        setAddingSetExerciseId(null);
      }
    },
    [reload],
  );

  const saveDetails = useCallback(
    async (input: WorkoutSessionDetailsInput) => {
      if (!session)
        return { ok: false as const, error: 'No active workout was found.' };
      if (!navigator.onLine) {
        const result = { ok: false as const, error: OFFLINE_ACTION_ERROR };
        setError(result.error);
        return result;
      }

      setSavingSessionDetails(true);
      setError(null);
      try {
        const result = await saveWorkoutSessionDetails(session.id, input);
        if (!result.ok) {
          setError(result.error);
          return result;
        }
        await reload(true);
        return result;
      } finally {
        setSavingSessionDetails(false);
      }
    },
    [reload, session],
  );

  const saveExerciseNotes = useCallback(
    async (sessionExerciseId: string, notes: string | null) => {
      if (!navigator.onLine) {
        const result = { ok: false as const, error: OFFLINE_ACTION_ERROR };
        setError(result.error);
        return result;
      }

      setSavingExerciseId(sessionExerciseId);
      setError(null);
      try {
        const result = await saveWorkoutExerciseNotes(sessionExerciseId, notes);
        if (!result.ok) {
          setError(result.error);
          return result;
        }
        await reload(true);
        return result;
      } finally {
        setSavingExerciseId(null);
      }
    },
    [reload],
  );

  const finish = useCallback(async () => {
    if (!session)
      return { ok: false as const, error: 'No active workout was found.' };
    if (!navigator.onLine) {
      const result = {
        ok: false as const,
        error:
          'Reconnect before finishing so every saved set reaches your history.',
      };
      setError(result.error);
      return result;
    }

    const pending = userId ? getWorkoutSyncState(userId).pendingCount : 0;
    if (pending > 0) {
      const result = {
        ok: false as const,
        error: `BioTrack is still syncing ${pending} saved ${pending === 1 ? 'set' : 'sets'}. Retry sync before finishing.`,
      };
      setError(result.error);
      requestAnimationFrame(() =>
        window.scrollTo({ top: 0, behavior: 'smooth' }),
      );
      return result;
    }

    const sessionSnapshot = session;
    const historyPromise = userId
      ? loadWorkoutHistory(userId)
      : Promise.resolve({ ok: true as const, data: [] });
    const recordsPromise = userId
      ? loadExerciseRecords(userId)
      : Promise.resolve({ ok: true as const, data: [] });

    setFinishing(true);
    setError(null);
    try {
      const result = await completeWorkout(sessionSnapshot.id);
      if (!result.ok) {
        setError(result.error);
        return result;
      }

      const [historyResult, recordsResult] = await Promise.all([
        historyPromise,
        recordsPromise,
      ]);

      emitWorkoutCompleted({
        session: sessionSnapshot,
        completedAt: new Date().toISOString(),
        previousHistory: historyResult.ok ? historyResult.data : [],
        previousRecords: recordsResult.ok ? recordsResult.data : [],
      });

      if (userId) clearCachedActiveWorkout(userId);
      await reload(false);
      return result;
    } finally {
      setFinishing(false);
    }
  }, [reload, session, userId]);

  const cancel = useCallback(async () => {
    if (!session)
      return { ok: false as const, error: 'No active workout was found.' };
    if (!navigator.onLine) {
      const result = {
        ok: false as const,
        error: 'Reconnect before cancelling this workout.',
      };
      setError(result.error);
      return result;
    }

    const pending = userId ? getWorkoutSyncState(userId).pendingCount : 0;
    if (pending > 0) {
      const result = {
        ok: false as const,
        error: 'Sync or finish saving the pending sets before cancelling.',
      };
      setError(result.error);
      return result;
    }

    setFinishing(true);
    setError(null);
    try {
      const result = await cancelWorkout(session.id);
      if (!result.ok) {
        setError(result.error);
        return result;
      }
      if (userId) clearCachedActiveWorkout(userId);
      await reload(false);
      return result;
    } finally {
      setFinishing(false);
    }
  }, [reload, session, userId]);

  const refresh = useCallback(() => reload(false), [reload]);
  const retryPendingSets = useCallback(
    () => syncPendingSets(),
    [syncPendingSets],
  );

  return {
    status,
    session,
    error,
    syncNotice,
    syncState,
    startingDayId,
    savingSetId,
    addingSetExerciseId,
    savingSessionDetails,
    savingExerciseId,
    finishing,
    refresh,
    retryPendingSets,
    start,
    saveSet,
    toggleWarmup,
    skipSet,
    restoreSet,
    resetSet,
    addSet,
    removeSet,
    saveDetails,
    saveExerciseNotes,
    finish,
    cancel,
  };
}
