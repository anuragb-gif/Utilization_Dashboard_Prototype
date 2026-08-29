/**
 * Historical and projected series.
 *
 * Facility series are generated first; every network, region and zone series
 * is then aggregated from them. Nothing is generated twice, so a total on one
 * screen can never disagree with the detail behind it on another.
 */

import type { ExecutionId, RegionId, TemperatureZoneId, UtilizationPoint } from '@/lib/domain/types'
import { FACILITIES, REGION_ORDER, TEMPERATURE_ZONES } from './master'
import { FORECAST_DAYS, HISTORY_DAYS, REPORT_DATE, rngFor } from './seed'
import { projectUtilization, utilizationPct } from '@/lib/domain/metrics'

// ---------------------------------------------------------------------------
// Calendar
// ---------------------------------------------------------------------------

function addDays(iso: string, days: number): string {
  const [y, m, d] = iso.split('-').map(Number)
  const date = new Date(Date.UTC(y, m - 1, d))
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().slice(0, 10)
}

function dayOfWeek(iso: string): number {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay()
}

/** History dates, oldest first; the last entry is the report date. */
export const HISTORY_DATES: string[] = Array.from({ length: HISTORY_DAYS }, (_, i) =>
  addDays(REPORT_DATE, i - (HISTORY_DAYS - 1)),
)

/** Forward dates, starting the day after the report date. */
export const FORECAST_DATES: string[] = Array.from({ length: FORECAST_DAYS }, (_, i) => addDays(REPORT_DATE, i + 1))

export const ALL_DATES: string[] = [...HISTORY_DATES, ...FORECAST_DATES]

/**
 * Weekday index applied to the projection.
 *
 * Cold-chain despatch is heaviest Mon-Wed and lightest on Sunday, so
 * occupancy dips mid-week and rebuilds over the weekend. Values are
 * percentage points, deliberately small.
 */
const WEEKDAY_INDEX_PP = [0.55, -0.15, -0.35, -0.3, -0.1, 0.1, 0.25] // Sun..Sat

// ---------------------------------------------------------------------------
// Facility utilization history
// ---------------------------------------------------------------------------

/**
 * Planted 7-day movements that carry the demo narrative. Everything not
 * listed here gets a deterministic value from its own seeded stream.
 */
const PLANTED_TREND_7D_PP: Record<string, number> = {
  'SNL-PNQ-01': 8.4, // rapid utilization increase
  'SNL-LKO-01': 7.5, // projected to breach 90% inside the forecast window
  'SNL-PLG-01': 5.8, // second forecast-breach candidate
  'SNL-DNK-02': 7.0, // third forecast-breach candidate
  'SNL-HSR-01': 6.0, // dedicated block filling ahead of a customer promotion
  'SNL-IDR-01': 5.6, // pushed itself over capacity
  'SNL-BHO-01': 3.9,
  'SNL-KRP-01': -1.2, // under-utilized and not recovering
  'SNL-MAA-01': -5.8, // largest deterioration
  'SNL-CCU-01': -4.1,
  'SNL-BOM-01': -3.4,
}

/**
 * Network-level tilt applied to every unplanted facility, in percentage
 * points over 7 days. Tuned so the network reads as mildly deteriorating,
 * which is the state the legacy report was last published in.
 */
const NETWORK_TREND_TILT_PP = -3.3

/**
 * Shared seasonal phase. Cold-chain occupancy across India moves together:
 * it builds into the summer ice cream and beverage season and again ahead of
 * the festive quarter. Facilities vary around this, they do not ignore it.
 */
const NETWORK_SEASONAL_PHASE = 1.15

export interface FacilitySeries {
  facilityId: string
  /** Utilization %, oldest first, HISTORY_DAYS long. Null when not computable. */
  history: (number | null)[]
  /** Projected utilization %, FORECAST_DAYS long. */
  forecast: (number | null)[]
  /** Occupied pallets per history day. */
  historyPallets: number[]
  trend7dPp: number
}

