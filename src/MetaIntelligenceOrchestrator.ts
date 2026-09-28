/**
 * MetaIntelligenceOrchestrator.ts
 *
 * AWU-01 made this the thin orchestrator called for by the build prompt:
 * intake only, recording a caller's problem statement at the `'received'`
 * stage. AWU-02 added `understand()`: a mechanical normalization step
 * that advances a task to `'understood'` without rewriting or
 * interpreting the original statement. AWU-03 added
 * `addGoalsConstraints()`: records the caller's goals and constraints
 * (each tagged `'caller'` or `'extracted'`) and advances a task to
 * `'goals-constraints'` (see `types.ts`). AWU-04 adds
 * `addEpistemicTracking()`: records the caller's knowns, unknowns,
 * assumptions, and evidence (each tagged `'caller'` or `'extracted'`,
 * same as goals/constraints) and advances a task to
 * `'epistemic-tracking'`. AWU-05 adds `decomposeCapabilities()`: checks a
 * caller-supplied list of required capabilities (each tagged `'caller'`
 * or `'extracted'`, same convention again) against an existing
 * `CapabilityGraph` passed in by the caller, records which capabilities
 * have a provider and which are gaps, and advances a task to
 * `'capability-decomposition'`. AWU-06 adds
 * `generateCandidateStrategies()`: builds a minimal, non-selecting set of
 * candidate strategies (one per satisfied requirement) from the
 * decomposition already on the task and advances it to
 * `'candidate-strategies'`. AWU-07 adds `evaluateStrategies()`: scores those
 * candidates with the existing DecisionScore pipeline, records an explicit
 * selection (one candidate id, or an explicit 'none selected' with a
 * reason), and advances a task to `'strategy-evaluation'`. AWU-08 adds
 * `governAction()`: records an explicit, caller-supplied ACT/WAIT/ASK/
 * SIMULATE governance decision against an already-`'strategy-evaluation'`
 * task, mechanically rejecting `'ACT'` unless AWU-07 actually selected a
 * candidate, and advances a task to `'action-governance'`. AWU-09 adds
 * `recordResult()`: records the caller's claimed outcome
 * (succeeded/failed/not-yet-executed) for an already-`'action-governance'`
 * task whose governance decision is `'ACT'` or `'SIMULATE'`, mechanically
 * verifies that claim against the task's own AWU-03 goals/constraints and
 * AWU-04 knowns, and advances a task to `'result-verification'`. AWU-10
 * adds `recordAdaptation()`: records an explicit, caller-supplied
 * retry/re-plan/escalate/accept adaptation decision against an already-
 * `'result-verification'` task whose `verification.outcome` is
 * `'goals-not-met'` or `'insufficient-basis'`, and advances a task to
 * `'adaptation'` — the tenth and final DoD stage.
 *
 * Deliberately does NOT: execute, compose, re-execute, or automatically
 * retry anything, even for a `'retry'`/`'re-plan'` adaptation decision.
 * Real re-execution/re-composition is out of scope for this build (see
 * `.mi/CONTEXT_MAP.json` and the build prompt's AWU queue).
 *
 * V2-A2 adds `getProblemRepresentation()`: a read-only accessor returning
 * a `MetaIntelligenceProblemRepresentation` (types.ts) that composes the
 * existing `problem`/`understanding`/`goalsConstraints`/`epistemicTracking`
 * fields into one view, honest about which of them a task has not
 * reached yet (`MetaIntelligencePresence`, never a silently-defaulted
 * empty value). Additive only: no existing stage method, field, or the
 * ten `MetaIntelligenceStage` values changed.
 *
 * V2-B2 adds `generateStrategies()`: builds real `MetaIntelligenceStrategy`
 * values (V2-B1's data model) from an already-`'capability-decomposition'`
 * (or later) task, one `'single-requirement'` strategy per satisfied
 * requirement -- additively alongside, and without ever touching, the
 * frozen V1 `generateCandidateStrategies()` / `candidateStrategies`
 * surface. Does not advance `stage`; `strategies` is an orthogonal field,
 * not an eleventh pipeline stage.
 *
 * V2-B3 adds `generateStrategyAlternatives()`: builds real diversity on
 * top of an already-`generateStrategies()`'d task -- per-provider
 * alternative single-requirement strategies wherever a satisfied
 * requirement has more than one provider, and one `'composed'` strategy
 * spanning every satisfied requirement whenever there is more than one --
 * stored in a new, separate `strategyAlternatives` field so
 * `generateStrategies()`'s own single-requirement output stays completely
 * unchanged. Also does not advance `stage`.
 *
 * V2-B4 adds `evaluateStrategyOptions()`: scores the combined
 * `strategies` + `strategyAlternatives` option set with the same
 * DecisionScore pipeline `evaluateStrategies()` already uses, recorded on
 * a new, separate `strategyOptionsEvaluation` field/type so the frozen V1
 * `evaluateStrategies()` / `strategyEvaluation` surface (which continues
 * to score `candidateStrategies` only) is completely untouched. No new
 * risk/cost/evidence/resource criterion shape was added (Law D/G — see
 * `.mi/DECISIONS.jsonl`): DecisionScore's existing generic weight+direction
 * criteria already let a caller express those dimensions. Also does not
 * advance `stage`.
 *
 * V2-C1 adds `authorizeComposition()`: a contract-level "Cognitive
 * Composition boundary" over `strategyOptionsEvaluation.selection`,
 * resolving a selected strategy's `components` and gating them behind an
 * explicit caller-supplied ACT/WAIT/ASK/SIMULATE decision (reusing
 * `MetaIntelligenceGovernanceDecision`, Law D). Recorded on a new,
 * separate `compositionBoundary` field so `governAction()`/
 * `MetaIntelligenceGovernance` (which continues to gate only the frozen
 * V1 `strategyEvaluation.selection`) is completely untouched. Also does
 * not advance `stage`.
 *
 * V2-C2 adds `buildExecutionPlan()`: derives a `MetaIntelligenceExecutionPlan`
 * from an already-`'ACT'`-decided `compositionBoundary`, existence-gated
 * strictly to `decision === 'ACT'` (unlike `compositionBoundary.components`,
 * which is inspectable under any of the four decisions). Takes no request
 * payload -- a pure, deterministic derivation of an already-recorded
 * decision. Also does not advance `stage`.
 *
 * V2-C3 adds `getCognitiveTrace()`: a read-only accessor composing ALL of
 * a task's fields (not just the four `getProblemRepresentation()`
 * covers) into one ordered, uniformly-shaped reasoning-path record --
 * each entry reusing that field's own already-recorded timestamp (Law D)
 * and surfacing only ids that field's own content actually names (Law
 * E). Purely derived, never stored, and available at any point in a
 * task's life (no `'ACT'`-only gate, unlike `buildExecutionPlan()`).
 *
 * V2-C4 adds `recordExecutionOutcome()`: records and mechanically
 * verifies a caller's claimed outcome for an already-`buildExecutionPlan()`'d
 * task, reusing the frozen V1 `MetaIntelligenceResult`/
 * `MetaIntelligenceVerification` shapes and `verifyResult()` logic
 * verbatim (Law D) so that a task whose real decision path ran through
 * `compositionBoundary`/`executionPlan` instead of `governAction()` can
 * finally have an outcome recorded at all. Also does not advance `stage`.
 *
 * V2-C5 adds `recordExecutionAdaptation()`: the same structural fix one
 * stage further down -- records a caller's retry/re-plan/escalate/accept
 * response to an already-`recordExecutionOutcome()`'d task's
 * `executionVerification.outcome`, reusing the frozen V1
 * `MetaIntelligenceAdaptation` shape verbatim (Law D -- no new type or
 * field shape needed at all). Also extends `getCognitiveTrace()` (V2-C3)
 * to compose the two V2-C4 fields that AWU's own `.mi/NEXT.json`
 * deliberately deferred -- purely additive to that method's output, no
 * existing entry changed. This closes Phase C's planned scope (see
 * `.mi/NEXT.json` for what remains: a small `executionAdaptation`
 * trace-wiring housekeeping item, or Phase D).
 *
 * Bookkeeping-only, mirroring `ModelRegistry`'s register/get/list shape
 * (reject-on-duplicate id, throw-on-missing lookup) for a consistent
 * feel with the rest of the Models Hub — but over tasks, not models, and
 * with no lazy-construction concern since a task is plain data.
 */

import type {
  DecisionFlipPoint,
  DecisionScoreMatrix,
  CapabilityGraphLike,
} from './contract.ts';
import type {
  MetaIntelligenceAdaptableVerificationOutcome,
  MetaIntelligenceAdaptation,
  MetaIntelligenceAdaptationDecision,
  MetaIntelligenceAdaptationRequest,
  MetaIntelligenceCandidateStrategies,
  MetaIntelligenceCandidateStrategy,
  MetaIntelligenceCapabilityDecomposition,
  MetaIntelligenceCapabilityDecompositionRequest,
  MetaIntelligenceCapabilityRequirement,
  MetaIntelligenceCapabilityRequirementInput,
  MetaIntelligenceCognitiveTrace,
  MetaIntelligenceCognitiveTraceEntry,
  MetaIntelligenceCompositionBoundary,
  MetaIntelligenceCompositionBoundaryRequest,
  MetaIntelligenceEpistemicItem,
  MetaIntelligenceEpistemicItemInput,
  MetaIntelligenceEpistemicTracking,
  MetaIntelligenceEpistemicTrackingRequest,
  MetaIntelligenceExecutionPlan,
  MetaIntelligenceGoalOrConstraint,
  MetaIntelligenceGoalOrConstraintInput,
  MetaIntelligenceGoalsConstraints,
  MetaIntelligenceGoalsConstraintsRequest,
  MetaIntelligenceGovernance,
  MetaIntelligenceGovernanceDecision,
  MetaIntelligenceGovernanceRequest,
  MetaIntelligenceIntakeRequest,
  MetaIntelligenceNoSelectionReason,
  MetaIntelligencePresence,
  MetaIntelligenceProblemRepresentation,
  MetaIntelligenceResult,
  MetaIntelligenceResultRequest,
  MetaIntelligenceResultStatus,
  MetaIntelligenceStrategy,
  MetaIntelligenceStrategyComponent,
  MetaIntelligenceStrategyEvaluation,
  MetaIntelligenceStrategyEvaluationRequest,
  MetaIntelligenceStrategyOptionRankEntry,
  MetaIntelligenceStrategyOptionSelection,
  MetaIntelligenceStrategyOptionsEvaluation,
  MetaIntelligenceStrategyRankEntry,
  MetaIntelligenceStrategyScorer,
  MetaIntelligenceStrategySelection,
  MetaIntelligenceStrategies,
  MetaIntelligenceStrategyAlternatives,
  MetaIntelligenceTask,
  MetaIntelligenceUnderstanding,
  MetaIntelligenceVerification,
  MetaIntelligenceVerificationOutcome,
} from './types.ts';
import { scoreWithDecisionScore } from './scoring/decisionScoreScorer.ts';

/** Collapse runs of whitespace to a single space. The ONLY transformation `understand()` performs. */
function normalizeWhitespace(statement: string): string {
  return statement.replace(/\s+/g, ' ').trim();
}

/**
 * Validate and assign stable ids to a list of goal/constraint inputs.
 * `text` is kept verbatim (only trimmed) — this is bookkeeping, not
 * interpretation, matching `understand()`'s "mechanical only" rule.
 * `kind` picks the id prefix (`'goal-N'` / `'constraint-N'`, scoped to
 * this call) and the error's item-kind label.
 */
function buildGoalOrConstraintList(
  inputs: MetaIntelligenceGoalOrConstraintInput[],
  kind: 'goal' | 'constraint',
  idPrefix: string
): MetaIntelligenceGoalOrConstraint[] {
  return inputs.map((input, index) => {
    const text = input.text?.trim();
    if (!text) {
      throw new EmptyGoalOrConstraintTextError(kind, index);
    }
    return {
      id: `${idPrefix}-${index + 1}`,
      text,
      origin: input.origin,
    };
  });
}

/** The four epistemic categories tracked by `addEpistemicTracking()`, in the order they appear in its request/output. */
const EPISTEMIC_CATEGORIES = ['known', 'unknown', 'assumption', 'evidence'] as const;
type EpistemicCategory = (typeof EPISTEMIC_CATEGORIES)[number];

