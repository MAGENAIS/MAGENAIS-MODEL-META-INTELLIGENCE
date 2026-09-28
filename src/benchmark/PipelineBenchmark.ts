/**
 * MetaIntelligencePipelineBenchmark.ts
 *
 * AWU-11. Exercises the now-complete AWU-01..10 Meta-Intelligence DoD
 * pipeline (`MetaIntelligenceOrchestrator`) through the existing
 * Benchmark & Baseline Engine (`BenchmarkDefinition` / `runBenchmark`),
 * rather than adding yet another ad-hoc test harness. Lives under
 * `benchmark/suites/`, not inside `meta-intelligence/`, for the same
 * reason `DecisionScoreCalibrationBenchmark.ts` lives here and not inside
 * `decision-score/` (see that file's own header): a benchmark suite is
 * Hub-side evaluation tooling that depends on the orchestrator, and
 * `meta-intelligence/`'s own header states it is written to be lifted
 * into its standalone published repo, which has no `benchmark/` sibling.
 *
 * WHY THIS SUITE LOOKS DIFFERENT FROM THE OTHER THREE: every existing
 * suite (DecisionScore/PatternSense/AnomalyMind) scores a NUMERIC
 * prediction (a confidence, a stability index) against a naive baseline
 * that produces the same kind of number without the model's real
 * analysis — that is what makes a §11 "WITHOUT MODEL vs WITH MODEL"
 * BaselineComparison meaningful for them. `MetaIntelligenceOrchestrator`
 * is not a predictor: it is stateful bookkeeping over a ten-stage
 * pipeline, and its correctness is entirely mechanical (does `'ACT'`
 * really get rejected without a selection? does a `'goals-not-met'`
 * outcome really reach `recordAdaptation()`? does a double call on the
 * same stage really get rejected?). There is no naive alternative
 * implementation of "an orchestrator with no stage-ordering rules" that
 * would be a meaningful baseline to score against — inventing one here
 * would be exactly the kind of universal-score-shaped busywork §11 warns
 * against, not a real comparison.
 *
 * So this suite has exactly ONE subject (`metaIntelligencePipelineSubject`,
 * the real orchestrator), and its `BenchmarkRunResult` — not a
 * `BaselineComparison` — IS this AWU's recorded baseline: the first
 * reference run future changes to the orchestrator get compared against.
 * `BenchmarkRegistry`'s own shape (register/get/list over a
 * `BenchmarkDefinition`) has no requirement that a definition be run
 * baseline-vs-treatment; that pairing is a convention the three numeric
 * suites chose, not something the engine or registry enforces. Per
 * `.mi/NEXT.json`'s own note for this AWU: no prior Meta-Intelligence
 * baseline exists anywhere in `BenchmarkRegistry`, so establishing this
 * run's `BenchmarkRunResult` as that reference point is exactly what
 * "baseline comparison" can mean here, and future AWUs should diff their
 * own run's `CaseResult`s against a saved copy of this one rather than
 * inventing a synthetic non-orchestrator baseline to run alongside it.
 *
 * WHAT EACH CASE'S `input` IS: a plain scenario function
 * `(mi: MetaIntelligenceOrchestrator) => MetaIntelligenceScenarioOutcome`
 * that drives a *fresh* orchestrator instance through some prefix of the
 * DoD pipeline (using the same helper-building style as
 * `metaIntelligenceOrchestrator.test.ts`'s own `taskAtXxx()` fixtures,
 * redefined here rather than imported since those are private to that
 * test file) and reports the observable outcome — final stage, any
 * thrown error's `name`, and whichever of selection/governance/
 * verification/adaptation the scenario reached. This keeps every case
 * self-contained plain data from the runner's point of view (`subject`
 * just calls the function it's given), while staying entirely within
 * `BenchmarkCase`'s documented `TInput` genericity — nothing here departs
 * from `BenchmarkSubject`'s own type, which was never restricted to
 * JSON-serializable input.
 *
 * WHAT THIS COVERS (`.mi/NEXT.json`'s objective, restated as cases below):
 * empty/whitespace problem statements; the full received->...->adaptation
 * path via both the `'ACT'` and `'SIMULATE'` governance branches; every
 * terminal "none"/"not-representable" branch (no-candidates, tie-for-top,
 * below-stability-threshold selection; WAIT/ASK result-refusal;
 * verified-against-basis/not-verifiable adaptation-refusal); all four
 * `MetaIntelligenceVerificationOutcome`s; all four
 * `MetaIntelligenceAdaptationDecision`s; invalid enum values for
 * governance/result/adaptation requests; and double-call/out-of-order
 * rejections at several stages. It deliberately does NOT change, retry,
 * or work around any AWU-01..10 orchestrator behavior — every case
 * either confirms today's documented behavior or documents today's
 * documented rejection.
 *
 * V2-D1 ADDITIVELY EXTENDS THIS: the AWU-11 cases above only ever reach
 * the frozen V1 fields (`candidateStrategies`/`strategyEvaluation`/
 * `governance`/`result`/`verification`/`adaptation`) -- the real V2-B/C
 * surface (`strategies`/`strategyOptionsEvaluation`/`compositionBoundary`/
 * `executionPlan`/`executionResult`/`executionVerification`/
 * `executionAdaptation`, V2-B2..C5) was entirely unexercised here before
 * this AWU. The V2-D1 cases (below the original 33, own fixture section)
 * close that gap: they never modify or replace an AWU-11 case.
 *
 * V2-D5 ADDITIVELY EXTENDS THIS AGAIN (closing the V2-D4 readiness gate's
 * G10 PARTIAL): the V2-D1 cases prove V2 MECHANICS (reachability, double
 * calls, one end-to-end run) on a single-requirement/single-provider
 * fixture, so nothing here yet tested strategy GENERATION or SELECTION
 * QUALITY. The `v2q-*` cases (below the V2-D1 section, own fixture builder)
 * do, on a multi-requirement/multi-provider fixture: per-provider and
 * composed alternatives; a minimize-direction risk criterion flipping the
 * selected strategy; the tie-for-top and below-stability-threshold `none`
 * outcomes over V2 strategy options; and ACT-authorized composition/plan
 * carrying an alternative-derived and a composed strategy's components.
 * Every expected value was read off a real run of the orchestrator, never
 * derived from what the code "should" do. The pre-existing 42 cases and
 * their expected values are untouched.
 */

import { MetaIntelligenceOrchestrator } from '../MetaIntelligenceOrchestrator.ts';
import type {
  MetaIntelligenceAdaptationDecision,
  MetaIntelligenceGovernanceDecision,
  MetaIntelligenceNoSelectionReason,
  MetaIntelligenceResultStatus,
  MetaIntelligenceStage,
  MetaIntelligenceStrategy,
  MetaIntelligenceStrategyComponent,
  MetaIntelligenceStrategySelection,
  MetaIntelligenceVerificationOutcome,
} from '../types.ts';
import type { CapabilityGraphLike } from '../contract.ts';
import { META_INTELLIGENCE_MODEL_ID, META_INTELLIGENCE_VERSION } from '../version.ts';
import type { BenchmarkDefinition, BenchmarkRunResult, BenchmarkSubject, SubjectDescriptor } from './types.ts';
import { runBenchmark, type RunOptions } from './BenchmarkRunner.ts';

export const META_INTELLIGENCE_PIPELINE_BENCHMARK_ID = 'magenais.meta-intelligence.pipeline-v1';

/**
 * V2-D3: bumped 1.0.0 -> 1.1.0. The case set grew 33 -> 42 (V2-D1), score()
 * became a structural comparison (V2-D1) and cases gained probesFailureModes
 * metadata (V2-D2), yet the version stayed 1.0.0, so two runs with different
 * case sets shared a benchmarkVersion (only `inputSetId`'s case count told
 * them apart). Any future change to the case set, expected values or scoring
 * must bump this; tests/unit/metaIntelligenceProvenance.test.ts pins a
 * fingerprint of the case set to this version to enforce that.
 *
 * V2-D5: bumped 1.1.0 -> 1.2.0 (case set 42 -> 51: nine additive `v2q-*`
 * strategy-quality cases; ten existing failure-mode tags added in
 * PROBES_FAILURE_MODES, which the fingerprint covers).
 */
export const META_INTELLIGENCE_PIPELINE_BENCHMARK_VERSION = '1.2.0';

// ---------------------------------------------------------------------------
// Scenario plumbing: a case's `input` is a function; its observable result
// is this outcome shape. Only the fields an individual case's `expected`
// actually sets are checked (see `score` below) — a case that only cares
// about `stage` and `thrownErrorName` need not populate the rest.
// ---------------------------------------------------------------------------

