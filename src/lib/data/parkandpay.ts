/**
 * Park & Pay locations.
 *
 * Park & Pay is a separate operating model: storage space rented from third
 * parties and sold on to customers, rather than space Snowman owns or leases
 * and operates itself. The positions are ordinary pallet positions, so they
 * are directly comparable with the own network - but they are a different
 * commercial book with a different cost base, which is exactly why the
 * dashboard reports own, Park & Pay and combined separately rather than
 * quietly adding them together.
 *
 * Rows, codes and capacities are carried across from the legacy PARK AND PAY
 * UTILIZATION grid. Two things in that grid are reproduced deliberately
 * rather than tidied away, because they are findings, not blemishes:
 *
 *   - Six locations report exactly 100.00% on every day of the window. Space
 *     that is contracted and space that is occupied are not the same
 *     measurement, and a flat 100.00% suggests the feed is publishing the
 *     former. It is surfaced as a data-quality item, not asserted as truth.
 *   - CNS holds 500 contracted positions at zero occupancy. That is a
 *     commercial question, not waste, and it is labelled as one.
 *
 * The source grid publishes a single capacity figure per location with no
 * frozen / chilled / dry split, so no split is invented here.
 */

import type { ParkAndPaySite, RegionId } from '@/lib/domain/types'
import { CITY_BY_ID } from './master'
import { HISTORY_DATES } from './timeseries'
import { OPERATIONAL_WINDOW_DAYS } from './seed'

interface SiteSpec {
  id: string
  /** Legacy location code, as published. */
  code: string
  /** Location name, as published. */
  name: string
  /** Null where the location is a third-party site with no city master row. */
  cityId: string | null
  regionId: RegionId
  /** Rented pallet positions. */
  capacity: number
  /** Occupied pallets on the report date. */
  utilizedPallets: number
  partner: string
  contractEndsOn: string
  /**
   * Occupancy earlier in the operational window, as { daysBeforeReportDate,
   * utilizedPallets } steps applied oldest-first. Absent means the site has
   * held its current occupancy across the whole window.
   */
  steps?: { fromDaysAgo: number; utilizedPallets: number }[]
  /** True where the feed publishes a flat, exactly-full figure. */
  reportsContractedAsOccupied?: boolean
}

/**
 * Occupancy is stored as pallets, never as the published percentage, so every
 * total in the application is a sum of integers rather than a sum of rounded
 * ratios. A handful of rows therefore render a hundredth of a point away from
 * the legacy grid; the pallet counts are the figures that reconcile.
 */
