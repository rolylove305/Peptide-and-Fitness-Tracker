import { supabase } from '../../../lib/supabase/client';
import type { Database, Json } from '../../../types/database';

export type RepositoryResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string };

export type WorkoutSessionSummary = {
  id: string;
  user_id: string;
  routine_day_id: string | null;
  name: string;
  started_at: string;
  completed_at: string;
  duration_seconds: number;
  exercise_count: number;
  completed_set_count: number;
  working_set_count: number;
  total_reps: number;
  total_volume: number;
  weight_unit: 'lb' | 'kg';
};

export type ExerciseRecord = {
  user_id: string;
  exercise_id: string;
  exercise_name: string;
  primary_muscle_group: string;
  weight_unit: 'lb' | 'kg';
  session_count: number;
  completed_set_count: number;
  total_reps: number;
  heaviest_weight: number | null;
  highest_reps: number | null;
  best_set_volume: number | null;
  last_performed_at: string;
};

export type MuscleVolumeDay = {
  user_id: string;
  workout_date: string;
  muscle_group: string;
  weight_unit: 'lb' | 'kg';
  completed_set_count: number;
  total_reps: number;
  total_volume: number;
};

export type WorkoutHistorySet = {
  id: string;
  set_number: number;
  weight: number | null;
  weight_unit: 'lb' | 'kg';
  reps: number | null;
  rpe: number | null;
  is_warmup: boolean;
  is_completed: boolean;
  completed_at: string | null;
};

export type WorkoutHistoryExercise = {
  id: string;
  exercise_id: string;
  exercise_order: number;
  exercise_name_snapshot: string;
  primary_muscle_group_snapshot: string | null;
  target_sets_snapshot: number;
  target_reps_min_snapshot: number | null;
  target_reps_max_snapshot: number | null;
  target_rest_seconds_snapshot: number;
  notes: string | null;
  sets: WorkoutHistorySet[];
};

export type WorkoutSessionDetail = {
  id: string;
  user_id: string;
  name: string;
  status: 'completed';
  started_at: string;
  completed_at: string;
  body_weight: number | null;
  weight_unit: 'lb' | 'kg';
  notes: string | null;
  exercises: WorkoutHistoryExercise[];
};

export type PreviousPerformanceSet = {
  set_number: number;
  weight: number | null;
  reps: number | null;
  rpe: number | null;
};

export type PreviousExercisePerformance = {
  exercise_id: string;
  session_id: string;
  performed_at: string;
  weight_unit: 'lb' | 'kg';
  sets: PreviousPerformanceSet[];
};

type SessionSummaryRow = Database['public']['Views']['workout_session_summaries']['Row'];
type ExerciseRecordRow = Database['public']['Views']['workout_exercise_records']['Row'];
type MuscleVolumeRow = Database['public']['Views']['workout_muscle_volume_daily']['Row'];

type SessionDetailQueryRow = Omit<WorkoutSessionDetail, 'exercises' | 'status' | 'completed_at'> & {
  status: string;
  completed_at: string | null;
  workout_session_exercises: Array<
    Omit<WorkoutHistoryExercise, 'sets'> & {
      workout_sets: WorkoutHistorySet[];
    }
  >;
};

function messageFrom(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === 'object' && error && 'message' in error) {
    const message = String((error as { message?: unknown }).message ?? '');
    if (message) return message;
  }
  return fallback;
}

function isWeightUnit(value: string | null): value is 'lb' | 'kg' {
  return value === 'lb' || value === 'kg';
}

function normalizeSummary(row: SessionSummaryRow): WorkoutSessionSummary | null {
  if (
    !row.id ||
    !row.user_id ||
    !row.name ||
    !row.started_at ||
    !row.completed_at ||
    !isWeightUnit(row.weight_unit)
  ) {
    return null;
  }

  return {
    id: row.id,
    user_id: row.user_id,
    routine_day_id: row.routine_day_id,
    name: row.name,
    started_at: row.started_at,
    completed_at: row.completed_at,
    duration_seconds: row.duration_seconds ?? 0,
    exercise_count: row.exercise_count ?? 0,
    completed_set_count: row.completed_set_count ?? 0,
    working_set_count: row.working_set_count ?? 0,
    total_reps: row.total_reps ?? 0,
    total_volume: row.total_volume ?? 0,
    weight_unit: row.weight_unit,
  };
}

function normalizeRecord(row: ExerciseRecordRow): ExerciseRecord | null {
  if (
    !row.user_id ||
    !row.exercise_id ||
    !row.exercise_name ||
    !row.last_performed_at ||
    !isWeightUnit(row.weight_unit)
  ) {
    return null;
  }

  return {
    user_id: row.user_id,
    exercise_id: row.exercise_id,
    exercise_name: row.exercise_name,
    primary_muscle_group: row.primary_muscle_group ?? 'Other',
    weight_unit: row.weight_unit,
    session_count: row.session_count ?? 0,
    completed_set_count: row.completed_set_count ?? 0,
    total_reps: row.total_reps ?? 0,
    heaviest_weight: row.heaviest_weight,
    highest_reps: row.highest_reps,
    best_set_volume: row.best_set_volume,
    last_performed_at: row.last_performed_at,
  };
}

function normalizeMuscleDay(row: MuscleVolumeRow): MuscleVolumeDay | null {
  if (!row.user_id || !row.workout_date || !isWeightUnit(row.weight_unit)) return null;

  return {
    user_id: row.user_id,
    workout_date: row.workout_date,
    muscle_group: row.muscle_group ?? 'Other',
    weight_unit: row.weight_unit,
    completed_set_count: row.completed_set_count ?? 0,
    total_reps: row.total_reps ?? 0,
    total_volume: row.total_volume ?? 0,
  };
}

