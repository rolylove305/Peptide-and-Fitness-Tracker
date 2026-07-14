import { useEffect, useMemo, useState } from 'react';
import {
  applyPwaUpdate,
  checkForPwaUpdate,
  getPwaUpdateState,
  subscribePwaUpdateState,
  type PwaUpdateState,
} from './pwaUpdateManager';
import {
  getWorkoutSyncState,
  readCachedActiveWorkout,
  subscribeWorkoutSyncState,
  type WorkoutSyncState,
} from '../features/workout/workoutOfflineStore';

type PwaUpdateStatusProps = {
  userId: string | undefined;
};

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

export function PwaUpdateStatus({ userId }: PwaUpdateStatusProps) {
  const online = useOnlineState();
  const [update, setUpdate] = useState<PwaUpdateState>(() => getPwaUpdateState());
  const [syncState, setSyncState] = useState<WorkoutSyncState>(() => getWorkoutSyncState(userId));
  const [safetyRevision, setSafetyRevision] = useState(0);

  useEffect(() => subscribePwaUpdateState(setUpdate), []);

  useEffect(() => {
    if (!userId) {
      setSyncState(getWorkoutSyncState(undefined));
      return;
    }
    return subscribeWorkoutSyncState(userId, setSyncState);
  }, [userId]);

  useEffect(() => {
    if (!userId || (update.status !== 'available' && update.status !== 'applying')) return;

    const refreshSafety = () => setSafetyRevision((revision) => revision + 1);
    const interval = window.setInterval(refreshSafety, 1000);
    window.addEventListener('storage', refreshSafety);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener('storage', refreshSafety);
    };
  }, [update.status, userId]);

  const hasActiveWorkout = useMemo(
    () => Boolean(userId && readCachedActiveWorkout(userId)),
    [safetyRevision, syncState, userId],
  );

  if (update.status === 'idle' || update.status === 'checking' || update.status === 'unsupported') {
    return null;
  }

  const blockedByWorkout = hasActiveWorkout;
  const blockedBySync = syncState.pendingCount > 0 || syncState.syncing;
  const canApply = online && !blockedByWorkout && !blockedBySync && update.status === 'available';

  let label = 'App update';
  let title = 'A safer BioTrack version is ready';
  let body = 'Update now to load the latest compatible files and remove old cached versions.';

  if (update.status === 'applying') {
    label = 'Updating';
    title = 'Loading the new BioTrack version';
    body = 'Your protected workout data will be recovered after the app reloads.';
  } else if (update.status === 'error') {
    label = 'Update needs attention';
    title = 'BioTrack could not prepare the update';
    body = update.error ?? 'Check your connection and try again.';
  } else if (!online) {
    title = 'BioTrack update waiting for a connection';
    body = 'Your current version remains available. Reconnect before applying the update.';
  } else if (blockedBySync) {
    title = 'BioTrack update waiting for workout sync';
    body = `${syncState.pendingCount} saved ${syncState.pendingCount === 1 ? 'set must' : 'sets must'} sync before BioTrack reloads.`;
  } else if (blockedByWorkout) {
    title = 'BioTrack update ready after this workout';
    body = 'Finish or cancel the active workout first. The new version will remain waiting without interrupting your session.';
  }

  return (
    <section
      className={`pwa-update-status pwa-update-status--${update.status}`}
      role="status"
      aria-live="polite"
    >
      <div className="pwa-update-status-mark" aria-hidden="true">
        {update.status === 'applying' ? '↻' : update.status === 'error' ? '!' : '↑'}
      </div>
      <div className="pwa-update-status-copy">
        <span>{label}</span>
        <strong>{title}</strong>
        <p>{body}</p>
        {update.buildId ? <small>Version {update.buildId.slice(0, 8)}</small> : null}
      </div>
      {canApply ? (
        <button className="primary-button" type="button" onClick={applyPwaUpdate}>
          Update BioTrack
        </button>
      ) : update.status === 'error' ? (
        <button
          className="secondary-button secondary-button--compact"
          type="button"
          onClick={() => void checkForPwaUpdate()}
        >
          Try again
        </button>
      ) : null}
    </section>
  );
}
