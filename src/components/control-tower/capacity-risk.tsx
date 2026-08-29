'use client'

import * as React from 'react'
import Link from 'next/link'
import { CalendarClock } from 'lucide-react'
import type { FacilityRollup } from '@/lib/domain/types'
import { Card, CardHeader, DrilldownLink, SeverityChip, StatusChip, Value } from '@/components/ui/primitives'
import { THRESHOLDS } from '@/lib/config/thresholds'
import { SEVERITY_RANK } from '@/lib/config/thresholds'
import { formatIst, formatPct } from '@/lib/utils'
import { cn } from '@/lib/utils'

/**
 * Capacity risk forecast.
 *
 * Answers one question: which warehouses are likely to breach the planning
 * threshold, and when. Values come from the deterministic projection in
 * src/lib/domain/metrics.ts and are labelled as a prototype forecast
 * everywhere they appear - there is no trained model behind them.
 */
export function CapacityRiskForecast({
  facilities,
  limit = 6,
  showAllHref = '/capacity',
}: {
  facilities: FacilityRollup[]
  limit?: number
  showAllHref?: string
}) {
  const atRisk = React.useMemo(
    () =>
      facilities
        .filter(
          (f) =>
            (f.forecast30dPct !== null && f.forecast30dPct >= THRESHOLDS.breachThresholdPct) ||
            (f.utilizationPct !== null && f.utilizationPct >= THRESHOLDS.breachThresholdPct),
        )
        .sort((a, b) => {
          const bySeverity = SEVERITY_RANK[a.risk] - SEVERITY_RANK[b.risk]
          if (bySeverity !== 0) return bySeverity
          return (b.forecast30dPct ?? 0) - (a.forecast30dPct ?? 0)
        }),
    [facilities],
  )

  const shown = atRisk.slice(0, limit)

  return (
    <Card className="flex h-full flex-col">
      <CardHeader
        title="Capacity Risk Forecast"
        subtitle={`Facilities at or projected above ${THRESHOLDS.breachThresholdPct}% utilization`}
        tip={`Projection is a damped trend extrapolation of the last 14 days with a weekday index, run per facility. It is a prototype forecast to demonstrate the decision flow, not a trained model — the method is documented in src/lib/domain/metrics.ts and shown in Settings.`}
        actions={
          <span className="inline-flex items-center gap-1 rounded border border-violet-200 bg-violet-50 px-1.5 py-0.5 text-[9.5px] font-semibold uppercase tracking-wide text-violet-700">
            Prototype forecast
          </span>
        }
      />

      {shown.length === 0 ? (
        <p className="px-4 py-8 text-center text-[12px] text-ink-muted">
          No facility is at or projected above {THRESHOLDS.breachThresholdPct}% within 30 days.
        </p>
      ) : (
        <div className="w-full min-w-0 overflow-x-auto">
          <table className="w-full border-collapse">
            <caption className="sr-only">Facilities projected to breach the planning threshold</caption>
            <thead>
              <tr className="border-b border-hairline bg-slate-50/70 text-[10px] uppercase tracking-wider text-ink-muted">
                <th scope="col" className="px-3 py-1.5 text-left font-semibold">Facility</th>
                <th scope="col" className="px-2 py-1.5 text-right font-semibold">Current</th>
                <th scope="col" className="px-2 py-1.5 text-right font-semibold">7d</th>
                <th scope="col" className="px-2 py-1.5 text-right font-semibold">14d</th>
                <th scope="col" className="px-2 py-1.5 text-right font-semibold">30d</th>
                <th scope="col" className="px-2 py-1.5 text-left font-semibold">Breach</th>
                <th scope="col" className="px-3 py-1.5 text-center font-semibold">Risk</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((facility) => {
                const already = (facility.utilizationPct ?? 0) >= THRESHOLDS.breachThresholdPct
                return (
                  <tr key={facility.facilityId} className="border-b border-hairline/70 last:border-0 hover:bg-slate-50/60">
                    <td className="px-3 py-1.5">
                      <Link
                        href={`/warehouses/${encodeURIComponent(facility.facilityId)}`}
                        className="text-[11.5px] font-semibold text-brand-600 hover:underline"
                      >
                        {facility.code}
                      </Link>
                      <p className="text-[10px] text-ink-faint">
                        {facility.regionId} · {facility.cityName}
                      </p>
                    </td>
                    <td className="tnum px-2 py-1.5 text-right">
                      <span className={cn('text-[11.5px] font-bold', (facility.utilizationPct ?? 0) > 100 ? 'text-bad' : 'text-ink')}>
                        {formatPct(facility.utilizationPct, 1)}
                      </span>
                    </td>
                    {([facility.forecast7dPct, facility.forecast14dPct, facility.forecast30dPct] as const).map(
                      (value, index) => (
                        <td key={index} className="tnum px-2 py-1.5 text-right text-[11.5px]">
                          <span
                            className={cn(
                              value !== null && value >= 100
                                ? 'font-semibold text-bad'
                                : value !== null && value >= THRESHOLDS.breachThresholdPct
                                  ? 'font-semibold text-hot'
                                  : 'text-ink-soft',
                            )}
                          >
                            <Value missing={value === null}>{formatPct(value, 1)}</Value>
                          </span>
                        </td>
                      ),
                    )}
                    <td className="px-2 py-1.5 text-[11px]">
                      {already ? (
                        <span className="font-semibold text-bad">Already above</span>
                      ) : facility.expectedBreachDate ? (
                        <span className="inline-flex items-center gap-1 font-medium text-warn">
                          <CalendarClock className="h-3 w-3" strokeWidth={2.25} aria-hidden />
                          {formatIst(facility.expectedBreachDate, 'dd MMM')}
                        </span>
                      ) : (
                        <span className="text-ink-faint">Not within 30d</span>
                      )}
                    </td>
                    <td className="px-3 py-1.5 text-center">
                      <SeverityChip severity={facility.risk} />
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {atRisk.length > shown.length ? (
        <div className="mt-auto border-t border-hairline px-4 py-2 no-print">
          <DrilldownLink href={showAllHref}>View all {atRisk.length} risk facilities</DrilldownLink>
        </div>
      ) : null}
    </Card>
  )
}

export { StatusChip }
