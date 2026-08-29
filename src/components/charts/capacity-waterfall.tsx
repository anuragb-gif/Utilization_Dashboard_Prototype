'use client'

import * as React from 'react'
import { Bar, BarChart, Cell, LabelList, ReferenceLine, ResponsiveContainer, XAxis, YAxis } from 'recharts'
import type { CapacityRollup } from '@/lib/domain/types'
import { CHART_COLORS } from '@/lib/config/brand'
import { formatNumber, formatPct } from '@/lib/utils'
import { InfoTip } from '@/components/ui/primitives'

interface Step {
  name: string
  base: number
  value: number
  color: string
  display: number
  note: string
}

/**
 * Capacity waterfall.
 *
 * Answers "where has the capacity gone" in one read: the capacity master,
 * what is occupied, what is genuinely free, and what is being held above
 * capacity. Over-capacity is shown as its own step rather than being netted
 * off the available figure, because the two are different problems.
 */
export function CapacityWaterfall({ rollup, height = 200 }: { rollup: CapacityRollup; height?: number }) {
  const capacity = rollup.capacity ?? 0
  const occupied = rollup.utilizedPallets
  const available = rollup.availableCapacity ?? 0
  const over = rollup.overCapacityPallets

  const steps: Step[] = [
    {
      name: 'Capacity',
      base: 0,
      value: capacity,
      display: capacity,
      color: '#CBD5E1',
      note: 'Rackable pallet positions on the capacity master',
    },
    {
      name: 'Occupied',
      base: capacity - occupied > 0 ? capacity - occupied : 0,
      value: Math.min(occupied, capacity),
      display: occupied,
      color: CHART_COLORS.occupied,
      note: 'Pallet positions occupied at close of the reporting day',
    },
    {
      name: 'Available',
      base: 0,
      value: available,
      display: available,
      color: CHART_COLORS.available,
      note: 'Sum of positive headroom, facility by facility',
    },
    {
      name: 'Over capacity',
      base: 0,
      value: over,
      display: over,
      color: CHART_COLORS.over,
      note: 'Pallets held above the capacity master',
    },
  ]

  const reconciles = rollup.netEmptyPallets !== null && capacity - occupied === rollup.netEmptyPallets

  return (
    <div>
      <div style={{ height }} className="px-2 pt-2">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={steps} margin={{ top: 22, right: 8, left: 8, bottom: 4 }} barCategoryGap="28%">
            <XAxis
              dataKey="name"
              tick={{ fontSize: 10.5, fill: '#6B7280' }}
              axisLine={{ stroke: '#E3E8EF' }}
              tickLine={false}
            />
            <YAxis hide domain={[0, capacity * 1.12]} />
            {/* The occupied step is drawn as a deduction from capacity, so a
                guide at the resulting headroom makes the waterfall legible. */}
            <ReferenceLine y={capacity} stroke="#CBD5E1" strokeDasharray="3 3" strokeWidth={1} />
            {capacity - occupied > 0 ? (
              <ReferenceLine y={capacity - occupied} stroke="#CBD5E1" strokeDasharray="3 3" strokeWidth={1} />
            ) : null}
            <Bar dataKey="base" stackId="w" fill="transparent" isAnimationActive={false} />
            <Bar dataKey="value" stackId="w" radius={[2, 2, 0, 0]} isAnimationActive={false}>
              {steps.map((step) => (
                <Cell key={step.name} fill={step.color} />
              ))}
              <LabelList
                dataKey="display"
                position="top"
                formatter={(value: unknown) => formatNumber(typeof value === 'number' ? value : Number(value))}
                style={{ fontSize: 11, fontWeight: 700, fill: '#111827' }}
              />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      <dl className="grid grid-cols-2 gap-x-4 gap-y-1.5 border-t border-hairline px-4 py-3 text-[11.5px] sm:grid-cols-4">
        {steps.map((step) => (
          <div key={step.name}>
            <dt className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-ink-faint">
              <span className="inline-block h-2 w-2 rounded-sm" style={{ background: step.color }} aria-hidden />
              {step.name}
            </dt>
            <dd className="tnum mt-0.5 font-semibold text-ink">{formatNumber(step.display)}</dd>
            <dd className="text-[10.5px] leading-snug text-ink-muted">{step.note}</dd>
          </div>
        ))}
      </dl>

      <div className="flex items-start gap-1.5 border-t border-hairline bg-slate-50 px-4 py-2 text-[11px] leading-relaxed text-ink-muted">
        <InfoTip
          label="Available versus empty"
          text="Available capacity sums positive headroom facility by facility. The legacy report publishes capacity minus occupied at network level, which nets off over-capacity pallets. The two differ by exactly the over-capacity figure, and both are shown so the difference is explicit rather than reconciled away."
        />
        <p>
          Available capacity <strong className="tnum text-ink">{formatNumber(available)}</strong> exceeds the legacy
          &ldquo;empty pallets&rdquo; figure of <strong className="tnum text-ink">{formatNumber(rollup.netEmptyPallets)}</strong> by{' '}
          <strong className="tnum text-ink">{formatNumber(over)}</strong> — the pallets currently held above capacity.
          {reconciles ? '' : ' Figures did not reconcile; review the capacity master.'}{' '}
          Network utilization <strong className="tnum text-ink">{formatPct(rollup.utilizationPct)}</strong>.
        </p>
      </div>
    </div>
  )
}
