/**
 * contract.ts
 *
 * The small, self-contained set of shared shapes this package needs so it
 * has ZERO dependency on MAGENAIS itself (it can be cloned, installed and
 * used entirely on its own):
 *
 *  - `ModelManifest` / `FailureMode` — the subset of the MAGENAIS manifest
 *    contract that this package's `model.json` is shaped against. Kept in
 *    sync with `schemas/model-manifest.schema.json` (a vendored copy of the
 *    MAGENAIS-MODELS schema); `tests/manifest.test.ts` validates `model.json`
 *    against that schema.
 *  - `CapabilityGraphLike` — the one method of MAGENAIS's `CapabilityGraph`
 *    that capability decomposition calls (structural / duck-typed).
 *  - The DecisionScore input/output shapes exchanged with a strategy scorer.
 *    They are the canonical definitions inside this package; they are
 *    structurally identical to MAGENAIS's DecisionScore types, so a scorer
 *    from either side is interchangeable.
 *
 * Meta-Intelligence is deliberately NOT a `Model<TInput, TOutput>`: it is a
 * stateful, multi-call orchestrator over a task lifecycle, not a single
 * `execute(request) -> response` prediction. There is therefore no
 * `ModelRequest` / `ModelResponse` here (see docs/integration.md).
 */

export type ModelType = 'algorithm' | 'ml' | 'llm' | 'vision' | 'audio' | 'graph' | 'hybrid';
export type ModelPricingType = 'free' | 'paid' | 'freemium' | 'enterprise';
export type ModelTrustLevel = 'magenais-verified' | 'community-verified' | 'experimental' | 'unverified';

export type FailureModeCategory =
  | 'false-positive'
  | 'false-negative'
  | 'degradation'
  | 'malformed-input'
  | 'edge-case'
  | 'adversarial'
  | 'dependency-failure'
  | 'unsupported-condition';

/** A declared way the component can fail and what it does when that happens. */
export interface FailureMode {
  id: string;
  description: string;
  behavior?: string;
  category?: FailureModeCategory;
}

/** The manifest fields this package declares (all V4.1 fields plus the V5 cognitive-contract fields it uses). */
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
  demo?: string;
  layer?: 'primitive' | 'native-model' | 'composite-model' | 'cognitive-system';
  family?: string;
  purpose?: string;
  problem?: string;
  nonGoals?: string[];
  inputs?: Array<{ type: string; description?: string; required?: boolean; schemaRef?: string }>;
  outputs?: Array<{ type: string; description?: string; required?: boolean; schemaRef?: string }>;
  dependencies?: { requiresCapabilities?: string[]; optionalCapabilities?: string[]; requiresModels?: string[] };
  executionMode?: 'synchronous' | 'asynchronous' | 'streaming' | 'batch';
  resourceRequirements?: {
    compute?: string;
    memory?: string;
    gpu?: boolean;
    network?: boolean;
    externalApi?: boolean;
    latencyExpectation?: string;
  };
  scientificStatus?: 'established' | 'emerging' | 'experimental' | 'speculative';
  evidenceLevel?: 'none' | 'unit-tested' | 'benchmarked' | 'baseline-compared' | 'ablated';
  limitations?: string[];
  failureModes?: FailureMode[];
  benchmarkIds?: string[];
  verificationStatus?: 'not-ready' | 'gate-passed' | 'verified';
  composability?: { independentlyExecutable: boolean; composesWith?: string[]; providesCapabilityTo?: string[] };
  provenance?: { origin?: string; createdAt?: string; basedOn?: string[]; benchmarkedAtCodeVersion?: string };
  implementationStatus?: 'designed' | 'partial' | 'implemented' | 'deprecated';
  cognitivePassport?: string;
  modelCard?: string;
}

/**
 * Structural mirror of the one `CapabilityGraph` query capability
 * decomposition needs (`providersOf()`). A real MAGENAIS `CapabilityGraph`
 * satisfies it as-is; standalone callers can pass any object with this
 * method, e.g. `{ providersOf: (c) => table[c] ?? [] }`.
 */
export interface CapabilityGraphLike {
  /** Model/provider ids declaring they provide the given capability. Empty array if none do. */
  providersOf(capability: string): string[];
}

/**
 * DecisionScore input/output shapes exchanged with a strategy scorer
 * (`MetaIntelligenceStrategyScorer`). The bundled default scorer
 * (`scoreWithDecisionScore`) and any caller-supplied scorer use these.
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
