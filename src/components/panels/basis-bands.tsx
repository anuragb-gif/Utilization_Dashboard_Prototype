'use client'

import * as React from 'react'
import { Minus, TrendingDown, TrendingUp } from 'lucide-react'
import type { BasisComparison, BasisId, BasisRollup } from '@/lib/domain/types'
import { StatusChip, UtilizationBar, Value } from '@/components/ui/primitives'
import { utilizationStatus } from '@/lib/config/thresholds'
import { cn, formatNumber, formatPct, formatPp } from '@/lib/utils'

export const BASIS_META: Record<BasisId, { label: string; short: string; note: string }> = {
  OWN: {
    label: 'Own network',
    short: 'Own',
    note: 'Capacity Snowman owns, leases or operates. This is the headline the network has always been managed against.',
  },
  PNP: {
    label: 'Park & Pay',
    short: 'P&P only',
    note: 'Pallet positions rented from third parties and sold on to customers. A different commercial book with a different cost base.',
  },
  COMBINED: {
    label: 'Total (own + Park & Pay)',
    short: 'Own + P&P',
    note: 'Both books summed and divided once — never the average of the two percentages, which misstates the network whenever the books differ in size.',
  },
}

export const BASIS_OPTIONS: { value: BasisId; label: string }[] = [
  { value: 'OWN', label: BASIS_META.OWN.short },
  { value: 'COMBINED', label: BASIS_META.COMBINED.short },
  { value: 'PNP', label: BASIS_META.PNP.short },
]

export function rollupFor(comparison: BasisComparison, basis: BasisId): BasisRollup {
  if (basis === 'PNP') return comparison.parkAndPay
  if (basis === 'COMBINED') return comparison.combined
  return comparison.own
}

/**
 * Effect of moving from own to combined, in percentage points.
 *
 * Rendered with an arrow and a signed value rather than colour alone, and
 * deliberately neutral in tone: including rented space can move the number
 * either way and neither direction is good or bad on its own.
 */
export function BasisImpact({ value, className }: { value: number | null; className?: string }) {
  if (value === null) {
    return <span className={cn('text-[11px] text-ink-faint', className)}>N/A</span>
  }
  const flat = Math.abs(value) < 0.005
  const Icon = flat ? Minus : value > 0 ? TrendingUp : TrendingDown
  return (
    <span className={cn('tnum inline-flex items-center gap-1 text-[11.5px] font-semibold text-ink-soft', className)}>
      <Icon className="h-3 w-3 text-ink-muted" strokeWidth={2.5} aria-hidden />
      {formatPp(value, 2)}
    </span>
  )
}

/**
 * Own, Park & Pay and combined on one sheet.
 *
 * The legacy South-1 card stacks the same three blocks, which is the right
 * shape — a reader compares them by scanning down one column. What is added
 * here is the part the legacy card leaves the reader to do in their head: a
 * utilization bar so the three are comparable at a glance, and an explicit
 * statement of what including Park & Pay does to the percentage.
 *
 * It is a table on purpose: three rows of the same four measures is a table,
 * and a screen reader should be able to read down a column.
 */
