'use client'

import * as React from 'react'
import Link from 'next/link'
import { ArrowLeft, Paperclip, Printer } from 'lucide-react'
import { useSnapshot } from '@/lib/state/use-snapshot'
import { Button } from '@/components/ui/primitives'
import { exportPdf } from '@/lib/export/exporters'
import { THRESHOLDS } from '@/lib/config/thresholds'
import { formatIst, formatNumber, formatPct, formatPp } from '@/lib/utils'
import { SEVERITY_RANK } from '@/lib/config/thresholds'

const SEVERITY_BG: Record<string, string> = {
  critical: '#FDECEC',
  high: '#FEF3E2',
  medium: '#FDF6E3',
  low: '#EFF6FD',
}
/** Plain-language band names, so the score is readable without the app. */
const HEALTH_BAND_LABEL: Record<string, string> = {
  healthy: 'healthy',
  watch: 'watch',
  high: 'action needed',
  critical: 'critical',
  info: 'informational',
  unknown: 'not computable',
}

const SEVERITY_FG: Record<string, string> = {
  critical: '#9B1C1C',
  high: '#9A4E06',
  medium: '#8A5B08',
  low: '#12508F',
}

/**
 * Daily LT email preview.
 *
 * The legacy dashboard's real distribution channel is an automated email, so
 * the email is designed here as a first-class deliverable: a compact,
 * single-screen summary that answers the morning's questions without opening
 * the application, with links in for anyone who wants the detail.
 */
