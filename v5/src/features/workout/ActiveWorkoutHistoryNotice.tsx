import { useEffect, useMemo, useState } from 'react';
import type { ActiveWorkoutSession } from './repositories/activeWorkoutRepository';
import { readCachedActiveWorkout } from './workoutOfflineStore';

type ActiveWorkoutHistoryNoticeProps = {
  userId: string | undefined;
};

function formatStartedAt(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'recently';

  const now = new Date();
  const sameLocalDay =
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate();
  const time = new Intl.DateTimeFormat(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  }).format(date);

  if (sameLocalDay) return `today at ${time}`;

  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(date);
}

function useCachedActiveWorkout(
  userId: string | undefined,
): ActiveWorkoutSession | null {
  const [session, setSession] = useState<ActiveWorkoutSession | null>(() =>
    userId ? readCachedActiveWorkout(userId) : null,
  );

  useEffect(() => {
    const refresh = () =>
      setSession(userId ? readCachedActiveWorkout(userId) : null);
    const refreshWhenVisible = () => {
      if (!document.hidden) refresh();
    };

    refresh();
    window.addEventListener('focus', refresh);
    window.addEventListener('storage', refresh);
    document.addEventListener('visibilitychange', refreshWhenVisible);

    return () => {
      window.removeEventListener('focus', refresh);
      window.removeEventListener('storage', refresh);
      document.removeEventListener('visibilitychange', refreshWhenVisible);
    };
  }, [userId]);

  return session;
}

export function ActiveWorkoutHistoryNotice({
  userId,
}: ActiveWorkoutHistoryNoticeProps) {
  const session = useCachedActiveWorkout(userId);
  const progress = useMemo(() => {
    if (!session) return null;
    const sets = session.exercises.flatMap((exercise) => exercise.sets);
    const completed = sets.filter((set) => set.is_completed).length;
    const skipped = sets.filter((set) => set.is_skipped).length;
    return {
      completed,
      skipped,
      remaining: Math.max(0, sets.length - completed - skipped),
    };
  }, [session]);

  if (!session || !progress) return null;

  function resumeWorkout() {
    const trainButton = document.querySelector<HTMLButtonElement>(
      '.workspace-nav-button[aria-label^="Train:"]',
    );
    trainButton?.click();
    window.requestAnimationFrame(() => {
      document
        .getElementById('workout-workspace-view')
        ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }

  return (
    <section
      className="history-active-workout"
      aria-labelledby="history-active-workout-heading"
    >
      <div className="history-active-workout-mark" aria-hidden="true">
        ▶
      </div>
      <div className="history-active-workout-copy">
        <span>Workout still in progress</span>
        <strong id="history-active-workout-heading">{session.name}</strong>
        <p>
          History only shows completed sessions. This workout started{' '}
          {formatStartedAt(session.started_at)}
          {' · '}
          {progress.completed} completed
          {' · '}
          {progress.remaining} remaining
          {progress.skipped > 0 ? ` · ${progress.skipped} skipped` : ''}.
        </p>
      </div>
      <button className="primary-button" type="button" onClick={resumeWorkout}>
        Resume workout
      </button>
    </section>
  );
}
