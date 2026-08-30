/**
 * The only place utilization arithmetic is implemented.
 *
 * Every guard the brief calls out lives here: capacity of zero, missing
 * capacity, over-capacity above 100%, negative movement. Callers get `null`
 * for "not computable" and are expected to render N/A rather than 0.
 */

import type { BasisComparison, BasisId, BasisRollup, CapacityRollup, StatusLevel } from './types'
import { THRESHOLDS, utilizationStatus } from '@/lib/config/thresholds'

export interface CapacityInput {
  capacity: number | null
  utilizedPallets: number
}

/** Division that refuses to produce Infinity or NaN. */
export function safeDivide(numerator: number, denominator: number): number | null {
  if (!Number.isFinite(numerator) || !Number.isFinite(denominator)) return null
  if (denominator === 0) return null
  const result = numerator / denominator
  return Number.isFinite(result) ? result : null
}

/**
 * utilization = utilizedPallets / totalCapacity * 100
 *
 * Returns null when capacity is missing or zero - a facility with no capacity
 * master row has no meaningful utilization and must not be shown as 0% or as
 * infinity. Values above 100 are returned as-is: over-capacity is never
 * clamped or hidden.
 */
export function utilizationPct(input: CapacityInput): number | null {
  if (input.capacity === null) return null
  if (input.capacity <= 0) return null
  const ratio = safeDivide(input.utilizedPallets, input.capacity)
  return ratio === null ? null : ratio * 100
}

/** availableCapacity = max(capacity - utilized, 0) */
export function availableCapacity(input: CapacityInput): number | null {
  if (input.capacity === null) return null
  return Math.max(input.capacity - input.utilizedPallets, 0)
}

/** overCapacityPallets = max(utilized - capacity, 0) */
export function overCapacityPallets(input: CapacityInput): number {
  if (input.capacity === null) return 0
  return Math.max(input.utilizedPallets - input.capacity, 0)
}

/**
 * The legacy report's "empty pallets": capacity - utilized, allowed to go
 * negative. Kept distinct from availableCapacity on purpose - the two differ
 * exactly by the network's over-capacity exposure, and the control tower
 * shows both so the difference is visible instead of silently reconciled.
 */
export function netEmptyPallets(input: CapacityInput): number | null {
  if (input.capacity === null) return null
  return input.capacity - input.utilizedPallets
}

/**
 * Aggregate a set of capacity-bearing entities.
 *
 * Members with a null capacity contribute their occupied pallets but not to
 * the capacity denominator, and are counted in `facilitiesMissingCapacity` so
 * the shortfall is reportable rather than invisible.
 */
export function rollup(items: CapacityInput[]): CapacityRollup {
  let capacity = 0
  let utilized = 0
  let excluded = 0
  let available = 0
  let over = 0
  let missing = 0
  let hasCapacity = false

  for (const item of items) {
    if (item.capacity === null) {
      missing += 1
      excluded += item.utilizedPallets
      continue
    }
    utilized += item.utilizedPallets
    hasCapacity = true
    capacity += item.capacity
    available += Math.max(item.capacity - item.utilizedPallets, 0)
    over += Math.max(item.utilizedPallets - item.capacity, 0)
  }

  const totalCapacity = hasCapacity ? capacity : null
  return {
    capacity: totalCapacity,
    utilizedPallets: utilized,
    excludedUtilizedPallets: excluded,
    availableCapacity: hasCapacity ? available : null,
    overCapacityPallets: over,
    netEmptyPallets: totalCapacity === null ? null : totalCapacity - utilized,
    utilizationPct: utilizationPct({ capacity: totalCapacity, utilizedPallets: utilized }),
    facilitiesMissingCapacity: missing,
  }
}

/** Variance in percentage points against a target. */
export function varianceToTarget(actualPct: number | null, targetPct: number | null): number | null {
  if (actualPct === null || targetPct === null) return null
  return actualPct - targetPct
}

/** Percentage-point delta between two utilization readings. */
export function deltaPp(current: number | null, previous: number | null): number | null {
  if (current === null || previous === null) return null
  return current - previous
}

