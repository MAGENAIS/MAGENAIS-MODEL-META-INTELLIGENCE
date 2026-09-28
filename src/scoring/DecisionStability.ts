/**
 * DecisionStability.ts
 *
 * Decision Stability Index (DSI) and Decision Flip Point (DFP), per MASTER
 * PROMPT §8. Both are sensitivity estimates under tested assumptions, not
 * guarantees — every caller-facing output must carry that caveat.
 *
 * DSI needs randomized perturbation sampling; to keep results reproducible
 * (MASTER PROMPT §37's "deterministic output" requirement), it uses a small
 * seeded PRNG rather than Math.random(). DFP is a deterministic sweep and
 * needs no randomness at all.
 */

import { normalizeWeights, scoreAndRank } from './DecisionScoreAlgorithm.ts';
import type { DecisionScoreInput, DecisionScoreCriterion, DecisionFlipPoint } from '../contract.ts';

export const DEFAULT_PERTURBATION_TRIALS = 200;
export const DEFAULT_PERTURBATION_MAGNITUDE = 0.2;
export const DEFAULT_SEED = 42;
export const DEFAULT_MAX_FLIP_SEARCH_RANGE = 5;
export const DEFAULT_FLIP_SEARCH_STEP = 0.05;

export const SENSITIVITY_DISCLAIMER =
  'This is a sensitivity estimate under tested assumptions. It is not a guarantee.';

/** mulberry32 — small, fast, deterministic PRNG. Same seed always produces the same sequence. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return function next() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Returns a copy of criteria with each weight multiplied by an independent random factor in [1 - magnitude, 1 + magnitude]. */
function perturbCriteria(
  criteria: DecisionScoreCriterion[],
  magnitude: number,
  rng: () => number
): DecisionScoreCriterion[] {
  return criteria.map((c) => {
    const factor = 1 + (rng() * 2 - 1) * magnitude;
    return { ...c, weight: Math.max(0, c.weight * factor) };
  });
}

/**
 * DSI: proportion of `trials` random weight perturbations under which the
 * top-ranked option (by id) stays the same as the unperturbed baseline.
 * Deterministic for a given (input, options.seed) pair.
 */
export function computeDSI(
  input: DecisionScoreInput,
  baselineTopId: string,
  opts: { trials?: number; magnitude?: number; seed?: number } = {}
): { dsi: number; trials: number } {
  const trials = opts.trials ?? DEFAULT_PERTURBATION_TRIALS;
  const magnitude = opts.magnitude ?? DEFAULT_PERTURBATION_MAGNITUDE;
  const rng = mulberry32(opts.seed ?? DEFAULT_SEED);

  if (input.options.length <= 1) {
    // A single option can never "flip" — it is trivially always the top choice.
    return { dsi: 1, trials };
  }

  let unchanged = 0;
  for (let i = 0; i < trials; i++) {
    const perturbed = perturbCriteria(input.criteria, magnitude, rng);
    const weights = normalizeWeights(perturbed);
    const { ranking } = scoreAndRank(input, weights);
    if (ranking[0]?.optionId === baselineTopId) unchanged++;
  }

  return { dsi: trials > 0 ? unchanged / trials : 1, trials };
}

/**
 * DFP: for each criterion, sweep its weight up and down (renormalizing the
 * rest proportionally, since weights must still sum to 1) to find the
 * smallest relative change that flips the top-ranked option. Reports the
 * smaller (more sensitive) of the increase/decrease directions per
 * criterion, sorted most-sensitive-first.
 */
export function computeDFP(
  input: DecisionScoreInput,
  baselineTopId: string,
  opts: { maxRange?: number; step?: number } = {}
): DecisionFlipPoint[] {
  const maxRange = opts.maxRange ?? DEFAULT_MAX_FLIP_SEARCH_RANGE;
  const step = opts.step ?? DEFAULT_FLIP_SEARCH_STEP;

  if (input.options.length <= 1) {
    return input.criteria.map((c) => ({
      criterionId: c.id,
      criterionName: c.name,
      direction: 'increase' as const,
      relativeChange: null,
      challengerOptionId: null,
    }));
  }

  const results: DecisionFlipPoint[] = [];

  for (const criterion of input.criteria) {
    const increase = sweepForFlip(input, criterion, baselineTopId, 'increase', maxRange, step);
    const decrease = sweepForFlip(input, criterion, baselineTopId, 'decrease', maxRange, step);

    const candidates = [increase, decrease].filter((c) => c.relativeChange !== null);
    const best =
      candidates.length > 0
        ? candidates.reduce((a, b) => ((a.relativeChange as number) <= (b.relativeChange as number) ? a : b))
        : increase; // both null — report the increase direction with relativeChange: null

    results.push(best);
  }

  return results.sort((a, b) => {
    if (a.relativeChange === null && b.relativeChange === null) return 0;
    if (a.relativeChange === null) return 1;
    if (b.relativeChange === null) return -1;
    return a.relativeChange - b.relativeChange;
  });
}

function sweepForFlip(
  input: DecisionScoreInput,
  target: DecisionScoreCriterion,
  baselineTopId: string,
  direction: 'increase' | 'decrease',
  maxRange: number,
  step: number
): DecisionFlipPoint {
  const sign = direction === 'increase' ? 1 : -1;

  for (let delta = step; delta <= maxRange + 1e-9; delta += step) {
    const relativeChange = sign * delta;
    // A weight can't go below 0; clamp the decrease sweep there and stop.
    const factor = 1 + relativeChange;
    if (factor < 0) break;

    const adjusted = input.criteria.map((c) =>
      c.id === target.id ? { ...c, weight: Math.max(0, c.weight * factor) } : c
    );
    const weights = normalizeWeights(adjusted);
    const { ranking } = scoreAndRank(input, weights);
    const newTop = ranking[0]?.optionId;

    if (newTop && newTop !== baselineTopId) {
      return {
        criterionId: target.id,
        criterionName: target.name,
        direction,
        relativeChange: Math.round(delta * 1000) / 1000,
        challengerOptionId: newTop,
      };
    }
  }

  return {
    criterionId: target.id,
    criterionName: target.name,
    direction,
    relativeChange: null,
    challengerOptionId: null,
  };
}
