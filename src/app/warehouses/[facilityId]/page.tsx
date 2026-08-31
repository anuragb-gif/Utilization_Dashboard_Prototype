'use client'

import * as React from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import type { ExceptionRecord } from '@/lib/domain/types'
import { PageHeader } from '@/components/layout/page-header'
import { UtilizationTrendChart } from '@/components/charts/utilization-trend'
import { CapacityWaterfall } from '@/components/charts/capacity-waterfall'
import { ZoneUtilizationChart, BucketChart } from '@/components/charts/mini-charts'
import { ExceptionList } from '@/components/control-tower/exception-list'
import { ExceptionDrawer } from '@/components/drawers/exception-drawer'
import { LocationUtilizationTable } from '@/components/panels/location-table'
import { Card, CardHeader, DeltaChip, SeverityChip, StatusChip, UtilizationBar, Value } from '@/components/ui/primitives'
import { DailyReportCard, PalletTrendChart, reportStatus, reportSummaryLine } from '@/components/panels/daily-report'
import { useFilters, scopedFilters } from '@/lib/state/filter-context'
import { useSnapshot } from '@/lib/state/use-snapshot'
import { dataSource } from '@/lib/repository'
import { EXECUTION_LABEL, FACILITY_TYPE_LABEL, OWNERSHIP_LABEL } from '@/lib/data/master'
import { DOCK_BY_FACILITY } from '@/lib/data/operations'
import { INVENTORY_CONCENTRATION, AGEING_BUCKETS } from '@/lib/data/inventory'
import { KPI_DEFINITIONS } from '@/lib/config/kpi-definitions'
import { THRESHOLDS } from '@/lib/config/thresholds'
import { CHART_COLORS } from '@/lib/config/brand'
import { formatIst, formatMinutes, formatNumber, formatPct, formatPp } from '@/lib/utils'

