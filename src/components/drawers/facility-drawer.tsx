'use client'

import * as React from 'react'
import Link from 'next/link'
import { ExternalLink } from 'lucide-react'
import type { FacilityRollup } from '@/lib/domain/types'
import { Drawer } from '@/components/ui/drawer'
import { DeltaChip, SeverityChip, Sparkline, StatusChip, UtilizationBar, Value } from '@/components/ui/primitives'
import { UtilizationTrendChart } from '@/components/charts/utilization-trend'
import { useSnapshot } from '@/lib/state/use-snapshot'
import { FACILITY_TYPE_LABEL, OWNERSHIP_LABEL, EXECUTION_LABEL, ZONE_BY_ID } from '@/lib/data/master'
import { formatNumber, formatPct, formatPp } from '@/lib/utils'
import { THRESHOLDS } from '@/lib/config/thresholds'

function Stat({ label, value, tone }: { label: string; value: React.ReactNode; tone?: 'bad' | 'ok' }) {
  return (
    <div className="rounded-md border border-hairline bg-surface px-3 py-2">
      <p className="text-[9.5px] font-semibold uppercase tracking-wider text-ink-faint">{label}</p>
      <p className={`tnum mt-0.5 text-[17px] font-bold ${tone === 'bad' ? 'text-bad' : tone === 'ok' ? 'text-ok' : 'text-ink'}`}>
        {value}
      </p>
    </div>
  )
}

/**
 * Facility quick-look.
 *
 * Opened from the exception board so a manager can triage without losing the
 * list they were reading. The full facility page is one click away and holds
 * chamber, location and inventory detail.
 */
