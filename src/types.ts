/**
 * types.ts (Meta-Intelligence)
 *
 * AWU-01. The smallest real contract for Meta-Intelligence (V5-5): pure
 * data shapes only, following the split already established between
 * `CognitiveContract.ts` (types) and `ModelRegistry.ts`
 * (behavior/errors) — see this directory's `MetaIntelligenceOrchestrator.ts`
 * for the latter.
 *
 * Meta-Intelligence's full lifecycle (build prompt §14, Definition of
 * Done) is:
 *
 *   Problem -> Understand -> Goals/Constraints -> Known/Unknown/
 *   Assumptions/Evidence -> Capability Decomposition -> Candidate
 *   Strategies -> Evaluation/Selection -> Execution/Composition ->
 *   Verification -> Result -> Adaptation/Re-plan
 *
 * AWU-01 implemented ONLY the first stage (intake of the caller's problem
 * statement, verbatim, as `'received'`). AWU-02 added the second stage,
 * `'understood'`: a normalized restatement of the problem, derived
 * mechanically (whitespace collapsing only — no semantic interpretation).
 * AWU-03 added the third stage, `'goals-constraints'`: a caller- or
 * extraction-sourced list of goals and constraints, each tagged with its
 * origin so `'caller'` (stated verbatim by the caller) and `'extracted'`
 * (derived by Meta-Intelligence) items are never silently merged or
 * rewritten into each other. AWU-04 adds the fourth stage,
 * `'epistemic-tracking'`: knowns, unknowns, assumptions, and evidence
 * tracked as four distinct categories, each item tagged with the same
 * `'caller'` / `'extracted'` origin used by goals/constraints — this
 * stage deliberately does not decompose capabilities (AWU-05), generate
 * or select a strategy (AWU-06/07), execute or verify anything
 * (AWU-08/09), or adapt/re-plan (AWU-10). AWU-05 adds the fifth stage,
 * `'capability-decomposition'`: the task's required capabilities — still
 * supplied by the caller/extraction (same `'caller'` / `'extracted'`
 * origin tagging as every earlier stage; never inferred here from the
 * problem text) — are checked against the existing CapabilityGraph
 * (which model ids, if any, currently provide each one), rather than
 * against a parallel capability model invented for Meta-Intelligence.
 * This stage deliberately does not generate or select a strategy
 * (AWU-06/07), execute or verify anything (AWU-08/09), or adapt/re-plan
 * (AWU-10) — recording which capabilities are required and which of
 * those are unmet gaps is not the same claim as choosing a provider or a
 * plan. AWU-06 adds the sixth stage, `'candidate-strategies'`: a
 * minimal, non-selecting set of candidate strategies built directly from
 * the AWU-05 decomposition (one candidate per satisfied capability
 * requirement, carrying that requirement's own providers) rather than
 * from a parallel model. This stage deliberately does not evaluate,
 * score, rank, or select among candidates (AWU-07), execute or verify
 * anything (AWU-08/09), or adapt/re-plan (AWU-10) — listing the
 * candidates is not the same claim as preferring one of them.
 *
 * AWU-07 adds the seventh stage, `'strategy-evaluation'`: the AWU-06
 * candidates are scored with the existing DecisionScore model (weighted
 * multi-criteria ranking + Decision Stability Index + Decision Flip
 * Points) rather than a parallel scoring model, and the outcome is
 * recorded as an explicit selection — either ONE candidate id or an
 * explicit "none selected" with a reason. Selecting a candidate is a
 * recorded decision only: it does not choose a provider from the
 * candidate's list, and this stage does not execute, verify, or
 * adapt/re-plan anything (AWU-08/09/10).
 *
 * AWU-08 adds the eighth stage, `'action-governance'`: an explicit
 * ACT/WAIT/ASK/SIMULATE governance decision is recorded against an
 * already-`'strategy-evaluation'` task, gating any future use of the
 * AWU-07 selection. The decision is caller-supplied (Meta-Intelligence
 * does not invent policy for when to act, wait, ask, or simulate) but
 * mechanically constrained: `'ACT'` is rejected outright unless
 * `strategyEvaluation.selection.status === 'selected'` — a task with no
 * selection, or an explicit "none selected", can never be governed to
 * `'ACT'`. The recorded governance always carries a copy of the
 * selection it gates, so the decision is traceable back to AWU-07
 * without a live reference. This stage deliberately does not execute,
 * compose, verify, or adapt/re-plan anything — recording the governance
 * decision is not the same claim as carrying it out (AWU-09/10).
 *
 * AWU-09 adds the ninth stage, `'result-verification'`: given an
 * already-`'action-governance'` task, an explicit result is recorded for
 * the governed decision (`'succeeded'` | `'failed'` | `'not-yet-executed'`)
 * — the caller's claim about what happened, never Meta-Intelligence's own
 * invention, and never an actual execution or composition of the AWU-07
 * selection (that remains undone). Reachable only from a governance
 * `decision` of `'ACT'` or `'SIMULATE'`: `'WAIT'`/`'ASK'` defer the
 * decision itself, so there is nothing yet to have a result. The result
 * also carries `simulated`, mechanically derived from
 * `governance.decision` (never caller-supplied — a caller cannot claim a
 * `'SIMULATE'`-gated result was real, or an `'ACT'`-gated one merely
 * simulated). Alongside the result, a verification outcome is computed —
 * mechanically, from the result's `status` and the task's own AWU-03
 * goals/constraints and AWU-04 knowns, never a bare "verified" claim with
 * no stated basis: `'not-yet-executed'` is `'not-verifiable'` (nothing to
 * check yet); `'failed'` is `'goals-not-met'` (a failed result cannot
 * satisfy any goal — a mechanical entailment, not a semantic judgement);
 * `'succeeded'` is `'verified-against-basis'` only if the task has at
 * least one recorded goal-or-constraint AND at least one recorded known
 * to check against, otherwise `'insufficient-basis'`. This stage
 * deliberately does not execute or compose the selection, and does not
 * adapt or re-plan — those remain AWU-10's job.
 *
 * AWU-10 adds the tenth and final DoD stage, `'adaptation'`: given an
 * already-`'result-verification'` task, an explicit adaptation decision
 * (`'retry'` | `'re-plan'` | `'escalate'` | `'accept'`) is recorded for a
 * verification outcome that indicates the task did NOT succeed as
 * claimed. Reachable only when `verification.outcome` is
 * `'goals-not-met'` or `'insufficient-basis'` — the two outcomes that
 * mean the AWU-09 success claim is unmet or unsupported.
 * `'verified-against-basis'` (a supported success) and `'not-verifiable'`
 * (nothing has happened yet, so there is no failure to adapt to) are
 * deliberately excluded: neither is a case of "did not succeed as
 * claimed", and both throw if adaptation is attempted. As with AWU-08's
 * governance decision, Meta-Intelligence does not choose retry/re-plan/
 * escalate/accept on its own — the caller supplies it, and this stage
 * only records it, together with a verbatim, non-live snapshot of the
 * verification outcome it responds to (same pattern as AWU-08's
 * selection copy and AWU-09's basis-id snapshot). This stage
 * deliberately does NOT perform any real re-execution, re-composition,
 * or automatic retry of the AWU-07 selection — even a `'retry'` or
 * `'re-plan'` decision is representation only, not action — and it does
 * not loop the task back to an earlier stage (`'candidate-strategies'`,
 * `'strategy-evaluation'`, ...) for a live re-plan. `'adaptation'` is a
 * new forward-only terminal stage, exactly like every stage before it.
 *
 * `MetaIntelligenceStage` therefore has exactly ten members today,
 * completing the DoD pipeline listed above. Each later change to the
 * pipeline shape (if any) belongs in its own AWU, rather than being
 * pre-declared here as an unimplemented placeholder.
 */

import type {
  DecisionFlipPoint,
  DecisionScoreCriterion,
  DecisionScoreInput,
  DecisionScoreMatrix,
  DecisionScoreOutput,
  DecisionScoreRunOptions,
} from './contract.ts';


/** A Meta-Intelligence task's current position in the DoD pipeline above. */
export type MetaIntelligenceStage =
  | 'received'
  | 'understood'
  | 'goals-constraints'
  | 'epistemic-tracking'
  | 'capability-decomposition'
  | 'candidate-strategies'
  | 'strategy-evaluation'
  | 'action-governance'
  | 'result-verification'
  | 'adaptation';

