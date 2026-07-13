import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import type { ActiveWorkoutExercise } from './repositories/activeWorkoutRepository';
import type {
  ExerciseRecord,
  WorkoutSessionSummary,
} from './repositories/workoutHistoryRepository';
import type { WorkoutWorkspaceView } from './WorkoutWorkspace';
import {
  WORKOUT_COMPLETED_EVENT,
  type WorkoutCompletedEventDetail,
} from './workoutCompletionEvent';

type WorkoutCompletionExperienceProps = {
  onNavigate: (view: WorkoutWorkspaceView) => void;
};

type RecordAchievement = {
  exerciseName: string;
  metric: 'Heaviest weight' | 'Most reps' | 'Best set volume';
  value: string;
};

type MuscleSummary = {
  name: string;
  sets: number;
};

type ComparisonMetric = {
  label: string;
  current: string;
  previous: string;
  delta: string;
  direction: 'up' | 'down' | 'same' | 'neutral';
};

type CompletionSummary = {
  sessionId: string;
  name: string;
  completedAt: string;
  durationSeconds: number;
  completedSets: number;
  plannedSets: number;
  completionPercent: number;
  totalReps: number;
  totalVolume: number;
  weightUnit: 'lb' | 'kg';
  exerciseCount: number;
  averageRpe: number | null;
  records: RecordAchievement[];
  muscles: MuscleSummary[];
  previousSessionName: string | null;
  comparison: ComparisonMetric[];
  coachMessage: string;
};

function formatNumber(value: number, maximumFractionDigits = 0): string {
  return new Intl.NumberFormat(undefined, { maximumFractionDigits }).format(value);
}

function formatDuration(totalSeconds: number): string {
  const minutes = Math.max(0, Math.round(totalSeconds / 60));
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return remainingMinutes > 0 ? `${hours}h ${remainingMinutes}m` : `${hours}h`;
}

function formatDateTime(value: string): string {
  return new Intl.DateTimeFormat(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(value));
}

function previousRecordFor(
  records: ExerciseRecord[],
  exerciseId: string,
  weightUnit: 'lb' | 'kg',
): ExerciseRecord | null {
  return (
    records.find(
      (record) => record.exercise_id === exerciseId && record.weight_unit === weightUnit,
    ) ?? null
  );
}

function completedWorkingSets(exercise: ActiveWorkoutExercise) {
  return exercise.sets.filter((set) => set.is_completed && !set.is_warmup);
}

function buildRecordAchievements(
  exercises: ActiveWorkoutExercise[],
  previousRecords: ExerciseRecord[],
): RecordAchievement[] {
  const achievements: RecordAchievement[] = [];

  exercises.forEach((exercise) => {
    const sets = completedWorkingSets(exercise);
    if (sets.length === 0) return;

    const weightUnit = sets[0]?.weight_unit ?? exercise.weight_unit_snapshot;
    const previous = previousRecordFor(previousRecords, exercise.exercise_id, weightUnit);
    if (!previous) return;

    const weights = sets.flatMap((set) => (set.weight === null ? [] : [set.weight]));
    const repetitions = sets.flatMap((set) => (set.reps === null ? [] : [set.reps]));
    const setVolumes = sets.flatMap((set) =>
      set.weight === null || set.reps === null ? [] : [set.weight * set.reps],
    );

    const heaviestWeight = weights.length > 0 ? Math.max(...weights) : null;
    const highestReps = repetitions.length > 0 ? Math.max(...repetitions) : null;
    const bestSetVolume = setVolumes.length > 0 ? Math.max(...setVolumes) : null;

    if (
      heaviestWeight !== null &&
      (previous.heaviest_weight === null || heaviestWeight > previous.heaviest_weight)
    ) {
      achievements.push({
        exerciseName: exercise.exercise_name_snapshot,
        metric: 'Heaviest weight',
        value: `${formatNumber(heaviestWeight, 1)} ${weightUnit}`,
      });
    }

    if (
      highestReps !== null &&
      (previous.highest_reps === null || highestReps > previous.highest_reps)
    ) {
      achievements.push({
        exerciseName: exercise.exercise_name_snapshot,
        metric: 'Most reps',
        value: `${highestReps} reps`,
      });
    }

    if (
      bestSetVolume !== null &&
      (previous.best_set_volume === null || bestSetVolume > previous.best_set_volume)
    ) {
      achievements.push({
        exerciseName: exercise.exercise_name_snapshot,
        metric: 'Best set volume',
        value: `${formatNumber(bestSetVolume)} ${weightUnit}`,
      });
    }
  });

  return achievements.slice(0, 8);
}

