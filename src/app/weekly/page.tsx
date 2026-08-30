'use client'

import * as React from 'react'
import Link from 'next/link'
import { ChevronRight, Download, Minus, TrendingDown, TrendingUp } from 'lucide-react'
import type { WeeklyFlag, WeeklyRow } from '@/lib/repository'
import { dataSource } from '@/lib/repository'
import { PageHeader } from '@/components/layout/page-header'
import {
  Card,
  CardHeader,
  InfoTip,
  SectionTitle,
  Segmented,
  Sparkline,
  StatusChip,
  Value,
} from '@/components/ui/primitives'
import { useFilters } from '@/lib/state/filter-context'
import { useSnapshot } from '@/lib/state/use-snapshot'
import { exportCsv, exportXlsx, type ExportColumn } from '@/lib/export/exporters'
import { describeFilters } from '@/components/panels/location-table'
import { THRESHOLDS, UTILIZATION_BANDS } from '@/lib/config/thresholds'
import { cn, formatDate, formatPct, formatPp } from '@/lib/utils'
import type { StatusLevel } from '@/lib/domain/types'

const WINDOWS = [
  { value: '4', label: '4 weeks' },
  { value: '8', label: '8 weeks' },
  { value: '13', label: '13 weeks' },
]

const FLAG_META: Record<WeeklyFlag, { label: string; status: StatusLevel; note: string }> = {
  SUSTAINED_OVER: { label: 'Over capacity every week', status: 'critical', note: 'Above 100% in every week of the window — not a spike.' },
  SUSTAINED_UNDER: { label: 'Under-utilized every week', status: 'watch', note: `Below ${THRESHOLDS.underUtilizedPct}% in every week — a commercial review, not an operational one.` },
  VOLATILE: { label: 'Volatile', status: 'high', note: 'Average week-on-week movement of 2.5 points or more.' },
  FLAT: { label: 'Barely moving', status: 'info', note: 'Average week-on-week movement under 0.25 points — genuinely static, or a feed that has stopped updating.' },
  NOT_COMPUTABLE: { label: 'No capacity master', status: 'unknown', note: 'Occupancy is reported but there is no capacity to divide by, so no utilization exists for any week.' },
  IMPROVING: { label: 'Improving', status: 'healthy', note: 'Up 3 points or more across the window.' },
  DECLINING: { label: 'Declining', status: 'watch', note: 'Down 3 points or more across the window.' },
}

/** Only the bands that need attention are tinted; a fully tinted sheet reads as noise. */
function cellTint(status: string): string {
  if (status === 'critical') return 'bg-bad-soft'
  if (status === 'high') return 'bg-hot-soft'
  return ''
}

function DeltaCell({ value }: { value: number | null }) {
  if (value === null) return <span className="text-[10px] text-ink-faint">—</span>
  const flat = Math.abs(value) < 0.05
  const Icon = flat ? Minus : value > 0 ? TrendingUp : TrendingDown
  return (
    <span
      className={cn(
        'tnum inline-flex items-center gap-0.5 text-[10px] font-semibold',
        flat ? 'text-ink-faint' : value > 0 ? 'text-ok' : 'text-bad',
      )}
    >
      <Icon className="h-2.5 w-2.5" strokeWidth={2.75} aria-hidden />
      {value > 0 ? '+' : ''}
      {value.toFixed(1)}
    </span>
  )
}

/**
 * Weekly Utilization Comparison.
 *
 * The legacy report is a region/location grid of week-ending utilization with
 * a movement column beside each week. That grid is kept — same rows, same
 * week-ending Sundays, same subtotals — because it is what gets reconciled in
 * the Monday review. What is added is the reading the flat grid makes the
 * reader do in their head: the shape of each row over the window, which sites
 * are actually moving, and which conditions have persisted long enough to stop
 * being noise.
 *
 * One correction: the legacy column is headed "Percent Change" but publishes a
 * percentage-POINT delta. It is labelled honestly here.
 */
