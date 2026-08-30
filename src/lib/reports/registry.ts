'use client'

/**
 * Report registry.
 *
 * The Report Centre is not a list of buttons that do nothing: each entry here
 * declares the columns and produces the rows, so Preview, CSV and XLSX all
 * render exactly the same data. Adding a report means adding one entry.
 */

import type { ControlTowerSnapshot } from '@/lib/repository'
import type { CellValue, ExportColumn } from '@/lib/export/exporters'
import { dataSource } from '@/lib/repository'
import { EXCEPTION_CATEGORY_LABEL } from '@/lib/domain/exceptions'
import { EXECUTION_LABEL, FACILITY_TYPE_LABEL, OWNERSHIP_LABEL, ZONE_BY_ID } from '@/lib/data/master'
import { FEFO_BREACHES } from '@/lib/data/coldchain'
import { NEAR_EXPIRY_BUCKET_IDS } from '@/lib/data/inventory'
import { KPI_DEFINITIONS } from '@/lib/config/kpi-definitions'

export interface ReportDefinition {
  id: string
  name: string
  description: string
  /** Who this report is produced for. */
  audience: string
  frequency: string
  /** Column headers, in order. */
  headers: string[]
  /** Row values, aligned to headers. `null` renders as N/A everywhere. */
  rows: (snapshot: ControlTowerSnapshot) => CellValue[][]
}

function round(value: number | null, digits = 2): number | null {
  return value === null || !Number.isFinite(value) ? null : Number(value.toFixed(digits))
}

