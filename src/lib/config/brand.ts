/**
 * Snowman Logistics visual identity.
 *
 * Colour is used to carry meaning, never decoration. The status ramp below is
 * the only source of status colour in the application - components read from
 * it rather than hard-coding hex values or Tailwind classes.
 */

export const BRAND = {
  name: 'Snowman Logistics',
  product: 'Pan-India Utilization Control Tower',
  /** Snowman corporate blue. */
  primary: '#1B6EC2',
  primaryDark: '#12508F',
  primaryLight: '#E8F1FB',
  accent: '#E53935',
  ink: '#111827',
  inkMuted: '#4B5563',
  canvas: '#F5F7FA',
  surface: '#FFFFFF',
  border: '#E2E8F0',
} as const

/** Status ramp. Every status colour in the app comes from here. */
export const STATUS_COLORS = {
  healthy: { hex: '#0F8A5F', bg: '#E7F6EF', border: '#A7DCC5', text: '#0B6B4A' },
  watch: { hex: '#B7791F', bg: '#FDF6E3', border: '#EFD79A', text: '#8A5B08' },
  high: { hex: '#D97706', bg: '#FEF3E2', border: '#F5C98A', text: '#9A4E06' },
  critical: { hex: '#C62828', bg: '#FDECEC', border: '#F1B4B4', text: '#9B1C1C' },
  info: { hex: '#1B6EC2', bg: '#E8F1FB', border: '#B9D5F1', text: '#12508F' },
  unknown: { hex: '#64748B', bg: '#F1F5F9', border: '#CBD5E1', text: '#475569' },
} as const

/** Chart series palette - sequential, colour-blind safe, no neon. */
export const CHART_COLORS = {
  actual: '#1B6EC2',
  budget: '#64748B',
  lastYear: '#94A3B8',
  forecast: '#7C3AED',
  occupied: '#1B6EC2',
  available: '#93C5FD',
  over: '#C62828',
  frozen: '#1E5EA8',
  chilled: '#3B9BD9',
  controlledAmbient: '#7DC4A5',
  ambient: '#B9A57D',
  inbound: '#0F8A5F',
  outbound: '#B7791F',
} as const

/**
 * Sequential ramp for magnitude - one hue, light to dark.
 *
 * Used by the heatmap, treemap and any other mark whose colour encodes "more".
 * Both modes were run through the dataviz validator's ordinal checks and pass
 * all four: monotone lightness, adjacent lightness gaps of at least 0.06, a
 * light end that still clears its surface at 2:1, and a hue spread under 5
 * degrees. Do not hand-edit a step without re-running it.
 *
 *   node scripts/validate_palette.js "<steps>" --ordinal --mode light --surface "#ffffff"
 */
export const SEQUENTIAL_RAMP = ['#88b6e4', '#5d9bd8', '#3f88cd', '#1b6ec2', '#12508f'] as const

/** The same ramp re-stepped against the dark surface, not an automatic flip. */
export const SEQUENTIAL_RAMP_DARK = ['#2b5479', '#37719f', '#4a92d4', '#71acdf', '#9dc4ea'] as const

/** Cell colour for a value with no magnitude - never the pale end of the ramp. */
export const SEQUENTIAL_EMPTY = '#eef2f7'

/**
 * Pick a ramp step for a value inside a domain.
 *
 * Returns null when the value is not computable, so the caller renders the
 * "no data" treatment rather than the lightest step - an absent reading and a
 * low one are different facts.
 */
export function rampStep(value: number | null, min: number, max: number): string | null {
  if (value === null || !Number.isFinite(value)) return null
  if (max <= min) return SEQUENTIAL_RAMP[SEQUENTIAL_RAMP.length - 1]
  const t = Math.min(Math.max((value - min) / (max - min), 0), 1)
  const index = Math.min(SEQUENTIAL_RAMP.length - 1, Math.floor(t * SEQUENTIAL_RAMP.length))
  return SEQUENTIAL_RAMP[index]
}

export const ZONE_COLORS: Record<string, string> = {
  FROZEN: CHART_COLORS.frozen,
  CHILLED: CHART_COLORS.chilled,
  CONTROLLED_AMBIENT: CHART_COLORS.controlledAmbient,
  AMBIENT: CHART_COLORS.ambient,
}
