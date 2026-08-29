'use client'

import * as React from 'react'
import { ChevronLeft, ChevronRight, Download, Search } from 'lucide-react'
import type { FilterState, TemperatureZoneId } from '@/lib/domain/types'
import { dataSource, type LocationQuery, type LocationRow } from '@/lib/repository'
import { Button, Card, CardHeader, Segmented, StatusChip, UtilizationBar, Value } from '@/components/ui/primitives'
import { exportCsv, exportXlsx, type ExportColumn } from '@/lib/export/exporters'
import { formatNumber, formatPct } from '@/lib/utils'
import { ZONE_BY_ID } from '@/lib/data/master'

const EXPORT_COLUMNS: ExportColumn<LocationRow>[] = [
  { key: 'region', header: 'Region', value: (r) => r.regionId },
  { key: 'facilityCode', header: 'Warehouse code', value: (r) => r.facilityCode },
  { key: 'facilityName', header: 'Warehouse', value: (r) => r.facilityName },
  { key: 'chamber', header: 'Chamber', value: (r) => r.chamber },
  { key: 'label', header: 'Location', value: (r) => r.label },
  { key: 'zone', header: 'Temperature zone', value: (r) => r.zoneName },
  { key: 'capacity', header: 'Capacity', value: (r) => r.capacity },
  { key: 'occupied', header: 'Occupied', value: (r) => r.utilizedPallets },
  { key: 'available', header: 'Available', value: (r) => r.availableCapacity },
  { key: 'utilization', header: 'Utilization %', value: (r) => (r.utilizationPct === null ? null : Number(r.utilizationPct.toFixed(2))) },
  { key: 'status', header: 'Status', value: (r) => r.status },
]

type SortKey = NonNullable<LocationQuery['sortBy']>

/**
 * Location-level utilization.
 *
 * Paged through the repository rather than in the browser: the query returns
 * one page at a time, so the component's cost is independent of how many
 * locations the network has. Exports still send the complete filtered set.
 */
