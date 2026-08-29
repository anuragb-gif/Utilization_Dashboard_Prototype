/**
 * Deterministic randomness.
 *
 * The prototype must produce byte-identical data on every render - on the
 * server, on the client, and on a colleague's laptop during a demo. Nothing
 * in the data layer may call Math.random() or read the wall clock.
 */

/** mulberry32 - small, fast, well-distributed 32-bit PRNG. */
export function createRng(seed: number) {
  let a = seed >>> 0
  return function next(): number {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Stable string -> seed hash, so each entity gets its own reproducible stream. */
export function hashSeed(input: string): number {
  let h = 2166136261
  for (let i = 0; i < input.length; i += 1) {
    h ^= input.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

export function rngFor(key: string) {
  return createRng(hashSeed(key))
}

/**
 * Distribute `total` across `weights` as integers that sum to exactly
 * `total` (largest-remainder / Hare quota). Used so region capacity always
 * reconciles to the sum of its facilities - no rounding drift.
 */
export function allocateInteger(total: number, weights: number[]): number[] {
  const weightSum = weights.reduce((a, b) => a + b, 0)
  if (weightSum <= 0) return weights.map(() => 0)
  const exact = weights.map((w) => (w / weightSum) * total)
  const floors = exact.map(Math.floor)
  let remainder = total - floors.reduce((a, b) => a + b, 0)
  const order = exact
    .map((value, index) => ({ index, frac: value - Math.floor(value) }))
    .sort((a, b) => b.frac - a.frac || a.index - b.index)
  const result = [...floors]
  let cursor = 0
  while (remainder > 0 && order.length > 0) {
    result[order[cursor % order.length].index] += 1
    remainder -= 1
    cursor += 1
  }
  return result
}

/**
 * The demo snapshot date.
 *
 * Anchoring the whole dataset to a fixed date keeps server and client render
 * identical and keeps the demo reproducible months from now. A real
 * deployment reads this from the ETL run log instead.
 */
export const REPORT_DATE = '2026-08-27'
export const LAST_REFRESH_AT = '2026-08-27T05:45:00+05:30'
export const LAST_SUCCESSFUL_REFRESH_AT = '2026-08-27T05:45:00+05:30'
export const PREVIOUS_REFRESH_AT = '2026-08-26T05:44:00+05:30'

/**
 * Days of history and of forward projection held in the dataset.
 *
 * History runs well past the 30 days the legacy report keeps so the 90-day
 * and year-to-date ranges on the trend chart show real movement rather than a
 * padded straight line.
 */
export const HISTORY_DAYS = 260
export const FORECAST_DAYS = 30
/** The window the daily report and the exception engine actually reason over. */
export const OPERATIONAL_WINDOW_DAYS = 30