/**
 * Validate and assign stable ids to a list of epistemic item inputs.
 * Mirrors `buildGoalOrConstraintList()`'s rules exactly (verbatim,
 * trimmed-only text; bookkeeping, not interpretation) — `category`
 * only picks the id prefix (`'known-N'` / `'unknown-N'` / ...) and the
 * error's category label; it is not stored on the item itself (see
 * `MetaIntelligenceEpistemicItem`'s own note on that).
 */
function buildEpistemicItemList(
  inputs: MetaIntelligenceEpistemicItemInput[],
  category: EpistemicCategory
): MetaIntelligenceEpistemicItem[] {
  return inputs.map((input, index) => {
    const text = input.text?.trim();
    if (!text) {
      throw new EmptyEpistemicItemTextError(category, index);
    }
    return {
      id: `${category}-${index + 1}`,
      text,
      origin: input.origin,
    };
  });
}

/**
 * Validate and assign stable ids to a list of capability-requirement
 * inputs, looking up each one's providers from the given
 * `CapabilityGraph`. `capability` text is kept verbatim (only trimmed) —
 * this is bookkeeping and a graph lookup, not interpretation, matching
 * `buildGoalOrConstraintList()`/`buildEpistemicItemList()`'s rules. A
 * capability with no provider is NOT an error here — an empty
 * `providers` list (and `satisfied: false`) is the intended result; see
 * `MetaIntelligenceCapabilityRequirement`'s own note.
 */
function buildCapabilityRequirementList(
  inputs: MetaIntelligenceCapabilityRequirementInput[],
  graph: CapabilityGraphLike
): MetaIntelligenceCapabilityRequirement[] {
  return inputs.map((input, index) => {
    const capability = input.capability?.trim();
    if (!capability) {
      throw new EmptyCapabilityRequirementError(index);
    }
    const providers = graph.providersOf(capability);
    return {
      id: `capability-${index + 1}`,
      capability,
      origin: input.origin,
      providers,
      satisfied: providers.length > 0,
    };
  });
}

export class EmptyProblemStatementError extends Error {
  constructor() {
    super('Meta-Intelligence intake requires a non-empty problem statement.');
    this.name = 'EmptyProblemStatementError';
  }
}

export class MetaIntelligenceTaskAlreadyExistsError extends Error {
  constructor(id: string) {
    super(`Meta-Intelligence task already exists: ${id}`);
    this.name = 'MetaIntelligenceTaskAlreadyExistsError';
  }
}

export class MetaIntelligenceTaskNotFoundError extends Error {
  constructor(id: string) {
    super(`Meta-Intelligence task not found: ${id}`);
    this.name = 'MetaIntelligenceTaskNotFoundError';
  }
}

/**
 * Thrown by `understand()` when the task is not at the `'received'`
 * stage — either it was already understood, or (once later AWUs add more
 * stages) it has moved further. Rejecting rather than silently
 * re-running keeps `understanding.understoodAt` a trustworthy one-time
 * timestamp, mirroring `ModelAlreadyRegisteredError`'s
 * reject-on-duplicate precedent.
 */
export class MetaIntelligenceTaskNotAtReceivedStageError extends Error {
  constructor(id: string, actualStage: string) {
    super(
      `Meta-Intelligence task "${id}" is not at the 'received' stage (currently '${actualStage}'); understand() requires 'received'.`
    );
    this.name = 'MetaIntelligenceTaskNotAtReceivedStageError';
  }
}

/**
 * Thrown by `addGoalsConstraints()` when the task is not at the
 * `'understood'` stage — either goals/constraints were already added, or
 * `understand()` has not run yet. Mirrors
 * `MetaIntelligenceTaskNotAtReceivedStageError`'s reject-on-duplicate /
 * reject-on-out-of-order precedent.
 */
export class MetaIntelligenceTaskNotAtUnderstoodStageError extends Error {
  constructor(id: string, actualStage: string) {
    super(
      `Meta-Intelligence task "${id}" is not at the 'understood' stage (currently '${actualStage}'); addGoalsConstraints() requires 'understood'.`
    );
    this.name = 'MetaIntelligenceTaskNotAtUnderstoodStageError';
  }
}

/**
 * Thrown by `addGoalsConstraints()` when a goal or constraint's `text` is
 * empty (or whitespace-only) after trimming.
 */
export class EmptyGoalOrConstraintTextError extends Error {
  constructor(kind: 'goal' | 'constraint', index: number) {
    super(`Meta-Intelligence addGoalsConstraints() requires a non-empty text for ${kind} at index ${index}.`);
    this.name = 'EmptyGoalOrConstraintTextError';
  }
}

/**
 * Thrown by `addEpistemicTracking()` when the task is not at the
 * `'goals-constraints'` stage — either epistemic tracking was already
 * added, or `addGoalsConstraints()` has not run yet. Mirrors
 * `MetaIntelligenceTaskNotAtUnderstoodStageError`'s reject-on-duplicate /
 * reject-on-out-of-order precedent.
 */
export class MetaIntelligenceTaskNotAtGoalsConstraintsStageError extends Error {
  constructor(id: string, actualStage: string) {
    super(
      `Meta-Intelligence task "${id}" is not at the 'goals-constraints' stage (currently '${actualStage}'); addEpistemicTracking() requires 'goals-constraints'.`
    );
    this.name = 'MetaIntelligenceTaskNotAtGoalsConstraintsStageError';
  }
}

/**
 * Thrown by `addEpistemicTracking()` when a known/unknown/assumption/
 * evidence item's `text` is empty (or whitespace-only) after trimming.
 */
export class EmptyEpistemicItemTextError extends Error {
  constructor(category: EpistemicCategory, index: number) {
    super(`Meta-Intelligence addEpistemicTracking() requires a non-empty text for ${category} at index ${index}.`);
    this.name = 'EmptyEpistemicItemTextError';
  }
}

/**
 * Thrown by `decomposeCapabilities()` when the task is not at the
 * `'epistemic-tracking'` stage — either capability decomposition was
 * already recorded, or `addEpistemicTracking()` has not run yet. Mirrors
 * `MetaIntelligenceTaskNotAtGoalsConstraintsStageError`'s
 * reject-on-duplicate / reject-on-out-of-order precedent.
 */
export class MetaIntelligenceTaskNotAtEpistemicTrackingStageError extends Error {
  constructor(id: string, actualStage: string) {
    super(
      `Meta-Intelligence task "${id}" is not at the 'epistemic-tracking' stage (currently '${actualStage}'); decomposeCapabilities() requires 'epistemic-tracking'.`
    );
    this.name = 'MetaIntelligenceTaskNotAtEpistemicTrackingStageError';
  }
}

/**
 * Thrown by `decomposeCapabilities()` when a required capability's name
 * is empty (or whitespace-only) after trimming. Distinct from an unmet
 * capability (no provider) — see `MetaIntelligenceCapabilityRequirement`.
 */
export class EmptyCapabilityRequirementError extends Error {
  constructor(index: number) {
    super(`Meta-Intelligence decomposeCapabilities() requires a non-empty capability name at index ${index}.`);
    this.name = 'EmptyCapabilityRequirementError';
  }
}

/**
 * Thrown by `generateCandidateStrategies()` when the task is not at the
 * `'capability-decomposition'` stage — either candidates were already
 * generated, or `decomposeCapabilities()` has not run yet. Mirrors
 * `MetaIntelligenceTaskNotAtEpistemicTrackingStageError`'s
 * reject-on-duplicate / reject-on-out-of-order precedent.
 */
export class MetaIntelligenceTaskNotAtCapabilityDecompositionStageError extends Error {
  constructor(id: string, actualStage: string) {
    super(
      `Meta-Intelligence task "${id}" is not at the 'capability-decomposition' stage (currently '${actualStage}'); generateCandidateStrategies() requires 'capability-decomposition'.`
    );
    this.name = 'MetaIntelligenceTaskNotAtCapabilityDecompositionStageError';
  }
}

/**
 * Thrown by `generateStrategies()` (V2-B2) when the task has no
 * `capabilityDecomposition` yet — i.e. it has not reached
 * `'capability-decomposition'`. Unlike the ten frozen DoD stage methods'
 * `...NotAtXStageError`s, this is not an exact-stage check: `generateStrategies()`
 * is reachable from `'capability-decomposition'` or any later stage, since
 * `capabilityDecomposition` remains present at every stage after it is set.
 */
export class MetaIntelligenceTaskMissingCapabilityDecompositionError extends Error {
  constructor(id: string, actualStage: string) {
    super(
      `Meta-Intelligence task "${id}" has no capability decomposition yet (currently '${actualStage}'); generateStrategies() requires an already-'capability-decomposition' (or later) task.`
    );
    this.name = 'MetaIntelligenceTaskMissingCapabilityDecompositionError';
  }
}

/**
 * Thrown by `generateStrategies()` (V2-B2) when the task already has a
 * `strategies` result — mirrors every other generation step's
 * reject-on-duplicate behavior (never silently recompute over a caller's
 * existing result).
 */
export class MetaIntelligenceStrategiesAlreadyGeneratedError extends Error {
  constructor(id: string) {
    super(
      `Meta-Intelligence task "${id}" already has generated strategies; generateStrategies() cannot be called twice for the same task.`
    );
    this.name = 'MetaIntelligenceStrategiesAlreadyGeneratedError';
  }
}

/**
 * Thrown by `generateStrategyAlternatives()` (V2-B3) when the task has no
 * `strategies` yet -- i.e. `generateStrategies()` (V2-B2) has not run.
 * Alternatives are built additively alongside V2-B2's own single-requirement
 * output, so a task must already have that output before diversity can be
 * added on top of it.
 */
export class MetaIntelligenceStrategiesNotYetGeneratedError extends Error {
  constructor(id: string) {
    super(
      `Meta-Intelligence task "${id}" has no generated strategies yet; generateStrategyAlternatives() requires generateStrategies() to have run first.`
    );
    this.name = 'MetaIntelligenceStrategiesNotYetGeneratedError';
  }
}

/**
 * Thrown by `generateStrategyAlternatives()` (V2-B3) when the task already
 * has a `strategyAlternatives` result -- mirrors
 * `MetaIntelligenceStrategiesAlreadyGeneratedError`'s reject-on-duplicate
 * behavior (never silently recompute over a caller's existing result).
 */
export class MetaIntelligenceStrategyAlternativesAlreadyGeneratedError extends Error {
  constructor(id: string) {
    super(
      `Meta-Intelligence task "${id}" already has generated strategy alternatives; generateStrategyAlternatives() cannot be called twice for the same task.`
    );
    this.name = 'MetaIntelligenceStrategyAlternativesAlreadyGeneratedError';
  }
}

/**
 * Thrown by `evaluateStrategyOptions()` (V2-B4) when the task has no
 * `strategies` yet -- i.e. `generateStrategies()` (V2-B2) has not run.
 * Same underlying precondition as `generateStrategyAlternatives()`'s own
 * `MetaIntelligenceStrategiesNotYetGeneratedError`, but a separate,
 * dedicated error class, per this build's established one-class-per-
 * triggering-method convention (see e.g. the distinct `...NotAtXStageError`s
 * for each of the ten frozen DoD stages).
 */
export class MetaIntelligenceTaskMissingStrategiesError extends Error {
  constructor(id: string) {
    super(
      `Meta-Intelligence task "${id}" has no generated strategies yet; evaluateStrategyOptions() requires generateStrategies() to have run first.`
    );
    this.name = 'MetaIntelligenceTaskMissingStrategiesError';
  }
}

/**
 * Thrown by `evaluateStrategyOptions()` (V2-B4) when the task already has
 * a `strategyOptionsEvaluation` result -- mirrors
 * `MetaIntelligenceStrategyAlternativesAlreadyGeneratedError`'s
 * reject-on-duplicate behavior (never silently recompute over a caller's
 * existing result).
 */
export class MetaIntelligenceStrategyOptionsAlreadyEvaluatedError extends Error {
  constructor(id: string) {
    super(
      `Meta-Intelligence task "${id}" already has an evaluated set of strategy options; evaluateStrategyOptions() cannot be called twice for the same task.`
    );
    this.name = 'MetaIntelligenceStrategyOptionsAlreadyEvaluatedError';
  }
}

/**
 * Thrown by `evaluateStrategies()` when the task is not at the
 * `'candidate-strategies'` stage — either the evaluation already ran, or
 * `generateCandidateStrategies()` has not run yet.
 */
