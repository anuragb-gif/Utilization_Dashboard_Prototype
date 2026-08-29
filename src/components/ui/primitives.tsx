'use client'

import * as React from 'react'
import Link from 'next/link'
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  CircleHelp,
  Info,
  Minus,
  OctagonAlert,
  ShieldCheck,
  TriangleAlert,
} from 'lucide-react'
import type { Severity, StatusLevel } from '@/lib/domain/types'
import { cn, NA } from '@/lib/utils'

// ---------------------------------------------------------------------------
// Status vocabulary
//
// Status is never carried by colour alone: every status element pairs its
// colour with an icon and a text label, so the meaning survives a greyscale
// print-out and a colour-vision deficiency.
// ---------------------------------------------------------------------------

export const STATUS_META: Record<StatusLevel, { label: string; icon: React.ElementType; chip: string; dot: string }> = {
  healthy: { label: 'Healthy', icon: ShieldCheck, chip: 'bg-ok-soft text-[#0b6b4a] border-ok-line', dot: 'bg-ok' },
  watch: { label: 'Watch', icon: TriangleAlert, chip: 'bg-warn-soft text-[#8a5b08] border-warn-line', dot: 'bg-warn' },
  high: { label: 'High', icon: AlertTriangle, chip: 'bg-hot-soft text-[#9a4e06] border-hot-line', dot: 'bg-hot' },
  critical: { label: 'Critical', icon: OctagonAlert, chip: 'bg-bad-soft text-[#9b1c1c] border-bad-line', dot: 'bg-bad' },
  info: { label: 'Info', icon: Info, chip: 'bg-brand-100 text-brand-700 border-brand-200', dot: 'bg-brand-500' },
  unknown: { label: 'No data', icon: CircleHelp, chip: 'bg-slate-100 text-slate-600 border-slate-300', dot: 'bg-slate-400' },
}

export const SEVERITY_META: Record<Severity, { label: string; status: StatusLevel }> = {
  critical: { label: 'Critical', status: 'critical' },
  high: { label: 'High', status: 'high' },
  medium: { label: 'Medium', status: 'watch' },
  low: { label: 'Low', status: 'info' },
}

export function StatusChip({
  status,
  label,
  size = 'sm',
  className,
}: {
  status: StatusLevel
  label?: string
  size?: 'xs' | 'sm'
  className?: string
}) {
  const meta = STATUS_META[status]
  const Icon = meta.icon
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border font-semibold whitespace-nowrap',
        size === 'xs' ? 'px-1.5 py-0.5 text-[10px]' : 'px-2 py-0.5 text-[11px]',
        meta.chip,
        className,
      )}
    >
      <Icon className={size === 'xs' ? 'h-2.5 w-2.5' : 'h-3 w-3'} strokeWidth={2.25} aria-hidden />
      {label ?? meta.label}
    </span>
  )
}

export function SeverityChip({ severity, className }: { severity: Severity; className?: string }) {
  const meta = SEVERITY_META[severity]
  return <StatusChip status={meta.status} label={meta.label} className={className} />
}

export function StatusDot({ status, className }: { status: StatusLevel; className?: string }) {
  return (
    <span className={cn('inline-block h-2 w-2 rounded-full', STATUS_META[status].dot, className)} aria-hidden />
  )
}

// ---------------------------------------------------------------------------
// Surfaces
// ---------------------------------------------------------------------------

export function Card({
  className,
  children,
  ...rest
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'min-w-0 rounded-lg border border-hairline bg-surface shadow-[0_1px_2px_rgba(16,24,40,0.04)] print-avoid-break',
        className,
      )}
      {...rest}
    >
      {children}
    </div>
  )
}

