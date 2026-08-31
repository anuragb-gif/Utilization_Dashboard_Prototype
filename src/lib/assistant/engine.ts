/**
 * The assistant's answering engine.
 *
 * This is a deterministic query resolver over the same snapshot every screen
 * renders. It is NOT a language model, and nothing here should ever be
 * presented as one: it matches a question against a fixed set of intents,
 * resolves the entity it names against the master data, and reads the figure
 * out of the semantic layer.
 *
 * Three rules hold throughout:
 *
 *  1. Every answer carries the formula that produced it, the source system and
 *     the owner, so the reader can check it against the screen it came from.
 *  2. Nothing is inferred. If the question cannot be matched to an intent and
 *     an entity, the engine says so and lists what it can answer - it never
 *     guesses a number or paraphrases one it did not compute.
 *  3. Values that are not computable come back as null and are rendered as
 *     N/A, never as zero.
 *
 * When a language model is eventually connected it should sit *in front* of
 * this, translating a question into one of these intents and narrating the
 * result - not replacing the arithmetic. `buildModelContext` produces exactly
 * the payload that would be handed to it.
 */

import type { ControlTowerSnapshot } from '@/lib/repository'
import type { RegionId, Severity } from '@/lib/domain/types'
import { KPI_DEFINITIONS, type KpiDefinition } from '@/lib/config/kpi-definitions'
import { THRESHOLDS } from '@/lib/config/thresholds'
import { REGION_ORDER } from '@/lib/data/master'
import { NEAR_EXPIRY_PALLETS } from '@/lib/data/inventory'
import { formatNumber, formatPct, formatPp } from '@/lib/utils'

export type AnswerConfidence = 'exact' | 'partial' | 'unanswered'

export interface AnswerFigure {
  label: string
  value: string
  /** True when the underlying value was not computable. */
  missing?: boolean
  tone?: 'bad' | 'good'
}

export interface Answer {
  /** Echo of what the engine understood, so a misreading is visible. */
  interpretation: string
  headline: string
  /** The single number the question asked for, already formatted. */
  value: string | null
  valueMissing: boolean
  detail: string
  figures: AnswerFigure[]
  /** The KPI definition behind the figure, when the question named a metric. */
  kpi: KpiDefinition | null
  /** Where the number came from, in the reader's terms. */
  source: string
  href: string | null
  hrefLabel: string | null
  confidence: AnswerConfidence
  severity: Severity | null
  /** Follow-up questions this engine can actually answer. */
  followUps: string[]
}

// ---------------------------------------------------------------------------
// Entity resolution
// ---------------------------------------------------------------------------

interface Entities {
  regionId: RegionId | null
  facilityCode: string | null
  parkAndPayCode: string | null
  raw: string
  words: string[]
}

const NORMALISE: Record<string, string> = {
  south1: 'SOUTH-1',
  south2: 'SOUTH-2',
  west1: 'WEST-1',
  west2: 'WEST-2',
}

function normalise(input: string): string {
  return input.toLowerCase().replace(/[^a-z0-9\s-]/g, ' ').replace(/\s+/g, ' ').trim()
}

function resolveEntities(question: string, snapshot: ControlTowerSnapshot): Entities {
  const raw = normalise(question)
  const words = raw.split(' ')
  const squashed = raw.replace(/[\s-]/g, '')

  let regionId: RegionId | null = null
  for (const region of REGION_ORDER) {
    const key = region.toLowerCase()
    if (raw.includes(key) || squashed.includes(key.replace('-', ''))) {
      regionId = region
      break
    }
  }
  if (!regionId) {
    for (const [alias, target] of Object.entries(NORMALISE)) {
      if (squashed.includes(alias)) {
        regionId = target as RegionId
        break
      }
    }
  }

  // Facility by code, then by city or name - longest match first, so
  // "Bhiwandi Cold Campus" is not shadowed by "Bhiwandi DC-2".
  let facilityCode: string | null = null
  const byLength = [...snapshot.facilities].sort((a, b) => b.name.length - a.name.length)
  for (const facility of byLength) {
    if (raw.includes(facility.code.toLowerCase())) {
      facilityCode = facility.code
      break
    }
  }
  if (!facilityCode) {
    for (const facility of byLength) {
      if (raw.includes(facility.name.toLowerCase())) {
        facilityCode = facility.code
        break
      }
    }
  }

  let parkAndPayCode: string | null = null
  for (const site of snapshot.parkAndPay.sites) {
    if (words.includes(site.code.toLowerCase())) {
      parkAndPayCode = site.code
      break
    }
  }

  return { regionId, facilityCode, parkAndPayCode, raw, words }
}

const has = (raw: string, ...terms: string[]) => terms.some((t) => raw.includes(t))

// ---------------------------------------------------------------------------
// Answer construction
// ---------------------------------------------------------------------------

function provenance(kpi: KpiDefinition): string {
  return `${kpi.source} · owner ${kpi.owner} · ${kpi.refreshFrequency.replace('_', ' ').toLowerCase()}`
}

function base(): Pick<Answer, 'figures' | 'kpi' | 'href' | 'hrefLabel' | 'severity' | 'followUps' | 'valueMissing'> {
  return { figures: [], kpi: null, href: null, hrefLabel: null, severity: null, followUps: [], valueMissing: false }
}

