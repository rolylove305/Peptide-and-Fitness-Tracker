import { describe, expect, it } from 'vitest';
import type { PeptideInventoryLot } from '../../types/database';
import {
  buildPeptideInventoryAlerts,
  daysBetweenDateKeys,
} from './peptideInventory';

function lot(
  overrides: Partial<PeptideInventoryLot> = {},
): PeptideInventoryLot {
  return {
    id: 'lot-1',
    user_id: 'user-1',
    protocol_id: null,
    peptide_name: 'Example',
    lot_number: null,
    quantity_remaining: 2,
    quantity_unit: 'vials',
    low_stock_threshold: 1,
    opened_on: null,
    expires_on: null,
    is_active: true,
    created_at: '2026-07-01T00:00:00.000Z',
    updated_at: '2026-07-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('peptide inventory alerts', () => {
  it('calculates calendar-day distance without UTC drift', () => {
    expect(daysBetweenDateKeys('2026-07-23', '2026-08-01')).toBe(9);
  });

  it('prioritizes expired, expiring and low-stock alerts', () => {
    const alerts = buildPeptideInventoryAlerts(
      [
        lot({ id: 'low', quantity_remaining: 1 }),
        lot({ id: 'soon', expires_on: '2026-08-01' }),
        lot({ id: 'expired', expires_on: '2026-07-22' }),
      ],
      new Date(2026, 6, 23, 8),
    );

    expect(alerts.map((alert) => [alert.kind, alert.lot.id])).toEqual([
      ['expired', 'expired'],
      ['expiring', 'soon'],
      ['low', 'low'],
    ]);
  });

  it('ignores archived inventory', () => {
    expect(
      buildPeptideInventoryAlerts(
        [lot({ is_active: false, quantity_remaining: 0 })],
        new Date(2026, 6, 23, 8),
      ),
    ).toEqual([]);
  });
});