export function CardHeader({
  title,
  subtitle,
  actions,
  tip,
  className,
  as: Heading = 'h2',
}: {
  title: React.ReactNode
  subtitle?: React.ReactNode
  actions?: React.ReactNode
  tip?: string
  className?: string
  as?: 'h2' | 'h3'
}) {
  return (
    <div className={cn('flex items-start justify-between gap-4 border-b border-hairline px-4 py-3', className)}>
      <div className="min-w-0">
        <Heading className="flex items-center gap-1.5 text-[13px] font-semibold tracking-tight text-ink">
          {title}
          {tip ? <InfoTip label={typeof title === 'string' ? title : 'More information'} text={tip} /> : null}
        </Heading>
        {subtitle ? <p className="mt-0.5 text-[11.5px] leading-snug text-ink-muted">{subtitle}</p> : null}
      </div>
      {actions ? <div className="flex shrink-0 items-center gap-1.5">{actions}</div> : null}
    </div>
  )
}

export function SectionTitle({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <h2 className={cn('text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-muted', className)}>
      {children}
    </h2>
  )
}

// ---------------------------------------------------------------------------
// Tooltip
//
// Hover AND focus, with the description wired to the trigger via
// aria-describedby so screen readers get the same explanation.
// ---------------------------------------------------------------------------

/**
 * Explanatory tooltip.
 *
 * Positioned with fixed coordinates measured on open and clamped to the
 * viewport, so a tip attached to a control near the right edge stays readable
 * instead of running off the page. It is removed from the DOM while closed —
 * an absolutely-positioned hidden panel still contributes to document scroll
 * width, which is enough to put the whole page into horizontal scroll.
 *
 * Opens on hover AND on keyboard focus, and is wired to the trigger with
 * aria-describedby so the same explanation reaches a screen reader.
 */
export function InfoTip({ label, text }: { label: string; text: string }) {
  const id = React.useId()
  const [open, setOpen] = React.useState(false)
  const [position, setPosition] = React.useState<{ top: number; left: number } | null>(null)
  const triggerRef = React.useRef<HTMLButtonElement>(null)

  const show = React.useCallback(() => {
    const rect = triggerRef.current?.getBoundingClientRect()
    if (!rect) return
    const width = 288
    const margin = 8
    const left = Math.min(Math.max(margin, rect.left), window.innerWidth - width - margin)
    // Flip above the trigger when there is not enough room below it.
    const below = rect.bottom + 6
    const top = below + 160 > window.innerHeight ? Math.max(margin, rect.top - 6 - 160) : below
    setPosition({ top, left })
    setOpen(true)
  }, [])

  const hide = React.useCallback(() => setOpen(false), [])

  React.useEffect(() => {
    if (!open) return
    const close = () => setOpen(false)
    window.addEventListener('scroll', close, true)
    window.addEventListener('resize', close)
    return () => {
      window.removeEventListener('scroll', close, true)
      window.removeEventListener('resize', close)
    }
  }, [open])

  return (
    <span className="relative inline-flex">
      <button
        ref={triggerRef}
        type="button"
        aria-label={`About ${label}`}
        aria-describedby={open ? id : undefined}
        aria-expanded={open}
        onMouseEnter={show}
        onMouseLeave={hide}
        onFocus={show}
        onBlur={hide}
        onClick={(event) => {
          event.preventDefault()
          if (open) hide()
          else show()
        }}
        className="inline-flex h-4 w-4 items-center justify-center rounded-full text-ink-faint transition-colors hover:text-brand-600 focus-visible:text-brand-600"
      >
        <CircleHelp className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
      </button>
      {open && position ? (
        <span
          role="tooltip"
          id={id}
          style={{ top: position.top, left: position.left, width: 288 }}
          className="ct-enter pointer-events-none fixed z-50 whitespace-pre-line rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-[11.5px] font-normal leading-relaxed text-slate-100 shadow-xl"
        >
          {text}
        </span>
      ) : null}
    </span>
  )
}

// ---------------------------------------------------------------------------
// Buttons
// ---------------------------------------------------------------------------

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger'

const BUTTON_STYLES: Record<ButtonVariant, string> = {
  primary: 'bg-brand-500 text-white hover:bg-brand-600 border-brand-500',
  secondary: 'bg-surface text-ink-soft hover:bg-slate-50 border-hairline',
  ghost: 'bg-transparent text-ink-muted hover:bg-slate-100 border-transparent',
  danger: 'bg-bad-soft text-[#9b1c1c] hover:bg-[#fbdcdc] border-bad-line',
}

