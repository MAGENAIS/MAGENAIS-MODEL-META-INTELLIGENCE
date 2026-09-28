# Meta-Intelligence V2

[![version](https://img.shields.io/badge/version-2.0.0-blue)](CHANGELOG.md)
[![license](https://img.shields.io/badge/license-Apache--2.0-green)](LICENSE)
[![dependencies](https://img.shields.io/badge/runtime%20dependencies-0-brightgreen)](package.json)
[![status](https://img.shields.io/badge/trust-experimental-orange)](MODEL_SPECIFICATION.md)

**Meta-Intelligence** (`magenais.meta-intelligence`, version **2.0.0**) is a small, zero-dependency TypeScript
library that keeps a structured, auditable record of how a task goes from *problem* to *strategy* to
*outcome*. It is a **stateful orchestrator**: you call its methods in order, and it records each
decision, plan or claim together with where it came from (provenance). It is part of the
[MAGENAIS](https://github.com/MAGENAIS) model family, but it runs completely on its own.

> **It plans and records. It never executes.** No step of Meta-Intelligence runs an action, calls a model,
> retries, or composes anything. An `ACT` decision, an execution plan and a `retry` adaptation are all
> *representations*; a caller (or some future executor) does the real work and reports back.

## What V2 does

| Layer | Capability | Method(s) |
|---|---|---|
| Pipeline (V1) | Problem intake, normalized understanding, goals/constraints, knowns/unknowns/assumptions/evidence, capability decomposition, candidate strategies, evaluation, governance, result + verification, adaptation | `intake`, `understand`, `addGoalsConstraints`, `addEpistemicTracking`, `decomposeCapabilities`, `generateCandidateStrategies`, `evaluateStrategies`, `governAction`, `recordResult`, `recordAdaptation` |
| Strategies | Real strategies derived from the capability decomposition, and alternatives (one per extra provider, plus one composed strategy) | `generateStrategies`, `generateStrategyAlternatives` |
| Evaluation | Scores all strategy options with the bundled DecisionScore algorithm: ranking, stability index (DSI), flip points (DFP), explicit *none selected* outcomes | `evaluateStrategyOptions` |
| Composition boundary | Caller-supplied `ACT`/`WAIT`/`ASK`/`SIMULATE` decision, mechanically constrained (`ACT` needs a selected strategy) | `authorizeComposition` |
| Execution plan | Derived only when the boundary is `ACT` | `buildExecutionPlan` |
| Outcome + adaptation | Records the caller's claimed outcome, verifies it against the recorded basis, records a `retry`/`re-plan`/`escalate`/`accept` decision | `recordExecutionOutcome`, `recordExecutionAdaptation` |
| Derived views | Read-only problem representation and ordered cognitive trace | `getProblemRepresentation`, `getCognitiveTrace` |

Every item carries an `origin` (`caller` or `extracted`) and a timestamp. Failure is explicit: invalid or
out-of-order calls throw one of 43 typed errors and leave the task unchanged.

## Install and run

Requires **Node.js ≥ 22.6** (the source is TypeScript, run with Node's built-in type stripping; there is no
build step). Runtime dependencies: **none**.

```bash
git clone https://github.com/MAGENAIS/MAGENAIS-MODEL-META-INTELLIGENCE.git
cd MAGENAIS-MODEL-META-INTELLIGENCE
npm install          # dev tooling only (typescript, @types/node); needed for `npm run typecheck`
npm test             # runs without installing anything
npm run examples     # runs the nine examples
```

## Quick start

```ts
import { MetaIntelligenceOrchestrator } from '@magenais/meta-intelligence'; // or './src/index.ts' in a clone

const mi = new MetaIntelligenceOrchestrator();
mi.intake({ id: 't1', statement: 'Reduce checkout drop-off on mobile.' });
mi.understand('t1');
mi.addGoalsConstraints('t1', { goals: [{ text: 'Raise completion rate.', origin: 'caller' }], constraints: [] });
mi.addEpistemicTracking('t1', { knowns: [{ text: 'Checkout has 3 steps.', origin: 'caller' }], unknowns: [], assumptions: [], evidence: [] });

// Any object with providersOf(capability) is a capability graph:
const graph = { providersOf: (c: string) => ({ 'form-optimization': ['acme.a', 'acme.b'] } as Record<string, string[]>)[c] ?? [] };
mi.decomposeCapabilities('t1', graph, { requirements: [{ capability: 'form-optimization', origin: 'caller' }] });

mi.generateStrategies('t1');
mi.generateStrategyAlternatives('t1');
const task = mi.evaluateStrategyOptions('t1', {
  criteria: [{ id: 'evidence', weight: 0.4, direction: 'maximize' }, { id: 'risk', weight: 0.6, direction: 'minimize' }],
  scores: { 'strategy-1': { evidence: 8, risk: 2 }, 'strategy-2': { evidence: 5, risk: 1 } },
});
console.log(task.strategyOptionsEvaluation?.selection); // { status: 'selected', strategyId: ... } or { status: 'none', reason }
```

Criteria and scores are **yours**: Meta-Intelligence does not invent goals, evidence, capabilities, risk or
scores. Full walkthrough: [`docs/api.md`](docs/api.md).

## Examples

| # | File | Shows |
|---|---|---|
| 1 | [`01-basic-problem-to-strategy.mjs`](examples/01-basic-problem-to-strategy.mjs) | problem → decomposition → strategies (gaps yield none) |
| 2 | [`02-strategy-alternatives.mjs`](examples/02-strategy-alternatives.mjs) | per-provider and composed alternatives |
| 3 | [`03-strategy-evaluation.mjs`](examples/03-strategy-evaluation.mjs) | ranking, selection, DSI with a `minimize` risk criterion |
| 4 | [`04-uncertainty-and-confidence.mjs`](examples/04-uncertainty-and-confidence.mjs) | DSI/DFP, stability threshold, tie abstention (no probabilities) |
| 5 | [`05-provenance-and-evidence.mjs`](examples/05-provenance-and-evidence.mjs) | origins, evidence, the verification basis ids |
| 6 | [`06-execution-planning.mjs`](examples/06-execution-planning.mjs) | `ACT` boundary → plan; `WAIT` blocks planning |
| 7 | [`07-outcome-and-adaptation.mjs`](examples/07-outcome-and-adaptation.mjs) | claimed outcome, verification, adaptation decision |
| 8 | [`08-cognitive-trace.mjs`](examples/08-cognitive-trace.mjs) | trace and problem representation |
| 9 | [`09-failure-and-abstention.mjs`](examples/09-failure-and-abstention.mjs) | typed errors, "none selected", refused `ACT` |

Run one with `node --experimental-strip-types --no-warnings examples/03-strategy-evaluation.mjs`.

## Implementation status

| Status | Items |
|---|---|
| **Implemented and tested** | everything in the table above; 43 typed errors; default DecisionScore scorer and caller-supplied scorers; the manifest; the 51-case benchmark and 9 fail-open guard ablations |
| **Validated** | 213 automated tests pass, `tsc --strict` is clean, `model.json` validates against the vendored MAGENAIS manifest schema, all 9 examples run, the 51 benchmark case definitions are textually identical to the MAGENAIS-validated ones (source diff shows only fixture plumbing differs) and their outcomes are pinned by a SHA-256 fingerprint |
| **Optional** | integrating with MAGENAIS (see [`docs/integration.md`](docs/integration.md)); supplying your own scorer |
| **Planned / not started** | see [`docs/roadmap.md`](docs/roadmap.md) |
| **Not implemented (by design)** | executing, composing or retrying anything; inventing goals/evidence/strategies; calibrated probabilities; persistence (state is in memory); concurrency control |

## Limitations (read before relying on it)

- It records; it does not act. Nothing here proves an action happened.
- `verified-against-basis` means a recorded goals/constraints-and-knowns basis exists. It does **not** mean
  the claimed success was independently confirmed.
- Governance, composition and adaptation decisions are supplied by the caller. A caller that always says
  `ACT`/`accept` gets no independent check on that judgement.
- Strategy generation is deliberately minimal and limited to what your capability graph reports.
- There are no probabilities or confidence percentages. Uncertainty is structural (DSI, DFP, origins,
  explicit abstention).
- In-memory only; a process restart loses tasks.
- The benchmark uses synthetic fixtures and is a regression/mechanics check, not evidence of real-world
  performance. Its evidence level is `benchmarked`, never `baseline-compared`.

## Relationship to the Models Hub

Meta-Intelligence is listed in the [MAGENAIS Models catalog](https://github.com/MAGENAIS/MAGENAIS-MODELS) (`magenais.meta-intelligence`,
`runtimes: ["embedded-library"]`, trust `experimental`) and appears in the MAGENAIS **Models Hub** tab as an information-only entry.
It has no Run panel there because it is a stateful, multi-call library rather than a single-run model, so it is not registered in the
Hub's `ModelRegistry` or dispatched by the Model Router. Inside MAGENAIS its manifest is available as `hub.metaIntelligenceManifest`;
see [`docs/integration.md`](docs/integration.md).

## Documentation

[`docs/architecture.md`](docs/architecture.md) · [`docs/api.md`](docs/api.md) ·
[`docs/integration.md`](docs/integration.md) · [`docs/testing-and-benchmarks.md`](docs/testing-and-benchmarks.md) ·
[`docs/roadmap.md`](docs/roadmap.md) · [`MODEL_SPECIFICATION.md`](MODEL_SPECIFICATION.md) ·
[`CHANGELOG.md`](CHANGELOG.md) · [`RELEASE_NOTES.md`](RELEASE_NOTES.md) · [`CONTRIBUTING.md`](CONTRIBUTING.md) ·
[`SECURITY.md`](SECURITY.md) · [`HANDOFF.md`](HANDOFF.md)

## License

Apache-2.0, see [`LICENSE`](LICENSE). Independent of MAGENAIS Core, which is separate.
