/**
 * Pallet flow and dock performance.
 *
 * Movement is reconciled: closing = opening + putaway - outbound for every
 * day, and the final closing balance equals the network's occupied pallets on
 * the report date. A flow report that does not tie back to the stock snapshot
 * is worse than no flow report.
 */

import type { PalletFlowPoint, RegionId } from '@/lib/domain/types'
import { FACILITIES, REGION_ORDER } from './master'
import { FACILITY_SERIES, HISTORY_DATES } from './timeseries'
import { rngFor } from './seed'

const NETWORK_OCCUPIED = FACILITIES.reduce((sum, f) => (f.capacity === null ? sum : sum + f.utilizedPallets), 0)

/**
 * Build a flow series that ends on a known closing balance.
 *
 * The occupancy curve is the source of truth: daily net movement is derived
 * from the change in occupancy, then split into gross inbound and outbound
 * using a deterministic churn rate. Putaway lags inbound slightly - pallets
 * received late in the day are put away the next morning.
 */
function buildFlow(occupancy: number[], seedKey: string): PalletFlowPoint[] {
  const rng = rngFor(`flow:${seedKey}`)
  const out: PalletFlowPoint[] = []
  let carriedInbound = 0

  for (let i = 0; i < occupancy.length; i += 1) {
    const opening = i === 0 ? Math.round(occupancy[0] * 0.994) : occupancy[i - 1]
    const closing = occupancy[i]
    const net = closing - opening
    // Gross churn: a cold store turns a meaningful share of stock every day
    // even when the net position barely moves.
    const churn = Math.round(opening * (0.055 + rng() * 0.03))
    const outbound = Math.max(0, churn - Math.round(net / 2))
    const inbound = Math.max(0, outbound + net)
    // 3-6% of a day's receipts land in staging and are put away next morning.
    const spill = Math.round(inbound * (0.03 + rng() * 0.03))
    const putaway = Math.max(0, inbound - spill + carriedInbound)
    carriedInbound = spill

    out.push({
      date: HISTORY_DATES[i],
      openingPallets: opening,
      inbound,
      putaway,
      outbound,
      closingPallets: closing,
      // DPR is carried across from the legacy report without reinterpretation.
      dpr: Math.round((inbound + outbound) * (0.41 + rng() * 0.05)),
    })
  }
  return out
}

function occupancyFor(facilityIds: string[]): number[] {
  return HISTORY_DATES.map((_, dayIndex) =>
    facilityIds.reduce((sum, id) => sum + (FACILITY_SERIES[id]?.historyPallets[dayIndex] ?? 0), 0),
  )
}

const SCOPED_IDS = FACILITIES.filter((f) => f.capacity !== null).map((f) => f.id)

export const NETWORK_FLOW: PalletFlowPoint[] = buildFlow(occupancyFor(SCOPED_IDS), 'network')

export const REGION_FLOW: Record<RegionId, PalletFlowPoint[]> = REGION_ORDER.reduce(
  (acc, regionId) => {
    acc[regionId] = buildFlow(
      occupancyFor(FACILITIES.filter((f) => f.regionId === regionId && f.capacity !== null).map((f) => f.id)),
      regionId,
    )
    return acc
  },
  {} as Record<RegionId, PalletFlowPoint[]>,
)

// ---------------------------------------------------------------------------
// Dock performance
// ---------------------------------------------------------------------------

export interface DockPerformance {
  facilityId: string
  dockToStockMinutes: number | null
  stagingDwellMinutes: number | null
  dispatchDwellMinutes: number | null
}

export const DOCK_PERFORMANCE: DockPerformance[] = FACILITIES.map((facility) => {
  const rng = rngFor(`dock:${facility.code}`)
  // Facilities that are close to full take longer to put away - there is
  // less open location to travel to. That relationship is deliberate.
  const pressure =
    facility.capacity === null || facility.capacity === 0 ? 1 : facility.utilizedPallets / facility.capacity
  const strain = 1 + Math.max(0, pressure - 0.85) * 2.6
  return {
    facilityId: facility.id,
    // Dehradun is a brand-new site whose event feed is not wired up yet.
    dockToStockMinutes: facility.code === 'SNL-DDN-01' ? null : Math.round((92 + rng() * 55) * strain),
    stagingDwellMinutes: facility.code === 'SNL-DDN-01' ? null : Math.round((31 + rng() * 26) * strain),
    dispatchDwellMinutes: facility.code === 'SNL-DDN-01' ? null : Math.round((44 + rng() * 34) * strain),
  }
})

export const DOCK_BY_FACILITY: Record<string, DockPerformance> = Object.fromEntries(
  DOCK_PERFORMANCE.map((d) => [d.facilityId, d]),
)

export function networkDockMedian(key: keyof Omit<DockPerformance, 'facilityId'>): number | null {
  const values = DOCK_PERFORMANCE.map((d) => d[key]).filter((v): v is number => v !== null)
  if (values.length === 0) return null
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0 ? Math.round((sorted[mid - 1] + sorted[mid]) / 2) : sorted[mid]
}

export const NETWORK_CLOSING_PALLETS = NETWORK_OCCUPIED
