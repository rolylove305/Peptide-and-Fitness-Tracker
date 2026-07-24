export type WorkoutClosureAction = 'finish' | 'cancel';

export function getWorkoutClosureBlocker(
  action: WorkoutClosureAction,
  online: boolean,
  pendingCount: number,
): string | null {
  if (!online) {
    return action === 'finish'
      ? 'Reconnect before finishing so every saved set reaches your history.'
      : 'Reconnect before cancelling this workout.';
  }

  if (pendingCount > 0) {
    return action === 'finish'
      ? `BioTrack is still syncing ${pendingCount} saved ${pendingCount === 1 ? 'set' : 'sets'}. Retry sync before finishing.`
      : 'Sync or finish saving the pending sets before cancelling.';
  }

  return null;
}