export const REPORTS: ReportDefinition[] = [
  {
    id: 'daily-pan-india',
    name: 'Daily Pan-India Utilization',
    description: 'The headline network position: capacity, occupancy, available headroom and variance to budget.',
    audience: 'LT / Executive',
    frequency: 'Daily, 05:45 IST',
    headers: ['Measure', 'Value', 'Unit', 'Comparison', 'Variance'],
    rows: (s) => [
      ['Network utilization', round(s.network.utilizationPct), '%', `budget ${s.network.targetPct}%`, round(s.network.variancePct)],
      ['Total capacity', s.network.capacity, 'pallet positions', null, null],
      ['Utilized pallets', s.network.utilizedPallets, 'pallets', 'previous day', round(s.network.comparison.previousDayPct)],
      ['Empty pallets (legacy definition)', s.network.netEmptyPallets, 'pallets', null, null],
      ['Available capacity', s.network.availableCapacity, 'pallets', null, null],
      ['Over-capacity pallets', s.network.overCapacityPallets, 'pallets', 'threshold 0', s.network.overCapacityPallets],
      ['Facilities over capacity', s.network.overCapacityFacilities, 'facilities', null, null],
      ['7-day change', round(s.network.change7dPp), 'pp', '7 days prior', round(s.network.change7dPp)],
      ['Same period last year', round(s.network.comparison.samePeriodLastYearPct), '%', null, null],
      ['7-day forecast', round(s.network.forecast.horizon7Pct), '% (prototype forecast)', null, null],
      ['14-day forecast', round(s.network.forecast.horizon14Pct), '% (prototype forecast)', null, null],
      ['30-day forecast', round(s.network.forecast.horizon30Pct), '% (prototype forecast)', null, null],
      ['Network health score', s.health.score, 'out of 100', 'target 90', s.health.score - 90],
      ['Occupied pallets excluded (no capacity master)', s.network.excludedUtilizedPallets, 'pallets', null, null],
    ],
  },
  {
    id: 'region-utilization',
    name: 'Region Utilization',
    description: 'Every region with capacity, occupancy, variance to budget, 7-day movement and forecast risk.',
    audience: 'National Operations, Regional Heads',
    frequency: 'Daily, 05:45 IST',
    headers: ['Region', 'Capacity', 'Utilized', 'Empty (net)', 'Available', 'Over capacity', 'Utilization %', 'Budget %', 'Variance pp', '7-day pp', '30-day forecast %', 'Risk', 'Facilities'],
    rows: (s) =>
      s.regions.map((r) => [
        r.regionId,
        r.capacity,
        r.utilizedPallets,
        r.netEmptyPallets,
        r.availableCapacity,
        r.overCapacityPallets,
        round(r.utilizationPct),
        r.targetPct,
        round(r.variancePct),
        round(r.change7dPct),
        round(r.forecast30dPct),
        r.risk,
        r.facilityCount,
      ]),
  },
  {
    id: 'warehouse-capacity',
    name: 'Warehouse Capacity',
    description: 'Facility-level capacity master against occupancy, with ownership and execution model.',
    audience: 'National Operations',
    frequency: 'Daily, 05:45 IST',
    headers: ['Code', 'Facility', 'Region', 'City', 'Type', 'Ownership', 'Execution', 'Capacity', 'Utilized', 'Available', 'Over capacity', 'Utilization %', 'Budget %', 'Manager'],
    rows: (s) =>
      s.facilities.map((f) => [
        f.code,
        f.name,
        f.regionId,
        f.cityName,
        FACILITY_TYPE_LABEL[f.type],
        OWNERSHIP_LABEL[f.ownership],
        EXECUTION_LABEL[f.execution],
        f.capacity,
        f.utilizedPallets,
        f.availableCapacity,
        f.overCapacityPallets,
        round(f.utilizationPct),
        f.targetPct,
        f.owner,
      ]),
  },
  {
    id: 'empty-pallet',
    name: 'Empty Pallet Report',
    description: 'Available headroom by facility, alongside the legacy net-empty figure so the two can be reconciled.',
    audience: 'National Operations, Commercial',
    frequency: 'Daily, 05:45 IST',
    headers: ['Code', 'Facility', 'Region', 'Capacity', 'Utilized', 'Empty (net, legacy)', 'Available (positive headroom)', 'Available %', 'Status'],
    rows: (s) =>
      s.facilities.map((f) => [
        f.code,
        f.name,
        f.regionId,
        f.capacity,
        f.utilizedPallets,
        f.netEmptyPallets,
        f.availableCapacity,
        f.capacity === null || f.capacity === 0 || f.availableCapacity === null
          ? null
          : round((f.availableCapacity / f.capacity) * 100, 1),
        f.status,
      ]),
  },
  {
    id: 'cold-depot',
    name: 'Cold Depot Report',
    description: 'Last-mile cold depots only — capacity, utilized and empty pallets. (Distinct from "FCD Pallets" in the legacy report, which is the Frozen + Chilled + Dry row total.)',
    audience: 'Regional Heads',
    frequency: 'Daily, 05:45 IST',
    headers: ['Code', 'Facility', 'Region', 'City', 'Capacity', 'Utilized', 'Empty', 'Utilization %', 'Status'],
    rows: (s) =>
      s.facilities
        .filter((f) => f.type === 'FORWARD_COLD_DEPOT')
        .map((f) => [f.code, f.name, f.regionId, f.cityName, f.capacity, f.utilizedPallets, f.availableCapacity, round(f.utilizationPct), f.status]),
  },
  {
    id: 'dpr',
    name: 'DPR Report',
    description: `Carried across from the legacy report. ${KPI_DEFINITIONS.dpr.definitionPending}`,
    audience: 'National Operations',
    frequency: 'Daily, 05:45 IST',
    headers: ['Date', 'DPR', 'Inbound', 'Outbound', 'Opening pallets', 'Closing pallets'],
    rows: (s) =>
      s.operations.flow
        .slice(-30)
        .map((p) => [p.date, p.dpr, p.inbound, p.outbound, p.openingPallets, p.closingPallets]),
  },
  {
    id: 'frozen-chilled',
    name: 'Frozen & Chilled Report',
    description: 'Temperature-zone capacity, occupancy and compliance across the network.',
    audience: 'Quality, Regional Heads',
    frequency: 'Daily, 05:45 IST',
    headers: ['Zone', 'Set point', 'Capacity', 'Occupied', 'Available', 'Utilization %', '7-day pp', 'Temperature compliance %', 'Status'],
    rows: (s) =>
      s.zones.map((z) => [
        z.zoneName,
        z.setPoint,
        z.capacity,
        z.utilizedPallets,
        z.availableCapacity,
        round(z.utilizationPct),
        round(z.change7dPct),
        round(z.temperatureCompliancePct),
        z.status,
      ]),
  },
  {
    id: 'location-utilization',
    name: 'Location Utilization',
    description: 'Chamber-level capacity and occupancy for every storage location in scope.',
    audience: 'Warehouse Managers',
    frequency: 'Daily, 05:45 IST',
    headers: ['Region', 'Warehouse', 'Chamber', 'Location', 'Zone', 'Capacity', 'Occupied', 'Available', 'Utilization %', 'Status'],
    rows: (s) =>
      dataSource
        .queryLocations({ filters: s.filters, page: 0, pageSize: 100_000, sortBy: 'utilization', sortDir: 'desc' })
        .rows.map((r) => [
          r.regionId,
          r.facilityCode,
          r.chamber,
          r.label,
          r.zoneName,
          r.capacity,
          r.utilizedPallets,
          r.availableCapacity,
          round(r.utilizationPct),
          r.status,
        ]),
  },
  {
    id: 'park-and-pay',
    name: 'Park & Pay Utilization',
    description: 'Occupancy of pallet positions rented from third parties, against the contracted capacity at each location. Published as a separate book from the own network.',
    audience: 'Regional Heads, Commercial',
    frequency: 'Daily, 05:45 IST',
    headers: [
      'Region', 'Code', 'Location', 'Partner', 'Contracted positions', 'Occupied',
      'Utilization %', 'Empty (capacity - occupied)', 'Over contracted', 'Contract ends', 'Feed reports contracted as occupied',
    ],
    rows: (s) =>
      s.parkAndPay.sites.map((site) => [
        site.regionId,
        site.code,
        site.name,
        site.partner,
        site.capacity,
        site.utilizedPallets,
        round(site.utilizationPct),
        site.netEmptyPallets,
        site.overCapacityPallets,
        site.contractEndsOn,
        site.reportsContractedAsOccupied ? 'Yes' : 'No',
      ]),
  },
  {
    id: 'basis-comparison',
    name: 'Own vs Park & Pay Comparison',
    description: 'Capacity, occupancy and utilization by region on all three bases: own network, Park & Pay, and the two combined.',
    audience: 'LT / Executive, Commercial',
    frequency: 'Daily, 05:45 IST',
    headers: [
      'Region', 'Own capacity', 'Own occupied', 'Own utilization %',
      'P&P sites', 'P&P capacity', 'P&P occupied', 'P&P utilization %',
      'Combined capacity', 'Combined occupied', 'Combined utilization %', 'Effect of including P&P (pp)',
    ],
    rows: (s) =>
      s.parkAndPay.regions.map((row) => [
        row.regionId,
        row.comparison.own.capacity,
        row.comparison.own.utilizedPallets,
        round(row.comparison.own.utilizationPct),
        row.siteCount,
        row.comparison.parkAndPay.capacity,
        row.comparison.parkAndPay.utilizedPallets,
        round(row.comparison.parkAndPay.utilizationPct),
        row.comparison.combined.capacity,
        row.comparison.combined.utilizedPallets,
        round(row.comparison.combined.utilizationPct),
        round(row.comparison.utilizationImpactPp),
      ]),
  },
  {
    id: 'weekly-comparison',
    name: 'Weekly Utilization Comparison',
    description: 'Week-ending utilization by region and location with the movement between each week, in percentage points.',
    audience: 'LT / Executive, National Operations',
    frequency: 'Weekly, Monday morning',
    headers: ['Level', 'Region', 'Row', 'Name', 'Week ending', 'Utilization %', 'Movement (pp)', 'Window change (pp)', 'Volatility (pp/week)', 'Signals'],
    rows: (s) => {
      const w = dataSource.queryWeeklyComparison({ filters: s.filters, weeks: 4 })
      const flat = [...w.regions.flatMap((g) => [g.region, ...g.facilities]), w.network]
      return flat.flatMap((row) =>
        row.cells.map((cell) => [
          row.kind,
          row.regionId,
          row.label,
          row.sublabel,
          cell.weekEnding,
          cell.utilizationPct,
          cell.changePp,
          row.windowChangePp,
          row.volatilityPp,
          row.flags.length ? row.flags.join('; ') : null,
        ] as CellValue[]),
      )
    },
  },
  {
    id: 'customer-wise-utilization',
    name: 'Customer Wise Utilization',
    description: 'Depositor occupancy by region, location and temperature zone, with the Frozen + Chilled + Dry row total the legacy report calls FCD Pallets.',
    audience: 'National Operations, Commercial',
    frequency: 'Daily, 05:45 IST',
    headers: ['REGION', 'LOCATION', 'CUSTOMER NO', 'CUSTOMER NAME', 'FROZEN', 'CHILLED', 'DRY', 'FCD Pallets', '% of location'],
    rows: (s) =>
      dataSource
        .queryCustomerUtilization({ filters: s.filters, sortBy: 'fcd', sortDir: 'desc' })
        .rows.map((r) => [
          r.regionId,
          r.locationCode,
          r.customerNo,
          r.customerName,
          r.frozen,
          r.chilled,
          r.dry,
          r.fcdPallets,
          r.pctOfLocation,
        ]),
  },
  {
    id: 'inventory-ageing',
    name: 'Inventory Ageing',
    description: 'Days in storage and days to expiry, with the pallets whose expiry date is not supplied reported separately.',
    audience: 'Warehouse Managers, Commercial',
    frequency: 'Daily, 05:45 IST',
    headers: ['Bucket type', 'Bucket', 'Pallets', 'Share of stock %', 'Estimated value (INR lakh)'],
    rows: (s) => {
      const occupied = s.network.utilizedPallets || 1
      const dated = s.expiry.reduce((sum, b) => sum + b.palletCount, 0) || 1
      return [
        ...s.ageing.map((b) => ['Ageing', b.label, b.palletCount, round((b.palletCount / occupied) * 100, 1), b.valueInrLakh] as CellValue[]),
        ...s.expiry.map((b) => ['Expiry', b.label, b.palletCount, round((b.palletCount / dated) * 100, 2), b.valueInrLakh] as CellValue[]),
        ['Expiry', 'Expiry date not supplied', s.expiryUndatedPallets, round((s.expiryUndatedPallets / occupied) * 100, 1), null],
      ]
    },
  },
  {
    id: 'cold-chain-exceptions',
    name: 'Cold Chain Exceptions',
    description: 'Temperature excursions and FEFO breaches with affected pallet counts.',
    audience: 'Quality, Warehouse Managers',
    frequency: 'Continuous, published daily',
    headers: ['Type', 'Reference', 'Facility', 'Region', 'Zone / chamber', 'Raised', 'Detail', 'Pallets', 'Severity', 'Status'],
    rows: (s) => [
      ...s.excursions.map(
        (e) =>
          [
            'Temperature excursion',
            e.id,
            e.facilityId,
            e.regionId,
            `${ZONE_BY_ID[e.zoneId].name} / ${e.chamber}`,
            e.startedAt,
            `Peak deviation ${e.peakDeviationC} °C for ${e.durationMinutes} min`,
            e.affectedPallets,
            e.severity,
            e.status,
          ] as CellValue[],
      ),
      ...FEFO_BREACHES.map(
        (b) =>
          [
            'FEFO breach',
            b.id,
            b.facilityId,
            b.regionId,
            null,
            b.detectedAt,
            `${b.sku}: picked ${b.pickedExpiry}, earlier stock expiring ${b.earlierAvailableExpiry} was available`,
            b.pallets,
            b.pallets >= 40 ? 'high' : 'medium',
            'OPEN',
          ] as CellValue[],
      ),
    ],
  },
  {
    id: 'capacity-forecast',
    name: 'Capacity Forecast',
    description: 'Projected utilization at 7, 14 and 30 days with the expected breach date. Prototype forecast, not a trained model.',
    audience: 'National Operations, Regional Heads',
    frequency: 'Daily, 05:45 IST',
    headers: ['Code', 'Facility', 'Region', 'Current %', '7-day %', '14-day %', '30-day %', 'Expected breach date', 'Risk'],
    rows: (s) =>
      s.facilities.map((f) => [
        f.code,
        f.name,
        f.regionId,
        round(f.utilizationPct, 1),
        round(f.forecast7dPct, 1),
        round(f.forecast14dPct, 1),
        round(f.forecast30dPct, 1),
        f.expectedBreachDate,
        f.risk,
      ]),
  },
  {
    id: 'management-exception',
    name: 'Management Exception Report',
    description: 'Every open exception with the metric, threshold, variance, owner and recommended action.',
    audience: 'LT / Executive, National Operations',
    frequency: 'Daily, 05:45 IST',
    headers: ['ID', 'Category', 'Severity', 'Raised', 'Region', 'Facility', 'Metric', 'Actual', 'Threshold', 'Variance', 'Unit', 'Reason', 'Recommended action', 'Owner', 'Status'],
    rows: (s) =>
      s.exceptions.map((e) => [
        e.id,
        EXCEPTION_CATEGORY_LABEL[e.category],
        e.severity,
        e.raisedAt,
        e.regionId,
        e.facilityId,
        e.metricLabel,
        e.actual,
        e.threshold,
        e.variance,
        e.unit,
        e.reason,
        e.recommendedAction,
        e.owner,
        e.status,
      ]),
  },
]

/** Adapt a report's headers/rows to the shared export column contract. */
export function reportExportColumns(report: ReportDefinition): ExportColumn<CellValue[]>[] {
  return report.headers.map((header, index) => ({
    key: `col-${index}`,
    header,
    value: (row: CellValue[]) => row[index] ?? null,
  }))
}

export const NEAR_EXPIRY_IDS = NEAR_EXPIRY_BUCKET_IDS
