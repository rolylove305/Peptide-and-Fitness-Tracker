import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../auth/AuthProvider';
import { useRoutines } from './hooks/useRoutines';
import { useWorkoutHistory } from './hooks/useWorkoutHistory';
import { useWorkoutProfile } from './WorkoutProfileProvider';
import { useWorkoutSchedule } from './WorkoutScheduleProvider';
import {
  dateForWeekday,
  localDateKey,
  startOfMondayWeek,
  weekdayOptions,
  type WeekdayIndex,
  type WorkoutScheduleAssignment,
} from './workoutSchedule';
import type { WorkoutWorkspaceView } from './WorkoutWorkspace';

type WeeklyWorkoutPlannerProps = {
  onNavigate: (view: WorkoutWorkspaceView) => void;
};

type RoutineDayChoice = {
  routineId: string;
  routineDayId: string;
  routineName: string;
  dayName: string;
  focus: string | null;
  exerciseCount: number;
};

const recommendedWeekdays: Record<number, WeekdayIndex[]> = {
  1: [1],
  2: [1, 4],
  3: [1, 3, 5],
  4: [1, 2, 4, 5],
  5: [1, 2, 3, 5, 6],
  6: [1, 2, 3, 4, 5, 6],
  7: [1, 2, 3, 4, 5, 6, 0],
};

function formatWeekRange(weekStart: Date): string {
  const end = new Date(weekStart);
  end.setDate(end.getDate() + 6);
  const formatter = new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' });
  return `${formatter.format(weekStart)} – ${formatter.format(end)}`;
}

function formatDayDate(date: Date): string {
  return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' }).format(date);
}

function statusForDay(
  weekday: WeekdayIndex,
  routineDayId: string | null,
  completedByDate: Map<string, Set<string>>,
): 'rest' | 'upcoming' | 'today' | 'completed' | 'overdue' {
  if (!routineDayId) return 'rest';
  const date = dateForWeekday(weekday);
  const dateKey = localDateKey(date);
  if (completedByDate.get(dateKey)?.has(routineDayId)) return 'completed';

  const todayKey = localDateKey(new Date());
  if (dateKey === todayKey) return 'today';
  return date.getTime() < new Date(`${todayKey}T00:00:00`).getTime() ? 'overdue' : 'upcoming';
}

function statusLabel(status: ReturnType<typeof statusForDay>): string {
  switch (status) {
    case 'completed':
      return 'Completed';
    case 'overdue':
      return 'Missed';
    case 'today':
      return 'Today';
    case 'upcoming':
      return 'Upcoming';
    default:
      return 'Rest';
  }
}

