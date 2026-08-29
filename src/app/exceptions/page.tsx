'use client'

import * as React from 'react'
import type { ExceptionCategory, ExceptionRecord, Severity } from '@/lib/domain/types'
import { PageHeader } from '@/components/layout/page-header'
import { ExceptionList } from '@/components/control-tower/exception-list'
import { ExceptionDrawer } from '@/components/drawers/exception-drawer'
import { Button, Card, CardHeader, SeverityChip } from '@/components/ui/primitives'
import { useSnapshot } from '@/lib/state/use-snapshot'
import { useSession } from '@/lib/state/session-context'
import { EXCEPTION_CATEGORY_LABEL } from '@/lib/domain/exceptions'
import { exportCsv, exportXlsx, type ExportColumn } from '@/lib/export/exporters'
import { Download } from 'lucide-react'
import { formatNumber } from '@/lib/utils'

const EXPORT_COLUMNS: ExportColumn<ExceptionRecord>[] = [
  { key: 'id', header: 'Exception ID', value: (e) => e.id },
  { key: 'category', header: 'Category', value: (e) => EXCEPTION_CATEGORY_LABEL[e.category] },
  { key: 'severity', header: 'Severity', value: (e) => e.severity },
  { key: 'raisedAt', header: 'Raised at', value: (e) => e.raisedAt },
  { key: 'region', header: 'Region', value: (e) => e.regionId },
  { key: 'facility', header: 'Facility', value: (e) => e.facilityId },
  { key: 'zone', header: 'Temperature zone', value: (e) => e.zoneId },
  { key: 'metric', header: 'Metric', value: (e) => e.metricLabel },
  { key: 'actual', header: 'Actual', value: (e) => e.actual },
  { key: 'threshold', header: 'Threshold', value: (e) => e.threshold },
  { key: 'variance', header: 'Variance', value: (e) => e.variance },
  { key: 'unit', header: 'Unit', value: (e) => e.unit },
  { key: 'reason', header: 'Reason', value: (e) => e.reason },
  { key: 'action', header: 'Recommended action', value: (e) => e.recommendedAction },
  { key: 'owner', header: 'Owner', value: (e) => e.owner },
  { key: 'status', header: 'Status', value: (e) => e.status },
]

const SEVERITIES: Severity[] = ['critical', 'high', 'medium', 'low']

