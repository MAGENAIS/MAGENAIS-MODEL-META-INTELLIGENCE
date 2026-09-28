# Release notes: Meta-Intelligence 2.0.0

**Standalone V2 release.** First version to identify as V2; earlier builds were internal `0.1.0` pre-releases covering V1 only.

## Highlights

- The full V2 cognitive layer is now in the standalone package: strategy generation and alternatives, DecisionScore-backed option
  evaluation (ranking, DSI, DFP, explicit abstention), composition boundary, execution plan, outcome verification, adaptation, problem
  representation and cognitive trace, all with provenance.
- Zero runtime dependencies and no MAGENAIS imports. The default scorer is the vendored DecisionScore algorithm, matching MAGENAIS behaviour.
- A deliberate public API, a `./benchmark` subpath, a schema-valid generated manifest, nine runnable examples, and rewritten documentation.

## What you can rely on

- Every method and error in `docs/api.md` exists and is covered by tests; the export list is snapshot-tested.
- `npm run check` (typecheck, tests, benchmark) passes on a clean clone after `npm install`.
- Benchmark outcomes (51/51 cases) are deterministic and pinned by a fingerprint.

## What not to claim

- Do not say it executes, composes, retries or acts. It records plans and decisions.
- Do not say a result is "verified" in the sense of independently true; it is checked against a recorded basis.
- Do not quote confidence percentages or probabilities; none are produced.
- Do not claim "outperforms" or any baseline result; no baseline pairing exists, and the evidence level is `benchmarked`.
- Do not describe it as a routed MAGENAIS model. It is listed in the public catalog and shown in the Models Hub as an information-only, in-process library (no Run panel).

## Upgrade notes

From `0.1.0`: the V1 API is unchanged. New methods are additive. `examples/basic-usage.mjs` was replaced by nine numbered examples.
The manifest's `runtimes` is now `['embedded-library']`.

## Known limitations

See the README's limitations section and `docs/roadmap.md`.
