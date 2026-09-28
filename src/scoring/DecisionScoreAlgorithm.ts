/**
 * DecisionScoreAlgorithm.ts
 *
 * Pure, deterministic multi-criteria scoring: a normalized weighted-sum
 * model (SAW — Simple Additive Weighting). No randomness lives here; the
 * only randomized piece (perturbation sampling for DSI) lives in
 * DecisionStability.ts, which calls back into these pure functions.
 *
 * Kept dependency-free and side-effect-free on purpose so it can later
 * become the independent MAGENAIS-MODEL-DECISION-SCORE package without
 * needing to be rewritten (MASTER PROMPT §28).
 */

import type {
  DecisionScoreInput,
  DecisionScoreCriterion,
  DecisionScoreMatrix,
  DecisionScoreRankEntry,
} from '../contract.ts';

export class DecisionScoreValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DecisionScoreValidationError';
  }
}

/** Throws DecisionScoreValidationError on any structural or data problem. Never silently repairs input. */
export function validateInput(input: DecisionScoreInput): void {
  if (!input || typeof input !== 'object') {
    throw new DecisionScoreValidationError('Input must be an object with options, criteria, and scores.');
  }
  if (!Array.isArray(input.options) || input.options.length === 0) {
    throw new DecisionScoreValidationError('At least one option is required.');
  }
  if (!Array.isArray(input.criteria) || input.criteria.length === 0) {
    throw new DecisionScoreValidationError('At least one criterion is required.');
  }

  const optionIds = new Set<string>();
  for (const option of input.options) {
    if (!option || typeof option.id !== 'string' || option.id.length === 0) {
      throw new DecisionScoreValidationError('Every option must have a non-empty string id.');
    }
    if (optionIds.has(option.id)) {
      throw new DecisionScoreValidationError(`Duplicate option id: "${option.id}".`);
    }
    optionIds.add(option.id);
  }

  const criterionIds = new Set<string>();
  let weightSum = 0;
  for (const criterion of input.criteria) {
    if (!criterion || typeof criterion.id !== 'string' || criterion.id.length === 0) {
      throw new DecisionScoreValidationError('Every criterion must have a non-empty string id.');
    }
    if (criterionIds.has(criterion.id)) {
      throw new DecisionScoreValidationError(`Duplicate criterion id: "${criterion.id}".`);
    }
    if (typeof criterion.weight !== 'number' || !Number.isFinite(criterion.weight) || criterion.weight < 0) {
      throw new DecisionScoreValidationError(`Criterion "${criterion.id}" must have a finite weight >= 0.`);
    }
    if (criterion.direction !== 'maximize' && criterion.direction !== 'minimize') {
      throw new DecisionScoreValidationError(
        `Criterion "${criterion.id}" direction must be "maximize" or "minimize".`
      );
    }
    weightSum += criterion.weight;
    criterionIds.add(criterion.id);
  }
  if (weightSum <= 0) {
    throw new DecisionScoreValidationError('At least one criterion must have a positive weight.');
  }

  if (!input.scores || typeof input.scores !== 'object') {
    throw new DecisionScoreValidationError('scores must be an object keyed by option id.');
  }
  for (const option of input.options) {
    const row = input.scores[option.id];
    if (!row || typeof row !== 'object') {
      throw new DecisionScoreValidationError(`Missing scores for option "${option.id}".`);
    }
    for (const criterion of input.criteria) {
      const value = row[criterion.id];
      if (typeof value !== 'number' || !Number.isFinite(value)) {
        throw new DecisionScoreValidationError(
          `Missing or non-numeric score for option "${option.id}", criterion "${criterion.id}".`
        );
      }
    }
  }
}

/** Normalized weights (sum to 1) keyed by criterion id. Assumes validateInput() already passed. */
export function normalizeWeights(criteria: DecisionScoreCriterion[]): Map<string, number> {
  const total = criteria.reduce((sum, c) => sum + c.weight, 0);
  const weights = new Map<string, number>();
  for (const c of criteria) {
    weights.set(c.id, total > 0 ? c.weight / total : 0);
  }
  return weights;
}

/**
 * Min-max normalizes each criterion's column to [0, 1], flipping the scale
 * for "minimize" criteria so that 1 always means "best" regardless of
 * direction. A criterion with identical scores across every option
 * (max === min) is a non-discriminating column: every option gets 1 for
 * it rather than dividing by zero, and this case is surfaced by the caller
 * as a warning, not an error.
 */
export function normalizeScoreMatrix(
  options: { id: string }[],
  criteria: DecisionScoreCriterion[],
  scores: DecisionScoreMatrix
): { normalized: DecisionScoreMatrix; constantCriteria: string[] } {
  const normalized: DecisionScoreMatrix = {};
  for (const option of options) normalized[option.id] = {};
  const constantCriteria: string[] = [];

  for (const criterion of criteria) {
    const values = options.map((o) => scores[o.id][criterion.id]);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = max - min;

    if (range === 0) {
      constantCriteria.push(criterion.id);
      for (const option of options) normalized[option.id][criterion.id] = 1;
      continue;
    }

    for (const option of options) {
      const raw = scores[option.id][criterion.id];
      const scaled = (raw - min) / range;
      normalized[option.id][criterion.id] = criterion.direction === 'maximize' ? scaled : 1 - scaled;
    }
  }

  return { normalized, constantCriteria };
}

/** Weighted sum of an already-normalized score matrix. Returns a score in [0, 1] per option id. */
export function computeWeightedScores(
  options: { id: string }[],
  criteria: DecisionScoreCriterion[],
  normalizedScores: DecisionScoreMatrix,
  weights: Map<string, number>
): Map<string, number> {
  const result = new Map<string, number>();
  for (const option of options) {
    let total = 0;
    for (const criterion of criteria) {
      total += (weights.get(criterion.id) ?? 0) * normalizedScores[option.id][criterion.id];
    }
    result.set(option.id, total);
  }
  return result;
}

/**
 * Ranks options by descending score. Ties keep the input option order
 * (stable sort) and share consecutive ranks based on position, not on
 * score equality — this keeps rank assignment simple and deterministic;
 * exactly-tied scores are visible to callers via the `score` field itself.
 */
export function rankOptions(
  options: { id: string; name?: string }[],
  scores: Map<string, number>
): DecisionScoreRankEntry[] {
  return options
    .map((o) => ({ optionId: o.id, name: o.name, score: scores.get(o.id) ?? 0 }))
    .sort((a, b) => b.score - a.score)
    .map((entry, index) => ({ ...entry, rank: index + 1 }));
}

/** End-to-end: normalize weights + scores, compute weighted scores, and rank. */
export function scoreAndRank(
  input: DecisionScoreInput,
  weightOverrides?: Map<string, number>
): { ranking: DecisionScoreRankEntry[]; constantCriteria: string[] } {
  const weights = weightOverrides ?? normalizeWeights(input.criteria);
  const { normalized, constantCriteria } = normalizeScoreMatrix(input.options, input.criteria, input.scores);
  const scores = computeWeightedScores(input.options, input.criteria, normalized, weights);
  const ranking = rankOptions(input.options, scores);
  return { ranking, constantCriteria };
}
