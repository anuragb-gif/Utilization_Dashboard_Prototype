'use client'

import * as React from 'react'
import { PageHeader } from '@/components/layout/page-header'
import { UtilizationTrendChart } from '@/components/charts/utilization-trend'
import { MultiSeriesLine } from '@/components/charts/multi-series'
import { Card, CardHeader, DeltaChip, InfoTip, Segmented, StatusChip, Value } from '@/components/ui/primitives'
import { BASIS_META, BASIS_OPTIONS, rollupFor } from '@/components/panels/basis-bands'
import type { BasisId } from '@/lib/domain/types'
import { useSnapshot } from '@/lib/state/use-snapshot'
import { CHART_COLORS, ZONE_COLORS } from '@/lib/config/brand'
import { EXECUTION_LABEL, TEMPERATURE_ZONES } from '@/lib/data/master'
import { KPI_DEFINITIONS } from '@/lib/config/kpi-definitions'
import { formatIst, formatNumber, formatPct } from '@/lib/utils'
import { utilizationStatus } from '@/lib/config/thresholds'

const EXECUTION_COLORS: Record<string, string> = {
  SNOWMAN_OWN: '#1B6EC2',
  PARTNER_OPERATED: '#0F8A5F',
  CUSTOMER_DEDICATED: '#B7791F',
}