export interface MetaIntelligenceScenarioOutcome {
  readonly stage: MetaIntelligenceStage | 'no-task';
  readonly thrownErrorName: string | null;
  readonly selectionStatus?: MetaIntelligenceStrategySelection['status'];
  readonly noSelectionReason?: MetaIntelligenceNoSelectionReason;
  readonly governanceDecision?: MetaIntelligenceGovernanceDecision;
  readonly resultStatus?: MetaIntelligenceResultStatus;
  readonly simulated?: boolean;
  readonly verificationOutcome?: MetaIntelligenceVerificationOutcome;
  readonly adaptationDecision?: MetaIntelligenceAdaptationDecision;
  /**
   * V2-D1: the V2-C5 `executionAdaptation` field's own decision, distinct
   * from the frozen V1 `adaptationDecision` above (which reads
   * `task.adaptation`, never `task.executionAdaptation`).
   */
  readonly executionAdaptationDecision?: MetaIntelligenceAdaptationDecision;
  /**
   * V2-D1: the ordered list of `getCognitiveTrace()` entry field names for
   * this task, read verbatim off the real accessor (Law E -- never
   * invented). `undefined` only when no task exists at all (`'no-task'`).
   */
  readonly cognitiveTraceFields?: readonly string[];
  /**
   * V2-D5 strategy-quality observations, each read verbatim off the real
   * task (Law E -- never invented). `undefined` whenever the task has not
   * reached the field that carries them.
   *
   * `strategyIds`: `task.strategies` (V2-B2) ids, in order.
   * `alternativeStrategies`: `task.strategyAlternatives` (V2-B3), each
   * encoded `id|derivation|capability[provider,...]+capability[...]`.
   * `options*`: `task.strategyOptionsEvaluation` (V2-B4) -- selection
   * status/id/none-reason, ranked strategy ids (best first) and DSI.
   * `compositionDecision`/`compositionComponents`: `task.compositionBoundary`
   * (V2-C1); components encoded `capability[provider,...]`, `null` when the
   * boundary carries none. `executionPlanSteps`: `task.executionPlan`
   * (V2-C2), same encoding.
   */
  readonly strategyIds?: readonly string[];
  readonly alternativeStrategies?: readonly string[];
  readonly optionsSelectionStatus?: 'selected' | 'none';
  readonly optionsSelectedStrategyId?: string;
  readonly optionsNoSelectionReason?: MetaIntelligenceNoSelectionReason;
  readonly optionsRankingIds?: readonly string[];
  readonly optionsDsi?: number | null;
  readonly compositionDecision?: MetaIntelligenceGovernanceDecision;
  readonly compositionComponents?: readonly string[] | null;
  readonly executionPlanSteps?: readonly string[];
}

export type MetaIntelligenceScenario = (mi: MetaIntelligenceOrchestrator) => MetaIntelligenceScenarioOutcome;

/** Runs `fn`; returns the thrown error's `name`, or `null` if it didn't throw. Every orchestrator error sets `this.name` explicitly (see MetaIntelligenceOrchestrator.ts), so this is exactly the caller-visible error identity. */
function attempt(fn: () => void): string | null {
  try {
    fn();
    return null;
  } catch (err) {
    return err instanceof Error ? err.name : String(err);
  }
}

/** Reads back whatever the task reached so far, for the outcome fields a case's `expected` cares about. */
function outcomeFromTask(
  mi: MetaIntelligenceOrchestrator,
  id: string,
  thrownErrorName: string | null
): MetaIntelligenceScenarioOutcome {
  const task = mi.tryGetTask(id);
  if (!task) return { stage: 'no-task', thrownErrorName };
  const selection = task.strategyEvaluation?.selection;
  const optionsEvaluation = task.strategyOptionsEvaluation;
  const optionsSelection = optionsEvaluation?.selection;
  const boundary = task.compositionBoundary;
  return {
    stage: task.stage,
    thrownErrorName,
    selectionStatus: selection?.status,
    noSelectionReason: selection?.status === 'none' ? selection.reason : undefined,
    governanceDecision: task.governance?.decision,
    resultStatus: task.result?.status,
    simulated: task.result?.simulated,
    verificationOutcome: task.verification?.outcome,
    adaptationDecision: task.adaptation?.decision,
    executionAdaptationDecision: task.executionAdaptation?.decision,
    cognitiveTraceFields: mi.getCognitiveTrace(id).entries.map((e) => e.field),
    strategyIds: task.strategies?.strategies.map((st) => st.id),
    alternativeStrategies: task.strategyAlternatives?.strategies.map(encodeStrategy),
    optionsSelectionStatus: optionsSelection?.status,
    optionsSelectedStrategyId: optionsSelection?.status === 'selected' ? optionsSelection.strategyId : undefined,
    optionsNoSelectionReason: optionsSelection?.status === 'none' ? optionsSelection.reason : undefined,
    optionsRankingIds: optionsEvaluation?.ranking.map((r) => r.strategyId),
    optionsDsi: optionsEvaluation?.dsi,
    compositionDecision: boundary?.decision,
    compositionComponents: boundary ? (boundary.components ? boundary.components.map(encodeComponent) : null) : undefined,
    executionPlanSteps: task.executionPlan?.steps.map(encodeComponent),
  };
}

/** `capability[provider,provider]` -- V2-D5's compact, order-preserving component encoding. */
function encodeComponent(c: MetaIntelligenceStrategyComponent): string {
  return `${c.capability}[${c.providers.join(',')}]`;
}

/** `id|derivation|component+component` -- V2-D5's compact strategy encoding. */
function encodeStrategy(st: MetaIntelligenceStrategy): string {
  return `${st.id}|${st.derivation}|${st.components.map(encodeComponent).join('+')}`;
}

// ---------------------------------------------------------------------------
// Fixture builders. Mirror metaIntelligenceOrchestrator.test.ts's own
// taskAtXxx() helpers (same fixture shapes, e.g. CLEAR_SCORES/NARROW_SCORES),
// redefined here since those are private to that test file rather than
// exported for reuse.
// ---------------------------------------------------------------------------

const TASK_ID = 'task-1';
const AD = 'anomaly-detection';
const PD = 'pattern-detection';

/** A synthetic provider record: just the two fields a capability graph is built from. */
interface FixtureManifest {
  id?: string;
  capabilities: string[];
}

/**
 * Standalone stand-in for MAGENAIS's `CapabilityGraph.fromManifests()`,
 * reproducing exactly the one behavior the orchestrator relies on:
 * `providersOf(capability)` returns the provider ids (deduplicated,
 * insertion order) of every manifest listing that capability. It keeps the
 * original quirk that a manifest without an `id` contributes `undefined` as
 * its provider id, because the frozen V1/V2-D1 cases were recorded against
 * exactly that behavior (see the V2-D5 note on `graphForProviders` below).
 */
function graphFromManifests(manifests: readonly FixtureManifest[]): CapabilityGraphLike {
  const providers = new Map<string, Array<string | undefined>>();
  for (const m of manifests) {
    for (const capability of m.capabilities ?? []) {
      const list = providers.get(capability) ?? [];
      if (!list.includes(m.id)) list.push(m.id);
      providers.set(capability, list);
    }
  }
  return { providersOf: (capability) => [...(providers.get(capability) ?? [])] as string[] };
}

function manifest(_id: string, capabilities: string[]): FixtureManifest {
  return { capabilities };
}

function graphFor(providersByCapability: Record<string, string[]>): CapabilityGraphLike {
  const providers = new Set(Object.values(providersByCapability).flat());
  return graphFromManifests(
    [...providers].map((id) =>
      manifest(
        id,
        Object.keys(providersByCapability).filter((cap) => providersByCapability[cap].includes(id))
      )
    )
  );
}

/** Advances to 'epistemic-tracking' with one goal + one known recorded — a basis `recordResult()` can verify a success against. */
function withBasis(mi: MetaIntelligenceOrchestrator, id = TASK_ID): void {
  mi.intake({ statement: 'Reduce checkout drop-off.', id });
  mi.understand(id);
  mi.addGoalsConstraints(id, { goals: [{ text: 'Increase completion rate.', origin: 'caller' }], constraints: [] });
  mi.addEpistemicTracking(id, {
    knowns: [{ text: 'Checkout has 3 steps.', origin: 'caller' }],
    unknowns: [],
    assumptions: [],
    evidence: [],
  });
}

/** Advances to 'epistemic-tracking' with no goals/constraints/knowns — no basis for `'verified-against-basis'`. */
function withoutBasis(mi: MetaIntelligenceOrchestrator, id = TASK_ID): void {
  mi.intake({ statement: 'Reduce checkout drop-off.', id });
  mi.understand(id);
  mi.addGoalsConstraints(id, { goals: [], constraints: [] });
  mi.addEpistemicTracking(id, { knowns: [], unknowns: [], assumptions: [], evidence: [] });
}

