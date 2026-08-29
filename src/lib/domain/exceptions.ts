/**
 * Exception engine.
 *
 * Every exception the control tower raises is generated here from the same
 * rollups the screens render, so an exception can always be traced back to a
 * number the user can see. Nothing is hard-coded per screen.
 */

import type {
  ExceptionCategory,
  ExceptionRecord,
  FacilityRollup,
  Severity,
} from './types'
import { REASONS } from './rollups'
import { THRESHOLDS } from '@/lib/config/thresholds'
import { SEVERITY_RANK } from '@/lib/config/thresholds'
import { FACILITY_BY_ID, REGION_BY_ID } from '@/lib/data/master'
import { FEFO_BREACHES, TEMPERATURE_EXCURSIONS } from '@/lib/data/coldchain'
import { DATA_QUALITY_ISSUES } from '@/lib/data/dataquality'
import { DOCK_BY_FACILITY } from '@/lib/data/operations'
import { LAST_REFRESH_AT, REPORT_DATE } from '@/lib/data/seed'
import { KPI_DEFINITIONS } from '@/lib/config/kpi-definitions'

const RECOMMENDED_ACTION: Record<string, string> = {
  [REASONS.overCapacity]:
    'Review overflow stock against the capacity master, release aged pallets for despatch, and open a temporary overflow booking at the nearest facility with headroom.',
  [REASONS.rapidIncrease]:
    'Confirm the inbound plan with the depositor, check for an unbooked receipt, and pre-position outbound slots before the facility runs out of headroom.',
  [REASONS.forecastRisk]:
    'Reserve overflow capacity now and agree a despatch acceleration with the depositor before the projected breach date.',
  [REASONS.underUtilized]:
    'Review the commercial plan for this facility: re-allocate depositor volume, or take the surplus racking off the sellable capacity master.',
  [REASONS.temperature]:
    'Escalate to the site engineer, quarantine affected pallets, and complete a product-integrity assessment before release.',
  [REASONS.ageing]:
    'Re-sequence picking to FEFO, and issue a short-code disposition request to the depositor for stock inside the near-expiry window.',
  [REASONS.deterioration]:
    'Review the depositor mix and outbound plan; a sustained decline of this size usually indicates volume moving to another provider.',
  [REASONS.aboveThreshold]:
    'Plan overflow now: confirm inbound bookings for the next 7 days and identify the nearest facility with available capacity.',
  [REASONS.emptyConcentration]:
    'Assess whether this is seasonal slack or structural over-capacity before it is reported as idle capacity.',
  [REASONS.dataQuality]:
    'Raise a capacity master request with IT / Data Admin. Until it is loaded this facility cannot be included in network utilization.',
}

const CATEGORY_FOR_REASON: Record<string, ExceptionCategory> = {
  [REASONS.overCapacity]: 'CAPACITY',
  [REASONS.rapidIncrease]: 'CAPACITY',
  [REASONS.forecastRisk]: 'CAPACITY',
  [REASONS.underUtilized]: 'CAPACITY',
  [REASONS.temperature]: 'TEMPERATURE',
  [REASONS.ageing]: 'INVENTORY',
  [REASONS.deterioration]: 'OPERATIONS',
  [REASONS.aboveThreshold]: 'CAPACITY',
  [REASONS.emptyConcentration]: 'CAPACITY',
  [REASONS.dataQuality]: 'DATA_QUALITY',
}

