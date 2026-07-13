import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type PropsWithChildren,
} from 'react';
import type { ExerciseMediaBundle, ExerciseMediaLibrary } from './exerciseMedia';
import { hasRenderableExerciseMedia } from './exerciseMedia';
import { loadExerciseMediaLibrary } from './repositories/exerciseMediaRepository';

type ExerciseMediaStatus = 'loading' | 'ready' | 'error';

type ExerciseMediaContextValue = {
  status: ExerciseMediaStatus;
  error: string | null;
  bundlesByExerciseId: ExerciseMediaLibrary;
  getBundle: (exerciseId: string) => ExerciseMediaBundle | null;
  hasRenderableMedia: (exerciseId: string) => boolean;
  refresh: () => Promise<void>;
};

const emptyLibrary: ExerciseMediaLibrary = new Map();

const ExerciseMediaContext = createContext<ExerciseMediaContextValue | null>(null);

export function ExerciseMediaProvider({ children }: PropsWithChildren) {
  const [status, setStatus] = useState<ExerciseMediaStatus>('loading');
  const [error, setError] = useState<string | null>(null);
  const [bundlesByExerciseId, setBundlesByExerciseId] = useState<ExerciseMediaLibrary>(emptyLibrary);

  const refresh = useCallback(async () => {
    setStatus('loading');
    setError(null);

    const result = await loadExerciseMediaLibrary();
    if (!result.ok) {
      setStatus('error');
      setError(result.error);
      return;
    }

    setBundlesByExerciseId(result.data);
    setStatus('ready');
  }, []);

  useEffect(() => {
    let active = true;

    void loadExerciseMediaLibrary().then((result) => {
      if (!active) return;

      if (!result.ok) {
        setStatus('error');
        setError(result.error);
        return;
      }

      setBundlesByExerciseId(result.data);
      setStatus('ready');
    });

    return () => {
      active = false;
    };
  }, []);

  const getBundle = useCallback(
    (exerciseId: string) => bundlesByExerciseId.get(exerciseId) ?? null,
    [bundlesByExerciseId],
  );

  const hasRenderableMedia = useCallback(
    (exerciseId: string) => hasRenderableExerciseMedia(bundlesByExerciseId.get(exerciseId)),
    [bundlesByExerciseId],
  );

  const value = useMemo<ExerciseMediaContextValue>(
    () => ({
      status,
      error,
      bundlesByExerciseId,
      getBundle,
      hasRenderableMedia,
      refresh,
    }),
    [bundlesByExerciseId, error, getBundle, hasRenderableMedia, refresh, status],
  );

  return <ExerciseMediaContext.Provider value={value}>{children}</ExerciseMediaContext.Provider>;
}

export function useExerciseMediaLibrary(): ExerciseMediaContextValue {
  const context = useContext(ExerciseMediaContext);
  if (!context) {
    throw new Error('useExerciseMediaLibrary must be used inside ExerciseMediaProvider.');
  }
  return context;
}

export function useExerciseMedia(exerciseId: string): ExerciseMediaBundle | null {
  return useExerciseMediaLibrary().getBundle(exerciseId);
}
