import type { SupabaseClient } from '@supabase/supabase-js';
import { supabase } from '../../../lib/supabase/client';
import type { Database, Json } from '../../../types/database';
import type {
  ProgressionConfidence,
  ProgressionRecommendationType,
} from './progressionRepository';

export type RepositoryResult<T> =
  { ok: true; data: T } | { ok: false; error: string };

export type ProgressionChangeStatus = 'applied' | 'undone';
export type ApplicableRecommendationType = Extract<
  ProgressionRecommendationType,
  'increase_load' | 'increase_reps'
>;

export type ProgressionChange = {
  id: string;
  user_id: string;
  routine_exercise_id: string | null;
  exercise_id: string;
  exercise_name_snapshot: string;
  routine_name_snapshot: string;
  day_name_snapshot: string;
  recommendation_type: ApplicableRecommendationType;
  confidence: ProgressionConfidence;
  recommendation_snapshot: Json;
  before_target_weight: number | null;
  before_weight_unit: 'lb' | 'kg';
  before_reps_min: number | null;
  before_reps_max: number | null;
  after_target_weight: number | null;
  after_weight_unit: 'lb' | 'kg';
  after_reps_min: number | null;
  after_reps_max: number | null;
  status: ProgressionChangeStatus;
  applied_at: string;
  undone_at: string | null;
  created_at: string;
  updated_at: string;
};

export type ApplyProgressionChangeInput = {
  routineExerciseId: string;
  recommendationType: ApplicableRecommendationType;
  recommendationWeightUnit: 'lb' | 'kg';
  expectedTargetWeight: number | null;
  expectedWeightUnit: 'lb' | 'kg';
  expectedRepsMin: number | null;
  expectedRepsMax: number | null;
  proposedTargetWeight: number | null;
  proposedWeightUnit: 'lb' | 'kg';
  proposedRepsMin: number;
  proposedRepsMax: number;
};

type ProgressionChangeTable = {
  Row: ProgressionChange;
  Insert: Omit<ProgressionChange, 'id' | 'created_at' | 'updated_at'> & {
    id?: string;
    created_at?: string;
    updated_at?: string;
  };
  Update: Partial<ProgressionChange>;
  Relationships: [];
};

type ProgressionChangeDatabase = Omit<Database, 'public'> & {
  public: Omit<Database['public'], 'Tables' | 'Functions'> & {
    Tables: Database['public']['Tables'] & {
      workout_progression_changes: ProgressionChangeTable;
    };
    Functions: Database['public']['Functions'] & {
      apply_workout_progression_change: {
        Args: {
          p_routine_exercise_id: string;
          p_expected_recommendation_type: ApplicableRecommendationType;
          p_expected_recommendation_weight_unit: 'lb' | 'kg';
          p_expected_target_weight: number | null;
          p_expected_weight_unit: 'lb' | 'kg';
          p_expected_reps_min: number | null;
          p_expected_reps_max: number | null;
          p_proposed_target_weight: number | null;
          p_proposed_weight_unit: 'lb' | 'kg';
          p_proposed_reps_min: number;
          p_proposed_reps_max: number;
        };
        Returns: string;
      };
      undo_workout_progression_change: {
        Args: { p_change_id: string };
        Returns: undefined;
      };
    };
  };
};

function client(): SupabaseClient<ProgressionChangeDatabase> | null {
  return supabase as unknown as SupabaseClient<ProgressionChangeDatabase> | null;
}

function messageFrom(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === 'object' && error && 'message' in error) {
    const message = String((error as { message?: unknown }).message ?? '');
    if (message) return message;
  }
  return fallback;
}

export async function loadProgressionChanges(
  userId: string,
  limit = 30,
): Promise<RepositoryResult<ProgressionChange[]>> {
  const database = client();
  if (!database) {
    return {
      ok: false,
      error: 'Supabase is not configured for BioTrack AI V5.',
    };
  }

  try {
    const { data, error } = await database
      .from('workout_progression_changes')
      .select('*')
      .eq('user_id', userId)
      .order('applied_at', { ascending: false })
      .limit(limit);

    if (error) throw error;
    return { ok: true, data: data ?? [] };
  } catch (error) {
    return {
      ok: false,
      error: messageFrom(
        error,
        'BioTrack could not load progression change history.',
      ),
    };
  }
}

export async function applyProgressionChange(
  input: ApplyProgressionChangeInput,
): Promise<RepositoryResult<string>> {
  const database = client();
  if (!database) {
    return {
      ok: false,
      error: 'Supabase is not configured for BioTrack AI V5.',
    };
  }

  try {
    const { data, error } = await database.rpc(
      'apply_workout_progression_change',
      {
        p_routine_exercise_id: input.routineExerciseId,
        p_expected_recommendation_type: input.recommendationType,
        p_expected_recommendation_weight_unit: input.recommendationWeightUnit,
        p_expected_target_weight: input.expectedTargetWeight,
        p_expected_weight_unit: input.expectedWeightUnit,
        p_expected_reps_min: input.expectedRepsMin,
        p_expected_reps_max: input.expectedRepsMax,
        p_proposed_target_weight: input.proposedTargetWeight,
        p_proposed_weight_unit: input.proposedWeightUnit,
        p_proposed_reps_min: input.proposedRepsMin,
        p_proposed_reps_max: input.proposedRepsMax,
      },
    );

    if (error) throw error;
    if (!data)
      throw new Error(
        'The progression was applied, but no change ID was returned.',
      );
    return { ok: true, data };
  } catch (error) {
    return {
      ok: false,
      error: messageFrom(
        error,
        'BioTrack could not apply this progression change.',
      ),
    };
  }
}

export async function undoProgressionChange(
  changeId: string,
): Promise<RepositoryResult<null>> {
  const database = client();
  if (!database) {
    return {
      ok: false,
      error: 'Supabase is not configured for BioTrack AI V5.',
    };
  }

  try {
    const { error } = await database.rpc('undo_workout_progression_change', {
      p_change_id: changeId,
    });

    if (error) throw error;
    return { ok: true, data: null };
  } catch (error) {
    return {
      ok: false,
      error: messageFrom(
        error,
        'BioTrack could not undo this progression change.',
      ),
    };
  }
}
