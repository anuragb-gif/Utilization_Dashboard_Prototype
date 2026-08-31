'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { PageHeader } from '@/components/layout/page-header'
import { Card, CardHeader, SectionTitle, StatusChip, Value } from '@/components/ui/primitives'
import {
  BulletChart,
  CalendarHeatmap,
  CapacityTreemap,
  ChartLegend,
  DistributionStrip,
  DumbbellChart,
  ConcentrationCurve,
  QuadrantBubble,
  type BulletRow,
  type DumbbellRow,
  type ParetoRow,
  type QuadrantPoint,
  type StripPoint,
  type TreemapLeaf,
} from '@/components/charts/analytics'
import { useSnapshot } from '@/lib/state/use-snapshot'
import { REGION_ORDER } from '@/lib/data/master'
import { CHART_COLORS, SEQUENTIAL_RAMP } from '@/lib/config/brand'
import { THRESHOLDS } from '@/lib/config/thresholds'
import { formatDate, formatNumber, formatPct, formatPp } from '@/lib/utils'

/** Quartiles from a sorted sample, linear interpolation between neighbours. */
function quantile(sorted: number[], q: number): number | null {
  if (sorted.length === 0) return null
  const pos = (sorted.length - 1) * q
  const lower = Math.floor(pos)
  const upper = Math.ceil(pos)
  if (lower === upper) return sorted[lower]
  return sorted[lower] + (sorted[upper] - sorted[lower]) * (pos - lower)
}

/**
 * Analytics.
 *
 * Four questions in order, each with the form that answers it fastest:
 * where the capacity sits, how evenly it is used, what is moving, and what the
 * year looks like. Every panel carries a written read underneath, because a
 * chart nobody can summarise in a sentence is decoration.
 *
 * Colour discipline throughout: one validated sequential hue for magnitude,
 * status colour only where something genuinely is a status, no cycled hues and
 * no second y-axis anywhere.
 */
