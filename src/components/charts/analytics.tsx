'use client'

import * as React from 'react'
import { CHART_COLORS, SEQUENTIAL_EMPTY, SEQUENTIAL_RAMP } from '@/lib/config/brand'
import { cn, formatNumber, formatPct, formatPp } from '@/lib/utils'

/**
 * The analytical chart set.
 *
 * Every mark here follows the same rules: thin strokes, a hairline recessive
 * grid, one hue carrying magnitude, status colour reserved for status, and a
 * hover layer on every plot. Identity is never colour alone - anything with
 * more than one series is direct-labelled or legended.
 *
 * The sequential ramp is the validated one in brand.ts. Nothing here generates
 * a hue.
 */

// ---------------------------------------------------------------------------
// Shared plumbing
// ---------------------------------------------------------------------------

interface TipState {
  x: number
  y: number
  title: string
  lines: { label: string; value: string }[]
}

/** One tooltip implementation, so every chart on the page behaves the same. */
function Tooltip({ tip, host }: { tip: TipState | null; host: DOMRect | null }) {
  if (!tip || !host) return null
  const left = Math.min(Math.max(tip.x, 8), host.width - 8)
  const flip = tip.y > host.height * 0.55
  return (
    <div
      className="pointer-events-none absolute z-20 w-max max-w-[240px] -translate-x-1/2 rounded-md border border-hairline bg-surface px-2.5 py-1.5 shadow-[0_6px_20px_rgba(16,24,40,0.14)]"
      style={{ left, top: flip ? undefined : tip.y + 14, bottom: flip ? host.height - tip.y + 14 : undefined }}
      role="status"
    >
      <p className="text-[11px] font-semibold text-ink">{tip.title}</p>
      {tip.lines.map((line) => (
        <p key={line.label} className="tnum flex items-baseline justify-between gap-3 text-[10.5px] text-ink-muted">
          <span>{line.label}</span>
          <span className="font-semibold text-ink-soft">{line.value}</span>
        </p>
      ))}
    </div>
  )
}

function useHover() {
  const ref = React.useRef<HTMLDivElement>(null)
  const [tip, setTip] = React.useState<TipState | null>(null)
  const [host, setHost] = React.useState<DOMRect | null>(null)
  const show = (event: React.MouseEvent, title: string, lines: { label: string; value: string }[]) => {
    const box = ref.current?.getBoundingClientRect()
    if (!box) return
    setHost(box)
    setTip({ x: event.clientX - box.left, y: event.clientY - box.top, title, lines })
  }
  return { ref, tip, host, show, hide: () => setTip(null) }
}

/** Legend row. Present whenever a chart carries two or more encodings. */
export function ChartLegend({
  items,
  className,
}: {
  items: { label: string; color?: string; swatch?: 'ramp' | 'ring' | 'dash'; note?: string }[]
  className?: string
}) {
  return (
    <ul className={cn('flex flex-wrap items-center gap-x-4 gap-y-1.5 px-4 py-2 text-[10.5px] text-ink-muted', className)}>
      {items.map((item) => (
        <li key={item.label} className="inline-flex items-center gap-1.5">
          {item.swatch === 'ramp' ? (
            <span className="inline-flex overflow-hidden rounded-[2px]" aria-hidden>
              {SEQUENTIAL_RAMP.map((step) => (
                <span key={step} className="block h-2.5 w-3" style={{ background: step }} />
              ))}
            </span>
          ) : item.swatch === 'dash' ? (
            <svg width="16" height="6" aria-hidden>
              <line x1="0" y1="3" x2="16" y2="3" stroke={item.color} strokeWidth="2" strokeDasharray="4 3" />
            </svg>
          ) : (
            <span
              className={cn('inline-block h-2.5 w-2.5 rounded-full', item.swatch === 'ring' && 'ring-2 ring-surface')}
              style={{ background: item.color }}
              aria-hidden
            />
          )}
          <span>{item.label}</span>
          {item.note ? <span className="text-ink-faint">{item.note}</span> : null}
        </li>
      ))}
    </ul>
  )
}

// ---------------------------------------------------------------------------
// 1. Calendar heatmap
// ---------------------------------------------------------------------------

export interface CalendarPoint {
  date: string
  value: number | null
}

const WEEKDAY_LABELS = ['M', '', 'W', '', 'F', '', 'S']
const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/**
 * Daily utilization for the whole history, one cell per day.
 *
 * Magnitude, so a single-hue sequential ramp: more-is-darker. A day with no
 * computable reading takes the neutral "no data" fill rather than the pale end
 * of the ramp, because an absent reading and a low one are different facts.
 * The weekday rows make the working rhythm visible, which a line chart of the
 * same series flattens away.
 */