function capacityException(facility: FacilityRollup): ExceptionRecord | null {
  if (!facility.primaryReason) return null
  const reason = facility.primaryReason
  const category = CATEGORY_FOR_REASON[reason] ?? 'OPERATIONS'

  // A facility flagged because of a temperature excursion or a FEFO breach
  // already has a precise exception raised by the dedicated builders below,
  // carrying the actual measurement and threshold. Emitting a second record
  // here would restate it against the utilization metric - which is not what
  // fired - and double-count it in every severity total.
  if (category === 'TEMPERATURE' || category === 'INVENTORY') return null

  // Each reason is measured against the threshold that actually triggered it.
  let actual: number | null = facility.utilizationPct
  let threshold: number | null = 100
  let unit = '%'
  let metricId = KPI_DEFINITIONS.networkUtilization.id
  let metricLabel = 'Utilization'

  if (reason === REASONS.rapidIncrease) {
    actual = facility.change7dPct
    threshold = THRESHOLDS.rapidIncreasePp
    unit = 'pp / 7d'
    metricLabel = '7-day utilization change'
  } else if (reason === REASONS.deterioration) {
    actual = facility.change7dPct
    threshold = THRESHOLDS.rapidDeclinePp
    unit = 'pp / 7d'
    metricLabel = '7-day utilization change'
  } else if (reason === REASONS.forecastRisk) {
    actual = facility.forecast30dPct
    threshold = THRESHOLDS.breachThresholdPct
    metricId = KPI_DEFINITIONS.forecastUtilization.id
    metricLabel = '30-day forecast utilization'
  } else if (reason === REASONS.underUtilized || reason === REASONS.emptyConcentration) {
    threshold = THRESHOLDS.underUtilizedPct
    metricLabel = 'Utilization'
  } else if (reason === REASONS.aboveThreshold) {
    threshold = THRESHOLDS.breachThresholdPct
  } else if (reason === REASONS.dataQuality) {
    actual = null
    threshold = null
    unit = 'pallets'
    metricId = KPI_DEFINITIONS.totalCapacity.id
    metricLabel = 'Capacity master'
  }

  return {
    id: `EXC-CAP-${facility.facilityId}`,
    category,
    severity: facility.risk,
    raisedAt: LAST_REFRESH_AT,
    regionId: facility.regionId,
    facilityId: facility.facilityId,
    zoneId: null,
    metricId,
    metricLabel,
    actual,
    threshold,
    variance: actual === null || threshold === null ? null : Number((actual - threshold).toFixed(2)),
    unit,
    reason,
    recommendedAction: RECOMMENDED_ACTION[reason] ?? 'Review with the regional head.',
    owner: facility.owner,
    status: 'OPEN',
  }
}

function temperatureExceptions(): ExceptionRecord[] {
  return TEMPERATURE_EXCURSIONS.filter((e) => e.status !== 'CLOSED').map((excursion) => {
    const facility = FACILITY_BY_ID[excursion.facilityId]
    return {
      id: `EXC-TMP-${excursion.id}`,
      category: 'TEMPERATURE' as ExceptionCategory,
      severity: excursion.severity,
      raisedAt: excursion.startedAt,
      regionId: excursion.regionId,
      facilityId: excursion.facilityId,
      zoneId: excursion.zoneId,
      metricId: KPI_DEFINITIONS.temperatureCompliance.id,
      metricLabel: `Peak deviation - ${excursion.chamber}`,
      actual: excursion.peakDeviationC,
      threshold: 0,
      variance: excursion.peakDeviationC,
      unit: '°C',
      reason: `Set-point deviation of ${excursion.peakDeviationC}°C sustained for ${excursion.durationMinutes} minutes across ${excursion.affectedPallets} pallets.`,
      recommendedAction: RECOMMENDED_ACTION[REASONS.temperature],
      owner: facility?.owner ?? 'Regional Head',
      status: excursion.status === 'ACKNOWLEDGED' ? 'ACKNOWLEDGED' : 'OPEN',
    }
  })
}

function inventoryExceptions(): ExceptionRecord[] {
  return FEFO_BREACHES.map((breach) => {
    const facility = FACILITY_BY_ID[breach.facilityId]
    return {
      id: `EXC-INV-${breach.id}`,
      category: 'INVENTORY' as ExceptionCategory,
      severity: breach.pallets >= 40 ? ('high' as Severity) : ('medium' as Severity),
      raisedAt: breach.detectedAt,
      regionId: facility?.regionId ?? null,
      facilityId: breach.facilityId,
      zoneId: null,
      metricId: KPI_DEFINITIONS.fefoCompliance.id,
      metricLabel: 'FEFO compliance',
      actual: breach.pallets,
      threshold: 0,
      variance: breach.pallets,
      unit: 'pallets',
      reason: `${breach.pallets} pallets of ${breach.sku} picked with expiry ${breach.pickedExpiry} while stock expiring ${breach.earlierAvailableExpiry} was available.`,
      recommendedAction: RECOMMENDED_ACTION[REASONS.ageing],
      owner: facility?.owner ?? 'Warehouse Manager',
      status: 'OPEN',
    }
  })
}