/** Advances to 'candidate-strategies' with two candidates (strategy-1: AD, strategy-2: PD) plus one gap. */
function toCandidateStrategies(mi: MetaIntelligenceOrchestrator, basis: 'with' | 'without', id = TASK_ID): void {
  basis === 'with' ? withBasis(mi, id) : withoutBasis(mi, id);
  const graph = graphFor({ [AD]: ['magenais.a', 'magenais.b'], [PD]: ['magenais.b'] });
  mi.decomposeCapabilities(id, graph, {
    requirements: [
      { capability: AD, origin: 'caller' },
      { capability: PD, origin: 'caller' },
      { capability: 'strategy-planning', origin: 'caller' },
    ],
  });
  mi.generateCandidateStrategies(id);
}

const CRITERIA = [
  { id: 'impact', weight: 0.6, direction: 'maximize' as const },
  { id: 'cost', weight: 0.4, direction: 'minimize' as const },
];
/** strategy-1 dominates strategy-2 on both criteria — a clear, non-tied winner. */
const CLEAR_SCORES = { 'strategy-1': { impact: 9, cost: 2 }, 'strategy-2': { impact: 4, cost: 7 } };
/** Identical scores on both criteria — an exact tie for top. */
const TIE_SCORES = { 'strategy-1': { impact: 5, cost: 5 }, 'strategy-2': { impact: 5, cost: 5 } };
/** Narrow 0.51/0.49 weighting: strategy-1 wins, but the ranking is not perfectly stable (DSI < 1). */
const NARROW_CRITERIA = [
  { id: 'impact', weight: 0.51, direction: 'maximize' as const },
  { id: 'cost', weight: 0.49, direction: 'maximize' as const },
];
const NARROW_SCORES = { 'strategy-1': { impact: 10, cost: 0 }, 'strategy-2': { impact: 0, cost: 10 } };

/** Advances to 'strategy-evaluation' with strategy-1 selected (a clear winner, no tie/threshold complications). */
function toStrategyEvaluationSelected(mi: MetaIntelligenceOrchestrator, basis: 'with' | 'without', id = TASK_ID): void {
  toCandidateStrategies(mi, basis, id);
  mi.evaluateStrategies(id, { criteria: CRITERIA, scores: CLEAR_SCORES });
}

/** Advances to 'strategy-evaluation' with {status:'none', reason:'no-candidates'} — every requirement is an unmet gap. */
function toStrategyEvaluationNoCandidates(mi: MetaIntelligenceOrchestrator, id = TASK_ID): void {
  withoutBasis(mi, id);
  mi.decomposeCapabilities(id, graphFor({}), { requirements: [{ capability: 'strategy-planning', origin: 'caller' }] });
  mi.generateCandidateStrategies(id);
  mi.evaluateStrategies(id, { criteria: [], scores: {} });
}

/** Advances to 'strategy-evaluation' with {status:'none', reason:'tie-for-top'}. */
function toStrategyEvaluationTie(mi: MetaIntelligenceOrchestrator, id = TASK_ID): void {
  toCandidateStrategies(mi, 'with', id);
  mi.evaluateStrategies(id, { criteria: CRITERIA, scores: TIE_SCORES });
}

/** Advances to 'strategy-evaluation' with {status:'none', reason:'below-stability-threshold'} (minStability: 1, a not-perfectly-stable ranking). */
function toStrategyEvaluationBelowStability(mi: MetaIntelligenceOrchestrator, id = TASK_ID): void {
  toCandidateStrategies(mi, 'with', id);
  mi.evaluateStrategies(id, { criteria: NARROW_CRITERIA, scores: NARROW_SCORES, minStability: 1 });
}

/** Advances a selected task to 'action-governance' under `decision`. */
function toActionGovernance(
  mi: MetaIntelligenceOrchestrator,
  decision: MetaIntelligenceGovernanceDecision,
  basis: 'with' | 'without',
  id = TASK_ID
): void {
  toStrategyEvaluationSelected(mi, basis, id);
  mi.governAction(id, { decision });
}

/** Advances an 'ACT'/'SIMULATE'-governed task to 'result-verification' with the given claimed `status`. */
function toResultVerification(
  mi: MetaIntelligenceOrchestrator,
  governanceDecision: 'ACT' | 'SIMULATE',
  status: MetaIntelligenceResultStatus,
  basis: 'with' | 'without',
  id = TASK_ID
): void {
  toActionGovernance(mi, governanceDecision, basis, id);
  mi.recordResult(id, { status });
}

// ---------------------------------------------------------------------------
// V2-D1: V2-B/C fixture builders. Deliberately independent of the V1
// toCandidateStrategies()/toStrategyEvaluationSelected()/etc. fixtures
// above: the real `strategies`/`strategyOptionsEvaluation`/
// `compositionBoundary`/`executionPlan`/`executionResult`/
// `executionVerification`/`executionAdaptation` surface (V2-B2..C5) is
// orthogonal to the frozen V1 `candidateStrategies`/`strategyEvaluation`/
// `governance`/`result`/`verification`/`adaptation` one those fixtures
// build, so reusing a two-requirement V1 fixture here would tie an
// unrelated V2-B/C case to V1 fixture internals for no reason. Single
// capability, single provider -- these cases test reachability/
// double-call/not-representable mechanics, not strategy diversity (that
// is V2-B3's own job, already covered by metaIntelligenceStrategy.test.ts).
// ---------------------------------------------------------------------------

/** Advances to a `strategies`-only task (V2-B2): `generateStrategies()` has run; no V1-only field or stage change. */
function toStrategies(mi: MetaIntelligenceOrchestrator, basis: 'with' | 'without', id = TASK_ID): void {
  basis === 'with' ? withBasis(mi, id) : withoutBasis(mi, id);
  const graph = graphFor({ [AD]: ['magenais.a'] });
  mi.decomposeCapabilities(id, graph, { requirements: [{ capability: AD, origin: 'caller' }] });
  mi.generateStrategies(id);
}

const V2_CRITERIA = [{ id: 'evidence', weight: 1, direction: 'maximize' as const }];
const V2_SCORES = { 'strategy-1': { evidence: 5 } };

/** Advances to a `strategyOptionsEvaluation`-selected task (V2-B4), strategy-1 selected. */
function toStrategyOptionsSelected(mi: MetaIntelligenceOrchestrator, basis: 'with' | 'without', id = TASK_ID): void {
  toStrategies(mi, basis, id);
  mi.evaluateStrategyOptions(id, { criteria: V2_CRITERIA, scores: V2_SCORES });
}

/** Advances to a `compositionBoundary`-bound task (V2-C1) under the given decision. */
function toCompositionBoundary(
  mi: MetaIntelligenceOrchestrator,
  decision: MetaIntelligenceGovernanceDecision,
  basis: 'with' | 'without',
  id = TASK_ID
): void {
  toStrategyOptionsSelected(mi, basis, id);
  mi.authorizeComposition(id, { decision });
}

/** Advances an `'ACT'`-composed task to `executionPlan` (V2-C2). */
function toV2ExecutionPlan(mi: MetaIntelligenceOrchestrator, basis: 'with' | 'without', id = TASK_ID): void {
  toCompositionBoundary(mi, 'ACT', basis, id);
  mi.buildExecutionPlan(id);
}

/** Advances a V2-B/C task through `recordExecutionOutcome()` (V2-C4) with the given claimed status. */
function toV2ExecutionVerification(
  mi: MetaIntelligenceOrchestrator,
  status: MetaIntelligenceResultStatus,
  basis: 'with' | 'without',
  id = TASK_ID
): void {
  toV2ExecutionPlan(mi, basis, id);
  mi.recordExecutionOutcome(id, { status });
}

// ---------------------------------------------------------------------------
// V2-D5: strategy-quality fixtures. The V1/V2-D1 `manifest()` helper above
// sets `name` but not `id`, and `CapabilityGraph.fromManifests()` keys
// providers on `manifest.id`, so every provider in those fixtures is
// `undefined`: providers collapse to one entry and no multi-provider
// diversity can exist. That is harmless to the frozen cases (they assert
// stages and error names, never providers) so it is left untouched, but it
// is exactly why no earlier case could exercise per-provider alternatives.
// The `v2q-*` cases use this correctly-identified builder instead.
// ---------------------------------------------------------------------------

function graphForProviders(providersByCapability: Record<string, string[]>): CapabilityGraphLike {
  const providers = new Set(Object.values(providersByCapability).flat());
  return graphFromManifests(
    [...providers].map((id) => ({
      ...manifest(
        id,
        Object.keys(providersByCapability).filter((cap) => providersByCapability[cap].includes(id))
      ),
      id,
    }))
  );
}

/**
 * Advances to a task with real strategy diversity: AD has two providers
 * (a, b), PD has one (b). Observed: strategy-1 (AD[a,b]) and strategy-2
 * (PD[b]) from generateStrategies(); strategy-3 (AD[b], the extra
 * per-provider alternative) and strategy-4 (composed AD+PD) from
 * generateStrategyAlternatives().
 */
