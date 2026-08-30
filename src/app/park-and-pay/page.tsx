'use client'

import * as React from 'react'
import Link from 'next/link'
import { CalendarClock, Download, Info } from 'lucide-react'
import type { ParkAndPaySiteRow } from '@/lib/repository'
import { PageHeader } from '@/components/layout/page-header'
import {
  Card,
  CardHeader,
  InfoTip,
  SectionTitle,
  Sparkline,
  StatusChip,
  UtilizationBar,
  Value,
} from '@/components/ui/primitives'
import { BasisBands, BasisImpact, CapacityMixBar } from '@/components/panels/basis-bands'
import { useSnapshot } from '@/lib/state/use-snapshot'
import { exportCsv, exportXlsx, type ExportColumn } from '@/lib/export/exporters'
import { describeFilters } from '@/components/panels/location-table'
import { THRESHOLDS } from '@/lib/config/thresholds'
import { cn, formatDate, formatNumber, formatPct, formatPp } from '@/lib/utils'
import type { StatusLevel } from '@/lib/domain/types'

const EXPORT_COLUMNS: ExportColumn<ParkAndPaySiteRow>[] = [
  { key: 'region', header: 'Region', value: (r) => r.regionId },
  { key: 'code', header: 'Code', value: (r) => r.code },
  { key: 'name', header: 'Location Name', value: (r) => r.name },
  { key: 'partner', header: 'Partner', value: (r) => r.partner },
  { key: 'capacity', header: 'Contracted positions', value: (r) => r.capacity },
  { key: 'used', header: 'Occupied', value: (r) => r.utilizedPallets },
  { key: 'pct', header: 'Utilization %', value: (r) => r.utilizationPct },
  { key: 'empty', header: 'Empty (capacity - occupied)', value: (r) => r.netEmptyPallets },
  { key: 'over', header: 'Over contracted', value: (r) => r.overCapacityPallets },
  { key: 'chg', header: '7-day change (pp)', value: (r) => r.change7dPp },
  { key: 'ends', header: 'Contract ends', value: (r) => r.contractEndsOn },
  { key: 'flat', header: 'Feed reports contracted as occupied', value: (r) => (r.reportsContractedAsOccupied ? 'Yes' : 'No') },
]

/**
 * Park & Pay.
 *
 * A separate operating model: pallet positions rented from third parties and
 * sold on to customers. The legacy report publishes it as a region / location
 * grid of capacity and utilization repeated once per day, and that grid is
 * kept - same rows, same codes, same day columns - because it is what gets
 * reconciled. What is added is the reading it cannot give: what the rented
 * book does to the network percentage, where the exposure sits, and which
 * rows are a measurement rather than a contract figure.
 *
 * Rented space fails differently from owned space. It has no structural
 * headroom when it overflows, the contract can lapse, and empty positions are
 * still being paid for - so idle contracted space is put to the reader as a
 * commercial question, never as waste.
 */
