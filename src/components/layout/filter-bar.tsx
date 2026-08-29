'use client'

import * as React from 'react'
import { CalendarDays, RotateCcw, SlidersHorizontal } from 'lucide-react'
import { MultiSelect, type Option } from '@/components/ui/multi-select'
import { Button } from '@/components/ui/primitives'
import { useFilters } from '@/lib/state/filter-context'
import { useSession } from '@/lib/state/session-context'
import { dataSource, REPORT_CONTEXT } from '@/lib/repository'
import {
  EXECUTION_LABEL,
  FACILITY_TYPE_LABEL,
  OWNERSHIP_LABEL,
  REGION_ORDER,
  TEMPERATURE_ZONES,
} from '@/lib/data/master'
import type { ComparisonPeriod } from '@/lib/domain/types'
import { formatNumber } from '@/lib/utils'
import { useNetworkSnapshot } from '@/lib/state/use-snapshot'

const COMPARISON_OPTIONS: { value: ComparisonPeriod; label: string }[] = [
  { value: 'PREV_DAY', label: 'vs previous day' },
  { value: 'PREV_WEEK', label: 'vs previous week' },
  { value: 'PREV_MONTH', label: 'vs 30 days ago' },
  { value: 'SAME_PERIOD_LAST_YEAR', label: 'vs same period last year' },
  { value: 'BUDGET', label: 'vs budget' },
]

/**
 * Compact filter bar.
 *
 * Filter state lives in one context and every screen reads from it, so a
 * selection made on the control tower survives a drilldown and a back
 * navigation. Options a role cannot see are not offered.
 */
export function FilterBar() {
  const { filters, setFilters, toggle, clear, reset, activeCount } = useFilters()
  const { role } = useSession()
  const snapshot = useNetworkSnapshot()

  const facilities = React.useMemo(() => dataSource.listFacilities(), [])

  const regionOptions: Option[] = React.useMemo(
    () =>
      REGION_ORDER.filter((id) => !role.regionScope || role.regionScope.includes(id)).map((id) => {
        const region = snapshot.regions.find((r) => r.regionId === id)
        return {
          value: id,
          label: id,
          hint: region?.utilizationPct === null || region === undefined ? 'N/A' : `${region.utilizationPct.toFixed(1)}%`,
        }
      }),
    [role.regionScope, snapshot.regions],
  )

  const facilityOptions: Option[] = React.useMemo(
    () =>
      facilities
        .filter((f) => (!role.regionScope || role.regionScope.includes(f.regionId)) && (!role.facilityScope || role.facilityScope.includes(f.id)))
        .map((f) => ({
          value: f.id,
          label: `${f.code} · ${f.name}`,
          group: f.regionId,
          hint: f.capacity === null ? 'no capacity' : formatNumber(f.capacity),
        })),
    [facilities, role.regionScope, role.facilityScope],
  )

  const customerOptions: Option[] = React.useMemo(
    () => snapshot.customers.map((c) => ({ value: c.id, label: c.name, hint: formatNumber(c.occupiedPallets) })),
    [snapshot.customers],
  )

  return (
    <div className="no-print sticky top-[53px] z-20 border-b border-hairline bg-slate-50/95 backdrop-blur">
      <div className="flex flex-wrap items-center gap-1.5 px-4 py-2">
        <span className="mr-0.5 inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-faint">
          <SlidersHorizontal className="h-3 w-3" strokeWidth={2.5} aria-hidden />
          Filters
        </span>

        <label className="inline-flex h-7 items-center gap-1.5 rounded-md border border-hairline bg-surface px-2 text-[12px] text-ink-soft">
          <CalendarDays className="h-3.5 w-3.5 text-ink-faint" strokeWidth={2} aria-hidden />
          <span className="sr-only">Report date</span>
          <input
            type="date"
            value={filters.date}
            max={REPORT_CONTEXT.reportDate}
            min={REPORT_CONTEXT.historyDates[0]}
            onChange={(e) => setFilters({ date: e.target.value })}
            className="tnum bg-transparent text-[12px] outline-none"
            aria-label="Report date"
          />
        </label>

        <MultiSelect
          label="Region"
          options={regionOptions}
          selected={filters.regionIds}
          onToggle={(v) => toggle('regionIds', v)}
          onClear={() => clear('regionIds')}
          widthClass="w-52"
        />
        <MultiSelect
          label="Warehouse"
          options={facilityOptions}
          selected={filters.facilityIds}
          onToggle={(v) => toggle('facilityIds', v)}
          onClear={() => clear('facilityIds')}
          searchable
          widthClass="w-80"
        />
        <MultiSelect
          label="Temperature zone"
          options={TEMPERATURE_ZONES.map((z) => ({ value: z.id, label: z.name, hint: z.setPoint }))}
          selected={filters.zoneIds}
          onToggle={(v) => toggle('zoneIds', v)}
          onClear={() => clear('zoneIds')}
          widthClass="w-72"
        />
        <MultiSelect
          label="Depositor"
          options={customerOptions}
          selected={filters.customerIds}
          onToggle={(v) => toggle('customerIds', v)}
          onClear={() => clear('customerIds')}
          searchable
          widthClass="w-80"
        />
        <MultiSelect
          label="Facility type"
          options={Object.entries(FACILITY_TYPE_LABEL)
            .filter(([value]) => value !== 'PARK_AND_PAY')
            .map(([value, label]) => ({ value, label }))}
          selected={filters.facilityTypes}
          onToggle={(v) => toggle('facilityTypes', v)}
          onClear={() => clear('facilityTypes')}
          widthClass="w-64"
        />
        <MultiSelect
          label="Ownership"
          options={Object.entries(OWNERSHIP_LABEL).map(([value, label]) => ({ value, label }))}
          selected={filters.ownerships}
          onToggle={(v) => toggle('ownerships', v)}
          onClear={() => clear('ownerships')}
          widthClass="w-48"
        />
        <MultiSelect
          label="Execution"
          options={Object.entries(EXECUTION_LABEL).map(([value, label]) => ({ value, label }))}
          selected={filters.executions}
          onToggle={(v) => toggle('executions', v)}
          onClear={() => clear('executions')}
          widthClass="w-56"
          align="right"
        />

        <label className="inline-flex h-7 items-center rounded-md border border-hairline bg-surface px-2 text-[12px] text-ink-soft">
          <span className="sr-only">Comparison period</span>
          <select
            value={filters.comparison}
            onChange={(e) => setFilters({ comparison: e.target.value as ComparisonPeriod })}
            className="bg-transparent text-[12px] outline-none"
            aria-label="Comparison period"
          >
            {COMPARISON_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>

        {activeCount > 0 ? (
          <Button variant="ghost" onClick={reset} className="ml-auto">
            <RotateCcw className="h-3 w-3" strokeWidth={2.5} aria-hidden />
            Reset ({activeCount})
          </Button>
        ) : null}
      </div>

      {role.regionScope ? (
        <p className="border-t border-hairline bg-brand-50 px-4 py-1 text-[11px] text-brand-700">
          Access scope: {role.name} — results limited to {role.regionScope.join(', ')}
          {role.facilityScope ? ` and ${role.facilityScope.length} facilities` : ''}.
        </p>
      ) : null}
    </div>
  )
}
