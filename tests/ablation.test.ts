/**
 * V2-D2: ablation + failure analysis over the Meta-Intelligence pipeline
 * benchmark (fail-open fault injection per guard; see the suite's header for
 * why this is not a true component-removal ablation).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  metaIntelligencePipelineBenchmark,
  PROBES_FAILURE_MODES,
} from '../src/benchmark/PipelineBenchmark.ts';
import {
  GUARD_ABLATIONS,
  runGuardAblations,
} from '../src/benchmark/PipelineAblation.ts';
import { META_INTELLIGENCE_MANIFEST } from '../src/manifest.ts';

const CASES = metaIntelligencePipelineBenchmark.cases;

function expectedRejection(caseId: string): string | null | undefined {
  const c = CASES.find((x) => x.id === caseId)!;
  return (c.expected as { thrownErrorName?: string | null }).thrownErrorName;
}

test('every failure-mode tag names a mode the manifest actually declares, and no case is tagged with an unknown id', () => {
  const declared = new Set((META_INTELLIGENCE_MANIFEST.failureModes ?? []).map((f) => f.id));
  const caseIds = new Set(CASES.map((c) => c.id));
  for (const [caseId, modes] of Object.entries(PROBES_FAILURE_MODES)) {
    assert.ok(caseIds.has(caseId), `tag for unknown case ${caseId}`);
    for (const m of modes) assert.ok(declared.has(m), `${caseId} tags undeclared mode ${m}`);
  }
  // 42 pre-V2-D5 cases + 9 additive V2-D5 `v2q-*` strategy-quality cases.
  assert.equal(CASES.length, 51);
});

test('V2-D5: every guard maps to a declared failure mode, and every case that expects a rejection is tagged with one', () => {
  const declared = new Set((META_INTELLIGENCE_MANIFEST.failureModes ?? []).map((f) => f.id));
  for (const g of GUARD_ABLATIONS) {
    assert.ok(g.failureModeId !== null && declared.has(g.failureModeId), `${g.guardId} has no declared failure mode`);
  }
  // Each declared mode is owned by exactly one guard, so attribution is unambiguous.
  const owners = GUARD_ABLATIONS.map((g) => g.failureModeId);
  assert.equal(new Set(owners).size, owners.length);

  const untagged = CASES.filter((c) => typeof expectedRejection(c.id) === 'string' && !(c.probesFailureModes ?? []).length).map((c) => c.id);
  assert.deepEqual(untagged, [], 'a case expects a rejection but probes no declared failure mode');
});

test('ablation: each fail-open guard fails exactly the cases whose expected rejection it swallows; the intact run passes everything', async () => {
  const reports = await runGuardAblations({ executionDate: '2026-09-27T00:00:00.000Z' });
  assert.equal(reports.length, GUARD_ABLATIONS.length);

  for (const g of GUARD_ABLATIONS) {
    const r = reports.find((x) => x.guardId === g.guardId)!;
    const expectedFailures = CASES.filter((c) => {
      const n = expectedRejection(c.id);
      return typeof n === 'string' && g.swallows(n);
    }).map((c) => c.id);

    assert.ok(expectedFailures.length > 0, `${g.guardId}: benchmark has no case probing this guard (blind spot)`);
    assert.equal(r.passRateWith, 1, `${g.guardId}: intact run must pass every case`);
    assert.deepEqual([...r.failedCaseIds].sort(), [...expectedFailures].sort(), g.guardId);
    assert.ok((r.passRateWithout ?? 1) < 1);
    assert.equal(r.breakdown.failedCases, expectedFailures.length);
  }
});

test('failure analysis: declared-mode guards attribute every failure to that mode; undeclared guards report all failures as undocumented', async () => {
  const reports = await runGuardAblations({ executionDate: '2026-09-27T00:00:00.000Z' });

  for (const r of reports) {
    if (r.failureModeId) {
      assert.deepEqual(r.breakdown.byDeclaredFailureMode, { [r.failureModeId]: r.failedCaseIds.length }, r.guardId);
      assert.equal(r.breakdown.undocumented.length, 0, r.guardId);
    } else {
      assert.deepEqual(r.breakdown.byDeclaredFailureMode, {}, r.guardId);
      assert.equal(r.breakdown.undocumented.length, r.failedCaseIds.length, r.guardId);
      assert.ok(r.failedCaseIds.length > 0);
    }
  }
});
