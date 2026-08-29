/**
 * Central KPI dictionary.
 *
 * Every number the control tower shows is defined once, here, with its
 * formula, owner and thresholds. Components look a KPI up by id and render
 * `name` / `unit` / `description` from this registry - no formula or target
 * is allowed to live inside a visual component.
 *
 * The Settings screen renders this registry as the "semantic layer" that a
 * future API would be generated from.
 */

import { THRESHOLDS } from './thresholds'

export type KpiUnit = 'percent' | 'pallets' | 'count' | 'minutes' | 'hours' | 'inr_lakh' | 'score'

export type RefreshFrequency = 'DAILY_0545' | 'HOURLY' | 'FIFTEEN_MIN' | 'ON_DEMAND'

export interface KpiDefinition {
  id: string
  name: string
  description: string
  unit: KpiUnit
  formula: string
  /** Target value in the KPI's unit; null where no target is agreed. */
  target: number | null
  /** Crossing this value raises a medium-severity exception. */
  warningThreshold: number | null
  /** Crossing this value raises a critical exception. */
  criticalThreshold: number | null
  /** Higher is better, lower is better, or a band is best. */
  direction: 'higher_is_better' | 'lower_is_better' | 'band'
  source: string
  owner: string
  refreshFrequency: RefreshFrequency
  /** Set where the definition still has to be confirmed with the business. */
  definitionPending?: string
}

