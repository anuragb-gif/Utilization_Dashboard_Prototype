'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import type { FacilityRollup, RegionRollup } from '@/lib/domain/types'
import { STATUS_META } from '@/components/ui/primitives'
import { STATUS_COLORS } from '@/lib/config/brand'
import { CITY_BY_ID, REGION_BY_ID } from '@/lib/data/master'
import { formatNumber, formatPct } from '@/lib/utils'

/**
 * Simplified India outline, as [longitude, latitude] pairs.
 *
 * A schematic coastline and northern border - enough to orient a reader
 * without shipping a topology file. Facility and region markers are placed by
 * their real coordinates through the same projection, so the geography is
 * accurate even though the outline is stylised.
 */
const INDIA_OUTLINE: [number, number][] = [
  [68.2, 23.7], [68.9, 22.3], [70.1, 22.4], [70.9, 20.8], [72.0, 21.1], [72.6, 21.7], [72.9, 20.7],
  [72.8, 19.2], [73.3, 17.9], [73.5, 16.0], [74.1, 14.8], [74.8, 13.0], [75.5, 11.6], [76.3, 9.5],
  [77.5, 8.1], [78.2, 9.0], [79.3, 10.3], [79.8, 11.9], [80.3, 13.1], [80.2, 15.9], [81.2, 16.3],
  [82.3, 16.9], [83.3, 17.7], [84.7, 19.1], [86.5, 20.1], [87.0, 21.5], [88.1, 21.6], [88.9, 22.0],
  [88.7, 24.5], [88.0, 25.2], [89.8, 26.0], [89.6, 26.2], [92.0, 26.9], [94.0, 27.5], [95.3, 27.0],
  [96.0, 27.7], [97.4, 28.2], [96.5, 28.4], [95.0, 27.1], [94.5, 27.7], [92.0, 27.9], [89.1, 27.3],
  [88.2, 27.9], [88.0, 26.7], [85.0, 27.0], [81.0, 30.0], [80.0, 30.5], [78.8, 31.3], [79.0, 32.5],
  [78.7, 34.0], [78.9, 35.5], [77.0, 35.5], [76.0, 34.6], [74.0, 34.6], [73.9, 33.2], [74.6, 32.5],
  [75.3, 32.3], [74.5, 31.7], [73.9, 30.0], [73.0, 29.5], [70.6, 28.0], [70.1, 26.5], [68.8, 24.3],
]

const LNG_MIN = 67.6
const LNG_MAX = 98.0
const LAT_MIN = 7.2
const LAT_MAX = 36.2
const WIDTH = 300
// Correct the horizontal squeeze at India's mean latitude so the outline is
// not stretched east-west.
const HEIGHT = Math.round((WIDTH * (LAT_MAX - LAT_MIN)) / ((LNG_MAX - LNG_MIN) * Math.cos((22 * Math.PI) / 180)))

function project(lng: number, lat: number): [number, number] {
  const x = ((lng - LNG_MIN) / (LNG_MAX - LNG_MIN)) * WIDTH
  const y = ((LAT_MAX - lat) / (LAT_MAX - LAT_MIN)) * HEIGHT
  return [Number(x.toFixed(2)), Number(y.toFixed(2))]
}

const OUTLINE_PATH = `${INDIA_OUTLINE.map(([lng, lat], i) => {
  const [x, y] = project(lng, lat)
  return `${i === 0 ? 'M' : 'L'}${x},${y}`
}).join(' ')} Z`

function statusFill(status: string): string {
  return STATUS_COLORS[status as keyof typeof STATUS_COLORS]?.hex ?? STATUS_COLORS.unknown.hex
}

/**
 * Region heatmap.
 *
 * Region bubbles are sized by capacity and coloured by utilization band, with
 * the percentage printed on the bubble - so the map is readable without the
 * legend and works in greyscale print. Over-capacity regions carry an
 * explicit "over capacity" callout rather than being clipped to 100%.
 */
