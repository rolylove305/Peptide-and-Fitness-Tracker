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

type ActiveWorkoutStatus = 'loading' | 'idle' | 'active' | 'error';

type SetMutation = () => Promise<{ ok: true; data: null } | { ok: false; error: string }>;

export function useActiveWorkout(userId: string | undefined) {
  const [status, setStatus] = useState<ActiveWorkoutStatus>('loading');
  const [session, setSession] = useState<ActiveWorkoutSession | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [startingDayId, setStartingDayId] = useState<string | null>(null);
  const [savingSetId, setSavingSetId] = useState<string | null>(null);
  const [addingSetExerciseId, setAddingSetExerciseId] = useState<string | null>(null);
  const [savingSessionDetails, setSavingSessionDetails] = useState(false);
  const [savingExerciseId, setSavingExerciseId] = useState<string | null>(null);
  const [finishing, setFinishing] = useState(false);

  const reload = useCallback(async (silent: boolean) => {
    if (!userId) {
      setSession(null);
      setStatus('idle');
      return;
    }

    if (!silent) setStatus('loading');
    setError(null);
    const result = await loadActiveWorkout(userId);
    if (!result.ok) {
      setStatus('error');
      setError(result.error);
      return;
    }

    setSession(result.data);
    setStatus(result.data ? 'active' : 'idle');
  }, [userId]);

  useEffect(() => {
    void reload(false);
  }, [reload]);

  const start = useCallback(
    async (dayId: string) => {
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
    (setId: string, input: WorkoutSetInput) =>
      runSetMutation(setId, () => saveWorkoutSet(setId, input)),
    [runSetMutation],
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
      setAddingSetExerciseId(sessionExerciseId);
      setError(null);
      try {
        const result = await addWorkoutSet(sessionExerciseId, setNumber, weightUnit);
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
      if (!session) return { ok: false as const, error: 'No active workout was found.' };
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
    if (!session) return { ok: false as const, error: 'No active workout was found.' };

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

      await reload(false);
      return result;
    } finally {
      setFinishing(false);
    }
  }, [reload, session, userId]);

  const cancel = useCallback(async () => {
    if (!session) return { ok: false as const, error: 'No active workout was found.' };
    setFinishing(true);
    setError(null);
    try {
      const result = await cancelWorkout(session.id);
      if (!result.ok) {
        setError(result.error);
        return result;
      }
      await reload(false);
      return result;
    } finally {
      setFinishing(false);
    }
  }, [reload, session]);

  const refresh = useCallback(() => reload(false), [reload]);

  return {
    status,
    session,
    error,
    startingDayId,
    savingSetId,
    addingSetExerciseId,
    savingSessionDetails,
    savingExerciseId,
    finishing,
    refresh,
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