export class MetaIntelligenceTaskNotAtCandidateStrategiesStageError extends Error {
  constructor(id: string, actualStage: string) {
    super(
      `Meta-Intelligence task "${id}" is not at the 'candidate-strategies' stage (currently '${actualStage}'); evaluateStrategies() requires 'candidate-strategies'.`
    );
    this.name = 'MetaIntelligenceTaskNotAtCandidateStrategiesStageError';
  }
}

/**
 * Thrown by `evaluateStrategies()` for a malformed request (e.g. a
 * `minStability` outside [0, 1]) or when the scorer's output cannot be
 * traced back to the task's candidates (unknown/missing candidate ids, or a
 * top option that is not the first-ranked entry). The task is left unchanged.
 */
export class InvalidStrategyEvaluationError extends Error {
  constructor(message: string) {
    super(`Meta-Intelligence evaluateStrategies(): ${message}`);
    this.name = 'InvalidStrategyEvaluationError';
  }
}

/**
 * Thrown by `evaluateStrategyOptions()` (V2-B4) for a malformed request
 * (e.g. a `minStability` outside [0, 1]) or when the scorer's output
 * cannot be traced back to the task's evaluated strategy options
 * (unknown/missing strategy ids, or a top option that is not the
 * first-ranked entry). Mirrors `InvalidStrategyEvaluationError`'s own
 * validation exactly, over strategy ids instead of candidate ids. The
 * task is left unchanged.
 */
export class InvalidStrategyOptionsEvaluationError extends Error {
  constructor(message: string) {
    super(`Meta-Intelligence evaluateStrategyOptions(): ${message}`);
    this.name = 'InvalidStrategyOptionsEvaluationError';
  }
}

/**
 * Thrown by `governAction()` when the task is not at the
 * `'strategy-evaluation'` stage — either governance was already recorded,
 * or `evaluateStrategies()` has not run yet.
 */
export class MetaIntelligenceTaskNotAtStrategyEvaluationStageError extends Error {
  constructor(id: string, actualStage: string) {
    super(
      `Meta-Intelligence task "${id}" is not at the 'strategy-evaluation' stage (currently '${actualStage}'); governAction() requires 'strategy-evaluation'.`
    );
    this.name = 'MetaIntelligenceTaskNotAtStrategyEvaluationStageError';
  }
}

/** Thrown by `governAction()` when `request.decision` is not one of the four `MetaIntelligenceGovernanceDecision` values. */
export class InvalidGovernanceDecisionError extends Error {
  constructor(decision: unknown) {
    super(`Meta-Intelligence governAction() requires decision to be one of 'ACT' | 'WAIT' | 'ASK' | 'SIMULATE' (got ${JSON.stringify(decision)}).`);
    this.name = 'InvalidGovernanceDecisionError';
  }
}

/**
 * Thrown by `governAction()` when the caller requests `'ACT'` but the
 * task's AWU-07 selection is not `{ status: 'selected' }` — no selection
 * or an explicit "none selected" can never be governed to `'ACT'`. The
 * task is left unchanged.
 */
export class MetaIntelligenceActionNotSelectableError extends Error {
  constructor(id: string) {
    super(
      `Meta-Intelligence task "${id}" cannot be governed to 'ACT': its strategy-evaluation selection is not 'selected'.`
    );
    this.name = 'MetaIntelligenceActionNotSelectableError';
  }
}

/**
 * Thrown by `authorizeComposition()` (V2-C1) when the task has no
 * `strategyOptionsEvaluation` yet -- i.e. `evaluateStrategyOptions()`
 * (V2-B4) has not run. A composition boundary can only describe/gate a
 * strategy that has actually been evaluated and (possibly) selected.
 */
export class MetaIntelligenceTaskMissingStrategyOptionsEvaluationError extends Error {
  constructor(id: string) {
    super(
      `Meta-Intelligence task "${id}" has no evaluated strategy options yet; authorizeComposition() requires evaluateStrategyOptions() to have run first.`
    );
    this.name = 'MetaIntelligenceTaskMissingStrategyOptionsEvaluationError';
  }
}

/**
 * Thrown by `authorizeComposition()` (V2-C1) when the task already has a
 * `compositionBoundary` -- mirrors every other generation/evaluation
 * step's reject-on-duplicate convention (never silently recompute over a
 * caller's existing result).
 */
export class MetaIntelligenceCompositionAlreadyBoundError extends Error {
  constructor(id: string) {
    super(
      `Meta-Intelligence task "${id}" already has a composition boundary; authorizeComposition() cannot be called twice for the same task.`
    );
    this.name = 'MetaIntelligenceCompositionAlreadyBoundError';
  }
}

/** Thrown by `authorizeComposition()` (V2-C1) when `request.decision` is not one of the four `MetaIntelligenceGovernanceDecision` values. */
export class InvalidCompositionDecisionError extends Error {
  constructor(decision: unknown) {
    super(`Meta-Intelligence authorizeComposition() requires decision to be one of 'ACT' | 'WAIT' | 'ASK' | 'SIMULATE' (got ${JSON.stringify(decision)}).`);
    this.name = 'InvalidCompositionDecisionError';
  }
}

/**
 * Thrown by `authorizeComposition()` (V2-C1) when the caller requests
 * `'ACT'` but the task's `strategyOptionsEvaluation.selection` is not
 * `{ status: 'selected' }` -- mirrors `MetaIntelligenceActionNotSelectableError`'s
 * own rule over `strategyId` instead of `candidateId`. No selection or an
 * explicit "none selected" can never be composed to `'ACT'`. The task is
 * left unchanged.
 */
export class MetaIntelligenceCompositionNotAuthorizableError extends Error {
  constructor(id: string) {
    super(
      `Meta-Intelligence task "${id}" cannot be composed to 'ACT': its strategy-options-evaluation selection is not 'selected'.`
    );
    this.name = 'MetaIntelligenceCompositionNotAuthorizableError';
  }
}

/**
 * Thrown by `buildExecutionPlan()` (V2-C2) when the task has no
 * `compositionBoundary` yet -- i.e. `authorizeComposition()` (V2-C1) has
 * not run. An execution plan can only be derived from an already-recorded
 * composition decision.
 */
export class MetaIntelligenceTaskMissingCompositionBoundaryError extends Error {
  constructor(id: string) {
    super(
      `Meta-Intelligence task "${id}" has no composition boundary yet; buildExecutionPlan() requires authorizeComposition() to have run first.`
    );
    this.name = 'MetaIntelligenceTaskMissingCompositionBoundaryError';
  }
}

/**
 * Thrown by `buildExecutionPlan()` (V2-C2) when the task already has an
 * `executionPlan` -- mirrors every other generation/evaluation/governance
 * step's reject-on-duplicate convention (never silently recompute over a
 * caller's existing result).
 */
export class MetaIntelligenceExecutionPlanAlreadyBuiltError extends Error {
  constructor(id: string) {
    super(
      `Meta-Intelligence task "${id}" already has an execution plan; buildExecutionPlan() cannot be called twice for the same task.`
    );
    this.name = 'MetaIntelligenceExecutionPlanAlreadyBuiltError';
  }
}

/**
 * Thrown by `buildExecutionPlan()` (V2-C2) when the task's
 * `compositionBoundary.decision` is not `'ACT'`. Unlike
 * `compositionBoundary.components` (inspectable under any of the four
 * decisions), an execution plan represents "this is now authorized to
 * run" and so is deliberately gated to `'ACT'` only -- see
 * `MetaIntelligenceExecutionPlan`'s doc comment for why this gate is the
 * one genuine gap this AWU found.
 */
export class MetaIntelligenceExecutionPlanNotAuthorizedError extends Error {
  constructor(id: string) {
    super(
      `Meta-Intelligence task "${id}" cannot have an execution plan built: its composition boundary decision is not 'ACT'.`
    );
    this.name = 'MetaIntelligenceExecutionPlanNotAuthorizedError';
  }
}

/**
 * Thrown by `buildExecutionPlan()` (V2-C2) if an `'ACT'`-decided
 * `compositionBoundary.components` is unexpectedly `null` -- an invariant
 * violation that should be impossible per `authorizeComposition()`'s own
 * "`'ACT'` requires `selection.status === 'selected'`, which always
 * resolves `components`" guarantee. Recorded as an explicit, honest error
 * rather than silently building an empty plan (Law E, Evidence Honesty).
 */
export class MetaIntelligenceExecutionPlanComponentsMissingError extends Error {
  constructor(id: string) {
    super(
      `Meta-Intelligence task "${id}" has an 'ACT'-decided composition boundary with no components; buildExecutionPlan() cannot derive a plan from it.`
    );
    this.name = 'MetaIntelligenceExecutionPlanComponentsMissingError';
  }
}

/**
 * Thrown by `recordResult()` when the task is not at the
 * `'action-governance'` stage — either a result was already recorded, or
 * `governAction()` has not run yet.
 */
export class MetaIntelligenceTaskNotAtActionGovernanceStageError extends Error {
  constructor(id: string, actualStage: string) {
    super(
      `Meta-Intelligence task "${id}" is not at the 'action-governance' stage (currently '${actualStage}'); recordResult() requires 'action-governance'.`
    );
    this.name = 'MetaIntelligenceTaskNotAtActionGovernanceStageError';
  }
}

/**
 * Thrown by `recordResult()` when the task's governance decision is
 * `'WAIT'` or `'ASK'` — a deferred decision has no execution to have a
 * result. Only `'ACT'` and `'SIMULATE'` governance can be resulted. The
 * task is left unchanged.
 */
export class MetaIntelligenceResultNotRepresentableError extends Error {
  constructor(id: string, decision: MetaIntelligenceGovernanceDecision) {
    super(
      `Meta-Intelligence task "${id}" cannot have a result recorded: its governance decision is '${decision}', not 'ACT' or 'SIMULATE'.`
    );
    this.name = 'MetaIntelligenceResultNotRepresentableError';
  }
}

/** Thrown by `recordResult()` when `request.status` is not one of the three `MetaIntelligenceResultStatus` values. */
export class InvalidResultStatusError extends Error {
  constructor(status: unknown) {
    super(`Meta-Intelligence recordResult() requires status to be one of 'succeeded' | 'failed' | 'not-yet-executed' (got ${JSON.stringify(status)}).`);
    this.name = 'InvalidResultStatusError';
  }
}

/**
 * Thrown by `recordExecutionOutcome()` (V2-C4) when the task has no
 * `executionPlan` yet -- i.e. `buildExecutionPlan()` (V2-C2) has not run.
 * An execution outcome can only be recorded against an already-derived
 * execution plan, mirroring `recordResult()`'s own "requires the upstream
 * decision artifact to already exist" precondition over `governance`.
 */
export class MetaIntelligenceTaskMissingExecutionPlanError extends Error {
  constructor(id: string) {
    super(
      `Meta-Intelligence task "${id}" has no execution plan yet; recordExecutionOutcome() requires buildExecutionPlan() to have run first.`
    );
    this.name = 'MetaIntelligenceTaskMissingExecutionPlanError';
  }
}

/**
 * Thrown by `recordExecutionOutcome()` (V2-C4) when the task already has
 * an `executionResult` -- mirrors every other generation/evaluation/
 * governance/result step's reject-on-duplicate convention (never
 * silently recompute over a caller's existing result).
 */
export class MetaIntelligenceExecutionResultAlreadyRecordedError extends Error {
  constructor(id: string) {
    super(
      `Meta-Intelligence task "${id}" already has an execution outcome recorded; recordExecutionOutcome() cannot be called twice for the same task.`
    );
    this.name = 'MetaIntelligenceExecutionResultAlreadyRecordedError';
  }
}

/**
 * Thrown by `recordAdaptation()` when the task is not at the
 * `'result-verification'` stage — either an adaptation was already
 * recorded, or `recordResult()` has not run yet.
 */
export class MetaIntelligenceTaskNotAtResultVerificationStageError extends Error {
  constructor(id: string, actualStage: string) {
    super(
      `Meta-Intelligence task "${id}" is not at the 'result-verification' stage (currently '${actualStage}'); recordAdaptation() requires 'result-verification'.`
    );
    this.name = 'MetaIntelligenceTaskNotAtResultVerificationStageError';
  }
}

/**
 * Thrown by `recordAdaptation()` when the task's `verification.outcome`
 * is `'verified-against-basis'` or `'not-verifiable'` — neither is a case
 * of "did not succeed as claimed" (a supported success needs no
 * adaptation; nothing has happened yet under `'not-verifiable'`, so there
 * is no failure to adapt to). The task is left unchanged.
 */
