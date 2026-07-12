import { useMemo } from 'react';
import { useAuth } from '../auth/AuthProvider';
import { useWorkoutHistory } from './hooks/useWorkoutHistory';
import type {
  MuscleVolumeDay,
  WorkoutHistorySet,
  WorkoutSessionDetail,
  WorkoutSessionSummary,
} from './repositories/workoutHistoryRepository';

function formatNumber(value: number, maximumFractionDigits = 0): string {
  return new Intl.NumberFormat(undefined, { maximumFractionDigits }).format(value);
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(value));
}

function formatDateTime(value: string): string {
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(value));
}

function formatDuration(totalSeconds: number): string {
  const minutes = Math.max(0, Math.round(totalSeconds / 60));
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return remainingMinutes > 0 ? `${hours}h ${remainingMinutes}m` : `${hours}h`;
}

function formatVolumeTotals(history: WorkoutSessionSummary[]): string {
  const totals = new Map<'lb' | 'kg', number>();
  history.forEach((session) => {
    totals.set(session.weight_unit, (totals.get(session.weight_unit) ?? 0) + session.total_volume);
  });

  const values = Array.from(totals.entries()).filter(([, value]) => value > 0);
  if (values.length === 0) return '0';
  return values.map(([unit, value]) => `${formatNumber(value)} ${unit}`).join(' · ');
}

function formatSet(workoutSet: WorkoutHistorySet): string {
  if (!workoutSet.is_completed) return `Set ${workoutSet.set_number}: skipped`;
  const reps = workoutSet.reps ?? 0;
  const weight = workoutSet.weight;
  const effort = workoutSet.rpe ? ` · RPE ${formatNumber(workoutSet.rpe, 1)}` : '';
  if (weight === null) return `Set ${workoutSet.set_number}: ${reps} reps${effort}`;
  return `Set ${workoutSet.set_number}: ${formatNumber(weight, 1)} ${workoutSet.weight_unit} × ${reps}${effort}`;
}

type MuscleAggregate = {
  muscleGroup: string;
  weightUnit: 'lb' | 'kg';
  sets: number;
  reps: number;
  volume: number;
};

function aggregateMuscleVolume(rows: MuscleVolumeDay[]): MuscleAggregate[] {
  const grouped = new Map<string, MuscleAggregate>();

  rows.forEach((row) => {
    const key = `${row.muscle_group}:${row.weight_unit}`;
    const current = grouped.get(key) ?? {
      muscleGroup: row.muscle_group,
      weightUnit: row.weight_unit,
      sets: 0,
      reps: 0,
      volume: 0,
    };
    current.sets += row.completed_set_count;
    current.reps += row.total_reps;
    current.volume += row.total_volume;
    grouped.set(key, current);
  });

  return Array.from(grouped.values()).sort((a, b) => {
    if (b.volume !== a.volume) return b.volume - a.volume;
    return b.sets - a.sets;
  });
}

function SessionDetails({ detail }: { detail: WorkoutSessionDetail }) {
  return (
    <div className="history-session-detail">
      {detail.exercises.map((exercise) => (
        <article className="history-exercise-detail" key={exercise.id}>
          <div className="history-exercise-heading">
            <div>
              <p>{exercise.primary_muscle_group_snapshot ?? 'Exercise'}</p>
              <h4>{exercise.exercise_name_snapshot}</h4>
            </div>
            <span>
              {exercise.sets.filter((set) => set.is_completed).length}/{exercise.sets.length} sets
            </span>
          </div>
          <div className="history-set-list">
            {exercise.sets.map((workoutSet) => (
              <span
                className={workoutSet.is_completed ? 'history-set-chip' : 'history-set-chip history-set-chip--skipped'}
                key={workoutSet.id}
              >
                {formatSet(workoutSet)}
              </span>
            ))}
          </div>
          {exercise.notes ? <p className="history-exercise-notes">{exercise.notes}</p> : null}
        </article>
      ))}
    </div>
  );
}

