/**
 * V2-D3: reproducibility + provenance validation for the Meta-Intelligence
 * pipeline benchmark and its guard ablations.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import {
  metaIntelligencePipelineBenchmark,
  runMetaIntelligencePipelineBenchmark,
  META_INTELLIGENCE_PIPELINE_BENCHMARK_ID,
  META_INTELLIGENCE_PIPELINE_BENCHMARK_VERSION,
  META_INTELLIGENCE_SUBJECT_DESCRIPTOR,
} from '../src/benchmark/PipelineBenchmark.ts';
import { runGuardAblations, GUARD_ABLATIONS } from '../src/benchmark/PipelineAblation.ts';
import { META_INTELLIGENCE_MANIFEST } from '../src/manifest.ts';

const OPTIONS = { executionDate: '2026-09-27T00:00:00.000Z', codeVersion: 'v2-d3-test' };

/** Everything in a run that must be deterministic (latency is wall-clock and excluded). */
function stable(run: Awaited<ReturnType<typeof runMetaIntelligencePipelineBenchmark>>) {
  return {
    benchmarkId: run.benchmarkId,
    benchmarkVersion: run.benchmarkVersion,
    subject: run.subject,
    passRate: run.passRate,
    reproducibility: run.reproducibility,
    cases: run.cases.map((c) => ({ caseId: c.caseId, passed: c.passed, metrics: c.metrics, notes: c.notes, error: c.error })),
  };
}

test('reproducibility: two pipeline runs with fixed options are identical in everything but wall-clock latency', async () => {
  assert.deepEqual(stable(await runMetaIntelligencePipelineBenchmark(OPTIONS)), stable(await runMetaIntelligencePipelineBenchmark(OPTIONS)));
});

test('reproducibility: two full guard-ablation sweeps with fixed options are identical', async () => {
  // Undocumented CaseResults embed wall-clock `latencyMs`; strip it, as for the pipeline run above.
  const strip = (reports: Awaited<ReturnType<typeof runGuardAblations>>) =>
    reports.map((r) => ({
      ...r,
      breakdown: { ...r.breakdown, undocumented: r.breakdown.undocumented.map(({ latencyMs: _l, ...rest }) => rest) },
    }));
  const a = strip(await runGuardAblations(OPTIONS));
  const b = strip(await runGuardAblations(OPTIONS));
  assert.equal(a.length, GUARD_ABLATIONS.length);
  assert.deepEqual(a, b);
});

test('provenance: a run record names the benchmark, its version, the exact case set, and the manifest-consistent subject', async () => {
  const run = await runMetaIntelligencePipelineBenchmark(OPTIONS);
  assert.equal(run.benchmarkId, META_INTELLIGENCE_PIPELINE_BENCHMARK_ID);
  assert.equal(run.benchmarkVersion, META_INTELLIGENCE_PIPELINE_BENCHMARK_VERSION);
  assert.equal(run.reproducibility.benchmarkVersion, META_INTELLIGENCE_PIPELINE_BENCHMARK_VERSION);
  assert.equal(run.reproducibility.inputSetId, `${META_INTELLIGENCE_PIPELINE_BENCHMARK_ID}@${metaIntelligencePipelineBenchmark.cases.length}-cases`);
  assert.equal(run.reproducibility.executionDate, OPTIONS.executionDate);
  assert.equal(run.reproducibility.codeVersion, 'v2-d3-test');

  // Subject identity/version must agree with the manifest the benchmark is attached to.
  assert.equal(run.subject.id, META_INTELLIGENCE_MANIFEST.id);
  assert.equal(run.subject.version, META_INTELLIGENCE_MANIFEST.version);
  assert.equal(run.reproducibility.modelVersion, META_INTELLIGENCE_MANIFEST.version);
  assert.deepEqual(META_INTELLIGENCE_SUBJECT_DESCRIPTOR, { kind: 'native-model', id: META_INTELLIGENCE_MANIFEST.id, version: META_INTELLIGENCE_MANIFEST.version });
});

test('provenance: codeVersion is never invented -- absent unless the caller supplies it', async () => {
  const run = await runMetaIntelligencePipelineBenchmark({ executionDate: OPTIONS.executionDate });
  assert.equal(run.reproducibility.codeVersion, undefined);
});

test('provenance: the manifest\'s benchmarkIds resolve to this very benchmark definition and version', () => {
  assert.deepEqual(META_INTELLIGENCE_MANIFEST.benchmarkIds, [metaIntelligencePipelineBenchmark.id]);
  assert.equal(metaIntelligencePipelineBenchmark.id, META_INTELLIGENCE_PIPELINE_BENCHMARK_ID);
  assert.equal(metaIntelligencePipelineBenchmark.version, META_INTELLIGENCE_PIPELINE_BENCHMARK_VERSION);
});

test('provenance: the pipeline benchmark version is pinned to a fingerprint of its case set, so changing cases without bumping the version fails', () => {
  const fingerprint = createHash('sha256')
    .update(
      JSON.stringify(
        metaIntelligencePipelineBenchmark.cases.map((c) => ({
          id: c.id,
          category: c.category,
          expected: c.expected,
          probesFailureModes: c.probesFailureModes ?? null,
        }))
      )
    )
    .digest('hex');
  const PINNED: Record<string, string> = {
    '1.1.0': '76126fb8dfb563cf35e14be76076ec8e167581ace9ecc84c1db958c446b6d9e7',
    '1.2.0': 'c9151dc5dd6e397f3effbe51c81aa15d76b0d5afda8141fce561684ebe6e8ea7',
  };
  assert.equal(
    fingerprint,
    PINNED[META_INTELLIGENCE_PIPELINE_BENCHMARK_VERSION],
    `case set changed (fingerprint ${fingerprint}); bump META_INTELLIGENCE_PIPELINE_BENCHMARK_VERSION and pin the new value`
  );
});

test('V2-D5: the 42 pre-V2-D5 cases keep their exact id, category and expected values (only the new v2q-* cases and failure-mode tags were added)', () => {
  const original = metaIntelligencePipelineBenchmark.cases.slice(0, 42);
  assert.ok(original.every((c) => !c.id.startsWith('v2q-')));
  const fingerprint = createHash('sha256')
    .update(JSON.stringify(original.map((c) => ({ id: c.id, category: c.category, expected: c.expected }))))
    .digest('hex');
  // Computed from the V2-D4 checkpoint's benchmark file, before any V2-D5 edit.
  assert.equal(fingerprint, '6cdd2459e59ec7ef308406ee01091cb4d070ccb49892819d3adf5a38e4d8b874');
});
