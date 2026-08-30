/**
 * The data abstraction layer.
 *
 * This is the seam between the control tower UI and wherever the numbers come
 * from. Screens depend only on this interface; today it is served from
 * deterministic mock data, tomorrow from a semantic KPI API over the
 * warehouse. Nothing above this line imports from src/lib/data.
 */

import type {
  AgeingBucket,
  ExecutionId,
  TemperatureZoneId,
  CapacityRollup,
  ColdChainSummary,
  Customer,
  DataQualityReport,
  ExceptionRecord,
  ExpiryBucket,
  Facility,
  FacilityRollup,
  FilterState,
  HealthScore,
  Insight,
  PalletFlowPoint,
  BasisComparison,
  ParkAndPaySite,
  Region,
  RegionId,
  StatusLevel,
  RegionRollup,
  StorageLocation,
  TemperatureExcursion,
  UtilizationPoint,
  ZoneRollup,
} from '@/lib/domain/types'

export interface ComparisonSet {
  previousDayPct: number | null
  previousWeekPct: number | null
  previousMonthPct: number | null
  samePeriodLastYearPct: number | null
  budgetPct: number | null
}

export interface ForecastSet {
  horizon7Pct: number | null
  horizon14Pct: number | null
  horizon30Pct: number | null
}

export interface NetworkSnapshot extends CapacityRollup {
  reportDate: string
  targetPct: number
  variancePct: number | null
  change7dPp: number | null
  comparison: ComparisonSet
  forecast: ForecastSet
  facilityCount: number
  overCapacityFacilities: number
}

export interface OperationsSnapshot {
  flow: PalletFlowPoint[]
  dockToStockMinutes: number | null
  stagingDwellMinutes: number | null
  dispatchDwellMinutes: number | null
  dpr: number | null
}

export interface ZoneSeriesRow {
  date: string
  utilizationPct: number | null
  utilizedPallets: number
  capacity: number
}

export interface ExecutionSeriesRow {
  date: string
  availablePallets: number
  capacity: number
  utilizationPct: number | null
}


// ---------------------------------------------------------------------------
// Park & Pay
// ---------------------------------------------------------------------------

/** One rented location, with the day-by-day grid the legacy report publishes. */
export interface ParkAndPaySiteRow {
  id: string
  code: string
  name: string
  cityName: string
  regionId: RegionId
  partner: string
  contractEndsOn: string
  daysToContractEnd: number
  capacity: number
  utilizedPallets: number
  utilizationPct: number | null
  availableCapacity: number
  overCapacityPallets: number
  /** capacity - utilized, allowed to go negative, as the legacy report shows. */
  netEmptyPallets: number
  status: StatusLevel
  change7dPp: number | null
  /** Utilization on each day of the published grid, oldest first. */
  grid: { date: string; utilizedPallets: number; utilizationPct: number | null }[]
  /** Occupancy across the whole operational window, for the trend. */
  spark: number[]
  reportsContractedAsOccupied: boolean
  idle: boolean
}

export interface ParkAndPayRegionRow {
  regionId: RegionId
  regionName: string
  siteCount: number
  comparison: BasisComparison
}

export interface ParkAndPayView {
  /** The dates of the published grid, oldest first. */
  gridDates: string[]
  sites: ParkAndPaySiteRow[]
  regions: ParkAndPayRegionRow[]
  /** Own vs Park & Pay vs combined for everything currently in scope. */
  network: BasisComparison
  /** Park & Pay totals on each day of the grid. */
  dailyTotals: { date: string; capacity: number; utilizedPallets: number; utilizationPct: number | null }[]
  /** Locations whose feed reports contracted space as occupied. */
  flatFullSites: number
  flatFullPallets: number
  /** Contracted positions carrying no occupancy on the report date. */
  idlePallets: number
  idleSites: number
  /** Regions in scope with no Park & Pay presence at all. */
  regionsWithoutParkAndPay: RegionId[]
  overCapacitySites: number
  contractsExpiringSoon: number
  contractsExpiringPallets: number
}

/** Everything one screen render needs, resolved in a single pass. */
export interface ControlTowerSnapshot {
  filters: FilterState
  lastRefreshAt: string
  previousRefreshAt: string
  dataAgeHours: number
  isStale: boolean
  network: NetworkSnapshot
  health: HealthScore
  regions: RegionRollup[]
  facilities: FacilityRollup[]
  zones: ZoneRollup[]
  exceptions: ExceptionRecord[]
  insights: Insight[]
  series: { history: UtilizationPoint[]; forecast: UtilizationPoint[] }
  operations: OperationsSnapshot
  /** Per-temperature-zone daily history for the operational window. */
  zoneSeries: Record<TemperatureZoneId, ZoneSeriesRow[]>
  /** Execution-wise available (empty) pallet trend from the legacy report. */
  executionSeries: Record<ExecutionId, ExecutionSeriesRow[]>
  coldChain: ColdChainSummary
  excursions: TemperatureExcursion[]
  ageing: AgeingBucket[]
  expiry: ExpiryBucket[]
  expiryUndatedPallets: number
  customers: Customer[]
  dataQuality: DataQualityReport
  /**
   * Park & Pay is a separate operating model - space rented from third parties
   * and sold on. It is carried alongside the own-network figures rather than
   * folded into them, so every screen can show own, Park & Pay and combined.
   */
  parkAndPay: ParkAndPayView
}