export function CalendarHeatmap({
  points,
  cell = 11,
  gap = 2.5,
}: {
  points: CalendarPoint[]
  cell?: number
  gap?: number
}) {
  const { ref, tip, host, show, hide } = useHover()

  const { weeks, domain, monthTicks } = React.useMemo(() => {
    const values = points.map((p) => p.value).filter((v): v is number => v !== null)
    const min = values.length ? Math.min(...values) : 0
    const max = values.length ? Math.max(...values) : 100

    // Monday-first columns; pad the first week so weekday rows line up.
    const first = points[0] ? new Date(`${points[0].date}T00:00:00Z`) : new Date()
    const lead = (first.getUTCDay() + 6) % 7
    const cells: (CalendarPoint | null)[] = [...Array.from({ length: lead }, () => null), ...points]
    const cols: (CalendarPoint | null)[][] = []
    for (let i = 0; i < cells.length; i += 7) cols.push(cells.slice(i, i + 7))

    const ticks: { col: number; label: string }[] = []
    let lastMonth = -1
    cols.forEach((col, index) => {
      const day = col.find((c): c is CalendarPoint => c !== null)
      if (!day) return
      const month = Number(day.date.slice(5, 7)) - 1
      if (month !== lastMonth) {
        ticks.push({ col: index, label: MONTH_SHORT[month] })
        lastMonth = month
      }
    })

    return { weeks: cols, domain: { min, max }, monthTicks: ticks }
  }, [points])

  const step = cell + gap
  const width = weeks.length * step + 26
  const height = 7 * step + 18

  return (
    <div ref={ref} className="relative w-full min-w-0 overflow-x-auto px-4 pb-2 pt-1">
      <svg width={width} height={height} role="img" aria-label="Daily utilization, one cell per day" className="block">
        {WEEKDAY_LABELS.map((label, row) =>
          label ? (
            <text key={row} x={0} y={18 + row * step + cell - 2} fontSize="8.5" fill="var(--color-ink-faint)">
              {label}
            </text>
          ) : null,
        )}
        {monthTicks.map((tick) => (
          <text key={`${tick.label}-${tick.col}`} x={26 + tick.col * step} y={8} fontSize="8.5" fill="var(--color-ink-faint)">
            {tick.label}
          </text>
        ))}
        {weeks.map((col, colIndex) =>
          col.map((day, row) => {
            if (!day) return null
            const t =
              day.value === null || domain.max <= domain.min
                ? null
                : (day.value - domain.min) / (domain.max - domain.min)
            const fill =
              t === null ? SEQUENTIAL_EMPTY : SEQUENTIAL_RAMP[Math.min(SEQUENTIAL_RAMP.length - 1, Math.floor(t * SEQUENTIAL_RAMP.length))]
            return (
              <rect
                key={day.date}
                x={26 + colIndex * step}
                y={14 + row * step}
                width={cell}
                height={cell}
                rx={2}
                fill={fill}
                onMouseMove={(event) =>
                  show(event, day.date, [
                    { label: 'Utilization', value: formatPct(day.value, 2) },
                    { label: 'Weekday', value: new Date(`${day.date}T00:00:00Z`).toLocaleDateString('en-GB', { weekday: 'long', timeZone: 'UTC' }) },
                  ])
                }
                onMouseLeave={hide}
              />
            )
          }),
        )}
      </svg>
      <Tooltip tip={tip} host={host} />
    </div>
  )
}

// ---------------------------------------------------------------------------
// 2. Quadrant bubble
// ---------------------------------------------------------------------------

export interface QuadrantPoint {
  id: string
  label: string
  x: number
  y: number
  size: number
  /** True where the point is already over capacity - the one status case. */
  critical?: boolean
}

/**
 * Where each warehouse sits on utilization now against where it is heading.
 *
 * Two measures and a size, which is the one job a scatter does better than any
 * table: the four quadrants are named, so a reader lands on the action rather
 * than on a coordinate. Marks are one hue; the status colour appears only on
 * sites that are genuinely over capacity, which is a state and not a series.
 */
