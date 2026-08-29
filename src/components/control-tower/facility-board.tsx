'use client'

import * as React from 'react'
import Link from 'next/link'
import type { ColumnDef } from '@tanstack/react-table'
import type { FacilityRollup } from '@/lib/domain/types'
import { DataTable } from '@/components/ui/data-table'
import {
  Card,
  CardHeader,
  DeltaChip,
  Segmented,
  SeverityChip,
  Sparkline,
  StatusChip,
  Value,
} from '@/components/ui/primitives'
import type { ExportColumn } from '@/lib/export/exporters'
import { SEVERITY_RANK } from '@/lib/config/thresholds'
import { formatNumber, formatPct, formatPp } from '@/lib/utils'
import { FACILITY_TYPE_LABEL } from '@/lib/data/master'

export const FACILITY_EXPORT_COLUMNS: ExportColumn<FacilityRollup>[] = [
  { key: 'code', header: 'Facility code', value: (f) => f.code },
  { key: 'name', header: 'Facility', value: (f) => f.name },
  { key: 'region', header: 'Region', value: (f) => f.regionId },
  { key: 'city', header: 'City', value: (f) => f.cityName },
  { key: 'type', header: 'Type', value: (f) => FACILITY_TYPE_LABEL[f.type] },
  { key: 'capacity', header: 'Capacity', value: (f) => f.capacity },
  { key: 'utilized', header: 'Utilized', value: (f) => f.utilizedPallets },
  { key: 'empty', header: 'Empty (net)', value: (f) => f.netEmptyPallets },
  { key: 'available', header: 'Available', value: (f) => f.availableCapacity },
  { key: 'over', header: 'Over capacity', value: (f) => f.overCapacityPallets },
  { key: 'utilization', header: 'Utilization %', value: (f) => (f.utilizationPct === null ? null : Number(f.utilizationPct.toFixed(2))) },
  { key: 'target', header: 'Budget %', value: (f) => f.targetPct },
  { key: 'variance', header: 'Variance pp', value: (f) => (f.variancePct === null ? null : Number(f.variancePct.toFixed(2))) },
  { key: 'change7d', header: '7-day change pp', value: (f) => (f.change7dPct === null ? null : Number(f.change7dPct.toFixed(2))) },
  { key: 'forecast7', header: '7-day forecast %', value: (f) => (f.forecast7dPct === null ? null : Number(f.forecast7dPct.toFixed(2))) },
  { key: 'forecast14', header: '14-day forecast %', value: (f) => (f.forecast14dPct === null ? null : Number(f.forecast14dPct.toFixed(2))) },
  { key: 'forecast30', header: '30-day forecast %', value: (f) => (f.forecast30dPct === null ? null : Number(f.forecast30dPct.toFixed(2))) },
  { key: 'breach', header: 'Expected breach date', value: (f) => f.expectedBreachDate },
  { key: 'risk', header: 'Risk', value: (f) => f.risk },
  { key: 'reason', header: 'Primary reason', value: (f) => f.primaryReason },
  { key: 'owner', header: 'Owner', value: (f) => f.owner },
]

type BoardScope = '10' | '20' | 'all'

/**
 * Facility exception board.
 *
 * The heart of the exception-first design: the facilities that need someone
 * to do something today, ordered by risk, each carrying the reason it is
 * listed and the person accountable for it. Facilities with nothing wrong are
 * not shown by default - a clean facility does not need management attention.
 */