/**
 * The caller's problem, kept verbatim (never rewritten or summarized)
 * so later AWUs — starting with AWU-02's normalization — can preserve
 * provenance by diffing "as given" against "as understood".
 */
export interface MetaIntelligenceProblem {
  /** The caller's own words. Not validated for structure beyond non-empty. */
  readonly statement: string;
  /** ISO-8601 timestamp of intake. */
  readonly receivedAt: string;
}

/**
 * AWU-02: the "Understand" stage's output. Deliberately mechanical, not
 * interpretive — collapsing incidental whitespace differences is not the
 * same claim as extracting goals, constraints, or meaning from the
 * problem (those are AWU-03+). `problem.statement` remains the source of
 * truth; this is a derived, disposable view of it, kept alongside rather
 * than in place of the verbatim statement (provenance preservation).
 */
export interface MetaIntelligenceUnderstanding {
  /** `problem.statement` with runs of whitespace collapsed to a single space. No other rewriting. */
  readonly normalizedStatement: string;
  /** ISO-8601 timestamp of normalization. */
  readonly understoodAt: string;
}

/**
 * Where a goal or constraint came from. `'caller'` means the caller stated
 * it verbatim (e.g. supplied directly in the request); `'extracted'` means
 * Meta-Intelligence derived it from the problem statement. Origins are
 * never merged: a `'caller'` item is never silently rewritten into an
 * `'extracted'` one or vice versa, and the two are tracked as distinct
 * items even if their text happens to coincide.
 */
export type MetaIntelligenceOrigin = 'caller' | 'extracted';

/**
 * A single goal or constraint attached to a task at the `'goals-constraints'`
 * stage. `text` is kept verbatim as given (for `'caller'`) or as derived
 * (for `'extracted'`) — this stage does not rewrite or normalize it.
 */
export interface MetaIntelligenceGoalOrConstraint {
  /** Stable id for this item, unique within its task. */
  readonly id: string;
  /** The goal/constraint text, verbatim per its origin. Non-empty after trimming. */
  readonly text: string;
  /** Where this item came from. See `MetaIntelligenceOrigin`. */
  readonly origin: MetaIntelligenceOrigin;
}

/**
 * AWU-03: the "Goals/Constraints" stage's output. Goals and constraints
 * are tracked as separate lists (a goal is not a constraint and vice
 * versa), each item individually tagged with its origin. This stage adds
 * no known/unknown/assumption/evidence tracking, capability
 * decomposition, or anything beyond recording these two lists.
 */
export interface MetaIntelligenceGoalsConstraints {
  readonly goals: readonly MetaIntelligenceGoalOrConstraint[];
  readonly constraints: readonly MetaIntelligenceGoalOrConstraint[];
  /** ISO-8601 timestamp of when goals/constraints were recorded. */
  readonly recordedAt: string;
}

/**
 * An epistemic item attached to a task at the `'epistemic-tracking'`
 * stage — a single known, unknown, assumption, or evidence entry. Which
 * of the four it is is determined by which list of
 * `MetaIntelligenceEpistemicTracking` it appears in (the same convention
 * `MetaIntelligenceGoalOrConstraint` uses for goals vs. constraints), not
 * by a field on the item itself. `origin` reuses `MetaIntelligenceOrigin`
 * so provenance is tracked identically to goals/constraints: a
 * `'caller'` item is never silently rewritten into an `'extracted'` one
 * or vice versa, and the two are kept as distinct items even if their
 * text happens to coincide.
 */
export interface MetaIntelligenceEpistemicItem {
  /** Stable id for this item, unique within its task. */
  readonly id: string;
  /** The item's text, verbatim per its origin. Non-empty after trimming. */
  readonly text: string;
  /** Where this item came from. See `MetaIntelligenceOrigin`. */
  readonly origin: MetaIntelligenceOrigin;
}

/**
 * AWU-04: the "Known/Unknown/Assumptions/Evidence" stage's output.
 * Knowns, unknowns, assumptions, and evidence are tracked as four
 * separate lists — a known is not an assumption and vice versa — each
 * item individually tagged with its origin. This stage adds no
 * capability decomposition, strategy generation/selection, execution,
 * verification, or adaptation.
 */
export interface MetaIntelligenceEpistemicTracking {
  readonly knowns: readonly MetaIntelligenceEpistemicItem[];
  readonly unknowns: readonly MetaIntelligenceEpistemicItem[];
  readonly assumptions: readonly MetaIntelligenceEpistemicItem[];
  readonly evidence: readonly MetaIntelligenceEpistemicItem[];
  /** ISO-8601 timestamp of when the epistemic state was recorded. */
  readonly recordedAt: string;
}

/**
 * A single required capability attached to a task at the
 * `'capability-decomposition'` stage. `capability` names a capability tag
 * exactly as `ModelCapability`/`CapabilityGraph` use it — this stage
 * does not invent its own capability vocabulary. `providers` and
 * `satisfied` are looked up from the `CapabilityGraph` passed to
 * `decomposeCapabilities()` at the moment it runs (a snapshot, not a
 * live reference): `providers` lists every model id the graph currently
 * says provides this capability (via `CapabilityGraph.providersOf()`),
 * and `satisfied` is `providers.length > 0`. A capability with no
 * provider is not rejected — that is precisely a capability gap (§1
 * capability gap detection), which this stage records rather than
 * treating as an error.
 */
export interface MetaIntelligenceCapabilityRequirement {
  /** Stable id for this item, unique within its task. */
  readonly id: string;
  /** The capability tag, verbatim per its origin. Non-empty after trimming. */
  readonly capability: string;
  /** Where this requirement came from. See `MetaIntelligenceOrigin`. */
  readonly origin: MetaIntelligenceOrigin;
  /** Model ids the CapabilityGraph reported as providing this capability, at decomposition time. */
  readonly providers: readonly string[];
  /** `true` iff `providers` is non-empty. */
  readonly satisfied: boolean;
}

/**
 * AWU-05: the "Capability Decomposition" stage's output. Each required
 * capability is checked against the existing `CapabilityGraph` rather
 * than against a parallel capability model invented for Meta-
 * Intelligence. `gaps` is the de-duplicated list of required
 * capabilities with no provider (`!satisfied`), in first-seen order —
 * the primitive later AWUs (candidate strategies, evaluation/selection)
 * will need to know what is missing before they can generate or choose
 * anything. This stage adds no strategy generation/selection, execution,
 * verification, or adaptation.
 */
export interface MetaIntelligenceCapabilityDecomposition {
  readonly requirements: readonly MetaIntelligenceCapabilityRequirement[];
  readonly gaps: readonly string[];
  /** ISO-8601 timestamp of when the capability decomposition was recorded. */
  readonly decomposedAt: string;
}

/**
 * A single candidate strategy recorded at the `'candidate-strategies'`
 * stage. Deliberately minimal and derived, not invented: each candidate
 * is exactly one AWU-05 capability requirement that has at least one
 * provider (`satisfied === true`), pointing back at it by
 * `requirementId` and carrying a copy of its `providers` — never a
 * parallel capability or provider model. A candidate covers ONE
 * requirement with the full provider list the graph reported; picking a
 * specific provider from that list is selection, which is AWU-07's job,
 * not this stage's. There is intentionally no score, rank, priority,
 * confidence, or `selected` field: candidates are unordered options
 * (array order is generation order, i.e. requirement order — not a
 * preference).
 */
export interface MetaIntelligenceCandidateStrategy {
  /** Stable id for this candidate, unique within its task (`'strategy-N'`). */
  readonly id: string;
  /** Id of the `MetaIntelligenceCapabilityRequirement` (AWU-05) this candidate is built from. */
  readonly requirementId: string;
  /** That requirement's capability tag, copied verbatim for readability. */
  readonly capability: string;
  /** Copy of that requirement's `providers` (model ids), at decomposition time. Never empty for a candidate. */
  readonly providers: readonly string[];
}