function toDiverseStrategies(mi: MetaIntelligenceOrchestrator, id = TASK_ID): void {
  withBasis(mi, id);
  mi.decomposeCapabilities(id, graphForProviders({ [AD]: ['magenais.a', 'magenais.b'], [PD]: ['magenais.b'] }), {
    requirements: [
      { capability: AD, origin: 'caller' },
      { capability: PD, origin: 'caller' },
    ],
  });
  mi.generateStrategies(id);
  mi.generateStrategyAlternatives(id);
}

const EVIDENCE_ONLY = [{ id: 'evidence', weight: 1, direction: 'maximize' as const }];
/** Composed strategy-4 has the most evidence; without a risk dimension it wins. */
const EVIDENCE_SCORES = {
  'strategy-1': { evidence: 8 },
  'strategy-2': { evidence: 2 },
  'strategy-3': { evidence: 5 },
  'strategy-4': { evidence: 9 },
};
/** Evidence (maximize, 0.4) plus risk (minimize, 0.6). strategy-4 is the riskiest, so it drops out. */
const EVIDENCE_AND_RISK = [
  { id: 'evidence', weight: 0.4, direction: 'maximize' as const },
  { id: 'risk', weight: 0.6, direction: 'minimize' as const },
];
const EVIDENCE_AND_RISK_SCORES = {
  'strategy-1': { evidence: 8, risk: 2 },
  'strategy-2': { evidence: 2, risk: 2 },
  'strategy-3': { evidence: 5, risk: 1 },
  'strategy-4': { evidence: 9, risk: 9 },
};
const FOUR_WAY_TIE = {
  'strategy-1': { evidence: 5 },
  'strategy-2': { evidence: 5 },
  'strategy-3': { evidence: 5 },
  'strategy-4': { evidence: 5 },
};
/** strategy-1 wins narrowly (0.51 vs 0.49) with a not-perfectly-stable ranking; strategy-3/4 score zero. */
const NARROW_V2_CRITERIA = [
  { id: 'impact', weight: 0.51, direction: 'maximize' as const },
  { id: 'cost', weight: 0.49, direction: 'maximize' as const },
];
const NARROW_V2_SCORES = {
  'strategy-1': { impact: 10, cost: 0 },
  'strategy-2': { impact: 0, cost: 10 },
  'strategy-3': { impact: 0, cost: 0 },
  'strategy-4': { impact: 0, cost: 0 },
};

/** `strategy-N` wins outright on evidence; every other strategy scores 1. */
function evidenceWinner(winner: string): Record<string, { evidence: number }> {
  const scores: Record<string, { evidence: number }> = {};
  for (const sid of ['strategy-1', 'strategy-2', 'strategy-3', 'strategy-4']) scores[sid] = { evidence: sid === winner ? 9 : 1 };
  return scores;
}

// ---------------------------------------------------------------------------
// Cases.
// ---------------------------------------------------------------------------

interface Case {
  id: string;
  category: 'deterministic' | 'scenario' | 'adversarial';
  description: string;
  scenario: MetaIntelligenceScenario;
  expected: Partial<MetaIntelligenceScenarioOutcome>;
}

