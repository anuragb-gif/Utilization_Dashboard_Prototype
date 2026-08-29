/**
 * Network Health Score.
 *
 * A weighted composite, not a decoration. Each component is a 0-100 sub-score
 * computed from a metric that is displayed elsewhere in the application, with
 * the weights declared here so the score can be explained - and argued with -
 * by the business rather than treated as a black box.
 */

import type { CapacityRollup, FacilityRollup, HealthScore, HealthScoreComponent, StatusLevel } from './types'
import { THRESHOLDS } from '@/lib/config/thresholds'
import { clamp, formatNumber, formatPct, formatPp } from '@/lib/utils'
import { COLD_CHAIN_SUMMARY } from '@/lib/data/coldchain'
import { AGEING_BUCKETS, NEAR_EXPIRY_PALLETS } from '@/lib/data/inventory'
import { DATA_QUALITY_REPORT } from '@/lib/data/dataquality'

export interface HealthScoreWeights {
  utilizationVsTarget: number
  overCapacityExposure: number
  utilizationTrend: number
  forecastRisk: number
  inventoryMovement: number
  temperatureCompliance: number
  expiryRisk: number
  dataFreshness: number
}

/** Configurable. Surfaced on the Settings screen. */
export const HEALTH_WEIGHTS: HealthScoreWeights = {
  utilizationVsTarget: 20,
  overCapacityExposure: 20,
  utilizationTrend: 10,
  forecastRisk: 15,
  inventoryMovement: 10,
  temperatureCompliance: 10,
  expiryRisk: 10,
  dataFreshness: 5,
}

function bandFor(score: number): StatusLevel {
  if (score >= 85) return 'healthy'
  if (score >= 70) return 'watch'
  if (score >= 55) return 'high'
  return 'critical'
}

/** Score how close utilization sits to target; both under and over cost points. */
function utilizationScore(actual: number | null, target: number): number {
  if (actual === null) return 50
  const gap = actual - target
  // Running a little under target is a commercial miss; running over is an
  // operational failure, so the penalty is asymmetric.
  const penalty = gap >= 0 ? gap * 4.5 : Math.abs(gap) * 2.2
  return clamp(100 - penalty, 0, 100)
}

