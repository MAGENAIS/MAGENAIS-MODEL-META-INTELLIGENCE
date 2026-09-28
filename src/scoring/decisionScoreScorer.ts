/**
 * decisionScoreScorer.ts (Meta-Intelligence, AWU-07)
 *
 * The default scorer for `MetaIntelligenceOrchestrator.evaluateStrategies()`:
 * the existing DecisionScore pipeline (validateInput -> scoreAndRank ->
 * computeDSI -> computeDFP), composed synchronously from DecisionScore's
 * own exported pure functions with the same steps and defaults as
 * `DecisionScoreModel.execute()`. No scoring logic lives here — this is
 * only the wiring, so Meta-Intelligence reuses DecisionScore rather than
 * growing a parallel scoring model. It does NOT go through
 * `DecisionScoreModel.execute()` because that is async and this
 * orchestrator is synchronous. The standalone package has no equivalent
 * file (zero-dependency policy): its callers pass their own scorer.
 */

import { validateInput, scoreAndRank } from './DecisionScoreAlgorithm.ts';
import { computeDSI, computeDFP } from './DecisionStability.ts';
import type { DecisionScoreInput, DecisionScoreOutput, DecisionScoreRunOptions } from '../contract.ts';

/** Run DecisionScore over `input`. Throws `DecisionScoreValidationError` on malformed input (never repairs it). */
export function scoreWithDecisionScore(
  input: DecisionScoreInput,
  options: DecisionScoreRunOptions = {}
): DecisionScoreOutput {
  validateInput(input);

  const { ranking } = scoreAndRank(input);
  const topOptionId = ranking[0]?.optionId ?? null;

  const { dsi } = topOptionId
    ? computeDSI(input, topOptionId, {
        trials: options.perturbationTrials,
        magnitude: options.perturbationMagnitude,
        seed: options.seed,
      })
    : { dsi: 1 };

  const dfp = topOptionId
    ? computeDFP(input, topOptionId, {
        maxRange: options.maxFlipSearchRange,
        step: options.flipSearchStep,
      })
    : [];

  return { ranking, topOptionId, dsi, dfp };
}
