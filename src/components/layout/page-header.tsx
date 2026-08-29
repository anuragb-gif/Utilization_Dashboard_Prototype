'use client'

import * as React from 'react'
import Link from 'next/link'
import { ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface Crumb {
  label: string
  href?: string
}

export function PageHeader({
  title,
  description,
  crumbs,
  actions,
  className,
}: {
  title: string
  description?: string
  crumbs?: Crumb[]
  actions?: React.ReactNode
  className?: string
}) {
  return (
    <div className={cn('mb-3 flex flex-wrap items-end justify-between gap-3', className)}>
      <div className="min-w-0">
        {crumbs && crumbs.length > 0 ? (
          <nav aria-label="Breadcrumb" className="mb-1">
            <ol className="flex flex-wrap items-center gap-1 text-[11px] text-ink-muted">
              {crumbs.map((crumb, index) => (
                <li key={`${crumb.label}-${index}`} className="flex items-center gap-1">
                  {crumb.href ? (
                    <Link href={crumb.href} className="transition-colors hover:text-brand-600 hover:underline">
                      {crumb.label}
                    </Link>
                  ) : (
                    <span className="font-medium text-ink-soft">{crumb.label}</span>
                  )}
                  {index < crumbs.length - 1 ? (
                    <ChevronRight className="h-3 w-3 text-ink-faint" strokeWidth={2.5} aria-hidden />
                  ) : null}
                </li>
              ))}
            </ol>
          </nav>
        ) : null}
        <h1 className="text-[19px] font-bold leading-tight tracking-tight text-ink">{title}</h1>
        {description ? <p className="mt-0.5 max-w-3xl text-[12px] leading-relaxed text-ink-muted">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2 no-print">{actions}</div> : null}
    </div>
  )
}
