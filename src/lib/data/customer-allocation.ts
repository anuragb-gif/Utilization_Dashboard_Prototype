/**
 * Depositor occupancy, allocated to facility and temperature zone.
 *
 * Built bottom-up: each facility zone's occupied pallets are shared out among
 * the depositors present at that facility, so
 *   sum(customer allocations) === zone occupancy === facility === region === network.
 * A depositor's network total is then derived from its allocations rather than
 * declared separately - there is exactly one number for a depositor and every
 * screen reads it from here.
 */

import type { Customer, RegionId, TemperatureZoneId } from '@/lib/domain/types'
import { CUSTOMER_SPECS, FACILITIES } from './master'
import { allocateInteger, rngFor } from './seed'

export interface CustomerAllocation {
  customerId: string
  facilityId: string
  zoneId: TemperatureZoneId
  pallets: number
}

/**
 * Depositors present at a facility.
 *
 * Larger sites carry more depositors. Selection is weighted by network share
 * so the big names appear widely and the small ones stay regional, and it is
 * seeded per facility so the roster never changes between loads.
 */
function rosterFor(facilityId: string, regionId: RegionId, capacity: number | null): string[] {
  const rng = rngFor(`roster:${facilityId}`)
  const eligible = CUSTOMER_SPECS.filter((c) => c.id !== 'others' && c.regionIds.includes(regionId))
  const size = Math.max(3, Math.min(9, Math.round((capacity ?? 900) / 700) + 2))

  // Weighted sampling without replacement, largest-weight-first with jitter.
  const scored = eligible
    .map((c) => ({ id: c.id, score: c.share * (0.55 + rng() * 0.9) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, size)
    .map((c) => c.id)

  // "Other depositors" absorbs the long tail and is present everywhere, which
  // is what keeps a site's roster from implying only nine customers exist.
  return [...scored, 'others']
}

export const CUSTOMER_ALLOCATIONS: CustomerAllocation[] = (() => {
  const out: CustomerAllocation[] = []
  for (const facility of FACILITIES) {
    const roster = rosterFor(facility.id, facility.regionId, facility.capacity)
    const shareOf = (id: string) => CUSTOMER_SPECS.find((c) => c.id === id)?.share ?? 1

    for (const zone of facility.zones) {
      if (zone.utilizedPallets <= 0) continue
      const rng = rngFor(`alloc:${facility.id}:${zone.zoneId}`)
      // Not every depositor stores in every zone - a dairy has no frozen
      // requirement at a site where it only holds chilled - so a share of the
      // roster is zeroed out per zone, deterministically.
      const weights: number[] = roster.map((id, i) => {
        const drop = i > 0 && rng() < 0.34 ? 0 : 1
        return drop * shareOf(id) * (0.4 + rng() * 1.5)
      })
      // A zone whose whole roster was dropped still has to be allocated to
      // someone, or its pallets would vanish from the reconciliation.
      if (weights.reduce((a, b) => a + b, 0) === 0) weights[0] = 1
      const split = allocateInteger(zone.utilizedPallets, weights)
      roster.forEach((id, i) => {
        if (split[i] > 0) out.push({ customerId: id, facilityId: facility.id, zoneId: zone.zoneId, pallets: split[i] })
      })
    }
  }
  return out
})()

/**
 * Customer numbers follow the legacy report's shape: a site prefix and a
 * six-digit sequence, issued per depositor per location.
 */
export const CUSTOMER_NUMBERS: Record<string, string> = (() => {
  const out: Record<string, string> = {}
  const seq: Record<string, number> = {}
  const seen = new Set<string>()
  for (const a of CUSTOMER_ALLOCATIONS) {
    const key = `${a.customerId}@${a.facilityId}`
    if (seen.has(key)) continue
    seen.add(key)
    const facility = FACILITIES.find((f) => f.id === a.facilityId)
    if (!facility) continue
    const parts = facility.code.split('-')
    const site = `${parts[1] ?? 'XXX'}${Number(parts[2] ?? 1)}`
    seq[site] = (seq[site] ?? 0) + 1
    out[key] = `${site}P${String(seq[site] * 7 + 11).padStart(6, '0')}`
  }
  return out
})()

export function customerNumber(customerId: string, facilityId: string): string | null {
  return CUSTOMER_NUMBERS[`${customerId}@${facilityId}`] ?? null
}

/** Network occupied pallets per depositor, derived from the allocations. */
export const CUSTOMER_TOTALS: Record<string, number> = CUSTOMER_ALLOCATIONS.reduce<Record<string, number>>(
  (acc, a) => {
    acc[a.customerId] = (acc[a.customerId] ?? 0) + a.pallets
    return acc
  },
  {},
)

/** Distinct facilities a depositor occupies. */
export const CUSTOMER_FACILITY_COUNT: Record<string, number> = (() => {
  const sets: Record<string, Set<string>> = {}
  for (const a of CUSTOMER_ALLOCATIONS) {
    ;(sets[a.customerId] ??= new Set()).add(a.facilityId)
  }
  return Object.fromEntries(Object.entries(sets).map(([k, v]) => [k, v.size]))
})()

/**
 * Depositor totals are derived from the allocation above, not declared, so the
 * figure on the depositor list is the same figure the customer-wise
 * utilization report adds up to.
 */
export function buildCustomers(): Customer[] {
  return CUSTOMER_SPECS.map((spec) => {
    const pallets = CUSTOMER_TOTALS[spec.id] ?? 0
    return {
      id: spec.id,
      name: spec.name,
      sector: spec.sector,
      occupiedPallets: pallets,
      change7d: spec.change7d,
      regionIds: spec.regionIds,
      facilityCount: CUSTOMER_FACILITY_COUNT[spec.id] ?? 0,
      monthlyRevenueInrLakh: spec.revenueMissing
        ? null
        : Number((pallets * (spec.revenuePerPallet ?? 0.012)).toFixed(1)),
    }
  }).sort((a, b) => b.occupiedPallets - a.occupiedPallets)
}
