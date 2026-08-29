/**
 * Mock implementation of the DataSource.
 *
 * Reads the deterministic dataset in src/lib/data and applies the same
 * domain logic a real backend would run. Results are memoised per filter
 * combination so re-renders and route changes do not recompute the network.
 */

import type {
  ControlTowerSnapshot,
  DataSource,
  ExecutionSeriesRow,
  LocationQueryResult,
  LocationRow,
  ZoneSeriesRow,
} from './types'
import type { ExecutionId, Facility, FilterState, TemperatureZoneId, UtilizationPoint } from '@/lib/domain/types'
import { THRESHOLDS, utilizationBandLabel, utilizationStatus } from '@/lib/config/thresholds'
import { rollup, utilizationPct } from '@/lib/domain/metrics'
import { buildFacilityRollups, buildRegionRollups, buildZoneRollups } from '@/lib/domain/rollups'
import { buildExceptions } from '@/lib/domain/exceptions'
import { buildHealthScore } from '@/lib/domain/health'
import { buildInsights } from '@/lib/domain/insights'
import {
  CITY_BY_ID,
  FACILITIES,
  LOCATIONS,
  REGIONS,
  REGION_SNAPSHOT,
  TEMPERATURE_ZONES,
  ZONE_BY_ID,
  buildCustomers,
} from '@/lib/data/master'
import {
  EXECUTIONS,
  FACILITY_SERIES,
  FORECAST_DATES,
  HISTORY_DATES,
  NETWORK_SERIES,
} from '@/lib/data/timeseries'
import {
  LAST_REFRESH_AT,
  OPERATIONAL_WINDOW_DAYS,
  PREVIOUS_REFRESH_AT,
  REPORT_DATE,
} from '@/lib/data/seed'
import { COLD_CHAIN_SUMMARY, TEMPERATURE_EXCURSIONS } from '@/lib/data/coldchain'
import { AGEING_BUCKETS, EXPIRY_BUCKETS, EXPIRY_UNDATED_PALLETS } from '@/lib/data/inventory'
import { DATA_QUALITY_REPORT } from '@/lib/data/dataquality'
import { DOCK_BY_FACILITY, NETWORK_FLOW } from '@/lib/data/operations'
import { PARK_AND_PAY_SITES } from '@/lib/data/parkandpay'

// ---------------------------------------------------------------------------
// Filtering
// ---------------------------------------------------------------------------

function matchesFilters(facility: Facility, filters: FilterState): boolean {
  if (filters.regionIds.length > 0 && !filters.regionIds.includes(facility.regionId)) return false
  if (filters.facilityIds.length > 0 && !filters.facilityIds.includes(facility.id)) return false
  if (filters.facilityTypes.length > 0 && !filters.facilityTypes.includes(facility.type)) return false
  if (filters.ownerships.length > 0 && !filters.ownerships.includes(facility.ownership)) return false
  if (filters.executions.length > 0 && !filters.executions.includes(facility.execution)) return false
  if (filters.zoneIds.length > 0 && !facility.zones.some((z) => filters.zoneIds.includes(z.zoneId))) return false
  return true
}

/**
 * A zone filter narrows what counts as capacity, not just which facilities
 * appear. Filtering to Frozen must report frozen capacity, not the whole site.
 */
function projectToZones(facility: Facility, zoneIds: FilterState['zoneIds']): Facility {
  if (zoneIds.length === 0) return facility
  const zones = facility.zones.filter((z) => zoneIds.includes(z.zoneId))
  const hasCapacity = zones.some((z) => z.capacity !== null)
  return {
    ...facility,
    capacity: facility.capacity === null || !hasCapacity ? null : zones.reduce((s, z) => s + (z.capacity ?? 0), 0),
    utilizedPallets: zones.reduce((s, z) => s + z.utilizedPallets, 0),
    zones,
  }
}

function applyFilters(filters: FilterState): Facility[] {
  return FACILITIES.filter((f) => matchesFilters(f, filters)).map((f) => projectToZones(f, filters.zoneIds))
}

// ---------------------------------------------------------------------------
// Series
// ---------------------------------------------------------------------------

