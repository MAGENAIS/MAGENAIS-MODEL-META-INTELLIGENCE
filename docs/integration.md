# MAGENAIS integration contract

## What is standalone

The whole of this repository: orchestrator, types, default scorer (vendored DecisionScore algorithm), manifest,
benchmark and ablations. It imports nothing from MAGENAIS and needs no MAGENAIS package to run, test or benchmark.

## What is MAGENAIS-specific (and lives only in MAGENAIS)

- `ModelsHub/meta-intelligence/`: the same orchestrator, whose default scorer calls the Hub's own `decision-score` module.
- `ModelHub.metaIntelligenceManifest`: the manifest exposed directly on the hub object by `createModelHub()`.
- Registration of `magenais.meta-intelligence.pipeline-v1` in the hub's benchmark registry.
- The `Model` interface, `ModelRegistry`, `ModelRouter`, `CapabilityGraph` and `LocalRuntime`. None of these are needed here.

## Shared interfaces

| Interface | Standalone form | MAGENAIS form | Adapter needed? |
|---|---|---|---|
| capability graph | `CapabilityGraphLike { providersOf }` | `CapabilityGraph` | **No**; the real class satisfies it structurally |
| scorer | `MetaIntelligenceStrategyScorer` over `DecisionScore*` shapes | Hub `decision-score` module | **No**; shapes are structurally identical |
| manifest | `META_INTELLIGENCE_MANIFEST` / `model.json` | `MetaIntelligenceManifest.ts` | No; same schema (see below) |
| benchmark | `metaIntelligencePipelineBenchmark` | same definition, registered in hub | No; same 51 cases and version `1.2.0` |

## How the Models Hub discovers it

Meta-Intelligence is **not** in `ModelRegistry` or the router, because it is not `Model`-shaped:
it is stateful and multi-call, and forcing it through `execute()` would hide a pipeline behind an opaque call.
It **is** listed in the public catalog (`MAGENAIS-MODELS/catalog/models.json`, `runtimes: ["embedded-library"]`, trust `experimental`) and on the
MAGENAIS Models page, and the MAGENAIS Models Hub tab shows it as an information-only entry (icon, details, limitations, links) with no Run panel.
In code, discovery is by manifest (`hub.metaIntelligenceManifest`) and by benchmark id. To use the standalone build from MAGENAIS,
depend on this package, pass `hub`'s real `CapabilityGraph` to `decomposeCapabilities`, and optionally pass a Hub scorer.
Flipping `verificationStatus` from `not-ready` remains an owner decision that this repository does not make.

## What must not be coupled to MAGENAIS Core

Core must not import Meta-Intelligence internals, and Meta-Intelligence must not import Core. Model count, model identity and
provider lists reach it only through the caller-supplied `providersOf`, so adding, replacing or removing models needs no change
here and no Core redesign. `tests/api.test.ts` fails if any source file imports from a MAGENAIS path.

## Manifest differences

| Field | MAGENAIS-integrated | Standalone | Why |
|---|---|---|---|
| `runtimes` | `[]` | `['embedded-library']` | the published schema requires ≥1 runtime; `builtin-local` would falsely imply routability |

As of the Models Hub documentation sync, the MAGENAIS-integrated manifest carries the same V2 content as this one (version, uri,
description, outputs, limitations, provenance, full repository URL). The one deliberate difference left is `runtimes`; everything else
(id, capability, type, trust, failure modes, evidence level, verification status) is identical.

## Known divergence in the MAGENAIS repository

The integrated `meta-intelligence/index.ts` barrel does not export the V2 errors, and the integrated manifest keeps an empty `runtimes`
(an in-code type allows it; the published schema does not). The manifest prose itself was synced to V2 in the Models Hub documentation sync.
