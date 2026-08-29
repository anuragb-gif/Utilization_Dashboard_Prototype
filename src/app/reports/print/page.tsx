'use client'

import * as React from 'react'
import Link from 'next/link'
import { ArrowLeft, Printer } from 'lucide-react'
import { useSnapshot } from '@/lib/state/use-snapshot'
import { Button } from '@/components/ui/primitives'
import { exportPdf } from '@/lib/export/exporters'
import { SEVERITY_RANK, THRESHOLDS } from '@/lib/config/thresholds'
import { formatIst, formatMinutes, formatNumber, formatPct, formatPp } from '@/lib/utils'

/**
 * Print / PDF pack.
 *
 * Laid out for A4 landscape, which is the format the leadership pack is
 * circulated in. Two pages: the network position and the exception detail.
 * Every interactive affordance is suppressed via `.no-print`.
 */
export default function PrintPackPage() {
  const snapshot = useSnapshot()
  const { network } = snapshot

  const topExceptions = React.useMemo(
    () => [...snapshot.exceptions].sort((a, b) => SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity]).slice(0, 12),
    [snapshot.exceptions],
  )

  const attentionFacilities = React.useMemo(
    () =>
      snapshot.facilities
        .filter((f) => f.primaryReason !== null)
        .sort((a, b) => SEVERITY_RANK[a.risk] - SEVERITY_RANK[b.risk] || (b.utilizationPct ?? 0) - (a.utilizationPct ?? 0))
        .slice(0, 12),
    [snapshot.facilities],
  )

  const riskFacilities = React.useMemo(
    () =>
      snapshot.facilities
        .filter((f) => (f.forecast30dPct ?? 0) >= THRESHOLDS.breachThresholdPct || (f.utilizationPct ?? 0) >= THRESHOLDS.breachThresholdPct)
        .sort((a, b) => (b.forecast30dPct ?? 0) - (a.forecast30dPct ?? 0))
        .slice(0, 12),
    [snapshot.facilities],
  )

  return (
    <div className="min-h-screen bg-slate-200 print:bg-white">
      <div className="mx-auto max-w-[1180px] px-4 py-5 print-shell">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2 no-print">
          <Link
            href="/reports"
            className="inline-flex h-8 items-center gap-1.5 rounded-md border border-hairline bg-surface px-2.5 text-[12px] font-medium text-ink-soft transition-colors hover:bg-slate-50"
          >
            <ArrowLeft className="h-3.5 w-3.5" strokeWidth={2.5} aria-hidden />
            Back to Report Centre
          </Link>
          <div className="flex items-center gap-2">
            <span className="text-[11.5px] text-ink-muted">Laid out for A4 landscape · 2 pages</span>
            <Button variant="primary" onClick={() => exportPdf()}>
              <Printer className="h-3 w-3" strokeWidth={2.5} aria-hidden />
              Print / Save as PDF
            </Button>
          </div>
        </div>

        {/* ---------------- Page 1 ---------------- */}
        <section className="print-page mb-5 bg-white p-6 shadow-lg print:p-0 print:shadow-none">
          <header className="flex items-end justify-between gap-4 border-b-2 border-brand-500 pb-2">
            <div>
              <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-brand-600">Snowman Logistics</p>
              <h1 className="text-[17px] font-bold leading-tight text-ink">
                Pan-India Utilization Control Tower — Daily Management Pack
              </h1>
            </div>
            <dl className="tnum flex gap-5 text-[9.5px] text-ink-muted">
              <div>
                <dt className="font-semibold uppercase tracking-wider">Report date</dt>
                <dd className="text-[11px] font-bold text-ink">
                  {formatIst(network.reportDate, 'dd MMM yyyy')}
                </dd>
              </div>
              <div>
                <dt className="font-semibold uppercase tracking-wider">Data refresh</dt>
                <dd className="text-[11px] font-bold text-ink">
                  {formatIst(snapshot.lastRefreshAt, 'dd MMM HH:mm')} IST
                </dd>
              </div>
              <div>
                <dt className="font-semibold uppercase tracking-wider">Health score</dt>
                <dd className="text-[11px] font-bold text-ink">{snapshot.health.score} / 100</dd>
              </div>
              <div>
                <dt className="font-semibold uppercase tracking-wider">Page</dt>
                <dd className="text-[11px] font-bold text-ink">1 of 2</dd>
              </div>
            </dl>
          </header>

          <table className="mt-3 w-full border-collapse">
            <caption className="sr-only">Network key performance indicators</caption>
            <tbody>
              <tr>
                <PrintKpi label="Network utilization" value={formatPct(network.utilizationPct)} note={`budget ${network.targetPct}% · ${formatPp(network.variancePct)}`} tone={(network.utilizationPct ?? 0) > 100 ? 'bad' : 'brand'} />
                <PrintKpi label="Total capacity" value={formatNumber(network.capacity)} note="pallet positions" />
                <PrintKpi label="Utilized pallets" value={formatNumber(network.utilizedPallets)} note={`7-day ${formatPp(network.change7dPp)}`} />
                <PrintKpi label="Empty pallets" value={formatNumber(network.netEmptyPallets)} note={`${formatNumber(network.availableCapacity)} truly available`} />
                <PrintKpi label="Over capacity" value={`${network.overCapacityFacilities} sites`} note={`${formatNumber(network.overCapacityPallets)} pallets`} tone={network.overCapacityPallets > 0 ? 'bad' : undefined} />
                <PrintKpi label="Forecast 7 / 14 / 30 d" value={`${formatPct(network.forecast.horizon7Pct, 1)} / ${formatPct(network.forecast.horizon14Pct, 1)} / ${formatPct(network.forecast.horizon30Pct, 1)}`} note="prototype forecast" />
              </tr>
            </tbody>
          </table>

          <div className="mt-4 grid grid-cols-[1.35fr_1fr] gap-5">
            <div>
              <PrintHeading>Region summary</PrintHeading>
              <table className="w-full border-collapse text-[9.5px]">
            <caption className="sr-only">Region summary</caption>
                <thead>
                  <tr className="bg-slate-100 text-left text-[8.5px] uppercase tracking-wider text-ink-muted">
                    <th scope="col" className="border border-hairline px-1.5 py-1">Region</th>
                    <th scope="col" className="border border-hairline px-1.5 py-1 text-right">Capacity</th>
                    <th scope="col" className="border border-hairline px-1.5 py-1 text-right">Utilized</th>
                    <th scope="col" className="border border-hairline px-1.5 py-1 text-right">Empty</th>
                    <th scope="col" className="border border-hairline px-1.5 py-1 text-right">Available</th>
                    <th scope="col" className="border border-hairline px-1.5 py-1 text-right">Util %</th>
                    <th scope="col" className="border border-hairline px-1.5 py-1 text-right">Budget</th>
                    <th scope="col" className="border border-hairline px-1.5 py-1 text-right">Var pp</th>
                    <th scope="col" className="border border-hairline px-1.5 py-1 text-right">7d pp</th>
                    <th scope="col" className="border border-hairline px-1.5 py-1 text-right">30d fc</th>
                    <th scope="col" className="border border-hairline px-1.5 py-1">Risk</th>
                  </tr>
                </thead>
                <tbody>
                  {snapshot.regions.map((region) => {
                    const over = (region.utilizationPct ?? 0) > 100
                    return (
                      <tr key={region.regionId} style={over ? { background: '#FDECEC' } : undefined}>
                        <td className="border border-hairline px-1.5 py-1 font-semibold">
                          {region.regionId}
                          {over ? <span className="ml-1 text-[8px] font-bold uppercase text-bad">over</span> : null}
                        </td>
                        <td className="tnum border border-hairline px-1.5 py-1 text-right">{formatNumber(region.capacity)}</td>
                        <td className="tnum border border-hairline px-1.5 py-1 text-right">{formatNumber(region.utilizedPallets)}</td>
                        <td className="tnum border border-hairline px-1.5 py-1 text-right">{formatNumber(region.netEmptyPallets)}</td>
                        <td className="tnum border border-hairline px-1.5 py-1 text-right">{formatNumber(region.availableCapacity)}</td>
                        <td className={`tnum border border-hairline px-1.5 py-1 text-right font-bold ${over ? 'text-bad' : ''}`}>
                          {formatPct(region.utilizationPct, 1)}
                        </td>
                        <td className="tnum border border-hairline px-1.5 py-1 text-right text-ink-muted">{region.targetPct}%</td>
                        <td className="tnum border border-hairline px-1.5 py-1 text-right">{formatPp(region.variancePct, 1)}</td>
                        <td className="tnum border border-hairline px-1.5 py-1 text-right">{formatPp(region.change7dPct, 1)}</td>
                        <td className="tnum border border-hairline px-1.5 py-1 text-right">{formatPct(region.forecast30dPct, 1)}</td>
                        <td className="border border-hairline px-1.5 py-1 uppercase">{region.risk}</td>
                      </tr>
                    )
                  })}
                  <tr className="bg-slate-100 font-bold">
                    <td className="border border-hairline px-1.5 py-1">NETWORK</td>
                    <td className="tnum border border-hairline px-1.5 py-1 text-right">{formatNumber(network.capacity)}</td>
                    <td className="tnum border border-hairline px-1.5 py-1 text-right">{formatNumber(network.utilizedPallets)}</td>
                    <td className="tnum border border-hairline px-1.5 py-1 text-right">{formatNumber(network.netEmptyPallets)}</td>
                    <td className="tnum border border-hairline px-1.5 py-1 text-right">{formatNumber(network.availableCapacity)}</td>
                    <td className="tnum border border-hairline px-1.5 py-1 text-right">{formatPct(network.utilizationPct)}</td>
                    <td className="tnum border border-hairline px-1.5 py-1 text-right">{network.targetPct}%</td>
                    <td className="tnum border border-hairline px-1.5 py-1 text-right">{formatPp(network.variancePct, 1)}</td>
                    <td className="tnum border border-hairline px-1.5 py-1 text-right">{formatPp(network.change7dPp, 1)}</td>
                    <td className="tnum border border-hairline px-1.5 py-1 text-right">{formatPct(network.forecast.horizon30Pct, 1)}</td>
                    <td className="border border-hairline px-1.5 py-1" />
                  </tr>
                </tbody>
              </table>

              <PrintHeading className="mt-4">Temperature zones</PrintHeading>
              <table className="w-full border-collapse text-[9.5px]">
            <caption className="sr-only">Temperature zones</caption>
                <thead>
                  <tr className="bg-slate-100 text-left text-[8.5px] uppercase tracking-wider text-ink-muted">
                    <th scope="col" className="border border-hairline px-1.5 py-1">Zone</th>
                    <th scope="col" className="border border-hairline px-1.5 py-1">Set point</th>
                    <th scope="col" className="border border-hairline px-1.5 py-1 text-right">Capacity</th>
                    <th scope="col" className="border border-hairline px-1.5 py-1 text-right">Occupied</th>
                    <th scope="col" className="border border-hairline px-1.5 py-1 text-right">Available</th>
                    <th scope="col" className="border border-hairline px-1.5 py-1 text-right">Util %</th>
                    <th scope="col" className="border border-hairline px-1.5 py-1 text-right">Compliance</th>
                  </tr>
                </thead>
                <tbody>
                  {snapshot.zones.map((zone) => (
                    <tr key={zone.zoneId}>
                      <td className="border border-hairline px-1.5 py-1 font-semibold">{zone.zoneName}</td>
                      <td className="border border-hairline px-1.5 py-1 text-ink-muted">{zone.setPoint}</td>
                      <td className="tnum border border-hairline px-1.5 py-1 text-right">{formatNumber(zone.capacity)}</td>
                      <td className="tnum border border-hairline px-1.5 py-1 text-right">{formatNumber(zone.utilizedPallets)}</td>
                      <td className="tnum border border-hairline px-1.5 py-1 text-right">{formatNumber(zone.availableCapacity)}</td>
                      <td className="tnum border border-hairline px-1.5 py-1 text-right font-bold">{formatPct(zone.utilizationPct, 1)}</td>
                      <td className="tnum border border-hairline px-1.5 py-1 text-right">{formatPct(zone.temperatureCompliancePct)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <PrintHeading className="mt-4">Facilities requiring attention today</PrintHeading>
              <table className="w-full border-collapse text-[9px]">
            <caption className="sr-only">Facilities requiring attention today</caption>
                <thead>
                  <tr className="bg-slate-100 text-left text-[8.5px] uppercase tracking-wider text-ink-muted">
                    <th scope="col" className="border border-hairline px-1.5 py-1">Facility</th>
                    <th scope="col" className="border border-hairline px-1.5 py-1">Region</th>
                    <th scope="col" className="border border-hairline px-1.5 py-1 text-right">Cap.</th>
                    <th scope="col" className="border border-hairline px-1.5 py-1 text-right">Occ.</th>
                    <th scope="col" className="border border-hairline px-1.5 py-1 text-right">Empty</th>
                    <th scope="col" className="border border-hairline px-1.5 py-1 text-right">Util %</th>
                    <th scope="col" className="border border-hairline px-1.5 py-1 text-right">7d pp</th>
                    <th scope="col" className="border border-hairline px-1.5 py-1">Reason</th>
                    <th scope="col" className="border border-hairline px-1.5 py-1">Manager</th>
                  </tr>
                </thead>
                <tbody>
                  {attentionFacilities.map((facility) => (
                    <tr
                      key={facility.facilityId}
                      style={(facility.utilizationPct ?? 0) > 100 ? { background: '#FDECEC' } : undefined}
                    >
                      <td className="border border-hairline px-1.5 py-1 font-semibold">
                        {facility.code} <span className="font-normal text-ink-muted">{facility.name}</span>
                      </td>
                      <td className="border border-hairline px-1.5 py-1">{facility.regionId}</td>
                      <td className="tnum border border-hairline px-1.5 py-1 text-right">{formatNumber(facility.capacity)}</td>
                      <td className="tnum border border-hairline px-1.5 py-1 text-right">{formatNumber(facility.utilizedPallets)}</td>
                      <td className={`tnum border border-hairline px-1.5 py-1 text-right ${(facility.netEmptyPallets ?? 0) < 0 ? 'font-semibold text-bad' : ''}`}>
                        {formatNumber(facility.netEmptyPallets)}
                      </td>
                      <td className={`tnum border border-hairline px-1.5 py-1 text-right font-bold ${(facility.utilizationPct ?? 0) > 100 ? 'text-bad' : ''}`}>
                        {formatPct(facility.utilizationPct, 1)}
                      </td>
                      <td className="tnum border border-hairline px-1.5 py-1 text-right">{formatPp(facility.change7dPct, 1)}</td>
                      <td className="border border-hairline px-1.5 py-1">{facility.primaryReason ?? '—'}</td>
                      <td className="border border-hairline px-1.5 py-1">{facility.owner}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div>
              <PrintHeading>Cold-chain health</PrintHeading>
              <dl className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-[9.5px]">
                <PrintStat label="Temperature compliance" value={formatPct(snapshot.coldChain.temperatureCompliancePct)} />
                <PrintStat label="Excursions (24h)" value={`${snapshot.coldChain.excursions24h} · ${snapshot.coldChain.criticalExcursions24h} critical`} />
                <PrintStat label="Avg excursion duration" value={formatMinutes(snapshot.coldChain.avgExcursionDurationMinutes)} />
                <PrintStat label="Open temperature alerts" value={String(snapshot.coldChain.openTemperatureAlerts)} />
                <PrintStat label="Quarantine pallets" value={formatNumber(snapshot.coldChain.quarantinePallets)} />
                <PrintStat label="FEFO compliance" value={formatPct(snapshot.coldChain.fefoCompliancePct)} />
                <PrintStat label="Near-expiry pallets" value={formatNumber(snapshot.coldChain.nearExpiryPallets)} />
                <PrintStat label="Short-coded pallets" value={formatNumber(snapshot.coldChain.shortCodedPallets)} />
              </dl>

              <PrintHeading className="mt-4">Pallet flow (report date)</PrintHeading>
              <dl className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-[9.5px]">
                <PrintStat label="Opening pallets" value={formatNumber(snapshot.operations.flow.at(-1)?.openingPallets)} />
                <PrintStat label="Closing pallets" value={formatNumber(snapshot.operations.flow.at(-1)?.closingPallets)} />
                <PrintStat label="Inbound" value={formatNumber(snapshot.operations.flow.at(-1)?.inbound)} />
                <PrintStat label="Putaway" value={formatNumber(snapshot.operations.flow.at(-1)?.putaway)} />
                <PrintStat label="Outbound" value={formatNumber(snapshot.operations.flow.at(-1)?.outbound)} />
                <PrintStat label="DPR" value={formatNumber(snapshot.operations.dpr)} />
                <PrintStat label="Dock-to-stock (median)" value={formatMinutes(snapshot.operations.dockToStockMinutes)} />
                <PrintStat label="Dispatch dwell (median)" value={formatMinutes(snapshot.operations.dispatchDwellMinutes)} />
              </dl>

              <PrintHeading className="mt-4">Management actions</PrintHeading>
              <ul className="space-y-1 text-[9.5px] leading-relaxed text-ink-soft">
                {snapshot.insights.slice(0, 6).map((insight) => (
                  <li key={insight.id} className="flex gap-1.5">
                    <span className="text-brand-600">•</span>
                    <span>{insight.text}</span>
                  </li>
                ))}
              </ul>

              <PrintHeading className="mt-4">Data quality</PrintHeading>
              <p className="text-[9.5px] leading-relaxed text-ink-soft">
                Load {formatPct(snapshot.dataQuality.healthScorePct, 1)} clean.{' '}
                {snapshot.dataQuality.issues
                  .filter((i) => i.severity !== 'low')
                  .map((i) => `${i.label} — ${i.count}`)
                  .join('; ')}
                . {formatNumber(network.excludedUtilizedPallets)} occupied pallets in{' '}
                {network.facilitiesMissingCapacity} facilities are excluded from network utilization because no
                capacity master row exists.
              </p>
            </div>
          </div>

          <PrintFooter />
        </section>

        {/* ---------------- Page 2 ---------------- */}
        <section className="bg-white p-6 shadow-lg print:p-0 print:shadow-none">
          <header className="flex items-end justify-between gap-4 border-b-2 border-brand-500 pb-2">
            <h2 className="text-[15px] font-bold text-ink">Exception detail &amp; capacity risk</h2>
            <p className="tnum text-[9.5px] font-semibold uppercase tracking-wider text-ink-muted">
              {formatIst(network.reportDate, 'dd MMM yyyy')} · Page 2 of 2
            </p>
          </header>

          <PrintHeading className="mt-3">Top exceptions requiring intervention</PrintHeading>
          <table className="w-full border-collapse text-[9px]">
            <caption className="sr-only">Top exceptions requiring intervention</caption>
            <thead>
              <tr className="bg-slate-100 text-left text-[8.5px] uppercase tracking-wider text-ink-muted">
                <th scope="col" className="border border-hairline px-1.5 py-1">Sev</th>
                <th scope="col" className="border border-hairline px-1.5 py-1">Region / facility</th>
                <th scope="col" className="border border-hairline px-1.5 py-1">Metric</th>
                <th scope="col" className="border border-hairline px-1.5 py-1 text-right">Actual</th>
                <th scope="col" className="border border-hairline px-1.5 py-1 text-right">Threshold</th>
                <th scope="col" className="border border-hairline px-1.5 py-1 text-right">Var</th>
                <th scope="col" className="border border-hairline px-1.5 py-1">Recommended action</th>
                <th scope="col" className="border border-hairline px-1.5 py-1">Owner</th>
              </tr>
            </thead>
            <tbody>
              {topExceptions.map((exception) => (
                <tr key={exception.id} style={exception.severity === 'critical' ? { background: '#FDECEC' } : undefined}>
                  <td className="border border-hairline px-1.5 py-1 font-bold uppercase">{exception.severity}</td>
                  <td className="border border-hairline px-1.5 py-1">
                    {exception.regionId ?? '—'} / {exception.facilityId ?? 'Network'}
                  </td>
                  <td className="border border-hairline px-1.5 py-1">{exception.metricLabel}</td>
                  <td className="tnum border border-hairline px-1.5 py-1 text-right font-semibold">
                    {exception.actual === null ? 'N/A' : `${exception.actual.toFixed(exception.unit === 'records' || exception.unit === 'pallets' ? 0 : 1)} ${exception.unit}`}
                  </td>
                  <td className="tnum border border-hairline px-1.5 py-1 text-right">
                    {exception.threshold === null ? 'N/A' : exception.threshold}
                  </td>
                  <td className="tnum border border-hairline px-1.5 py-1 text-right">
                    {exception.variance === null ? 'N/A' : `${exception.variance > 0 ? '+' : ''}${exception.variance.toFixed(1)}`}
                  </td>
                  <td className="border border-hairline px-1.5 py-1 leading-snug">{exception.recommendedAction}</td>
                  <td className="border border-hairline px-1.5 py-1">{exception.owner}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <PrintHeading className="mt-4">
            Capacity risk — facilities at or projected above {THRESHOLDS.breachThresholdPct}% (prototype forecast)
          </PrintHeading>
          <table className="w-full border-collapse text-[9.5px]">
            <caption className="sr-only">Top exceptions requiring intervention</caption>
            <thead>
              <tr className="bg-slate-100 text-left text-[8.5px] uppercase tracking-wider text-ink-muted">
                <th scope="col" className="border border-hairline px-1.5 py-1">Facility</th>
                <th scope="col" className="border border-hairline px-1.5 py-1">Region</th>
                <th scope="col" className="border border-hairline px-1.5 py-1 text-right">Capacity</th>
                <th scope="col" className="border border-hairline px-1.5 py-1 text-right">Occupied</th>
                <th scope="col" className="border border-hairline px-1.5 py-1 text-right">Current</th>
                <th scope="col" className="border border-hairline px-1.5 py-1 text-right">7d</th>
                <th scope="col" className="border border-hairline px-1.5 py-1 text-right">14d</th>
                <th scope="col" className="border border-hairline px-1.5 py-1 text-right">30d</th>
                <th scope="col" className="border border-hairline px-1.5 py-1">Breach</th>
                <th scope="col" className="border border-hairline px-1.5 py-1">Primary reason</th>
                <th scope="col" className="border border-hairline px-1.5 py-1">Manager</th>
              </tr>
            </thead>
            <tbody>
              {riskFacilities.map((facility) => (
                <tr key={facility.facilityId} style={(facility.utilizationPct ?? 0) > 100 ? { background: '#FDECEC' } : undefined}>
                  <td className="border border-hairline px-1.5 py-1 font-semibold">
                    {facility.code} <span className="font-normal text-ink-muted">{facility.name}</span>
                  </td>
                  <td className="border border-hairline px-1.5 py-1">{facility.regionId}</td>
                  <td className="tnum border border-hairline px-1.5 py-1 text-right">{formatNumber(facility.capacity)}</td>
                  <td className="tnum border border-hairline px-1.5 py-1 text-right">{formatNumber(facility.utilizedPallets)}</td>
                  <td className={`tnum border border-hairline px-1.5 py-1 text-right font-bold ${(facility.utilizationPct ?? 0) > 100 ? 'text-bad' : ''}`}>
                    {formatPct(facility.utilizationPct, 1)}
                  </td>
                  <td className="tnum border border-hairline px-1.5 py-1 text-right">{formatPct(facility.forecast7dPct, 1)}</td>
                  <td className="tnum border border-hairline px-1.5 py-1 text-right">{formatPct(facility.forecast14dPct, 1)}</td>
                  <td className="tnum border border-hairline px-1.5 py-1 text-right">{formatPct(facility.forecast30dPct, 1)}</td>
                  <td className="border border-hairline px-1.5 py-1">
                    {(facility.utilizationPct ?? 0) >= THRESHOLDS.breachThresholdPct
                      ? 'Already above'
                      : facility.expectedBreachDate
                        ? formatIst(facility.expectedBreachDate, 'dd MMM')
                        : '—'}
                  </td>
                  <td className="border border-hairline px-1.5 py-1">{facility.primaryReason ?? '—'}</td>
                  <td className="border border-hairline px-1.5 py-1">{facility.owner}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <PrintFooter />
        </section>
      </div>
    </div>
  )
}

function PrintHeading({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <h3 className={`mb-1 border-b border-hairline pb-0.5 text-[10px] font-bold uppercase tracking-wide text-brand-700 ${className}`}>
      {children}
    </h3>
  )
}

function PrintKpi({
  label,
  value,
  note,
  tone,
}: {
  label: string
  value: string
  note: string
  tone?: 'bad' | 'brand'
}) {
  return (
    <td
      className="border border-hairline px-2 py-1.5 align-top"
      style={{ background: tone === 'bad' ? '#FDECEC' : tone === 'brand' ? '#E8F1FB' : '#FFFFFF', width: '16.6%' }}
    >
      <p className="text-[8px] font-bold uppercase tracking-wider text-ink-muted">{label}</p>
      <p className={`tnum mt-0.5 text-[15px] font-bold leading-tight ${tone === 'bad' ? 'text-bad' : 'text-ink'}`}>{value}</p>
      <p className="tnum text-[8.5px] leading-snug text-ink-muted">{note}</p>
    </td>
  )
}

function PrintStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-b border-hairline pb-0.5">
      <dt className="text-[8px] font-semibold uppercase tracking-wider text-ink-faint">{label}</dt>
      <dd className="tnum text-[11px] font-bold text-ink">{value}</dd>
    </div>
  )
}

function PrintFooter() {
  return (
    <p className="mt-3 border-t border-hairline pt-1.5 text-[8px] leading-relaxed text-ink-faint">
      Snowman Logistics — Pan-India Utilization Control Tower. Design prototype on deterministic demonstration data;
      figures reproduce the legacy daily report snapshot and are not live operational data. Forecast figures are a
      deterministic trend projection, not model output. Utilization excludes facilities with no capacity master row;
      their occupancy is reported separately in the data quality note.
    </p>
  )
}