export default function WeeklyComparisonPage() {
  const { filters } = useFilters()
  const snapshot = useSnapshot()
  const [weeks, setWeeks] = React.useState('4')
  const [expanded, setExpanded] = React.useState<Record<string, boolean>>({})

  const data = React.useMemo(
    () => dataSource.queryWeeklyComparison({ filters, weeks: Number(weeks) }),
    [filters, weeks],
  )

  const toggle = (id: string) => setExpanded((prev) => ({ ...prev, [id]: !prev[id] }))
  const allOpen = data.regions.every((r) => expanded[r.region.id])
  const setAll = (open: boolean) =>
    setExpanded(Object.fromEntries(data.regions.map((r) => [r.region.id, open])))

  const exportRows = React.useMemo(() => {
    const out: WeeklyRow[] = []
    for (const group of data.regions) {
      out.push(group.region)
      out.push(...group.facilities)
    }
    out.push(data.network)
    return out
  }, [data])

  const exportColumns = React.useMemo<ExportColumn<WeeklyRow>[]>(() => {
    const base: ExportColumn<WeeklyRow>[] = [
      { key: 'level', header: 'Level', value: (r) => r.kind },
      { key: 'region', header: 'Region', value: (r) => r.regionId },
      { key: 'label', header: 'Row', value: (r) => r.label },
      { key: 'name', header: 'Name', value: (r) => r.sublabel },
    ]
    data.weekEndings.forEach((week, i) => {
      base.push({ key: `u${i}`, header: `${week} utilization %`, value: (r) => r.cells[i]?.utilizationPct ?? null })
      base.push({ key: `d${i}`, header: `${week} change (pp)`, value: (r) => r.cells[i]?.changePp ?? null })
    })
    base.push({ key: 'win', header: 'Window change (pp)', value: (r) => r.windowChangePp })
    base.push({ key: 'vol', header: 'Volatility (pp/week)', value: (r) => r.volatilityPp })
    base.push({ key: 'flags', header: 'Flags', value: (r) => (r.flags.length ? r.flags.join('; ') : null) })
    return base
  }, [data.weekEndings])

  const meta = {
    title: 'Weekly Utilization Comparison',
    reportDate: snapshot.network.reportDate,
    generatedAt: snapshot.lastRefreshAt,
    filters: describeFilters(filters),
  }

  const net = data.network
  const weeksAboveBudget = net.cells.filter((c) => c.utilizationPct !== null && c.utilizationPct > snapshot.network.targetPct).length
  const mostVolatileRegion = [...data.regions].sort((a, b) => (b.region.volatilityPp ?? 0) - (a.region.volatilityPp ?? 0))[0]

  const watchlistGroups: { key: WeeklyFlag; rows: WeeklyRow[] }[] = [
    { key: 'SUSTAINED_OVER', rows: data.watchlist.sustainedOver },
    { key: 'VOLATILE', rows: data.watchlist.volatile },
    { key: 'SUSTAINED_UNDER', rows: data.watchlist.sustainedUnder },
    { key: 'FLAT', rows: data.watchlist.flat },
    { key: 'NOT_COMPUTABLE', rows: data.watchlist.notComputable },
  ]

  return (
    <div className="space-y-4">
      <PageHeader
        title="Weekly Utilization Comparison"
        description={`Week-ending utilization by region and location across ${data.weekEndings.length} weeks, with the movement between each. Movement is in percentage points.`}
        crumbs={[{ label: 'Control Tower', href: '/' }, { label: 'Weekly' }]}
        actions={
          <>
            <Segmented options={WINDOWS} value={weeks} onChange={setWeeks} ariaLabel="Comparison window" />
            <button
              type="button"
              onClick={() => exportCsv(exportRows, exportColumns, meta)}
              className="inline-flex h-7 items-center gap-1.5 rounded-md border border-hairline bg-surface px-2.5 text-[12px] font-medium text-ink-soft transition-colors hover:bg-slate-50"
            >
              <Download className="h-3 w-3" strokeWidth={2.5} aria-hidden />
              CSV
            </button>
            <button
              type="button"
              onClick={() => exportXlsx(exportRows, exportColumns, meta)}
              className="inline-flex h-7 items-center gap-1.5 rounded-md border border-hairline bg-surface px-2.5 text-[12px] font-medium text-ink-soft transition-colors hover:bg-slate-50"
            >
              <Download className="h-3 w-3" strokeWidth={2.5} aria-hidden />
              XLSX
            </button>
          </>
        }
      />

      {/* Where the network stands over the window, before the detail. */}
      <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="p-3.5">
          <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-ink-muted">
            Network · week ending {formatDate(data.weekEndings[data.weekEndings.length - 1], 'dd MMM')}
          </p>
          <div className="mt-1 flex items-end justify-between gap-3">
            <p className="tnum text-[28px] font-bold leading-none text-ink">{formatPct(net.latestPct, 2)}</p>
            <Sparkline
              values={net.cells.map((c) => c.utilizationPct ?? 0)}
              width={90}
              height={30}
              status={net.status as StatusLevel}
              label="Network utilization across the window"
            />
          </div>
          <p className="mt-2 flex items-center gap-2 text-[11px] text-ink-muted">
            <StatusChip status={net.status as StatusLevel} size="xs" />
            <span className="tnum">
              {formatPp(net.windowChangePp, 1)} across {data.weekEndings.length} weeks
            </span>
          </p>
        </Card>
        <SummaryTile
          label="Movement this week"
          value={formatPp(net.cells[net.cells.length - 1]?.changePp ?? null, 2)}
          note={`vs week ending ${formatDate(data.weekEndings[data.weekEndings.length - 2] ?? data.weekEndings[0], 'dd MMM')}`}
        />
        <SummaryTile
          label="Weeks above budget"
          value={`${weeksAboveBudget} of ${data.weekEndings.length}`}
          note={`Budget ${snapshot.network.targetPct}% · latest week ${
            net.latestPct === null
              ? 'not computable'
              : net.latestPct > snapshot.network.targetPct
                ? 'above'
                : 'below'
          } it at ${formatPct(net.latestPct, 2)}`}
        />
        <SummaryTile
          label="Least settled region"
          value={mostVolatileRegion?.region.label ?? 'N/A'}
          note={
            mostVolatileRegion
              ? `${formatPp(mostVolatileRegion.region.volatilityPp, 2)} average weekly movement`
              : 'No region in scope'
          }
        />
      </div>

      {/* Small multiples: one line per region rather than six on one axis. */}
      <Card>
        <CardHeader
          title="Region Trajectories"
          subtitle="One panel per region across the window — the shape, not just the endpoints"
          tip="Drawn as small multiples rather than six lines on one axis: six overlapping series need six colours to tell apart, and at this size the shapes are easier to compare side by side than untangled from each other."
        />
        <div className="grid gap-px bg-hairline sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          {data.regions.map(({ region }) => {
            const over = (region.latestPct ?? 0) > 100
            return (
              <button
                key={region.id}
                type="button"
                onClick={() => toggle(region.id)}
                className="bg-surface p-3 text-left transition-colors hover:bg-brand-50/50"
              >
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-[11.5px] font-bold text-ink">{region.label}</span>
                  <span className={cn('tnum text-[15px] font-bold', over ? 'text-bad' : 'text-ink')}>
                    {formatPct(region.latestPct, 1)}
                  </span>
                </div>
                <div className="mt-2">
                  <Sparkline
                    values={region.cells.map((c) => c.utilizationPct ?? 0)}
                    width={140}
                    height={34}
                    status={region.status as StatusLevel}
                    label={`${region.label} utilization across the window`}
                  />
                </div>
                <p className="tnum mt-1.5 flex items-center gap-1.5 text-[10.5px] text-ink-muted">
                  <DeltaCell value={region.windowChangePp} />
                  <span>over {data.weekEndings.length}w</span>
                </p>
              </button>
            )
          })}
        </div>
      </Card>

      <Card>
        <CardHeader
          title="Weekly Comparison"
          subtitle={`Week-ending Sundays${data.baselineWeek ? ` · first column measured against ${formatDate(data.baselineWeek, 'dd MMM')}` : ''}`}
          tip='The legacy report heads this movement column "Percent Change" but publishes a percentage-point delta — a site moving 35.4% to 36.4% is +1.0 point, not +2.6 percent. It is labelled as points here. Cells are tinted only at 90% and above, so the sheet stays readable and the pressure points stand out.'
          actions={
            <div className="flex items-center gap-2">
              <div className="flex flex-wrap items-center gap-2 text-[9.5px] text-ink-muted">
                {UTILIZATION_BANDS.map((band) => (
                  <span key={band.id} className="inline-flex items-center gap-1">
                    <span
                      className={cn(
                        'inline-block h-2.5 w-2.5 rounded-sm border',
                        band.id === 'critical'
                          ? 'border-bad-line bg-bad-soft'
                          : band.id === 'high'
                            ? 'border-hot-line bg-hot-soft'
                            : 'border-hairline bg-surface',
                      )}
                      aria-hidden
                    />
                    {band.to === null ? `${band.from}%+` : `${band.from}–${band.to}%`}
                  </span>
                ))}
              </div>
              <button
                type="button"
                onClick={() => setAll(!allOpen)}
                className="rounded-md border border-hairline bg-surface px-2 py-1 text-[11px] font-medium text-ink-soft transition-colors hover:bg-slate-50"
              >
                {allOpen ? 'Collapse all' : 'Expand all'}
              </button>
            </div>
          }
        />
        <div className="w-full min-w-0 overflow-x-auto">
          <table className="w-full border-collapse">
            <caption className="sr-only">
              Week-ending utilization and percentage-point movement by region and location
            </caption>
            <thead>
              <tr className="border-b border-hairline bg-slate-50/70">
                <th
                  scope="col"
                  className="sticky left-0 z-10 min-w-[190px] bg-slate-50 px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-wider text-ink-muted"
                >
                  Region / location
                </th>
                {data.weekEndings.map((week) => (
                  <th
                    key={week}
                    scope="col"
                    className="min-w-[92px] px-2 py-2 text-right text-[10px] font-semibold uppercase tracking-wider text-ink-muted"
                  >
                    {formatDate(week, 'dd MMM')}
                    <span className="block text-[9px] font-normal normal-case tracking-normal text-ink-faint">
                      {formatDate(week, 'EEE')}
                    </span>
                  </th>
                ))}
                <th scope="col" className="min-w-[80px] px-2 py-2 text-center text-[10px] font-semibold uppercase tracking-wider text-ink-muted">
                  Trend
                </th>
                <th scope="col" className="min-w-[76px] px-2 py-2 text-right text-[10px] font-semibold uppercase tracking-wider text-ink-muted">
                  Window
                </th>
                <th scope="col" className="min-w-[150px] px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-wider text-ink-muted">
                  Signals
                </th>
              </tr>
            </thead>
            <tbody>
              {data.regions.map(({ region, facilities }) => (
                <React.Fragment key={region.id}>
                  <WeeklyTableRow
                    row={region}
                    expanded={Boolean(expanded[region.id])}
                    onToggle={() => toggle(region.id)}
                    weekCount={data.weekEndings.length}
                  />
                  {expanded[region.id]
                    ? facilities.map((facility) => (
                        <WeeklyTableRow key={facility.id} row={facility} weekCount={data.weekEndings.length} />
                      ))
                    : null}
                </React.Fragment>
              ))}
              <WeeklyTableRow row={data.network} weekCount={data.weekEndings.length} isTotal />
            </tbody>
          </table>
        </div>
      </Card>

      <div className="grid items-start gap-3 xl:grid-cols-[1fr_1fr]">
        <Card>
          <CardHeader
            title="Movers"
            subtitle={`Largest movement across ${data.weekEndings.length} weeks`}
            tip="Ranked by movement across the whole window rather than the latest week, so a single noisy Sunday does not put a site at the top of the list."
          />
          <div className="grid gap-px bg-hairline sm:grid-cols-2">
            <MoverList title="Improving" rows={data.movers.improving} tone="up" />
            <MoverList title="Declining" rows={data.movers.declining} tone="down" />
          </div>
        </Card>

        <Card>
          <CardHeader
            title="Persistent Conditions"
            subtitle="Things the weekly view can see that a single day cannot"
            tip="A daily snapshot cannot tell a spike from a standing problem. These groups only fire on conditions that have held across the window, which is what makes them worth acting on."
          />
          <div className="divide-y divide-hairline">
            {watchlistGroups.map(({ key, rows }) => {
              const meta = FLAG_META[key]
              return (
                <div key={key} className="px-4 py-2.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusChip status={meta.status} label={meta.label} size="xs" />
                    <span className="tnum text-[11px] font-semibold text-ink">{rows.length}</span>
                    <InfoTip label={meta.label} text={meta.note} />
                  </div>
                  {rows.length === 0 ? (
                    <p className="mt-1 text-[11px] text-ink-faint">None in scope.</p>
                  ) : (
                    <ul className="mt-1.5 flex flex-wrap gap-1.5">
                      {rows.map((row) => (
                        <li key={row.id}>
                          <Link
                            href={row.facilityId ? `/warehouses/${encodeURIComponent(row.facilityId)}` : '/regions'}
                            className="tnum inline-flex items-center gap-1.5 rounded border border-hairline bg-surface px-1.5 py-1 text-[11px] font-medium text-ink transition-colors hover:border-brand-300 hover:bg-brand-50"
                          >
                            {row.label}
                            <span className="text-ink-muted">
                              <Value missing={row.latestPct === null}>{formatPct(row.latestPct, 1)}</Value>
                            </span>
                          </Link>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )
            })}
          </div>
        </Card>
      </div>

      <Card>
        <CardHeader title="How this is read" subtitle="Definitions behind the columns" />
        <dl className="grid gap-x-6 gap-y-2.5 px-4 py-3 text-[11.5px] sm:grid-cols-2 lg:grid-cols-4">
          <Definition
            term="Week ending"
            detail="Utilization on the Sunday named, taken from the same daily series the rest of the application reads. Sundays are kept as the boundary because that is what the legacy report reconciles against."
          />
          <Definition
            term="Movement (pp)"
            detail="Percentage points against the previous Sunday. The legacy report calls this Percent Change but publishes points; the two differ materially away from 100%."
          />
          <Definition
            term="Window"
            detail="Movement between the first and last week shown. Changing the window changes this figure, not the weekly movements."
          />
          <Definition
            term="Volatility"
            detail="Mean absolute week-on-week movement. High values mean the site is unsettled; values near zero mean it is static, or its feed has stopped."
          />
        </dl>
      </Card>
    </div>
  )
}

function WeeklyTableRow({
  row,
  expanded,
  onToggle,
  weekCount,
  isTotal,
}: {
  row: WeeklyRow
  expanded?: boolean
  onToggle?: () => void
  weekCount: number
  isTotal?: boolean
}) {
  const isGroup = row.kind === 'region'
  const label = (
    <span className="flex items-center gap-1.5">
      {isGroup ? (
        <ChevronRight
          className={cn('h-3.5 w-3.5 shrink-0 text-ink-muted transition-transform', expanded && 'rotate-90')}
          strokeWidth={2.5}
          aria-hidden
        />
      ) : null}
      <span className={cn(isGroup || isTotal ? 'font-bold text-ink' : 'font-semibold text-brand-600')}>{row.label}</span>
    </span>
  )

  return (
    <tr
      className={cn(
        'border-b border-hairline/60',
        isTotal ? 'border-t-2 border-t-ink-soft bg-slate-100' : isGroup ? 'bg-brand-50/45' : 'hover:bg-slate-50/60',
      )}
    >
      <th
        scope="row"
        className={cn(
          'sticky left-0 z-10 px-3 py-1.5 text-left font-normal',
          isTotal ? 'bg-slate-100' : isGroup ? 'bg-[#eef4fc]' : 'bg-surface',
        )}
      >
        {isGroup && onToggle ? (
          <button type="button" onClick={onToggle} aria-expanded={expanded} className="text-left text-[12px]">
            {label}
          </button>
        ) : row.facilityId ? (
          <Link href={`/warehouses/${encodeURIComponent(row.facilityId)}`} className="text-[12px] hover:underline">
            {label}
          </Link>
        ) : (
          <span className="text-[12px]">{label}</span>
        )}
        {row.sublabel ? (
          <span className={cn('block truncate text-[9.5px] text-ink-faint', isGroup && 'pl-5')}>{row.sublabel}</span>
        ) : null}
      </th>

      {row.cells.map((cell) => {
        const over = (cell.utilizationPct ?? 0) > 100
        return (
          <td key={cell.weekEnding} className={cn('px-2 py-1.5 text-right align-middle', cellTint(cell.status))}>
            <span
              className={cn('tnum block text-[12px] font-semibold', over ? 'text-bad' : 'text-ink')}
              title={over ? 'Over capacity' : undefined}
            >
              {over ? <span aria-label="over capacity">▲ </span> : null}
              <Value missing={cell.utilizationPct === null} reason="No capacity master row — utilization is not computable.">
                {formatPct(cell.utilizationPct, 2)}
              </Value>
            </span>
            <DeltaCell value={cell.changePp} />
          </td>
        )
      })}

      <td className="px-2 py-1.5 text-center">
        {row.cells.some((c) => c.utilizationPct !== null) ? (
          <Sparkline
            values={row.cells.map((c) => c.utilizationPct ?? 0)}
            width={Math.min(72, weekCount * 12)}
            height={20}
            status={row.status as StatusLevel}
            label={`${row.label} trend`}
          />
        ) : (
          <span className="text-[10px] text-ink-faint">—</span>
        )}
      </td>

      <td className="px-2 py-1.5 text-right">
        <span className="tnum text-[11.5px] font-semibold">
          <Value missing={row.windowChangePp === null}>{formatPp(row.windowChangePp, 1)}</Value>
        </span>
      </td>

      <td className="px-3 py-1.5">
        {row.flags.length === 0 ? (
          <span className="text-[10.5px] text-ink-faint">—</span>
        ) : (
          <span className="flex flex-wrap gap-1">
            {row.flags.map((flag) => (
              <StatusChip key={flag} status={FLAG_META[flag].status} label={FLAG_META[flag].label} size="xs" />
            ))}
          </span>
        )}
      </td>
    </tr>
  )
}

function SummaryTile({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <Card className="p-3.5">
      <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-ink-muted">{label}</p>
      <p className="tnum mt-1 text-[24px] font-bold leading-none text-ink">{value}</p>
      <p className="mt-1.5 text-[10.5px] leading-snug text-ink-muted">{note}</p>
    </Card>
  )
}

function MoverList({ title, rows, tone }: { title: string; rows: WeeklyRow[]; tone: 'up' | 'down' }) {
  return (
    <div className="bg-surface px-4 py-3">
      <SectionTitle className="mb-2 flex items-center gap-1.5">
        {tone === 'up' ? (
          <TrendingUp className="h-3 w-3 text-ok" strokeWidth={2.5} aria-hidden />
        ) : (
          <TrendingDown className="h-3 w-3 text-bad" strokeWidth={2.5} aria-hidden />
        )}
        {title}
      </SectionTitle>
      {rows.length === 0 ? (
        <p className="text-[11px] text-ink-faint">None in scope.</p>
      ) : (
        <ul className="space-y-1.5">
          {rows.map((row) => (
            <li key={row.id}>
              <Link
                href={row.facilityId ? `/warehouses/${encodeURIComponent(row.facilityId)}` : '/regions'}
                className="flex items-center gap-2 rounded px-1 py-0.5 transition-colors hover:bg-slate-50"
              >
                <span className="w-24 shrink-0 text-[11.5px] font-semibold text-brand-600">{row.label}</span>
                <span className="min-w-0 flex-1 truncate text-[10.5px] text-ink-muted">{row.regionId}</span>
                <Sparkline
                  values={row.cells.map((c) => c.utilizationPct ?? 0)}
                  width={54}
                  height={18}
                  status={row.status as StatusLevel}
                  label={`${row.label} trend`}
                />
                <span className="tnum w-14 shrink-0 text-right text-[11.5px] font-semibold text-ink">
                  {formatPct(row.latestPct, 1)}
                </span>
                <span className="w-14 shrink-0 text-right">
                  <DeltaCell value={row.windowChangePp} />
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function Definition({ term, detail }: { term: string; detail: string }) {
  return (
    <div>
      <dt className="text-[10px] font-semibold uppercase tracking-wider text-ink-faint">{term}</dt>
      <dd className="mt-0.5 leading-relaxed text-ink-muted">{detail}</dd>
    </div>
  )
}
