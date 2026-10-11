import { cleanup, act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useActiveWorkout } from './useActiveWorkout';
import { getWorkoutClosureBlocker } from '../workoutClosureGuards';
import {
  getWorkoutSyncState,
  queueWorkoutSetWrite,
} from '../workoutOfflineStore';
import {
  cancelWorkout,
  completeWorkout,
  loadActiveWorkout,
} from '../repositories/activeWorkoutRepository';
import {
  loadExerciseRecords,
  loadWorkoutHistory,
} from '../repositories/workoutHistoryRepository';
import type { ActiveWorkoutSession } from '../repositories/activeWorkoutRepository';

// Only the remote repositories are mocked: the offline outbox store and the
// pure guard stay real so these tests exercise the true finish/cancel path.
vi.mock('../repositories/activeWorkoutRepository', () => ({
  loadActiveWorkout: vi.fn(),
  completeWorkout: vi.fn(),
  cancelWorkout: vi.fn(),
  startWorkoutFromDay: vi.fn(),
  addWorkoutSet: vi.fn(),
  deleteWorkoutSet: vi.fn(),
  resetWorkoutSet: vi.fn(),
  restoreWorkoutSet: vi.fn(),
  saveWorkoutExerciseNotes: vi.fn(),
  saveWorkoutSessionDetails: vi.fn(),
  saveWorkoutSet: vi.fn(),
  setWorkoutSetWarmup: vi.fn(),
  skipWorkoutSet: vi.fn(),
}));

vi.mock('../repositories/workoutHistoryRepository', () => ({
  loadWorkoutHistory: vi.fn(),
  loadExerciseRecords: vi.fn(),
}));

const CURRENT_USER = 'user-current';
const OTHER_USER = 'user-other';
const SESSION_ID = 'session-1';

type ClosureOutcome = { ok: boolean; error?: string; data?: unknown };

const loadActiveWorkoutMock = vi.mocked(loadActiveWorkout);
const completeWorkoutMock = vi.mocked(completeWorkout);
const cancelWorkoutMock = vi.mocked(cancelWorkout);
const loadWorkoutHistoryMock = vi.mocked(loadWorkoutHistory);
const loadExerciseRecordsMock = vi.mocked(loadExerciseRecords);

function makeSession(): ActiveWorkoutSession {
  // A minimal in-progress session is enough: finish/cancel only read `id`, and
  // applyPendingWorkoutSetWrites maps over an (empty) exercises array.
  return {
    id: SESSION_ID,
    user_id: CURRENT_USER,
    status: 'in_progress',
    updated_at: new Date(0).toISOString(),
    exercises: [],
  } as unknown as ActiveWorkoutSession;
}

function setOnline(online: boolean): void {
  Object.defineProperty(navigator, 'onLine', {
    configurable: true,
    value: online,
  });
}

function queuePending(userId: string, setId: string): void {
  act(() => {
    queueWorkoutSetWrite(userId, SESSION_ID, setId, {
      weight: 100,
      reps: 5,
      rpe: 8,
      is_warmup: false,
      is_completed: true,
    });
  });
}

// Renders the hook and lets the async mount effect (load + optional sync)
// settle before the test drives finish/cancel.
async function renderActiveWorkout(userId = CURRENT_USER) {
  const utils = renderHook(() => useActiveWorkout(userId));
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
  return utils;
}

