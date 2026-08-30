'use client'

import * as React from 'react'
import Link from 'next/link'
import { Download, Search } from 'lucide-react'
import type { CustomerUtilizationRow } from '@/lib/repository'
import { dataSource } from '@/lib/repository'
import { PageHeader } from '@/components/layout/page-header'
import { Drawer } from '@/components/ui/drawer'
import { Button, Card, CardHeader, DeltaChip, InfoTip, Segmented, Value } from '@/components/ui/primitives'
import { useFilters } from '@/lib/state/filter-context'
import { useSnapshot } from '@/lib/state/use-snapshot'
import { useSession } from '@/lib/state/session-context'
import { exportCsv, exportXlsx, type ExportColumn } from '@/lib/export/exporters'
import { describeFilters } from '@/components/panels/location-table'
import { ZONE_GROUP_LABEL } from '@/lib/data/master'
import { formatInrLakh, formatNumber, formatPct } from '@/lib/utils'

const EXPORT_COLUMNS: ExportColumn<CustomerUtilizationRow>[] = [
  { key: 'region', header: 'REGION', value: (r) => r.regionId },
  { key: 'location', header: 'LOCATION', value: (r) => r.locationCode },
  { key: 'customerNo', header: 'CUSTOMER NO', value: (r) => r.customerNo },
  { key: 'customerName', header: 'CUSTOMER NAME', value: (r) => r.customerName },
  { key: 'frozen', header: 'FROZEN', value: (r) => r.frozen },
  { key: 'chilled', header: 'CHILLED', value: (r) => r.chilled },
  { key: 'dry', header: 'DRY', value: (r) => r.dry },
  { key: 'fcd', header: 'FCD Pallets', value: (r) => r.fcdPallets },
  { key: 'pctLoc', header: '% of location', value: (r) => r.pctOfLocation },
  { key: 'pctNet', header: '% of network', value: (r) => r.pctOfNetwork },
  { key: 'sector', header: 'Sector', value: (r) => r.sector },
  { key: 'facility', header: 'Facility', value: (r) => r.facilityName },
  { key: 'city', header: 'City', value: (r) => r.cityName },
]

type SortKey = 'fcd' | 'frozen' | 'chilled' | 'dry' | 'customer'

/**
 * Customer-wise utilization.
 *
 * The legacy daily report publishes this as a flat region / location /
 * depositor grid with Frozen, Chilled, Dry and an FCD Pallets row total. That
 * grid is reproduced exactly - the same grouping, the same column order, the
 * same subtotal rows - because it is what the business already reconciles
 * against. What is added around it is the part the legacy version leaves the
 * reader to work out by hand: each depositor's share of the site, the
 * concentration of the site's occupancy, and a route into a depositor's
 * footprint across the rest of the network.
 */
