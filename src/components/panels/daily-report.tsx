'use client'

import * as React from 'react'
import Link from 'next/link'
import type { DailyReportBands, DailyReportLocationRow } from '@/lib/repository'
import type { CapacityRollup, StatusLevel } from '@/lib/domain/types'
import { StatusChip, UtilizationBar, Value } from '@/components/ui/primitives'
import { BasisImpact } from '@/components/panels/basis-bands'
import { MultiSeriesLine } from '@/components/charts/multi-series'
import { CHART_COLORS } from '@/lib/config/brand'
import type { PalletTrendPoint } from '@/lib/domain/daily-report'
import { utilizationStatus } from '@/lib/config/thresholds'
import { cn, formatNumber, formatPct, formatPp } from '@/lib/utils'

interface BandRow {
  id: string
  label: string
  sublabel: string
  rollup: CapacityRollup
  /** Subtotal rows carry a rule above them and heavier type. */
  kind: 'member' | 'subtotal' | 'total'
}

function bandRows(bands: DailyReportBands): BandRow[] {
  const pnpSites = bands.parkAndPay.siteCount
  return [
    {
      id: 'fc',
      label: 'Frozen + Chilled',
      sublabel: 'F/C chambers',
      rollup: bands.fc,
      kind: 'member',
    },
    {
      id: 'dry',
      label: 'Dry',
      sublabel: 'Controlled ambient + ambient',
      rollup: bands.dry,
      kind: 'member',
    },
    {
      id: 'own',
      label: 'Own network',
      sublabel: 'F/C + Dry',
      rollup: bands.own,
      kind: 'subtotal',
    },
    {
      id: 'pnp',
      label: 'Park & Pay',
      sublabel: pnpSites === 0 ? 'No rented space in scope' : `${pnpSites} rented ${pnpSites === 1 ? 'location' : 'locations'}`,
      rollup: bands.parkAndPay,
      kind: 'member',
    },
    {
      id: 'combined',
      label: 'Total (own + Park & Pay)',
      sublabel: 'Summed, then divided once',
      rollup: bands.combined,
      kind: 'total',
    },
  ]
}

/**
 * The daily report card.
 *
 * The mail this replaces publishes the same twelve figures as twelve separate
 * boxed tiles, which means the reader compares F/C against Dry against the
 * total by moving their eye across three rows of unrelated boxes. One table
 * with the measures as columns answers the same question by scanning down,
 * shows the subtotals as subtotals, and makes the arithmetic visible: F/C plus
 * Dry is the own total, own plus Park & Pay is the combined total.
 *
 * Empty pallets are allowed to go negative and are coloured when they do —
 * a book holding more than its capacity is the single most useful thing on
 * the card and the legacy version renders it as an ordinary figure.
 */
