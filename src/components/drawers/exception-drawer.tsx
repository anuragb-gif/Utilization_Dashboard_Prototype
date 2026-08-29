'use client'

import * as React from 'react'
import Link from 'next/link'
import { Check, ExternalLink, FileDown, UserPlus } from 'lucide-react'
import type { ExceptionRecord } from '@/lib/domain/types'
import { Drawer } from '@/components/ui/drawer'
import { Button, SeverityChip, StatusChip } from '@/components/ui/primitives'
import { EXCEPTION_CATEGORY_LABEL } from '@/lib/domain/exceptions'
import { KPI_DEFINITIONS } from '@/lib/config/kpi-definitions'
import { useSession } from '@/lib/state/session-context'
import { exportCsv } from '@/lib/export/exporters'
import { formatIst, formatNumber } from '@/lib/utils'

function formatMetric(value: number | null, unit: string): string {
  if (value === null) return 'N/A'
  if (unit === '%' || unit.startsWith('pp')) return `${value.toFixed(2)}${unit === '%' ? '%' : ` ${unit}`}`
  if (unit === '°C') return `${value.toFixed(1)} °C`
  return `${formatNumber(value)} ${unit}`
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-[10px] font-semibold uppercase tracking-wider text-ink-faint">{label}</dt>
      <dd className="mt-0.5 text-[12px] text-ink-soft">{children}</dd>
    </div>
  )
}

/**
 * Exception detail.
 *
 * Everything a manager needs to act without opening another system: what
 * fired, against which threshold, by how much, who owns it, and what to do.
 * Acknowledge and Assign write to the session workflow state and the audit
 * log - they are not decorative buttons.
 */
export function ExceptionDrawer({
  exception,
  onClose,
  reportDate,
}: {
  exception: ExceptionRecord | null
  onClose: () => void
  reportDate: string
}) {
  if (!exception) return null
  // Keying on the exception id remounts the panel when a different exception
  // is opened, so the assignee field resets to that exception's owner without
  // an effect that mirrors a prop into state.
  return <ExceptionDrawerPanel key={exception.id} exception={exception} onClose={onClose} reportDate={reportDate} />
}

