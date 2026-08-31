'use client'

import * as React from 'react'
import { usePathname } from 'next/navigation'
import { Sidebar } from './sidebar'
import { TopBar } from './top-bar'
import { FilterBar } from './filter-bar'
import { SessionProvider } from '@/lib/state/session-context'

/** Routes that render as documents rather than as application screens. */
const BARE_ROUTES = ['/reports/print']

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const [collapsed, setCollapsed] = React.useState(false)
  const bare = BARE_ROUTES.some((route) => pathname.startsWith(route))

  return (
    <SessionProvider>
      <a href="#main" className="skip-link">
        Skip to main content
      </a>
      {bare ? (
        <main id="main">{children}</main>
      ) : (
        <div className="flex min-h-screen">
          <div className="sticky top-0 h-screen">
            <Sidebar collapsed={collapsed} />
          </div>
          <div className="flex min-w-0 flex-1 flex-col">
            <TopBar collapsed={collapsed} onToggleSidebar={() => setCollapsed((v) => !v)} />
            <FilterBar />
            <main id="main" className="flex-1 px-4 py-4">
              {children}
            </main>
            <footer className="no-print border-t border-hairline px-4 py-3 text-[10.5px] leading-relaxed text-ink-faint">
              Snowman Logistics — Pan-India Utilization Control Tower · Design prototype built on deterministic
              demonstration data. Figures reproduce the legacy daily report snapshot and are not live operational data.
            </footer>
          </div>
        </div>
      )}
    </SessionProvider>
  )
}