export function IndiaRegionMap({
  regions,
  facilities,
  onSelect,
  height = 380,
}: {
  regions: RegionRollup[]
  facilities: FacilityRollup[]
  onSelect?: (regionId: string) => void
  height?: number
}) {
  const router = useRouter()
  const [hovered, setHovered] = React.useState<string | null>(null)

  const maxCapacity = Math.max(...regions.map((r) => r.capacity ?? 0), 1)

  function activate(regionId: string) {
    if (onSelect) onSelect(regionId)
    else router.push(`/regions/${encodeURIComponent(regionId)}`)
  }

  return (
    <div className="flex flex-col gap-3 px-4 py-3 lg:flex-row">
      <div className="shrink-0" style={{ height }}>
        <svg
          viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
          height={height}
          role="img"
          aria-label="Map of India showing utilization by region"
          className="h-full"
        >
          <path d={OUTLINE_PATH} fill="#EDF2F7" stroke="#CBD5E1" strokeWidth={0.8} strokeLinejoin="round" />

          {/* Facility dots, placed at their city's real coordinates. */}
          {facilities.map((facility) => {
            const city = CITY_BY_ID[facility.cityId]
            if (!city) return null
            const [x, y] = project(city.lng, city.lat)
            return (
              <circle
                key={facility.facilityId}
                cx={x}
                cy={y}
                r={1.6}
                fill={statusFill(facility.status)}
                fillOpacity={0.55}
              >
                <title>{`${facility.code} · ${facility.name} · ${formatPct(facility.utilizationPct)}`}</title>
              </circle>
            )
          })}

          {regions.map((region) => {
            const meta = REGION_BY_ID[region.regionId]
            const [x, y] = project(meta.lng, meta.lat)
            const radius = 12 + ((region.capacity ?? 0) / maxCapacity) * 12
            const over = (region.utilizationPct ?? 0) > 100
            const active = hovered === region.regionId
            return (
              <g
                key={region.regionId}
                role="button"
                tabIndex={0}
                aria-label={`${region.regionId}, utilization ${formatPct(region.utilizationPct)}${over ? ', over capacity' : ''}`}
                onClick={() => activate(region.regionId)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    activate(region.regionId)
                  }
                }}
                onMouseEnter={() => setHovered(region.regionId)}
                onMouseLeave={() => setHovered(null)}
                onFocus={() => setHovered(region.regionId)}
                onBlur={() => setHovered(null)}
                className="cursor-pointer outline-none"
              >
                {over ? <circle cx={x} cy={y} r={radius + 4} fill={statusFill('critical')} fillOpacity={0.14} /> : null}
                <circle
                  cx={x}
                  cy={y}
                  r={radius}
                  fill={statusFill(region.status)}
                  fillOpacity={active ? 0.95 : 0.85}
                  stroke="#fff"
                  strokeWidth={active ? 2.5 : 1.5}
                />
                <text
                  x={x}
                  y={y - 1}
                  textAnchor="middle"
                  fontSize={8.5}
                  fontWeight={700}
                  fill="#fff"
                  className="tnum pointer-events-none"
                >
                  {region.utilizationPct === null ? 'N/A' : `${region.utilizationPct.toFixed(0)}%`}
                </text>
                <text
                  x={x}
                  y={y + 7.5}
                  textAnchor="middle"
                  fontSize={6}
                  fontWeight={600}
                  fill="#fff"
                  fillOpacity={0.85}
                  className="pointer-events-none"
                >
                  {region.regionId}
                </text>
              </g>
            )
          })}
        </svg>
      </div>

      <ul className="grid min-w-0 flex-1 gap-1.5 self-start sm:grid-cols-2">
        {regions.map((region) => {
          const over = (region.utilizationPct ?? 0) > 100
          const meta = STATUS_META[region.status]
          const Icon = meta.icon
          return (
            <li key={region.regionId}>
              <button
                type="button"
                onClick={() => activate(region.regionId)}
                onMouseEnter={() => setHovered(region.regionId)}
                onMouseLeave={() => setHovered(null)}
                className={`w-full rounded-md border p-2.5 text-left transition-colors ${
                  hovered === region.regionId ? 'border-brand-300 bg-brand-50' : 'border-hairline bg-surface hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[12px] font-semibold text-ink">{region.regionId}</span>
                  <span className="tnum text-[15px] font-bold" style={{ color: statusFill(region.status) }}>
                    {formatPct(region.utilizationPct, 1)}
                  </span>
                </div>
                <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${Math.min(region.utilizationPct ?? 0, 100)}%`,
                      background: statusFill(region.status),
                    }}
                  />
                </div>
                <p className="tnum mt-1 flex items-center gap-1 text-[10.5px] text-ink-muted">
                  <Icon className="h-2.5 w-2.5" strokeWidth={2.5} aria-hidden />
                  {over ? (
                    <span className="font-semibold text-bad">
                      OVER CAPACITY +{formatNumber(region.overCapacityPallets)} pallets
                    </span>
                  ) : (
                    <span>
                      {formatNumber(region.availableCapacity)} available · budget {region.targetPct}%
                    </span>
                  )}
                </p>
              </button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