export function WeeklyWorkoutPlanner({ onNavigate }: WeeklyWorkoutPlannerProps) {
  const { user } = useAuth();
  const routines = useRoutines(user?.id);
  const history = useWorkoutHistory(user?.id);
  const profile = useWorkoutProfile();
  const scheduleState = useWorkoutSchedule();
  const [selectionByWeekday, setSelectionByWeekday] = useState<Record<number, string>>({});
  const [message, setMessage] = useState<string | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);
  const weekStart = useMemo(() => startOfMondayWeek(), []);

  const choices = useMemo<RoutineDayChoice[]>(
    () =>
      routines.routines
        .filter((routine) => routine.is_active)
        .flatMap((routine) =>
          routine.days.map((day) => ({
            routineId: routine.id,
            routineDayId: day.id,
            routineName: routine.name,
            dayName: day.name,
            focus: day.focus,
            exerciseCount: day.exercises.length,
          })),
        ),
    [routines.routines],
  );

  const choiceByDayId = useMemo(
    () => new Map(choices.map((choice) => [choice.routineDayId, choice])),
    [choices],
  );

  useEffect(() => {
    const next: Record<number, string> = {};
    scheduleState.schedule?.assignments.forEach((assignment) => {
      if (choiceByDayId.has(assignment.routineDayId)) {
        next[assignment.weekday] = assignment.routineDayId;
      }
    });
    setSelectionByWeekday(next);
  }, [choiceByDayId, scheduleState.schedule]);

  const completedByDate = useMemo(() => {
    const result = new Map<string, Set<string>>();
    history.history.forEach((session) => {
      if (!session.routine_day_id) return;
      const key = localDateKey(session.completed_at);
      const completed = result.get(key) ?? new Set<string>();
      completed.add(session.routine_day_id);
      result.set(key, completed);
    });
    return result;
  }, [history.history]);

  const plannedDays = weekdayOptions.filter((day) => Boolean(selectionByWeekday[day.value]));
  const completedCount = plannedDays.filter((day) =>
    statusForDay(day.value, selectionByWeekday[day.value] ?? null, completedByDate) === 'completed',
  ).length;
  const overdueCount = plannedDays.filter((day) =>
    statusForDay(day.value, selectionByWeekday[day.value] ?? null, completedByDate) === 'overdue',
  ).length;

  function autoFill() {
    setMessage(null);
    setLocalError(null);
    if (choices.length === 0) {
      setLocalError('Add or activate a routine before building a weekly schedule.');
      return;
    }

    const requestedDays = Math.min(7, Math.max(1, profile.profile?.daysPerWeek ?? Math.min(3, choices.length)));
    const weekdays = recommendedWeekdays[requestedDays] ?? recommendedWeekdays[3];
    const next: Record<number, string> = {};
    weekdays.forEach((weekday, index) => {
      const choice = choices[index % choices.length];
      if (choice) next[weekday] = choice.routineDayId;
    });
    setSelectionByWeekday(next);
    setMessage(`A ${requestedDays}-day schedule was created from your profile. Review it, then save.`);
  }

  async function save() {
    setMessage(null);
    setLocalError(null);

    const assignments: WorkoutScheduleAssignment[] = weekdayOptions.flatMap((day) => {
      const selectedId = selectionByWeekday[day.value];
      const choice = selectedId ? choiceByDayId.get(selectedId) : null;
      if (!choice) return [];
      return [{
        weekday: day.value,
        routineId: choice.routineId,
        routineDayId: choice.routineDayId,
        routineNameSnapshot: choice.routineName,
        dayNameSnapshot: choice.dayName,
        focusSnapshot: choice.focus,
        exerciseCountSnapshot: choice.exerciseCount,
      }];
    });

    const saved = await scheduleState.saveSchedule({ assignments });
    if (saved) setMessage('Weekly schedule saved. Today and Train now prioritize the correct session.');
  }

  const loading = routines.status === 'loading' || history.status === 'loading';
  const error = localError ?? scheduleState.error ?? routines.error ?? history.error;

  return (
    <section className="weekly-planner" aria-labelledby="weekly-planner-heading">
      <div className="weekly-planner-heading">
        <div>
          <p className="eyebrow">Weekly plan</p>
          <h2 id="weekly-planner-heading">Put every workout on the right day</h2>
          <p>Assign saved routine days to your real week. BioTrack tracks what is complete, due next or missed.</p>
        </div>
        <div className="weekly-planner-range">
          <span>This week</span>
          <strong>{formatWeekRange(weekStart)}</strong>
        </div>
      </div>

      <div className="weekly-planner-summary" aria-label="Weekly training summary">
        <article><span>Planned</span><strong>{plannedDays.length}</strong></article>
        <article><span>Completed</span><strong>{completedCount}</strong></article>
        <article><span>Remaining</span><strong>{Math.max(0, plannedDays.length - completedCount)}</strong></article>
        <article className={overdueCount > 0 ? 'weekly-summary-alert' : ''}><span>Missed</span><strong>{overdueCount}</strong></article>
      </div>

      {message ? <p className="builder-message builder-message--success" role="status">{message}</p> : null}
      {error ? <p className="builder-message builder-message--error" role="alert">{error}</p> : null}

      <div className="weekly-planner-toolbar">
        <button className="secondary-button" type="button" onClick={autoFill} disabled={loading || choices.length === 0}>
          Build from my profile
        </button>
        <button className="text-button" type="button" onClick={() => setSelectionByWeekday({})}>
          Clear week
        </button>
      </div>

      {loading ? (
        <div className="weekly-planner-grid" aria-live="polite" aria-busy="true">
          {weekdayOptions.map((day) => <div className="weekly-day-card weekly-day-card--loading" key={day.value} />)}
        </div>
      ) : choices.length === 0 ? (
        <div className="weekly-planner-empty">
          <h3>No active routine days yet</h3>
          <p>Add a starter plan or build a routine, then return here to place each session on the calendar.</p>
          <button className="primary-button" type="button" onClick={() => onNavigate('plans')}>Browse plans</button>
        </div>
      ) : (
        <div className="weekly-planner-grid">
          {weekdayOptions.map((day) => {
            const selectedId = selectionByWeekday[day.value] ?? '';
            const selected = selectedId ? choiceByDayId.get(selectedId) ?? null : null;
            const status = statusForDay(day.value, selected?.routineDayId ?? null, completedByDate);
            const date = dateForWeekday(day.value, weekStart);

            return (
              <article className={`weekly-day-card weekly-day-card--${status}`} key={day.value}>
                <header>
                  <div><span>{day.short}</span><strong>{formatDayDate(date)}</strong></div>
                  <em>{statusLabel(status)}</em>
                </header>
                <label>
                  <span className="sr-only">Workout for {day.label}</span>
                  <select
                    value={selectedId}
                    onChange={(event) => {
                      const value = event.target.value;
                      setSelectionByWeekday((current) => ({ ...current, [day.value]: value }));
                      setMessage(null);
                    }}
                  >
                    <option value="">Rest day</option>
                    {choices.map((choice) => (
                      <option value={choice.routineDayId} key={`${day.value}:${choice.routineDayId}`}>
                        {choice.routineName} — {choice.dayName}
                      </option>
                    ))}
                  </select>
                </label>
                {selected ? (
                  <div className="weekly-day-details">
                    <strong>{selected.dayName}</strong>
                    <span>{selected.routineName}</span>
                    <small>{selected.exerciseCount} exercises · {selected.focus || 'Custom focus'}</small>
                  </div>
                ) : (
                  <div className="weekly-day-rest"><strong>Recovery day</strong><span>No workout assigned</span></div>
                )}
              </article>
            );
          })}
        </div>
      )}

      <div className="weekly-planner-actions">
        <button className="primary-button" type="button" disabled={scheduleState.saving || loading} onClick={() => void save()}>
          {scheduleState.saving ? 'Saving schedule…' : 'Save weekly schedule'}
        </button>
        <button className="secondary-button" type="button" onClick={() => onNavigate('overview')}>Back to Today</button>
      </div>

      <aside className="weekly-planner-note">
        <strong>Flexible, not punitive.</strong>
        <p>A missed day is information, not failure. Reassign the session when your week changes; completed workout history remains untouched.</p>
      </aside>
    </section>
  );
}
