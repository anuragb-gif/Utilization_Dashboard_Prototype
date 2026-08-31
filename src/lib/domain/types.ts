/**
 * Domain model for the Pan-India Utilization Control Tower.
 *
 * Everything the UI renders is described here. The mock data layer
 * (src/lib/data) produces these shapes and the repository layer
 * (src/lib/repository) serves them, so swapping mock -> API is a change of
 * one module rather than a rewrite of the screens.
 *
 * Nullability is deliberate: `null` means "the source system did not supply
 * this value" and MUST be rendered as N/A / Missing, never coerced to 0.
 */

export type RegionId = 'EAST' | 'WEST-1' | 'WEST-2' | 'NORTH' | 'SOUTH-1' | 'SOUTH-2'

export type TemperatureZoneId = 'FROZEN' | 'CHILLED' | 'CONTROLLED_AMBIENT' | 'AMBIENT'

export type FacilityType = 'DISTRIBUTION_CENTRE' | 'FORWARD_COLD_DEPOT' | 'CROSS_DOCK' | 'PARK_AND_PAY'

/** Commercial/ownership model of the facility. */
export type OwnershipModel = 'OWNED' | 'LEASED' | 'DEDICATED'

/** Snowman "execution" grouping used by the legacy daily report. */
export type ExecutionId = 'SNOWMAN_OWN' | 'PARTNER_OPERATED' | 'CUSTOMER_DEDICATED'

/** Traffic-light semantics used across the whole application. */
export type StatusLevel = 'healthy' | 'watch' | 'high' | 'critical' | 'info' | 'unknown'

export type Severity = 'critical' | 'high' | 'medium' | 'low'

export type TrendDirection = 'up' | 'down' | 'flat'

// ---------------------------------------------------------------------------
// Master data
// ---------------------------------------------------------------------------

export interface Region {
  id: RegionId
  name: string
  /** Approximate centroid used to place the region bubble on the India map. */
  lat: number
  lng: number
  head: string
}

export interface City {
  id: string
  name: string
  state: string
  regionId: RegionId
  lat: number
  lng: number
}

export interface Facility {
  id: string
  /** Short operational code, e.g. SNL-BOM-04. */
  code: string
  name: string
  regionId: RegionId
  cityId: string
  type: FacilityType
  ownership: OwnershipModel
  execution: ExecutionId
  /** Facility manager accountable for exceptions raised here. */
  owner: string
  commissionedOn: string
  /**
   * Pallet positions from the capacity master.
   * `null` = facility exists in the movement feed but has no capacity master
   * row. Utilization is NOT computable for these and must show as N/A.
   */
  capacity: number | null
  /** Occupied pallet positions on the report date. */
  utilizedPallets: number
  /** Per-temperature-zone split. Sums to the facility totals. */
  zones: FacilityZone[]
}

export interface FacilityZone {
  zoneId: TemperatureZoneId
  capacity: number | null
  utilizedPallets: number
  /** Set-point band, purely descriptive. */
  setPoint: string
  /** Share of readings inside the set-point band over the last 24h. */
  temperatureCompliancePct: number | null
}

export interface StorageLocation {
  id: string
  facilityId: string
  regionId: RegionId
  zoneId: TemperatureZoneId
  /** Chamber the location sits in, e.g. "CH-02". */
  chamber: string
  /** Human label, e.g. "A-12-03". */
  label: string
  capacity: number | null
  utilizedPallets: number
  /** Flags a location that appears more than once in the source extract. */
  duplicateOf?: string
}

export interface Customer {
  id: string
  name: string
  sector: string
  /** Occupied pallet positions across the network. */
  occupiedPallets: number
  /** Change in occupied pallets over the last 7 days. */
  change7d: number
  regionIds: RegionId[]
  facilityCount: number
  /**
   * Monthly storage revenue in INR lakh.
   * `null` where the depositor is billed through a contract the reporting
   * feed does not expose.
   */
  monthlyRevenueInrLakh: number | null
}

// ---------------------------------------------------------------------------
// Time series
// ---------------------------------------------------------------------------

export interface UtilizationPoint {
  /** ISO date (yyyy-MM-dd). */
  date: string
  capacity: number
  utilizedPallets: number
  /** Budgeted utilization percentage for the day. */
  budgetPct: number
  /** Actual utilization percentage for the same calendar day last year. */
  lastYearPct: number | null
  /** True for dates after the report date. */
  isForecast: boolean
}

