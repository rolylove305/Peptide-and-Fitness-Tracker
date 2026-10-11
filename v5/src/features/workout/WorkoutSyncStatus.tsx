import { useEffect, useState } from 'react';
import { useAuth } from '../auth/AuthProvider';
import {
  getWorkoutSyncState,
  requestWorkoutSync,
  subscribeWorkoutSyncState,
  type WorkoutSyncState,
} from './workoutOfflineStore';

function useOnlineState(): boolean {
  const [online, setOnline] = useState(() => navigator.onLine);

  useEffect(() => {
    const markOnline = () => setOnline(true);
    const markOffline = () => setOnline(false);
    window.addEventListener('online', markOnline);
    window.addEventListener('offline', markOffline);
    return () => {
      window.removeEventListener('online', markOnline);
      window.removeEventListener('offline', markOffline);
    };
  }, []);

  return online;
}

export function WorkoutSyncStatus() {
  const { user } = useAuth();
  const userId = user?.id;
  const online = useOnlineState();
  const [state, setState] = useState<WorkoutSyncState>(() =>
    getWorkoutSyncState(userId),
  );

  useEffect(() => {
    if (!userId) {
      setState(getWorkoutSyncState(undefined));
      return;
    }
    return subscribeWorkoutSyncState(userId, setState);
  }, [userId]);

  if (!userId) return null;
  if (online && state.pendingCount === 0 && !state.syncing && !state.error)
    return null;

  const className = [
    'workout-sync-status',
    !online ? 'workout-sync-status--offline' : '',
    state.error ? 'workout-sync-status--error' : '',
    state.syncing ? 'workout-sync-status--syncing' : '',
  ]
    .filter(Boolean)
    .join(' ');

  let label = 'Workout protected';
  let title = 'Your active workout remains safe on this device';
  let body =
    'Reconnect when available. Completed sets will sync automatically.';

  if (online && state.syncing) {
    label = 'Syncing';
    title = `Uploading ${state.pendingCount} saved ${state.pendingCount === 1 ? 'set' : 'sets'}`;
    body =
      'Keep BioTrack open for a moment. You can continue viewing your workout.';
  } else if (online && state.pendingCount > 0) {
    label = state.error ? 'Sync needs attention' : 'Ready to sync';
    title = `${state.pendingCount} saved ${state.pendingCount === 1 ? 'set is' : 'sets are'} waiting`;
    body =
      state.error ?? 'BioTrack will retry automatically, or you can retry now.';
  } else if (!online && state.pendingCount > 0) {
    title = `${state.pendingCount} completed ${state.pendingCount === 1 ? 'set is' : 'sets are'} saved locally`;
  }

  return (
    <section className={className} role="status" aria-live="polite">
      <div className="workout-sync-status-mark" aria-hidden="true">
        {state.syncing ? '↻' : online ? '✓' : '⌁'}
      </div>
      <div className="workout-sync-status-copy">
        <span>{label}</span>
        <strong>{title}</strong>
        <p>{body}</p>
      </div>
      {online && state.pendingCount > 0 && !state.syncing ? (
        <button
          className="secondary-button secondary-button--compact"
          type="button"
          onClick={() => requestWorkoutSync(userId)}
        >
          Retry sync
        </button>
      ) : null}
    </section>
  );
}
