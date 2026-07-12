import { useMemo } from 'react';
import { useAuth } from '../auth/AuthProvider';
import { useActiveWorkout } from './hooks/useActiveWorkout';
import { useRoutines } from './hooks/useRoutines';
import { useWorkoutHistory } from './hooks/useWorkoutHistory';
import type { WorkoutWorkspaceView } from './WorkoutWorkspace';

type WorkoutOverviewProps = {
  onNavigate: (view: WorkoutWorkspaceView) => void;
};

type RoutineDayOption = {
  id: string;
  routineName: string;
  routineDifficulty: string;
  dayName: string;
  focus: string;
  exerciseCount: number;
};

function localDateKey(value: Date | string): string {
  const date = value instanceof Date ? value : new Date(value);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function startOfCurrentWeek(): Date {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  const daysSinceMonday = (date.getDay() + 6) % 7;
  date.setDate(date.getDate() - daysSinceMonday);
  return date;
}

function dateDaysAgo(days: number): Date {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() - days);
  return date;
}

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

function formatWorkoutDate(value: string): string {
  return new Intl.DateTimeFormat(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  }).format(new Date(value));
}

export function WorkoutOverview({ onNavigate }: WorkoutOverviewProps) {
  const { user } = useAuth();
  const active = useActiveWorkout(user?.id);
  const routines = useRoutines(user?.id);
  const history = useWorkoutHistory(user?.id);

  const routineDays = useMemo<RoutineDayOption[]>(
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

  const lastWorkout = history.history[0] ?? null;

  const recommendedDay = useMemo(() => {
    if (routineDays.length === 0) return null;
    const lastRoutineDayId = lastWorkout?.routine_day_id;
    if (!lastRoutineDayId) return routineDays[0] ?? null;
    const lastIndex = routineDays.findIndex((day) => day.id === lastRoutineDayId);
    if (lastIndex < 0) return routineDays[0] ?? null;
    return routineDays[(lastIndex + 1) % routineDays.length] ?? null;
  }, [lastWorkout?.routine_day_id, routineDays]);

  const weeklyStats = useMemo(() => {
    const weekStart = startOfCurrentWeek().getTime();
    const sessions = history.history.filter(
      (session) => new Date(session.completed_at).getTime() >= weekStart,
    );
    const weightUnit = sessions[0]?.weight_unit ?? lastWorkout?.weight_unit ?? 'lb';
    const compatibleSessions = sessions.filter((session) => session.weight_unit === weightUnit);

    return {
      workouts: sessions.length,
      sets: sessions.reduce((sum, session) => sum + session.completed_set_count, 0),
      duration: sessions.reduce((sum, session) => sum + session.duration_seconds, 0),
      volume: compatibleSessions.reduce((sum, session) => sum + session.total_volume, 0),
      weightUnit,
    };
  }, [history.history, lastWorkout?.weight_unit]);

  const consistencyDays = useMemo(() => {
    const completedByDay = new Map<string, number>();
    history.history.forEach((session) => {
      const key = localDateKey(session.completed_at);
      completedByDay.set(key, (completedByDay.get(key) ?? 0) + 1);
    });

    return Array.from({ length: 7 }, (_, index) => {
      const date = dateDaysAgo(6 - index);
      const key = localDateKey(date);
      return {
        key,
        label: new Intl.DateTimeFormat(undefined, { weekday: 'short' }).format(date).slice(0, 2),
        count: completedByDay.get(key) ?? 0,
        isToday: key === localDateKey(new Date()),
      };
    });
  }, [history.history]);

  const muscleFocus = useMemo(() => {
    const cutoff = localDateKey(dateDaysAgo(29));
    const totals = new Map<string, number>();

    history.muscleVolume
      .filter((day) => day.workout_date >= cutoff)
      .forEach((day) => {
        totals.set(day.muscle_group, (totals.get(day.muscle_group) ?? 0) + day.completed_set_count);
      });

    return [...totals.entries()]
      .map(([muscle, sets]) => ({ muscle, sets }))
      .sort((a, b) => b.sets - a.sets)
      .slice(0, 4);
  }, [history.muscleVolume]);

  const activeProgress = useMemo(() => {
    if (!active.session) return { completed: 0, total: 0, percent: 0 };
    const sets = active.session.exercises.flatMap((exercise) => exercise.sets);
    const completed = sets.filter((set) => set.is_completed).length;
    const total = sets.length;
    return {
      completed,
      total,
      percent: total > 0 ? Math.round((completed / total) * 100) : 0,
    };
  }, [active.session]);

  const loading =
    active.status === 'loading' && routines.status === 'loading' && history.status === 'loading';
  const error = active.error ?? routines.error ?? history.error;

  if (loading) {
    return (
      <section className="workout-overview workout-overview--loading" aria-live="polite" aria-busy="true">
        <div className="overview-skeleton overview-skeleton--hero" />
        <div className="overview-stat-grid">
          {Array.from({ length: 4 }, (_, index) => (
            <div className="overview-skeleton overview-skeleton--stat" key={index} />
          ))}
        </div>
      </section>
    );
  }

  return (
    <section className="workout-overview" aria-labelledby="workout-overview-heading">
      <div className="overview-heading">
        <div>
          <p className="eyebrow">Today</p>
          <h2 id="workout-overview-heading">Your training dashboard</h2>
          <p>Start the next session, review this week and keep your routine moving.</p>
        </div>
        <button
          className="overview-refresh-button"
          type="button"
          onClick={() => {
            active.refresh();
            routines.refresh();
            history.refresh();
          }}
        >
          Refresh
        </button>
      </div>

      {error ? (
        <p className="builder-message builder-message--error" role="alert">
          {error}
        </p>
      ) : null}

      {active.session ? (
        <article className="overview-hero overview-hero--active">
          <div className="overview-hero-copy">
            <span className="overview-kicker">Workout in progress</span>
            <h3>{active.session.name}</h3>
            <p>
              {activeProgress.completed} of {activeProgress.total} sets completed. Your workout is saved as you go.
            </p>
            <div className="overview-progress" aria-label={`${activeProgress.percent}% completed`}>
              <span style={{ width: `${activeProgress.percent}%` }} />
            </div>
          </div>
          <div className="overview-hero-action">
            <strong>{activeProgress.percent}%</strong>
            <button className="primary-button" type="button" onClick={() => onNavigate('train')}>
              Resume workout
            </button>
          </div>
        </article>
      ) : recommendedDay ? (
        <article className="overview-hero">
          <div className="overview-hero-copy">
            <span className="overview-kicker">Next in your routine</span>
            <h3>{recommendedDay.dayName}</h3>
            <p>
              <strong>{recommendedDay.routineName}</strong>
              {' · '}
              {recommendedDay.focus || 'Custom training day'}
            </p>
            <div className="overview-meta-row">
              <span>{recommendedDay.exerciseCount} exercises</span>
              <span>{recommendedDay.routineDifficulty}</span>
            </div>
          </div>
          <div className="overview-hero-action">
            <span className="overview-action-mark" aria-hidden="true">W</span>
            <button className="primary-button" type="button" onClick={() => onNavigate('train')}>
              Start workout
            </button>
          </div>
        </article>
      ) : (
        <article className="overview-hero overview-hero--empty">
          <div className="overview-hero-copy">
            <span className="overview-kicker">First step</span>
            <h3>Build your first training routine</h3>
            <p>Choose exercises, sets, rep targets and rest times. BioTrack will turn it into a live workout.</p>
          </div>
          <div className="overview-hero-action">
            <span className="overview-action-mark" aria-hidden="true">+</span>
            <button className="primary-button" type="button" onClick={() => onNavigate('builder')}>
              Build routine
            </button>
          </div>
        </article>
      )}

      <div className="overview-stat-grid" aria-label="This week">
        <article className="overview-stat-card">
          <span>Workouts</span>
          <strong>{weeklyStats.workouts}</strong>
          <small>This week</small>
        </article>
        <article className="overview-stat-card">
          <span>Completed sets</span>
          <strong>{formatNumber(weeklyStats.sets)}</strong>
          <small>This week</small>
        </article>
        <article className="overview-stat-card">
          <span>Training volume</span>
          <strong>{formatNumber(weeklyStats.volume)}</strong>
          <small>{weeklyStats.weightUnit} moved</small>
        </article>
        <article className="overview-stat-card">
          <span>Training time</span>
          <strong>{formatDuration(weeklyStats.duration)}</strong>
          <small>This week</small>
        </article>
      </div>

      <div className="overview-detail-grid">
        <article className="overview-panel">
          <div className="overview-panel-heading">
            <div>
              <span className="overview-kicker">Consistency</span>
              <h3>Last 7 days</h3>
            </div>
            <strong>{consistencyDays.filter((day) => day.count > 0).length}/7</strong>
          </div>
          <div className="consistency-strip" aria-label="Workout activity during the last seven days">
            {consistencyDays.map((day) => (
              <div className={day.isToday ? 'consistency-day consistency-day--today' : 'consistency-day'} key={day.key}>
                <span className={day.count > 0 ? 'consistency-dot consistency-dot--complete' : 'consistency-dot'}>
                  {day.count > 1 ? day.count : ''}
                </span>
                <small>{day.label}</small>
              </div>
            ))}
          </div>
        </article>

        <article className="overview-panel">
          <div className="overview-panel-heading">
            <div>
              <span className="overview-kicker">Recent training</span>
              <h3>{lastWorkout ? lastWorkout.name : 'No completed workouts yet'}</h3>
            </div>
            {lastWorkout ? <span>{formatWorkoutDate(lastWorkout.completed_at)}</span> : null}
          </div>
          {lastWorkout ? (
            <>
              <div className="overview-session-metrics">
                <span><strong>{lastWorkout.completed_set_count}</strong> sets</span>
                <span><strong>{lastWorkout.total_reps}</strong> reps</span>
                <span><strong>{formatDuration(lastWorkout.duration_seconds)}</strong></span>
              </div>
              <button className="text-button" type="button" onClick={() => onNavigate('history')}>
                View workout history
              </button>
            </>
          ) : (
            <>
              <p>Complete your first session to unlock workout summaries, records and muscle-group volume.</p>
              <button className="text-button" type="button" onClick={() => onNavigate('train')}>
                Go to training
              </button>
            </>
          )}
        </article>

        <article className="overview-panel overview-panel--muscles">
          <div className="overview-panel-heading">
            <div>
              <span className="overview-kicker">Muscle focus</span>
              <h3>Last 30 days</h3>
            </div>
            <button className="text-button" type="button" onClick={() => onNavigate('progression')}>
              Details
            </button>
          </div>
          {muscleFocus.length > 0 ? (
            <div className="muscle-focus-list">
              {muscleFocus.map((item, index) => {
                const maximum = muscleFocus[0]?.sets ?? 1;
                const percent = Math.max(8, Math.round((item.sets / maximum) * 100));
                return (
                  <div className="muscle-focus-row" key={item.muscle}>
                    <div><span>{item.muscle}</span><strong>{item.sets} sets</strong></div>
                    <div className="muscle-focus-track"><span style={{ width: `${percent}%` }} /></div>
                    <small>#{index + 1}</small>
                  </div>
                );
              })}
            </div>
          ) : (
            <p>Muscle-group trends will appear after you complete workouts.</p>
          )}
        </article>

        <article className="overview-panel overview-panel--actions">
          <span className="overview-kicker">Quick actions</span>
          <h3>Build your training system</h3>
          <div className="overview-action-grid">
            <button type="button" onClick={() => onNavigate('builder')}>
              <span aria-hidden="true">R</span>
              <strong>Routines</strong>
              <small>Create or edit plans</small>
            </button>
            <button type="button" onClick={() => onNavigate('library')}>
              <span aria-hidden="true">E</span>
              <strong>Exercises</strong>
              <small>Browse the library</small>
            </button>
          </div>
        </article>
      </div>
    </section>
  );
}