const CASES: Case[] = [
  {
    id: 'empty-problem-statement',
    category: 'adversarial',
    description: 'intake() rejects an empty statement; no task is created.',
    scenario: (mi) => outcomeFromTask(mi, TASK_ID, attempt(() => mi.intake({ statement: '', id: TASK_ID }))),
    expected: { stage: 'no-task', thrownErrorName: 'EmptyProblemStatementError' },
  },
  {
    id: 'whitespace-only-problem-statement',
    category: 'adversarial',
    description: 'intake() rejects a whitespace-only statement identically to an empty one.',
    scenario: (mi) => outcomeFromTask(mi, TASK_ID, attempt(() => mi.intake({ statement: '   ', id: TASK_ID }))),
    expected: { stage: 'no-task', thrownErrorName: 'EmptyProblemStatementError' },
  },
  {
    id: 'double-call-understand',
    category: 'adversarial',
    description: 'understand() rejects a second call on an already-understood task; the task stays at "understood".',
    scenario: (mi) => {
      mi.intake({ statement: 'Reduce checkout drop-off.', id: TASK_ID });
      mi.understand(TASK_ID);
      return outcomeFromTask(mi, TASK_ID, attempt(() => mi.understand(TASK_ID)));
    },
    expected: { stage: 'understood', thrownErrorName: 'MetaIntelligenceTaskNotAtReceivedStageError' },
  },
  {
    id: 'out-of-order-goals-before-understand',
    category: 'adversarial',
    description: 'addGoalsConstraints() rejects a "received"-stage task; understand() has not run yet.',
    scenario: (mi) => {
      mi.intake({ statement: 'Reduce checkout drop-off.', id: TASK_ID });
      return outcomeFromTask(
        mi,
        TASK_ID,
        attempt(() => mi.addGoalsConstraints(TASK_ID, { goals: [], constraints: [] }))
      );
    },
    expected: { stage: 'received', thrownErrorName: 'MetaIntelligenceTaskNotAtUnderstoodStageError' },
  },
  {
    id: 'empty-goal-text',
    category: 'adversarial',
    description: 'addGoalsConstraints() rejects a whitespace-only goal text.',
    scenario: (mi) => {
      mi.intake({ statement: 'Reduce checkout drop-off.', id: TASK_ID });
      mi.understand(TASK_ID);
      return outcomeFromTask(
        mi,
        TASK_ID,
        attempt(() => mi.addGoalsConstraints(TASK_ID, { goals: [{ text: '   ', origin: 'caller' }], constraints: [] }))
      );
    },
    expected: { stage: 'understood', thrownErrorName: 'EmptyGoalOrConstraintTextError' },
  },
  {
    id: 'empty-epistemic-item-text',
    category: 'adversarial',
    description: 'addEpistemicTracking() rejects a whitespace-only unknown text.',
    scenario: (mi) => {
      mi.intake({ statement: 'Reduce checkout drop-off.', id: TASK_ID });
      mi.understand(TASK_ID);
      mi.addGoalsConstraints(TASK_ID, { goals: [], constraints: [] });
      return outcomeFromTask(
        mi,
        TASK_ID,
        attempt(() =>
          mi.addEpistemicTracking(TASK_ID, {
            knowns: [],
            unknowns: [{ text: ' ', origin: 'caller' }],
            assumptions: [],
            evidence: [],
          })
        )
      );
    },
    expected: { stage: 'goals-constraints', thrownErrorName: 'EmptyEpistemicItemTextError' },
  },
  {
    id: 'empty-capability-requirement',
    category: 'adversarial',
    description: 'decomposeCapabilities() rejects a whitespace-only capability name.',
    scenario: (mi) => {
      withoutBasis(mi);
      return outcomeFromTask(
        mi,
        TASK_ID,
        attempt(() => mi.decomposeCapabilities(TASK_ID, graphFor({}), { requirements: [{ capability: '  ', origin: 'caller' }] }))
      );
    },
    expected: { stage: 'epistemic-tracking', thrownErrorName: 'EmptyCapabilityRequirementError' },
  },
  {
    id: 'selection-none-no-candidates',
    category: 'scenario',
    description: 'evaluateStrategies() with every requirement an unmet gap selects nothing ("no-candidates").',
    scenario: (mi) => {
      toStrategyEvaluationNoCandidates(mi);
      return outcomeFromTask(mi, TASK_ID, null);
    },
    expected: { stage: 'strategy-evaluation', selectionStatus: 'none', noSelectionReason: 'no-candidates', thrownErrorName: null },
  },
  {
    id: 'selection-none-tie-for-top',
    category: 'scenario',
    description: 'evaluateStrategies() with an exact top-two tie selects nothing ("tie-for-top") rather than breaking it by order.',
    scenario: (mi) => {
      toStrategyEvaluationTie(mi);
      return outcomeFromTask(mi, TASK_ID, null);
    },
    expected: { stage: 'strategy-evaluation', selectionStatus: 'none', noSelectionReason: 'tie-for-top', thrownErrorName: null },
  },
  {
    id: 'selection-none-below-stability-threshold',
    category: 'scenario',
    description: 'evaluateStrategies() with minStability above the ranking\'s DSI selects nothing ("below-stability-threshold").',
    scenario: (mi) => {
      toStrategyEvaluationBelowStability(mi);
      return outcomeFromTask(mi, TASK_ID, null);
    },
    expected: {
      stage: 'strategy-evaluation',
      selectionStatus: 'none',
      noSelectionReason: 'below-stability-threshold',
      thrownErrorName: null,
    },
  },
  {
    id: 'act-without-selection-rejected',
    category: 'adversarial',
    description: 'governAction() rejects "ACT" when the task\'s selection is "none".',
    scenario: (mi) => {
      toStrategyEvaluationNoCandidates(mi);
      return outcomeFromTask(mi, TASK_ID, attempt(() => mi.governAction(TASK_ID, { decision: 'ACT' })));
    },
    expected: { stage: 'strategy-evaluation', thrownErrorName: 'MetaIntelligenceActionNotSelectableError' },
  },
  {
    id: 'invalid-governance-decision',
    category: 'adversarial',
    description: 'governAction() rejects a decision outside ACT/WAIT/ASK/SIMULATE.',
    scenario: (mi) => {
      toStrategyEvaluationSelected(mi, 'with');
      return outcomeFromTask(
        mi,
        TASK_ID,
        attempt(() => mi.governAction(TASK_ID, { decision: 'PROCEED' as unknown as 'ACT' }))
      );
    },
    expected: { stage: 'strategy-evaluation', thrownErrorName: 'InvalidGovernanceDecisionError' },
  },
  {
    id: 'governance-act',
    category: 'scenario',
    description: 'governAction() records "ACT" for a selected task (the ACT branch).',
    scenario: (mi) => {
      toActionGovernance(mi, 'ACT', 'with');
      return outcomeFromTask(mi, TASK_ID, null);
    },
    expected: { stage: 'action-governance', governanceDecision: 'ACT', thrownErrorName: null },
  },
  {
    id: 'governance-simulate',
    category: 'scenario',
    description: 'governAction() records "SIMULATE" for a selected task (the SIMULATE branch).',
    scenario: (mi) => {
      toActionGovernance(mi, 'SIMULATE', 'with');
      return outcomeFromTask(mi, TASK_ID, null);
    },
    expected: { stage: 'action-governance', governanceDecision: 'SIMULATE', thrownErrorName: null },
  },
  {
    id: 'governance-wait',
    category: 'scenario',
    description: 'governAction() records "WAIT" without requiring a selection.',
    scenario: (mi) => {
      toActionGovernance(mi, 'WAIT', 'with');
      return outcomeFromTask(mi, TASK_ID, null);
    },
    expected: { stage: 'action-governance', governanceDecision: 'WAIT', thrownErrorName: null },
  },
  {
    id: 'governance-ask',
    category: 'scenario',
    description: 'governAction() records "ASK" without requiring a selection.',
    scenario: (mi) => {
      toActionGovernance(mi, 'ASK', 'with');
      return outcomeFromTask(mi, TASK_ID, null);
    },
    expected: { stage: 'action-governance', governanceDecision: 'ASK', thrownErrorName: null },
  },
  {
    id: 'double-call-governance',
    category: 'adversarial',
    description: 'governAction() rejects a second call on an already-governed task.',
    scenario: (mi) => {
      toActionGovernance(mi, 'WAIT', 'with');
      return outcomeFromTask(mi, TASK_ID, attempt(() => mi.governAction(TASK_ID, { decision: 'WAIT' })));
    },
    expected: { stage: 'action-governance', thrownErrorName: 'MetaIntelligenceTaskNotAtStrategyEvaluationStageError' },
  },
  {
    id: 'double-call-evaluate',
    category: 'adversarial',
    description: 'evaluateStrategies() rejects a second call on an already-evaluated task.',
    scenario: (mi) => {
      toStrategyEvaluationSelected(mi, 'with');
      return outcomeFromTask(
        mi,
        TASK_ID,
        attempt(() => mi.evaluateStrategies(TASK_ID, { criteria: CRITERIA, scores: CLEAR_SCORES }))
      );
    },
    expected: { stage: 'strategy-evaluation', thrownErrorName: 'MetaIntelligenceTaskNotAtCandidateStrategiesStageError' },
  },
  {
    id: 'result-not-representable-wait',
    category: 'adversarial',
    description: 'recordResult() refuses a result for a "WAIT"-governed task — a deferred decision has nothing to result.',
    scenario: (mi) => {
      toActionGovernance(mi, 'WAIT', 'with');
      return outcomeFromTask(mi, TASK_ID, attempt(() => mi.recordResult(TASK_ID, { status: 'succeeded' })));
    },
    expected: { stage: 'action-governance', thrownErrorName: 'MetaIntelligenceResultNotRepresentableError' },
  },
  {
    id: 'result-not-representable-ask',
    category: 'adversarial',
    description: 'recordResult() refuses a result for an "ASK"-governed task — a deferred decision has nothing to result.',
    scenario: (mi) => {
      toActionGovernance(mi, 'ASK', 'with');
      return outcomeFromTask(mi, TASK_ID, attempt(() => mi.recordResult(TASK_ID, { status: 'succeeded' })));
    },
    expected: { stage: 'action-governance', thrownErrorName: 'MetaIntelligenceResultNotRepresentableError' },
  },
  {
    id: 'invalid-result-status',
    category: 'adversarial',
    description: 'recordResult() rejects a status outside succeeded/failed/not-yet-executed.',
    scenario: (mi) => {
      toActionGovernance(mi, 'ACT', 'with');
      return outcomeFromTask(
        mi,
        TASK_ID,
        attempt(() => mi.recordResult(TASK_ID, { status: 'done' as unknown as 'succeeded' }))
      );
    },
    expected: { stage: 'action-governance', thrownErrorName: 'InvalidResultStatusError' },
  },
  {
    id: 'verification-not-verifiable',
    category: 'scenario',
    description: '"not-yet-executed" verifies as "not-verifiable" — nothing has happened yet.',
    scenario: (mi) => {
      toResultVerification(mi, 'ACT', 'not-yet-executed', 'with');
      return outcomeFromTask(mi, TASK_ID, null);
    },
    expected: { stage: 'result-verification', verificationOutcome: 'not-verifiable', thrownErrorName: null },
  },
  {
    id: 'verification-goals-not-met',
    category: 'scenario',
    description: '"failed" verifies as "goals-not-met" regardless of recorded basis.',
    scenario: (mi) => {
      toResultVerification(mi, 'ACT', 'failed', 'with');
      return outcomeFromTask(mi, TASK_ID, null);
    },
    expected: { stage: 'result-verification', verificationOutcome: 'goals-not-met', thrownErrorName: null },
  },
  {
    id: 'verification-insufficient-basis',
    category: 'scenario',
    description: '"succeeded" with no recorded goal/constraint/known verifies as "insufficient-basis".',
    scenario: (mi) => {
      toResultVerification(mi, 'ACT', 'succeeded', 'without');
      return outcomeFromTask(mi, TASK_ID, null);
    },
    expected: { stage: 'result-verification', verificationOutcome: 'insufficient-basis', thrownErrorName: null },
  },
  {
    id: 'verification-verified-against-basis-act-branch',
    category: 'scenario',
    description: 'Full received->result-verification path via ACT: "succeeded" with a recorded basis verifies as "verified-against-basis".',
    scenario: (mi) => {
      toResultVerification(mi, 'ACT', 'succeeded', 'with');
      return outcomeFromTask(mi, TASK_ID, null);
    },
    expected: {
      stage: 'result-verification',
      governanceDecision: 'ACT',
      verificationOutcome: 'verified-against-basis',
      simulated: false,
      thrownErrorName: null,
    },
  },
  {
    id: 'adaptation-not-representable-verified-against-basis',
    category: 'adversarial',
    description: 'recordAdaptation() refuses to adapt a supported success ("verified-against-basis").',
    scenario: (mi) => {
      toResultVerification(mi, 'ACT', 'succeeded', 'with');
      return outcomeFromTask(mi, TASK_ID, attempt(() => mi.recordAdaptation(TASK_ID, { decision: 'accept' })));
    },
    expected: { stage: 'result-verification', thrownErrorName: 'MetaIntelligenceAdaptationNotRepresentableError' },
  },
  {
    id: 'adaptation-not-representable-not-verifiable',
    category: 'adversarial',
    description: 'recordAdaptation() refuses to adapt a "not-verifiable" task — nothing has happened yet, so there is no failure to adapt to.',
    scenario: (mi) => {
      toResultVerification(mi, 'ACT', 'not-yet-executed', 'with');
      return outcomeFromTask(mi, TASK_ID, attempt(() => mi.recordAdaptation(TASK_ID, { decision: 'accept' })));
    },
    expected: { stage: 'result-verification', thrownErrorName: 'MetaIntelligenceAdaptationNotRepresentableError' },
  },
  {
    id: 'invalid-adaptation-decision',
    category: 'adversarial',
    description: 'recordAdaptation() rejects a decision outside retry/re-plan/escalate/accept.',
    scenario: (mi) => {
      toResultVerification(mi, 'ACT', 'failed', 'with');
      return outcomeFromTask(
        mi,
        TASK_ID,
        attempt(() => mi.recordAdaptation(TASK_ID, { decision: 'ignore' as unknown as 'accept' }))
      );
    },
    expected: { stage: 'result-verification', thrownErrorName: 'InvalidAdaptationDecisionError' },
  },
  {
    id: 'adaptation-retry',
    category: 'scenario',
    description: '"goals-not-met" can be adapted with "retry".',
    scenario: (mi) => {
      toResultVerification(mi, 'ACT', 'failed', 'with');
      mi.recordAdaptation(TASK_ID, { decision: 'retry' });
      return outcomeFromTask(mi, TASK_ID, null);
    },
    expected: { stage: 'adaptation', adaptationDecision: 'retry', thrownErrorName: null },
  },
  {
    id: 'adaptation-escalate',
    category: 'scenario',
    description: '"goals-not-met" can be adapted with "escalate".',
    scenario: (mi) => {
      toResultVerification(mi, 'ACT', 'failed', 'with');
      mi.recordAdaptation(TASK_ID, { decision: 'escalate' });
      return outcomeFromTask(mi, TASK_ID, null);
    },
    expected: { stage: 'adaptation', adaptationDecision: 'escalate', thrownErrorName: null },
  },
  {
    id: 'adaptation-re-plan',
    category: 'scenario',
    description: '"insufficient-basis" can be adapted with "re-plan".',
    scenario: (mi) => {
      toResultVerification(mi, 'ACT', 'succeeded', 'without');
      mi.recordAdaptation(TASK_ID, { decision: 're-plan' });
      return outcomeFromTask(mi, TASK_ID, null);
    },
    expected: { stage: 'adaptation', adaptationDecision: 're-plan', thrownErrorName: null },
  },
  {
    id: 'adaptation-accept-simulate-branch',
    category: 'scenario',
    description: 'Full received->adaptation path via SIMULATE: "insufficient-basis" can be adapted with "accept"; result.simulated is true.',
    scenario: (mi) => {
      toResultVerification(mi, 'SIMULATE', 'succeeded', 'without');
      mi.recordAdaptation(TASK_ID, { decision: 'accept' });
      return outcomeFromTask(mi, TASK_ID, null);
    },
    expected: {
      stage: 'adaptation',
      governanceDecision: 'SIMULATE',
      simulated: true,
      adaptationDecision: 'accept',
      thrownErrorName: null,
    },
  },
  {
    id: 'double-call-adaptation',
    category: 'adversarial',
    description: 'recordAdaptation() rejects a second call on an already-adapted task.',
    scenario: (mi) => {
      toResultVerification(mi, 'ACT', 'failed', 'with');
      mi.recordAdaptation(TASK_ID, { decision: 'retry' });
      return outcomeFromTask(mi, TASK_ID, attempt(() => mi.recordAdaptation(TASK_ID, { decision: 'retry' })));
    },
    expected: { stage: 'adaptation', thrownErrorName: 'MetaIntelligenceTaskNotAtResultVerificationStageError' },
  },

  // -------------------------------------------------------------------------
  // V2-D1: adversarial/realistic V2-B/C coverage. `.mi/NEXT.json`'s own
  // objective for this AWU: assess whether this suite already exercises
  // strategies/strategyAlternatives/strategyOptionsEvaluation/
  // compositionBoundary/executionPlan/executionResult/
  // executionVerification/executionAdaptation -- it did not (every case
  // above only ever reaches `candidateStrategies`/`strategyEvaluation`/
  // `governance`/`result`/`verification`/`adaptation`, the frozen V1
  // surface). The cases below are the smallest set (Law G) that closes
  // that gap: one case per genuinely adversarial structural-reachability
  // finding V2-C1/C4/C5 each made and fixed (a frozen V1 method really
  // cannot reach a V2-B/C-only task), one double-call rejection per new
  // V2-B/C stage-like method that has one, one not-representable
  // rejection for `recordExecutionAdaptation()`, and exactly one
  // realistic end-to-end scenario exercising the full V2-B/C chain plus
  // `getCognitiveTrace()` over it (V2-C3/C4/C5/D1's own composed output).
  // -------------------------------------------------------------------------
  {
    id: 'v2bc-strategies-only-blocks-governAction',
    category: 'adversarial',
    description:
      'The frozen V1 governAction() cannot reach a strategies-only (V2-B2) task -- it is gated to the ' +
      "V1 'strategy-evaluation' stage, which generateStrategies() never sets (V2-C1's own structural-reachability finding, regression-proofed at the benchmark level).",
    scenario: (mi) => {
      toStrategies(mi, 'with');
      return outcomeFromTask(mi, TASK_ID, attempt(() => mi.governAction(TASK_ID, { decision: 'ACT' })));
    },
    expected: { stage: 'capability-decomposition', thrownErrorName: 'MetaIntelligenceTaskNotAtStrategyEvaluationStageError' },
  },
  {
    id: 'v2bc-executionplan-only-blocks-recordResult',
    category: 'adversarial',
    description:
      'The frozen V1 recordResult() cannot reach an executionPlan-only (V2-C2) task -- it is gated to the ' +
      "V1 'action-governance' stage, which no V2-B/C method ever sets (V2-C4's own structural-reachability finding, regression-proofed at the benchmark level).",
    scenario: (mi) => {
      toV2ExecutionPlan(mi, 'with');
      return outcomeFromTask(mi, TASK_ID, attempt(() => mi.recordResult(TASK_ID, { status: 'succeeded' })));
    },
    expected: { stage: 'capability-decomposition', thrownErrorName: 'MetaIntelligenceTaskNotAtActionGovernanceStageError' },
  },
  {
    id: 'v2bc-executionverification-only-blocks-recordAdaptation',
    category: 'adversarial',
    description:
      'The frozen V1 recordAdaptation() cannot reach an executionVerification-only (V2-C4) task -- it is gated to the ' +
      "V1 'result-verification' stage, which no V2-B/C method ever sets (V2-C5's own structural-reachability finding, regression-proofed at the benchmark level).",
    scenario: (mi) => {
      toV2ExecutionVerification(mi, 'failed', 'with');
      return outcomeFromTask(mi, TASK_ID, attempt(() => mi.recordAdaptation(TASK_ID, { decision: 'retry' })));
    },
    expected: { stage: 'capability-decomposition', thrownErrorName: 'MetaIntelligenceTaskNotAtResultVerificationStageError' },
  },
  {
    id: 'v2bc-composition-wait-blocks-executionplan',
    category: 'adversarial',
    description: "authorizeComposition('WAIT') records a boundary with null components; buildExecutionPlan() then refuses it (deliberately 'ACT'-only, per MetaIntelligenceExecutionPlanNotAuthorizedError's own doc comment).",
    scenario: (mi) => {
      toCompositionBoundary(mi, 'WAIT', 'with');
      return outcomeFromTask(mi, TASK_ID, attempt(() => mi.buildExecutionPlan(TASK_ID)));
    },
    expected: { stage: 'capability-decomposition', thrownErrorName: 'MetaIntelligenceExecutionPlanNotAuthorizedError' },
  },
  {
    id: 'v2bc-double-call-authorizeComposition',
    category: 'adversarial',
    description: 'authorizeComposition() rejects a second call on an already-bound task.',
    scenario: (mi) => {
      toCompositionBoundary(mi, 'ACT', 'with');
      return outcomeFromTask(mi, TASK_ID, attempt(() => mi.authorizeComposition(TASK_ID, { decision: 'WAIT' })));
    },
    expected: { stage: 'capability-decomposition', thrownErrorName: 'MetaIntelligenceCompositionAlreadyBoundError' },
  },
  {
    id: 'v2bc-double-call-recordExecutionOutcome',
    category: 'adversarial',
    description: 'recordExecutionOutcome() rejects a second call on an already-recorded task.',
    scenario: (mi) => {
      toV2ExecutionVerification(mi, 'succeeded', 'with');
      return outcomeFromTask(mi, TASK_ID, attempt(() => mi.recordExecutionOutcome(TASK_ID, { status: 'failed' })));
    },
    expected: { stage: 'capability-decomposition', thrownErrorName: 'MetaIntelligenceExecutionResultAlreadyRecordedError' },
  },
  {
    id: 'v2bc-double-call-recordExecutionAdaptation',
    category: 'adversarial',
    description: 'recordExecutionAdaptation() rejects a second call on an already-adapted task.',
    scenario: (mi) => {
      toV2ExecutionVerification(mi, 'failed', 'with');
      mi.recordExecutionAdaptation(TASK_ID, { decision: 'retry' });
      return outcomeFromTask(mi, TASK_ID, attempt(() => mi.recordExecutionAdaptation(TASK_ID, { decision: 'retry' })));
    },
    expected: { stage: 'capability-decomposition', thrownErrorName: 'MetaIntelligenceExecutionAdaptationAlreadyRecordedError' },
  },
  {
    id: 'v2bc-execution-adaptation-not-representable-verified-against-basis',
    category: 'adversarial',
    description: "recordExecutionAdaptation() refuses to adapt a supported success ('verified-against-basis'), mirroring recordAdaptation()'s own frozen V1 refusal.",
    scenario: (mi) => {
      toV2ExecutionVerification(mi, 'succeeded', 'with');
      return outcomeFromTask(mi, TASK_ID, attempt(() => mi.recordExecutionAdaptation(TASK_ID, { decision: 'accept' })));
    },
    expected: { stage: 'capability-decomposition', thrownErrorName: 'MetaIntelligenceExecutionAdaptationNotRepresentableError' },
  },
  {
    id: 'v2bc-full-pipeline-act-branch',
    category: 'scenario',
    description:
      'Full received->executionAdaptation path over the real V2-B/C surface (strategies->strategyOptionsEvaluation->' +
      "compositionBoundary('ACT')->executionPlan->executionResult->executionVerification->executionAdaptation), with getCognitiveTrace() composing all of it.",
    scenario: (mi) => {
      toV2ExecutionVerification(mi, 'failed', 'with');
      mi.recordExecutionAdaptation(TASK_ID, { decision: 're-plan' });
      return outcomeFromTask(mi, TASK_ID, null);
    },
    expected: {
      stage: 'capability-decomposition',
      executionAdaptationDecision: 're-plan',
      thrownErrorName: null,
      cognitiveTraceFields: [
        'problem',
        'understanding',
        'goalsConstraints',
        'epistemicTracking',
        'capabilityDecomposition',
        'strategies',
        'strategyOptionsEvaluation',
        'compositionBoundary',
        'executionPlan',
        'executionResult',
        'executionVerification',
        'executionAdaptation',
      ],
    },
  },
  // -------------------------------------------------------------------------
  // V2-D5: strategy-quality cases (closing the V2-D4 gate's G10 PARTIAL).
  // Multi-requirement / multi-provider fixture (see toDiverseStrategies()).
  // Every expected value below was read off a real run; none was derived
  // from what the code is supposed to do.
  // -------------------------------------------------------------------------
  {
    id: 'v2q-alternatives-per-provider-and-composed',
    category: 'scenario',
    description:
      'generateStrategyAlternatives() over two requirements (AD: 2 providers, PD: 1) adds exactly one per-provider ' +
      'single-requirement alternative (AD[b]) and one composed strategy spanning both requirements, continuing strategy-N numbering; strategies is untouched.',
    scenario: (mi) => {
      toDiverseStrategies(mi);
      return outcomeFromTask(mi, TASK_ID, null);
    },
    expected: {
      stage: 'capability-decomposition',
      thrownErrorName: null,
      strategyIds: ['strategy-1', 'strategy-2'],
      alternativeStrategies: [
        'strategy-3|single-requirement|anomaly-detection[magenais.b]',
        'strategy-4|composed|anomaly-detection[magenais.a,magenais.b]+pattern-detection[magenais.b]',
      ],
    },
  },
  {
    id: 'v2q-alternatives-none-without-diversity',
    category: 'scenario',
    description:
      'generateStrategyAlternatives() over one requirement with one provider yields an empty alternatives list -- it does not invent diversity the task does not have.',
    scenario: (mi) => {
      withBasis(mi);
      mi.decomposeCapabilities(TASK_ID, graphForProviders({ [AD]: ['magenais.a'] }), { requirements: [{ capability: AD, origin: 'caller' }] });
      mi.generateStrategies(TASK_ID);
      mi.generateStrategyAlternatives(TASK_ID);
      return outcomeFromTask(mi, TASK_ID, null);
    },
    expected: { stage: 'capability-decomposition', thrownErrorName: null, strategyIds: ['strategy-1'], alternativeStrategies: [] },
  },
  {
    id: 'v2q-selection-without-risk-criterion',
    category: 'scenario',
    description:
      'evaluateStrategyOptions() with an evidence-only criterion set over all four options selects the composed strategy-4 (highest evidence); baseline half of the risk-flip pair.',
    scenario: (mi) => {
      toDiverseStrategies(mi);
      mi.evaluateStrategyOptions(TASK_ID, { criteria: EVIDENCE_ONLY, scores: EVIDENCE_SCORES });
      return outcomeFromTask(mi, TASK_ID, null);
    },
    expected: {
      stage: 'capability-decomposition',
      thrownErrorName: null,
      optionsSelectionStatus: 'selected',
      optionsSelectedStrategyId: 'strategy-4',
      optionsRankingIds: ['strategy-4', 'strategy-1', 'strategy-3', 'strategy-2'],
      optionsDsi: 1,
    },
  },
  {
    id: 'v2q-selection-with-risk-criterion-flips-selection',
    category: 'scenario',
    description:
      'Adding a minimize-direction risk criterion (weight 0.6) to the same evidence scores demotes the risky composed strategy-4 to last and selects strategy-1 instead: risk materially affects selection (G5).',
    scenario: (mi) => {
      toDiverseStrategies(mi);
      mi.evaluateStrategyOptions(TASK_ID, { criteria: EVIDENCE_AND_RISK, scores: EVIDENCE_AND_RISK_SCORES });
      return outcomeFromTask(mi, TASK_ID, null);
    },
    expected: {
      stage: 'capability-decomposition',
      thrownErrorName: null,
      optionsSelectionStatus: 'selected',
      optionsSelectedStrategyId: 'strategy-1',
      optionsRankingIds: ['strategy-1', 'strategy-3', 'strategy-2', 'strategy-4'],
      optionsDsi: 1,
    },
  },
  {
    id: 'v2q-selection-none-tie-for-top',
    category: 'scenario',
    description: 'evaluateStrategyOptions() with identical scores for all four options selects nothing (\'tie-for-top\') rather than breaking the tie by order.',
    scenario: (mi) => {
      toDiverseStrategies(mi);
      mi.evaluateStrategyOptions(TASK_ID, { criteria: EVIDENCE_ONLY, scores: FOUR_WAY_TIE });
      return outcomeFromTask(mi, TASK_ID, null);
    },
    expected: {
      stage: 'capability-decomposition',
      thrownErrorName: null,
      optionsSelectionStatus: 'none',
      optionsNoSelectionReason: 'tie-for-top',
    },
  },
  {
    id: 'v2q-selection-none-below-stability-threshold',
    category: 'scenario',
    description:
      'evaluateStrategyOptions() over a narrowly-won ranking (DSI 0.55) with minStability 1 selects nothing (\'below-stability-threshold\') instead of committing to an unstable winner.',
    scenario: (mi) => {
      toDiverseStrategies(mi);
      mi.evaluateStrategyOptions(TASK_ID, { criteria: NARROW_V2_CRITERIA, scores: NARROW_V2_SCORES, minStability: 1 });
      return outcomeFromTask(mi, TASK_ID, null);
    },
    expected: {
      stage: 'capability-decomposition',
      thrownErrorName: null,
      optionsSelectionStatus: 'none',
      optionsNoSelectionReason: 'below-stability-threshold',
      optionsDsi: 0.55,
    },
  },
  {
    id: 'v2q-selection-narrow-ranking-selects-without-threshold',
    category: 'scenario',
    description:
      'The identical narrow ranking with no minStability selects strategy-1 (DSI still 0.55): the stability threshold, not the scores, is what produced the none outcome above.',
    scenario: (mi) => {
      toDiverseStrategies(mi);
      mi.evaluateStrategyOptions(TASK_ID, { criteria: NARROW_V2_CRITERIA, scores: NARROW_V2_SCORES });
      return outcomeFromTask(mi, TASK_ID, null);
    },
    expected: {
      stage: 'capability-decomposition',
      thrownErrorName: null,
      optionsSelectionStatus: 'selected',
      optionsSelectedStrategyId: 'strategy-1',
      optionsDsi: 0.55,
    },
  },
  {
    id: 'v2q-act-alternative-strategy-components-and-plan',
    category: 'scenario',
    description:
      "authorizeComposition('ACT') over a selected per-provider alternative (strategy-3) attaches that strategy's single component verbatim, and buildExecutionPlan() carries exactly it.",
    scenario: (mi) => {
      toDiverseStrategies(mi);
      mi.evaluateStrategyOptions(TASK_ID, { criteria: EVIDENCE_ONLY, scores: evidenceWinner('strategy-3') });
      mi.authorizeComposition(TASK_ID, { decision: 'ACT' });
      mi.buildExecutionPlan(TASK_ID);
      return outcomeFromTask(mi, TASK_ID, null);
    },
    expected: {
      stage: 'capability-decomposition',
      thrownErrorName: null,
      optionsSelectedStrategyId: 'strategy-3',
      compositionDecision: 'ACT',
      compositionComponents: ['anomaly-detection[magenais.b]'],
      executionPlanSteps: ['anomaly-detection[magenais.b]'],
    },
  },
  {
    id: 'v2q-act-composed-strategy-components-and-plan',
    category: 'scenario',
    description:
      "authorizeComposition('ACT') over the selected composed strategy-4 attaches both components in order, with their full provider lists, and buildExecutionPlan() carries them unchanged.",
    scenario: (mi) => {
      toDiverseStrategies(mi);
      mi.evaluateStrategyOptions(TASK_ID, { criteria: EVIDENCE_ONLY, scores: evidenceWinner('strategy-4') });
      mi.authorizeComposition(TASK_ID, { decision: 'ACT' });
      mi.buildExecutionPlan(TASK_ID);
      return outcomeFromTask(mi, TASK_ID, null);
    },
    expected: {
      stage: 'capability-decomposition',
      thrownErrorName: null,
      optionsSelectedStrategyId: 'strategy-4',
      compositionDecision: 'ACT',
      compositionComponents: ['anomaly-detection[magenais.a,magenais.b]', 'pattern-detection[magenais.b]'],
      executionPlanSteps: ['anomaly-detection[magenais.a,magenais.b]', 'pattern-detection[magenais.b]'],
    },
  },
];

