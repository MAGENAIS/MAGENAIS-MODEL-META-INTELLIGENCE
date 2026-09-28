# Model Specification: Meta-Intelligence 2.0.0

The authoritative machine-readable form is [`model.json`](model.json), generated from
[`src/manifest.ts`](src/manifest.ts) and validated against [`schemas/model-manifest.schema.json`](schemas/model-manifest.schema.json)
(a vendored copy of the MAGENAIS-MODELS manifest schema). This document explains it.

## Identity

| Field | Value |
|---|---|
| id | `magenais.meta-intelligence` |
| version | `2.0.0` (uri `magenais://meta-intelligence@2.0.0`) |
| layer / family | `composite-model` / `metacognition` |
| type | `algorithm` |
| capability | `meta-orchestration` |
| trust | `experimental` |
| licence | Apache-2.0 |
| pricing | free |
| implementationStatus | `implemented` |
| evidenceLevel | `benchmarked` |
| verificationStatus | `not-ready` (a registry decision for the owner; packaging does not change it) |

## What it is (and is not)

A **stateful, multi-call orchestrator** over a `MetaIntelligenceTask`. It is *not* a stateless
`execute(request) → response` model, which is why the manifest says `runtimes: ["embedded-library"]`
and declares `composability.independentlyExecutable: true`. Calling it means importing it in-process.

## Interfaces

**Inputs** (`meta-intelligence-request`, per call): a problem statement; caller-supplied goals/constraints,
epistemic items and capability requirements; a capability graph (`providersOf`); DecisionScore-shaped criteria and
scores (optionally a scorer); governance, composition, outcome and adaptation decisions.

**Outputs**: `meta-intelligence-task` (every stage and V2 field recorded so far, with origins and timestamps);
optional derived `meta-intelligence-problem-representation` and `meta-intelligence-cognitive-trace`.

**Public API**: [`docs/api.md`](docs/api.md). Entry points: `.` (library), `./benchmark` (tooling), `./model.json`.

## Runtime expectations

Synchronous, in-memory, no network, no file I/O, no external API. Cost is O(1) bookkeeping per call plus the
DecisionScore cost O(options × criteria × perturbations) inside evaluation. Node.js ≥ 22.6.

## Dependencies and compatibility

Runtime: none. Declared capability dependency `decision-ranking`, satisfied in-package by the vendored
DecisionScore algorithm (`src/scoring/`). Composes with `magenais.decision-score` (interchangeable scorer shapes)
and accepts a MAGENAIS `CapabilityGraph` as-is (structural `providersOf`).

## Failure modes (9 declared, each backed by a typed error and tests)

`act-without-selection`, `adaptation-not-representable`, `out-of-order-stage-call`, `empty-text-input`,
`result-not-representable`, `invalid-enum-value`, `duplicate-v2-stage-call`, `execution-plan-not-authorized`,
`execution-adaptation-not-representable`.

## Limitations and non-goals

Listed in full in `model.json` (`limitations`, `nonGoals`) and summarized in the [README](README.md#limitations-read-before-relying-on-it).
Key points: nothing is executed; decisions are the caller's; verification is against a recorded basis, not the
world; no calibrated probabilities; synthetic-fixture benchmark only.

## Provenance

Built inside MAGENAIS as V5-5 (V1, AWU-01..12) and V5-6 (V2, phases A–D), then extracted here as the
standalone V2 release. Benchmarked at code version 2.0.0.

## Differences from the MAGENAIS-integrated manifest

Deliberate, and explained in [`docs/integration.md`](docs/integration.md#manifest-differences): `runtimes`
(`embedded-library` instead of an empty list that fails the published schema). The version, uri, provenance, description,
outputs, limitations and repository URL now match the MAGENAIS-integrated manifest.
