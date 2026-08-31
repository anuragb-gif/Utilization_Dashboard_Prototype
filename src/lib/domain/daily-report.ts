/**
 * The daily report each warehouse and region receives.
 *
 * The legacy version is an automated mail: twelve boxed figures for the own
 * network split into F/C and Dry, then a Park & Pay block, then a combined
 * total, followed by two trend charts. Every one of those figures is
 * reproduced here from the same rollups the screens render - the split, the
 * subtotals and the order are the report's, not an invention.
 *
 * Two things are deliberately different:
 *
 *  - The combined total is computed, not restated. In the reference cards the
 *    "Total (Own + P&P)" row adds correctly for some scopes and not others;
 *    here it always sums the two books and divides once.
 *  - Empty pallets are allowed to be negative, because a book holding more
 *    than its capacity is a fact worth seeing rather than a floor at zero.
 */

import type { CapacityRollup, Facility, TemperatureZoneId } from './types'
import { rollup } from './metrics'
import { ZONE_GROUP } from '@/lib/data/master'

/**
 * The two books the daily report speaks in.
 *
 * "F/C" is frozen and chilled together; "Dry" is the union of controlled
 * ambient and ambient. The four-zone capacity master maps onto these two
 * through the same ZONE_GROUP table every other legacy-facing screen uses, so
 * the report cannot drift from the zone screens.
 */
export type TemperatureBookId = 'FC' | 'DRY'

export const TEMPERATURE_BOOK_LABEL: Record<TemperatureBookId, string> = {
  FC: 'Frozen + Chilled',
  DRY: 'Dry',
}

/** Short form, as the legacy report heads its columns. */
export const TEMPERATURE_BOOK_SHORT: Record<TemperatureBookId, string> = {
  FC: 'F/C',
  DRY: 'Dry',
}

export function bookForZone(zoneId: TemperatureZoneId): TemperatureBookId {
  return ZONE_GROUP[zoneId] === 'DRY' ? 'DRY' : 'FC'
}

export interface TemperatureBooks {
  fc: CapacityRollup
  dry: CapacityRollup
  /** F/C and Dry summed - the own-network total for this scope. */
  own: CapacityRollup
}

/**
 * Split a set of facilities into the report's two temperature books.
 *
 * Chamber capacity is read from the facility's own zone rows rather than its
 * headline capacity, so the two books always add back to the facility total.
 * A zone with no capacity master row contributes its occupancy but not a
 * denominator, exactly as it does everywhere else.
 */
export function temperatureBooks(facilities: Facility[], zoneFilter?: TemperatureZoneId[]): TemperatureBooks {
  const wanted = zoneFilter && zoneFilter.length > 0 ? new Set(zoneFilter) : null
  const fc: { capacity: number | null; utilizedPallets: number }[] = []
  const dry: typeof fc = []

  for (const facility of facilities) {
    for (const zone of facility.zones) {
      if (wanted && !wanted.has(zone.zoneId)) continue
      const entry = { capacity: zone.capacity, utilizedPallets: zone.utilizedPallets }
      if (bookForZone(zone.zoneId) === 'DRY') dry.push(entry)
      else fc.push(entry)
    }
  }

  return { fc: rollup(fc), dry: rollup(dry), own: rollup([...fc, ...dry]) }
}

export interface PalletTrendPoint {
  date: string
  /** Occupied pallets on the day. */
  utilizedPallets: number
  /** Budgeted occupancy, derived from the day's capacity and budget percentage. */
  budgetPallets: number | null
  /** Occupied pallets on the same calendar day last year. */
  lastYearPallets: number | null
}

/**
 * The pallet-count version of the utilization trend.
 *
 * The legacy report publishes both: the percentage tells you how full the
 * network is, the pallet count tells you how much stock moved. They can point
 * in opposite directions when capacity changes, which is precisely why both
 * are kept.
 *
 * Budget and last-year pallets are derived from the percentages the series
 * already carries, applied to that day's capacity. Where a percentage is
 * missing the pallet figure is null rather than zero.
 */
export function palletTrend(
  history: { date: string; capacity: number; utilizedPallets: number; budgetPct: number; lastYearPct: number | null }[],
): PalletTrendPoint[] {
  return history.map((point) => ({
    date: point.date,
    utilizedPallets: point.utilizedPallets,
    budgetPallets: point.capacity <= 0 ? null : Math.round((point.capacity * point.budgetPct) / 100),
    lastYearPallets:
      point.lastYearPct === null || point.capacity <= 0 ? null : Math.round((point.capacity * point.lastYearPct) / 100),
  }))
}
