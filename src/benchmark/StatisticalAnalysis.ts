/**
 * StatisticalAnalysis.ts
 *
 * V5 PHASE 2. Dependency-free descriptive statistics for benchmark
 * results and baseline/ablation comparisons.
 *
 * SCOPE, STATED DELIBERATELY: this module computes descriptive statistics
 * (mean, sample standard deviation, median, min, max) and paired
 * differences. IT DOES NOT COMPUTE A P-VALUE, CONFIDENCE INTERVAL, OR ANY
 * OTHER INFERENTIAL STATISTIC, and it never will.
 *
 * Why: V5 MASTER PROMPT §7 requires scientific discipline and forbids
 * unsupported claims. A hand-rolled significance test run against the
 * small, hand-built case sets typical of an early benchmark would produce
 * a number that LOOKS rigorous — a p-value, a confidence interval — while
 * resting on assumptions (independence, distribution shape, adequate
 * sample size) this module has no way to verify and a benchmark author has
 * no reason to have satisfied. Reporting such a number is false precision:
 * worse than reporting the raw deltas plainly, because it invites a reader
 * to treat "the model helps" as statistically established when it is not.
 *
 * §11 asks whether a model "provides meaningful value" — this module
 * supplies the numbers a reader needs to judge that for themselves
 * (`summarize`, `pairedDeltas`), and stops there. If genuine statistical
 * inference is needed later (a large benchmark, a real experiment), that
 * calls for a real statistics library, not an extension of this file.
 */

import type { StatSummary } from './types.ts';

/** Empty-input summary: every field 0, meaning "no data", not "the data is 0". */
const EMPTY_SUMMARY: StatSummary = { n: 0, mean: 0, stdDev: 0, median: 0, min: 0, max: 0 };

/**
 * Descriptive statistics over a list of numbers. Uses the SAMPLE standard
 * deviation (dividing by n-1), which is 0 for n <= 1 by convention (there
 * is no variance to estimate from a single point).
 */
export function summarize(values: readonly number[]): StatSummary {
  const n = values.length;
  if (n === 0) return { ...EMPTY_SUMMARY };

  const mean = values.reduce((sum, v) => sum + v, 0) / n;

  let stdDev = 0;
  if (n > 1) {
    const variance = values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / (n - 1);
    stdDev = Math.sqrt(variance);
  }

  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  const median = sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];

  return { n, mean, stdDev, median, min: sorted[0], max: sorted[sorted.length - 1] };
}

export class MismatchedLengthError extends Error {
  constructor(baselineLength: number, treatmentLength: number) {
    super(
      `pairedDeltas requires equal-length arrays (baseline: ${baselineLength}, treatment: ${treatmentLength}). ` +
        'Match cases by id before computing deltas — see BaselineComparator.ts.'
    );
    this.name = 'MismatchedLengthError';
  }
}

/**
 * Per-index (treatment - baseline) differences. Callers are responsible
 * for ensuring the two arrays are in the SAME case order — this function
 * has no notion of case identity; BaselineComparator.ts does that matching
 * before calling this.
 */
export function pairedDeltas(baseline: readonly number[], treatment: readonly number[]): number[] {
  if (baseline.length !== treatment.length) {
    throw new MismatchedLengthError(baseline.length, treatment.length);
  }
  return baseline.map((b, i) => treatment[i] - b);
}

/** Mean of an array, or 0 for an empty one (matching summarize's empty-input convention). */
export function mean(values: readonly number[]): number {
  return values.length === 0 ? 0 : values.reduce((sum, v) => sum + v, 0) / values.length;
}
