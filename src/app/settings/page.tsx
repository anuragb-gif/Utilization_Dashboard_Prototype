'use client'

import * as React from 'react'
import { PageHeader } from '@/components/layout/page-header'
import { Card, CardHeader, SectionTitle, StatusChip } from '@/components/ui/primitives'
import { useSession } from '@/lib/state/session-context'
import { KPI_LIST } from '@/lib/config/kpi-definitions'
import { THRESHOLDS, UTILIZATION_BANDS } from '@/lib/config/thresholds'
import { HEALTH_WEIGHTS } from '@/lib/domain/health'
import { ROLES } from '@/lib/config/roles'
import { REGION_SNAPSHOT } from '@/lib/data/master'
import { REPORT_CONTEXT } from '@/lib/repository'
import { formatNumber } from '@/lib/utils'

const UNIT_LABEL: Record<string, string> = {
  percent: '%',
  pallets: 'pallets',
  count: 'count',
  minutes: 'minutes',
  hours: 'hours',
  inr_lakh: 'INR lakh',
  score: 'score',
}

export default function SettingsPage() {
  const { role, can } = useSession()
  const canAdmin = can('admin:thresholds')

  const weightedBudget = React.useMemo(() => {
    const entries = Object.values(REGION_SNAPSHOT)
    const capacity = entries.reduce((sum, r) => sum + r.capacity, 0)
    const weighted = entries.reduce((sum, r) => sum + r.capacity * r.targetPct, 0)
    return capacity === 0 ? null : weighted / capacity
  }, [])

  return (
    <div className="space-y-4">
      <PageHeader
        title="Settings & Definitions"
        description="The semantic layer behind every number in this application: what each KPI means, which thresholds it is measured against, and who can see it. Nothing here is decorative — the screens read these objects at runtime."
        crumbs={[{ label: 'Control Tower', href: '/' }, { label: 'Settings' }]}
        actions={
          <StatusChip
            status={canAdmin ? 'healthy' : 'info'}
            label={canAdmin ? 'Editable by your role' : 'Read-only for your role'}
          />
        }
      />

      {!canAdmin ? (
        <p className="rounded-md border border-brand-200 bg-brand-50 px-4 py-2 text-[11.5px] text-brand-800">
          You are signed in as <strong>{role.name}</strong>. Threshold and definition changes are restricted to IT /
          Data Admin. Switch role in the sidebar to see the editable view.
        </p>
      ) : null}

      <Card>
        <CardHeader
          title="KPI Dictionary"
          subtitle={`${KPI_LIST.length} KPIs with formula, target, thresholds, source and owner`}
          tip="Every KPI in the application is defined once in src/lib/config/kpi-definitions.ts and read from there. No component contains its own formula or its own target, which is what stops two screens quietly disagreeing about what a number means."
        />
        <div className="w-full min-w-0 overflow-x-auto">
          <table className="w-full border-collapse">
            <caption className="sr-only">KPI definitions</caption>
            <thead>
              <tr className="border-b border-hairline bg-slate-50/70 text-[10px] uppercase tracking-wider text-ink-muted">
                <th scope="col" className="px-3 py-2 text-left font-semibold">KPI</th>
                <th scope="col" className="px-3 py-2 text-left font-semibold">Formula</th>
                <th scope="col" className="px-3 py-2 text-right font-semibold">Target</th>
                <th scope="col" className="px-3 py-2 text-right font-semibold">Warning</th>
                <th scope="col" className="px-3 py-2 text-right font-semibold">Critical</th>
                <th scope="col" className="px-3 py-2 text-left font-semibold">Source</th>
                <th scope="col" className="px-3 py-2 text-left font-semibold">Owner</th>
                <th scope="col" className="px-3 py-2 text-left font-semibold">Refresh</th>
              </tr>
            </thead>
            <tbody>
              {KPI_LIST.map((kpi) => (
                <tr key={kpi.id} className="border-b border-hairline/70 align-top last:border-0">
                  <td className="px-3 py-2">
                    <p className="text-[12px] font-semibold text-ink">{kpi.name}</p>
                    <p className="mt-0.5 max-w-md text-[10.5px] leading-relaxed text-ink-muted">{kpi.description}</p>
                    {kpi.definitionPending ? (
                      <p className="mt-1 inline-block rounded border border-warn-line bg-warn-soft px-1.5 py-0.5 text-[10px] font-semibold text-[#8a5b08]">
                        {kpi.definitionPending}
                      </p>
                    ) : null}
                  </td>
                  <td className="px-3 py-2">
                    <code className="block max-w-xs rounded bg-slate-100 px-1.5 py-1 font-mono text-[10px] leading-relaxed text-ink-soft">
                      {kpi.formula}
                    </code>
                    <p className="mt-1 text-[10px] text-ink-faint">unit: {UNIT_LABEL[kpi.unit] ?? kpi.unit}</p>
                  </td>
                  <td className="tnum px-3 py-2 text-right text-[11.5px] font-semibold">
                    {kpi.target === null ? <span className="text-ink-faint">—</span> : kpi.target}
                  </td>
                  <td className="tnum px-3 py-2 text-right text-[11.5px] text-warn">
                    {kpi.warningThreshold === null ? <span className="text-ink-faint">—</span> : kpi.warningThreshold}
                  </td>
                  <td className="tnum px-3 py-2 text-right text-[11.5px] text-bad">
                    {kpi.criticalThreshold === null ? <span className="text-ink-faint">—</span> : kpi.criticalThreshold}
                  </td>
                  <td className="px-3 py-2 text-[11px] text-ink-soft">{kpi.source}</td>
                  <td className="px-3 py-2 text-[11px] text-ink-soft">{kpi.owner}</td>
                  <td className="px-3 py-2 text-[11px] text-ink-muted">
                    {kpi.refreshFrequency.replace(/_/g, ' ').toLowerCase()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <div className="grid gap-3 xl:grid-cols-2">
        <Card>
          <CardHeader
            title="Utilization Bands"
            subtitle="Prototype defaults, not ratified business rules"
            tip="These bands drive every status colour, chip and exception in the application. They are declared once so a business owner can change a boundary without a code change to any screen."
          />
          <table className="w-full border-collapse">
            <caption className="sr-only">Utilization Bands</caption>
            <thead>
              <tr className="border-b border-hairline bg-slate-50/70 text-[10px] uppercase tracking-wider text-ink-muted">
                <th scope="col" className="px-3 py-2 text-left font-semibold">Band</th>
                <th scope="col" className="px-3 py-2 text-left font-semibold">Range</th>
                <th scope="col" className="px-3 py-2 text-left font-semibold">Meaning</th>
              </tr>
            </thead>
            <tbody>
              {UTILIZATION_BANDS.map((band) => (
                <tr key={band.id} className="border-b border-hairline/70 last:border-0">
                  <td className="px-3 py-2">
                    <StatusChip status={band.id} label={band.label} />
                  </td>
                  <td className="tnum px-3 py-2 text-[11.5px] font-semibold text-ink">
                    {band.to === null ? `${band.from}% and above` : `${band.from}% – ${band.to}%`}
                  </td>
                  <td className="px-3 py-2 text-[11px] text-ink-muted">{band.description}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="border-t border-hairline bg-slate-50 px-3 py-2 text-[11px] leading-relaxed text-ink-muted">
            Utilization above 100% is never clipped or normalised. A facility at 108.4% is shown at 108.4% with its
            over-capacity pallet count, because rounding it down to 100% would hide the exact situation the report
            exists to surface.
          </p>
        </Card>

        <Card>
          <CardHeader title="Operational Thresholds" subtitle="Every configurable limit the exception engine reads" />
          <dl className="divide-y divide-hairline">
            <Threshold label="Network utilization budget" value={`${THRESHOLDS.networkTargetPct}%`} note="set top-down by the leadership team" />
            <Threshold label="Forecast breach threshold" value={`${THRESHOLDS.breachThresholdPct}%`} note="a facility projected above this is flagged as capacity risk" />
            <Threshold label="Under-utilization threshold" value={`${THRESHOLDS.underUtilizedPct}%`} note="below this, empty space is reviewed as under-utilization" />
            <Threshold label="Rapid increase" value={`+${THRESHOLDS.rapidIncreasePp} pp / 7 days`} note="triggers the rapid utilization increase exception" />
            <Threshold label="Rapid decline" value={`${THRESHOLDS.rapidDeclinePp} pp / 7 days`} note="triggers the operational deterioration exception" />
            <Threshold label="Temperature compliance floor" value={`${THRESHOLDS.temperatureCompliancePct}%`} note="below this, cold-chain health is critical" />
            <Threshold label="FEFO compliance floor" value={`${THRESHOLDS.fefoCompliancePct}%`} note="below this, expiry risk is escalated" />
            <Threshold label="Inventory ageing" value={`${THRESHOLDS.ageingDays} days`} note="stock older than this is reported as ageing" />
            <Threshold label="Near-expiry window" value={`${THRESHOLDS.nearExpiryDays} days`} note="stock expiring inside this window is near-expiry" />
            <Threshold label="Data staleness" value={`${THRESHOLDS.dataStaleAfterHours} hours`} note="data older than this is badged as stale in the header" />
            <Threshold label="Data quality floor" value={`${THRESHOLDS.dataQualityPct}%`} note="clean-record rate below this raises a data-quality exception" />
          </dl>
        </Card>
      </div>

      <div className="grid gap-3 xl:grid-cols-2">
        <Card>
          <CardHeader
            title="Health Score Weights"
            subtitle={`Total weight ${Object.values(HEALTH_WEIGHTS).reduce((a, b) => a + b, 0)}`}
            tip="The composite score is a weighted mean of eight 0–100 sub-scores. Changing a weight here changes the score everywhere it appears; the score's own tooltip shows the current component values."
          />
          <ul className="divide-y divide-hairline">
            {Object.entries(HEALTH_WEIGHTS).map(([key, weight]) => (
              <li key={key} className="flex items-center gap-3 px-4 py-2">
                <span className="w-52 text-[11.5px] font-medium text-ink-soft">
                  {key.replace(/([A-Z])/g, ' $1').replace(/^./, (c) => c.toUpperCase())}
                </span>
                <span className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
                  <span className="block h-full rounded-full bg-brand-400" style={{ width: `${weight * 4}%` }} />
                </span>
                <span className="tnum w-8 text-right text-[11.5px] font-semibold text-ink">{weight}</span>
              </li>
            ))}
          </ul>
        </Card>

        <Card>
          <CardHeader
            title="Regional Budgets"
            subtitle="Set per region; the network budget is set separately"
            tip="The network budget is agreed top-down by the leadership team and does not have to equal the capacity-weighted average of the regional budgets. Both are shown so the difference is explicit rather than a surprise in a review."
          />
          <table className="w-full border-collapse">
            <caption className="sr-only">Regional Budgets</caption>
            <thead>
              <tr className="border-b border-hairline bg-slate-50/70 text-[10px] uppercase tracking-wider text-ink-muted">
                <th scope="col" className="px-3 py-2 text-left font-semibold">Region</th>
                <th scope="col" className="px-3 py-2 text-right font-semibold">Capacity</th>
                <th scope="col" className="px-3 py-2 text-right font-semibold">Budget</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(REGION_SNAPSHOT).map(([regionId, snapshot]) => (
                <tr key={regionId} className="border-b border-hairline/70 last:border-0">
                  <td className="px-3 py-1.5 text-[11.5px] font-semibold text-ink">{regionId}</td>
                  <td className="tnum px-3 py-1.5 text-right text-[11.5px]">{formatNumber(snapshot.capacity)}</td>
                  <td className="tnum px-3 py-1.5 text-right text-[11.5px] font-semibold">{snapshot.targetPct}%</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="border-t border-hairline bg-slate-50 px-3 py-2 text-[11px] leading-relaxed text-ink-muted">
            Capacity-weighted average of the regional budgets is{' '}
            <strong className="tnum text-ink">{weightedBudget === null ? 'N/A' : `${weightedBudget.toFixed(2)}%`}</strong>
            . The published network budget is <strong className="tnum text-ink">{THRESHOLDS.networkTargetPct}%</strong>.
            The gap is deliberate and is a live question for the leadership team, not a defect.
          </p>
        </Card>
      </div>

      <Card>
        <CardHeader
          title="Forecast Method"
          subtitle="What the forecast is, and what it is not"
          tip="Stated explicitly so nobody presents this to a board as machine learning."
        />
        <div className="space-y-2 px-4 py-3 text-[11.5px] leading-relaxed text-ink-soft">
          <p>
            Every figure labelled <strong>prototype forecast</strong> is produced by a deterministic trend
            extrapolation: a least-squares slope over the last 14 days of a facility&rsquo;s utilization, damped
            geometrically so the trend fades rather than compounding, plus a small weekday index. It is implemented in{' '}
            <code className="rounded bg-slate-100 px-1 py-0.5 font-mono text-[10.5px]">
              src/lib/domain/metrics.ts → projectUtilization()
            </code>
            .
          </p>
          <p>
            There is <strong>no trained model, no machine learning and no language model</strong> behind any number in
            this application. The forecast exists to demonstrate the decision flow — &ldquo;which facility do I need to
            act on before it fills&rdquo; — with numbers that behave plausibly. Replacing it with a real model is a
            backend change behind the same interface; no screen would need to change.
          </p>
          <p>
            The Management Insights panel is likewise rule-based. Each insight is generated by an explicit rule over the
            displayed figures and carries the calculation it came from, so any statement it makes can be checked against
            a number on screen.
          </p>
        </div>
      </Card>

      <Card>
        <CardHeader
          title="Access Model"
          subtitle="Authentication and role-based access — placeholder"
          tip="No authentication is wired up in the prototype. The shape of the access model is: roles, the data scope each can see, and the actions each can take. The role switcher in the sidebar applies these scopes to the query, so the model can be reviewed before it is built."
        />
        <div className="border-b border-hairline bg-warn-soft/50 px-4 py-2 text-[11.5px] text-[#8a5b08]">
          <strong>Not implemented.</strong> There is no login, no session, no token and no server-side enforcement in
          this build. Region and facility scoping is applied to the client-side query to demonstrate the intent; in
          production it must be enforced by the API.
        </div>
        <div className="w-full min-w-0 overflow-x-auto">
          <table className="w-full border-collapse">
            <caption className="sr-only">Roles and permissions</caption>
            <thead>
              <tr className="border-b border-hairline bg-slate-50/70 text-[10px] uppercase tracking-wider text-ink-muted">
                <th scope="col" className="px-3 py-2 text-left font-semibold">Role</th>
                <th scope="col" className="px-3 py-2 text-left font-semibold">Data scope</th>
                <th scope="col" className="px-3 py-2 text-left font-semibold">Permissions</th>
              </tr>
            </thead>
            <tbody>
              {ROLES.map((r) => (
                <tr key={r.id} className={`border-b border-hairline/70 last:border-0 ${r.id === role.id ? 'bg-brand-50' : ''}`}>
                  <td className="px-3 py-2">
                    <p className="text-[12px] font-semibold text-ink">
                      {r.name}
                      {r.id === role.id ? (
                        <span className="ml-1.5 rounded bg-brand-500 px-1 py-0.5 text-[9px] font-bold uppercase text-white">
                          current
                        </span>
                      ) : null}
                    </p>
                    <p className="mt-0.5 max-w-sm text-[10.5px] leading-relaxed text-ink-muted">{r.description}</p>
                  </td>
                  <td className="px-3 py-2 text-[11px] text-ink-soft">
                    {r.regionScope ? r.regionScope.join(', ') : 'All regions'}
                    {r.facilityScope ? ` · ${r.facilityScope.join(', ')}` : ''}
                  </td>
                  <td className="px-3 py-2">
                    <ul className="flex flex-wrap gap-1">
                      {r.permissions.map((permission) => (
                        <li
                          key={permission}
                          className="rounded border border-hairline bg-slate-50 px-1.5 py-0.5 font-mono text-[10px] text-ink-soft"
                        >
                          {permission}
                        </li>
                      ))}
                    </ul>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="border-t border-hairline px-4 py-3">
          <SectionTitle className="mb-1.5">Audit logging</SectionTitle>
          <p className="text-[11.5px] leading-relaxed text-ink-muted">
            Acknowledge, assign and export actions are appended to an in-session audit list visible on the Exception
            Centre. In production this becomes an append-only table behind the API carrying the authenticated user, the
            action, the target entity and the timestamp — held server-side, not in browser state as it is here.
          </p>
        </div>
      </Card>

      <Card>
        <CardHeader title="Reporting Context" subtitle="What this build is anchored to" />
        <dl className="grid gap-4 px-4 py-3 text-[11.5px] sm:grid-cols-3">
          <div>
            <dt className="text-[10px] font-semibold uppercase tracking-wider text-ink-faint">Demo snapshot date</dt>
            <dd className="tnum font-semibold text-ink">{REPORT_CONTEXT.reportDate}</dd>
            <dd className="text-[10.5px] leading-snug text-ink-muted">
              Fixed rather than read from the clock, so the prototype is reproducible on any machine on any day.
            </dd>
          </div>
          <div>
            <dt className="text-[10px] font-semibold uppercase tracking-wider text-ink-faint">History held</dt>
            <dd className="tnum font-semibold text-ink">{REPORT_CONTEXT.historyDates.length} days</dd>
            <dd className="text-[10.5px] leading-snug text-ink-muted">
              {REPORT_CONTEXT.historyDates[0]} to {REPORT_CONTEXT.reportDate}, supporting the 7D / 30D / 90D / YTD ranges.
            </dd>
          </div>
          <div>
            <dt className="text-[10px] font-semibold uppercase tracking-wider text-ink-faint">Forecast horizon</dt>
            <dd className="tnum font-semibold text-ink">{REPORT_CONTEXT.forecastDates.length} days</dd>
            <dd className="text-[10.5px] leading-snug text-ink-muted">
              To {REPORT_CONTEXT.forecastDates.at(-1)}. Deterministic projection, regenerated identically every load.
            </dd>
          </div>
        </dl>
      </Card>
    </div>
  )
}

function Threshold({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <div className="flex items-start justify-between gap-4 px-4 py-2">
      <div className="min-w-0">
        <dt className="text-[12px] font-medium text-ink">{label}</dt>
        <dd className="text-[10.5px] leading-snug text-ink-muted">{note}</dd>
      </div>
      <dd className="tnum shrink-0 text-[13px] font-bold text-ink">{value}</dd>
    </div>
  )
}