export function QuadrantBubble({
  points,
  xLabel,
  yLabel,
  xSplit,
  ySplit = 0,
  quadrants,
  height = 340,
  onSelect,
}: {
  points: QuadrantPoint[]
  xLabel: string
  yLabel: string
  xSplit: number
  ySplit?: number
  quadrants: { tl: string; tr: string; bl: string; br: string }
  height?: number
  onSelect?: (id: string) => void
}) {
  const { ref, tip, host, show, hide } = useHover()
  const pad = { l: 46, r: 14, t: 16, b: 30 }
  const width = 720

  const bounds = React.useMemo(() => {
    const xs = points.map((p) => p.x)
    const ys = points.map((p) => p.y)
    const xMin = Math.min(...xs, xSplit) - 4
    const xMax = Math.max(...xs, xSplit) + 4
    const yPad = Math.max((Math.max(...ys) - Math.min(...ys)) * 0.18, 1)
    return { xMin, xMax, yMin: Math.min(...ys, ySplit) - yPad, yMax: Math.max(...ys, ySplit) + yPad }
  }, [points, xSplit, ySplit])

  const maxSize = Math.max(...points.map((p) => p.size), 1)
  const px = (v: number) => pad.l + ((v - bounds.xMin) / (bounds.xMax - bounds.xMin)) * (width - pad.l - pad.r)
  const py = (v: number) => height - pad.b - ((v - bounds.yMin) / (bounds.yMax - bounds.yMin)) * (height - pad.t - pad.b)
  const pr = (v: number) => 4 + Math.sqrt(v / maxSize) * 13

  const xs = px(xSplit)
  const ys = py(ySplit)

  return (
    <div ref={ref} className="relative w-full min-w-0 overflow-x-auto px-2 pb-1">
      <svg viewBox={`0 0 ${width} ${height}`} width="100%" height={height} role="img" aria-label={`${yLabel} against ${xLabel} for each warehouse`}>
        {/* Quadrant grounds are the faintest possible tint: they name regions
            of the plot without competing with the marks. */}
        <rect x={pad.l} y={pad.t} width={xs - pad.l} height={ys - pad.t} fill="var(--color-canvas)" opacity="0.55" />
        <rect x={xs} y={ys} width={width - pad.r - xs} height={height - pad.b - ys} fill="var(--color-canvas)" opacity="0.55" />

        <line x1={xs} y1={pad.t} x2={xs} y2={height - pad.b} stroke="var(--color-hairline)" strokeWidth="1" />
        <line x1={pad.l} y1={ys} x2={width - pad.r} y2={ys} stroke="var(--color-hairline)" strokeWidth="1" />
        <line x1={pad.l} y1={height - pad.b} x2={width - pad.r} y2={height - pad.b} stroke="var(--color-hairline)" strokeWidth="1" />
        <line x1={pad.l} y1={pad.t} x2={pad.l} y2={height - pad.b} stroke="var(--color-hairline)" strokeWidth="1" />

        <text x={pad.l + 6} y={pad.t + 12} fontSize="9.5" fill="var(--color-ink-faint)">{quadrants.tl}</text>
        <text x={width - pad.r - 6} y={pad.t + 12} fontSize="9.5" fill="var(--color-ink-faint)" textAnchor="end">{quadrants.tr}</text>
        <text x={pad.l + 6} y={height - pad.b - 6} fontSize="9.5" fill="var(--color-ink-faint)">{quadrants.bl}</text>
        <text x={width - pad.r - 6} y={height - pad.b - 6} fontSize="9.5" fill="var(--color-ink-faint)" textAnchor="end">{quadrants.br}</text>

        <text x={width / 2} y={height - 6} fontSize="9.5" fill="var(--color-ink-muted)" textAnchor="middle">{xLabel}</text>
        <text x={12} y={height / 2} fontSize="9.5" fill="var(--color-ink-muted)" textAnchor="middle" transform={`rotate(-90 12 ${height / 2})`}>
          {yLabel}
        </text>

        {points.map((point) => (
          <circle
            key={point.id}
            cx={px(point.x)}
            cy={py(point.y)}
            r={pr(point.size)}
            fill={point.critical ? 'var(--color-bad)' : CHART_COLORS.actual}
            fillOpacity={point.critical ? 0.5 : 0.34}
            stroke={point.critical ? 'var(--color-bad)' : CHART_COLORS.actual}
            strokeWidth="1.5"
            className={onSelect ? 'cursor-pointer' : undefined}
            onClick={() => onSelect?.(point.id)}
            onMouseMove={(event) =>
              show(event, point.label, [
                { label: xLabel, value: formatPct(point.x, 1) },
                { label: yLabel, value: formatPp(point.y, 1) },
                { label: 'Capacity', value: formatNumber(point.size) },
              ])
            }
            onMouseLeave={hide}
          />
        ))}
      </svg>
      <Tooltip tip={tip} host={host} />
    </div>
  )
}

// ---------------------------------------------------------------------------
// 3. Bullet chart
// ---------------------------------------------------------------------------