function buildFacilitySeries(): Record<string, FacilitySeries> {
  const out: Record<string, FacilitySeries> = {}

  for (const facility of FACILITIES) {
    const current = utilizationPct(facility)
    const rng = rngFor(`series:${facility.code}`)
    const planted = PLANTED_TREND_7D_PP[facility.code]
    const trend7d = planted ?? Number((NETWORK_TREND_TILT_PP + (rng() * 7 - 3.2)).toFixed(2))
    // Planted movers are ACCELERATING - most of their 30-day move happened in
    // the last week - which is exactly what makes them worth flagging. Ordinary
    // facilities drift, so their month is a multiple of their week.
    const trend30d = Number((trend7d * (planted === undefined ? 1.5 + rng() * 1.1 : 1.15)).toFixed(2))

    if (current === null) {
      // No capacity master: utilization is not computable on any day. The
      // occupied pallet series still exists and is still shown.
      const pallets = HISTORY_DATES.map((_, i) =>
        Math.max(0, Math.round(facility.utilizedPallets * (0.82 + (i / (HISTORY_DAYS - 1)) * 0.18 + (rng() - 0.5) * 0.04))),
      )
      pallets[pallets.length - 1] = facility.utilizedPallets
      out[facility.id] = {
        facilityId: facility.id,
        history: HISTORY_DATES.map(() => null),
        forecast: FORECAST_DATES.map(() => null),
        historyPallets: pallets,
        trend7dPp: trend7d,
      }
      continue
    }

    const todayIndex = HISTORY_DAYS - 1
    const weekAgoIndex = todayIndex - 7
    const monthAgoIndex = todayIndex - 30
    const weekAgoValue = current - trend7d
    const monthAgoValue = current - trend30d

    // Seasonality: Indian cold-chain occupancy builds through the summer ice
    // cream and beverage season and again ahead of the festive quarter, then
    // unwinds. Amplitude and phase are per-facility so no two curves match.
    const amplitude = 1.0 + rng() * 1.8
    // Facilities share most of the seasonal phase - the whole network fills
    // and empties together - with enough jitter that no two curves overlay.
    const phase = NETWORK_SEASONAL_PHASE + (rng() - 0.5) * 0.9
    const seasonalAt = (index: number) => amplitude * Math.sin((index / 182.5) * Math.PI + phase)
    const seasonalAtMonthAgo = seasonalAt(monthAgoIndex)
    // Slow structural drift across the year, independent of the recent trend.
    const yearDrift = (rng() - 0.5) * 2.5

    const history: (number | null)[] = []
    for (let i = 0; i < HISTORY_DAYS; i += 1) {
      let base: number
      if (i >= weekAgoIndex) {
        // Last week: interpolate to the measured value.
        const t = (i - weekAgoIndex) / (todayIndex - weekAgoIndex)
        base = weekAgoValue + (current - weekAgoValue) * t
      } else if (i >= monthAgoIndex) {
        // Preceding three weeks: interpolate to the week-ago anchor.
        const t = (i - monthAgoIndex) / (weekAgoIndex - monthAgoIndex)
        base = monthAgoValue + (weekAgoValue - monthAgoValue) * t
      } else {
        // Everything older: seasonal wave around the month-ago level plus a
        // slow drift, so the year-to-date view has genuine shape.
        const progress = i / Math.max(monthAgoIndex, 1)
        base = monthAgoValue - seasonalAtMonthAgo + seasonalAt(i) + yearDrift * (progress - 1)
      }
      const weekday = WEEKDAY_INDEX_PP[dayOfWeek(HISTORY_DATES[i])]
      const noise = (rng() - 0.5) * 1.4
      history.push(Math.max(0, Number((base + weekday + noise).toFixed(3))))
    }
    // The report date is a measured value, not a modelled one.
    history[todayIndex] = Number(current.toFixed(3))

    const numericHistory = history as number[]
    const forecast = FORECAST_DATES.map((date, i) => {
      const projected = projectUtilization(numericHistory, i + 1)
      if (projected === null) return null
      return Number((projected + WEEKDAY_INDEX_PP[dayOfWeek(date)]).toFixed(3))
    })

    out[facility.id] = {
      facilityId: facility.id,
      history,
      forecast,
      historyPallets: numericHistory.map((pct) => Math.round(((facility.capacity as number) * pct) / 100)),
      trend7dPp: trend7d,
    }
  }

  return out
}