export default function ParkAndPayPage() {
  const snapshot = useSnapshot()
  const pnp = snapshot.parkAndPay
  const comparison = pnp.network
  const rows = pnp.sites

  const meta = {
    title: 'Park & Pay Utilization',
    reportDate: snapshot.network.reportDate,
    generatedAt: snapshot.lastRefreshAt,
    filters: describeFilters(snapshot.filters),
  }

  // Region filters narrow Park & Pay; the facility-shaped filters do not apply
  // to rented space at all, so the page says so rather than showing a combined
  // figure that is not comparable with what the other screens are showing.
  const nonRegionFilterActive =
    snapshot.filters.facilityIds.length > 0 ||
    snapshot.filters.zoneIds.length > 0 ||
    snapshot.filters.facilityTypes.length > 0 ||
    snapshot.filters.ownerships.length > 0 ||
    snapshot.filters.executions.length > 0

  const grid = pnp.gridDates
  const totalsRow = pnp.dailyTotals

  if (rows.length === 0) {
    return (
      <div className="space-y-4">
        <PageHeader
          title="Park & Pay"
          description="Pallet positions rented from third parties and sold on to customers."
          crumbs={[{ label: 'Control Tower', href: '/' }, { label: 'Park & Pay' }]}
        />
        <Card className="px-4 py-8 text-center">
          <p className="text-[13px] font-semibold text-ink">No Park &amp; Pay locations in scope</p>
          <p className="mx-auto mt-1 max-w-md text-[11.5px] leading-relaxed text-ink-muted">
            {snapshot.filters.regionIds.length > 0
              ? `${snapshot.filters.regionIds.join(', ')} has no rented space. The own-network figures on every other screen are unaffected.`
              : 'No rented locations were returned by the partner feed.'}
          </p>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="Park & Pay"
        description="Pallet positions rented from third parties and sold on to customers — reported as its own book, and shown against the own network rather than folded into it."
        crumbs={[{ label: 'Control Tower', href: '/' }, { label: 'Park & Pay' }]}
        actions={
          <>
            <button
              type="button"
              onClick={() => exportCsv(rows, EXPORT_COLUMNS, meta)}
              className="inline-flex h-7 items-center gap-1.5 rounded-md border border-hairline bg-surface px-2.5 text-[12px] font-medium text-ink-soft transition-colors hover:bg-slate-50"
            >
              <Download className="h-3 w-3" strokeWidth={2.5} aria-hidden />
              CSV
            </button>
            <button
              type="button"
              onClick={() => exportXlsx(rows, EXPORT_COLUMNS, meta)}
              className="inline-flex h-7 items-center gap-1.5 rounded-md border border-hairline bg-surface px-2.5 text-[12px] font-medium text-ink-soft transition-colors hover:bg-slate-50"
            >
              <Download className="h-3 w-3" strokeWidth={2.5} aria-hidden />
              XLSX
            </button>
          </>
        }
      />

      {/* The comparison is the point of the page, so it leads. */}
      <Card>
        <CardHeader
          title="Own network, Park & Pay, and the two together"
          subtitle={`On ${formatDate(snapshot.network.reportDate)} · budget ${snapshot.network.targetPct}%`}
          tip="Combined utilization is a genuine re-aggregation: capacities and occupancies are summed and divided once. It is never the average of the two percentages, which would misstate the network because the two books are very different sizes."
        />
        <BasisBands
          comparison={comparison}
          caption="Capacity, utilized pallets, empty pallets and utilization on the own network, Park & Pay and combined bases"
          targetPct={snapshot.network.targetPct}
        />
      </Card>

      <div className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryTile
          label="Contracted positions"
          value={formatNumber(comparison.parkAndPay.capacity)}
          note={`${rows.length} rented ${rows.length === 1 ? 'location' : 'locations'} · ${formatPct(comparison.capacitySharePct, 1)} of combined capacity`}
        >
          <CapacityMixBar
            ownCapacity={comparison.own.capacity}
            pnpCapacity={comparison.parkAndPay.capacity}
            className="mt-2.5"
          />
        </SummaryTile>
        <SummaryTile
          label="Park & Pay utilization"
          value={formatPct(comparison.parkAndPay.utilizationPct, 2)}
          tone={(comparison.parkAndPay.utilizationPct ?? 0) > 100 ? 'bad' : undefined}
          note={`${formatPp(
            comparison.parkAndPay.utilizationPct === null || comparison.own.utilizationPct === null
              ? null
              : comparison.parkAndPay.utilizationPct - comparison.own.utilizationPct,
            1,
          )} against the own network`}
        >
          <UtilizationBar
            pct={comparison.parkAndPay.utilizationPct}
            targetPct={snapshot.network.targetPct}
            className="mt-2.5"
          />
        </SummaryTile>
        <SummaryTile
          label="Held above contract"
          value={formatNumber(comparison.parkAndPay.overCapacityPallets)}
          tone={comparison.parkAndPay.overCapacityPallets > 0 ? 'bad' : undefined}
          note={
            pnp.overCapacitySites === 0
              ? 'No location is above its contracted positions'
              : `${pnp.overCapacitySites} ${pnp.overCapacitySites === 1 ? 'location has' : 'locations have'} no contractual headroom left`
          }
        />
        <SummaryTile
          label="Effect on the network figure"
          value={formatPp(comparison.utilizationImpactPp, 2)}
          note={`Own ${formatPct(comparison.own.utilizationPct, 2)} → combined ${formatPct(comparison.combined.utilizationPct, 2)}`}
        />
      </div>

      {nonRegionFilterActive ? (
        <div className="flex items-start gap-2 rounded-lg border border-hairline bg-slate-50 px-3.5 py-2.5">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-ink-muted" strokeWidth={2.2} aria-hidden />
          <p className="text-[11.5px] leading-relaxed text-ink-soft">
            <span className="font-semibold text-ink">Filters that describe own facilities do not narrow Park &amp; Pay.</span>{' '}
            Warehouse, temperature zone, facility type, ownership and execution are attributes of the own network; rented
            space does not carry them. The Park &amp; Pay figures on this page respond to the region filter only, so the
            combined figure above is not comparable with the own-network figure on the other screens while those filters
            are set.
          </p>
        </div>
      ) : null}

      {/* The legacy grid, kept whole. */}
      <Card>
        <CardHeader
          title="Park & Pay Utilization"
          subtitle={`Contracted positions and daily utilization, ${formatDate(grid[0], 'dd MMM')} to ${formatDate(grid[grid.length - 1], 'dd MMM yyyy')}`}
          tip="The legacy grid, kept as published: region, location name, code, contracted positions and utilization repeated for each day of the week. Two readings are added — a 30-day trend and the 7-day movement — and rows whose feed publishes a flat, exactly-full figure are marked, because a contracted figure and a measured one are not the same number."
          actions={
            <div className="flex flex-wrap items-center gap-2 text-[9.5px] text-ink-muted">
              <span className="inline-flex items-center gap-1">
                <span className="inline-block h-2.5 w-2.5 rounded-sm border border-hot-line bg-hot-soft" aria-hidden />
                90–100%
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="inline-block h-2.5 w-2.5 rounded-sm border border-bad-line bg-bad-soft" aria-hidden />
                Over contracted
              </span>
            </div>
          }
        />
        <div className="w-full min-w-0 overflow-x-auto">
          <table className="w-full border-collapse">
            <caption className="sr-only">
              Park and Pay contracted positions and daily utilization by region and location
            </caption>
            <thead>
              <tr className="border-b border-hairline bg-slate-50/70">
                <th scope="col" className="sticky left-0 z-10 min-w-[68px] bg-slate-50 px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-wider text-ink-muted">
                  Region
                </th>
                <th scope="col" className="min-w-[150px] px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-wider text-ink-muted">
                  Location name
                </th>
                <th scope="col" className="min-w-[52px] px-2 py-2 text-left text-[10px] font-semibold uppercase tracking-wider text-ink-muted">
                  Code
                </th>
                <th scope="col" className="min-w-[86px] px-3 py-2 text-right text-[10px] font-semibold uppercase tracking-wider text-ink-muted">
                  Contracted
                </th>
                {grid.map((date) => (
                  <th
                    key={date}
                    scope="col"
                    className="min-w-[72px] px-2 py-2 text-right text-[10px] font-semibold uppercase tracking-wider text-ink-muted"
                  >
                    {formatDate(date, 'dd MMM')}
                  </th>
                ))}
                <th scope="col" className="min-w-[74px] px-2 py-2 text-center text-[10px] font-semibold uppercase tracking-wider text-ink-muted">
                  30-day trend
                </th>
                <th scope="col" className="min-w-[70px] px-3 py-2 text-right text-[10px] font-semibold uppercase tracking-wider text-ink-muted">
                  7-day
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, index) => {
                const firstOfRegion = index === 0 || rows[index - 1].regionId !== row.regionId
                return (
                  <tr key={row.id} className={cn('border-b border-hairline/60', firstOfRegion && index > 0 && 'border-t border-t-hairline')}>
                    <td className="sticky left-0 z-10 bg-surface px-3 py-1.5 text-[11.5px] font-semibold text-ink">
                      {firstOfRegion ? row.regionId : ''}
                    </td>
                    <td className="px-3 py-1.5">
                      <span className="text-[11.5px] font-semibold text-ink">{row.name}</span>
                      <span className="block truncate text-[9.5px] text-ink-faint">
                        {[
                          row.cityName === 'Not mapped' ? 'City not mapped' : null,
                          row.partner === row.name ? null : row.partner,
                        ]
                          .filter(Boolean)
                          .join(' · ') || 'Third-party site'}
                      </span>
                    </td>
                    <td className="px-2 py-1.5">
                      <span className="mono text-[11px] font-semibold text-brand-600">{row.code}</span>
                      {row.reportsContractedAsOccupied ? (
                        <span
                          className="ml-1 align-middle text-[10px] text-ink-faint"
                          title="This location reports exactly 100.00% on every day of the window — contracted space, not a measured count."
                          aria-label="Feed reports contracted space as occupied"
                        >
                          ⚑
                        </span>
                      ) : null}
                    </td>
                    <td className="tnum px-3 py-1.5 text-right text-[11.5px] font-semibold text-ink">
                      {formatNumber(row.capacity)}
                    </td>
                    {row.grid.map((cell) => {
                      // Red is reserved for holding more stock than has been
                      // contracted - the thing that has no fallback. A location
                      // at exactly 100% is full, which is a different fact, so
                      // it takes the amber band with everything else near the
                      // top. Nine of twelve rows sit at or above 100%, and a
                      // sheet that is red throughout carries no signal at all.
                      const over = (cell.utilizationPct ?? 0) > 100
                      const high = !over && (cell.utilizationPct ?? 0) >= THRESHOLDS.breachThresholdPct
                      return (
                        <td
                          key={cell.date}
                          className={cn(
                            'px-2 py-1.5 text-right align-middle',
                            over ? 'bg-bad-soft' : high ? 'bg-hot-soft' : '',
                          )}
                        >
                          <span className={cn('tnum block text-[11.5px] font-semibold', over ? 'text-bad' : 'text-ink')}>
                            {over ? <span aria-label="over contracted capacity">▲ </span> : null}
                            <Value missing={cell.utilizationPct === null}>{formatPct(cell.utilizationPct, 2)}</Value>
                          </span>
                          <span className="tnum block text-[9.5px] text-ink-faint">
                            {formatNumber(cell.utilizedPallets)}
                          </span>
                        </td>
                      )
                    })}
                    <td className="px-2 py-1.5 text-center">
                      <Sparkline
                        values={row.spark}
                        status={row.status as StatusLevel}
                        label={`30-day utilization for ${row.code}`}
                      />
                    </td>
                    <td className="tnum px-3 py-1.5 text-right text-[11.5px] font-semibold">
                      <Value missing={row.change7dPp === null}>{formatPp(row.change7dPp, 1)}</Value>
                    </td>
                  </tr>
                )
              })}
              <tr className="border-t-2 border-t-ink-soft bg-slate-100">
                <td className="sticky left-0 z-10 bg-slate-100 px-3 py-2 text-[12px] font-bold text-ink" colSpan={3}>
                  Total
                </td>
                <td className="tnum px-3 py-2 text-right text-[12px] font-bold text-ink">
                  {formatNumber(comparison.parkAndPay.capacity)}
                </td>
                {totalsRow.map((day) => {
                  const over = (day.utilizationPct ?? 0) > 100
                  return (
                    <td key={day.date} className="px-2 py-2 text-right">
                      <span className={cn('tnum block text-[12px] font-bold', over ? 'text-bad' : 'text-ink')}>
                        <Value missing={day.utilizationPct === null}>{formatPct(day.utilizationPct, 2)}</Value>
                      </span>
                      <span className="tnum block text-[9.5px] text-ink-faint">{formatNumber(day.utilizedPallets)}</span>
                    </td>
                  )
                })}
                <td className="px-2 py-2 text-center">
                  <Sparkline
                    values={totalsRow.map((d) => d.utilizationPct ?? 0)}
                    status="info"
                    label="Park and Pay total utilization across the published week"
                  />
                </td>
                <td />
              </tr>
            </tbody>
          </table>
        </div>
        <p className="border-t border-hairline px-4 py-2 text-[10.5px] leading-relaxed text-ink-faint">
          ⚑ marks a location whose feed publishes a flat, exactly-full figure — {pnp.flatFullSites} of {rows.length} rows,
          covering {formatNumber(pnp.flatFullPallets)}&nbsp;positions. The percentage under each date is that day&apos;s
          utilization; the figure beneath it is the occupied pallet count the percentage is derived from.
        </p>
      </Card>

      <div className="grid items-start gap-3 xl:grid-cols-[1.15fr_1fr]">
        <Card>
          <CardHeader
            title="What Park & Pay does to each region"
            subtitle="Own utilization, rented utilization, and the effect of putting them together"
            tip="A region is only moved by rented space in proportion to how much of it there is. A region with a small rented book and a very full one can still barely move — which is exactly what this column is for."
          />
          <div className="w-full min-w-0 overflow-x-auto">
            <table className="w-full border-collapse">
              <caption className="sr-only">Own, Park and Pay and combined utilization by region</caption>
              <thead>
                <tr className="border-b border-hairline bg-slate-50/70">
                  <th scope="col" className="px-4 py-2 text-left text-[10px] font-semibold uppercase tracking-wider text-ink-muted">
                    Region
                  </th>
                  <th scope="col" className="px-3 py-2 text-right text-[10px] font-semibold uppercase tracking-wider text-ink-muted">
                    Own
                  </th>
                  <th scope="col" className="px-3 py-2 text-right text-[10px] font-semibold uppercase tracking-wider text-ink-muted">
                    Park &amp; Pay
                  </th>
                  <th scope="col" className="px-3 py-2 text-right text-[10px] font-semibold uppercase tracking-wider text-ink-muted">
                    Combined
                  </th>
                  <th scope="col" className="px-3 py-2 text-right text-[10px] font-semibold uppercase tracking-wider text-ink-muted">
                    Effect
                  </th>
                  <th scope="col" className="min-w-[110px] px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-wider text-ink-muted">
                    Capacity mix
                  </th>
                </tr>
              </thead>
              <tbody>
                {pnp.regions.map((region) => {
                  const c = region.comparison
                  const none = region.siteCount === 0
                  return (
                    <tr key={region.regionId} className="border-b border-hairline/60 last:border-0 hover:bg-slate-50/60">
                      <th scope="row" className="px-4 py-2 text-left font-normal">
                        <Link href={`/regions/${region.regionId}`} className="text-[12px] font-semibold text-brand-600 hover:underline">
                          {region.regionId}
                        </Link>
                        <span className="block text-[9.5px] text-ink-faint">
                          {none ? 'No rented space' : `${region.siteCount} rented ${region.siteCount === 1 ? 'location' : 'locations'}`}
                        </span>
                      </th>
                      <td className="tnum px-3 py-2 text-right text-[12px] font-semibold text-ink">
                        {formatPct(c.own.utilizationPct, 1)}
                      </td>
                      <td
                        className={cn(
                          'tnum px-3 py-2 text-right text-[12px] font-semibold',
                          (c.parkAndPay.utilizationPct ?? 0) > 100 ? 'text-bad' : 'text-ink',
                        )}
                      >
                        <Value missing={c.parkAndPay.utilizationPct === null} reason="No rented space in this region.">
                          {formatPct(c.parkAndPay.utilizationPct, 1)}
                        </Value>
                      </td>
                      <td className="tnum px-3 py-2 text-right text-[12px] font-bold text-ink">
                        {formatPct(c.combined.utilizationPct, 1)}
                      </td>
                      <td className="px-3 py-2 text-right">
                        {none ? <span className="text-[11px] text-ink-faint">—</span> : <BasisImpact value={c.utilizationImpactPp} />}
                      </td>
                      <td className="px-3 py-2">
                        <CapacityMixBar ownCapacity={c.own.capacity} pnpCapacity={c.parkAndPay.capacity} />
                        <span className="tnum mt-1 block text-[9.5px] text-ink-faint">
                          {none ? 'Own only' : `${formatPct(c.capacitySharePct, 1)} rented`}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </Card>

        <Card>
          <CardHeader
            title="Contract and exposure position"
            subtitle="What rented space carries that owned space does not"
            tip="Owned capacity does not expire and is not paid for twice. Rented capacity does both, so the questions worth asking about it are different from the ones asked about a warehouse."
          />
          <div className="divide-y divide-hairline">
            <ExposureRow
              title="Held above contracted positions"
              value={formatNumber(comparison.parkAndPay.overCapacityPallets)}
              unit="pallets"
              status={comparison.parkAndPay.overCapacityPallets > 0 ? 'critical' : 'healthy'}
              detail={
                pnp.overCapacitySites === 0
                  ? 'Every location is inside the space it has contracted.'
                  : `Across ${pnp.overCapacitySites} locations. Rented space has no structural headroom — an overflow at a partner site has nowhere to go except another site.`
              }
              rows={rows.filter((r) => r.overCapacityPallets > 0)}
            />
            <ExposureRow
              title="Contracted, no occupancy"
              value={formatNumber(pnp.idlePallets)}
              unit="pallets"
              status={pnp.idlePallets > 0 ? 'watch' : 'healthy'}
              detail={
                pnp.idleSites === 0
                  ? 'Every contracted location is carrying stock.'
                  : 'Available capacity that is already being paid for. A commercial question — place volume against it, or serve notice at the next break — not waste.'
              }
              rows={rows.filter((r) => r.idle)}
            />
            <ExposureRow
              title={`Contracts ending within ${THRESHOLDS.contractRenewalWindowDays} days`}
              value={formatNumber(pnp.contractsExpiringPallets)}
              unit="pallets"
              status={pnp.contractsExpiringSoon > 0 ? 'watch' : 'healthy'}
              detail={
                pnp.contractsExpiringSoon === 0
                  ? 'No renewal falls inside the window.'
                  : 'Capacity that has to be re-signed or replaced. A site running above its contracted positions has no fallback if the contract lapses.'
              }
              rows={rows.filter((r) => r.daysToContractEnd <= THRESHOLDS.contractRenewalWindowDays)}
              showContract
            />
            <ExposureRow
              title="Occupancy reported as contracted"
              value={formatNumber(pnp.flatFullPallets)}
              unit="pallets"
              status={pnp.flatFullSites > 0 ? 'info' : 'healthy'}
              detail={
                pnp.flatFullSites === 0
                  ? 'Every location returns a measured occupancy count.'
                  : 'These locations return exactly 100.00% on every day of the window. Contracted space and occupied space are different measurements; until the partner sites return a measured count, Park & Pay utilization is overstated by an unknown amount.'
              }
              rows={rows.filter((r) => r.reportsContractedAsOccupied)}
            />
          </div>
        </Card>
      </div>

      <Card>
        <CardHeader title="How this is read" subtitle="Definitions behind the columns" />
        <dl className="grid gap-x-6 gap-y-2.5 px-4 py-3 text-[11.5px] sm:grid-cols-2 lg:grid-cols-4">
          <Definition
            term="Contracted positions"
            detail="Pallet positions Snowman has contracted at a partner site. The source grid publishes one figure per location with no frozen / chilled / dry split, so none is shown."
          />
          <Definition
            term="Utilization"
            detail="Occupied pallets divided by contracted positions. Above 100% means more stock is held than has been contracted — it is shown as it stands and never capped."
          />
          <Definition
            term="Empty"
            detail="Contracted positions less occupied pallets, allowed to go negative. This is available capacity being paid for, not waste."
          />
          <Definition
            term="Effect on the network"
            detail="Combined utilization less own utilization, in percentage points. A region only moves in proportion to how much rented space it has."
          />
        </dl>
        <p className="border-t border-hairline px-4 py-2.5 text-[10.5px] leading-relaxed text-ink-faint">
          Region membership follows the location master, so a rented location sits in the same region as the facilities
          around it. Park &amp; Pay responds to the region filter only — the warehouse, zone, type, ownership and
          execution filters describe attributes of own facilities that rented space does not carry.
        </p>
      </Card>
    </div>
  )
}

function SummaryTile({
  label,
  value,
  note,
  tone,
  children,
}: {
  label: string
  value: string
  note: string
  tone?: 'bad'
  children?: React.ReactNode
}) {
  return (
    <Card className="p-3.5">
      <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-ink-muted">{label}</p>
      <p className={cn('tnum mt-1 text-[24px] font-bold leading-none', tone === 'bad' ? 'text-bad' : 'text-ink')}>
        {value}
      </p>
      <p className="mt-1.5 text-[10.5px] leading-snug text-ink-muted">{note}</p>
      {children}
    </Card>
  )
}

function ExposureRow({
  title,
  value,
  unit,
  detail,
  status,
  rows,
  showContract,
}: {
  title: string
  value: string
  unit: string
  detail: string
  status: StatusLevel
  rows: ParkAndPaySiteRow[]
  showContract?: boolean
}) {
  return (
    <div className="px-4 py-2.5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <SectionTitle className="flex items-center gap-1.5">
          <StatusChip status={status} size="xs" />
          {title}
        </SectionTitle>
        <span className="tnum text-[13px] font-bold text-ink">
          {value} <span className="text-[10px] font-medium text-ink-muted">{unit}</span>
        </span>
      </div>
      <p className="mt-1 text-[10.5px] leading-relaxed text-ink-muted">{detail}</p>
      {rows.length > 0 ? (
        <ul className="mt-1.5 flex flex-wrap gap-1.5">
          {rows.map((row) => (
            <li key={row.id}>
              <span className="tnum inline-flex items-center gap-1.5 rounded border border-hairline bg-surface px-1.5 py-1 text-[11px] font-semibold text-ink">
                {row.code}
                {showContract ? (
                  <span className="inline-flex items-center gap-0.5 font-medium text-ink-muted">
                    <CalendarClock className="h-2.5 w-2.5" strokeWidth={2.4} aria-hidden />
                    {row.daysToContractEnd}d
                  </span>
                ) : (
                  <span className="font-medium text-ink-muted">{formatPct(row.utilizationPct, 1)}</span>
                )}
              </span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}

function Definition({ term, detail }: { term: string; detail: string }) {
  return (
    <div>
      <dt className="font-semibold text-ink">
        {term}
        <InfoTip label={term} text={detail} />
      </dt>
      <dd className="mt-0.5 leading-relaxed text-ink-muted">{detail}</dd>
    </div>
  )
}
