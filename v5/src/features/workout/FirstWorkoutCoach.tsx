import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../auth/AuthProvider';
import {
  loadActiveWorkout,
  type ActiveWorkoutSession,
} from './repositories/activeWorkoutRepository';
import { loadWorkoutHistory } from './repositories/workoutHistoryRepository';

const REST_TIMER_STORAGE_KEY = 'biotrack-v5-rest-timer';
const COACH_DISMISSED_PREFIX = 'biotrack-v5-first-workout-coach-dismissed';
const TECHNIQUE_SEEN_PREFIX = 'biotrack-v5-first-workout-technique-seen';

type CoachStep = 'log' | 'timer' | 'technique' | 'continue' | 'finish';

type RestTimerSnapshot = {
  sessionId?: unknown;
  endsAt?: unknown;
};

function dismissedKey(userId: string): string {
  return `${COACH_DISMISSED_PREFIX}:${userId}`;
}

function techniqueKey(sessionId: string): string {
  return `${TECHNIQUE_SEEN_PREFIX}:${sessionId}`;
}

function readBoolean(storage: Storage, key: string): boolean {
  try {
    return storage.getItem(key) === '1';
  } catch {
    return false;
  }
}

function writeBoolean(storage: Storage, key: string): void {
  try {
    storage.setItem(key, '1');
  } catch {
    // The coach still works for the current page when browser storage is unavailable.
  }
}

function restTimerIsActive(sessionId: string): boolean {
  try {
    const raw = window.localStorage.getItem(REST_TIMER_STORAGE_KEY);
    if (!raw) return false;
    const parsed = JSON.parse(raw) as RestTimerSnapshot;
    return (
      parsed.sessionId === sessionId &&
      typeof parsed.endsAt === 'number' &&
      Number.isFinite(parsed.endsAt) &&
      parsed.endsAt > Date.now()
    );
  } catch {
    return false;
  }
}

function goToTrain(): void {
  document
    .querySelector<HTMLButtonElement>('.workspace-nav-button[aria-label^="Train:"]')
    ?.click();
}

function afterNavigation(action: () => void): void {
  window.setTimeout(action, 260);
}

function scrollAndFocus(selector: string, focusSelector?: string): void {
  const element = document.querySelector<HTMLElement>(selector);
  element?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  if (focusSelector) {
    element?.querySelector<HTMLElement>(focusSelector)?.focus({ preventScroll: true });
  } else {
    element?.focus({ preventScroll: true });
  }
}

const copyByStep: Record<CoachStep, { title: string; body: string; action: string }> = {
  log: {
    title: 'Log your first working set',
    body: 'Enter the weight you actually used and the repetitions you completed. RPE is optional. Tap Complete set when you are done.',
    action: 'Go to my first set',
  },
  timer: {
    title: 'Let BioTrack manage your rest',
    body: 'After a completed set, the rest timer starts automatically. You can add 30 seconds, subtract time or skip it when you feel ready.',
    action: 'Got it — continue',
  },
  technique: {
    title: 'Check your technique before the next set',
    body: 'Open the full movement guide to review the start position, finish position, breathing, coaching cues and common mistakes.',
    action: 'Open technique guide',
  },
  continue: {
    title: 'Resolve the remaining sets',
    body: 'Complete each planned set, or use Skip set when you intentionally leave one out. BioTrack keeps completed and skipped work separate.',
    action: 'Go to next set',
  },
  finish: {
    title: 'Save your first workout',
    body: 'Every planned set is resolved. Finish the workout to save it to History and unlock your first progress baseline.',
    action: 'Go to Finish workout',
  },
};