export const Button = React.forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant; size?: 'sm' | 'md' }
>(function Button({ className, variant = 'secondary', size = 'sm', ...rest }, ref) {
  return (
    <button
      ref={ref}
      className={cn(
        'inline-flex items-center justify-center gap-1.5 rounded-md border font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50',
        size === 'sm' ? 'h-7 px-2.5 text-[12px]' : 'h-9 px-3.5 text-[13px]',
        BUTTON_STYLES[variant],
        className,
      )}
      {...rest}
    />
  )
})

export function LinkButton({
  href,
  children,
  className,
  variant = 'secondary',
}: {
  href: string
  children: React.ReactNode
  className?: string
  variant?: ButtonVariant
}) {
  return (
    <Link
      href={href}
      className={cn(
        'inline-flex h-7 items-center justify-center gap-1.5 rounded-md border px-2.5 text-[12px] font-medium transition-colors',
        BUTTON_STYLES[variant],
        className,
      )}
    >
      {children}
    </Link>
  )
}

// ---------------------------------------------------------------------------
// Values
// ---------------------------------------------------------------------------

/**
 * Renders a value or an explicit "not available" marker.
 *
 * A missing number is never rendered as 0 or as a blank cell - the reader has
 * to be able to tell "nothing is stored here" apart from "the value is zero".
 */
export function Value({
  children,
  missing,
  reason,
  className,
}: {
  children: React.ReactNode
  missing?: boolean
  reason?: string
  className?: string
}) {
  if (missing) {
    return (
      <span className={cn('inline-flex items-center gap-1 text-ink-faint', className)} title={reason}>
        <span className="text-[11px] font-medium uppercase tracking-wide">{NA}</span>
        {reason ? <span className="sr-only">{reason}</span> : null}
      </span>
    )
  }
  return <span className={className}>{children}</span>
}

export function DeltaChip({
  value,
  suffix = 'pp',
  invert = false,
  neutral = false,
  digits = 2,
  className,
}: {
  value: number | null
  suffix?: string
  /** Set when a rise is bad (e.g. dwell time) so the colour follows meaning. */
  invert?: boolean
  /**
   * Set where neither direction is inherently good - variance against a
   * planning target, for instance, where over and under are both just
   * information and a status chip beside it already carries the judgement.
   */
  neutral?: boolean
  digits?: number
  className?: string
}) {
  if (value === null || !Number.isFinite(value)) {
    return <span className={cn('text-[11px] font-medium text-ink-faint', className)}>{NA}</span>
  }
  const flat = Math.abs(value) < 0.05
  const positiveIsGood = !invert
  const good = flat ? null : value > 0 === positiveIsGood
  const Icon = flat ? Minus : value > 0 ? ArrowUpRight : ArrowDownRight
  return (
    <span
      className={cn(
        'tnum inline-flex items-center gap-0.5 text-[11.5px] font-semibold',
        neutral || flat ? 'text-ink-soft' : good ? 'text-ok' : 'text-bad',
        className,
      )}
    >
      <Icon className="h-3 w-3" strokeWidth={2.5} aria-hidden />
      {value > 0 ? '+' : ''}
      {value.toFixed(digits)}
      {suffix ? <span className="font-medium">&nbsp;{suffix}</span> : null}
    </span>
  )
}

// ---------------------------------------------------------------------------
// Sparkline - inline SVG, no chart library, cheap enough for a 50-row table
// ---------------------------------------------------------------------------

export function Sparkline({
  values,
  width = 72,
  height = 22,
  status = 'info',
  label,
}: {
  values: number[]
  width?: number
  height?: number
  status?: StatusLevel
  label?: string
}) {
  if (values.length < 2) {
    return <span className="text-[11px] text-ink-faint">{NA}</span>
  }
  const min = Math.min(...values)
  const max = Math.max(...values)
  const span = max - min || 1
  const step = width / (values.length - 1)
  const points = values
    .map((v, i) => `${(i * step).toFixed(1)},${(height - ((v - min) / span) * (height - 4) - 2).toFixed(1)}`)
    .join(' ')
  const stroke =
    status === 'critical' ? '#c62828' : status === 'high' ? '#d97706' : status === 'watch' ? '#b7791f' : '#1b6ec2'
  const last = values[values.length - 1]

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label={label ?? `Trend, latest ${last.toFixed(1)}`}
      className="overflow-visible"
    >
      <polyline points={points} fill="none" stroke={stroke} strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round" />
      <circle
        cx={width}
        cy={height - ((last - min) / span) * (height - 4) - 2}
        r={2}
        fill={stroke}
      />
    </svg>
  )
}

