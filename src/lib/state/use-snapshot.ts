'use client'

import { useMemo } from 'react'
import type { FilterState, RegionId } from '@/lib/domain/types'
import type { Role } from '@/lib/config/roles'
import { dataSource, type ControlTowerSnapshot } from '@/lib/repository'
import { useFilters } from './filter-context'
import { useSession } from './session-context'

/**
 * Narrow the user's filter selection to what their role is allowed to see.
 *
 * Access control is applied to the query, not to the rendering - a regional
 * head does not receive national rows and then have them hidden. The mock
 * data source stands in for the API that would enforce this server-side.
 */
export function applyRoleScope(filters: FilterState, role: Role): FilterState {
  let regionIds = filters.regionIds
  if (role.regionScope) {
    regionIds =
      filters.regionIds.length === 0
        ? role.regionScope
        : filters.regionIds.filter((id) => role.regionScope!.includes(id as RegionId))
    // An empty intersection means the user asked for a region they cannot
    // see. Fall back to their own scope rather than silently showing nothing.
    if (regionIds.length === 0) regionIds = role.regionScope
  }

  let facilityIds = filters.facilityIds
  if (role.facilityScope) {
    facilityIds =
      filters.facilityIds.length === 0
        ? role.facilityScope
        : filters.facilityIds.filter((id) => role.facilityScope!.includes(id))
    if (facilityIds.length === 0) facilityIds = role.facilityScope
  }

  return { ...filters, regionIds, facilityIds }
}

/** The single hook every screen uses to read data. */
export function useSnapshot(overrides?: Partial<FilterState>): ControlTowerSnapshot {
  const { filters } = useFilters()
  const { role } = useSession()

  return useMemo(() => {
    const merged = overrides ? { ...filters, ...overrides } : filters
    return dataSource.getSnapshot(applyRoleScope(merged, role))
  }, [filters, role, overrides])
}

/** Snapshot for the whole network, ignoring the filter bar but not the role. */
export function useNetworkSnapshot(): ControlTowerSnapshot {
  const { filters } = useFilters()
  const { role } = useSession()
  return useMemo(
    () =>
      dataSource.getSnapshot(
        applyRoleScope(
          {
            ...filters,
            regionIds: [],
            facilityIds: [],
            zoneIds: [],
            facilityTypes: [],
            ownerships: [],
            executions: [],
          },
          role,
        ),
      ),
    [filters, role],
  )
}