export function FacilityDrawer({ facility, onClose }: { facility: FacilityRollup | null; onClose: () => void }) {
  const scoped = React.useMemo(
    () => (facility ? { facilityIds: [facility.facilityId] } : undefined),
    [facility],
  )
  const snapshot = useSnapshot(scoped)

  if (!facility) return null

  const over = (facility.utilizationPct ?? 0) > 100
  const facilityExceptions = snapshot.exceptions.filter((e) => e.facilityId === facility.facilityId)

  return (
    <Drawer
      open={Boolean(facility)}
      onClose={onClose}
      width="xl"
      title={
        <span className="flex items-center gap-2">
          {facility.code}
          <span className="text-[13px] font-normal text-ink-muted">{facility.name}</span>
        </span>
      }
      subtitle={
        <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span>{facility.regionId}</span>
          <span>· {facility.cityName}</span>
          <span>· {FACILITY_TYPE_LABEL[facility.type]}</span>
          <span>· {OWNERSHIP_LABEL[facility.ownership]}</span>
          <span>· {EXECUTION_LABEL[facility.execution]}</span>
          <span>· Manager {facility.owner}</span>
        </span>
      }
      footer={
        <Link
          href={`/warehouses/${encodeURIComponent(facility.facilityId)}`}
          className="inline-flex h-9 items-center gap-1.5 rounded-md border border-brand-500 bg-brand-500 px-3 text-[13px] font-medium text-white transition-colors hover:bg-brand-600"
        >
          <ExternalLink className="h-3.5 w-3.5" strokeWidth={2.5} aria-hidden />
          Open full facility detail
        </Link>
      }
    >
      <div className="space-y-4">
        {over ? (
          <div className="rounded-lg border border-bad-line bg-bad-soft px-4 py-3">
            <p className="text-[13px] font-bold uppercase tracking-wide text-[#9b1c1c]">Over capacity</p>
            <p className="tnum mt-0.5 text-[12px] text-[#9b1c1c]">
              {formatPct(facility.utilizationPct)} of capacity · {formatNumber(facility.overCapacityPallets)} pallets held
              above the capacity master.
            </p>
          </div>
        ) : null}

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Stat
            label="Utilization"
            tone={over ? 'bad' : undefined}
            value={
              <Value missing={facility.utilizationPct === null} reason="Capacity master missing.">
                {formatPct(facility.utilizationPct, 1)}
              </Value>
            }
          />
          <Stat label="Capacity" value={<Value missing={facility.capacity === null}>{formatNumber(facility.capacity)}</Value>} />
          <Stat label="Occupied" value={formatNumber(facility.utilizedPallets)} />
          <Stat
            label="Available"
            value={<Value missing={facility.availableCapacity === null}>{formatNumber(facility.availableCapacity)}</Value>}
          />
        </div>

        <div className="rounded-lg border border-hairline bg-surface p-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <StatusChip status={facility.status} />
              <SeverityChip severity={facility.risk} />
              {facility.primaryReason ? (
                <span className="text-[12px] font-medium text-ink-soft">{facility.primaryReason}</span>
              ) : null}
            </div>
            <div className="flex items-center gap-3 text-[11.5px]">
              <span className="text-ink-muted">
                Budget {facility.targetPct}% · variance{' '}
                <strong className="tnum text-ink">{formatPp(facility.variancePct)}</strong>
              </span>
              <span className="flex items-center gap-1.5">
                <Sparkline values={facility.spark} status={facility.status} label="14-day utilization" />
                <DeltaChip value={facility.change7dPct} />
              </span>
            </div>
          </div>
          <UtilizationBar pct={facility.utilizationPct} targetPct={facility.targetPct} className="mt-2.5" />
        </div>

        <section className="rounded-lg border border-hairline bg-surface">
          <h3 className="border-b border-hairline px-3 py-2 text-[11px] font-semibold uppercase tracking-wider text-ink-muted">
            Forecast · prototype
          </h3>
          <dl className="grid grid-cols-4 gap-2 px-3 py-2.5">
            {(
              [
                ['Current', facility.utilizationPct],
                ['7 day', facility.forecast7dPct],
                ['14 day', facility.forecast14dPct],
                ['30 day', facility.forecast30dPct],
              ] as const
            ).map(([label, value]) => (
              <div key={label}>
                <dt className="text-[9.5px] font-semibold uppercase tracking-wider text-ink-faint">{label}</dt>
                <dd
                  className={`tnum text-[15px] font-bold ${
                    value !== null && value >= 100 ? 'text-bad' : value !== null && value >= THRESHOLDS.breachThresholdPct ? 'text-hot' : 'text-ink'
                  }`}
                >
                  <Value missing={value === null}>{formatPct(value, 1)}</Value>
                </dd>
              </div>
            ))}
          </dl>
          {facility.expectedBreachDate ? (
            <p className="border-t border-hairline px-3 py-1.5 text-[11px] text-warn">
              Projected to cross {THRESHOLDS.breachThresholdPct}% on {facility.expectedBreachDate}.
            </p>
          ) : null}
        </section>

        <section className="rounded-lg border border-hairline bg-surface">
          <h3 className="border-b border-hairline px-3 py-2 text-[11px] font-semibold uppercase tracking-wider text-ink-muted">
            Temperature zones
          </h3>
          <table className="w-full border-collapse">
            <caption className="sr-only">Data table</caption>
            <thead>
              <tr className="text-[10px] uppercase tracking-wider text-ink-faint">
                <th scope="col" className="px-3 py-1 text-left font-semibold">Zone</th>
                <th scope="col" className="px-3 py-1 text-right font-semibold">Capacity</th>
                <th scope="col" className="px-3 py-1 text-right font-semibold">Occupied</th>
                <th scope="col" className="px-3 py-1 text-right font-semibold">Utilization</th>
                <th scope="col" className="px-3 py-1 text-right font-semibold">Compliance</th>
              </tr>
            </thead>
            <tbody>
              {snapshot.zones.map((zone) => (
                <tr key={zone.zoneId} className="border-t border-hairline/70">
                  <td className="px-3 py-1.5 text-[11.5px] font-medium text-ink">
                    {zone.zoneName}
                    <span className="ml-1.5 text-[10px] text-ink-faint">{ZONE_BY_ID[zone.zoneId].setPoint}</span>
                  </td>
                  <td className="tnum px-3 py-1.5 text-right text-[11.5px]">{formatNumber(zone.capacity)}</td>
                  <td className="tnum px-3 py-1.5 text-right text-[11.5px]">{formatNumber(zone.utilizedPallets)}</td>
                  <td className="tnum px-3 py-1.5 text-right text-[11.5px] font-semibold">
                    {formatPct(zone.utilizationPct, 1)}
                  </td>
                  <td className="tnum px-3 py-1.5 text-right text-[11.5px]">
                    <Value missing={zone.temperatureCompliancePct === null} reason="Ambient storage has no set-point band.">
                      {formatPct(zone.temperatureCompliancePct, 2)}
                    </Value>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <section className="rounded-lg border border-hairline bg-surface">
          <h3 className="border-b border-hairline px-3 py-2 text-[11px] font-semibold uppercase tracking-wider text-ink-muted">
            Utilization trend
          </h3>
          <UtilizationTrendChart
            history={snapshot.series.history}
            forecast={snapshot.series.forecast}
            targetPct={facility.targetPct}
            height={200}
            defaultRange="30D"
          />
        </section>

        {facilityExceptions.length > 0 ? (
          <section className="rounded-lg border border-hairline bg-surface">
            <h3 className="border-b border-hairline px-3 py-2 text-[11px] font-semibold uppercase tracking-wider text-ink-muted">
              Open exceptions ({facilityExceptions.length})
            </h3>
            <ul className="divide-y divide-hairline">
              {facilityExceptions.map((exception) => (
                <li key={exception.id} className="px-3 py-2">
                  <p className="flex items-center gap-2 text-[12px] font-semibold text-ink">
                    <SeverityChip severity={exception.severity} />
                    {exception.metricLabel}
                  </p>
                  <p className="mt-0.5 text-[11px] leading-relaxed text-ink-muted">{exception.reason}</p>
                  <p className="mt-1 text-[11px] leading-relaxed text-brand-700">
                    <strong>Recommended:</strong> {exception.recommendedAction}
                  </p>
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </div>
    </Drawer>
  )
}
