import { useMemo } from 'react';
import { useAuth } from '../auth/AuthProvider';
import { useActiveWorkout } from './hooks/useActiveWorkout';
import { useRoutines } from './hooks/useRoutines';
import { useWorkoutHistory } from './hooks/useWorkoutHistory';
import type { WorkoutWorkspaceView } from './WorkoutWorkspace';
import {
  dateForWeekday,
  findNextScheduledDay,
  localDateKey,
  readWeeklySchedule,
  sameLocalDay,
  startOfWeek,
  weekdayKeyForDate,
  weekdays,
} from './weeklySchedule';

type WorkoutOverviewProps = {
  onNavigate: (view: WorkoutWorkspaceView) => void;
};

type RoutineDayOption = {
  id: string;
  routineName: string;
  routineDifficulty: string;
  dayName: string;
  focus: string | null;
  focusMuscleGroups: string[];
  exerciseCount: number;
};

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

function formatUpcomingDate(date: Date, daysAway: number): string {
  if (daysAway === 1) return 'Tomorrow';
  return new Intl.DateTimeFormat(undefined, { weekday: 'long' }).format(date);
}

export function WorkoutOverview({ onNavigate }: WorkoutOverviewProps) {
  const { user } = useAuth();
  const active = useActiveWorkout(user?.id);
  const routines = useRoutines(user?.id);
  const history = useWorkoutHistory(user?.id);

  const routineDays = useMemo<RoutineDayOption[]>(
    () =>
      routines.routines
        .filter((routine) => routine.is_active)
        .flatMap((routine) =>
          routine.days.map((day) => ({
            id: day.id,
            routineName: routine.name,
            routineDifficulty: routine.difficulty,
            dayName: day.name,
            focus: day.focus,
            focusMuscleGroups: day.focus_muscle_groups,
            exerciseCount: day.exercises.length,
          })),
        ),
    [routines.routines],
  );

  const dayById = useMemo(
    () => new Map(routineDays.map((day) => [day.id, day])),
    [routineDays],
  );
  const validDayIds = useMemo(() => new Set(dayById.keys()), [dayById]);
  const schedule = useMemo(
    () => readWeeklySchedule(user?.user_metadata?.workout_weekly_schedule),
    [user?.user_metadata?.workout_weekly_schedule],
  );
  const hasSchedule = Object.values(schedule).some(
    (dayId) => Boolean(dayId && dayById.has(dayId)),
  );

  const now = new Date();
  const todayKey = weekdayKeyForDate(now);
  const scheduledTodayId = schedule[todayKey] ?? null;
  const scheduledToday = scheduledTodayId ? dayById.get(scheduledTodayId) ?? null : null;
  const todayCompletedSession = scheduledToday
    ? history.history.find(
        (session) =>
          session.routine_day_id === scheduledToday.id &&
          sameLocalDay(session.completed_at, now),
      ) ?? null
    : null;

  const nextScheduled = useMemo(
    () => findNextScheduledDay(schedule, validDayIds),
    [schedule, validDayIds],
  );
  const nextScheduledDay = nextScheduled
    ? dayById.get(nextScheduled.dayId) ?? null
    : null;

  const lastWorkout = history.history[0] ?? null;

  const weeklyStats = useMemo(() => {
    const weekStart = startOfWeek().getTime();
    const sessions = history.history.filter(
      (session) => new Date(session.completed_at).getTime() >= weekStart,
    );
    const weightUnit = sessions[0]?.weight_unit ?? lastWorkout?.weight_unit ?? 'lb';
    const compatibleSessions = sessions.filter(
      (session) => session.weight_unit === weightUnit,
    );

    return {
      workouts: sessions.length,
      sets: sessions.reduce((sum, session) => sum + session.completed_set_count, 0),
      duration: sessions.reduce((sum, session) => sum + session.duration_seconds, 0),
      volume: compatibleSessions.reduce((sum, session) => sum + session.total_volume, 0),
      weightUnit,
    };
  }, [history.history, lastWorkout?.weight_unit]);

  const weekPlan = useMemo(
    () =>
      weekdays.map((weekday) => {
        const date = dateForWeekday(weekday.key);
        const scheduledId = schedule[weekday.key] ?? null;
        const scheduled = scheduledId ? dayById.get(scheduledId) ?? null : null;
        const completed = scheduled
          ? history.history.some(
              (session) =>
                session.routine_day_id === scheduled.id &&
                sameLocalDay(session.completed_at, date),
            )
          : false;
        return {
          ...weekday,
          date,
          scheduled,
          completed,
          isToday: sameLocalDay(now, date),
        };
      }),
    [dayById, history.history, now, schedule],
  );

  const plannedThisWeek = weekPlan.filter((day) => day.scheduled).length;
  const completedAsPlanned = weekPlan.filter((day) => day.completed).length;
  const adherence =
    plannedThisWeek > 0
      ? Math.round((completedAsPlanned / plannedThisWeek) * 100)
      : null;

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
        label: new Intl.DateTimeFormat(undefined, { weekday: 'short' })
          .format(date)
          .slice(0, 2),
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
        totals.set(
          day.muscle_group,
          (totals.get(day.muscle_group) ?? 0) + day.completed_set_count,
        );
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
    active.status === 'loading' ||
    routines.status === 'loading' ||
    history.status === 'loading';
  const error = active.error ?? routines.error ?? history.error;

  async function startTodayWorkout() {
    if (!scheduledToday) return;
    const result = await active.start(scheduledToday.id);
    if (result?.ok) onNavigate('train');
  }

  if (loading) {
    return (
      <section
        className="workout-overview workout-overview--loading"
        aria-live="polite"
        aria-busy="true"
      >
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
          <h2 id="workout-overview-heading">Your training command center</h2>
          <p>
            One clear next action, your current week and the evidence behind your progress.
          </p>
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
        <p className="builder-message builder-message--error" role="alert">{error}</p>
      ) : null}

      {active.session ? (
        <article className="overview-hero overview-hero--active">
          <div className="overview-hero-copy">
            <span className="overview-kicker">Workout in progress</span>
            <h3>{active.session.name}</h3>
            <p>
              {activeProgress.completed} of {activeProgress.total} sets completed. Your workout
              is saved as you go.
            </p>
            <div
              className="overview-progress"
              aria-label={`${activeProgress.percent}% completed`}
            >
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
      ) : scheduledToday && !todayCompletedSession ? (
        <article className="overview-hero overview-hero--scheduled">
          <div className="overview-hero-copy">
            <span className="overview-kicker">Today’s scheduled workout</span>
            <h3>{scheduledToday.dayName}</h3>
            <p>
              <strong>{scheduledToday.routineName}</strong>
              {' · '}
              {scheduledToday.focus ||
                scheduledToday.focusMuscleGroups.join(', ') ||
                'Custom training day'}
            </p>
            <div className="overview-meta-row">
              <span>{scheduledToday.exerciseCount} exercises</span>
              <span>{scheduledToday.routineDifficulty}</span>
              <span>Scheduled today</span>
            </div>
          </div>
          <div className="overview-hero-action">
            <span className="overview-action-mark" aria-hidden="true">T</span>
            <button
              className="primary-button"
              type="button"
              disabled={active.startingDayId === scheduledToday.id}
              onClick={() => void startTodayWorkout()}
            >
              {active.startingDayId === scheduledToday.id
                ? 'Starting…'
                : 'Start today’s workout'}
            </button>
          </div>
        </article>
      ) : scheduledToday && todayCompletedSession ? (
        <article className="overview-hero overview-hero--complete">
          <div className="overview-hero-copy">
            <span className="overview-kicker">Today’s plan complete</span>
            <h3>{scheduledToday.dayName} is done</h3>
            <p>
              {todayCompletedSession.completed_set_count} sets and{' '}
              {todayCompletedSession.total_reps} repetitions were recorded today.
            </p>
            {nextScheduled && nextScheduledDay ? (
              <div className="today-next-session">
                <span>Next</span>
                <strong>{formatUpcomingDate(nextScheduled.date, nextScheduled.daysAway)}</strong>
                <small>{nextScheduledDay.dayName}</small>
              </div>
            ) : null}
          </div>
          <div className="overview-hero-action">
            <span className="overview-action-mark" aria-hidden="true">✓</span>
            <button className="primary-button" type="button" onClick={() => onNavigate('history')}>
              Review workout
            </button>
          </div>
        </article>
      ) : hasSchedule && nextScheduled && nextScheduledDay ? (
        <article className="overview-hero overview-hero--rest">
          <div className="overview-hero-copy">
            <span className="overview-kicker">Open day</span>
            <h3>No workout is scheduled today</h3>
            <p>
              Your next planned session is <strong>{nextScheduledDay.dayName}</strong> on{' '}
              {formatUpcomingDate(nextScheduled.date, nextScheduled.daysAway)}.
            </p>
            <div className="overview-meta-row">
              <span>{nextScheduledDay.routineName}</span>
              <span>{nextScheduledDay.exerciseCount} exercises</span>
            </div>
          </div>
          <div className="overview-hero-action">
            <span className="overview-action-mark" aria-hidden="true">R</span>
            <button className="primary-button" type="button" onClick={() => onNavigate('planner')}>
              Review this week
            </button>
          </div>
        </article>
      ) : routineDays.length > 0 ? (
        <article className="overview-hero overview-hero--empty">
          <div className="overview-hero-copy">
            <span className="overview-kicker">Set your rhythm</span>
            <h3>Turn your routine into a weekly plan</h3>
            <p>
              Assign routine days to Monday through Sunday so BioTrack can tell you exactly
              what comes next.
            </p>
          </div>
          <div className="overview-hero-action">
            <span className="overview-action-mark" aria-hidden="true">W</span>
            <button className="primary-button" type="button" onClick={() => onNavigate('planner')}>
              Plan my week
            </button>
          </div>
        </article>
      ) : (
        <article className="overview-hero overview-hero--empty">
          <div className="overview-hero-copy">
            <span className="overview-kicker">First step</span>
            <h3>Choose your first training plan</h3>
            <p>
              Start with a complete plan or build your own routine. BioTrack will turn it into
              a live workout.
            </p>
          </div>
          <div className="overview-hero-action">
            <span className="overview-action-mark" aria-hidden="true">+</span>
            <button className="primary-button" type="button" onClick={() => onNavigate('plans')}>
              Browse plans
            </button>
          </div>
        </article>
      )}

      <article className="today-week-card" aria-labelledby="today-week-heading">
        <div className="today-week-heading">
          <div>
            <span className="overview-kicker">This week</span>
            <h3 id="today-week-heading">Plan and adherence</h3>
          </div>
          <button className="text-button" type="button" onClick={() => onNavigate('planner')}>
            Edit week
          </button>
        </div>

        <div className="today-week-summary">
          <span><strong>{completedAsPlanned}</strong> completed</span>
          <span><strong>{plannedThisWeek}</strong> planned</span>
          <span><strong>{adherence === null ? '—' : `${adherence}%`}</strong> adherence</span>
        </div>

        <div className="today-week-strip" aria-label="Current weekly training plan">
          {weekPlan.map((day) => (
            <div
              className={`today-week-day${day.isToday ? ' today-week-day--today' : ''}${day.completed ? ' today-week-day--complete' : ''}${day.scheduled ? ' today-week-day--planned' : ''}`}
              key={day.key}
              title={day.scheduled ? `${day.label}: ${day.scheduled.dayName}` : `${day.label}: open day`}
            >
              <span>{day.short.slice(0, 2)}</span>
              <strong>{day.date.getDate()}</strong>
              <i aria-hidden="true">{day.completed ? '✓' : day.scheduled ? '•' : ''}</i>
              <small>{day.scheduled?.dayName ?? 'Open'}</small>
            </div>
          ))}
        </div>
      </article>

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
              <div
                className={day.isToday ? 'consistency-day consistency-day--today' : 'consistency-day'}
                key={day.key}
              >
                <span
                  className={day.count > 0 ? 'consistency-dot consistency-dot--complete' : 'consistency-dot'}
                >
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
              <p>
                Complete your first session to unlock workout summaries, records and
                muscle-group volume.
              </p>
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
            <button type="button" onClick={() => onNavigate('planner')}>
              <span aria-hidden="true">W</span>
              <strong>Week</strong>
              <small>Schedule your sessions</small>
            </button>
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