/**
 * AWU-06: the "Candidate Strategies" stage's output. One
 * `MetaIntelligenceCandidateStrategy` per satisfied requirement of the
 * task's `capabilityDecomposition`, in requirement order. Requirements
 * that are gaps (no provider) yield no candidate — they remain visible,
 * unchanged, as `capabilityDecomposition.gaps`. This stage adds no
 * evaluation, scoring, ranking, or selection, and no execution,
 * verification, or adaptation.
 */
export interface MetaIntelligenceCandidateStrategies {
  readonly candidates: readonly MetaIntelligenceCandidateStrategy[];
  /** ISO-8601 timestamp of when the candidates were generated. */
  readonly generatedAt: string;
}

/**
 * V2-B1: one component of a `MetaIntelligenceStrategy` — the requirement
 * it addresses, carried the same way `MetaIntelligenceCandidateStrategy`
 * already does. This is deliberately the same shape as
 * `MetaIntelligenceCandidateStrategy` minus its `id`: a strategy owns its
 * own id, and a component is not independently addressable outside the
 * strategy it belongs to.
 */
export interface MetaIntelligenceStrategyComponent {
  /** Id of the `MetaIntelligenceCapabilityRequirement` (AWU-05) this component addresses. */
  readonly requirementId: string;
  /** That requirement's capability tag, copied verbatim for readability. */
  readonly capability: string;
  /** Copy of that requirement's `providers`, at the moment this component was built. Never empty. */
  readonly providers: readonly string[];
}

/**
 * V2-B1: how many requirements a `MetaIntelligenceStrategy` composes.
 * Mechanically derived from `components.length` (`1` -> `'single-requirement'`,
 * `>1` -> `'composed'`) wherever this type is constructed — never a
 * caller-supplied or inferred judgement, consistent with this build's
 * established "no invented scores/labels" precedent (Law E). `0` is not
 * representable: a strategy with no components is not a strategy (see
 * `MetaIntelligenceStrategy.components`).
 */
export type MetaIntelligenceStrategyDerivation = 'single-requirement' | 'composed';

/**
 * V2-B1 (Phase B — Cognitive Strategy Engine): the data shape for a real
 * strategy, distinct from `MetaIntelligenceCandidateStrategy`. A V1/AWU-06
 * candidate is exactly one satisfied capability requirement aliased
 * one-for-one — this is the concrete gap V2-A1's readiness gate flagged as
 * G3 FAIL ("not real alternatives"). A `MetaIntelligenceStrategy` composes
 * one OR MORE requirement-derived `MetaIntelligenceStrategyComponent`s into
 * a single named approach, so a future generator (V2-B2) has a real shape
 * to build multi-capability strategies into instead of continuing to alias
 * requirements one-for-one. `components` is never empty — a strategy
 * addresses at least one requirement.
 *
 * This type is data-model-only as of V2-B1: nothing in
 * `MetaIntelligenceOrchestrator` constructs, stores, or returns one yet
 * (that is V2-B2's job), and `MetaIntelligenceTask`/`MetaIntelligenceStage`
 * are unchanged. There is intentionally no score, rank, priority,
 * confidence, or `selected` field here either — mirroring
 * `MetaIntelligenceCandidateStrategy`'s own "evaluation is a later stage's
 * job" convention (AWU-06/V2-A1 G3-G5). There is also no `origin` field:
 * per the existing candidate precedent, provenance stays on the referenced
 * requirement rather than being re-declared on the composing shape.
 */
export interface MetaIntelligenceStrategy {
  /** Stable id for this strategy, unique within the task that generated it (`'strategy-N'`, mirroring `MetaIntelligenceCandidateStrategy`'s id convention). */
  readonly id: string;
  /** One or more components this strategy composes. Never empty. */
  readonly components: readonly MetaIntelligenceStrategyComponent[];
  /** Mechanically derived from `components.length`. See `MetaIntelligenceStrategyDerivation`. */
  readonly derivation: MetaIntelligenceStrategyDerivation;
}

/**
 * V2-B2: the "Strategy Generation" output — a set of real
 * `MetaIntelligenceStrategy` values for a task, additive alongside (never
 * replacing) the frozen V1 `MetaIntelligenceCandidateStrategies`.
 * Deliberately the same shape as `MetaIntelligenceCandidateStrategies` (a
 * `readonly` list plus a `generatedAt` timestamp) for a consistent feel,
 * holding `MetaIntelligenceStrategy` values instead of
 * `MetaIntelligenceCandidateStrategy` values. See
 * `MetaIntelligenceOrchestrator.generateStrategies()` for how this is
 * produced -- as of V2-B2, one `'single-requirement'` strategy per
 * satisfied capability requirement, mirroring
 * `generateCandidateStrategies()`'s own satisfied-only rule. Composed,
 * multi-requirement strategies remain representable by the underlying
 * `MetaIntelligenceStrategy` type (V2-B1) but are not yet generated here
 * -- that is V2-B3's job.
 */
export interface MetaIntelligenceStrategies {
  readonly strategies: readonly MetaIntelligenceStrategy[];
  /** ISO-8601 timestamp of when the strategies were generated. */
  readonly generatedAt: string;
}

/**
 * V2-B3: the "Strategy Alternatives / Diversity" output -- real
 * alternative and/or composed `MetaIntelligenceStrategy` values, additive
 * alongside (never replacing) V2-B2's `strategies` field. Addresses
 * V2-A1's G3 FAIL finding ("candidates are not real alternatives") for
 * real, using only data that already varies at `'capability-decomposition'`
 * time -- nothing invented:
 *
 * - a `'single-requirement'` alternative strategy for every provider of a
 *   satisfied requirement BEYOND the first (a genuinely different
 *   provider satisfying the same capability is a real alternative, not a
 *   restatement of the requirement's own already-full provider list that
 *   V2-B2's `strategies` field already carries), and
 * - one `'composed'` strategy spanning every satisfied requirement of the
 *   task (one component per requirement, each carrying that requirement's
 *   full provider list), whenever two or more satisfied requirements
 *   exist -- a real multi-capability approach, not an invented heuristic.
 *
 * Same shape as `MetaIntelligenceStrategies` (a `readonly` list plus a
 * `generatedAt` timestamp) for a consistent feel. See
 * `MetaIntelligenceOrchestrator.generateStrategyAlternatives()`. Deliberately
 * a separate field/method from V2-B2's `generateStrategies()` rather than
 * an extension of it: `generateStrategies()`'s own single-requirement
 * output (one strategy per satisfied requirement, full provider list
 * copied verbatim) must stay byte-for-byte unchanged for the no-diversity
 * case, including for a requirement that happens to have more than one
 * provider -- that existing behavior is exactly what V2-B2's own tests
 * assert and must keep asserting. There is intentionally no score, rank,
 * priority, confidence, or `selected` field on any value here either --
 * evaluation/selection over these strategies remains V2-B4/B5's job.
 */
export interface MetaIntelligenceStrategyAlternatives {
  readonly strategies: readonly MetaIntelligenceStrategy[];
  /** ISO-8601 timestamp of when the alternatives were generated. */
  readonly generatedAt: string;
}

