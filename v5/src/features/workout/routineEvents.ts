const WORKOUT_ROUTINE_SAVED_EVENT = 'biotrack:v5:routine-saved';

export type WorkoutRoutineSavedDetail = {
  routineId: string;
};

export function emitWorkoutRoutineSaved(routineId: string): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(
    new CustomEvent<WorkoutRoutineSavedDetail>(WORKOUT_ROUTINE_SAVED_EVENT, {
      detail: { routineId },
    }),
  );
}

export function subscribeWorkoutRoutineSaved(
  listener: (detail: WorkoutRoutineSavedDetail) => void,
): () => void {
  if (typeof window === 'undefined') return () => undefined;

  const handler = (event: Event) => {
    const detail = (event as CustomEvent<WorkoutRoutineSavedDetail>).detail;
    if (
      !detail ||
      typeof detail.routineId !== 'string' ||
      detail.routineId.length === 0
    )
      return;
    listener(detail);
  };

  window.addEventListener(WORKOUT_ROUTINE_SAVED_EVENT, handler);
  return () => window.removeEventListener(WORKOUT_ROUTINE_SAVED_EVENT, handler);
}