export function FacilityExceptionBoard({
  facilities,
  reportDate,
  onSelect,
  title = 'Facility Exception Board',
  defaultScope = '10',
}: {
  facilities: FacilityRollup[]
  reportDate: string
  onSelect?: (facility: FacilityRollup) => void
  title?: string
  defaultScope?: BoardScope
}) {
  const [scope, setScope] = React.useState<BoardScope>(defaultScope)

  const ranked = React.useMemo(() => {
    const flagged = facilities.filter((f) => f.primaryReason !== null)
    const sorted = [...flagged].sort((a, b) => {
      const bySeverity = SEVERITY_RANK[a.risk] - SEVERITY_RANK[b.risk]
      if (bySeverity !== 0) return bySeverity
      return (b.utilizationPct ?? 0) - (a.utilizationPct ?? 0)
    })
    if (scope === 'all') return sorted
    return sorted.slice(0, Number(scope))
  }, [facilities, scope])

  const columns = React.useMemo<ColumnDef<FacilityRollup, unknown>[]>(
    () => [
      {
        id: 'facility',
        header: 'Facility',
        accessorFn: (row) => `${row.code} ${row.name} ${row.cityName}`,
        cell: ({ row }) => (
          <div className="w-32">
            <Link
              href={`/warehouses/${encodeURIComponent(row.original.facilityId)}`}
              className="text-[12px] font-semibold text-brand-600 hover:text-brand-700 hover:underline"
              onClick={(e) => e.stopPropagation()}
            >
              {row.original.code}
            </Link>
            <p className="truncate text-[11px] text-ink-soft">{row.original.name}</p>
            <p className="truncate text-[10px] text-ink-faint" title={`${row.original.cityName} · ${FACILITY_TYPE_LABEL[row.original.type]}`}>
              {row.original.cityName} · {FACILITY_TYPE_LABEL[row.original.type]}
            </p>
          </div>
        ),
      },
      {
        id: 'region',
        header: 'Region',
        accessorFn: (row) => row.regionId,
        cell: ({ row }) => <span className="text-[11px] font-medium">{row.original.regionId}</span>,
      },
      {
        id: 'capacity',
        header: 'Capacity',
        accessorFn: (row) => row.capacity ?? -1,
        cell: ({ row }) => (
          <span className="tnum">
            <Value missing={row.original.capacity === null} reason="No capacity master row for this facility.">
              {formatNumber(row.original.capacity)}
            </Value>
          </span>
        ),
        meta: { align: 'right' },
      },
      {
        id: 'utilized',
        header: 'Utilized',
        accessorFn: (row) => row.utilizedPallets,
        cell: ({ row }) => <span className="tnum">{formatNumber(row.original.utilizedPallets)}</span>,
        meta: { align: 'right' },
      },
      {
        id: 'empty',
        header: 'Empty',
        accessorFn: (row) => row.netEmptyPallets ?? 0,
        cell: ({ row }) => (
          <span className={`tnum ${(row.original.netEmptyPallets ?? 0) < 0 ? 'font-semibold text-bad' : ''}`}>
            <Value missing={row.original.netEmptyPallets === null}>{formatNumber(row.original.netEmptyPallets)}</Value>
          </span>
        ),
        meta: { align: 'right' },
      },
      {
        id: 'utilization',
        header: 'Utilization',
        accessorFn: (row) => row.utilizationPct ?? -1,
        cell: ({ row }) => {
          const pct = row.original.utilizationPct
          const over = (pct ?? 0) > 100
          return (
            <div className="flex items-center justify-end gap-1.5">
              <span className={`tnum text-[12px] font-bold ${over ? 'text-bad' : 'text-ink'}`}>
                <Value missing={pct === null} reason="Capacity master missing — utilization is not computable.">
                  {formatPct(pct, 1)}
                </Value>
              </span>
              <StatusChip status={row.original.status} size="xs" label={over ? 'Over' : undefined} />
            </div>
          )
        },
        meta: { align: 'right' },
      },
      {
        id: 'target',
        header: 'Budget',
        accessorFn: (row) => row.targetPct,
        cell: ({ row }) => <span className="tnum text-ink-muted">{row.original.targetPct}%</span>,
        meta: { align: 'right' },
      },
      {
        id: 'variance',
        header: 'Variance',
        accessorFn: (row) => row.variancePct ?? 0,
        cell: ({ row }) => (
          <span className="tnum text-[11.5px]">
            <Value missing={row.original.variancePct === null}>{formatPp(row.original.variancePct, 1)}</Value>
          </span>
        ),
        meta: { align: 'right' },
      },
      {
        id: 'trend',
        header: '7D trend',
        accessorFn: (row) => row.change7dPct ?? 0,
        cell: ({ row }) => (
          <div className="flex flex-col items-end gap-0.5">
            <Sparkline
              values={row.original.spark}
              width={56}
              height={18}
              status={row.original.status}
              label={`14-day utilization trend for ${row.original.code}`}
            />
            <DeltaChip value={row.original.change7dPct} digits={1} />
          </div>
        ),
        meta: { align: 'right' },
      },
      {
        id: 'forecast30',
        header: '30D forecast',
        accessorFn: (row) => row.forecast30dPct ?? 0,
        cell: ({ row }) => (
          <div className="text-right">
            <span className="tnum text-[11.5px] font-medium text-ink-soft">{formatPct(row.original.forecast30dPct, 1)}</span>
            {row.original.expectedBreachDate ? (
              <p className="text-[9.5px] text-warn">breach {row.original.expectedBreachDate.slice(5)}</p>
            ) : null}
          </div>
        ),
        meta: { align: 'right' },
      },
      {
        id: 'risk',
        header: 'Risk',
        accessorFn: (row) => SEVERITY_RANK[row.risk],
        cell: ({ row }) => <SeverityChip severity={row.original.risk} />,
        meta: { align: 'center' },
      },
      {
        id: 'reason',
        header: 'Primary reason',
        accessorFn: (row) => row.primaryReason ?? '',
        cell: ({ row }) => (
          <span className="block w-[5.5rem] text-[11px] font-medium leading-snug text-ink-soft">
            {row.original.primaryReason ?? '—'}
          </span>
        ),
      },
      {
        id: 'owner',
        header: 'Owner',
        accessorFn: (row) => row.owner,
        cell: ({ row }) => (
          <span className="block w-[4.5rem] truncate text-[11px] text-ink-muted" title={row.original.owner}>
            {row.original.owner}
          </span>
        ),
      },
    ],
    [],
  )

  return (
    <Card>
      <CardHeader
        title={title}
        subtitle={`${ranked.length} of ${facilities.length} facilities require attention · ordered by risk`}
        tip="A facility appears here only when a rule fires against it: over capacity, a rapid change, a projected breach, under-utilization, an open temperature or FEFO event, or a missing capacity master row. The reason column names which rule. Click a row for the full detail and recommended action."
        actions={
          <Segmented
            options={[
              { value: '10', label: 'Top 10' },
              { value: '20', label: 'Top 20' },
              { value: 'all', label: 'All' },
            ]}
            value={scope}
            onChange={setScope}
            ariaLabel="Number of facilities shown"
          />
        }
      />
      <DataTable
        caption="Facilities requiring management attention"
        data={ranked}
        columns={columns}
        exportColumns={FACILITY_EXPORT_COLUMNS}
        exportMeta={{ title: 'Facility Exception Board', reportDate, generatedAt: reportDate }}
        searchPlaceholder="Search facility, city, reason"
        onRowClick={onSelect}
        rowId={(row) => row.facilityId}
        dense
        pageSize={scope === 'all' ? 15 : 20}
        emptyMessage="No facility is currently breaching a configured threshold."
      />
    </Card>
  )
}