describe('useActiveWorkout finish/cancel closure integration', () => {
  beforeEach(() => {
    // Module-mock call history is not cleared by restoreMocks, so reset it here
    // to keep the "never called" assertions independent across tests.
    vi.clearAllMocks();
    setOnline(true);
    window.localStorage.clear();
    Object.defineProperty(window, 'scrollTo', {
      configurable: true,
      value: vi.fn(),
    });
    loadActiveWorkoutMock.mockResolvedValue({ ok: true, data: makeSession() });
    completeWorkoutMock.mockResolvedValue({ ok: true, data: null });
    cancelWorkoutMock.mockResolvedValue({ ok: true, data: null });
    loadWorkoutHistoryMock.mockResolvedValue({ ok: true, data: [] });
    loadExerciseRecordsMock.mockResolvedValue({ ok: true, data: [] });
  });

  afterEach(() => {
    cleanup();
  });

  it('blocks finish and cancel while offline with pending sets, without calling remote ops', async () => {
    setOnline(false);
    const { result } = await renderActiveWorkout();
    queuePending(CURRENT_USER, 'set-1');
    expect(getWorkoutSyncState(CURRENT_USER).pendingCount).toBe(1);

    let finishOutcome: ClosureOutcome = { ok: false };
    await act(async () => {
      finishOutcome = await result.current.finish();
    });
    expect(finishOutcome.ok).toBe(false);
    expect(finishOutcome.error).toBe(
      'Reconnect before finishing so every saved set reaches your history.',
    );
    // Offline takes precedence over the pending-sets message in the guard.
    expect(finishOutcome.error).toBe(
      getWorkoutClosureBlocker('finish', false, 1),
    );
    expect(result.current.error).toBe(finishOutcome.error);
    expect(completeWorkoutMock).not.toHaveBeenCalled();

    let cancelOutcome: ClosureOutcome = { ok: false };
    await act(async () => {
      cancelOutcome = await result.current.cancel();
    });
    expect(cancelOutcome.ok).toBe(false);
    expect(cancelOutcome.error).toBe(
      'Reconnect before cancelling this workout.',
    );
    expect(cancelOutcome.error).toBe(
      getWorkoutClosureBlocker('cancel', false, 1),
    );
    expect(cancelWorkoutMock).not.toHaveBeenCalled();
  });

  it('blocks finish and cancel when online with pending sets, keeping the syncing message', async () => {
    const { result } = await renderActiveWorkout();
    queuePending(CURRENT_USER, 'set-1');
    queuePending(CURRENT_USER, 'set-2');
    expect(getWorkoutSyncState(CURRENT_USER).pendingCount).toBe(2);

    let finishOutcome: ClosureOutcome = { ok: false };
    await act(async () => {
      finishOutcome = await result.current.finish();
    });
    expect(finishOutcome.ok).toBe(false);
    expect(finishOutcome.error).toBe(
      'BioTrack is still syncing 2 saved sets. Retry sync before finishing.',
    );
    expect(finishOutcome.error).toBe(
      getWorkoutClosureBlocker('finish', true, 2),
    );
    expect(completeWorkoutMock).not.toHaveBeenCalled();

    let cancelOutcome: ClosureOutcome = { ok: false };
    await act(async () => {
      cancelOutcome = await result.current.cancel();
    });
    expect(cancelOutcome.ok).toBe(false);
    expect(cancelOutcome.error).toBe(
      'Sync or finish saving the pending sets before cancelling.',
    );
    expect(cancelOutcome.error).toBe(
      getWorkoutClosureBlocker('cancel', true, 2),
    );
    expect(cancelWorkoutMock).not.toHaveBeenCalled();
  });

  it('lets finish reach the remote completion when online with nothing pending', async () => {
    const { result } = await renderActiveWorkout();
    expect(getWorkoutSyncState(CURRENT_USER).pendingCount).toBe(0);
    expect(getWorkoutClosureBlocker('finish', true, 0)).toBeNull();

    let outcome: ClosureOutcome = { ok: false };
    await act(async () => {
      outcome = await result.current.finish();
    });
    expect(outcome.ok).toBe(true);
    expect(completeWorkoutMock).toHaveBeenCalledWith(SESSION_ID);
  });

  it('lets cancel reach the remote cancellation when online with nothing pending', async () => {
    const { result } = await renderActiveWorkout();
    expect(getWorkoutSyncState(CURRENT_USER).pendingCount).toBe(0);
    expect(getWorkoutClosureBlocker('cancel', true, 0)).toBeNull();

    let outcome: ClosureOutcome = { ok: false };
    await act(async () => {
      outcome = await result.current.cancel();
    });
    expect(outcome.ok).toBe(true);
    expect(cancelWorkoutMock).toHaveBeenCalledWith(SESSION_ID);
  });

  it('stops blocking finish once the outbox is emptied', async () => {
    const { result } = await renderActiveWorkout();
    queuePending(CURRENT_USER, 'set-1');

    let blocked: ClosureOutcome = { ok: false };
    await act(async () => {
      blocked = await result.current.finish();
    });
    expect(blocked.ok).toBe(false);
    expect(completeWorkoutMock).not.toHaveBeenCalled();

    window.localStorage.clear();
    expect(getWorkoutSyncState(CURRENT_USER).pendingCount).toBe(0);

    let allowed: ClosureOutcome = { ok: false };
    await act(async () => {
      allowed = await result.current.finish();
    });
    expect(allowed.ok).toBe(true);
    expect(completeWorkoutMock).toHaveBeenCalledWith(SESSION_ID);
  });

  it("ignores another user's pending sets and lets the current user finish", async () => {
    queuePending(OTHER_USER, 'set-1');
    const { result } = await renderActiveWorkout(CURRENT_USER);

    expect(getWorkoutSyncState(OTHER_USER).pendingCount).toBe(1);
    expect(getWorkoutSyncState(CURRENT_USER).pendingCount).toBe(0);

    let outcome: ClosureOutcome = { ok: false };
    await act(async () => {
      outcome = await result.current.finish();
    });
    expect(outcome.ok).toBe(true);
    expect(completeWorkoutMock).toHaveBeenCalledWith(SESSION_ID);
  });
});
