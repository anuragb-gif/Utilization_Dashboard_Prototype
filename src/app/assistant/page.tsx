'use client'

import * as React from 'react'
import Link from 'next/link'
import { ArrowRight, Check, CornerDownLeft, Minus, Search, Sparkles } from 'lucide-react'
import type { Answer } from '@/lib/assistant/engine'
import { answerQuestion, buildModelContext, suggestedQuestions } from '@/lib/assistant/engine'
import {
  CAPABILITY_NOTES,
  CONNECTION_REQUIREMENTS,
  MODEL_CONNECTION,
} from '@/lib/config/assistant'
import { PageHeader } from '@/components/layout/page-header'
import { Card, CardHeader, InfoTip, SectionTitle, StatusChip, Value } from '@/components/ui/primitives'
import { useSnapshot } from '@/lib/state/use-snapshot'
import { useSession } from '@/lib/state/session-context'
import { cn } from '@/lib/utils'
import type { StatusLevel } from '@/lib/domain/types'

const SEVERITY_STATUS: Record<string, StatusLevel> = {
  critical: 'critical',
  high: 'high',
  medium: 'watch',
  low: 'info',
}

/**
 * Assistant.
 *
 * A working analyst over the dashboard's own figures — and deliberately not an
 * LLM chat window, because no language model is connected to this prototype
 * and a screen that implied one would be the single most misleading thing in
 * it. What it does instead is real: it resolves a question to an intent,
 * reads the figure out of the semantic layer, and shows the formula, the
 * source system and the owner beside the answer so it can be checked.
 *
 * The second half of the screen is the honest version of the roadmap: exactly
 * what payload a model would receive, what is already in place for it, and
 * what is not. Someone deciding whether to connect one can see the whole
 * position without being sold anything.
 */
