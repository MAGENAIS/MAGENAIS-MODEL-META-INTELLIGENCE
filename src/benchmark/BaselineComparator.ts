/**
 * BaselineComparator.ts
 *
 * V5 PHASE 2. Implements V5 MASTER PROMPT §11's mandatory comparison:
 * BASELINE vs BASELINE+MODEL / WITHOUT MODEL vs WITH MODEL / MODEL A vs
 * MODEL A + MODEL B. Takes two `BenchmarkRunResult`s produced by the SAME
 * `BenchmarkDefinition` (so the case ids line up) and computes per-metric
 * deltas over whatever cases both runs actually share.
 *
 * Cases are matched BY ID, not by array position — a subject that throws
 * on one case and produces no metrics for it should not silently shift
 * every later case out of alignment. Cases present on only one side are
 * reported in `unmatchedCaseIds` rather than dropped without a trace.
 *
 * This module computes deltas. It does not decide whether a delta is
 * "meaningful" — see StatisticalAnalysis.ts's header for why no
 * significance test is attached, and read the deltas yourself.
 */

import type {
  BaselineComparison,
  BenchmarkRunResult,
  CaseResult,
  MetricComparison,
} from './types.ts';
import { summarize, pairedDeltas } from './StatisticalAnalysis.ts';

function indexById(cases: readonly CaseResult[]): Map<string, CaseResult> {
  return new Map(cases.map((c) => [c.caseId, c] as const));
}

function compareMetric(
  metric: string,
  matchedCaseIds: readonly string[],
  baselineById: Map<string, CaseResult>,
  treatmentById: Map<string, CaseResult>
): MetricComparison | undefined {
  // Only cases where BOTH sides reported this exact metric name contribute —
  // a metric one subject doesn't emit can't be compared for that case.
  const caseIds = matchedCaseIds.filter(
    (id) => metric in (baselineById.get(id)?.metrics ?? {}) && metric in (treatmentById.get(id)?.metrics ?? {})
  );
  if (caseIds.length === 0) return undefined;

  const baselineValues = caseIds.map((id) => baselineById.get(id)!.metrics[metric]);
  const treatmentValues = caseIds.map((id) => treatmentById.get(id)!.metrics[metric]);
  const deltas = pairedDeltas(baselineValues, treatmentValues);

  return {
    metric,
    baseline: summarize(baselineValues),
    treatment: summarize(treatmentValues),
    meanDelta: deltas.reduce((s, d) => s + d, 0) / deltas.length,
    deltas,
  };
}

/** Wraps latencyMs into a synthetic `.metrics` map so `compareMetric`'s logic can be reused for it too. */
function withLatencyAsMetric(caseResult: CaseResult): CaseResult {
  return { ...caseResult, metrics: { __latencyMs: caseResult.latencyMs } };
}

/**
 * Compare a baseline run against a treatment run of the SAME benchmark
 * definition. Order matters only for labeling (`baselineSubject` vs
 * `treatmentSubject`) and for delta sign (`treatment - baseline`, so a
 * positive delta on an "improvement is higher" metric means the treatment
 * did better).
 */
export function compareResults(baseline: BenchmarkRunResult, treatment: BenchmarkRunResult): BaselineComparison {
  const baselineById = indexById(baseline.cases);
  const treatmentById = indexById(treatment.cases);

  const matchedCaseIds = baseline.cases.map((c) => c.caseId).filter((id) => treatmentById.has(id));
  const onlyInBaseline = baseline.cases.map((c) => c.caseId).filter((id) => !treatmentById.has(id));
  const onlyInTreatment = treatment.cases.map((c) => c.caseId).filter((id) => !baselineById.has(id));

  const metricNames = new Set<string>();
  for (const id of matchedCaseIds) {
    for (const key of Object.keys(baselineById.get(id)!.metrics)) metricNames.add(key);
    for (const key of Object.keys(treatmentById.get(id)!.metrics)) metricNames.add(key);
  }

  const metrics = Array.from(metricNames)
    .map((name) => compareMetric(name, matchedCaseIds, baselineById, treatmentById))
    .filter((m): m is MetricComparison => m !== undefined);

  const latencyBaselineById = new Map(
    matchedCaseIds.map((id) => [id, withLatencyAsMetric(baselineById.get(id)!)] as const)
  );
  const latencyTreatmentById = new Map(
    matchedCaseIds.map((id) => [id, withLatencyAsMetric(treatmentById.get(id)!)] as const)
  );
  const latencyComparison = compareMetric('__latencyMs', matchedCaseIds, latencyBaselineById, latencyTreatmentById) ?? {
    metric: '__latencyMs',
    baseline: summarize([]),
    treatment: summarize([]),
    meanDelta: 0,
    deltas: [],
  };

  const passRateDelta =
    baseline.passRate !== undefined && treatment.passRate !== undefined
      ? treatment.passRate - baseline.passRate
      : undefined;

  return {
    baselineSubject: baseline.subject,
    treatmentSubject: treatment.subject,
    matchedCaseIds,
    unmatchedCaseIds: { onlyInBaseline, onlyInTreatment },
    metrics,
    latency: { ...latencyComparison, metric: 'latencyMs' },
    passRateDelta,
  };
}