export const FACILITY_SERIES: Record<string, FacilitySeries> = buildFacilitySeries()

// ---------------------------------------------------------------------------
// Aggregated series
// ---------------------------------------------------------------------------

function aggregateSeries(facilityIds: string[]) {
  const scoped = facilityIds.filter((id) => FACILITIES.find((f) => f.id === id)?.capacity !== null)
  const capacity = scoped.reduce((sum, id) => sum + (FACILITIES.find((f) => f.id === id)?.capacity ?? 0), 0)

  const historyPallets = HISTORY_DATES.map((_, dayIndex) =>
    scoped.reduce((sum, id) => sum + (FACILITY_SERIES[id]?.historyPallets[dayIndex] ?? 0), 0),
  )
  const forecastPct = FORECAST_DATES.map((_, dayIndex) => {
    if (capacity === 0) return null
    const pallets = scoped.reduce((sum, id) => {
      const pct = FACILITY_SERIES[id]?.forecast[dayIndex]
      const cap = FACILITIES.find((f) => f.id === id)?.capacity ?? 0
      return sum + (pct === null || pct === undefined ? 0 : (cap * pct) / 100)
    }, 0)
    return Number(((pallets / capacity) * 100).toFixed(3))
  })

  return { capacity, historyPallets, forecastPct }
}

/**
 * Budget curve.
 *
 * The leadership budget is set monthly, so it is a step function rather than
 * a smooth line - drawing it as a smooth line would misrepresent how the
 * number is actually agreed.
 */
const MONTHLY_BUDGET_PCT: Record<string, number> = {
  '2026-07': 84.5,
  '2026-08': 85.0,
  '2026-09': 86.0,
  '2026-10': 87.5,
}

function budgetFor(date: string): number {
  return MONTHLY_BUDGET_PCT[date.slice(0, 7)] ?? 85
}

/** Same calendar day last year, expressed as utilization %. */
function lastYearFor(date: string, networkPct: number, rng: () => number): number {
  // Last year the network ran roughly 3 points lighter with a wider spread.
  return Number((networkPct - 3.1 + (rng() - 0.5) * 2.2).toFixed(3))
}

export interface UtilizationSeries {
  history: UtilizationPoint[]
  forecast: UtilizationPoint[]
}

function buildUtilizationSeries(facilityIds: string[], seedKey: string): UtilizationSeries {
  const { capacity, historyPallets, forecastPct } = aggregateSeries(facilityIds)
  const rng = rngFor(`ly:${seedKey}`)

  const history: UtilizationPoint[] = HISTORY_DATES.map((date, i) => {
    const utilized = historyPallets[i]
    const pct = capacity === 0 ? null : (utilized / capacity) * 100
    return {
      date,
      capacity,
      utilizedPallets: utilized,
      budgetPct: budgetFor(date),
      lastYearPct: pct === null ? null : lastYearFor(date, pct, rng),
      isForecast: false,
    }
  })

  const forecast: UtilizationPoint[] = FORECAST_DATES.map((date, i) => {
    const pct = forecastPct[i]
    return {
      date,
      capacity,
      utilizedPallets: pct === null ? 0 : Math.round((capacity * pct) / 100),
      budgetPct: budgetFor(date),
      lastYearPct: null,
      isForecast: true,
    }
  })

  return { history, forecast }
}

const ALL_FACILITY_IDS = FACILITIES.map((f) => f.id)

export const NETWORK_SERIES: UtilizationSeries = buildUtilizationSeries(ALL_FACILITY_IDS, 'network')

export const REGION_SERIES: Record<RegionId, UtilizationSeries> = REGION_ORDER.reduce(
  (acc, regionId) => {
    acc[regionId] = buildUtilizationSeries(
      FACILITIES.filter((f) => f.regionId === regionId).map((f) => f.id),
      regionId,
    )
    return acc
  },
  {} as Record<RegionId, UtilizationSeries>,
)

// ---------------------------------------------------------------------------
// Temperature-zone trend
// ---------------------------------------------------------------------------