export function DailyReportCard({
  bands,
  caption,
  targetPct,
}: {
  bands: DailyReportBands
  caption: string
  targetPct?: number
}) {
  const rows = bandRows(bands)
  const noParkAndPay = bands.parkAndPay.siteCount === 0

  return (
    <div className="w-full min-w-0 overflow-x-auto">
      <table className="w-full border-collapse">
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr className="border-b border-hairline bg-slate-50/70">
            <th scope="col" className="min-w-[164px] px-4 py-2 text-left text-[10px] font-semibold uppercase tracking-wider text-ink-muted">
              Band
            </th>
            <th scope="col" className="min-w-[94px] px-3 py-2 text-right text-[10px] font-semibold uppercase tracking-wider text-ink-muted">
              Capacity
            </th>
            <th scope="col" className="min-w-[94px] px-3 py-2 text-right text-[10px] font-semibold uppercase tracking-wider text-ink-muted">
              Utilized pallets
            </th>
            <th scope="col" className="min-w-[94px] px-3 py-2 text-right text-[10px] font-semibold uppercase tracking-wider text-ink-muted">
              Empty pallets
            </th>
            <th scope="col" className="min-w-[196px] px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-wider text-ink-muted">
              Utilization
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const over = (row.rollup.utilizationPct ?? 0) > 100
            const negativeEmpty = (row.rollup.netEmptyPallets ?? 0) < 0
            const missingBand = row.id === 'pnp' && noParkAndPay
            return (
              <tr
                key={row.id}
                className={cn(
                  'border-b border-hairline/60 last:border-0',
                  row.kind === 'subtotal' && 'border-t border-t-hairline bg-slate-50/70',
                  row.kind === 'total' && 'border-t-2 border-t-ink-soft bg-slate-100',
                )}
              >
                <th scope="row" className="px-4 py-2.5 text-left font-normal">
                  <span
                    className={cn(
                      'block text-[12px]',
                      row.kind === 'member' ? 'font-semibold text-ink' : 'font-bold text-ink',
                    )}
                  >
                    {row.label}
                  </span>
                  <span className="mt-0.5 block text-[9.5px] text-ink-faint">{row.sublabel}</span>
                </th>
                <td className="tnum px-3 py-2.5 text-right text-[13.5px] font-semibold text-ink">
                  <Value missing={row.rollup.capacity === null} reason={missingBand ? 'No rented space in scope.' : 'No capacity master row in scope.'}>
                    {formatNumber(row.rollup.capacity)}
                  </Value>
                </td>
                <td className="tnum px-3 py-2.5 text-right text-[13.5px] font-semibold text-ink">
                  {formatNumber(row.rollup.utilizedPallets)}
                </td>
                <td
                  className={cn('tnum px-3 py-2.5 text-right text-[13.5px] font-semibold', negativeEmpty ? 'text-bad' : 'text-ink')}
                  title={negativeEmpty ? 'Negative: more pallets are held than there are positions.' : undefined}
                >
                  <Value missing={row.rollup.netEmptyPallets === null}>{formatNumber(row.rollup.netEmptyPallets)}</Value>
                </td>
                <td className="px-3 py-2.5">
                  <div className="flex items-center gap-2">
                    <span className={cn('tnum w-[64px] shrink-0 text-[15px] font-bold', over ? 'text-bad' : 'text-ink')}>
                      <Value
                        missing={row.rollup.utilizationPct === null}
                        reason={missingBand ? 'No rented space in scope.' : 'Nothing in scope has a capacity master row.'}
                      >
                        {formatPct(row.rollup.utilizationPct, 2)}
                      </Value>
                    </span>
                    <UtilizationBar pct={row.rollup.utilizationPct} targetPct={targetPct} className="min-w-[70px] flex-1" />
                    <StatusChip status={utilizationStatus(row.rollup.utilizationPct)} size="xs" />
                  </div>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>

      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 border-t border-hairline px-4 py-2.5">
        <Footnote label="F/C share of own capacity">
          <span className="tnum text-[11.5px] font-semibold text-ink-soft">
            <Value missing={bands.own.capacity === null || bands.fc.capacity === null}>
              {formatPct(
                bands.own.capacity === null || bands.own.capacity === 0 || bands.fc.capacity === null
                  ? null
                  : (bands.fc.capacity / bands.own.capacity) * 100,
                1,
              )}
            </Value>
          </span>
        </Footnote>
        <Footnote label="Effect of including Park &amp; Pay">
          {noParkAndPay ? (
            <span className="text-[11.5px] text-ink-muted">None — no rented space in scope</span>
          ) : (
            <BasisImpact value={bands.parkAndPayImpactPp} />
          )}
        </Footnote>
        {bands.own.overCapacityPallets > 0 ? (
          <Footnote label="Held above capacity">
            <span className="tnum text-[11.5px] font-semibold text-bad">
              {formatNumber(bands.own.overCapacityPallets)} pallets
            </span>
          </Footnote>
        ) : null}
      </div>
    </div>
  )
}

function Footnote({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className="text-[9.5px] font-semibold uppercase tracking-[0.1em] text-ink-muted">{label}</span>
      {children}
    </span>
  )
}

/**
 * The same bands, one row per warehouse.
 *
 * The mail goes out per location, so a regional head reading six of them has
 * to hold six cards side by side to see who is tight and who is slack. This
 * is those cards as a sheet: grouped headers keep the F/C, Dry and total
 * blocks legible, and the Park & Pay columns stay empty rather than zero
 * where a location has no rented space in its city.
 */
export function DailyReportLocationTable({
  rows,
  caption,
}: {
  rows: DailyReportLocationRow[]
  caption: string
}) {
  const anyParkAndPay = rows.some((row) => row.parkAndPaySiteCount > 0)

  return (
    <div className="w-full min-w-0 overflow-x-auto">
      <table className="w-full border-collapse">
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr className="border-b border-hairline/70 bg-slate-50/70 text-[9px] font-semibold uppercase tracking-[0.1em] text-ink-faint">
            <th scope="col" className="sticky left-0 z-10 bg-slate-50 px-3 py-1.5 text-left" />
            <th scope="col" colSpan={2} className="border-l border-hairline px-2 py-1.5 text-center">
              Frozen + Chilled
            </th>
            <th scope="col" colSpan={2} className="border-l border-hairline px-2 py-1.5 text-center">
              Dry
            </th>
            <th scope="col" colSpan={4} className="border-l border-hairline px-2 py-1.5 text-center">
              Own total
            </th>
            {anyParkAndPay ? (
              <th scope="col" colSpan={2} className="border-l border-hairline px-2 py-1.5 text-center">
                Park &amp; Pay
              </th>
            ) : null}
            <th scope="col" className="border-l border-hairline px-2 py-1.5 text-center">
              Combined
            </th>
          </tr>
          <tr className="border-b border-hairline bg-slate-50/70 text-[10px] font-semibold uppercase tracking-wider text-ink-muted">
            <th scope="col" className="sticky left-0 z-10 min-w-[168px] bg-slate-50 px-3 py-2 text-left">
              Location
            </th>
            <th scope="col" className="min-w-[74px] border-l border-hairline px-2 py-2 text-right">
              Cap.
            </th>
            <th scope="col" className="min-w-[68px] px-2 py-2 text-right">
              Util.
            </th>
            <th scope="col" className="min-w-[74px] border-l border-hairline px-2 py-2 text-right">
              Cap.
            </th>
            <th scope="col" className="min-w-[68px] px-2 py-2 text-right">
              Util.
            </th>
            <th scope="col" className="min-w-[78px] border-l border-hairline px-2 py-2 text-right">
              Cap.
            </th>
            <th scope="col" className="min-w-[78px] px-2 py-2 text-right">
              Used
            </th>
            <th scope="col" className="min-w-[74px] px-2 py-2 text-right">
              Empty
            </th>
            <th scope="col" className="min-w-[112px] px-2 py-2 text-left">
              Utilization
            </th>
            {anyParkAndPay ? (
              <>
                <th scope="col" className="min-w-[70px] border-l border-hairline px-2 py-2 text-right">
                  Cap.
                </th>
                <th scope="col" className="min-w-[68px] px-2 py-2 text-right">
                  Util.
                </th>
              </>
            ) : null}
            <th scope="col" className="min-w-[72px] border-l border-hairline px-2 py-2 text-right">
              Util.
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const over = (row.own.utilizationPct ?? 0) > 100
            return (
              <tr key={row.facilityId} className="border-b border-hairline/60 last:border-0 hover:bg-slate-50/60">
                <th scope="row" className="sticky left-0 z-10 bg-surface px-3 py-1.5 text-left font-normal">
                  <Link
                    href={`/warehouses/${encodeURIComponent(row.facilityId)}`}
                    className="text-[11.5px] font-semibold text-brand-600 hover:underline"
                  >
                    {row.code}
                  </Link>
                  <span className="block truncate text-[9.5px] text-ink-faint">
                    {row.name} · {row.cityName}
                  </span>
                </th>
                <Cell value={formatNumber(row.fc.capacity)} missing={row.fc.capacity === null} bordered />
                <PctCell pct={row.fc.utilizationPct} />
                <Cell value={formatNumber(row.dry.capacity)} missing={row.dry.capacity === null} bordered />
                <PctCell pct={row.dry.utilizationPct} />
                <Cell value={formatNumber(row.own.capacity)} missing={row.own.capacity === null} bordered strong />
                <Cell value={formatNumber(row.own.utilizedPallets)} strong />
                <Cell
                  value={formatNumber(row.own.netEmptyPallets)}
                  missing={row.own.netEmptyPallets === null}
                  tone={(row.own.netEmptyPallets ?? 0) < 0 ? 'bad' : undefined}
                />
                <td className="px-2 py-1.5">
                  <div className="flex items-center gap-1.5">
                    <span className={cn('tnum w-[46px] shrink-0 text-[11.5px] font-bold', over ? 'text-bad' : 'text-ink')}>
                      <Value missing={row.own.utilizationPct === null}>{formatPct(row.own.utilizationPct, 1)}</Value>
                    </span>
                    <UtilizationBar pct={row.own.utilizationPct} className="min-w-[36px] flex-1" />
                  </div>
                </td>
                {anyParkAndPay ? (
                  <>
                    <Cell
                      value={row.parkAndPaySiteCount === 0 ? '—' : formatNumber(row.parkAndPay.capacity)}
                      muted={row.parkAndPaySiteCount === 0}
                      bordered
                    />
                    <PctCell pct={row.parkAndPay.utilizationPct} muted={row.parkAndPaySiteCount === 0} />
                  </>
                ) : null}
                <td className="border-l border-hairline px-2 py-1.5 text-right">
                  <span
                    className={cn(
                      'tnum text-[11.5px] font-bold',
                      (row.combined.utilizationPct ?? 0) > 100 ? 'text-bad' : 'text-ink',
                    )}
                  >
                    <Value missing={row.combined.utilizationPct === null}>{formatPct(row.combined.utilizationPct, 1)}</Value>
                  </span>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function Cell({
  value,
  missing,
  bordered,
  strong,
  muted,
  tone,
}: {
  value: string
  missing?: boolean
  bordered?: boolean
  strong?: boolean
  muted?: boolean
  tone?: 'bad'
}) {
  return (
    <td
      className={cn(
        'tnum px-2 py-1.5 text-right text-[11.5px]',
        bordered && 'border-l border-hairline',
        strong ? 'font-semibold' : 'font-medium',
        tone === 'bad' ? 'text-bad' : muted ? 'text-ink-faint' : 'text-ink',
      )}
    >
      <Value missing={missing}>{value}</Value>
    </td>
  )
}

function PctCell({ pct, muted }: { pct: number | null; muted?: boolean }) {
  const over = (pct ?? 0) > 100
  return (
    <td
      className={cn(
        'tnum px-2 py-1.5 text-right text-[11.5px] font-semibold',
        over ? 'text-bad' : muted ? 'text-ink-faint' : 'text-ink-soft',
      )}
    >
      {muted && pct === null ? <span className="text-ink-faint">—</span> : <Value missing={pct === null}>{formatPct(pct, 1)}</Value>}
    </td>
  )
}

/** Status of a whole scope, for a report header line. */
export function reportStatus(bands: DailyReportBands): StatusLevel {
  return utilizationStatus(bands.own.utilizationPct)
}

/** The one-line summary the mail's subject line would carry. */
export function reportSummaryLine(bands: DailyReportBands, scopeLabel: string): string {
  const parts = [
    `${scopeLabel} at ${formatPct(bands.own.utilizationPct, 2)}`,
    `${formatNumber(bands.own.utilizedPallets)} of ${formatNumber(bands.own.capacity)} positions`,
  ]
  if (bands.own.overCapacityPallets > 0) {
    parts.push(`${formatNumber(bands.own.overCapacityPallets)} pallets above capacity`)
  }
  if (bands.parkAndPay.siteCount > 0) {
    parts.push(`${formatPct(bands.combined.utilizationPct, 2)} including Park & Pay (${formatPp(bands.parkAndPayImpactPp, 2)})`)
  }
  return parts.join(' · ')
}


/**
 * Occupancy in pallets against budget and the same period last year.
 *
 * The percentage trend and this one answer different questions and the legacy
 * report is right to publish both: a site can hold more stock than last year
 * and still read lower, because capacity moved underneath it. The series and
 * colours are the ones the utilization trend already uses, so a reader moving
 * between the two charts is reading the same encoding.
 */
export function PalletTrendChart({ points, height = 230 }: { points: PalletTrendPoint[]; height?: number }) {
  const rows = React.useMemo(
    () =>
      points.map((point) => ({
        date: point.date,
        utilizedPallets: point.utilizedPallets,
        budgetPallets: point.budgetPallets,
        lastYearPallets: point.lastYearPallets,
      })),
    [points],
  )

  return (
    <MultiSeriesLine
      rows={rows}
      unit="pallets"
      height={height}
      yLabelWidth={58}
      series={[
        { key: 'utilizedPallets', label: 'Occupied pallets', color: CHART_COLORS.actual },
        { key: 'budgetPallets', label: 'Budget', color: CHART_COLORS.budget },
        { key: 'lastYearPallets', label: 'Same period last year', color: CHART_COLORS.lastYear },
      ]}
    />
  )
}
