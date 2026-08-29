'use client'

import * as React from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ChevronRight, Snowflake } from 'lucide-react'
import { NAV_ITEMS } from '@/lib/config/nav'
import { ROLES } from '@/lib/config/roles'
import { useSession } from '@/lib/state/session-context'
import { useNetworkSnapshot } from '@/lib/state/use-snapshot'
import { cn } from '@/lib/utils'

export function Sidebar({ collapsed }: { collapsed: boolean }) {
  const pathname = usePathname()
  const { role, setRole } = useSession()
  const snapshot = useNetworkSnapshot()

  const badges: Record<string, number> = {
    exceptions: snapshot.exceptions.filter((e) => e.severity === 'critical' || e.severity === 'high').length,
    dataQuality: snapshot.dataQuality.issues.filter((i) => i.severity !== 'low').length,
  }

  return (
    <aside
      className={cn(
        'no-print flex h-screen shrink-0 flex-col border-r border-brand-950/40 bg-brand-950 text-slate-300 transition-[width] duration-200',
        collapsed ? 'w-[58px]' : 'w-[212px]',
      )}
    >
      <div className={cn('flex items-center gap-2.5 border-b border-white/[0.08] px-4 py-3.5', collapsed && 'justify-center px-0')}>
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded bg-brand-500 text-white">
          <Snowflake className="h-4 w-4" strokeWidth={2.5} aria-hidden />
        </span>
        {!collapsed ? (
          <div className="min-w-0">
            <p className="truncate text-[12.5px] font-bold leading-none tracking-tight text-white">Snowman</p>
            <p className="mt-1 truncate text-[9.5px] font-medium uppercase tracking-[0.16em] text-brand-300">
              Control Tower
            </p>
          </div>
        ) : null}
      </div>

      <nav aria-label="Primary" className="flex-1 overflow-y-auto px-2 py-2">
        <ul className="space-y-0.5">
          {NAV_ITEMS.map((item) => {
            const active = item.href === '/' ? pathname === '/' : pathname.startsWith(item.href)
            const Icon = item.icon
            const badge = item.badge ? badges[item.badge] : 0
            return (
              <li key={item.id}>
                <Link
                  href={item.href}
                  aria-current={active ? 'page' : undefined}
                  title={collapsed ? item.label : undefined}
                  className={cn(
                    'group relative flex items-center gap-2.5 rounded-md px-2.5 py-2 text-[12.5px] font-medium transition-colors',
                    collapsed && 'justify-center px-0',
                    active
                      ? 'bg-brand-500/15 text-white'
                      : 'text-slate-400 hover:bg-white/[0.06] hover:text-slate-100',
                  )}
                >
                  {active ? (
                    <span className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r bg-brand-400" aria-hidden />
                  ) : null}
                  <Icon
                    className={cn('h-[15px] w-[15px] shrink-0', active ? 'text-brand-300' : 'text-slate-500 group-hover:text-slate-300')}
                    strokeWidth={1.9}
                    aria-hidden
                  />
                  {!collapsed ? (
                    <>
                      <span className="flex-1 truncate">{item.label}</span>
                      {badge > 0 ? (
                        <span className="tnum rounded bg-bad px-1 text-[9.5px] font-bold leading-4 text-white">
                          {badge}
                        </span>
                      ) : null}
                      {active ? <ChevronRight className="h-3 w-3 text-brand-400/70" strokeWidth={2.5} aria-hidden /> : null}
                    </>
                  ) : null}
                </Link>
              </li>
            )
          })}
        </ul>
      </nav>

      <div className={cn('border-t border-white/[0.08] px-3 py-3', collapsed && 'px-2')}>
        {!collapsed ? (
          <>
            <label
              htmlFor="role-switcher"
              className="mb-1 block text-[9.5px] font-semibold uppercase tracking-[0.14em] text-slate-500"
            >
              Signed in as
            </label>
            <select
              id="role-switcher"
              value={role.id}
              onChange={(e) => setRole(e.target.value as typeof role.id)}
              className="w-full rounded border border-white/10 bg-white/[0.06] px-2 py-1.5 text-[11.5px] font-medium text-slate-100 outline-none transition-colors hover:bg-white/[0.1] focus-visible:border-brand-400"
            >
              {ROLES.map((r) => (
                <option key={r.id} value={r.id} className="bg-brand-950 text-slate-100">
                  {r.name}
                </option>
              ))}
            </select>
            <p className="mt-1.5 text-[10px] leading-relaxed text-slate-500">
              {role.regionScope ? `Scoped to ${role.regionScope.join(', ')}` : 'Full network access'}
              {role.facilityScope ? ` · ${role.facilityScope.length} facilities` : ''}
            </p>
          </>
        ) : (
          <p className="text-center text-[9px] font-semibold uppercase text-slate-600" title={role.name}>
            {role.name.slice(0, 2)}
          </p>
        )}
      </div>
    </aside>
  )
}
