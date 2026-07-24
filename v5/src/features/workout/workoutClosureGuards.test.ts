import { beforeEach, describe, expect, it } from 'vitest';
import { getWorkoutClosureBlocker } from './workoutClosureGuards';
import {
  getWorkoutSyncState,
  queueWorkoutSetWrite,
} from './workoutOfflineStore';

const USER_ID = 'user-guard-tests';

describe('workout closure guards', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('allows finishing and cancelling when online with nothing pending', () => {
    expect(getWorkoutClosureBlocker('finish', true, 0)).toBeNull();
    expect(getWorkoutClosureBlocker('cancel', true, 0)).toBeNull();
  });

  it('blocks finishing and cancelling while offline', () => {
    expect(getWorkoutClosureBlocker('finish', false, 0)).toBe(
      'Reconnect before finishing so every saved set reaches your history.',
    );
    expect(getWorkoutClosureBlocker('cancel', false, 0)).toBe(
      'Reconnect before cancelling this workout.',
    );
  });

  it('blocks finishing while saved sets are still syncing', () => {
    expect(getWorkoutClosureBlocker('finish', true, 1)).toBe(
      'BioTrack is still syncing 1 saved set. Retry sync before finishing.',
    );
    expect(getWorkoutClosureBlocker('finish', true, 3)).toBe(
      'BioTrack is still syncing 3 saved sets. Retry sync before finishing.',
    );
  });

  it('blocks cancelling while saved sets are still syncing', () => {
    expect(getWorkoutClosureBlocker('cancel', true, 2)).toBe(
      'Sync or finish saving the pending sets before cancelling.',
    );
  });

  it('blocks closure from real pending outbox writes and unblocks when empty', () => {
    queueWorkoutSetWrite(USER_ID, 'session-1', 'set-1', {
      weight: 100,
      reps: 5,
      rpe: 8,
      is_warmup: false,
      is_completed: true,
    });

    const pending = getWorkoutSyncState(USER_ID).pendingCount;
    expect(pending).toBe(1);
    expect(getWorkoutClosureBlocker('finish', true, pending)).not.toBeNull();
    expect(getWorkoutClosureBlocker('cancel', true, pending)).not.toBeNull();

    window.localStorage.clear();
    const cleared = getWorkoutSyncState(USER_ID).pendingCount;
    expect(cleared).toBe(0);
    expect(getWorkoutClosureBlocker('finish', true, cleared)).toBeNull();
    expect(getWorkoutClosureBlocker('cancel', true, cleared)).toBeNull();
  });
});
