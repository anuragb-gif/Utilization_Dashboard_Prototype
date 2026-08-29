'use client'

import * as React from 'react'
import { format, parseISO } from 'date-fns'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  ComposedChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { AgeingBucket, ExpiryBucket, PalletFlowPoint, ZoneRollup } from '@/lib/domain/types'
import { CHART_COLORS, STATUS_COLORS, ZONE_COLORS } from '@/lib/config/brand'
import { formatNumber, formatPct } from '@/lib/utils'

const AXIS_TICK = { fontSize: 10.5, fill: '#9CA3AF' }

function TooltipShell({ title, rows }: { title: string; rows: { label: string; value: string; color?: string }[] }) {
  return (
    <div className="rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-[11.5px] text-slate-100 shadow-xl">
      <p className="mb-1 font-semibold">{title}</p>
      <dl className="tnum space-y-0.5">
        {rows.map((row) => (
          <div key={row.label} className="flex items-center justify-between gap-6">
            <dt className="flex items-center gap-1.5 text-slate-400">
              {row.color ? <span className="h-2 w-2 rounded-sm" style={{ background: row.color }} aria-hidden /> : null}
              {row.label}
            </dt>
            <dd className="font-semibold">{row.value}</dd>
          </div>
        ))}
      </dl>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Pallet flow
// ---------------------------------------------------------------------------

export function PalletFlowChart({ flow, days = 30, height = 220 }: { flow: PalletFlowPoint[]; days?: number; height?: number }) {
  const data = React.useMemo(
    () =>
      flow.slice(-days).map((point) => ({
        date: point.date,
        inbound: point.inbound,
        outbound: -point.outbound,
        net: point.inbound - point.outbound,
        closing: point.closingPallets,
      })),
    [flow, days],
  )

  return (
    <div style={{ height }} className="px-2 pb-1 pt-3">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 8, right: 8, left: 4, bottom: 4 }} stackOffset="sign">
          <CartesianGrid stroke="#EEF2F6" vertical={false} />
          <XAxis
            dataKey="date"
            tickFormatter={(v: string) => format(parseISO(v), 'dd MMM')}
            tick={AXIS_TICK}
            axisLine={{ stroke: '#E3E8EF' }}
            tickLine={false}
            minTickGap={26}
          />
          <YAxis tick={AXIS_TICK} axisLine={false} tickLine={false} width={46} tickFormatter={(v: number) => formatNumber(Math.abs(v))} />
          <Tooltip
            cursor={{ fill: '#F1F5F9' }}
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null
              const row = payload[0].payload as (typeof data)[number]
              return (
                <TooltipShell
                  title={format(parseISO(row.date), 'EEE, dd MMM yyyy')}
                  rows={[
                    { label: 'Inbound', value: formatNumber(row.inbound), color: CHART_COLORS.inbound },
                    { label: 'Outbound', value: formatNumber(Math.abs(row.outbound)), color: CHART_COLORS.outbound },
                    { label: 'Net movement', value: `${row.net > 0 ? '+' : ''}${formatNumber(row.net)}` },
                    { label: 'Closing pallets', value: formatNumber(row.closing) },
                  ]}
                />
              )
            }}
          />
          <Legend
            verticalAlign="top"
            align="right"
            iconType="square"
            iconSize={8}
            wrapperStyle={{ fontSize: 11, color: '#6B7280', paddingBottom: 6 }}
          />
          <Bar dataKey="inbound" name="Inbound" stackId="flow" fill={CHART_COLORS.inbound} radius={[2, 2, 0, 0]} isAnimationActive={false} />
          <Bar dataKey="outbound" name="Outbound" stackId="flow" fill={CHART_COLORS.outbound} radius={[0, 0, 2, 2]} isAnimationActive={false} />
          <Line type="monotone" dataKey="net" name="Net movement" stroke={CHART_COLORS.actual} strokeWidth={1.75} dot={false} isAnimationActive={false} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Temperature-zone utilization
