# Testing and benchmarks

```bash
npm test            # 213 tests, node:test, no install needed
npm run typecheck   # tsc --strict (needs `npm install` for typescript + @types/node)
npm run examples    # all 9 examples
npm run benchmark   # 51-case pipeline benchmark + 9 guard ablations, exit 1 on any failing case
```

## Test files

| File | Covers |
|---|---|
| `orchestrator.test.ts` | V1 pipeline, contracts, failure handling, regression cases |
| `strategy.test.ts` | strategies, alternatives, evaluation, composition, execution plan, outcome, adaptation, trace |
| `problemRepresentation.test.ts` | derived problem representation |
| `provenance.test.ts` | origins, timestamps, referenced ids, benchmark provenance |
| `benchmark.test.ts` | benchmark definition, frozen-case fingerprint, reproducibility |
| `ablation.test.ts` | fail-open guard ablations |
| `endToEnd.test.ts` | full V2 path through the public entry point only |
| `api.test.ts` | public export and method snapshot; no MAGENAIS imports |
| `manifest.test.ts` | `model.json` vs schema and vs `src/manifest.ts`; honesty checks |
| `versioning.test.ts` | one version across code, package, manifest, docs, HTML |
| `examples.test.ts` | every example runs cleanly |
| `html.test.ts` | `index.html` version, links, embedded docs, API example |

## What the benchmark measures

51 deterministic cases in two categories, **scenario** (25) and **adversarial** (26). Together they check
pipeline correctness, V2 mechanics (alternatives, evaluation, composition, plan, outcome, adaptation, trace) and
strategy generation/selection quality (including abstention). The frozen case set is pinned by a SHA-256 fingerprint, so
changing a case fails a test and requires a deliberate version bump.

Distinctions kept on purpose:

- **Routing** (choosing among models) is *not* measured here; this component does not route.
- **Strategy quality** and **cognitive behaviour** are checked on synthetic fixtures with known-correct answers.
- **Regression**: the fingerprint and case ids guard against silent change.
- **Sensitivity/mutation**: `GUARD_ABLATIONS` disables one guard at a time (fail-open fault injection) and confirms the
  benchmark notices (1 to 8 failing cases each, none undetected). This tests the benchmark's sensitivity; it is not a
  component-removal ablation and says nothing about real-world value.

## Reporting results

`npm run benchmark` is the only source for numbers you may quote. Pass rate depends on the code and the fixtures, and is
reproducible; latency is wall-clock and machine-dependent. No external baseline exists, so no "better than X" claim is supportable.
