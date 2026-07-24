import { supabase } from '../../../lib/supabase/client';
import type {
  Exercise,
  Json,
  WorkoutRoutine,
  WorkoutRoutineDay,
  WorkoutRoutineExercise,
} from '../../../types/database';

export type RepositoryResult<T> =
  { ok: true; data: T } | { ok: false; error: string };

export type WeightUnit = 'lb' | 'kg';

export type RoutineExerciseDraft = {
  localId: string;
  exercise_id: string;
  target_sets: number;
  target_reps_min: number;
  target_reps_max: number;
  target_rest_seconds: number;
  target_weight: number | null;
  weight_unit: WeightUnit;
  tempo: string;
  notes: string;
};

export type RoutineDayDraft = {
  localId: string;
  name: string;
  focus: string;
  focus_muscle_groups: string[];
  exercises: RoutineExerciseDraft[];
};

export type RoutineDraft = {
  name: string;
  description: string;
  goal: string;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  days: RoutineDayDraft[];
};

export type RoutineExerciseWithLoad = WorkoutRoutineExercise & {
  target_weight: number | null;
  weight_unit: WeightUnit;
};

export type RoutineExerciseTree = RoutineExerciseWithLoad & {
  exercise: Pick<
    Exercise,
    'id' | 'name' | 'primary_muscle_group' | 'equipment'
  > | null;
};

export type RoutineDayTree = WorkoutRoutineDay & {
  exercises: RoutineExerciseTree[];
};

export type RoutineTree = WorkoutRoutine & {
  days: RoutineDayTree[];
};

type RoutineQueryRow = WorkoutRoutine & {
  workout_routine_days: Array<
    WorkoutRoutineDay & {
      workout_routine_exercises: Array<
        RoutineExerciseWithLoad & {
          exercise_library: Pick<
            Exercise,
            'id' | 'name' | 'primary_muscle_group' | 'equipment'
          > | null;
        }
      >;
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

export async function loadRoutineTrees(
  userId: string,
): Promise<RepositoryResult<RoutineTree[]>> {
  if (!supabase) {
    return {
      ok: false,
      error: 'Supabase is not configured for BioTrack AI V5.',
    };
  }

  try {
    const { data, error } = await supabase
      .from('workout_routines')
      .select(
        `
        *,
        workout_routine_days (
          *,
          workout_routine_exercises (
            *,
            exercise_library (
              id,
              name,
              primary_muscle_group,
              equipment
            )
          )
        )
      `,
      )
      .eq('user_id', userId)
      .order('updated_at', { ascending: false });

    if (error) throw error;

    const routines = ((data ?? []) as unknown as RoutineQueryRow[]).map(
      (routine) => ({
        ...routine,
        days: [...routine.workout_routine_days]
          .sort((a, b) => a.day_order - b.day_order)
          .map((day) => ({
            ...day,
            exercises: [...day.workout_routine_exercises]
              .sort((a, b) => a.exercise_order - b.exercise_order)
              .map((exercise) => ({
                ...exercise,
                exercise: exercise.exercise_library,
              })),
          })),
      }),
    );

    return { ok: true, data: routines };
  } catch (error) {
    return {
      ok: false,
      error: messageFrom(
        error,
        'BioTrack could not load your workout routines.',
      ),
    };
  }
}

export async function saveRoutineTree(
  draft: RoutineDraft,
  routineId: string | null,
): Promise<RepositoryResult<string>> {
  if (!supabase) {
    return {
      ok: false,
      error: 'Supabase is not configured for BioTrack AI V5.',
    };
  }

  const payload: Json = {
    name: draft.name.trim(),
    description: draft.description.trim(),
    goal: draft.goal.trim(),
    difficulty: draft.difficulty,
    days: draft.days.map((day) => ({
      name: day.name.trim(),
      focus: day.focus.trim(),
      focus_muscle_groups: day.focus_muscle_groups,
      exercises: day.exercises.map((exercise) => ({
        exercise_id: exercise.exercise_id,
        target_sets: exercise.target_sets,
        target_reps_min: exercise.target_reps_min,
        target_reps_max: exercise.target_reps_max,
        target_rest_seconds: exercise.target_rest_seconds,
        target_weight: exercise.target_weight,
        weight_unit: exercise.weight_unit,
        tempo: exercise.tempo.trim(),
        notes: exercise.notes.trim(),
      })),
    })),
  };

  try {
    const { data, error } = await supabase.rpc('save_workout_routine_tree', {
      p_routine: payload,
      p_routine_id: routineId,
    });

    if (error) throw error;
    if (!data)
      throw new Error('The routine was saved, but no routine ID was returned.');

    return { ok: true, data };
  } catch (error) {
    return {
      ok: false,
      error: messageFrom(error, 'BioTrack could not save this routine.'),
    };
  }
}

export async function deleteRoutineTree(
  userId: string,
  routineId: string,
): Promise<RepositoryResult<null>> {
  if (!supabase) {
    return {
      ok: false,
      error: 'Supabase is not configured for BioTrack AI V5.',
    };
  }

  try {
    const { error } = await supabase
      .from('workout_routines')
      .delete()
      .eq('id', routineId)
      .eq('user_id', userId);

    if (error) throw error;
    return { ok: true, data: null };
  } catch (error) {
    return {
      ok: false,
      error: messageFrom(error, 'BioTrack could not delete this routine.'),
    };
  }
}
