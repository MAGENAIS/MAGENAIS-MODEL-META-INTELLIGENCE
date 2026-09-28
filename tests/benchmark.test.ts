/**
 * AWU-11: end-to-end test of the Meta-Intelligence pipeline-correctness
 * benchmark — proves the benchmark engine (definition -> runner) against
 * the real orchestrator, over every branch `.mi/NEXT.json`'s objective
 * calls out (ACT/SIMULATE governance, every none/not-representable
 * branch, all four verification outcomes, all four adaptation decisions,
 * double-call/out-of-order rejections).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  metaIntelligencePipelineBenchmark,
  runMetaIntelligencePipelineBenchmark,
  META_INTELLIGENCE_SUBJECT_DESCRIPTOR,
} from '../src/benchmark/PipelineBenchmark.ts';

test('the benchmark has at least one case per pipeline branch called out in the AWU-11 objective', () => {
  const ids = metaIntelligencePipelineBenchmark.cases.map((c) => c.id);

  // Empty/whitespace intake.
  assert.ok(ids.includes('empty-problem-statement'));
  assert.ok(ids.includes('whitespace-only-problem-statement'));

  // Selection "none" reasons.
  assert.ok(ids.includes('selection-none-no-candidates'));
  assert.ok(ids.includes('selection-none-tie-for-top'));
  assert.ok(ids.includes('selection-none-below-stability-threshold'));

  // ACT-without-selection and both governance branches.
  assert.ok(ids.includes('act-without-selection-rejected'));
  assert.ok(ids.includes('governance-act'));
  assert.ok(ids.includes('governance-simulate'));

  // WAIT/ASK result-refusal.
  assert.ok(ids.includes('result-not-representable-wait'));
  assert.ok(ids.includes('result-not-representable-ask'));

  // All four verification outcomes.
  assert.ok(ids.includes('verification-not-verifiable'));
  assert.ok(ids.includes('verification-goals-not-met'));
  assert.ok(ids.includes('verification-insufficient-basis'));
  assert.ok(ids.includes('verification-verified-against-basis-act-branch'));

  // Both adaptation-not-representable branches, and all four adaptation decisions.
  assert.ok(ids.includes('adaptation-not-representable-verified-against-basis'));
  assert.ok(ids.includes('adaptation-not-representable-not-verifiable'));
  assert.ok(ids.includes('adaptation-retry'));
  assert.ok(ids.includes('adaptation-re-plan'));
  assert.ok(ids.includes('adaptation-escalate'));
  assert.ok(ids.includes('adaptation-accept-simulate-branch'));

  // Double-call/out-of-order rejections.
  assert.ok(ids.includes('double-call-understand'));
  assert.ok(ids.includes('out-of-order-goals-before-understand'));
  assert.ok(ids.includes('double-call-evaluate'));
  assert.ok(ids.includes('double-call-governance'));
  assert.ok(ids.includes('double-call-adaptation'));

  // Case ids are unique.
  assert.equal(new Set(ids).size, ids.length);
});

test('V2-D1: the benchmark now has adversarial/realistic coverage of the V2-B/C surface (strategies through executionAdaptation)', () => {
  const ids = metaIntelligencePipelineBenchmark.cases.map((c) => c.id);

  // The AWU-11 baseline's 33 V1 cases are untouched.
  assert.ok(ids.includes('adaptation-accept-simulate-branch'));

  // Structural-reachability regressions: a frozen V1 method really cannot
  // reach a V2-B/C-only task (the exact findings V2-C1/C4/C5 each made).
  assert.ok(ids.includes('v2bc-strategies-only-blocks-governAction'));
  assert.ok(ids.includes('v2bc-executionplan-only-blocks-recordResult'));
  assert.ok(ids.includes('v2bc-executionverification-only-blocks-recordAdaptation'));

  // New-stage mechanics: WAIT-blocks-plan, double-calls, not-representable.
  assert.ok(ids.includes('v2bc-composition-wait-blocks-executionplan'));
  assert.ok(ids.includes('v2bc-double-call-authorizeComposition'));
  assert.ok(ids.includes('v2bc-double-call-recordExecutionOutcome'));
  assert.ok(ids.includes('v2bc-double-call-recordExecutionAdaptation'));
  assert.ok(ids.includes('v2bc-execution-adaptation-not-representable-verified-against-basis'));

  // One full end-to-end V2-B/C scenario, composed by getCognitiveTrace().
  assert.ok(ids.includes('v2bc-full-pipeline-act-branch'));

  assert.equal(new Set(ids).size, ids.length);
  // 42 (V2-D1) + 9 additive V2-D5 `v2q-*` cases; the original 42 are pinned separately in the provenance test.
  assert.equal(ids.length, 51);
});

test('every case id is unique and every case declares a category', () => {
  for (const c of metaIntelligencePipelineBenchmark.cases) {
    assert.ok(['deterministic', 'scenario', 'adversarial'].includes(c.category), `${c.id} has an unexpected category`);
  }
});

test('running the benchmark against the real orchestrator: every case passes, with no thrown-and-uncaught errors', async () => {
  const result = await runMetaIntelligencePipelineBenchmark({ executionDate: '2026-01-01T00:00:00.000Z' });

  assert.equal(result.cases.length, metaIntelligencePipelineBenchmark.cases.length);
  assert.equal(result.subject.kind, META_INTELLIGENCE_SUBJECT_DESCRIPTOR.kind);
  assert.equal(result.subject.id, META_INTELLIGENCE_SUBJECT_DESCRIPTOR.id);

  const failures = result.cases.filter((c) => c.passed !== true);
  assert.deepEqual(
    failures.map((f) => ({ caseId: f.caseId, error: f.error, notes: f.notes })),
    [],
    'every case is expected to match today\'s documented AWU-01..10 behavior'
  );

  // A benchmark's job is to characterize failure, not throw it — every
  // case's subject invocation itself completed (no `CaseResult.error`),
  // even the cases whose *scenario* deliberately triggers and catches an
  // orchestrator error internally.
  assert.ok(result.cases.every((c) => c.error === undefined));
  assert.equal(result.passRate, 1);
});

test('the run is reproducible: identical options produce identical case results', async () => {
  const options = { executionDate: '2026-03-03T00:00:00.000Z', codeVersion: 'test-run' };
  const first = await runMetaIntelligencePipelineBenchmark(options);
  const second = await runMetaIntelligencePipelineBenchmark(options);

  assert.deepEqual(
    first.cases.map((c) => ({ caseId: c.caseId, passed: c.passed, metrics: c.metrics })),
    second.cases.map((c) => ({ caseId: c.caseId, passed: c.passed, metrics: c.metrics }))
  );
  assert.deepEqual(first.reproducibility, second.reproducibility);
});

test('a scenario that expects a specific rejection actually observes that error name (sanity: score() is not vacuously true)', async () => {
  const result = await runMetaIntelligencePipelineBenchmark();
  const actOnNone = result.cases.find((c) => c.caseId === 'act-without-selection-rejected')!;
  assert.equal(actOnNone.passed, true);
  assert.equal(actOnNone.metrics.mismatchCount, 0);
});

test('score() reports a mismatch (not a pass) when the observed outcome disagrees with what was expected', () => {
  const scored = metaIntelligencePipelineBenchmark.score(
    { output: { stage: 'received', thrownErrorName: null } },
    { stage: 'understood', thrownErrorName: null },
    (() => {}) as unknown as never
  );
  assert.equal(scored.passed, false);
  assert.equal(scored.metrics!.mismatchCount, 1);
  assert.ok(scored.notes?.includes('stage'));
});

test('V2-D5: strategy-quality cases cover per-provider/composed alternatives, risk-driven selection, the V2 none outcomes and ACT composition + plan (G10)', async () => {
  const cases = metaIntelligencePipelineBenchmark.cases;
  const v2q = cases.filter((c) => c.id.startsWith('v2q-')).map((c) => c.id);
  assert.deepEqual(v2q, [
    'v2q-alternatives-per-provider-and-composed',
    'v2q-alternatives-none-without-diversity',
    'v2q-selection-without-risk-criterion',
    'v2q-selection-with-risk-criterion-flips-selection',
    'v2q-selection-none-tie-for-top',
    'v2q-selection-none-below-stability-threshold',
    'v2q-selection-narrow-ranking-selects-without-threshold',
    'v2q-act-alternative-strategy-components-and-plan',
    'v2q-act-composed-strategy-components-and-plan',
  ]);

  const result = await runMetaIntelligencePipelineBenchmark({ executionDate: '2026-09-28T00:00:00.000Z' });
  const failures = result.cases.filter((c) => c.passed !== true);
  assert.deepEqual(failures.map((f) => ({ caseId: f.caseId, notes: f.notes })), []);
});

test('V2-D5: the risk criterion is what flips selection -- the paired cases share options and evidence scores and select different strategies', () => {
  const expectedOf = (id: string) => metaIntelligencePipelineBenchmark.cases.find((c) => c.id === id)!.expected as {
    optionsSelectedStrategyId?: string;
    optionsRankingIds?: string[];
  };
  const without = expectedOf('v2q-selection-without-risk-criterion');
  const withRisk = expectedOf('v2q-selection-with-risk-criterion-flips-selection');
  assert.notEqual(without.optionsSelectedStrategyId, withRisk.optionsSelectedStrategyId);
  // The strategy that wins on evidence alone is the one the risk dimension demotes to last.
  assert.equal(without.optionsRankingIds![0], withRisk.optionsRankingIds!.at(-1));
});

test('V2-D5: score() is not vacuous for the new strategy-quality fields (a wrong selected id, ranking or component list is a mismatch)', () => {
  const noop = (() => {}) as unknown as never;
  const observed = {
    stage: 'capability-decomposition' as const,
    thrownErrorName: null,
    optionsSelectedStrategyId: 'strategy-1',
    optionsRankingIds: ['strategy-1', 'strategy-3'],
    compositionComponents: ['anomaly-detection[magenais.b]'],
  };
  const ok = metaIntelligencePipelineBenchmark.score({ output: observed }, { ...observed }, noop);
  assert.equal(ok.passed, true);
  for (const wrong of [
    { optionsSelectedStrategyId: 'strategy-4' },
    { optionsRankingIds: ['strategy-3', 'strategy-1'] },
    { compositionComponents: ['anomaly-detection[magenais.a,magenais.b]'] },
  ]) {
    const scored = metaIntelligencePipelineBenchmark.score({ output: observed }, { ...observed, ...wrong }, noop);
    assert.equal(scored.passed, false, JSON.stringify(wrong));
    assert.equal(scored.metrics?.mismatchCount, 1);
  }
});

// ---- standalone V2 release: frozen outcome fingerprint --------------------
import { createHash } from 'node:crypto';

const FROZEN_OUTCOME_FINGERPRINT = '341d385f42b2734862614e97900deca2a871345f0386a095837607f7459ef387';

test('regression: the 51 benchmark cases (ids, categories, pass state, metrics) match the frozen V2 fingerprint and are deterministic', async () => {
  const fingerprint = async () => {
    const run = await runMetaIntelligencePipelineBenchmark({ codeVersion: '2.0.0' });
    assert.equal(run.cases.length, 51);
    assert.ok(run.cases.every((c) => c.passed === true));
    const line = (c: (typeof run.cases)[number]) => `${c.caseId}|${c.category}|${c.passed}|${JSON.stringify(c.metrics)}`;
    return createHash('sha256').update(run.cases.map(line).join('\n')).digest('hex');
  };
  const first = await fingerprint();
  assert.equal(first, await fingerprint(), 'benchmark outcomes must be deterministic');
  assert.equal(first, FROZEN_OUTCOME_FINGERPRINT, 'benchmark cases changed: bump the benchmark version deliberately and update this fingerprint');
});