export interface BulletRow {
  id: string
  label: string
  sublabel?: string
  value: number | null
  target: number
  /** Network figure, drawn as a second reference tick. */
  benchmark?: number
}

/**
 * Actual against target and a benchmark, one row per category.
 *
 * A bullet is the honest form for "did we hit the number": the bar is the
 * measure, the tick is the target, the band behind is the qualitative range.
 * A gauge shows the same thing in ten times the space and cannot be stacked.
 */
export function BulletChart({
  rows,
  max = 110,
  bands = [55, 85, 100],
  benchmarkLabel = 'Network',
}: {
  rows: BulletRow[]
  max?: number
  bands?: number[]
  benchmarkLabel?: string
}) {
  const { ref, tip, host, show, hide } = useHover()
  return (
    <div ref={ref} className="relative">
      <ul className="divide-y divide-hairline/70">
        {rows.map((row) => {
          const pct = row.value === null ? 0 : Math.min(row.value, max) / max
          const over = (row.value ?? 0) > 100
          return (
            <li
              key={row.id}
              className="flex items-center gap-3 px-4 py-2"
              onMouseMove={(event) =>
                show(event, row.label, [
                  { label: 'Actual', value: formatPct(row.value, 2) },
                  { label: 'Budget', value: formatPct(row.target, 0) },
                  ...(row.benchmark !== undefined ? [{ label: benchmarkLabel, value: formatPct(row.benchmark, 2) }] : []),
                  { label: 'Variance', value: formatPp(row.value === null ? null : row.value - row.target, 2) },
                ])
              }
              onMouseLeave={hide}
            >
              <span className="w-[112px] shrink-0">
                <span className="block text-[11.5px] font-semibold text-ink">{row.label}</span>
                {row.sublabel ? <span className="block text-[9.5px] text-ink-faint">{row.sublabel}</span> : null}
              </span>

              <span className="relative h-5 min-w-0 flex-1">
                {/* Qualitative bands: the same neutral ground at three steps,
                    never three hues - the bar carries the only colour. */}
                {bands.map((band, index) => (
                  <span
                    key={band}
                    className="absolute inset-y-0 rounded-[2px]"
                    style={{
                      left: index === 0 ? 0 : `${(bands[index - 1] / max) * 100}%`,
                      width: `${((band - (index === 0 ? 0 : bands[index - 1])) / max) * 100}%`,
                      // Three steps of the same neutral, not three hues: the
                      // bands are a backdrop and the bar carries the colour.
                      background: ['#f3f5f8', '#e9edf3', '#dee4ec'][index] ?? '#dee4ec',
                    }}
                    aria-hidden
                  />
                ))}
                <span
                  className="absolute inset-y-1.5 left-0 rounded-r-[3px]"
                  style={{ width: `${pct * 100}%`, background: over ? 'var(--color-bad)' : CHART_COLORS.actual }}
                  aria-hidden
                />
                <span
                  className="absolute -inset-y-0.5 w-[2.5px] rounded-sm bg-ink"
                  style={{ left: `${(row.target / max) * 100}%` }}
                  aria-hidden
                  title={`Budget ${row.target}%`}
                />
                {row.benchmark !== undefined ? (
                  // Drawn as two short caps in the band above and below the
                  // bar rather than a line through it: a grey rule laid over a
                  // coloured bar is unreadable at this height.
                  <span
                    className="absolute inset-y-0 w-[1.5px]"
                    style={{ left: `${(Math.min(row.benchmark, max) / max) * 100}%` }}
                    aria-hidden
                    title={`${benchmarkLabel} ${row.benchmark.toFixed(2)}%`}
                  >
                    <span className="absolute inset-x-0 top-0 h-1.5 rounded-sm bg-ink-muted" />
                    <span className="absolute inset-x-0 bottom-0 h-1.5 rounded-sm bg-ink-muted" />
                  </span>
                ) : null}
              </span>

              <span className={cn('tnum w-[58px] shrink-0 text-right text-[12.5px] font-bold', over ? 'text-bad' : 'text-ink')}>
                {formatPct(row.value, 1)}
              </span>
              <span className="tnum w-[62px] shrink-0 text-right text-[11px] font-semibold text-ink-muted">
                {formatPp(row.value === null ? null : row.value - row.target, 1)}
              </span>
            </li>
          )
        })}
      </ul>
      <Tooltip tip={tip} host={host} />
    </div>
  )
}

// ---------------------------------------------------------------------------
// 4. Dumbbell
// ---------------------------------------------------------------------------

export interface DumbbellRow {
  id: string
  label: string
  from: number | null
  to: number | null
}