/** One Meta-Intelligence task, tracked from intake through (eventually) the full pipeline. */
export interface MetaIntelligenceTask {
  /** Stable id for this task, unique within one orchestrator instance. */
  readonly id: string;
  readonly problem: MetaIntelligenceProblem;
  readonly stage: MetaIntelligenceStage;
  /** Present once `understand()` has run (stage `'understood'` or later); absent at `'received'`. */
  readonly understanding?: MetaIntelligenceUnderstanding;
  /** Present once `addGoalsConstraints()` has run (stage `'goals-constraints'` or later); absent before then. */
  readonly goalsConstraints?: MetaIntelligenceGoalsConstraints;
  /** Present once `addEpistemicTracking()` has run (stage `'epistemic-tracking'` or later); absent before then. */
  readonly epistemicTracking?: MetaIntelligenceEpistemicTracking;
  /** Present once `decomposeCapabilities()` has run (stage `'capability-decomposition'` or later); absent before then. */
  readonly capabilityDecomposition?: MetaIntelligenceCapabilityDecomposition;
  /** Present once `generateCandidateStrategies()` has run (stage `'candidate-strategies'`); absent before then. */
  readonly candidateStrategies?: MetaIntelligenceCandidateStrategies;
  /**
   * Present once `generateStrategies()` has run (V2-B2); absent before
   * then. Additive alongside `candidateStrategies` -- does not replace
   * it, is not read or written by any V1 stage method, and does not gate
   * on or change `stage` (it is not one of `MetaIntelligenceStage`'s ten
   * pipeline stages).
   */
  readonly strategies?: MetaIntelligenceStrategies;
  /**
   * Present once `generateStrategyAlternatives()` has run (V2-B3); absent
   * before then. Additive alongside `strategies` -- does not replace it,
   * requires it to already be present, and does not gate on or change
   * `stage` (it is not one of `MetaIntelligenceStage`'s ten pipeline
   * stages).
   */
  readonly strategyAlternatives?: MetaIntelligenceStrategyAlternatives;
  /**
   * Present once `evaluateStrategyOptions()` has run (V2-B4); absent
   * before then. Additive alongside `strategies`/`strategyAlternatives`
   * -- does not replace either, requires `strategies` to already be
   * present, and does not gate on or change `stage` (it is not one of
   * `MetaIntelligenceStage`'s ten pipeline stages). Distinct from, and
   * never read/written by, the frozen V1 `strategyEvaluation` field
   * below, which continues to score `candidateStrategies` only.
   */
  readonly strategyOptionsEvaluation?: MetaIntelligenceStrategyOptionsEvaluation;
  /**
   * Present once `authorizeComposition()` has run (V2-C1); absent before
   * then. Additive alongside `strategyOptionsEvaluation` -- requires it to
   * already be present, does not replace or modify it, and does not gate
   * on or change `stage` (it is not one of `MetaIntelligenceStage`'s ten
   * pipeline stages). Distinct from, and never read/written by, the
   * frozen V1 `governance` field below, which continues to gate only
   * `strategyEvaluation.selection`.
   */
  readonly compositionBoundary?: MetaIntelligenceCompositionBoundary;
  /**
   * Present once `buildExecutionPlan()` has run (V2-C2); absent before
   * then. Additive alongside `compositionBoundary` -- requires it to
   * already be present with `decision === 'ACT'`, does not replace or
   * modify it, and does not gate on or change `stage` (it is not one of
   * `MetaIntelligenceStage`'s ten pipeline stages). Distinct from, and
   * never read/written by, `governAction()`/`MetaIntelligenceGovernance`
   * below, which continues to gate only the frozen V1
   * `strategyEvaluation.selection`.
   */
  readonly executionPlan?: MetaIntelligenceExecutionPlan;
  /**
   * V2-C4: present once `recordExecutionOutcome()` has run; absent
   * before then. Additive alongside `executionPlan` -- requires it to
   * already be present, does not replace or modify it, and does not
   * gate on or change `stage` (it is not one of `MetaIntelligenceStage`'s
   * ten pipeline stages). Reuses the frozen V1 `MetaIntelligenceResult`
   * shape verbatim (Law D, One Epistemic Language -- no new leaf data
   * shape): a claimed outcome's status/simulated/detail/timestamp are
   * exactly as meaningful for an `executionPlan`-authorized decision as
   * for a `governance`-authorized one. Distinct from, and never
   * read/written by, the frozen V1 `result` field below, which continues
   * to require `governance.decision` to be `'ACT'`/`'SIMULATE'`.
   */
  readonly executionResult?: MetaIntelligenceResult;
  /**
   * V2-C4: present once `recordExecutionOutcome()` has run, alongside
   * `executionResult`. Reuses the frozen V1 `MetaIntelligenceVerification`
   * shape verbatim (Law D): the same goal/constraint/known-basis check
   * `verifyResult()` already performs for the frozen V1 `result`/
   * `verification` pair applies unchanged here. Distinct from, and never
   * read/written by, the frozen V1 `verification` field below.
   */
  readonly executionVerification?: MetaIntelligenceVerification;
  /**
   * V2-C5: present once `recordExecutionAdaptation()` has run; absent
   * before then. Additive alongside `executionVerification` -- requires
   * it to already be present, does not replace or modify it, and does
   * not gate on or change `stage` (it is not one of `MetaIntelligenceStage`'s
   * ten pipeline stages). Reuses the frozen V1 `MetaIntelligenceAdaptation`
   * shape verbatim (Law D, One Epistemic Language -- no new leaf type at
   * all was needed for this field, the first V2 AWU to need neither a
   * new type nor even a new field shape): a caller's
   * retry/re-plan/escalate/accept response is exactly as meaningful for
   * an `executionVerification`-derived outcome as for the frozen V1
   * `verification` one. Distinct from, and never read/written by, the
   * frozen V1 `adaptation` field below, which continues to require
   * `task.stage === 'result-verification'`.
   */
  readonly executionAdaptation?: MetaIntelligenceAdaptation;
  /** Present once `evaluateStrategies()` has run (stage `'strategy-evaluation'`); absent before then. */
  readonly strategyEvaluation?: MetaIntelligenceStrategyEvaluation;
  /** Present once `governAction()` has run (stage `'action-governance'`); absent before then. */
  readonly governance?: MetaIntelligenceGovernance;
  /** Present once `recordResult()` has run (stage `'result-verification'`); absent before then. */
  readonly result?: MetaIntelligenceResult;
  /** Present once `recordResult()` has run (stage `'result-verification'`); absent before then. */
  readonly verification?: MetaIntelligenceVerification;
  /** Present once `recordAdaptation()` has run (stage `'adaptation'`); absent before then. */
  readonly adaptation?: MetaIntelligenceAdaptation;
}

/** Input to `MetaIntelligenceOrchestrator.intake()`. */
export interface MetaIntelligenceIntakeRequest {
  /** The problem statement, verbatim. Must be non-empty after trimming. */
  statement: string;
  /** Optional caller-supplied id. A stable generated id is used if omitted. */
  id?: string;
}

/** One goal/constraint item as supplied to `addGoalsConstraints()`, before an id is assigned. */
export interface MetaIntelligenceGoalOrConstraintInput {
  /** The goal/constraint text. Must be non-empty after trimming. */
  text: string;
  /** Where this item came from. See `MetaIntelligenceOrigin`. */
  origin: MetaIntelligenceOrigin;
}

/** Input to `MetaIntelligenceOrchestrator.addGoalsConstraints()`. */
export interface MetaIntelligenceGoalsConstraintsRequest {
  goals: MetaIntelligenceGoalOrConstraintInput[];
  constraints: MetaIntelligenceGoalOrConstraintInput[];
}

/** One known/unknown/assumption/evidence item as supplied to `addEpistemicTracking()`, before an id is assigned. */
export interface MetaIntelligenceEpistemicItemInput {
  /** The item's text. Must be non-empty after trimming. */
  text: string;
  /** Where this item came from. See `MetaIntelligenceOrigin`. */
  origin: MetaIntelligenceOrigin;
}

/** Input to `MetaIntelligenceOrchestrator.addEpistemicTracking()`. */
export interface MetaIntelligenceEpistemicTrackingRequest {
  knowns: MetaIntelligenceEpistemicItemInput[];
  unknowns: MetaIntelligenceEpistemicItemInput[];
  assumptions: MetaIntelligenceEpistemicItemInput[];
  evidence: MetaIntelligenceEpistemicItemInput[];
}

/** One required capability as supplied to `decomposeCapabilities()`, before an id/providers/satisfied are computed. */
export interface MetaIntelligenceCapabilityRequirementInput {
  /** The capability tag. Must be non-empty after trimming. Not validated against the graph — an unmet one is a gap, not an error. */
  capability: string;
  /** Where this requirement came from. See `MetaIntelligenceOrigin`. */
  origin: MetaIntelligenceOrigin;
}

/** Input to `MetaIntelligenceOrchestrator.decomposeCapabilities()`. */
export interface MetaIntelligenceCapabilityDecompositionRequest {
  requirements: MetaIntelligenceCapabilityRequirementInput[];
}

/**
 * Why no candidate was selected. Every value is an explicit, mechanical
 * outcome — never a silent default:
 * - `'no-candidates'`: AWU-06 produced no candidates (all requirements
 *   were gaps, or there were none), so there was nothing to score.
 * - `'tie-for-top'`: the two best candidates have (numerically) equal
 *   DecisionScore scores. Candidate array order is generation order, not
 *   a preference, so it is not used to break the tie.
 * - `'below-stability-threshold'`: the caller set `minStability` and the
 *   DecisionScore Decision Stability Index of the top candidate is below it.
 */
