# Standalone V2 Release Audit: Meta-Intelligence 2.0.0

**GITHUB_READY = YES** (with the non-blocking caveats in section "Known limitations").

Every result below was produced by running the commands shown, on Node 22.22.2 with TypeScript 6.0.3 and @types/node 25.6.0.

## Answers to the required questions

**Is standalone behaviour synchronized with validated MAGENAIS V2? Yes.** The orchestrator, types, default scorer, DecisionScore algorithm, benchmark engine,
benchmark suite and ablations were compared line by line against `MAGENAIS-main/src/ModelsHub`. The only differences are import paths, the `CapabilityGraph`→`CapabilityGraphLike`
type substitution (structural, so a real `CapabilityGraph` still works), the graph builder inside the benchmark fixtures, and removal of the MAGENAIS-only `subjectFromModel` adapter.
`types.ts` differs by one import line; the orchestrator only in import lines and two `graph:` type annotations. The 170 ported MAGENAIS unit tests pass against the standalone code; their only edits are import paths, fixture runtime names, and one Hub-registry test rewritten to check the benchmark id directly.

**What differences remain and why?** (1) Manifest: `runtimes: ['embedded-library']` (the integrated `[]` fails the published schema), version/uri/provenance 2.0.0, V2-accurate prose, full repository URL.
(2) Vendored DecisionScore algorithm in `src/scoring/` so the default scorer works without MAGENAIS. (3) No `Model` adapter. All documented in `docs/integration.md`.

**Is the public API stable?** Yes for 2.0.0. It is explicit (`src/index.ts`), and `tests/api.test.ts` snapshots the runtime exports (6 values + 43 errors), the 23 orchestrator members, the exports map, and forbids MAGENAIS imports.

**Are all V2 capabilities represented?** Yes: problem representation, strategy generation, alternatives, evaluation (DSI/DFP/abstention), governance, composition boundary, execution plan, execution outcome + verification, adaptation, uncertainty, provenance, cognitive trace, failure states, benchmark interfaces, manifest, version metadata. Each has tests and an example.

**Are tests passing?** 213/213 (`npm test`, also in a clean copy). `tsc --strict` over src, tests and scripts: 0 errors. Benchmark: 51/51 cases; 9/9 guard ablations detected (1-8 failing cases each, none undocumented). All 9 examples exit 0 with empty stderr.

**Is documentation complete?** Yes: README, MODEL_SPECIFICATION, docs/{architecture,api,integration,testing-and-benchmarks,roadmap}, CHANGELOG, RELEASE_NOTES, CONTRIBUTING, SECURITY, HANDOFF, this audit. `tests/versioning.test.ts` checks no pre-V2 claims remain. No separate "contracts" or "limitations" file was created (contracts live in `types.ts`/`contract.ts` and `docs/api.md`; limitations in README, manifest and roadmap) to avoid duplicate documentation.

**Is the manifest correct?** Yes. `model.json` is generated from `src/manifest.ts`, validates against the vendored MAGENAIS schema, and is tested for honesty (not a routed model, no autonomy claim, evidence `benchmarked`, verification `not-ready`).

**Is index.html correct?** Yes. It shows 2.0.0, describes only implemented behaviour, uses a real example output, has no broken links, embeds the current docs (regenerated from files, sync-tested; the test was shown to fail when an embedded doc is corrupted), has no external requests, and loads in headless Chromium with zero console or page errors.

**Is the repository portable?** Yes. A copy with no `node_modules` passes `npm test`, `npm run examples`, `npm run benchmark` and `tsc`; the generators reproduce the committed `model.json` and `index.html`. Scans found no absolute paths, credentials or temp artifacts.

**Is it GitHub-ready?** Yes.

## Known limitations

- **No lockfile and `npm install` unverified.** There is no network here. Dev dependencies are ranged to the verified versions (TypeScript ^6.0.3, @types/node ^25.6.0). Runtime dependencies: none. Tests/examples/benchmark need no install; only `npm run typecheck` does. Verified on Node 22.22.2 only.
- Not a routed MAGENAIS model; `verificationStatus` stays `not-ready` (owner's decision). *Update (Models Hub documentation sync): it is now listed in the public catalog and shown in the Models Hub as an information-only entry.*
- The benchmark is synthetic and has no baseline pairing; evidence level is `benchmarked`.
- The MAGENAIS repo's `meta-intelligence/index.ts` barrel and manifest prose were stale relative to V2 when this audit was written. *Update: the manifest prose was synced in the Models Hub documentation sync; the barrel was not changed.*
- Parity with MAGENAIS was established by source diff and ported tests; the integrated repo's own build was not executed here (its dependencies are not installed).

## Must NOT be claimed publicly

That it executes, composes, retries or acts autonomously; that a result is independently verified; any probability or confidence percentage; any "better than" baseline claim; that it is a routed Models Hub model (it is listed in the public catalog and shown in the Hub as an information-only entry); that `verificationStatus` is anything but `not-ready`.

## Reproduce this audit

`npm run check` (typecheck + tests + benchmark); `npm run examples`; `npm run manifest:sync && npm run html:sync` should leave `git status` clean.