function parsePreviousSets(value: Json): PreviousPerformanceSet[] {
  if (!Array.isArray(value)) return [];

  return value.flatMap((item) => {
    if (!item || Array.isArray(item) || typeof item !== 'object') return [];
    const setNumber = Number(item.set_number);
    const weight = item.weight === null || item.weight === undefined ? null : Number(item.weight);
    const reps = item.reps === null || item.reps === undefined ? null : Number(item.reps);
    const rpe = item.rpe === null || item.rpe === undefined ? null : Number(item.rpe);

    if (!Number.isFinite(setNumber)) return [];
    return [{
      set_number: setNumber,
      weight: weight !== null && Number.isFinite(weight) ? weight : null,
      reps: reps !== null && Number.isFinite(reps) ? reps : null,
      rpe: rpe !== null && Number.isFinite(rpe) ? rpe : null,
    }];
  });
}

export async function loadWorkoutHistory(
  userId: string,
  limit = 24,
): Promise<RepositoryResult<WorkoutSessionSummary[]>> {
  if (!supabase) return { ok: false, error: 'Supabase is not configured for BioTrack AI V5.' };

  try {
    const { data, error } = await supabase
      .from('workout_session_summaries')
      .select('*')
      .eq('user_id', userId)
      .order('completed_at', { ascending: false })
      .limit(limit);

    if (error) throw error;
    return {
      ok: true,
      data: (data ?? []).flatMap((row) => {
        const normalized = normalizeSummary(row);
        return normalized ? [normalized] : [];
      }),
    };
  } catch (error) {
    return { ok: false, error: messageFrom(error, 'BioTrack could not load workout history.') };
  }
}

export async function loadExerciseRecords(
  userId: string,
): Promise<RepositoryResult<ExerciseRecord[]>> {
  if (!supabase) return { ok: false, error: 'Supabase is not configured for BioTrack AI V5.' };

  try {
    const { data, error } = await supabase
      .from('workout_exercise_records')
      .select('*')
      .eq('user_id', userId)
      .order('last_performed_at', { ascending: false });

    if (error) throw error;
    return {
      ok: true,
      data: (data ?? []).flatMap((row) => {
        const normalized = normalizeRecord(row);
        return normalized ? [normalized] : [];
      }),
    };
  } catch (error) {
    return { ok: false, error: messageFrom(error, 'BioTrack could not load exercise records.') };
  }
}

export async function loadMuscleVolume(
  userId: string,
  sinceDate: string,
): Promise<RepositoryResult<MuscleVolumeDay[]>> {
  if (!supabase) return { ok: false, error: 'Supabase is not configured for BioTrack AI V5.' };

  try {
    const { data, error } = await supabase
      .from('workout_muscle_volume_daily')
      .select('*')
      .eq('user_id', userId)
      .gte('workout_date', sinceDate)
      .order('workout_date', { ascending: true });

    if (error) throw error;
    return {
      ok: true,
      data: (data ?? []).flatMap((row) => {
        const normalized = normalizeMuscleDay(row);
        return normalized ? [normalized] : [];
      }),
    };
  } catch (error) {
    return { ok: false, error: messageFrom(error, 'BioTrack could not load muscle progress.') };
  }
}

export async function loadWorkoutSessionDetail(
  userId: string,
  sessionId: string,
): Promise<RepositoryResult<WorkoutSessionDetail | null>> {
  if (!supabase) return { ok: false, error: 'Supabase is not configured for BioTrack AI V5.' };

  try {
    const { data, error } = await supabase
      .from('workout_sessions')
      .select(`
        *,
        workout_session_exercises (
          *,
          workout_sets (*)
        )
      `)
      .eq('id', sessionId)
      .eq('user_id', userId)
      .eq('status', 'completed')
      .maybeSingle();

    if (error) throw error;
    if (!data) return { ok: true, data: null };

    const row = data as unknown as SessionDetailQueryRow;
    if (!row.completed_at) return { ok: true, data: null };

    return {
      ok: true,
      data: {
        id: row.id,
        user_id: row.user_id,
        name: row.name,
        status: 'completed',
        started_at: row.started_at,
        completed_at: row.completed_at,
        body_weight: row.body_weight,
        weight_unit: row.weight_unit,
        notes: row.notes,
        exercises: [...row.workout_session_exercises]
          .sort((a, b) => a.exercise_order - b.exercise_order)
          .map((exercise) => ({
            ...exercise,
            sets: [...exercise.workout_sets].sort((a, b) => a.set_number - b.set_number),
          })),
      },
    };
  } catch (error) {
    return { ok: false, error: messageFrom(error, 'BioTrack could not load this workout.') };
  }
}

export async function loadPreviousExercisePerformance(
  exerciseIds: string[],
): Promise<RepositoryResult<PreviousExercisePerformance[]>> {
  if (!supabase) return { ok: false, error: 'Supabase is not configured for BioTrack AI V5.' };
  if (exerciseIds.length === 0) return { ok: true, data: [] };

  try {
    const { data, error } = await supabase.rpc('get_previous_exercise_performance', {
      p_exercise_ids: Array.from(new Set(exerciseIds)),
    });

    if (error) throw error;
    return {
      ok: true,
      data: (data ?? []).flatMap((row) => {
        if (!isWeightUnit(row.weight_unit)) return [];
        return [{
          exercise_id: row.exercise_id,
          session_id: row.session_id,
          performed_at: row.performed_at,
          weight_unit: row.weight_unit,
          sets: parsePreviousSets(row.sets),
        }];
      }),
    };
  } catch (error) {
    return {
      ok: false,
      error: messageFrom(error, 'BioTrack could not load your previous performance.'),
    };
  }
}
