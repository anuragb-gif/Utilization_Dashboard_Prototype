'use client'

import * as React from 'react'
import Link from 'next/link'
import type { ColumnDef } from '@tanstack/react-table'
import type { Customer } from '@/lib/domain/types'
import { PageHeader } from '@/components/layout/page-header'
import { BucketChart, SEVERITY_FILL } from '@/components/charts/mini-charts'
import { DataTable } from '@/components/ui/data-table'
import { Card, CardHeader, DemoDataBadge, InfoTip, SeverityChip, Value } from '@/components/ui/primitives'
import { useSnapshot } from '@/lib/state/use-snapshot'
import { useSession } from '@/lib/state/session-context'
import { INVENTORY_CONCENTRATION, NEAR_EXPIRY_BUCKET_IDS } from '@/lib/data/inventory'
import { CHART_COLORS } from '@/lib/config/brand'
import { THRESHOLDS } from '@/lib/config/thresholds'
import type { ExportColumn } from '@/lib/export/exporters'
import { formatInrLakh, formatNumber, formatPct } from '@/lib/utils'

const CUSTOMER_EXPORT: ExportColumn<Customer & { sharePct: number | null }>[] = [
  { key: 'name', header: 'Depositor', value: (c) => c.name },
  { key: 'sector', header: 'Sector', value: (c) => c.sector },
  { key: 'pallets', header: 'Occupied pallets', value: (c) => c.occupiedPallets },
  { key: 'share', header: '% of network occupied', value: (c) => (c.sharePct === null ? null : Number(c.sharePct.toFixed(2))) },
  { key: 'change', header: '7-day change (pallets)', value: (c) => c.change7d },
  { key: 'regions', header: 'Regions', value: (c) => c.regionIds.join(', ') },
  { key: 'facilities', header: 'Facilities', value: (c) => c.facilityCount },
  { key: 'revenue', header: 'Monthly storage revenue (INR lakh)', value: (c) => c.monthlyRevenueInrLakh },
]

