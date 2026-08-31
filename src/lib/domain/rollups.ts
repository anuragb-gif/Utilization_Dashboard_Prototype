/**
 * Rollup builders.
 *
 * These turn master data + series into the view models the screens render.
 * They are pure functions of a facility set, which is what makes the filter
 * bar work uniformly on every screen: filter the facilities, rebuild.
 */

import type {
  Facility,
  FacilityRollup,
  RegionId,
  RegionRollup,
  Severity,
  TemperatureZoneId,
  ZoneRollup,
} from './types'
import {
  expectedBreachDate as firstBreachDate,
  forecastRisk,
  rollup,
  utilizationPct,
  varianceToTarget,
} from './metrics'
import { THRESHOLDS, statusToSeverity, utilizationStatus } from '@/lib/config/thresholds'
import {
  CITY_BY_ID,
  REGION_BY_ID,
  REGION_ORDER,
  REGION_SNAPSHOT,
  TEMPERATURE_ZONES,
} from '@/lib/data/master'
import { FACILITY_SERIES, FORECAST_DATES, forecastAt, utilizationOnDay } from '@/lib/data/timeseries'
import { TEMPERATURE_EXCURSIONS, FEFO_BREACHES } from '@/lib/data/coldchain'

const OPEN_EXCURSION_FACILITIES = new Set(
  TEMPERATURE_EXCURSIONS.filter((e) => e.status !== 'CLOSED').map((e) => e.facilityId),
)
const FEFO_FACILITIES = new Set(FEFO_BREACHES.map((b) => b.facilityId))

export const REASONS = {
  overCapacity: 'Over capacity',
  rapidIncrease: 'Rapid utilization increase',
  forecastRisk: 'Capacity forecast risk',
  underUtilized: 'Under-utilized',
  temperature: 'Temperature excursion',
  ageing: 'Inventory ageing / FEFO',
  deterioration: 'Operational deterioration',
  aboveThreshold: 'Utilization above threshold',
  emptyConcentration: 'Empty capacity concentration',
  dataQuality: 'Capacity master missing',
  pnpOverCapacity: 'Rented space over capacity',
  pnpIdle: 'Contracted space with no occupancy',
  pnpContractRisk: 'Park & Pay contract expiring',
  pnpFlatFeed: 'Park & Pay occupancy reported as contracted',
} as const

function primaryReason(
  facility: Facility,
  pct: number | null,
  change7d: number | null,
  forecast30: number | null,
): string | null {
  if (facility.capacity === null) return REASONS.dataQuality
  if (pct !== null && pct > 100) return REASONS.overCapacity
  if (change7d !== null && change7d >= THRESHOLDS.rapidIncreasePp) return REASONS.rapidIncrease
  if (forecast30 !== null && forecast30 >= THRESHOLDS.breachThresholdPct && (pct ?? 0) < THRESHOLDS.breachThresholdPct)
    return REASONS.forecastRisk
  if (pct !== null && pct < THRESHOLDS.underUtilizedPct) return REASONS.underUtilized
  if (OPEN_EXCURSION_FACILITIES.has(facility.id)) return REASONS.temperature
  if (FEFO_FACILITIES.has(facility.id)) return REASONS.ageing
  if (change7d !== null && change7d <= THRESHOLDS.rapidDeclinePp) return REASONS.deterioration
  if (pct !== null && pct >= THRESHOLDS.breachThresholdPct) return REASONS.aboveThreshold
  if (pct !== null && pct < THRESHOLDS.networkTargetPct - 15) return REASONS.emptyConcentration
  return null
}

function riskFor(pct: number | null, forecast30: number | null, reason: string | null): Severity {
  if (reason === REASONS.dataQuality) return 'medium'
  if (pct !== null && pct > 100) return 'critical'
  if (reason === REASONS.temperature) return 'critical'
  const projected = forecastRisk(pct, forecast30)
  if (reason === REASONS.rapidIncrease && projected !== 'critical') return 'high'
  if (reason === REASONS.underUtilized) return 'medium'
  return statusToSeverity(projected)
}

/** Facility-level view model, including trend, forecast and the reason it needs attention. */
export function buildFacilityRollup(facility: Facility): FacilityRollup {
  const pct = utilizationPct(facility)
  const series = FACILITY_SERIES[facility.id]
  const change7d =
    pct === null ? null : (() => {
      const past = utilizationOnDay(facility.id, 7)
      return past === null ? null : Number((pct - past).toFixed(2))
    })()
  // A 30-day baseline as well as a 7-day one: a week of movement is noise at a
  // single site, a month is a direction.
  const utilization30dAgo = utilizationOnDay(facility.id, 30)
  const change30d =
    pct === null || utilization30dAgo === null ? null : Number((pct - utilization30dAgo).toFixed(2))

  const forecast7 = forecastAt(facility.id, 7)
  const forecast14 = forecastAt(facility.id, 14)
  const forecast30 = forecastAt(facility.id, 30)
  const breachDate = firstBreachDate(
    FORECAST_DATES.map((date, i) => ({ date, pct: series?.forecast[i] ?? null })),
  )

  const region = REGION_SNAPSHOT[facility.regionId]
  const reason = primaryReason(facility, pct, change7d, forecast30)
  const base = rollup([facility])

  return {
    ...base,
    facilityId: facility.id,
    code: facility.code,
    name: facility.name,
    regionId: facility.regionId,
    cityId: facility.cityId,
    cityName: CITY_BY_ID[facility.cityId]?.name ?? 'Unknown',
    type: facility.type,
    ownership: facility.ownership,
    execution: facility.execution,
    owner: facility.owner,
    targetPct: region.targetPct,
    variancePct: varianceToTarget(pct, region.targetPct),
    change7dPct: change7d,
    change30dPct: change30d,
    utilizationPct30dAgo: utilization30dAgo,
    forecast7dPct: forecast7,
    forecast14dPct: forecast14,
    forecast30dPct: forecast30,
    expectedBreachDate: pct !== null && pct >= THRESHOLDS.breachThresholdPct ? null : breachDate,
    status: utilizationStatus(pct),
    risk: riskFor(pct, forecast30, reason),
    spark: (series?.history.slice(-14) ?? []).map((v) => v ?? 0),
    primaryReason: reason,
  }
}