/** The one answer the engine gives when it has not understood the question. */
function unanswered(question: string, suggestions: string[]): Answer {
  return {
    ...base(),
    interpretation: question.trim() || 'an empty question',
    headline: 'I cannot answer that from this dataset',
    value: null,
    valueMissing: true,
    detail:
      'This assistant resolves a question against a fixed set of intents over the published figures. It has not matched one here, and it will not guess a number. Rephrase using a region, a warehouse code, a Park & Pay code or a metric name — or pick one of the questions below, which it can answer exactly.',
    source: 'No query matched',
    confidence: 'unanswered',
    followUps: suggestions,
  }
}

interface Resolver {
  id: string
  /** Returns an answer when this resolver recognises the question. */
  run: (entities: Entities, snapshot: ControlTowerSnapshot) => Answer | null
}

const RESOLVERS: Resolver[] = [
  // ---- Park & Pay --------------------------------------------------------
  {
    id: 'park-and-pay',
    run: (e, s) => {
      const wantsPnp =
        has(e.raw, 'park and pay', 'park & pay', 'park pay', 'parkandpay', 'p p', 'rented', 'rent') ||
        e.parkAndPayCode !== null
      if (!wantsPnp) return null
      const pnp = s.parkAndPay

      if (e.parkAndPayCode) {
        const site = pnp.sites.find((x) => x.code === e.parkAndPayCode)!
        return {
          ...base(),
          interpretation: `Park & Pay location ${site.code} (${site.name})`,
          headline: `${site.code} · ${site.name}`,
          value: formatPct(site.utilizationPct, 2),
          valueMissing: site.utilizationPct === null,
          detail: `${formatNumber(site.utilizedPallets)} pallets against ${formatNumber(site.capacity)} contracted positions at ${site.partner}. ${
            site.overCapacityPallets > 0
              ? `${formatNumber(site.overCapacityPallets)} pallets are held above the contracted space, which has no structural headroom behind it.`
              : site.idle
                ? 'The space is contracted and being paid for with no stock against it — a commercial question, not waste.'
                : `${formatNumber(site.netEmptyPallets)} positions are free.`
          }${site.reportsContractedAsOccupied ? ' This location reports exactly 100.00% every day, which is a contracted figure rather than a measured count.' : ''}`,
          figures: [
            { label: 'Contracted', value: formatNumber(site.capacity) },
            { label: 'Occupied', value: formatNumber(site.utilizedPallets) },
            { label: 'Empty', value: formatNumber(site.netEmptyPallets), tone: site.netEmptyPallets < 0 ? 'bad' : undefined },
            { label: 'Contract ends', value: `${site.contractEndsOn} (${site.daysToContractEnd}d)` },
          ],
          kpi: KPI_DEFINITIONS.parkAndPayUtilization,
          source: provenance(KPI_DEFINITIONS.parkAndPayUtilization),
          href: '/park-and-pay',
          hrefLabel: 'Open Park & Pay',
          confidence: 'exact',
          severity: site.overCapacityPallets > 0 ? 'critical' : site.idle ? 'high' : null,
          followUps: ['What does Park & Pay do to the network figure?', 'Which Park & Pay contracts expire soon?'],
        }
      }

      if (has(e.raw, 'expire', 'expiring', 'contract', 'renew')) {
        return {
          ...base(),
          interpretation: 'Park & Pay contracts approaching renewal',
          headline: `${pnp.contractsExpiringSoon} ${pnp.contractsExpiringSoon === 1 ? 'contract' : 'contracts'} ending within ${THRESHOLDS.contractRenewalWindowDays} days`,
          value: formatNumber(pnp.contractsExpiringPallets),
          detail: `${formatNumber(pnp.contractsExpiringPallets)} rented positions sit on contracts inside the renewal window${
            pnp.contractsExpiringSoon > 0
              ? `: ${pnp.sites
                  .filter((x) => x.daysToContractEnd <= THRESHOLDS.contractRenewalWindowDays)
                  .map((x) => `${x.code} (${x.daysToContractEnd} days)`)
                  .join(', ')}. Owned capacity does not expire; rented capacity has to be re-signed or replaced.`
              : '. Owned capacity does not expire; rented capacity has to be re-signed or replaced.'
          }`,
          figures: [
            { label: 'Positions at risk', value: formatNumber(pnp.contractsExpiringPallets) },
            { label: 'Locations', value: String(pnp.contractsExpiringSoon) },
            { label: 'Window', value: `${THRESHOLDS.contractRenewalWindowDays} days` },
          ],
          kpi: KPI_DEFINITIONS.parkAndPayCapacity,
          source: provenance(KPI_DEFINITIONS.parkAndPayCapacity),
          href: '/park-and-pay',
          hrefLabel: 'Open Park & Pay',
          confidence: 'exact',
          severity: pnp.contractsExpiringSoon > 0 ? 'high' : null,
          followUps: ['Which Park & Pay locations are over contract?', 'What is Park & Pay utilization?'],
        }
      }

      if (e.regionId) {
        const row = pnp.regions.find((r) => r.regionId === e.regionId)
        if (row) {
          const c = row.comparison
          return {
            ...base(),
            interpretation: `Park & Pay in ${e.regionId}`,
            headline: `${e.regionId} · Park & Pay`,
            value: formatPct(c.parkAndPay.utilizationPct, 2),
            valueMissing: c.parkAndPay.utilizationPct === null,
            detail:
              row.siteCount === 0
                ? `${e.regionId} has no rented space, so its own-network figure of ${formatPct(c.own.utilizationPct, 2)} is the whole region.`
                : `${row.siteCount} rented ${row.siteCount === 1 ? 'location' : 'locations'} hold ${formatNumber(c.parkAndPay.utilizedPallets)} pallets against ${formatNumber(c.parkAndPay.capacity)} contracted positions. Including them moves ${e.regionId} from ${formatPct(c.own.utilizationPct, 2)} to ${formatPct(c.combined.utilizationPct, 2)}, a change of ${formatPp(c.utilizationImpactPp, 2)}.`,
            figures: [
              { label: 'Own', value: formatPct(c.own.utilizationPct, 2) },
              { label: 'Park & Pay', value: formatPct(c.parkAndPay.utilizationPct, 2), missing: c.parkAndPay.utilizationPct === null },
              { label: 'Combined', value: formatPct(c.combined.utilizationPct, 2) },
              { label: 'Effect', value: formatPp(c.utilizationImpactPp, 2) },
            ],
            kpi: KPI_DEFINITIONS.parkAndPayUtilization,
            source: provenance(KPI_DEFINITIONS.parkAndPayUtilization),
            href: `/regions/${encodeURIComponent(e.regionId)}`,
            hrefLabel: `Open ${e.regionId}`,
            confidence: 'exact',
            severity: null,
            followUps: ['What does Park & Pay do to the network figure?', 'Which Park & Pay locations are over contract?'],
          }
        }
      }

      const c = pnp.network
      const overSites = pnp.sites.filter((x) => x.overCapacityPallets > 0)
      const askingOver = has(e.raw, 'over', 'above', 'exceed', 'breach')
      return {
        ...base(),
        interpretation: askingOver ? 'Park & Pay locations above their contracted space' : 'Park & Pay against the own network',
        headline: askingOver
          ? `${overSites.length} ${overSites.length === 1 ? 'location is' : 'locations are'} above contract`
          : 'Park & Pay vs the own network',
        value: askingOver ? formatNumber(c.parkAndPay.overCapacityPallets) : formatPct(c.parkAndPay.utilizationPct, 2),
        valueMissing: !askingOver && c.parkAndPay.utilizationPct === null,
        detail: askingOver
          ? `${formatNumber(c.parkAndPay.overCapacityPallets)} pallets are held above contracted space across ${overSites.map((x) => `${x.code} (${formatPct(x.utilizationPct, 1)})`).join(', ')}. Rented space has no structural headroom — an overflow at a partner site has nowhere to go except another site.`
          : `Park & Pay runs at ${formatPct(c.parkAndPay.utilizationPct, 2)} across ${formatNumber(c.parkAndPay.capacity)} contracted positions, against ${formatPct(c.own.utilizationPct, 2)} on the own network. Combined — capacities and occupancies summed, then divided once — the network reads ${formatPct(c.combined.utilizationPct, 2)}, a change of ${formatPp(c.utilizationImpactPp, 2)}. Rented space is ${formatPct(c.capacitySharePct, 1)} of combined capacity.`,
        figures: [
          { label: 'Own', value: formatPct(c.own.utilizationPct, 2) },
          { label: 'Park & Pay', value: formatPct(c.parkAndPay.utilizationPct, 2) },
          { label: 'Combined', value: formatPct(c.combined.utilizationPct, 2) },
          { label: 'Effect', value: formatPp(c.utilizationImpactPp, 2) },
        ],
        kpi: askingOver ? KPI_DEFINITIONS.parkAndPayCapacity : KPI_DEFINITIONS.combinedUtilization,
        source: provenance(KPI_DEFINITIONS.combinedUtilization),
        href: '/park-and-pay',
        hrefLabel: 'Open Park & Pay',
        confidence: 'exact',
        severity: askingOver && overSites.length > 0 ? 'critical' : null,
        followUps: ['Which Park & Pay contracts expire soon?', 'Which Park & Pay locations are over contract?'],
      }
    },
  },

  // ---- A named warehouse -------------------------------------------------
  {
    id: 'facility',
    run: (e, s) => {
      if (!e.facilityCode) return null
      const f = s.facilities.find((x) => x.code === e.facilityCode)!
      const over = f.overCapacityPallets > 0
      const askingForecast = has(e.raw, 'forecast', 'project', 'will', 'expect', 'next')
      return {
        ...base(),
        interpretation: `${f.code} — ${f.name}, ${f.cityName}`,
        headline: `${f.code} · ${f.name}`,
        value: askingForecast ? formatPct(f.forecast30dPct, 2) : formatPct(f.utilizationPct, 2),
        valueMissing: (askingForecast ? f.forecast30dPct : f.utilizationPct) === null,
        detail: askingForecast
          ? `Projected to ${formatPct(f.forecast7dPct, 1)} in 7 days, ${formatPct(f.forecast14dPct, 1)} in 14 and ${formatPct(f.forecast30dPct, 1)} in 30, from ${formatPct(f.utilizationPct, 2)} today.${
              f.expectedBreachDate ? ` On that trend it crosses ${THRESHOLDS.breachThresholdPct}% on ${f.expectedBreachDate}.` : ''
            } This is a damped extrapolation of the last 14 days — a trend projection, not a model output.`
          : `${formatNumber(f.utilizedPallets)} pallets against ${formatNumber(f.capacity)} positions in ${f.cityName}, ${f.regionId}. ${
              over
                ? `${formatNumber(f.overCapacityPallets)} pallets are above the capacity master.`
                : `${formatNumber(f.availableCapacity)} positions are available.`
            } Seven-day movement ${formatPp(f.change7dPct, 1)}. Site manager ${f.owner}.${f.primaryReason ? ` Flagged: ${f.primaryReason}.` : ''}`,
        figures: [
          { label: 'Capacity', value: formatNumber(f.capacity), missing: f.capacity === null },
          { label: 'Occupied', value: formatNumber(f.utilizedPallets) },
          { label: 'Available', value: formatNumber(f.availableCapacity) },
          { label: '7-day', value: formatPp(f.change7dPct, 1) },
        ],
        kpi: askingForecast ? KPI_DEFINITIONS.forecastUtilization : KPI_DEFINITIONS.networkUtilization,
        source: provenance(askingForecast ? KPI_DEFINITIONS.forecastUtilization : KPI_DEFINITIONS.networkUtilization),
        href: `/warehouses/${encodeURIComponent(f.facilityId)}`,
        hrefLabel: `Open ${f.code}`,
        confidence: 'exact',
        severity: over ? 'critical' : f.risk,
        followUps: [`What is the forecast for ${f.code}?`, `Which warehouses are over capacity?`],
      }
    },
  },

  // ---- Rankings ----------------------------------------------------------
  {
    id: 'ranking',
    run: (e, s) => {
      const wantsHigh = has(e.raw, 'highest', 'most', 'busiest', 'fullest', 'top', 'worst', 'over capacity', 'overcapacity')
      const wantsLow = has(e.raw, 'lowest', 'least', 'emptiest', 'under', 'bottom', 'spare', 'available', 'headroom')
      if (!wantsHigh && !wantsLow) return null

      const byRegion = has(e.raw, 'region')
      if (byRegion) {
        const ranked = [...s.regions]
          .filter((r) => r.utilizationPct !== null)
          .sort((a, b) => (wantsHigh ? (b.utilizationPct ?? 0) - (a.utilizationPct ?? 0) : (a.utilizationPct ?? 0) - (b.utilizationPct ?? 0)))
        const top = ranked[0]
        if (!top) return null
        return {
          ...base(),
          interpretation: wantsHigh ? 'Region with the highest utilization' : 'Region with the lowest utilization',
          headline: `${top.regionId} — ${formatPct(top.utilizationPct, 2)}`,
          value: formatPct(top.utilizationPct, 2),
          detail: `${top.regionId} runs at ${formatPct(top.utilizationPct, 2)} against a ${top.targetPct}% budget (${formatPp(top.variancePct, 2)}), on ${formatNumber(top.utilizedPallets)} pallets across ${formatNumber(top.capacity)} positions. Full order: ${ranked
            .map((r) => `${r.regionId} ${formatPct(r.utilizationPct, 1)}`)
            .join(' · ')}.`,
          figures: ranked.slice(0, 4).map((r) => ({
            label: r.regionId,
            value: formatPct(r.utilizationPct, 1),
            tone: (r.utilizationPct ?? 0) > 100 ? ('bad' as const) : undefined,
          })),
          kpi: KPI_DEFINITIONS.networkUtilization,
          source: provenance(KPI_DEFINITIONS.networkUtilization),
          href: '/regions',
          hrefLabel: 'Open Regions',
          confidence: 'exact',
          severity: (top.utilizationPct ?? 0) > 100 ? 'critical' : null,
          followUps: ['Which warehouses are over capacity?', 'Where is the spare capacity?'],
        }
      }

      if (wantsHigh) {
        const overFacilities = s.facilities
          .filter((f) => f.capacity !== null && f.utilizedPallets > f.capacity)
          .sort((a, b) => (b.utilizationPct ?? 0) - (a.utilizationPct ?? 0))
        if (overFacilities.length === 0) {
          return {
            ...base(),
            interpretation: 'Warehouses above their capacity master',
            headline: 'No warehouse is over capacity',
            value: '0',
            detail: `Every facility in scope is inside its capacity master on ${s.network.reportDate}.`,
            kpi: KPI_DEFINITIONS.overCapacityPallets,
            source: provenance(KPI_DEFINITIONS.overCapacityPallets),
            href: '/warehouses',
            hrefLabel: 'Open Warehouses',
            confidence: 'exact',
            severity: null,
            followUps: ['Which region is most utilized?', 'Where is the spare capacity?'],
          }
        }
        return {
          ...base(),
          interpretation: 'Warehouses above their capacity master',
          headline: `${overFacilities.length} ${overFacilities.length === 1 ? 'warehouse is' : 'warehouses are'} over capacity`,
          value: formatNumber(s.network.overCapacityPallets),
          detail: `${formatNumber(s.network.overCapacityPallets)} pallets are held above the capacity master: ${overFacilities
            .map((f) => `${f.code} ${formatPct(f.utilizationPct, 1)} (+${formatNumber(f.overCapacityPallets)})`)
            .join(', ')}.`,
          figures: overFacilities.slice(0, 4).map((f) => ({
            label: f.code,
            value: formatPct(f.utilizationPct, 1),
            tone: 'bad' as const,
          })),
          kpi: KPI_DEFINITIONS.overCapacityPallets,
          source: provenance(KPI_DEFINITIONS.overCapacityPallets),
          href: '/exceptions',
          hrefLabel: 'Open Exceptions',
          confidence: 'exact',
          severity: 'critical',
          followUps: ['Where is the spare capacity?', 'What is the 30-day forecast?'],
        }
      }

      const spare = [...s.regions]
        .filter((r) => r.availableCapacity !== null)
        .sort((a, b) => (b.availableCapacity ?? 0) - (a.availableCapacity ?? 0))
      const best = spare[0]
      if (!best) return null
      return {
        ...base(),
        interpretation: 'Where the available capacity sits',
        headline: `${best.regionId} holds the most headroom`,
        value: formatNumber(best.availableCapacity),
        detail: `${best.regionId} has ${formatNumber(best.availableCapacity)} available positions at ${formatPct(best.utilizationPct, 2)} utilization. Network-wide there are ${formatNumber(s.network.availableCapacity)} available positions against a legacy empty-pallet figure of ${formatNumber(s.network.netEmptyPallets)} — the difference is the ${formatNumber(s.network.overCapacityPallets)} pallets currently held above capacity. Empty positions are available capacity, not waste, until a facility falls below the ${THRESHOLDS.underUtilizedPct}% review threshold.`,
        figures: spare.slice(0, 4).map((r) => ({ label: r.regionId, value: formatNumber(r.availableCapacity) })),
        kpi: KPI_DEFINITIONS.availableCapacity,
        source: provenance(KPI_DEFINITIONS.availableCapacity),
        href: '/capacity',
        hrefLabel: 'Open Capacity',
        confidence: 'exact',
        severity: null,
        followUps: ['Which region is most utilized?', 'Which warehouses are over capacity?'],
      }
    },
  },

  // ---- A named region ----------------------------------------------------
  {
    id: 'region',
    run: (e, s) => {
      if (!e.regionId) return null
      const r = s.regions.find((x) => x.regionId === e.regionId)
      if (!r) return null
      const over = (r.utilizationPct ?? 0) > 100
      return {
        ...base(),
        interpretation: `${r.regionId} — ${r.regionName} region`,
        headline: `${r.regionId} · ${formatPct(r.utilizationPct, 2)}`,
        value: formatPct(r.utilizationPct, 2),
        valueMissing: r.utilizationPct === null,
        detail: `${formatNumber(r.utilizedPallets)} pallets against ${formatNumber(r.capacity)} positions across ${r.facilityCount} facilities, ${formatPp(r.variancePct, 2)} against a ${r.targetPct}% budget. ${
          over
            ? `${formatNumber(r.overCapacityPallets)} pallets are above the capacity master across ${r.overCapacityFacilities} ${r.overCapacityFacilities === 1 ? 'facility' : 'facilities'}.`
            : `${formatNumber(r.availableCapacity)} positions are available.`
        } Seven-day movement ${formatPp(r.change7dPct, 1)}; 30-day projection ${formatPct(r.forecast30dPct, 1)}.`,
        figures: [
          { label: 'Capacity', value: formatNumber(r.capacity) },
          { label: 'Occupied', value: formatNumber(r.utilizedPallets) },
          { label: 'Available', value: formatNumber(r.availableCapacity) },
          { label: 'Over capacity', value: formatNumber(r.overCapacityPallets), tone: over ? 'bad' : undefined },
        ],
        kpi: KPI_DEFINITIONS.networkUtilization,
        source: provenance(KPI_DEFINITIONS.networkUtilization),
        href: `/regions/${encodeURIComponent(r.regionId)}`,
        hrefLabel: `Open ${r.regionId}`,
        confidence: 'exact',
        severity: over ? 'critical' : null,
        followUps: [`What is Park & Pay in ${r.regionId}?`, 'Which region is most utilized?'],
      }
    },
  },

  // ---- Exceptions --------------------------------------------------------
  {
    id: 'exceptions',
    run: (e, s) => {
      if (!has(e.raw, 'exception', 'issue', 'problem', 'alert', 'attention', 'wrong', 'risk today')) return null
      const critical = s.exceptions.filter((x) => x.severity === 'critical')
      const high = s.exceptions.filter((x) => x.severity === 'high')
      return {
        ...base(),
        interpretation: 'Open exceptions on the report date',
        headline: `${s.exceptions.length} open · ${critical.length} critical`,
        value: String(s.exceptions.length),
        // Name the thing each exception is about, not just the metric - three
        // rows reading "Utilization (critical)" tell the reader nothing.
        detail: `${critical.length} critical and ${high.length} high exceptions are open on ${s.network.reportDate}. The most severe: ${s.exceptions
          .slice(0, 3)
          .map((x) => {
            const subject = x.parkAndPaySiteId
              ? (s.parkAndPay.sites.find((p) => p.id === x.parkAndPaySiteId)?.code ?? 'Park & Pay')
              : (x.facilityId ? (s.facilities.find((f) => f.facilityId === x.facilityId)?.code ?? x.facilityId) : (x.regionId ?? 'Network'))
            return `${subject} — ${x.metricLabel} (${x.severity})`
          })
          .join('; ')}. Each one carries the actual, the threshold that fired it and a named owner.`,
        figures: [
          { label: 'Critical', value: String(critical.length), tone: critical.length > 0 ? 'bad' : undefined },
          { label: 'High', value: String(high.length) },
          { label: 'Total', value: String(s.exceptions.length) },
        ],
        kpi: null,
        source: 'Exception engine · thresholds from Settings',
        href: '/exceptions',
        hrefLabel: 'Open Exceptions',
        confidence: 'exact',
        severity: critical.length > 0 ? 'critical' : 'high',
        followUps: ['Which warehouses are over capacity?', 'What is the cold-chain compliance?'],
      }
    },
  },

  // ---- Cold chain, inventory, operations, data quality -------------------
  {
    id: 'cold-chain',
    run: (e, s) => {
      if (!has(e.raw, 'temperature', 'cold chain', 'coldchain', 'excursion', 'compliance', 'fefo')) return null
      const c = s.coldChain
      const askingFefo = has(e.raw, 'fefo')
      const kpi = askingFefo ? KPI_DEFINITIONS.fefoCompliance : KPI_DEFINITIONS.temperatureCompliance
      return {
        ...base(),
        interpretation: askingFefo ? 'FEFO picking compliance' : 'Temperature compliance and excursions',
        headline: askingFefo ? 'FEFO compliance' : 'Temperature compliance',
        value: formatPct(askingFefo ? c.fefoCompliancePct : c.temperatureCompliancePct, 2),
        valueMissing: (askingFefo ? c.fefoCompliancePct : c.temperatureCompliancePct) === null,
        detail: `Temperature compliance is ${formatPct(c.temperatureCompliancePct, 2)} against a ${THRESHOLDS.temperatureCompliancePct}% threshold, with ${c.excursions24h} excursions in the last 24 hours of which ${c.criticalExcursions24h} are critical. FEFO picking compliance is ${formatPct(c.fefoCompliancePct, 2)} against ${THRESHOLDS.fefoCompliancePct}%.`,
        figures: [
          { label: 'Temperature', value: formatPct(c.temperatureCompliancePct, 2) },
          { label: 'FEFO', value: formatPct(c.fefoCompliancePct, 2) },
          { label: 'Excursions 24h', value: String(c.excursions24h), tone: c.criticalExcursions24h > 0 ? 'bad' : undefined },
          { label: 'Critical', value: String(c.criticalExcursions24h), tone: c.criticalExcursions24h > 0 ? 'bad' : undefined },
        ],
        kpi,
        source: provenance(kpi),
        href: '/cold-chain',
        hrefLabel: 'Open Cold Chain',
        confidence: 'exact',
        severity: c.criticalExcursions24h > 0 ? 'critical' : null,
        followUps: ['How much stock is near expiry?', 'What exceptions are open today?'],
      }
    },
  },
  {
    id: 'inventory',
    run: (e, s) => {
      if (!has(e.raw, 'expiry', 'expire', 'near expiry', 'ageing', 'aging', 'old stock', 'shelf life')) return null
      // The near-expiry buckets are defined once in the inventory data layer;
      // reusing that definition keeps this answer and the Inventory screen in
      // agreement rather than each deciding what "near expiry" means.
      const pallets = NEAR_EXPIRY_PALLETS
      return {
        ...base(),
        interpretation: `Stock within ${THRESHOLDS.nearExpiryDays} days of expiry`,
        headline: 'Near-expiry stock',
        value: formatNumber(pallets),
        detail: `${formatNumber(pallets)} pallets sit inside the ${THRESHOLDS.nearExpiryDays}-day expiry window. A further ${formatNumber(s.expiryUndatedPallets)} pallets carry no expiry date in the feed at all and are reported separately rather than assumed to be in date.`,
        figures: [
          { label: 'Near expiry', value: formatNumber(pallets) },
          { label: 'No expiry date', value: formatNumber(s.expiryUndatedPallets) },
          { label: 'Window', value: `${THRESHOLDS.nearExpiryDays} days` },
        ],
        kpi: KPI_DEFINITIONS.nearExpiryPallets,
        source: provenance(KPI_DEFINITIONS.nearExpiryPallets),
        href: '/inventory',
        hrefLabel: 'Open Inventory',
        confidence: 'exact',
        severity: pallets > 0 ? 'medium' : null,
        followUps: ['What is the cold-chain compliance?', 'What exceptions are open today?'],
      }
    },
  },
  {
    id: 'data-quality',
    run: (e, s) => {
      if (!has(e.raw, 'data quality', 'missing', 'trust', 'reliable', 'feed', 'stale')) return null
      const dq = s.dataQuality
      return {
        ...base(),
        interpretation: 'Data quality of the published figures',
        headline: 'Data quality',
        value: formatPct(dq.healthScorePct, 1),
        detail: `${formatPct(dq.healthScorePct, 1)} of source records loaded without rejection or a missing mapping. ${formatNumber(s.network.facilitiesMissingCapacity)} facilities have no capacity master row; their ${formatNumber(s.network.excludedUtilizedPallets)} occupied pallets are reported but held out of the utilization denominator rather than folded in. Data is ${s.dataAgeHours}h old${s.isStale ? ' and past the staleness threshold' : ''}.`,
        figures: [
          { label: 'Score', value: formatPct(dq.healthScorePct, 1) },
          { label: 'Rejected', value: formatNumber(dq.recordsRejected) },
          { label: 'No capacity master', value: String(s.network.facilitiesMissingCapacity) },
          { label: 'Excluded pallets', value: formatNumber(s.network.excludedUtilizedPallets) },
        ],
        kpi: KPI_DEFINITIONS.dataQualityScore,
        source: provenance(KPI_DEFINITIONS.dataQualityScore),
        href: '/data-quality',
        hrefLabel: 'Open Data Quality',
        confidence: 'exact',
        severity: dq.healthScorePct < THRESHOLDS.dataQualityPct ? 'high' : null,
        followUps: ['What exceptions are open today?', 'What is network utilization today?'],
      }
    },
  },

  // ---- Forecast ----------------------------------------------------------
  {
    id: 'forecast',
    run: (e, s) => {
      if (!has(e.raw, 'forecast', 'project', 'next 30', 'next 7', 'will we', 'expected')) return null
      const n = s.network
      return {
        ...base(),
        interpretation: 'Network utilization projection',
        headline: '30-day projection',
        value: formatPct(n.forecast.horizon30Pct, 2),
        valueMissing: n.forecast.horizon30Pct === null,
        detail: `From ${formatPct(n.utilizationPct, 2)} today, the network projects to ${formatPct(n.forecast.horizon7Pct, 1)} in 7 days, ${formatPct(n.forecast.horizon14Pct, 1)} in 14 and ${formatPct(n.forecast.horizon30Pct, 1)} in 30. This is a damped extrapolation of the recent trend computed in the application — there is no model behind it and it is not described as one.`,
        figures: [
          { label: 'Today', value: formatPct(n.utilizationPct, 2) },
          { label: '7 day', value: formatPct(n.forecast.horizon7Pct, 1) },
          { label: '14 day', value: formatPct(n.forecast.horizon14Pct, 1) },
          { label: '30 day', value: formatPct(n.forecast.horizon30Pct, 1) },
        ],
        kpi: KPI_DEFINITIONS.forecastUtilization,
        source: provenance(KPI_DEFINITIONS.forecastUtilization),
        href: '/utilization',
        hrefLabel: 'Open Utilization',
        confidence: 'exact',
        severity: null,
        followUps: ['Which warehouses are over capacity?', 'Which region is most utilized?'],
      }
    },
  },

  // ---- Network headline (deliberately last: it is the widest match) ------
  {
    id: 'network',
    run: (e, s) => {
      if (!has(e.raw, 'utilization', 'utilisation', 'capacity', 'occupied', 'empty', 'network', 'today', 'overall', 'total')) {
        return null
      }
      const n = s.network
      const wantsEmpty = has(e.raw, 'empty', 'available', 'free', 'headroom', 'spare')
      const kpi = wantsEmpty ? KPI_DEFINITIONS.availableCapacity : KPI_DEFINITIONS.networkUtilization
      return {
        ...base(),
        interpretation: wantsEmpty ? 'Network available capacity' : 'Network utilization on the report date',
        headline: wantsEmpty ? 'Available capacity' : 'Network utilization',
        value: wantsEmpty ? formatNumber(n.availableCapacity) : formatPct(n.utilizationPct, 2),
        valueMissing: (wantsEmpty ? n.availableCapacity : n.utilizationPct) === null,
        detail: wantsEmpty
          ? `${formatNumber(n.availableCapacity)} positions are genuinely available, summed facility by facility so a site that is over capacity cannot mask headroom elsewhere. The legacy "empty pallets" figure is ${formatNumber(n.netEmptyPallets)}; the two differ by the ${formatNumber(n.overCapacityPallets)} pallets held above capacity. Empty positions are available capacity, not waste.`
          : `The network is at ${formatPct(n.utilizationPct, 2)} on ${n.reportDate} — ${formatNumber(n.utilizedPallets)} pallets against ${formatNumber(n.capacity)} positions across ${n.facilityCount} facilities, ${formatPp(n.variancePct, 2)} against an ${n.targetPct}% budget. Seven-day movement ${formatPp(n.change7dPp, 2)}. ${formatNumber(n.excludedUtilizedPallets)} pallets at ${n.facilitiesMissingCapacity} facilities with no capacity master row are excluded from the denominator.`,
        figures: [
          { label: 'Capacity', value: formatNumber(n.capacity) },
          { label: 'Occupied', value: formatNumber(n.utilizedPallets) },
          { label: 'Available', value: formatNumber(n.availableCapacity) },
          { label: 'Over capacity', value: formatNumber(n.overCapacityPallets), tone: n.overCapacityPallets > 0 ? 'bad' : undefined },
        ],
        kpi,
        source: provenance(kpi),
        href: wantsEmpty ? '/capacity' : '/utilization',
        hrefLabel: wantsEmpty ? 'Open Capacity' : 'Open Utilization',
        confidence: 'exact',
        severity: null,
        followUps: ['Which region is most utilized?', 'What does Park & Pay do to the network figure?'],
      }
    },
  },
]