/**
 * Two points in time per category, joined by the distance between them.
 *
 * One hue in two shades, because the two ends are the same measure at two
 * moments rather than two different things - a categorical pair here would
 * imply they are independent series.
 */
export function DumbbellChart({
  rows,
  fromLabel,
  toLabel,
  height = 26,
}: {
  rows: DumbbellRow[]
  fromLabel: string
  toLabel: string
  height?: number
}) {
  const { ref, tip, host, show, hide } = useHover()
  const values = rows.flatMap((r) => [r.from, r.to]).filter((v): v is number => v !== null)
  const min = Math.floor(Math.min(...values) - 3)
  const max = Math.ceil(Math.max(...values) + 3)
  const pos = (v: number) => ((v - min) / (max - min)) * 100

  return (
    <div ref={ref} className="relative">
      <ul className="divide-y divide-hairline/70">
        {rows.map((row) => {
          const moved = row.from !== null && row.to !== null ? row.to - row.from : null
          return (
            <li
              key={row.id}
              className="flex items-center gap-3 px-4 py-2"
              onMouseMove={(event) =>
                show(event, row.label, [
                  { label: fromLabel, value: formatPct(row.from, 2) },
                  { label: toLabel, value: formatPct(row.to, 2) },
                  { label: 'Movement', value: formatPp(moved, 2) },
                ])
              }
              onMouseLeave={hide}
            >
              <span className="w-[92px] shrink-0 text-[11.5px] font-semibold text-ink">{row.label}</span>
              <span className="relative min-w-0 flex-1" style={{ height }}>
                <span className="absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-hairline" aria-hidden />
                {row.from !== null && row.to !== null ? (
                  <span
                    className="absolute top-1/2 h-[3px] -translate-y-1/2 rounded-full"
                    style={{
                      left: `${Math.min(pos(row.from), pos(row.to))}%`,
                      width: `${Math.abs(pos(row.to) - pos(row.from))}%`,
                      background: SEQUENTIAL_RAMP[1],
                    }}
                    aria-hidden
                  />
                ) : null}
                {row.from !== null ? (
                  <span
                    className="absolute top-1/2 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full ring-2 ring-surface"
                    style={{ left: `${pos(row.from)}%`, background: SEQUENTIAL_RAMP[0] }}
                    aria-hidden
                  />
                ) : null}
                {row.to !== null ? (
                  <span
                    className="absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full ring-2 ring-surface"
                    style={{ left: `${pos(row.to)}%`, background: SEQUENTIAL_RAMP[4] }}
                    aria-hidden
                  />
                ) : null}
              </span>
              <span className="tnum w-[58px] shrink-0 text-right text-[12px] font-bold text-ink">{formatPct(row.to, 1)}</span>
              <span
                className={cn(
                  'tnum w-[56px] shrink-0 text-right text-[11px] font-semibold',
                  moved === null ? 'text-ink-faint' : moved > 0 ? 'text-ink-soft' : 'text-ink-soft',
                )}
              >
                {formatPp(moved, 1)}
              </span>
            </li>
          )
        })}
      </ul>
      <Tooltip tip={tip} host={host} />
    </div>
  )
}

// ---------------------------------------------------------------------------
// 5. Distribution strip
// ---------------------------------------------------------------------------

export interface StripPoint {
  id: string
  label: string
  value: number | null
  critical?: boolean
}

/**
 * Every warehouse as one dot on one axis, with the middle half shaded.
 *
 * A mean hides both tails. This shows the whole population at once: where the
 * bulk sits, how long the tails are, and which named sites are outside them.
 * Dots are nudged off the line when they collide so none is hidden.
 */
