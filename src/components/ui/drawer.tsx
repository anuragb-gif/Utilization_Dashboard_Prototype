'use client'

import * as React from 'react'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * Right-hand slide-over.
 *
 * Handles the things an accessible dialog has to handle and that a div with
 * a transform does not: focus is moved in and restored on close, Escape
 * closes, Tab is trapped inside, and the page behind is inert to assistive
 * technology.
 */
export function Drawer({
  open,
  onClose,
  title,
  subtitle,
  children,
  footer,
  width = 'lg',
}: {
  open: boolean
  onClose: () => void
  title: React.ReactNode
  subtitle?: React.ReactNode
  children: React.ReactNode
  footer?: React.ReactNode
  width?: 'md' | 'lg' | 'xl'
}) {
  const panelRef = React.useRef<HTMLDivElement>(null)
  const restoreRef = React.useRef<HTMLElement | null>(null)
  const titleId = React.useId()

  React.useEffect(() => {
    if (!open) return
    restoreRef.current = document.activeElement as HTMLElement | null
    const panel = panelRef.current
    const initial = panel?.querySelector<HTMLElement>('[data-autofocus]')
    if (initial) initial.focus()
    else panel?.focus()

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.stopPropagation()
        onClose()
        return
      }
      if (event.key !== 'Tab' || !panel) return
      const focusable = panel.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      )
      if (focusable.length === 0) return
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', onKeyDown, true)
    return () => {
      document.removeEventListener('keydown', onKeyDown, true)
      document.body.style.overflow = previousOverflow
      restoreRef.current?.focus?.()
    }
  }, [open, onClose])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 no-print">
      <div
        className="absolute inset-0 bg-slate-900/25 backdrop-blur-[1px]"
        onClick={onClose}
        aria-hidden
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className={cn(
          'ct-drawer absolute right-0 top-0 flex h-full w-full flex-col bg-canvas shadow-2xl outline-none',
          width === 'md' ? 'max-w-md' : width === 'lg' ? 'max-w-2xl' : 'max-w-4xl',
        )}
      >
        <header className="flex items-start justify-between gap-4 border-b border-hairline bg-surface px-5 py-3.5">
          <div className="min-w-0">
            <h2 id={titleId} className="truncate text-[15px] font-semibold tracking-tight text-ink">
              {title}
            </h2>
            {subtitle ? <div className="mt-0.5 text-[12px] text-ink-muted">{subtitle}</div> : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            data-autofocus
            className="rounded-md p-1.5 text-ink-muted transition-colors hover:bg-slate-100 hover:text-ink"
            aria-label="Close panel"
          >
            <X className="h-4 w-4" strokeWidth={2} aria-hidden />
          </button>
        </header>
        <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>
        {footer ? <footer className="border-t border-hairline bg-surface px-5 py-3">{footer}</footer> : null}
      </div>
    </div>
  )
}