export default function AnalyticsPage() {
  const snapshot = useSnapshot()
  const router = useRouter()
  const openFacility = React.useCallback(
    (id: string) => router.push(`/warehouses/${encodeURIComponent(id)}`),
    [router],
  )

  const withCapacity = React.useMemo(
    () => snapshot.facilities.filter((f) => f.capacity !== null && f.utilizationPct !== null),
    [snapshot.facilities],
  )

  // ---- Where the capacity sits ------------------------------------------
  const treemap = React.useMemo<TreemapLeaf[]>(
    () =>
      withCapacity.map((f) => ({
        id: f.facilityId,
        label: f.code.replace('SNL-', ''),
        parent: f.regionId,
        size: f.capacity ?? 0,
        intensity: f.utilizationPct,
      })),
    [withCapacity],
  )
  const treemapGroups = React.useMemo(
    () =>
      REGION_ORDER.filter((r) => treemap.some((l) => l.parent === r)).map((r) => ({ id: r as string, label: r as string })),
    [treemap],
  )

  const pareto = React.useMemo<ParetoRow[]>(
    () => withCapacity.map((f) => ({ id: f.facilityId, label: f.code, value: f.utilizedPallets })),
    [withCapacity],
  )
  const concentration = React.useMemo(() => {
    const total = pareto.reduce((sum, r) => sum + r.value, 0)
    const sorted = [...pareto].sort((a, b) => b.value - a.value)
    const running = sorted.reduce<number[]>((acc, row) => {
      acc.push((acc.length === 0 ? 0 : acc[acc.length - 1]) + (total === 0 ? 0 : (row.value / total) * 100))
      return acc
    }, [])
    const fifth = Math.max(1, Math.ceil(sorted.length * 0.2))
    const halfIndex = running.findIndex((v) => v >= 50)
    return {
      of: sorted.length,
      topFifthSites: fifth,
      topFifthShare: running[fifth - 1] ?? null,
      halfCount: halfIndex < 0 ? sorted.length : halfIndex + 1,
    }
  }, [pareto])

  // ---- How evenly it is used --------------------------------------------
  const strip = React.useMemo<StripPoint[]>(
    () =>
      withCapacity.map((f) => ({
        id: f.facilityId,
        label: `${f.code} · ${f.cityName}`,
        value: f.utilizationPct,
        critical: (f.utilizationPct ?? 0) > 100,
      })),
    [withCapacity],
  )
  const stats = React.useMemo(() => {
    const sorted = strip.map((p) => p.value).filter((v): v is number => v !== null).sort((a, b) => a - b)
    return {
      median: quantile(sorted, 0.5),
      q1: quantile(sorted, 0.25),
      q3: quantile(sorted, 0.75),
      min: sorted[0] ?? null,
      max: sorted[sorted.length - 1] ?? null,
      spread: quantile(sorted, 0.75) !== null && quantile(sorted, 0.25) !== null
        ? (quantile(sorted, 0.75) as number) - (quantile(sorted, 0.25) as number)
        : null,
    }
  }, [strip])

  const bullets = React.useMemo<BulletRow[]>(
    () =>
      snapshot.regions.map((r) => ({
        id: r.regionId,
        label: r.regionId,
        sublabel: `${r.facilityCount} sites`,
        value: r.utilizationPct,
        target: r.targetPct,
        benchmark: snapshot.network.utilizationPct ?? undefined,
      })),
    [snapshot.regions, snapshot.network.utilizationPct],
  )
  const missedBudget = bullets.filter((b) => b.value !== null && b.value < b.target).length

  // ---- What is moving ----------------------------------------------------
  const dumbbell = React.useMemo<DumbbellRow[]>(
    () =>
      [...snapshot.regions]
        .sort((a, b) => Math.abs(b.change30dPct ?? 0) - Math.abs(a.change30dPct ?? 0))
        .map((r) => ({ id: r.regionId, label: r.regionId, from: r.utilizationPct30dAgo, to: r.utilizationPct })),
    [snapshot.regions],
  )
  const biggestMover = dumbbell[0]

  const quadrant = React.useMemo<QuadrantPoint[]>(
    () =>
      withCapacity
        .filter((f) => f.forecast30dPct !== null)
        .map((f) => ({
          id: f.facilityId,
          label: `${f.code} · ${f.cityName}`,
          x: f.utilizationPct as number,
          y: (f.forecast30dPct as number) - (f.utilizationPct as number),
          size: f.capacity ?? 0,
          critical: (f.utilizationPct ?? 0) > 100,
        })),
    [withCapacity],
  )
  const actNow = quadrant.filter((p) => p.x >= THRESHOLDS.breachThresholdPct && p.y > 0)
  const commercial = quadrant.filter((p) => p.x < THRESHOLDS.underUtilizedPct && p.y <= 0)

  // ---- What the year looks like -----------------------------------------
  const calendar = React.useMemo(
    () =>
      snapshot.series.history.map((point) => ({
        date: point.date,
        value: point.capacity <= 0 ? null : Number(((point.utilizedPallets / point.capacity) * 100).toFixed(2)),
      })),
    [snapshot.series.history],
  )
  const calendarStats = React.useMemo(() => {
    const values = calendar.map((c) => c.value).filter((v): v is number => v !== null)
    const peak = calendar.reduce<{ date: string; value: number } | null>(
      (best, c) => (c.value !== null && (best === null || c.value > best.value) ? { date: c.date, value: c.value } : best),
      null,
    )
    const trough = calendar.reduce<{ date: string; value: number } | null>(
      (worst, c) => (c.value !== null && (worst === null || c.value < worst.value) ? { date: c.date, value: c.value } : worst),
      null,
    )
    return { days: values.length, peak, trough }
  }, [calendar])

  return (
    <div className="space-y-4">
      <PageHeader
        title="Analytics"
        description="Four questions, in order: where the capacity sits, how evenly it is used, what is moving, and what the year looks like. Every panel names what it shows in a sentence."
        crumbs={[{ label: 'Control Tower', href: '/' }, { label: 'Analytics' }]}
      />

      {/* ---------------------------------------------------------------- */}
      <SectionTitle className="pt-1">1 · Where the capacity sits</SectionTitle>

      <div className="grid items-start gap-3 xl:grid-cols-[1.4fr_1fr]">
        <Card>
          <CardHeader
            title="Capacity Structure"
            subtitle="Area is pallet positions, shade is how full they are"
            tip="Area and lightness are read independently, which is what lets one mark carry both measures: a large pale block is a big site with room, a small dark one is a small site under pressure. Regions are the outer blocks."
          />
          <CapacityTreemap leaves={treemap} groups={treemapGroups} height={330} onSelect={openFacility} />
          <ChartLegend
            className="border-t border-hairline"
            items={[
              { label: 'Utilization', swatch: 'ramp', note: 'low → high' },
              { label: 'Block area', color: SEQUENTIAL_RAMP[2], note: '= pallet positions' },
            ]}
          />
          <Read>
            The network&apos;s {formatNumber(snapshot.network.capacity)} positions are not evenly spread: WEST-1 and NORTH
            carry the largest blocks, and the darkest cells inside them are the sites to watch — a small block that is
            dark is a site with no room to absorb anything.
          </Read>
        </Card>

        <Card>
          <CardHeader
            title="Occupancy Concentration"
            subtitle="Cumulative share of stock against cumulative share of sites"
            tip="A Pareto was the first choice and was the wrong form — this network is close to evenly distributed, so the bars come out at two percent each and the cumulative line is almost a straight diagonal. Here both axes are cumulative shares on one 0–100 scale, and the dashed diagonal is what perfectly even distribution looks like: the gap between the curve and it is the concentration."
          />
          <ConcentrationCurve rows={pareto} height={250} onSelect={openFacility} />
          <ChartLegend
            className="border-t border-hairline"
            items={[
              { label: 'Cumulative occupancy', color: CHART_COLORS.actual },
              { label: 'Perfectly even', color: 'var(--color-ink-faint)', swatch: 'dash' },
            ]}
          />
          <Read>
            The curve sits close to the diagonal: the largest {concentration.topFifthSites} sites — a fifth of the
            network — hold {formatPct(concentration.topFifthShare, 0)} of the occupied pallets, and it takes{' '}
            {concentration.halfCount} of {concentration.of} to reach half. There is no small set of sites that a capacity
            decision can be narrowed to; this network is genuinely spread out, which is itself the finding.
          </Read>
        </Card>
      </div>

      {/* ---------------------------------------------------------------- */}
      <SectionTitle className="pt-2">2 · How evenly it is used</SectionTitle>

      <Card>
        <CardHeader
          title="Utilization Spread"
          subtitle={`Every warehouse as one dot · median ${formatPct(stats.median, 1)}, middle half ${formatPct(stats.q1, 1)}–${formatPct(stats.q3, 1)}`}
          tip="A network average hides both tails. This shows the whole population at once — where the bulk sits, how long the tails run, and which named sites fall outside them. Dots are nudged off the line where they would overlap, so none is hidden behind another."
        />
        <DistributionStrip
          points={strip}
          median={stats.median}
          q1={stats.q1}
          q3={stats.q3}
          target={snapshot.network.targetPct}
          height={132}
          onSelect={openFacility}
        />
        <ChartLegend
          className="border-t border-hairline"
          items={[
            { label: 'Warehouse', color: CHART_COLORS.actual },
            { label: 'Over capacity', color: 'var(--color-bad)' },
            { label: 'Budget', color: 'var(--color-ink-faint)', swatch: 'dash' },
          ]}
        />
        <Read>
          The middle half of the network sits inside {formatPp(stats.spread, 1).replace('+', '')} of each other, between{' '}
          {formatPct(stats.q1, 1)} and {formatPct(stats.q3, 1)}. The spread from {formatPct(stats.min, 1)} to{' '}
          {formatPct(stats.max, 1)} is the whole management problem in one line: the tails are where capacity is either
          unsellable or already gone.
        </Read>
      </Card>

      <Card>
        <CardHeader
          title="Region against Budget"
          subtitle="Actual, its own budget, and the network figure on one row each"
          tip="A bullet is the compact honest form for 'did we hit the number': the bar is the measure, the heavy tick is that region's budget, the light tick is the network. A gauge shows the same thing in ten times the space and cannot be stacked for comparison."
        />
        <BulletChart rows={bullets} max={110} bands={[THRESHOLDS.underUtilizedPct, THRESHOLDS.networkTargetPct, 100]} />
        <ChartLegend
          className="border-t border-hairline"
          items={[
            { label: 'Actual', color: CHART_COLORS.actual },
            { label: 'Over capacity', color: 'var(--color-bad)' },
            { label: 'Region budget', color: 'var(--color-ink)' },
            { label: 'Network', color: 'var(--color-ink-faint)' },
          ]}
        />
        <Read>
          {missedBudget} of {bullets.length} regions are below their own budget. Each region carries a different budget,
          so the ranking by utilization and the ranking by variance are not the same list — this panel shows both at once.
        </Read>
      </Card>

      {/* ---------------------------------------------------------------- */}
      <SectionTitle className="pt-2">3 · What is moving</SectionTitle>

      <div className="grid items-start gap-3 xl:grid-cols-[1fr_1.35fr]">
        <Card>
          <CardHeader
            title="30-Day Movement"
            subtitle="Where each region was a month ago, and where it is now"
            tip="One hue in two shades rather than two colours: the ends are the same measure at two moments, not two independent series. The bar between them is the distance travelled, which is the thing worth reading."
          />
          <DumbbellChart rows={dumbbell} fromLabel="30 days ago" toLabel="Today" />
          <ChartLegend
            className="border-t border-hairline"
            items={[
              { label: '30 days ago', color: SEQUENTIAL_RAMP[0], swatch: 'ring' },
              { label: 'Today', color: SEQUENTIAL_RAMP[4], swatch: 'ring' },
            ]}
          />
          <Read>
            {biggestMover ? (
              <>
                {biggestMover.label} has travelled furthest —{' '}
                {formatPct(biggestMover.from, 1)} to {formatPct(biggestMover.to, 1)}. A week of movement is noise at a
                single site; a month is a direction.
              </>
            ) : (
              'No region has a computable 30-day baseline in this scope.'
            )}
          </Read>
        </Card>

        <Card>
          <CardHeader
            title="Full Now against Heading Up"
            subtitle="Utilization today on one axis, projected 30-day movement on the other"
            tip="Two measures and a size, which is the one job a scatter does better than a table. The quadrants are named so a reader lands on the action rather than on a coordinate. Bubble area is capacity; the red marks are sites already over capacity, which is a state rather than a series."
          />
          <QuadrantBubble
            points={quadrant}
            xLabel="Utilization today (%)"
            yLabel="Projected 30-day movement (pp)"
            xSplit={THRESHOLDS.breachThresholdPct}
            ySplit={0}
            quadrants={{
              tl: 'Filling, room left',
              tr: 'Act now — full and rising',
              bl: 'Emptying — commercial review',
              br: 'Full but easing',
            }}
            height={340}
            onSelect={openFacility}
          />
          <ChartLegend
            className="border-t border-hairline"
            items={[
              { label: 'Warehouse', color: CHART_COLORS.actual, note: 'area = capacity' },
              { label: 'Already over capacity', color: 'var(--color-bad)' },
            ]}
          />
          <Read>
            {actNow.length} {actNow.length === 1 ? 'site is' : 'sites are'} above {THRESHOLDS.breachThresholdPct}% and
            still projected to rise — the top-right quadrant is the only one that needs a decision this week.{' '}
            {commercial.length > 0
              ? `${commercial.length} ${commercial.length === 1 ? 'site sits' : 'sites sit'} below ${THRESHOLDS.underUtilizedPct}% and falling, which is a commercial conversation rather than an operational one.`
              : 'Nothing sits in the emptying quadrant.'}
          </Read>
        </Card>
      </div>

      {/* ---------------------------------------------------------------- */}
      <SectionTitle className="pt-2">4 · What the year looks like</SectionTitle>

      <Card>
        <CardHeader
          title="Daily Utilization Calendar"
          subtitle={`${calendarStats.days} days, one cell per day · rows are weekdays`}
          tip="The same series the trend chart draws, laid out by week and weekday. A line shows the direction; this shows the rhythm — the weekly shape, the run of heavy days, and the gaps — which a line flattens into a single wobble."
          actions={
            <div className="flex items-center gap-2">
              {calendarStats.peak ? (
                <StatusChip status="high" label={`Peak ${formatPct(calendarStats.peak.value, 1)}`} size="xs" />
              ) : null}
              {calendarStats.trough ? (
                <StatusChip status="info" label={`Low ${formatPct(calendarStats.trough.value, 1)}`} size="xs" />
              ) : null}
            </div>
          }
        />
        <CalendarHeatmap points={calendar} />
        <ChartLegend
          className="border-t border-hairline"
          items={[{ label: 'Utilization', swatch: 'ramp', note: 'low → high' }]}
        />
        <Read>
          Highest on {calendarStats.peak ? formatDate(calendarStats.peak.date) : 'N/A'} at{' '}
          <Value missing={!calendarStats.peak}>{formatPct(calendarStats.peak?.value ?? null, 2)}</Value>, lowest on{' '}
          {calendarStats.trough ? formatDate(calendarStats.trough.date) : 'N/A'} at{' '}
          <Value missing={!calendarStats.trough}>{formatPct(calendarStats.trough?.value ?? null, 2)}</Value>. Reading down
          a column gives one week; reading across a row gives the same weekday all year, which is where a working rhythm
          shows up.
        </Read>
      </Card>

      <Card>
        <CardHeader title="How these were chosen" subtitle="Form follows the question, not the fashion" />
        <dl className="grid gap-x-6 gap-y-2.5 px-4 py-3 text-[11.5px] sm:grid-cols-2 lg:grid-cols-3">
          <Note term="One hue for magnitude">
            Anything encoding &ldquo;more&rdquo; uses a single validated sequential ramp, light to dark. No rainbow, and
            no value-ramp on categories that have no order.
          </Note>
          <Note term="Status colour is reserved">
            Red means over capacity and nothing else. It never appears as &ldquo;series two&rdquo;, and it always ships
            with a label rather than standing alone.
          </Note>
          <Note term="One axis, always">
            The Pareto draws bars and a cumulative line on the same 0–100 scale. A second y-axis would invent a
            correlation between two ranges that do not share one.
          </Note>
          <Note term="Distribution over average">
            A mean hides both tails, and the tails are the decisions. The strip plot shows all{' '}
            {withCapacity.length} sites rather than summarising them.
          </Note>
          <Note term="No chart where a number is enough">
            A single figure gets a stat tile, not a one-bar chart. Part-to-whole with more than a handful of slices gets
            a treemap or a table, never a pie.
          </Note>
          <Note term="Hover on every plot">
            Each mark carries its exact figures on hover, so nothing depends on reading a value off an axis.
          </Note>
        </dl>
      </Card>
    </div>
  )
}

/** The one-sentence read under each panel. */
function Read({ children }: { children: React.ReactNode }) {
  return (
    <p className="border-t border-hairline bg-slate-50/60 px-4 py-2.5 text-[11.5px] leading-relaxed text-ink-soft">
      {children}
    </p>
  )
}

function Note({ term, children }: { term: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="font-semibold text-ink">{term}</dt>
      <dd className="mt-0.5 leading-relaxed text-ink-muted">{children}</dd>
    </div>
  )
}