export default function UtilizationPage() {
  const snapshot = useSnapshot()
  const { network } = snapshot

  // Today's figure can be re-based; the comparison periods below it cannot.
  // The rented book publishes 30 days of history against the 260 the own
  // network carries, so a combined "same period last year" does not exist and
  // is not invented.
  const [basis, setBasis] = React.useState<BasisId>('OWN')
  const active = rollupFor(snapshot.parkAndPay.network, basis)
  const noParkAndPay = snapshot.parkAndPay.network.parkAndPay.siteCount === 0

  const zoneSeries = snapshot.zoneSeries
  const zoneRows = React.useMemo(() => {
    const dates = zoneSeries.FROZEN?.map((row) => row.date) ?? []
    return dates.map((date, index) => {
      const row: Record<string, string | number | null> = { date }
      for (const zone of TEMPERATURE_ZONES) {
        row[zone.id] = zoneSeries[zone.id]?.[index]?.utilizationPct ?? null
      }
      return row
    })
  }, [zoneSeries])

  const executionSeries = snapshot.executionSeries
  const executionRows = React.useMemo(() => {
    const keys = Object.keys(executionSeries) as (keyof typeof executionSeries)[]
    const dates = executionSeries[keys[0]]?.map((row) => row.date) ?? []
    return dates.map((date, index) => {
      const row: Record<string, string | number | null> = { date }
      for (const key of keys) {
        row[key] = executionSeries[key]?.[index]?.availablePallets ?? null
      }
      return row
    })
  }, [executionSeries])

  const dprRows = React.useMemo(
    () =>
      snapshot.operations.flow.slice(-30).map((point) => ({
        date: point.date,
        dpr: point.dpr,
      })),
    [snapshot.operations.flow],
  )

  const comparisons = [
    { label: 'Previous day', value: network.comparison.previousDayPct },
    { label: 'Previous week', value: network.comparison.previousWeekPct },
    { label: '30 days ago', value: network.comparison.previousMonthPct },
    { label: 'Same period last year', value: network.comparison.samePeriodLastYearPct },
    { label: 'Budget', value: network.comparison.budgetPct },
  ]

  return (
    <div className="space-y-4">
      <PageHeader
        title="Utilization"
        description="How the network is tracking against budget and against last year, and how the individual temperature zones and execution models are moving underneath the headline."
        crumbs={[{ label: 'Control Tower', href: '/' }, { label: 'Utilization' }]}
      />

      <div className="grid items-start gap-3 xl:grid-cols-[1fr_320px]">
        <Card>
          <CardHeader
            title="Network Utilization Trend"
            subtitle={`Report date ${formatIst(network.reportDate, 'dd MMM yyyy')} · actual, budget, same period last year and prototype forecast`}
            tip="The budget line is drawn as a step because the budget is agreed monthly — drawing it smooth would misrepresent how the number is set. Only the latest, maximum and minimum readings are labelled."
          />
          <UtilizationTrendChart
            history={snapshot.series.history}
            forecast={snapshot.series.forecast}
            targetPct={network.targetPct}
            height={320}
            defaultRange="90D"
          />
        </Card>

        <Card>
          <CardHeader
            title="Comparison Summary"
            subtitle="Today against every configured comparison period"
            tip="Every comparison is computed from the same aggregated series shown on the left, so a number here can always be found on the chart. Today's figure can be re-based onto the rented book; the comparison periods cannot, because Park & Pay publishes 30 days of history rather than the 260 the own network carries."
          />
          <div className="px-4 py-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-ink-faint">Utilization today</p>
              {noParkAndPay ? null : (
                <Segmented options={BASIS_OPTIONS} value={basis} onChange={setBasis} ariaLabel="Utilization basis" size="xs" />
              )}
            </div>
            <div className="mt-1 flex items-baseline gap-2">
              <span
                className={`tnum text-[30px] font-bold leading-none ${(active.utilizationPct ?? 0) > 100 ? 'text-bad' : 'text-ink'}`}
              >
                <Value missing={active.utilizationPct === null} reason="Nothing in scope on this basis has a capacity master row.">
                  {formatPct(active.utilizationPct)}
                </Value>
              </span>
              <StatusChip status={utilizationStatus(active.utilizationPct)} />
            </div>
            <p className="tnum mt-1 text-[11.5px] text-ink-muted">
              {formatNumber(active.utilizedPallets)} of <Value missing={active.capacity === null}>{formatNumber(active.capacity)}</Value>{' '}
              pallet positions · {BASIS_META[basis].label}
            </p>
            {basis === 'OWN' ? null : (
              <p className="mt-1.5 text-[10.5px] leading-relaxed text-ink-faint">
                {BASIS_META[basis].note}{' '}
                The comparisons below and the trend on the left stay on the own network — Park
                &amp; Pay publishes 30 days of history, so there is no combined previous month or same period last year
                to compare against.
              </p>
            )}
          </div>
          <p className="border-t border-hairline bg-slate-50/60 px-4 py-1.5 text-[9.5px] font-semibold uppercase tracking-[0.1em] text-ink-muted">
            Comparison periods · own network
          </p>
          <dl className="divide-y divide-hairline border-t border-hairline">
            {comparisons.map((row) => (
              <div key={row.label} className="flex items-center justify-between gap-3 px-4 py-2">
                <dt className="text-[11.5px] text-ink-soft">{row.label}</dt>
                <dd className="flex items-center gap-2">
                  <span className="tnum text-[12px] font-semibold text-ink">
                    <Value missing={row.value === null}>{formatPct(row.value)}</Value>
                  </span>
                  <DeltaChip
                    value={
                      network.utilizationPct === null || row.value === null ? null : network.utilizationPct - row.value
                    }
                  />
                </dd>
              </div>
            ))}
          </dl>
        </Card>
      </div>

      <div className="grid items-start gap-3 xl:grid-cols-2">
        <Card>
          <CardHeader
            title="Temperature Zone Utilization Trend"
            subtitle="Frozen, chilled, controlled ambient and ambient over the operational window"
            tip="Zone occupancy is derived from the facility series using today's zone mix, because the source extract does not publish a daily zone split. The mix is held constant across the window and this is stated rather than hidden."
          />
          <MultiSeriesLine
            rows={zoneRows}
            series={TEMPERATURE_ZONES.map((zone) => ({
              key: zone.id,
              label: zone.name,
              color: ZONE_COLORS[zone.id],
            }))}
            height={240}
          />
        </Card>

        <Card>
          <CardHeader
            title="Execution-wise Available Pallet Trend"
            subtitle="Carried across from the legacy report's empty-pallet-by-execution view"
            tip="Execution is Snowman's operating model for a site: run by Snowman, run by a partner, or dedicated to a single customer. The legacy report tracked empty pallets by execution; the same view is kept here, relabelled as available capacity."
          />
          <MultiSeriesLine
            rows={executionRows}
            series={Object.keys(EXECUTION_LABEL).map((key) => ({
              key,
              label: EXECUTION_LABEL[key as keyof typeof EXECUTION_LABEL],
              color: EXECUTION_COLORS[key] ?? CHART_COLORS.actual,
            }))}
            unit="pallets"
            height={240}
            yLabelWidth={56}
          />
        </Card>
      </div>

      <Card>
        <CardHeader
          title={
            <span className="inline-flex items-center gap-1.5">
              DPR Trend
              <InfoTip label="DPR" text={KPI_DEFINITIONS.dpr.definitionPending ?? ''} />
            </span>
          }
          subtitle="Reported exactly as the legacy report reports it"
          tip="DPR is carried across from the legacy daily report without reinterpretation. Its business definition has not been confirmed, so this application neither renames it nor invents a meaning for it."
        />
        <div className="border-b border-hairline bg-warn-soft/50 px-4 py-2 text-[11.5px] text-[#8a5b08]">
          <strong>Definition to be mapped from Snowman source system.</strong> DPR is reproduced here so nothing from the
          legacy report is lost, but no formula, target or threshold has been assigned to it in this prototype.
        </div>
        <MultiSeriesLine
          rows={dprRows}
          series={[{ key: 'dpr', label: 'DPR', color: CHART_COLORS.budget }]}
          unit="pallets"
          height={200}
          yLabelWidth={56}
        />
      </Card>
    </div>
  )
}