export const KPI_DEFINITIONS: Record<string, KpiDefinition> = {
  networkUtilization: {
    id: 'networkUtilization',
    name: 'Network Utilization',
    description: 'Occupied pallet positions as a share of the total capacity master across all in-scope facilities.',
    unit: 'percent',
    formula: 'utilizedPallets / totalCapacity * 100',
    target: THRESHOLDS.networkTargetPct,
    warningThreshold: 90,
    criticalThreshold: 100,
    direction: 'band',
    source: 'WMS - daily stock snapshot',
    owner: 'National Operations',
    refreshFrequency: 'DAILY_0545',
  },
  totalCapacity: {
    id: 'totalCapacity',
    name: 'Total Capacity',
    description: 'Rackable pallet positions from the capacity master. Facilities without a capacity master row are excluded and reported separately.',
    unit: 'pallets',
    formula: 'sum(facility.capacity) where capacity is not null',
    target: null,
    warningThreshold: null,
    criticalThreshold: null,
    direction: 'higher_is_better',
    source: 'Capacity master (WMS)',
    owner: 'IT / Data Admin',
    refreshFrequency: 'ON_DEMAND',
  },
  utilizedPallets: {
    id: 'utilizedPallets',
    name: 'Utilized Pallets',
    description: 'Pallet positions occupied at the close of the reporting day.',
    unit: 'pallets',
    formula: 'sum(facility.utilizedPallets)',
    target: null,
    warningThreshold: null,
    criticalThreshold: null,
    direction: 'band',
    source: 'WMS - daily stock snapshot',
    owner: 'National Operations',
    refreshFrequency: 'DAILY_0545',
  },
  availableCapacity: {
    id: 'availableCapacity',
    name: 'Available Capacity',
    description: 'True sellable headroom: positive free positions summed facility by facility, so a facility that is over capacity cannot mask headroom elsewhere.',
    unit: 'pallets',
    formula: 'sum(max(facility.capacity - facility.utilizedPallets, 0))',
    target: null,
    warningThreshold: null,
    criticalThreshold: null,
    direction: 'band',
    source: 'Derived',
    owner: 'National Operations',
    refreshFrequency: 'DAILY_0545',
  },
  netEmptyPallets: {
    id: 'netEmptyPallets',
    name: 'Empty Pallets (net)',
    description: 'Capacity minus occupied at network level. This is the figure the legacy daily report publishes; it nets off over-capacity pallets and is therefore lower than true available headroom.',
    unit: 'pallets',
    formula: 'totalCapacity - utilizedPallets',
    target: null,
    warningThreshold: null,
    criticalThreshold: null,
    direction: 'band',
    source: 'Derived (legacy definition)',
    owner: 'National Operations',
    refreshFrequency: 'DAILY_0545',
  },
  overCapacityPallets: {
    id: 'overCapacityPallets',
    name: 'Over-Capacity Pallets',
    description: 'Pallets held above the capacity master, summed facility by facility. Any non-zero value is an operational exception.',
    unit: 'pallets',
    formula: 'sum(max(facility.utilizedPallets - facility.capacity, 0))',
    target: 0,
    warningThreshold: 1,
    criticalThreshold: 1,
    direction: 'lower_is_better',
    source: 'Derived',
    owner: 'Regional Head',
    refreshFrequency: 'DAILY_0545',
  },
  forecastUtilization: {
    id: 'forecastUtilization',
    name: 'Forecast Utilization',
    description: 'Projected utilization produced by a deterministic trend-and-seasonality extrapolation of the last 30 days. Prototype forecast - not a trained model.',
    unit: 'percent',
    formula: 'lastValue + slope(last 14d) * horizon + weekdayIndex(horizon)',
    target: THRESHOLDS.networkTargetPct,
    warningThreshold: THRESHOLDS.breachThresholdPct,
    criticalThreshold: 100,
    direction: 'band',
    source: 'Derived (prototype forecast)',
    owner: 'Analyst',
    refreshFrequency: 'DAILY_0545',
  },
  networkHealthScore: {
    id: 'networkHealthScore',
    name: 'Network Health Score',
    description: 'Weighted composite of utilization against target, over-capacity exposure, trend, forecast risk, inventory movement, temperature compliance, expiry risk and data freshness.',
    unit: 'score',
    formula: 'sum(component.score * component.weight) / sum(component.weight)',
    target: 90,
    warningThreshold: 75,
    criticalThreshold: 60,
    direction: 'higher_is_better',
    source: 'Derived',
    owner: 'LT / Executive',
    refreshFrequency: 'DAILY_0545',
  },
  temperatureCompliance: {
    id: 'temperatureCompliance',
    name: 'Temperature Compliance',
    description: 'Share of chamber readings inside the contracted set-point band over the last 24 hours.',
    unit: 'percent',
    formula: 'readingsInBand / totalReadings * 100',
    target: 99.5,
    warningThreshold: THRESHOLDS.temperatureCompliancePct,
    criticalThreshold: 98,
    direction: 'higher_is_better',
    source: 'Chamber telemetry (prototype data)',
    owner: 'Quality',
    refreshFrequency: 'FIFTEEN_MIN',
  },
  fefoCompliance: {
    id: 'fefoCompliance',
    name: 'FEFO Compliance',
    description: 'Share of outbound picks that took the first-expiring pallet available for the SKU and depositor.',
    unit: 'percent',
    formula: 'compliantPicks / totalPicks * 100',
    target: 99,
    warningThreshold: THRESHOLDS.fefoCompliancePct,
    criticalThreshold: 96,
    direction: 'higher_is_better',
    source: 'WMS - pick confirmations',
    owner: 'Warehouse Manager',
    refreshFrequency: 'DAILY_0545',
  },
  nearExpiryPallets: {
    id: 'nearExpiryPallets',
    name: 'Near-Expiry Pallets',
    description: `Pallets whose earliest expiry falls inside the next ${THRESHOLDS.nearExpiryDays} days.`,
    unit: 'pallets',
    formula: `count(pallets where daysToExpiry <= ${THRESHOLDS.nearExpiryDays})`,
    target: 0,
    warningThreshold: 100,
    criticalThreshold: 250,
    direction: 'lower_is_better',
    source: 'WMS - lot master',
    owner: 'Warehouse Manager',
    refreshFrequency: 'DAILY_0545',
  },
  dpr: {
    id: 'dpr',
    name: 'DPR',
    description: 'Carried forward unchanged from the legacy daily report.',
    unit: 'count',
    formula: 'Not mapped',
    target: null,
    warningThreshold: null,
    criticalThreshold: null,
    direction: 'band',
    source: 'Legacy daily report',
    owner: 'IT / Data Admin',
    refreshFrequency: 'DAILY_0545',
    definitionPending: 'Definition to be mapped from Snowman source system.',
  },
  dockToStockMinutes: {
    id: 'dockToStockMinutes',
    name: 'Dock-to-Stock',
    description: 'Elapsed time from vehicle gate-in to pallet confirmed in a storage location.',
    unit: 'minutes',
    formula: 'median(putawayConfirmedAt - gateInAt)',
    target: 120,
    warningThreshold: 150,
    criticalThreshold: 180,
    direction: 'lower_is_better',
    source: 'WMS - receipt events',
    owner: 'Warehouse Manager',
    refreshFrequency: 'HOURLY',
  },
  stagingDwellMinutes: {
    id: 'stagingDwellMinutes',
    name: 'Staging Dwell',
    description: 'Time inbound pallets sit in the staging lane before putaway.',
    unit: 'minutes',
    formula: 'median(putawayStartedAt - unloadCompletedAt)',
    target: 45,
    warningThreshold: 60,
    criticalThreshold: 90,
    direction: 'lower_is_better',
    source: 'WMS - receipt events',
    owner: 'Warehouse Manager',
    refreshFrequency: 'HOURLY',
  },
  dispatchDwellMinutes: {
    id: 'dispatchDwellMinutes',
    name: 'Dispatch Dwell',
    description: 'Time picked pallets wait at the dispatch dock before vehicle gate-out.',
    unit: 'minutes',
    formula: 'median(gateOutAt - pickCompletedAt)',
    target: 60,
    warningThreshold: 90,
    criticalThreshold: 120,
    direction: 'lower_is_better',
    source: 'WMS - dispatch events',
    owner: 'Warehouse Manager',
    refreshFrequency: 'HOURLY',
  },
  dataQualityScore: {
    id: 'dataQualityScore',
    name: 'Data Quality Score',
    description: 'Share of source records that loaded without rejection, missing mapping or duplication.',
    unit: 'percent',
    formula: '(recordsProcessed - recordsRejected - recordsWithIssues) / recordsProcessed * 100',
    target: 99.5,
    warningThreshold: THRESHOLDS.dataQualityPct,
    criticalThreshold: 95,
    direction: 'higher_is_better',
    source: 'ETL run log',
    owner: 'IT / Data Admin',
    refreshFrequency: 'DAILY_0545',
  },
}

export function kpi(id: keyof typeof KPI_DEFINITIONS | string): KpiDefinition {
  const found = KPI_DEFINITIONS[id]
  if (!found) throw new Error(`Unknown KPI id: ${id}`)
  return found
}

export const KPI_LIST = Object.values(KPI_DEFINITIONS)
