/**
 * Park & Pay yards.
 *
 * Carried forward from the legacy daily report. These are vehicle parking
 * bays, not pallet positions, so they are deliberately kept out of the
 * network pallet utilization figures and reported on their own.
 */

import type { ParkAndPaySite, RegionId } from '@/lib/domain/types'
import { CITY_BY_ID } from './master'
import { HISTORY_DATES } from './timeseries'
import { rngFor } from './seed'

interface SiteSpec {
  id: string
  name: string
  cityId: string
  regionId: RegionId
  capacity: number | null
  utilizationPct: number | null
  targetPct: number
}

const SITE_SPECS: SiteSpec[] = [
  { id: 'PNP-KUN-01', name: 'Kundli Yard', cityId: 'kundli', regionId: 'NORTH', capacity: 180, utilizationPct: 88.3, targetPct: 80 },
  { id: 'PNP-PWL-01', name: 'Palwal Yard', cityId: 'palwal', regionId: 'NORTH', capacity: 120, utilizationPct: 71.7, targetPct: 80 },
  { id: 'PNP-CCU-01', name: 'Kolkata Yard', cityId: 'kolkata', regionId: 'EAST', capacity: 150, utilizationPct: 82.0, targetPct: 80 },
  { id: 'PNP-DNK-01', name: 'Dankuni Yard', cityId: 'dankuni', regionId: 'EAST', capacity: 90, utilizationPct: 65.6, targetPct: 80 },
  { id: 'PNP-BOM-01', name: 'Bhiwandi Yard', cityId: 'bhiwandi', regionId: 'WEST-1', capacity: 240, utilizationPct: 94.2, targetPct: 80 },
  { id: 'PNP-PLG-01', name: 'Palghar Yard', cityId: 'palghar', regionId: 'WEST-1', capacity: 110, utilizationPct: 76.4, targetPct: 80 },
  { id: 'PNP-AMD-01', name: 'Ahmedabad Yard', cityId: 'ahmedabad', regionId: 'WEST-1', capacity: 100, utilizationPct: 69.0, targetPct: 80 },
  { id: 'PNP-IDR-01', name: 'Indore Yard', cityId: 'indore', regionId: 'WEST-2', capacity: 80, utilizationPct: 103.8, targetPct: 80 },
  { id: 'PNP-NAG-01', name: 'Nagpur Yard', cityId: 'nagpur', regionId: 'WEST-2', capacity: 95, utilizationPct: 84.2, targetPct: 80 },
  { id: 'PNP-MAA-01', name: 'Chennai Yard', cityId: 'chennai', regionId: 'SOUTH-1', capacity: 200, utilizationPct: 79.5, targetPct: 80 },
  { id: 'PNP-SRC-01', name: 'Sri City Yard', cityId: 'sricity', regionId: 'SOUTH-1', capacity: 130, utilizationPct: 60.8, targetPct: 80 },
  { id: 'PNP-BLR-01', name: 'Bengaluru Yard', cityId: 'bengaluru', regionId: 'SOUTH-2', capacity: 175, utilizationPct: 86.9, targetPct: 80 },
  { id: 'PNP-HYD-01', name: 'Hyderabad Yard', cityId: 'hyderabad', regionId: 'SOUTH-2', capacity: 140, utilizationPct: 73.6, targetPct: 80 },
  // Capacity master row was never created for this yard after commissioning.
  { id: 'PNP-VTZ-01', name: 'Visakhapatnam Yard', cityId: 'visakhapatnam', regionId: 'SOUTH-1', capacity: null, utilizationPct: null, targetPct: 80 },
]

const MONTH_LABELS = [
  '2025-09', '2025-10', '2025-11', '2025-12', '2026-01', '2026-02',
  '2026-03', '2026-04', '2026-05', '2026-06', '2026-07', '2026-08',
]

export const PARK_AND_PAY_SITES: ParkAndPaySite[] = SITE_SPECS.map((spec) => {
  const rng = rngFor(`pnp:${spec.id}`)
  const occupied =
    spec.capacity === null || spec.utilizationPct === null
      ? 41 // vehicles counted at the gate even though no bay master exists
      : Math.round((spec.capacity * spec.utilizationPct) / 100)

  const daily = HISTORY_DATES.map((date, i) => {
    const drift = (i / (HISTORY_DATES.length - 1) - 0.5) * 0.12
    const value = Math.max(0, Math.round(occupied * (1 + drift + (rng() - 0.5) * 0.14)))
    return { date, occupied: value }
  })
  daily[daily.length - 1] = { date: HISTORY_DATES[HISTORY_DATES.length - 1], occupied }

  const monthly = MONTH_LABELS.map((month, i) => {
    if (spec.capacity === null || spec.utilizationPct === null) return { month, utilizationPct: null }
    const seasonal = Math.sin((i / MONTH_LABELS.length) * Math.PI * 2) * 4.5
    return {
      month,
      utilizationPct: Number(Math.max(0, spec.utilizationPct - 6 + seasonal + rng() * 5).toFixed(1)),
    }
  })
  if (spec.utilizationPct !== null) {
    monthly[monthly.length - 1] = { month: MONTH_LABELS[MONTH_LABELS.length - 1], utilizationPct: spec.utilizationPct }
  }

  return {
    id: spec.id,
    name: spec.name,
    regionId: spec.regionId,
    cityId: spec.cityId,
    capacity: spec.capacity,
    occupied,
    daily,
    monthly,
    targetPct: spec.targetPct,
  }
})

export function parkAndPayCityName(site: ParkAndPaySite): string {
  return CITY_BY_ID[site.cityId]?.name ?? 'Unknown'
}