export function DistributionStrip({
  points,
  median,
  q1,
  q3,
  target,
  height = 128,
  onSelect,
}: {
  points: StripPoint[]
  median: number | null
  q1: number | null
  q3: number | null
  target?: number
  height?: number
  onSelect?: (id: string) => void
}) {
  const { ref, tip, host, show, hide } = useHover()
  const width = 720
  const pad = { l: 16, r: 16, t: 18, b: 26 }
  const values = points.map((p) => p.value).filter((v): v is number => v !== null)
  const min = Math.floor(Math.min(...values) - 4)
  const max = Math.ceil(Math.max(...values) + 4)
  const px = (v: number) => pad.l + ((v - min) / (max - min)) * (width - pad.l - pad.r)

  // Jitter is deterministic - a collision count, not a random offset - so the
  // chart is identical on every render.
  const placed: { point: StripPoint; x: number; row: number }[] = []
  for (const point of points) {
    if (point.value === null) continue
    const x = px(point.value)
    let row = 0
    while (placed.some((p) => p.row === row && Math.abs(p.x - x) < 9)) row += 1
    placed.push({ point, x, row })
  }
  const rows = Math.max(...placed.map((p) => p.row), 0) + 1
  const mid = pad.t + (height - pad.t - pad.b) / 2
  const spread = Math.min(11, (height - pad.t - pad.b) / (rows + 1))

  const ticks = [min, Math.round((min + max) / 2), max]

  return (
    <div ref={ref} className="relative w-full min-w-0 overflow-x-auto px-2 pb-1">
      <svg viewBox={`0 0 ${width} ${height}`} width="100%" height={height} role="img" aria-label="Utilization of every warehouse on one axis">
        {q1 !== null && q3 !== null ? (
          <rect
            x={px(q1)}
            y={pad.t - 4}
            width={px(q3) - px(q1)}
            height={height - pad.t - pad.b + 8}
            fill="var(--color-canvas)"
            stroke="var(--color-hairline)"
            strokeWidth="1"
            rx="3"
          />
        ) : null}
        {median !== null ? (
          <line x1={px(median)} y1={pad.t - 4} x2={px(median)} y2={height - pad.b + 4} stroke="var(--color-ink-soft)" strokeWidth="1.5" />
        ) : null}
        {target !== undefined ? (
          <line x1={px(target)} y1={pad.t - 4} x2={px(target)} y2={height - pad.b + 4} stroke="var(--color-ink-faint)" strokeWidth="1" strokeDasharray="4 3" />
        ) : null}
        <line x1={pad.l} y1={height - pad.b + 4} x2={width - pad.r} y2={height - pad.b + 4} stroke="var(--color-hairline)" strokeWidth="1" />
        {ticks.map((tick) => (
          <text key={tick} x={px(tick)} y={height - 8} fontSize="9" fill="var(--color-ink-faint)" textAnchor="middle">
            {tick}%
          </text>
        ))}
        {median !== null ? (
          <text x={px(median)} y={12} fontSize="9" fill="var(--color-ink-soft)" textAnchor="middle">
            median {median.toFixed(1)}%
          </text>
        ) : null}

        {placed.map(({ point, x, row }) => (
          <circle
            key={point.id}
            cx={x}
            cy={mid + (row % 2 === 0 ? -1 : 1) * Math.ceil(row / 2) * spread}
            r={4.5}
            fill={point.critical ? 'var(--color-bad)' : CHART_COLORS.actual}
            fillOpacity={point.critical ? 0.75 : 0.5}
            stroke="var(--color-surface)"
            strokeWidth="1.5"
            className={onSelect ? 'cursor-pointer' : undefined}
            onClick={() => onSelect?.(point.id)}
            onMouseMove={(event) => show(event, point.label, [{ label: 'Utilization', value: formatPct(point.value, 2) }])}
            onMouseLeave={hide}
          />
        ))}
      </svg>
      <Tooltip tip={tip} host={host} />
    </div>
  )
}

// ---------------------------------------------------------------------------
// 6. Treemap
// ---------------------------------------------------------------------------

export interface TreemapLeaf {
  id: string
  label: string
  parent: string
  size: number
  /** Drives the fill through the sequential ramp. */
  intensity: number | null
}

interface Rect {
  x: number
  y: number
  w: number
  h: number
}

/** Squarified slice-and-dice, deterministic for a given input order. */
function layout(items: { id: string; size: number }[], rect: Rect): Record<string, Rect> {
  const out: Record<string, Rect> = {}
  const total = items.reduce((sum, i) => sum + i.size, 0)
  if (total <= 0) return out
  let { x, y, w, h } = rect
  let remaining = total
  items.forEach((item, index) => {
    const share = item.size / remaining
    if (index === items.length - 1) {
      out[item.id] = { x, y, w, h }
      return
    }
    if (w >= h) {
      const cut = w * share
      out[item.id] = { x, y, w: cut, h }
      x += cut
      w -= cut
    } else {
      const cut = h * share
      out[item.id] = { x, y, w, h: cut }
      y += cut
      h -= cut
    }
    remaining -= item.size
  })
  return out
}

/**
 * Capacity by region and warehouse, area for size and the ramp for fullness.
 *
 * Area answers "where are our shelves"; the fill answers "how full are they".
 * Those are two different measures on one mark, which a treemap can carry
 * because area and lightness are read independently.
 */
