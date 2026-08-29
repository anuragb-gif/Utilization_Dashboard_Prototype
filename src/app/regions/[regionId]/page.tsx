'use client'

import * as React from 'react'
import Link from 'next/link'
import { notFound, useParams } from 'next/navigation'
import type { ExceptionRecord, FacilityRollup, RegionId } from '@/lib/domain/types'
import { PageHeader } from '@/components/layout/page-header'
import { CapacityWaterfall } from '@/components/charts/capacity-waterfall'
import { UtilizationTrendChart } from '@/components/charts/utilization-trend'
import { ZoneUtilizationChart, BucketChart } from '@/components/charts/mini-charts'
import { FacilityExceptionBoard } from '@/components/control-tower/facility-board'
import { CapacityRiskForecast } from '@/components/control-tower/capacity-risk'
import { ExceptionList } from '@/components/control-tower/exception-list'
import { ExceptionDrawer } from '@/components/drawers/exception-drawer'
import { FacilityDrawer } from '@/components/drawers/facility-drawer'
import { LocationUtilizationTable } from '@/components/panels/location-table'
import { Card, CardHeader, DeltaChip, StatusChip, UtilizationBar, Value } from '@/components/ui/primitives'
import { useFilters } from '@/lib/state/filter-context'
import { scopedFilters } from '@/lib/state/filter-context'
import { useSnapshot } from '@/lib/state/use-snapshot'
import { REGION_BY_ID, REGION_ORDER } from '@/lib/data/master'
import { ageingByRegion, AGEING_BUCKETS } from '@/lib/data/inventory'
import { CHART_COLORS } from '@/lib/config/brand'
import { formatNumber, formatPct, formatPp } from '@/lib/utils'