export function FirstWorkoutCoach() {
  const { user } = useAuth();
  const userId = user?.id;
  const [historyChecked, setHistoryChecked] = useState(false);
  const [hasCompletedWorkout, setHasCompletedWorkout] = useState(false);
  const [session, setSession] = useState<ActiveWorkoutSession | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [expanded, setExpanded] = useState(true);
  const [timerSeen, setTimerSeen] = useState(false);
  const [timerActive, setTimerActive] = useState(false);
  const [techniqueSeen, setTechniqueSeen] = useState(false);

  useEffect(() => {
    if (!userId) {
      setHistoryChecked(true);
      setHasCompletedWorkout(true);
      setSession(null);
      return;
    }

    let cancelled = false;
    setHistoryChecked(false);
    setSession(null);
    setDismissed(readBoolean(window.localStorage, dismissedKey(userId)));

    void loadWorkoutHistory(userId).then((result) => {
      if (cancelled) return;
      setHasCompletedWorkout(!result.ok || result.data.length > 0);
      setHistoryChecked(true);
    });

    return () => {
      cancelled = true;
    };
  }, [userId]);

  useEffect(() => {
    if (!userId || !historyChecked || hasCompletedWorkout || dismissed) return;

    let cancelled = false;

    async function refreshSession() {
      const result = await loadActiveWorkout(userId);
      if (cancelled || !result.ok) return;

      setSession(result.data);
      if (!result.data) {
        setTimerActive(false);
        return;
      }

      const activeTimer = restTimerIsActive(result.data.id);
      setTimerActive(activeTimer);
      if (activeTimer) setTimerSeen(true);
    }

    void refreshSession();
    const interval = window.setInterval(() => void refreshSession(), 1400);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [dismissed, hasCompletedWorkout, historyChecked, userId]);

  useEffect(() => {
    if (!session) {
      setTimerSeen(false);
      setTechniqueSeen(false);
      return;
    }

    setTimerSeen(restTimerIsActive(session.id));
    setTechniqueSeen(readBoolean(window.sessionStorage, techniqueKey(session.id)));
  }, [session?.id]);

  const progress = useMemo(() => {
    if (!session) {
      return {
        completed: 0,
        skipped: 0,
        total: 0,
        remaining: 0,
        allResolved: false,
        nextSetId: null as string | null,
      };
    }

    const sets = session.exercises.flatMap((exercise) => exercise.sets);
    const completed = sets.filter((set) => set.is_completed).length;
    const skipped = sets.filter((set) => set.is_skipped).length;
    const nextSetId =
      sets.find((set) => !set.is_completed && !set.is_skipped)?.id ?? null;
    const remaining = Math.max(0, sets.length - completed - skipped);

    return {
      completed,
      skipped,
      total: sets.length,
      remaining,
      allResolved: sets.length > 0 && remaining === 0,
      nextSetId,
    };
  }, [session]);

  if (!userId || !historyChecked || hasCompletedWorkout || dismissed || !session) {
    return null;
  }

  let currentStep: CoachStep = 'log';
  if (progress.completed > 0) currentStep = 'timer';
  if (progress.completed > 0 && timerSeen) currentStep = 'technique';
  if (progress.completed > 0 && timerSeen && techniqueSeen) currentStep = 'continue';
  if (progress.allResolved) currentStep = 'finish';

  const currentIndex =
    currentStep === 'log'
      ? 1
      : currentStep === 'timer'
        ? 2
        : currentStep === 'technique'
          ? 3
          : currentStep === 'continue'
            ? 4
            : 5;
  const currentCopy = copyByStep[currentStep];
  const completionPercent = Math.round(((currentIndex - 1) / 5) * 100);

  const steps = [
    { label: 'Log and complete a set', done: progress.completed > 0, active: currentStep === 'log' },
    { label: 'Understand the rest timer', done: timerSeen, active: currentStep === 'timer' },
    { label: 'Open a technique guide', done: techniqueSeen, active: currentStep === 'technique' },
    { label: 'Resolve every planned set', done: progress.allResolved, active: currentStep === 'continue' },
    { label: 'Finish and save the workout', done: false, active: currentStep === 'finish' },
  ];

  function dismissCoach() {
    writeBoolean(window.localStorage, dismissedKey(userId));
    setDismissed(true);
  }

  function handleAction() {
    if (currentStep === 'timer') {
      if (timerActive) {
        goToTrain();
        afterNavigation(() => scrollAndFocus('.rest-timer'));
      }
      setTimerSeen(true);
      return;
    }

    if (currentStep === 'technique') {
      goToTrain();
      afterNavigation(() => {
        const button = document.querySelector<HTMLButtonElement>(
          '.active-technique-dock .primary-button',
        );
        button?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        button?.click();
        writeBoolean(window.sessionStorage, techniqueKey(session.id));
        setTechniqueSeen(true);
      });
      return;
    }

    if (currentStep === 'finish') {
      goToTrain();
      afterNavigation(() =>
        scrollAndFocus('.live-workout-actions', '.primary-button'),
      );
      return;
    }

    goToTrain();
    afterNavigation(() => {
      if (progress.nextSetId) {
        scrollAndFocus(
          `#workout-set-${progress.nextSetId}`,
          'input[data-field="reps"]',
        );
      } else {
        scrollAndFocus('.live-workout');
      }
    });
  }

  return (
    <section
      className={expanded ? 'first-workout-coach' : 'first-workout-coach first-workout-coach--collapsed'}
      aria-labelledby="first-workout-coach-heading"
      aria-live="polite"
    >
      <header className="first-workout-coach-header">
        <div className="first-workout-coach-mark" aria-hidden="true">AI</div>
        <div>
          <span>First workout coach · Step {currentIndex} of 5</span>
          <strong id="first-workout-coach-heading">
            {expanded ? currentCopy.title : 'Your first-workout guide is active'}
          </strong>
        </div>
        <div className="first-workout-coach-header-actions">
          <button type="button" onClick={() => setExpanded((current) => !current)}>
            {expanded ? 'Minimize' : 'Open'}
          </button>
          <button type="button" onClick={dismissCoach}>Skip guide</button>
        </div>
      </header>

      <div className="first-workout-coach-progress" aria-label={`${completionPercent}% of coach steps complete`}>
        <span style={{ width: `${completionPercent}%` }} />
      </div>

      {expanded ? (
        <div className="first-workout-coach-body">
          <div className="first-workout-coach-current">
            <p>{currentCopy.body}</p>
            <div className="first-workout-coach-session-status">
              <span>{progress.completed} completed</span>
              <span>{progress.skipped} skipped</span>
              <span>{progress.remaining} remaining</span>
            </div>
            <button className="primary-button" type="button" onClick={handleAction}>
              {currentCopy.action}
            </button>
          </div>

          <ol className="first-workout-coach-checklist">
            {steps.map((step, index) => (
              <li
                className={[
                  step.done ? 'first-workout-coach-step--done' : '',
                  step.active ? 'first-workout-coach-step--active' : '',
                ].filter(Boolean).join(' ')}
                key={step.label}
              >
                <span aria-hidden="true">{step.done ? '✓' : index + 1}</span>
                <strong>{step.label}</strong>
              </li>
            ))}
          </ol>

          <p className="first-workout-coach-note">
            This guide disappears automatically after your first completed workout.
          </p>
        </div>
      ) : null}
    </section>
  );
}
