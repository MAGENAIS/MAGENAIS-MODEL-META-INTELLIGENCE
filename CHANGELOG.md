# Changelog

All notable changes to this project will be documented in this file.
Format loosely follows [Keep a Changelog](https://keepachangelog.com/), and
this project uses [Semantic Versioning](https://semver.org/), independent
of MAGENAIS's own version.

## [Unreleased]

### Added

- `recordAdaptation()` (AWU-10): records the caller's chosen response
  (`'retry'` | `'re-plan'` | `'escalate'` | `'accept'`) to a verification
  outcome that indicates the task did NOT succeed as claimed, advancing
  an already-`'result-verification'` task to `'adaptation'` — the tenth
  and final stage of the Definition-of-Done pipeline. Reachable only when
  `verification.outcome` is `'goals-not-met'` or `'insufficient-basis'`;
  `'verified-against-basis'` (a supported success) and `'not-verifiable'`
  (nothing has happened yet) are refused (task left unchanged) since
  neither is a case of "did not succeed as claimed". `decision` is
  exactly what the caller requests — Meta-Intelligence does not choose
  retry/re-plan/escalate/accept on its own, mirroring `governAction()`'s
  pattern. The recorded adaptation carries a verbatim copy of the
  verification outcome it responds to (not a live reference), so the
  decision stays traceable even if later state changes. Executes,
  composes, re-executes, and automatically retries nothing — not even for
  a `'retry'`/`'re-plan'` decision, and the task is never looped back to
  an earlier stage; `'adaptation'` is a new forward-only terminal stage.
  Earlier-stage state, including `result`/`verification`, is untouched.
- Types: `MetaIntelligenceStage` gains `'adaptation'`;
  `MetaIntelligenceAdaptableVerificationOutcome`,
  `MetaIntelligenceAdaptationDecision`, `MetaIntelligenceAdaptation`,
  `MetaIntelligenceAdaptationRequest`; errors
  `MetaIntelligenceTaskNotAtResultVerificationStageError`,
  `MetaIntelligenceAdaptationNotRepresentableError`,
  `InvalidAdaptationDecisionError`. `MetaIntelligenceTask` gains an
  optional `adaptation` field.
- `recordResult()` (AWU-09): records the caller's claimed outcome
  (`'succeeded'` | `'failed'` | `'not-yet-executed'`) for an
  already-`'action-governance'` task, advancing it to
  `'result-verification'`. Reachable only when `governance.decision` is
  `'ACT'` or `'SIMULATE'` — `'WAIT'`/`'ASK'` are refused (task left
  unchanged), since a deferred decision has nothing to have a result yet.
  `status` is exactly the caller's claim; `simulated` is NOT
  caller-supplied — it's mechanically derived from `governance.decision`
  (`true` iff `'SIMULATE'`), so a caller can never claim a
  `'SIMULATE'`-gated result was real or vice versa. Alongside the result,
  a verification outcome is computed purely mechanically from `status`
  and the task's own AWU-03 goals/constraints and AWU-04 knowns — never a
  bare "verified" claim with no stated basis: `'not-yet-executed'` →
  `'not-verifiable'`; `'failed'` → `'goals-not-met'` (a failed result
  cannot satisfy any goal — a mechanical entailment, not a semantic
  judgement about *why* it failed); `'succeeded'` → `'verified-against-basis'`
  only if the task has at least one recorded goal-or-constraint AND at
  least one recorded known to check against, else `'insufficient-basis'`.
  The goal/constraint/known ids checked are recorded alongside the
  outcome so it stays traceable. Executes, composes, and adapts nothing;
  earlier-stage state, including `governance`, is untouched.
- Types: `MetaIntelligenceStage` gains `'result-verification'`;
  `MetaIntelligenceResultStatus`, `MetaIntelligenceResult`,
  `MetaIntelligenceResultRequest`, `MetaIntelligenceVerificationOutcome`,
  `MetaIntelligenceVerification`; errors
  `MetaIntelligenceTaskNotAtActionGovernanceStageError`,
  `MetaIntelligenceResultNotRepresentableError`,
  `InvalidResultStatusError`. `MetaIntelligenceTask` gains optional
  `result` and `verification` fields.
- `governAction()` (AWU-08): records an explicit, caller-supplied
  ACT/WAIT/ASK/SIMULATE governance decision against an
  already-`'strategy-evaluation'` task, advancing it to
  `'action-governance'`. The decision is exactly what the caller
  requests — Meta-Intelligence does not choose among ACT/WAIT/ASK/
  SIMULATE on its own — with one mechanical rejection: `'ACT'` is
  refused (task left unchanged) unless the task's AWU-07
  `strategyEvaluation.selection.status === 'selected'`; a task with no
  selection, or an explicit `'none selected'`, can never be governed to
  `'ACT'`. The recorded governance carries a verbatim copy of the
  selection it gates (not a live reference), so the decision stays
  traceable to the exact AWU-07 outcome even if later state changes.
  Executes, verifies, and adapts nothing.
- Types: `MetaIntelligenceStage` gains `'action-governance'`;
  `MetaIntelligenceGovernanceDecision`, `MetaIntelligenceGovernance`,
  `MetaIntelligenceGovernanceRequest`; errors
  `MetaIntelligenceTaskNotAtStrategyEvaluationStageError`,
  `InvalidGovernanceDecisionError`,
  `MetaIntelligenceActionNotSelectableError`. `MetaIntelligenceTask`
  gains an optional `governance` field.

## [0.1.0] — not yet released

Prepared during the MAGENAIS V5 Meta-Intelligence build, AWU-01 through
AWU-07. Not yet published as a GitHub repository — this is the working
scaffold created alongside those AWUs.

### Added

- `MetaIntelligenceOrchestrator` (AWU-01): `intake()` records a caller's
  problem statement verbatim under a task id, at stage `'received'`.
  Bookkeeping-only (register/get/list, reject-on-duplicate id,
  throw-on-missing lookup).
- `understand()` (AWU-02): mechanical whitespace normalization of an
  already-`'received'` task's statement, advancing it to `'understood'`.
  The verbatim statement is read, never rewritten.
- `addGoalsConstraints()` (AWU-03): records a caller's goals and
  constraints against an already-`'understood'` task, advancing it to
  `'goals-constraints'`. Each item is tagged with its origin (`'caller'`
  vs `'extracted'`), and origins are never merged or silently rewritten
  into each other.
- `addEpistemicTracking()` (AWU-04): records a caller's knowns, unknowns,
  assumptions, and evidence against an already-`'goals-constraints'`
  task, advancing it to `'epistemic-tracking'`. Each of the four is
  tracked as its own list, and every item is tagged with the same
  `'caller'` / `'extracted'` origin used by goals/constraints — never
  merged or silently rewritten into each other.
- `decomposeCapabilities()` (AWU-05): checks a caller-supplied list of
  required capabilities against a `CapabilityGraph`-shaped object
  (`CapabilityGraphLike`, see `src/contract.ts`) against an
  already-`'epistemic-tracking'` task, advancing it to
  `'capability-decomposition'`. Each requirement is tagged with the same
  `'caller'` / `'extracted'` origin as every earlier stage, and records
  the provider model ids the graph reports plus whether any exist. An
  unmet capability is recorded as a de-duplicated **gap**, not rejected
  as an error — this is capability gap detection, not strategy
  generation or selection.
- `generateCandidateStrategies()` (AWU-06): builds a minimal set of
  candidate strategies from an already-`'capability-decomposition'`
  task's own decomposition, advancing it to `'candidate-strategies'`. One
  candidate is created per **satisfied** requirement (in requirement
  order), pointing back at it by `requirementId` and carrying a copy of
  its `providers`; gap requirements yield no candidate and stay visible
  as `capabilityDecomposition.gaps`. Candidates carry no score, rank, or
  `selected` flag and no single provider is chosen — evaluation and
  selection remain unimplemented (AWU-07).
- `evaluateStrategies()` (AWU-07): scores an already-`'candidate-strategies'`
  task's candidates with a DecisionScore-shaped scorer
  (`MetaIntelligenceStrategyScorer`; option id = candidate id; criteria,
  weights, and per-candidate scores supplied by the caller) and records
  an explicit selection, advancing the task to `'strategy-evaluation'`.
  The top-ranked candidate is selected unless there are no candidates
  (`'no-candidates'`; scorer not called), the top two tie
  (`'tie-for-top'`), or the caller's optional `minStability` exceeds the
  DSI (`'below-stability-threshold'`) — each recorded as
  `{ status: 'none', reason }`. The scorer result is verified to trace
  back to the task's candidates; on any failure the task is left
  unchanged. Selects a candidate only — no provider is chosen and nothing is
  executed. Earlier-stage state is untouched. In MAGENAIS-main the scorer
  defaults to the real DecisionScore functions; this package has zero
  dependencies, so the scorer is a required parameter.
- Types: `MetaIntelligenceStage` gains `'strategy-evaluation'`;
  `MetaIntelligenceStrategyEvaluation`, `MetaIntelligenceStrategySelection`,
  `MetaIntelligenceNoSelectionReason`, `MetaIntelligenceStrategyRankEntry`,
  `MetaIntelligenceStrategyScorer`,
  `MetaIntelligenceStrategyEvaluationRequest`; errors
  `MetaIntelligenceTaskNotAtCandidateStrategiesStageError` and
  `InvalidStrategyEvaluationError`. `contract.ts` gains structural
  mirrors of the DecisionScore input/output shapes.
- Contract types (`types.ts`): `MetaIntelligenceStage` (`'received'` |
  `'understood'` | `'goals-constraints'` | `'epistemic-tracking'` |
  `'capability-decomposition'` | `'candidate-strategies'`),
  `MetaIntelligenceProblem`, `MetaIntelligenceUnderstanding`,
  `MetaIntelligenceOrigin`, `MetaIntelligenceGoalOrConstraint`,
  `MetaIntelligenceGoalsConstraints`, `MetaIntelligenceEpistemicItem`,
  `MetaIntelligenceEpistemicTracking`,
  `MetaIntelligenceCapabilityRequirement`,
  `MetaIntelligenceCapabilityDecomposition`,
  `MetaIntelligenceCandidateStrategy`,
  `MetaIntelligenceCandidateStrategies`, `MetaIntelligenceTask`,
  `MetaIntelligenceIntakeRequest`,
  `MetaIntelligenceGoalOrConstraintInput`,
  `MetaIntelligenceGoalsConstraintsRequest`,
  `MetaIntelligenceEpistemicItemInput`,
  `MetaIntelligenceEpistemicTrackingRequest`,
  `MetaIntelligenceCapabilityRequirementInput`,
  `MetaIntelligenceCapabilityDecompositionRequest`.
- `CapabilityGraphLike` (`contract.ts`, AWU-05): a self-contained,
  structural mirror of the one `CapabilityGraph` query method
  (`providersOf()`) `decomposeCapabilities()` needs, so this package
  keeps zero dependency on MAGENAIS-main while still accepting an actual
  `CapabilityGraph` instance unchanged (it already satisfies the shape).
- Unit tests covering: verbatim intake, empty/whitespace-only rejection,
  generated vs. caller-supplied ids, duplicate-id rejection,
  get/tryGet/list/size bookkeeping, whitespace normalization, a
  not-found lookup, re-`understand()` rejection, goals/constraints
  recording with origin tracking, empty goal/constraint text rejection,
  out-of-order/re-call rejection for `addGoalsConstraints()`,
  known/unknown/assumption/evidence recording with origin tracking,
  empty epistemic-item text rejection, out-of-order/re-call rejection
  for `addEpistemicTracking()`, capability-requirement decomposition
  against a graph (satisfied + gap cases), gap de-duplication, empty
  capability-name rejection, out-of-order/re-call rejection for
  `decomposeCapabilities()`, candidate-strategy generation (one per
  satisfied requirement, gaps excluded, earlier-stage state unchanged,
  no score/rank/selection fields, provider list copied, empty and
  repeated-capability cases), out-of-order/re-call rejection for
  `generateCandidateStrategies()`, and independence between separate
  orchestrator instances, and evaluation/selection (selected, no-candidates,
  tie, stability threshold, invalid threshold, out-of-order/re-call
  rejection, scorer failure leaves task unchanged, scorer result
  traceability, request copying, no execution/verification/adaptation).
- `model.json` manifest, Apache-2.0 `LICENSE`, `SECURITY.md`,
  `CONTRIBUTING.md`.

### Not yet implemented

Real execution/composition, and any real re-execution or automatic retry
of a `recordAdaptation()` decision — see README.md's Status table. The
Definition-of-Done pipeline itself (AWU-01 through AWU-10) is now fully
represented; benchmarking and live integration/registration remain later
AWUs in the MAGENAIS-main build (see that repository's `.mi/`).