export interface ZoneSeriesPoint {
  date: string
  zoneId: TemperatureZoneId
  utilizationPct: number | null
  utilizedPallets: number
  capacity: number
}

function buildZoneSeries(): Record<TemperatureZoneId, ZoneSeriesPoint[]> {
  const out = {} as Record<TemperatureZoneId, ZoneSeriesPoint[]>
  for (const zone of TEMPERATURE_ZONES) {
    const members = FACILITIES.flatMap((f) =>
      f.capacity === null ? [] : f.zones.filter((z) => z.zoneId === zone.id).map((z) => ({ facility: f, zone: z })),
    )
    const capacity = members.reduce((sum, m) => sum + (m.zone.capacity ?? 0), 0)
    out[zone.id] = HISTORY_DATES.map((date, dayIndex) => {
      // A zone follows its facility's daily curve, scaled by the zone's share
      // of that facility's occupancy today.
      const pallets = members.reduce((sum, m) => {
        const series = FACILITY_SERIES[m.facility.id]
        const facilityToday = m.facility.utilizedPallets
        const share = facilityToday === 0 ? 0 : m.zone.utilizedPallets / facilityToday
        return sum + (series?.historyPallets[dayIndex] ?? 0) * share
      }, 0)
      return {
        date,
        zoneId: zone.id,
        utilizedPallets: Math.round(pallets),
        capacity,
        utilizationPct: capacity === 0 ? null : Number(((pallets / capacity) * 100).toFixed(3)),
      }
    })
  }
  return out
}

export const ZONE_SERIES: Record<TemperatureZoneId, ZoneSeriesPoint[]> = buildZoneSeries()

// ---------------------------------------------------------------------------
// Execution-wise empty (available) pallet trend - carried over from the legacy report
// ---------------------------------------------------------------------------

export interface ExecutionSeriesPoint {
  date: string
  execution: ExecutionId
  availablePallets: number
  capacity: number
}

export const EXECUTIONS: ExecutionId[] = ['SNOWMAN_OWN', 'PARTNER_OPERATED', 'CUSTOMER_DEDICATED']

export const EXECUTION_SERIES: Record<ExecutionId, ExecutionSeriesPoint[]> = EXECUTIONS.reduce(
  (acc, execution) => {
    const members = FACILITIES.filter((f) => f.execution === execution && f.capacity !== null)
    const capacity = members.reduce((sum, f) => sum + (f.capacity ?? 0), 0)
    acc[execution] = HISTORY_DATES.map((date, dayIndex) => {
      const available = members.reduce((sum, f) => {
        const occupied = FACILITY_SERIES[f.id]?.historyPallets[dayIndex] ?? 0
        return sum + Math.max((f.capacity as number) - occupied, 0)
      }, 0)
      return { date, execution, availablePallets: available, capacity }
    })
    return acc
  },
  {} as Record<ExecutionId, ExecutionSeriesPoint[]>,
)

// ---------------------------------------------------------------------------
// Helpers used by the view layer
// ---------------------------------------------------------------------------

export function utilizationOnDay(facilityId: string, daysAgo: number): number | null {
  const series = FACILITY_SERIES[facilityId]
  if (!series) return null
  const index = HISTORY_DAYS - 1 - daysAgo
  if (index < 0 || index >= HISTORY_DAYS) return null
  return series.history[index]
}

export function forecastAt(facilityId: string, horizonDays: number): number | null {
  const series = FACILITY_SERIES[facilityId]
  if (!series) return null
  const index = horizonDays - 1
  if (index < 0 || index >= FORECAST_DAYS) return null
  return series.forecast[index]
}

export function networkUtilizationOnDay(daysAgo: number): number | null {
  const index = HISTORY_DAYS - 1 - daysAgo
  const point = NETWORK_SERIES.history[index]
  if (!point) return null
  return point.capacity === 0 ? null : (point.utilizedPallets / point.capacity) * 100
}

export function networkForecastAt(horizonDays: number): number | null {
  const point = NETWORK_SERIES.forecast[horizonDays - 1]
  if (!point) return null
  return point.capacity === 0 ? null : (point.utilizedPallets / point.capacity) * 100
}

export { addDays, dayOfWeek }
