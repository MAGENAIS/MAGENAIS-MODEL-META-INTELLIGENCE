# API reference (V2)

Everything below is exported from the package root (`src/index.ts`). Tooling is under `./benchmark`.
`tests/api.test.ts` snapshots the export list and the orchestrator's method list, so this page cannot silently drift.

## Construction and lookup

`new MetaIntelligenceOrchestrator()` (no arguments) · `getTask(id)` (throws `MetaIntelligenceTaskNotFoundError`) ·
`tryGetTask(id)` · `listTasks()` · `size`.

## V1 pipeline methods (stage-gated, forward only)

| Method | Requires | Records |
|---|---|---|
| `intake({ id?, statement })` | nothing | verbatim statement, timestamp → stage `received` |
| `understand(id)` | `received` | whitespace-normalized restatement |
| `addGoalsConstraints(id, { goals, constraints })` | `understood` | items with origin |
| `addEpistemicTracking(id, { knowns, unknowns, assumptions, evidence })` | `goals-constraints` | items with origin |
| `decomposeCapabilities(id, graph, { requirements })` | `epistemic-tracking` | per requirement: providers or gap |
| `generateCandidateStrategies(id)` | `capability-decomposition` | V1 candidate strategies |
| `evaluateStrategies(id, request, scorer?)` | `candidate-strategies` | ranking / selection over V1 candidates |
| `governAction(id, { decision })` | `strategy-evaluation` | `ACT`/`WAIT`/`ASK`/`SIMULATE` (`ACT` needs a selection) |
| `recordResult(id, { status })` | `action-governance` with `ACT`/`SIMULATE` | claimed result + mechanical verification |
| `recordAdaptation(id, { decision })` | `result-verification` with `goals-not-met`/`insufficient-basis` | `retry`/`re-plan`/`escalate`/`accept` |

## V2 methods (additive; do not advance `stage`)

| Method | Requires | Records / returns |
|---|---|---|
| `generateStrategies(id)` | capability decomposition | `strategies` (one per satisfied requirement) |
| `generateStrategyAlternatives(id)` | `strategies` | `strategyAlternatives` (per extra provider + one composed) |
| `evaluateStrategyOptions(id, request, scorer?)` | `strategies` | `strategyOptionsEvaluation`: `ranking`, `selection`, `dsi`, `dfp`, `minStability` |
| `authorizeComposition(id, { decision, reason? })` | options evaluation | `compositionBoundary` (`ACT` refused unless a strategy was selected) |
| `buildExecutionPlan(id)` | boundary decision `ACT` | `executionPlan` (data only) |
| `recordExecutionOutcome(id, { status, detail? })` | execution plan | `executionResult` + `executionVerification` |
| `recordExecutionAdaptation(id, { decision, reason? })` | verification `goals-not-met`/`insufficient-basis` | `executionAdaptation` |
| `getProblemRepresentation(id)` | any task | derived view with `present` flags |
| `getCognitiveTrace(id)` | any task | derived ordered entries: field, timestamp, ids named |

## Request shapes worth knowing

- **Evaluation request**: `{ criteria: [{ id, weight, direction: 'maximize'|'minimize' }], scores: { [strategyId]: { [criterionId]: number } }, minStability?, scorerOptions? }`.
- **Selection**: `{ status: 'selected', strategyId } | { status: 'none', reason: 'no-candidates' | 'tie-for-top' | 'below-stability-threshold' }`.
- **Scorer**: `(input: DecisionScoreInput, options?: DecisionScoreRunOptions) => DecisionScoreOutput`. The default is exported as `scoreWithDecisionScore`.
- **Capability graph**: `{ providersOf(capability: string): string[] }` (`CapabilityGraphLike`).

## Other exports

`META_INTELLIGENCE_VERSION`, `META_INTELLIGENCE_MODEL_ID`, `META_INTELLIGENCE_URI`, `META_INTELLIGENCE_MANIFEST`,
`DecisionScoreValidationError`, all task/result types, the contract types (`ModelManifest`, `CapabilityGraphLike`,
`DecisionScore*`), and **43 typed errors** (one per failure, each with a stable class name; see the export list in `src/index.ts`).

## Not public

Helper functions inside the orchestrator module, `scoring/` internals (`computeDSI`, `scoreAndRank`, ...), and test helpers.

## Benchmark subpath

`@magenais/meta-intelligence/benchmark`: `runBenchmark`, `runAblation`, `analyzeFailures`, `compareResults`, `summarize`,
`metaIntelligencePipelineBenchmark`, `runMetaIntelligencePipelineBenchmark`, `GUARD_ABLATIONS`, `runGuardAblations` and their types.