export default function AssistantPage() {
  const snapshot = useSnapshot()
  const { log } = useSession()

  const suggestions = React.useMemo(() => suggestedQuestions(snapshot), [snapshot])
  const [draft, setDraft] = React.useState('')
  const [asked, setAsked] = React.useState<string[]>([])

  // Answers are derived, never stored: re-running them against the current
  // snapshot means a filter change updates the answer instead of leaving a
  // stale figure on screen.
  const answers = React.useMemo(
    () => asked.map((question) => ({ question, answer: answerQuestion(question, snapshot) })),
    [asked, snapshot],
  )

  const ask = React.useCallback(
    (question: string) => {
      const trimmed = question.trim()
      if (!trimmed) return
      setAsked((prev) => [trimmed, ...prev].slice(0, 8))
      setDraft('')
      log(`Assistant question: ${trimmed}`, 'Answered from the current snapshot')
    },
    [log],
  )

  const modelContext = React.useMemo(() => buildModelContext(snapshot), [snapshot])
  const contextJson = React.useMemo(() => JSON.stringify(modelContext, null, 2), [modelContext])
  const readyCount = CONNECTION_REQUIREMENTS.filter((r) => r.ready).length

  return (
    <div className="space-y-4">
      <PageHeader
        title="Assistant"
        description="Ask about today’s position and get the figure with the calculation behind it. Rules-based, not a language model — every answer is read out of the same snapshot the screens render."
        crumbs={[{ label: 'Control Tower', href: '/' }, { label: 'Assistant' }]}
        actions={
          <span className="inline-flex items-center gap-1.5 rounded-md border border-hairline bg-slate-50 px-2.5 py-1 text-[11.5px] font-semibold text-ink-soft">
            <Sparkles className="h-3 w-3 text-ink-muted" strokeWidth={2.4} aria-hidden />
            Rules-based · no model connected
          </span>
        }
      />

      <Card>
        <div className="border-b border-hairline px-4 py-3">
          <form
            onSubmit={(event) => {
              event.preventDefault()
              ask(draft)
            }}
            className="flex flex-wrap items-center gap-2"
          >
            <label htmlFor="assistant-q" className="sr-only">
              Ask a question about the current position
            </label>
            <div className="relative min-w-0 flex-1">
              <Search
                className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-muted"
                strokeWidth={2.2}
                aria-hidden
              />
              <input
                id="assistant-q"
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                placeholder="e.g. How is WEST-2 doing? · Which warehouses are over capacity? · What is the 30-day forecast?"
                className="h-9 w-full min-w-0 rounded-md border border-hairline bg-surface pl-8 pr-3 text-[12.5px] text-ink placeholder:text-ink-faint focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100"
              />
            </div>
            <button
              type="submit"
              disabled={draft.trim().length === 0}
              className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-md border border-brand-500 bg-brand-500 px-3 text-[12.5px] font-medium text-white transition-colors hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <CornerDownLeft className="h-3.5 w-3.5" strokeWidth={2.5} aria-hidden />
              Ask
            </button>
          </form>

          <div className="mt-2.5">
            <SectionTitle className="mb-1.5">Questions it can answer exactly</SectionTitle>
            <ul className="flex flex-wrap gap-1.5">
              {suggestions.map((question) => (
                <li key={question}>
                  <button
                    type="button"
                    onClick={() => ask(question)}
                    className="rounded border border-hairline bg-surface px-2 py-1 text-[11.5px] font-medium text-ink-soft transition-colors hover:border-brand-300 hover:bg-brand-50 hover:text-brand-700"
                  >
                    {question}
                  </button>
                </li>
              ))}
            </ul>
            <p className="mt-1.5 text-[10.5px] leading-relaxed text-ink-faint">
              These are built from what is actually in today’s data, so none of them leads to an empty result. Free text
              works too — a region, a warehouse code, a Park &amp; Pay code or a metric name is enough.
            </p>
          </div>
        </div>

        {answers.length === 0 ? (
          <div className="px-4 py-10 text-center">
            <p className="text-[13px] font-semibold text-ink">Nothing asked yet</p>
            <p className="mx-auto mt-1 max-w-lg text-[11.5px] leading-relaxed text-ink-muted">
              Answers appear here with the figure, the formula that produced it, the source system and a link to the
              screen it came from — so anything said here can be checked against the dashboard rather than taken on
              trust.
            </p>
          </div>
        ) : (
          <ul aria-label="Answers" className="divide-y divide-hairline">
            {answers.map(({ question, answer }, index) => (
              <li key={`${question}-${index}`}>
                <AnswerBlock question={question} answer={answer} onAsk={ask} />
              </li>
            ))}
          </ul>
        )}
      </Card>

      <div className="grid items-start gap-3 xl:grid-cols-[1fr_1fr]">
        <Card>
          <CardHeader
            title="Today’s briefing"
            subtitle="The rule engine’s read of the current position"
            tip="Each line is generated by a rule over the same rollups the screens render, and names the calculation it came from. There is no language model behind these — they are written templates filled with computed figures."
          />
          <ul className="divide-y divide-hairline">
            {snapshot.insights.slice(0, 6).map((insight) => (
              <li key={insight.id} className="px-4 py-2.5">
                <div className="flex items-start gap-2">
                  <StatusChip status={SEVERITY_STATUS[insight.severity] ?? 'info'} size="xs" className="mt-0.5 shrink-0" />
                  <div className="min-w-0">
                    <p className="text-[11.5px] leading-relaxed text-ink">{insight.text}</p>
                    <p className="mt-1 flex flex-wrap items-center gap-x-2 text-[10px] text-ink-faint">
                      <span>{insight.source}</span>
                      {insight.href ? (
                        <Link href={insight.href} className="font-semibold text-brand-600 hover:underline">
                          Open →
                        </Link>
                      ) : null}
                    </p>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </Card>

        <Card>
          <CardHeader
            title="What this is, and what it is not"
            subtitle="Stated plainly, because the distinction matters"
            tip="An assistant that sounds confident and is occasionally wrong about an operational figure is worse than no assistant. This one is narrow and checkable by design."
          />
          <div className="grid gap-px bg-hairline sm:grid-cols-2">
            <div className="bg-surface px-4 py-3">
              <SectionTitle className="mb-2 flex items-center gap-1.5">
                <Check className="h-3 w-3 text-ok" strokeWidth={3} aria-hidden />
                It does
              </SectionTitle>
              <ul className="space-y-1.5">
                {CAPABILITY_NOTES.does.map((line) => (
                  <li key={line} className="text-[11px] leading-relaxed text-ink-soft">
                    {line}
                  </li>
                ))}
              </ul>
            </div>
            <div className="bg-surface px-4 py-3">
              <SectionTitle className="mb-2 flex items-center gap-1.5">
                <Minus className="h-3 w-3 text-ink-muted" strokeWidth={3} aria-hidden />
                It does not
              </SectionTitle>
              <ul className="space-y-1.5">
                {CAPABILITY_NOTES.doesNot.map((line) => (
                  <li key={line} className="text-[11px] leading-relaxed text-ink-soft">
                    {line}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </Card>
      </div>

      <Card>
        <CardHeader
          title="Connecting a language model"
          subtitle={`Not connected · ${readyCount} of ${CONNECTION_REQUIREMENTS.length} prerequisites already in place`}
          tip="A model belongs in front of this engine, translating a question into an intent and narrating the result — not behind it doing the arithmetic. This panel is the honest position on what that would take."
          actions={<StatusChip status="unknown" label="No model configured" size="xs" />}
        />
        <div className="grid gap-px bg-hairline lg:grid-cols-[1fr_1fr]">
          <div className="min-w-0 bg-surface">
            <ul className="divide-y divide-hairline">
              {CONNECTION_REQUIREMENTS.map((requirement) => (
                <li key={requirement.id} className="flex items-start gap-2.5 px-4 py-2.5">
                  <span
                    className={cn(
                      'mt-0.5 inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full border',
                      requirement.ready ? 'border-ok-line bg-ok-soft text-ok' : 'border-hairline bg-slate-50 text-ink-faint',
                    )}
                    aria-hidden
                  >
                    {requirement.ready ? <Check className="h-2.5 w-2.5" strokeWidth={3.5} /> : <Minus className="h-2.5 w-2.5" strokeWidth={3.5} />}
                  </span>
                  <div className="min-w-0">
                    <p className="text-[11.5px] font-semibold text-ink">
                      {requirement.label}
                      <span className={cn('ml-1.5 text-[9.5px] font-medium uppercase tracking-wider', requirement.ready ? 'text-ok' : 'text-ink-faint')}>
                        {requirement.ready ? 'in place' : 'outstanding'}
                      </span>
                    </p>
                    <p className="mt-0.5 text-[10.5px] leading-relaxed text-ink-muted">{requirement.detail}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>

          <div className="min-w-0 bg-surface px-4 py-3">
            <SectionTitle className="mb-1.5 flex items-center gap-1.5">
              Context that would be sent
              <InfoTip
                label="Context that would be sent"
                text="Shown in full so it can be reviewed before anyone agrees to send it. It is the aggregated semantic layer — figures, definitions and thresholds — never the underlying rows, so no depositor-level or contractual detail leaves the application."
              />
            </SectionTitle>
            <dl className="mb-2 grid grid-cols-2 gap-x-4 gap-y-1 text-[11px] sm:grid-cols-4">
              <ConfigField label="Provider" value={MODEL_CONNECTION.provider} />
              <ConfigField label="Model" value={MODEL_CONNECTION.model} />
              <ConfigField label="Endpoint" value={MODEL_CONNECTION.endpoint} />
              <ConfigField label="Payload" value={`${(contextJson.length / 1024).toFixed(1)} KB`} />
            </dl>
            <p className="mb-2 text-[10.5px] leading-relaxed text-ink-muted">
              Credential: {MODEL_CONNECTION.credentialSource}. Nothing on this page makes a network request — the JSON
              below is rendered locally so it can be inspected, not transmitted.
            </p>
            <pre className="max-h-64 overflow-auto rounded-md border border-hairline bg-slate-50 p-3 text-[10.5px] leading-relaxed text-ink-soft">
              <code>{contextJson}</code>
            </pre>
          </div>
        </div>
      </Card>
    </div>
  )
}

function ConfigField({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="min-w-0">
      <dt className="text-[9.5px] font-semibold uppercase tracking-wider text-ink-faint">{label}</dt>
      <dd className="truncate font-medium text-ink-soft">
        <Value missing={value === null} reason="No model is configured.">
          {value}
        </Value>
      </dd>
    </div>
  )
}

function AnswerBlock({
  question,
  answer,
  onAsk,
}: {
  question: string
  answer: Answer
  onAsk: (question: string) => void
}) {
  const unmatched = answer.confidence === 'unanswered'
  return (
    <div className="px-4 py-3.5">
      <p className="flex items-start gap-2 text-[12.5px] font-semibold text-ink">
        <Search className="mt-0.5 h-3 w-3 shrink-0 text-ink-muted" strokeWidth={2.4} aria-hidden />
        {question}
      </p>
      <p className="mt-1 text-[10.5px] text-ink-faint">
        Read as: <span className="font-medium text-ink-muted">{answer.interpretation}</span>
      </p>

      <div
        className={cn(
          'mt-2 rounded-lg border px-3.5 py-3',
          unmatched ? 'border-hairline bg-slate-50' : 'border-brand-200 bg-brand-50/40',
        )}
      >
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <p className="text-[12.5px] font-bold text-ink">{answer.headline}</p>
          {answer.value !== null ? (
            <p
              className={cn(
                'tnum text-[26px] font-bold leading-none',
                answer.severity === 'critical' ? 'text-bad' : 'text-ink',
              )}
            >
              <Value missing={answer.valueMissing} reason="This figure is not computable from the data in scope.">
                {answer.value}
              </Value>
            </p>
          ) : null}
        </div>

        <p className="mt-1.5 text-[11.5px] leading-relaxed text-ink-soft">{answer.detail}</p>

        {answer.figures.length > 0 ? (
          <dl className="mt-2.5 grid grid-cols-2 gap-x-4 gap-y-1.5 sm:grid-cols-4">
            {answer.figures.map((figure) => (
              <div key={figure.label} className="min-w-0">
                <dt className="text-[9.5px] font-semibold uppercase tracking-wider text-ink-muted">{figure.label}</dt>
                <dd
                  className={cn(
                    'tnum text-[13px] font-bold',
                    figure.tone === 'bad' ? 'text-bad' : figure.tone === 'good' ? 'text-ok' : 'text-ink',
                  )}
                >
                  <Value missing={figure.missing}>{figure.value}</Value>
                </dd>
              </div>
            ))}
          </dl>
        ) : null}

        {answer.kpi ? (
          <p className="mt-2.5 border-t border-brand-200/70 pt-2 font-mono text-[10.5px] leading-relaxed text-ink-muted">
            {answer.kpi.formula}
          </p>
        ) : null}

        <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
          <p className="text-[10px] text-ink-faint">{answer.source}</p>
          {answer.href && answer.hrefLabel ? (
            <Link
              href={answer.href}
              className="inline-flex items-center gap-1 text-[11.5px] font-semibold text-brand-600 transition-colors hover:underline"
            >
              {answer.hrefLabel}
              <ArrowRight className="h-3 w-3" strokeWidth={2.5} aria-hidden />
            </Link>
          ) : null}
        </div>
      </div>

      {answer.followUps.length > 0 ? (
        <div className="mt-2">
          <SectionTitle className="mb-1.5">{unmatched ? 'Try one of these' : 'Follow up'}</SectionTitle>
          <ul className="flex flex-wrap gap-1.5">
            {answer.followUps.map((followUp) => (
              <li key={followUp}>
                <button
                  type="button"
                  onClick={() => onAsk(followUp)}
                  className="rounded border border-hairline bg-surface px-2 py-1 text-[11px] font-medium text-ink-soft transition-colors hover:border-brand-300 hover:bg-brand-50 hover:text-brand-700"
                >
                  {followUp}
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  )
}
