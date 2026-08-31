# Snowman Logistics — Pan-India Utilization Control Tower

A design prototype for the proposed replacement of Snowman Logistics' existing
daily Power BI utilization report and its automated email distribution.

It is a working Next.js application, not a mockup: every filter, drilldown,
sort, search, export, drawer and print view actually functions, and every
number is computed from a single deterministic dataset.

> **This build runs on demonstration data.** No Snowman system is connected.
> The figures reproduce the legacy report's published snapshot so the
> prototype can be reviewed against something familiar. Nothing here is live
> operational data, and the interface says so on every screen that could be
> mistaken for one.

---

## 1. Running it

```bash
npm install
npm run dev          # http://localhost:3000
```

```bash
npm run build && npm start   # production build
npm run typecheck            # tsc --noEmit
npm run lint
```

Requires Node 20+. There is no database, no API and no environment
configuration to set up — the dataset is generated in-process at import time.

---

## 2. What it answers

The brief was a list of questions leadership needs answered before 09:00 each
morning. Each is answered on a specific screen:

| Question | Where |
| --- | --- |
| What is current network utilization? | Control Tower — KPI strip |
| How much capacity is occupied / available? | Control Tower — capacity waterfall; Capacity |
| Where are we over capacity? | Control Tower — KPI strip, region heatmap, exception board |
| Where are we under-utilized? | Capacity — available capacity analysis |
| Which regions and warehouses drive the variance? | Region ranking; facility exception board |
| Are we improving or deteriorating vs budget? | Utilization — trend with budget step line |
| How do we compare with the same period last year? | Utilization — comparison summary |
| What happens over the next 7 / 14 / 30 days? | Capacity — capacity risk forecast |
| Which facilities need intervention today? | Exception Centre; facility exception board |
| Are there cold-chain quality risks? | Cold Chain — compliance, excursions, FEFO |
| Is inventory aging / expiry creating risk? | Inventory — ageing and expiry buckets |
| What should management do? | Every exception carries a recommended action and an owner |

---

## 3. Design decisions worth arguing with

These are the judgement calls in the prototype. They are listed here because
they are the parts most worth challenging in review.

**Exception-first, not chart-first.** The landing page leads with what is
wrong. The facility exception board only lists facilities that tripped a rule,
each with the reason it is listed and the person accountable. A facility with
nothing wrong does not need management attention and is not shown by default.

**Over-capacity is never clipped.** A facility at 108.4% is displayed at
108.4% with its over-capacity pallet count. Normalising it to 100% would hide
exactly the situation the report exists to surface.

**Two definitions of spare capacity, both shown.** The legacy report publishes
"empty pallets" as `capacity − occupied` at network level, which nets off
over-capacity pallets. True sellable headroom is the sum of *positive* free
positions, facility by facility. On the demo snapshot these differ by 476
pallets. Both are shown side by side rather than silently reconciled, because
they answer different questions.

**Missing data is reported, not zeroed.** Three facilities in the demo dataset
have no capacity master row. Their occupancy (1,842 pallets) is counted and
reported, but held out of the utilization denominator — a facility with no
capacity has no meaningful utilization, and showing it as 0% would drag the
network figure down by a fabricated amount. `N/A` appears wherever a value is
genuinely absent.

**The forecast is not a model, and says so.** Everything labelled *prototype
forecast* is a damped least-squares trend extrapolation over the last 14 days
with a weekday index (`src/lib/domain/metrics.ts → projectUtilization`). There
is no machine learning and no language model anywhere in this application.
Management Insights is a rule engine, and each insight names the calculation it
came from so any statement can be checked against a number on screen.

**Empty space is "available capacity", not waste.** A facility is only
described as under-utilized when it falls below a configured threshold
(55% by default). A newly commissioned site legitimately sits below that while
it fills.

**DPR is reproduced, not reinterpreted.** Its business definition has not been
confirmed, so it is carried across under its original name with an explicit
"Definition to be mapped from Snowman source system" note and no invented
formula, target or threshold.