/**
 * Least-squares slope over a series, in units per step.
 * Returns null for series too short to have a direction.
 */
export function slope(series: number[]): number | null {
  const n = series.length
  if (n < 2) return null
  const meanX = (n - 1) / 2
  const meanY = series.reduce((a, b) => a + b, 0) / n
  let num = 0
  let den = 0
  for (let i = 0; i < n; i += 1) {
    num += (i - meanX) * (series[i] - meanY)
    den += (i - meanX) ** 2
  }
  return den === 0 ? null : num / den
}

/**
 * Deterministic prototype forecast.
 *
 * A trend extrapolation with a damped slope and a weekday index, run over the
 * observed history. There is no model behind it and the UI must always label
 * it "Prototype forecast".
 */
export function projectUtilization(history: number[], horizonDays: number, weekdayIndex: number[] = []): number | null {
  if (history.length === 0) return null
  const window = history.slice(-14)
  const s = slope(window)
  if (s === null) return null
  const last = history[history.length - 1]
  // A geometrically damped slope: the trend persists but fades, so a steep
  // fortnight cannot extrapolate into an absurd 30-day number. The cumulative
  // movement converges to slope x damping / (1 - damping).
  const damping = 0.9
  let projected = last
  for (let d = 1; d <= horizonDays; d += 1) {
    projected += s * damping ** d
  }
  const seasonal = weekdayIndex.length > 0 ? weekdayIndex[horizonDays % weekdayIndex.length] : 0
  // Utilization cannot go below zero; it can and does go above 100. The upper
  // clamp only exists to keep a pathological input off the chart axis.
  return Math.min(Math.max(0, projected + seasonal), 150)
}

/** Movement can legitimately be negative (net outflow); only impossible values are rejected. */
export function netMovement(inbound: number, outbound: number): number | null {
  if (!Number.isFinite(inbound) || !Number.isFinite(outbound)) return null
  if (inbound < 0 || outbound < 0) return null
  return inbound - outbound
}

/** Classify a facility's forward risk from its current and projected utilization. */
export function forecastRisk(currentPct: number | null, forecast30Pct: number | null): StatusLevel {
  if (currentPct === null) return 'unknown'
  const peak = forecast30Pct === null ? currentPct : Math.max(currentPct, forecast30Pct)
  return utilizationStatus(peak)
}

/** First forecast date projected above the breach threshold, or null. */
export function expectedBreachDate(
  forecast: { date: string; pct: number | null }[],
  thresholdPct: number = THRESHOLDS.breachThresholdPct,
): string | null {
  for (const point of forecast) {
    if (point.pct !== null && point.pct >= thresholdPct) return point.date
  }
  return null
}


/**
 * Own, Park & Pay and combined, computed from the same primitives.
 *
 * Combined is a genuine re-aggregation - capacities and occupancies are summed
 * and divided once - never an average of the two percentages, which would be
 * wrong whenever the two books differ in size.
 */
export function basisRollup(basis: BasisId, items: CapacityInput[]): BasisRollup {
  return { ...rollup(items), basis, siteCount: items.length }
}

export function compareBasis(own: CapacityInput[], parkAndPay: CapacityInput[]): BasisComparison {
  const ownRollup = basisRollup('OWN', own)
  const pnpRollup = basisRollup('PNP', parkAndPay)
  const combined = basisRollup('COMBINED', [...own, ...parkAndPay])

  const impact =
    combined.utilizationPct === null || ownRollup.utilizationPct === null
      ? null
      : combined.utilizationPct - ownRollup.utilizationPct

  const share = (part: number | null, whole: number | null): number | null => {
    if (part === null || whole === null) return null
    const ratio = safeDivide(part, whole)
    return ratio === null ? null : ratio * 100
  }

  return {
    own: ownRollup,
    parkAndPay: pnpRollup,
    combined,
    utilizationImpactPp: impact,
    capacitySharePct: share(pnpRollup.capacity, combined.capacity),
    occupancySharePct: share(
      pnpRollup.utilizedPallets,
      combined.utilizedPallets === 0 ? null : combined.utilizedPallets,
    ),
  }
}
