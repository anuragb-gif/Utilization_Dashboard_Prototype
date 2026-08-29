'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
} from 'react'
import type {
  ComparisonPeriod,
  ExecutionId,
  FacilityType,
  FilterState,
  OwnershipModel,
  RegionId,
  TemperatureZoneId,
} from '@/lib/domain/types'
import { REPORT_CONTEXT } from '@/lib/repository'

export const DEFAULT_FILTERS: FilterState = {
  date: REPORT_CONTEXT.reportDate,
  regionIds: [],
  facilityIds: [],
  zoneIds: [],
  customerIds: [],
  facilityTypes: [],
  ownerships: [],
  executions: [],
  comparison: 'PREV_DAY',
}

type ArrayFilterKey = 'regionIds' | 'facilityIds' | 'zoneIds' | 'customerIds' | 'facilityTypes' | 'ownerships' | 'executions'

interface FilterContextValue {
  filters: FilterState
  setFilters: (next: Partial<FilterState>) => void
  toggle: (key: ArrayFilterKey, value: string) => void
  clear: (key: ArrayFilterKey) => void
  reset: () => void
  activeCount: number
}

const FilterContext = createContext<FilterContextValue | null>(null)

/** Query-string keys, kept short so shared links stay readable. */
const URL_KEYS: Record<ArrayFilterKey, string> = {
  regionIds: 'r',
  facilityIds: 'w',
  zoneIds: 'z',
  customerIds: 'c',
  facilityTypes: 't',
  ownerships: 'o',
  executions: 'e',
}

function readFromSearch(search: string): Partial<FilterState> {
  const params = new URLSearchParams(search)
  const next: Partial<FilterState> = {}
  const date = params.get('d')
  if (date && /^\d{4}-\d{2}-\d{2}$/.test(date)) next.date = date
  const comparison = params.get('cmp') as ComparisonPeriod | null
  if (comparison) next.comparison = comparison
  for (const [key, param] of Object.entries(URL_KEYS) as [ArrayFilterKey, string][]) {
    const raw = params.get(param)
    if (!raw) continue
    const values = raw.split(',').filter(Boolean)
    if (values.length === 0) continue
    // Casts are safe: unknown ids simply match no facility and the screens
    // render an empty-state rather than throwing.
    ;(next as Record<string, unknown>)[key] = values
  }
  return next
}

function writeToSearch(filters: FilterState): string {
  const params = new URLSearchParams()
  if (filters.date !== DEFAULT_FILTERS.date) params.set('d', filters.date)
  if (filters.comparison !== DEFAULT_FILTERS.comparison) params.set('cmp', filters.comparison)
  for (const [key, param] of Object.entries(URL_KEYS) as [ArrayFilterKey, string][]) {
    const values = filters[key]
    if (values.length > 0) params.set(param, values.join(','))
  }
  const qs = params.toString()
  return qs ? `?${qs}` : ''
}

/** Browser history is an external store; subscribe to back/forward navigation. */
function subscribeToHistory(onChange: () => void) {
  window.addEventListener('popstate', onChange)
  return () => window.removeEventListener('popstate', onChange)
}

const getSearchSnapshot = () => window.location.search
/**
 * The server has no URL to read, so it renders the defaults. React uses this
 * snapshot for the hydration render too and only then applies the client
 * value, which is what keeps a deep link from causing a hydration mismatch.
 */
const getServerSearchSnapshot = () => ''

export function FilterProvider({ children }: { children: React.ReactNode }) {
  const search = useSyncExternalStore(subscribeToHistory, getSearchSnapshot, getServerSearchSnapshot)

  /**
   * Filters come from the URL until the user changes one; after that the
   * in-memory selection is authoritative, so a selection survives navigating
   * into a region or facility and back out again.
   */
  const [edited, setEdited] = useState<FilterState | null>(null)

  const filters = useMemo<FilterState>(
    () => edited ?? { ...DEFAULT_FILTERS, ...readFromSearch(search) },
    [edited, search],
  )

  // Mirror the selection back into the URL without pushing history entries, so
  // a filtered view can be copied out of the address bar and shared.
  useEffect(() => {
    if (!edited) return
    const next = `${window.location.pathname}${writeToSearch(edited)}`
    if (next !== `${window.location.pathname}${window.location.search}`) {
      window.history.replaceState(null, '', next)
    }
  }, [edited])

  const update = useCallback((project: (previous: FilterState) => FilterState) => {
    setEdited((previous) =>
      project(previous ?? { ...DEFAULT_FILTERS, ...readFromSearch(window.location.search) }),
    )
  }, [])

  const setFilters = useCallback(
    (next: Partial<FilterState>) => update((prev) => ({ ...prev, ...next })),
    [update],
  )

  const toggle = useCallback(
    (key: ArrayFilterKey, value: string) =>
      update((prev) => {
        const current = prev[key] as string[]
        const next = current.includes(value) ? current.filter((v) => v !== value) : [...current, value]
        return { ...prev, [key]: next }
      }),
    [update],
  )

  const clear = useCallback((key: ArrayFilterKey) => update((prev) => ({ ...prev, [key]: [] })), [update])

  const reset = useCallback(() => setEdited(DEFAULT_FILTERS), [])

  const activeCount = useMemo(
    () =>
      (Object.keys(URL_KEYS) as ArrayFilterKey[]).reduce((sum, key) => sum + filters[key].length, 0) +
      (filters.date !== DEFAULT_FILTERS.date ? 1 : 0),
    [filters],
  )

  const value = useMemo(
    () => ({ filters, setFilters, toggle, clear, reset, activeCount }),
    [filters, setFilters, toggle, clear, reset, activeCount],
  )

  return <FilterContext.Provider value={value}>{children}</FilterContext.Provider>
}

export function useFilters(): FilterContextValue {
  const ctx = useContext(FilterContext)
  if (!ctx) throw new Error('useFilters must be used inside <FilterProvider>')
  return ctx
}

/**
 * Filters scoped to a single region or facility, used by the detail pages so
 * a drilldown inherits the control tower's filter state without mutating it.
 */
export function scopedFilters(
  base: FilterState,
  scope: { regionId?: RegionId; facilityId?: string; zoneId?: TemperatureZoneId },
): FilterState {
  return {
    ...base,
    regionIds: scope.regionId ? [scope.regionId] : base.regionIds,
    facilityIds: scope.facilityId ? [scope.facilityId] : base.facilityIds,
    zoneIds: scope.zoneId ? [scope.zoneId] : base.zoneIds,
  }
}

export type { ArrayFilterKey, ExecutionId, FacilityType, OwnershipModel }
