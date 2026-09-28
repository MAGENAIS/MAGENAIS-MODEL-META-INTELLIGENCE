/**
 * @magenais/meta-intelligence/benchmark
 *
 * Benchmark, regression and ablation tooling for Meta-Intelligence V2. This is
 * a separate subpath so the core library stays free of tooling code.
 *
 *  - the generic engine (runner, statistics, baseline comparator, ablation
 *    runner, failure analyzer) and its types;
 *  - the pipeline benchmark: 51 deterministic cases covering pipeline
 *    correctness, V2 mechanics and strategy-generation/selection quality;
 *  - the fail-open guard ablations over that benchmark (a sensitivity check,
 *    not a component-removal ablation).
 */

export type {
  BenchmarkCaseCategory,
  SubjectInvocation,
  BenchmarkSubject,
  SubjectDescriptor,
  BenchmarkCase,
  CaseScore,
  CaseScorer,
  BenchmarkDefinition,
  CaseResult,
  StatSummary,
  ReproducibilityRecord,
  BenchmarkRunResult,
  MetricComparison,
  BaselineComparison,
  AblationResult,
  FailureBreakdown,
} from './types.ts';

export { summarize, pairedDeltas, mean, MismatchedLengthError } from './StatisticalAnalysis.ts';
export { runBenchmark } from './BenchmarkRunner.ts';
export type { RunOptions } from './BenchmarkRunner.ts';
export { compareResults } from './BaselineComparator.ts';
export { runAblation } from './AblationRunner.ts';
export { analyzeFailures } from './FailureAnalyzer.ts';

export {
  metaIntelligencePipelineBenchmark,
  metaIntelligencePipelineSubject,
  runMetaIntelligencePipelineBenchmark,
  META_INTELLIGENCE_SUBJECT_DESCRIPTOR,
  META_INTELLIGENCE_PIPELINE_BENCHMARK_ID,
  META_INTELLIGENCE_PIPELINE_BENCHMARK_VERSION,
  PROBES_FAILURE_MODES,
} from './PipelineBenchmark.ts';
export type { MetaIntelligenceScenarioOutcome } from './PipelineBenchmark.ts';

export { GUARD_ABLATIONS, ablatedPipelineSubject, runGuardAblations } from './PipelineAblation.ts';
export type { GuardAblation, GuardAblationReport } from './PipelineAblation.ts';
