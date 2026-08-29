'use client'

import * as React from 'react'
import Link from 'next/link'
import { Snowflake, Thermometer } from 'lucide-react'
import { PageHeader } from '@/components/layout/page-header'
import { MultiSeriesLine } from '@/components/charts/multi-series'
import {
  Card,
  CardHeader,
  DeltaChip,
  DemoDataBadge,
  SeverityChip,
  StatusChip,
  UtilizationBar,
  Value,
} from '@/components/ui/primitives'
import { useSnapshot } from '@/lib/state/use-snapshot'
import { FEFO_BREACHES } from '@/lib/data/coldchain'
import { TEMPERATURE_ZONES, ZONE_BY_ID } from '@/lib/data/master'
import { ZONE_COLORS } from '@/lib/config/brand'
import { KPI_DEFINITIONS } from '@/lib/config/kpi-definitions'
import { THRESHOLDS } from '@/lib/config/thresholds'
import { formatIst, formatMinutes, formatNumber, formatPct } from '@/lib/utils'
import type { StatusLevel } from '@/lib/domain/types'

function complianceStatus(value: number | null, warn: number, critical: number): StatusLevel {
  if (value === null) return 'unknown'
  if (value < critical) return 'critical'
  if (value < warn) return 'watch'
  return 'healthy'
}

