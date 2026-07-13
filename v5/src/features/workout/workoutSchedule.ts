export type WeekdayIndex = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export type WorkoutScheduleAssignment = {
  weekday: WeekdayIndex;
  routineId: string;
  routineDayId: string;
  routineNameSnapshot: string;
  dayNameSnapshot: string;
  focusSnapshot: string | null;
  exerciseCountSnapshot: number;
};

export type WorkoutSchedule = {
  version: 1;
  assignments: WorkoutScheduleAssignment[];
  updatedAt: string;
};

export type WorkoutScheduleDraft = Omit<WorkoutSchedule, 'version' | 'updatedAt'>;

export const workoutScheduleMetadataKey = 'workout_schedule_v1';

export const weekdayOptions: Array<{ value: WeekdayIndex; short: string; label: string }> = [
  { value: 1, short: 'Mon', label: 'Monday' },
  { value: 2, short: 'Tue', label: 'Tuesday' },
  { value: 3, short: 'Wed', label: 'Wednesday' },
  { value: 4, short: 'Thu', label: 'Thursday' },
  { value: 5, short: 'Fri', label: 'Friday' },
  { value: 6, short: 'Sat', label: 'Saturday' },
  { value: 0, short: 'Sun', label: 'Sunday' },
];

function isWeekdayIndex(value: unknown): value is WeekdayIndex {
  return Number.isInteger(value) && Number(value) >= 0 && Number(value) <= 6;
}

export function parseWorkoutSchedule(value: unknown): WorkoutSchedule | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const candidate = value as Record<string, unknown>;
  if (candidate.version !== 1 || !Array.isArray(candidate.assignments) || typeof candidate.updatedAt !== 'string') {
    return null;
  }

  const assignments = candidate.assignments.flatMap((item) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) return [];
    const assignment = item as Record<string, unknown>;
    if (
      !isWeekdayIndex(assignment.weekday) ||
      typeof assignment.routineId !== 'string' ||
      typeof assignment.routineDayId !== 'string' ||
      typeof assignment.routineNameSnapshot !== 'string' ||
      typeof assignment.dayNameSnapshot !== 'string' ||
      !(assignment.focusSnapshot === null || typeof assignment.focusSnapshot === 'string') ||
      typeof assignment.exerciseCountSnapshot !== 'number' ||
      !Number.isFinite(assignment.exerciseCountSnapshot) ||
      assignment.exerciseCountSnapshot < 0
    ) {
      return [];
    }

    return [{
      weekday: assignment.weekday,
      routineId: assignment.routineId,
      routineDayId: assignment.routineDayId,
      routineNameSnapshot: assignment.routineNameSnapshot,
      dayNameSnapshot: assignment.dayNameSnapshot,
      focusSnapshot: assignment.focusSnapshot,
      exerciseCountSnapshot: Math.round(assignment.exerciseCountSnapshot),
    } satisfies WorkoutScheduleAssignment];
  });

  const uniqueByWeekday = new Map<WeekdayIndex, WorkoutScheduleAssignment>();
  assignments.forEach((assignment) => uniqueByWeekday.set(assignment.weekday, assignment));

  return {
    version: 1,
    assignments: weekdayOptions.flatMap((day) => {
      const assignment = uniqueByWeekday.get(day.value);
      return assignment ? [assignment] : [];
    }),
    updatedAt: candidate.updatedAt,
  };
}

export function weekdayLabel(weekday: WeekdayIndex): string {
  return weekdayOptions.find((option) => option.value === weekday)?.label ?? 'Training day';
}

export function mondayStartIndex(date: Date): number {
  return (date.getDay() + 6) % 7;
}

export function startOfMondayWeek(date = new Date()): Date {
  const result = new Date(date);
  result.setHours(0, 0, 0, 0);
  result.setDate(result.getDate() - mondayStartIndex(result));
  return result;
}

export function dateForWeekday(weekday: WeekdayIndex, weekStart = startOfMondayWeek()): Date {
  const mondayOffset = weekday === 0 ? 6 : weekday - 1;
  const result = new Date(weekStart);
  result.setDate(result.getDate() + mondayOffset);
  return result;
}

export function localDateKey(value: Date | string): string {
  const date = value instanceof Date ? value : new Date(value);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
