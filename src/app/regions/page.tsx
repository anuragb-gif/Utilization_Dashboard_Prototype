'use client'

import * as React from 'react'
import Link from 'next/link'
import { PageHeader } from '@/components/layout/page-header'
import { IndiaRegionMap } from '@/components/charts/india-map'
import { RegionRanking } from '@/components/control-tower/region-ranking'
import { Card, CardHeader, DeltaChip, StatusChip, UtilizationBar, Value } from '@/components/ui/primitives'
import { BasisImpact, CapacityMixBar } from '@/components/panels/basis-bands'
import { useSnapshot } from '@/lib/state/use-snapshot'
import { REGION_BY_ID } from '@/lib/data/master'
import { formatNumber, formatPct, formatPp } from '@/lib/utils'

export default function RegionsPage() {
  const snapshot = useSnapshot()
  const pnpByRegion = React.useMemo(
    () => new Map(snapshot.parkAndPay.regions.map((row) => [row.regionId, row])),
    [snapshot.parkAndPay.regions],
  )

  return (
    <div className="space-y-4">
      <PageHeader
        title="Regions"
        description="Regional position across the network. Every tile and every map bubble opens the region's detail view."
        crumbs={[{ label: 'Control Tower', href: '/' }, { label: 'Regions' }]}
      />

      <Card>
        <CardHeader title="Region Heatmap" subtitle="Sized by capacity, coloured by utilization band" />
        <IndiaRegionMap regions={snapshot.regions} facilities={snapshot.facilities} height={360} />
      </Card>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {snapshot.regions.map((region) => {
          const over = (region.utilizationPct ?? 0) > 100
          const pnp = pnpByRegion.get(region.regionId)
          return (
            <Link key={region.regionId} href={`/regions/${encodeURIComponent(region.regionId)}`} className="block">
              <Card className={`h-full p-4 transition-shadow hover:shadow-[0_2px_10px_rgba(16,24,40,0.1)] ${over ? 'border-bad-line' : ''}`}>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-[14px] font-bold text-ink">{region.regionId}</p>
                    <p className="text-[11px] text-ink-muted">{REGION_BY_ID[region.regionId]?.head}</p>
                  </div>
                  <StatusChip status={region.status} label={over ? 'Over capacity' : undefined} />
                </div>

                <p className={`tnum mt-3 text-[30px] font-bold leading-none ${over ? 'text-bad' : 'text-ink'}`}>
                  <Value missing={region.utilizationPct === null}>{formatPct(region.utilizationPct, 1)}</Value>
                </p>
                {over ? (
                  <p className="tnum mt-0.5 text-[11px] font-bold uppercase tracking-wide text-bad">
                    +{formatNumber(region.overCapacityPallets)} pallets over capacity
                  </p>
                ) : (
                  <p className="tnum mt-0.5 text-[11px] text-ink-muted">
                    {formatNumber(region.availableCapacity)} pallet positions available
                  </p>
                )}
                <UtilizationBar pct={region.utilizationPct} targetPct={region.targetPct} className="mt-2" />

                <dl className="tnum mt-3 grid grid-cols-3 gap-2 text-[11px]">
                  <div>
                    <dt className="text-[9.5px] uppercase tracking-wider text-ink-faint">Capacity</dt>
                    <dd className="font-semibold text-ink">{formatNumber(region.capacity)}</dd>
                  </div>
                  <div>
                    <dt className="text-[9.5px] uppercase tracking-wider text-ink-faint">Occupied</dt>
                    <dd className="font-semibold text-ink">{formatNumber(region.utilizedPallets)}</dd>
                  </div>
                  <div>
                    <dt className="text-[9.5px] uppercase tracking-wider text-ink-faint">Facilities</dt>
                    <dd className="font-semibold text-ink">{region.facilityCount}</dd>
                  </div>
                </dl>

                <div className="mt-3 flex items-center justify-between border-t border-hairline pt-2 text-[11px]">
                  <span className="text-ink-muted">
                    Budget {region.targetPct}% ·{' '}
                    <strong className="tnum text-ink">{formatPp(region.variancePct)}</strong>
                  </span>
                  <DeltaChip value={region.change7dPct} />
                </div>

                {/* The figures above are the own network. This is what the same
                    region reads once the space rented inside it is included -
                    kept to one line, because for most regions it barely moves. */}
                <div className="mt-2 border-t border-hairline pt-2">
                  {pnp && pnp.siteCount > 0 ? (
                    <>
                      <div className="flex items-baseline justify-between gap-2">
                        <span className="text-[9.5px] font-semibold uppercase tracking-[0.1em] text-ink-faint">
                          With Park &amp; Pay
                        </span>
                        <span className="tnum text-[12px] font-bold text-ink">
                          {formatPct(pnp.comparison.combined.utilizationPct, 1)}
                        </span>
                        <BasisImpact value={pnp.comparison.utilizationImpactPp} className="text-[10.5px]" />
                      </div>
                      <CapacityMixBar
                        ownCapacity={pnp.comparison.own.capacity}
                        pnpCapacity={pnp.comparison.parkAndPay.capacity}
                        className="mt-1.5 h-1.5"
                      />
                      <p className="tnum mt-1 text-[9.5px] text-ink-faint">
                        {pnp.siteCount} rented {pnp.siteCount === 1 ? 'location' : 'locations'} ·{' '}
                        {formatNumber(pnp.comparison.parkAndPay.capacity)} positions at{' '}
                        {formatPct(pnp.comparison.parkAndPay.utilizationPct, 1)}
                      </p>
                    </>
                  ) : (
                    <p className="text-[9.5px] text-ink-faint">
                      No Park &amp; Pay space — the figures above are the whole region
                    </p>
                  )}
                </div>
              </Card>
            </Link>
          )
        })}
      </div>

      <RegionRanking regions={snapshot.regions} reportDate={snapshot.network.reportDate} />
    </div>
  )
}
