/**
 * Management insights.
 *
 * Rule-based, generated from the same rollups the screens render. There is no
 * language model behind this and the UI says so. Each insight carries the
 * `source` that produced it so a reader can check the number themselves.
 */

import type { CapacityRollup, ColdChainSummary, FacilityRollup, Insight, RegionRollup } from './types'
import { THRESHOLDS } from '@/lib/config/thresholds'
import { formatNumber, formatPct, formatPp } from '@/lib/utils'
import { NEAR_EXPIRY_PALLETS } from '@/lib/data/inventory'

export interface InsightInput {
  network: CapacityRollup
  regions: RegionRollup[]
  facilities: FacilityRollup[]
  change7dPp: number | null
  coldChain: ColdChainSummary
}

export function buildInsights({ network, regions, facilities, change7dPp, coldChain }: InsightInput): Insight[] {
  const insights: Insight[] = []

  // 1. Over-capacity regions.
  const over = regions
    .filter((r) => r.utilizationPct !== null && r.utilizationPct > 100)
    .sort((a, b) => (b.utilizationPct ?? 0) - (a.utilizationPct ?? 0))
  for (const region of over) {
    insights.push({
      id: `insight-over-${region.regionId}`,
      severity: 'critical',
      text: `${region.regionId} is above configured capacity by ${formatPct((region.utilizationPct ?? 100) - 100)} - ${formatNumber(region.overCapacityPallets)} pallets across ${region.overCapacityFacilities} ${region.overCapacityFacilities === 1 ? 'facility' : 'facilities'}.`,
      source: 'Region ranking - utilization vs 100% capacity master',
      href: `/regions/${encodeURIComponent(region.regionId)}`,
    })
  }

  // 2. Forecast breach risk.
  const breach = facilities.filter(
    (f) =>
      f.forecast14dPct !== null &&
      f.forecast14dPct >= THRESHOLDS.breachThresholdPct &&
      (f.utilizationPct ?? 0) < THRESHOLDS.breachThresholdPct,
  )
  if (breach.length > 0) {
    insights.push({
      id: 'insight-breach-14d',
      severity: 'high',
      text: `${breach.length} ${breach.length === 1 ? 'facility is' : 'facilities are'} projected to exceed ${THRESHOLDS.breachThresholdPct}% utilization within 14 days: ${breach.slice(0, 3).map((f) => f.code).join(', ')}${breach.length > 3 ? ` and ${breach.length - 3} more` : ''}.`,
      source: 'Capacity risk forecast - prototype forecast, 14-day horizon',
      href: '/capacity',
    })
  }

  // 3. Largest available capacity.
  const withHeadroom = regions
    .filter((r) => r.availableCapacity !== null)
    .sort((a, b) => (b.availableCapacity ?? 0) - (a.availableCapacity ?? 0))
  if (withHeadroom.length > 0) {
    const top = withHeadroom[0]
    insights.push({
      id: 'insight-headroom',
      severity: 'low',
      text: `${top.regionId} holds the largest available capacity in the network at ${formatNumber(top.availableCapacity)} pallet positions (${formatPct(100 - (top.utilizationPct ?? 0))} of its capacity).`,
      source: 'Empty capacity analysis - sum of positive facility headroom',
      href: '/capacity',
    })
  }

  // 4. Network trend.
  if (change7dPp !== null && Math.abs(change7dPp) >= 0.5) {
    const direction = change7dPp < 0 ? 'declined' : 'increased'
    insights.push({
      id: 'insight-trend',
      severity: Math.abs(change7dPp) >= 3 ? 'high' : 'medium',
      text: `Network utilization has ${direction} ${formatPct(Math.abs(change7dPp))} points over the last 7 days, to ${formatPct(network.utilizationPct)} against an ${THRESHOLDS.networkTargetPct}% budget.`,
      source: 'Network utilization trend - report date vs 7 days prior',
      href: '/utilization',
    })
  }

  // 5. Fastest riser.
  const risers = [...facilities]
    .filter((f) => f.change7dPct !== null)
    .sort((a, b) => (b.change7dPct ?? 0) - (a.change7dPct ?? 0))
  if (risers.length > 0 && (risers[0].change7dPct ?? 0) >= THRESHOLDS.rapidIncreasePp) {
    const top = risers[0]
    insights.push({
      id: 'insight-riser',
      severity: 'high',
      text: `${top.code} (${top.name}) has added ${formatPp(top.change7dPct)} of utilization in 7 days to ${formatPct(top.utilizationPct)} - the fastest increase in the network.`,
      source: 'Facility exception board - 7-day utilization change',
      href: `/warehouses/${encodeURIComponent(top.facilityId)}`,
    })
  }

  // 6. Deepest under-utilization.
  const under = [...facilities]
    .filter((f) => f.utilizationPct !== null)
    .sort((a, b) => (a.utilizationPct ?? 0) - (b.utilizationPct ?? 0))
  if (under.length > 0 && (under[0].utilizationPct ?? 100) < THRESHOLDS.underUtilizedPct) {
    const bottom = under[0]
    insights.push({
      id: 'insight-under',
      severity: 'medium',
      text: `${bottom.code} (${bottom.name}) is running at ${formatPct(bottom.utilizationPct)} against a ${bottom.targetPct}% regional budget, leaving ${formatNumber(bottom.availableCapacity)} pallet positions unsold.`,
      source: 'Facility exception board - utilization vs regional budget',
      href: `/warehouses/${encodeURIComponent(bottom.facilityId)}`,
    })
  }

  // 7. Expiry exposure.
  if (NEAR_EXPIRY_PALLETS > 0) {
    insights.push({
      id: 'insight-expiry',
      severity: NEAR_EXPIRY_PALLETS > 1500 ? 'high' : 'medium',
      text: `${formatNumber(NEAR_EXPIRY_PALLETS)} pallets are inside the ${THRESHOLDS.nearExpiryDays}-day expiry window, of which ${formatNumber(coldChain.shortCodedPallets)} are already short-coded.`,
      source: 'Inventory health - expiry buckets 0-30 days',
      href: '/inventory',
    })
  }

  // 8. Cold-chain compliance.
  if (coldChain.criticalExcursions24h > 0) {
    insights.push({
      id: 'insight-temperature',
      severity: 'critical',
      text: `${coldChain.criticalExcursions24h} critical temperature ${coldChain.criticalExcursions24h === 1 ? 'excursion' : 'excursions'} in the last 24 hours, with ${coldChain.openTemperatureAlerts} alerts still open and ${formatNumber(coldChain.quarantinePallets)} pallets in quarantine.`,
      source: 'Cold-chain health - chamber telemetry, last 24 hours',
      href: '/cold-chain',
    })
  }

  // 9. Excluded occupancy.
  if (network.excludedUtilizedPallets > 0) {
    insights.push({
      id: 'insight-excluded',
      severity: 'medium',
      text: `${formatNumber(network.excludedUtilizedPallets)} occupied pallets sit in ${network.facilitiesMissingCapacity} facilities with no capacity master row and are excluded from network utilization.`,
      source: 'Data quality - facilities without a capacity master row',
      href: '/data-quality',
    })
  }

  return insights
}