export class MetaIntelligenceAdaptationNotRepresentableError extends Error {
  constructor(id: string, outcome: MetaIntelligenceVerificationOutcome) {
    super(
      `Meta-Intelligence task "${id}" cannot have an adaptation recorded: its verification outcome is '${outcome}', not 'goals-not-met' or 'insufficient-basis'.`
    );
    this.name = 'MetaIntelligenceAdaptationNotRepresentableError';
  }
}

/** Thrown by `recordAdaptation()` when `request.decision` is not one of the four `MetaIntelligenceAdaptationDecision` values. */
export class InvalidAdaptationDecisionError extends Error {
  constructor(decision: unknown) {
    super(`Meta-Intelligence recordAdaptation() requires decision to be one of 'retry' | 're-plan' | 'escalate' | 'accept' (got ${JSON.stringify(decision)}).`);
    this.name = 'InvalidAdaptationDecisionError';
  }
}

/**
 * Thrown by `recordExecutionAdaptation()` (V2-C5) when the task has no
 * `executionVerification` yet -- i.e. `recordExecutionOutcome()` (V2-C4)
 * has not run. An execution adaptation can only be recorded against an
 * already-verified execution outcome, mirroring `recordAdaptation()`'s
 * own "requires the upstream verification to already exist" precondition
 * over the frozen V1 `verification` field.
 */
export class MetaIntelligenceTaskMissingExecutionVerificationError extends Error {
  constructor(id: string) {
    super(
      `Meta-Intelligence task "${id}" has no execution verification yet; recordExecutionAdaptation() requires recordExecutionOutcome() to have run first.`
    );
    this.name = 'MetaIntelligenceTaskMissingExecutionVerificationError';
  }
}

/**
 * Thrown by `recordExecutionAdaptation()` (V2-C5) when the task's
 * `executionVerification.outcome` is `'verified-against-basis'` or
 * `'not-verifiable'` -- mirrors `MetaIntelligenceAdaptationNotRepresentableError`'s
 * own rule, over `executionVerification` instead of the frozen V1
 * `verification`: neither is a case of "did not succeed as claimed". The
 * task is left unchanged.
 */
export class MetaIntelligenceExecutionAdaptationNotRepresentableError extends Error {
  constructor(id: string, outcome: MetaIntelligenceVerificationOutcome) {
    super(
      `Meta-Intelligence task "${id}" cannot have an execution adaptation recorded: its execution verification outcome is '${outcome}', not 'goals-not-met' or 'insufficient-basis'.`
    );
    this.name = 'MetaIntelligenceExecutionAdaptationNotRepresentableError';
  }
}

/**
 * Thrown by `recordExecutionAdaptation()` (V2-C5) when the task already
 * has an `executionAdaptation` -- mirrors every other generation/
 * evaluation/governance/outcome step's reject-on-duplicate convention
 * (never silently recompute over a caller's existing decision).
 */
export class MetaIntelligenceExecutionAdaptationAlreadyRecordedError extends Error {
  constructor(id: string) {
    super(
      `Meta-Intelligence task "${id}" already has an execution adaptation recorded; recordExecutionAdaptation() cannot be called twice for the same task.`
    );
    this.name = 'MetaIntelligenceExecutionAdaptationAlreadyRecordedError';
  }
}

/** Scores closer than this are treated as tied for the purpose of `'tie-for-top'`. */
const TIE_EPSILON = 1e-12;

/** The only valid `MetaIntelligenceGovernanceRequest.decision` values, in the order documented on `MetaIntelligenceGovernanceDecision`. */
const GOVERNANCE_DECISIONS: readonly MetaIntelligenceGovernanceDecision[] = ['ACT', 'WAIT', 'ASK', 'SIMULATE'];

/** The only valid `MetaIntelligenceResultRequest.status` values, in the order documented on `MetaIntelligenceResultStatus`. */
const RESULT_STATUSES: readonly MetaIntelligenceResultStatus[] = ['succeeded', 'failed', 'not-yet-executed'];

/** Governance decisions `recordResult()` accepts a result against. `'WAIT'`/`'ASK'` are excluded — see `MetaIntelligenceResultNotRepresentableError`. */
const RESULTABLE_GOVERNANCE_DECISIONS: readonly MetaIntelligenceGovernanceDecision[] = ['ACT', 'SIMULATE'];

/** The only valid `MetaIntelligenceAdaptationRequest.decision` values, in the order documented on `MetaIntelligenceAdaptationDecision`. */
const ADAPTATION_DECISIONS: readonly MetaIntelligenceAdaptationDecision[] = ['retry', 're-plan', 'escalate', 'accept'];

/** Verification outcomes `recordAdaptation()` accepts an adaptation against. See `MetaIntelligenceAdaptationNotRepresentableError`. */
const ADAPTABLE_VERIFICATION_OUTCOMES: readonly MetaIntelligenceVerificationOutcome[] = ['goals-not-met', 'insufficient-basis'];

/**
 * Mechanical-only verification: derive `MetaIntelligenceVerificationOutcome`
 * from a just-recorded result's `status` and the task's own AWU-03
 * goals/constraints and AWU-04 knowns. See `MetaIntelligenceVerificationOutcome`
 * for exactly what each outcome means and why. Never inspects `detail`,
 * never inspects goal/constraint/known *text* — only whether they exist.
 */
function verifyResult(
  status: MetaIntelligenceResultStatus,
  task: MetaIntelligenceTask
): MetaIntelligenceVerificationOutcome {
  if (status === 'not-yet-executed') return 'not-verifiable';
  if (status === 'failed') return 'goals-not-met';
  const hasGoalOrConstraint =
    (task.goalsConstraints?.goals.length ?? 0) > 0 || (task.goalsConstraints?.constraints.length ?? 0) > 0;
  const hasKnown = (task.epistemicTracking?.knowns.length ?? 0) > 0;
  return hasGoalOrConstraint && hasKnown ? 'verified-against-basis' : 'insufficient-basis';
}

/**
 * V2-A2: wrap an optional `MetaIntelligenceTask` field as an explicit
 * `MetaIntelligencePresence`, never collapsing "not yet recorded" into an
 * empty value of `T`'s own shape. See `MetaIntelligencePresence` (types.ts).
 */
function presence<T>(value: T | undefined): MetaIntelligencePresence<T> {
  return value === undefined ? { present: false } : { present: true, value };
}

export class MetaIntelligenceOrchestrator {
  private readonly tasks: Map<string, MetaIntelligenceTask> = new Map();
  private nextSeq = 1;

  /**
   * Stage 1 of the DoD pipeline ("Problem") only: record the caller's
   * statement verbatim under a task id and the `'received'` stage.
   */
  intake(request: MetaIntelligenceIntakeRequest): MetaIntelligenceTask {
    const statement = request.statement?.trim();
    if (!statement) {
      throw new EmptyProblemStatementError();
    }

    const id = request.id ?? `mi-task-${this.nextSeq++}`;
    if (this.tasks.has(id)) {
      throw new MetaIntelligenceTaskAlreadyExistsError(id);
    }

    const task: MetaIntelligenceTask = {
      id,
      problem: { statement, receivedAt: new Date().toISOString() },
      stage: 'received',
    };
    this.tasks.set(id, task);
    return task;
  }

  /**
   * Stage 2 of the DoD pipeline ("Understand") only: derive a normalized
   * restatement of an already-`'received'` task's problem and advance it
   * to `'understood'`. Whitespace collapsing is the only transformation —
   * no goal/constraint extraction, no epistemic tracking, no capability
   * decomposition. `problem.statement` is read, never modified.
   */
  understand(id: string): MetaIntelligenceTask {
    const task = this.getTask(id);
    if (task.stage !== 'received') {
      throw new MetaIntelligenceTaskNotAtReceivedStageError(id, task.stage);
    }

    const understanding: MetaIntelligenceUnderstanding = {
      normalizedStatement: normalizeWhitespace(task.problem.statement),
      understoodAt: new Date().toISOString(),
    };

    const updated: MetaIntelligenceTask = {
      ...task,
      stage: 'understood',
      understanding,
    };
    this.tasks.set(id, updated);
    return updated;
  }

  /**
   * Stage 3 of the DoD pipeline ("Goals/Constraints") only: attach the
   * caller's goals and constraints to an already-`'understood'` task and
   * advance it to `'goals-constraints'`. Each item's `origin` is recorded
   * as given — `'caller'` and `'extracted'` items are kept as distinct
   * entries and never merged or rewritten into each other, here or
   * later. `problem.statement` and `understanding` are untouched.
   */
  addGoalsConstraints(id: string, request: MetaIntelligenceGoalsConstraintsRequest): MetaIntelligenceTask {
    const task = this.getTask(id);
    if (task.stage !== 'understood') {
      throw new MetaIntelligenceTaskNotAtUnderstoodStageError(id, task.stage);
    }

    const goals = buildGoalOrConstraintList(request.goals, 'goal', 'goal');
    const constraints = buildGoalOrConstraintList(request.constraints, 'constraint', 'constraint');

    const goalsConstraints: MetaIntelligenceGoalsConstraints = {
      goals,
      constraints,
      recordedAt: new Date().toISOString(),
    };

    const updated: MetaIntelligenceTask = {
      ...task,
      stage: 'goals-constraints',
      goalsConstraints,
    };
    this.tasks.set(id, updated);
    return updated;
  }

  /**
   * Stage 4 of the DoD pipeline ("Known/Unknown/Assumptions/Evidence")
   * only: attach the caller's epistemic state to an already-
   * `'goals-constraints'` task and advance it to `'epistemic-tracking'`.
   * Knowns, unknowns, assumptions, and evidence are tracked as four
   * distinct lists, each item's `origin` recorded as given — exactly the
   * same `'caller'` / `'extracted'` provenance rule `addGoalsConstraints()`
   * uses, never merged or rewritten here or later.
   * `problem.statement`, `understanding`, and `goalsConstraints` are
   * untouched.
   */
  addEpistemicTracking(id: string, request: MetaIntelligenceEpistemicTrackingRequest): MetaIntelligenceTask {
    const task = this.getTask(id);
    if (task.stage !== 'goals-constraints') {
      throw new MetaIntelligenceTaskNotAtGoalsConstraintsStageError(id, task.stage);
    }

    const knowns = buildEpistemicItemList(request.knowns, 'known');
    const unknowns = buildEpistemicItemList(request.unknowns, 'unknown');
    const assumptions = buildEpistemicItemList(request.assumptions, 'assumption');
    const evidence = buildEpistemicItemList(request.evidence, 'evidence');

    const epistemicTracking: MetaIntelligenceEpistemicTracking = {
      knowns,
      unknowns,
      assumptions,
      evidence,
      recordedAt: new Date().toISOString(),
    };

    const updated: MetaIntelligenceTask = {
      ...task,
      stage: 'epistemic-tracking',
      epistemicTracking,
    };
    this.tasks.set(id, updated);
    return updated;
  }

  /**
   * Stage 5 of the DoD pipeline ("Capability Decomposition") only: check
   * a caller-supplied list of required capabilities against `graph` (an
   * existing `CapabilityGraph`, e.g. built from the live `ModelRegistry`)
   * and advance an already-`'epistemic-tracking'` task to
   * `'capability-decomposition'`. Each requirement's `providers` and
   * `satisfied` are looked up from `graph.providersOf()` at call time — a
   * snapshot, not a live reference — and a requirement with no provider
   * is recorded as a gap, not rejected as an error (capability gap
   * detection is the point of this stage, not a failure of it). This
   * method reads from `graph` only; it never mutates it, and it never
   * invents capability names or providers of its own — every entry in
   * `requirements[].providers` and `gaps` traces back to `graph`.
   * `problem.statement`, `understanding`, `goalsConstraints`, and
   * `epistemicTracking` are untouched. Deliberately does NOT generate or
   * select a strategy, execute or verify anything, or adapt/re-plan —
   * those are later AWUs.
   */
  decomposeCapabilities(
    id: string,
    graph: CapabilityGraphLike,
    request: MetaIntelligenceCapabilityDecompositionRequest
  ): MetaIntelligenceTask {
    const task = this.getTask(id);
    if (task.stage !== 'epistemic-tracking') {
      throw new MetaIntelligenceTaskNotAtEpistemicTrackingStageError(id, task.stage);
    }

    const requirements = buildCapabilityRequirementList(request.requirements, graph);
    const gaps: string[] = [];
    for (const requirement of requirements) {
      if (!requirement.satisfied && !gaps.includes(requirement.capability)) {
        gaps.push(requirement.capability);
      }
    }

    const capabilityDecomposition: MetaIntelligenceCapabilityDecomposition = {
      requirements,
      gaps,
      decomposedAt: new Date().toISOString(),
    };

    const updated: MetaIntelligenceTask = {
      ...task,
      stage: 'capability-decomposition',
      capabilityDecomposition,
    };
    this.tasks.set(id, updated);
    return updated;
  }