export default function ExceptionsPage() {
  const snapshot = useSnapshot()
  const { audit } = useSession()
  const [exception, setException] = React.useState<ExceptionRecord | null>(null)

  const bySeverity = React.useMemo(() => {
    const map = new Map<Severity, number>()
    for (const e of snapshot.exceptions) map.set(e.severity, (map.get(e.severity) ?? 0) + 1)
    return map
  }, [snapshot.exceptions])

  const byCategory = React.useMemo(() => {
    const map = new Map<ExceptionCategory, number>()
    for (const e of snapshot.exceptions) map.set(e.category, (map.get(e.category) ?? 0) + 1)
    return map
  }, [snapshot.exceptions])

  const meta = {
    title: 'Management Exception Report',
    reportDate: snapshot.network.reportDate,
    generatedAt: snapshot.lastRefreshAt,
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="Exception Centre"
        description="Everything the network raised today, grouped by the discipline that owns it. Each exception carries the metric, the threshold it crossed, the variance and the recommended action."
        crumbs={[{ label: 'Control Tower', href: '/' }, { label: 'Exceptions' }]}
        actions={
          <>
            <Button onClick={() => exportCsv(snapshot.exceptions, EXPORT_COLUMNS, meta)}>
              <Download className="h-3 w-3" strokeWidth={2.5} aria-hidden />
              CSV
            </Button>
            <Button onClick={() => exportXlsx(snapshot.exceptions, EXPORT_COLUMNS, meta)}>
              <Download className="h-3 w-3" strokeWidth={2.5} aria-hidden />
              XLSX
            </Button>
          </>
        }
      />

      <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
        {SEVERITIES.map((severity) => (
          <Card
            key={severity}
            className={`p-3 ${severity === 'critical' ? 'border-bad-line bg-bad-soft/40' : ''}`}
          >
            <div className="flex items-center justify-between">
              <SeverityChip severity={severity} />
              <span className="tnum text-[26px] font-bold leading-none text-ink">{bySeverity.get(severity) ?? 0}</span>
            </div>
            <p className="mt-1.5 text-[10.5px] text-ink-muted">
              {severity === 'critical'
                ? 'Requires intervention today'
                : severity === 'high'
                  ? 'Requires a plan this week'
                  : severity === 'medium'
                    ? 'Monitor and review'
                    : 'Informational'}
            </p>
          </Card>
        ))}
      </div>

      <div className="grid items-start gap-3 xl:grid-cols-[1fr_340px]">
        <ExceptionList
          exceptions={snapshot.exceptions}
          onSelect={setException}
          title="All Exceptions"
          subtitle={`${snapshot.exceptions.length} raised on ${snapshot.network.reportDate}`}
          showCategoryFilter
        />

        <div className="grid gap-3 self-start">
          <Card>
            <CardHeader title="By Category" subtitle="Which discipline owns today’s workload" />
            <ul className="divide-y divide-hairline">
              {[...byCategory.entries()]
                .sort((a, b) => b[1] - a[1])
                .map(([category, count]) => {
                  const total = snapshot.exceptions.length || 1
                  return (
                    <li key={category} className="flex items-center gap-3 px-4 py-2">
                      <span className="w-28 text-[11.5px] font-medium text-ink-soft">
                        {EXCEPTION_CATEGORY_LABEL[category]}
                      </span>
                      <span className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
                        <span
                          className="block h-full rounded-full bg-brand-400"
                          style={{ width: `${(count / total) * 100}%` }}
                        />
                      </span>
                      <span className="tnum w-8 text-right text-[11.5px] font-semibold text-ink">{count}</span>
                    </li>
                  )
                })}
            </ul>
          </Card>

          <Card>
            <CardHeader
              title="Audit Trail"
              subtitle="Actions taken in this session"
              tip="Placeholder for the audit requirement. In production every acknowledge, assign and export is written to an append-only log behind the API with the authenticated user's identity — not held in browser state as it is here."
            />
            {audit.length === 0 ? (
              <p className="px-4 py-6 text-center text-[11.5px] text-ink-muted">
                No actions taken yet. Acknowledge or assign an exception and it will appear here.
              </p>
            ) : (
              <ul className="divide-y divide-hairline">
                {audit.slice(0, 10).map((entry) => (
                  <li key={entry.id} className="px-4 py-2">
                    <p className="text-[11.5px] font-medium text-ink">{entry.action}</p>
                    <p className="text-[10.5px] text-ink-muted">{entry.target}</p>
                    <p className="tnum text-[10px] text-ink-faint">
                      {entry.actor} · {entry.at.slice(11, 16)} IST
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card>
            <CardHeader title="Scope" subtitle="What these exceptions cover" />
            <dl className="grid grid-cols-2 gap-3 px-4 py-3 text-[11.5px]">
              <div>
                <dt className="text-[10px] uppercase tracking-wider text-ink-faint">Facilities in scope</dt>
                <dd className="tnum font-semibold text-ink">{snapshot.network.facilityCount}</dd>
              </div>
              <div>
                <dt className="text-[10px] uppercase tracking-wider text-ink-faint">Over capacity</dt>
                <dd className="tnum font-semibold text-bad">
                  {snapshot.network.overCapacityFacilities} · {formatNumber(snapshot.network.overCapacityPallets)} pallets
                </dd>
              </div>
              <div>
                <dt className="text-[10px] uppercase tracking-wider text-ink-faint">Data-quality warnings</dt>
                <dd className="tnum font-semibold text-ink">{snapshot.dataQuality.issues.length}</dd>
              </div>
              <div>
                <dt className="text-[10px] uppercase tracking-wider text-ink-faint">Open temperature alerts</dt>
                <dd className="tnum font-semibold text-ink">{snapshot.coldChain.openTemperatureAlerts}</dd>
              </div>
            </dl>
          </Card>
        </div>
      </div>

      <ExceptionDrawer exception={exception} onClose={() => setException(null)} reportDate={snapshot.network.reportDate} />
    </div>
  )
}
