import type { ActiveWorkoutSession } from './repositories/activeWorkoutRepository';
import type {
  ExerciseRecord,
  WorkoutSessionSummary,
} from './repositories/workoutHistoryRepository';

export const WORKOUT_COMPLETED_EVENT = 'biotrack:workout-completed';

export type WorkoutCompletedEventDetail = {
  session: ActiveWorkoutSession;
  completedAt: string;
  previousHistory: WorkoutSessionSummary[];
  previousRecords: ExerciseRecord[];
};

export function emitWorkoutCompleted(
  detail: WorkoutCompletedEventDetail,
): void {
  window.dispatchEvent(
    new CustomEvent<WorkoutCompletedEventDetail>(WORKOUT_COMPLETED_EVENT, {
      detail,
    }),
  );
}