/**
 * One depositor's occupancy at one location, in the three zones the legacy
 * daily report publishes. `fcdPallets` is the row total across those zones -
 * that is what "FCD Pallets" means in the legacy report, not a facility type.
 */
export interface CustomerUtilizationRow {
  customerId: string
  customerNo: string
  customerName: string
  sector: string
  regionId: string
  facilityId: string
  locationCode: string
  facilityName: string
  cityName: string
  frozen: number
  chilled: number
  dry: number
  fcdPallets: number
  /** Share of this location's total occupancy held by this depositor. */
  pctOfLocation: number | null
  /** Share of the in-scope network occupancy. */
  pctOfNetwork: number | null
}

export interface CustomerUtilizationResult {
  rows: CustomerUtilizationRow[]
  totals: { frozen: number; chilled: number; dry: number; fcdPallets: number }
  customerCount: number
  locationCount: number
  /** Occupancy sitting at facilities with no capacity master row. */
  excludedPallets: number
  /** Top-ten depositor share of the reported occupancy. */
  topTenSharePct: number | null
}

export interface CustomerQuery {
  filters: FilterState
  search?: string
  sortBy?: 'fcd' | 'frozen' | 'chilled' | 'dry' | 'customer'
  sortDir?: 'asc' | 'desc'
}

// ---------------------------------------------------------------------------
// Weekly comparison
// ---------------------------------------------------------------------------

export type WeeklyFlag =
  | 'SUSTAINED_OVER'
  | 'SUSTAINED_UNDER'
  | 'VOLATILE'
  | 'FLAT'
  | 'NOT_COMPUTABLE'
  | 'IMPROVING'
  | 'DECLINING'

export interface WeeklyCell {
  weekEnding: string
  utilizationPct: number | null
  /**
   * Movement against the previous week in PERCENTAGE POINTS.
   *
   * The legacy report labels this column "Percent Change" but publishes a
   * percentage-point delta; the two differ materially at any utilization far
   * from 100%. It is labelled honestly here.
   */
  changePp: number | null
  status: string
}

export interface WeeklyRow {
  id: string
  kind: 'network' | 'region' | 'facility'
  label: string
  sublabel: string | null
  regionId: string | null
  facilityId: string | null
  capacity: number | null
  cells: WeeklyCell[]
  latestPct: number | null
  /** Movement across the whole displayed window, in percentage points. */
  windowChangePp: number | null
  /** Mean absolute week-on-week movement - how unsettled the site is. */
  volatilityPp: number | null
  status: string
  flags: WeeklyFlag[]
}

export interface WeeklyComparison {
  weekEndings: string[]
  /** The week immediately before the window, used for the first column's delta. */
  baselineWeek: string | null
  network: WeeklyRow
  regions: { region: WeeklyRow; facilities: WeeklyRow[] }[]
  movers: { improving: WeeklyRow[]; declining: WeeklyRow[] }
  watchlist: {
    sustainedOver: WeeklyRow[]
    sustainedUnder: WeeklyRow[]
    volatile: WeeklyRow[]
    flat: WeeklyRow[]
    notComputable: WeeklyRow[]
  }
}

export interface WeeklyQuery {
  filters: FilterState
  /** Number of week-ending columns to display. */
  weeks: number
}

export interface DataSource {
  /** Master data - stable across filter changes. */
  listRegions(): Region[]
  listFacilities(): Facility[]
  listLocations(): StorageLocation[]
  listParkAndPay(): ParkAndPaySite[]

  /** The one call every screen makes. */
  getSnapshot(filters: FilterState): ControlTowerSnapshot

  /** Location-level detail, paged so a 5,000 row extract never lands at once. */
  queryLocations(request: LocationQuery): LocationQueryResult

  /** Depositor occupancy by location and temperature zone. */
  queryCustomerUtilization(request: CustomerQuery): CustomerUtilizationResult

  /** Week-ending utilization by region and location, with movement. */
  queryWeeklyComparison(request: WeeklyQuery): WeeklyComparison
}

export interface LocationQuery {
  filters: FilterState
  search?: string
  page: number
  pageSize: number
  sortBy?: 'facility' | 'utilization' | 'capacity' | 'occupied' | 'available'
  sortDir?: 'asc' | 'desc'
}

export interface LocationRow {
  id: string
  regionId: string
  facilityCode: string
  facilityName: string
  chamber: string
  label: string
  zoneId: string
  zoneName: string
  capacity: number | null
  utilizedPallets: number
  availableCapacity: number | null
  utilizationPct: number | null
  status: string
}

export interface LocationQueryResult {
  rows: LocationRow[]
  total: number
  page: number
  pageSize: number
}