/**
 * V2-D2: which of `META_INTELLIGENCE_MANIFEST.failureModes` each case probes
 * (V5 MASTER PROMPT §27). A case is tagged only when its expected rejection
 * is literally what a declared failure mode's own `behavior` text describes:
 *   - act-without-selection: ActionNotSelectableError
 *   - adaptation-not-representable: recordAdaptation()'s refusal (the manifest
 *     names recordAdaptation() specifically, so the V2 analogue
 *     recordExecutionAdaptation() is deliberately NOT tagged)
 *   - out-of-order-stage-call: a stage method's own NotAtXStageError
 *   - empty-text-input: the four Empty*Error classes
 * V2-D5 declared the five modes V2-D2 found missing, each checked against
 * the exact throw site (see the manifest), and tags their cases:
 *   - result-not-representable: recordResult() on a WAIT/ASK-governed task
 *   - invalid-enum-value: Invalid{Governance,Result,Adaptation}*Error
 *   - duplicate-v2-stage-call: the three V2 AlreadyBound/AlreadyRecorded errors
 *   - execution-plan-not-authorized: buildExecutionPlan() off a non-ACT boundary
 *   - execution-adaptation-not-representable: recordExecutionAdaptation()'s refusal
 * Nothing is left undocumented among the cases that expect a rejection.
 */
