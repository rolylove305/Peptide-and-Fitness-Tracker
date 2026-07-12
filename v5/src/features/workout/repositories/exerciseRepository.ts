import { supabase } from '../../../lib/supabase/client';
import type { Exercise } from '../../../types/database';

export type RepositoryResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string };

function errorMessage(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;

  if (
    typeof error === 'object' &&
    error !== null &&
    'message' in error &&
    typeof error.message === 'string' &&
    error.message.length > 0
  ) {
    return error.message;
  }

  return 'BioTrack could not load the exercise library.';
}

export async function loadExerciseLibrary(): Promise<RepositoryResult<Exercise[]>> {
  if (!supabase) {
    return {
      ok: false,
      error: 'Supabase is not configured for BioTrack AI V5.',
    };
  }

  try {
    const { data, error } = await supabase
      .from('exercise_library')
      .select('*')
      .eq('is_active', true)
      .order('primary_muscle_group', { ascending: true })
      .order('name', { ascending: true });

    if (error) throw error;

    return {
      ok: true,
      data: data ?? [],
    };
  } catch (error) {
    return {
      ok: false,
      error: errorMessage(error),
    };
  }
}