export default function EmailPreviewPage() {
  const snapshot = useSnapshot()
  const { network } = snapshot

  const topExceptions = React.useMemo(
    () => [...snapshot.exceptions].sort((a, b) => SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity]).slice(0, 5),
    [snapshot.exceptions],
  )

  const riskFacilities = React.useMemo(
    () =>
      snapshot.facilities
        .filter((f) => (f.forecast14dPct ?? 0) >= THRESHOLDS.breachThresholdPct || (f.utilizationPct ?? 0) > 100)
        .sort((a, b) => (b.forecast14dPct ?? 0) - (a.forecast14dPct ?? 0))
        .slice(0, 5),
    [snapshot.facilities],
  )

  const actions = React.useMemo(() => snapshot.insights.slice(0, 5), [snapshot.insights])

  return (
    <div className="min-h-screen bg-slate-200 py-6">
      <div className="mx-auto max-w-[820px] px-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2 no-print">
          <Link
            href="/reports"
            className="inline-flex h-8 items-center gap-1.5 rounded-md border border-hairline bg-surface px-2.5 text-[12px] font-medium text-ink-soft transition-colors hover:bg-slate-50"
          >
            <ArrowLeft className="h-3.5 w-3.5" strokeWidth={2.5} aria-hidden />
            Back to Report Centre
          </Link>
          <Button onClick={() => exportPdf()}>
            <Printer className="h-3 w-3" strokeWidth={2.5} aria-hidden />
            Print this email
          </Button>
        </div>

        {/* Mail client chrome, so the reviewer sees it as leadership will. */}
        <div className="overflow-hidden rounded-lg border border-slate-300 bg-white shadow-lg">
          <div className="border-b border-slate-200 bg-slate-50 px-5 py-3 text-[12px]">
            <dl className="space-y-1">
              <Header label="From" value="Snowman Control Tower <no-reply@snowman.example>" />
              <Header
                label="To"
                value="Leadership Team; National Operations; Regional Heads"
              />
              <Header
                label="Subject"
                value={`Pan-India Utilization — ${formatIst(network.reportDate, 'dd MMM yyyy')} — ${formatPct(network.utilizationPct)} network utilization${network.overCapacityFacilities > 0 ? ` — ${network.overCapacityFacilities} facilities over capacity` : ''}`}
                bold
              />
              <Header
                label="Sent"
                value={`${formatIst(network.reportDate, 'dd MMM yyyy')}, 06:00 IST`}
              />
            </dl>
            <p className="mt-2 flex items-center gap-1.5 text-[11px] text-ink-muted">
              <Paperclip className="h-3 w-3" strokeWidth={2.5} aria-hidden />
              pan-india-utilization-{network.reportDate}.pdf · region-utilization-{network.reportDate}.xlsx
            </p>
          </div>

          {/* Email body */}
          <div className="px-6 py-5" style={{ fontFamily: 'Arial, Helvetica, sans-serif' }}>
            <div className="border-b-2 border-[#1B6EC2] pb-3">
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#1B6EC2]">Snowman Logistics</p>
              <h1 className="mt-0.5 text-[19px] font-bold leading-tight text-[#111827]">
                Pan-India Utilization — Daily Summary
              </h1>
              <p className="mt-1 text-[11.5px] text-[#6B7280]">
                Report date {formatIst(network.reportDate, 'EEEE, dd MMMM yyyy')} · data refreshed{' '}
                {formatIst(snapshot.lastRefreshAt, 'dd MMM HH:mm')} IST ·{' '}
                {snapshot.isStale ? 'DATA STALE' : 'data current'} · prototype, demonstration data
              </p>
            </div>

            {/* KPI block */}
            <table className="mt-4 w-full border-collapse">
              <caption className="sr-only">Network key performance indicators</caption>
              <tbody>
                <tr>
                  <EmailKpi
                    label="Network utilization"
                    value={formatPct(network.utilizationPct)}
                    note={`budget ${network.targetPct}% · ${formatPp(network.variancePct)}`}
                    tone={(network.utilizationPct ?? 0) > 100 ? 'bad' : 'brand'}
                  />
                  <EmailKpi label="Total capacity" value={formatNumber(network.capacity)} note="pallet positions" />
                  <EmailKpi label="Utilized" value={formatNumber(network.utilizedPallets)} note="pallets occupied" />
                  <EmailKpi
                    label="Empty pallets"
                    value={formatNumber(network.netEmptyPallets)}
                    note={`${formatNumber(network.availableCapacity)} truly available`}
                  />
                  <EmailKpi
                    label="Over capacity"
                    value={`${network.overCapacityFacilities} sites`}
                    note={`${formatNumber(network.overCapacityPallets)} pallets`}
                    tone={network.overCapacityPallets > 0 ? 'bad' : undefined}
                  />
                  <EmailKpi
                    label="Health score"
                    value={`${snapshot.health.score}/100`}
                    note={`${HEALTH_BAND_LABEL[snapshot.health.band]} · 7-day ${formatPp(network.change7dPp, 1)}`}
                  />
                </tr>
              </tbody>
            </table>

            <EmailSection title="Region summary">
              <table className="w-full border-collapse text-[11px]">
            <caption className="sr-only">Data table</caption>
                <thead>
                  <tr className="bg-[#F1F5F9] text-left text-[10px] uppercase tracking-wider text-[#6B7280]">
                    <th scope="col" className="border border-[#E3E8EF] px-2 py-1.5">Region</th>
                    <th scope="col" className="border border-[#E3E8EF] px-2 py-1.5 text-right">Capacity</th>
                    <th scope="col" className="border border-[#E3E8EF] px-2 py-1.5 text-right">Utilized</th>
                    <th scope="col" className="border border-[#E3E8EF] px-2 py-1.5 text-right">Empty</th>
                    <th scope="col" className="border border-[#E3E8EF] px-2 py-1.5 text-right">Utilization</th>
                    <th scope="col" className="border border-[#E3E8EF] px-2 py-1.5 text-right">Budget</th>
                    <th scope="col" className="border border-[#E3E8EF] px-2 py-1.5 text-right">Var.</th>
                    <th scope="col" className="border border-[#E3E8EF] px-2 py-1.5 text-right">7-day</th>
                  </tr>
                </thead>
                <tbody>
                  {snapshot.regions.map((region) => {
                    const over = (region.utilizationPct ?? 0) > 100
                    return (
                      <tr key={region.regionId} style={over ? { background: '#FDECEC' } : undefined}>
                        <td className="border border-[#E3E8EF] px-2 py-1.5 font-semibold">
                          {region.regionId}
                          {over ? (
                            <span className="ml-1.5 text-[9px] font-bold uppercase text-[#9B1C1C]">over capacity</span>
                          ) : null}
                        </td>
                        <td className="tnum border border-[#E3E8EF] px-2 py-1.5 text-right">{formatNumber(region.capacity)}</td>
                        <td className="tnum border border-[#E3E8EF] px-2 py-1.5 text-right">{formatNumber(region.utilizedPallets)}</td>
                        <td className="tnum border border-[#E3E8EF] px-2 py-1.5 text-right">{formatNumber(region.netEmptyPallets)}</td>
                        <td
                          className="tnum border border-[#E3E8EF] px-2 py-1.5 text-right font-bold"
                          style={{ color: over ? '#9B1C1C' : '#111827' }}
                        >
                          {formatPct(region.utilizationPct, 1)}
                        </td>
                        <td className="tnum border border-[#E3E8EF] px-2 py-1.5 text-right text-[#6B7280]">{region.targetPct}%</td>
                        <td className="tnum border border-[#E3E8EF] px-2 py-1.5 text-right">{formatPp(region.variancePct, 1)}</td>
                        <td className="tnum border border-[#E3E8EF] px-2 py-1.5 text-right">{formatPp(region.change7dPct, 1)}</td>
                      </tr>
                    )
                  })}
                  <tr className="bg-[#F1F5F9] font-bold">
                    <td className="border border-[#E3E8EF] px-2 py-1.5">NETWORK</td>
                    <td className="tnum border border-[#E3E8EF] px-2 py-1.5 text-right">{formatNumber(network.capacity)}</td>
                    <td className="tnum border border-[#E3E8EF] px-2 py-1.5 text-right">{formatNumber(network.utilizedPallets)}</td>
                    <td className="tnum border border-[#E3E8EF] px-2 py-1.5 text-right">{formatNumber(network.netEmptyPallets)}</td>
                    <td className="tnum border border-[#E3E8EF] px-2 py-1.5 text-right">{formatPct(network.utilizationPct)}</td>
                    <td className="tnum border border-[#E3E8EF] px-2 py-1.5 text-right">{network.targetPct}%</td>
                    <td className="tnum border border-[#E3E8EF] px-2 py-1.5 text-right">{formatPp(network.variancePct, 1)}</td>
                    <td className="tnum border border-[#E3E8EF] px-2 py-1.5 text-right">{formatPp(network.change7dPp, 1)}</td>
                  </tr>
                </tbody>
              </table>
            </EmailSection>

            <EmailSection title="Top 5 exceptions">
              <ol className="space-y-1.5">
                {topExceptions.map((exception, index) => (
                  <li
                    key={exception.id}
                    className="rounded border px-2.5 py-2 text-[11px] leading-relaxed"
                    style={{
                      background: SEVERITY_BG[exception.severity],
                      borderColor: SEVERITY_FG[exception.severity] + '40',
                    }}
                  >
                    <p className="font-bold" style={{ color: SEVERITY_FG[exception.severity] }}>
                      {index + 1}. {exception.severity.toUpperCase()} · {exception.facilityId ?? exception.regionId ?? 'Network'} ·{' '}
                      {exception.metricLabel}
                    </p>
                    <p className="mt-0.5 text-[#374151]">{exception.reason}</p>
                    <p className="mt-0.5 text-[#374151]">
                      <strong>Action:</strong> {exception.recommendedAction} <em>({exception.owner})</em>
                    </p>
                  </li>
                ))}
              </ol>
            </EmailSection>

            <EmailSection title={`Capacity risk — facilities at or projected above ${THRESHOLDS.breachThresholdPct}%`}>
              <table className="w-full border-collapse text-[11px]">
            <caption className="sr-only">Data table</caption>
                <thead>
                  <tr className="bg-[#F1F5F9] text-left text-[10px] uppercase tracking-wider text-[#6B7280]">
                    <th scope="col" className="border border-[#E3E8EF] px-2 py-1.5">Facility</th>
                    <th scope="col" className="border border-[#E3E8EF] px-2 py-1.5">Region</th>
                    <th scope="col" className="border border-[#E3E8EF] px-2 py-1.5 text-right">Current</th>
                    <th scope="col" className="border border-[#E3E8EF] px-2 py-1.5 text-right">14-day</th>
                    <th scope="col" className="border border-[#E3E8EF] px-2 py-1.5 text-right">30-day</th>
                    <th scope="col" className="border border-[#E3E8EF] px-2 py-1.5">Breach</th>
                  </tr>
                </thead>
                <tbody>
                  {riskFacilities.map((facility) => (
                    <tr key={facility.facilityId}>
                      <td className="border border-[#E3E8EF] px-2 py-1.5 font-semibold">
                        {facility.code} <span className="font-normal text-[#6B7280]">{facility.name}</span>
                      </td>
                      <td className="border border-[#E3E8EF] px-2 py-1.5">{facility.regionId}</td>
                      <td
                        className="tnum border border-[#E3E8EF] px-2 py-1.5 text-right font-bold"
                        style={{ color: (facility.utilizationPct ?? 0) > 100 ? '#9B1C1C' : '#111827' }}
                      >
                        {formatPct(facility.utilizationPct, 1)}
                      </td>
                      <td className="tnum border border-[#E3E8EF] px-2 py-1.5 text-right">{formatPct(facility.forecast14dPct, 1)}</td>
                      <td className="tnum border border-[#E3E8EF] px-2 py-1.5 text-right">{formatPct(facility.forecast30dPct, 1)}</td>
                      <td className="border border-[#E3E8EF] px-2 py-1.5">
                        {(facility.utilizationPct ?? 0) >= THRESHOLDS.breachThresholdPct
                          ? 'Already above'
                          : facility.expectedBreachDate
                            ? formatIst(facility.expectedBreachDate, 'dd MMM')
                            : 'Not within 30d'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="mt-1 text-[10px] italic text-[#6B7280]">
                Forecast figures are a deterministic trend projection produced for this prototype. They are not model
                output.
              </p>
            </EmailSection>

            <EmailSection title="Cold-chain health">
              <table className="w-full border-collapse text-[11px]">
            <caption className="sr-only">Data table</caption>
                <tbody>
                  <tr>
                    <EmailMini label="Temperature compliance" value={formatPct(snapshot.coldChain.temperatureCompliancePct)} />
                    <EmailMini
                      label="Excursions (24h)"
                      value={`${snapshot.coldChain.excursions24h} · ${snapshot.coldChain.criticalExcursions24h} critical`}
                      tone={snapshot.coldChain.criticalExcursions24h > 0 ? 'bad' : undefined}
                    />
                    <EmailMini label="FEFO compliance" value={formatPct(snapshot.coldChain.fefoCompliancePct)} />
                    <EmailMini label="Near expiry" value={`${formatNumber(snapshot.coldChain.nearExpiryPallets)} pallets`} />
                    <EmailMini label="Quarantine" value={`${formatNumber(snapshot.coldChain.quarantinePallets)} pallets`} />
                  </tr>
                </tbody>
              </table>
            </EmailSection>

            <EmailSection title="Management actions today">
              <ul className="space-y-1 text-[11.5px] leading-relaxed text-[#374151]">
                {actions.map((insight) => (
                  <li key={insight.id} className="flex gap-2">
                    <span className="text-[#1B6EC2]">•</span>
                    <span>{insight.text}</span>
                  </li>
                ))}
              </ul>
            </EmailSection>

            {snapshot.dataQuality.issues.length > 0 ? (
              <EmailSection title="Data quality notice">
                <p className="text-[11px] leading-relaxed text-[#8A5B08]">
                  Today&rsquo;s figures load at {formatPct(snapshot.dataQuality.healthScorePct, 1)} clean.{' '}
                  {snapshot.dataQuality.issues
                    .filter((i) => i.severity !== 'low')
                    .map((issue) => `${issue.label} — ${issue.count}`)
                    .join('; ')}
                  . {formatNumber(network.excludedUtilizedPallets)} occupied pallets are excluded from network
                  utilization because no capacity master row exists for their facility.
                </p>
              </EmailSection>
            ) : null}

            <div className="mt-5 border-t border-[#E3E8EF] pt-3 text-[10px] leading-relaxed text-[#9CA3AF]">
              <p>
                Generated by the Snowman Pan-India Utilization Control Tower. This is a design prototype running on
                deterministic demonstration data; the figures reproduce the legacy daily report snapshot and are not
                live operational data.
              </p>
              <p className="mt-1 no-print">
                <Link href="/" className="text-[#1B6EC2] underline">
                  Open the control tower
                </Link>{' '}
                ·{' '}
                <Link href="/exceptions" className="text-[#1B6EC2] underline">
                  Exception centre
                </Link>{' '}
                ·{' '}
                <Link href="/reports/print" className="text-[#1B6EC2] underline">
                  Printable pack
                </Link>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function Header({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className="flex gap-2">
      <dt className="w-14 shrink-0 text-[11px] font-semibold text-ink-faint">{label}</dt>
      <dd className={`min-w-0 text-[11.5px] ${bold ? 'font-bold text-ink' : 'text-ink-soft'}`}>{value}</dd>
    </div>
  )
}

function EmailKpi({
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
      className="border border-[#E3E8EF] px-2.5 py-2 align-top"
      style={{ background: tone === 'bad' ? '#FDECEC' : tone === 'brand' ? '#E8F1FB' : '#FFFFFF', width: '16.6%' }}
    >
      <p className="text-[9px] font-bold uppercase tracking-wider text-[#6B7280]">{label}</p>
      <p
        className="tnum mt-0.5 text-[17px] font-bold leading-tight"
        style={{ color: tone === 'bad' ? '#9B1C1C' : '#111827' }}
      >
        {value}
      </p>
      <p className="tnum mt-0.5 text-[9.5px] leading-snug text-[#6B7280]">{note}</p>
    </td>
  )
}

function EmailMini({ label, value, tone }: { label: string; value: string; tone?: 'bad' }) {
  return (
    <td className="border border-[#E3E8EF] px-2.5 py-2 align-top" style={{ width: '20%' }}>
      <p className="text-[9px] font-bold uppercase tracking-wider text-[#6B7280]">{label}</p>
      <p className="tnum mt-0.5 text-[13px] font-bold" style={{ color: tone === 'bad' ? '#9B1C1C' : '#111827' }}>
        {value}
      </p>
    </td>
  )
}

function EmailSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-5 print-avoid-break">
      <h2 className="mb-1.5 border-b border-[#E3E8EF] pb-1 text-[12px] font-bold uppercase tracking-wide text-[#12508F]">
        {title}
      </h2>
      {children}
    </section>
  )
}
