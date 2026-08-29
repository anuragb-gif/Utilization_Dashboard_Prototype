'use client'

import * as React from 'react'
import { PageHeader } from '@/components/layout/page-header'
import { Card, CardHeader, SeverityChip, StatusChip } from '@/components/ui/primitives'
import { useSnapshot } from '@/lib/state/use-snapshot'
import { THRESHOLDS } from '@/lib/config/thresholds'
import { formatIst, formatNumber, formatPct } from '@/lib/utils'

export default function DataQualityPage() {
  const snapshot = useSnapshot()
  const dq = snapshot.dataQuality

  const status = dq.healthScorePct >= 99 ? 'healthy' : dq.healthScorePct >= THRESHOLDS.dataQualityPct ? 'watch' : 'critical'
  const cleanRecords = dq.recordsProcessed - dq.recordsRejected

  return (
    <div className="space-y-4">
      <PageHeader
        title="Data Quality"
        description="What loaded, what did not, and what the published figures are therefore missing. Nothing on this screen is cosmetic — every count here changes a number somewhere else in the application."
        crumbs={[{ label: 'Control Tower', href: '/' }, { label: 'Data Quality' }]}
        actions={<StatusChip status={status} label={`${formatPct(dq.healthScorePct, 1)} clean`} />}
      />

      <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-5">
        <Tile label="Clean-record rate" value={formatPct(dq.healthScorePct, 1)} note={`floor ${THRESHOLDS.dataQualityPct}%`} tone={status === 'critical' ? 'bad' : status === 'watch' ? 'warn' : undefined} />
        <Tile label="Records processed" value={formatNumber(dq.recordsProcessed)} note="across all source extracts" />
        <Tile label="Records rejected" value={formatNumber(dq.recordsRejected)} note={`${formatPct((dq.recordsRejected / dq.recordsProcessed) * 100, 2)} of the load`} tone="warn" />
        <Tile label="Records loaded clean" value={formatNumber(cleanRecords)} note="passed every validation rule" />
        <Tile
          label="Last successful refresh"
          value={formatIst(dq.lastSuccessfulRefreshAt, 'HH:mm')}
          note={`${formatIst(dq.lastSuccessfulRefreshAt, 'dd MMM yyyy')} IST · ${snapshot.dataAgeHours}h old`}
          tone={snapshot.isStale ? 'warn' : undefined}
        />
      </div>

      <Card>
        <CardHeader
          title="Open Warnings"
          subtitle={`${dq.issues.length} known gaps in today's figures`}
          tip="Every warning names the entities it affects and states what the published numbers do as a result. A reporting system that hides its own gaps trains people to distrust it."
        />
        <ul className="divide-y divide-hairline">
          {dq.issues.map((issue) => (
            <li key={issue.id} className="px-4 py-3">
              <div className="flex flex-wrap items-center gap-2">
                <SeverityChip severity={issue.severity} />
                <p className="text-[12.5px] font-semibold text-ink">{issue.label}</p>
                <span className="tnum rounded bg-slate-100 px-1.5 py-0.5 text-[11px] font-bold text-ink-soft">
                  {formatNumber(issue.count)}
                </span>
              </div>
              <p className="mt-1 max-w-4xl text-[11.5px] leading-relaxed text-ink-muted">{issue.detail}</p>
              {issue.affected.length > 0 ? (
                <ul className="mt-1.5 flex flex-wrap gap-1.5">
                  {issue.affected.map((item) => (
                    <li
                      key={item}
                      className="rounded border border-hairline bg-slate-50 px-1.5 py-0.5 font-mono text-[10.5px] text-ink-soft"
                    >
                      {item}
                    </li>
                  ))}
                </ul>
              ) : null}
            </li>
          ))}
        </ul>
      </Card>

      <div className="grid gap-3 xl:grid-cols-2">
        <Card>
          <CardHeader title="Source Systems" subtitle="Where today's figures came from" />
          <table className="w-full border-collapse">
            <caption className="sr-only">Source Systems</caption>
            <thead>
              <tr className="border-b border-hairline bg-slate-50/70 text-[10px] uppercase tracking-wider text-ink-muted">
                <th scope="col" className="px-3 py-2 text-left font-semibold">Source</th>
                <th scope="col" className="px-3 py-2 text-center font-semibold">Status</th>
                <th scope="col" className="px-3 py-2 text-left font-semibold">Last load</th>
                <th scope="col" className="px-3 py-2 text-right font-semibold">Records</th>
              </tr>
            </thead>
            <tbody>
              {dq.sourceSystems.map((source) => (
                <tr key={source.name} className="border-b border-hairline/70 last:border-0">
                  <td className="px-3 py-2 text-[11.5px] font-medium text-ink">{source.name}</td>
                  <td className="px-3 py-2 text-center">
                    <StatusChip
                      status={source.status === 'OK' ? 'healthy' : source.status === 'DEGRADED' ? 'watch' : 'critical'}
                      size="xs"
                      label={source.status === 'OK' ? 'Loaded' : source.status === 'DEGRADED' ? 'Degraded' : 'Failed'}
                    />
                  </td>
                  <td className="tnum px-3 py-2 text-[11.5px]">
                    {formatIst(source.lastLoadAt, 'dd MMM, HH:mm')}
                    {source.lastLoadAt !== dq.lastRefreshAt ? (
                      <span className="ml-1.5 text-[10px] font-semibold text-warn">stale</span>
                    ) : null}
                  </td>
                  <td className="tnum px-3 py-2 text-right text-[11.5px]">{formatNumber(source.records)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>

        <Card>
          <CardHeader
            title="Effect on Published Figures"
            subtitle="What the headline numbers exclude and why"
            tip="This is the reconciliation between the raw extract and the published figures. It is the answer to 'why does the dashboard not match my WMS report'."
          />
          <dl className="divide-y divide-hairline">
            <Row
              label="Facilities excluded from network utilization"
              value={String(snapshot.network.facilitiesMissingCapacity)}
              note="no capacity master row, so no denominator exists"
            />
            <Row
              label="Occupied pallets excluded"
              value={formatNumber(snapshot.network.excludedUtilizedPallets)}
              note="counted and reported, but held out of the utilization percentage"
            />
            <Row
              label="Warehouse codes quarantined"
              value={String(dq.issues.find((i) => i.id === 'dq-unmapped-warehouse')?.count ?? 0)}
              note="present in the movement feed, absent from the facility master"
            />
            <Row
              label="Duplicate locations removed"
              value={String(dq.issues.find((i) => i.id === 'dq-duplicate-location')?.count ?? 0)}
              note="excluded from location rollups so capacity is not double counted"
            />
            <Row
              label="Chambers excluded from compliance"
              value={String(dq.issues.find((i) => i.id === 'dq-stale-telemetry')?.count ?? 0)}
              note="last sensor reading older than the 12-hour staleness threshold"
            />
          </dl>
        </Card>
      </div>

      <Card>
        <CardHeader title="Refresh History" subtitle="The daily load that produces this report" />
        <dl className="grid gap-4 px-4 py-3 sm:grid-cols-3">
          <div>
            <dt className="text-[10px] font-semibold uppercase tracking-wider text-ink-faint">This run</dt>
            <dd className="tnum text-[15px] font-semibold text-ink">
              {formatIst(dq.lastRefreshAt, 'dd MMM yyyy, HH:mm')} IST
            </dd>
          </div>
          <div>
            <dt className="text-[10px] font-semibold uppercase tracking-wider text-ink-faint">Previous run</dt>
            <dd className="tnum text-[15px] font-semibold text-ink">
              {formatIst(snapshot.previousRefreshAt, 'dd MMM yyyy, HH:mm')} IST
            </dd>
          </div>
          <div>
            <dt className="text-[10px] font-semibold uppercase tracking-wider text-ink-faint">Freshness</dt>
            <dd className="flex items-center gap-2">
              <span className="tnum text-[15px] font-semibold text-ink">{snapshot.dataAgeHours}h old</span>
              <StatusChip status={snapshot.isStale ? 'watch' : 'healthy'} size="xs" label={snapshot.isStale ? 'Stale' : 'Fresh'} />
            </dd>
          </div>
        </dl>
      </Card>
    </div>
  )
}

function Tile({ label, value, note, tone }: { label: string; value: string; note: string; tone?: 'warn' | 'bad' }) {
  return (
    <Card className={`p-3 ${tone === 'bad' ? 'border-bad-line bg-bad-soft/40' : tone === 'warn' ? 'border-warn-line bg-warn-soft/40' : ''}`}>
      <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-ink-muted">{label}</p>
      <p className="tnum mt-1 text-[22px] font-bold text-ink">{value}</p>
      <p className="mt-0.5 text-[10.5px] leading-snug text-ink-muted">{note}</p>
    </Card>
  )
}

function Row({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <div className="flex items-start justify-between gap-4 px-4 py-2.5">
      <div className="min-w-0">
        <dt className="text-[12px] font-medium text-ink">{label}</dt>
        <dd className="text-[10.5px] leading-snug text-ink-muted">{note}</dd>
      </div>
      <dd className="tnum shrink-0 text-[17px] font-bold text-ink">{value}</dd>
    </div>
  )
}
