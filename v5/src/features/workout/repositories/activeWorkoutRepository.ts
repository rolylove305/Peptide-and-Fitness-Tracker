import { supabase } from '../../../lib/supabase/client';
import type { Database } from '../../../types/database';

export type RepositoryResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string };

type WorkoutSetUpdate = Database['public']['Tables']['workout_sets']['Update'];
type WorkoutSetInsert = Database['public']['Tables']['workout_sets']['Insert'];
type WorkoutSetUpdateWithSkip = WorkoutSetUpdate & { is_skipped?: boolean };
type WorkoutSetInsertWithSkip = WorkoutSetInsert & { is_skipped?: boolean };

export type ActiveWorkoutSet = {
  id: string;
  session_exercise_id: string;
  set_number: number;
  weight: number | null;
  weight_unit: 'lb' | 'kg';
  reps: number | null;
  rpe: number | null;
  is_warmup: boolean;
  is_completed: boolean;
  is_skipped: boolean;
  rest_seconds_actual: number | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
};

export type ActiveWorkoutExercise = {
  id: string;
  session_id: string;
  exercise_id: string;
  exercise_order: number;
  exercise_name_snapshot: string;
  primary_muscle_group_snapshot: string | null;
  target_sets_snapshot: number;
  target_reps_min_snapshot: number | null;
  target_reps_max_snapshot: number | null;
  target_rest_seconds_snapshot: number;
  target_weight_snapshot: number | null;
  weight_unit_snapshot: 'lb' | 'kg';
  notes: string | null;
  sets: ActiveWorkoutSet[];
};

export type ActiveWorkoutSession = {
  id: string;
  user_id: string;
  routine_day_id: string | null;
  name: string;
  status: 'in_progress';
  started_at: string;
  completed_at: string | null;
  body_weight: number | null;
  weight_unit: 'lb' | 'kg';
  notes: string | null;
  created_at: string;
  updated_at: string;
  exercises: ActiveWorkoutExercise[];
};

type SessionQueryRow = Omit<ActiveWorkoutSession, 'exercises'> & {
  workout_session_exercises: Array<
    Omit<ActiveWorkoutExercise, 'sets'> & {
      workout_sets: Array<Omit<ActiveWorkoutSet, 'is_skipped'> & { is_skipped?: boolean }>;
    }
  >;
};

export type WorkoutSetInput = {
  weight: number | null;
  reps: number;
  rpe: number | null;
  is_warmup: boolean;
  is_completed: boolean;
};

export type WorkoutSessionDetailsInput = {
  bodyWeight: number | null;
  weightUnit: 'lb' | 'kg';
  notes: string | null;
};

function messageFrom(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === 'object' && error && 'message' in error) {
    const message = String((error as { message?: unknown }).message ?? '');
    if (message) return message;
  }
  return fallback;
}

function asWorkoutSetUpdate(value: WorkoutSetUpdateWithSkip): WorkoutSetUpdate {
  return value as unknown as WorkoutSetUpdate;
}

function asWorkoutSetInsert(value: WorkoutSetInsertWithSkip): WorkoutSetInsert {
  return value as unknown as WorkoutSetInsert;
}

export async function loadActiveWorkout(
  userId: string,
): Promise<RepositoryResult<ActiveWorkoutSession | null>> {
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
      .eq('user_id', userId)
      .eq('status', 'in_progress')
      .maybeSingle();

    if (error) throw error;
    if (!data) return { ok: true, data: null };

    const row = data as unknown as SessionQueryRow;
    return {
      ok: true,
      data: {
        ...row,
        exercises: [...row.workout_session_exercises]
          .sort((a, b) => a.exercise_order - b.exercise_order)
          .map((exercise) => ({
            ...exercise,
            sets: [...exercise.workout_sets]
              .sort((a, b) => a.set_number - b.set_number)
              .map((set) => ({ ...set, is_skipped: set.is_skipped ?? false })),
          })),
      },
    };
  } catch (error) {
    return { ok: false, error: messageFrom(error, 'BioTrack could not load the active workout.') };
  }
}

export async function startWorkoutFromDay(dayId: string): Promise<RepositoryResult<string>> {
  if (!supabase) return { ok: false, error: 'Supabase is not configured for BioTrack AI V5.' };

  try {
    const { data, error } = await supabase.rpc('start_workout_session_from_day', {
      p_routine_day_id: dayId,
    });
    if (error) throw error;
    if (!data) throw new Error('The workout started, but no session ID was returned.');
    return { ok: true, data };
  } catch (error) {
    return { ok: false, error: messageFrom(error, 'BioTrack could not start this workout.') };
  }
}

export async function saveWorkoutSet(
  setId: string,
  input: WorkoutSetInput,
): Promise<RepositoryResult<null>> {
  if (!supabase) return { ok: false, error: 'Supabase is not configured for BioTrack AI V5.' };

  try {
    const update: WorkoutSetUpdateWithSkip = {
      weight: input.weight,
      reps: input.reps,
      rpe: input.rpe,
      is_warmup: input.is_warmup,
      is_completed: input.is_completed,
      is_skipped: false,
      completed_at: input.is_completed ? new Date().toISOString() : null,
    };
    const { error } = await supabase
      .from('workout_sets')
      .update(asWorkoutSetUpdate(update))
      .eq('id', setId);

    if (error) throw error;
    return { ok: true, data: null };
  } catch (error) {
    return { ok: false, error: messageFrom(error, 'BioTrack could not save this set.') };
  }
}

