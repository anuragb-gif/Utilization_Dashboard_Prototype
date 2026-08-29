'use client'

import * as React from 'react'
import Link from 'next/link'
import type { ColumnDef } from '@tanstack/react-table'
import { Crown, TrendingDown, TrendingUp } from 'lucide-react'
import type { RegionRollup } from '@/lib/domain/types'
import { DataTable } from '@/components/ui/data-table'
import { Card, CardHeader, DeltaChip, SeverityChip, StatusChip, UtilizationBar, Value } from '@/components/ui/primitives'
import type { ExportColumn } from '@/lib/export/exporters'
import { formatNumber, formatPct, formatPp } from '@/lib/utils'
import { REGION_BY_ID } from '@/lib/data/master'

interface RankedRegion extends RegionRollup {
  rank: number
  flags: string[]
}

const EXPORT_COLUMNS: ExportColumn<RankedRegion>[] = [
  { key: 'rank', header: 'Rank', value: (r) => r.rank },
  { key: 'region', header: 'Region', value: (r) => r.regionId },
  { key: 'head', header: 'Regional head', value: (r) => REGION_BY_ID[r.regionId]?.head ?? null },
  { key: 'capacity', header: 'Capacity', value: (r) => r.capacity },
  { key: 'utilized', header: 'Utilized', value: (r) => r.utilizedPallets },
  { key: 'empty', header: 'Empty (net)', value: (r) => r.netEmptyPallets },
  { key: 'available', header: 'Available', value: (r) => r.availableCapacity },
  { key: 'over', header: 'Over capacity', value: (r) => r.overCapacityPallets },
  { key: 'utilization', header: 'Utilization %', value: (r) => (r.utilizationPct === null ? null : Number(r.utilizationPct.toFixed(2))) },
  { key: 'target', header: 'Budget %', value: (r) => r.targetPct },
  { key: 'variance', header: 'Variance pp', value: (r) => (r.variancePct === null ? null : Number(r.variancePct.toFixed(2))) },
  { key: 'change7d', header: '7-day change pp', value: (r) => (r.change7dPct === null ? null : Number(r.change7dPct.toFixed(2))) },
  { key: 'forecast30', header: '30-day forecast %', value: (r) => (r.forecast30dPct === null ? null : Number(r.forecast30dPct.toFixed(2))) },
  { key: 'risk', header: 'Risk', value: (r) => r.risk },
  { key: 'flags', header: 'Flags', value: (r) => (r.flags.length ? r.flags.join('; ') : null) },
]

const FLAG_STYLE: Record<string, string> = {
  'Highest utilization': 'bg-bad-soft text-[#9b1c1c] border-bad-line',
  'Lowest utilization': 'bg-brand-100 text-brand-700 border-brand-200',
  'Largest deterioration': 'bg-hot-soft text-[#9a4e06] border-hot-line',
  'Largest improvement': 'bg-ok-soft text-[#0b6b4a] border-ok-line',
  'Highest projected risk': 'bg-warn-soft text-[#8a5b08] border-warn-line',
}