export type MetaIntelligenceNoSelectionReason = 'no-candidates' | 'tie-for-top' | 'below-stability-threshold';

/**
 * The recorded outcome of the evaluation: exactly one candidate
 * (`candidateId` always equals the `id` of a `MetaIntelligenceCandidateStrategy`
 * on the same task) or an explicit "none selected". A selection names a
 * candidate/strategy only; it does not pick one provider from that
 * candidate's `providers` list.
 */
export type MetaIntelligenceStrategySelection =
  | { readonly status: 'selected'; readonly candidateId: string }
  | { readonly status: 'none'; readonly reason: MetaIntelligenceNoSelectionReason };

/** One candidate's DecisionScore result. `candidateId` is the DecisionScore `optionId`. */
export interface MetaIntelligenceStrategyRankEntry {
  readonly candidateId: string;
  /** DecisionScore's normalized weighted score in [0, 1]; higher is better. */
  readonly score: number;
  /** DecisionScore's 1-based rank (ties keep candidate order; see `'tie-for-top'`). */
  readonly rank: number;
}

/**
 * AWU-07: the "Evaluation/Selection" stage's output. `criteria` and
 * `scores` are exactly what the caller supplied (restricted to the task's
 * candidates): Meta-Intelligence does not invent criteria, weights, or
 * per-candidate scores. `ranking`, `dsi`, and `dfp` come from the
 * DecisionScore scorer's output. With no candidates the scorer is not
 * called: `ranking` and `dfp` are empty and `dsi` is `null`. This stage
 * adds no execution, verification, or adaptation.
 */
export interface MetaIntelligenceStrategyEvaluation {
  readonly criteria: readonly DecisionScoreCriterion[];
  /** `scores[candidateId][criterionId]`, as supplied by the caller. */
  readonly scores: DecisionScoreMatrix;
  /** Best-first, one entry per candidate. Empty iff there were no candidates. */
  readonly ranking: readonly MetaIntelligenceStrategyRankEntry[];
  /** DecisionScore's Decision Stability Index of the ranking, or `null` if nothing was scored. */
  readonly dsi: number | null;
  /** DecisionScore's Decision Flip Points, unchanged. */
  readonly dfp: readonly DecisionFlipPoint[];
  /** The caller's stability threshold, or `null` if none was set. */
  readonly minStability: number | null;
  readonly selection: MetaIntelligenceStrategySelection;
  /** ISO-8601 timestamp of when the evaluation was recorded. */
  readonly evaluatedAt: string;
}

/**
 * The scoring function `evaluateStrategies()` calls. Its shape is exactly
 * the DecisionScore pipeline (validate -> weighted-sum rank -> DSI -> DFP)
 * over `DecisionScoreInput`/`DecisionScoreOutput`. In MAGENAIS-main a
 * default backed by the real DecisionScore functions is provided
 * (`scoreWithDecisionScore`); the standalone package has no such default
 * and the caller must pass one.
 */
export type MetaIntelligenceStrategyScorer = (
  input: DecisionScoreInput,
  options?: DecisionScoreRunOptions
) => DecisionScoreOutput;

/** Input to `MetaIntelligenceOrchestrator.evaluateStrategies()`. */
export interface MetaIntelligenceStrategyEvaluationRequest {
  /** DecisionScore criteria (weights + directions). Required and caller-supplied when there are candidates. */
  criteria: DecisionScoreCriterion[];
  /** `scores[candidateId][criterionId]` for every candidate and criterion. */
  scores: DecisionScoreMatrix;
  /** Optional threshold in [0, 1]: select nothing if the top candidate's DSI is below it. */
  minStability?: number;
  /** Optional DecisionScore run options (trials, seed, ...), passed through unchanged. */
  scorerOptions?: DecisionScoreRunOptions;
}

/**
 * V2-B4: one strategy option's DecisionScore result, over the combined
 * option set `task.strategies.strategies` + (if present)
 * `task.strategyAlternatives.strategies`. `strategyId` is the
 * DecisionScore `optionId`, mirroring
 * `MetaIntelligenceStrategyRankEntry.candidateId`'s own convention on the
 * frozen V1 surface (this is a separate, parallel type, not a rename of
 * it -- see `MetaIntelligenceStrategyOptionsEvaluation`).
 */
export interface MetaIntelligenceStrategyOptionRankEntry {
  readonly strategyId: string;
  readonly score: number;
  readonly rank: number;
}

/**
 * V2-B4: the recorded outcome of `evaluateStrategyOptions()` -- exactly
 * one strategy (`strategyId` always equals the `id` of a
 * `MetaIntelligenceStrategy` present in the evaluated option set) or an
 * explicit "none selected". Reuses `MetaIntelligenceNoSelectionReason`
 * as-is (Law D, One Epistemic Language): the three reasons ("no
 * candidates to score", "tie for top", "below the caller's stability
 * threshold") are exactly as applicable to strategy options as to V1
 * candidates: introducing a parallel reason type would restate the same
 * three mechanical outcomes under new names for no measurable benefit.
 */
export type MetaIntelligenceStrategyOptionSelection =
  | { readonly status: 'selected'; readonly strategyId: string }
  | { readonly status: 'none'; readonly reason: MetaIntelligenceNoSelectionReason };

/**
 * V2-B4 (Phase B -- Cognitive Strategy Engine): the "Strategy Evaluation"
 * output over real `MetaIntelligenceStrategy` values (V2-B1..B3) --
 * additive alongside, and never touching, the frozen V1
 * `MetaIntelligenceStrategyEvaluation` surface, which continues to score
 * `candidateStrategies` only.
 *
 * V2-A1's G5 FAIL finding was that DecisionScore criteria are fully
 * caller-supplied/generic, with no risk/cost/evidence/resource dimension
 * the component itself reasons about. Per Law D and Law G (80/20
 * filter), this AWU did not invent a new criterion shape for that: a
 * caller can already express a risk or cost dimension as a
 * `DecisionScoreCriterion` with `direction: 'minimize'`, and an evidence
 * or resource dimension with `direction: 'maximize'`, scored per option
 * in the existing `DecisionScoreMatrix` -- exactly what
 * `evaluateStrategyOptions()` accepts unchanged via the reused
 * `MetaIntelligenceStrategyEvaluationRequest` shape (its `criteria` /
 * `scores` members were already fully generic, never
 * `candidateStrategies`-specific). See `.mi/DECISIONS.jsonl` for the
 * full assessment. The genuine gap this type/method closes is
 * structural, not a criterion shape: `evaluateStrategies()` can only
 * ever score `candidateStrategies` (gated to the `'candidate-strategies'`
 * stage) -- it has no path to score `MetaIntelligenceStrategy` /
 * `MetaIntelligenceStrategyAlternatives` values at all, so a real
 * multi-requirement `'composed'` strategy (V2-B3) could never be
 * risk/cost/evidence/resource-evaluated until now. There is intentionally
 * no new criterion/matrix type here, mirroring `MetaIntelligenceStrategy`'s
 * own "no invented scores" precedent one level up: only the evaluation
 * *output* shape is new (`strategyId` in place of `candidateId`), never
 * the criterion/scoring vocabulary.
 */
export interface MetaIntelligenceStrategyOptionsEvaluation {
  readonly criteria: readonly DecisionScoreCriterion[];
  /** `scores[strategyId][criterionId]`, as supplied by the caller. */
  readonly scores: DecisionScoreMatrix;
  /** Best-first, one entry per evaluated strategy option. Empty iff there were no options. */
  readonly ranking: readonly MetaIntelligenceStrategyOptionRankEntry[];
  /** DecisionScore's Decision Stability Index of the ranking, or `null` if nothing was scored. */
  readonly dsi: number | null;
  /** DecisionScore's Decision Flip Points, unchanged. */
  readonly dfp: readonly DecisionFlipPoint[];
  /** The caller's stability threshold, or `null` if none was set. */
  readonly minStability: number | null;
  readonly selection: MetaIntelligenceStrategyOptionSelection;
  /** ISO-8601 timestamp of when this evaluation was recorded. */
  readonly evaluatedAt: string;
}

