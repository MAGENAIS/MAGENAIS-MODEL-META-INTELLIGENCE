/**
 * MetaIntelligenceOrchestrator.ts (standalone package copy)
 *
 * Kept in sync by hand with
 * `MAGENAIS-main/src/ModelsHub/meta-intelligence/MetaIntelligenceOrchestrator.ts`.
 * Do not let this drift silently — if the MAGENAIS-main version changes,
 * update this copy in the same change.
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
 * `CapabilityGraph`-shaped object (`CapabilityGraphLike`, see
 * `contract.ts`) passed in by the caller, records which capabilities
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
 * Bookkeeping-only, mirroring `ModelRegistry`'s register/get/list shape
 * (reject-on-duplicate id, throw-on-missing lookup) for a consistent
 * feel with the rest of the Models Hub — but over tasks, not models, and
 * with no lazy-construction concern since a task is plain data.
 */

import type {
  DecisionFlipPoint,
  DecisionScoreMatrix,
} from './contract';
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
  MetaIntelligenceEpistemicItem,
  MetaIntelligenceEpistemicItemInput,
  MetaIntelligenceEpistemicTracking,
  MetaIntelligenceEpistemicTrackingRequest,
  MetaIntelligenceGoalOrConstraint,
  MetaIntelligenceGoalOrConstraintInput,
  MetaIntelligenceGoalsConstraints,
  MetaIntelligenceGoalsConstraintsRequest,
  MetaIntelligenceGovernance,
  MetaIntelligenceGovernanceDecision,
  MetaIntelligenceGovernanceRequest,
  MetaIntelligenceIntakeRequest,
  MetaIntelligenceNoSelectionReason,
  MetaIntelligenceResult,
  MetaIntelligenceResultRequest,
  MetaIntelligenceResultStatus,
  MetaIntelligenceStrategyEvaluation,
  MetaIntelligenceStrategyEvaluationRequest,
  MetaIntelligenceStrategyRankEntry,
  MetaIntelligenceStrategyScorer,
  MetaIntelligenceStrategySelection,
  MetaIntelligenceTask,
  MetaIntelligenceUnderstanding,
  MetaIntelligenceVerification,
  MetaIntelligenceVerificationOutcome,
} from './types';
import type { CapabilityGraphLike } from './contract';

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
 * `CapabilityGraphLike` (see `contract.ts` for why this repo mirrors
 * rather than imports MAGENAIS-main's `CapabilityGraph`). `capability`
 * text is kept verbatim (only trimmed) —
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
   * a caller-supplied list of required capabilities against `graph` (a
   * `CapabilityGraphLike` — e.g. an actual MAGENAIS-main `CapabilityGraph`
   * built from the live `ModelRegistry`, which already satisfies this
   * shape; see `contract.ts`) and advance an already-`'epistemic-tracking'` task to
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
    scorer: MetaIntelligenceStrategyScorer
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
