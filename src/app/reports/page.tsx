'use client'

import * as React from 'react'
import Link from 'next/link'
import { Download, Eye, FileText, Mail, Printer } from 'lucide-react'
import { PageHeader } from '@/components/layout/page-header'
import { Drawer } from '@/components/ui/drawer'
import { Button, Card, CardHeader, DemoDataBadge } from '@/components/ui/primitives'
import { useSnapshot } from '@/lib/state/use-snapshot'
import { useSession } from '@/lib/state/session-context'
import { REPORTS, reportExportColumns, type ReportDefinition } from '@/lib/reports/registry'
import { exportCsv, exportPdf, exportXlsx, type CellValue } from '@/lib/export/exporters'
import { describeFilters } from '@/components/panels/location-table'
import { formatNumber } from '@/lib/utils'

const PREVIEW_ROWS = 25

export default function ReportCentrePage() {
  const snapshot = useSnapshot()
  const { log } = useSession()
  const [preview, setPreview] = React.useState<ReportDefinition | null>(null)

  const rowsFor = React.useCallback((report: ReportDefinition) => report.rows(snapshot), [snapshot])

  const metaFor = React.useCallback(
    (report: ReportDefinition) => ({
      title: report.name,
      reportDate: snapshot.network.reportDate,
      generatedAt: snapshot.lastRefreshAt,
      filters: describeFilters(snapshot.filters),
    }),
    [snapshot],
  )

  const previewRows = preview ? rowsFor(preview) : []

  return (
    <div className="space-y-4">
      <PageHeader
        title="Report Centre"
        description="Every report the legacy distribution produces, plus the ones it did not. Preview shows exactly what the download contains — the same rows, in the same order."
        crumbs={[{ label: 'Control Tower', href: '/' }, { label: 'Reports' }]}
        actions={<DemoDataBadge text="Demo data" />}
      />

      <div className="grid gap-3 lg:grid-cols-2">
        <Card className="border-brand-200 bg-brand-50/50">
          <CardHeader
            title="Daily LT Email Preview"
            subtitle="Exactly what leadership receives at 06:00 IST each morning"
            tip="The legacy dashboard is distributed by automated email. This preview renders that email so the compact summary can be reviewed as a deliverable in its own right, not as an afterthought of the interactive screens."
          />
          <div className="flex items-center justify-between gap-4 px-4 py-3">
            <p className="max-w-md text-[11.5px] leading-relaxed text-ink-muted">
              A single-screen executive summary: network KPIs, region table, the top five exceptions, capacity risk,
              cold-chain health and the management actions for the day.
            </p>
            <Link
              href="/reports/email-preview"
              className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-md border border-brand-500 bg-brand-500 px-3 text-[13px] font-medium text-white transition-colors hover:bg-brand-600"
            >
              <Mail className="h-3.5 w-3.5" strokeWidth={2.5} aria-hidden />
              Open email preview
            </Link>
          </div>
        </Card>

        <Card className="border-brand-200 bg-brand-50/50">
          <CardHeader
            title="Print / PDF View"
            subtitle="A4 landscape, designed for the printed pack"
            tip="A dedicated print layout rather than a browser print of the application. Margins, page breaks and density are set for A4 landscape, which is the format the leadership pack is circulated in."
          />
          <div className="flex items-center justify-between gap-4 px-4 py-3">
            <p className="max-w-md text-[11.5px] leading-relaxed text-ink-muted">
              The full daily pack laid out for paper: KPI block, region summary, exception board, capacity risk and
              cold-chain health across two landscape pages.
            </p>
            <Link
              href="/reports/print"
              className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-md border border-brand-500 bg-brand-500 px-3 text-[13px] font-medium text-white transition-colors hover:bg-brand-600"
            >
              <Printer className="h-3.5 w-3.5" strokeWidth={2.5} aria-hidden />
              Open print view
            </Link>
          </div>
        </Card>
      </div>

      <Card>
        <CardHeader title="Reports" subtitle={`${REPORTS.length} reports available for the current filter selection`} />
        <ul className="divide-y divide-hairline">
          {REPORTS.map((report) => {
            const rows = rowsFor(report)
            return (
              <li key={report.id} className="flex flex-wrap items-start justify-between gap-3 px-4 py-3">
                <div className="min-w-0 max-w-2xl">
                  <p className="flex items-center gap-2 text-[13px] font-semibold text-ink">
                    <FileText className="h-3.5 w-3.5 text-brand-500" strokeWidth={2.25} aria-hidden />
                    {report.name}
                  </p>
                  <p className="mt-0.5 text-[11.5px] leading-relaxed text-ink-muted">{report.description}</p>
                  <p className="tnum mt-1 flex flex-wrap gap-x-3 text-[10.5px] text-ink-faint">
                    <span>{formatNumber(rows.length)} rows</span>
                    <span>{report.headers.length} columns</span>
                    <span>Audience: {report.audience}</span>
                    <span>{report.frequency}</span>
                  </p>
                </div>
                <div className="flex shrink-0 flex-wrap items-center gap-1.5">
                  <Button onClick={() => setPreview(report)}>
                    <Eye className="h-3 w-3" strokeWidth={2.5} aria-hidden />
                    Preview
                  </Button>
                  <Button
                    onClick={() => {
                      log('Exported report', `${report.name} (CSV)`)
                      exportCsv(rows, reportExportColumns(report), metaFor(report))
                    }}
                  >
                    <Download className="h-3 w-3" strokeWidth={2.5} aria-hidden />
                    CSV
                  </Button>
                  <Button
                    onClick={() => {
                      log('Exported report', `${report.name} (XLSX)`)
                      exportXlsx(rows, reportExportColumns(report), metaFor(report))
                    }}
                  >
                    <Download className="h-3 w-3" strokeWidth={2.5} aria-hidden />
                    XLSX
                  </Button>
                  <Button onClick={() => exportPdf('/reports/print')}>
                    <Printer className="h-3 w-3" strokeWidth={2.5} aria-hidden />
                    PDF
                  </Button>
                </div>
              </li>
            )
          })}
        </ul>
      </Card>

      <Drawer
        open={Boolean(preview)}
        onClose={() => setPreview(null)}
        width="xl"
        title={preview?.name ?? ''}
        subtitle={
          preview ? (
            <span>
              {formatNumber(previewRows.length)} rows · showing the first {Math.min(PREVIEW_ROWS, previewRows.length)} ·
              report date {snapshot.network.reportDate}
            </span>
          ) : null
        }
        footer={
          preview ? (
            <div className="flex items-center gap-2">
              <Button
                variant="primary"
                size="md"
                onClick={() => exportCsv(previewRows, reportExportColumns(preview), metaFor(preview))}
              >
                <Download className="h-3.5 w-3.5" strokeWidth={2.5} aria-hidden />
                Download CSV
              </Button>
              <Button size="md" onClick={() => exportXlsx(previewRows, reportExportColumns(preview), metaFor(preview))}>
                <Download className="h-3.5 w-3.5" strokeWidth={2.5} aria-hidden />
                Download XLSX
              </Button>
              <Button size="md" onClick={() => exportPdf('/reports/print')}>
                <Printer className="h-3.5 w-3.5" strokeWidth={2.5} aria-hidden />
                Print / PDF
              </Button>
            </div>
          ) : null
        }
      >
        {preview ? (
          <>
            <p className="mb-3 text-[12px] leading-relaxed text-ink-muted">{preview.description}</p>
            <div className="overflow-x-auto rounded-lg border border-hairline bg-surface">
              <table className="w-full border-collapse">
                <caption className="sr-only">{preview.name} preview</caption>
                <thead>
                  <tr className="border-b border-hairline bg-slate-50 text-[10px] uppercase tracking-wider text-ink-muted">
                    {preview.headers.map((header) => (
                      <th key={header} scope="col" className="whitespace-nowrap px-2.5 py-2 text-left font-semibold">
                        {header}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {previewRows.slice(0, PREVIEW_ROWS).map((row, rowIndex) => (
                    <tr key={rowIndex} className="border-b border-hairline/70 last:border-0">
                      {row.map((cell, cellIndex) => (
                        <td key={cellIndex} className="whitespace-nowrap px-2.5 py-1.5 text-[11px] text-ink-soft">
                          {renderCell(cell)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {previewRows.length > PREVIEW_ROWS ? (
              <p className="mt-2 text-[11px] text-ink-faint">
                {formatNumber(previewRows.length - PREVIEW_ROWS)} further rows are included in the download.
              </p>
            ) : null}
          </>
        ) : null}
      </Drawer>
    </div>
  )
}

function renderCell(cell: CellValue) {
  if (cell === null) return <span className="text-[10px] font-medium uppercase text-ink-faint">N/A</span>
  if (typeof cell === 'number') return <span className="tnum">{cell.toLocaleString('en-IN')}</span>
  return cell
}