function operationsExceptions(facilities: FacilityRollup[]): ExceptionRecord[] {
  const def = KPI_DEFINITIONS.dockToStockMinutes
  return facilities
    .map((facility): ExceptionRecord | null => {
      const dock = DOCK_BY_FACILITY[facility.facilityId]
      if (!dock || dock.dockToStockMinutes === null) return null
      if (def.criticalThreshold === null || dock.dockToStockMinutes < def.criticalThreshold) return null
      return {
        id: `EXC-OPS-${facility.facilityId}`,
        category: 'OPERATIONS' as ExceptionCategory,
        severity: (dock.dockToStockMinutes > (def.criticalThreshold ?? 0) * 1.4 ? 'high' : 'medium') as Severity,
        raisedAt: LAST_REFRESH_AT,
        regionId: facility.regionId,
        facilityId: facility.facilityId,
        zoneId: null,
        metricId: def.id,
        metricLabel: def.name,
        actual: dock.dockToStockMinutes,
        threshold: def.criticalThreshold,
        variance: dock.dockToStockMinutes - (def.criticalThreshold ?? 0),
        unit: 'min',
        reason: `Median dock-to-stock is ${dock.dockToStockMinutes} minutes against a ${def.criticalThreshold} minute critical threshold. Receiving is slowing as the facility fills.`,
        recommendedAction:
          'Add a putaway shift or open a secondary receiving lane; sustained dock-to-stock at this level pushes pallets into staging and inflates apparent occupancy.',
        owner: facility.owner,
        status: 'OPEN' as const,
      }
    })
    .filter((e): e is ExceptionRecord => e !== null)
}

function dataQualityExceptions(): ExceptionRecord[] {
  return DATA_QUALITY_ISSUES.filter((issue) => issue.severity !== 'low').map((issue) => ({
    id: `EXC-DQ-${issue.id}`,
    category: 'DATA_QUALITY' as ExceptionCategory,
    severity: issue.severity,
    raisedAt: LAST_REFRESH_AT,
    regionId: null,
    facilityId: null,
    zoneId: null,
    metricId: KPI_DEFINITIONS.dataQualityScore.id,
    metricLabel: issue.label,
    actual: issue.count,
    threshold: 0,
    variance: issue.count,
    unit: 'records',
    reason: issue.detail,
    recommendedAction:
      'Raise a data correction request with IT / Data Admin. Affected rows stay excluded from the published figures until it is closed.',
    owner: 'IT / Data Admin',
    status: 'OPEN' as const,
  }))
}

export function buildExceptions(facilities: FacilityRollup[]): ExceptionRecord[] {
  const facilityIds = new Set(facilities.map((f) => f.facilityId))
  const all = [
    ...facilities.map(capacityException).filter((e): e is ExceptionRecord => e !== null),
    ...temperatureExceptions().filter((e) => !e.facilityId || facilityIds.has(e.facilityId)),
    ...inventoryExceptions().filter((e) => !e.facilityId || facilityIds.has(e.facilityId)),
    ...operationsExceptions(facilities),
    ...dataQualityExceptions(),
  ]

  // A facility can trigger both a capacity and an operations exception; that
  // is intentional - they have different owners and different actions.
  return all.sort((a, b) => {
    const bySeverity = SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity]
    if (bySeverity !== 0) return bySeverity
    return b.raisedAt.localeCompare(a.raisedAt) || a.id.localeCompare(b.id)
  })
}

export const EXCEPTION_CATEGORY_LABEL: Record<ExceptionCategory, string> = {
  CAPACITY: 'Capacity',
  INVENTORY: 'Inventory',
  TEMPERATURE: 'Temperature',
  OPERATIONS: 'Operations',
  DATA_QUALITY: 'Data Quality',
}

export { REPORT_DATE, REGION_BY_ID }
