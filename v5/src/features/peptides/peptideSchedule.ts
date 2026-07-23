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