  /**
   * Stage 6 of the DoD pipeline ("Candidate Strategies") only: build a
   * minimal set of candidate strategies from an already-
   * `'capability-decomposition'` task's own `capabilityDecomposition` and
   * advance it to `'candidate-strategies'`. One candidate is created per
   * satisfied requirement (`satisfied === true`), in requirement order,
   * each pointing back at its requirement and carrying a copy of that
   * requirement's `providers`; gap requirements yield no candidate (they
   * stay visible as `capabilityDecomposition.gaps`). Nothing here is
   * inferred or invented: every candidate field traces back to the
   * AWU-05 decomposition. Deliberately does NOT evaluate, score, rank, or
   * select among candidates, choose a provider from a candidate's list,
   * execute or verify anything, or adapt/re-plan — those are later AWUs.
   * `problem.statement`, `understanding`, `goalsConstraints`,
   * `epistemicTracking`, and `capabilityDecomposition` are untouched.
   */
  generateCandidateStrategies(id: string): MetaIntelligenceTask {
    const task = this.getTask(id);
    if (task.stage !== 'capability-decomposition' || !task.capabilityDecomposition) {
      throw new MetaIntelligenceTaskNotAtCapabilityDecompositionStageError(id, task.stage);
    }

    const candidates: MetaIntelligenceCandidateStrategy[] = [];
    for (const requirement of task.capabilityDecomposition.requirements) {
      if (!requirement.satisfied) continue;
      candidates.push({
        id: `strategy-${candidates.length + 1}`,
        requirementId: requirement.id,
        capability: requirement.capability,
        providers: [...requirement.providers],
      });
    }

    const candidateStrategies: MetaIntelligenceCandidateStrategies = {
      candidates,
      generatedAt: new Date().toISOString(),
    };

    const updated: MetaIntelligenceTask = {
      ...task,
      stage: 'candidate-strategies',
      candidateStrategies,
    };
    this.tasks.set(id, updated);
    return updated;
  }

  /**
   * V2-B2 (Phase B — Cognitive Strategy Engine): builds real
   * `MetaIntelligenceStrategy` values from an already-
   * `'capability-decomposition'` (or later) task's own
   * `capabilityDecomposition`, additively alongside the frozen V1
   * `generateCandidateStrategies()` / `candidateStrategies` surface --
   * this method never reads or writes `candidateStrategies`, and never
   * changes `stage`. Deliberately mirrors `generateCandidateStrategies()`'s
   * own satisfied-only rule: one `'single-requirement'` strategy (a
   * single `MetaIntelligenceStrategyComponent`) per satisfied requirement
   * (`satisfied === true`), in requirement order; gap requirements yield
   * no strategy, same as they yield no candidate. This is a deliberately
   * justified first version (see `.mi/DECISIONS.jsonl`): it proves the
   * V2-B1 `MetaIntelligenceStrategy` shape out end-to-end through the
   * orchestrator before any multi-requirement composition heuristic is
   * invented -- composition/diversity is V2-B3's job, not this one's.
   *
   * Unlike the ten frozen DoD stage methods, `strategies` is an additive,
   * orthogonal field, not a new pipeline stage (`MetaIntelligenceStage`'s
   * ten values are unchanged by V2-B2), so this method is reachable from
   * `'capability-decomposition'` or any later stage rather than gated to
   * one exact stage. Rejects a second call for the same task (mirroring
   * every other generation step's reject-on-duplicate behavior) rather
   * than silently recomputing over a caller's existing result.
   * Deliberately does NOT evaluate, score, rank, or select among
   * strategies, execute or verify anything, or adapt/re-plan.
   */
  generateStrategies(id: string): MetaIntelligenceTask {
    const task = this.getTask(id);
    if (!task.capabilityDecomposition) {
      throw new MetaIntelligenceTaskMissingCapabilityDecompositionError(id, task.stage);
    }
    if (task.strategies) {
      throw new MetaIntelligenceStrategiesAlreadyGeneratedError(id);
    }

    const strategies: MetaIntelligenceStrategy[] = [];
    for (const requirement of task.capabilityDecomposition.requirements) {
      if (!requirement.satisfied) continue;
      const component: MetaIntelligenceStrategyComponent = {
        requirementId: requirement.id,
        capability: requirement.capability,
        providers: [...requirement.providers],
      };
      strategies.push({
        id: `strategy-${strategies.length + 1}`,
        components: [component],
        derivation: 'single-requirement',
      });
    }

    const generatedStrategies: MetaIntelligenceStrategies = {
      strategies,
      generatedAt: new Date().toISOString(),
    };

    const updated: MetaIntelligenceTask = {
      ...task,
      strategies: generatedStrategies,
    };
    this.tasks.set(id, updated);
    return updated;
  }

  /**
   * V2-B3 (Phase B — Cognitive Strategy Engine): builds real strategy
   * ALTERNATIVES/diversity for an already-`generateStrategies()`'d task,
   * additively alongside (and without ever touching) V2-B2's `strategies`
   * field, the frozen V1 `generateCandidateStrategies()` /
   * `candidateStrategies` surface, or `stage`. Addresses V2-A1's G3 FAIL
   * finding ("candidates are not real alternatives") using only diversity
   * that already exists in the task's own `capabilityDecomposition` data —
   * nothing invented, no score/rank/priority/confidence/`selected` field:
   *
   * - for every satisfied requirement with MORE THAN ONE provider, one
   *   additional `'single-requirement'` alternative strategy per provider
   *   BEYOND the first (`providers.slice(1)`), each carrying only that one
   *   provider — a genuinely different provider satisfying the identical
   *   capability is a real alternative, not a restatement of the
   *   requirement's already-full provider list V2-B2's own
   *   single-requirement strategy already carries;
   * - one `'composed'` strategy spanning EVERY satisfied requirement of
   *   the task (one component per requirement, each with that
   *   requirement's full provider list), whenever the task has two or
   *   more satisfied requirements — a real multi-capability approach,
   *   built strictly from already-satisfied requirements with no
   *   filtering/scoring applied (that remains V2-B4's job).
   *
   * A task with no such diversity in its data (a single satisfied
   * requirement with exactly one provider, or none satisfied at all)
   * yields an empty `strategyAlternatives.strategies` list — mirroring
   * `generateStrategies()`'s own gap/no-candidates precedent — rather than
   * inventing a placeholder alternative.
   *
   * This is a deliberately separate field/method from `generateStrategies()`,
   * not an extension of it (see `.mi/DECISIONS.jsonl`): V2-B2's own
   * single-requirement output must stay byte-for-byte unchanged, including
   * for a requirement that happens to have more than one provider, since
   * that is exactly the case V2-B2's own existing tests assert and must
   * keep asserting. Requires `task.strategies` to already be present
   * (throws `MetaIntelligenceStrategiesNotYetGeneratedError` otherwise);
   * rejects a second call for the same task
   * (`MetaIntelligenceStrategyAlternativesAlreadyGeneratedError`), same
   * reject-on-duplicate convention as every other generation step. New
   * strategy ids continue V2-B2's own `'strategy-N'` numbering from where
   * `task.strategies.strategies` left off, so ids stay unique across both
   * fields. Like `generateStrategies()`, does not advance `stage` —
   * `strategyAlternatives` is an additive, orthogonal field, not an
   * eleventh pipeline stage. Deliberately does NOT evaluate, score, rank,
   * or select among strategies, execute or verify anything, or
   * adapt/re-plan.
   */
  generateStrategyAlternatives(id: string): MetaIntelligenceTask {
    const task = this.getTask(id);
    if (!task.strategies) {
      throw new MetaIntelligenceStrategiesNotYetGeneratedError(id);
    }
    if (task.strategyAlternatives) {
      throw new MetaIntelligenceStrategyAlternativesAlreadyGeneratedError(id);
    }

    const satisfiedRequirements = (task.capabilityDecomposition?.requirements ?? []).filter(
      (requirement) => requirement.satisfied
    );

    const alternatives: MetaIntelligenceStrategy[] = [];
    let nextId = task.strategies.strategies.length + 1;

    // Real per-provider alternatives: one extra single-requirement strategy
    // per provider beyond the first, for any satisfied requirement with more
    // than one provider.
    for (const requirement of satisfiedRequirements) {
      for (const provider of requirement.providers.slice(1)) {
        alternatives.push({
          id: `strategy-${nextId++}`,
          components: [
            {
              requirementId: requirement.id,
              capability: requirement.capability,
              providers: [provider],
            },
          ],
          derivation: 'single-requirement',
        });
      }
    }

    // Real composed alternative: one strategy spanning every satisfied
    // requirement, whenever there is more than one to compose.
    if (satisfiedRequirements.length > 1) {
      alternatives.push({
        id: `strategy-${nextId++}`,
        components: satisfiedRequirements.map((requirement) => ({
          requirementId: requirement.id,
          capability: requirement.capability,
          providers: [...requirement.providers],
        })),
        derivation: 'composed',
      });
    }

    const strategyAlternatives: MetaIntelligenceStrategyAlternatives = {
      strategies: alternatives,
      generatedAt: new Date().toISOString(),
    };

    const updated: MetaIntelligenceTask = {
      ...task,
      strategyAlternatives,
    };
    this.tasks.set(id, updated);
    return updated;
  }

  /**
   * Stage 7 of the DoD pipeline ("Evaluation/Selection") only: score an
   * already-`'candidate-strategies'` task's candidates with the DecisionScore
   * pipeline and record an explicit selection, advancing the task to
   * `'strategy-evaluation'`. Candidates become DecisionScore options (option
   * id = candidate id); the criteria, weights, and per-candidate scores come
   * from `request` — nothing is invented here. Selection is mechanical: the
   * top-ranked candidate is selected unless (a) there are no candidates,
   * (b) the top two scores tie, or (c) `request.minStability` is set and the
   * ranking's DSI is below it — in those cases "none selected" is recorded
   * with the reason. A selection names a candidate only; it does not choose
   * a provider from its `providers`. If the scorer or request validation
   * throws, the task is left unchanged. Deliberately does NOT execute,
   * verify, or adapt/re-plan anything. Earlier-stage state is untouched.
   */
  evaluateStrategies(
    id: string,
    request: MetaIntelligenceStrategyEvaluationRequest,
    scorer: MetaIntelligenceStrategyScorer = scoreWithDecisionScore
  ): MetaIntelligenceTask {
    const task = this.getTask(id);
    if (task.stage !== 'candidate-strategies' || !task.candidateStrategies) {
      throw new MetaIntelligenceTaskNotAtCandidateStrategiesStageError(id, task.stage);
    }

    const minStability = request.minStability ?? null;
    if (minStability !== null && (typeof minStability !== 'number' || !Number.isFinite(minStability) || minStability < 0 || minStability > 1)) {
      throw new InvalidStrategyEvaluationError('minStability must be a finite number in [0, 1].');
    }

    const candidates = task.candidateStrategies.candidates;
    const candidateIds = candidates.map((c) => c.id);

    // Copy inputs so later mutation by the caller can never alias the recorded evaluation.
    const criteria = (request.criteria ?? []).map((c) => ({ ...c }));
    const scores: DecisionScoreMatrix = {};
    for (const candidateId of candidateIds) {
      const row = request.scores?.[candidateId];
      if (row && typeof row === 'object') scores[candidateId] = { ...row };
    }

    let ranking: MetaIntelligenceStrategyRankEntry[] = [];
    let dsi: number | null = null;
    let dfp: DecisionFlipPoint[] = [];
    let selection: MetaIntelligenceStrategySelection;

    if (candidates.length === 0) {
      selection = { status: 'none', reason: 'no-candidates' };
    } else {
      const output = scorer(
        {
          options: candidateIds.map((candidateId) => ({ id: candidateId })),
          criteria,
          scores,
        },
        request.scorerOptions
      );

      const rankedIds = output.ranking.map((entry) => entry.optionId);
      if (
        rankedIds.length !== candidateIds.length ||
        new Set(rankedIds).size !== rankedIds.length ||
        !rankedIds.every((rankedId) => candidateIds.includes(rankedId))
      ) {
        throw new InvalidStrategyEvaluationError('scorer ranking does not cover exactly this task\'s candidates.');
      }
      if (output.topOptionId !== rankedIds[0]) {
        throw new InvalidStrategyEvaluationError('scorer topOptionId is not the first-ranked candidate.');
      }
      if (typeof output.dsi !== 'number' || !Number.isFinite(output.dsi)) {
        throw new InvalidStrategyEvaluationError('scorer returned a non-finite dsi.');
      }

      ranking = output.ranking.map((entry) => ({
        candidateId: entry.optionId,
        score: entry.score,
        rank: entry.rank,
      }));
      dsi = output.dsi;
      dfp = output.dfp.map((flip) => ({ ...flip }));

      if (ranking.length > 1 && Math.abs(ranking[0].score - ranking[1].score) <= TIE_EPSILON) {
        selection = { status: 'none', reason: 'tie-for-top' };
      } else if (minStability !== null && dsi < minStability) {
        selection = { status: 'none', reason: 'below-stability-threshold' };
      } else {
        selection = { status: 'selected', candidateId: ranking[0].candidateId };
      }
    }

    const strategyEvaluation: MetaIntelligenceStrategyEvaluation = {
      criteria,
      scores,
      ranking,
      dsi,
      dfp,
      minStability,
      selection,
      evaluatedAt: new Date().toISOString(),
    };

    const updated: MetaIntelligenceTask = {
      ...task,
      stage: 'strategy-evaluation',
      strategyEvaluation,
    };
    this.tasks.set(id, updated);
    return updated;
  }

