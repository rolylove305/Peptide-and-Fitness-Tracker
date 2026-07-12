import type { SupabaseClient } from '@supabase/supabase-js';
import { supabase } from '../../../lib/supabase/client';
import type { Database, Json } from '../../../types/database';

export type RepositoryResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string };

export type ProgressionRecommendationType =
  | 'increase_load'
  | 'increase_reps'
  | 'review_recovery'
  | 'hold'
  | 'insufficient_data';

export type ProgressionConfidence = 'low' | 'medium' | 'high';

export type ProgressionEvidenceSession = {
  session_id: string;
  performed_at: string;
  completed_set_count: number;
  average_reps: number;
  minimum_reps: number;
  maximum_reps: number;
  maximum_weight: number | null;
  average_rpe: number | null;
  rpe_set_count: number;
  target_reps_min: number | null;
  target_reps_max: number | null;
};

export type ProgressionRecommendation = {
  exercise_id: string;
  exercise_name: string;
  primary_muscle_group: string;
  weight_unit: 'lb' | 'kg';
  recommendation_type: ProgressionRecommendationType;
  confidence: ProgressionConfidence;
  sessions_analyzed: number;
  latest_performed_at: string;
  latest_weight: number | null;
  latest_average_reps: number;
  latest_average_rpe: number | null;
  target_reps_min: number | null;
  target_reps_max: number | null;
  action_label: string;
  rationale: string;
  evidence: ProgressionEvidenceSession[];
};

type ProgressionRpcRow = {
  exercise_id: string;
  exercise_name: string;
  primary_muscle_group: string;
  weight_unit: string;
  recommendation_type: string;
  confidence: string;
  sessions_analyzed: number;
  latest_performed_at: string;
  latest_weight: number | null;
  latest_average_reps: number;
  latest_average_rpe: number | null;
  target_reps_min: number | null;
  target_reps_max: number | null;
  action_label: string;
  rationale: string;
  evidence: Json;
};

type ProgressionPublicSchema = Omit<Database['public'], 'Functions'> & {
  Functions: Database['public']['Functions'] & {
    get_workout_progression_recommendations: {
      Args: {
        p_exercise_ids?: string[] | null;
        p_session_limit?: number;
      };
      Returns: ProgressionRpcRow[];
    };
  };
};

type ProgressionDatabase = Omit<Database, 'public'> & {
  public: ProgressionPublicSchema;
};

function progressionClient(): SupabaseClient<ProgressionDatabase> | null {
  return supabase as unknown as SupabaseClient<ProgressionDatabase> | null;
}

function messageFrom(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === 'object' && error && 'message' in error) {
    const message = String((error as { message?: unknown }).message ?? '');
    if (message) return message;
  }
  return fallback;
}

function numberOrNull(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function numberOrZero(value: unknown): number {
  return numberOrNull(value) ?? 0;
}

function isRecommendationType(value: string): value is ProgressionRecommendationType {
  return [
    'increase_load',
    'increase_reps',
    'review_recovery',
    'hold',
    'insufficient_data',
  ].includes(value);
}

function isConfidence(value: string): value is ProgressionConfidence {
  return value === 'low' || value === 'medium' || value === 'high';
}

function isWeightUnit(value: string): value is 'lb' | 'kg' {
  return value === 'lb' || value === 'kg';
}

function parseEvidence(value: Json): ProgressionEvidenceSession[] {
  if (!Array.isArray(value)) return [];

  return value.flatMap((item) => {
    if (!item || Array.isArray(item) || typeof item !== 'object') return [];
    if (typeof item.session_id !== 'string' || typeof item.performed_at !== 'string') return [];

    return [{
      session_id: item.session_id,
      performed_at: item.performed_at,
      completed_set_count: numberOrZero(item.completed_set_count),
      average_reps: numberOrZero(item.average_reps),
      minimum_reps: numberOrZero(item.minimum_reps),
      maximum_reps: numberOrZero(item.maximum_reps),
      maximum_weight: numberOrNull(item.maximum_weight),
      average_rpe: numberOrNull(item.average_rpe),
      rpe_set_count: numberOrZero(item.rpe_set_count),
      target_reps_min: numberOrNull(item.target_reps_min),
      target_reps_max: numberOrNull(item.target_reps_max),
    }];
  });
}

function normalizeRecommendation(row: ProgressionRpcRow): ProgressionRecommendation | null {
  if (
    !row.exercise_id ||
    !row.exercise_name ||
    !row.primary_muscle_group ||
    !row.latest_performed_at ||
    !row.action_label ||
    !row.rationale ||
    !isWeightUnit(row.weight_unit) ||
    !isRecommendationType(row.recommendation_type) ||
    !isConfidence(row.confidence)
  ) {
    return null;
  }

  return {
    exercise_id: row.exercise_id,
    exercise_name: row.exercise_name,
    primary_muscle_group: row.primary_muscle_group,
    weight_unit: row.weight_unit,
    recommendation_type: row.recommendation_type,
    confidence: row.confidence,
    sessions_analyzed: numberOrZero(row.sessions_analyzed),
    latest_performed_at: row.latest_performed_at,
    latest_weight: numberOrNull(row.latest_weight),
    latest_average_reps: numberOrZero(row.latest_average_reps),
    latest_average_rpe: numberOrNull(row.latest_average_rpe),
    target_reps_min: numberOrNull(row.target_reps_min),
    target_reps_max: numberOrNull(row.target_reps_max),
    action_label: row.action_label,
    rationale: row.rationale,
    evidence: parseEvidence(row.evidence),
  };
}

export async function loadProgressionRecommendations(
  exerciseIds?: string[],
  sessionLimit = 3,
): Promise<RepositoryResult<ProgressionRecommendation[]>> {
  const client = progressionClient();
  if (!client) {
    return { ok: false, error: 'Supabase is not configured for BioTrack AI V5.' };
  }

  const uniqueExerciseIds = exerciseIds?.length
    ? Array.from(new Set(exerciseIds))
    : null;

  try {
    const { data, error } = await client.rpc('get_workout_progression_recommendations', {
      p_exercise_ids: uniqueExerciseIds,
      p_session_limit: Math.max(2, Math.min(sessionLimit, 6)),
    });

    if (error) throw error;

    return {
      ok: true,
      data: (data ?? []).flatMap((row) => {
        const normalized = normalizeRecommendation(row);
        return normalized ? [normalized] : [];
      }),
    };
  } catch (error) {
    return {
      ok: false,
      error: messageFrom(error, 'BioTrack could not calculate progression guidance.'),
    };
  }
}