const SITE_SPECS: SiteSpec[] = [
  {
    id: 'PNP-LUH-01', code: 'LUH', name: 'Ludhiana', cityId: 'ludhiana', regionId: 'NORTH',
    capacity: 2000, utilizedPallets: 1151, partner: 'Satluj Cold Chain', contractEndsOn: '2027-03-31',
    steps: [{ fromDaysAgo: 29, utilizedPallets: 1154 }, { fromDaysAgo: 0, utilizedPallets: 1151 }],
  },
  {
    id: 'PNP-BMZ-01', code: 'BMZ', name: 'TBJ Cold Storage', cityId: null, regionId: 'NORTH',
    capacity: 2200, utilizedPallets: 2265, partner: 'TBJ Cold Storage', contractEndsOn: '2026-12-31',
    steps: [{ fromDaysAgo: 29, utilizedPallets: 2188 }, { fromDaysAgo: 16, utilizedPallets: 2265 }],
  },
  {
    id: 'PNP-CHS-01', code: 'CHS', name: 'Chennai', cityId: 'chennai', regionId: 'SOUTH-1',
    capacity: 200, utilizedPallets: 200, partner: 'Coromandel Coldworks', contractEndsOn: '2027-06-30',
    reportsContractedAsOccupied: true,
  },
  {
    id: 'PNP-CNS-01', code: 'CNS', name: 'Chennai', cityId: 'chennai', regionId: 'SOUTH-1',
    capacity: 500, utilizedPallets: 0, partner: 'Coromandel Coldworks', contractEndsOn: '2027-06-30',
    steps: [{ fromDaysAgo: 29, utilizedPallets: 318 }, { fromDaysAgo: 12, utilizedPallets: 0 }],
  },
  {
    id: 'PNP-KGT-01', code: 'KGT', name: 'Krishnapatnam', cityId: 'krishnapatnam', regionId: 'SOUTH-1',
    capacity: 1000, utilizedPallets: 1000, partner: 'Penna Port Logistics', contractEndsOn: '2026-11-30',
    reportsContractedAsOccupied: true,
  },
  {
    id: 'PNP-COP-01', code: 'COP', name: 'Cochin', cityId: 'kochi', regionId: 'SOUTH-2',
    capacity: 400, utilizedPallets: 400, partner: 'Backwater Cold Stores', contractEndsOn: '2027-01-31',
    reportsContractedAsOccupied: true,
  },
  {
    id: 'PNP-MAE-01', code: 'MAE', name: 'Mumbai', cityId: 'mumbai', regionId: 'WEST-1',
    capacity: 1000, utilizedPallets: 1000, partner: 'Konkan Frozen Depots', contractEndsOn: '2026-10-31',
    reportsContractedAsOccupied: true,
  },
  {
    id: 'PNP-MBH-01', code: 'MBH', name: 'Mumbai', cityId: 'mumbai', regionId: 'WEST-1',
    capacity: 363, utilizedPallets: 363, partner: 'Konkan Frozen Depots', contractEndsOn: '2026-10-31',
    reportsContractedAsOccupied: true,
  },
  {
    id: 'PNP-MUA-01', code: 'MUA', name: 'Mumbai', cityId: 'mumbai', regionId: 'WEST-1',
    capacity: 700, utilizedPallets: 786, partner: 'Arabian Coastal Cold', contractEndsOn: '2027-04-30',
    steps: [{ fromDaysAgo: 29, utilizedPallets: 742 }, { fromDaysAgo: 21, utilizedPallets: 786 }],
  },
  {
    id: 'PNP-PNI-01', code: 'PNI', name: 'Pune', cityId: 'pune', regionId: 'WEST-2',
    capacity: 1000, utilizedPallets: 1010, partner: 'Deccan Cold Network', contractEndsOn: '2027-02-28',
    steps: [{ fromDaysAgo: 29, utilizedPallets: 994 }, { fromDaysAgo: 9, utilizedPallets: 1010 }],
  },
  {
    id: 'PNP-PNT-01', code: 'PNT', name: 'Pune', cityId: 'pune', regionId: 'WEST-2',
    capacity: 1500, utilizedPallets: 1500, partner: 'Deccan Cold Network', contractEndsOn: '2027-02-28',
    reportsContractedAsOccupied: true,
  },
  {
    id: 'PNP-PUE-01', code: 'PUE', name: 'Pune', cityId: 'pune', regionId: 'WEST-2',
    capacity: 800, utilizedPallets: 1063, partner: 'Sahyadri Storage Partners', contractEndsOn: '2026-09-30',
    steps: [
      { fromDaysAgo: 29, utilizedPallets: 1071 },
      { fromDaysAgo: 1, utilizedPallets: 1047 },
      { fromDaysAgo: 0, utilizedPallets: 1063 },
    ],
  },
]

/** The trailing slice of the daily series the legacy grid publishes. */
export const PARK_AND_PAY_GRID_DAYS = 7

const WINDOW_DATES = HISTORY_DATES.slice(-OPERATIONAL_WINDOW_DAYS)

function dailyFor(spec: SiteSpec): { date: string; utilizedPallets: number }[] {
  const lastIndex = WINDOW_DATES.length - 1
  const steps = spec.steps ?? [{ fromDaysAgo: lastIndex, utilizedPallets: spec.utilizedPallets }]
  return WINDOW_DATES.map((date, i) => {
    const daysAgo = lastIndex - i
    // Steps are declared oldest-first; the last one whose start has been
    // reached is the value in force on that day.
    let value = steps[0].utilizedPallets
    for (const step of steps) {
      if (daysAgo <= step.fromDaysAgo) value = step.utilizedPallets
    }
    return { date, utilizedPallets: value }
  })
}

export const PARK_AND_PAY_SITES: ParkAndPaySite[] = SITE_SPECS.map((spec) => {
  const daily = dailyFor(spec)
  return {
    id: spec.id,
    code: spec.code,
    name: spec.name,
    regionId: spec.regionId,
    cityId: spec.cityId,
    capacity: spec.capacity,
    utilizedPallets: daily[daily.length - 1].utilizedPallets,
    partner: spec.partner,
    contractEndsOn: spec.contractEndsOn,
    daily,
    reportsContractedAsOccupied: spec.reportsContractedAsOccupied === true,
  }
})

export const PARK_AND_PAY_BY_ID: Record<string, ParkAndPaySite> = Object.fromEntries(
  PARK_AND_PAY_SITES.map((site) => [site.id, site]),
)

export function parkAndPayCityName(site: ParkAndPaySite): string {
  if (site.cityId === null) return 'Not mapped'
  return CITY_BY_ID[site.cityId]?.name ?? 'Not mapped'
}

/** Locations whose feed publishes a flat, exactly-full occupancy figure. */
export const PARK_AND_PAY_FLAT_FULL = PARK_AND_PAY_SITES.filter((s) => s.reportsContractedAsOccupied)

/** Contracted space carrying no occupancy on the report date. */
export const PARK_AND_PAY_IDLE = PARK_AND_PAY_SITES.filter((s) => s.utilizedPallets === 0)
