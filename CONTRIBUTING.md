# Contributing to Meta-Intelligence

Thanks for your interest in contributing.

## Getting started

This package has **zero runtime dependencies** and needs no install step
to develop:

```bash
git clone https://github.com/MAGENAIS/MAGENAIS-MODEL-META-INTELLIGENCE.git
cd MAGENAIS-MODEL-META-INTELLIGENCE
npm test          # node --experimental-strip-types --test tests/*.test.ts
npm run example   # runs examples/basic-usage.mjs
```

Requires Node.js >= 22 (for `--experimental-strip-types`).

## Project layout

```
src/
  contract.ts                    Self-contained ModelManifest shape (see that file's own note on why it's partial)
  types.ts                       Meta-Intelligence contract: stages, task, problem, understanding
  MetaIntelligenceOrchestrator.ts Thin orchestrator: intake() + understand()
  index.ts                       Public exports
tests/                            node:test unit tests
examples/                         Runnable usage examples
docs/                             Pipeline/roadmap notes
```

## Relationship to the MAGENAIS monorepo

This repository is kept in sync **by hand** with
`MAGENAIS-main/src/ModelsHub/meta-intelligence/` and
`MAGENAIS-main/tests/unit/metaIntelligenceOrchestrator.test.ts` in the
MAGENAIS repository — the same relationship DecisionScore's, PatternSense's,
and AnomalyMind's own standalone repos have with their MAGENAIS-main
sources. If you change one copy, change the other in the same PR/commit;
each file that's a copy says so in its own header comment.

## Ground rules

- **No runtime dependencies.** This package intentionally stays
  dependency-free. If a contribution needs one, open an issue to discuss
  first.
- **Don't get ahead of the AWU queue.** This package is built one Atomic
  Work Unit (AWU) at a time (see the MAGENAIS repository's
  `META_INTELLIGENCE_BUILD_PROMPT_V4.md` and `.mi/CONTEXT_MAP.json`). A
  PR that implements a pipeline stage (goals/constraints, strategy
  generation, execution, ...) ahead of its AWU will be asked to split or
  wait, even if the code looks correct — see that build prompt's "no
  phase/round-explosion" and "hard guards" sections.
- **`understand()` stays mechanical.** Whitespace collapsing only. Any
  change that starts inferring meaning, goals, or constraints from the
  problem statement belongs in a later stage's own file (AWU-02+),
  not folded into `understand()`.
- **Never rewrite `problem.statement`.** Provenance — what the caller
  actually said — must remain readable and unmodified from every later
  stage. Add new fields alongside it; never replace it.
- **No TypeScript constructor parameter properties**
  (`constructor(private readonly x: T)`). The test runner uses Node's
  `--experimental-strip-types`, which does not support that syntax. Use a
  plain field declaration + assignment in the constructor body instead.
- **Every behavior change needs a test.** In particular, a new stage
  method should include tests for its happy path, its rejection of an
  out-of-order call, and (once relevant) a not-found case.
- **No novelty/capability overclaiming.** `model.json`'s `capabilities`
  and this README's Status table must reflect what's actually
  implemented, not what's planned — see the MAGENAIS build prompt's hard
  guard: "Do not invent facts, evidence, capabilities, ... or benchmark
  results."
- **Export each name from exactly one file in `index.ts`.** A name may
  only be exported once across the files `index.ts` re-exports via
  `export *`. Two files exporting the same name causes an ambiguous
  re-export (`tsc` error TS2308).

## Reporting bugs / requesting features

Open a GitHub issue with:

- the input that produced the unexpected result (or the feature request),
- what you expected vs. what happened,
- the package version.

## Pull requests

1. Fork and branch from `main`.
2. Add/update tests for your change.
3. Run `npm test` — it must pass with zero failures.
4. Update `CHANGELOG.md` under an "Unreleased" heading.
5. Open a PR describing the change and why it's needed.

## Code of Conduct

Be respectful and constructive. Disagreements about approach are fine and
expected in a research-oriented project; personal attacks are not.