export default function FacilityDetailPage() {
  const params = useParams<{ facilityId: string }>()
  const facilityId = decodeURIComponent(params.facilityId)
  const { filters } = useFilters()

  const overrides = React.useMemo(() => ({ facilityIds: [facilityId], regionIds: [] }), [facilityId])
  const snapshot = useSnapshot(overrides)
  const [exception, setException] = React.useState<ExceptionRecord | null>(null)

  // The snapshot is scoped to this facility, so its daily report is the
  // location's - including the rented space in the same city.
  const report = snapshot.dailyReport
  const facility = snapshot.facilities.find((f) => f.facilityId === facilityId)
  const master = dataSource.listFacilities().find((f) => f.id === facilityId)
  const facilityFilters = React.useMemo(() => scopedFilters(filters, { facilityId }), [filters, facilityId])

  const ageing = React.useMemo(
    () =>
      AGEING_BUCKETS.map((bucket) => {
        const row = INVENTORY_CONCENTRATION.find((c) => c.facilityId === facilityId && c.bucketId === bucket.id)
        return { ...bucket, palletCount: row?.palletCount ?? 0, valueInrLakh: null }
      }),
    [facilityId],
  )

  if (!facility || !master) {
    return (
      <div className="space-y-4">
        <PageHeader
          title={facilityId}
          crumbs={[
            { label: 'Control Tower', href: '/' },
            { label: 'Warehouses', href: '/warehouses' },
            { label: facilityId },
          ]}
        />
        <Card>
          <p className="px-4 py-10 text-center text-[12px] text-ink-muted">
            No facility with code <strong>{facilityId}</strong> is available under the current filters or your access
            scope.{' '}
            <Link href="/warehouses" className="text-brand-600 hover:underline">
              Back to warehouses
            </Link>
          </p>
        </Card>
      </div>
    )
  }

  const over = (facility.utilizationPct ?? 0) > 100
  const dock = DOCK_BY_FACILITY[facilityId]

  return (
    <div className="space-y-4">
      <PageHeader
        title={`${facility.code} — ${facility.name}`}
        description={`${facility.cityName}, ${facility.regionId} · ${FACILITY_TYPE_LABEL[facility.type]} · ${OWNERSHIP_LABEL[facility.ownership]} · ${EXECUTION_LABEL[facility.execution]} · commissioned ${formatIst(master.commissionedOn, 'MMM yyyy')} · manager ${facility.owner}`}
        crumbs={[
          { label: 'Control Tower', href: '/' },
          { label: 'Regions', href: '/regions' },
          { label: facility.regionId, href: `/regions/${encodeURIComponent(facility.regionId)}` },
          { label: facility.code },
        ]}
        actions={
          <>
            <StatusChip status={facility.status} />
            <SeverityChip severity={facility.risk} />
          </>
        }
      />

      {facility.primaryReason ? (
        <div
          className={`rounded-lg border px-4 py-3 ${
            over ? 'border-bad-line bg-bad-soft' : 'border-warn-line bg-warn-soft'
          }`}
        >
          <p className={`text-[13px] font-bold uppercase tracking-wide ${over ? 'text-[#9b1c1c]' : 'text-[#8a5b08]'}`}>
            {facility.primaryReason}
          </p>
          <p className={`tnum mt-0.5 text-[12px] ${over ? 'text-[#9b1c1c]' : 'text-[#8a5b08]'}`}>
            {over
              ? `${formatPct(facility.utilizationPct)} of capacity · ${formatNumber(facility.overCapacityPallets)} pallets held above the capacity master.`
              : `Utilization ${formatPct(facility.utilizationPct)} against a ${facility.targetPct}% regional budget, ${formatPp(facility.change7dPct)} over 7 days.`}
          </p>
        </div>
      ) : null}

      <div className="grid gap-2.5 sm:grid-cols-3 lg:grid-cols-6">
        <Tile label="Utilization" tone={over ? 'bad' : undefined}>
          <span className="tnum text-[24px] font-bold">
            <Value missing={facility.utilizationPct === null} reason="No capacity master row for this facility.">
              {formatPct(facility.utilizationPct, 1)}
            </Value>
          </span>
          <UtilizationBar pct={facility.utilizationPct} targetPct={facility.targetPct} className="mt-1.5" />
        </Tile>
        <Tile label="Capacity">
          <span className="tnum text-[24px] font-bold">
            <Value missing={facility.capacity === null}>{formatNumber(facility.capacity)}</Value>
          </span>
        </Tile>
        <Tile label="Occupied">
          <span className="tnum text-[24px] font-bold">{formatNumber(facility.utilizedPallets)}</span>
        </Tile>
        <Tile label="Available">
          <span className="tnum text-[24px] font-bold">
            <Value missing={facility.availableCapacity === null}>{formatNumber(facility.availableCapacity)}</Value>
          </span>
        </Tile>
        <Tile label="7-day change">
          <DeltaChip value={facility.change7dPct} className="text-[18px]" />
        </Tile>
        <Tile label="30-day forecast" tone={(facility.forecast30dPct ?? 0) >= 100 ? 'bad' : undefined}>
          <span className="tnum text-[24px] font-bold">
            <Value missing={facility.forecast30dPct === null}>{formatPct(facility.forecast30dPct, 1)}</Value>
          </span>
          <p className="mt-0.5 text-[10px] text-violet-700">Prototype forecast</p>
        </Tile>
      </div>

      {/* The daily mail this location receives, as a sheet: F/C, Dry, the own
          subtotal, the rented space in its city, and the combined total. */}
      <Card>
        <CardHeader
          title="Daily Report"
          subtitle={reportSummaryLine(report, facility.code)}
          tip="Reproduces the figures the automated daily mail publishes for this location — the F/C and Dry split, the own subtotal, Park & Pay and the combined total — with the arithmetic between them visible. Park & Pay is the rented space in this warehouse's own city, which is how the location mail reports it."
          actions={<StatusChip status={reportStatus(report)} />}
        />
        <DailyReportCard
          bands={report}
          caption={`${facility.code} capacity, utilized pallets, empty pallets and utilization by temperature book, Park and Pay and combined`}
          targetPct={facility.targetPct}
        />
      </Card>

      {/* Both trends the mail publishes - percentage and pallets. */}
      <div className="grid items-start gap-3 xl:grid-cols-2">
        <Card>
          <CardHeader title="Utilization Trend" subtitle="Percentage against budget, last year and the prototype forecast" />
          <UtilizationTrendChart
            history={snapshot.series.history}
            forecast={snapshot.series.forecast}
            targetPct={facility.targetPct}
            height={250}
          />
        </Card>
        <Card>
          <CardHeader
            title="Occupancy Trend"
            subtitle="Pallets held against budget and the same period last year"
            tip="The same window in pallets rather than percent. The two can move in opposite directions when capacity changes, which is why the daily report publishes both."
          />
          <PalletTrendChart points={report.palletSeries} height={250} />
        </Card>
      </div>

      <div className="grid items-start gap-3 xl:grid-cols-3">
        <Card>
          <CardHeader title="Capacity Breakdown" />
          <CapacityWaterfall rollup={facility} height={170} />
        </Card>

        <Card>
          <CardHeader title="Temperature Zones" subtitle="Chamber groups within this facility" />
          <ZoneUtilizationChart zones={snapshot.zones} height={170} />
          <table className="w-full border-collapse border-t border-hairline">
            <caption className="sr-only">Temperature Zones</caption>
            <thead>
              <tr className="text-[10px] uppercase tracking-wider text-ink-faint">
                <th scope="col" className="px-3 py-1.5 text-left font-semibold">Zone</th>
                <th scope="col" className="px-3 py-1.5 text-left font-semibold">Set point</th>
                <th scope="col" className="px-3 py-1.5 text-right font-semibold">Utilization</th>
                <th scope="col" className="px-3 py-1.5 text-right font-semibold">Compliance</th>
              </tr>
            </thead>
            <tbody>
              {snapshot.zones.map((zone) => (
                <tr key={zone.zoneId} className="border-t border-hairline/70">
                  <td className="px-3 py-1.5 text-[11.5px] font-medium">{zone.zoneName}</td>
                  <td className="px-3 py-1.5 text-[10.5px] text-ink-muted">{zone.setPoint}</td>
                  <td className="tnum px-3 py-1.5 text-right text-[11.5px] font-semibold">
                    {formatPct(zone.utilizationPct, 1)}
                  </td>
                  <td className="tnum px-3 py-1.5 text-right text-[11.5px]">
                    <Value
                      missing={zone.temperatureCompliancePct === null}
                      reason="Ambient storage has no set-point band."
                    >
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
            title="Dock Performance"
            subtitle="Median times for this facility"
            tip="Dock-to-stock lengthens as a facility fills — there is less open location to travel to. Watching it alongside utilization is how a warehouse manager sees congestion before it shows up as an occupancy problem."
          />
          <dl className="divide-y divide-hairline">
            {(
              [
                ['dockToStockMinutes', dock?.dockToStockMinutes ?? null],
                ['stagingDwellMinutes', dock?.stagingDwellMinutes ?? null],
                ['dispatchDwellMinutes', dock?.dispatchDwellMinutes ?? null],
              ] as const
            ).map(([key, value]) => {
              const def = KPI_DEFINITIONS[key]
              const breached = value !== null && def.criticalThreshold !== null && value >= def.criticalThreshold
              return (
                <div key={key} className="flex items-center justify-between gap-3 px-4 py-2.5">
                  <div>
                    <dt className="text-[12px] font-medium text-ink">{def.name}</dt>
                    <dd className="tnum text-[10.5px] text-ink-muted">
                      target {def.target} min · critical {def.criticalThreshold} min
                    </dd>
                  </div>
                  <dd className={`tnum text-[16px] font-bold ${breached ? 'text-bad' : 'text-ink'}`}>
                    <Value missing={value === null} reason="This facility's event feed is not yet connected.">
                      {formatMinutes(value)}
                    </Value>
                  </dd>
                </div>
              )
            })}
          </dl>
        </Card>

        <Card>
          <CardHeader title="Inventory Ageing" subtitle="Days in storage at this facility" />
          <BucketChart buckets={ageing} height={200} colorFor={() => CHART_COLORS.actual} />
        </Card>
      </div>

      <ExceptionList
        exceptions={snapshot.exceptions.filter((e) => e.facilityId === facilityId)}
        onSelect={setException}
        title={`${facility.code} Exceptions`}
        subtitle="Everything raised against this facility today, with the recommended action"
      />

      <LocationUtilizationTable
        filters={facilityFilters}
        title={`${facility.code} Chambers & Locations`}
        subtitle="Every storage location in this facility"
        pageSize={12}
      />

      {facility.expectedBreachDate ? (
        <p className="rounded-md border border-warn-line bg-warn-soft px-4 py-2 text-[12px] text-[#8a5b08]">
          On the prototype forecast this facility crosses {THRESHOLDS.breachThresholdPct}% on{' '}
          <strong>{formatIst(facility.expectedBreachDate, 'dd MMM yyyy')}</strong>. Overflow capacity should be
          reserved before that date.
        </p>
      ) : null}

      <ExceptionDrawer exception={exception} onClose={() => setException(null)} reportDate={snapshot.network.reportDate} />
    </div>
  )
}

function Tile({ label, children, tone }: { label: string; children: React.ReactNode; tone?: 'bad' }) {
  return (
    <Card className={`p-3 ${tone === 'bad' ? 'border-bad-line bg-bad-soft/40' : ''}`}>
      <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-ink-muted">{label}</p>
      <div className={`mt-1 ${tone === 'bad' ? 'text-bad' : 'text-ink'}`}>{children}</div>
    </Card>
  )
}
