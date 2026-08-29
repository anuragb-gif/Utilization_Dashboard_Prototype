import type { RegionId } from '@/lib/domain/types'

/**
 * Role-based access control - placeholder.
 *
 * No authentication is wired up in the prototype. What is wired up is the
 * SHAPE of it: roles, the data scope each role can see, and the actions each
 * can take. The role switcher in the sidebar drives real behaviour (regional
 * roles are scoped to their regions, read-only roles cannot acknowledge or
 * assign exceptions) so the access model can be reviewed before it is built.
 */

export type RoleId =
  | 'LT_EXECUTIVE'
  | 'NATIONAL_OPS'
  | 'REGIONAL_HEAD'
  | 'WAREHOUSE_MANAGER'
  | 'ANALYST'
  | 'IT_DATA_ADMIN'

export type Permission =
  | 'view:network'
  | 'view:financials'
  | 'action:acknowledge'
  | 'action:assign'
  | 'action:export'
  | 'admin:thresholds'
  | 'admin:data'

export interface Role {
  id: RoleId
  name: string
  description: string
  /** null = the whole network. */
  regionScope: RegionId[] | null
  /** null = every facility inside the region scope. */
  facilityScope: string[] | null
  permissions: Permission[]
}

export const ROLES: Role[] = [
  {
    id: 'LT_EXECUTIVE',
    name: 'LT / Executive',
    description: 'Leadership team. Whole-network read access including commercial figures.',
    regionScope: null,
    facilityScope: null,
    permissions: ['view:network', 'view:financials', 'action:export'],
  },
  {
    id: 'NATIONAL_OPS',
    name: 'National Operations',
    description: 'Owns the network position. Can acknowledge and assign every exception.',
    regionScope: null,
    facilityScope: null,
    permissions: ['view:network', 'view:financials', 'action:acknowledge', 'action:assign', 'action:export'],
  },
  {
    id: 'REGIONAL_HEAD',
    name: 'Regional Head (West)',
    description: 'Scoped to WEST-1 and WEST-2. Network totals are shown as context only.',
    regionScope: ['WEST-1', 'WEST-2'],
    facilityScope: null,
    permissions: ['view:network', 'action:acknowledge', 'action:assign', 'action:export'],
  },
  {
    id: 'WAREHOUSE_MANAGER',
    name: 'Warehouse Manager (Indore)',
    description: 'Scoped to the facilities they run. Cannot see other facilities in the region.',
    regionScope: ['WEST-2'],
    facilityScope: ['SNL-IDR-01', 'SNL-IDR-02'],
    permissions: ['view:network', 'action:acknowledge', 'action:export'],
  },
  {
    id: 'ANALYST',
    name: 'Analyst',
    description: 'Read and export across the network. Cannot action exceptions.',
    regionScope: null,
    facilityScope: null,
    permissions: ['view:network', 'view:financials', 'action:export'],
  },
  {
    id: 'IT_DATA_ADMIN',
    name: 'IT / Data Admin',
    description: 'Owns the pipeline, the capacity master and the threshold configuration.',
    regionScope: null,
    facilityScope: null,
    permissions: ['view:network', 'action:export', 'admin:thresholds', 'admin:data'],
  },
]

export const ROLE_BY_ID: Record<RoleId, Role> = Object.fromEntries(ROLES.map((r) => [r.id, r])) as Record<RoleId, Role>

/**
 * National Operations owns the network position day to day and is the role
 * the control tower is primarily built for, so it is the default. Switching to
 * LT / Executive or Analyst demonstrates the read-only scope, and to Regional
 * Head or Warehouse Manager the region and facility scoping.
 */
export const DEFAULT_ROLE: RoleId = 'NATIONAL_OPS'

export function can(role: Role, permission: Permission): boolean {
  return role.permissions.includes(permission)
}

/**
 * Audit log - placeholder.
 *
 * Every action a user takes in the prototype is appended here so the audit
 * requirement is visible in the design rather than deferred. In production
 * this is an append-only table behind the API, not client state.
 */
export interface AuditEntry {
  id: string
  at: string
  actor: string
  action: string
  target: string
}