// ---------------------------------------------------------------------------

export function ZoneUtilizationChart({ zones, height = 190 }: { zones: ZoneRollup[]; height?: number }) {
  const data = zones.map((zone) => ({
    name: zone.zoneName,
    zoneId: zone.zoneId,
    utilization: zone.utilizationPct ?? 0,
    hasValue: zone.utilizationPct !== null,
    occupied: zone.utilizedPallets,
    capacity: zone.capacity,
  }))

  return (
    <div style={{ height }} className="px-2 pb-1 pt-3">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ top: 4, right: 44, left: 4, bottom: 4 }}>
          <CartesianGrid stroke="#EEF2F6" horizontal={false} />
          <XAxis type="number" domain={[0, 110]} tick={AXIS_TICK} axisLine={false} tickLine={false} tickFormatter={(v: number) => `${v}%`} />
          <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: '#374151' }} axisLine={false} tickLine={false} width={130} />
          <Tooltip
            cursor={{ fill: '#F1F5F9' }}
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null
              const row = payload[0].payload as (typeof data)[number]
              return (
                <TooltipShell
                  title={row.name}
                  rows={[
                    { label: 'Utilization', value: row.hasValue ? formatPct(row.utilization) : 'N/A' },
                    { label: 'Occupied', value: formatNumber(row.occupied) },
                    { label: 'Capacity', value: formatNumber(row.capacity) },
                  ]}
                />
              )
            }}
          />
          <Bar dataKey="utilization" radius={[0, 3, 3, 0]} isAnimationActive={false} barSize={18}>
            {data.map((row) => (
              <Cell key={row.zoneId} fill={ZONE_COLORS[row.zoneId] ?? CHART_COLORS.actual} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Inventory ageing / expiry
// ---------------------------------------------------------------------------

export function BucketChart({
  buckets,
  height = 200,
  colorFor,
}: {
  buckets: (AgeingBucket | ExpiryBucket)[]
  height?: number
  colorFor?: (bucket: AgeingBucket | ExpiryBucket) => string
}) {
  const total = buckets.reduce((sum, b) => sum + b.palletCount, 0)
  const data = buckets.map((bucket) => ({
    label: bucket.label,
    pallets: bucket.palletCount,
    share: total === 0 ? null : (bucket.palletCount / total) * 100,
    value: bucket.valueInrLakh,
    fill: colorFor ? colorFor(bucket) : CHART_COLORS.actual,
  }))

  return (
    <div style={{ height }} className="px-2 pb-1 pt-3">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, left: 4, bottom: 4 }}>
          <CartesianGrid stroke="#EEF2F6" vertical={false} />
          <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#6B7280' }} axisLine={{ stroke: '#E3E8EF' }} tickLine={false} interval={0} />
          <YAxis tick={AXIS_TICK} axisLine={false} tickLine={false} width={46} tickFormatter={(v: number) => formatNumber(v)} />
          <Tooltip
            cursor={{ fill: '#F1F5F9' }}
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null
              const row = payload[0].payload as (typeof data)[number]
              return (
                <TooltipShell
                  title={row.label}
                  rows={[
                    { label: 'Pallets', value: formatNumber(row.pallets) },
                    { label: 'Share of stock', value: formatPct(row.share, 1) },
                    { label: 'Est. value', value: row.value === null ? 'N/A' : `₹${row.value.toFixed(1)} L` },
                  ]}
                />
              )
            }}
          />
          <Bar dataKey="pallets" radius={[3, 3, 0, 0]} isAnimationActive={false}>
            {data.map((row) => (
              <Cell key={row.label} fill={row.fill} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

export const SEVERITY_FILL: Record<string, string> = {
  critical: STATUS_COLORS.critical.hex,
  high: STATUS_COLORS.high.hex,
  medium: STATUS_COLORS.watch.hex,
  low: STATUS_COLORS.info.hex,
}