**Form follows the question.** The analytical screen picks each chart from the
job the data has to do, and the colour decisions are computed rather than
eyeballed: one validated single-hue sequential ramp carries every magnitude
encoding (heatmap, treemap), status colour is reserved for status and never
appears as a series, no chart carries a second y-axis, and no hue is ever
generated to seat an extra series. The ramp was run through the dataviz
validator's ordinal checks in both modes and passes all four. Where a form
turned out not to fit the data it was replaced rather than forced: a Pareto of
occupancy came out as forty-six two-percent bars under a straight diagonal,
because this network has almost no concentration, so it became a concentration
curve against a perfectly-even reference — which says the same true thing and
says it legibly.

**The daily mail is reproduced as a report, not as a mail.** Each region and
location gets the same figures the automated mail publishes — the F/C and Dry
split, the own subtotal, Park & Pay and the combined total — but as one table
where the subtotals read as subtotals and the arithmetic is visible: F/C plus
Dry is the own total, own plus Park & Pay is the combined total. Both trends
the mail carries are kept, percentage and pallets, because they answer
different questions and can disagree when capacity moves. A region also gets
the location-wise sheet the mail cannot: every warehouse on the same bands,
side by side.

**The assistant is rules-based and says so.** No language model is connected,
so the Assistant screen does not present itself as one. It resolves a question
to a fixed set of intents over the published figures, reads the answer out of
the semantic layer, and shows the formula, the source system and the owner
beside it. When it cannot match a question it says so and lists what it can
answer — it never guesses a figure. The screen also carries the honest
position on connecting a model: the exact context payload that would be sent
(the aggregated semantic layer, never the underlying rows), which prerequisites
are already in place and which are not. A model belongs *in front* of that
engine, translating a question and narrating a computed result — not behind it
doing the arithmetic.

**Park & Pay is a separate book, not a footnote.** It is space rented from
third parties and sold on to customers — ordinary pallet positions, directly
comparable with own capacity, but with a different cost base and a contract
that can lapse. So every affected screen reports own, Park & Pay and combined
rather than one figure that quietly mixes them, and combined utilization is a
genuine re-aggregation (capacities and occupancies summed, divided once) rather
than an average of two percentages. Own stays the headline everywhere, so a
screenshot can never be read as the wrong basis.

**Contracted space and occupied space are different measurements.** Six of the
twelve rented locations return exactly 100.00% on every day of the window,
which is what a contracted figure looks like, not a measured count. That is
surfaced as a data-quality finding and the rented utilization is described as
an upper bound — it is not silently corrected. Contracted space standing empty
is put to the reader as a commercial question, never as waste.

---

## 4. Architecture

```
src/
├─ app/                      Next.js App Router — one directory per screen
│  ├─ page.tsx               Executive Control Tower (default route)
│  ├─ capacity/ utilization/ regions/ warehouses/ inventory/
│  ├─ cold-chain/ operations/ exceptions/ data-quality/ settings/
│  ├─ regions/[regionId]/    Region drilldown
│  ├─ warehouses/[facilityId]/ Facility drilldown
│  ├─ assistant/             Rules-based analyst over the semantic layer
│  └─ reports/               Report Centre and the Print/PDF pack
│
├─ components/
│  ├─ ui/                    Design system: card, badge, table, drawer, multi-select…
│  ├─ layout/                Sidebar, top bar, filter bar, page header
│  ├─ charts/                Recharts wrappers + the SVG India map
│  ├─ control-tower/         KPI strip, health score, rankings, exception board
│  ├─ panels/                Location utilization table
│  └─ drawers/               Exception and facility detail drawers
│
└─ lib/
   ├─ config/                KPI dictionary, thresholds, brand, roles, nav
   ├─ domain/                Types + all business logic (metrics, rollups,
   │                         exceptions, health score, insights)
   ├─ data/                  Deterministic mock dataset
   ├─ repository/            THE SEAM — DataSource interface + mock implementation
   ├─ export/                CSV, XLSX (zero-dependency writer), print/PDF
   └─ state/                 Filter context, session/role context, snapshot hook
```