  /**
   * V2-B4 (Phase B — Cognitive Strategy Engine): evaluates real
   * `MetaIntelligenceStrategy` options — the combined set of
   * `task.strategies.strategies` (V2-B2) and, if present,
   * `task.strategyAlternatives.strategies` (V2-B3) — with the same
   * DecisionScore pipeline `evaluateStrategies()` already uses, additively
   * alongside (and without ever reading or writing) the frozen V1
   * `evaluateStrategies()` / `MetaIntelligenceStrategyEvaluation` /
   * `candidateStrategies` surface, which continues to score
   * `candidateStrategies` only.
   *
   * Addresses V2-A1's G5 FAIL finding ("DecisionScore criteria are fully
   * caller-supplied and generic; there is no structured risk/cost/evidence/
   * resource dimension a caller can attach that this component itself
   * reasons about"). Per Law D (One Epistemic Language) and Law G (80/20
   * filter), this AWU did NOT invent a new risk/cost/evidence/resource
   * criterion shape: a caller can already express a risk or cost dimension
   * as a `DecisionScoreCriterion` with `direction: 'minimize'`, and an
   * evidence or resource dimension with `direction: 'maximize'`, scored
   * per strategy option in the existing `DecisionScoreMatrix` — exactly
   * what this method accepts unchanged via the reused
   * `MetaIntelligenceStrategyEvaluationRequest` shape (its `criteria` /
   * `scores` members are already fully generic, never
   * `candidateStrategies`-specific). See `.mi/DECISIONS.jsonl` for the
   * full assessment. The genuine gap this method closes is structural, not
   * a criterion shape: `evaluateStrategies()` can only ever score
   * `candidateStrategies` (gated to the `'candidate-strategies'` stage) —
   * it has no path to score `MetaIntelligenceStrategy` /
   * `MetaIntelligenceStrategyAlternatives` values at all, so a real
   * multi-requirement `'composed'` strategy (V2-B3) could never be
   * risk/cost/evidence/resource-evaluated until now.
   *
   * Mirrors `evaluateStrategies()`'s own mechanics exactly (option id =
   * strategy id; validate `minStability`; score via `scorer`; validate the
   * scorer's ranking covers exactly the option set; tie-for-top /
   * below-stability-threshold / no-options selection rules, reusing the
   * same `TIE_EPSILON`), just over strategy ids instead of candidate ids,
   * recorded on a separate `strategyOptionsEvaluation` field/type
   * (`MetaIntelligenceStrategyOptionsEvaluation`,
   * `MetaIntelligenceStrategyOptionRankEntry`,
   * `MetaIntelligenceStrategyOptionSelection`) — mirroring
   * `MetaIntelligenceStrategyEvaluation`'s own separation from
   * `MetaIntelligenceCandidateStrategy`. Requires `task.strategies` to
   * already be present (throws `MetaIntelligenceTaskMissingStrategiesError`
   * otherwise); `task.strategyAlternatives` is optional and simply
   * contributes no extra options when absent. Rejects a second call for
   * the same task (`MetaIntelligenceStrategyOptionsAlreadyEvaluatedError`),
   * same reject-on-duplicate convention as every other generation/
   * evaluation step. Like `generateStrategies()`/
   * `generateStrategyAlternatives()`, does NOT advance `stage` —
   * `strategyOptionsEvaluation` is an additive, orthogonal field, not an
   * eleventh pipeline stage. Deliberately does NOT select, execute,
   * compose, verify, or adapt/re-plan anything beyond recording the
   * evaluation and its mechanical selection — strategy *selection* proper
   * (choosing among evaluated strategies, with explanation/provenance)
   * remains V2-B5's job, mirroring the V1
   * `generateCandidateStrategies()`/`evaluateStrategies()` split. If the
   * scorer or request validation throws, the task is left unchanged.
   */
  evaluateStrategyOptions(
    id: string,
    request: MetaIntelligenceStrategyEvaluationRequest,
    scorer: MetaIntelligenceStrategyScorer = scoreWithDecisionScore
  ): MetaIntelligenceTask {
    const task = this.getTask(id);
    if (!task.strategies) {
      throw new MetaIntelligenceTaskMissingStrategiesError(id);
    }
    if (task.strategyOptionsEvaluation) {
      throw new MetaIntelligenceStrategyOptionsAlreadyEvaluatedError(id);
    }

    const minStability = request.minStability ?? null;
    if (minStability !== null && (typeof minStability !== 'number' || !Number.isFinite(minStability) || minStability < 0 || minStability > 1)) {
      throw new InvalidStrategyOptionsEvaluationError('minStability must be a finite number in [0, 1].');
    }

    const options: readonly MetaIntelligenceStrategy[] = [
      ...task.strategies.strategies,
      ...(task.strategyAlternatives?.strategies ?? []),
    ];
    const optionIds = options.map((s) => s.id);

    // Copy inputs so later mutation by the caller can never alias the recorded evaluation.
    const criteria = (request.criteria ?? []).map((c) => ({ ...c }));
    const scores: DecisionScoreMatrix = {};
    for (const strategyId of optionIds) {
      const row = request.scores?.[strategyId];
      if (row && typeof row === 'object') scores[strategyId] = { ...row };
    }

    let ranking: MetaIntelligenceStrategyOptionRankEntry[] = [];
    let dsi: number | null = null;
    let dfp: DecisionFlipPoint[] = [];
    let selection: MetaIntelligenceStrategyOptionSelection;

    if (optionIds.length === 0) {
      selection = { status: 'none', reason: 'no-candidates' };
    } else {
      const output = scorer(
        {
          options: optionIds.map((strategyId) => ({ id: strategyId })),
          criteria,
          scores,
        },
        request.scorerOptions
      );

      const rankedIds = output.ranking.map((entry) => entry.optionId);
      if (
        rankedIds.length !== optionIds.length ||
        new Set(rankedIds).size !== rankedIds.length ||
        !rankedIds.every((rankedId) => optionIds.includes(rankedId))
      ) {
        throw new InvalidStrategyOptionsEvaluationError('scorer ranking does not cover exactly this task\'s strategy options.');
      }
      if (output.topOptionId !== rankedIds[0]) {
        throw new InvalidStrategyOptionsEvaluationError('scorer topOptionId is not the first-ranked strategy option.');
      }
      if (typeof output.dsi !== 'number' || !Number.isFinite(output.dsi)) {
        throw new InvalidStrategyOptionsEvaluationError('scorer returned a non-finite dsi.');
      }

      ranking = output.ranking.map((entry) => ({
        strategyId: entry.optionId,
        score: entry.score,
        rank: entry.rank,
      }));
      dsi = output.dsi;
      dfp = output.dfp.map((flip) => ({ ...flip }));

      if (ranking.length > 1 && Math.abs(ranking[0].score - ranking[1].score) <= TIE_EPSILON) {
        selection = { status: 'none', reason: 'tie-for-top' };
      } else if (minStability !== null && dsi < minStability) {
        selection = { status: 'none', reason: 'below-stability-threshold' };
      } else {
        selection = { status: 'selected', strategyId: ranking[0].strategyId };
      }
    }

    const strategyOptionsEvaluation: MetaIntelligenceStrategyOptionsEvaluation = {
      criteria,
      scores,
      ranking,
      dsi,
      dfp,
      minStability,
      selection,
      evaluatedAt: new Date().toISOString(),
    };

    const updated: MetaIntelligenceTask = {
      ...task,
      strategyOptionsEvaluation,
    };
    this.tasks.set(id, updated);
    return updated;
  }

  /**
   * V2-C1 (Phase C -- Closed-Loop Cognition): the "Cognitive Composition
   * boundary" -- record an explicit, caller-supplied ACT/WAIT/ASK/SIMULATE
   * composition decision against an already-`evaluateStrategyOptions()`'d
   * task (`MetaIntelligenceTaskMissingStrategyOptionsEvaluationError`
   * otherwise), and, when a strategy was actually selected, resolve and
   * attach that strategy's `components` verbatim so the boundary is a
   * self-contained description of what composing it would mean. Mirrors
   * `governAction()`'s "caller decides, this only records" rule over
   * `strategyOptionsEvaluation.selection` instead of
   * `strategyEvaluation.selection`: `decision` is exactly
   * `request.decision`, with the one mechanical rejection that `'ACT'` is
   * refused (task left unchanged) unless `selection.status === 'selected'`
   * (`MetaIntelligenceCompositionNotAuthorizableError`). `'WAIT'`/`'ASK'`/
   * `'SIMULATE'` may be recorded regardless of `selection.status`, exactly
   * as `governAction()` already allows. Rejects a second call for the same
   * task (`MetaIntelligenceCompositionAlreadyBoundError`), same
   * reject-on-duplicate convention as every other generation/evaluation/
   * governance step. Does NOT advance `stage` -- `compositionBoundary` is
   * an additive, orthogonal field, not an eleventh pipeline stage, and
   * does not touch `governance` or any frozen V1 field. Deliberately does
   * NOT execute, compose, verify, or adapt/re-plan anything beyond
   * recording this boundary -- a real execution-plan representation is
   * V2-C2's job.
   */
  authorizeComposition(id: string, request: MetaIntelligenceCompositionBoundaryRequest): MetaIntelligenceTask {
    const task = this.getTask(id);
    if (!task.strategyOptionsEvaluation) {
      throw new MetaIntelligenceTaskMissingStrategyOptionsEvaluationError(id);
    }
    if (task.compositionBoundary) {
      throw new MetaIntelligenceCompositionAlreadyBoundError(id);
    }

    const decision = request.decision;
    if (!GOVERNANCE_DECISIONS.includes(decision)) {
      throw new InvalidCompositionDecisionError(decision);
    }

    const selection = task.strategyOptionsEvaluation.selection;
    if (decision === 'ACT' && selection.status !== 'selected') {
      throw new MetaIntelligenceCompositionNotAuthorizableError(id);
    }

    // Resolve the selected strategy's components verbatim. Invariant
    // (enforced by evaluateStrategyOptions()): a 'selected' strategyId
    // always names a strategy present in strategies + strategyAlternatives
    // at evaluation time, and neither field is ever mutated afterward, so
    // the lookup below always succeeds when selection.status === 'selected'.
    let components: readonly MetaIntelligenceStrategyComponent[] | null = null;
    if (selection.status === 'selected') {
      const options: readonly MetaIntelligenceStrategy[] = [
        ...(task.strategies?.strategies ?? []),
        ...(task.strategyAlternatives?.strategies ?? []),
      ];
      const matched = options.find((option) => option.id === selection.strategyId);
      components = matched ? matched.components.map((component) => ({ ...component, providers: [...component.providers] })) : null;
    }

    const reason = request.reason?.trim();

    const compositionBoundary: MetaIntelligenceCompositionBoundary = {
      decision,
      selection: { ...selection },
      components,
      reason: reason ? reason : null,
      boundAt: new Date().toISOString(),
    };

    const updated: MetaIntelligenceTask = {
      ...task,
      compositionBoundary,
    };
    this.tasks.set(id, updated);
    return updated;
  }