export async function setWorkoutSetWarmup(
  setId: string,
  isWarmup: boolean,
): Promise<RepositoryResult<null>> {
  if (!supabase) return { ok: false, error: 'Supabase is not configured for BioTrack AI V5.' };

  try {
    const update: WorkoutSetUpdate = { is_warmup: isWarmup };
    const { error } = await supabase.from('workout_sets').update(update).eq('id', setId);
    if (error) throw error;
    return { ok: true, data: null };
  } catch (error) {
    return { ok: false, error: messageFrom(error, 'BioTrack could not update the set type.') };
  }
}

export async function skipWorkoutSet(setId: string): Promise<RepositoryResult<null>> {
  if (!supabase) return { ok: false, error: 'Supabase is not configured for BioTrack AI V5.' };

  try {
    const update: WorkoutSetUpdateWithSkip = {
      is_skipped: true,
      is_completed: false,
      completed_at: null,
    };
    const { error } = await supabase
      .from('workout_sets')
      .update(asWorkoutSetUpdate(update))
      .eq('id', setId);
    if (error) throw error;
    return { ok: true, data: null };
  } catch (error) {
    return { ok: false, error: messageFrom(error, 'BioTrack could not skip this set.') };
  }
}

export async function restoreWorkoutSet(setId: string): Promise<RepositoryResult<null>> {
  if (!supabase) return { ok: false, error: 'Supabase is not configured for BioTrack AI V5.' };

  try {
    const update: WorkoutSetUpdateWithSkip = { is_skipped: false };
    const { error } = await supabase
      .from('workout_sets')
      .update(asWorkoutSetUpdate(update))
      .eq('id', setId);
    if (error) throw error;
    return { ok: true, data: null };
  } catch (error) {
    return { ok: false, error: messageFrom(error, 'BioTrack could not restore this set.') };
  }
}

export async function resetWorkoutSet(setId: string): Promise<RepositoryResult<null>> {
  if (!supabase) return { ok: false, error: 'Supabase is not configured for BioTrack AI V5.' };

  try {
    const update: WorkoutSetUpdateWithSkip = {
      is_completed: false,
      is_skipped: false,
      completed_at: null,
    };
    const { error } = await supabase
      .from('workout_sets')
      .update(asWorkoutSetUpdate(update))
      .eq('id', setId);
    if (error) throw error;
    return { ok: true, data: null };
  } catch (error) {
    return { ok: false, error: messageFrom(error, 'BioTrack could not reopen this set.') };
  }
}

export async function addWorkoutSet(
  sessionExerciseId: string,
  setNumber: number,
  weightUnit: 'lb' | 'kg',
): Promise<RepositoryResult<null>> {
  if (!supabase) return { ok: false, error: 'Supabase is not configured for BioTrack AI V5.' };

  try {
    const insert: WorkoutSetInsertWithSkip = {
      session_exercise_id: sessionExerciseId,
      set_number: setNumber,
      weight_unit: weightUnit,
      is_warmup: false,
      is_completed: false,
      is_skipped: false,
    };
    const { error } = await supabase
      .from('workout_sets')
      .insert(asWorkoutSetInsert(insert));
    if (error) throw error;
    return { ok: true, data: null };
  } catch (error) {
    return { ok: false, error: messageFrom(error, 'BioTrack could not add another set.') };
  }
}

export async function deleteWorkoutSet(setId: string): Promise<RepositoryResult<null>> {
  if (!supabase) return { ok: false, error: 'Supabase is not configured for BioTrack AI V5.' };

  try {
    const { error } = await supabase.from('workout_sets').delete().eq('id', setId);
    if (error) throw error;
    return { ok: true, data: null };
  } catch (error) {
    return { ok: false, error: messageFrom(error, 'BioTrack could not remove this extra set.') };
  }
}

export async function saveWorkoutSessionDetails(
  sessionId: string,
  input: WorkoutSessionDetailsInput,
): Promise<RepositoryResult<null>> {
  if (!supabase) return { ok: false, error: 'Supabase is not configured for BioTrack AI V5.' };

  try {
    const { error } = await supabase
      .from('workout_sessions')
      .update({
        body_weight: input.bodyWeight,
        weight_unit: input.weightUnit,
        notes: input.notes,
      })
      .eq('id', sessionId)
      .eq('status', 'in_progress');
    if (error) throw error;
    return { ok: true, data: null };
  } catch (error) {
    return { ok: false, error: messageFrom(error, 'BioTrack could not save the workout details.') };
  }
}

export async function saveWorkoutExerciseNotes(
  sessionExerciseId: string,
  notes: string | null,
): Promise<RepositoryResult<null>> {
  if (!supabase) return { ok: false, error: 'Supabase is not configured for BioTrack AI V5.' };

  try {
    const { error } = await supabase
      .from('workout_session_exercises')
      .update({ notes })
      .eq('id', sessionExerciseId);
    if (error) throw error;
    return { ok: true, data: null };
  } catch (error) {
    return { ok: false, error: messageFrom(error, 'BioTrack could not save the exercise note.') };
  }
}

export async function completeWorkout(sessionId: string): Promise<RepositoryResult<null>> {
  if (!supabase) return { ok: false, error: 'Supabase is not configured for BioTrack AI V5.' };

  try {
    const { error } = await supabase.rpc('complete_workout_session', {
      p_session_id: sessionId,
    });
    if (error) throw error;
    return { ok: true, data: null };
  } catch (error) {
    return { ok: false, error: messageFrom(error, 'BioTrack could not complete this workout.') };
  }
}

export async function cancelWorkout(sessionId: string): Promise<RepositoryResult<null>> {
  if (!supabase) return { ok: false, error: 'Supabase is not configured for BioTrack AI V5.' };

  try {
    const { error } = await supabase.rpc('cancel_workout_session', {
      p_session_id: sessionId,
    });
    if (error) throw error;
    return { ok: true, data: null };
  } catch (error) {
    return { ok: false, error: messageFrom(error, 'BioTrack could not cancel this workout.') };
  }
}
