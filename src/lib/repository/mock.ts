/**
 * Mock implementation of the DataSource.
 *
 * Reads the deterministic dataset in src/lib/data and applies the same
 * domain logic a real backend would run. Results are memoised per filter
 * combination so re-renders and route changes do not recompute the network.
 */

import type {
  ControlTowerSnapshot,
  CustomerQuery,
  CustomerUtilizationResult,
  CustomerUtilizationRow,
  DataSource,
  ExecutionSeriesRow,
  LocationQueryResult,
  LocationRow,
  ParkAndPayRegionRow,
  ParkAndPaySiteRow,
  ParkAndPayView,
  WeeklyCell,
  WeeklyComparison,
  WeeklyFlag,
  WeeklyQuery,
  WeeklyRow,
  ZoneSeriesRow,
} from './types'
import type {
  ExecutionId,
  Facility,
  FilterState,
  ParkAndPaySite,
  RegionId,
  TemperatureZoneId,
  UtilizationPoint,
} from '@/lib/domain/types'
import { THRESHOLDS, utilizationBandLabel, utilizationStatus } from '@/lib/config/thresholds'
import { compareBasis, rollup, utilizationPct } from '@/lib/domain/metrics'
import { buildFacilityRollups, buildRegionRollups, buildZoneRollups } from '@/lib/domain/rollups'
import { buildExceptions } from '@/lib/domain/exceptions'
import { buildHealthScore } from '@/lib/domain/health'
import { buildInsights } from '@/lib/domain/insights'
import {
  CITY_BY_ID,
  FACILITIES,
  LOCATIONS,
  REGIONS,
  REGION_BY_ID,
  REGION_ORDER,
  REGION_SNAPSHOT,
  TEMPERATURE_ZONES,
  ZONE_BY_ID,
  ZONE_GROUP,
  CUSTOMER_SPECS,
} from '@/lib/data/master'
import {
  EXECUTIONS,
  FACILITY_SERIES,
  FORECAST_DATES,
  HISTORY_DATES,
  NETWORK_SERIES,
  dayOfWeek,
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
import { PARK_AND_PAY_GRID_DAYS, PARK_AND_PAY_SITES, parkAndPayCityName } from '@/lib/data/parkandpay'
import { CUSTOMER_ALLOCATIONS, buildCustomers, customerNumber } from '@/lib/data/customer-allocation'

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


// ---------------------------------------------------------------------------
// Park & Pay
// ---------------------------------------------------------------------------

/**
 * Park & Pay responds to the region filter and nothing else.
 *
 * The facility-level filters - type, ownership, execution, temperature zone -
 * describe attributes of the own network that rented space does not carry, so
 * applying them would silently drop Park & Pay from view rather than filter it.
 * Where a filter of that kind is active the screens say the scope is
 * own-network only rather than showing a combined figure that is not comparable.
 */
function parkAndPayInScope(filters: FilterState): ParkAndPaySite[] {
  if (filters.regionIds.length === 0) return PARK_AND_PAY_SITES
  const allowed = new Set<RegionId>(filters.regionIds)
  return PARK_AND_PAY_SITES.filter((site) => allowed.has(site.regionId))
}

function buildParkAndPayView(filters: FilterState, ownFacilities: Facility[]): ParkAndPayView {
  const sites = parkAndPayInScope(filters)
  const windowDates = sites[0]?.daily.map((d) => d.date) ?? []
  const gridDates = windowDates.slice(-PARK_AND_PAY_GRID_DAYS)
  const gridOffset = windowDates.length - gridDates.length

  const rows: ParkAndPaySiteRow[] = sites.map((site) => {
    const pct = utilizationPct(site)
    const sevenDaysAgo = site.daily[site.daily.length - 8]
    const previousPct =
      sevenDaysAgo === undefined ? null : utilizationPct({ capacity: site.capacity, utilizedPallets: sevenDaysAgo.utilizedPallets })
    const daysToContractEnd = Math.round(
      (Date.parse(`${site.contractEndsOn}T00:00:00+05:30`) - Date.parse(`${REPORT_DATE}T00:00:00+05:30`)) / 86_400_000,
    )
    return {
      id: site.id,
      code: site.code,
      name: site.name,
      cityName: parkAndPayCityName(site),
      regionId: site.regionId,
      partner: site.partner,
      contractEndsOn: site.contractEndsOn,
      daysToContractEnd,
      capacity: site.capacity,
      utilizedPallets: site.utilizedPallets,
      utilizationPct: pct,
      availableCapacity: Math.max(site.capacity - site.utilizedPallets, 0),
      overCapacityPallets: Math.max(site.utilizedPallets - site.capacity, 0),
      netEmptyPallets: site.capacity - site.utilizedPallets,
      status: utilizationStatus(pct),
      change7dPp: pct === null || previousPct === null ? null : Number((pct - previousPct).toFixed(2)),
      grid: site.daily.slice(gridOffset).map((d) => ({
        date: d.date,
        utilizedPallets: d.utilizedPallets,
        utilizationPct: utilizationPct({ capacity: site.capacity, utilizedPallets: d.utilizedPallets }),
      })),
      spark: site.daily.map((d) => {
        const p = utilizationPct({ capacity: site.capacity, utilizedPallets: d.utilizedPallets })
        return p === null ? 0 : Number(p.toFixed(2))
      }),
      reportsContractedAsOccupied: site.reportsContractedAsOccupied,
      idle: site.utilizedPallets === 0,
    }
  })

  const ordered = [...rows].sort(
    (a, b) => REGION_ORDER.indexOf(a.regionId) - REGION_ORDER.indexOf(b.regionId) || b.capacity - a.capacity,
  )

  const regionsInScope =
    filters.regionIds.length > 0 ? REGION_ORDER.filter((r) => filters.regionIds.includes(r)) : REGION_ORDER

  const regions: ParkAndPayRegionRow[] = regionsInScope.map((regionId) => {
    const own = ownFacilities.filter((f) => f.regionId === regionId)
    const pnp = sites.filter((s) => s.regionId === regionId)
    return {
      regionId,
      regionName: REGION_BY_ID[regionId].name,
      siteCount: pnp.length,
      comparison: compareBasis(own, pnp),
    }
  })

  const dailyTotals = gridDates.map((date, i) => {
    let capacity = 0
    let utilized = 0
    for (const row of rows) {
      capacity += row.capacity
      utilized += row.grid[i]?.utilizedPallets ?? 0
    }
    return { date, capacity, utilizedPallets: utilized, utilizationPct: utilizationPct({ capacity, utilizedPallets: utilized }) }
  })

  const flatFull = rows.filter((r) => r.reportsContractedAsOccupied)
  const idle = rows.filter((r) => r.idle)
  const expiring = rows.filter((r) => r.daysToContractEnd <= THRESHOLDS.contractRenewalWindowDays)

  return {
    gridDates,
    sites: ordered,
    regions,
    network: compareBasis(ownFacilities, sites),
    dailyTotals,
    flatFullSites: flatFull.length,
    flatFullPallets: flatFull.reduce((sum, r) => sum + r.capacity, 0),
    idlePallets: idle.reduce((sum, r) => sum + r.capacity, 0),
    idleSites: idle.length,
    regionsWithoutParkAndPay: regionsInScope.filter((r) => !sites.some((s) => s.regionId === r)),
    overCapacitySites: rows.filter((r) => r.overCapacityPallets > 0).length,
    contractsExpiringSoon: expiring.length,
    contractsExpiringPallets: expiring.reduce((sum, r) => sum + r.capacity, 0),
  }
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
  const parkAndPay = buildParkAndPayView(filters, facilities)
  const exceptions = buildExceptions(
    facilityRollups,
    filters.regionIds.length > 0 ? new Set<RegionId>(filters.regionIds) : null,
  )
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
    customers: buildCustomers(),
    dataQuality: DATA_QUALITY_REPORT,
    parkAndPay,
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
// Customer-wise utilization
// ---------------------------------------------------------------------------

/**
 * Depositor occupancy by location, in the legacy report's three zones.
 *
 * Rebuilt from the same allocation the depositor list totals come from, so a
 * depositor's network figure is the sum of its rows here and nothing has to be
 * reconciled by hand.
 */
function buildCustomerRows(filters: FilterState): CustomerUtilizationRow[] {
  const scoped = applyFilters(filters)
  const allowed = new Map(scoped.map((f) => [f.id, f]))
  const zoneFilter = filters.zoneIds.length > 0 ? new Set(filters.zoneIds) : null
  const customerFilter = filters.customerIds.length > 0 ? new Set(filters.customerIds) : null

  // customerId -> facilityId -> zone-group totals
  const grid = new Map<string, { frozen: number; chilled: number; dry: number }>()
  for (const a of CUSTOMER_ALLOCATIONS) {
    if (!allowed.has(a.facilityId)) continue
    if (zoneFilter && !zoneFilter.has(a.zoneId)) continue
    if (customerFilter && !customerFilter.has(a.customerId)) continue
    const key = `${a.customerId}|${a.facilityId}`
    const cell = grid.get(key) ?? { frozen: 0, chilled: 0, dry: 0 }
    const group = ZONE_GROUP[a.zoneId]
    if (group === 'FROZEN') cell.frozen += a.pallets
    else if (group === 'CHILLED') cell.chilled += a.pallets
    else cell.dry += a.pallets
    grid.set(key, cell)
  }

  // Location denominators, so "% of location" is a share of what is on screen.
  const locationTotals = new Map<string, number>()
  for (const [key, cell] of grid) {
    const facilityId = key.split('|')[1]
    locationTotals.set(facilityId, (locationTotals.get(facilityId) ?? 0) + cell.frozen + cell.chilled + cell.dry)
  }
  const networkTotal = [...locationTotals.values()].reduce((a, b) => a + b, 0)

  const rows: CustomerUtilizationRow[] = []
  for (const [key, cell] of grid) {
    const [customerId, facilityId] = key.split('|')
    const facility = allowed.get(facilityId)
    const spec = CUSTOMER_SPECS.find((c) => c.id === customerId)
    if (!facility || !spec) continue
    const fcd = cell.frozen + cell.chilled + cell.dry
    if (fcd === 0) continue
    const locTotal = locationTotals.get(facilityId) ?? 0
    const parts = facility.code.split('-')
    rows.push({
      customerId,
      customerNo: customerNumber(customerId, facilityId) ?? 'N/A',
      customerName: spec.name,
      sector: spec.sector,
      regionId: facility.regionId,
      facilityId,
      locationCode: `${parts[1] ?? facility.code}-${parts[2] ?? ''}`.replace(/-$/, ''),
      facilityName: facility.name,
      cityName: CITY_BY_ID[facility.cityId]?.name ?? 'Unknown',
      frozen: cell.frozen,
      chilled: cell.chilled,
      dry: cell.dry,
      fcdPallets: fcd,
      pctOfLocation: locTotal === 0 ? null : Number(((fcd / locTotal) * 100).toFixed(2)),
      pctOfNetwork: networkTotal === 0 ? null : Number(((fcd / networkTotal) * 100).toFixed(3)),
    })
  }
  return rows
}

const customerCache = new Map<string, CustomerUtilizationRow[]>()

// ---------------------------------------------------------------------------
// Weekly comparison
// ---------------------------------------------------------------------------

/**
 * Week-ending Sundays available in the history, oldest first.
 *
 * The legacy weekly comparison is published against Sunday week-endings, so
 * the same anchor is used here rather than a rolling seven-day window - a
 * report the business already reconciles against should not quietly change
 * its period boundaries.
 */
const WEEK_ENDINGS: { date: string; index: number }[] = HISTORY_DATES.map((date, index) => ({ date, index })).filter(
  (d) => dayOfWeek(d.date) === 0,
)

/** How settled a series is: mean absolute week-on-week movement. */
function volatility(values: (number | null)[]): number | null {
  const deltas: number[] = []
  for (let i = 1; i < values.length; i += 1) {
    const a = values[i - 1]
    const b = values[i]
    if (a === null || b === null) continue
    deltas.push(Math.abs(b - a))
  }
  if (deltas.length === 0) return null
  return Number((deltas.reduce((x, y) => x + y, 0) / deltas.length).toFixed(2))
}

function weeklyFlags(cells: WeeklyCell[], windowChange: number | null, vol: number | null): WeeklyFlag[] {
  const values = cells.map((c) => c.utilizationPct).filter((v): v is number => v !== null)
  const flags: WeeklyFlag[] = []
  if (values.length === 0) return ['NOT_COMPUTABLE']
  if (values.length === cells.length && values.every((v) => v > 100)) flags.push('SUSTAINED_OVER')
  if (values.length === cells.length && values.every((v) => v < THRESHOLDS.underUtilizedPct)) flags.push('SUSTAINED_UNDER')
  if (vol !== null && vol >= 2.5) flags.push('VOLATILE')
  // A site whose reported utilization barely moves for a month is either
  // genuinely static or its feed has stopped updating; both are worth a look.
  if (vol !== null && vol < 0.25 && cells.length >= 3) flags.push('FLAT')
  if (windowChange !== null && windowChange >= 3) flags.push('IMPROVING')
  if (windowChange !== null && windowChange <= -3) flags.push('DECLINING')
  return flags
}

/** Build one row from a set of facilities, aggregating pallets over capacity. */
function weeklyRow(
  id: string,
  kind: WeeklyRow['kind'],
  label: string,
  sublabel: string | null,
  regionId: string | null,
  facilityId: string | null,
  members: Facility[],
  weeks: { date: string; index: number }[],
  baseline: { date: string; index: number } | null,
): WeeklyRow {
  const scoped = members.filter((f) => f.capacity !== null && f.capacity > 0)
  const capacity = scoped.reduce((sum, f) => sum + (f.capacity as number), 0)

  const at = (weekIndex: number): number | null => {
    if (capacity === 0) return null
    const pallets = scoped.reduce((sum, f) => sum + (FACILITY_SERIES[f.id]?.historyPallets[weekIndex] ?? 0), 0)
    return Number(((pallets / capacity) * 100).toFixed(2))
  }

  const baselinePct = baseline ? at(baseline.index) : null
  const cells: WeeklyCell[] = weeks.map((week, i) => {
    const pct = at(week.index)
    const previous = i === 0 ? baselinePct : at(weeks[i - 1].index)
    return {
      weekEnding: week.date,
      utilizationPct: pct,
      changePp: pct === null || previous === null ? null : Number((pct - previous).toFixed(2)),
      status: utilizationStatus(pct),
    }
  })

  const values = cells.map((c) => c.utilizationPct)
  const first = values.find((v) => v !== null) ?? null
  const latest = [...values].reverse().find((v) => v !== null) ?? null
  const windowChange = first === null || latest === null ? null : Number((latest - first).toFixed(2))
  const vol = volatility(values)

  return {
    id,
    kind,
    label,
    sublabel,
    regionId,
    facilityId,
    capacity: capacity === 0 ? null : capacity,
    cells,
    latestPct: latest,
    windowChangePp: windowChange,
    volatilityPp: vol,
    status: utilizationStatus(latest),
    flags: weeklyFlags(cells, windowChange, vol),
  }
}

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

  queryCustomerUtilization({ filters, search, sortBy = 'fcd', sortDir = 'desc' }: CustomerQuery): CustomerUtilizationResult {
    const key = filterKey(filters)
    let rows = customerCache.get(key)
    if (!rows) {
      rows = buildCustomerRows(filters)
      customerCache.set(key, rows)
    }

    const term = search?.trim().toLowerCase()
    const filtered = term
      ? rows.filter(
          (r) =>
            r.customerName.toLowerCase().includes(term) ||
            r.customerNo.toLowerCase().includes(term) ||
            r.sector.toLowerCase().includes(term) ||
            r.locationCode.toLowerCase().includes(term) ||
            r.facilityName.toLowerCase().includes(term) ||
            r.regionId.toLowerCase().includes(term),
        )
      : rows

    const dir = sortDir === 'asc' ? 1 : -1
    const sorted = [...filtered].sort((a, b) => {
      switch (sortBy) {
        case 'customer':
          return dir * a.customerName.localeCompare(b.customerName)
        case 'frozen':
          return dir * (a.frozen - b.frozen)
        case 'chilled':
          return dir * (a.chilled - b.chilled)
        case 'dry':
          return dir * (a.dry - b.dry)
        default:
          return dir * (a.fcdPallets - b.fcdPallets)
      }
    })

    const totals = sorted.reduce(
      (acc, r) => ({
        frozen: acc.frozen + r.frozen,
        chilled: acc.chilled + r.chilled,
        dry: acc.dry + r.dry,
        fcdPallets: acc.fcdPallets + r.fcdPallets,
      }),
      { frozen: 0, chilled: 0, dry: 0, fcdPallets: 0 },
    )

    // Depositor concentration is measured across the network, not per row.
    const byCustomer = new Map<string, number>()
    for (const r of sorted) byCustomer.set(r.customerId, (byCustomer.get(r.customerId) ?? 0) + r.fcdPallets)
    const ranked = [...byCustomer.entries()].filter(([id]) => id !== 'others').sort((a, b) => b[1] - a[1])
    const topTen = ranked.slice(0, 10).reduce((a, [, v]) => a + v, 0)

    const excluded = sorted
      .filter((r) => FACILITIES.find((f) => f.id === r.facilityId)?.capacity === null)
      .reduce((a, r) => a + r.fcdPallets, 0)

    return {
      rows: sorted,
      totals,
      customerCount: byCustomer.size,
      locationCount: new Set(sorted.map((r) => r.facilityId)).size,
      excludedPallets: excluded,
      topTenSharePct: totals.fcdPallets === 0 ? null : Number(((topTen / totals.fcdPallets) * 100).toFixed(1)),
    }
  },

  queryWeeklyComparison({ filters, weeks }: WeeklyQuery): WeeklyComparison {
    const facilities = applyFilters(filters)
    const available = WEEK_ENDINGS.slice(-(weeks + 1))
    // One extra week is read so the first displayed column still has a
    // movement figure, exactly as the legacy report shows one.
    const hasBaseline = available.length > weeks
    const baseline = hasBaseline ? available[0] : null
    const window = hasBaseline ? available.slice(1) : available

    const network = weeklyRow('network', 'network', 'Total', 'All regions in scope', null, null, facilities, window, baseline)

    const regions = REGION_ORDER.map((regionId) => {
      const members = facilities.filter((f) => f.regionId === regionId)
      if (members.length === 0) return null
      const meta = REGIONS.find((r) => r.id === regionId)
      return {
        region: weeklyRow(regionId, 'region', regionId, meta?.head ?? null, regionId, null, members, window, baseline),
        facilities: members
          .map((f) =>
            weeklyRow(
              f.id,
              'facility',
              f.code,
              `${f.name} · ${CITY_BY_ID[f.cityId]?.name ?? ''}`,
              regionId,
              f.id,
              [f],
              window,
              baseline,
            ),
          )
          .sort((a, b) => (b.latestPct ?? -1) - (a.latestPct ?? -1)),
      }
    }).filter((r): r is { region: WeeklyRow; facilities: WeeklyRow[] } => r !== null)

    const allFacilities = regions.flatMap((r) => r.facilities)
    const ranked = allFacilities.filter((f) => f.windowChangePp !== null)

    return {
      weekEndings: window.map((w) => w.date),
      baselineWeek: baseline?.date ?? null,
      network,
      regions,
      movers: {
        improving: [...ranked].sort((a, b) => (b.windowChangePp ?? 0) - (a.windowChangePp ?? 0)).slice(0, 5),
        declining: [...ranked].sort((a, b) => (a.windowChangePp ?? 0) - (b.windowChangePp ?? 0)).slice(0, 5),
      },
      watchlist: {
        sustainedOver: allFacilities.filter((f) => f.flags.includes('SUSTAINED_OVER')),
        sustainedUnder: allFacilities.filter((f) => f.flags.includes('SUSTAINED_UNDER')),
        volatile: [...allFacilities.filter((f) => f.flags.includes('VOLATILE'))]
          .sort((a, b) => (b.volatilityPp ?? 0) - (a.volatilityPp ?? 0))
          .slice(0, 6),
        flat: allFacilities.filter((f) => f.flags.includes('FLAT')),
        notComputable: allFacilities.filter((f) => f.flags.includes('NOT_COMPUTABLE')),
      },
    }
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
