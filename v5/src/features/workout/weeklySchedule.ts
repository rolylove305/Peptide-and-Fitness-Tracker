export type WeekdayKey = '1' | '2' | '3' | '4' | '5' | '6' | '0';

export type WeeklySchedule = Partial<Record<WeekdayKey, string>>;

export const weekdays: Array<{
  key: WeekdayKey;
  short: string;
  label: string;
}> = [
  { key: '1', short: 'Mon', label: 'Monday' },
  { key: '2', short: 'Tue', label: 'Tuesday' },
  { key: '3', short: 'Wed', label: 'Wednesday' },
  { key: '4', short: 'Thu', label: 'Thursday' },
  { key: '5', short: 'Fri', label: 'Friday' },
  { key: '6', short: 'Sat', label: 'Saturday' },
  { key: '0', short: 'Sun', label: 'Sunday' },
];

const validKeys = new Set<WeekdayKey>(weekdays.map((day) => day.key));

export function readWeeklySchedule(value: unknown): WeeklySchedule {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};

  const result: WeeklySchedule = {};
  Object.entries(value).forEach(([key, dayId]) => {
    if (
      validKeys.has(key as WeekdayKey) &&
      typeof dayId === 'string' &&
      dayId.trim()
    ) {
      result[key as WeekdayKey] = dayId;
    }
  });
  return result;
}

export function localDateKey(value: Date | string): string {
  const date = value instanceof Date ? value : new Date(value);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function sameLocalDay(value: Date | string, target: Date): boolean {
  return localDateKey(value) === localDateKey(target);
}

export function weekdayKeyForDate(date: Date): WeekdayKey {
  return String(date.getDay()) as WeekdayKey;
}

export function startOfWeek(date = new Date()): Date {
  const result = new Date(date);
  const day = result.getDay();
  const distance = day === 0 ? 6 : day - 1;
  result.setHours(0, 0, 0, 0);
  result.setDate(result.getDate() - distance);
  return result;
}

export function dateForWeekday(
  weekdayKey: WeekdayKey,
  anchor = new Date(),
): Date {
  const monday = startOfWeek(anchor);
  const offset = weekdayKey === '0' ? 6 : Number(weekdayKey) - 1;
  const result = new Date(monday);
  result.setDate(monday.getDate() + offset);
  return result;
}

export function formatWeekRange(anchor = new Date()): string {
  const monday = startOfWeek(anchor);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  const formatter = new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
  });
  return `${formatter.format(monday)} – ${formatter.format(sunday)}`;
}

export function findNextScheduledDay(
  schedule: WeeklySchedule,
  validDayIds: ReadonlySet<string>,
  fromDate = new Date(),
): {
  weekdayKey: WeekdayKey;
  dayId: string;
  date: Date;
  daysAway: number;
} | null {
  for (let daysAway = 1; daysAway <= 7; daysAway += 1) {
    const date = new Date(fromDate);
    date.setHours(0, 0, 0, 0);
    date.setDate(date.getDate() + daysAway);
    const weekdayKey = weekdayKeyForDate(date);
    const dayId = schedule[weekdayKey];
    if (dayId && validDayIds.has(dayId))
      return { weekdayKey, dayId, date, daysAway };
  }
  return null;
}