export function LocationUtilizationTable({
  filters,
  title = 'Location Utilization',
  subtitle,
  pageSize = 12,
}: {
  filters: FilterState
  title?: string
  subtitle?: string
  pageSize?: number
}) {
  const [page, setPage] = React.useState(0)
  const [search, setSearch] = React.useState('')
  const [sortBy, setSortBy] = React.useState<SortKey>('utilization')
  const [sortDir, setSortDir] = React.useState<'asc' | 'desc'>('desc')
  const [statusFilter, setStatusFilter] = React.useState<'all' | 'critical' | 'high' | 'healthy'>('all')

  // Reset to the first page whenever the query changes, so the user is never
  // left staring at an empty page 7 of 3. Adjusting during render rather than
  // in an effect avoids a second render pass showing the stale page.
  const querySignature = `${JSON.stringify(filters)}|${search}|${sortBy}|${sortDir}|${statusFilter}`
  const [lastSignature, setLastSignature] = React.useState(querySignature)
  if (lastSignature !== querySignature) {
    setLastSignature(querySignature)
    setPage(0)
  }

  const result = React.useMemo(
    () => dataSource.queryLocations({ filters, search, page: 0, pageSize: 100_000, sortBy, sortDir }),
    [filters, search, sortBy, sortDir],
  )

  const filteredRows = React.useMemo(() => {
    if (statusFilter === 'all') return result.rows
    if (statusFilter === 'healthy') return result.rows.filter((r) => r.status === 'healthy' || r.status === 'watch')
    return result.rows.filter((r) => r.status === statusFilter)
  }, [result.rows, statusFilter])

  const total = filteredRows.length
  const pageCount = Math.max(1, Math.ceil(total / pageSize))
  const rows = filteredRows.slice(page * pageSize, page * pageSize + pageSize)

  function toggleSort(key: SortKey) {
    if (sortBy === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    else {
      setSortBy(key)
      setSortDir('desc')
    }
  }

  const meta = {
    title: 'Location Utilization',
    reportDate: filters.date,
    generatedAt: filters.date,
    filters: describeFilters(filters),
  }

  return (
    <Card>
      <CardHeader
        title={title}
        subtitle={subtitle ?? `${formatNumber(total)} storage locations in scope`}
        tip="Chamber-level detail behind every facility figure. Rows are served one page at a time from the data layer, so the table stays responsive whatever the network size. Exports always contain the full filtered set, not just the page on screen."
      />

      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-hairline px-3 py-2 no-print">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex h-7 items-center gap-1.5 rounded-md border border-hairline bg-surface px-2">
            <Search className="h-3.5 w-3.5 text-ink-faint" strokeWidth={2} aria-hidden />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search warehouse, chamber, zone"
              aria-label="Search locations"
              className="w-56 bg-transparent text-[12px] outline-none placeholder:text-ink-faint"
            />
          </div>
          <Segmented
            options={[
              { value: 'all', label: 'All' },
              { value: 'critical', label: 'Over capacity' },
              { value: 'high', label: '90–100%' },
              { value: 'healthy', label: 'Under 90%' },
            ]}
            value={statusFilter}
            onChange={setStatusFilter}
            ariaLabel="Filter locations by status"
          />
        </div>
        <div className="flex items-center gap-2">
          <span className="tnum text-[11.5px] text-ink-muted">{formatNumber(total)} rows</span>
          <Button onClick={() => exportCsv(filteredRows, EXPORT_COLUMNS, meta)}>
            <Download className="h-3 w-3" strokeWidth={2.5} aria-hidden />
            CSV
          </Button>
          <Button onClick={() => exportXlsx(filteredRows, EXPORT_COLUMNS, meta)}>
            <Download className="h-3 w-3" strokeWidth={2.5} aria-hidden />
            XLSX
          </Button>
        </div>
      </div>

      <div className="w-full min-w-0 overflow-x-auto">
        <table className="w-full border-collapse">
          <caption className="sr-only">Location-level capacity and utilization</caption>
          <thead>
            <tr className="border-b border-hairline bg-slate-50/70 text-[10.5px] uppercase tracking-wider text-ink-muted">
              <th scope="col" className="px-3 py-2 text-left font-semibold">Region</th>
              <SortableHeader label="Warehouse" active={sortBy === 'facility'} dir={sortDir} onClick={() => toggleSort('facility')} />
              <th scope="col" className="px-3 py-2 text-left font-semibold">Chamber / location</th>
              <th scope="col" className="px-3 py-2 text-left font-semibold">Zone</th>
              <SortableHeader label="Capacity" align="right" active={sortBy === 'capacity'} dir={sortDir} onClick={() => toggleSort('capacity')} />
              <SortableHeader label="Occupied" align="right" active={sortBy === 'occupied'} dir={sortDir} onClick={() => toggleSort('occupied')} />
              <SortableHeader label="Available" align="right" active={sortBy === 'available'} dir={sortDir} onClick={() => toggleSort('available')} />
              <SortableHeader label="Utilization" align="right" active={sortBy === 'utilization'} dir={sortDir} onClick={() => toggleSort('utilization')} />
              <th scope="col" className="px-3 py-2 text-center font-semibold">Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-3 py-10 text-center text-[12px] text-ink-muted">
                  No locations match the current filters.
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={row.id} className="border-b border-hairline/70 last:border-0 hover:bg-slate-50/60">
                  <td className="px-3 py-1.5 text-[11.5px] font-medium">{row.regionId}</td>
                  <td className="px-3 py-1.5">
                    <p className="text-[11.5px] font-semibold text-ink">{row.facilityCode}</p>
                    <p className="truncate text-[10px] text-ink-faint">{row.facilityName}</p>
                  </td>
                  <td className="px-3 py-1.5 text-[11.5px]">
                    {row.chamber} <span className="text-ink-faint">/ {row.label}</span>
                  </td>
                  <td className="px-3 py-1.5 text-[11.5px]">
                    {row.zoneName}
                    <span className="ml-1 text-[10px] text-ink-faint">
                      {ZONE_BY_ID[row.zoneId as TemperatureZoneId]?.setPoint}
                    </span>
                  </td>
                  <td className="tnum px-3 py-1.5 text-right text-[11.5px]">
                    <Value missing={row.capacity === null} reason="No capacity master row for this location.">
                      {formatNumber(row.capacity)}
                    </Value>
                  </td>
                  <td className="tnum px-3 py-1.5 text-right text-[11.5px]">{formatNumber(row.utilizedPallets)}</td>
                  <td className="tnum px-3 py-1.5 text-right text-[11.5px]">
                    <Value missing={row.availableCapacity === null}>{formatNumber(row.availableCapacity)}</Value>
                  </td>
                  <td className="px-3 py-1.5 text-right">
                    <span
                      className={`tnum text-[11.5px] font-semibold ${(row.utilizationPct ?? 0) > 100 ? 'text-bad' : 'text-ink'}`}
                    >
                      <Value missing={row.utilizationPct === null}>{formatPct(row.utilizationPct, 1)}</Value>
                    </span>
                    <UtilizationBar pct={row.utilizationPct} className="mt-1 w-20" />
                  </td>
                  <td className="px-3 py-1.5 text-center">
                    <StatusChip status={row.status as 'healthy'} size="xs" />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between gap-3 border-t border-hairline px-3 py-2 no-print">
        <span className="tnum text-[11.5px] text-ink-muted">
          Showing {total === 0 ? 0 : page * pageSize + 1}–{Math.min((page + 1) * pageSize, total)} of {formatNumber(total)}
        </span>
        <div className="flex items-center gap-1">
          <Button onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={page === 0} aria-label="Previous page">
            <ChevronLeft className="h-3 w-3" strokeWidth={2.5} aria-hidden />
            Prev
          </Button>
          <span className="tnum px-1 text-[11.5px] text-ink-muted">
            {page + 1} / {pageCount}
          </span>
          <Button
            onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
            disabled={page >= pageCount - 1}
            aria-label="Next page"
          >
            Next
            <ChevronRight className="h-3 w-3" strokeWidth={2.5} aria-hidden />
          </Button>
        </div>
      </div>
    </Card>
  )
}

function SortableHeader({
  label,
  active,
  dir,
  onClick,
  align = 'left',
}: {
  label: string
  active: boolean
  dir: 'asc' | 'desc'
  onClick: () => void
  align?: 'left' | 'right'
}) {
  return (
    <th
      scope="col"
      aria-sort={active ? (dir === 'asc' ? 'ascending' : 'descending') : 'none'}
      className={`px-3 py-2 font-semibold ${align === 'right' ? 'text-right' : 'text-left'}`}
    >
      <button type="button" onClick={onClick} className="inline-flex items-center gap-1 transition-colors hover:text-ink">
        {label}
        <span aria-hidden className={active ? 'text-brand-600' : 'opacity-30'}>
          {active && dir === 'asc' ? '▲' : '▼'}
        </span>
      </button>
    </th>
  )
}

export function describeFilters(filters: FilterState): string {
  const parts: string[] = []
  if (filters.regionIds.length) parts.push(`regions: ${filters.regionIds.join(', ')}`)
  if (filters.facilityIds.length) parts.push(`warehouses: ${filters.facilityIds.join(', ')}`)
  if (filters.zoneIds.length) parts.push(`zones: ${filters.zoneIds.join(', ')}`)
  if (filters.facilityTypes.length) parts.push(`types: ${filters.facilityTypes.join(', ')}`)
  if (filters.ownerships.length) parts.push(`ownership: ${filters.ownerships.join(', ')}`)
  if (filters.executions.length) parts.push(`execution: ${filters.executions.join(', ')}`)
  return parts.length ? parts.join(' | ') : 'none'
}
