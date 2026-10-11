import { describe, expect, it } from 'vitest';
import {
  buildPeptideWeek,
  describePeptideFrequency,
  isProtocolScheduledOn,
} from './peptideSchedule';

describe('describePeptideFrequency', () => {
  it('describes daily and record-only schedules', () => {
    expect(
      describePeptideFrequency({
        frequency_type: 'daily',
        days_of_week: [],
        interval_days: null,
      }),
    ).toBe('Every day');
    expect(
      describePeptideFrequency({
        frequency_type: 'as_needed',
        days_of_week: [],
        interval_days: null,
      }),
    ).toBe('As recorded');
  });

  it('describes interval schedules with correct grammar', () => {
    expect(
      describePeptideFrequency({
        frequency_type: 'interval_days',
        days_of_week: [],
        interval_days: 1,
      }),
    ).toBe('Every 1 day');
    expect(
      describePeptideFrequency({
        frequency_type: 'interval_days',
        days_of_week: [],
        interval_days: 3,
      }),
    ).toBe('Every 3 days');
  });

  it('orders selected weekdays consistently', () => {
    expect(
      describePeptideFrequency({
        frequency_type: 'selected_days',
        days_of_week: [5, 1, 3],
        interval_days: null,
      }),
    ).toBe('Mon, Wed, Fri');
  });
});

describe('peptide schedule planning', () => {
  const baseProtocol = {
    id: 'protocol-1',
    user_id: 'user-1',
    peptide_name: 'Example',
    dose_amount: 1,
    dose_unit: 'mg' as const,
    frequency_type: 'daily' as const,
    time_of_day: '08:00:00',
    days_of_week: [],
    interval_days: null,
    start_date: '2026-07-20',
    end_date: null,
    is_active: true,
    created_at: '2026-07-20T00:00:00Z',
    updated_at: '2026-07-20T00:00:00Z',
  };

  it('respects start, end and active state', () => {
    expect(isProtocolScheduledOn(baseProtocol, '2026-07-19')).toBe(false);
    expect(isProtocolScheduledOn(baseProtocol, '2026-07-20')).toBe(true);
    expect(
      isProtocolScheduledOn(
        { ...baseProtocol, end_date: '2026-07-22' },
        '2026-07-23',
      ),
    ).toBe(false);
    expect(
      isProtocolScheduledOn(
        { ...baseProtocol, is_active: false },
        '2026-07-20',
      ),
    ).toBe(false);
  });

  it('supports selected weekdays and interval days', () => {
    expect(
      isProtocolScheduledOn(
        {
          ...baseProtocol,
          frequency_type: 'selected_days',
          days_of_week: [1, 3, 5],
        },
        '2026-07-22',
      ),
    ).toBe(true);
    expect(
      isProtocolScheduledOn(
        {
          ...baseProtocol,
          frequency_type: 'interval_days',
          interval_days: 3,
        },
        '2026-07-23',
      ),
    ).toBe(true);
  });

  it('builds seven calendar days from the anchor date', () => {
    const week = buildPeptideWeek(
      [baseProtocol],
      new Date('2026-07-23T12:00:00'),
    );
    expect(week).toHaveLength(7);
    expect(week[0]?.dateKey).toBe('2026-07-23');
    expect(week[0]?.isToday).toBe(true);
    expect(week[0]?.protocols).toHaveLength(1);
  });
});
