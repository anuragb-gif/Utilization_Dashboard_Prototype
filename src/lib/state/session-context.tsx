'use client'

import * as React from 'react'
import { DEFAULT_ROLE, ROLE_BY_ID, type AuditEntry, type Permission, type Role, type RoleId } from '@/lib/config/roles'
import type { ExceptionStatus } from '@/lib/domain/types'
import { REPORT_CONTEXT } from '@/lib/repository'

interface SessionValue {
  role: Role
  setRole: (id: RoleId) => void
  can: (permission: Permission) => boolean
  /** Exception workflow state, kept in session so the demo flow is real. */
  exceptionStatus: Record<string, ExceptionStatus>
  setExceptionStatus: (id: string, status: ExceptionStatus, label: string) => void
  audit: AuditEntry[]
  log: (action: string, target: string) => void
}

const SessionContext = React.createContext<SessionValue | null>(null)

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [roleId, setRoleId] = React.useState<RoleId>(DEFAULT_ROLE)
  const [exceptionStatus, setStatuses] = React.useState<Record<string, ExceptionStatus>>({})
  const [audit, setAudit] = React.useState<AuditEntry[]>([])
  const counter = React.useRef(0)

  const role = ROLE_BY_ID[roleId]

  const log = React.useCallback(
    (action: string, target: string) => {
      counter.current += 1
      setAudit((prev) => [
        {
          id: `audit-${counter.current}`,
          // The dataset is anchored to a fixed report date, so audit entries
          // are stamped against it rather than the viewer's clock.
          at: `${REPORT_CONTEXT.reportDate}T09:${String(counter.current % 60).padStart(2, '0')}:00+05:30`,
          actor: ROLE_BY_ID[roleId].name,
          action,
          target,
        },
        ...prev,
      ])
    },
    [roleId],
  )

  const setExceptionStatus = React.useCallback(
    (id: string, status: ExceptionStatus, label: string) => {
      setStatuses((prev) => ({ ...prev, [id]: status }))
      log(status === 'ACKNOWLEDGED' ? 'Acknowledged exception' : 'Assigned exception', label)
    },
    [log],
  )

  const value = React.useMemo<SessionValue>(
    () => ({
      role,
      setRole: setRoleId,
      can: (permission) => role.permissions.includes(permission),
      exceptionStatus,
      setExceptionStatus,
      audit,
      log,
    }),
    [role, exceptionStatus, setExceptionStatus, audit, log],
  )

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
}

export function useSession(): SessionValue {
  const ctx = React.useContext(SessionContext)
  if (!ctx) throw new Error('useSession must be used inside <SessionProvider>')
  return ctx
}