export function buildFacilityRollups(facilities: Facility[]): FacilityRollup[] {
  return facilities.map(buildFacilityRollup)
}

/** Region-level view model built from whichever facilities survived the filters. */
export function buildRegionRollups(facilities: Facility[]): RegionRollup[] {
  return REGION_ORDER.map((regionId) => {
    const members = facilities.filter((f) => f.regionId === regionId)
    const base = rollup(members)
    const target = REGION_SNAPSHOT[regionId].targetPct

    // Region trend and forecast are capacity-weighted from the members, so a
    // filtered region reports the trend of what is actually on screen.
    const scoped = members.filter((f) => f.capacity !== null)
    const capacity = scoped.reduce((sum, f) => sum + (f.capacity ?? 0), 0)

    const weighted = (pick: (facilityId: string) => number | null): number | null => {
      if (capacity === 0) return null
      let total = 0
      let covered = 0
      for (const facility of scoped) {
        const value = pick(facility.id)
        if (value === null) continue
        total += value * (facility.capacity as number)
        covered += facility.capacity as number
      }
      return covered === 0 ? null : Number((total / covered).toFixed(2))
    }

    const past7 = weighted((id) => utilizationOnDay(id, 7))
    const change7d = base.utilizationPct === null || past7 === null ? null : Number((base.utilizationPct - past7).toFixed(2))
    const past30 = weighted((id) => utilizationOnDay(id, 30))
    const change30d = base.utilizationPct === null || past30 === null ? null : Number((base.utilizationPct - past30).toFixed(2))
    const forecast30 = weighted((id) => forecastAt(id, 30))

    const overFacilities = scoped.filter((f) => f.utilizedPallets > (f.capacity as number)).length
    const status = utilizationStatus(base.utilizationPct)

    return {
      ...base,
      regionId,
      regionName: REGION_BY_ID[regionId].name,
      targetPct: target,
      variancePct: varianceToTarget(base.utilizationPct, target),
      change7dPct: change7d,
      change30dPct: change30d,
      utilizationPct30dAgo: past30,
      forecast30dPct: forecast30,
      status,
      risk: overFacilities > 0 ? 'critical' : statusToSeverity(forecastRisk(base.utilizationPct, forecast30)),
      facilityCount: members.length,
      overCapacityFacilities: overFacilities,
    }
  }).filter((r) => r.facilityCount > 0)
}

/** Temperature-zone view model. */
export function buildZoneRollups(facilities: Facility[], zoneFilter?: TemperatureZoneId[]): ZoneRollup[] {
  const wanted = zoneFilter && zoneFilter.length > 0 ? new Set(zoneFilter) : null

  return TEMPERATURE_ZONES.filter((z) => !wanted || wanted.has(z.id))
    .map((zone) => {
      const members = facilities.flatMap((f) =>
        f.zones.filter((z) => z.zoneId === zone.id).map((z) => ({ facility: f, zone: z })),
      )
      const base = rollup(members.map((m) => ({ capacity: m.zone.capacity, utilizedPallets: m.zone.utilizedPallets })))

      // Compliance is weighted by occupancy: a full chamber out of band
      // matters more than an empty one.
      let complianceWeighted = 0
      let complianceWeight = 0
      for (const m of members) {
        if (m.zone.temperatureCompliancePct === null) continue
        complianceWeighted += m.zone.temperatureCompliancePct * m.zone.utilizedPallets
        complianceWeight += m.zone.utilizedPallets
      }

      // Zone 7-day change is approximated from its facilities' movement,
      // weighted by the zone's share of each facility today.
      let changeWeighted = 0
      let changeWeight = 0
      for (const m of members) {
        const facilityChange = (() => {
          const now = utilizationPct(m.facility)
          const past = utilizationOnDay(m.facility.id, 7)
          return now === null || past === null ? null : now - past
        })()
        if (facilityChange === null || m.zone.capacity === null) continue
        changeWeighted += facilityChange * m.zone.capacity
        changeWeight += m.zone.capacity
      }

      return {
        ...base,
        zoneId: zone.id,
        zoneName: zone.name,
        setPoint: zone.setPoint,
        temperatureCompliancePct:
          complianceWeight === 0 ? null : Number((complianceWeighted / complianceWeight).toFixed(2)),
        change7dPct: changeWeight === 0 ? null : Number((changeWeighted / changeWeight).toFixed(2)),
        status: utilizationStatus(base.utilizationPct),
      }
    })
    .filter((z) => z.capacity !== null || z.utilizedPallets > 0)
}

export function regionOf(regionId: RegionId) {
  return REGION_BY_ID[regionId]
}
