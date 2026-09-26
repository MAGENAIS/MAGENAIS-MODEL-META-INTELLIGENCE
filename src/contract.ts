/**
 * contract.ts
 *
 * A self-contained copy of the small portion of the MAGENAIS Model
 * contract (ModelManifest) that this package's `model.json` is shaped
 * against, so this repo has ZERO dependency on MAGENAIS itself and can
 * be cloned, installed, and read entirely on its own.
 *
 * NOTE: unlike DecisionScore/PatternSense/AnomalyMind, this package does
 * NOT yet implement the Model interface (`execute(request): Promise<
 * ModelResponse>`). Meta-Intelligence, as of this repo's current
 * version, is an orchestrator over its own task lifecycle
 * (`intake()` / `understand()`), not a single-shot Model the router can
 * invoke — see README.md's "Status" section. This file therefore only
 * mirrors `ModelManifest`, not the full Model/ModelRequest/ModelResponse
 * set the sibling repos copy. Byte-for-byte alignment with those repos'
 * `contract.ts` is intentionally deferred until Meta-Intelligence has an
 * `execute()` boundary to describe (see the build's AWU-08 action-
 * governance step).
 */

export type ModelType = 'algorithm' | 'ml' | 'llm' | 'vision' | 'audio' | 'graph' | 'hybrid';
export type ModelPricingType = 'free' | 'paid' | 'freemium' | 'enterprise';
export type ModelTrustLevel = 'magenais-verified' | 'community-verified' | 'experimental' | 'unverified';

export interface ModelManifest {
  id: string;
  name: string;
  version: string;
  description: string;
  author: { name: string; organization?: string };
  type: ModelType;
  capabilities: string[];
  runtimes: string[];
  license: { type: string; url?: string };
  pricing: { type: ModelPricingType };
  trust: ModelTrustLevel;
  uri?: string;
  repository?: string;
  documentation?: string;
}

/**
 * AWU-05: a self-contained mirror of the one `CapabilityGraph` query
 * method `decomposeCapabilities()` needs
 * (`MAGENAIS-main/src/ModelsHub/graph/CapabilityGraph.ts`'s
 * `providersOf()`), for the same zero-dependency reason `ModelManifest`
 * above is mirrored rather than imported. This is a structural
 * (duck-typed) interface, not a class: a real `CapabilityGraph` instance
 * from MAGENAIS-main already satisfies it as-is (it has a `providersOf`
 * method with this exact signature), so passing one in from a caller
 * that *does* depend on MAGENAIS-main works unchanged — this package
 * just doesn't need to import the class to describe what it calls on
 * it. Keep this signature in sync by hand with `CapabilityGraph`'s own
 * `providersOf()` if that ever changes.
 */
export interface CapabilityGraphLike {
  /** Model ids declaring they provide the given capability. Empty array if none do. */
  providersOf(capability: string): string[];
}

/**
 * AWU-07: self-contained structural mirrors of the DecisionScore shapes
 * (`MAGENAIS-main/src/ModelsHub/decision-score/types.ts`) that
 * `evaluateStrategies()` sends to / receives from its scorer, mirrored
 * rather than imported for the same zero-dependency reason as
 * `CapabilityGraphLike` above. They deliberately keep the real names so
 * `types.ts` reads identically in both repos. A real DecisionScore
 * scorer from MAGENAIS-main (`scoreWithDecisionScore`) already satisfies
 * `MetaIntelligenceStrategyScorer` structurally. Keep these in sync by
 * hand with the originals if those ever change; the mirror covers only the
 * fields Meta-Intelligence reads or passes through.
 */
export type DecisionScoreDirection = 'maximize' | 'minimize';

export interface DecisionScoreOption {
  id: string;
  name?: string;
}

export interface DecisionScoreCriterion {
  id: string;
  name?: string;
  /** Relative importance, >= 0; normalized internally by DecisionScore. */
  weight: number;
  direction: DecisionScoreDirection;
}

/** scores[optionId][criterionId] = raw numeric score. */
export type DecisionScoreMatrix = Record<string, Record<string, number>>;

export interface DecisionScoreInput {
  options: DecisionScoreOption[];
  criteria: DecisionScoreCriterion[];
  scores: DecisionScoreMatrix;
  constraints?: string[];
}

export interface DecisionScoreRunOptions {
  perturbationTrials?: number;
  perturbationMagnitude?: number;
  seed?: number;
  maxFlipSearchRange?: number;
  flipSearchStep?: number;
}

export interface DecisionScoreRankEntry {
  optionId: string;
  name?: string;
  score: number;
  rank: number;
}

export interface DecisionFlipPoint {
  criterionId: string;
  criterionName?: string;
  direction: 'increase' | 'decrease';
  relativeChange: number | null;
  challengerOptionId: string | null;
}

export interface DecisionScoreOutput {
  ranking: DecisionScoreRankEntry[];
  topOptionId: string | null;
  dsi: number;
  dfp: DecisionFlipPoint[];
}
