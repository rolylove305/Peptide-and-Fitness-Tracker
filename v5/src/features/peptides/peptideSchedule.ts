import type { PeptideProtocol } from '../../types/database';

export const peptideWeekDays = [
  { value: 0, short: 'Sun' },
  { value: 1, short: 'Mon' },
  { value: 2, short: 'Tue' },
  { value: 3, short: 'Wed' },
  { value: 4, short: 'Thu' },
  { value: 5, short: 'Fri' },
  { value: 6, short: 'Sat' },
] as const;

export function describePeptideFrequency(
  protocol: Pick<
    PeptideProtocol,
    'frequency_type' | 'days_of_week' | 'interval_days'
  >,
): string {
  if (protocol.frequency_type === 'daily') return 'Every day';
  if (protocol.frequency_type === 'as_needed') return 'As recorded';
  if (protocol.frequency_type === 'interval_days') {
    const interval = protocol.interval_days ?? 1;
    return `Every ${interval} day${interval === 1 ? '' : 's'}`;
  }

  return peptideWeekDays
    .filter((day) => protocol.days_of_week.includes(day.value))
    .map((day) => day.short)
    .join(', ');
}

export function toLocalDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function localDate(dateKey: string): Date {
  return new Date(`${dateKey}T12:00:00`);
}

export function isProtocolScheduledOn(
  protocol: Pick<
    PeptideProtocol,
    | 'frequency_type'
    | 'days_of_week'
    | 'interval_days'
    | 'start_date'
    | 'end_date'
    | 'is_active'
  >,
  dateKey: string,
): boolean {
  if (!protocol.is_active || protocol.frequency_type === 'as_needed')
    return false;
  if (dateKey < protocol.start_date) return false;
  if (protocol.end_date && dateKey > protocol.end_date) return false;
  if (protocol.frequency_type === 'daily') return true;

  const date = localDate(dateKey);
  if (protocol.frequency_type === 'selected_days') {
    return protocol.days_of_week.includes(date.getDay());
  }

  const start = localDate(protocol.start_date);
  const elapsedDays = Math.round(
    (date.getTime() - start.getTime()) / 86_400_000,
  );
  return elapsedDays >= 0 && elapsedDays % (protocol.interval_days ?? 1) === 0;
}

export type PeptideScheduleDay = {
  dateKey: string;
  dayLabel: string;
  dateLabel: string;
  isToday: boolean;
  protocols: PeptideProtocol[];
};

export function buildPeptideWeek(
  protocols: PeptideProtocol[],
  anchor = new Date(),
): PeptideScheduleDay[] {
  const todayKey = toLocalDateKey(anchor);

  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(anchor);
    date.setHours(12, 0, 0, 0);
    date.setDate(date.getDate() + index);
    const dateKey = toLocalDateKey(date);

    return {
      dateKey,
      dayLabel: new Intl.DateTimeFormat(undefined, { weekday: 'short' }).format(
        date,
      ),
      dateLabel: new Intl.DateTimeFormat(undefined, {
        month: 'short',
        day: 'numeric',
      }).format(date),
      isToday: dateKey === todayKey,
      protocols: protocols.filter((protocol) =>
        isProtocolScheduledOn(protocol, dateKey),
      ),
    };
  });
}
