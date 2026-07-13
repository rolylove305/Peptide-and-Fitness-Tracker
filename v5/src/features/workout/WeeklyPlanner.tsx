import { useMemo, useState } from 'react';
import { useAuth } from '../auth/AuthProvider';
import { supabase } from '../../lib/supabase/client';
import { useActiveWorkout } from './hooks/useActiveWorkout';
import { useRoutines } from './hooks/useRoutines';
import { useWorkoutHistory } from './hooks/useWorkoutHistory';
import type { WorkoutWorkspaceView } from './WorkoutWorkspace';
import {
  dateForWeekday,
  formatWeekRange,
  readWeeklySchedule,
  sameLocalDay,
  startOfWeek,
  weekdays,
  type WeeklySchedule,
} from './weeklySchedule';

type WeeklyPlannerProps = {
  onNavigate: (view: WorkoutWorkspaceView) => void;
};

export function WeeklyPlanner({ onNavigate }: WeeklyPlannerProps) {
  const { user } = useAuth();
  const routines = useRoutines(user?.id);
  const history = useWorkoutHistory(user?.id);
  const active = useActiveWorkout(user?.id);
  const [schedule, setSchedule] = useState<WeeklySchedule>(() =>
    readWeeklySchedule(user?.user_metadata?.workout_weekly_schedule),
  );
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const routineDays = useMemo(
    () =>
      routines.routines
        .filter((routine) => routine.is_active)
        .flatMap((routine) =>
          routine.days.map((day) => ({ ...day, routineName: routine.name })),
        ),
    [routines.routines],
  );

  const dayById = useMemo(
    () => new Map(routineDays.map((day) => [day.id, day])),
    [routineDays],
  );

  const completedThisWeek = useMemo(() => {
    const monday = startOfWeek();
    const nextMonday = new Date(monday);
    nextMonday.setDate(monday.getDate() + 7);
    return history.history.filter((session) => {
      const completed = new Date(session.completed_at);
      return completed >= monday && completed < nextMonday;
    });
  }, [history.history]);

  const plannedCount = Object.values(schedule).filter(
    (dayId) => dayId && dayById.has(dayId),
  ).length;
  const completedPlannedCount = weekdays.filter((weekday) => {
    const dayId = schedule[weekday.key];
    if (!dayId) return false;
    return completedThisWeek.some(
      (session) =>
        session.routine_day_id === dayId &&
        sameLocalDay(session.completed_at, dateForWeekday(weekday.key)),
    );
  }).length;

  async function saveSchedule(next: WeeklySchedule) {
    if (!supabase) {
      setError('Supabase is not configured for BioTrack AI V5.');
      return;
    }
    setSaving(true);
    setMessage(null);
    setError(null);
    try {
      const { error: updateError } = await supabase.auth.updateUser({
        data: { workout_weekly_schedule: next },
      });
      if (updateError) throw updateError;
      setSchedule(next);
      setMessage('Weekly schedule saved and synced to your account.');
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : 'BioTrack could not save the weekly schedule.',
      );
    } finally {
      setSaving(false);
    }
  }

  async function startScheduledWorkout(dayId: string) {
    if (active.session) {
      onNavigate('train');
      return;
    }
    const result = await active.start(dayId);
    if (result?.ok) onNavigate('train');
    else setError(result?.error ?? 'BioTrack could not start this workout.');
  }

  const loading =
    routines.status === 'loading' ||
    history.status === 'loading' ||
    active.status === 'loading';

  return (
    <section className="weekly-planner" aria-labelledby="weekly-planner-heading">
      <header className="weekly-planner-heading">
        <div>
          <p className="eyebrow">Weekly Planner</p>
          <h2 id="weekly-planner-heading">Turn your routine into a real week</h2>
          <p>
            Assign saved routine days, start today’s session and adjust the week without
            changing completed history.
          </p>
        </div>
        <span>{formatWeekRange()}</span>
      </header>

      <div className="weekly-planner-summary">
        <article><span>Planned</span><strong>{plannedCount}</strong></article>
        <article><span>Completed as planned</span><strong>{completedPlannedCount}</strong></article>
        <article>
          <span>Weekly adherence</span>
          <strong>
            {plannedCount === 0
              ? '—'
              : `${Math.round((completedPlannedCount / plannedCount) * 100)}%`}
          </strong>
        </article>
      </div>

      {message ? (
        <p className="builder-message builder-message--success" role="status">{message}</p>
      ) : null}
      {error || routines.error || history.error || active.error ? (
        <p className="builder-message builder-message--error" role="alert">
          {error ?? routines.error ?? history.error ?? active.error}
        </p>
      ) : null}

      {loading ? (
        <div className="weekly-planner-loading" aria-live="polite">
          Loading your week…
        </div>
      ) : routineDays.length === 0 ? (
        <div className="weekly-planner-empty">
          <h3>Create or add a routine first</h3>
          <p>The planner needs at least one active routine day.</p>
          <button className="primary-button" type="button" onClick={() => onNavigate('plans')}>
            Browse plans
          </button>
        </div>
      ) : (
        <div className="weekly-planner-grid">
          {weekdays.map((weekday) => {
            const selectedId = schedule[weekday.key] ?? '';
            const selectedDay = dayById.get(selectedId) ?? null;
            const date = dateForWeekday(weekday.key);
            const isToday = sameLocalDay(new Date(), date);
            const completed = selectedDay
              ? completedThisWeek.some(
                  (session) =>
                    session.routine_day_id === selectedDay.id &&
                    sameLocalDay(session.completed_at, date),
                )
              : false;

            return (
              <article
                className={`weekly-day-card${isToday ? ' weekly-day-card--today' : ''}${completed ? ' weekly-day-card--completed' : ''}`}
                key={weekday.key}
              >
                <header>
                  <div><strong>{weekday.short}</strong><span>{date.getDate()}</span></div>
                  {completed ? <em>Completed</em> : isToday ? <em>Today</em> : null}
                </header>
                <label>
                  <span className="sr-only">Workout for {weekday.label}</span>
                  <select
                    value={selectedId}
                    disabled={saving}
                    onChange={(event) => {
                      const next = { ...schedule };
                      if (event.target.value) next[weekday.key] = event.target.value;
                      else delete next[weekday.key];
                      void saveSchedule(next);
                    }}
                  >
                    <option value="">Rest / unplanned</option>
                    {routineDays.map((day) => (
                      <option value={day.id} key={day.id}>
                        {day.routineName} — {day.name}
                      </option>
                    ))}
                  </select>
                </label>
                {selectedDay ? (
                  <div className="weekly-day-detail">
                    <strong>{selectedDay.name}</strong>
                    <span>
                      {selectedDay.focus ||
                        selectedDay.focus_muscle_groups.join(', ') ||
                        `${selectedDay.exercises.length} exercises`}
                    </span>
                    {isToday && !completed ? (
                      <button
                        className="primary-button"
                        type="button"
                        disabled={active.startingDayId === selectedDay.id}
                        onClick={() => void startScheduledWorkout(selectedDay.id)}
                      >
                        {active.startingDayId === selectedDay.id
                          ? 'Starting…'
                          : active.session
                            ? 'Continue active workout'
                            : 'Start today’s workout'}
                      </button>
                    ) : null}
                  </div>
                ) : (
                  <p>Recovery, mobility or an open day.</p>
                )}
              </article>
            );
          })}
        </div>
      )}

      <aside className="weekly-planner-note">
        <strong>Flexible by design.</strong>
        <span>
          Moving a session changes only your recurring weekly plan. Completed workouts stay
          attached to the date they were performed.
        </span>
      </aside>
    </section>
  );
}