### The seam

`src/lib/repository/types.ts` defines a `DataSource` interface. Screens depend
only on that interface, through one hook:

```ts
const snapshot = useSnapshot()   // everything one screen render needs
```

Today `dataSource` is the mock implementation reading `src/lib/data`. Swapping
it for an HTTP client against a real API is a change to
`src/lib/repository/index.ts` and nothing else. **No screen imports from
`src/lib/data` for its figures.**

### Where the business logic lives

Every formula is implemented once, in `src/lib/domain/metrics.ts`, and every
KPI is described once, in `src/lib/config/kpi-definitions.ts` — id, name,
description, unit, formula, target, warning and critical thresholds, source,
owner and refresh frequency. Components look a KPI up by id; **no component
contains a formula or a hard-coded target.** The Settings screen renders that
registry directly, so the semantic layer is reviewable by the business.

Guards that live in `metrics.ts` and nowhere else: division by zero, capacity
of zero, missing capacity, utilization above 100%, negative movement, missing
region, duplicate locations, stale data.

---

## 5. Target architecture

The prototype is deliberately shaped so this transition changes the backend
and not the frontend:

```
   ERP  ·  WMS  ·  TMS  ·  SOMS  ·  chamber telemetry  ·  billing
                              │
                              ▼
              Ingestion / ETL  (batch daily 05:45 IST + streaming for telemetry)
                              │
                              ▼
              Data warehouse / lakehouse   (raw → conformed → marts)
                              │
                              ▼
              Semantic KPI layer   ◄── generated from src/lib/config/kpi-definitions.ts
                              │           (one definition of utilization, network-wide)
                              ▼
              API   (REST or GraphQL, implementing the DataSource contract,
                     enforcing region/facility scope server-side)
                              │
                              ▼
              Next.js Control Tower  ──►  Web · Email · PDF · Mobile
```

**Migration path, in order:**

1. **Stand up the semantic layer first.** The KPI dictionary in this repo is
   the specification: publish those definitions as views or a metrics layer so
   every consumer computes utilization identically.
2. **Implement `DataSource` as an API client.** The interface is already the
   contract; `getSnapshot(filters)` maps to one endpoint, `queryLocations` to a
   paged one.
3. **Move access control server-side.** The role scoping demonstrated here is
   applied to the query, not to rendering — but it runs in the browser and is
   therefore a demonstration only. It must be enforced by the API.
4. **Replace the forecast.** `projectUtilization` is isolated behind one
   function; a trained model can replace it without touching a screen.
5. **Wire telemetry.** Cold-chain data is currently hand-authored fixtures with
   a visible demo-data marker; the shapes match what a sensor gateway emits.

---

## 6. Security — placeholders, not implementation

There is **no authentication, no session, no token and no server-side
enforcement** in this build. What exists is the *shape* of the access model, so
it can be reviewed before it is built (`src/lib/config/roles.ts`):

| Role | Scope | Can |
| --- | --- | --- |
| LT / Executive | Network | View incl. commercial figures, export |
| National Operations *(default)* | Network | View, acknowledge, assign, export |
| Regional Head | WEST-1, WEST-2 | View, acknowledge, assign, export |
| Warehouse Manager | Indore facilities | View, acknowledge, export |
| Analyst | Network | View incl. commercial figures, export |
| IT / Data Admin | Network | View, export, edit thresholds and data |

The role switcher in the sidebar drives real behaviour: regional roles receive
narrowed query results, read-only roles have Acknowledge and Assign disabled,
and roles without commercial access do not see revenue columns. Acknowledge,
assign and export write to an in-session audit list shown on the Exception
Centre — in production that becomes an append-only server-side table.

---

## 7. Demo data