/**
 * Answer a question, or say plainly that it cannot be answered.
 *
 * Resolvers are tried in order and the first match wins, so the specific ones
 * (a named location) run before the broad ones (the network headline).
 */
export function answerQuestion(question: string, snapshot: ControlTowerSnapshot): Answer {
  const entities = resolveEntities(question, snapshot)
  if (entities.raw.length === 0) return unanswered(question, suggestedQuestions(snapshot).slice(0, 4))

  for (const resolver of RESOLVERS) {
    const answer = resolver.run(entities, snapshot)
    if (answer) return answer
  }
  return unanswered(question, suggestedQuestions(snapshot).slice(0, 4))
}

/**
 * Questions the engine can answer, drawn from what is actually in the data
 * today - so a suggestion never leads to an empty result.
 */
export function suggestedQuestions(snapshot: ControlTowerSnapshot): string[] {
  const out = ['What is network utilization today?']

  const over = snapshot.facilities.filter((f) => f.capacity !== null && f.utilizedPallets > f.capacity)
  if (over.length > 0) out.push('Which warehouses are over capacity?')

  const hottest = [...snapshot.regions].sort((a, b) => (b.utilizationPct ?? 0) - (a.utilizationPct ?? 0))[0]
  if (hottest) out.push(`How is ${hottest.regionId} doing?`)

  if (snapshot.parkAndPay.sites.length > 0) {
    out.push('What does Park & Pay do to the network figure?')
    if (snapshot.parkAndPay.contractsExpiringSoon > 0) out.push('Which Park & Pay contracts expire soon?')
  }

  out.push('Where is the spare capacity?')
  if (snapshot.exceptions.length > 0) out.push('What exceptions are open today?')
  out.push('What is the 30-day forecast?')

  const worst = [...snapshot.facilities].sort((a, b) => (b.utilizationPct ?? 0) - (a.utilizationPct ?? 0))[0]
  if (worst) out.push(`How is ${worst.code} doing?`)

  out.push('What is the cold-chain compliance?')
  out.push('How much stock is near expiry?')
  out.push('Can I trust today’s data?')

  return out
}