export function RegionRanking({ regions, reportDate }: { regions: RegionRollup[]; reportDate: string }) {
  const ranked = React.useMemo<RankedRegion[]>(() => {
    const sorted = [...regions].sort((a, b) => (b.utilizationPct ?? -1) - (a.utilizationPct ?? -1))
    const withValues = sorted.filter((r) => r.utilizationPct !== null)
    const highest = withValues[0]?.regionId
    const lowest = withValues[withValues.length - 1]?.regionId
    // Only flag a direction that actually happened: in a week where every
    // region declined, the least-bad region is not "the largest improvement".
    const byChange = [...regions].filter((r) => r.change7dPct !== null).sort((a, b) => (a.change7dPct ?? 0) - (b.change7dPct ?? 0))
    const worst = (byChange[0]?.change7dPct ?? 0) < 0 ? byChange[0]?.regionId : undefined
    const bestCandidate = byChange[byChange.length - 1]
    const best = (bestCandidate?.change7dPct ?? 0) > 0 ? bestCandidate?.regionId : undefined
    const byForecast = [...regions].filter((r) => r.forecast30dPct !== null).sort((a, b) => (b.forecast30dPct ?? 0) - (a.forecast30dPct ?? 0))
    const riskiest = byForecast[0]?.regionId

    return sorted.map((region, index) => {
      const flags: string[] = []
      if (region.regionId === highest) flags.push('Highest utilization')
      if (region.regionId === lowest) flags.push('Lowest utilization')
      if (region.regionId === worst) flags.push('Largest deterioration')
      if (region.regionId === best) flags.push('Largest improvement')
      if (region.regionId === riskiest) flags.push('Highest projected risk')
      return { ...region, rank: index + 1, flags }
    })
  }, [regions])

  const columns = React.useMemo<ColumnDef<RankedRegion, unknown>[]>(
    () => [
      {
        id: 'rank',
        header: '#',
        accessorFn: (row) => row.rank,
        cell: ({ row }) => <span className="tnum text-[11px] font-semibold text-ink-faint">{row.original.rank}</span>,
        meta: { align: 'center' },
      },
      {
        id: 'region',
        header: 'Region',
        accessorFn: (row) => row.regionId,
        cell: ({ row }) => (
          <div>
            <Link
              href={`/regions/${encodeURIComponent(row.original.regionId)}`}
              className="text-[12px] font-semibold text-brand-600 hover:text-brand-700 hover:underline"
            >
              {row.original.regionId}
            </Link>
            <p className="text-[10px] text-ink-faint">
              {REGION_BY_ID[row.original.regionId]?.head} · {row.original.facilityCount} facilities
            </p>
          </div>
        ),
      },
      {
        id: 'capacity',
        header: 'Capacity',
        accessorFn: (row) => row.capacity ?? -1,
        cell: ({ row }) => <span className="tnum">{formatNumber(row.original.capacity)}</span>,
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
          <span className={row.original.netEmptyPallets !== null && row.original.netEmptyPallets < 0 ? 'tnum font-semibold text-bad' : 'tnum'}>
            {formatNumber(row.original.netEmptyPallets)}
          </span>
        ),
        meta: { align: 'right' },
      },
      {
        id: 'utilization',
        header: 'Utilization',
        accessorFn: (row) => row.utilizationPct ?? -1,
        cell: ({ row }) => {
          const over = (row.original.utilizationPct ?? 0) > 100
          return (
            <div className="min-w-28">
              <div className="flex items-center justify-end gap-1.5">
                <span className={`tnum text-[12px] font-bold ${over ? 'text-bad' : 'text-ink'}`}>
                  {formatPct(row.original.utilizationPct, 1)}
                </span>
                <StatusChip status={row.original.status} size="xs" label={over ? 'Over' : undefined} />
              </div>
              <UtilizationBar pct={row.original.utilizationPct} targetPct={row.original.targetPct} className="mt-1" />
              {over ? (
                <p className="tnum mt-0.5 text-right text-[9.5px] font-bold uppercase tracking-wide text-bad">
                  +{formatNumber(row.original.overCapacityPallets)} pallets over
                </p>
              ) : null}
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
          <span className="tnum text-[11.5px] font-semibold">
            <Value missing={row.original.variancePct === null}>{formatPp(row.original.variancePct)}</Value>
          </span>
        ),
        meta: { align: 'right' },
      },
      {
        id: 'change7d',
        header: '7D change',
        accessorFn: (row) => row.change7dPct ?? 0,
        cell: ({ row }) => <DeltaChip value={row.original.change7dPct} />,
        meta: { align: 'right' },
      },
      {
        id: 'forecast30',
        header: '30D forecast',
        accessorFn: (row) => row.forecast30dPct ?? 0,
        cell: ({ row }) => (
          <span className="tnum text-[11.5px] text-ink-soft">{formatPct(row.original.forecast30dPct, 1)}</span>
        ),
        meta: { align: 'right' },
      },
      {
        id: 'risk',
        header: 'Risk',
        accessorFn: (row) => row.risk,
        cell: ({ row }) => <SeverityChip severity={row.original.risk} />,
        meta: { align: 'center' },
      },
      {
        id: 'flags',
        header: 'Notes',
        enableSorting: false,
        accessorFn: (row) => row.flags.join(' '),
        cell: ({ row }) =>
          row.original.flags.length === 0 ? (
            <span className="text-[11px] text-ink-faint">—</span>
          ) : (
            <div className="flex flex-wrap gap-1">
              {row.original.flags.map((flag) => (
                <span
                  key={flag}
                  className={`inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[9.5px] font-semibold ${FLAG_STYLE[flag] ?? 'border-hairline bg-slate-50 text-ink-muted'}`}
                >
                  {flag === 'Highest utilization' ? <Crown className="h-2.5 w-2.5" strokeWidth={2.5} aria-hidden /> : null}
                  {flag === 'Largest deterioration' ? <TrendingDown className="h-2.5 w-2.5" strokeWidth={2.5} aria-hidden /> : null}
                  {flag === 'Largest improvement' ? <TrendingUp className="h-2.5 w-2.5" strokeWidth={2.5} aria-hidden /> : null}
                  {flag}
                </span>
              ))}
            </div>
          ),
      },
    ],
    [],
  )

  return (
    <Card>
      <CardHeader
        title="Region Ranking"
        subtitle="Ranked by utilization. Click a region to open its detail view."
        tip="Ranking is by utilization on the report date. Flags mark the extremes on utilization, on 7-day movement, and on the 30-day prototype forecast — so the regions worth a conversation surface without reading every row."
      />
      <DataTable
        caption="Region utilization ranking"
        data={ranked}
        columns={columns}
        exportColumns={EXPORT_COLUMNS}
        exportMeta={{
          title: 'Region Utilization Ranking',
          reportDate,
          generatedAt: reportDate,
        }}
        searchPlaceholder="Search regions"
        pageSize={10}
        hideSearch
      />
    </Card>
  )
}
