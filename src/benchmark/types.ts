/**
 * types.ts (benchmark)
 *
 * V5 PHASE 2 (Benchmark & Baseline Engine). The types behind V5 MASTER
 * PROMPT §25 (Benchmark Architecture), §11 (Baseline Comparison), §26
 * (Controlled Ablation) and §32 (Research Reproducibility).
 *
 * DESIGN PRINCIPLE — §11: "Do not force a universal score. Different
 * cognitive capabilities require different metrics." Every result here is
 * a named `Record<string, number>` rather than a single scalar. Nothing
 * in this module computes an aggregate "intelligence score", and nothing
 * ever will — nothing in this file is asked to.
 *
 * DESIGN PRINCIPLE — §25 lists test categories explicitly (deterministic,
 * scenario, adversarial, stress, longitudinal). `BenchmarkCaseCategory`
 * names them directly so a benchmark's own case mix is visible rather than
 * folded into one undifferentiated list.
 *
 * WHAT THIS MODULE DOES NOT DO, on purpose:
 *   - No statistical significance testing (see StatisticalAnalysis.ts's
 *     own header for why a hand-rolled p-value would be false precision).
 *   - No coupling to ProviderManager or any specific model type. A
 *     `BenchmarkSubject` is a plain async function; `subjectFromModel()`
 *     in BenchmarkRunner.ts is the only place that touches the `Model`
 *     interface, and even that is a thin adapter, not a dependency this
 *     module needs.
 *   - No external-provider calling machinery. `SubjectDescriptor.kind`
 *     includes `'external-target'` so a result can be TAGGED as evaluating
 *     an external system (§22/§23 "must support... external AI systems"),
 *     but actually calling one through ProviderManager is the External
 *     Evaluation Layer's job — a later phase, not this one.
 */

/** A capability tag. Free-form string (MAGENAIS's `ModelCapability` is a string union with an open tail). */
type ModelCapability = string;

/** §25's own list of test categories, named directly rather than collapsed into one bucket. */
export type BenchmarkCaseCategory = 'deterministic' | 'scenario' | 'adversarial' | 'stress' | 'longitudinal';

/**
 * What a subject invocation returns. Confidence is a distinct field, not
 * folded into `output`, because a calibration benchmark (does reported
 * confidence track actual reliability?) needs to score it directly without
 * knowing anything about the model's specific output shape.
 */
export interface SubjectInvocation<TOutput = unknown> {
  output: TOutput;
  /** 0-1 confidence, if the subject reports one. Absent, not 0, when none is given. */
  confidence?: number;
}

/**
 * A benchmark subject: anything that can be asked to produce an output for
 * a given input. Deliberately NOT typed as `Model` — a hand-written
 * baseline function (see BenchmarkRunner.ts's DecisionScore example) is
 * exactly as valid a subject as a real model, which is what §11's
 * "BASELINE vs BASELINE+MODEL" comparison requires: the baseline is often
 * not a MAGENAIS model at all.
 */
export type BenchmarkSubject<TInput = unknown, TOutput = unknown> = (
  input: TInput
) => Promise<SubjectInvocation<TOutput>>;

/** Identifies what was benchmarked, for the result envelope and reproducibility record. */
export interface SubjectDescriptor {
  kind: 'native-model' | 'external-target' | 'baseline';
  /** A model id for `native-model`, a free-form label for `baseline`/`external-target`. */
  id: string;
  version?: string;
}

/** One test case. `expected` is the oracle/ground truth a scorer may consult — optional, since some scorers are self-contained. */
export interface BenchmarkCase<TInput = unknown, TExpected = unknown> {
  id: string;
  category: BenchmarkCaseCategory;
  input: TInput;
  expected?: TExpected;
  description?: string;
  /** §27: which of the subject's declared FailureMode ids this case is designed to probe, if any. */
  probesFailureModes?: string[];
}

/** What a single case's scorer decides. `passed` is optional — some benchmarks report metrics only. */
export interface CaseScore {
  passed?: boolean;
  metrics?: Record<string, number>;
  notes?: string;
}

/**
 * Scores one case's outcome. Receives the whole invocation (output +
 * confidence), not just the output, so calibration-style metrics — which
 * need confidence — are a first-class case rather than something bolted on.
 */
export type CaseScorer<TInput = unknown, TOutput = unknown, TExpected = unknown> = (
  actual: SubjectInvocation<TOutput>,
  expected: TExpected | undefined,
  input: TInput
) => CaseScore;

/**
 * A reusable benchmark definition: a fixed case set plus one scorer. The
 * same definition is run against different subjects (baseline, treatment,
 * an ablated variant) so results are comparable case-by-case — that
 * comparability is the whole point of §11/§26.
 */