function seriesForFacilities(facilities: Facility[]): { history: UtilizationPoint[]; forecast: UtilizationPoint[] } {
  const ids = facilities.filter((f) => f.capacity !== null).map((f) => f.id)
  // The unfiltered case is precomputed; only rebuild when the user narrows.
  if (ids.length === FACILITIES.filter((f) => f.capacity !== null).length) return NETWORK_SERIES

  const capacity = facilities.reduce((sum, f) => sum + (f.capacity ?? 0), 0)
  // Zone-filtered facilities carry a reduced capacity, so scale the facility's
  // daily occupancy by the share of it that the selected zones hold today.
  const shares = new Map<string, number>()
  for (const f of facilities) {
    const full = FACILITIES.find((x) => x.id === f.id)
    const denominator = full?.utilizedPallets ?? 0
    shares.set(f.id, denominator === 0 ? 0 : f.utilizedPallets / denominator)
  }

  const history = HISTORY_DATES.map((date, i) => {
    const utilized = ids.reduce(
      (sum, id) => sum + (FACILITY_SERIES[id]?.historyPallets[i] ?? 0) * (shares.get(id) ?? 1),
      0,
    )
    const reference = NETWORK_SERIES.history[i]
    const pct = capacity === 0 ? null : (utilized / capacity) * 100
    return {
      date,
      capacity,
      utilizedPallets: Math.round(utilized),
      budgetPct: reference.budgetPct,
      lastYearPct: pct === null ? null : Number((pct - 3.1).toFixed(3)),
      isForecast: false,
    }
  })

  const forecast = FORECAST_DATES.map((date, i) => {
    const utilized = ids.reduce((sum, id) => {
      const pct = FACILITY_SERIES[id]?.forecast[i]
      const full = FACILITIES.find((x) => x.id === id)
      if (pct === null || pct === undefined || !full || full.capacity === null) return sum
      return sum + ((full.capacity * pct) / 100) * (shares.get(id) ?? 1)
    }, 0)
    return {
      date,
      capacity,
      utilizedPallets: Math.round(utilized),
      budgetPct: NETWORK_SERIES.forecast[i].budgetPct,
      lastYearPct: null,
      isForecast: true,
    }
  })

  return { history, forecast }
}

/**
 * Temperature-zone and execution histories for the operational window.
 *
 * Both are aggregated from the same facility series everything else uses, so
 * a zone total on the Utilization screen reconciles with the zone card on the
 * Cold Chain screen without either being recomputed differently.
 */
function zoneAndExecutionSeries(facilities: Facility[], windowDays = OPERATIONAL_WINDOW_DAYS) {
  const dates = HISTORY_DATES.slice(-windowDays)
  const offset = HISTORY_DATES.length - windowDays
  const scoped = facilities.filter((f) => f.capacity !== null)

  const zoneSeries = {} as Record<TemperatureZoneId, ZoneSeriesRow[]>
  for (const zone of TEMPERATURE_ZONES) {
    const members = scoped.flatMap((facility) =>
      facility.zones
        .filter((z) => z.zoneId === zone.id && z.capacity !== null)
        .map((z) => ({ facility, zone: z })),
    )
    const capacity = members.reduce((sum, m) => sum + (m.zone.capacity ?? 0), 0)
    zoneSeries[zone.id] = dates.map((date, i) => {
      const pallets = members.reduce((sum, m) => {
        const dayTotal = FACILITY_SERIES[m.facility.id]?.historyPallets[offset + i] ?? 0
        // Hold today's zone mix constant across the window; the daily zone
        // split is not published by the legacy extract.
        const share = m.facility.utilizedPallets === 0 ? 0 : m.zone.utilizedPallets / m.facility.utilizedPallets
        return sum + dayTotal * share
      }, 0)
      return {
        date,
        capacity,
        utilizedPallets: Math.round(pallets),
        utilizationPct: capacity === 0 ? null : Number(((pallets / capacity) * 100).toFixed(2)),
      }
    })
  }

  const executionSeries = {} as Record<ExecutionId, ExecutionSeriesRow[]>
  for (const execution of EXECUTIONS) {
    const members = scoped.filter((f) => f.execution === execution)
    const capacity = members.reduce((sum, f) => sum + (f.capacity ?? 0), 0)
    executionSeries[execution] = dates.map((date, i) => {
      let available = 0
      let occupied = 0
      for (const facility of members) {
        const dayTotal = FACILITY_SERIES[facility.id]?.historyPallets[offset + i] ?? 0
        occupied += dayTotal
        available += Math.max((facility.capacity as number) - dayTotal, 0)
      }
      return {
        date,
        availablePallets: available,
        capacity,
        utilizationPct: capacity === 0 ? null : Number(((occupied / capacity) * 100).toFixed(2)),
      }
    })
  }

  return { zoneSeries, executionSeries }
}

function pctOf(point: UtilizationPoint | undefined): number | null {
  if (!point || point.capacity === 0) return null
  return Number(((point.utilizedPallets / point.capacity) * 100).toFixed(3))
}

// ---------------------------------------------------------------------------
// Snapshot
// ---------------------------------------------------------------------------

