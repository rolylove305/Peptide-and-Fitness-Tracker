import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../auth/AuthProvider';
import { useWorkoutProfile } from './WorkoutProfileProvider';
import {
  loadExerciseRecords,
  loadMuscleVolume,
  loadWorkoutHistory,
  type ExerciseRecord,
  type MuscleVolumeDay,
  type WorkoutSessionSummary,
} from './repositories/workoutHistoryRepository';

type RangeWeeks = 4 | 8 | 12;
type WeightUnit = 'lb' | 'kg';
type LoadStatus = 'loading' | 'ready' | 'empty' | 'error';

type WeekBucket = {
  key: string;
  label: string;
  workouts: number;
  sets: number;
  reps: number;
  duration: number;
  volume: number;
};

type PeriodTotals = {
  workouts: number;
  sets: number;
  reps: number;
  duration: number;
  volume: number;
};

const rangeOptions: RangeWeeks[] = [4, 8, 12];
const weekdayLabels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const emptyTotals: PeriodTotals = {
  workouts: 0,
  sets: 0,
  reps: 0,
  duration: 0,
  volume: 0,
};

function localDateKey(value: Date | string): string {
  const date = value instanceof Date ? value : new Date(value);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function startOfWeek(value = new Date()): Date {
  const date = new Date(value);
  date.setHours(0, 0, 0, 0);
  const distance = (date.getDay() + 6) % 7;
  date.setDate(date.getDate() - distance);
  return date;
}

function addDays(value: Date, days: number): Date {
  const date = new Date(value);
  date.setDate(date.getDate() + days);
  return date;
}

function dateDaysAgo(days: number): string {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() - days);
  return localDateKey(date);
}

function dayOrdinal(value: Date | string): number {
  const date = value instanceof Date ? value : new Date(value);
  return Math.floor(
    Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / 86_400_000,
  );
}

function formatNumber(value: number, maximumFractionDigits = 0): string {
  return new Intl.NumberFormat(undefined, { maximumFractionDigits }).format(
    value,
  );
}

function formatCompact(value: number): string {
  return new Intl.NumberFormat(undefined, {
    notation: value >= 10_000 ? 'compact' : 'standard',
    maximumFractionDigits: value >= 10_000 ? 1 : 0,
  }).format(value);
}

function formatDuration(seconds: number): string {
  const minutes = Math.max(0, Math.round(seconds / 60));
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return remainder > 0 ? `${hours}h ${remainder}m` : `${hours}h`;
}

function formatWeekLabel(date: Date): string {
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
  }).format(date);
}

function percentDelta(current: number, previous: number): number | null {
  if (previous === 0) return current === 0 ? 0 : null;
  return Math.round(((current - previous) / previous) * 100);
}

function deltaLabel(current: number, previous: number): string {
  const delta = percentDelta(current, previous);
  if (delta === null) return current > 0 ? 'New activity' : 'No activity';
  if (delta === 0) return 'No change';
  return `${delta > 0 ? '+' : '−'}${Math.abs(delta)}%`;
}

function sumWeeks(weeks: WeekBucket[]): PeriodTotals {
  return weeks.reduce<PeriodTotals>(
    (total, week) => ({
      workouts: total.workouts + week.workouts,
      sets: total.sets + week.sets,
      reps: total.reps + week.reps,
      duration: total.duration + week.duration,
      volume: total.volume + week.volume,
    }),
    { ...emptyTotals },
  );
}

function calculateStreaks(sessions: WorkoutSessionSummary[]) {
  const ordinals = [
    ...new Set(sessions.map((session) => dayOrdinal(session.completed_at))),
  ].sort((a, b) => a - b);
  if (ordinals.length === 0) return { current: 0, longest: 0 };

  let longest = 0;
  let running = 0;
  let previous: number | null = null;
  for (const ordinal of ordinals) {
    running = previous !== null && ordinal === previous + 1 ? running + 1 : 1;
    longest = Math.max(longest, running);
    previous = ordinal;
  }

  const latest = ordinals.at(-1);
  if (latest === undefined || latest < dayOrdinal(new Date()) - 1) {
    return { current: 0, longest };
  }

  let current = 0;
  let expected = latest;
  for (const ordinal of [...ordinals].reverse()) {
    if (ordinal !== expected) break;
    current += 1;
    expected -= 1;
  }

  return { current, longest };
}

