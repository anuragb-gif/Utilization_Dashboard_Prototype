'use client'

import * as React from 'react'
import { format, parseISO } from 'date-fns'
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceDot,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { UtilizationPoint } from '@/lib/domain/types'
import { CHART_COLORS } from '@/lib/config/brand'
import { Segmented } from '@/components/ui/primitives'
import { formatNumber, formatPct, formatPp } from '@/lib/utils'

export type TrendRange = '7D' | '30D' | '90D' | 'YTD'

const RANGE_OPTIONS: { value: TrendRange; label: string }[] = [
  { value: '7D', label: '7D' },
  { value: '30D', label: '30D' },
  { value: '90D', label: '90D' },
  { value: 'YTD', label: 'YTD' },
]

interface Row {
  date: string
  actualPct: number | null
  forecastPct: number | null
  budgetPct: number
  lastYearPct: number | null
  utilizedPallets: number
  capacity: number
}

function buildRows(history: UtilizationPoint[], forecast: UtilizationPoint[], range: TrendRange, showForecast: boolean): Row[] {
  const sliced = (() => {
    switch (range) {
      case '7D':
        return history.slice(-7)
      case '30D':
        return history.slice(-30)
      case '90D':
        return history.slice(-90)
      case 'YTD': {
        const year = history[history.length - 1]?.date.slice(0, 4)
        return history.filter((p) => p.date.slice(0, 4) === year)
      }
    }
  })()

  const rows: Row[] = sliced.map((point) => ({
    date: point.date,
    actualPct: point.capacity === 0 ? null : Number(((point.utilizedPallets / point.capacity) * 100).toFixed(2)),
    forecastPct: null,
    budgetPct: point.budgetPct,
    lastYearPct: point.lastYearPct,
    utilizedPallets: point.utilizedPallets,
    capacity: point.capacity,
  }))

  if (!showForecast || rows.length === 0) return rows

  // Seed the forecast line at the last actual so the two segments join
  // instead of appearing as an unexplained jump.
  rows[rows.length - 1].forecastPct = rows[rows.length - 1].actualPct
  for (const point of forecast) {
    rows.push({
      date: point.date,
      actualPct: null,
      forecastPct: point.capacity === 0 ? null : Number(((point.utilizedPallets / point.capacity) * 100).toFixed(2)),
      budgetPct: point.budgetPct,
      lastYearPct: null,
      utilizedPallets: point.utilizedPallets,
      capacity: point.capacity,
    })
  }
  return rows
}

function TrendTooltip({ active, payload }: { active?: boolean; payload?: { payload: Row }[] }) {
  if (!active || !payload?.length) return null
  const row = payload[0].payload
  const value = row.actualPct ?? row.forecastPct
  const variance = value === null ? null : value - row.budgetPct
  const isForecast = row.actualPct === null

  return (
    <div className="min-w-56 rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-[11.5px] text-slate-100 shadow-xl">
      <p className="mb-1.5 flex items-center justify-between gap-3 font-semibold">
        {format(parseISO(row.date), 'EEE, dd MMM yyyy')}
        {isForecast ? (
          <span className="rounded bg-violet-500/25 px-1 text-[9.5px] font-bold uppercase tracking-wide text-violet-200">
            Forecast
          </span>
        ) : null}
      </p>
      <dl className="tnum space-y-0.5">
        <Row label={isForecast ? 'Projected' : 'Actual'} value={formatPct(value)} />
        <Row label="Budget" value={formatPct(row.budgetPct)} />
        <Row label="Variance" value={variance === null ? 'N/A' : formatPp(variance)} tone={variance !== null && variance > 0 ? 'bad' : 'ok'} />
        <Row label="Last year" value={row.lastYearPct === null ? 'N/A' : formatPct(row.lastYearPct)} />
        <div className="my-1 border-t border-slate-700" />
        <Row label="Occupied pallets" value={formatNumber(row.utilizedPallets)} />
        <Row label="Capacity" value={formatNumber(row.capacity)} />
      </dl>
    </div>
  )
}

function Row({ label, value, tone }: { label: string; value: string; tone?: 'ok' | 'bad' }) {
  return (
    <div className="flex items-center justify-between gap-6">
      <dt className="text-slate-400">{label}</dt>
      <dd className={tone === 'bad' ? 'font-semibold text-red-300' : tone === 'ok' ? 'font-semibold text-emerald-300' : 'font-semibold'}>
        {value}
      </dd>
    </div>
  )
}

/**
 * Network utilization trend.
 *
 * Deliberately sparse: no data label on every point. Only the latest reading,
 * the period maximum and the period minimum are labelled, which is what makes
 * the shape readable at a glance in a management review.
 */
