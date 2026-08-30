import type { Severity, StatusLevel } from '@/lib/domain/types'

/**
 * Business thresholds.
 *
 * IMPORTANT: these are prototype defaults, NOT ratified Snowman business
 * rules. They are declared once here so that a business owner can change a
 * band without touching a single component. The Settings screen renders this
 * object directly so the assumptions are visible to whoever is reviewing the
 * prototype.
 */

export interface UtilizationBand {
  id: StatusLevel
  label: string
  /** Inclusive lower bound, percentage points. */
  from: number
  /** Exclusive upper bound; null = unbounded. */
  to: number | null
  description: string
}

export const UTILIZATION_BANDS: UtilizationBand[] = [
  { id: 'healthy', label: 'Healthy', from: 0, to: 80, description: 'Comfortable headroom against capacity.' },
  { id: 'watch', label: 'Watch', from: 80, to: 90, description: 'Approaching the planning threshold.' },
  { id: 'high', label: 'High', from: 90, to: 100, description: 'Limited headroom; plan overflow now.' },
  { id: 'critical', label: 'Over capacity', from: 100, to: null, description: 'Occupied pallets exceed the capacity master.' },
]

export const THRESHOLDS = {
  /** Network utilization target used for variance-to-target across the app. */
  networkTargetPct: 85,
  /** Utilization above which a facility is flagged as a forecast breach risk. */
  breachThresholdPct: 90,
  /** Utilization below which a facility is reviewed for under-utilization. */
  underUtilizedPct: 55,
  /** 7-day percentage-point increase that counts as a rapid ramp. */
  rapidIncreasePp: 6,
  /** 7-day percentage-point decrease that counts as a deterioration. */
  rapidDeclinePp: -6,
  /** Minimum acceptable temperature compliance. */
  temperatureCompliancePct: 99.0,
  /** Minimum acceptable FEFO (first-expired-first-out) picking compliance. */
  fefoCompliancePct: 98.0,
  /** Inventory older than this many days is flagged as ageing. */
  ageingDays: 60,
  /** Days-to-expiry below which stock is treated as near-expiry. */
  nearExpiryDays: 30,
  /** Data older than this many hours is treated as stale. */
  dataStaleAfterHours: 12,
  /** Minimum acceptable data-quality score. */
  dataQualityPct: 97,
  /** Days before a Park & Pay contract ends at which renewal becomes an issue. */
  contractRenewalWindowDays: 60,
} as const

/** Resolve a utilization percentage to a status band. */
export function utilizationStatus(pct: number | null): StatusLevel {
  if (pct === null || !Number.isFinite(pct)) return 'unknown'
  const band = UTILIZATION_BANDS.find((b) => pct >= b.from && (b.to === null || pct < b.to))
  return band?.id ?? 'unknown'
}

export function utilizationBandLabel(pct: number | null): string {
  if (pct === null || !Number.isFinite(pct)) return 'Not computable'
  const band = UTILIZATION_BANDS.find((b) => pct >= b.from && (b.to === null || pct < b.to))
  return band?.label ?? 'Unknown'
}

/** Map a status band to an exception severity. */
export function statusToSeverity(status: StatusLevel): Severity {
  switch (status) {
    case 'critical':
      return 'critical'
    case 'high':
      return 'high'
    case 'watch':
      return 'medium'
    default:
      return 'low'
  }
}

export const SEVERITY_RANK: Record<Severity, number> = { critical: 0, high: 1, medium: 2, low: 3 }
