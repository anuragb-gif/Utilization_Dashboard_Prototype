/**
 * Repository entry point.
 *
 * Swap the implementation here - an HTTP client hitting the semantic KPI API,
 * a server action, a React Query cache - and no screen changes.
 */

import { mockDataSource, REPORT_CONTEXT } from './mock'
import type { DataSource } from './types'

export const dataSource: DataSource = mockDataSource

export * from './types'
export { REPORT_CONTEXT }
