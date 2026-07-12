import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../auth/AuthProvider';
import { PreviousPerformance, PreviousPerformanceProvider } from './PreviousPerformance';
import { useActiveWorkout } from './hooks/useActiveWorkout';
import { useRoutines } from './hooks/useRoutines';
import type {
  ActiveWorkoutSet,
  WorkoutSetInput,
} from './repositories/activeWorkoutRepository';

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
  exerciseName: string;
  remaining: number;
  total: number;
};

type SetEditorProps = {
  workoutSet: ActiveWorkoutSet;
  targetRepsMin: number | null;
  targetRepsMax: number | null;
  saving: boolean;
  onSave: (input: WorkoutSetInput, wasAlreadyCompleted: boolean) => Promise<boolean>;
};

function SetEditor({
  workoutSet,
  targetRepsMin,
  targetRepsMax,
  saving,
  onSave,
}: SetEditorProps) {
  const [weight, setWeight] = useState(workoutSet.weight?.toString() ?? '');
  const [reps, setReps] = useState(workoutSet.reps?.toString() ?? '');
  const [rpe, setRpe] = useState(workoutSet.rpe?.toString() ?? '');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setWeight(workoutSet.weight?.toString() ?? '');
    setReps(workoutSet.reps?.toString() ?? '');
    setRpe(workoutSet.rpe?.toString() ?? '');
  }, [workoutSet.rpe, workoutSet.reps, workoutSet.weight]);

  const targetLabel =
    targetRepsMin && targetRepsMax
      ? targetRepsMin === targetRepsMax
        ? `${targetRepsMin} reps`
        : `${targetRepsMin}–${targetRepsMax} reps`
      : 'Custom reps';

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

    await onSave(
      {
        weight: parsedWeight,
        reps: parsedReps,
        rpe: parsedRpe,
        is_completed: true,
      },
      workoutSet.is_completed,
    );
  }

  return (
    <div className={workoutSet.is_completed ? 'live-set live-set--complete' : 'live-set'}>
      <div className="live-set-number">
        <span>Set</span>
        <strong>{workoutSet.set_number}</strong>
      </div>
      <label className="live-set-field">
        <span>Weight ({workoutSet.weight_unit})</span>
        <input
          type="number"
          min={0}
          step="0.5"
          inputMode="decimal"
          value={weight}
          placeholder="0"
          onChange={(event) => setWeight(event.target.value)}
        />
      </label>
      <label className="live-set-field">
        <span>{targetLabel}</span>
        <input
          type="number"
          min={1}
          max={10000}
          inputMode="numeric"
          value={reps}
          placeholder="Reps"
          onChange={(event) => setReps(event.target.value)}
        />
      </label>
      <label className="live-set-field">
        <span>RPE</span>
        <input
          type="number"
          min={1}
          max={10}
          step="0.5"
          inputMode="decimal"
          value={rpe}
          placeholder="1–10"
          onChange={(event) => setRpe(event.target.value)}
        />
      </label>
      <button className="complete-set-button" type="button" disabled={saving} onClick={() => void handleSave()}>
        {saving ? 'Saving…' : workoutSet.is_completed ? 'Update' : 'Complete'}
      </button>
      {workoutSet.is_completed ? <span className="set-complete-mark">✓ Saved</span> : null}
      {error ? <p className="live-set-error">{error}</p> : null}
    </div>
  );
}

export function ActiveWorkout() {
  const { user } = useAuth();
  const active = useActiveWorkout(user?.id);
  const routines = useRoutines(user?.id);
  const [restTimer, setRestTimer] = useState<RestTimerState | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);
  const elapsedSeconds = useElapsedSeconds(active.session?.started_at);

  useEffect(() => {
    if (!restTimer || restTimer.remaining <= 0) return;
    const timer = window.setInterval(() => {
      setRestTimer((current) =>
        current ? { ...current, remaining: Math.max(0, current.remaining - 1) } : current,
      );
    }, 1000);
    return () => window.clearInterval(timer);
  }, [restTimer?.remaining]);

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
    if (!active.session) return { completed: 0, total: 0 };
    const allSets = active.session.exercises.flatMap((exercise) => exercise.sets);
    return {
      completed: allSets.filter((set) => set.is_completed).length,
      total: allSets.length,
    };
  }, [active.session]);

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

    if (!wasAlreadyCompleted && restSeconds > 0) {
      setRestTimer({ exerciseName, remaining: restSeconds, total: restSeconds });
    }
    return true;
  }

  async function finishWorkout() {
    setMessage(null);
    setLocalError(null);
    const result = await active.finish();
    if (!result.ok) {
      setLocalError(result.error);
      return;
    }
    setRestTimer(null);
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
    setRestTimer(null);
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

  return (
    <section className="live-workout" aria-labelledby="live-workout-heading">
      <header className="live-workout-header">
        <div>
          <p className="eyebrow">Workout in progress</p>
          <h2 id="live-workout-heading">{active.session.name}</h2>
          <p>Complete each set to save it instantly and begin the programmed rest timer.</p>
        </div>
        <div className="live-workout-metrics">
          <div><span>Elapsed</span><strong>{formatClock(elapsedSeconds)}</strong></div>
          <div><span>Sets</span><strong>{sessionProgress.completed}/{sessionProgress.total}</strong></div>
        </div>
      </header>

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

              <PreviousPerformance exerciseId={exercise.exercise_id} />

              <div className="live-set-list">
                {exercise.sets.map((workoutSet) => (
                  <SetEditor
                    key={workoutSet.id}
                    workoutSet={workoutSet}
                    targetRepsMin={exercise.target_reps_min_snapshot}
                    targetRepsMax={exercise.target_reps_max_snapshot}
                    saving={active.savingSetId === workoutSet.id}
                    onSave={(input, wasAlreadyCompleted) =>
                      saveSet(
                        workoutSet.id,
                        exercise.exercise_name_snapshot,
                        exercise.target_rest_seconds_snapshot,
                        input,
                        wasAlreadyCompleted,
                      )
                    }
                  />
                ))}
              </div>
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
        <aside className={restTimer.remaining === 0 ? 'rest-timer rest-timer--done' : 'rest-timer'} aria-live="polite">
          <div>
            <p>{restTimer.remaining === 0 ? 'Rest complete' : `Rest after ${restTimer.exerciseName}`}</p>
            <strong>{formatClock(restTimer.remaining)}</strong>
          </div>
          <div className="rest-timer-actions">
            {restTimer.remaining > 0 ? (
              <button type="button" onClick={() => setRestTimer((current) => current ? { ...current, remaining: current.remaining + 30, total: current.total + 30 } : current)}>+30 sec</button>
            ) : null}
            <button type="button" onClick={() => setRestTimer(null)}>{restTimer.remaining > 0 ? 'Skip' : 'Close'}</button>
          </div>
        </aside>
      ) : null}
    </section>
  );
}