export const PROBES_FAILURE_MODES: Readonly<Record<string, readonly string[]>> = {
  'act-without-selection-rejected': ['act-without-selection'],
  'adaptation-not-representable-verified-against-basis': ['adaptation-not-representable'],
  'adaptation-not-representable-not-verifiable': ['adaptation-not-representable'],
  'double-call-understand': ['out-of-order-stage-call'],
  'out-of-order-goals-before-understand': ['out-of-order-stage-call'],
  'double-call-governance': ['out-of-order-stage-call'],
  'double-call-evaluate': ['out-of-order-stage-call'],
  'double-call-adaptation': ['out-of-order-stage-call'],
  'v2bc-strategies-only-blocks-governAction': ['out-of-order-stage-call'],
  'v2bc-executionplan-only-blocks-recordResult': ['out-of-order-stage-call'],
  'v2bc-executionverification-only-blocks-recordAdaptation': ['out-of-order-stage-call'],
  'empty-problem-statement': ['empty-text-input'],
  'whitespace-only-problem-statement': ['empty-text-input'],
  'empty-goal-text': ['empty-text-input'],
  'empty-epistemic-item-text': ['empty-text-input'],
  'empty-capability-requirement': ['empty-text-input'],
  'result-not-representable-wait': ['result-not-representable'],
  'result-not-representable-ask': ['result-not-representable'],
  'invalid-governance-decision': ['invalid-enum-value'],
  'invalid-result-status': ['invalid-enum-value'],
  'invalid-adaptation-decision': ['invalid-enum-value'],
  'v2bc-double-call-authorizeComposition': ['duplicate-v2-stage-call'],
  'v2bc-double-call-recordExecutionOutcome': ['duplicate-v2-stage-call'],
  'v2bc-double-call-recordExecutionAdaptation': ['duplicate-v2-stage-call'],
  'v2bc-composition-wait-blocks-executionplan': ['execution-plan-not-authorized'],
  'v2bc-execution-adaptation-not-representable-verified-against-basis': ['execution-adaptation-not-representable'],
};

