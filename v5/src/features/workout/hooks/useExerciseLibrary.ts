import { useCallback, useEffect, useState } from 'react';
import type { Exercise } from '../../../types/database';
import { loadExerciseLibrary } from '../repositories/exerciseRepository';

export type ExerciseLibraryStatus = 'loading' | 'ready' | 'empty' | 'error';

export function useExerciseLibrary() {
  const [status, setStatus] = useState<ExerciseLibraryStatus>('loading');
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [requestVersion, setRequestVersion] = useState(0);

  const refresh = useCallback(() => {
    setRequestVersion((current) => current + 1);
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setStatus('loading');
      setError(null);

      const result = await loadExerciseLibrary();
      if (cancelled) return;

      if (!result.ok) {
        setExercises([]);
        setError(result.error);
        setStatus('error');
        return;
      }

      setExercises(result.data);
      setStatus(result.data.length > 0 ? 'ready' : 'empty');
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, [requestVersion]);

  return {
    status,
    exercises,
    error,
    refresh,
  } as const;
}
