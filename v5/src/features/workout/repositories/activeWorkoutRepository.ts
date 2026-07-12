import { supabase } from '../../../lib/supabase/client';

export type RepositoryResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string };

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
      workout_sets: ActiveWorkoutSet[];
    }
  >;
};

export type WorkoutSetInput = {
  weight: number | null;
  reps: number;
  rpe: number | null;
  is_completed: boolean;
};

function messageFrom(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === 'object' && error && 'message' in error) {
    const message = String((error as { message?: unknown }).message ?? '');
    if (message) return message;
  }
  return fallback;
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
            sets: [...exercise.workout_sets].sort((a, b) => a.set_number - b.set_number),
          })),
      },
    };
  } catch (error) {
    return { ok: false, error: messageFrom(error, 'BioTrack could not load the active workout.') };
  }
}

async function invokeUuidRpc(
  functionName:
    | 'start_workout_session_from_day'
    | 'complete_workout_session'
    | 'cancel_workout_session',
  args: Record<string, string>,
): Promise<{ data: string | null; error: { message: string } | null }> {
  if (!supabase) return { data: null, error: { message: 'Supabase is not configured.' } };
  const invoke = supabase.rpc.bind(supabase) as unknown as (
    name: string,
    parameters: Record<string, string>,
  ) => Promise<{ data: string | null; error: { message: string } | null }>;
  return invoke(functionName, args);
}

export async function startWorkoutFromDay(dayId: string): Promise<RepositoryResult<string>> {
  try {
    const { data, error } = await invokeUuidRpc('start_workout_session_from_day', {
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
    const { error } = await supabase
      .from('workout_sets')
      .update({
        weight: input.weight,
        reps: input.reps,
        rpe: input.rpe,
        is_completed: input.is_completed,
        completed_at: input.is_completed ? new Date().toISOString() : null,
      })
      .eq('id', setId);

    if (error) throw error;
    return { ok: true, data: null };
  } catch (error) {
    return { ok: false, error: messageFrom(error, 'BioTrack could not save this set.') };
  }
}

export async function completeWorkout(sessionId: string): Promise<RepositoryResult<null>> {
  try {
    const { error } = await invokeUuidRpc('complete_workout_session', {
      p_session_id: sessionId,
    });
    if (error) throw error;
    return { ok: true, data: null };
  } catch (error) {
    return { ok: false, error: messageFrom(error, 'BioTrack could not complete this workout.') };
  }
}

export async function cancelWorkout(sessionId: string): Promise<RepositoryResult<null>> {
  try {
    const { error } = await invokeUuidRpc('cancel_workout_session', {
      p_session_id: sessionId,
    });
    if (error) throw error;
    return { ok: true, data: null };
  } catch (error) {
    return { ok: false, error: messageFrom(error, 'BioTrack could not cancel this workout.') };
  }
}