// ---------------------------------------------------------------------------
// Meters, empty states
// ---------------------------------------------------------------------------

export function UtilizationBar({
  pct,
  targetPct,
  className,
}: {
  pct: number | null
  targetPct?: number
  className?: string
}) {
  if (pct === null) {
    return <div className={cn('h-1.5 rounded-full bg-slate-100', className)} aria-hidden />
  }
  const status: StatusLevel = pct >= 100 ? 'critical' : pct >= 90 ? 'high' : pct >= 80 ? 'watch' : 'healthy'
  const fill = Math.min(pct, 100)
  const overflow = pct > 100 ? Math.min(pct - 100, 20) : 0
  return (
    <div className={cn('relative h-1.5 w-full rounded-full bg-slate-100', className)}>
      <div
        className={cn('h-full rounded-full transition-[width] duration-500', STATUS_META[status].dot)}
        style={{ width: `${fill}%` }}
      />
      {overflow > 0 ? (
        <div
          className="absolute top-0 h-full rounded-r-full bg-bad opacity-60"
          style={{ left: '100%', width: `${overflow}%` }}
          aria-hidden
        />
      ) : null}
      {targetPct !== undefined && targetPct <= 100 ? (
        <div
          className="absolute -top-0.5 h-2.5 w-px bg-ink-soft"
          style={{ left: `${targetPct}%` }}
          aria-hidden
          title={`Target ${targetPct}%`}
        />
      ) : null}
    </div>
  )
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string
  description?: string
  action?: React.ReactNode
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-6 py-12 text-center">
      <p className="text-[13px] font-semibold text-ink-soft">{title}</p>
      {description ? <p className="max-w-md text-[12px] leading-relaxed text-ink-muted">{description}</p> : null}
      {action}
    </div>
  )
}

export function DemoDataBadge({ className, text = 'Demo data' }: { className?: string; text?: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded border border-amber-300 bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-800',
        className,
      )}
    >
      <TriangleAlert className="h-2.5 w-2.5" strokeWidth={2.5} aria-hidden />
      {text}
    </span>
  )
}

export function DrilldownLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="group inline-flex items-center gap-1 text-[12px] font-semibold text-brand-600 transition-colors hover:text-brand-700"
    >
      {children}
      <ArrowRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5" strokeWidth={2.5} aria-hidden />
    </Link>
  )
}

// ---------------------------------------------------------------------------
// Segmented control
// ---------------------------------------------------------------------------

export function Segmented<T extends string>({
  options,
  value,
  onChange,
  ariaLabel,
  size = 'sm',
}: {
  options: { value: T; label: string }[]
  value: T
  onChange: (value: T) => void
  ariaLabel: string
  size?: 'xs' | 'sm'
}) {
  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className="inline-flex items-center gap-0.5 rounded-md border border-hairline bg-slate-50 p-0.5"
    >
      {options.map((option) => {
        const active = option.value === value
        return (
          <button
            key={option.value}
            role="tab"
            type="button"
            aria-selected={active}
            onClick={() => onChange(option.value)}
            className={cn(
              'rounded font-medium transition-colors',
              size === 'xs' ? 'px-1.5 py-0.5 text-[10.5px]' : 'px-2 py-1 text-[11.5px]',
              active ? 'bg-surface text-brand-700 shadow-[0_1px_2px_rgba(16,24,40,0.08)]' : 'text-ink-muted hover:text-ink-soft',
            )}
          >
            {option.label}
          </button>
        )
      })}
    </div>
  )
}
