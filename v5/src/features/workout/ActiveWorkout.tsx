import { useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '../auth/AuthProvider';
import {
  PreviousPerformance,
  PreviousPerformanceProvider,
  usePreviousPerformanceForExercise,
} from './PreviousPerformance';
import {
  ExerciseNotesEditor,
  SessionDetailsEditor,
} from './ActiveWorkoutFlexControls';
import { useActiveWorkout } from './hooks/useActiveWorkout';
import { useRoutines } from './hooks/useRoutines';
import type {
  ActiveWorkoutExercise,
  ActiveWorkoutSet,
  WorkoutSessionDetailsInput,
  WorkoutSetInput,
} from './repositories/activeWorkoutRepository';

const REST_TIMER_STORAGE_KEY = 'biotrack-v5-rest-timer';

function formatClock(totalSeconds: number): string {
  const safeSeconds = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);
  const seconds = safeSeconds % 60;
  if (hours > 0) {
    return [hours, minutes, seconds].map((value) => String(value).padStart(2, '0')).join(':');
  }
  return [minutes, seconds].map((value) => String(value).padStart(2, '0')).join(':');
}

function useElapsedSeconds(startedAt: string | undefined): number {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (!startedAt) {
      setElapsed(0);
      return;
    }

    const update = () => {
      setElapsed(Math.max(0, Math.floor((Date.now() - new Date(startedAt).getTime()) / 1000)));
    };

    update();
    const timer = window.setInterval(update, 1000);
    return () => window.clearInterval(timer);
  }, [startedAt]);

  return elapsed;
}

type RestTimerState = {
  sessionId: string;
  exerciseName: string;
  endsAt: number;
  total: number;
};

type SetSuggestion = {
  weight: number | null;
  reps: number | null;
  source: 'Previous set' | 'Last workout' | 'Routine target';
};