export function buildHealthScore(network: CapacityRollup, facilities: FacilityRollup[], change7dPp: number | null): HealthScore {
  const capacity = network.capacity ?? 0
  const overExposure = capacity === 0 ? 0 : (network.overCapacityPallets / capacity) * 100
  const breachRisk = facilities.filter(
    (f) => f.forecast30dPct !== null && f.forecast30dPct >= THRESHOLDS.breachThresholdPct,
  ).length
  const ageingPallets = AGEING_BUCKETS.find((b) => b.id === 'age-60-plus')?.palletCount ?? 0
  const ageingShare = network.utilizedPallets === 0 ? 0 : (ageingPallets / network.utilizedPallets) * 100

  const components: HealthScoreComponent[] = [
    {
      id: 'utilizationVsTarget',
      label: 'Utilization vs target',
      score: utilizationScore(network.utilizationPct, THRESHOLDS.networkTargetPct),
      weight: HEALTH_WEIGHTS.utilizationVsTarget,
      detail: `Network at ${formatPct(network.utilizationPct)} against a ${THRESHOLDS.networkTargetPct}% budget. Running over target is penalised more heavily than running under.`,
      status: network.utilizationPct === null ? 'unknown' : network.utilizationPct > 100 ? 'critical' : 'healthy',
    },
    {
      id: 'overCapacityExposure',
      label: 'Over-capacity exposure',
      // Every 1% of network capacity held above the master costs 25 points.
      score: clamp(100 - overExposure * 25, 0, 100),
      weight: HEALTH_WEIGHTS.overCapacityExposure,
      detail: `${formatNumber(network.overCapacityPallets)} pallets held above the capacity master (${formatPct(overExposure)} of network capacity).`,
      status: network.overCapacityPallets > 0 ? 'critical' : 'healthy',
    },
    {
      id: 'utilizationTrend',
      label: 'Utilization trend (7 day)',
      score: change7dPp === null ? 50 : clamp(100 - Math.abs(change7dPp) * 8, 0, 100),
      weight: HEALTH_WEIGHTS.utilizationTrend,
      detail: `Network utilization has moved ${formatPp(change7dPp)} over 7 days. Movement in either direction at pace reduces the score.`,
      status: change7dPp === null ? 'unknown' : Math.abs(change7dPp) > 4 ? 'watch' : 'healthy',
    },
    {
      id: 'forecastRisk',
      label: 'Capacity forecast risk',
      score: clamp(100 - breachRisk * 11, 0, 100),
      weight: HEALTH_WEIGHTS.forecastRisk,
      detail: `${breachRisk} facilities are projected above ${THRESHOLDS.breachThresholdPct}% within 30 days on the prototype forecast.`,
      status: breachRisk === 0 ? 'healthy' : breachRisk > 5 ? 'critical' : 'watch',
    },
    {
      id: 'inventoryMovement',
      label: 'Inventory movement',
      score: clamp(100 - Math.max(0, ageingShare - 5) * 7, 0, 100),
      weight: HEALTH_WEIGHTS.inventoryMovement,
      detail: `${formatPct(ageingShare, 1)} of occupied pallets have been in storage more than ${THRESHOLDS.ageingDays} days.`,
      status: ageingShare > 10 ? 'watch' : 'healthy',
    },
    {
      id: 'temperatureCompliance',
      label: 'Temperature compliance',
      score: clamp(100 - (100 - COLD_CHAIN_SUMMARY.temperatureCompliancePct) * 28, 0, 100),
      weight: HEALTH_WEIGHTS.temperatureCompliance,
      detail: `${formatPct(COLD_CHAIN_SUMMARY.temperatureCompliancePct)} of chamber readings inside the set-point band, with ${COLD_CHAIN_SUMMARY.criticalExcursions24h} critical excursions in the last 24 hours.`,
      status:
        COLD_CHAIN_SUMMARY.temperatureCompliancePct < THRESHOLDS.temperatureCompliancePct ? 'critical' : 'healthy',
    },
    {
      id: 'expiryRisk',
      label: 'Expiry / FEFO risk',
      score: clamp(
        100 -
          Math.max(0, THRESHOLDS.fefoCompliancePct - COLD_CHAIN_SUMMARY.fefoCompliancePct) * 22 -
          (NEAR_EXPIRY_PALLETS / 100) * 1.4,
        0,
        100,
      ),
      weight: HEALTH_WEIGHTS.expiryRisk,
      detail: `FEFO compliance ${formatPct(COLD_CHAIN_SUMMARY.fefoCompliancePct)} against a ${THRESHOLDS.fefoCompliancePct}% floor, with ${formatNumber(NEAR_EXPIRY_PALLETS)} pallets inside the ${THRESHOLDS.nearExpiryDays}-day expiry window.`,
      status: COLD_CHAIN_SUMMARY.fefoCompliancePct < THRESHOLDS.fefoCompliancePct ? 'watch' : 'healthy',
    },
    {
      id: 'dataFreshness',
      label: 'Data freshness & quality',
      score: clamp(DATA_QUALITY_REPORT.healthScorePct, 0, 100),
      weight: HEALTH_WEIGHTS.dataFreshness,
      detail: `Load completed ${DATA_QUALITY_REPORT.lastRefreshAt.slice(11, 16)} IST with a ${formatPct(DATA_QUALITY_REPORT.healthScorePct, 1)} clean-record rate and ${DATA_QUALITY_REPORT.issues.length} open warnings.`,
      status: DATA_QUALITY_REPORT.healthScorePct < THRESHOLDS.dataQualityPct ? 'watch' : 'healthy',
    },
  ]

  const totalWeight = components.reduce((sum, c) => sum + c.weight, 0)
  const weighted = components.reduce((sum, c) => sum + c.score * c.weight, 0)
  const score = totalWeight === 0 ? 0 : Math.round(weighted / totalWeight)

  return { score, band: bandFor(score), components }
}
