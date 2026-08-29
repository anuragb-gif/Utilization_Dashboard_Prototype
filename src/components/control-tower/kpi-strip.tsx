'use client'

import * as React from 'react'
import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import type { ControlTowerSnapshot } from '@/lib/repository'
import { KPI_DEFINITIONS } from '@/lib/config/kpi-definitions'
import { Card, DeltaChip, InfoTip, StatusChip, UtilizationBar, Value } from '@/components/ui/primitives'
import { useCountUp } from '@/components/ui/count-up'
import { utilizationStatus } from '@/lib/config/thresholds'
import { cn, formatNumber, formatPct, formatPp } from '@/lib/utils'

function kpiTooltip(id: keyof typeof KPI_DEFINITIONS): string {
  const def = KPI_DEFINITIONS[id]
  return `${def.description}\n\nFormula: ${def.formula}\nSource: ${def.source} · Owner: ${def.owner}`
}

function KpiCard({
  label,
  tip,
  children,
  className,
  tone = 'default',
  href,
}: {
  label: string
  tip: string
  children: React.ReactNode
  className?: string
  tone?: 'default' | 'critical'
  href?: string
}) {
  const body = (
    <Card
      className={cn(
        'flex h-full flex-col justify-between p-3 transition-shadow',
        tone === 'critical' ? 'border-bad-line bg-bad-soft/40' : '',
        href ? 'hover:shadow-[0_2px_8px_rgba(16,24,40,0.09)]' : '',
        className,
      )}
    >
      <div className="flex items-start justify-between gap-1">
        <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-ink-muted">{label}</p>
        <InfoTip label={label} text={tip} />
      </div>
      <div className="mt-1.5">{children}</div>
    </Card>
  )
  return href ? (
    <Link href={href} className="block h-full focus-visible:rounded-lg">
      {body}
    </Link>
  ) : (
    body
  )
}

