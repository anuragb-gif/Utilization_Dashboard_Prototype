'use client'

import * as React from 'react'
import {
  FileSpreadsheet,
  PanelLeftClose,
  PanelLeftOpen,
  Printer,
  RotateCw,
  TriangleAlert,
} from 'lucide-react'
import { Button, InfoTip, StatusChip } from '@/components/ui/primitives'
import { exportCsv, exportPdf, exportXlsx, type ExportColumn } from '@/lib/export/exporters'
import { useNetworkSnapshot } from '@/lib/state/use-snapshot'
import { useSession } from '@/lib/state/session-context'
import type { RegionRollup } from '@/lib/domain/types'
import { formatIst } from '@/lib/utils'

const REGION_EXPORT_COLUMNS: ExportColumn<RegionRollup>[] = [
  { key: 'region', header: 'Region', value: (r) => r.regionId },
  { key: 'capacity', header: 'Capacity (pallets)', value: (r) => r.capacity },
  { key: 'occupied', header: 'Occupied (pallets)', value: (r) => r.utilizedPallets },
  { key: 'available', header: 'Available (pallets)', value: (r) => r.availableCapacity },
  { key: 'over', header: 'Over-capacity (pallets)', value: (r) => r.overCapacityPallets },
  { key: 'utilization', header: 'Utilization %', value: (r) => (r.utilizationPct === null ? null : Number(r.utilizationPct.toFixed(2))) },
  { key: 'target', header: 'Budget %', value: (r) => r.targetPct },
  { key: 'variance', header: 'Variance (pp)', value: (r) => (r.variancePct === null ? null : Number(r.variancePct.toFixed(2))) },
  { key: 'change7d', header: '7-day change (pp)', value: (r) => (r.change7dPct === null ? null : Number(r.change7dPct.toFixed(2))) },
  { key: 'forecast30', header: '30-day forecast %', value: (r) => (r.forecast30dPct === null ? null : Number(r.forecast30dPct.toFixed(2))) },
  { key: 'risk', header: 'Risk', value: (r) => r.risk },
]

export function TopBar({
  collapsed,
  onToggleSidebar,
}: {
  collapsed: boolean
  onToggleSidebar: () => void
}) {
  const snapshot = useNetworkSnapshot()
  const { log } = useSession()

  const meta = {
    title: 'Daily Pan-India Region Summary',
    reportDate: snapshot.network.reportDate,
    generatedAt: snapshot.lastRefreshAt,
    filters: 'Network (unfiltered)',
  }

  const freshness = snapshot.isStale ? 'watch' : 'healthy'

  return (
    <header className="no-print sticky top-0 z-30 border-b border-hairline bg-surface/95 backdrop-blur">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-2.5">
        <button
          type="button"
          onClick={onToggleSidebar}
          aria-label={collapsed ? 'Expand navigation' : 'Collapse navigation'}
          className="rounded-md p-1.5 text-ink-muted transition-colors hover:bg-slate-100 hover:text-ink"
        >
          {collapsed ? (
            <PanelLeftOpen className="h-4 w-4" strokeWidth={2} aria-hidden />
          ) : (
            <PanelLeftClose className="h-4 w-4" strokeWidth={2} aria-hidden />
          )}
        </button>

        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-brand-600">Snowman Logistics</p>
          {/* Chrome, not the page heading: each screen supplies the single
              <h1>, so this is a paragraph with a landmark label instead. */}
          <p className="truncate text-[15px] font-bold leading-tight tracking-tight text-ink">
            Pan-India Utilization Control Tower
          </p>
        </div>

        <div className="ml-auto flex flex-wrap items-center gap-x-4 gap-y-1.5">
          <dl className="flex items-center gap-4 text-[11px]">
            <div>
              <dt className="text-[9.5px] font-semibold uppercase tracking-wider text-ink-faint">Report date</dt>
              <dd className="tnum font-semibold text-ink">
                {formatIst(snapshot.network.reportDate, 'EEE, dd MMM yyyy')}
              </dd>
            </div>
            <div>
              <dt className="text-[9.5px] font-semibold uppercase tracking-wider text-ink-faint">Last refresh</dt>
              <dd className="tnum flex items-center gap-1 font-semibold text-ink">
                <RotateCw className="h-3 w-3 text-ink-faint" strokeWidth={2.5} aria-hidden />
                {formatIst(snapshot.lastRefreshAt, 'dd MMM, HH:mm')} IST
              </dd>
            </div>
          </dl>

          <div className="flex items-center gap-1.5">
            <StatusChip
              status={freshness}
              label={snapshot.isStale ? `Stale · ${snapshot.dataAgeHours}h old` : `Fresh · ${snapshot.dataAgeHours}h old`}
            />
            <InfoTip
              label="Data freshness"
              text={`The last successful load completed at ${formatIst(snapshot.dataQuality.lastSuccessfulRefreshAt, 'dd MMM HH:mm')} IST. Data is treated as stale once it is more than 12 hours old. The previous run completed ${formatIst(snapshot.previousRefreshAt, 'dd MMM HH:mm')} IST.`}
            />
            <span
              className="inline-flex items-center gap-1 rounded border border-slate-300 bg-slate-100 px-1.5 py-0.5 text-[9.5px] font-bold uppercase tracking-wider text-slate-600"
              title="This build runs on deterministic demonstration data, not the production warehouse."
            >
              <TriangleAlert className="h-2.5 w-2.5" strokeWidth={2.5} aria-hidden />
              Prototype · Demo data
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            <Button
              onClick={() => {
                log('Exported region summary', 'CSV')
                exportCsv(snapshot.regions, REGION_EXPORT_COLUMNS, meta)
              }}
            >
              <FileSpreadsheet className="h-3 w-3" strokeWidth={2.5} aria-hidden />
              CSV
            </Button>
            <Button
              onClick={() => {
                log('Exported region summary', 'XLSX')
                exportXlsx(snapshot.regions, REGION_EXPORT_COLUMNS, meta)
              }}
            >
              <FileSpreadsheet className="h-3 w-3" strokeWidth={2.5} aria-hidden />
              Excel
            </Button>
            <Button
              onClick={() => {
                log('Opened print / PDF view', 'Daily LT pack')
                exportPdf('/reports/print')
              }}
            >
              <Printer className="h-3 w-3" strokeWidth={2.5} aria-hidden />
              PDF
            </Button>
          </div>
        </div>
      </div>
    </header>
  )
}
