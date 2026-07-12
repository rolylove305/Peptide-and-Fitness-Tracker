import { useEffect, useMemo, useState } from 'react';
import {
  loadPreviousExercisePerformance,
  type PreviousExercisePerformance,
} from '../repositories/workoutHistoryRepository';

export type PreviousPerformanceStatus = 'idle' | 'loading' | 'ready' | 'error';

export function usePreviousPerformance(exerciseIds: string[]) {
  const key = useMemo(
    () => Array.from(new Set(exerciseIds)).sort((a, b) => a.localeCompare(b)).join(','),
    [exerciseIds],
  );
  const [status, setStatus] = useState<PreviousPerformanceStatus>('idle');
  const [byExerciseId, setByExerciseId] = useState<Record<string, PreviousExercisePerformance>>({});
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const ids = key ? key.split(',') : [];

    async function load() {
      if (ids.length === 0) {
        setByExerciseId({});
        setStatus('idle');
        setError(null);
        return;
      }

      setStatus('loading');
      setError(null);
      const result = await loadPreviousExercisePerformance(ids);
      if (cancelled) return;

      if (!result.ok) {
        setByExerciseId({});
        setStatus('error');
        setError(result.error);
        return;
      }

      setByExerciseId(
        Object.fromEntries(result.data.map((performance) => [performance.exercise_id, performance])),
      );
      setStatus('ready');
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [key]);

  return { status, byExerciseId, error } as const;
}