function TrendChart({ weeks }: { weeks: WeekBucket[] }) {
  const width = 720;
  const height = 220;
  const horizontalPadding = 42;
  const topPadding = 22;
  const bottomPadding = 42;
  const chartHeight = height - topPadding - bottomPadding;
  const chartWidth = width - horizontalPadding * 2;
  const maximumSets = Math.max(1, ...weeks.map((week) => week.sets));
  const maximumWorkouts = Math.max(1, ...weeks.map((week) => week.workouts));
  const step = weeks.length > 1 ? chartWidth / (weeks.length - 1) : chartWidth;
  const barWidth = Math.min(
    42,
    Math.max(18, chartWidth / Math.max(weeks.length, 1) - 18),
  );
  const points = weeks.map((week, index) => {
    const x =
      horizontalPadding + (weeks.length === 1 ? chartWidth / 2 : step * index);
    const y =
      topPadding + chartHeight - (week.sets / maximumSets) * chartHeight;
    return { x, y, week };
  });
  const path = points
    .map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`)
    .join(' ');

  return (
    <div className="insights-chart-wrap">
      <svg
        className="insights-trend-chart"
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label="Weekly workout frequency shown as bars and completed working sets shown as a line"
      >
        {[0, 0.5, 1].map((fraction) => {
          const y = topPadding + chartHeight * fraction;
          return (
            <line
              className="insights-chart-gridline"
              x1={horizontalPadding}
              x2={width - horizontalPadding}
              y1={y}
              y2={y}
              key={fraction}
            />
          );
        })}

        {points.map(({ x, week }) => {
          const barHeight = (week.workouts / maximumWorkouts) * chartHeight;
          return (
            <rect
              className="insights-workout-bar"
              x={x - barWidth / 2}
              y={topPadding + chartHeight - barHeight}
              width={barWidth}
              height={barHeight}
              rx={8}
              key={`bar-${week.key}`}
            />
          );
        })}

        <path className="insights-set-line" d={path} />
        {points.map(({ x, y, week }) => (
          <g key={`point-${week.key}`}>
            <circle className="insights-set-point" cx={x} cy={y} r={5} />
            <text
              className="insights-chart-value"
              x={x}
              y={Math.max(14, y - 12)}
              textAnchor="middle"
            >
              {week.sets}
            </text>
            <text
              className="insights-chart-label"
              x={x}
              y={height - 14}
              textAnchor="middle"
            >
              {week.label}
            </text>
          </g>
        ))}
      </svg>
      <div className="insights-chart-legend" aria-hidden="true">
        <span>
          <i className="insights-legend-bar" />
          Workouts
        </span>
        <span>
          <i className="insights-legend-line" />
          Working sets
        </span>
      </div>
    </div>
  );
}

export function WorkoutInsights() {
  const { user } = useAuth();
  const { profile } = useWorkoutProfile();
  const [status, setStatus] = useState<LoadStatus>('loading');
  const [sessions, setSessions] = useState<WorkoutSessionSummary[]>([]);
  const [records, setRecords] = useState<ExerciseRecord[]>([]);
  const [muscleVolume, setMuscleVolume] = useState<MuscleVolumeDay[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [requestVersion, setRequestVersion] = useState(0);
  const [rangeWeeks, setRangeWeeks] = useState<RangeWeeks>(8);
  const [renderedAt] = useState(() => Date.now());
  const [weightUnit, setWeightUnit] = useState<WeightUnit>(
    profile?.weightUnit ?? 'lb',
  );

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (!user) {
        setSessions([]);
        setRecords([]);
        setMuscleVolume([]);
        setStatus('empty');
        return;
      }

      setStatus('loading');
      setError(null);
      const [historyResult, recordResult, muscleResult] = await Promise.all([
        loadWorkoutHistory(user.id, 120),
        loadExerciseRecords(user.id),
        loadMuscleVolume(user.id, dateDaysAgo(90)),
      ]);
      if (cancelled) return;

      const failed = [historyResult, recordResult, muscleResult].find(
        (result) => !result.ok,
      );
      if (failed && !failed.ok) {
        setError(failed.error);
        setStatus('error');
        return;
      }
      if (!historyResult.ok || !recordResult.ok || !muscleResult.ok) return;

      setSessions(historyResult.data);
      setRecords(recordResult.data);
      setMuscleVolume(muscleResult.data);
      setStatus(historyResult.data.length > 0 ? 'ready' : 'empty');
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [requestVersion, user]);

  const availableUnits = useMemo<WeightUnit[]>(
    () => [...new Set(sessions.map((session) => session.weight_unit))],
    [sessions],
  );

  useEffect(() => {
    if (availableUnits.length === 0 || availableUnits.includes(weightUnit))
      return;
    const preferred = profile?.weightUnit;
    if (preferred && availableUnits.includes(preferred)) {
      setWeightUnit(preferred);
      return;
    }
    const first = availableUnits.at(0);
    if (first) setWeightUnit(first);
  }, [availableUnits, profile?.weightUnit, weightUnit]);

  const rangeStart = useMemo(
    () => addDays(startOfWeek(), -(rangeWeeks - 1) * 7),
    [rangeWeeks],
  );
  const rangeEnd = addDays(startOfWeek(), 7);
  const filteredSessions = useMemo(
    () =>
      sessions.filter((session) => {
        const completed = new Date(session.completed_at);
        return completed >= rangeStart && completed < rangeEnd;
      }),
    [rangeEnd, rangeStart, sessions],
  );

  const weeks = useMemo<WeekBucket[]>(
    () =>
      Array.from({ length: rangeWeeks }, (_, index) => {
        const start = addDays(rangeStart, index * 7);
        const end = addDays(start, 7);
        const weekSessions = filteredSessions.filter((session) => {
          const completed = new Date(session.completed_at);
          return completed >= start && completed < end;
        });
        const unitSessions = weekSessions.filter(
          (session) => session.weight_unit === weightUnit,
        );
        return {
          key: localDateKey(start),
          label: formatWeekLabel(start),
          workouts: weekSessions.length,
          sets: weekSessions.reduce(
            (sum, session) => sum + session.working_set_count,
            0,
          ),
          reps: weekSessions.reduce(
            (sum, session) => sum + session.total_reps,
            0,
          ),
          duration: weekSessions.reduce(
            (sum, session) => sum + session.duration_seconds,
            0,
          ),
          volume: unitSessions.reduce(
            (sum, session) => sum + session.total_volume,
            0,
          ),
        };
      }),
    [filteredSessions, rangeStart, rangeWeeks, weightUnit],
  );

  const totals = useMemo(() => sumWeeks(weeks), [weeks]);
  const comparison = useMemo(() => {
    const midpoint = Math.floor(weeks.length / 2);
    return {
      previous: sumWeeks(weeks.slice(0, midpoint)),
      current: sumWeeks(weeks.slice(midpoint)),
      label: `${midpoint} weeks vs previous ${midpoint}`,
    };
  }, [weeks]);

  const targetWorkouts = (profile?.daysPerWeek ?? 0) * rangeWeeks;
  const adherence =
    targetWorkouts > 0
      ? Math.round((totals.workouts / targetWorkouts) * 100)
      : null;
  const averageDuration =
    totals.workouts > 0 ? totals.duration / totals.workouts : 0;
  const streaks = useMemo(
    () => calculateStreaks(filteredSessions),
    [filteredSessions],
  );
  const bestWeek = useMemo(
    () =>
      weeks.reduce<WeekBucket | null>((best, week) => {
        if (!best) return week;
        if (week.workouts > best.workouts) return week;
        if (week.workouts === best.workouts && week.sets > best.sets)
          return week;
        return best;
      }, null),
    [weeks],
  );

  const activityByDate = useMemo(() => {
    const map = new Map<string, number>();
    filteredSessions.forEach((session) => {
      const key = localDateKey(session.completed_at);
      map.set(key, (map.get(key) ?? 0) + 1);
    });
    return map;
  }, [filteredSessions]);

  const heatmapDays = useMemo(
    () =>
      Array.from({ length: rangeWeeks * 7 }, (_, index) => {
        const date = addDays(rangeStart, index);
        const key = localDateKey(date);
        return {
          key,
          date,
          count: activityByDate.get(key) ?? 0,
          future: date.getTime() > renderedAt,
        };
      }),
    [activityByDate, rangeStart, rangeWeeks, renderedAt],
  );

  const muscles = useMemo(() => {
    const cutoff = localDateKey(rangeStart);
    const totalsByMuscle = new Map<string, number>();
    muscleVolume
      .filter((entry) => entry.workout_date >= cutoff)
      .forEach((entry) => {
        totalsByMuscle.set(
          entry.muscle_group,
          (totalsByMuscle.get(entry.muscle_group) ?? 0) +
            entry.completed_set_count,
        );
      });
    return [...totalsByMuscle.entries()]
      .map(([name, sets]) => ({ name, sets }))
      .sort((a, b) => b.sets - a.sets || a.name.localeCompare(b.name));
  }, [muscleVolume, rangeStart]);

  const totalMuscleSets = muscles.reduce((sum, muscle) => sum + muscle.sets, 0);
  const maximumMuscleSets = Math.max(
    1,
    ...muscles.map((muscle) => muscle.sets),
  );
  const selectedRecords = useMemo(
    () =>
      records
        .filter((record) => record.weight_unit === weightUnit)
        .sort(
          (a, b) =>
            (b.best_set_volume ?? 0) - (a.best_set_volume ?? 0) ||
            new Date(b.last_performed_at).getTime() -
              new Date(a.last_performed_at).getTime(),
        )
        .slice(0, 6),
    [records, weightUnit],
  );

  const observations = useMemo(() => {
    if (totals.workouts === 0)
      return ['Complete a workout to establish your first analytics baseline.'];
    const notes: string[] = [];
    if (adherence !== null) {
      if (adherence >= 90) {
        notes.push(
          `You completed ${adherence}% of your ${profile?.daysPerWeek}-day weekly target across this range.`,
        );
      } else if (adherence >= 60) {
        notes.push(
          `You reached ${adherence}% of your planned frequency. One more consistent day each week would close most of the gap.`,
        );
      } else {
        notes.push(
          `Your current frequency is ${adherence}% of the profile target. A smaller weekly plan may be easier to sustain.`,
        );
      }
    } else {
      notes.push(
        `You averaged ${(totals.workouts / rangeWeeks).toFixed(1)} workouts per week.`,
      );
    }

    const workoutDelta = percentDelta(
      comparison.current.workouts,
      comparison.previous.workouts,
    );
    if (workoutDelta === null)
      notes.push(
        'Training activity began during the most recent comparison period.',
      );
    else if (workoutDelta > 15)
      notes.push(
        `Workout frequency increased ${workoutDelta}% in the latest comparison period.`,
      );
    else if (workoutDelta < -15)
      notes.push(
        `Workout frequency decreased ${Math.abs(workoutDelta)}% in the latest comparison period.`,
      );
    else
      notes.push(
        'Workout frequency is stable between the two comparison periods.',
      );

    const topMuscle = muscles.at(0);
    if (topMuscle && totalMuscleSets > 0) {
      const share = Math.round((topMuscle.sets / totalMuscleSets) * 100);
      if (share >= 40)
        notes.push(
          `${topMuscle.name} represents ${share}% of recorded muscle-group sets, making it the strongest training emphasis.`,
        );
      else
        notes.push(
          `Training volume is distributed across ${muscles.length} recorded muscle groups.`,
        );
    }
    return notes.slice(0, 3);
  }, [
    adherence,
    comparison,
    muscles,
    profile?.daysPerWeek,
    rangeWeeks,
    totalMuscleSets,
    totals.workouts,
  ]);

  if (status === 'loading') {
    return (
      <section
        className="workout-insights workout-insights--loading"
        aria-live="polite"
        aria-busy="true"
      >
        <div className="insights-skeleton insights-skeleton--hero" />
        <div className="insights-kpi-grid">
          {Array.from({ length: 4 }, (_, index) => (
            <div
              className="insights-skeleton insights-skeleton--card"
              key={index}
            />
          ))}
        </div>
        <div className="insights-skeleton insights-skeleton--chart" />
      </section>
    );
  }

  if (status === 'error') {
    return (
      <section className="workout-insights-state" role="alert">
        <h2>Training insights unavailable</h2>
        <p>{error}</p>
        <button
          className="secondary-button"
          type="button"
          onClick={() => setRequestVersion((value) => value + 1)}
        >
          Try again
        </button>
      </section>
    );
  }

  if (status === 'empty') {
    return (
      <section className="workout-insights-state">
        <span aria-hidden="true">↗</span>
        <h2>Your analytics baseline starts with one workout</h2>
        <p>
          Completed sessions will unlock weekly trends, muscle balance, records
          and consistency patterns.
        </p>
      </section>
    );
  }

  return (
    <section
      className="workout-insights"
      aria-labelledby="workout-insights-heading"
    >
      <header className="workout-insights-heading">
        <div>
          <p className="eyebrow">Training analytics</p>
          <h2 id="workout-insights-heading">
            Understand what your training is actually doing
          </h2>
          <p>
            Review frequency, workload, consistency, muscle balance and current
            records using completed workout data.
          </p>
        </div>
        <button
          className="overview-refresh-button"
          type="button"
          onClick={() => setRequestVersion((value) => value + 1)}
        >
          Refresh
        </button>
      </header>

      <div className="insights-control-row" aria-label="Analytics filters">
        <div className="insights-segmented-control" aria-label="Time range">
          {rangeOptions.map((option) => (
            <button
              type="button"
              className={
                rangeWeeks === option
                  ? 'insights-segment insights-segment--active'
                  : 'insights-segment'
              }
              aria-pressed={rangeWeeks === option}
              onClick={() => setRangeWeeks(option)}
              key={option}
            >
              {option} weeks
            </button>
          ))}
        </div>
        {availableUnits.length > 1 ? (
          <div className="insights-segmented-control" aria-label="Weight unit">
            {availableUnits.map((unit) => (
              <button
                type="button"
                className={
                  weightUnit === unit
                    ? 'insights-segment insights-segment--active'
                    : 'insights-segment'
                }
                aria-pressed={weightUnit === unit}
                onClick={() => setWeightUnit(unit)}
                key={unit}
              >
                {unit}
              </button>
            ))}
          </div>
        ) : null}
      </div>

      <div
        className="insights-kpi-grid"
        aria-label={`${rangeWeeks}-week totals`}
      >
        <article>
          <span>Workouts</span>
          <strong>{totals.workouts}</strong>
          <small>{(totals.workouts / rangeWeeks).toFixed(1)} per week</small>
        </article>
        <article>
          <span>Working sets</span>
          <strong>{formatNumber(totals.sets)}</strong>
          <small>{formatNumber(totals.reps)} total reps</small>
        </article>
        <article>
          <span>Training time</span>
          <strong>{formatDuration(totals.duration)}</strong>
          <small>{formatDuration(averageDuration)} average</small>
        </article>
        <article>
          <span>Training volume</span>
          <strong>{formatCompact(totals.volume)}</strong>
          <small>{weightUnit} · matching-unit sessions</small>
        </article>
        <article>
          <span>Current streak</span>
          <strong>{streaks.current}</strong>
          <small>Longest: {streaks.longest} days</small>
        </article>
        <article>
          <span>Plan completion</span>
          <strong>{adherence === null ? '—' : `${adherence}%`}</strong>
          <small>
            {targetWorkouts > 0
              ? `${totals.workouts} of ${targetWorkouts} target sessions`
              : 'Complete your profile to set a target'}
          </small>
        </article>
      </div>

      <article className="insights-panel insights-panel--chart">
        <header className="insights-panel-heading">
          <div>
            <span className="overview-kicker">Weekly trend</span>
            <h3>Frequency and working sets</h3>
          </div>
          {bestWeek ? (
            <span>
              Best week: {bestWeek.label} · {bestWeek.workouts} workouts
            </span>
          ) : null}
        </header>
        <TrendChart weeks={weeks} />
      </article>

      <div className="insights-two-column">
        <article className="insights-panel">
          <header className="insights-panel-heading">
            <div>
              <span className="overview-kicker">Consistency map</span>
              <h3>{rangeWeeks} weeks of activity</h3>
            </div>
            <span>{filteredSessions.length} sessions</span>
          </header>
          <div className="insights-weekday-labels" aria-hidden="true">
            {weekdayLabels.map((label) => (
              <span key={label}>{label}</span>
            ))}
          </div>
          <div
            className="insights-heatmap"
            aria-label="Completed workout activity by day"
          >
            {heatmapDays.map((day) => {
              const label = new Intl.DateTimeFormat(undefined, {
                weekday: 'long',
                month: 'short',
                day: 'numeric',
              }).format(day.date);
              return (
                <span
                  className={`insights-heatmap-day insights-heatmap-day--${Math.min(3, day.count)}${day.future ? ' insights-heatmap-day--future' : ''}`}
                  role="img"
                  aria-label={`${label}: ${day.count} completed ${day.count === 1 ? 'workout' : 'workouts'}`}
                  title={`${label}: ${day.count} workout${day.count === 1 ? '' : 's'}`}
                  key={day.key}
                />
              );
            })}
          </div>
        </article>

        <article className="insights-panel insights-panel--comparison">
          <header className="insights-panel-heading">
            <div>
              <span className="overview-kicker">Momentum</span>
              <h3>Latest {comparison.label}</h3>
            </div>
          </header>
          <div className="insights-comparison-list">
            <div>
              <span>Workouts</span>
              <strong>{comparison.current.workouts}</strong>
              <em>
                {deltaLabel(
                  comparison.current.workouts,
                  comparison.previous.workouts,
                )}
              </em>
            </div>
            <div>
              <span>Working sets</span>
              <strong>{comparison.current.sets}</strong>
              <em>
                {deltaLabel(comparison.current.sets, comparison.previous.sets)}
              </em>
            </div>
            <div>
              <span>Training time</span>
              <strong>{formatDuration(comparison.current.duration)}</strong>
              <em>
                {deltaLabel(
                  comparison.current.duration,
                  comparison.previous.duration,
                )}
              </em>
            </div>
            <div>
              <span>Volume ({weightUnit})</span>
              <strong>{formatCompact(comparison.current.volume)}</strong>
              <em>
                {deltaLabel(
                  comparison.current.volume,
                  comparison.previous.volume,
                )}
              </em>
            </div>
          </div>
        </article>
      </div>

      <div className="insights-two-column insights-two-column--lower">
        <article className="insights-panel">
          <header className="insights-panel-heading">
            <div>
              <span className="overview-kicker">Muscle balance</span>
              <h3>Completed sets by muscle group</h3>
            </div>
            <span>{totalMuscleSets} tracked sets</span>
          </header>
          {muscles.length > 0 ? (
            <div className="insights-muscle-list">
              {muscles.slice(0, 8).map((muscle) => (
                <div className="insights-muscle-row" key={muscle.name}>
                  <div>
                    <span>{muscle.name}</span>
                    <strong>{muscle.sets} sets</strong>
                  </div>
                  <div className="insights-muscle-track">
                    <span
                      style={{
                        width: `${Math.max(6, (muscle.sets / maximumMuscleSets) * 100)}%`,
                      }}
                    />
                  </div>
                  <small>
                    {totalMuscleSets > 0
                      ? Math.round((muscle.sets / totalMuscleSets) * 100)
                      : 0}
                    %
                  </small>
                </div>
              ))}
            </div>
          ) : (
            <p>
              Muscle-group analytics will appear after completed working sets
              are recorded.
            </p>
          )}
        </article>

        <article className="insights-panel">
          <header className="insights-panel-heading">
            <div>
              <span className="overview-kicker">Current records</span>
              <h3>Strongest recorded performances</h3>
            </div>
            <span>{weightUnit}</span>
          </header>
          {selectedRecords.length > 0 ? (
            <div className="insights-record-list">
              {selectedRecords.map((record) => (
                <div key={`${record.exercise_id}:${record.weight_unit}`}>
                  <div>
                    <strong>{record.exercise_name}</strong>
                    <span>{record.primary_muscle_group}</span>
                  </div>
                  <dl>
                    <div>
                      <dt>Top load</dt>
                      <dd>
                        {record.heaviest_weight === null
                          ? '—'
                          : `${formatNumber(record.heaviest_weight, 1)} ${record.weight_unit}`}
                      </dd>
                    </div>
                    <div>
                      <dt>Most reps</dt>
                      <dd>{record.highest_reps ?? '—'}</dd>
                    </div>
                    <div>
                      <dt>Best set</dt>
                      <dd>
                        {record.best_set_volume === null
                          ? '—'
                          : formatCompact(record.best_set_volume)}
                      </dd>
                    </div>
                  </dl>
                </div>
              ))}
            </div>
          ) : (
            <p>No comparable {weightUnit} records are available yet.</p>
          )}
        </article>
      </div>

      <aside className="insights-observation-panel">
        <div>
          <span aria-hidden="true">AI</span>
          <div>
            <p className="eyebrow">Evidence summary</p>
            <h3>What the data says</h3>
          </div>
        </div>
        <ul>
          {observations.map((observation) => (
            <li key={observation}>{observation}</li>
          ))}
        </ul>
        <p>
          These observations describe logged patterns only. They do not
          automatically change your routine or replace recovery judgment.
        </p>
      </aside>
    </section>
  );
}
