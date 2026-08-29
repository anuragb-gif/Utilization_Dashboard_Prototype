'use client'

import * as React from 'react'
import { format, parseISO } from 'date-fns'
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { formatNumber, formatPct } from '@/lib/utils'

export interface SeriesSpec {
  key: string
  label: string
  color: string
}

/**
 * Small multi-line chart used for the zone and execution trends.
 *
 * Kept deliberately plain - no fills, no labels on points - because these
 * charts exist to show relative movement between four or five series, and
 * anything heavier makes them unreadable at this size.
 */
export function MultiSeriesLine({
  rows,
  series,
  height = 220,
  unit = 'percent',
  yLabelWidth = 46,
}: {
  rows: Record<string, string | number | null>[]
  series: SeriesSpec[]
  height?: number
  unit?: 'percent' | 'pallets'
  yLabelWidth?: number
}) {
  // Anchoring a percentage axis at zero squashes every series into the top of
  // the plot and hides the movement the chart exists to show. Fit the axis to
  // the data with a small margin instead, and let the tooltip carry exact values.
  const domain = React.useMemo<[number, number]>(() => {
    const values = rows.flatMap((row) =>
      series.map((spec) => row[spec.key]).filter((v): v is number => typeof v === 'number'),
    )
    if (values.length === 0) return [0, 100]
    const min = Math.min(...values)
    const max = Math.max(...values)
    const pad = Math.max((max - min) * 0.18, unit === 'percent' ? 2 : 1)
    return [Math.max(0, Math.floor(min - pad)), Math.ceil(max + pad)]
  }, [rows, series, unit])

  const formatValue = React.useCallback(
    (value: number | null) => (unit === 'percent' ? formatPct(value, 1) : formatNumber(value)),
    [unit],
  )

  return (
    <div style={{ height }} className="px-2 pb-1 pt-2">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={rows} margin={{ top: 8, right: 12, left: 4, bottom: 4 }}>
          <CartesianGrid stroke="#EEF2F6" vertical={false} />
          <XAxis
            dataKey="date"
            tickFormatter={(value: string) => format(parseISO(value), 'dd MMM')}
            tick={{ fontSize: 10.5, fill: '#9CA3AF' }}
            axisLine={{ stroke: '#E3E8EF' }}
            tickLine={false}
            minTickGap={26}
          />
          <YAxis
            domain={domain}
            tick={{ fontSize: 10.5, fill: '#9CA3AF' }}
            axisLine={false}
            tickLine={false}
            width={yLabelWidth}
            tickFormatter={(value: number) => (unit === 'percent' ? `${value}%` : formatNumber(value))}
          />
          <Tooltip
            cursor={{ stroke: '#CBD5E1', strokeWidth: 1 }}
            content={({ active, payload, label }) => {
              if (!active || !payload?.length) return null
              return (
                <div className="rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-[11.5px] text-slate-100 shadow-xl">
                  <p className="mb-1 font-semibold">{format(parseISO(String(label)), 'EEE, dd MMM yyyy')}</p>
                  <dl className="tnum space-y-0.5">
                    {series.map((spec) => {
                      const entry = payload.find((p) => p.dataKey === spec.key)
                      const value = entry?.value
                      return (
                        <div key={spec.key} className="flex items-center justify-between gap-6">
                          <dt className="flex items-center gap-1.5 text-slate-400">
                            <span className="h-2 w-2 rounded-sm" style={{ background: spec.color }} aria-hidden />
                            {spec.label}
                          </dt>
                          <dd className="font-semibold">
                            {typeof value === 'number' ? formatValue(value) : 'N/A'}
                          </dd>
                        </div>
                      )
                    })}
                  </dl>
                </div>
              )
            }}
          />
          <Legend
            verticalAlign="top"
            align="left"
            iconType="plainline"
            iconSize={14}
            wrapperStyle={{ fontSize: 11, color: '#6B7280', paddingBottom: 8 }}
          />
          {series.map((spec) => (
            <Line
              key={spec.key}
              type="monotone"
              dataKey={spec.key}
              name={spec.label}
              stroke={spec.color}
              strokeWidth={1.75}
              dot={false}
              isAnimationActive={false}
              connectNulls
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
