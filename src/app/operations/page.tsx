'use client'

import * as React from 'react'
import Link from 'next/link'
import { ArrowRight, PackageCheck, Truck, Warehouse } from 'lucide-react'
import { PageHeader } from '@/components/layout/page-header'
import { PalletFlowChart } from '@/components/charts/mini-charts'
import { MultiSeriesLine } from '@/components/charts/multi-series'
import { Card, CardHeader, DeltaChip, InfoTip, StatusChip, Value } from '@/components/ui/primitives'
import { useSnapshot } from '@/lib/state/use-snapshot'
import { DOCK_BY_FACILITY } from '@/lib/data/operations'
import { KPI_DEFINITIONS } from '@/lib/config/kpi-definitions'
import { CHART_COLORS } from '@/lib/config/brand'
import { netMovement } from '@/lib/domain/metrics'
import { formatIst, formatMinutes, formatNumber, formatPct } from '@/lib/utils'

export default function OperationsPage() {
  const snapshot = useSnapshot()
  const flow = snapshot.operations.flow
  const today = flow[flow.length - 1]
  const yesterday = flow[flow.length - 2]
  const pnp = snapshot.parkAndPay.network

  const net = today ? netMovement(today.inbound, today.outbound) : null

  const dockMetrics = [
    { key: 'dockToStockMinutes', value: snapshot.operations.dockToStockMinutes },
    { key: 'stagingDwellMinutes', value: snapshot.operations.stagingDwellMinutes },
    { key: 'dispatchDwellMinutes', value: snapshot.operations.dispatchDwellMinutes },
  ] as const

  const dprRows = React.useMemo(
    () => flow.slice(-30).map((point) => ({ date: point.date, dpr: point.dpr })),
    [flow],
  )

  // Facilities whose receiving is slow enough to be worth a conversation. The
  // network median hides these, which is the point of showing both.
  const dockOutliers = React.useMemo(() => {
    const critical = KPI_DEFINITIONS.dockToStockMinutes.criticalThreshold ?? Infinity
    return snapshot.facilities
      .map((facility) => ({ facility, dock: DOCK_BY_FACILITY[facility.facilityId] }))
      .filter((row) => row.dock?.dockToStockMinutes != null && row.dock.dockToStockMinutes >= critical)
      .sort((a, b) => (b.dock!.dockToStockMinutes ?? 0) - (a.dock!.dockToStockMinutes ?? 0))
      .slice(0, 6)
  }, [snapshot.facilities])

  return (
    <div className="space-y-4">
      <PageHeader
        title="Operations"
        description="Pallet movement into and out of the network, and how quickly receipts reach a storage location."
        crumbs={[{ label: 'Control Tower', href: '/' }, { label: 'Operations' }]}
      />

      <Card>
        <CardHeader
          title="Pallet Flow"
          subtitle={today ? `Movement on ${formatIst(today.date, 'dd MMM yyyy')}` : 'Movement'}
          tip="Closing = opening + putaway − outbound, every day, and the final closing balance equals the occupied pallet count on the control tower. A flow report that does not tie back to the stock snapshot is worse than no flow report."
        />
        <div className="grid gap-3 px-4 py-4 lg:grid-cols-[1fr_auto_1fr_auto_1fr]">
          <FlowNode
            icon={Truck}
            label="Inbound"
            value={formatNumber(today?.inbound)}
            sub={`${formatNumber(today?.putaway)} put away`}
            delta={today && yesterday ? today.inbound - yesterday.inbound : null}
            tone="in"
          />
          <FlowArrow />
          <FlowNode
            icon={Warehouse}
            label="In storage"
            value={formatNumber(today?.closingPallets)}
            sub={`opened at ${formatNumber(today?.openingPallets)}`}
            delta={net}
            tone="store"
          />
          <FlowArrow />
          <FlowNode
            icon={PackageCheck}
            label="Outbound"
            value={formatNumber(today?.outbound)}
            sub={net === null ? 'net movement N/A' : `net ${net > 0 ? '+' : ''}${formatNumber(net)}`}
            delta={today && yesterday ? today.outbound - yesterday.outbound : null}
            tone="out"
          />
        </div>
        <PalletFlowChart flow={flow} days={30} height={230} />
      </Card>

      <div className="grid items-start gap-3 xl:grid-cols-[1fr_1fr]">
        <Card>
          <CardHeader
            title="Dock Performance"
            subtitle="Network medians across facilities in scope"
            tip="Medians rather than means: a single facility with a broken dock should not move the network number, but it should show up as an exception on its own."
          />
          <dl className="divide-y divide-hairline">
            {dockMetrics.map(({ key, value }) => {
              const def = KPI_DEFINITIONS[key]
              const status =
                value === null
                  ? 'unknown'
                  : def.criticalThreshold !== null && value >= def.criticalThreshold
                    ? 'critical'
                    : def.warningThreshold !== null && value >= def.warningThreshold
                      ? 'watch'
                      : 'healthy'
              return (
                <div key={key} className="flex items-center justify-between gap-4 px-4 py-3">
                  <div className="min-w-0">
                    <dt className="flex items-center gap-1.5 text-[12.5px] font-semibold text-ink">
                      {def.name}
                      <InfoTip label={def.name} text={`${def.description}\n\nFormula: ${def.formula}\nSource: ${def.source}`} />
                    </dt>
                    <dd className="tnum mt-0.5 text-[10.5px] text-ink-muted">
                      target {def.target} min · warning {def.warningThreshold} min · critical {def.criticalThreshold} min
                    </dd>
                  </div>
                  <dd className="flex items-center gap-2">
                    <span className="tnum text-[20px] font-bold text-ink">
                      <Value missing={value === null}>{formatMinutes(value)}</Value>
                    </span>
                    <StatusChip status={status} size="xs" />
                  </dd>
                </div>
              )
            })}
          </dl>

          <div className="border-t border-hairline px-4 py-3">
            <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-muted">
              Slowest receiving facilities
            </p>
            {dockOutliers.length === 0 ? (
              <p className="text-[11.5px] text-ink-muted">
                No facility in scope is above the {KPI_DEFINITIONS.dockToStockMinutes.criticalThreshold} minute
                dock-to-stock critical threshold.
              </p>
            ) : (
              <ul className="space-y-1">
                {dockOutliers.map(({ facility, dock }) => (
                  <li key={facility.facilityId} className="flex items-center gap-2">
                    <Link
                      href={`/warehouses/${encodeURIComponent(facility.facilityId)}`}
                      className="w-24 shrink-0 text-[11.5px] font-semibold text-brand-600 hover:underline"
                    >
                      {facility.code}
                    </Link>
                    <span className="min-w-0 flex-1 truncate text-[11px] text-ink-muted">
                      {facility.cityName} · {formatPct(facility.utilizationPct, 1)} full
                    </span>
                    <span className="h-1.5 w-20 overflow-hidden rounded-full bg-slate-100">
                      <span
                        className="block h-full rounded-full bg-hot"
                        style={{ width: `${Math.min(((dock?.dockToStockMinutes ?? 0) / 400) * 100, 100)}%` }}
                      />
                    </span>
                    <span className="tnum w-14 shrink-0 text-right text-[11.5px] font-semibold text-ink">
                      {formatMinutes(dock?.dockToStockMinutes ?? null)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </Card>

        <Card>
          <CardHeader
            title={
              <span className="inline-flex items-center gap-1.5">
                DPR
                <InfoTip label="DPR" text={KPI_DEFINITIONS.dpr.definitionPending ?? ''} />
              </span>
            }
            subtitle="Carried across from the legacy daily report"
          />
          <div className="border-b border-hairline bg-warn-soft/50 px-4 py-2 text-[11.5px] text-[#8a5b08]">
            <strong>Definition to be mapped from Snowman source system.</strong> No formula, target or threshold has been
            assigned in this prototype.
          </div>
          <div className="px-4 pt-3">
            <p className="tnum text-[26px] font-bold text-ink">{formatNumber(snapshot.operations.dpr)}</p>
            <p className="text-[11px] text-ink-muted">value on the report date</p>
          </div>
          <MultiSeriesLine
            rows={dprRows}
            series={[{ key: 'dpr', label: 'DPR', color: CHART_COLORS.budget }]}
            unit="pallets"
            height={190}
            yLabelWidth={56}
          />
        </Card>
      </div>

      {/* Park & Pay is storage, not movement. It has its own screen; what
          belongs here is the one operational fact - rented space carries no
          structural headroom, so an overflow there has nowhere to go. */}
      <Card>
        <CardHeader
          title="Park & Pay"
          subtitle="Rented storage, reported on its own screen"
          tip="Park & Pay is a separate operating model - pallet positions rented from third parties and sold on - so it is measured against its own contracted capacity rather than folded into network flow. The full grid, the contribution by region and the contract position are on the Park & Pay screen."
        />
        <div className="flex flex-wrap items-center gap-x-8 gap-y-3 px-4 py-3.5">
          <Metric label="Contracted positions" value={formatNumber(pnp.parkAndPay.capacity)} />
          <Metric label="Occupied" value={formatNumber(pnp.parkAndPay.utilizedPallets)} />
          <Metric
            label="Utilization"
            value={formatPct(pnp.parkAndPay.utilizationPct, 2)}
            tone={(pnp.parkAndPay.utilizationPct ?? 0) > 100 ? 'bad' : undefined}
          />
          <Metric
            label="Over contracted space"
            value={formatNumber(pnp.parkAndPay.overCapacityPallets)}
            tone={pnp.parkAndPay.overCapacityPallets > 0 ? 'bad' : undefined}
          />
          <Link
            href="/park-and-pay"
            className="ml-auto inline-flex items-center gap-1 rounded-md border border-hairline bg-surface px-2.5 py-1.5 text-[11.5px] font-semibold text-brand-600 transition-colors hover:border-brand-300 hover:bg-brand-50"
          >
            Open Park &amp; Pay
            <ArrowRight className="h-3 w-3" strokeWidth={2.5} aria-hidden />
          </Link>
        </div>
      </Card>
    </div>
  )
}

function FlowNode({
  icon: Icon,
  label,
  value,
  sub,
  delta,
  tone,
}: {
  icon: React.ElementType
  label: string
  value: string
  sub: string
  delta: number | null
  tone: 'in' | 'store' | 'out'
}) {
  const color = tone === 'in' ? '#0F8A5F' : tone === 'out' ? '#B7791F' : '#1B6EC2'
  return (
    <div className="rounded-lg border border-hairline bg-slate-50/60 px-4 py-3">
      <div className="flex items-center gap-2">
        <span
          className="flex h-7 w-7 items-center justify-center rounded"
          style={{ background: `${color}1a`, color }}
          aria-hidden
        >
          <Icon className="h-4 w-4" strokeWidth={2.25} />
        </span>
        <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-muted">{label}</p>
      </div>
      <p className="tnum mt-2 text-[26px] font-bold leading-none text-ink">{value}</p>
      <p className="tnum mt-1 flex items-center gap-2 text-[11px] text-ink-muted">
        {sub}
        <DeltaChip value={delta} suffix="" digits={0} />
      </p>
    </div>
  )
}

function FlowArrow() {
  return (
    <div className="hidden items-center justify-center lg:flex" aria-hidden>
      <ArrowRight className="h-5 w-5 text-ink-faint" strokeWidth={2} />
    </div>
  )
}

function Metric({ label, value, tone }: { label: string; value: string; tone?: 'bad' }) {
  return (
    <div>
      <p className="text-[9.5px] font-semibold uppercase tracking-[0.12em] text-ink-muted">{label}</p>
      <p className={`tnum mt-0.5 text-[19px] font-bold leading-none ${tone === 'bad' ? 'text-bad' : 'text-ink'}`}>
        {value}
      </p>
    </div>
  )
}