export default function InventoryPage() {
  const snapshot = useSnapshot()
  const { can } = useSession()
  const showFinancials = can('view:financials')

  const nearExpiry = React.useMemo(
    () => snapshot.expiry.filter((b) => NEAR_EXPIRY_BUCKET_IDS.includes(b.id)),
    [snapshot.expiry],
  )
  const nearExpiryTotal = nearExpiry.reduce((sum, b) => sum + b.palletCount, 0)

  const customers = React.useMemo(() => {
    const total = snapshot.customers.reduce((sum, c) => sum + c.occupiedPallets, 0)
    return snapshot.customers
      .map((c) => ({ ...c, sharePct: total === 0 ? null : (c.occupiedPallets / total) * 100 }))
      .sort((a, b) => b.occupiedPallets - a.occupiedPallets)
  }, [snapshot.customers])

  const top10Share = React.useMemo(() => {
    const total = customers.reduce((sum, c) => sum + c.occupiedPallets, 0)
    const top = customers.filter((c) => c.id !== 'others').slice(0, 10).reduce((sum, c) => sum + c.occupiedPallets, 0)
    return total === 0 ? null : (top / total) * 100
  }, [customers])

  const ageingByFacility = React.useMemo(() => {
    const scope = new Set(snapshot.facilities.map((f) => f.facilityId))
    const map = new Map<string, number>()
    for (const row of INVENTORY_CONCENTRATION) {
      if (row.bucketId !== 'age-60-plus' || !scope.has(row.facilityId)) continue
      map.set(row.facilityId, (map.get(row.facilityId) ?? 0) + row.palletCount)
    }
    return [...map.entries()]
      .map(([facilityId, pallets]) => {
        const facility = snapshot.facilities.find((f) => f.facilityId === facilityId)
        return {
          facilityId,
          code: facility?.code ?? facilityId,
          name: facility?.name ?? 'Unknown',
          regionId: facility?.regionId ?? '',
          pallets,
          share: facility && facility.utilizedPallets > 0 ? (pallets / facility.utilizedPallets) * 100 : null,
        }
      })
      .sort((a, b) => b.pallets - a.pallets)
      .slice(0, 10)
  }, [snapshot.facilities])

  const customerColumns = React.useMemo<ColumnDef<(typeof customers)[number], unknown>[]>(
    () => [
      {
        id: 'name',
        header: 'Depositor',
        accessorFn: (row) => `${row.name} ${row.sector}`,
        cell: ({ row }) => (
          <div>
            <p className="text-[12px] font-semibold text-ink">{row.original.name}</p>
            <p className="text-[10.5px] text-ink-muted">{row.original.sector}</p>
          </div>
        ),
      },
      {
        id: 'pallets',
        header: 'Occupied pallets',
        accessorFn: (row) => row.occupiedPallets,
        cell: ({ row }) => <span className="tnum font-semibold">{formatNumber(row.original.occupiedPallets)}</span>,
        meta: { align: 'right' },
      },
      {
        id: 'share',
        header: '% of network',
        accessorFn: (row) => row.sharePct ?? 0,
        cell: ({ row }) => (
          <div className="flex items-center justify-end gap-2">
            <span className="h-1.5 w-16 overflow-hidden rounded-full bg-slate-100">
              <span
                className="block h-full rounded-full bg-brand-400"
                style={{ width: `${Math.min((row.original.sharePct ?? 0) * 6, 100)}%` }}
              />
            </span>
            <span className="tnum w-12 text-right">{formatPct(row.original.sharePct, 1)}</span>
          </div>
        ),
        meta: { align: 'right' },
      },
      {
        id: 'change',
        header: '7-day trend',
        accessorFn: (row) => row.change7d,
        cell: ({ row }) => (
          <span className={`tnum text-[11.5px] font-semibold ${row.original.change7d >= 0 ? 'text-ok' : 'text-bad'}`}>
            {row.original.change7d > 0 ? '+' : ''}
            {formatNumber(row.original.change7d)}
          </span>
        ),
        meta: { align: 'right' },
      },
      {
        id: 'regions',
        header: 'Regions',
        accessorFn: (row) => row.regionIds.join(','),
        cell: ({ row }) => <span className="text-[10.5px]">{row.original.regionIds.join(', ')}</span>,
      },
      {
        id: 'facilities',
        header: 'Facilities',
        accessorFn: (row) => row.facilityCount,
        cell: ({ row }) => <span className="tnum">{row.original.facilityCount}</span>,
        meta: { align: 'right' },
      },
      ...(showFinancials
        ? [
            {
              id: 'revenue',
              header: 'Monthly revenue',
              accessorFn: (row: (typeof customers)[number]) => row.monthlyRevenueInrLakh ?? -1,
              cell: ({ row }: { row: { original: (typeof customers)[number] } }) => (
                <span className="tnum">
                  <Value
                    missing={row.original.monthlyRevenueInrLakh === null}
                    reason="Billed under a contract the reporting feed does not expose."
                  >
                    {formatInrLakh(row.original.monthlyRevenueInrLakh)}
                  </Value>
                </span>
              ),
              meta: { align: 'right' as const },
            } as ColumnDef<(typeof customers)[number], unknown>,
          ]
        : []),
    ],
    [showFinancials],
  )

  return (
    <div className="space-y-4">
      <PageHeader
        title="Inventory Health"
        description="How long stock has been in store, how close it is to expiry, and which depositors the network's occupancy actually depends on."
        crumbs={[{ label: 'Control Tower', href: '/' }, { label: 'Inventory' }]}
        actions={<DemoDataBadge text="Demo data" />}
      />

      <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
        <Stat
          label="Stock over 60 days"
          value={formatNumber(snapshot.ageing.find((b) => b.id === 'age-60-plus')?.palletCount)}
          note={`${formatPct(
            ((snapshot.ageing.find((b) => b.id === 'age-60-plus')?.palletCount ?? 0) / snapshot.network.utilizedPallets) * 100,
            1,
          )} of occupied pallets`}
        />
        <Stat
          label={`Near expiry (${THRESHOLDS.nearExpiryDays}d)`}
          value={formatNumber(nearExpiryTotal)}
          note={`${formatNumber(snapshot.coldChain.shortCodedPallets)} already short-coded`}
          tone="warn"
        />
        <Stat
          label="Expiring within 7 days"
          value={formatNumber(snapshot.expiry.find((b) => b.id === 'exp-0-7')?.palletCount)}
          note="requires disposition today"
          tone="bad"
        />
        <Stat
          label="Expiry date not supplied"
          value={formatNumber(snapshot.expiryUndatedPallets)}
          note="excluded from expiry buckets, not assumed long-dated"
        />
      </div>

      <div className="grid items-start gap-3 xl:grid-cols-2">
        <Card>
          <CardHeader
            title="Inventory Ageing"
            subtitle="Pallets by days in storage"
            tip="Buckets are allocated from network occupancy, so the ageing profile always sums back to the occupied pallet count on the control tower."
          />
          <BucketChart buckets={snapshot.ageing} height={220} colorFor={() => CHART_COLORS.actual} />
          <table className="w-full border-collapse border-t border-hairline">
            <caption className="sr-only">Inventory Ageing</caption>
            <thead>
              <tr className="text-[10px] uppercase tracking-wider text-ink-faint">
                <th scope="col" className="px-3 py-1.5 text-left font-semibold">Bucket</th>
                <th scope="col" className="px-3 py-1.5 text-right font-semibold">Pallets</th>
                <th scope="col" className="px-3 py-1.5 text-right font-semibold">Share</th>
                {showFinancials ? (
                  <th scope="col" className="px-3 py-1.5 text-right font-semibold">Est. value</th>
                ) : null}
              </tr>
            </thead>
            <tbody>
              {snapshot.ageing.map((bucket) => (
                <tr key={bucket.id} className="border-t border-hairline/70">
                  <td className="px-3 py-1.5 text-[11.5px] font-medium">{bucket.label}</td>
                  <td className="tnum px-3 py-1.5 text-right text-[11.5px]">{formatNumber(bucket.palletCount)}</td>
                  <td className="tnum px-3 py-1.5 text-right text-[11.5px]">
                    {formatPct((bucket.palletCount / snapshot.network.utilizedPallets) * 100, 1)}
                  </td>
                  {showFinancials ? (
                    <td className="tnum px-3 py-1.5 text-right text-[11.5px]">{formatInrLakh(bucket.valueInrLakh)}</td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>
        </Card>

        <Card>
          <CardHeader
            title="Expiry Exposure"
            subtitle={`${formatNumber(snapshot.expiry.reduce((s, b) => s + b.palletCount, 0))} pallets carry a lot expiry date`}
            tip="Only stock with an expiry date in the source extract is bucketed. Pallets without one are reported separately rather than being assumed to be long-dated — assuming would understate the risk."
          />
          <BucketChart buckets={snapshot.expiry} height={220} colorFor={(b) => SEVERITY_FILL[(b as { severity: string }).severity] ?? CHART_COLORS.actual} />
          <table className="w-full border-collapse border-t border-hairline">
            <caption className="sr-only">Expiry Exposure</caption>
            <thead>
              <tr className="text-[10px] uppercase tracking-wider text-ink-faint">
                <th scope="col" className="px-3 py-1.5 text-left font-semibold">Window</th>
                <th scope="col" className="px-3 py-1.5 text-right font-semibold">Pallets</th>
                <th scope="col" className="px-3 py-1.5 text-center font-semibold">Severity</th>
                {showFinancials ? (
                  <th scope="col" className="px-3 py-1.5 text-right font-semibold">Est. value</th>
                ) : null}
              </tr>
            </thead>
            <tbody>
              {snapshot.expiry.map((bucket) => (
                <tr key={bucket.id} className="border-t border-hairline/70">
                  <td className="px-3 py-1.5 text-[11.5px] font-medium">{bucket.label}</td>
                  <td className="tnum px-3 py-1.5 text-right text-[11.5px] font-semibold">
                    {formatNumber(bucket.palletCount)}
                  </td>
                  <td className="px-3 py-1.5 text-center">
                    <SeverityChip severity={bucket.severity} />
                  </td>
                  {showFinancials ? (
                    <td className="tnum px-3 py-1.5 text-right text-[11.5px]">{formatInrLakh(bucket.valueInrLakh)}</td>
                  ) : null}
                </tr>
              ))}
              <tr className="border-t border-hairline bg-slate-50">
                <td className="px-3 py-1.5 text-[11.5px] font-medium text-ink-muted">
                  Expiry date not supplied
                  <InfoTip
                    label="Undated stock"
                    text="These pallets have no lot expiry date in the source extract. They are counted in occupancy but excluded from every expiry bucket, and are listed here so the gap is visible."
                  />
                </td>
                <td className="tnum px-3 py-1.5 text-right text-[11.5px]">{formatNumber(snapshot.expiryUndatedPallets)}</td>
                <td className="px-3 py-1.5 text-center text-[11px] text-ink-faint">Unknown</td>
                {showFinancials ? <td className="px-3 py-1.5 text-right text-[11px] text-ink-faint">N/A</td> : null}
              </tr>
            </tbody>
          </table>
        </Card>
      </div>

      <Card>
        <CardHeader
          title="Where Ageing Stock Sits"
          subtitle="Top facilities by pallets held over 60 days"
          tip="Ageing concentrated in one facility is an operational problem; ageing spread evenly is usually a depositor contract problem. The split matters more than the total."
        />
        <table className="w-full border-collapse">
            <caption className="sr-only">Where Ageing Stock Sits</caption>
          <thead>
            <tr className="border-b border-hairline bg-slate-50/70 text-[10px] uppercase tracking-wider text-ink-muted">
              <th scope="col" className="px-3 py-1.5 text-left font-semibold">Facility</th>
              <th scope="col" className="px-3 py-1.5 text-left font-semibold">Region</th>
              <th scope="col" className="px-3 py-1.5 text-right font-semibold">Pallets over 60 days</th>
              <th scope="col" className="px-3 py-1.5 text-right font-semibold">Share of facility stock</th>
            </tr>
          </thead>
          <tbody>
            {ageingByFacility.map((row) => (
              <tr key={row.facilityId} className="border-b border-hairline/70 last:border-0 hover:bg-slate-50/60">
                <td className="px-3 py-1.5">
                  <Link
                    href={`/warehouses/${encodeURIComponent(row.facilityId)}`}
                    className="text-[11.5px] font-semibold text-brand-600 hover:underline"
                  >
                    {row.code}
                  </Link>
                  <p className="text-[10px] text-ink-faint">{row.name}</p>
                </td>
                <td className="px-3 py-1.5 text-[11.5px]">{row.regionId}</td>
                <td className="tnum px-3 py-1.5 text-right text-[11.5px] font-semibold">{formatNumber(row.pallets)}</td>
                <td className="tnum px-3 py-1.5 text-right text-[11.5px]">{formatPct(row.share, 1)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <Card>
        <CardHeader
          title="Depositor Concentration"
          subtitle={
            top10Share === null
              ? 'Depositor mix'
              : `Top 10 depositors hold ${formatPct(top10Share, 1)} of network occupied capacity`
          }
          tip="Concentration is a capacity-planning input: if one depositor holds a fifth of the network, their promotion calendar is the network's capacity plan. Revenue is visible only to roles with commercial access."
        />
        <DataTable
        caption="Depositor concentration by occupied pallets"
          data={customers}
          columns={customerColumns}
          exportColumns={CUSTOMER_EXPORT}
          exportMeta={{
            title: 'Depositor Concentration',
            reportDate: snapshot.network.reportDate,
            generatedAt: snapshot.lastRefreshAt,
          }}
          searchPlaceholder="Search depositor or sector"
          initialSorting={[{ id: 'pallets', desc: true }]}
          pageSize={12}
        />
      </Card>
    </div>
  )
}

function Stat({
  label,
  value,
  note,
  tone,
}: {
  label: string
  value: string
  note: string
  tone?: 'warn' | 'bad'
}) {
  return (
    <Card className={`p-3 ${tone === 'bad' ? 'border-bad-line bg-bad-soft/40' : tone === 'warn' ? 'border-warn-line bg-warn-soft/40' : ''}`}>
      <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-ink-muted">{label}</p>
      <p className={`tnum mt-1 text-[24px] font-bold ${tone === 'bad' ? 'text-bad' : tone === 'warn' ? 'text-[#8a5b08]' : 'text-ink'}`}>
        {value}
      </p>
      <p className="mt-0.5 text-[10.5px] leading-snug text-ink-muted">{note}</p>
    </Card>
  )
}