function hoursBetween(fromIso: string, toIso: string): number {
  return Math.abs(new Date(toIso).getTime() - new Date(fromIso).getTime()) / 3_600_000
}

const snapshotCache = new Map<string, ControlTowerSnapshot>()

function filterKey(filters: FilterState): string {
  return JSON.stringify([
    filters.date,
    [...filters.regionIds].sort(),
    [...filters.facilityIds].sort(),
    [...filters.zoneIds].sort(),
    [...filters.customerIds].sort(),
    [...filters.facilityTypes].sort(),
    [...filters.ownerships].sort(),
    [...filters.executions].sort(),
    filters.comparison,
  ])
}

function computeSnapshot(filters: FilterState): ControlTowerSnapshot {
  const facilities = applyFilters(filters)
  const network = rollup(facilities)
  const series = seriesForFacilities(facilities)

  const todayPct = network.utilizationPct
  const lastIndex = series.history.length - 1
  const previousDayPct = pctOf(series.history[lastIndex - 1])
  const previousWeekPct = pctOf(series.history[lastIndex - 7])
  const previousMonthPct = pctOf(series.history[0])
  const change7dPp =
    todayPct === null || previousWeekPct === null ? null : Number((todayPct - previousWeekPct).toFixed(2))

  const facilityRollups = buildFacilityRollups(facilities)
  const regionRollups = buildRegionRollups(facilities)
  const zoneRollups = buildZoneRollups(facilities, filters.zoneIds)

  const capacity = network.capacity ?? 0
  const forecastPct = (horizon: number): number | null => {
    const point = series.forecast[horizon - 1]
    if (!point || capacity === 0) return null
    return Number(((point.utilizedPallets / point.capacity) * 100).toFixed(2))
  }

  const targetPct = THRESHOLDS.networkTargetPct
  const health = buildHealthScore(network, facilityRollups, change7dPp)
  const exceptions = buildExceptions(facilityRollups)
  const insights = buildInsights({
    network,
    regions: regionRollups,
    facilities: facilityRollups,
    change7dPp,
    coldChain: COLD_CHAIN_SUMMARY,
  })

  const dockValues = facilities
    .map((f) => DOCK_BY_FACILITY[f.id])
    .filter((d): d is NonNullable<typeof d> => Boolean(d))
  const median = (key: 'dockToStockMinutes' | 'stagingDwellMinutes' | 'dispatchDwellMinutes'): number | null => {
    const values = dockValues.map((d) => d[key]).filter((v): v is number => v !== null)
    if (values.length === 0) return null
    const sorted = [...values].sort((a, b) => a - b)
    const mid = Math.floor(sorted.length / 2)
    return sorted.length % 2 === 0 ? Math.round((sorted[mid - 1] + sorted[mid]) / 2) : sorted[mid]
  }

  const dataAgeHours = hoursBetween(LAST_REFRESH_AT, `${REPORT_DATE}T09:00:00+05:30`)
  const { zoneSeries, executionSeries } = zoneAndExecutionSeries(facilities)

  return {
    filters,
    lastRefreshAt: LAST_REFRESH_AT,
    previousRefreshAt: PREVIOUS_REFRESH_AT,
    dataAgeHours: Number(dataAgeHours.toFixed(1)),
    isStale: dataAgeHours > THRESHOLDS.dataStaleAfterHours,
    network: {
      ...network,
      reportDate: filters.date,
      targetPct,
      variancePct: todayPct === null ? null : Number((todayPct - targetPct).toFixed(2)),
      change7dPp,
      comparison: {
        previousDayPct,
        previousWeekPct,
        previousMonthPct,
        samePeriodLastYearPct: series.history[lastIndex]?.lastYearPct ?? null,
        budgetPct: series.history[lastIndex]?.budgetPct ?? null,
      },
      forecast: {
        horizon7Pct: forecastPct(7),
        horizon14Pct: forecastPct(14),
        horizon30Pct: forecastPct(30),
      },
      facilityCount: facilities.length,
      overCapacityFacilities: facilities.filter((f) => f.capacity !== null && f.utilizedPallets > f.capacity).length,
    },
    health,
    regions: regionRollups,
    facilities: facilityRollups,
    zones: zoneRollups,
    exceptions,
    insights,
    series,
    operations: {
      flow: NETWORK_FLOW,
      dockToStockMinutes: median('dockToStockMinutes'),
      stagingDwellMinutes: median('stagingDwellMinutes'),
      dispatchDwellMinutes: median('dispatchDwellMinutes'),
      dpr: NETWORK_FLOW[NETWORK_FLOW.length - 1]?.dpr ?? null,
    },
    zoneSeries,
    executionSeries,
    coldChain: COLD_CHAIN_SUMMARY,
    excursions: TEMPERATURE_EXCURSIONS,
    ageing: AGEING_BUCKETS,
    expiry: EXPIRY_BUCKETS,
    expiryUndatedPallets: EXPIRY_UNDATED_PALLETS,
    customers: buildCustomers(network.utilizedPallets),
    dataQuality: DATA_QUALITY_REPORT,
  }
}