export default function ColdChainPage() {
  const snapshot = useSnapshot()
  const cold = snapshot.coldChain

  const zoneRows = React.useMemo(() => {
    const dates = snapshot.zoneSeries.FROZEN?.map((r) => r.date) ?? []
    return dates.map((date, index) => {
      const row: Record<string, string | number | null> = { date }
      for (const zone of TEMPERATURE_ZONES) {
        row[zone.id] = snapshot.zoneSeries[zone.id]?.[index]?.utilizationPct ?? null
      }
      return row
    })
  }, [snapshot.zoneSeries])

  const healthMetrics: {
    label: string
    value: React.ReactNode
    note: string
    status: StatusLevel
  }[] = [
    {
      label: 'Temperature compliance',
      value: formatPct(cold.temperatureCompliancePct),
      note: `target ${KPI_DEFINITIONS.temperatureCompliance.target}% · floor ${THRESHOLDS.temperatureCompliancePct}%`,
      status: complianceStatus(cold.temperatureCompliancePct, THRESHOLDS.temperatureCompliancePct, 98),
    },
    {
      label: 'Temperature excursions (24h)',
      value: cold.excursions24h,
      note: `${cold.criticalExcursions24h} critical`,
      status: cold.criticalExcursions24h > 0 ? 'critical' : cold.excursions24h > 0 ? 'watch' : 'healthy',
    },
    {
      label: 'Average excursion duration',
      value: formatMinutes(cold.avgExcursionDurationMinutes),
      note: 'across all excursions in the last 24 hours',
      status: cold.avgExcursionDurationMinutes > 60 ? 'watch' : 'healthy',
    },
    {
      label: 'Open temperature alerts',
      value: cold.openTemperatureAlerts,
      note: 'not yet closed by the site engineer',
      status: cold.openTemperatureAlerts > 0 ? 'high' : 'healthy',
    },
    {
      label: 'Quarantine pallets',
      value: formatNumber(cold.quarantinePallets),
      note: 'held pending product-integrity assessment',
      status: cold.quarantinePallets > 250 ? 'watch' : 'healthy',
    },
    {
      label: 'FEFO compliance',
      value: formatPct(cold.fefoCompliancePct),
      note: `floor ${THRESHOLDS.fefoCompliancePct}% · ${FEFO_BREACHES.length} breaches logged`,
      status: complianceStatus(cold.fefoCompliancePct, THRESHOLDS.fefoCompliancePct, 96),
    },
    {
      label: 'Near-expiry inventory',
      value: formatNumber(cold.nearExpiryPallets),
      note: `inside the ${THRESHOLDS.nearExpiryDays}-day window`,
      status: cold.nearExpiryPallets > 1500 ? 'watch' : 'healthy',
    },
    {
      label: 'Short-coded inventory',
      value: formatNumber(cold.shortCodedPallets),
      note: 'requires depositor disposition',
      status: cold.shortCodedPallets > 300 ? 'watch' : 'healthy',
    },
  ]

  return (
    <div className="space-y-4">
      <PageHeader
        title="Cold Chain Health"
        description="Temperature zones, chamber compliance, live excursions and FEFO discipline — the things that make a cold store different from a warehouse."
        crumbs={[{ label: 'Control Tower', href: '/' }, { label: 'Cold Chain' }]}
        actions={<DemoDataBadge text="Demo data — no live telemetry connected" />}
      />

      <div className="rounded-lg border border-hairline bg-brand-50 px-4 py-2.5 text-[11.5px] leading-relaxed text-brand-800">
        <strong>Prototype data.</strong> Chamber telemetry, excursions and FEFO breaches on this screen are
        hand-authored demonstration records. They exist to show the exception path end to end. No IoT feed, sensor
        gateway or WMS pick-confirmation stream is connected to this build, and nothing here should be read as a real
        product-integrity event.
      </div>

      <div className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-4">
        {snapshot.zones.map((zone) => {
          const over = (zone.utilizationPct ?? 0) > 100
          return (
            <Card key={zone.zoneId} className="p-3.5">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span
                    className="flex h-7 w-7 items-center justify-center rounded"
                    style={{ background: `${ZONE_COLORS[zone.zoneId]}1a`, color: ZONE_COLORS[zone.zoneId] }}
                    aria-hidden
                  >
                    {zone.zoneId === 'FROZEN' ? (
                      <Snowflake className="h-4 w-4" strokeWidth={2.25} />
                    ) : (
                      <Thermometer className="h-4 w-4" strokeWidth={2.25} />
                    )}
                  </span>
                  <div>
                    <p className="text-[13px] font-bold text-ink">{zone.zoneName}</p>
                    <p className="text-[10px] text-ink-muted">{ZONE_BY_ID[zone.zoneId].setPoint}</p>
                  </div>
                </div>
                <StatusChip status={zone.status} size="xs" label={over ? 'Over' : undefined} />
              </div>

              <p className={`tnum mt-3 text-[26px] font-bold leading-none ${over ? 'text-bad' : 'text-ink'}`}>
                <Value missing={zone.utilizationPct === null}>{formatPct(zone.utilizationPct, 1)}</Value>
              </p>
              <UtilizationBar pct={zone.utilizationPct} className="mt-1.5" />

              <dl className="tnum mt-3 grid grid-cols-2 gap-y-1.5 text-[11px]">
                <div>
                  <dt className="text-[9.5px] uppercase tracking-wider text-ink-faint">Capacity</dt>
                  <dd className="font-semibold text-ink">{formatNumber(zone.capacity)}</dd>
                </div>
                <div>
                  <dt className="text-[9.5px] uppercase tracking-wider text-ink-faint">Occupied</dt>
                  <dd className="font-semibold text-ink">{formatNumber(zone.utilizedPallets)}</dd>
                </div>
                <div>
                  <dt className="text-[9.5px] uppercase tracking-wider text-ink-faint">Available</dt>
                  <dd className="font-semibold text-ink">{formatNumber(zone.availableCapacity)}</dd>
                </div>
                <div>
                  <dt className="text-[9.5px] uppercase tracking-wider text-ink-faint">7-day</dt>
                  <dd>
                    <DeltaChip value={zone.change7dPct} />
                  </dd>
                </div>
              </dl>

              <div className="mt-3 flex items-center justify-between border-t border-hairline pt-2">
                <span className="text-[10.5px] text-ink-muted">Temperature compliance</span>
                <span className="tnum text-[12px] font-bold text-ink">
                  <Value missing={zone.temperatureCompliancePct === null} reason="Ambient storage has no set-point band.">
                    {formatPct(zone.temperatureCompliancePct)}
                  </Value>
                </span>
              </div>
            </Card>
          )
        })}
      </div>

      <div className="grid items-start gap-3 xl:grid-cols-[1fr_460px]">
        <Card>
          <CardHeader title="Zone Utilization Trend" subtitle="Occupancy by temperature zone across the operational window" />
          <MultiSeriesLine
            rows={zoneRows}
            series={TEMPERATURE_ZONES.map((zone) => ({ key: zone.id, label: zone.name, color: ZONE_COLORS[zone.id] }))}
            height={430}
          />
        </Card>

        <Card>
          <CardHeader
            title="Cold-Chain Health"
            subtitle="Compliance, excursions and expiry discipline"
            tip="Compliance is weighted by the pallets each chamber holds, so a full chamber running out of band moves the network figure more than an empty one."
          />
          <dl className="grid grid-cols-2 divide-x divide-y divide-hairline border-t border-hairline">
            {healthMetrics.map((metric) => (
              <div key={metric.label} className="px-3.5 py-2.5">
                <dt className="text-[10px] font-semibold uppercase tracking-wider text-ink-faint">{metric.label}</dt>
                <dd className="tnum mt-0.5 text-[19px] font-bold text-ink">{metric.value}</dd>
                <dd className="mt-1 flex items-center gap-1.5">
                  <StatusChip status={metric.status} size="xs" />
                </dd>
                <dd className="mt-0.5 text-[10px] leading-snug text-ink-muted">{metric.note}</dd>
              </div>
            ))}
          </dl>
        </Card>
      </div>

      <Card>
        <CardHeader
          title="Temperature Excursions"
          subtitle="Set-point deviations recorded in the last 24 hours"
          tip="An excursion is any period where a chamber's readings fall outside its contracted set-point band. Affected pallets are quarantined until a product-integrity assessment clears them."
        />
        <div className="w-full min-w-0 overflow-x-auto">
          <table className="w-full border-collapse">
            <caption className="sr-only">Temperature excursions in the last 24 hours</caption>
            <thead>
              <tr className="border-b border-hairline bg-slate-50/70 text-[10px] uppercase tracking-wider text-ink-muted">
                <th scope="col" className="px-3 py-2 text-left font-semibold">Reference</th>
                <th scope="col" className="px-3 py-2 text-left font-semibold">Facility</th>
                <th scope="col" className="px-3 py-2 text-left font-semibold">Zone / chamber</th>
                <th scope="col" className="px-3 py-2 text-left font-semibold">Started</th>
                <th scope="col" className="px-3 py-2 text-right font-semibold">Duration</th>
                <th scope="col" className="px-3 py-2 text-right font-semibold">Peak deviation</th>
                <th scope="col" className="px-3 py-2 text-right font-semibold">Pallets</th>
                <th scope="col" className="px-3 py-2 text-center font-semibold">Severity</th>
                <th scope="col" className="px-3 py-2 text-center font-semibold">Status</th>
              </tr>
            </thead>
            <tbody>
              {snapshot.excursions.map((excursion) => (
                <tr key={excursion.id} className="border-b border-hairline/70 last:border-0 hover:bg-slate-50/60">
                  <td className="px-3 py-2 text-[11px] font-mono text-ink-muted">{excursion.id}</td>
                  <td className="px-3 py-2">
                    <Link
                      href={`/warehouses/${encodeURIComponent(excursion.facilityId)}`}
                      className="text-[11.5px] font-semibold text-brand-600 hover:underline"
                    >
                      {excursion.facilityId}
                    </Link>
                    <p className="text-[10px] text-ink-faint">{excursion.regionId}</p>
                  </td>
                  <td className="px-3 py-2 text-[11.5px]">
                    {ZONE_BY_ID[excursion.zoneId].name} <span className="text-ink-faint">/ {excursion.chamber}</span>
                  </td>
                  <td className="tnum px-3 py-2 text-[11.5px]">
                    {formatIst(excursion.startedAt, 'dd MMM, HH:mm')}
                  </td>
                  <td className="tnum px-3 py-2 text-right text-[11.5px]">{formatMinutes(excursion.durationMinutes)}</td>
                  <td className="tnum px-3 py-2 text-right text-[11.5px] font-semibold text-bad">
                    +{excursion.peakDeviationC.toFixed(1)} °C
                  </td>
                  <td className="tnum px-3 py-2 text-right text-[11.5px]">{formatNumber(excursion.affectedPallets)}</td>
                  <td className="px-3 py-2 text-center">
                    <SeverityChip severity={excursion.severity} />
                  </td>
                  <td className="px-3 py-2 text-center">
                    <StatusChip
                      status={excursion.status === 'OPEN' ? 'critical' : excursion.status === 'CLOSED' ? 'healthy' : 'watch'}
                      size="xs"
                      label={excursion.status.charAt(0) + excursion.status.slice(1).toLowerCase()}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card>
        <CardHeader
          title="FEFO Breaches"
          subtitle="Picks that took later-expiring stock while earlier-expiring stock was available"
          tip="FEFO — first expired, first out — is the discipline that stops a cold store accumulating short-coded stock. Each breach names the SKU, what was picked, and what should have been picked instead."
        />
        <div className="w-full min-w-0 overflow-x-auto">
          <table className="w-full border-collapse">
            <caption className="sr-only">FEFO compliance breaches</caption>
            <thead>
              <tr className="border-b border-hairline bg-slate-50/70 text-[10px] uppercase tracking-wider text-ink-muted">
                <th scope="col" className="px-3 py-2 text-left font-semibold">Reference</th>
                <th scope="col" className="px-3 py-2 text-left font-semibold">Facility</th>
                <th scope="col" className="px-3 py-2 text-left font-semibold">Depositor</th>
                <th scope="col" className="px-3 py-2 text-left font-semibold">SKU</th>
                <th scope="col" className="px-3 py-2 text-left font-semibold">Picked expiry</th>
                <th scope="col" className="px-3 py-2 text-left font-semibold">Earlier stock available</th>
                <th scope="col" className="px-3 py-2 text-right font-semibold">Pallets</th>
              </tr>
            </thead>
            <tbody>
              {FEFO_BREACHES.map((breach) => (
                <tr key={breach.id} className="border-b border-hairline/70 last:border-0 hover:bg-slate-50/60">
                  <td className="px-3 py-2 text-[11px] font-mono text-ink-muted">{breach.id}</td>
                  <td className="px-3 py-2">
                    <Link
                      href={`/warehouses/${encodeURIComponent(breach.facilityId)}`}
                      className="text-[11.5px] font-semibold text-brand-600 hover:underline"
                    >
                      {breach.facilityId}
                    </Link>
                  </td>
                  <td className="px-3 py-2 text-[11.5px]">{breach.depositor}</td>
                  <td className="px-3 py-2 font-mono text-[10.5px] text-ink-soft">{breach.sku}</td>
                  <td className="tnum px-3 py-2 text-[11.5px]">{formatIst(breach.pickedExpiry, 'dd MMM yyyy')}</td>
                  <td className="tnum px-3 py-2 text-[11.5px] font-semibold text-bad">
                    {formatIst(breach.earlierAvailableExpiry, 'dd MMM yyyy')}
                  </td>
                  <td className="tnum px-3 py-2 text-right text-[11.5px]">{formatNumber(breach.pallets)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}
