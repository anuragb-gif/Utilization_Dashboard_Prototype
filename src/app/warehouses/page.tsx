'use client'

import * as React from 'react'
import type { FacilityRollup } from '@/lib/domain/types'
import { PageHeader } from '@/components/layout/page-header'
import { FacilityExceptionBoard } from '@/components/control-tower/facility-board'
import { FacilityDrawer } from '@/components/drawers/facility-drawer'
import { LocationUtilizationTable } from '@/components/panels/location-table'
import { Card, CardHeader, DemoDataBadge } from '@/components/ui/primitives'
import { useFilters } from '@/lib/state/filter-context'
import { useSnapshot } from '@/lib/state/use-snapshot'
import { formatNumber, formatPct } from '@/lib/utils'
import { FACILITY_TYPE_LABEL, OWNERSHIP_LABEL } from '@/lib/data/master'

export default function WarehousesPage() {
  const snapshot = useSnapshot()
  const { filters } = useFilters()
  const [facility, setFacility] = React.useState<FacilityRollup | null>(null)

  const byType = React.useMemo(() => {
    const map = new Map<string, { count: number; capacity: number; occupied: number }>()
    for (const f of snapshot.facilities) {
      const entry = map.get(f.type) ?? { count: 0, capacity: 0, occupied: 0 }
      entry.count += 1
      entry.capacity += f.capacity ?? 0
      entry.occupied += f.utilizedPallets
      map.set(f.type, entry)
    }
    return [...map.entries()]
  }, [snapshot.facilities])

  const byOwnership = React.useMemo(() => {
    const map = new Map<string, { count: number; capacity: number; occupied: number }>()
    for (const f of snapshot.facilities) {
      const entry = map.get(f.ownership) ?? { count: 0, capacity: 0, occupied: 0 }
      entry.count += 1
      entry.capacity += f.capacity ?? 0
      entry.occupied += f.utilizedPallets
      map.set(f.ownership, entry)
    }
    return [...map.entries()]
  }, [snapshot.facilities])

  return (
    <div className="space-y-4">
      <PageHeader
        title="Warehouses"
        description="Every facility in scope with its capacity, occupancy and the reason it needs attention. Click any row for the facility detail."
        crumbs={[{ label: 'Control Tower', href: '/' }, { label: 'Warehouses' }]}
        actions={<DemoDataBadge text="Demo data" />}
      />

      <div className="grid gap-3 lg:grid-cols-2">
        <Card>
          <CardHeader title="By Facility Type" subtitle="Capacity and occupancy split by the role a site plays" />
          <table className="w-full border-collapse">
            <caption className="sr-only">Capacity and occupancy by facility type</caption>
            <thead>
              <tr className="border-b border-hairline bg-slate-50/70 text-[10px] uppercase tracking-wider text-ink-muted">
                <th scope="col" className="px-3 py-1.5 text-left font-semibold">Type</th>
                <th scope="col" className="px-3 py-1.5 text-right font-semibold">Sites</th>
                <th scope="col" className="px-3 py-1.5 text-right font-semibold">Capacity</th>
                <th scope="col" className="px-3 py-1.5 text-right font-semibold">Occupied</th>
                <th scope="col" className="px-3 py-1.5 text-right font-semibold">Utilization</th>
              </tr>
            </thead>
            <tbody>
              {byType.map(([type, entry]) => (
                <tr key={type} className="border-b border-hairline/70 last:border-0">
                  <td className="px-3 py-1.5 text-[11.5px] font-medium text-ink">
                    {FACILITY_TYPE_LABEL[type as keyof typeof FACILITY_TYPE_LABEL]}
                  </td>
                  <td className="tnum px-3 py-1.5 text-right text-[11.5px]">{entry.count}</td>
                  <td className="tnum px-3 py-1.5 text-right text-[11.5px]">{formatNumber(entry.capacity)}</td>
                  <td className="tnum px-3 py-1.5 text-right text-[11.5px]">{formatNumber(entry.occupied)}</td>
                  <td className="tnum px-3 py-1.5 text-right text-[11.5px] font-semibold">
                    {formatPct(entry.capacity === 0 ? null : (entry.occupied / entry.capacity) * 100, 1)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>

        <Card>
          <CardHeader title="By Ownership Model" subtitle="Owned, leased and customer-dedicated capacity" />
          <table className="w-full border-collapse">
            <caption className="sr-only">Capacity and occupancy by ownership model</caption>
            <thead>
              <tr className="border-b border-hairline bg-slate-50/70 text-[10px] uppercase tracking-wider text-ink-muted">
                <th scope="col" className="px-3 py-1.5 text-left font-semibold">Ownership</th>
                <th scope="col" className="px-3 py-1.5 text-right font-semibold">Sites</th>
                <th scope="col" className="px-3 py-1.5 text-right font-semibold">Capacity</th>
                <th scope="col" className="px-3 py-1.5 text-right font-semibold">Occupied</th>
                <th scope="col" className="px-3 py-1.5 text-right font-semibold">Utilization</th>
              </tr>
            </thead>
            <tbody>
              {byOwnership.map(([ownership, entry]) => (
                <tr key={ownership} className="border-b border-hairline/70 last:border-0">
                  <td className="px-3 py-1.5 text-[11.5px] font-medium text-ink">
                    {OWNERSHIP_LABEL[ownership as keyof typeof OWNERSHIP_LABEL]}
                  </td>
                  <td className="tnum px-3 py-1.5 text-right text-[11.5px]">{entry.count}</td>
                  <td className="tnum px-3 py-1.5 text-right text-[11.5px]">{formatNumber(entry.capacity)}</td>
                  <td className="tnum px-3 py-1.5 text-right text-[11.5px]">{formatNumber(entry.occupied)}</td>
                  <td className="tnum px-3 py-1.5 text-right text-[11.5px] font-semibold">
                    {formatPct(entry.capacity === 0 ? null : (entry.occupied / entry.capacity) * 100, 1)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </div>

      <FacilityExceptionBoard
        facilities={snapshot.facilities}
        reportDate={snapshot.network.reportDate}
        onSelect={setFacility}
        title="Warehouse Ranking"
        defaultScope="all"
      />

      <LocationUtilizationTable filters={filters} pageSize={15} />

      <FacilityDrawer facility={facility} onClose={() => setFacility(null)} />
    </div>
  )
}
