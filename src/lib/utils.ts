import { clsx, type ClassValue } from 'clsx'
import { format, parseISO } from 'date-fns'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** Rendered wherever a source value is absent. Never substitute zero. */
export const NA = 'N/A'

const INT_FORMAT = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 })

/** Indian digit grouping (1,62,281) - this is an India-operations report. */
export function formatNumber(value: number | null | undefined, fallback = NA): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return fallback
  return INT_FORMAT.format(Math.round(value))
}

export function formatPct(value: number | null | undefined, digits = 2, fallback = NA): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return fallback
  return `${value.toFixed(digits)}%`
}

/** Signed percentage-point delta, e.g. "+2.40 pp". */
export function formatPp(value: number | null | undefined, digits = 2, fallback = NA): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return fallback
  const sign = value > 0 ? '+' : ''
  return `${sign}${value.toFixed(digits)} pp`
}

export function formatSignedNumber(value: number | null | undefined, fallback = NA): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return fallback
  const sign = value > 0 ? '+' : ''
  return `${sign}${INT_FORMAT.format(Math.round(value))}`
}

export function formatInrLakh(value: number | null | undefined, fallback = NA): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return fallback
  return `₹${value.toFixed(1)} L`
}

export function formatMinutes(value: number | null | undefined, fallback = NA): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return fallback
  const hours = Math.floor(value / 60)
  const minutes = Math.round(value % 60)
  return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`
}

/** Sum helper that treats null as "absent" rather than zero. */
export function sumDefined(values: (number | null | undefined)[]): number | null {
  const defined = values.filter((v): v is number => v !== null && v !== undefined && Number.isFinite(v))
  if (defined.length === 0) return null
  return defined.reduce((a, b) => a + b, 0)
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

/** Stable ascending/descending comparator that pushes nulls to the end. */
export function compareNullable(a: number | null, b: number | null, dir: 'asc' | 'desc' = 'desc'): number {
  if (a === null && b === null) return 0
  if (a === null) return 1
  if (b === null) return -1
  return dir === 'asc' ? a - b : b - a
}

export function titleCase(input: string): string {
  return input
    .toLowerCase()
    .split(/[_\s]+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
}

/**
 * Format a timestamp in the offset it was recorded in, not the viewer's.
 *
 * Every timestamp in this dataset is stamped +05:30 because Snowman operates
 * in India and the daily load runs on IST. Passing such a string through
 * `new Date()` renders it in whatever timezone the browser happens to be in,
 * so a 05:45 IST refresh shows as 00:15 to a reader in London. Formatting the
 * wall-clock portion of the string directly keeps the displayed time equal to
 * the time the operation actually happened.
 */
export function formatIst(iso: string, pattern: string): string {
  const wallClock = iso.replace(/(Z|[+-]\d{2}:?\d{2})$/, '')
  const parsed = parseISO(wallClock)
  if (Number.isNaN(parsed.getTime())) return NA
  return format(parsed, pattern)
}

/** Date-only helper, for values that carry no time component. */
export function formatDate(iso: string, pattern = 'dd MMM yyyy'): string {
  return formatIst(iso, pattern)
}
