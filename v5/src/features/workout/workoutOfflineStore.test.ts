import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ActiveWorkoutSession } from './repositories/activeWorkoutRepository';
import {
  applyPendingWorkoutSetWrites,
  cacheActiveWorkout,
  flushPendingWorkoutSetWrites,
  getWorkoutSyncState,
  queueWorkoutSetWrite,
  readCachedActiveWorkout,
} from './workoutOfflineStore';

const userId = 'user-1';

function session(): ActiveWorkoutSession {
  return {
    id: 'session-1',
    user_id: userId,
    routine_day_id: 'day-1',
    name: 'Full Body A',
    status: 'in_progress',
    started_at: '2026-07-22T10:00:00.000Z',
    completed_at: null,
    body_weight: null,
    weight_unit: 'lb',
    notes: null,
    created_at: '2026-07-22T10:00:00.000Z',
    updated_at: '2026-07-22T10:00:00.000Z',
    exercises: [
      {
        id: 'session-exercise-1',
        session_id: 'session-1',
        exercise_id: 'exercise-1',
        exercise_order: 1,
        exercise_name_snapshot: 'Goblet Squat',
        primary_muscle_group_snapshot: 'Quads',
        target_sets_snapshot: 1,
        target_reps_min_snapshot: 8,
        target_reps_max_snapshot: 12,
        target_rest_seconds_snapshot: 90,
        target_weight_snapshot: 40,
        weight_unit_snapshot: 'lb',
        notes: null,
        sets: [
          {
            id: 'set-1',
            session_exercise_id: 'session-exercise-1',
            set_number: 1,
            weight: null,
            weight_unit: 'lb',
            reps: null,
            rpe: null,
            is_warmup: false,
            is_completed: false,
            is_skipped: false,
            rest_seconds_actual: null,
            completed_at: null,
            created_at: '2026-07-22T10:00:00.000Z',
            updated_at: '2026-07-22T10:00:00.000Z',
          },
        ],
      },
    ],
  };
}

beforeEach(() => {
  Object.defineProperty(navigator, 'onLine', {
    configurable: true,
    value: true,
  });
});

describe('active workout recovery', () => {
  it('restores only the current user in-progress session', () => {
    const active = session();
    cacheActiveWorkout(userId, active);

    expect(readCachedActiveWorkout(userId)).toEqual(active);
    expect(readCachedActiveWorkout('another-user')).toBeNull();
  });

  it('ignores malformed recovery data', () => {
    window.localStorage.setItem(
      `biotrack-v5-active-workout-cache:${userId}`,
      '{broken',
    );

    expect(readCachedActiveWorkout(userId)).toBeNull();
  });
});

describe('offline set outbox', () => {
  it('keeps the newest edit for a set and applies it to the recovered session', () => {
    queueWorkoutSetWrite(userId, 'session-1', 'set-1', {
      weight: 40,
      reps: 10,
      rpe: 7,
      is_warmup: false,
      is_completed: true,
    });
    queueWorkoutSetWrite(userId, 'session-1', 'set-1', {
      weight: 45,
      reps: 9,
      rpe: 8,
      is_warmup: false,
      is_completed: true,
    });

    const recovered = applyPendingWorkoutSetWrites(session(), userId);
    expect(getWorkoutSyncState(userId).pendingCount).toBe(1);
    expect(recovered.exercises[0]?.sets[0]).toMatchObject({
      weight: 45,
      reps: 9,
      rpe: 8,
      is_completed: true,
      is_skipped: false,
    });
  });

  it('flushes queued writes and clears the outbox', async () => {
    queueWorkoutSetWrite(userId, 'session-1', 'set-1', {
      weight: 45,
      reps: 9,
      rpe: 8,
      is_warmup: false,
      is_completed: true,
    });
    const persist = vi.fn().mockResolvedValue({ ok: true, data: null });

    await expect(
      flushPendingWorkoutSetWrites(userId, persist),
    ).resolves.toEqual({
      ok: true,
      synced: 1,
    });
    expect(persist).toHaveBeenCalledOnce();
    expect(getWorkoutSyncState(userId).pendingCount).toBe(0);
  });

  it('preserves queued writes while offline', async () => {
    Object.defineProperty(navigator, 'onLine', {
      configurable: true,
      value: false,
    });
    queueWorkoutSetWrite(userId, 'session-1', 'set-1', {
      weight: 45,
      reps: 9,
      rpe: null,
      is_warmup: false,
      is_completed: true,
    });
    const persist = vi.fn();

    await expect(
      flushPendingWorkoutSetWrites(userId, persist),
    ).resolves.toEqual({
      ok: false,
      error: 'You are offline.',
      synced: 0,
    });
    expect(persist).not.toHaveBeenCalled();
    expect(getWorkoutSyncState(userId).pendingCount).toBe(1);
  });
});