  /**
   * V2-C2 (Phase C): derive the smallest additive execution-plan
   * representation of an already-`'ACT'`-authorized `compositionBoundary`
   * -- without a real execution runtime, a cognitive trace (V2-C3), or
   * verification/outcome analysis (V2-C4). See `MetaIntelligenceExecutionPlan`'s
   * doc comment for why this is a genuinely new, additive type rather
   * than a restatement of `compositionBoundary.components`: existence
   * itself is the new contract -- a plan is only derivable once
   * `decision === 'ACT'`, unlike `components`, which V2-C1 deliberately
   * populates for any decision over a `'selected'` strategy option.
   * Requires `compositionBoundary` to already be present
   * (`MetaIntelligenceTaskMissingCompositionBoundaryError`) and its
   * `decision` to be `'ACT'`
   * (`MetaIntelligenceExecutionPlanNotAuthorizedError`); rejects a second
   * call for the same task
   * (`MetaIntelligenceExecutionPlanAlreadyBuiltError`). Does NOT advance
   * `stage`, and does not touch `compositionBoundary`, `governance`, or
   * any other frozen field/method.
   */
  buildExecutionPlan(id: string): MetaIntelligenceTask {
    const task = this.getTask(id);
    if (!task.compositionBoundary) {
      throw new MetaIntelligenceTaskMissingCompositionBoundaryError(id);
    }
    if (task.executionPlan) {
      throw new MetaIntelligenceExecutionPlanAlreadyBuiltError(id);
    }
    if (task.compositionBoundary.decision !== 'ACT') {
      throw new MetaIntelligenceExecutionPlanNotAuthorizedError(id);
    }
    if (!task.compositionBoundary.components) {
      // Should be unreachable: authorizeComposition() only ever records
      // 'ACT' when selection.status === 'selected', which always resolves
      // components. Guarded explicitly rather than assumed (Law E).
      throw new MetaIntelligenceExecutionPlanComponentsMissingError(id);
    }

    const executionPlan: MetaIntelligenceExecutionPlan = {
      steps: task.compositionBoundary.components.map((component) => ({
        ...component,
        providers: [...component.providers],
      })),
      derivedAt: new Date().toISOString(),
    };

    const updated: MetaIntelligenceTask = {
      ...task,
      executionPlan,
    };
    this.tasks.set(id, updated);
    return updated;
  }

  /**
   * Stage 8 of the DoD pipeline ("Action Governance") only: record an
   * explicit ACT/WAIT/ASK/SIMULATE governance decision against an
   * already-`'strategy-evaluation'` task and advance it to
   * `'action-governance'`. The decision is exactly what `request.decision`
   * says — Meta-Intelligence does not choose among ACT/WAIT/ASK/SIMULATE
   * on its own — with one mechanical rejection: `'ACT'` is refused (and
   * the task left unchanged) unless the task's AWU-07
   * `strategyEvaluation.selection.status === 'selected'`. A verbatim copy
   * of that selection is stored on the recorded governance so the
   * decision stays traceable to exactly the AWU-07 outcome it gated, even
   * if later state changes. Deliberately does NOT execute, compose,
   * verify, or adapt/re-plan anything — recording the decision is not
   * carrying it out. Earlier-stage state, including `strategyEvaluation`,
   * is untouched.
   */
  governAction(id: string, request: MetaIntelligenceGovernanceRequest): MetaIntelligenceTask {
    const task = this.getTask(id);
    if (task.stage !== 'strategy-evaluation' || !task.strategyEvaluation) {
      throw new MetaIntelligenceTaskNotAtStrategyEvaluationStageError(id, task.stage);
    }

    const decision = request.decision;
    if (!GOVERNANCE_DECISIONS.includes(decision)) {
      throw new InvalidGovernanceDecisionError(decision);
    }

    const selection = task.strategyEvaluation.selection;
    if (decision === 'ACT' && selection.status !== 'selected') {
      throw new MetaIntelligenceActionNotSelectableError(id);
    }

    const reason = request.reason?.trim();

    const governance: MetaIntelligenceGovernance = {
      decision,
      selection: { ...selection },
      reason: reason ? reason : null,
      governedAt: new Date().toISOString(),
    };

    const updated: MetaIntelligenceTask = {
      ...task,
      stage: 'action-governance',
      governance,
    };
    this.tasks.set(id, updated);
    return updated;
  }

  /**
   * Stage 9 of the DoD pipeline ("Verification" + "Result") only: record
   * the caller's claimed outcome for an already-`'action-governance'`
   * task and mechanically verify it, advancing the task to
   * `'result-verification'`. Reachable only when `governance.decision`
   * is `'ACT'` or `'SIMULATE'` — `'WAIT'`/`'ASK'` defer the decision
   * itself, so there is nothing yet to have a result
   * (`MetaIntelligenceResultNotRepresentableError`). `status` is exactly
   * `request.status` (the caller's claim); `simulated` is derived from
   * `governance.decision`, never caller-supplied, so a caller can never
   * claim a `'SIMULATE'`-gated result was real or vice versa. Verification
   * is purely mechanical — see `verifyResult()` / `MetaIntelligenceVerificationOutcome`
   * — and never inspects `detail` or goal/constraint/known text, only
   * whether a basis is recorded. This stage does NOT execute or compose
   * the AWU-07 selection, and does NOT adapt or re-plan — recording and
   * verifying a claimed outcome is not carrying one out. Earlier-stage
   * state, including `governance`, is untouched.
   */
  recordResult(id: string, request: MetaIntelligenceResultRequest): MetaIntelligenceTask {
    const task = this.getTask(id);
    if (task.stage !== 'action-governance' || !task.governance) {
      throw new MetaIntelligenceTaskNotAtActionGovernanceStageError(id, task.stage);
    }

    const decision = task.governance.decision;
    if (!RESULTABLE_GOVERNANCE_DECISIONS.includes(decision)) {
      throw new MetaIntelligenceResultNotRepresentableError(id, decision);
    }

    const status = request.status;
    if (!RESULT_STATUSES.includes(status)) {
      throw new InvalidResultStatusError(status);
    }

    const detail = request.detail?.trim();
    const recordedAt = new Date().toISOString();

    const result: MetaIntelligenceResult = {
      status,
      simulated: decision === 'SIMULATE',
      detail: detail ? detail : null,
      recordedAt,
    };

    const outcome: MetaIntelligenceVerificationOutcome = verifyResult(status, task);
    const verification: MetaIntelligenceVerification = {
      outcome,
      goalIds: (task.goalsConstraints?.goals ?? []).map((g) => g.id),
      constraintIds: (task.goalsConstraints?.constraints ?? []).map((c) => c.id),
      knownIds: (task.epistemicTracking?.knowns ?? []).map((k) => k.id),
      verifiedAt: recordedAt,
    };

    const updated: MetaIntelligenceTask = {
      ...task,
      stage: 'result-verification',
      result,
      verification,
    };
    this.tasks.set(id, updated);
    return updated;
  }

  /**
   * V2-C4: records the caller's claimed outcome for an already-
   * `buildExecutionPlan()`'d task and mechanically verifies it against
   * the same AWU-03 goals/constraints and AWU-04 knowns `recordResult()`
   * already checks against -- additive alongside, and never touching,
   * the frozen V1 `recordResult()` / `result` / `verification` surface
   * (which continues to require `governance.decision` to be `'ACT'`/
   * `'SIMULATE'`).
   *
   * Per `.mi/DECISIONS.jsonl`: `recordResult()` is gated to the exact
   * `'action-governance'` stage and an already-recorded `governance`
   * field, so a task whose real decision path ran through
   * `compositionBoundary`/`executionPlan` (V2-C1/C2) instead of
   * `governAction()` can never reach `'action-governance'` and so could
   * never have an outcome recorded or verified at all -- the same
   * structural gap V2-B4 found for `evaluateStrategies()` and V2-C1
   * found for `governAction()`, one stage further down the pipeline.
   * Reuses `MetaIntelligenceResult`/`MetaIntelligenceVerification`/
   * `MetaIntelligenceResultRequest`/`MetaIntelligenceResultStatus`/
   * `MetaIntelligenceVerificationOutcome` verbatim (Law D -- none of
   * these shapes are governance-specific) and the exact same
   * `verifyResult()` basis-check logic (Law D again -- one verification
   * algorithm, not a parallel one). `simulated` is always `false`:
   * `buildExecutionPlan()` only ever derives a plan from an `'ACT'`-
   * decided `compositionBoundary` (V2-C2), so there is no `'SIMULATE'`-
   * equivalent case to represent here (an honest derivation, not an
   * invented default -- Law E). Requires `task.executionPlan` to already
   * be present; rejects a second call for the same task. Does not
   * advance `task.stage` (additive/orthogonal fields, not an eleventh
   * pipeline stage); does not touch `recordResult()`, `MetaIntelligenceResult`,
   * `MetaIntelligenceVerification`, `buildExecutionPlan()`,
   * `authorizeComposition()`, or any other frozen field/method. Does NOT
   * implement reflection or adaptation/re-plan integration over this new
   * outcome (V2-C5's job, mirroring `recordAdaptation()`'s own separate
   * stage).
   */
  recordExecutionOutcome(id: string, request: MetaIntelligenceResultRequest): MetaIntelligenceTask {
    const task = this.getTask(id);
    if (!task.executionPlan) {
      throw new MetaIntelligenceTaskMissingExecutionPlanError(id);
    }
    if (task.executionResult) {
      throw new MetaIntelligenceExecutionResultAlreadyRecordedError(id);
    }

    const status = request.status;
    if (!RESULT_STATUSES.includes(status)) {
      throw new InvalidResultStatusError(status);
    }

    const detail = request.detail?.trim();
    const recordedAt = new Date().toISOString();

    const executionResult: MetaIntelligenceResult = {
      status,
      // buildExecutionPlan() only ever derives a plan from an 'ACT'-decided
      // compositionBoundary -- there is no 'SIMULATE'-equivalent path here.
      simulated: false,
      detail: detail ? detail : null,
      recordedAt,
    };

    const outcome: MetaIntelligenceVerificationOutcome = verifyResult(status, task);
    const executionVerification: MetaIntelligenceVerification = {
      outcome,
      goalIds: (task.goalsConstraints?.goals ?? []).map((g) => g.id),
      constraintIds: (task.goalsConstraints?.constraints ?? []).map((c) => c.id),
      knownIds: (task.epistemicTracking?.knowns ?? []).map((k) => k.id),
      verifiedAt: recordedAt,
    };

    const updated: MetaIntelligenceTask = {
      ...task,
      executionResult,
      executionVerification,
    };
    this.tasks.set(id, updated);
    return updated;
  }

  /**
   * Stage 10 of the DoD pipeline ("Adaptation/Re-plan") only: record the
   * caller's chosen response to a not-succeeded-as-claimed verification
   * outcome, advancing an already-`'result-verification'` task to the
   * final `'adaptation'` stage. Reachable only when
   * `verification.outcome` is `'goals-not-met'` or `'insufficient-basis'`
   * (`MetaIntelligenceAdaptationNotRepresentableError` otherwise — a
   * supported success or a not-yet-executed task has nothing to adapt
   * to). `decision` is exactly `request.decision` — Meta-Intelligence
   * does not choose retry/re-plan/escalate/accept on its own, mirroring
   * `governAction()`'s "caller decides, this only records" rule. A
   * verbatim copy of `verification.outcome` is stored on the recorded
   * adaptation so the decision stays traceable to exactly the AWU-09
   * outcome it responds to, even if later state changes. Deliberately
   * does NOT execute, compose, re-execute, or automatically retry
   * anything — not even for a `'retry'`/`'re-plan'` decision — and does
   * NOT loop the task back to an earlier stage. Earlier-stage state,
   * including `result`/`verification`, is untouched.
   */
  recordAdaptation(id: string, request: MetaIntelligenceAdaptationRequest): MetaIntelligenceTask {
    const task = this.getTask(id);
    if (task.stage !== 'result-verification' || !task.verification) {
      throw new MetaIntelligenceTaskNotAtResultVerificationStageError(id, task.stage);
    }

    const outcome = task.verification.outcome;
    if (!ADAPTABLE_VERIFICATION_OUTCOMES.includes(outcome)) {
      throw new MetaIntelligenceAdaptationNotRepresentableError(id, outcome);
    }
    const adaptableOutcome = outcome as MetaIntelligenceAdaptableVerificationOutcome;

    const decision = request.decision;
    if (!ADAPTATION_DECISIONS.includes(decision)) {
      throw new InvalidAdaptationDecisionError(decision);
    }

    const reason = request.reason?.trim();

    const adaptation: MetaIntelligenceAdaptation = {
      decision,
      outcome: adaptableOutcome,
      reason: reason ? reason : null,
      adaptedAt: new Date().toISOString(),
    };

    const updated: MetaIntelligenceTask = {
      ...task,
      stage: 'adaptation',
      adaptation,
    };
    this.tasks.set(id, updated);
    return updated;
  }

