# Contributing to Meta-Intelligence

Thanks for your interest in contributing.

## Getting started

```bash
git clone https://github.com/MAGENAIS/MAGENAIS-MODEL-META-INTELLIGENCE.git
cd MAGENAIS-MODEL-META-INTELLIGENCE
npm install        # dev tooling only (typescript, @types/node)
npm run check      # typecheck + tests + benchmark
```

`npm test` and `npm run examples` need no install. Requires Node.js ≥ 22.6 (built-in type stripping; there is no build step).

## Layout

```
src/index.ts                         public API (explicit exports only)
src/MetaIntelligenceOrchestrator.ts  the orchestrator and all typed errors
src/types.ts  src/contract.ts        task/strategy/plan/trace types; shared shapes
src/manifest.ts  src/version.ts      manifest source of model.json; version constants
src/scoring/                         vendored DecisionScore algorithm + default scorer
src/benchmark/                       engine, 51-case pipeline benchmark, guard ablations
tests/  examples/  docs/  scripts/  schemas/
```

## Ground rules

- **No runtime dependencies.** `dependencies` must stay empty (a test enforces it).
- **Isolation.** No import may leave the package or reference MAGENAIS paths (a test enforces it).
- **Keep the public API intentional.** Adding or removing an export or orchestrator method fails `tests/api.test.ts`; update that snapshot and `docs/api.md` in the same change.
- **One version.** Bump `src/version.ts`, `package.json`, then run `npm run manifest:sync` and `npm run html:sync`; add a `CHANGELOG.md` entry. `tests/versioning.test.ts` catches drift.
- **`model.json` is generated.** Edit `src/manifest.ts`, never `model.json` by hand.
- **No overclaiming.** Docs, manifest and HTML must describe what exists and passes tests. Do not describe plans or decisions as execution. Do not add benchmark numbers that `npm run benchmark` cannot reproduce.
- **The component records; the caller decides.** Do not add logic that invents goals, evidence, strategies or governance decisions.
- **Never rewrite `problem.statement`.** Add fields beside it.
- **Benchmark cases are frozen.** Changing a case changes the fingerprint test on purpose; bump the benchmark version and update the fingerprint deliberately.
- **No TypeScript constructor parameter properties** (unsupported by Node's type stripping); use explicit fields.
- **Every behaviour change needs a test**: happy path, rejection path, and a not-found case where relevant.

## Relationship to the MAGENAIS monorepo

The orchestrator, types and benchmark originate in MAGENAIS (`src/ModelsHub/meta-intelligence/`). This repository is the
standalone release and is kept in sync deliberately, not automatically. A behaviour change in one copy must be made in the other,
or the difference must be documented in `docs/integration.md`. See that file for what is shared and what is not.

## Pull requests

1. Branch from `main`. 2. Add/update tests. 3. `npm run check` must pass with zero failures. 4. Update `CHANGELOG.md`. 5. Describe what and why.

Be respectful and constructive.
