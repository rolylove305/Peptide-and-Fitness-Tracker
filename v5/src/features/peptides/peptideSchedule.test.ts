import { describe, expect, it } from 'vitest';
import { describePeptideFrequency } from './peptideSchedule';

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