/**
 * AWU-08's action-governance boundary. `'ACT'` authorizes going on to use
 * the AWU-07 selection (execution/composition — not implemented until a
 * later AWU); `'WAIT'` defers the decision without rejecting it;
 * `'ASK'` defers to a human/caller for explicit confirmation; `'SIMULATE'`
 * authorizes a dry-run/simulated use of the selection only, not a real
 * one. Meta-Intelligence does not choose among these on its own — the
 * caller supplies the intended decision and `governAction()` only
 * enforces the one hard rule below; it never invents a decision.
 */
export type MetaIntelligenceGovernanceDecision = 'ACT' | 'WAIT' | 'ASK' | 'SIMULATE';

/**
 * AWU-08: the "Action Governance" stage's output. `decision` is exactly
 * what the caller requested in `MetaIntelligenceGovernanceRequest`,
 * except that `'ACT'` is never recorded unless `selection.status ===
 * 'selected'` (see `governAction()` for the rejection this implies).
 * `selection` is a verbatim copy of `strategyEvaluation.selection` at the
 * moment governance ran — not a live reference — so the decision remains
 * traceable to exactly the AWU-07 outcome it gated even if later state
 * changes. This stage records a decision only: it does not execute,
 * compose, verify, or adapt/re-plan anything.
 */
export interface MetaIntelligenceGovernance {
  readonly decision: MetaIntelligenceGovernanceDecision;
  /** Copy of `strategyEvaluation.selection` at the moment this decision was recorded. */
  readonly selection: MetaIntelligenceStrategySelection;
  /** Caller-supplied rationale, verbatim (trimmed), or `null` if none was given. */
  readonly reason: string | null;
  /** ISO-8601 timestamp of when the governance decision was recorded. */
  readonly governedAt: string;
}

/** Input to `MetaIntelligenceOrchestrator.governAction()`. */
export interface MetaIntelligenceGovernanceRequest {
  /** The caller's requested governance decision. Must be one of `MetaIntelligenceGovernanceDecision`'s four values. */
  decision: MetaIntelligenceGovernanceDecision;
  /** Optional caller-supplied rationale, recorded verbatim (trimmed). */
  reason?: string;
}

/**
 * V2-C1 (Phase C -- Closed-Loop Cognition): the "Cognitive Composition
 * boundary" -- the smallest additive, contract-level boundary that lets a
 * caller take an already-`evaluateStrategyOptions()`'d task's
 * `strategyOptionsEvaluation.selection` (V2-B4/B5) and describe how the
 * selected strategy would be composed/executed, without a real execution
 * runtime, an execution-plan representation (V2-C2), a cognitive trace
 * (V2-C3), or verification/outcome analysis (V2-C4).
 *
 * Per `.mi/DECISIONS.jsonl`: this AWU assessed, and rejected, treating the
 * existing `MetaIntelligenceStrategyComponent` shape plus `selection` as
 * already-sufficient as-is. `selection` names only a `strategyId` (or
 * `'none'`); it does not itself carry that strategy's `components` --
 * resolving a `strategyId` back into a concrete, composable component list
 * requires re-searching `task.strategies`/`task.strategyAlternatives`,
 * which is real, missing behavior, not a restatement. Reusing
 * `MetaIntelligenceGovernanceDecision`'s four ACT/WAIT/ASK/SIMULATE values
 * (Law D, One Epistemic Language) closes the second, explicitly-deferred
 * V2-B5 gap: `strategyOptionsEvaluation.selection` alone provides no
 * boundary distinguishing "this strategy is now authorized to be
 * composed" from "this strategy was merely selected" -- any caller could
 * already read any strategy's `components` regardless of whether
 * `evaluateStrategyOptions()` ever ran or what it selected. This type is
 * the first genuine, additive answer to both gaps together: a single,
 * immutable snapshot binding a specific evaluated `selection` to (when
 * selected) its resolved `components`, gated by an explicit,
 * caller-supplied composition decision -- mirroring `governAction()`'s
 * own "caller decides, this only records" mechanics over `strategyId`
 * instead of `candidateId`, and deliberately NOT reusing or modifying
 * `MetaIntelligenceGovernance`/`governAction()` (which continues to gate
 * only the frozen V1 `strategyEvaluation.selection`).
 *
 * There is intentionally no ordering/dependency field beyond `components`'
 * own array order: no real per-component dependency data exists anywhere
 * upstream (capability requirements carry no such relationship), so
 * inventing one here would be an unverified assumption (Law E, Evidence
 * Honesty) rather than a real capability. Array order, copied verbatim
 * from the resolved strategy, is the only ordering this build can honestly
 * claim.
 */
export interface MetaIntelligenceCompositionBoundary {
  /** The caller's requested composition decision. Reuses `MetaIntelligenceGovernanceDecision`'s four values (Law D) -- never a fifth, invented value. */
  readonly decision: MetaIntelligenceGovernanceDecision;
  /** Verbatim copy of `strategyOptionsEvaluation.selection` at the moment this boundary was recorded -- not a live reference, so it stays traceable even if later state changes. */
  readonly selection: MetaIntelligenceStrategyOptionSelection;
  /**
   * The selected strategy's `components`, resolved from
   * `task.strategies`/`task.strategyAlternatives` and copied verbatim, in
   * the same order the strategy itself declares them -- this is the
   * "describe how it would be composed" contract. `null` when `selection`
   * is `{ status: 'none' }`: there is no strategy to describe composing.
   */
  readonly components: readonly MetaIntelligenceStrategyComponent[] | null;
  /** Caller-supplied rationale, verbatim (trimmed), or `null` if none was given. */
  readonly reason: string | null;
  /** ISO-8601 timestamp of when this composition boundary was recorded. */
  readonly boundAt: string;
}

/** Input to `MetaIntelligenceOrchestrator.authorizeComposition()`. */
export interface MetaIntelligenceCompositionBoundaryRequest {
  /** The caller's requested composition decision. Must be one of `MetaIntelligenceGovernanceDecision`'s four values. */
  decision: MetaIntelligenceGovernanceDecision;
  /** Optional caller-supplied rationale, recorded verbatim (trimmed). */
  reason?: string;
}

/**
 * V2-C2 (Phase C -- Closed-Loop Cognition): the "Execution Plan"
 * representation -- the smallest additive representation of what
 * executing an already-`'ACT'`-authorized `MetaIntelligenceCompositionBoundary`'s
 * components would look like, without a real execution runtime, a
 * cognitive trace (V2-C3), or verification/outcome analysis (V2-C4).
 *
 * Per `.mi/DECISIONS.jsonl`: this AWU assessed, and rejected, treating
 * `compositionBoundary.components` as already sufficient as an execution
 * plan. `components` (V2-C1) is populated for ANY composition decision
 * over a `'selected'` strategy option -- `'WAIT'`/`'ASK'`/`'SIMULATE'`
 * included -- because it is a descriptive answer to "what would composing
 * this strategy look like", not an authorization to actually treat it as
 * a plan. The real, structural gap is existence-gating: a plan a caller
 * could hand to a (future, still-nonexistent) executor must only be
 * representable once the boundary's `decision` is actually `'ACT'` --
 * unlike `components`, which is deliberately inspectable under
 * `'WAIT'`/`'ASK'`/`'SIMULATE'` too. This type closes exactly that one
 * gap and nothing else.
 *
 * `steps` is a verbatim, order-preserving copy of
 * `compositionBoundary.components` -- the same `MetaIntelligenceStrategyComponent`
 * shape (Law D, One Epistemic Language: no new leaf data shape), so each
 * step still names only a capability requirement + its providers (Law C,
 * Contract Over Implementation Dependency -- a step never names another
 * model's implementation directly). There is intentionally no explicit
 * per-step ordinal, status, or dependency field: array order already
 * equals `components`' own order (an explicit ordinal would restate the
 * index for zero new expressive power, Law G), and no real per-component
 * lifecycle or dependency data exists anywhere upstream to represent
 * honestly (Law E, Evidence Honesty) -- real status/lifecycle tracking of
 * an in-progress execution is a cognitive trace's job (V2-C3), not this
 * one's.
 */