export interface BenchmarkDefinition<TInput = unknown, TOutput = unknown, TExpected = unknown> {
  id: string;
  name: string;
  description: string;
  /** The capability this benchmark evaluates. Links to the §17 graph via a model's `benchmarkIds`. */
  capability?: ModelCapability;
  version: string;
  cases: Array<BenchmarkCase<TInput, TExpected>>;
  score: CaseScorer<TInput, TOutput, TExpected>;
}

/** One case's outcome after running. */
export interface CaseResult {
  caseId: string;
  category: BenchmarkCaseCategory;
  passed?: boolean;
  metrics: Record<string, number>;
  latencyMs: number;
  /** Set when the subject threw or reported failure; `passed` is then always false. */
  error?: string;
  notes?: string;
}

/** Simple descriptive statistics. No inferential claims — see StatisticalAnalysis.ts. */
export interface StatSummary {
  n: number;
  mean: number;
  stdDev: number;
  median: number;
  min: number;
  max: number;
}

/** §32 Research Reproducibility record. */
export interface ReproducibilityRecord {
  modelVersion?: string;
  /**
   * No git tooling is assumed to be available at run time (this sandbox
   * has none), so this is never auto-detected — always caller-supplied.
   * Pass a commit hash, a package version, or any other stable label you
   * actually control.
   */
  codeVersion?: string;
  benchmarkVersion: string;
  configuration?: Record<string, unknown>;
  /** Identifies the exact case set run, e.g. "magenais.decision-score-calibration@8-cases". */
  inputSetId: string;
  executionDate: string;
  environment?: string;
  evaluationParameters?: Record<string, unknown>;
}

/** The full result of running one BenchmarkDefinition against one subject. */
export interface BenchmarkRunResult {
  benchmarkId: string;
  benchmarkVersion: string;
  subject: SubjectDescriptor;
  cases: CaseResult[];
  /** Per metric name, across every case that reported it. Empty object if no case reported any metric. */
  aggregateMetrics: Record<string, StatSummary>;
  latency: StatSummary;
  /** Fraction of cases with `passed === true`, among cases that set `passed` at all. Undefined if none did. */
  passRate?: number;
  reproducibility: ReproducibilityRecord;
}

/** One metric's baseline-vs-treatment comparison. */
export interface MetricComparison {
  metric: string;
  baseline: StatSummary;
  treatment: StatSummary;
  meanDelta: number;
  /** Per matched case, treatment - baseline, in matched-case order. */
  deltas: number[];
}

/**
 * §11's "BASELINE vs BASELINE+MODEL" / "WITHOUT MODEL vs WITH MODEL"
 * comparison, computed case-by-case over whatever cases both runs share.
 * Deliberately does not conclude "the model provides meaningful value" —
 * §7 scientific discipline: that judgment is the reader's, informed by
 * these numbers, not a boolean this module asserts on their behalf.
 */
export interface BaselineComparison {
  baselineSubject: SubjectDescriptor;
  treatmentSubject: SubjectDescriptor;
  matchedCaseIds: string[];
  unmatchedCaseIds: { onlyInBaseline: string[]; onlyInTreatment: string[] };
  metrics: MetricComparison[];
  latency: MetricComparison;
  /** treatment.passRate - baseline.passRate, only when both runs defined a passRate. */
  passRateDelta?: number;
}

/**
 * §26 Controlled Ablation: SYSTEM WITHOUT COMPONENT vs SYSTEM WITH
 * COMPONENT. Structurally identical to a BaselineComparison — reusing that
 * type rather than re-deriving the same statistics under a new name — but
 * exposed under §26's own vocabulary (`without`/`with`) so a report reads
 * the way the master prompt phrases it.
 */
export interface AblationResult {
  /** What was ablated — typically a model id or capability name. */
  componentId: string;
  without: BenchmarkRunResult;
  with: BenchmarkRunResult;
  comparison: BaselineComparison;
}

/** §27 failure-taxonomy cross-check output. */
export interface FailureBreakdown {
  totalCases: number;
  failedCases: number;
  /** failureMode id -> number of failing cases that named it via `probesFailureModes`. */
  byDeclaredFailureMode: Record<string, number>;
  /**
   * Failing cases that named no `probesFailureModes` id, or named one not
   * present in the subject's declared FailureMode list. §27: "a model is
   * not complete merely because its happy path works" — this is what
   * makes an unaccounted-for failure visible rather than silently folded
   * into a pass-rate number.
   */
  undocumented: CaseResult[];
}
