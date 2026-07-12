import { useCallback, useEffect, useState } from 'react';
import {
  cancelWorkout,
  completeWorkout,
  loadActiveWorkout,
  saveWorkoutSet,
  startWorkoutFromDay,
  type ActiveWorkoutSession,
  type WorkoutSetInput,
} from '../repositories/activeWorkoutRepository';

type ActiveWorkoutStatus = 'loading' | 'idle' | 'active' | 'error';

export function useActiveWorkout(userId: string | undefined) {
  const [status, setStatus] = useState<ActiveWorkoutStatus>('loading');
  const [session, setSession] = useState<ActiveWorkoutSession | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [startingDayId, setStartingDayId] = useState<string | null>(null);
  const [savingSetId, setSavingSetId] = useState<string | null>(null);
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

  const saveSet = useCallback(
    async (setId: string, input: WorkoutSetInput) => {
      setSavingSetId(setId);
      setError(null);
      try {
        const result = await saveWorkoutSet(setId, input);
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

  const finish = useCallback(async () => {
    if (!session) return { ok: false as const, error: 'No active workout was found.' };
    setFinishing(true);
    setError(null);
    try {
      const result = await completeWorkout(session.id);
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
    finishing,
    refresh,
    start,
    saveSet,
    finish,
    cancel,
  };
}