export const metaIntelligencePipelineBenchmark: BenchmarkDefinition<MetaIntelligenceScenario, MetaIntelligenceScenarioOutcome, Partial<MetaIntelligenceScenarioOutcome>> = {
  id: META_INTELLIGENCE_PIPELINE_BENCHMARK_ID,
  name: 'Meta-Intelligence Pipeline Correctness',
  description:
    'Exercises the full AWU-01..10 Meta-Intelligence DoD pipeline (received through adaptation), including the ' +
    'ACT/SIMULATE governance branches, every terminal none/not-representable branch, all four verification ' +
    'outcomes, all four adaptation decisions, and double-call/out-of-order rejections. V2-D1 additively extends ' +
    'this to the real V2-B/C surface (strategies through executionAdaptation): the structural-reachability gaps ' +
    'V2-C1/C4/C5 each found and fixed, the new stages\' double-call rejections, and one full end-to-end scenario.',
  version: META_INTELLIGENCE_PIPELINE_BENCHMARK_VERSION,
  cases: CASES.map((c) => ({
    id: c.id,
    category: c.category,
    input: c.scenario,
    expected: c.expected,
    description: c.description,
    ...(PROBES_FAILURE_MODES[c.id] ? { probesFailureModes: [...PROBES_FAILURE_MODES[c.id]] } : {}),
  })),
  score: (actual, expected) => {
    const out = actual.output as MetaIntelligenceScenarioOutcome;
    const exp = expected ?? {};
    const mismatches: string[] = [];
    for (const key of Object.keys(exp) as (keyof MetaIntelligenceScenarioOutcome)[]) {
      // V2-D1: structural (JSON) comparison, not `!==` -- required once an
      // `expected` field can be array-valued (`cognitiveTraceFields`), since
      // two distinct array instances with identical content are never `===`.
      // Produces the exact same verdict as the old `!==` check for every
      // pre-existing primitive-valued field (string/boolean/null/undefined),
      // so none of the 33 V1 cases' scoring changes.
      if (JSON.stringify(out[key]) !== JSON.stringify(exp[key])) {
        mismatches.push(`${key}: expected ${JSON.stringify(exp[key])}, got ${JSON.stringify(out[key])}`);
      }
    }
    return {
      passed: mismatches.length === 0,
      metrics: { mismatchCount: mismatches.length },
      notes: mismatches.length > 0 ? mismatches.join('; ') : undefined,
    };
  },
};

/**
 * The one and only subject: the real orchestrator. Each case's `input` is
 * already the runnable scenario (see header) — the subject's only job is
 * to hand it a fresh `MetaIntelligenceOrchestrator` and return what came
 * back, matching `BenchmarkSubject`'s `(input) => Promise<SubjectInvocation>`
 * shape.
 */
export const metaIntelligencePipelineSubject: BenchmarkSubject<MetaIntelligenceScenario, MetaIntelligenceScenarioOutcome> =
  async (scenario) => ({ output: scenario(new MetaIntelligenceOrchestrator()) });

/**
 * Meta-Intelligence has no `ModelManifest`/capability tag yet — that
 * registration is AWU-12's job (`.mi/NEXT.json`'s AWU-11 `mustNotImplementYet`
 * explicitly excludes it from this AWU) — so this descriptor names the
 * subject directly rather than through a manifest id lookup.
 */
export const META_INTELLIGENCE_SUBJECT_DESCRIPTOR: SubjectDescriptor = {
  kind: 'native-model',
  id: META_INTELLIGENCE_MODEL_ID,
  version: META_INTELLIGENCE_VERSION,
};

/**
 * Runs the pipeline-correctness benchmark against the real orchestrator.
 * Returns a single `BenchmarkRunResult`, not a `BaselineComparison` — see
 * this file's header for why a baseline-vs-treatment pairing does not
 * apply to Meta-Intelligence, and why this run itself is the recorded
 * baseline for future AWUs to compare against.
 */
export async function runMetaIntelligencePipelineBenchmark(options: RunOptions = {}): Promise<BenchmarkRunResult> {
  return runBenchmark(metaIntelligencePipelineBenchmark, metaIntelligencePipelineSubject, META_INTELLIGENCE_SUBJECT_DESCRIPTOR, options);
}
