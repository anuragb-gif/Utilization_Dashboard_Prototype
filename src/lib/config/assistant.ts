/**
 * Assistant configuration and the model-connection placeholder.
 *
 * No language model is connected to this prototype. `MODEL_CONNECTION` records
 * what would have to be configured for one to be, and the screen renders it as
 * an unconfigured state rather than pretending the wiring exists. Nothing here
 * makes a network call.
 */

export interface ModelConnection {
  connected: boolean
  provider: string | null
  model: string | null
  endpoint: string | null
  /** Where the credential would come from. No key is stored in the client. */
  credentialSource: string
}

export const MODEL_CONNECTION: ModelConnection = {
  connected: false,
  provider: null,
  model: null,
  endpoint: null,
  credentialSource: 'Server-side secret store — never shipped to the browser',
}

export interface ConnectionRequirement {
  id: string
  label: string
  detail: string
  /** Whether this prototype already satisfies it. */
  ready: boolean
}

/**
 * What has to be true before a model is put in front of these figures.
 *
 * Three of these are already done, because they were built for the dashboard
 * rather than for the assistant: a semantic layer to ground answers in, a
 * repository seam to read it through, and a deterministic engine to do the
 * arithmetic. The rest are genuinely outstanding.
 */
export const CONNECTION_REQUIREMENTS: ConnectionRequirement[] = [
  {
    id: 'semantic-layer',
    label: 'Semantic layer to ground answers in',
    detail:
      'Every KPI has a name, a formula, a unit, a source system and an owner in the registry, so a model narrating a figure can cite where it came from instead of describing it loosely.',
    ready: true,
  },
  {
    id: 'deterministic-arithmetic',
    label: 'Arithmetic stays outside the model',
    detail:
      'Utilization, rollups and variances are computed in the domain layer and handed to the model as finished figures. A model that is asked to do the division can get it wrong; one that is asked to read a number out loud cannot.',
    ready: true,
  },
  {
    id: 'bounded-context',
    label: 'Bounded, aggregated context',
    detail:
      'The payload is the aggregated semantic layer, not the underlying rows. No depositor-level, contractual or personally identifying detail is included, which is what makes sending it acceptable at all.',
    ready: true,
  },
  {
    id: 'server-route',
    label: 'Server-side inference route',
    detail:
      'A backend endpoint holding the credential and enforcing the caller’s region and warehouse scope before any context is assembled. The browser must never hold a key or be trusted to narrow the scope itself.',
    ready: false,
  },
  {
    id: 'grounding-check',
    label: 'Answer grounding check',
    detail:
      'Every figure in a generated answer verified back against the snapshot before it is displayed, and the answer suppressed if it does not reconcile. Without this an assistant is a plausible-sounding number generator.',
    ready: false,
  },
  {
    id: 'audit',
    label: 'Prompt and response audit trail',
    detail:
      'Who asked what, what context was assembled, what came back, and which figures it cited — retained on the same terms as the rest of the audit log.',
    ready: false,
  },
  {
    id: 'evaluation',
    label: 'Evaluation set before rollout',
    detail:
      'A fixed set of questions with known-correct answers, run on every model or prompt change. Accuracy on operational figures is not something to discover in a management review.',
    ready: false,
  },
]

/** What the assistant does and does not do, stated on the screen. */
export const CAPABILITY_NOTES = {
  does: [
    'Resolves a question to a fixed set of intents over the published figures',
    'Reads the answer out of the same snapshot every screen renders',
    'Shows the formula, source system and owner behind every figure',
    'Says plainly when it cannot answer, rather than guessing',
  ],
  doesNot: [
    'Generate language — every sentence here is a written template',
    'Infer, estimate or extrapolate beyond the computed figures',
    'Answer anything outside the dashboard’s own data',
    'Send anything anywhere — no request leaves the browser',
  ],
}
