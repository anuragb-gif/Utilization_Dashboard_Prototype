'use client'

import * as React from 'react'
import Link from 'next/link'
import type { ColumnDef } from '@tanstack/react-table'
import type { FacilityRollup } from '@/lib/domain/types'
import { PageHeader } from '@/components/layout/page-header'
import { CapacityWaterfall } from '@/components/charts/capacity-waterfall'
import { CapacityRiskForecast } from '@/components/control-tower/capacity-risk'
import { ZoneUtilizationChart } from '@/components/charts/mini-charts'
import { DataTable } from '@/components/ui/data-table'
import { FACILITY_EXPORT_COLUMNS } from '@/components/control-tower/facility-board'
import { Card, CardHeader, InfoTip, SectionTitle, StatusChip, UtilizationBar, Value } from '@/components/ui/primitives'
import { useSnapshot } from '@/lib/state/use-snapshot'
import { useFilters } from '@/lib/state/filter-context'
import { THRESHOLDS } from '@/lib/config/thresholds'
import { FACILITY_TYPE_LABEL } from '@/lib/data/master'
import { formatNumber, formatPct } from '@/lib/utils'
import { describeFilters } from '@/components/panels/location-table'

export default function CapacityPage() {
  const snapshot = useSnapshot()
  const { filters } = useFilters()

  const emptyByRegion = React.useMemo(
    () =>
      [...snapshot.regions]
        .filter((r) => r.availableCapacity !== null)
        .sort((a, b) => (b.availableCapacity ?? 0) - (a.availableCapacity ?? 0)),
    [snapshot.regions],
  )

  /**
   * Under-utilized facilities.
   *
   * Empty positions are NOT waste by default - they are available capacity.
   * A facility is only called under-utilized when it sits below the
   * configured threshold, which is what the business rule actually says.
   */
  const underUtilized = React.useMemo(
    () =>
      snapshot.facilities
        .filter((f) => f.utilizationPct !== null && f.utilizationPct < THRESHOLDS.underUtilizedPct)
        .sort((a, b) => (a.utilizationPct ?? 0) - (b.utilizationPct ?? 0)),
    [snapshot.facilities],
  )

  const fcd = React.useMemo(
    () => snapshot.facilities.filter((f) => f.type === 'FORWARD_COLD_DEPOT'),
    [snapshot.facilities],
  )
  const fcdTotals = React.useMemo(
    () =>
      fcd.reduce(
        (acc, f) => ({
          capacity: acc.capacity + (f.capacity ?? 0),
          occupied: acc.occupied + f.utilizedPallets,
          available: acc.available + (f.availableCapacity ?? 0),
        }),
        { capacity: 0, occupied: 0, available: 0 },
      ),
    [fcd],
  )

  const columns = React.useMemo<ColumnDef<FacilityRollup, unknown>[]>(
    () => [
      {
        id: 'facility',
        header: 'Facility',
        accessorFn: (row) => `${row.code} ${row.name} ${row.cityName}`,
        cell: ({ row }) => (
          <div>
            <Link
              href={`/warehouses/${encodeURIComponent(row.original.facilityId)}`}
              className="text-[12px] font-semibold text-brand-600 hover:underline"
            >
              {row.original.code}
            </Link>
            <p className="text-[10.5px] text-ink-muted">{row.original.name}</p>
          </div>
        ),
      },
      { id: 'region', header: 'Region', accessorFn: (row) => row.regionId, cell: ({ row }) => row.original.regionId },
      {
        id: 'type',
        header: 'Type',
        accessorFn: (row) => row.type,
        cell: ({ row }) => <span className="text-[11px]">{FACILITY_TYPE_LABEL[row.original.type]}</span>,
      },
      {
        id: 'capacity',
        header: 'Capacity',
        accessorFn: (row) => row.capacity ?? -1,
        cell: ({ row }) => (
          <span className="tnum">
            <Value missing={row.original.capacity === null}>{formatNumber(row.original.capacity)}</Value>
          </span>
        ),
        meta: { align: 'right' },
      },
      {
        id: 'occupied',
        header: 'Occupied',
        accessorFn: (row) => row.utilizedPallets,
        cell: ({ row }) => <span className="tnum">{formatNumber(row.original.utilizedPallets)}</span>,
        meta: { align: 'right' },
      },
      {
        id: 'available',
        header: 'Available',
        accessorFn: (row) => row.availableCapacity ?? -1,
        cell: ({ row }) => (
          <span className="tnum font-semibold text-brand-700">
            <Value missing={row.original.availableCapacity === null}>{formatNumber(row.original.availableCapacity)}</Value>
          </span>
        ),
        meta: { align: 'right' },
      },
      {
        id: 'over',
        header: 'Over',
        accessorFn: (row) => row.overCapacityPallets,
        cell: ({ row }) =>
          row.original.overCapacityPallets > 0 ? (
            <span className="tnum font-semibold text-bad">+{formatNumber(row.original.overCapacityPallets)}</span>
          ) : (
            <span className="text-ink-faint">—</span>
          ),
        meta: { align: 'right' },
      },
      {
        id: 'utilization',
        header: 'Utilization',
        accessorFn: (row) => row.utilizationPct ?? -1,
        cell: ({ row }) => (
          <div className="min-w-24">
            <div className="flex items-center justify-end gap-1.5">
              <span className={`tnum text-[12px] font-bold ${(row.original.utilizationPct ?? 0) > 100 ? 'text-bad' : ''}`}>
                <Value missing={row.original.utilizationPct === null}>{formatPct(row.original.utilizationPct, 1)}</Value>
              </span>
              <StatusChip status={row.original.status} size="xs" />
            </div>
            <UtilizationBar pct={row.original.utilizationPct} targetPct={row.original.targetPct} className="mt-1" />
          </div>
        ),
        meta: { align: 'right' },
      },
    ],
    [],
  )

  const availablePct =
    snapshot.network.capacity === null || snapshot.network.capacity === 0 || snapshot.network.availableCapacity === null
      ? null
      : (snapshot.network.availableCapacity / snapshot.network.capacity) * 100

  return (
    <div className="space-y-4">
      <PageHeader
        title="Capacity & Utilization"
        description="Where the network's pallet positions sit today, how much is genuinely sellable, and which facilities are projected to run out of room."
        crumbs={[{ label: 'Control Tower', href: '/' }, { label: 'Capacity' }]}
      />

      <div className="grid items-start gap-3 xl:grid-cols-[460px_1fr]">
        <Card>
          <CardHeader title="Capacity Waterfall" subtitle="Capacity → occupied → available → over capacity" />
          <CapacityWaterfall rollup={snapshot.network} height={200} />
        </Card>

        <Card>
          <CardHeader
            title="Available Capacity Analysis"
            subtitle="Empty positions are available capacity, not waste, until a business threshold says otherwise"
            tip={`This panel deliberately calls empty positions "available capacity". A facility is only described as under-utilized when it falls below the configured ${THRESHOLDS.underUtilizedPct}% threshold — editable in Settings. Nothing here classifies empty space as waste on its own.`}
          />
          <div className="grid gap-3 px-4 py-3 md:grid-cols-3">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-ink-faint">Total available</p>
              <p className="tnum text-[24px] font-bold text-ink">{formatNumber(snapshot.network.availableCapacity)}</p>
              <p className="tnum text-[11px] text-ink-muted">{formatPct(availablePct, 1)} of network capacity</p>
            </div>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-ink-faint">Legacy empty figure</p>
              <p className="tnum text-[24px] font-bold text-ink-muted">{formatNumber(snapshot.network.netEmptyPallets)}</p>
              <p className="text-[11px] text-ink-muted">capacity − occupied, net of over-capacity</p>
            </div>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-ink-faint">Under-utilized facilities</p>
              <p className="tnum text-[24px] font-bold text-warn">{underUtilized.length}</p>
              <p className="text-[11px] text-ink-muted">below the {THRESHOLDS.underUtilizedPct}% threshold</p>
            </div>
          </div>

          <div className="grid gap-4 border-t border-hairline px-4 py-3 md:grid-cols-2">
            <div>
              <SectionTitle className="mb-2">Available capacity by region</SectionTitle>
              <ul className="space-y-1.5">
                {emptyByRegion.map((region) => {
                  const share =
                    snapshot.network.availableCapacity === null || snapshot.network.availableCapacity === 0
                      ? 0
                      : ((region.availableCapacity ?? 0) / snapshot.network.availableCapacity) * 100
                  return (
                    <li key={region.regionId}>
                      <Link
                        href={`/regions/${encodeURIComponent(region.regionId)}`}
                        className="group flex items-center gap-2 rounded px-1 py-0.5 transition-colors hover:bg-slate-50"
                      >
                        <span className="w-16 text-[11.5px] font-semibold text-ink">{region.regionId}</span>
                        <span className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
                          <span className="block h-full rounded-full bg-brand-300" style={{ width: `${share}%` }} />
                        </span>
                        <span className="tnum w-16 text-right text-[11.5px] font-semibold text-ink">
                          {formatNumber(region.availableCapacity)}
                        </span>
                        <span className="tnum w-12 text-right text-[10.5px] text-ink-muted">{share.toFixed(1)}%</span>
                      </Link>
                    </li>
                  )
                })}
              </ul>
            </div>

            <div>
              <SectionTitle className="mb-2">Utilization by temperature zone</SectionTitle>
              <ZoneUtilizationChart zones={snapshot.zones} height={150} />
            </div>
          </div>

          {underUtilized.length > 0 ? (
            <div className="border-t border-hairline bg-warn-soft/40 px-4 py-3">
              <p className="flex items-center gap-1.5 text-[11.5px] font-semibold text-[#8a5b08]">
                Potentially under-utilized facilities
                <InfoTip
                  label="Under-utilized"
                  text={`Listed because utilization is below the configured ${THRESHOLDS.underUtilizedPct}% threshold. This is a prompt for a commercial review, not a judgement that the space is wasted — a newly commissioned facility legitimately sits here while it fills.`}
                />
              </p>
              <ul className="mt-1.5 flex flex-wrap gap-2">
                {underUtilized.map((facility) => (
                  <li key={facility.facilityId}>
                    <Link
                      href={`/warehouses/${encodeURIComponent(facility.facilityId)}`}
                      className="tnum inline-flex items-center gap-1.5 rounded border border-warn-line bg-surface px-2 py-1 text-[11px] font-medium text-ink transition-colors hover:bg-warn-soft"
                    >
                      {facility.code}
                      <span className="font-bold">{formatPct(facility.utilizationPct, 1)}</span>
                      <span className="text-ink-muted">{formatNumber(facility.availableCapacity)} free</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </Card>
      </div>

      <CapacityRiskForecast facilities={snapshot.facilities} limit={20} showAllHref="/exceptions" />

      <Card>
        <CardHeader
          title="Forward Cold Depot (FCD) Summary"
          subtitle="The FCD block carried across from the legacy daily report"
          tip="Forward Cold Depots are the last-mile depots between a distribution centre and the customer. The legacy report published FCD capacity, utilized and empty pallets as a separate block; that view is preserved here rather than dropped because it did not fit a new layout."
        />
        <dl className="grid grid-cols-2 gap-4 px-4 py-3 sm:grid-cols-4">
          <div>
            <dt className="text-[10px] font-semibold uppercase tracking-wider text-ink-faint">FCD count</dt>
            <dd className="tnum text-[20px] font-bold text-ink">{fcd.length}</dd>
          </div>
          <div>
            <dt className="text-[10px] font-semibold uppercase tracking-wider text-ink-faint">FCD capacity</dt>
            <dd className="tnum text-[20px] font-bold text-ink">{formatNumber(fcdTotals.capacity)}</dd>
          </div>
          <div>
            <dt className="text-[10px] font-semibold uppercase tracking-wider text-ink-faint">FCD utilized pallets</dt>
            <dd className="tnum text-[20px] font-bold text-ink">{formatNumber(fcdTotals.occupied)}</dd>
          </div>
          <div>
            <dt className="text-[10px] font-semibold uppercase tracking-wider text-ink-faint">FCD empty pallets</dt>
            <dd className="tnum text-[20px] font-bold text-ink">{formatNumber(fcdTotals.available)}</dd>
          </div>
        </dl>
      </Card>

      <Card>
        <CardHeader title="Warehouse Capacity" subtitle="Every facility in scope, sortable and exportable" />
        <DataTable
        caption="Warehouse capacity and utilization"
          data={snapshot.facilities}
          columns={columns}
          exportColumns={FACILITY_EXPORT_COLUMNS}
          exportMeta={{
            title: 'Warehouse Capacity',
            reportDate: snapshot.network.reportDate,
            generatedAt: snapshot.lastRefreshAt,
            filters: describeFilters(filters),
          }}
          searchPlaceholder="Search facility, city, region"
          initialSorting={[{ id: 'utilization', desc: true }]}
          pageSize={15}
        />
      </Card>
    </div>
  )
}