export function CapacityTreemap({
  leaves,
  groups,
  height = 320,
  onSelect,
}: {
  leaves: TreemapLeaf[]
  groups: { id: string; label: string }[]
  height?: number
  onSelect?: (id: string) => void
}) {
  const { ref, tip, host, show, hide } = useHover()
  const width = 720
  const gap = 2

  const { groupRects, leafRects } = React.useMemo(() => {
    const sums = groups.map((group) => ({
      id: group.id,
      size: leaves.filter((l) => l.parent === group.id).reduce((sum, l) => sum + l.size, 0),
    }))
    const gRects = layout(sums, { x: 0, y: 0, w: width, h: height })
    const lRects: Record<string, Rect> = {}
    for (const group of groups) {
      const rect = gRects[group.id]
      if (!rect) continue
      const inner = { x: rect.x + gap, y: rect.y + 15, w: Math.max(rect.w - gap * 2, 1), h: Math.max(rect.h - 15 - gap, 1) }
      const members = leaves.filter((l) => l.parent === group.id).sort((a, b) => b.size - a.size)
      Object.assign(lRects, layout(members, inner))
    }
    return { groupRects: gRects, leafRects: lRects }
  }, [leaves, groups, height])

  const intensities = leaves.map((l) => l.intensity).filter((v): v is number => v !== null)
  const min = Math.min(...intensities)
  const max = Math.max(...intensities)

  return (
    <div ref={ref} className="relative w-full min-w-0 overflow-x-auto px-2 pb-1">
      <svg viewBox={`0 0 ${width} ${height}`} width="100%" height={height} role="img" aria-label="Capacity by region and warehouse, shaded by utilization">
        {groups.map((group) => {
          const rect = groupRects[group.id]
          if (!rect) return null
          return (
            <text key={group.id} x={rect.x + 4} y={rect.y + 11} fontSize="10" fontWeight="700" fill="var(--color-ink-muted)">
              {group.label}
            </text>
          )
        })}
        {leaves.map((leaf) => {
          const rect = leafRects[leaf.id]
          if (!rect || rect.w < 1 || rect.h < 1) return null
          const t = leaf.intensity === null || max <= min ? null : (leaf.intensity - min) / (max - min)
          const fill = t === null ? SEQUENTIAL_EMPTY : SEQUENTIAL_RAMP[Math.min(SEQUENTIAL_RAMP.length - 1, Math.floor(t * SEQUENTIAL_RAMP.length))]
          const dark = t !== null && t > 0.55
          return (
            <g key={leaf.id}>
              <rect
                x={rect.x + gap / 2}
                y={rect.y + gap / 2}
                width={Math.max(rect.w - gap, 0.5)}
                height={Math.max(rect.h - gap, 0.5)}
                rx={2}
                fill={fill}
                stroke="var(--color-surface)"
                strokeWidth={gap}
                className={onSelect ? 'cursor-pointer' : undefined}
                onClick={() => onSelect?.(leaf.id)}
                onMouseMove={(event) =>
                  show(event, leaf.label, [
                    { label: 'Capacity', value: formatNumber(leaf.size) },
                    { label: 'Utilization', value: formatPct(leaf.intensity, 2) },
                  ])
                }
                onMouseLeave={hide}
              />
              {rect.w > 54 && rect.h > 22 ? (
                <text
                  x={rect.x + 5}
                  y={rect.y + 14}
                  fontSize="9"
                  fontWeight="600"
                  fill={dark ? '#ffffff' : 'var(--color-ink-soft)'}
                  pointerEvents="none"
                >
                  {leaf.label}
                </text>
              ) : null}
            </g>
          )
        })}
      </svg>
      <Tooltip tip={tip} host={host} />
    </div>
  )
}

// ---------------------------------------------------------------------------
// 7. Pareto
// ---------------------------------------------------------------------------

export interface ParetoRow {
  id: string
  label: string
  value: number
}

/**
 * Concentration: how unevenly the total is distributed.
 *
 * A Pareto was the obvious first choice and it was the wrong form: this
 * network is close to evenly distributed, so the bars come out at two percent
 * each and the cumulative line is almost a straight diagonal - a chart that
 * assumes concentration, drawn on data that has none.
 *
 * A concentration curve answers the same question honestly. Both axes are
 * cumulative shares on one 0-100 scale, and the diagonal is what perfectly
 * even distribution would look like. The gap between the curve and that
 * diagonal *is* the concentration, so a flat network reads as a flat answer
 * rather than as a chart that failed to draw.
 */