export default function CustomerUtilizationPage() {
  const { filters } = useFilters()
  const snapshot = useSnapshot()
  const { can } = useSession()
  const showFinancials = can('view:financials')

  const [search, setSearch] = React.useState('')
  const [sortBy, setSortBy] = React.useState<SortKey>('fcd')
  const [selected, setSelected] = React.useState<string | null>(null)

  const result = React.useMemo(
    () => dataSource.queryCustomerUtilization({ filters, search, sortBy, sortDir: 'desc' }),
    [filters, search, sortBy],
  )

  /** Region → location → depositor rows, mirroring the legacy grouping. */
  const grouped = React.useMemo(() => {
    const byRegion = new Map<string, Map<string, CustomerUtilizationRow[]>>()
    for (const row of result.rows) {
      const region = byRegion.get(row.regionId) ?? new Map<string, CustomerUtilizationRow[]>()
      const loc = region.get(row.locationCode) ?? []
      loc.push(row)
      region.set(row.locationCode, loc)
      byRegion.set(row.regionId, region)
    }
    return [...byRegion.entries()].map(([regionId, locs]) => ({
      regionId,
      locations: [...locs.entries()].map(([locationCode, rows]) => ({
        locationCode,
        rows,
        totals: rows.reduce(
          (a, r) => ({
            frozen: a.frozen + r.frozen,
            chilled: a.chilled + r.chilled,
            dry: a.dry + r.dry,
            fcd: a.fcd + r.fcdPallets,
          }),
          { frozen: 0, chilled: 0, dry: 0, fcd: 0 },
        ),
      })),
      totals: rows(locs).reduce(
        (a, r) => ({
          frozen: a.frozen + r.frozen,
          chilled: a.chilled + r.chilled,
          dry: a.dry + r.dry,
          fcd: a.fcd + r.fcdPallets,
        }),
        { frozen: 0, chilled: 0, dry: 0, fcd: 0 },
      ),
    }))
  }, [result.rows])

  /** Network-level depositor summary, used for the concentration panel. */
  const byCustomer = React.useMemo(() => {
    const map = new Map<string, { name: string; sector: string; fcd: number; locations: number }>()
    for (const r of result.rows) {
      const e = map.get(r.customerId) ?? { name: r.customerName, sector: r.sector, fcd: 0, locations: 0 }
      e.fcd += r.fcdPallets
      e.locations += 1
      map.set(r.customerId, e)
    }
    return [...map.entries()].map(([id, v]) => ({ id, ...v })).sort((a, b) => b.fcd - a.fcd)
  }, [result.rows])

  const selectedRows = React.useMemo(
    () => (selected ? result.rows.filter((r) => r.customerId === selected) : []),
    [selected, result.rows],
  )
  const selectedCustomer = snapshot.customers.find((c) => c.id === selected)

  const singleLocation = result.locationCount === 1 ? result.rows[0] : null
  const namedCount = byCustomer.filter((c) => c.id !== 'others').length
  const topN = Math.min(10, namedCount)
  const meta = {
    title: 'Customer Wise Utilization Report',
    reportDate: snapshot.network.reportDate,
    generatedAt: snapshot.lastRefreshAt,
    filters: describeFilters(filters),
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="Customer Wise Utilization"
        description="Depositor occupancy by region, location and temperature zone — the legacy daily grid, with each depositor's share of the site and their footprint across the network added."
        crumbs={[{ label: 'Control Tower', href: '/' }, { label: 'Customers' }]}
        actions={
          <>
            <Button onClick={() => exportCsv(result.rows, EXPORT_COLUMNS, meta)}>
              <Download className="h-3 w-3" strokeWidth={2.5} aria-hidden />
              CSV
            </Button>
            <Button onClick={() => exportXlsx(result.rows, EXPORT_COLUMNS, meta)}>
              <Download className="h-3 w-3" strokeWidth={2.5} aria-hidden />
              XLSX
            </Button>
          </>
        }
      />

      {/* The four figures the legacy report leads with, in its own order. */}
      <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
        <ZoneTile label={ZONE_GROUP_LABEL.FROZEN} value={result.totals.frozen} total={result.totals.fcdPallets} tone="frozen" />
        <ZoneTile label={ZONE_GROUP_LABEL.CHILLED} value={result.totals.chilled} total={result.totals.fcdPallets} tone="chilled" />
        <ZoneTile label={ZONE_GROUP_LABEL.DRY} value={result.totals.dry} total={result.totals.fcdPallets} tone="dry" />
        <Card className="p-3">
          <p className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-ink-muted">
            FCD Pallets
            <InfoTip
              label="FCD Pallets"
              text={'"FCD Pallets" in the legacy daily report is the row total across the three temperature zones — Frozen + Chilled + Dry. It is not a facility type. Dry is the union of controlled ambient and ambient storage in the capacity master.'}
            />
          </p>
          <p className="tnum mt-1 text-[24px] font-bold text-ink">{formatNumber(result.totals.fcdPallets)}</p>
          <p className="mt-0.5 text-[10.5px] leading-snug text-ink-muted">
            Frozen + Chilled + Dry · {result.customerCount} depositors across {result.locationCount}{' '}
            {result.locationCount === 1 ? 'location' : 'locations'}
          </p>
        </Card>
      </div>

      {singleLocation ? (
        <h2 className="text-[22px] font-bold tracking-tight text-ink">
          {singleLocation.cityName}
          <span className="ml-2 text-[13px] font-medium text-ink-muted">
            {singleLocation.facilityName} · {singleLocation.locationCode}
          </span>
        </h2>
      ) : null}

      {result.excludedPallets > 0 ? (
        <p className="rounded-md border border-warn-line bg-warn-soft px-3 py-2 text-[11.5px] leading-relaxed text-[#8a5b08]">
          <strong>Reconciliation.</strong> This report totals {formatNumber(result.totals.fcdPallets)} occupied pallets,
          which is {formatNumber(result.excludedPallets)} more than the {formatNumber(snapshot.network.utilizedPallets)}{' '}
          in the network utilization figure. The difference is occupancy at facilities with no capacity master row —
          real stock, correctly reported here, and correctly excluded from a utilization percentage that has no
          denominator.
        </p>
      ) : null}

      <Card>
        <CardHeader
          title="Customer Wise Utilization Report"
          subtitle={`${formatNumber(result.rows.length)} depositor-location rows · grouped by region and location`}
          tip="Reproduces the legacy report's grouping and column order so it can be reconciled line for line. The % of location column is added: it is the share of that site's occupancy the depositor holds, which is the question the flat legacy grid leaves the reader to work out."
          actions={
            <div className="flex items-center gap-2">
              <div className="flex h-7 items-center gap-1.5 rounded-md border border-hairline bg-surface px-2">
                <Search className="h-3.5 w-3.5 text-ink-faint" strokeWidth={2} aria-hidden />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search depositor, number, location"
                  aria-label="Search the customer utilization report"
                  className="w-52 bg-transparent text-[12px] outline-none placeholder:text-ink-faint"
                />
              </div>
              <Segmented
                options={[
                  { value: 'fcd', label: 'FCD' },
                  { value: 'frozen', label: 'Frozen' },
                  { value: 'chilled', label: 'Chilled' },
                  { value: 'dry', label: 'Dry' },
                  { value: 'customer', label: 'A–Z' },
                ]}
                value={sortBy}
                onChange={setSortBy}
                ariaLabel="Sort depositors within each location"
              />
            </div>
          }
        />
        <div className="w-full min-w-0 overflow-x-auto">
          <table className="w-full border-collapse">
            <caption className="sr-only">Customer wise utilization by region, location and temperature zone</caption>
            <thead>
              <tr className="border-b border-hairline bg-slate-50/70 text-[10px] uppercase tracking-wider text-ink-muted">
                <th scope="col" className="px-3 py-2 text-left font-semibold">Region</th>
                <th scope="col" className="px-3 py-2 text-left font-semibold">Location</th>
                <th scope="col" className="px-3 py-2 text-left font-semibold">Customer no</th>
                <th scope="col" className="px-3 py-2 text-left font-semibold">Customer name</th>
                <th scope="col" className="px-3 py-2 text-right font-semibold">Frozen</th>
                <th scope="col" className="px-3 py-2 text-right font-semibold">Chilled</th>
                <th scope="col" className="px-3 py-2 text-right font-semibold">Dry</th>
                <th scope="col" className="px-3 py-2 text-right font-semibold">FCD Pallets</th>
                <th scope="col" className="px-3 py-2 text-right font-semibold">% of location</th>
              </tr>
            </thead>
            <tbody>
              {result.rows.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-3 py-10 text-center text-[12px] text-ink-muted">
                    No depositor occupancy matches the current filters.
                  </td>
                </tr>
              ) : (
                grouped.map((region) =>
                  region.locations.map((loc, locIndex) => (
                    <React.Fragment key={`${region.regionId}-${loc.locationCode}`}>
                      {loc.rows.map((row, i) => (
                        <tr
                          key={`${row.customerId}-${row.facilityId}`}
                          onClick={() => setSelected(row.customerId)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault()
                              setSelected(row.customerId)
                            }
                          }}
                          tabIndex={0}
                          role="button"
                          className="cursor-pointer border-b border-hairline/60 transition-colors hover:bg-brand-50/60 focus-visible:bg-brand-50"
                        >
                          <td className="px-3 py-1.5 text-[11.5px] font-medium text-ink-soft">
                            {locIndex === 0 && i === 0 ? region.regionId : ''}
                          </td>
                          <td className="px-3 py-1.5 text-[11.5px] font-medium text-ink-soft">
                            {i === 0 ? loc.locationCode : ''}
                          </td>
                          <td className="px-3 py-1.5 font-mono text-[11px] text-ink-muted">{row.customerNo}</td>
                          <td className="px-3 py-1.5 text-[11.5px] font-medium text-ink">{row.customerName}</td>
                          <td className="tnum px-3 py-1.5 text-right text-[11.5px]">{formatNumber(row.frozen)}</td>
                          <td className="tnum px-3 py-1.5 text-right text-[11.5px]">{formatNumber(row.chilled)}</td>
                          <td className="tnum px-3 py-1.5 text-right text-[11.5px]">{formatNumber(row.dry)}</td>
                          <td className="tnum px-3 py-1.5 text-right text-[11.5px] font-bold text-ink">
                            {formatNumber(row.fcdPallets)}
                          </td>
                          <td className="px-3 py-1.5 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <span className="h-1.5 w-14 overflow-hidden rounded-full bg-slate-100">
                                <span
                                  className="block h-full rounded-full bg-brand-400"
                                  style={{ width: `${Math.min(row.pctOfLocation ?? 0, 100)}%` }}
                                />
                              </span>
                              <span className="tnum w-12 text-right text-[11px] text-ink-soft">
                                {formatPct(row.pctOfLocation, 1)}
                              </span>
                            </div>
                          </td>
                        </tr>
                      ))}
                      <tr className="border-b border-hairline bg-slate-50/80">
                        <td className="px-3 py-1.5" />
                        <td className="px-3 py-1.5 text-[11px] font-bold text-ink-soft" colSpan={3}>
                          Total · {loc.locationCode}
                        </td>
                        <td className="tnum px-3 py-1.5 text-right text-[11.5px] font-bold">{formatNumber(loc.totals.frozen)}</td>
                        <td className="tnum px-3 py-1.5 text-right text-[11.5px] font-bold">{formatNumber(loc.totals.chilled)}</td>
                        <td className="tnum px-3 py-1.5 text-right text-[11.5px] font-bold">{formatNumber(loc.totals.dry)}</td>
                        <td className="tnum px-3 py-1.5 text-right text-[11.5px] font-bold text-ink">{formatNumber(loc.totals.fcd)}</td>
                        <td className="px-3 py-1.5" />
                      </tr>
                    </React.Fragment>
                  )),
                )
              )}
              {result.rows.length > 0 ? (
                <tr className="border-t-2 border-ink-soft bg-slate-100">
                  <td className="px-3 py-2 text-[11.5px] font-bold text-ink" colSpan={4}>
                    Total
                  </td>
                  <td className="tnum px-3 py-2 text-right text-[12px] font-bold text-ink">{formatNumber(result.totals.frozen)}</td>
                  <td className="tnum px-3 py-2 text-right text-[12px] font-bold text-ink">{formatNumber(result.totals.chilled)}</td>
                  <td className="tnum px-3 py-2 text-right text-[12px] font-bold text-ink">{formatNumber(result.totals.dry)}</td>
                  <td className="tnum px-3 py-2 text-right text-[12px] font-bold text-ink">{formatNumber(result.totals.fcdPallets)}</td>
                  <td className="px-3 py-2" />
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </Card>

      <Card>
        <CardHeader
          title="Depositor Concentration"
          subtitle={
            result.topTenSharePct === null
              ? 'Depositor mix'
              : `Top ${topN} named ${topN === 1 ? 'depositor holds' : 'depositors hold'} ${formatPct(result.topTenSharePct, 1)} of the occupancy in scope`
          }
          tip="Concentration is a capacity-planning input the legacy grid does not surface: if one depositor holds a fifth of a site, their promotion calendar is that site's capacity plan. Select any depositor for their footprint across the network."
        />
        <ul className="divide-y divide-hairline">
          {byCustomer.slice(0, 12).map((c) => {
            const share = result.totals.fcdPallets === 0 ? 0 : (c.fcd / result.totals.fcdPallets) * 100
            const customer = snapshot.customers.find((x) => x.id === c.id)
            return (
              <li key={c.id}>
                <button
                  type="button"
                  onClick={() => setSelected(c.id)}
                  className="flex w-full items-center gap-3 px-4 py-2 text-left transition-colors hover:bg-brand-50/50"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[12px] font-semibold text-ink">{c.name}</span>
                    <span className="block text-[10.5px] text-ink-muted">
                      {c.sector} · {c.locations} {c.locations === 1 ? 'location' : 'locations'}
                    </span>
                  </span>
                  <span className="h-2 w-28 shrink-0 overflow-hidden rounded-full bg-slate-100">
                    <span className="block h-full rounded-full bg-brand-400" style={{ width: `${Math.min(share * 4, 100)}%` }} />
                  </span>
                  <span className="tnum w-16 shrink-0 text-right text-[12px] font-semibold text-ink">{formatNumber(c.fcd)}</span>
                  <span className="tnum w-12 shrink-0 text-right text-[11px] text-ink-muted">{formatPct(share, 1)}</span>
                  {showFinancials ? (
                    <span className="tnum w-20 shrink-0 text-right text-[11px] text-ink-muted">
                      <Value
                        missing={customer?.monthlyRevenueInrLakh === null || customer === undefined}
                        reason="Billed under a contract the reporting feed does not expose."
                      >
                        {formatInrLakh(scopedRevenue(customer, c.fcd))}
                      </Value>
                    </span>
                  ) : null}
                </button>
              </li>
            )
          })}
        </ul>
      </Card>

      <Drawer
        open={Boolean(selected)}
        onClose={() => setSelected(null)}
        width="lg"
        title={selectedCustomer?.name ?? ''}
        subtitle={
          selectedCustomer ? (
            <span>
              {selectedCustomer.sector} · {selectedRows.length}{' '}
              {selectedRows.length === 1 ? 'location' : 'locations'} in scope ·{' '}
              {formatNumber(selectedRows.reduce((a, r) => a + r.fcdPallets, 0))} pallets
            </span>
          ) : null
        }
      >
        {selectedCustomer ? (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-2">
              <Metric label="Occupied (network)" value={formatNumber(selectedCustomer.occupiedPallets)} />
              <Metric label="Locations" value={String(selectedCustomer.facilityCount)} />
              <Metric
                label="7-day change"
                value={<DeltaChip value={selectedCustomer.change7d} suffix="" digits={0} />}
              />
            </div>
            <div className="rounded-lg border border-hairline bg-surface">
              <h3 className="border-b border-hairline px-3 py-2 text-[11px] font-semibold uppercase tracking-wider text-ink-muted">
                Footprint by location
              </h3>
              <table className="w-full border-collapse">
                <caption className="sr-only">{selectedCustomer.name} occupancy by location</caption>
                <thead>
                  <tr className="text-[10px] uppercase tracking-wider text-ink-faint">
                    <th scope="col" className="px-3 py-1.5 text-left font-semibold">Location</th>
                    <th scope="col" className="px-3 py-1.5 text-right font-semibold">Frozen</th>
                    <th scope="col" className="px-3 py-1.5 text-right font-semibold">Chilled</th>
                    <th scope="col" className="px-3 py-1.5 text-right font-semibold">Dry</th>
                    <th scope="col" className="px-3 py-1.5 text-right font-semibold">FCD</th>
                    <th scope="col" className="px-3 py-1.5 text-right font-semibold">% of site</th>
                  </tr>
                </thead>
                <tbody>
                  {[...selectedRows].sort((a, b) => b.fcdPallets - a.fcdPallets).map((r) => (
                    <tr key={r.facilityId} className="border-t border-hairline/70">
                      <td className="px-3 py-1.5">
                        <Link
                          href={`/warehouses/${encodeURIComponent(r.facilityId)}`}
                          className="text-[11.5px] font-semibold text-brand-600 hover:underline"
                        >
                          {r.locationCode}
                        </Link>
                        <p className="text-[10px] text-ink-faint">
                          {r.regionId} · {r.cityName}
                        </p>
                      </td>
                      <td className="tnum px-3 py-1.5 text-right text-[11.5px]">{formatNumber(r.frozen)}</td>
                      <td className="tnum px-3 py-1.5 text-right text-[11.5px]">{formatNumber(r.chilled)}</td>
                      <td className="tnum px-3 py-1.5 text-right text-[11.5px]">{formatNumber(r.dry)}</td>
                      <td className="tnum px-3 py-1.5 text-right text-[11.5px] font-bold">{formatNumber(r.fcdPallets)}</td>
                      <td className="tnum px-3 py-1.5 text-right text-[11.5px]">{formatPct(r.pctOfLocation, 1)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : null}
      </Drawer>
    </div>
  )
}

/**
 * Storage revenue scaled to the occupancy actually on screen.
 *
 * The figure beside it is location-scoped, so a network revenue number would
 * be comparing two different scopes on one row. Revenue is linear in pallets,
 * so scaling by the in-scope share is exact rather than an estimate.
 */
function scopedRevenue(customer: { occupiedPallets: number; monthlyRevenueInrLakh: number | null } | undefined, scopedPallets: number): number | null {
  if (!customer || customer.monthlyRevenueInrLakh === null || customer.occupiedPallets === 0) return null
  return Number(((customer.monthlyRevenueInrLakh * scopedPallets) / customer.occupiedPallets).toFixed(1))
}

function rows(locs: Map<string, CustomerUtilizationRow[]>): CustomerUtilizationRow[] {
  return [...locs.values()].flat()
}

function ZoneTile({
  label,
  value,
  total,
  tone,
}: {
  label: string
  value: number
  total: number
  tone: 'frozen' | 'chilled' | 'dry'
}) {
  const color = tone === 'frozen' ? '#1E5EA8' : tone === 'chilled' ? '#3B9BD9' : '#B9A57D'
  const share = total === 0 ? 0 : (value / total) * 100
  return (
    <Card className="p-3">
      <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-ink-muted">{label}</p>
      <p className="tnum mt-1 text-[24px] font-bold text-ink">{formatNumber(value)}</p>
      <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
        <span className="block h-full rounded-full" style={{ width: `${share}%`, background: color }} />
      </div>
      <p className="tnum mt-1 text-[10.5px] text-ink-muted">{formatPct(share, 1)} of FCD pallets</p>
    </Card>
  )
}

function Metric({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-md border border-hairline bg-surface px-3 py-2">
      <p className="text-[9.5px] font-semibold uppercase tracking-wider text-ink-faint">{label}</p>
      <p className="tnum mt-0.5 text-[17px] font-bold text-ink">{value}</p>
    </div>
  )
}