function findPreviousSession(
  currentName: string,
  routineDayId: string | null,
  history: WorkoutSessionSummary[],
): WorkoutSessionSummary | null {
  if (routineDayId) {
    const sameDay = history.find((session) => session.routine_day_id === routineDayId);
    if (sameDay) return sameDay;
  }
  return history.find((session) => session.name === currentName) ?? null;
}

function comparisonDirection(delta: number): 'up' | 'down' | 'same' {
  if (delta > 0) return 'up';
  if (delta < 0) return 'down';
  return 'same';
}

function signedNumber(value: number, suffix = ''): string {
  if (value === 0) return `No change${suffix}`;
  const sign = value > 0 ? '+' : '−';
  return `${sign}${formatNumber(Math.abs(value))}${suffix}`;
}

function buildComparison(
  current: Pick<
    CompletionSummary,
    'completedSets' | 'totalReps' | 'totalVolume' | 'durationSeconds' | 'weightUnit'
  >,
  previous: WorkoutSessionSummary | null,
): ComparisonMetric[] {
  if (!previous) return [];

  const setDelta = current.completedSets - previous.working_set_count;
  const repDelta = current.totalReps - previous.total_reps;
  const durationDeltaMinutes = Math.round((current.durationSeconds - previous.duration_seconds) / 60);
  const metrics: ComparisonMetric[] = [
    {
      label: 'Working sets',
      current: formatNumber(current.completedSets),
      previous: formatNumber(previous.working_set_count),
      delta: signedNumber(setDelta),
      direction: comparisonDirection(setDelta),
    },
    {
      label: 'Total reps',
      current: formatNumber(current.totalReps),
      previous: formatNumber(previous.total_reps),
      delta: signedNumber(repDelta),
      direction: comparisonDirection(repDelta),
    },
    {
      label: 'Training time',
      current: formatDuration(current.durationSeconds),
      previous: formatDuration(previous.duration_seconds),
      delta:
        durationDeltaMinutes === 0
          ? 'Same time'
          : `${durationDeltaMinutes > 0 ? '+' : '−'}${Math.abs(durationDeltaMinutes)} min`,
      direction: 'neutral',
    },
  ];

  if (previous.weight_unit === current.weightUnit) {
    const volumeDelta = current.totalVolume - previous.total_volume;
    metrics.unshift({
      label: 'Training volume',
      current: `${formatNumber(current.totalVolume)} ${current.weightUnit}`,
      previous: `${formatNumber(previous.total_volume)} ${previous.weight_unit}`,
      delta: signedNumber(volumeDelta, ` ${current.weightUnit}`),
      direction: comparisonDirection(volumeDelta),
    });
  }

  return metrics;
}

function buildCoachMessage(
  records: RecordAchievement[],
  completionPercent: number,
  comparison: ComparisonMetric[],
  hasPreviousSession: boolean,
): string {
  if (records.length > 0) {
    return `You set ${records.length} new personal ${records.length === 1 ? 'best' : 'bests'}. Review the wins, recover well and let the next session build on real evidence.`;
  }

  const volume = comparison.find((metric) => metric.label === 'Training volume');
  if (completionPercent === 100 && volume?.direction === 'up') {
    return 'Every programmed set was completed and total volume moved forward. That is measurable progression without changing the plan automatically.';
  }

  if (completionPercent === 100) {
    return 'Every programmed set was completed. This session is now part of your progression history and will guide future recommendations.';
  }

  if (hasPreviousSession) {
    return 'The completed work is saved. Use the comparison below as context, not judgment, and adjust the next session only when the evidence supports it.';
  }

  return 'Your first baseline is saved. Future workouts can now be compared against real sets, repetitions, load and effort.';
}