export default function RegionDetailPage() {
  const params = useParams<{ regionId: string }>()
  const regionId = decodeURIComponent(params.regionId) as RegionId
  const { filters } = useFilters()

  const overrides = React.useMemo(() => ({ regionIds: [regionId] }), [regionId])
  const snapshot = useSnapshot(overrides)

  const [exception, setException] = React.useState<ExceptionRecord | null>(null)
  const [facility, setFacility] = React.useState<FacilityRollup | null>(null)

  if (!REGION_ORDER.includes(regionId)) notFound()

  const region = snapshot.regions.find((r) => r.regionId === regionId)
  const meta = REGION_BY_ID[regionId]
  const over = (region?.utilizationPct ?? 0) > 100

  const ageing = React.useMemo(() => {
    return AGEING_BUCKETS.map((bucket) => ({
      ...bucket,
      palletCount: ageingByRegion(bucket.id)[regionId] ?? 0,
      valueInrLakh: null,
    }))
  }, [regionId])

  const regionFilters = React.useMemo(() => scopedFilters(filters, { regionId }), [filters, regionId])

  if (!region) {
    return (
      <div className="space-y-4">
        <PageHeader
          title={regionId}
          crumbs={[{ label: 'Control Tower', href: '/' }, { label: 'Regions', href: '/regions' }, { label: regionId }]}
        />
        <Card>
          <p className="px-4 py-10 text-center text-[12px] text-ink-muted">
            No facilities in {regionId} match the current filters, or your role does not have access to this region.
          </p>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title={`${regionId} — ${meta.name} Region`}
        description={`Regional head ${meta.head} · ${region.facilityCount} facilities · budget ${region.targetPct}%`}
        crumbs={[
          { label: 'Control Tower', href: '/' },
          { label: 'Regions', href: '/regions' },
          { label: regionId },
        ]}
      />

      {over ? (
        <div className="flex flex-wrap items-center gap-3 rounded-lg border border-bad-line bg-bad-soft px-4 py-3">
          <span className="text-[15px] font-bold uppercase tracking-wide text-[#9b1c1c]">{regionId} over capacity</span>
          <span className="tnum text-[13px] font-semibold text-[#9b1c1c]">
            {formatPct(region.utilizationPct)} · {formatNumber(region.overCapacityPallets)} pallets above the capacity
            master across {region.overCapacityFacilities}{' '}
            {region.overCapacityFacilities === 1 ? 'facility' : 'facilities'}
          </span>
          <Link
            href="/exceptions"
            className="ml-auto inline-flex h-7 items-center rounded-md border border-[#9b1c1c] bg-surface px-2.5 text-[12px] font-semibold text-[#9b1c1c] transition-colors hover:bg-bad-soft no-print"
          >
            Open exceptions
          </Link>
        </div>
      ) : null}

      <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-5">
        <MetricTile label="Utilization" tone={over ? 'bad' : undefined}>
          <span className="tnum text-[26px] font-bold">
            <Value missing={region.utilizationPct === null}>{formatPct(region.utilizationPct, 1)}</Value>
          </span>
          <UtilizationBar pct={region.utilizationPct} targetPct={region.targetPct} className="mt-1.5" />
          <p className="mt-1 flex items-center gap-2 text-[11px] text-ink-muted">
            <StatusChip status={region.status} size="xs" />
            <span className="tnum">
              budget {region.targetPct}% · {formatPp(region.variancePct)}
            </span>
          </p>
        </MetricTile>
        <MetricTile label="Total capacity">
          <span className="tnum text-[26px] font-bold">{formatNumber(region.capacity)}</span>
          <p className="mt-1 text-[11px] text-ink-muted">pallet positions</p>
        </MetricTile>
        <MetricTile label="Occupied">
          <span className="tnum text-[26px] font-bold">{formatNumber(region.utilizedPallets)}</span>
          <p className="mt-1 text-[11px] text-ink-muted">pallets on the report date</p>
        </MetricTile>
        <MetricTile label="Available" >
          <span className="tnum text-[26px] font-bold">{formatNumber(region.availableCapacity)}</span>
          <p className="mt-1 text-[11px] text-ink-muted">
            legacy empty figure {formatNumber(region.netEmptyPallets)}
          </p>
        </MetricTile>
        <MetricTile label="Over capacity" tone={region.overCapacityPallets > 0 ? 'bad' : undefined}>
          <span className="tnum text-[26px] font-bold">{formatNumber(region.overCapacityPallets)}</span>
          <p className="mt-1 flex items-center gap-2 text-[11px] text-ink-muted">
            <span>7-day</span>
            <DeltaChip value={region.change7dPct} />
          </p>
        </MetricTile>
      </div>

      <div className="grid items-start gap-3 xl:grid-cols-[1fr_420px]">
        <Card>
          <CardHeader title={`${regionId} Utilization Trend`} subtitle="Actual, budget, last year and prototype forecast" />
          <UtilizationTrendChart
            history={snapshot.series.history}
            forecast={snapshot.series.forecast}
            targetPct={region.targetPct}
            height={260}
          />
        </Card>
        <Card>
          <CardHeader title="Capacity Breakdown" subtitle={`${regionId} capacity, occupied, available and over capacity`} />
          <CapacityWaterfall rollup={region} height={180} />
        </Card>
      </div>

      <FacilityExceptionBoard
        facilities={snapshot.facilities}
        reportDate={snapshot.network.reportDate}
        onSelect={setFacility}
        title={`${regionId} Warehouse Ranking`}
        defaultScope="all"
      />

      <div className="grid items-start gap-3 xl:grid-cols-3">
        <Card>
          <CardHeader title="Temperature Zones" subtitle={`Zone utilization within ${regionId}`} />
          <ZoneUtilizationChart zones={snapshot.zones} height={190} />
          <table className="w-full border-collapse border-t border-hairline">
            <caption className="sr-only">Temperature Zones</caption>
            <thead>
              <tr className="text-[10px] uppercase tracking-wider text-ink-faint">
                <th scope="col" className="px-3 py-1.5 text-left font-semibold">Zone</th>
                <th scope="col" className="px-3 py-1.5 text-right font-semibold">Occupied</th>
                <th scope="col" className="px-3 py-1.5 text-right font-semibold">Available</th>
                <th scope="col" className="px-3 py-1.5 text-right font-semibold">Compliance</th>
              </tr>
            </thead>
            <tbody>
              {snapshot.zones.map((zone) => (
                <tr key={zone.zoneId} className="border-t border-hairline/70">
                  <td className="px-3 py-1.5 text-[11.5px] font-medium">{zone.zoneName}</td>
                  <td className="tnum px-3 py-1.5 text-right text-[11.5px]">{formatNumber(zone.utilizedPallets)}</td>
                  <td className="tnum px-3 py-1.5 text-right text-[11.5px]">{formatNumber(zone.availableCapacity)}</td>
                  <td className="tnum px-3 py-1.5 text-right text-[11.5px]">
                    <Value missing={zone.temperatureCompliancePct === null} reason="Ambient storage has no set-point band.">
                      {formatPct(zone.temperatureCompliancePct, 2)}
                    </Value>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>

        <Card>
          <CardHeader
            title="Inventory Ageing"
            subtitle={`Days in storage across ${regionId}`}
            tip="Ageing is allocated to facilities from the network buckets in proportion to occupancy, so regional ageing always sums back to the network figure."
          />
          <BucketChart buckets={ageing} height={200} colorFor={() => CHART_COLORS.actual} />
        </Card>

        <ExceptionList
          exceptions={snapshot.exceptions}
          onSelect={setException}
          title={`${regionId} Exceptions`}
          limit={8}
          showAllHref="/exceptions"
        />
      </div>

      <CapacityRiskForecast facilities={snapshot.facilities} limit={10} showAllHref="/capacity" />

      <LocationUtilizationTable
        filters={regionFilters}
        title={`${regionId} Location Utilization`}
        subtitle="Chamber-level detail for every facility in the region"
      />

      <ExceptionDrawer exception={exception} onClose={() => setException(null)} reportDate={snapshot.network.reportDate} />
      <FacilityDrawer facility={facility} onClose={() => setFacility(null)} />
    </div>
  )
}

function MetricTile({
  label,
  children,
  tone,
}: {
  label: string
  children: React.ReactNode
  tone?: 'bad'
}) {
  return (
    <Card className={`p-3 ${tone === 'bad' ? 'border-bad-line bg-bad-soft/40' : ''}`}>
      <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-ink-muted">{label}</p>
      <div className={`mt-1 ${tone === 'bad' ? 'text-bad' : 'text-ink'}`}>{children}</div>
    </Card>
  )
}
