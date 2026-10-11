import type { WorkoutProfile } from './workoutProfile';

export const workoutProfileCompletedEventName =
  'biotrack:workout-profile-completed';

export type WorkoutProfileCompletedDetail = {
  profile: WorkoutProfile;
};

export function emitWorkoutProfileCompleted(profile: WorkoutProfile): void {
  window.dispatchEvent(
    new CustomEvent<WorkoutProfileCompletedDetail>(
      workoutProfileCompletedEventName,
      {
        detail: { profile },
      },
    ),
  );
}

export function subscribeWorkoutProfileCompleted(
  listener: (detail: WorkoutProfileCompletedDetail) => void,
): () => void {
  const handleEvent = (event: Event) => {
    listener((event as CustomEvent<WorkoutProfileCompletedDetail>).detail);
  };

  window.addEventListener(workoutProfileCompletedEventName, handleEvent);
  return () =>
    window.removeEventListener(workoutProfileCompletedEventName, handleEvent);
}