export function UtilizationTrendChart({
  history,
  forecast,
  targetPct,
  height = 260,
  defaultRange = '30D',
  showForecastToggle = true,
}: {
  history: UtilizationPoint[]
  forecast: UtilizationPoint[]
  targetPct: number
  height?: number
  defaultRange?: TrendRange
  showForecastToggle?: boolean
}) {
  const [range, setRange] = React.useState<TrendRange>(defaultRange)
  const [showForecast, setShowForecast] = React.useState(true)

  const rows = React.useMemo(
    () => buildRows(history, forecast, range, showForecast),
    [history, forecast, range, showForecast],
  )

  const actuals = rows.filter((r) => r.actualPct !== null) as (Row & { actualPct: number })[]
  const latest = actuals[actuals.length - 1]
  const max = actuals.reduce((best, r) => (r.actualPct > best.actualPct ? r : best), actuals[0])
  const min = actuals.reduce((best, r) => (r.actualPct < best.actualPct ? r : best), actuals[0])

  const values = rows.flatMap((r) => [r.actualPct, r.forecastPct, r.lastYearPct, r.budgetPct].filter((v): v is number => v !== null))
  const domainMin = Math.floor(Math.min(...values, targetPct) - 3)
  const domainMax = Math.ceil(Math.max(...values, targetPct) + 3)

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 pt-3 no-print">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-ink-muted">
          <LegendKey color={CHART_COLORS.actual} label="Actual" />
          <LegendKey color={CHART_COLORS.budget} label="Budget" dashed />
          <LegendKey color={CHART_COLORS.lastYear} label="Same period last year" dashed />
          {showForecast ? <LegendKey color={CHART_COLORS.forecast} label="Prototype forecast" dashed /> : null}
        </div>
        <div className="flex items-center gap-2">
          {showForecastToggle ? (
            <label className="inline-flex items-center gap-1.5 text-[11.5px] text-ink-muted">
              <input
                type="checkbox"
                checked={showForecast}
                onChange={(e) => setShowForecast(e.target.checked)}
                aria-label="Show prototype forecast on the chart"
                className="h-3 w-3 accent-[#7C3AED]"
              />
              Show forecast
            </label>
          ) : null}
          <Segmented options={RANGE_OPTIONS} value={range} onChange={setRange} ariaLabel="Trend range" />
        </div>
      </div>

      <div style={{ height }} className="px-1 pb-1 pt-2">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={rows} margin={{ top: 16, right: 46, left: 4, bottom: 4 }}>
            <defs>
              <linearGradient id="utilFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={CHART_COLORS.actual} stopOpacity={0.11} />
                <stop offset="100%" stopColor={CHART_COLORS.actual} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke="#EEF2F6" vertical={false} />
            <XAxis
              dataKey="date"
              tickFormatter={(value: string) => format(parseISO(value), range === 'YTD' || range === '90D' ? 'MMM' : 'dd MMM')}
              tick={{ fontSize: 10.5, fill: '#9CA3AF' }}
              axisLine={{ stroke: '#E3E8EF' }}
              tickLine={false}
              minTickGap={28}
            />
            <YAxis
              domain={[domainMin, domainMax]}
              tickFormatter={(value: number) => `${value}%`}
              tick={{ fontSize: 10.5, fill: '#9CA3AF' }}
              axisLine={false}
              tickLine={false}
              width={40}
            />
            <Tooltip content={<TrendTooltip />} cursor={{ stroke: '#CBD5E1', strokeWidth: 1 }} />

            <ReferenceLine
              y={100}
              stroke="#C62828"
              strokeDasharray="2 3"
              strokeWidth={1}
              label={{ value: 'Capacity 100%', position: 'insideTopRight', fontSize: 9.5, fill: '#C62828' }}
            />
            <Area type="monotone" dataKey="actualPct" stroke="none" fill="url(#utilFill)" isAnimationActive={false} connectNulls={false} />
            <Line
              type="monotone"
              dataKey="lastYearPct"
              stroke={CHART_COLORS.lastYear}
              strokeWidth={1.25}
              strokeDasharray="3 3"
              dot={false}
              isAnimationActive={false}
              connectNulls
            />
            <Line
              type="stepAfter"
              dataKey="budgetPct"
              stroke={CHART_COLORS.budget}
              strokeWidth={1.25}
              strokeDasharray="5 3"
              dot={false}
              isAnimationActive={false}
            />
            <Line
              type="monotone"
              dataKey="forecastPct"
              stroke={CHART_COLORS.forecast}
              strokeWidth={1.75}
              strokeDasharray="4 3"
              dot={false}
              isAnimationActive={false}
              connectNulls
            />
            <Line
              type="monotone"
              dataKey="actualPct"
              stroke={CHART_COLORS.actual}
              strokeWidth={2}
              dot={false}
              isAnimationActive={false}
              connectNulls={false}
            />

            {/* Only three labelled points: latest, period max, period min. */}
            {max ? <ReferenceDot x={max.date} y={max.actualPct} r={3} fill="#fff" stroke={CHART_COLORS.actual} strokeWidth={1.5} label={{ value: `max ${max.actualPct.toFixed(1)}%`, position: 'top', fontSize: 9.5, fill: '#6B7280' }} /> : null}
            {min && min.date !== max?.date ? <ReferenceDot x={min.date} y={min.actualPct} r={3} fill="#fff" stroke={CHART_COLORS.actual} strokeWidth={1.5} label={{ value: `min ${min.actualPct.toFixed(1)}%`, position: 'bottom', fontSize: 9.5, fill: '#6B7280' }} /> : null}
            {latest ? <ReferenceDot x={latest.date} y={latest.actualPct} r={4} fill={CHART_COLORS.actual} stroke="#fff" strokeWidth={2} label={{ value: `${latest.actualPct.toFixed(2)}%`, position: 'right', fontSize: 11, fontWeight: 700, fill: '#12508F' }} /> : null}
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

function LegendKey({ color, label, dashed }: { color: string; label: string; dashed?: boolean }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <svg width="16" height="6" aria-hidden>
        <line x1="0" y1="3" x2="16" y2="3" stroke={color} strokeWidth={2} strokeDasharray={dashed ? '4 3' : undefined} />
      </svg>
      {label}
    </span>
  )
}
