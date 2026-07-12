import { useCallback, useEffect, useState } from 'react';
import {
  applyProgressionChange,
  loadProgressionChanges,
  undoProgressionChange,
  type ApplyProgressionChangeInput,
  type ProgressionChange,
} from '../repositories/progressionChangeRepository';

export type ProgressionChangeStatus = 'loading' | 'ready' | 'empty' | 'error';

export function useProgressionChanges(userId: string | undefined) {
  const [status, setStatus] = useState<ProgressionChangeStatus>('loading');
  const [changes, setChanges] = useState<ProgressionChange[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [applyingExerciseId, setApplyingExerciseId] = useState<string | null>(null);
  const [undoingChangeId, setUndoingChangeId] = useState<string | null>(null);
  const [requestVersion, setRequestVersion] = useState(0);

  const refresh = useCallback(() => {
    setRequestVersion((current) => current + 1);
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (!userId) {
        setChanges([]);
        setStatus('empty');
        return;
      }

      setStatus('loading');
      setError(null);
      const result = await loadProgressionChanges(userId);
      if (cancelled) return;

      if (!result.ok) {
        setChanges([]);
        setError(result.error);
        setStatus('error');
        return;
      }

      setChanges(result.data);
      setStatus(result.data.length > 0 ? 'ready' : 'empty');
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [requestVersion, userId]);

  const apply = useCallback(
    async (exerciseId: string, input: ApplyProgressionChangeInput) => {
      setApplyingExerciseId(exerciseId);
      setError(null);
      try {
        const result = await applyProgressionChange(input);
        if (!result.ok) {
          setError(result.error);
          return result;
        }
        refresh();
        return result;
      } finally {
        setApplyingExerciseId(null);
      }
    },
    [refresh],
  );

  const undo = useCallback(
    async (changeId: string) => {
      setUndoingChangeId(changeId);
      setError(null);
      try {
        const result = await undoProgressionChange(changeId);
        if (!result.ok) {
          setError(result.error);
          return result;
        }
        refresh();
        return result;
      } finally {
        setUndoingChangeId(null);
      }
    },
    [refresh],
  );

  return {
    status,
    changes,
    error,
    applyingExerciseId,
    undoingChangeId,
    refresh,
    apply,
    undo,
  } as const;
}