// ---------------------------------------------------------------------------
// Model connection
// ---------------------------------------------------------------------------

/**
 * The payload a language model would be given if one were connected.
 *
 * It is deliberately the semantic layer - aggregated figures, definitions and
 * thresholds - and not the underlying rows. A model asked to narrate these
 * numbers cannot invent a facility that does not exist, and no depositor-level
 * or commercially sensitive detail leaves the application.
 *
 * It is rendered on screen so the reader can see exactly what would be sent
 * before anyone agrees to send it.
 */
export function buildModelContext(snapshot: ControlTowerSnapshot) {
  return {
    reportDate: snapshot.network.reportDate,
    lastRefreshAt: snapshot.lastRefreshAt,
    scope: {
      regions: snapshot.filters.regionIds.length > 0 ? snapshot.filters.regionIds : 'all',
      facilities: snapshot.network.facilityCount,
    },
    network: {
      utilizationPct: snapshot.network.utilizationPct,
      capacity: snapshot.network.capacity,
      utilizedPallets: snapshot.network.utilizedPallets,
      availableCapacity: snapshot.network.availableCapacity,
      overCapacityPallets: snapshot.network.overCapacityPallets,
      targetPct: snapshot.network.targetPct,
      change7dPp: snapshot.network.change7dPp,
      excludedUtilizedPallets: snapshot.network.excludedUtilizedPallets,
    },
    parkAndPay: {
      utilizationPct: snapshot.parkAndPay.network.parkAndPay.utilizationPct,
      capacity: snapshot.parkAndPay.network.parkAndPay.capacity,
      combinedUtilizationPct: snapshot.parkAndPay.network.combined.utilizationPct,
      effectPp: snapshot.parkAndPay.network.utilizationImpactPp,
    },
    regions: snapshot.regions.map((r) => ({
      regionId: r.regionId,
      utilizationPct: r.utilizationPct,
      targetPct: r.targetPct,
      overCapacityPallets: r.overCapacityPallets,
    })),
    exceptions: snapshot.exceptions.slice(0, 10).map((e) => ({
      severity: e.severity,
      metric: e.metricLabel,
      actual: e.actual,
      threshold: e.threshold,
      owner: e.owner,
    })),
    definitions: Object.values(KPI_DEFINITIONS).map((k) => ({
      id: k.id,
      name: k.name,
      formula: k.formula,
      unit: k.unit,
    })),
    thresholds: THRESHOLDS,
  }
}
