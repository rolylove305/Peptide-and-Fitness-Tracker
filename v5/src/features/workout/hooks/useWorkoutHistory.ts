import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  loadExerciseRecords,
  loadMuscleVolume,
  loadWorkoutHistory,
  loadWorkoutSessionDetail,
  type ExerciseRecord,
  type MuscleVolumeDay,
  type WorkoutSessionDetail,
  type WorkoutSessionSummary,
} from '../repositories/workoutHistoryRepository';

export type WorkoutHistoryStatus = 'loading' | 'ready' | 'empty' | 'error';

function dateDaysAgo(days: number): string {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() - days);
  return date.toISOString().slice(0, 10);
}

export function useWorkoutHistory(userId: string | undefined) {
  const [status, setStatus] = useState<WorkoutHistoryStatus>('loading');
  const [history, setHistory] = useState<WorkoutSessionSummary[]>([]);
  const [records, setRecords] = useState<ExerciseRecord[]>([]);
  const [muscleVolume, setMuscleVolume] = useState<MuscleVolumeDay[]>([]);
  const [details, setDetails] = useState<Record<string, WorkoutSessionDetail>>(
    {},
  );
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(
    null,
  );
  const [loadingDetailId, setLoadingDetailId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [requestVersion, setRequestVersion] = useState(0);

  const refresh = useCallback(() => {
    setRequestVersion((current) => current + 1);
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (!userId) {
        setHistory([]);
        setRecords([]);
        setMuscleVolume([]);
        setDetails({});
        setSelectedSessionId(null);
        setStatus('empty');
        return;
      }

      setStatus('loading');
      setError(null);

      const [historyResult, recordsResult, muscleResult] = await Promise.all([
        loadWorkoutHistory(userId),
        loadExerciseRecords(userId),
        loadMuscleVolume(userId, dateDaysAgo(89)),
      ]);

      if (cancelled) return;

      const failedResult = [historyResult, recordsResult, muscleResult].find(
        (result) => !result.ok,
      );
      if (failedResult && !failedResult.ok) {
        setError(failedResult.error);
        setStatus('error');
        return;
      }

      if (!historyResult.ok || !recordsResult.ok || !muscleResult.ok) return;

      setHistory(historyResult.data);
      setRecords(recordsResult.data);
      setMuscleVolume(muscleResult.data);
      setDetails({});
      setSelectedSessionId(null);
      setStatus(historyResult.data.length > 0 ? 'ready' : 'empty');
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [requestVersion, userId]);

  const selectedDetail = useMemo(
    () => (selectedSessionId ? (details[selectedSessionId] ?? null) : null),
    [details, selectedSessionId],
  );

  const toggleSession = useCallback(
    async (sessionId: string) => {
      if (!userId) return;
      if (selectedSessionId === sessionId) {
        setSelectedSessionId(null);
        return;
      }

      setSelectedSessionId(sessionId);
      if (details[sessionId]) return;

      setLoadingDetailId(sessionId);
      setError(null);
      const result = await loadWorkoutSessionDetail(userId, sessionId);
      setLoadingDetailId(null);

      if (!result.ok) {
        setError(result.error);
        return;
      }
      if (!result.data) {
        setError('This completed workout could not be found.');
        return;
      }

      setDetails((current) => ({
        ...current,
        [sessionId]: result.data as WorkoutSessionDetail,
      }));
    },
    [details, selectedSessionId, userId],
  );

  return {
    status,
    history,
    records,
    muscleVolume,
    selectedSessionId,
    selectedDetail,
    loadingDetailId,
    error,
    refresh,
    toggleSession,
  } as const;
}