export function WorkoutHistory() {
  const { user } = useAuth();
  const historyState = useWorkoutHistory(user?.id);

  const overview = useMemo(
    () => ({
      workouts: historyState.history.length,
      sets: historyState.history.reduce((total, session) => total + session.working_set_count, 0),
      reps: historyState.history.reduce((total, session) => total + session.total_reps, 0),
      volume: formatVolumeTotals(historyState.history),
    }),
    [historyState.history],
  );

  const muscleProgress = useMemo(
    () => aggregateMuscleVolume(historyState.muscleVolume),
    [historyState.muscleVolume],
  );
  const maxMuscleVolume = Math.max(1, ...muscleProgress.map((item) => item.volume));

  const topRecords = useMemo(
    () =>
      [...historyState.records]
        .sort((a, b) => {
          const weightDifference = (b.heaviest_weight ?? -1) - (a.heaviest_weight ?? -1);
          if (weightDifference !== 0) return weightDifference;
          return new Date(b.last_performed_at).getTime() - new Date(a.last_performed_at).getTime();
        })
        .slice(0, 12),
    [historyState.records],
  );

  if (historyState.status === 'loading') {
    return (
      <section className="history-state-card" aria-live="polite" aria-busy="true">
        <div className="loading-mark" aria-hidden="true">H</div>
        <p>Building your training history…</p>
      </section>
    );
  }

  if (historyState.status === 'error') {
    return (
      <section className="history-state-card" role="alert">
        <h2>History unavailable</h2>
        <p>{historyState.error}</p>
        <button className="secondary-button" type="button" onClick={historyState.refresh}>Try again</button>
      </section>
    );
  }

  if (historyState.status === 'empty') {
    return (
      <section className="history-empty" aria-labelledby="history-empty-heading">
        <p className="eyebrow">Progress starts with one session</p>
        <h2 id="history-empty-heading">No completed workouts yet</h2>
        <p>
          Finish a workout in the Train tab. BioTrack will automatically create your history, records and
          muscle-group progress from the sets you save.
        </p>
      </section>
    );
  }

  return (
    <section className="workout-history" aria-labelledby="workout-history-heading">
      <div className="section-heading history-heading">
        <div>
          <p className="eyebrow">Training intelligence</p>
          <h2 id="workout-history-heading">History & progress</h2>
          <p>Review completed sessions, previous performance, personal records and 90-day muscle volume.</p>
        </div>
        <button className="text-button" type="button" onClick={historyState.refresh}>Refresh</button>
      </div>

      {historyState.error ? (
        <p className="builder-message builder-message--error" role="alert">{historyState.error}</p>
      ) : null}

      <div className="history-overview-grid">
        <article><span>Workouts</span><strong>{overview.workouts}</strong></article>
        <article><span>Working sets</span><strong>{formatNumber(overview.sets)}</strong></article>
        <article><span>Total reps</span><strong>{formatNumber(overview.reps)}</strong></article>
        <article><span>Training volume</span><strong>{overview.volume}</strong></article>
      </div>

      <div className="history-dashboard-grid">
        <section className="history-panel" aria-labelledby="recent-sessions-heading">
          <div className="history-panel-heading">
            <div>
              <p className="eyebrow">Completed workouts</p>
              <h3 id="recent-sessions-heading">Recent sessions</h3>
            </div>
            <span>{historyState.history.length} saved</span>
          </div>

          <div className="history-session-list">
            {historyState.history.map((session) => {
              const selected = historyState.selectedSessionId === session.id;
              const loading = historyState.loadingDetailId === session.id;
              return (
                <article className={selected ? 'history-session-card history-session-card--open' : 'history-session-card'} key={session.id}>
                  <button
                    className="history-session-toggle"
                    type="button"
                    aria-expanded={selected}
                    onClick={() => void historyState.toggleSession(session.id)}
                  >
                    <div>
                      <span>{formatDateTime(session.completed_at)}</span>
                      <h4>{session.name}</h4>
                    </div>
                    <div className="history-session-stats">
                      <span>{formatDuration(session.duration_seconds)}</span>
                      <span>{session.exercise_count} exercises</span>
                      <span>{session.working_set_count} sets</span>
                      <span>{formatNumber(session.total_volume)} {session.weight_unit}</span>
                    </div>
                  </button>
                  {selected && loading ? <p className="history-detail-loading">Loading set details…</p> : null}
                  {selected && historyState.selectedDetail ? (
                    <SessionDetails detail={historyState.selectedDetail} />
                  ) : null}
                </article>
              );
            })}
          </div>
        </section>

        <section className="history-panel" aria-labelledby="muscle-progress-heading">
          <div className="history-panel-heading">
            <div>
              <p className="eyebrow">Last 90 days</p>
              <h3 id="muscle-progress-heading">Muscle-group progress</h3>
            </div>
          </div>

          {muscleProgress.length === 0 ? (
            <p>No working-set volume is available yet.</p>
          ) : (
            <div className="muscle-progress-list">
              {muscleProgress.map((item) => (
                <article key={`${item.muscleGroup}:${item.weightUnit}`}>
                  <div className="muscle-progress-label">
                    <div><strong>{item.muscleGroup}</strong><span>{item.sets} sets · {item.reps} reps</span></div>
                    <span>{formatNumber(item.volume)} {item.weightUnit}</span>
                  </div>
                  <div className="muscle-progress-track" aria-hidden="true">
                    <span style={{ width: `${Math.max(4, (item.volume / maxMuscleVolume) * 100)}%` }} />
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>

      <section className="history-panel" aria-labelledby="records-heading">
        <div className="history-panel-heading">
          <div>
            <p className="eyebrow">Personal bests</p>
            <h3 id="records-heading">Exercise records</h3>
          </div>
          <span>{historyState.records.length} tracked</span>
        </div>

        <div className="exercise-record-grid">
          {topRecords.map((record) => (
            <article className="exercise-record-card" key={`${record.exercise_id}:${record.weight_unit}`}>
              <p>{record.primary_muscle_group}</p>
              <h4>{record.exercise_name}</h4>
              <div className="exercise-record-values">
                <div><span>Heaviest</span><strong>{record.heaviest_weight === null ? '—' : `${formatNumber(record.heaviest_weight, 1)} ${record.weight_unit}`}</strong></div>
                <div><span>Most reps</span><strong>{record.highest_reps ?? '—'}</strong></div>
                <div><span>Best set volume</span><strong>{record.best_set_volume === null ? '—' : `${formatNumber(record.best_set_volume)} ${record.weight_unit}`}</strong></div>
              </div>
              <footer>{record.session_count} sessions · Last {formatDate(record.last_performed_at)}</footer>
            </article>
          ))}
        </div>
      </section>
    </section>
  );
}