  /**
   * V2-C5: records the caller's chosen retry/re-plan/escalate/accept
   * response to an already-`recordExecutionOutcome()`'d task's
   * `executionVerification.outcome` -- additive alongside, and never
   * touching, the frozen V1 `recordAdaptation()` / `adaptation` surface
   * (which continues to require `task.stage === 'result-verification'`).
   *
   * Per `.mi/DECISIONS.jsonl`: `recordAdaptation()` is gated to the exact
   * `'result-verification'` stage and an already-recorded `verification`
   * field, but no V2-B/C additive method ever advances `task.stage` or
   * sets `verification` -- so a task whose real outcome was recorded via
   * `recordExecutionOutcome()` (V2-C4) instead of the frozen V1
   * `recordResult()` could never reach `'result-verification'` and so
   * could never have an adaptation decision recorded at all -- the exact
   * structural reachability gap V2-C4 found for `recordResult()` and
   * V2-C1 found for `governAction()`, one stage further down the
   * pipeline. Reuses `MetaIntelligenceAdaptation` /
   * `MetaIntelligenceAdaptationRequest` / `MetaIntelligenceAdaptationDecision`
   * / `MetaIntelligenceAdaptableVerificationOutcome` verbatim (Law D, One
   * Epistemic Language -- none of these shapes are stage-specific; this
   * is the first V2 AWU to need neither a new type nor even a new field
   * shape, only a new field/method pairing). Requires
   * `task.executionVerification` to already be present
   * (`MetaIntelligenceTaskMissingExecutionVerificationError` otherwise);
   * requires its `outcome` to be `'goals-not-met'` or `'insufficient-basis'`
   * (`MetaIntelligenceExecutionAdaptationNotRepresentableError` otherwise
   * -- mirrors `MetaIntelligenceAdaptationNotRepresentableError`'s own
   * rule); rejects a second call
   * (`MetaIntelligenceExecutionAdaptationAlreadyRecordedError`). Does not
   * advance `task.stage` (additive/orthogonal field, not an eleventh
   * pipeline stage). Deliberately does NOT execute, compose, re-execute,
   * or automatically retry anything, even for a `'retry'`/`'re-plan'`
   * decision (Law E, Evidence Honesty -- mirrors `recordAdaptation()`'s
   * own precedent exactly); does not touch `recordAdaptation()`,
   * `MetaIntelligenceTask.adaptation`, `recordExecutionOutcome()`,
   * `getCognitiveTrace()`, or any other frozen field/method.
   */
  recordExecutionAdaptation(id: string, request: MetaIntelligenceAdaptationRequest): MetaIntelligenceTask {
    const task = this.getTask(id);
    if (!task.executionVerification) {
      throw new MetaIntelligenceTaskMissingExecutionVerificationError(id);
    }
    if (task.executionAdaptation) {
      throw new MetaIntelligenceExecutionAdaptationAlreadyRecordedError(id);
    }

    const outcome = task.executionVerification.outcome;
    if (!ADAPTABLE_VERIFICATION_OUTCOMES.includes(outcome)) {
      throw new MetaIntelligenceExecutionAdaptationNotRepresentableError(id, outcome);
    }
    const adaptableOutcome = outcome as MetaIntelligenceAdaptableVerificationOutcome;

    const decision = request.decision;
    if (!ADAPTATION_DECISIONS.includes(decision)) {
      throw new InvalidAdaptationDecisionError(decision);
    }

    const reason = request.reason?.trim();

    const executionAdaptation: MetaIntelligenceAdaptation = {
      decision,
      outcome: adaptableOutcome,
      reason: reason ? reason : null,
      adaptedAt: new Date().toISOString(),
    };

    const updated: MetaIntelligenceTask = {
      ...task,
      executionAdaptation,
    };
    this.tasks.set(id, updated);
    return updated;
  }

  /**
   * V2-A2: a read-only, purely-derived `MetaIntelligenceProblemRepresentation`
   * for an existing task — composes `problem`/`understanding`/
   * `goalsConstraints`/`epistemicTracking` into one view, wrapping each
   * optional field (other than `problem`, which is never absent) in a
   * `MetaIntelligencePresence` so a stage the task has not reached yet is
   * explicit absence, never a silently-defaulted empty value. Reads only;
   * never mutates the task, and computes nothing beyond copying existing
   * fields. Throws `MetaIntelligenceTaskNotFoundError` if `id` is absent,
   * same as `getTask()`.
   */
  /**
   * V2-C3: a single, ordered, machine-readable record of the reasoning
   * path this task has actually taken so far -- one entry per
   * `MetaIntelligenceTask` field the task has reached, in fixed pipeline
   * order, each carrying that field's own timestamp (verbatim) and the
   * ids its own recorded content actually names (never invented). Purely
   * derived and read-only; never stored on the task. Available at any
   * point in a task's life -- no equivalent of `buildExecutionPlan()`'s
   * `'ACT'`-only gate applies here. See `MetaIntelligenceCognitiveTrace`
   * (types.ts) for the full rationale.
   *
   * V2-C5 housekeeping: also composes the two V2-C4 fields
   * (`executionResult`/`executionVerification`), deliberately deferred by
   * V2-C4's own `.mi/NEXT.json` to that AWU -- purely additive to this
   * method's OUTPUT for tasks that have them; no existing entry's
   * field/recordedAt/idsTouched value or ordering changed for tasks that
   * predate V2-C4.
   *
   * V2-D1 housekeeping: now also composes `executionAdaptation` (V2-C5's
   * own new field, deliberately deferred by V2-C5's own `.mi/NEXT.json`
   * to this AWU) -- purely additive to this method's OUTPUT for tasks
   * that have it; no existing entry's field/recordedAt/idsTouched value
   * or ordering changes for tasks that predate V2-C5. Mirrors the frozen
   * V1 `adaptation` entry's own `idsTouched: []` convention, since
   * `MetaIntelligenceAdaptation` carries no id-bearing content.
   */
  getCognitiveTrace(id: string): MetaIntelligenceCognitiveTrace {
    const task = this.getTask(id);
    const entries: MetaIntelligenceCognitiveTraceEntry[] = [];

    entries.push({ field: 'problem', recordedAt: task.problem.receivedAt, idsTouched: [] });

    if (task.understanding) {
      entries.push({ field: 'understanding', recordedAt: task.understanding.understoodAt, idsTouched: [] });
    }
    if (task.goalsConstraints) {
      entries.push({
        field: 'goalsConstraints',
        recordedAt: task.goalsConstraints.recordedAt,
        idsTouched: [
          ...task.goalsConstraints.goals.map((g) => g.id),
          ...task.goalsConstraints.constraints.map((c) => c.id),
        ],
      });
    }
    if (task.epistemicTracking) {
      entries.push({
        field: 'epistemicTracking',
        recordedAt: task.epistemicTracking.recordedAt,
        idsTouched: [
          ...task.epistemicTracking.knowns.map((i) => i.id),
          ...task.epistemicTracking.unknowns.map((i) => i.id),
          ...task.epistemicTracking.assumptions.map((i) => i.id),
          ...task.epistemicTracking.evidence.map((i) => i.id),
        ],
      });
    }
    if (task.capabilityDecomposition) {
      entries.push({
        field: 'capabilityDecomposition',
        recordedAt: task.capabilityDecomposition.decomposedAt,
        idsTouched: task.capabilityDecomposition.requirements.map((r) => r.id),
      });
    }
    if (task.candidateStrategies) {
      entries.push({
        field: 'candidateStrategies',
        recordedAt: task.candidateStrategies.generatedAt,
        idsTouched: task.candidateStrategies.candidates.map((c) => c.id),
      });
    }
    if (task.strategies) {
      entries.push({
        field: 'strategies',
        recordedAt: task.strategies.generatedAt,
        idsTouched: task.strategies.strategies.map((s) => s.id),
      });
    }
    if (task.strategyAlternatives) {
      entries.push({
        field: 'strategyAlternatives',
        recordedAt: task.strategyAlternatives.generatedAt,
        idsTouched: task.strategyAlternatives.strategies.map((s) => s.id),
      });
    }
    if (task.strategyEvaluation) {
      entries.push({
        field: 'strategyEvaluation',
        recordedAt: task.strategyEvaluation.evaluatedAt,
        idsTouched:
          task.strategyEvaluation.selection.status === 'selected'
            ? [task.strategyEvaluation.selection.candidateId]
            : [],
      });
    }
    if (task.strategyOptionsEvaluation) {
      entries.push({
        field: 'strategyOptionsEvaluation',
        recordedAt: task.strategyOptionsEvaluation.evaluatedAt,
        idsTouched:
          task.strategyOptionsEvaluation.selection.status === 'selected'
            ? [task.strategyOptionsEvaluation.selection.strategyId]
            : [],
      });
    }
    if (task.governance) {
      entries.push({
        field: 'governance',
        recordedAt: task.governance.governedAt,
        idsTouched:
          task.governance.selection.status === 'selected' ? [task.governance.selection.candidateId] : [],
      });
    }
    if (task.compositionBoundary) {
      entries.push({
        field: 'compositionBoundary',
        recordedAt: task.compositionBoundary.boundAt,
        idsTouched:
          task.compositionBoundary.selection.status === 'selected'
            ? [task.compositionBoundary.selection.strategyId]
            : [],
      });
    }
    if (task.executionPlan) {
      entries.push({
        field: 'executionPlan',
        recordedAt: task.executionPlan.derivedAt,
        idsTouched: task.executionPlan.steps.map((s) => s.requirementId),
      });
    }
    if (task.executionResult) {
      entries.push({ field: 'executionResult', recordedAt: task.executionResult.recordedAt, idsTouched: [] });
    }
    if (task.executionVerification) {
      entries.push({
        field: 'executionVerification',
        recordedAt: task.executionVerification.verifiedAt,
        idsTouched: [
          ...task.executionVerification.goalIds,
          ...task.executionVerification.constraintIds,
          ...task.executionVerification.knownIds,
        ],
      });
    }
    if (task.executionAdaptation) {
      entries.push({ field: 'executionAdaptation', recordedAt: task.executionAdaptation.adaptedAt, idsTouched: [] });
    }
    if (task.result) {
      entries.push({ field: 'result', recordedAt: task.result.recordedAt, idsTouched: [] });
    }
    if (task.verification) {
      entries.push({
        field: 'verification',
        recordedAt: task.verification.verifiedAt,
        idsTouched: [
          ...task.verification.goalIds,
          ...task.verification.constraintIds,
          ...task.verification.knownIds,
        ],
      });
    }
    if (task.adaptation) {
      entries.push({ field: 'adaptation', recordedAt: task.adaptation.adaptedAt, idsTouched: [] });
    }

    return {
      taskId: task.id,
      stage: task.stage,
      entries,
      derivedAt: new Date().toISOString(),
    };
  }

  getProblemRepresentation(id: string): MetaIntelligenceProblemRepresentation {
    const task = this.getTask(id);
    return {
      taskId: task.id,
      stage: task.stage,
      problem: task.problem,
      understanding: presence(task.understanding),
      goalsConstraints: presence(task.goalsConstraints),
      epistemicTracking: presence(task.epistemicTracking),
      derivedAt: new Date().toISOString(),
    };
  }

  /** Look up a task by id. Throws MetaIntelligenceTaskNotFoundError if absent. */
  getTask(id: string): MetaIntelligenceTask {
    const task = this.tasks.get(id);
    if (!task) throw new MetaIntelligenceTaskNotFoundError(id);
    return task;
  }

  /** Look up a task by id without throwing. */
  tryGetTask(id: string): MetaIntelligenceTask | undefined {
    return this.tasks.get(id);
  }

  /** Every task currently tracked by this orchestrator, in intake order. */
  listTasks(): MetaIntelligenceTask[] {
    return Array.from(this.tasks.values());
  }

  /** Number of tasks currently tracked. */
  get size(): number {
    return this.tasks.size;
  }
}
