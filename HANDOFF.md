# Handoff: state of the repository at 2.0.0

Read this first if you are continuing the work without the original conversation.

## State

Standalone Meta-Intelligence V2 release, version **2.0.0**. See `STANDALONE_V2_RELEASE_AUDIT.md` for the release decision and evidence.

## How it was produced

Source of truth: the validated MAGENAIS V2 implementation (`MAGENAIS-main/src/ModelsHub/meta-intelligence/`). The orchestrator and types were
copied, with three mechanical changes only: imports rewritten to package-local paths, `CapabilityGraph` replaced by the structural `CapabilityGraphLike`,
and the default scorer's DecisionScore algorithm vendored into `src/scoring/`. `types.ts` differs from MAGENAIS by one import line. The benchmark case
definitions differ only in fixture plumbing (graph builder, imports, descriptor version).

## Commands

`npm run check` (typecheck + tests + benchmark) · `npm test` · `npm run examples` · `npm run benchmark` · `npm run manifest:sync` (regenerate `model.json`) ·
`npm run html:sync` (regenerate embedded docs in `index.html`).

## Open decisions (owner's, not made here)

- `verificationStatus` stays `not-ready`. It is listed in the public MAGENAIS catalog (trust `experimental`) as of the Models Hub documentation sync.
- The MAGENAIS repo's manifest prose was synced to V2 in the Models Hub documentation sync; its `meta-intelligence/index.ts` barrel was left as is.
- No lockfile is committed (it could not be generated offline). There are no runtime dependencies. The two dev dependencies are ranged to the versions the release was verified with: TypeScript 6.0.3 and @types/node 25.6.0, on Node 22.22.2. `npm install` itself was not run offline; tests, examples and the benchmark need no install. Generate and commit a lockfile if you want pinned tooling.

## Not started

Model #02, an executor, persistence, a baseline methodology. See `docs/roadmap.md`.