export interface ZoneTrendPoint {
  date: string
  frozen: number
  chilled: number
  controlledAmbient: number
  ambient: number
}

export interface PalletFlowPoint {
  date: string
  openingPallets: number
  inbound: number
  putaway: number
  outbound: number
  closingPallets: number
  /** Legacy metric carried forward from the Power BI report. */
  dpr: number
}

// ---------------------------------------------------------------------------
// Cold chain, inventory, operations
// ---------------------------------------------------------------------------

export interface TemperatureExcursion {
  id: string
  facilityId: string
  regionId: RegionId
  zoneId: TemperatureZoneId
  chamber: string
  startedAt: string
  durationMinutes: number
  peakDeviationC: number
  severity: Severity
  status: 'OPEN' | 'ACKNOWLEDGED' | 'CLOSED'
  affectedPallets: number
}

export interface ColdChainSummary {
  temperatureCompliancePct: number
  excursions24h: number
  criticalExcursions24h: number
  avgExcursionDurationMinutes: number
  openTemperatureAlerts: number
  quarantinePallets: number
  fefoCompliancePct: number
  nearExpiryPallets: number
  shortCodedPallets: number
}

export interface AgeingBucket {
  id: string
  label: string
  palletCount: number
  /** Estimated inventory value in INR lakh; null when valuation is absent. */
  valueInrLakh: number | null
}

export interface ExpiryBucket {
  id: string
  label: string
  palletCount: number
  valueInrLakh: number | null
  severity: Severity
}

export interface InventoryConcentration {
  facilityId: string
  regionId: RegionId
  bucketId: string
  palletCount: number
}

// ---------------------------------------------------------------------------
// Exceptions
// ---------------------------------------------------------------------------

export type ExceptionCategory = 'CAPACITY' | 'INVENTORY' | 'TEMPERATURE' | 'OPERATIONS' | 'DATA_QUALITY'

export type ExceptionStatus = 'OPEN' | 'ACKNOWLEDGED' | 'ASSIGNED' | 'RESOLVED'

export interface ExceptionRecord {
  id: string
  category: ExceptionCategory
  severity: Severity
  raisedAt: string
  regionId: RegionId | null
  facilityId: string | null
  zoneId: TemperatureZoneId | null
  metricId: string
  metricLabel: string
  /** null when the underlying value could not be computed. */
  actual: number | null
  threshold: number | null
  /** actual - threshold, in the metric's unit. */
  variance: number | null
  unit: string
  reason: string
  recommendedAction: string
  owner: string
  status: ExceptionStatus
  /** Set when the exception was raised against a Park & Pay location. */
  parkAndPaySiteId?: string
}

// ---------------------------------------------------------------------------
// Data quality
// ---------------------------------------------------------------------------

export interface DataQualityIssue {
  id: string
  severity: Severity
  label: string
  count: number
  detail: string
  /** Overrides the generic remediation text when this issue needs its own. */
  action?: string
  /** Entities affected, used for the drill-in list. */
  affected: string[]
}

export interface DataQualityReport {
  lastRefreshAt: string
  lastSuccessfulRefreshAt: string
  sourceSystems: { name: string; status: 'OK' | 'DEGRADED' | 'FAILED'; lastLoadAt: string; records: number }[]
  recordsProcessed: number
  recordsRejected: number
  healthScorePct: number
  issues: DataQualityIssue[]
}

// ---------------------------------------------------------------------------
// Derived / computed view models
// ---------------------------------------------------------------------------

export interface CapacityRollup {
  capacity: number | null
  /** Occupied pallets across members that HAVE a capacity master row. */
  utilizedPallets: number
  /**
   * Occupied pallets on members with no capacity master row. These are held
   * out of the utilization denominator on purpose and reported to the user
   * rather than folded in silently.
   */
  excludedUtilizedPallets: number
  /** max(capacity - utilized, 0) summed over members - true free headroom. */
  availableCapacity: number | null
  /** max(utilized - capacity, 0) summed over members. */
  overCapacityPallets: number
  /** capacity - utilized (may be negative). Matches the legacy "empty pallets". */
  netEmptyPallets: number | null
  utilizationPct: number | null
  /** Members that had no capacity master row and were excluded. */
  facilitiesMissingCapacity: number
}

