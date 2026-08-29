/**
 * Cold-chain telemetry and quality events.
 *
 * DEMO DATA. There is no IoT feed behind this module; the values are
 * hand-authored so the prototype can demonstrate the exception path. Every
 * screen that renders it carries a visible demo-data marker.
 */

import type { ColdChainSummary, TemperatureExcursion } from '@/lib/domain/types'
import { FACILITIES } from './master'
import { REPORT_DATE } from './seed'

export const TEMPERATURE_EXCURSIONS: TemperatureExcursion[] = [
  {
    id: 'EXC-2026-0827-01',
    facilityId: 'SNL-IDR-01',
    regionId: 'WEST-2',
    zoneId: 'FROZEN',
    chamber: 'CH-03',
    startedAt: `${REPORT_DATE}T02:14:00+05:30`,
    durationMinutes: 96,
    peakDeviationC: 5.8,
    severity: 'critical',
    status: 'OPEN',
    affectedPallets: 268,
  },
  {
    id: 'EXC-2026-0827-02',
    facilityId: 'SNL-HYD-01',
    regionId: 'SOUTH-2',
    zoneId: 'CHILLED',
    chamber: 'CH-02',
    startedAt: `${REPORT_DATE}T04:40:00+05:30`,
    durationMinutes: 41,
    peakDeviationC: 2.4,
    severity: 'critical',
    status: 'ACKNOWLEDGED',
    affectedPallets: 74,
  },
  {
    id: 'EXC-2026-0826-07',
    facilityId: 'SNL-GAU-01',
    regionId: 'EAST',
    zoneId: 'FROZEN',
    chamber: 'CH-01',
    startedAt: '2026-08-26T21:05:00+05:30',
    durationMinutes: 28,
    peakDeviationC: 1.6,
    severity: 'medium',
    status: 'CLOSED',
    affectedPallets: 33,
  },
  {
    id: 'EXC-2026-0826-08',
    facilityId: 'SNL-BOM-02',
    regionId: 'WEST-1',
    zoneId: 'CHILLED',
    chamber: 'CH-04',
    startedAt: '2026-08-26T18:22:00+05:30',
    durationMinutes: 19,
    peakDeviationC: 1.1,
    severity: 'low',
    status: 'CLOSED',
    affectedPallets: 12,
  },
]

/**
 * Network temperature compliance, weighted by the pallets each zone actually
 * holds - a small empty chamber running out of band should not move the
 * network number as much as a full one.
 */
function weightedTemperatureCompliance(): number {
  let weighted = 0
  let weight = 0
  for (const facility of FACILITIES) {
    for (const zone of facility.zones) {
      if (zone.temperatureCompliancePct === null) continue
      weighted += zone.temperatureCompliancePct * zone.utilizedPallets
      weight += zone.utilizedPallets
    }
  }
  return weight === 0 ? 0 : Number((weighted / weight).toFixed(2))
}

export const COLD_CHAIN_SUMMARY: ColdChainSummary = {
  temperatureCompliancePct: weightedTemperatureCompliance(),
  excursions24h: TEMPERATURE_EXCURSIONS.length,
  criticalExcursions24h: TEMPERATURE_EXCURSIONS.filter((e) => e.severity === 'critical').length,
  avgExcursionDurationMinutes: Math.round(
    TEMPERATURE_EXCURSIONS.reduce((a, e) => a + e.durationMinutes, 0) / TEMPERATURE_EXCURSIONS.length,
  ),
  openTemperatureAlerts: TEMPERATURE_EXCURSIONS.filter((e) => e.status !== 'CLOSED').length,
  quarantinePallets: 342,
  fefoCompliancePct: 97.8,
  nearExpiryPallets: 1826,
  shortCodedPallets: 411,
}

/** FEFO breaches: picks that skipped an earlier-expiring pallet. */
export interface FefoBreach {
  id: string
  facilityId: string
  regionId: string
  depositor: string
  sku: string
  pickedExpiry: string
  earlierAvailableExpiry: string
  pallets: number
  detectedAt: string
}

export const FEFO_BREACHES: FefoBreach[] = [
  {
    id: 'FEFO-0827-01',
    facilityId: 'SNL-HYD-01',
    regionId: 'SOUTH-2',
    depositor: 'Deccan Bakers',
    sku: 'DB-FRZ-PARATHA-400G',
    pickedExpiry: '2026-11-14',
    earlierAvailableExpiry: '2026-09-08',
    pallets: 46,
    detectedAt: `${REPORT_DATE}T06:12:00+05:30`,
  },
  {
    id: 'FEFO-0827-02',
    facilityId: 'SNL-BLR-01',
    regionId: 'SOUTH-2',
    depositor: 'QuickServe Restaurants India',
    sku: 'QS-FRZ-PATTY-90G',
    pickedExpiry: '2026-12-02',
    earlierAvailableExpiry: '2026-09-19',
    pallets: 31,
    detectedAt: `${REPORT_DATE}T06:12:00+05:30`,
  },
  {
    id: 'FEFO-0826-05',
    facilityId: 'SNL-CCU-01',
    regionId: 'EAST',
    depositor: 'Sundarban Foods',
    sku: 'SF-FRZ-FISHFING-500G',
    pickedExpiry: '2026-10-30',
    earlierAvailableExpiry: '2026-09-25',
    pallets: 18,
    detectedAt: '2026-08-26T07:03:00+05:30',
  },
]