function ExceptionDrawerPanel({
  exception,
  onClose,
  reportDate,
}: {
  exception: ExceptionRecord
  onClose: () => void
  reportDate: string
}) {
  const { can, exceptionStatus, setExceptionStatus } = useSession()
  const [assignee, setAssignee] = React.useState(exception.owner)

  const status = exceptionStatus[exception.id] ?? exception.status
  const definition = KPI_DEFINITIONS[exception.metricId]
  const canAction = can('action:acknowledge')
  const canAssign = can('action:assign')

  return (
    <Drawer
      open={Boolean(exception)}
      onClose={onClose}
      width="lg"
      title={
        <span className="flex items-center gap-2">
          <SeverityChip severity={exception.severity} />
          {exception.metricLabel}
        </span>
      }
      subtitle={
        <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="rounded border border-hairline bg-slate-50 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-ink-muted">
            {EXCEPTION_CATEGORY_LABEL[exception.category]}
          </span>
          {exception.regionId ? <span>{exception.regionId}</span> : null}
          {exception.facilityId ? <span>· {exception.facilityId}</span> : null}
          {exception.zoneId ? <span>· {exception.zoneId.replace('_', ' ')}</span> : null}
          <span className="text-ink-faint">
            · raised {formatIst(exception.raisedAt, 'dd MMM yyyy, HH:mm')} IST
          </span>
        </span>
      }
      footer={
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Button
              variant="primary"
              size="md"
              disabled={!canAction || status !== 'OPEN'}
              onClick={() => setExceptionStatus(exception.id, 'ACKNOWLEDGED', `${exception.id} · ${exception.metricLabel}`)}
            >
              <Check className="h-3.5 w-3.5" strokeWidth={2.5} aria-hidden />
              {status === 'OPEN' ? 'Acknowledge' : 'Acknowledged'}
            </Button>
            <div className="flex items-center gap-1">
              <label htmlFor="assignee" className="sr-only">
                Assign to
              </label>
              <input
                id="assignee"
                value={assignee}
                onChange={(e) => setAssignee(e.target.value)}
                disabled={!canAssign}
                className="h-9 w-44 rounded-md border border-hairline bg-surface px-2 text-[12px] outline-none disabled:bg-slate-50"
                placeholder="Assign to"
              />
              <Button
                size="md"
                disabled={!canAssign || assignee.trim() === ''}
                onClick={() => setExceptionStatus(exception.id, 'ASSIGNED', `${exception.id} → ${assignee}`)}
              >
                <UserPlus className="h-3.5 w-3.5" strokeWidth={2.5} aria-hidden />
                Assign
              </Button>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              size="md"
              onClick={() =>
                exportCsv(
                  [exception],
                  [
                    { key: 'id', header: 'Exception ID', value: (e) => e.id },
                    { key: 'category', header: 'Category', value: (e) => EXCEPTION_CATEGORY_LABEL[e.category] },
                    { key: 'severity', header: 'Severity', value: (e) => e.severity },
                    { key: 'raisedAt', header: 'Raised at', value: (e) => e.raisedAt },
                    { key: 'region', header: 'Region', value: (e) => e.regionId },
                    { key: 'facility', header: 'Facility', value: (e) => e.facilityId },
                    { key: 'metric', header: 'Metric', value: (e) => e.metricLabel },
                    { key: 'actual', header: 'Actual', value: (e) => e.actual },
                    { key: 'threshold', header: 'Threshold', value: (e) => e.threshold },
                    { key: 'variance', header: 'Variance', value: (e) => e.variance },
                    { key: 'unit', header: 'Unit', value: (e) => e.unit },
                    { key: 'reason', header: 'Reason', value: (e) => e.reason },
                    { key: 'action', header: 'Recommended action', value: (e) => e.recommendedAction },
                    { key: 'owner', header: 'Owner', value: (e) => e.owner },
                  ],
                  { title: `Exception ${exception.id}`, reportDate, generatedAt: reportDate },
                )
              }
            >
              <FileDown className="h-3.5 w-3.5" strokeWidth={2.5} aria-hidden />
              Export
            </Button>
            {exception.facilityId ? (
              <Link
                href={`/warehouses/${encodeURIComponent(exception.facilityId)}`}
                className="inline-flex h-9 items-center gap-1.5 rounded-md border border-hairline bg-surface px-3 text-[13px] font-medium text-ink-soft transition-colors hover:bg-slate-50"
              >
                <ExternalLink className="h-3.5 w-3.5" strokeWidth={2.5} aria-hidden />
                Open facility
              </Link>
            ) : null}
          </div>
        </div>
      }
    >
      <div className="space-y-4">
        <div className="rounded-lg border border-hairline bg-surface p-4">
          <dl className="grid grid-cols-3 gap-4">
            <Field label="Actual">
              <span className="tnum text-[20px] font-bold text-ink">{formatMetric(exception.actual, exception.unit)}</span>
            </Field>
            <Field label="Threshold">
              <span className="tnum text-[20px] font-semibold text-ink-muted">
                {formatMetric(exception.threshold, exception.unit)}
              </span>
            </Field>
            <Field label="Variance">
              <span
                className={`tnum text-[20px] font-bold ${
                  exception.variance !== null && exception.variance > 0 ? 'text-bad' : 'text-ok'
                }`}
              >
                {exception.variance === null
                  ? 'N/A'
                  : `${exception.variance > 0 ? '+' : ''}${formatMetric(exception.variance, exception.unit)}`}
              </span>
            </Field>
          </dl>
        </div>

        <section>
          <h3 className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-ink-faint">Why this fired</h3>
          <p className="text-[12.5px] leading-relaxed text-ink-soft">{exception.reason}</p>
        </section>

        <section className="rounded-lg border border-brand-200 bg-brand-50 p-3">
          <h3 className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-brand-700">Recommended action</h3>
          <p className="text-[12.5px] leading-relaxed text-brand-900">{exception.recommendedAction}</p>
        </section>

        <section>
          <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-ink-faint">Ownership & status</h3>
          <dl className="grid grid-cols-2 gap-3 rounded-lg border border-hairline bg-surface p-3">
            <Field label="Owner">{exception.owner}</Field>
            <Field label="Status">
              <StatusChip
                status={status === 'OPEN' ? 'critical' : status === 'RESOLVED' ? 'healthy' : 'watch'}
                label={status.charAt(0) + status.slice(1).toLowerCase()}
              />
            </Field>
            <Field label="Metric definition">
              {definition ? (
                <>
                  <span className="font-medium text-ink">{definition.name}</span>
                  <span className="mt-0.5 block text-[11px] leading-relaxed text-ink-muted">{definition.description}</span>
                  <code className="mt-1 block rounded bg-slate-100 px-1.5 py-1 text-[10.5px] text-ink-soft">
                    {definition.formula}
                  </code>
                </>
              ) : (
                'Not mapped'
              )}
            </Field>
            <Field label="Source & refresh">
              {definition ? `${definition.source} · ${definition.refreshFrequency.replace(/_/g, ' ').toLowerCase()}` : 'N/A'}
            </Field>
          </dl>
        </section>

        {!canAction ? (
          <p className="rounded-md border border-warn-line bg-warn-soft px-3 py-2 text-[11.5px] text-[#8a5b08]">
            Your role has read-only access to exception workflow. Acknowledge and Assign are disabled.
          </p>
        ) : null}
      </div>
    </Drawer>
  )
}