export function ConcentrationCurve({
  rows,
  height = 250,
  onSelect,
}: {
  rows: ParetoRow[]
  height?: number
  onSelect?: (id: string) => void
}) {
  const { ref, tip, host, show, hide } = useHover()
  const width = 720
  const pad = { l: 44, r: 16, t: 16, b: 40 }

  const { curve, topFifthShare } = React.useMemo(() => {
    const total = rows.reduce((sum, r) => sum + r.value, 0)
    const sorted = [...rows].sort((a, b) => b.value - a.value)
    const points = sorted.reduce<{ row: ParetoRow; sitePct: number; sharePct: number; rank: number }[]>(
      (acc, row, index) => {
        const previous = acc.length === 0 ? 0 : acc[acc.length - 1].sharePct
        acc.push({
          row,
          rank: index + 1,
          sitePct: ((index + 1) / sorted.length) * 100,
          sharePct: previous + (total === 0 ? 0 : (row.value / total) * 100),
        })
        return acc
      },
      [],
    )
    const fifth = points.find((p) => p.sitePct >= 20)
    return { curve: points, topFifthShare: fifth?.sharePct ?? null }
  }, [rows])

  const px = (v: number) => pad.l + (v / 100) * (width - pad.l - pad.r)
  const py = (v: number) => height - pad.b - (v / 100) * (height - pad.t - pad.b)

  const area = `M ${px(0)},${py(0)} ` + curve.map((p) => `L ${px(p.sitePct)},${py(p.sharePct)}`).join(' ') + ` L ${px(100)},${py(100)} Z`

  return (
    <div ref={ref} className="relative w-full min-w-0 overflow-x-auto px-2 pb-1">
      <svg viewBox={`0 0 ${width} ${height}`} width="100%" height={height} role="img" aria-label="Cumulative share of occupancy against cumulative share of warehouses">
        {[0, 25, 50, 75, 100].map((tick) => (
          <g key={tick}>
            <line x1={pad.l} y1={py(tick)} x2={width - pad.r} y2={py(tick)} stroke="var(--color-hairline)" strokeWidth="1" />
            <text x={pad.l - 6} y={py(tick) + 3} fontSize="9" fill="var(--color-ink-faint)" textAnchor="end">
              {tick}%
            </text>
            <text x={px(tick)} y={height - pad.b + 14} fontSize="9" fill="var(--color-ink-faint)" textAnchor="middle">
              {tick}%
            </text>
          </g>
        ))}

        {/* The gap between the curve and the diagonal is the concentration. */}
        <path d={area} fill={SEQUENTIAL_RAMP[0]} fillOpacity="0.35" />
        <line x1={px(0)} y1={py(0)} x2={px(100)} y2={py(100)} stroke="var(--color-ink-faint)" strokeWidth="1.5" strokeDasharray="5 4" />
        <polyline
          points={[`${px(0)},${py(0)}`, ...curve.map((p) => `${px(p.sitePct)},${py(p.sharePct)}`)].join(' ')}
          fill="none"
          stroke={CHART_COLORS.actual}
          strokeWidth="2"
          strokeLinejoin="round"
        />

        {curve.map((point) => (
          <circle
            key={point.row.id}
            cx={px(point.sitePct)}
            cy={py(point.sharePct)}
            r={6}
            fill="transparent"
            className={onSelect ? 'cursor-pointer' : undefined}
            onClick={() => onSelect?.(point.row.id)}
            onMouseMove={(event) =>
              show(event, point.row.label, [
                { label: 'Rank', value: `${point.rank} of ${curve.length}` },
                { label: 'Occupied', value: formatNumber(point.row.value) },
                { label: 'Top sites so far', value: formatPct(point.sitePct, 0) },
                { label: 'Occupancy so far', value: formatPct(point.sharePct, 1) },
              ])
            }
            onMouseLeave={hide}
          />
        ))}

        {topFifthShare !== null ? (
          <>
            <line x1={px(20)} y1={py(0)} x2={px(20)} y2={py(topFifthShare)} stroke="var(--color-ink-soft)" strokeWidth="1" />
            <circle cx={px(20)} cy={py(topFifthShare)} r={4} fill={CHART_COLORS.actual} stroke="var(--color-surface)" strokeWidth="1.5" />
            <text x={px(20) + 8} y={py(topFifthShare) - 11} fontSize="9.5" fontWeight="600" fill="var(--color-ink-soft)">
              largest 20% of sites hold {topFifthShare.toFixed(0)}%
            </text>
          </>
        ) : null}

        <text x={width / 2} y={height - 6} fontSize="9.5" fill="var(--color-ink-muted)" textAnchor="middle">
          Warehouses, largest first (cumulative share)
        </text>
      </svg>
      <Tooltip tip={tip} host={host} />
    </div>
  )
}
