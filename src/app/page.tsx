'use client'

import * as React from 'react'
import type { ExceptionRecord, FacilityRollup } from '@/lib/domain/types'
import { PageHeader } from '@/components/layout/page-header'
import { KpiStrip } from '@/components/control-tower/kpi-strip'
import { HealthScoreCard } from '@/components/control-tower/health-score'
import { ManagementInsights } from '@/components/control-tower/insights'
import { RegionRanking } from '@/components/control-tower/region-ranking'
import { FacilityExceptionBoard } from '@/components/control-tower/facility-board'
import { CapacityRiskForecast } from '@/components/control-tower/capacity-risk'
import { ExceptionList } from '@/components/control-tower/exception-list'
import { ExceptionDrawer } from '@/components/drawers/exception-drawer'
import { FacilityDrawer } from '@/components/drawers/facility-drawer'
import { UtilizationTrendChart } from '@/components/charts/utilization-trend'
import { CapacityWaterfall } from '@/components/charts/capacity-waterfall'
import { IndiaRegionMap } from '@/components/charts/india-map'
import { Card, CardHeader, DemoDataBadge, DrilldownLink, SectionTitle } from '@/components/ui/primitives'
import { useSnapshot } from '@/lib/state/use-snapshot'
import { formatNumber, formatPct } from '@/lib/utils'
import { UTILIZATION_BANDS } from '@/lib/config/thresholds'

export default function ControlTowerPage() {
  const snapshot = useSnapshot()
  const [exception, setException] = React.useState<ExceptionRecord | null>(null)
  const [facility, setFacility] = React.useState<FacilityRollup | null>(null)

  return (
    <div className="space-y-4">
      <PageHeader
        title="Executive Control Tower"
        description={`Network position for ${snapshot.network.reportDate}. Exceptions first: everything on this page is clickable and drills through region, facility, temperature zone and location.`}
        actions={<DemoDataBadge text="Prototype · demonstration data" />}
      />

      <KpiStrip snapshot={snapshot} />

      <div className="grid items-start gap-3 xl:grid-cols-[1fr_360px]">
        <Card>
          <CardHeader
            title="Network Utilization Trend"
            subtitle="Actual against budget and the same period last year, with the prototype forecast"
            tip="Only three points are labelled — the latest reading, the period maximum and the period minimum. Labelling every point makes the shape unreadable in a management review. Hover any point for the full breakdown including occupied pallets and capacity."
          />
          <UtilizationTrendChart
            history={snapshot.series.history}
            forecast={snapshot.series.forecast}
            targetPct={snapshot.network.targetPct}
            height={280}
          />
        </Card>

        <HealthScoreCard health={snapshot.health} />
      </div>

      <div className="grid items-start gap-3 xl:grid-cols-[420px_1fr]">
        <Card className="flex flex-col">
          <CardHeader
            title="Capacity Breakdown"
            subtitle="Where the network's pallet positions are going today"
            tip="Reads left to right: the capacity master, what is occupied against it, the headroom that is genuinely sellable, and the pallets currently held above capacity."
          />
          <CapacityWaterfall rollup={snapshot.network} height={190} />
        </Card>

        <Card className="flex flex-col">
          <CardHeader
            title="Region Heatmap"
            subtitle="Utilization by region · click a region to drill in"
            tip="Bubbles are sized by capacity and coloured by utilization band. Values above 100% are shown as they are, never clipped — the number and the over-capacity pallet count both appear."
            actions={
              <div className="flex flex-wrap items-center gap-2 text-[10px] text-ink-muted">
                {UTILIZATION_BANDS.map((band) => (
                  <span key={band.id} className="inline-flex items-center gap-1">
                    <span
                      className="inline-block h-2 w-2 rounded-full"
                      style={{
                        background:
                          band.id === 'healthy'
                            ? '#0F8A5F'
                            : band.id === 'watch'
                              ? '#B7791F'
                              : band.id === 'high'
                                ? '#D97706'
                                : '#C62828',
                      }}
                      aria-hidden
                    />
                    {band.to === null ? `${band.from}%+` : `${band.from}–${band.to}%`}
                  </span>
                ))}
              </div>
            }
          />
          <IndiaRegionMap regions={snapshot.regions} facilities={snapshot.facilities} height={330} />
        </Card>
      </div>

      <section aria-labelledby="exceptions-heading" className="space-y-3">
        <div className="flex items-center justify-between">
          <SectionTitle>
            <span id="exceptions-heading">Exception management</span>
          </SectionTitle>
          <DrilldownLink href="/exceptions">Open exception centre</DrilldownLink>
        </div>

        <FacilityExceptionBoard
          facilities={snapshot.facilities}
          reportDate={snapshot.network.reportDate}
          onSelect={setFacility}
        />

        <div className="grid items-start gap-3 xl:grid-cols-2">
          <ExceptionList
            exceptions={snapshot.exceptions}
            onSelect={setException}
            limit={7}
            title="Today’s Exceptions"
            showAllHref="/exceptions"
          />
          <CapacityRiskForecast facilities={snapshot.facilities} limit={7} />
        </div>
      </section>

      <div className="grid items-start gap-3 xl:grid-cols-[1fr_400px]">
        <RegionRanking regions={snapshot.regions} reportDate={snapshot.network.reportDate} />
        <ManagementInsights insights={snapshot.insights} limit={8} />
      </div>

      <Card>
        <CardHeader
          title="Reconciliation"
          subtitle="How the headline numbers add up"
          tip="Published to make the arithmetic auditable. Every figure on this page is derived from facility rows, and the two definitions of spare capacity are shown side by side rather than reconciled silently."
        />
        <dl className="grid gap-x-6 gap-y-2 px-4 py-3 text-[11.5px] sm:grid-cols-2 lg:grid-cols-4">
          <Reconcile
            label="Capacity master"
            value={`${formatNumber(snapshot.network.capacity)} pallet positions`}
            note={`${snapshot.network.facilityCount - snapshot.network.facilitiesMissingCapacity} facilities in scope`}
          />
          <Reconcile
            label="Occupied"
            value={`${formatNumber(snapshot.network.utilizedPallets)} pallets`}
            note={`Utilization ${formatPct(snapshot.network.utilizationPct)}`}
          />
          <Reconcile
            label="Empty (legacy) vs available"
            value={`${formatNumber(snapshot.network.netEmptyPallets)} vs ${formatNumber(snapshot.network.availableCapacity)}`}
            note={`Differ by ${formatNumber(snapshot.network.overCapacityPallets)} over-capacity pallets`}
          />
          <Reconcile
            label="Excluded from utilization"
            value={`${formatNumber(snapshot.network.excludedUtilizedPallets)} pallets`}
            note={`${snapshot.network.facilitiesMissingCapacity} facilities with no capacity master row`}
          />
        </dl>
      </Card>

      <ExceptionDrawer exception={exception} onClose={() => setException(null)} reportDate={snapshot.network.reportDate} />
      <FacilityDrawer facility={facility} onClose={() => setFacility(null)} />
    </div>
  )
}

function Reconcile({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <div>
      <dt className="text-[10px] font-semibold uppercase tracking-wider text-ink-faint">{label}</dt>
      <dd className="tnum mt-0.5 font-semibold text-ink">{value}</dd>
      <dd className="text-[10.5px] leading-snug text-ink-muted">{note}</dd>
    </div>
  )
}
