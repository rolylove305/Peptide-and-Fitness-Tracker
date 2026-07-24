import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  loadProgressionRecommendations,
  type ProgressionRecommendation,
} from '../repositories/progressionRepository';

export type ProgressionStatus = 'loading' | 'ready' | 'empty' | 'error';

export function useProgressionRecommendations(exerciseIds?: string[]) {
  const normalizedExerciseKey = Array.from(new Set(exerciseIds ?? []))
    .sort()
    .join(',');
  const [status, setStatus] = useState<ProgressionStatus>('loading');
  const [recommendations, setRecommendations] = useState<
    ProgressionRecommendation[]
  >([]);
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

      const ids = normalizedExerciseKey
        ? normalizedExerciseKey.split(',')
        : undefined;
      const result = await loadProgressionRecommendations(ids, 3);

      if (cancelled) return;
      if (!result.ok) {
        setRecommendations([]);
        setError(result.error);
        setStatus('error');
        return;
      }

      setRecommendations(result.data);
      setStatus(result.data.length > 0 ? 'ready' : 'empty');
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [normalizedExerciseKey, requestVersion]);

  const byExerciseId = useMemo(() => {
    const grouped: Record<string, ProgressionRecommendation[]> = {};
    recommendations.forEach((recommendation) => {
      grouped[recommendation.exercise_id] = [
        ...(grouped[recommendation.exercise_id] ?? []),
        recommendation,
      ];
    });
    return grouped;
  }, [recommendations]);

  return {
    status,
    recommendations,
    byExerciseId,
    error,
    refresh,
  } as const;
}