Deterministic, seeded (`mulberry32`), generated at import. It never changes
between reloads, machines or days — a demo two months from now shows the same
numbers as today. Nothing calls `Math.random()` or reads the wall clock.

- 6 regions · 49 facilities (46 with a capacity master) · 43 cities
- 423 storage locations across 4 temperature zones
- 260 days of history + 30 days of projection, per facility
- 24 depositors, pallet flow, dock performance
- 12 Park & Pay locations · 11,663 rented pallet positions

**Snapshot (reproduces the legacy report):** 162,281 capacity · 135,104
occupied · 27,177 empty · **83.25%** network utilization. Regions: EAST 77.0,
WEST-1 88.0, **WEST-2 102.0**, NORTH 80.0, SOUTH-1 76.0, SOUTH-2 83.0.

**Park & Pay:** 11,663 contracted positions · 10,738 occupied · **92.07%**,
reproducing the legacy grid's daily totals (92.07% on the report date, 91.96%
the day before). Combined: 173,944 · 145,842 · **83.84%** — including the
rented book moves the network figure by +0.59 pp.

Everything reconciles bottom-up: `sum(location) = zone`, `sum(zone) = facility`,
`sum(facility) = region`, `sum(region) = network`, and closing pallets in the
flow report equal the occupancy snapshot.

**Planted exceptions** so the demo has something to find: a facility over
capacity (SNL-IDR-01, 108.4%), a rapid riser (SNL-PNQ-01, +9.1pp/7d), a
severely under-utilized site (SNL-KRP-01, 38.2%), facilities projected to
breach 90% within the forecast window, two open temperature excursions, three
FEFO breaches, and six data-quality defects including three facilities with no
capacity master row.

---

## 8. Three-minute demo

1. **Control Tower** — 83.25%, 3 facilities over capacity, health score, insights.
2. Click **WEST-2 (102.0%)** on the map → region detail opens with the
   over-capacity banner and 476 pallets above the master.
3. Click **SNL-IDR-01 (108.4%)** → facility detail: temperature zones, chambers,
   locations at 121.8%, and the open excursion in the frozen chamber.
4. Open the exception → **recommended action** and owner; Acknowledge it and it
   appears in the audit trail.
5. Back to **Control Tower** → capacity risk forecast: SNL-LKO-01 crossing 90%
   on 06 Sep.
6. **Cold Chain** → 99.56% compliance, 2 critical excursions, FEFO 97.8%,
   1,826 pallets near expiry.
7. **Report Centre → Print / PDF View** → the A4 landscape pack.

---

## 9. Quality

- **Performance** — pagination everywhere (only the visible page renders),
  memoised rollups, per-filter snapshot cache, inline SVG sparklines rather
  than a chart instance per row.
- **Accessibility** — skip link as the first tab stop, single `h1` per page,
  captioned tables with `scope` on headers, `aria-sort`, focus-trapped drawers
  that restore focus and close on Escape, keyboard-operable map regions,
  viewport-clamped tooltips on hover *and* focus, and status never carried by
  colour alone (every status pairs colour with an icon and a text label).
- **Responsive** — verified free of horizontal page overflow at 1440, 1280 and
  1024; desktop-first, as befits an operations application.
- **Print** — a purpose-built A4 landscape layout, not a print of the screen.

### Known limitations

- Zone-level history is derived by holding today's zone mix constant across the
  window; the source extract does not publish a daily zone split. Stated on the
  chart rather than hidden.
- Cold-chain telemetry, FEFO breaches and depositor names are fabricated
  demonstration records. Depositor names are deliberately invented rather than
  real Snowman customers.
- The date filter changes the reported date label; the underlying dataset is
  anchored to the fixed snapshot date, so historical dates do not re-generate a
  full historical snapshot.
- Exception workflow state (acknowledge/assign) lives in session memory and is
  lost on reload — by design, since there is no backend to persist it to.

---

*Design prototype for Snowman Logistics. Built on deterministic demonstration
data; not for operational use.*