export interface MetaIntelligenceExecutionPlan {
  /** Verbatim, order-preserving copy of the 'ACT'-authorized `compositionBoundary.components`. Never empty (mirrors `MetaIntelligenceStrategy.components`'s own non-empty invariant, since an 'ACT' boundary requires a 'selected' strategy). */
  readonly steps: readonly MetaIntelligenceStrategyComponent[];
  /** ISO-8601 timestamp of when this execution plan was derived. */
  readonly derivedAt: string;
}

/**
 * V2-C3 (Phase C -- Closed-Loop Cognition): one entry in a
 * `MetaIntelligenceCognitiveTrace` -- a single `MetaIntelligenceTask`
 * field the task has actually reached, summarized uniformly regardless
 * of that field's own shape or its own timestamp field's name.
 *
 * Per `.mi/DECISIONS.jsonl`: every one of `MetaIntelligenceTask`'s
 * fields already carries its own ISO-8601 timestamp, but under a
 * different name on almost every type (`receivedAt` / `understoodAt` /
 * `recordedAt` (two different types) / `decomposedAt` / `generatedAt`
 * (three types) / `evaluatedAt` (two types) / `governedAt` / `boundAt` /
 * `derivedAt` / `verifiedAt` / `adaptedAt`) -- so a caller wanting "the
 * reasoning path in timestamp order" would first need to know every
 * field's name AND its own timestamp field's name, and would still have
 * no uniform place to find which id (a selected candidate/strategy, a
 * recorded requirement/goal/constraint/epistemic item) that field's
 * content actually names. `recordedAt` and `idsTouched` below are that
 * one genuine, additive normalization -- never a newly-invented fact:
 * `recordedAt` is always copied verbatim from the underlying field's own
 * timestamp (Law D, One Epistemic Language -- no parallel logging
 * system, no freshly-generated per-entry timestamp), and `idsTouched` is
 * always read from ids the field's own recorded content already lists
 * or selects (Law E, Evidence Honesty -- never invented; empty for a
 * field with no id-bearing content, such as `problem`, `understanding`,
 * `result`, or `adaptation`).
 */
export interface MetaIntelligenceCognitiveTraceEntry {
  /**
   * Name of the `MetaIntelligenceTask` field this entry summarizes --
   * one of `'problem'`, `'understanding'`, `'goalsConstraints'`,
   * `'epistemicTracking'`, `'capabilityDecomposition'`,
   * `'candidateStrategies'`, `'strategies'`, `'strategyAlternatives'`,
   * `'strategyEvaluation'`, `'strategyOptionsEvaluation'`,
   * `'governance'`, `'compositionBoundary'`, `'executionPlan'`,
   * `'executionResult'`, `'executionVerification'` (V2-C5: wired in by
   * `getCognitiveTrace()` alongside the V2-C4 fields they summarize),
   * `'executionAdaptation'` (V2-D1 housekeeping: wired in by
   * `getCognitiveTrace()` alongside the V2-C5 field it summarizes --
   * see `MetaIntelligenceCognitiveTrace`'s own doc comment), `'result'`,
   * `'verification'`, `'adaptation'`.
   */
  readonly field: string;
  /** That field's own recorded timestamp, copied verbatim -- never a newly-generated one. */
  readonly recordedAt: string;
  /**
   * Ids the field's own recorded content actually names (e.g. a
   * selected candidateId/strategyId, or goal/constraint/epistemic-item/
   * requirement/candidate/strategy ids it lists) -- never invented.
   * Empty when the field records no id-bearing content, or when its
   * selection is `{ status: 'none' }`.
   */
  readonly idsTouched: readonly string[];
}

/**
 * V2-C3 (Phase C -- Closed-Loop Cognition): the "Cognitive Trace" -- the
 * smallest additive, reproducible record of the reasoning path a task
 * has actually taken so far, without a real execution runtime or
 * verification/outcome analysis beyond what V1's own `recordResult()`
 * already computes (further verification/outcome analysis is V2-C4's
 * job, not this one's).
 *
 * Purely derived and never stored on `MetaIntelligenceTask` itself --
 * mirroring `MetaIntelligenceProblemRepresentation`'s (V2-A2) read-only-
 * view precedent, not `MetaIntelligenceCompositionBoundary`'s/
 * `MetaIntelligenceExecutionPlan`'s record-once-and-store convention.
 * `getCognitiveTrace()` composed all sixteen of `MetaIntelligenceTask`'s
 * fields as of V2-C3 (versus `getProblemRepresentation()`'s four), since a
 * reasoning-path record that stopped at `epistemicTracking` would miss
 * every V2-B/V2-C addition and the frozen V1
 * `candidateStrategies`/`strategyEvaluation`/`governance`/`result`/
 * `verification`/`adaptation` surface entirely. V2-C4 added two more
 * fields (`executionResult`/`executionVerification`) but, per its own
 * `.mi/NEXT.json`, deliberately froze `getCognitiveTrace()` for that AWU
 * without wiring them in; V2-C5 closed that gap as pure housekeeping,
 * bringing the composed total to eighteen. V2-C5 also added a nineteenth
 * field, `executionAdaptation`, which it deliberately left uncomposed
 * here -- extending `getCognitiveTrace()` to cover a field the same AWU
 * that introduces it also just added would have been indistinguishable
 * from designing the field's trace representation before any caller had
 * ever populated it. V2-D1 closes that gap as the same kind of one-AWU-
 * later housekeeping, bringing the composed total to nineteen.
 *
 * Available at ANY point in a task's life -- unlike `buildExecutionPlan()`
 * (V2-C2), which is deliberately gated to an `'ACT'`-authorized
 * `compositionBoundary`, a trace has no "not yet authorized to inspect"
 * concern to enforce: a partial trace of a task that has only reached
 * `'understood'` is itself a legitimate, honest answer to "what
 * reasoning has this task done so far", not a premature one.
 */
export interface MetaIntelligenceCognitiveTrace {
  /** Id of the `MetaIntelligenceTask` this trace was derived from. */
  readonly taskId: string;
  /** Copy of the task's `stage` at the moment this trace was derived. */
  readonly stage: MetaIntelligenceStage;
  /** One entry per task field the task has reached so far, in fixed pipeline order (`'problem'` always first and always present). */
  readonly entries: readonly MetaIntelligenceCognitiveTraceEntry[];
  /** ISO-8601 timestamp of when this read-only trace was derived (not when any underlying field was recorded). */
  readonly derivedAt: string;
}

/**
 * The caller's claim about what happened to a governed decision.
 * `'not-yet-executed'` means exactly that — no real execution has
 * happened (this stage never performs one); `'succeeded'` / `'failed'`
 * are the caller's own report of an outcome that occurred elsewhere.
 * Meta-Intelligence records this claim; it does not generate, infer, or
 * verify-then-overwrite it.
 */
export type MetaIntelligenceResultStatus = 'succeeded' | 'failed' | 'not-yet-executed';

/**
 * AWU-09: the result half of the "Result" stage's output, for an
 * already-`'action-governance'` task whose `governance.decision` is
 * `'ACT'` or `'SIMULATE'`. `status` is exactly the caller's claim (see
 * `MetaIntelligenceResultStatus`); `simulated` is NOT caller-supplied —
 * it is mechanically derived from `governance.decision` at the moment
 * `recordResult()` runs (`true` iff `'SIMULATE'`), so a caller can never
 * claim a `'SIMULATE'`-gated result was real, or an `'ACT'`-gated one was
 * merely simulated. This stage never executes or composes anything
 * itself — recording a claimed outcome is not carrying one out.
 */
export interface MetaIntelligenceResult {
  readonly status: MetaIntelligenceResultStatus;
  /** `true` iff the governing decision was `'SIMULATE'`; `false` iff `'ACT'`. Derived, never caller-supplied. */
  readonly simulated: boolean;
  /** Caller-supplied detail, verbatim (trimmed), or `null` if none was given. */
  readonly detail: string | null;
  /** ISO-8601 timestamp of when the result was recorded. */
  readonly recordedAt: string;
}

/** Input to `MetaIntelligenceOrchestrator.recordResult()`. */
export interface MetaIntelligenceResultRequest {
  /** The caller's claimed outcome. Must be one of `MetaIntelligenceResultStatus`'s three values. */
  status: MetaIntelligenceResultStatus;
  /** Optional caller-supplied detail, recorded verbatim (trimmed). */
  detail?: string;
}

