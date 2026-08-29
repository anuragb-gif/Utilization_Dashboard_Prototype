/**
 * Inventory ageing and expiry exposure.
 *
 * Bucket totals are allocated from the network's occupied pallet count, so
 * the ageing panel always adds up to the same occupancy the KPI strip shows.
 */

import type { AgeingBucket, ExpiryBucket, InventoryConcentration, RegionId } from '@/lib/domain/types'
import { FACILITIES, REGION_ORDER } from './master'
import { allocateInteger, rngFor } from './seed'

const NETWORK_OCCUPIED = FACILITIES.reduce((sum, f) => (f.capacity === null ? sum : sum + f.utilizedPallets), 0)

const AGEING_SHAPE = [
  { id: 'age-0-7', label: '0-7 days', share: 27.5 },
  { id: 'age-8-15', label: '8-15 days', share: 23.0 },
  { id: 'age-16-30', label: '16-30 days', share: 24.5 },
  { id: 'age-31-60', label: '31-60 days', share: 17.2 },
  { id: 'age-60-plus', label: '60+ days', share: 7.8 },
]

/** Average declared value per pallet, in INR lakh. */
const VALUE_PER_PALLET_LAKH = 0.86

export const AGEING_BUCKETS: AgeingBucket[] = (() => {
  const counts = allocateInteger(
    NETWORK_OCCUPIED,
    AGEING_SHAPE.map((b) => b.share),
  )
  return AGEING_SHAPE.map((bucket, i) => ({
    id: bucket.id,
    label: bucket.label,
    palletCount: counts[i],
    valueInrLakh: Number((counts[i] * VALUE_PER_PALLET_LAKH).toFixed(1)),
  }))
})()

/**
 * Expiry exposure.
 *
 * Only stock carrying a lot expiry date in the source extract is bucketed;
 * the balance is reported as "expiry date not supplied" rather than being
 * assumed to be long-dated.
 */
export const EXPIRY_DATED_PALLETS = 118_940
export const EXPIRY_UNDATED_PALLETS = NETWORK_OCCUPIED - EXPIRY_DATED_PALLETS

const EXPIRY_SHAPE: { id: string; label: string; share: number; severity: ExpiryBucket['severity'] }[] = [
  { id: 'exp-0-7', label: '0-7 days to expiry', share: 0.34, severity: 'critical' },
  { id: 'exp-8-15', label: '8-15 days', share: 0.65, severity: 'high' },
  { id: 'exp-16-30', label: '16-30 days', share: 0.55, severity: 'medium' },
  { id: 'exp-31-60', label: '31-60 days', share: 4.1, severity: 'low' },
  { id: 'exp-60-plus', label: '60+ days', share: 94.36, severity: 'low' },
]

export const EXPIRY_BUCKETS: ExpiryBucket[] = (() => {
  const counts = allocateInteger(
    EXPIRY_DATED_PALLETS,
    EXPIRY_SHAPE.map((b) => b.share),
  )
  return EXPIRY_SHAPE.map((bucket, i) => ({
    id: bucket.id,
    label: bucket.label,
    palletCount: counts[i],
    valueInrLakh: Number((counts[i] * VALUE_PER_PALLET_LAKH).toFixed(1)),
    severity: bucket.severity,
  }))
})()

/** Where the ageing and near-expiry stock actually sits. */
export const INVENTORY_CONCENTRATION: InventoryConcentration[] = (() => {
  const out: InventoryConcentration[] = []
  const scoped = FACILITIES.filter((f) => f.capacity !== null)
  for (const bucket of [...AGEING_BUCKETS, ...EXPIRY_BUCKETS]) {
    const rng = rngFor(`conc:${bucket.id}`)
    // Ageing concentrates where stock turns slowest, so weight by occupancy
    // and by how far below the regional norm the facility's throughput sits.
    const weights = scoped.map((f) => f.utilizedPallets * (0.6 + rng() * 0.9))
    const counts = allocateInteger(bucket.palletCount, weights)
    scoped.forEach((facility, i) => {
      if (counts[i] === 0) return
      out.push({
        facilityId: facility.id,
        regionId: facility.regionId,
        bucketId: bucket.id,
        palletCount: counts[i],
      })
    })
  }
  return out
})()

export function ageingByRegion(bucketId: string): Record<RegionId, number> {
  const base = Object.fromEntries(REGION_ORDER.map((r) => [r, 0])) as Record<RegionId, number>
  for (const row of INVENTORY_CONCENTRATION) {
    if (row.bucketId !== bucketId) continue
    base[row.regionId] += row.palletCount
  }
  return base
}

export const NEAR_EXPIRY_BUCKET_IDS = ['exp-0-7', 'exp-8-15', 'exp-16-30']

export const NEAR_EXPIRY_PALLETS = EXPIRY_BUCKETS.filter((b) => NEAR_EXPIRY_BUCKET_IDS.includes(b.id)).reduce(
  (sum, b) => sum + b.palletCount,
  0,
)
