/**
 * Data quality.
 *
 * The counts here are not decorative: each one is derived from the same
 * master data the rest of the application renders, so the warnings on this
 * screen point at rows a user can actually go and look at.
 */

import type { DataQualityIssue, DataQualityReport } from '@/lib/domain/types'
import { DUPLICATE_LOCATIONS, FACILITIES, LOCATIONS } from './master'
import { PARK_AND_PAY_SITES } from './parkandpay'
import { LAST_REFRESH_AT, LAST_SUCCESSFUL_REFRESH_AT } from './seed'

const facilitiesMissingCapacity = FACILITIES.filter((f) => f.capacity === null)
const yardsMissingCapacity = PARK_AND_PAY_SITES.filter((s) => s.capacity === null)

/**
 * Movement rows whose warehouse code does not resolve to the facility master.
 * These are dropped from every rollup and reported here.
 */
export const UNMAPPED_WAREHOUSE_CODES = ['WH-9041', 'WH-9042', 'SNL-XXX-07']

/** Rows that loaded with a warehouse but no region assignment. */
export const RECORDS_MISSING_REGION = 12

export const RECORDS_PROCESSED = 248_611
export const RECORDS_REJECTED = 1_284

export const DATA_QUALITY_ISSUES: DataQualityIssue[] = [
  {
    id: 'dq-missing-capacity',
    severity: 'high',
    label: 'Facilities with no capacity master row',
    count: facilitiesMissingCapacity.length,
    detail:
      'These facilities report occupied pallets but have no rackable capacity on file. They are excluded from every utilization denominator and their occupancy is reported separately, never folded into the network percentage.',
    affected: facilitiesMissingCapacity.map((f) => `${f.code} - ${f.name}`),
  },
  {
    id: 'dq-missing-region',
    severity: 'medium',
    label: 'Movement records missing a region',
    count: RECORDS_MISSING_REGION,
    detail:
      'Pallet movements that resolved to a warehouse but carry no region code. They are counted at network level and omitted from regional splits, which is why regional pallet flow can be marginally below the network total.',
    affected: ['Source: WMS movement extract, 27-Aug-2026 05:45'],
  },
  {
    id: 'dq-unmapped-warehouse',
    severity: 'high',
    label: 'Unmapped warehouse codes',
    count: UNMAPPED_WAREHOUSE_CODES.length,
    detail:
      'Warehouse codes present in the movement feed that do not exist in the facility master. Their movements are quarantined pending a mapping decision.',
    affected: UNMAPPED_WAREHOUSE_CODES,
  },
  {
    id: 'dq-duplicate-location',
    severity: 'medium',
    label: 'Duplicate location records',
    count: DUPLICATE_LOCATIONS.length,
    detail:
      'The same storage location appears more than once in the extract. Duplicates are excluded from location rollups so capacity is not double counted.',
    affected: DUPLICATE_LOCATIONS.map((l) => `${l.facilityId} / ${l.label} (duplicate of ${l.duplicateOf})`),
  },
  {
    id: 'dq-yard-capacity',
    severity: 'medium',
    label: 'Park & Pay yards with no bay master',
    count: yardsMissingCapacity.length,
    detail:
      'Yards recording vehicle entries with no bay capacity on file. Occupancy is shown; utilization is reported as N/A rather than assumed.',
    affected: yardsMissingCapacity.map((s) => `${s.id} - ${s.name}`),
  },
  {
    id: 'dq-stale-telemetry',
    severity: 'low',
    label: 'Chamber sensors with stale readings',
    count: 4,
    detail:
      'Temperature sensors whose last reading is older than the 12-hour staleness threshold. Their chambers are excluded from the compliance calculation.',
    affected: ['SNL-DDN-01 / CH-01', 'SNL-DDN-01 / CH-02', 'SNL-RNC-01 / CH-01', 'SNL-HBX-01 / CH-02'],
  },
]

const RECORDS_WITH_ISSUES =
  RECORDS_MISSING_REGION + DUPLICATE_LOCATIONS.length + UNMAPPED_WAREHOUSE_CODES.length * 214

export const DATA_QUALITY_REPORT: DataQualityReport = {
  lastRefreshAt: LAST_REFRESH_AT,
  lastSuccessfulRefreshAt: LAST_SUCCESSFUL_REFRESH_AT,
  sourceSystems: [
    { name: 'WMS - stock snapshot', status: 'OK', lastLoadAt: LAST_REFRESH_AT, records: 162_940 },
    { name: 'WMS - movement extract', status: 'OK', lastLoadAt: LAST_REFRESH_AT, records: 71_318 },
    { name: 'Capacity master', status: 'DEGRADED', lastLoadAt: '2026-08-24T05:45:00+05:30', records: 512 },
    { name: 'Chamber telemetry', status: 'OK', lastLoadAt: '2026-08-27T05:30:00+05:30', records: 13_841 },
    { name: 'Depositor billing extract', status: 'OK', lastLoadAt: LAST_REFRESH_AT, records: 1_284 },
  ],
  recordsProcessed: RECORDS_PROCESSED,
  recordsRejected: RECORDS_REJECTED,
  healthScorePct: Number(
    (((RECORDS_PROCESSED - RECORDS_REJECTED - RECORDS_WITH_ISSUES) / RECORDS_PROCESSED) * 100).toFixed(1),
  ),
  issues: DATA_QUALITY_ISSUES,
}

/** Locations excluded from rollups because they are duplicates. */
export const LOCATION_COUNT = LOCATIONS.length
