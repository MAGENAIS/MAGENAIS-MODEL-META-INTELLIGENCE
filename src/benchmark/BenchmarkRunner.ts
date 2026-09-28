/**
 * BenchmarkRunner.ts
 *
 * V5 PHASE 2. Executes a `BenchmarkDefinition` against one
 * `BenchmarkSubject`, producing a `BenchmarkRunResult` with timing,
 * per-case scoring, aggregate metrics and a §32 reproducibility record.
 *
 * Runs cases sequentially and awaits each one before starting the next.
 * Benchmarks are diagnostic tooling run interactively or in CI, not a hot
 * path — sequential execution keeps per-case latency measurement honest
 * (no cases competing for the event loop) and keeps output deterministic
 * in the order cases were defined, which matters for §32 reproducibility.
 */

import type {
  BenchmarkDefinition,
  BenchmarkRunResult,
  BenchmarkSubject,
  CaseResult,
  ReproducibilityRecord,
  SubjectDescriptor,
  SubjectInvocation,
  StatSummary,
} from './types.ts';
import { summarize } from './StatisticalAnalysis.ts';

export interface RunOptions {
  /** Caller-supplied — see ReproducibilityRecord's own doc comment on why this is never auto-detected. */
  codeVersion?: string;
  configuration?: Record<string, unknown>;
  environment?: string;
  evaluationParameters?: Record<string, unknown>;
  /** Defaults to `new Date().toISOString()` at call time. */
  executionDate?: string;
}

function buildReproducibility(
  definition: BenchmarkDefinition<unknown, unknown, unknown>,
  subject: SubjectDescriptor,
  options: RunOptions
): ReproducibilityRecord {
  return {
    modelVersion: subject.version,
    codeVersion: options.codeVersion,
    benchmarkVersion: definition.version,
    configuration: options.configuration,
    inputSetId: `${definition.id}@${definition.cases.length}-cases`,
    executionDate: options.executionDate ?? new Date().toISOString(),
    environment: options.environment,
    evaluationParameters: options.evaluationParameters,
  };
}

/** Union of every metric name reported by at least one case. */
function collectMetricNames(cases: readonly CaseResult[]): string[] {
  const names = new Set<string>();
  for (const c of cases) for (const key of Object.keys(c.metrics)) names.add(key);
  return Array.from(names);
}

function aggregateMetrics(cases: readonly CaseResult[]): Record<string, StatSummary> {
  const out: Record<string, StatSummary> = {};
  for (const name of collectMetricNames(cases)) {
    const values = cases.filter((c) => name in c.metrics).map((c) => c.metrics[name]);
    out[name] = summarize(values);
  }
  return out;
}

function computePassRate(cases: readonly CaseResult[]): number | undefined {
  const withPassed = cases.filter((c) => c.passed !== undefined);
  if (withPassed.length === 0) return undefined;
  return withPassed.filter((c) => c.passed === true).length / withPassed.length;
}

/**
 * Run a benchmark definition against one subject. Every case runs even if
 * an earlier one throws — a benchmark's job is to characterize failure,
 * not stop at the first one (§27).
 */
export async function runBenchmark<TInput, TOutput, TExpected>(
  definition: BenchmarkDefinition<TInput, TOutput, TExpected>,
  subject: BenchmarkSubject<TInput, TOutput>,
  subjectDescriptor: SubjectDescriptor,
  options: RunOptions = {}
): Promise<BenchmarkRunResult> {
  const results: CaseResult[] = [];

  for (const testCase of definition.cases) {
    const start = Date.now();
    try {
      const invocation: SubjectInvocation<TOutput> = await subject(testCase.input);
      const latencyMs = Date.now() - start;
      const scored = definition.score(invocation, testCase.expected, testCase.input);
      results.push({
        caseId: testCase.id,
        category: testCase.category,
        passed: scored.passed,
        metrics: scored.metrics ?? {},
        latencyMs,
        notes: scored.notes,
      });
    } catch (err) {
      const latencyMs = Date.now() - start;
      results.push({
        caseId: testCase.id,
        category: testCase.category,
        passed: false,
        metrics: {},
        latencyMs,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return {
    benchmarkId: definition.id,
    benchmarkVersion: definition.version,
    subject: subjectDescriptor,
    cases: results,
    aggregateMetrics: aggregateMetrics(results),
    latency: summarize(results.map((r) => r.latencyMs)),
    passRate: computePassRate(results),
    reproducibility: buildReproducibility(
      definition as BenchmarkDefinition<unknown, unknown, unknown>,
      subjectDescriptor,
      options
    ),
  };
}