function buildCompletionSummary(detail: WorkoutCompletedEventDetail): CompletionSummary {
  const completedAt = new Date(detail.completedAt);
  const durationSeconds = Math.max(
    0,
    Math.round((completedAt.getTime() - new Date(detail.session.started_at).getTime()) / 1000),
  );
  const allSets = detail.session.exercises.flatMap((exercise) => exercise.sets);
  const completedSets = detail.session.exercises.flatMap(completedWorkingSets);
  const totalReps = completedSets.reduce((sum, set) => sum + (set.reps ?? 0), 0);
  const totalVolume = completedSets.reduce(
    (sum, set) => sum + (set.weight === null ? 0 : set.weight * (set.reps ?? 0)),
    0,
  );
  const rpeValues = completedSets.flatMap((set) => (set.rpe === null ? [] : [set.rpe]));
  const averageRpe =
    rpeValues.length > 0
      ? rpeValues.reduce((sum, value) => sum + value, 0) / rpeValues.length
      : null;
  const completionPercent =
    allSets.length > 0 ? Math.round((allSets.filter((set) => set.is_completed).length / allSets.length) * 100) : 0;

  const muscleCounts = new Map<string, number>();
  detail.session.exercises.forEach((exercise) => {
    const setCount = completedWorkingSets(exercise).length;
    if (setCount === 0) return;
    const muscle = exercise.primary_muscle_group_snapshot ?? 'Other';
    muscleCounts.set(muscle, (muscleCounts.get(muscle) ?? 0) + setCount);
  });

  const previousSession = findPreviousSession(
    detail.session.name,
    detail.session.routine_day_id,
    detail.previousHistory,
  );
  const records = buildRecordAchievements(detail.session.exercises, detail.previousRecords);
  const currentMetrics = {
    completedSets: completedSets.length,
    totalReps,
    totalVolume,
    durationSeconds,
    weightUnit: detail.session.weight_unit,
  };
  const comparison = buildComparison(currentMetrics, previousSession);

  return {
    sessionId: detail.session.id,
    name: detail.session.name,
    completedAt: detail.completedAt,
    durationSeconds,
    completedSets: completedSets.length,
    plannedSets: allSets.length,
    completionPercent,
    totalReps,
    totalVolume,
    weightUnit: detail.session.weight_unit,
    exerciseCount: detail.session.exercises.filter(
      (exercise) => completedWorkingSets(exercise).length > 0,
    ).length,
    averageRpe,
    records,
    muscles: [...muscleCounts.entries()]
      .map(([name, sets]) => ({ name, sets }))
      .sort((a, b) => b.sets - a.sets),
    previousSessionName: previousSession?.name ?? null,
    comparison,
    coachMessage: buildCoachMessage(
      records,
      completionPercent,
      comparison,
      Boolean(previousSession),
    ),
  };
}

function buildShareText(summary: CompletionSummary): string {
  const lines = [
    'BioTrack AI workout complete',
    summary.name,
    `${summary.completedSets} working sets · ${summary.totalReps} reps · ${formatNumber(summary.totalVolume)} ${summary.weightUnit}`,
    `${formatDuration(summary.durationSeconds)} · ${summary.exerciseCount} exercises`,
  ];
  if (summary.records.length > 0) {
    lines.push(`${summary.records.length} new personal ${summary.records.length === 1 ? 'best' : 'bests'}`);
  }
  return lines.join('\n');
}

async function copyText(text: string): Promise<void> {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }

  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.setAttribute('readonly', 'true');
  textarea.style.position = 'fixed';
  textarea.style.opacity = '0';
  document.body.appendChild(textarea);
  textarea.select();
  document.execCommand('copy');
  textarea.remove();
}