export function KpiStrip({ snapshot }: { snapshot: ControlTowerSnapshot }) {
  const { network } = snapshot
  const animatedUtil = useCountUp(network.utilizationPct)
  const animatedOccupied = useCountUp(network.utilizedPallets)
  const status = utilizationStatus(network.utilizationPct)

  const comparisonRows: { label: string; value: number | null }[] = [
    { label: 'Prev day', value: network.comparison.previousDayPct },
    { label: 'Prev week', value: network.comparison.previousWeekPct },
    { label: 'Last year', value: network.comparison.samePeriodLastYearPct },
  ]

  return (
    <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-4 xl:grid-cols-6">
      {/* Headline utilization spans two columns - it is the answer to the
          first question the report exists to answer. */}
      <KpiCard
        label="Network Utilization"
        tip={kpiTooltip('networkUtilization')}
        className="col-span-2"
        href="/utilization"
      >
        <div className="flex items-end justify-between gap-3">
          <div>
            <p className="tnum text-[34px] font-bold leading-none tracking-tight text-ink">
              <Value missing={network.utilizationPct === null} reason="No facility in scope has a capacity master row.">
                {formatPct(animatedUtil)}
              </Value>
            </p>
            <div className="mt-1.5 flex flex-wrap items-center gap-2">
              <StatusChip status={status} />
              <span className="tnum text-[11px] text-ink-muted">
                Budget {network.targetPct}% ·{' '}
                <strong className={network.variancePct !== null && network.variancePct < 0 ? 'text-warn' : 'text-ink'}>
                  {formatPp(network.variancePct)}
                </strong>
              </span>
            </div>
          </div>
          <dl className="shrink-0 space-y-0.5 text-right">
            {comparisonRows.map((row) => (
              <div key={row.label} className="flex items-center justify-end gap-2">
                <dt className="text-[10px] text-ink-faint">{row.label}</dt>
                <dd className="tnum w-24 text-right text-[11px] font-medium text-ink-soft">
                  {formatPct(row.value, 2)}
                  <DeltaChip
                    value={network.utilizationPct === null || row.value === null ? null : network.utilizationPct - row.value}
                    suffix=""
                    digits={2}
                    className="ml-1.5"
                  />
                </dd>
              </div>
            ))}
          </dl>
        </div>
        <UtilizationBar pct={network.utilizationPct} targetPct={network.targetPct} className="mt-2.5" />
      </KpiCard>

      <KpiCard label="Total Capacity" tip={kpiTooltip('totalCapacity')} href="/capacity">
        <p className="tnum text-[22px] font-bold leading-none text-ink">
          <Value missing={network.capacity === null} reason="No capacity master rows in scope.">
            {formatNumber(network.capacity)}
          </Value>
        </p>
        <p className="mt-1 text-[10.5px] leading-snug text-ink-muted">
          pallet positions across {network.facilityCount - network.facilitiesMissingCapacity} facilities
        </p>
        {network.facilitiesMissingCapacity > 0 ? (
          <p className="mt-1 text-[10.5px] font-medium text-warn">
            {network.facilitiesMissingCapacity} excluded — no capacity master
          </p>
        ) : null}
      </KpiCard>

      <KpiCard label="Utilized Pallets" tip={kpiTooltip('utilizedPallets')} href="/capacity">
        <p className="tnum text-[22px] font-bold leading-none text-ink">{formatNumber(animatedOccupied)}</p>
        <p className="mt-1 text-[10.5px] leading-snug text-ink-muted">occupied pallet positions</p>
        {network.excludedUtilizedPallets > 0 ? (
          <p className="mt-1 text-[10.5px] font-medium text-warn">
            +{formatNumber(network.excludedUtilizedPallets)} not in denominator
          </p>
        ) : null}
      </KpiCard>

      <KpiCard label="Empty Pallets" tip={kpiTooltip('netEmptyPallets')} href="/capacity">
        <p className="tnum text-[22px] font-bold leading-none text-ink">
          <Value missing={network.netEmptyPallets === null} reason="Capacity master missing.">
            {formatNumber(network.netEmptyPallets)}
          </Value>
        </p>
        <p className="mt-1 text-[10.5px] leading-snug text-ink-muted">legacy definition (capacity − occupied)</p>
        <p className="mt-1 text-[10.5px] font-medium text-brand-600">
          {formatNumber(network.availableCapacity)} truly available
        </p>
      </KpiCard>

      <KpiCard
        label="Over-Capacity"
        tip={kpiTooltip('overCapacityPallets')}
        tone={network.overCapacityPallets > 0 ? 'critical' : 'default'}
        href="/exceptions"
      >
        <p
          className={cn(
            'tnum text-[22px] font-bold leading-none',
            network.overCapacityPallets > 0 ? 'text-bad' : 'text-ink',
          )}
        >
          {network.overCapacityFacilities} {network.overCapacityFacilities === 1 ? 'facility' : 'facilities'}
        </p>
        <p className="tnum mt-1 text-[10.5px] leading-snug text-ink-muted">
          {formatNumber(network.overCapacityPallets)} pallets above capacity
        </p>
        {network.overCapacityPallets > 0 ? (
          <p className="mt-1 inline-flex items-center gap-1 text-[10.5px] font-semibold text-bad">
            Action required
            <ArrowRight className="h-2.5 w-2.5" strokeWidth={3} aria-hidden />
          </p>
        ) : (
          <p className="mt-1 text-[10.5px] font-medium text-ok">Within capacity master</p>
        )}
      </KpiCard>

      <KpiCard label="Forecast Utilization" tip={kpiTooltip('forecastUtilization')} href="/capacity">
        <dl className="tnum grid grid-cols-3 gap-1">
          {(
            [
              ['7d', network.forecast.horizon7Pct],
              ['14d', network.forecast.horizon14Pct],
              ['30d', network.forecast.horizon30Pct],
            ] as const
          ).map(([label, value]) => (
            <div key={label}>
              <dt className="text-[9.5px] font-semibold uppercase text-ink-faint">{label}</dt>
              <dd className="text-[15px] font-bold leading-tight text-ink">{formatPct(value, 1)}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-1.5 inline-flex items-center gap-1 rounded border border-violet-200 bg-violet-50 px-1.5 py-0.5 text-[9.5px] font-semibold uppercase tracking-wide text-violet-700">
          Prototype forecast
        </p>
      </KpiCard>
    </div>
  )
}
