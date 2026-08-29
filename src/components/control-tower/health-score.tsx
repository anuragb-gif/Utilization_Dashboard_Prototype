'use client'

import * as React from 'react'
import type { HealthScore } from '@/lib/domain/types'
import { Card, CardHeader, StatusChip, StatusDot } from '@/components/ui/primitives'
import { useCountUp } from '@/components/ui/count-up'
import { HEALTH_WEIGHTS } from '@/lib/domain/health'
import { STATUS_COLORS } from '@/lib/config/brand'
import { KPI_DEFINITIONS } from '@/lib/config/kpi-definitions'
import { cn } from '@/lib/utils'

const RADIUS = 46
const CIRCUMFERENCE = 2 * Math.PI * RADIUS

/**
 * Network Health Score.
 *
 * The ring is the headline, but the component breakdown underneath is the
 * point: an executive who disagrees with the score can see exactly which
 * component and which weight produced it.
 */
export function HealthScoreCard({ health }: { health: HealthScore }) {
  const animated = useCountUp(health.score) ?? health.score
  const color = STATUS_COLORS[health.band].hex
  const [expanded, setExpanded] = React.useState(false)

  const definition = KPI_DEFINITIONS.networkHealthScore

  return (
    <Card className="flex h-full flex-col">
      <CardHeader
        title="Network Health Score"
        subtitle="Weighted composite across eight configured components"
        tip={`${definition.description}\n\nFormula: ${definition.formula}\n\nBands: 85+ healthy, 70-84 watch, 55-69 high, below 55 critical. Weights are configurable in Settings.`}
        actions={<StatusChip status={health.band} />}
      />

      <div className="flex items-center gap-4 px-4 py-3">
        <div className="relative shrink-0">
          <svg width={112} height={112} viewBox="0 0 112 112" role="img" aria-label={`Health score ${health.score} out of 100`}>
            <circle cx={56} cy={56} r={RADIUS} fill="none" stroke="#EEF2F6" strokeWidth={9} />
            <circle
              cx={56}
              cy={56}
              r={RADIUS}
              fill="none"
              stroke={color}
              strokeWidth={9}
              strokeLinecap="round"
              strokeDasharray={CIRCUMFERENCE}
              strokeDashoffset={CIRCUMFERENCE * (1 - animated / 100)}
              transform="rotate(-90 56 56)"
              style={{ transition: 'stroke-dashoffset 600ms cubic-bezier(0.22,1,0.36,1)' }}
            />
          </svg>
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
            <span className="tnum text-[28px] font-bold leading-none text-ink">{Math.round(animated)}</span>
            <span className="text-[10px] font-medium text-ink-faint">out of 100</span>
          </div>
        </div>

        <ul className="min-w-0 flex-1 space-y-1">
          {health.components.map((component) => (
            <li key={component.id} className="flex items-center gap-2">
              <StatusDot status={component.status} />
              <span className="min-w-0 flex-1 truncate text-[11px] text-ink-soft">{component.label}</span>
              <span className="tnum w-8 text-right text-[11px] font-semibold text-ink">{Math.round(component.score)}</span>
              <span className="tnum w-8 text-right text-[10px] text-ink-faint">×{component.weight}</span>
            </li>
          ))}
        </ul>
      </div>

      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
        className="no-print border-t border-hairline px-4 py-2 text-left text-[11.5px] font-medium text-brand-600 transition-colors hover:bg-slate-50"
      >
        {expanded ? 'Hide how this is calculated' : 'How is this calculated?'}
      </button>

      {expanded ? (
        <div className="ct-enter border-t border-hairline bg-slate-50 px-4 py-3">
          <p className="mb-2 text-[11px] leading-relaxed text-ink-muted">
            Each component is scored 0–100 from a metric shown elsewhere in this application, then combined as a
            weighted mean. Total weight {Object.values(HEALTH_WEIGHTS).reduce((a, b) => a + b, 0)}.
          </p>
          <dl className="space-y-2">
            {health.components.map((component) => (
              <div key={component.id} className="grid grid-cols-[1fr_auto] gap-x-3">
                <dt className="text-[11.5px] font-semibold text-ink">{component.label}</dt>
                <dd className="tnum text-[11.5px] font-semibold text-ink">
                  {Math.round(component.score)}{' '}
                  <span className="font-normal text-ink-faint">× {component.weight}</span>
                </dd>
                <dd className={cn('col-span-2 text-[11px] leading-relaxed text-ink-muted')}>{component.detail}</dd>
              </div>
            ))}
          </dl>
        </div>
      ) : null}
    </Card>
  )
}
