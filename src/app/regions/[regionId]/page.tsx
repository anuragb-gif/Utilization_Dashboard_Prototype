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
import { Download } from 'lucide-react'
import {
  DailyReportCard,
  DailyReportLocationTable,
  PalletTrendChart,
  reportStatus,
  reportSummaryLine,
} from '@/components/panels/daily-report'
import { exportCsv, exportXlsx, type ExportColumn } from '@/lib/export/exporters'
import type { DailyReportLocationRow } from '@/lib/repository'
import { useFilters } from '@/lib/state/filter-context'
import { scopedFilters } from '@/lib/state/filter-context'
import { useSnapshot } from '@/lib/state/use-snapshot'
import { REGION_BY_ID, REGION_ORDER } from '@/lib/data/master'
import { ageingByRegion, AGEING_BUCKETS } from '@/lib/data/inventory'
import { CHART_COLORS } from '@/lib/config/brand'
import { formatNumber, formatPct, formatPp } from '@/lib/utils'

const LOCATION_EXPORT_COLUMNS: ExportColumn<DailyReportLocationRow>[] = [
  { key: 'region', header: 'Region', value: (r) => r.regionId },
  { key: 'code', header: 'Location', value: (r) => r.code },
  { key: 'name', header: 'Name', value: (r) => r.name },
  { key: 'city', header: 'City', value: (r) => r.cityName },
  { key: 'fcCap', header: 'F/C capacity', value: (r) => r.fc.capacity },
  { key: 'fcUsed', header: 'F/C utilized pallets', value: (r) => r.fc.utilizedPallets },
  { key: 'fcPct', header: 'F/C utilization %', value: (r) => r.fc.utilizationPct },
  { key: 'fcEmpty', header: 'F/C empty pallets', value: (r) => r.fc.netEmptyPallets },
  { key: 'dryCap', header: 'Dry capacity', value: (r) => r.dry.capacity },
  { key: 'dryUsed', header: 'Dry utilized pallets', value: (r) => r.dry.utilizedPallets },
  { key: 'dryPct', header: 'Dry utilization %', value: (r) => r.dry.utilizationPct },
  { key: 'dryEmpty', header: 'Dry empty pallets', value: (r) => r.dry.netEmptyPallets },
  { key: 'ownCap', header: 'Total capacity', value: (r) => r.own.capacity },
  { key: 'ownUsed', header: 'Total utilized pallets', value: (r) => r.own.utilizedPallets },
  { key: 'ownPct', header: 'Total utilization %', value: (r) => r.own.utilizationPct },
  { key: 'ownEmpty', header: 'Total empty pallets', value: (r) => r.own.netEmptyPallets },
  { key: 'pnpSites', header: 'Park & Pay locations', value: (r) => r.parkAndPaySiteCount },
  { key: 'pnpCap', header: 'Park & Pay capacity', value: (r) => r.parkAndPay.capacity },
  { key: 'pnpUsed', header: 'Park & Pay utilized pallets', value: (r) => r.parkAndPay.utilizedPallets },
  { key: 'pnpPct', header: 'Park & Pay utilization %', value: (r) => r.parkAndPay.utilizationPct },
  { key: 'combCap', header: 'Combined capacity', value: (r) => r.combined.capacity },
  { key: 'combUsed', header: 'Combined utilized pallets', value: (r) => r.combined.utilizedPallets },
  { key: 'combPct', header: 'Combined utilization %', value: (r) => r.combined.utilizationPct },
  { key: 'chg', header: '7-day change (pp)', value: (r) => r.change7dPct },
]

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

  // The snapshot is already scoped to this region, so its daily report is the
  // region's.
  const report = snapshot.dailyReport
  const reportMeta = {
    title: `${regionId} Daily Report`,
    reportDate: snapshot.network.reportDate,
    generatedAt: snapshot.lastRefreshAt,
    filters: `region: ${regionId}`,
  }

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

      {/* The daily report each location and region receives, as a sheet rather
          than twelve boxed tiles: F/C, Dry, the own subtotal, Park & Pay and
          the combined total, with the arithmetic between them visible. */}
      <Card>
        <CardHeader
          title="Daily Report"
          subtitle={reportSummaryLine(report, regionId)}
          tip="Reproduces the figures the automated daily mail publishes — the F/C and Dry split, the own subtotal, Park & Pay and the combined total — as one table so the subtotals read as subtotals. Frozen and chilled are combined into F/C and controlled ambient and ambient into Dry, the same grouping the legacy report uses. The combined total is computed here rather than restated."
          actions={
            <>
              <StatusChip status={reportStatus(report)} />
              <button
                type="button"
                onClick={() => exportCsv(report.locations, LOCATION_EXPORT_COLUMNS, reportMeta)}
                className="inline-flex h-7 items-center gap-1.5 rounded-md border border-hairline bg-surface px-2.5 text-[12px] font-medium text-ink-soft transition-colors hover:bg-slate-50 no-print"
              >
                <Download className="h-3 w-3" strokeWidth={2.5} aria-hidden />
                CSV
              </button>
              <button
                type="button"
                onClick={() => exportXlsx(report.locations, LOCATION_EXPORT_COLUMNS, reportMeta)}
                className="inline-flex h-7 items-center gap-1.5 rounded-md border border-hairline bg-surface px-2.5 text-[12px] font-medium text-ink-soft transition-colors hover:bg-slate-50 no-print"
              >
                <Download className="h-3 w-3" strokeWidth={2.5} aria-hidden />
                XLSX
              </button>
            </>
          }
        />
        <DailyReportCard
          bands={report}
          caption={`${regionId} capacity, utilized pallets, empty pallets and utilization by temperature book, Park and Pay and combined`}
          targetPct={region.targetPct}
        />
      </Card>

      {/* The same card, one row per warehouse - the six mails a regional head
          would otherwise be holding side by side. */}
      <Card>
        <CardHeader
          title="Location-wise Position"
          subtitle={`${report.locations.length} ${report.locations.length === 1 ? 'warehouse' : 'warehouses'} in ${regionId}, on the same bands`}
          tip="Park & Pay is joined to a warehouse by city, which is how the location mail reports it — the rented space at Chennai belongs to the Chennai card. A warehouse with no rented space in its city shows a dash rather than a zero."
        />
        <DailyReportLocationTable
          rows={report.locations}
          caption={`Frozen and chilled, dry, own total, Park and Pay and combined utilization for each warehouse in ${regionId}`}
        />
      </Card>

      {/* Both trends the mail publishes. They answer different questions and
          can disagree: a site can hold more stock than last year and still
          read lower, because capacity moved underneath it. */}
      <div className="grid items-start gap-3 xl:grid-cols-2">
        <Card>
          <CardHeader
            title="Utilization Trend"
            subtitle="Percentage against budget, last year and the prototype forecast"
          />
          <UtilizationTrendChart
            history={snapshot.series.history}
            forecast={snapshot.series.forecast}
            targetPct={region.targetPct}
            height={250}
          />
        </Card>
        <Card>
          <CardHeader
            title="Occupancy Trend"
            subtitle="Pallets held against budget and the same period last year"
            tip="The same window in pallets rather than percent. The two charts can move in opposite directions when capacity changes, which is why the daily report publishes both."
          />
          <PalletTrendChart points={report.palletSeries} height={250} />
        </Card>
      </div>

      <div className="grid items-start gap-3 xl:grid-cols-[420px_1fr]">
        <Card>
          <CardHeader title="Capacity Breakdown" subtitle={`${regionId} capacity, occupied, available and over capacity`} />
          <CapacityWaterfall rollup={region} height={180} />
        </Card>
        <Card>
          <CardHeader
            title="How this report is read"
            subtitle="Definitions behind the bands"
          />
          <dl className="grid gap-x-6 gap-y-2.5 px-4 py-3 text-[11.5px] sm:grid-cols-2">
            <Definition
              term="F/C"
              detail="Frozen and chilled chambers together, as the daily mail groups them. The capacity master carries four zones; controlled ambient and ambient make up Dry."
            />
            <Definition
              term="Empty pallets"
              detail="Capacity less occupied, allowed to go negative. A negative figure means more stock is held than there are positions — it is shown, not floored at zero."
            />
            <Definition
              term="Park & Pay"
              detail="Space rented from third parties and sold on, joined to a location by city. A separate commercial book, so it is shown beside the own network rather than folded into it."
            />
            <Definition
              term="Total (own + P&P)"
              detail="Both books summed and divided once — never the average of two percentages, which misstates the scope whenever the books differ in size."
            />
          </dl>
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

function Definition({ term, detail }: { term: string; detail: string }) {
  return (
    <div>
      <dt className="font-semibold text-ink">{term}</dt>
      <dd className="mt-0.5 leading-relaxed text-ink-muted">{detail}</dd>
    </div>
  )
}
