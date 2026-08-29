'use client'

import * as React from 'react'
import {
  type ColumnDef,
  type SortingState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from '@tanstack/react-table'
import { ArrowDown, ArrowUp, ChevronLeft, ChevronRight, ChevronsUpDown, Download, Search } from 'lucide-react'
import { Button } from './primitives'
import { cn } from '@/lib/utils'
import { exportCsv, exportXlsx, type ExportColumn, type ExportMeta } from '@/lib/export/exporters'

/**
 * Shared enterprise table.
 *
 * Sorting, search, pagination and export all live here so every table in the
 * application behaves identically. Pagination is not cosmetic: only the
 * current page is ever rendered, which is what keeps a 5,000-row location
 * extract responsive.
 */
export function DataTable<T>({
  data,
  columns,
  exportColumns,
  exportMeta,
  searchPlaceholder = 'Search',
  initialSorting = [],
  pageSize = 15,
  emptyMessage = 'No rows match the current filters.',
  onRowClick,
  rowId,
  dense = false,
  toolbarExtra,
  hideSearch = false,
  caption,
}: {
  data: T[]
  columns: ColumnDef<T, unknown>[]
  exportColumns?: ExportColumn<T>[]
  exportMeta?: ExportMeta
  searchPlaceholder?: string
  initialSorting?: SortingState
  pageSize?: number
  emptyMessage?: string
  onRowClick?: (row: T) => void
  rowId?: (row: T) => string
  dense?: boolean
  toolbarExtra?: React.ReactNode
  hideSearch?: boolean
  /** Announced to screen readers; not shown visually. */
  caption?: string
}) {
  const [sorting, setSorting] = React.useState<SortingState>(initialSorting)
  const [globalFilter, setGlobalFilter] = React.useState('')

  const table = useReactTable({
    data,
    columns,
    state: { sorting, globalFilter },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getRowId: rowId ? (row) => rowId(row) : undefined,
    initialState: { pagination: { pageSize } },
  })

  const rows = table.getRowModel().rows
  const total = table.getFilteredRowModel().rows.length
  const pageIndex = table.getState().pagination.pageIndex
  const pageCount = table.getPageCount()

  // Exports always send the full filtered set, in the current sort order -
  // never just the visible page.
  const exportRows = React.useMemo(
    () => table.getSortedRowModel().rows.map((r) => r.original),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [table, sorting, globalFilter, data],
  )

  return (
    <div className="flex flex-col">
      {!hideSearch || exportColumns || toolbarExtra ? (
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-hairline px-3 py-2 no-print">
          <div className="flex items-center gap-2">
            {!hideSearch ? (
              <div className="flex h-7 items-center gap-1.5 rounded-md border border-hairline bg-surface px-2">
                <Search className="h-3.5 w-3.5 text-ink-faint" strokeWidth={2} aria-hidden />
                <input
                  value={globalFilter}
                  onChange={(e) => {
                    setGlobalFilter(e.target.value)
                    table.setPageIndex(0)
                  }}
                  placeholder={searchPlaceholder}
                  aria-label={searchPlaceholder}
                  className="w-44 bg-transparent text-[12px] outline-none placeholder:text-ink-faint"
                />
              </div>
            ) : null}
            {toolbarExtra}
          </div>
          <div className="flex items-center gap-2">
            <span className="tnum text-[11.5px] text-ink-muted">
              {total.toLocaleString('en-IN')} {total === 1 ? 'row' : 'rows'}
            </span>
            {exportColumns && exportMeta ? (
              <>
                <Button onClick={() => exportCsv(exportRows, exportColumns, exportMeta)} aria-label="Export as CSV">
                  <Download className="h-3 w-3" strokeWidth={2.5} aria-hidden />
                  CSV
                </Button>
                <Button onClick={() => exportXlsx(exportRows, exportColumns, exportMeta)} aria-label="Export as XLSX">
                  <Download className="h-3 w-3" strokeWidth={2.5} aria-hidden />
                  XLSX
                </Button>
              </>
            ) : null}
          </div>
        </div>
      ) : null}

      <div className="w-full min-w-0 overflow-x-auto">
        <table className="w-full border-collapse">
          {caption ? <caption className="sr-only">{caption}</caption> : null}
          <thead>
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id} className="border-b border-hairline bg-slate-50/70">
                {headerGroup.headers.map((header) => {
                  const canSort = header.column.getCanSort()
                  const sorted = header.column.getIsSorted()
                  const align = (header.column.columnDef.meta as { align?: string } | undefined)?.align
                  return (
                    <th
                      key={header.id}
                      scope="col"
                      aria-sort={sorted === 'asc' ? 'ascending' : sorted === 'desc' ? 'descending' : 'none'}
                      className={cn(
                        'whitespace-nowrap py-2 text-[10.5px] font-semibold uppercase tracking-wider text-ink-muted',
                        dense ? 'px-2' : 'px-3',
                        align === 'right' ? 'text-right' : align === 'center' ? 'text-center' : 'text-left',
                      )}
                    >
                      {header.isPlaceholder ? null : canSort ? (
                        <button
                          type="button"
                          onClick={header.column.getToggleSortingHandler()}
                          className={cn(
                            'inline-flex items-center gap-1 transition-colors hover:text-ink',
                            align === 'right' ? 'flex-row-reverse' : '',
                          )}
                        >
                          {flexRender(header.column.columnDef.header, header.getContext())}
                          {sorted === 'asc' ? (
                            <ArrowUp className="h-3 w-3 text-brand-600" strokeWidth={2.5} aria-hidden />
                          ) : sorted === 'desc' ? (
                            <ArrowDown className="h-3 w-3 text-brand-600" strokeWidth={2.5} aria-hidden />
                          ) : (
                            <ChevronsUpDown className="h-3 w-3 opacity-40" strokeWidth={2} aria-hidden />
                          )}
                        </button>
                      ) : (
                        flexRender(header.column.columnDef.header, header.getContext())
                      )}
                    </th>
                  )
                })}
              </tr>
            ))}
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={table.getAllColumns().length} className="px-3 py-10 text-center text-[12px] text-ink-muted">
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr
                  key={row.id}
                  onClick={onRowClick ? () => onRowClick(row.original) : undefined}
                  onKeyDown={
                    onRowClick
                      ? (event) => {
                          if (event.key === 'Enter' || event.key === ' ') {
                            event.preventDefault()
                            onRowClick(row.original)
                          }
                        }
                      : undefined
                  }
                  tabIndex={onRowClick ? 0 : undefined}
                  role={onRowClick ? 'button' : undefined}
                  className={cn(
                    'border-b border-hairline/70 transition-colors last:border-0',
                    onRowClick ? 'cursor-pointer hover:bg-brand-50/60 focus-visible:bg-brand-50' : 'hover:bg-slate-50/60',
                  )}
                >
                  {row.getVisibleCells().map((cell) => {
                    const align = (cell.column.columnDef.meta as { align?: string } | undefined)?.align
                    return (
                      <td
                        key={cell.id}
                        className={cn(
                          'text-[12px] text-ink-soft',
                          dense ? 'px-2 py-1.5' : 'px-3 py-2',
                          align === 'right' ? 'text-right' : align === 'center' ? 'text-center' : 'text-left',
                        )}
                      >
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    )
                  })}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {pageCount > 1 ? (
        <div className="flex items-center justify-between gap-3 border-t border-hairline px-3 py-2 no-print">
          <span className="tnum text-[11.5px] text-ink-muted">
            Page {pageIndex + 1} of {pageCount}
          </span>
          <div className="flex items-center gap-1">
            <Button
              onClick={() => table.previousPage()}
              disabled={!table.getCanPreviousPage()}
              aria-label="Previous page"
            >
              <ChevronLeft className="h-3 w-3" strokeWidth={2.5} aria-hidden />
              Prev
            </Button>
            <Button onClick={() => table.nextPage()} disabled={!table.getCanNextPage()} aria-label="Next page">
              Next
              <ChevronRight className="h-3 w-3" strokeWidth={2.5} aria-hidden />
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  )
}

/** Column meta helper so alignment stays type-checked at the call site. */
export type ColumnMeta = { align?: 'left' | 'right' | 'center' }