export interface RegionRollup extends CapacityRollup {
  regionId: RegionId
  regionName: string
  targetPct: number
  variancePct: number | null
  change7dPct: number | null
  /** 30-day movement in percentage points. */
  change30dPct: number | null
  /** Utilization 30 days ago, for before/after comparisons. */
  utilizationPct30dAgo: number | null
  forecast30dPct: number | null
  status: StatusLevel
  risk: Severity
  facilityCount: number
  overCapacityFacilities: number
}

export interface FacilityRollup extends CapacityRollup {
  facilityId: string
  code: string
  name: string
  regionId: RegionId
  cityId: string
  cityName: string
  type: FacilityType
  ownership: OwnershipModel
  execution: ExecutionId
  owner: string
  targetPct: number
  variancePct: number | null
  change7dPct: number | null
  /** 30-day movement in percentage points - a direction rather than noise. */
  change30dPct: number | null
  /** Utilization 30 days ago, for before/after comparisons. */
  utilizationPct30dAgo: number | null
  forecast7dPct: number | null
  forecast14dPct: number | null
  forecast30dPct: number | null
  /** First forecast date where utilization is projected above the breach threshold. */
  expectedBreachDate: string | null
  status: StatusLevel
  risk: Severity
  /** 14-point sparkline of utilization %. */
  spark: number[]
  primaryReason: string | null
}

export interface ZoneRollup extends CapacityRollup {
  zoneId: TemperatureZoneId
  zoneName: string
  setPoint: string
  temperatureCompliancePct: number | null
  change7dPct: number | null
  status: StatusLevel
}

export interface HealthScoreComponent {
  id: string
  label: string
  /** 0-100 sub-score. */
  score: number
  weight: number
  detail: string
  status: StatusLevel
}

export interface HealthScore {
  score: number
  band: StatusLevel
  components: HealthScoreComponent[]
}

export interface Insight {
  id: string
  severity: Severity
  text: string
  /** Where the numbers in `text` came from, so every insight is traceable. */
  source: string
  href?: string
}

// ---------------------------------------------------------------------------
// Filters
// ---------------------------------------------------------------------------

export interface FilterState {
  date: string
  regionIds: RegionId[]
  facilityIds: string[]
  zoneIds: TemperatureZoneId[]
  customerIds: string[]
  facilityTypes: FacilityType[]
  ownerships: OwnershipModel[]
  executions: ExecutionId[]
  comparison: ComparisonPeriod
}

export interface ParkAndPaySite {
  id: string
  /** Legacy location code, as published in the Park & Pay grid. */
  code: string
  /** Location name, as published. */
  name: string
  regionId: RegionId
  /** Null where the site is a third-party location with no city master row. */
  cityId: string | null
  /** Rented pallet positions - directly comparable with own capacity. */
  capacity: number
  utilizedPallets: number
  partner: string
  contractEndsOn: string
  /** Daily occupied pallets across the operational window, oldest first. */
  daily: { date: string; utilizedPallets: number }[]
  /**
   * True where the feed publishes a flat, exactly-full figure - contracted
   * space reported as occupied. Recorded so the reader can discount it, not
   * so the figure can be silently corrected.
   */
  reportsContractedAsOccupied: boolean
}

/**
 * Which book a figure is measured on.
 *
 * OWN is the default everywhere: it is what the legacy report publishes as the
 * headline and what the network has always been managed against. The other two
 * are offered alongside it, never in place of it.
 */
export type BasisId = 'OWN' | 'COMBINED' | 'PNP'

export interface BasisRollup extends CapacityRollup {
  basis: BasisId
  siteCount: number
}

/** Own, Park & Pay and combined side by side, plus what P&P contributes. */
export interface BasisComparison {
  own: BasisRollup
  parkAndPay: BasisRollup
  combined: BasisRollup
  /**
   * Effect of including Park & Pay on the utilization percentage, in
   * percentage points. Null when either side is not computable.
   */
  utilizationImpactPp: number | null
  /** Park & Pay capacity as a share of combined capacity. */
  capacitySharePct: number | null
  /** Park & Pay occupied pallets as a share of combined occupancy. */
  occupancySharePct: number | null
}

export type ComparisonPeriod = 'PREV_DAY' | 'PREV_WEEK' | 'PREV_MONTH' | 'SAME_PERIOD_LAST_YEAR' | 'BUDGET'