/**
 * The mechanical verification outcome for a recorded result, computed by
 * `recordResult()` — never a bare "verified" claim with no stated basis:
 * - `'not-verifiable'`: `result.status === 'not-yet-executed'` — nothing
 *   has happened yet, so there is nothing to check.
 * - `'goals-not-met'`: `result.status === 'failed'` — a failed result
 *   cannot satisfy any goal. A mechanical entailment of "failed", not a
 *   semantic judgement about *why* it failed.
 * - `'insufficient-basis'`: `result.status === 'succeeded'` but the task
 *   has no recorded AWU-03 goal-or-constraint, or no recorded AWU-04
 *   known, to check the claim against.
 * - `'verified-against-basis'`: `result.status === 'succeeded'` AND the
 *   task has at least one recorded goal-or-constraint AND at least one
 *   recorded known (see `goalIds`/`constraintIds`/`knownIds` for exactly
 *   which). This checks that a basis exists and is recorded, not that
 *   the claimed success is independently confirmed true — Meta-
 *   Intelligence does not execute anything, so it cannot confirm that.
 */
export type MetaIntelligenceVerificationOutcome =
  | 'not-verifiable'
  | 'goals-not-met'
  | 'insufficient-basis'
  | 'verified-against-basis';

/**
 * AWU-09: the verification half of the "Verification" stage's output,
 * recorded by `recordResult()` alongside `MetaIntelligenceResult`. `goalIds`
 * / `constraintIds` / `knownIds` are a snapshot of the task's AWU-03/AWU-04
 * ids at verification time (not live references) — the exact basis
 * `outcome` was checked against, so the outcome stays traceable.
 */
export interface MetaIntelligenceVerification {
  readonly outcome: MetaIntelligenceVerificationOutcome;
  /** Ids of `goalsConstraints.goals` present on the task at verification time. */
  readonly goalIds: readonly string[];
  /** Ids of `goalsConstraints.constraints` present on the task at verification time. */
  readonly constraintIds: readonly string[];
  /** Ids of `epistemicTracking.knowns` present on the task at verification time. */
  readonly knownIds: readonly string[];
  /** ISO-8601 timestamp of when the verification was recorded. Equal to the sibling `MetaIntelligenceResult.recordedAt`. */
  readonly verifiedAt: string;
}

/**
 * The verification outcomes for which an adaptation decision is
 * representable — see `MetaIntelligenceAdaptation` and
 * `recordAdaptation()`. Exactly the two outcomes that mean the AWU-09
 * success claim was unmet or unsupported (`'goals-not-met'` /
 * `'insufficient-basis'`); `'verified-against-basis'` and
 * `'not-verifiable'` are excluded (see `types.ts`'s AWU-10 header note
 * for why) and their task's `recordAdaptation()` call throws
 * `MetaIntelligenceAdaptationNotRepresentableError`.
 */
export type MetaIntelligenceAdaptableVerificationOutcome = 'goals-not-met' | 'insufficient-basis';

/**
 * AWU-10's caller-chosen response to a verification outcome that
 * indicates the task did not succeed as claimed. Meta-Intelligence does
 * not choose among these on its own — the caller supplies the intended
 * decision and `recordAdaptation()` only records it, mirroring AWU-08's
 * `MetaIntelligenceGovernanceDecision` pattern:
 * - `'retry'`: try the same AWU-07 selection again (not performed here).
 * - `'re-plan'`: go back to an earlier stage for a new strategy (not
 *   performed here — this stage never actually loops the task back).
 * - `'escalate'`: hand the task to a human/caller for a decision this
 *   stage cannot make.
 * - `'accept'`: accept the outcome as final, with no further action.
 */
export type MetaIntelligenceAdaptationDecision = 'retry' | 're-plan' | 'escalate' | 'accept';

/**
 * AWU-10: the "Adaptation/Re-plan" stage's output, for an already-
 * `'result-verification'` task whose `verification.outcome` is
 * `'goals-not-met'` or `'insufficient-basis'`. `decision` is exactly the
 * caller's `MetaIntelligenceAdaptationRequest.decision`; `outcome` is a
 * verbatim copy of `verification.outcome` at the moment
 * `recordAdaptation()` ran — not a live reference — so the decision stays
 * traceable to exactly the AWU-09 outcome it responds to even if later
 * state changes (mirrors `MetaIntelligenceGovernance.selection`'s and
 * `MetaIntelligenceVerification`'s own snapshot-not-reference pattern).
 * This stage never executes, composes, re-executes, or automatically
 * retries anything itself — recording the decision is not carrying it
 * out.
 */
export interface MetaIntelligenceAdaptation {
  readonly decision: MetaIntelligenceAdaptationDecision;
  /** Copy of `verification.outcome` at the moment this decision was recorded. */
  readonly outcome: MetaIntelligenceAdaptableVerificationOutcome;
  /** Caller-supplied rationale, verbatim (trimmed), or `null` if none was given. */
  readonly reason: string | null;
  /** ISO-8601 timestamp of when the adaptation decision was recorded. */
  readonly adaptedAt: string;
}

/** Input to `MetaIntelligenceOrchestrator.recordAdaptation()`. */
export interface MetaIntelligenceAdaptationRequest {
  /** The caller's chosen response. Must be one of `MetaIntelligenceAdaptationDecision`'s four values. */
  decision: MetaIntelligenceAdaptationDecision;
  /** Optional caller-supplied rationale, recorded verbatim (trimmed). */
  reason?: string;
}

/**
 * V2-A2: an explicit presence wrapper used only by
 * `MetaIntelligenceProblemRepresentation`. A task field that has not yet
 * been recorded (the task has not advanced past the stage that produces
 * it) is `{ present: false }` — never silently collapsed to an empty
 * object/array shape of the underlying type, which would be
 * indistinguishable from "recorded, but empty" (e.g. `addGoalsConstraints()`
 * called with `{ goals: [], constraints: [] }`). `present: true` carries
 * the underlying value unchanged, verbatim from `MetaIntelligenceTask`.
 */
export type MetaIntelligencePresence<T> =
  | { readonly present: true; readonly value: T }
  | { readonly present: false };

/**
 * V2-A2 (Phase A — V1 Exit + V2 Foundation): a structured, read-only
 * Problem Representation composing the V1 fields that already describe a
 * task's problem/understanding/goals-constraints/epistemic state
 * (`MetaIntelligenceTask.problem` / `.understanding` / `.goalsConstraints`
 * / `.epistemicTracking`) into one view. This is purely derived — it adds
 * no new data, computes nothing beyond copying existing fields, and does
 * not change `MetaIntelligenceTask`, `MetaIntelligenceStage`, or any
 * existing stage method. Its only reason to exist is to answer "what do
 * we currently know about the problem?" in one call without hand-picking
 * four optional task fields, while staying honest (via
 * `MetaIntelligencePresence`) about which of them the task has not
 * reached yet, per `MetaIntelligenceOrchestrator.getProblemRepresentation()`.
 *
 * `problem` has no presence wrapper: it is recorded unconditionally by
 * `intake()` at the `'received'` stage, so it is never absent for any
 * task that exists at all.
 */
export interface MetaIntelligenceProblemRepresentation {
  /** Id of the `MetaIntelligenceTask` this view was derived from. */
  readonly taskId: string;
  /** Copy of the task's `stage` at the moment this view was derived. */
  readonly stage: MetaIntelligenceStage;
  /** Always present: verbatim copy of `MetaIntelligenceTask.problem`. */
  readonly problem: MetaIntelligenceProblem;
  /** Present once `understand()` has run (stage `'understood'` or later); explicit absence before then. */
  readonly understanding: MetaIntelligencePresence<MetaIntelligenceUnderstanding>;
  /** Present once `addGoalsConstraints()` has run (stage `'goals-constraints'` or later); explicit absence before then. */
  readonly goalsConstraints: MetaIntelligencePresence<MetaIntelligenceGoalsConstraints>;
  /** Present once `addEpistemicTracking()` has run (stage `'epistemic-tracking'` or later); explicit absence before then. */
  readonly epistemicTracking: MetaIntelligencePresence<MetaIntelligenceEpistemicTracking>;
  /** ISO-8601 timestamp of when this read-only view was derived (not when any underlying field was recorded). */
  readonly derivedAt: string;
}
