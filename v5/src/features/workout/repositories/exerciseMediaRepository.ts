import type { SupabaseClient } from '@supabase/supabase-js';
import { supabase } from '../../../lib/supabase/client';
import type { Database } from '../../../types/database';
import type {
  ExerciseMediaAsset,
  ExerciseMediaBundle,
  ExerciseMediaLibrary,
  ExerciseTechniqueGuide,
} from '../exerciseMedia';
import type { RepositoryResult } from './exerciseRepository';

type ReadOnlyTable<Row> = {
  Row: Row;
  Insert: Partial<Row>;
  Update: Partial<Row>;
  Relationships: [];
};

type ExerciseMediaDatabase = Omit<Database, 'public'> & {
  public: Omit<Database['public'], 'Tables'> & {
    Tables: Database['public']['Tables'] & {
      exercise_media_assets: ReadOnlyTable<ExerciseMediaAsset>;
      exercise_technique_guides: ReadOnlyTable<ExerciseTechniqueGuide>;
    };
  };
};

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

  return 'BioTrack could not load professional exercise media.';
}

function getMediaClient(): SupabaseClient<ExerciseMediaDatabase> | null {
  return supabase as SupabaseClient<ExerciseMediaDatabase> | null;
}

export async function loadExerciseMediaLibrary(): Promise<RepositoryResult<ExerciseMediaLibrary>> {
  const client = getMediaClient();
  if (!client) {
    return {
      ok: false,
      error: 'Supabase is not configured for the BioTrack Exercise Media Engine.',
    };
  }

  try {
    const [assetsResult, guidesResult] = await Promise.all([
      client
        .from('exercise_media_assets')
        .select('*')
        .eq('is_active', true)
        .order('exercise_id', { ascending: true })
        .order('media_role', { ascending: true })
        .order('sort_order', { ascending: true }),
      client
        .from('exercise_technique_guides')
        .select('*')
        .eq('is_active', true)
        .eq('status', 'published')
        .order('updated_at', { ascending: false }),
    ]);

    if (assetsResult.error) throw assetsResult.error;
    if (guidesResult.error) throw guidesResult.error;

    const bundles = new Map<string, ExerciseMediaBundle>();

    for (const asset of assetsResult.data ?? []) {
      const current = bundles.get(asset.exercise_id) ?? {
        exerciseId: asset.exercise_id,
        assets: [],
        guide: null,
      };
      current.assets.push(asset);
      bundles.set(asset.exercise_id, current);
    }

    for (const guide of guidesResult.data ?? []) {
      const current = bundles.get(guide.exercise_id) ?? {
        exerciseId: guide.exercise_id,
        assets: [],
        guide: null,
      };
      current.guide = guide;
      bundles.set(guide.exercise_id, current);
    }

    return {
      ok: true,
      data: bundles,
    };
  } catch (error) {
    return {
      ok: false,
      error: errorMessage(error),
    };
  }
}
