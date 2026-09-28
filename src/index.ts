/**
 * @magenais/meta-intelligence — public API (V2).
 *
 * Everything a standalone consumer needs is exported from here. Nothing
 * else in `src/` is part of the public API: `scoring/` internals (other than
 * the default scorer and its validation error) and helper functions inside
 * the orchestrator module are deliberately not re-exported.
 *
 * The benchmark / regression / ablation tooling lives behind a separate
 * subpath (`@magenais/meta-intelligence/benchmark`).
 */

// ---- version / identity ------------------------------------------------
export { META_INTELLIGENCE_VERSION, META_INTELLIGENCE_MODEL_ID, META_INTELLIGENCE_URI } from './version.ts';

// ---- manifest (also published as model.json) ---------------------------
export { META_INTELLIGENCE_MANIFEST } from './manifest.ts';

// ---- shared contract shapes (manifest, capability graph, scorer I/O) ---
export type {
  ModelType,
  ModelPricingType,
  ModelTrustLevel,
  FailureModeCategory,
  FailureMode,
  ModelManifest,
  CapabilityGraphLike,
  DecisionScoreDirection,
  DecisionScoreOption,
  DecisionScoreCriterion,
  DecisionScoreMatrix,
  DecisionScoreInput,
  DecisionScoreRunOptions,
  DecisionScoreRankEntry,
  DecisionFlipPoint,
  DecisionScoreOutput,
} from './contract.ts';

// ---- task / stage / result types ---------------------------------------
export type {
  MetaIntelligenceStage,
  MetaIntelligenceProblem,
  MetaIntelligenceUnderstanding,
  MetaIntelligenceOrigin,
  MetaIntelligenceGoalOrConstraint,
  MetaIntelligenceGoalsConstraints,
  MetaIntelligenceEpistemicItem,
  MetaIntelligenceEpistemicTracking,
  MetaIntelligenceCapabilityRequirement,
  MetaIntelligenceCapabilityDecomposition,
  MetaIntelligenceCandidateStrategy,
  MetaIntelligenceCandidateStrategies,
  MetaIntelligenceStrategyComponent,
  MetaIntelligenceStrategyDerivation,
  MetaIntelligenceStrategy,
  MetaIntelligenceStrategies,
  MetaIntelligenceStrategyAlternatives,
  MetaIntelligenceTask,
  MetaIntelligenceIntakeRequest,
  MetaIntelligenceGoalOrConstraintInput,
  MetaIntelligenceGoalsConstraintsRequest,
  MetaIntelligenceEpistemicItemInput,
  MetaIntelligenceEpistemicTrackingRequest,
  MetaIntelligenceCapabilityRequirementInput,
  MetaIntelligenceCapabilityDecompositionRequest,
  MetaIntelligenceNoSelectionReason,
  MetaIntelligenceStrategySelection,
  MetaIntelligenceStrategyRankEntry,
  MetaIntelligenceStrategyEvaluation,
  MetaIntelligenceStrategyScorer,
  MetaIntelligenceStrategyEvaluationRequest,
  MetaIntelligenceStrategyOptionRankEntry,
  MetaIntelligenceStrategyOptionSelection,
  MetaIntelligenceStrategyOptionsEvaluation,
  MetaIntelligenceGovernanceDecision,
  MetaIntelligenceGovernance,
  MetaIntelligenceGovernanceRequest,
  MetaIntelligenceCompositionBoundary,
  MetaIntelligenceCompositionBoundaryRequest,
  MetaIntelligenceExecutionPlan,
  MetaIntelligenceCognitiveTraceEntry,
  MetaIntelligenceCognitiveTrace,
  MetaIntelligenceResultStatus,
  MetaIntelligenceResult,
  MetaIntelligenceResultRequest,
  MetaIntelligenceVerificationOutcome,
  MetaIntelligenceVerification,
  MetaIntelligenceAdaptableVerificationOutcome,
  MetaIntelligenceAdaptationDecision,
  MetaIntelligenceAdaptation,
  MetaIntelligenceAdaptationRequest,
  MetaIntelligencePresence,
  MetaIntelligenceProblemRepresentation,
} from './types.ts';

// ---- orchestrator and its typed errors ---------------------------------
export {
  MetaIntelligenceOrchestrator,
  EmptyProblemStatementError,
  MetaIntelligenceTaskAlreadyExistsError,
  MetaIntelligenceTaskNotFoundError,
  MetaIntelligenceTaskNotAtReceivedStageError,
  MetaIntelligenceTaskNotAtUnderstoodStageError,
  EmptyGoalOrConstraintTextError,
  MetaIntelligenceTaskNotAtGoalsConstraintsStageError,
  EmptyEpistemicItemTextError,
  MetaIntelligenceTaskNotAtEpistemicTrackingStageError,
  EmptyCapabilityRequirementError,
  MetaIntelligenceTaskNotAtCapabilityDecompositionStageError,
  MetaIntelligenceTaskMissingCapabilityDecompositionError,
  MetaIntelligenceStrategiesAlreadyGeneratedError,
  MetaIntelligenceStrategiesNotYetGeneratedError,
  MetaIntelligenceStrategyAlternativesAlreadyGeneratedError,
  MetaIntelligenceTaskMissingStrategiesError,
  MetaIntelligenceStrategyOptionsAlreadyEvaluatedError,
  MetaIntelligenceTaskNotAtCandidateStrategiesStageError,
  InvalidStrategyEvaluationError,
  InvalidStrategyOptionsEvaluationError,
  MetaIntelligenceTaskNotAtStrategyEvaluationStageError,
  InvalidGovernanceDecisionError,
  MetaIntelligenceActionNotSelectableError,
  MetaIntelligenceTaskMissingStrategyOptionsEvaluationError,
  MetaIntelligenceCompositionAlreadyBoundError,
  InvalidCompositionDecisionError,
  MetaIntelligenceCompositionNotAuthorizableError,
  MetaIntelligenceTaskMissingCompositionBoundaryError,
  MetaIntelligenceExecutionPlanAlreadyBuiltError,
  MetaIntelligenceExecutionPlanNotAuthorizedError,
  MetaIntelligenceExecutionPlanComponentsMissingError,
  MetaIntelligenceTaskNotAtActionGovernanceStageError,
  MetaIntelligenceResultNotRepresentableError,
  InvalidResultStatusError,
  MetaIntelligenceTaskMissingExecutionPlanError,
  MetaIntelligenceExecutionResultAlreadyRecordedError,
  MetaIntelligenceTaskNotAtResultVerificationStageError,
  MetaIntelligenceAdaptationNotRepresentableError,
  InvalidAdaptationDecisionError,
  MetaIntelligenceTaskMissingExecutionVerificationError,
  MetaIntelligenceExecutionAdaptationNotRepresentableError,
  MetaIntelligenceExecutionAdaptationAlreadyRecordedError,
} from './MetaIntelligenceOrchestrator.ts';

// ---- default strategy scorer (bundled DecisionScore algorithm) ---------
export { scoreWithDecisionScore } from './scoring/decisionScoreScorer.ts';
export { DecisionScoreValidationError } from './scoring/DecisionScoreAlgorithm.ts';