// ---------------------------------------------------------------------------
// Location query
// ---------------------------------------------------------------------------

function buildLocationRows(filters: FilterState): LocationRow[] {
  const allowed = new Set(applyFilters(filters).map((f) => f.id))
  const zoneFilter = filters.zoneIds.length > 0 ? new Set(filters.zoneIds) : null

  return LOCATIONS.filter((l) => allowed.has(l.facilityId) && (!zoneFilter || zoneFilter.has(l.zoneId))).map((l) => {
    const facility = FACILITIES.find((f) => f.id === l.facilityId)
    const pct = utilizationPct(l)
    return {
      id: l.id,
      regionId: l.regionId,
      facilityCode: facility?.code ?? l.facilityId,
      facilityName: facility?.name ?? 'Unknown',
      chamber: l.chamber,
      label: l.label,
      zoneId: l.zoneId,
      zoneName: ZONE_BY_ID[l.zoneId].name,
      capacity: l.capacity,
      utilizedPallets: l.utilizedPallets,
      availableCapacity: l.capacity === null ? null : Math.max(l.capacity - l.utilizedPallets, 0),
      utilizationPct: pct,
      status: utilizationStatus(pct),
    }
  })
}

const locationCache = new Map<string, LocationRow[]>()

// ---------------------------------------------------------------------------

export const mockDataSource: DataSource = {
  listRegions: () => REGIONS,
  listFacilities: () => FACILITIES,
  listLocations: () => LOCATIONS,
  listParkAndPay: () => PARK_AND_PAY_SITES,

  getSnapshot(filters) {
    const key = filterKey(filters)
    const cached = snapshotCache.get(key)
    if (cached) return cached
    const snapshot = computeSnapshot(filters)
    snapshotCache.set(key, snapshot)
    return snapshot
  },

  queryLocations({ filters, search, page, pageSize, sortBy = 'utilization', sortDir = 'desc' }): LocationQueryResult {
    const key = filterKey(filters)
    let rows = locationCache.get(key)
    if (!rows) {
      rows = buildLocationRows(filters)
      locationCache.set(key, rows)
    }

    const term = search?.trim().toLowerCase()
    let filtered = rows
    if (term) {
      filtered = rows.filter(
        (r) =>
          r.facilityCode.toLowerCase().includes(term) ||
          r.facilityName.toLowerCase().includes(term) ||
          r.label.toLowerCase().includes(term) ||
          r.chamber.toLowerCase().includes(term) ||
          r.zoneName.toLowerCase().includes(term) ||
          r.regionId.toLowerCase().includes(term),
      )
    }

    const direction = sortDir === 'asc' ? 1 : -1
    const sorted = [...filtered].sort((a, b) => {
      switch (sortBy) {
        case 'facility':
          return direction * a.facilityCode.localeCompare(b.facilityCode)
        case 'capacity':
          return direction * ((a.capacity ?? -1) - (b.capacity ?? -1))
        case 'occupied':
          return direction * (a.utilizedPallets - b.utilizedPallets)
        case 'available':
          return direction * ((a.availableCapacity ?? -1) - (b.availableCapacity ?? -1))
        default: {
          // Nulls always sort last regardless of direction - a location with
          // no capacity master is not "0%".
          if (a.utilizationPct === null && b.utilizationPct === null) return 0
          if (a.utilizationPct === null) return 1
          if (b.utilizationPct === null) return -1
          return direction * (a.utilizationPct - b.utilizationPct)
        }
      }
    })

    const start = page * pageSize
    return {
      rows: sorted.slice(start, start + pageSize),
      total: sorted.length,
      page,
      pageSize,
    }
  },
}

/**
 * Reporting context. In production this comes from the ETL run log; here it
 * is the fixed demo snapshot date so the prototype is reproducible.
 */
export const REPORT_CONTEXT = {
  reportDate: REPORT_DATE,
  lastRefreshAt: LAST_REFRESH_AT,
  previousRefreshAt: PREVIOUS_REFRESH_AT,
  historyDates: HISTORY_DATES,
  forecastDates: FORECAST_DATES,
} as const

export { utilizationBandLabel, CITY_BY_ID, REGION_SNAPSHOT }
