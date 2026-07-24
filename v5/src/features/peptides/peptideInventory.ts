import type { PeptideInventoryLot } from '../../types/database';
import { toLocalDateKey } from './peptideSchedule';

export type PeptideInventoryAlert = {
  kind: 'expired' | 'expiring' | 'low';
  lot: PeptideInventoryLot;
  daysUntilExpiry: number | null;
};

function localDateFromKey(value: string): Date {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year ?? 0, (month ?? 1) - 1, day ?? 1);
}

export function daysBetweenDateKeys(from: string, to: string): number {
  const milliseconds =
    localDateFromKey(to).getTime() - localDateFromKey(from).getTime();
  return Math.round(milliseconds / 86_400_000);
}

export function buildPeptideInventoryAlerts(
  lots: PeptideInventoryLot[],
  now = new Date(),
): PeptideInventoryAlert[] {
  const todayKey = toLocalDateKey(now);
  const alerts: PeptideInventoryAlert[] = [];

  for (const lot of lots) {
    if (!lot.is_active) continue;

    const daysUntilExpiry = lot.expires_on
      ? daysBetweenDateKeys(todayKey, lot.expires_on)
      : null;

    if (daysUntilExpiry !== null && daysUntilExpiry < 0) {
      alerts.push({ kind: 'expired', lot, daysUntilExpiry });
    } else if (daysUntilExpiry !== null && daysUntilExpiry <= 30) {
      alerts.push({ kind: 'expiring', lot, daysUntilExpiry });
    }

    if (
      lot.low_stock_threshold !== null &&
      lot.quantity_remaining <= lot.low_stock_threshold
    ) {
      alerts.push({ kind: 'low', lot, daysUntilExpiry });
    }
  }

  const priority = { expired: 0, expiring: 1, low: 2 } as const;
  return alerts.sort(
    (left, right) => priority[left.kind] - priority[right.kind],
  );
}