export function BasisBands({
  comparison,
  caption,
  targetPct,
  compact,
}: {
  comparison: BasisComparison
  caption: string
  targetPct?: number
  compact?: boolean
}) {
  const rows: { basis: BasisId; rollup: BasisRollup }[] = [
    { basis: 'OWN', rollup: comparison.own },
    { basis: 'PNP', rollup: comparison.parkAndPay },
    { basis: 'COMBINED', rollup: comparison.combined },
  ]
  const noParkAndPay = comparison.parkAndPay.siteCount === 0

  return (
    <div className="w-full min-w-0 overflow-x-auto">
      <table className="w-full border-collapse">
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr className="border-b border-hairline bg-slate-50/70">
            <th scope="col" className="min-w-[150px] px-4 py-2 text-left text-[10px] font-semibold uppercase tracking-wider text-ink-muted">
              Basis
            </th>
            <th scope="col" className="min-w-[92px] px-3 py-2 text-right text-[10px] font-semibold uppercase tracking-wider text-ink-muted">
              Capacity
            </th>
            <th scope="col" className="min-w-[92px] px-3 py-2 text-right text-[10px] font-semibold uppercase tracking-wider text-ink-muted">
              Utilized
            </th>
            <th scope="col" className="min-w-[92px] px-3 py-2 text-right text-[10px] font-semibold uppercase tracking-wider text-ink-muted">
              Empty
            </th>
            <th scope="col" className="min-w-[190px] px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-wider text-ink-muted">
              Utilization
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map(({ basis, rollup }) => {
            const isTotal = basis === 'COMBINED'
            const isPnp = basis === 'PNP'
            const over = (rollup.utilizationPct ?? 0) > 100
            return (
              <tr
                key={basis}
                className={cn(
                  'border-b border-hairline/60 last:border-0',
                  isTotal && 'border-t-2 border-t-ink-soft bg-slate-50',
                  isPnp && 'bg-brand-50/35',
                )}
              >
                <th scope="row" className="px-4 py-2.5 text-left font-normal">
                  <span className={cn('block text-[12px]', isTotal ? 'font-bold text-ink' : 'font-semibold text-ink')}>
                    {BASIS_META[basis].label}
                  </span>
                  <span className="mt-0.5 block text-[9.5px] text-ink-faint">
                    {isPnp
                      ? noParkAndPay
                        ? 'No rented locations in scope'
                        : `${rollup.siteCount} rented ${rollup.siteCount === 1 ? 'location' : 'locations'}`
                      : isTotal
                        ? 'Summed, then divided once'
                        : `${rollup.siteCount} ${rollup.siteCount === 1 ? 'facility' : 'facilities'}`}
                  </span>
                </th>
                <td className="tnum px-3 py-2.5 text-right text-[13px] font-semibold text-ink">
                  <Value missing={rollup.capacity === null} reason="No capacity master row in scope.">
                    {formatNumber(rollup.capacity)}
                  </Value>
                </td>
                <td className="tnum px-3 py-2.5 text-right text-[13px] font-semibold text-ink">
                  {formatNumber(rollup.utilizedPallets)}
                </td>
                <td
                  className={cn(
                    'tnum px-3 py-2.5 text-right text-[13px] font-semibold',
                    (rollup.netEmptyPallets ?? 0) < 0 ? 'text-bad' : 'text-ink',
                  )}
                  title={
                    (rollup.netEmptyPallets ?? 0) < 0
                      ? 'Negative: more pallets are held than there are positions.'
                      : undefined
                  }
                >
                  <Value missing={rollup.netEmptyPallets === null}>{formatNumber(rollup.netEmptyPallets)}</Value>
                </td>
                <td className="px-3 py-2.5">
                  <div className="flex items-center gap-2">
                    <span
                      className={cn(
                        'tnum w-[62px] shrink-0 text-[15px] font-bold',
                        over ? 'text-bad' : isTotal ? 'text-ink' : 'text-ink',
                      )}
                    >
                      <Value
                        missing={rollup.utilizationPct === null}
                        reason="Nothing in scope has a capacity master row, so there is no denominator."
                      >
                        {formatPct(rollup.utilizationPct, 2)}
                      </Value>
                    </span>
                    <UtilizationBar pct={rollup.utilizationPct} targetPct={targetPct} className="min-w-[70px] flex-1" />
                    <StatusChip status={utilizationStatus(rollup.utilizationPct)} size="xs" />
                  </div>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>

      {compact ? null : (
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 border-t border-hairline px-4 py-2.5">
          <Footnote label="Effect of including Park &amp; Pay">
            {noParkAndPay ? (
              <span className="text-[11.5px] text-ink-muted">None — no rented locations in scope</span>
            ) : (
              <BasisImpact value={comparison.utilizationImpactPp} />
            )}
          </Footnote>
          <Footnote label="P&amp;P share of capacity">
            <span className="tnum text-[11.5px] font-semibold text-ink-soft">
              <Value missing={comparison.capacitySharePct === null}>{formatPct(comparison.capacitySharePct, 1)}</Value>
            </span>
          </Footnote>
          <Footnote label="P&amp;P share of occupancy">
            <span className="tnum text-[11.5px] font-semibold text-ink-soft">
              <Value missing={comparison.occupancySharePct === null}>{formatPct(comparison.occupancySharePct, 1)}</Value>
            </span>
          </Footnote>
        </div>
      )}
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
 * A single stacked bar of own vs rented capacity.
 *
 * Used where the question is "how much of this book is rented" rather than
 * "how full is each book" - one bar answers that faster than three numbers.
 */
export function CapacityMixBar({
  ownCapacity,
  pnpCapacity,
  className,
}: {
  ownCapacity: number | null
  pnpCapacity: number | null
  className?: string
}) {
  const own = ownCapacity ?? 0
  const pnp = pnpCapacity ?? 0
  const total = own + pnp
  if (total === 0) {
    return <div className={cn('h-2 rounded-full bg-slate-100', className)} aria-hidden />
  }
  const pnpShare = (pnp / total) * 100
  return (
    <div className={cn('flex h-2 w-full overflow-hidden rounded-full bg-slate-100', className)}>
      <div className="h-full bg-brand-500" style={{ width: `${100 - pnpShare}%` }} aria-hidden />
      {/* Rented space is patterned as well as tinted, so the split survives
          greyscale print and colour-vision deficiency. */}
      <div
        className="h-full bg-brand-300"
        style={{
          width: `${pnpShare}%`,
          backgroundImage:
            'repeating-linear-gradient(135deg, rgba(255,255,255,0.85) 0 2px, transparent 2px 5px)',
        }}
        aria-hidden
      />
    </div>
  )
}

/**
 * A compact three-segment comparison for the top of a screen.
 *
 * Where BasisBands is the full sheet, this is the one-line answer: what the
 * network reads on each book, and what including the rented one does. It sits
 * beside the headline rather than changing it, so a screenshot of the control
 * tower can never be read as the wrong basis.
 */
export function BasisStrip({
  comparison,
  targetPct,
  href,
}: {
  comparison: BasisComparison
  targetPct?: number
  href?: string
}) {
  const noParkAndPay = comparison.parkAndPay.siteCount === 0
  const segments: { basis: BasisId; rollup: BasisRollup }[] = [
    { basis: 'OWN', rollup: comparison.own },
    { basis: 'PNP', rollup: comparison.parkAndPay },
    { basis: 'COMBINED', rollup: comparison.combined },
  ]

  return (
    <div className="grid gap-px overflow-hidden rounded-lg border border-hairline bg-hairline sm:grid-cols-3">
      {segments.map(({ basis, rollup }) => {
        const isTotal = basis === 'COMBINED'
        const over = (rollup.utilizationPct ?? 0) > 100
        return (
          <div key={basis} className={cn('bg-surface px-3.5 py-3', isTotal && 'bg-slate-50')}>
            <div className="flex items-baseline justify-between gap-2">
              <p className="text-[9.5px] font-semibold uppercase tracking-[0.12em] text-ink-muted">
                {BASIS_META[basis].label}
              </p>
              {isTotal && !noParkAndPay ? <BasisImpact value={comparison.utilizationImpactPp} /> : null}
              {basis === 'PNP' && !noParkAndPay ? (
                <span className="tnum text-[10px] text-ink-faint">
                  {formatPct(comparison.capacitySharePct, 1)} of capacity
                </span>
              ) : null}
            </div>
            <p className={cn('tnum mt-1 text-[24px] font-bold leading-none', over ? 'text-bad' : 'text-ink')}>
              <Value missing={rollup.utilizationPct === null} reason="No capacity in scope on this basis.">
                {formatPct(rollup.utilizationPct, 2)}
              </Value>
            </p>
            <UtilizationBar pct={rollup.utilizationPct} targetPct={targetPct} className="mt-2" />
            <p className="tnum mt-1.5 text-[10.5px] text-ink-muted">
              {basis === 'PNP' && noParkAndPay ? (
                'No rented locations in scope'
              ) : (
                <>
                  {formatNumber(rollup.utilizedPallets)} of{' '}
                  <Value missing={rollup.capacity === null}>{formatNumber(rollup.capacity)}</Value> positions
                </>
              )}
            </p>
          </div>
        )
      })}
      {href ? null : null}
    </div>
  )
}