function readStoredRestTimer(): RestTimerState | null {
  try {
    const raw = window.localStorage.getItem(REST_TIMER_STORAGE_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as Partial<RestTimerState>;
    if (
      typeof parsed.sessionId !== 'string' ||
      typeof parsed.exerciseName !== 'string' ||
      typeof parsed.endsAt !== 'number' ||
      typeof parsed.total !== 'number' ||
      !Number.isFinite(parsed.endsAt) ||
      !Number.isFinite(parsed.total) ||
      parsed.total <= 0
    ) {
      window.localStorage.removeItem(REST_TIMER_STORAGE_KEY);
      return null;
    }

    if (Date.now() - parsed.endsAt > 5 * 60 * 1000) {
      window.localStorage.removeItem(REST_TIMER_STORAGE_KEY);
      return null;
    }

    return parsed as RestTimerState;
  } catch {
    window.localStorage.removeItem(REST_TIMER_STORAGE_KEY);
    return null;
  }
}

function formatSuggestion(suggestion: SetSuggestion, unit: 'lb' | 'kg'): string {
  const parts: string[] = [];
  if (suggestion.weight !== null) parts.push(`${suggestion.weight} ${unit}`);
  if (suggestion.reps !== null) parts.push(`${suggestion.reps} reps`);
  return parts.join(' × ');
}

type SetEditorProps = {
  workoutSet: ActiveWorkoutSet;
  targetRepsMin: number | null;
  targetRepsMax: number | null;
  targetSets: number;
  saving: boolean;
  suggestion: SetSuggestion | null;
  nextSetId: string | null;
  onSave: (input: WorkoutSetInput, wasAlreadyCompleted: boolean) => Promise<boolean>;
  onToggleWarmup: (isWarmup: boolean) => Promise<boolean>;
  onSkip: () => Promise<boolean>;
  onRestore: () => Promise<boolean>;
  onReset: () => Promise<boolean>;
  onDeleteExtra: () => Promise<boolean>;
};

function SetEditor({
  workoutSet,
  targetRepsMin,
  targetRepsMax,
  targetSets,
  saving,
  suggestion,
  nextSetId,
  onSave,
  onToggleWarmup,
  onSkip,
  onRestore,
  onReset,
  onDeleteExtra,
}: SetEditorProps) {
  const [weight, setWeight] = useState(workoutSet.weight?.toString() ?? '');
  const [reps, setReps] = useState(workoutSet.reps?.toString() ?? '');
  const [rpe, setRpe] = useState(workoutSet.rpe?.toString() ?? '');
  const [error, setError] = useState<string | null>(null);
  const isExtra = workoutSet.set_number > targetSets;

  useEffect(() => {
    setWeight(workoutSet.weight?.toString() ?? '');
    setReps(workoutSet.reps?.toString() ?? '');
    setRpe(workoutSet.rpe?.toString() ?? '');
  }, [workoutSet.rpe, workoutSet.reps, workoutSet.weight]);

  useEffect(() => {
    if (workoutSet.is_completed || workoutSet.is_skipped || !suggestion) return;
    setWeight((current) => (current.trim() !== '' ? current : suggestion.weight?.toString() ?? ''));
    setReps((current) => (current.trim() !== '' ? current : suggestion.reps?.toString() ?? ''));
  }, [suggestion, workoutSet.is_completed, workoutSet.is_skipped]);

  const targetLabel =
    targetRepsMin && targetRepsMax
      ? targetRepsMin === targetRepsMax
        ? `${targetRepsMin} reps`
        : `${targetRepsMin}–${targetRepsMax} reps`
      : 'Repetitions';

  function adjustWeight(delta: number) {
    const current = weight.trim() === '' ? 0 : Number(weight);
    const next = Math.max(0, (Number.isFinite(current) ? current : 0) + delta);
    setWeight(String(Math.round(next * 2) / 2));
  }

  function adjustReps(delta: number) {
    const current = reps.trim() === '' ? 0 : Number(reps);
    const next = Math.max(1, Math.round((Number.isFinite(current) ? current : 0) + delta));
    setReps(String(next));
  }

  async function handleSave() {
    setError(null);
    const parsedReps = Number(reps);
    const parsedWeight = weight.trim() === '' ? null : Number(weight);
    const parsedRpe = rpe.trim() === '' ? null : Number(rpe);

    if (!Number.isFinite(parsedReps) || parsedReps < 1) {
      setError('Enter at least 1 repetition.');
      return;
    }
    if (parsedWeight !== null && (!Number.isFinite(parsedWeight) || parsedWeight < 0)) {
      setError('Weight cannot be negative.');
      return;
    }
    if (parsedRpe !== null && (!Number.isFinite(parsedRpe) || parsedRpe < 1 || parsedRpe > 10)) {
      setError('RPE must be between 1 and 10.');
      return;
    }

    const saved = await onSave(
      {
        weight: parsedWeight,
        reps: parsedReps,
        rpe: parsedRpe,
        is_warmup: workoutSet.is_warmup,
        is_completed: true,
      },
      workoutSet.is_completed,
    );

    if (saved && nextSetId && !workoutSet.is_completed) {
      window.setTimeout(() => {
        const nextSet = document.getElementById(`workout-set-${nextSetId}`);
        nextSet?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        nextSet?.querySelector<HTMLInputElement>('input[data-field="reps"]')?.focus({ preventScroll: true });
      }, 180);
    }
  }

  async function removeExtraSet() {
    const confirmed = window.confirm(
      workoutSet.is_completed
        ? 'Remove this completed extra set from the current workout?'
        : 'Remove this extra set from the current workout?',
    );
    if (!confirmed) return;
    await onDeleteExtra();
  }

  const classNames = [
    'live-set',
    workoutSet.is_completed ? 'live-set--complete' : '',
    workoutSet.is_warmup ? 'live-set--warmup' : '',
    workoutSet.is_skipped ? 'live-set--skipped' : '',
    isExtra ? 'live-set--extra' : '',
  ].filter(Boolean).join(' ');

  if (workoutSet.is_skipped) {
    return (
      <div className={classNames} id={`workout-set-${workoutSet.id}`}>
        <div className="live-set-header-row">
          <div className="live-set-number">
            <span>{isExtra ? 'Extra' : 'Set'}</span>
            <strong>{workoutSet.set_number}</strong>
          </div>
          <div className="live-set-status">
            <span className="set-skipped-mark">Skipped for today</span>
            <small>This set will not count toward training volume.</small>
          </div>
        </div>
        <div className="live-set-compact-actions">
          <button type="button" disabled={saving} onClick={() => void onRestore()}>
            {saving ? 'Restoring…' : 'Restore set'}
          </button>
          {isExtra ? (
            <button className="live-set-action--danger" type="button" disabled={saving} onClick={() => void removeExtraSet()}>
              Remove extra set
            </button>
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <div className={classNames} id={`workout-set-${workoutSet.id}`}>
      <div className="live-set-header-row">
        <div className="live-set-number">
          <span>{isExtra ? 'Extra' : 'Set'}</span>
          <strong>{workoutSet.set_number}</strong>
        </div>

        <div className="live-set-status">
          {workoutSet.is_completed ? (
            <span className="set-complete-mark">✓ Saved</span>
          ) : suggestion ? (
            <>
              <span className="set-prefill-source">{suggestion.source}</span>
              <small>{formatSuggestion(suggestion, workoutSet.weight_unit)}</small>
            </>
          ) : (
            <span className="set-ready-label">Ready to log</span>
          )}
          {isExtra ? <small>Added during this workout</small> : null}
        </div>
      </div>

      <button
        className={workoutSet.is_warmup ? 'warmup-toggle warmup-toggle--active' : 'warmup-toggle'}
        type="button"
        aria-pressed={workoutSet.is_warmup}
        disabled={saving}
        onClick={() => void onToggleWarmup(!workoutSet.is_warmup)}
      >
        <span aria-hidden="true">{workoutSet.is_warmup ? '✓' : '○'}</span>
        {workoutSet.is_warmup ? 'Warm-up set' : 'Mark as warm-up'}
      </button>

      <div className="live-set-fields">
        <div className="live-set-field">
          <span>Weight ({workoutSet.weight_unit})</span>
          <div className="live-number-control">
            <button type="button" aria-label="Decrease weight by 5" onClick={() => adjustWeight(-5)}>
              −5
            </button>
            <input
              aria-label={`Set ${workoutSet.set_number} weight`}
              type="number"
              min={0}
              step="0.5"
              inputMode="decimal"
              data-field="weight"
              value={weight}
              placeholder="0"
              onChange={(event) => setWeight(event.target.value)}
            />
            <button type="button" aria-label="Increase weight by 5" onClick={() => adjustWeight(5)}>
              +5
            </button>
          </div>
        </div>

        <div className="live-set-field">
          <span>{targetLabel}</span>
          <div className="live-number-control">
            <button type="button" aria-label="Decrease repetitions by 1" onClick={() => adjustReps(-1)}>
              −1
            </button>
            <input
              aria-label={`Set ${workoutSet.set_number} repetitions`}
              type="number"
              min={1}
              max={10000}
              inputMode="numeric"
              data-field="reps"
              value={reps}
              placeholder="Reps"
              onChange={(event) => setReps(event.target.value)}
            />
            <button type="button" aria-label="Increase repetitions by 1" onClick={() => adjustReps(1)}>
              +1
            </button>
          </div>
        </div>

        <div className="live-set-field live-set-field--rpe">
          <span>RPE (optional)</span>
          <input
            aria-label={`Set ${workoutSet.set_number} RPE`}
            type="number"
            min={1}
            max={10}
            step="0.5"
            inputMode="decimal"
            value={rpe}
            placeholder="1–10"
            onChange={(event) => setRpe(event.target.value)}
          />
        </div>
      </div>

      <button
        className="complete-set-button"
        type="button"
        disabled={saving}
        onClick={() => void handleSave()}
      >
        {saving
          ? 'Saving…'
          : workoutSet.is_completed
            ? 'Update saved set'
            : workoutSet.is_warmup
              ? 'Complete warm-up set'
              : 'Complete set'}
      </button>

      <div className="live-set-secondary-actions">
        {workoutSet.is_completed ? (
          <button type="button" disabled={saving} onClick={() => void onReset()}>
            Mark incomplete
          </button>
        ) : (
          <button type="button" disabled={saving} onClick={() => void onSkip()}>
            Skip set
          </button>
        )}
        {isExtra ? (
          <button className="live-set-action--danger" type="button" disabled={saving} onClick={() => void removeExtraSet()}>
            Remove extra
          </button>
        ) : null}
      </div>

      {error ? <p className="live-set-error">{error}</p> : null}
    </div>
  );
}

type ExerciseSetEditorsProps = {
  exercise: ActiveWorkoutExercise;
  savingSetId: string | null;
  addingSet: boolean;
  onSave: (
    setId: string,
    exerciseName: string,
    restSeconds: number,
    input: WorkoutSetInput,
    wasAlreadyCompleted: boolean,
  ) => Promise<boolean>;
  onToggleWarmup: (setId: string, isWarmup: boolean) => Promise<boolean>;
  onSkip: (setId: string) => Promise<boolean>;
  onRestore: (setId: string) => Promise<boolean>;
  onReset: (setId: string) => Promise<boolean>;
  onDeleteExtra: (setId: string) => Promise<boolean>;
  onAddSet: (nextSetNumber: number) => Promise<boolean>;
};

function ExerciseSetEditors({
  exercise,
  savingSetId,
  addingSet,
  onSave,
  onToggleWarmup,
  onSkip,
  onRestore,
  onReset,
  onDeleteExtra,
  onAddSet,
}: ExerciseSetEditorsProps) {
  const previous = usePreviousPerformanceForExercise(exercise.exercise_id);
  const nextSetNumber = Math.max(0, ...exercise.sets.map((set) => set.set_number)) + 1;

  return (
    <div className="live-set-list">
      {exercise.sets.map((workoutSet, index) => {
        const previousCompletedSet = [...exercise.sets]
          .slice(0, index)
          .reverse()
          .find((set) => set.is_completed);
        const previousWorkoutSet =
          previous.performance?.sets.find((set) => set.set_number === workoutSet.set_number) ??
          previous.performance?.sets[index] ??
          previous.performance?.sets[previous.performance.sets.length - 1] ??
          null;

        let suggestion: SetSuggestion | null = null;
        if (previousCompletedSet) {
          suggestion = {
            weight: previousCompletedSet.weight,
            reps: previousCompletedSet.reps,
            source: 'Previous set',
          };
        } else if (previousWorkoutSet) {
          suggestion = {
            weight: previousWorkoutSet.weight,
            reps: previousWorkoutSet.reps,
            source: 'Last workout',
          };
        } else if (
          exercise.target_weight_snapshot !== null ||
          exercise.target_reps_min_snapshot !== null
        ) {
          suggestion = {
            weight: exercise.target_weight_snapshot,
            reps: exercise.target_reps_min_snapshot,
            source: 'Routine target',
          };
        }

        if (suggestion && suggestion.weight === null && suggestion.reps === null) {
          suggestion = null;
        }

        const nextSetId =
          exercise.sets
            .slice(index + 1)
            .find((set) => !set.is_completed && !set.is_skipped)?.id ?? null;

        return (
          <SetEditor
            key={workoutSet.id}
            workoutSet={workoutSet}
            targetRepsMin={exercise.target_reps_min_snapshot}
            targetRepsMax={exercise.target_reps_max_snapshot}
            targetSets={exercise.target_sets_snapshot}
            saving={savingSetId === workoutSet.id}
            suggestion={suggestion}
            nextSetId={nextSetId}
            onSave={(input, wasAlreadyCompleted) =>
              onSave(
                workoutSet.id,
                exercise.exercise_name_snapshot,
                exercise.target_rest_seconds_snapshot,
                input,
                wasAlreadyCompleted,
              )
            }
            onToggleWarmup={(isWarmup) => onToggleWarmup(workoutSet.id, isWarmup)}
            onSkip={() => onSkip(workoutSet.id)}
            onRestore={() => onRestore(workoutSet.id)}
            onReset={() => onReset(workoutSet.id)}
            onDeleteExtra={() => onDeleteExtra(workoutSet.id)}
          />
        );
      })}

      <button
        className="add-extra-set-button"
        type="button"
        disabled={addingSet || nextSetNumber > 100}
        onClick={() => void onAddSet(nextSetNumber)}
      >
        <span aria-hidden="true">＋</span>
        {addingSet ? 'Adding set…' : 'Add extra set'}
      </button>
    </div>
  );
}

export function ActiveWorkout() {
  const { user } = useAuth();
  const active = useActiveWorkout(user?.id);
  const routines = useRoutines(user?.id);
  const [restTimer, setRestTimer] = useState<RestTimerState | null>(() => readStoredRestTimer());
  const [timerNow, setTimerNow] = useState(() => Date.now());
  const [message, setMessage] = useState<string | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);
  const announcedTimerRef = useRef<number | null>(null);
  const elapsedSeconds = useElapsedSeconds(active.session?.started_at);

  const restTimerRemaining = restTimer
    ? Math.max(0, Math.ceil((restTimer.endsAt - timerNow) / 1000))
    : 0;

  useEffect(() => {
    if (!restTimer) return;
    setTimerNow(Date.now());
    const timer = window.setInterval(() => setTimerNow(Date.now()), 250);
    return () => window.clearInterval(timer);
  }, [restTimer]);

  useEffect(() => {
    try {
      if (restTimer) {
        window.localStorage.setItem(REST_TIMER_STORAGE_KEY, JSON.stringify(restTimer));
      } else {
        window.localStorage.removeItem(REST_TIMER_STORAGE_KEY);
      }
    } catch {
      // The timer continues in memory when private storage is unavailable.
    }
  }, [restTimer]);

  useEffect(() => {
    if (!restTimer || active.status === 'loading') return;
    if (!active.session || restTimer.sessionId !== active.session.id) {
      setRestTimer(null);
    }
  }, [active.session, active.status, restTimer]);

  useEffect(() => {
    if (!restTimer || restTimerRemaining !== 0 || announcedTimerRef.current === restTimer.endsAt) return;
    announcedTimerRef.current = restTimer.endsAt;
    if ('vibrate' in navigator) navigator.vibrate([180, 90, 180]);
  }, [restTimer, restTimerRemaining]);

  const availableDays = useMemo(
    () =>
      routines.routines.flatMap((routine) =>
        routine.days.map((day) => ({
          id: day.id,
          routineName: routine.name,
          routineDifficulty: routine.difficulty,
          dayName: day.name,
          focus: day.focus,
          exerciseCount: day.exercises.length,
        })),
      ),
    [routines.routines],
  );

  const sessionProgress = useMemo(() => {
    if (!active.session) {
      return { completed: 0, skipped: 0, total: 0, remaining: 0, percent: 0 };
    }
    const allSets = active.session.exercises.flatMap((exercise) => exercise.sets);
    const completed = allSets.filter((set) => set.is_completed).length;
    const skipped = allSets.filter((set) => set.is_skipped).length;
    const total = allSets.length;
    const resolved = completed + skipped;
    return {
      completed,
      skipped,
      total,
      remaining: Math.max(0, total - resolved),
      percent: total > 0 ? Math.round((resolved / total) * 100) : 0,
    };
  }, [active.session]);

  const nextIncompleteSet = useMemo(() => {
    if (!active.session) return null;
    for (const exercise of active.session.exercises) {
      const nextSet = exercise.sets.find((set) => !set.is_completed && !set.is_skipped);
      if (nextSet) {
        return {
          exerciseName: exercise.exercise_name_snapshot,
          setNumber: nextSet.set_number,
          setId: nextSet.id,
        };
      }
    }
    return null;
  }, [active.session]);

  function startRestTimer(sessionId: string, exerciseName: string, seconds: number) {
    const now = Date.now();
    announcedTimerRef.current = null;
    setTimerNow(now);
    setRestTimer({
      sessionId,
      exerciseName,
      endsAt: now + seconds * 1000,
      total: seconds,
    });
  }

  function adjustRestTimer(seconds: number) {
    const now = Date.now();
    setTimerNow(now);
    announcedTimerRef.current = null;
    setRestTimer((current) => {
      if (!current) return current;
      const currentRemaining = Math.max(0, Math.ceil((current.endsAt - now) / 1000));
      const nextRemaining = Math.max(0, currentRemaining + seconds);
      return {
        ...current,
        endsAt: now + nextRemaining * 1000,
        total: Math.max(1, current.total + seconds),
      };
    });
  }

  function clearRestTimer() {
    setRestTimer(null);
    announcedTimerRef.current = null;
  }

  function scrollToNextSet() {
    if (!nextIncompleteSet) return;
    document
      .getElementById(`workout-set-${nextIncompleteSet.setId}`)
      ?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  async function startDay(dayId: string) {
    setMessage(null);
    setLocalError(null);
    const result = await active.start(dayId);
    if (!result.ok) setLocalError(result.error);
  }

  async function saveSet(
    setId: string,
    exerciseName: string,
    restSeconds: number,
    input: WorkoutSetInput,
    wasAlreadyCompleted: boolean,
  ): Promise<boolean> {
    setMessage(null);
    setLocalError(null);
    const result = await active.saveSet(setId, input);
    if (!result.ok) {
      setLocalError(result.error);
      return false;
    }

    if (!wasAlreadyCompleted && restSeconds > 0 && active.session) {
      startRestTimer(active.session.id, exerciseName, restSeconds);
    }
    return true;
  }

  async function runSetAction(
    action: () => Promise<{ ok: true; data: null } | { ok: false; error: string }>,
  ): Promise<boolean> {
    setMessage(null);
    setLocalError(null);
    const result = await action();
    if (!result.ok) {
      setLocalError(result.error);
      return false;
    }
    return true;
  }

  async function addSet(exercise: ActiveWorkoutExercise, nextSetNumber: number): Promise<boolean> {
    return runSetAction(() =>
      active.addSet(exercise.id, nextSetNumber, exercise.weight_unit_snapshot),
    );
  }

  async function saveSessionDetails(input: WorkoutSessionDetailsInput): Promise<boolean> {
    setMessage(null);
    setLocalError(null);
    const result = await active.saveDetails(input);
    if (!result.ok) {
      setLocalError(result.error);
      return false;
    }
    return true;
  }

  async function saveExerciseNote(exerciseId: string, notes: string | null): Promise<boolean> {
    setMessage(null);
    setLocalError(null);
    const result = await active.saveExerciseNotes(exerciseId, notes);
    if (!result.ok) {
      setLocalError(result.error);
      return false;
    }
    return true;
  }

  async function finishWorkout() {
    if (
      sessionProgress.remaining > 0 &&
      !window.confirm(
        `Finish this workout with ${sessionProgress.remaining} unresolved ${
          sessionProgress.remaining === 1 ? 'set' : 'sets'
        }? Skipped sets are already resolved.`,
      )
    ) {
      return;
    }

    setMessage(null);
    setLocalError(null);
    const result = await active.finish();
    if (!result.ok) {
      setLocalError(result.error);
      return;
    }
    clearRestTimer();
    setMessage('Workout completed and saved to your history.');
  }

  async function cancelCurrentWorkout() {
    if (!window.confirm('Cancel this workout? The session will remain in history as cancelled.')) return;
    setMessage(null);
    setLocalError(null);
    const result = await active.cancel();
    if (!result.ok) {
      setLocalError(result.error);
      return;
    }
    clearRestTimer();
    setMessage('Workout cancelled.');
  }

  if (active.status === 'loading') {
    return (
      <section className="active-workout-state" aria-live="polite" aria-busy="true">
        <div className="loading-mark" aria-hidden="true">W</div>
        <p>Loading your workout…</p>
      </section>
    );
  }

  if (active.status === 'error') {
    return (
      <section className="active-workout-state" role="alert">
        <h2>Workout unavailable</h2>
        <p>{active.error}</p>
        <button className="secondary-button" type="button" onClick={active.refresh}>Try again</button>
      </section>
    );
  }

  if (!active.session) {
    return (
      <section className="workout-launcher" aria-labelledby="start-workout-heading">
        <div className="section-heading workout-launcher-heading">
          <div>
            <p className="eyebrow">Train now</p>
            <h2 id="start-workout-heading">Start a workout</h2>
            <p>Choose a saved routine day. BioTrack will create every exercise and target set for you.</p>
          </div>
          <button className="text-button" type="button" onClick={routines.refresh}>Refresh plans</button>
        </div>

        {message ? <p className="builder-message builder-message--success">{message}</p> : null}
        {localError || active.error || routines.error ? (
          <p className="builder-message builder-message--error" role="alert">
            {localError ?? active.error ?? routines.error}
          </p>
        ) : null}

        {routines.status === 'loading' ? <p>Loading saved routines…</p> : null}
        {availableDays.length === 0 && routines.status !== 'loading' ? (
          <div className="workout-empty-card">
            <h3>Build your first routine</h3>
            <p>Create at least one routine day in the Routine Builder, then return here to train.</p>
          </div>
        ) : null}

        <div className="workout-day-grid">
          {availableDays.map((day) => (
            <article className="workout-day-option" key={day.id}>
              <div>
                <span className="difficulty-chip">{day.routineDifficulty}</span>
                <p>{day.routineName}</p>
                <h3>{day.dayName}</h3>
                <p>{day.focus || 'Custom training day'}</p>
              </div>
              <div className="workout-day-option-footer">
                <span>{day.exerciseCount} exercises</span>
                <button
                  className="primary-button"
                  type="button"
                  disabled={active.startingDayId !== null || day.exerciseCount === 0}
                  onClick={() => void startDay(day.id)}
                >
                  {active.startingDayId === day.id ? 'Starting…' : 'Start workout'}
                </button>
              </div>
            </article>
          ))}
        </div>
      </section>
    );
  }

  const restProgress =
    restTimer && restTimer.total > 0
      ? Math.min(100, Math.max(0, ((restTimer.total - restTimerRemaining) / restTimer.total) * 100))
      : 0;

  return (
    <section className="live-workout" aria-labelledby="live-workout-heading">
      <header className="live-workout-header">
        <div>
          <p className="eyebrow">Workout in progress</p>
          <h2 id="live-workout-heading">{active.session.name}</h2>
          <p>Adjust this session freely. Your saved routine remains unchanged.</p>
        </div>
        <div className="live-workout-metrics live-workout-metrics--flexible">
          <div><span>Elapsed</span><strong>{formatClock(elapsedSeconds)}</strong></div>
          <div><span>Completed</span><strong>{sessionProgress.completed}</strong></div>
          <div><span>Skipped</span><strong>{sessionProgress.skipped}</strong></div>
          <div><span>Remaining</span><strong>{sessionProgress.remaining}</strong></div>
        </div>

        <div className="live-workout-progress" aria-label={`${sessionProgress.percent}% resolved`}>
          <span style={{ width: `${sessionProgress.percent}%` }} />
        </div>

        {nextIncompleteSet ? (
          <button className="next-set-cue" type="button" onClick={scrollToNextSet}>
            <span>Next set</span>
            <strong>{nextIncompleteSet.exerciseName} · Set {nextIncompleteSet.setNumber}</strong>
          </button>
        ) : (
          <div className="next-set-cue next-set-cue--complete">
            <span>All sets resolved</span>
            <strong>Ready to finish</strong>
          </div>
        )}
      </header>

      <SessionDetailsEditor
        session={active.session}
        saving={active.savingSessionDetails}
        onSave={saveSessionDetails}
      />

      {localError || active.error ? (
        <p className="builder-message builder-message--error" role="alert">
          {localError ?? active.error}
        </p>
      ) : null}

      <PreviousPerformanceProvider exerciseIds={active.session.exercises.map((exercise) => exercise.exercise_id)}>
        <div className="live-exercise-list">
          {active.session.exercises.map((exercise) => (
            <article className="live-exercise-card" key={exercise.id}>
              <div className="live-exercise-heading">
                <div>
                  <p>{exercise.primary_muscle_group_snapshot || 'Exercise'}</p>
                  <h3>{exercise.exercise_name_snapshot}</h3>
                </div>
                <span className="rest-target">Rest {formatClock(exercise.target_rest_seconds_snapshot)}</span>
              </div>

              <ExerciseNotesEditor
                exercise={exercise}
                saving={active.savingExerciseId === exercise.id}
                onSave={(notes) => saveExerciseNote(exercise.id, notes)}
              />

              <PreviousPerformance exerciseId={exercise.exercise_id} />

              <ExerciseSetEditors
                exercise={exercise}
                savingSetId={active.savingSetId}
                addingSet={active.addingSetExerciseId === exercise.id}
                onSave={saveSet}
                onToggleWarmup={(setId, isWarmup) => runSetAction(() => active.toggleWarmup(setId, isWarmup))}
                onSkip={(setId) => runSetAction(() => active.skipSet(setId))}
                onRestore={(setId) => runSetAction(() => active.restoreSet(setId))}
                onReset={(setId) => runSetAction(() => active.resetSet(setId))}
                onDeleteExtra={(setId) => runSetAction(() => active.removeSet(setId))}
                onAddSet={(nextSetNumber) => addSet(exercise, nextSetNumber)}
              />
            </article>
          ))}
        </div>
      </PreviousPerformanceProvider>

      <div className="live-workout-actions">
        <button className="primary-button" type="button" disabled={active.finishing} onClick={() => void finishWorkout()}>
          {active.finishing ? 'Finishing…' : 'Finish workout'}
        </button>
        <button className="text-button text-button--danger" type="button" disabled={active.finishing} onClick={() => void cancelCurrentWorkout()}>
          Cancel workout
        </button>
      </div>

      {restTimer ? (
        <aside
          className={restTimerRemaining === 0 ? 'rest-timer rest-timer--done' : 'rest-timer'}
          aria-live="polite"
        >
          <div className="rest-timer-copy">
            <p>{restTimerRemaining === 0 ? 'Rest complete' : `Rest after ${restTimer.exerciseName}`}</p>
            <strong>{formatClock(restTimerRemaining)}</strong>
            <div className="rest-timer-progress" aria-hidden="true">
              <span style={{ width: `${restProgress}%` }} />
            </div>
          </div>
          <div className="rest-timer-actions">
            {restTimerRemaining > 0 ? (
              <button type="button" onClick={() => adjustRestTimer(-15)}>−15 sec</button>
            ) : null}
            <button type="button" onClick={() => adjustRestTimer(30)}>+30 sec</button>
            <button type="button" onClick={clearRestTimer}>
              {restTimerRemaining > 0 ? 'Skip' : 'Close'}
            </button>
          </div>
        </aside>
      ) : null}
    </section>
  );
}
