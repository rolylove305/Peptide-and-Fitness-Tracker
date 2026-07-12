import { useCallback, useEffect, useState } from 'react';
import {
  deleteRoutineTree,
  loadRoutineTrees,
  saveRoutineTree,
  type RoutineDraft,
  type RoutineTree,
} from '../repositories/routineRepository';

type RoutineStatus = 'loading' | 'ready' | 'empty' | 'error';

export function useRoutines(userId: string | undefined) {
  const [status, setStatus] = useState<RoutineStatus>('loading');
  const [routines, setRoutines] = useState<RoutineTree[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!userId) {
      setRoutines([]);
      setStatus('empty');
      return;
    }

    setStatus('loading');
    setError(null);
    const result = await loadRoutineTrees(userId);

    if (!result.ok) {
      setStatus('error');
      setError(result.error);
      return;
    }

    setRoutines(result.data);
    setStatus(result.data.length === 0 ? 'empty' : 'ready');
  }, [userId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const save = useCallback(
    async (draft: RoutineDraft, routineId: string | null) => {
      setSaving(true);
      setError(null);
      try {
        const result = await saveRoutineTree(draft, routineId);
        if (!result.ok) {
          setError(result.error);
          return result;
        }
        await refresh();
        return result;
      } finally {
        setSaving(false);
      }
    },
    [refresh],
  );

  const remove = useCallback(
    async (routineId: string) => {
      if (!userId) return { ok: false as const, error: 'No signed-in user was found.' };
      setDeletingId(routineId);
      setError(null);
      try {
        const result = await deleteRoutineTree(userId, routineId);
        if (!result.ok) {
          setError(result.error);
          return result;
        }
        await refresh();
        return result;
      } finally {
        setDeletingId(null);
      }
    },
    [refresh, userId],
  );

  return { status, routines, error, saving, deletingId, refresh, save, remove };
}