export function WorkoutCompletionExperience({
  onNavigate,
}: WorkoutCompletionExperienceProps) {
  const [summary, setSummary] = useState<CompletionSummary | null>(null);
  const [shareMessage, setShareMessage] = useState<string | null>(null);
  const dialogRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const handleCompleted = (event: Event) => {
      const detail = (event as CustomEvent<WorkoutCompletedEventDetail>).detail;
      if (!detail?.session) return;
      setSummary(buildCompletionSummary(detail));
      setShareMessage(null);
    };

    window.addEventListener(WORKOUT_COMPLETED_EVENT, handleCompleted);
    return () => window.removeEventListener(WORKOUT_COMPLETED_EVENT, handleCompleted);
  }, []);

  useEffect(() => {
    if (!summary) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.setTimeout(() => dialogRef.current?.focus(), 0);

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setSummary(null);
    };
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [summary]);

  const completionStyle = useMemo(
    () => ({ '--workout-completion': `${summary?.completionPercent ?? 0}%` }) as CSSProperties,
    [summary?.completionPercent],
  );

  if (!summary) return null;

  async function shareSummary() {
    const text = buildShareText(summary);
    setShareMessage(null);

    try {
      if (navigator.share) {
        await navigator.share({ title: 'BioTrack AI workout complete', text });
        setShareMessage('Summary shared.');
      } else {
        await copyText(text);
        setShareMessage('Summary copied.');
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return;
      try {
        await copyText(text);
        setShareMessage('Summary copied.');
      } catch {
        setShareMessage('Sharing is unavailable on this device.');
      }
    }
  }

  function closeAndNavigate(view: WorkoutWorkspaceView) {
    setSummary(null);
    onNavigate(view);
  }

  return (
    <div
      className="workout-completion-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.currentTarget === event.target) setSummary(null);
      }}
    >
      <section
        className="workout-completion-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="workout-completion-title"
        tabIndex={-1}
        ref={dialogRef}
      >
        <button
          className="workout-completion-close"
          type="button"
          aria-label="Close workout summary"
          onClick={() => setSummary(null)}
        >
          ×
        </button>

        <header className="workout-completion-hero">
          <div className="completion-ring" style={completionStyle} aria-label={`${summary.completionPercent}% complete`}>
            <div>
              <strong>{summary.completionPercent}%</strong>
              <span>complete</span>
            </div>
          </div>
          <div>
            <p className="eyebrow">Workout complete</p>
            <h2 id="workout-completion-title">{summary.name}</h2>
            <p>{formatDateTime(summary.completedAt)}</p>
          </div>
        </header>

        <div className="completion-coach-message">
          <span aria-hidden="true">AI</span>
          <p>{summary.coachMessage}</p>
        </div>

        <div className="completion-metric-grid" aria-label="Workout totals">
          <article><span>Time</span><strong>{formatDuration(summary.durationSeconds)}</strong></article>
          <article><span>Working sets</span><strong>{summary.completedSets}</strong><small>of {summary.plannedSets} planned</small></article>
          <article><span>Total reps</span><strong>{formatNumber(summary.totalReps)}</strong></article>
          <article><span>Volume</span><strong>{formatNumber(summary.totalVolume)}</strong><small>{summary.weightUnit}</small></article>
          <article><span>Exercises</span><strong>{summary.exerciseCount}</strong></article>
          <article><span>Average RPE</span><strong>{summary.averageRpe === null ? '—' : formatNumber(summary.averageRpe, 1)}</strong></article>
        </div>

        {summary.records.length > 0 ? (
          <section className="completion-section completion-records" aria-labelledby="completion-records-title">
            <div className="completion-section-heading">
              <div>
                <p className="eyebrow">Personal bests</p>
                <h3 id="completion-records-title">New records</h3>
              </div>
              <span>{summary.records.length}</span>
            </div>
            <div className="completion-record-list">
              {summary.records.map((record, index) => (
                <article key={`${record.exerciseName}:${record.metric}:${index}`}>
                  <span aria-hidden="true">PR</span>
                  <div><strong>{record.exerciseName}</strong><small>{record.metric}</small></div>
                  <strong>{record.value}</strong>
                </article>
              ))}
            </div>
          </section>
        ) : null}

        {summary.comparison.length > 0 ? (
          <section className="completion-section" aria-labelledby="completion-comparison-title">
            <div className="completion-section-heading">
              <div>
                <p className="eyebrow">Previous performance</p>
                <h3 id="completion-comparison-title">Compared with {summary.previousSessionName}</h3>
              </div>
            </div>
            <div className="completion-comparison-grid">
              {summary.comparison.map((metric) => (
                <article key={metric.label}>
                  <span>{metric.label}</span>
                  <div><strong>{metric.current}</strong><small>Last: {metric.previous}</small></div>
                  <em className={`comparison-delta comparison-delta--${metric.direction}`}>{metric.delta}</em>
                </article>
              ))}
            </div>
          </section>
        ) : null}

        {summary.muscles.length > 0 ? (
          <section className="completion-section" aria-labelledby="completion-muscles-title">
            <div className="completion-section-heading">
              <div>
                <p className="eyebrow">Training focus</p>
                <h3 id="completion-muscles-title">Muscles trained</h3>
              </div>
            </div>
            <div className="completion-muscle-list">
              {summary.muscles.map((muscle) => (
                <span key={muscle.name}><strong>{muscle.name}</strong>{muscle.sets} sets</span>
              ))}
            </div>
          </section>
        ) : null}

        {shareMessage ? <p className="completion-share-message" role="status">{shareMessage}</p> : null}

        <footer className="workout-completion-actions">
          <button className="primary-button" type="button" onClick={() => closeAndNavigate('history')}>
            View workout history
          </button>
          <button className="secondary-button" type="button" onClick={() => void shareSummary()}>
            Share summary
          </button>
          <button className="text-button" type="button" onClick={() => setSummary(null)}>
            Done
          </button>
        </footer>
      </section>
    </div>
  );
}
