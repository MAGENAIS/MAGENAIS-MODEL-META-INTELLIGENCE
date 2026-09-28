/**
 * Manifest contract: model.json is valid against the vendored MAGENAIS
 * manifest schema, is generated from src/manifest.ts (single source of
 * truth), and makes only claims the implementation backs.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { META_INTELLIGENCE_MANIFEST, MetaIntelligenceOrchestrator } from '../src/index.ts';
import * as api from '../src/index.ts';
import { META_INTELLIGENCE_PIPELINE_BENCHMARK_ID } from '../src/benchmark/index.ts';
import { validate } from './helpers/jsonSchema.ts';

const read = (rel: string) => JSON.parse(readFileSync(new URL(`../${rel}`, import.meta.url), 'utf8'));
const modelJson = read('model.json');
const schema = read('schemas/model-manifest.schema.json');

test('model.json validates against the vendored MAGENAIS model-manifest schema', () => {
  assert.deepEqual(validate(modelJson, schema), []);
});

test('the schema validator itself rejects a bad manifest (guard against a vacuous pass)', () => {
  const bad = { ...modelJson, runtimes: [], version: 'two', extra: true };
  const errors = validate(bad, schema).join('\n');
  assert.match(errors, /runtimes/);
  assert.match(errors, /version/);
  assert.match(errors, /unexpected property "extra"/);
});

test('model.json is exactly the serialized src/manifest.ts constant (run `npm run manifest:sync` if this fails)', () => {
  assert.deepEqual(modelJson, JSON.parse(JSON.stringify(META_INTELLIGENCE_MANIFEST)));
});

test('manifest identity is stable and honest about what this component is', () => {
  assert.equal(modelJson.id, 'magenais.meta-intelligence');
  assert.deepEqual(modelJson.capabilities, ['meta-orchestration']);
  assert.equal(modelJson.executionMode, 'synchronous');
  assert.equal(modelJson.composability.independentlyExecutable, true);
  assert.equal(modelJson.implementationStatus, 'implemented');
  assert.equal(modelJson.evidenceLevel, 'benchmarked'); // no baseline pairing exists, so never 'baseline-compared'
  assert.equal(modelJson.verificationStatus, 'not-ready'); // owner's decision; not flipped by packaging
  assert.equal(modelJson.trust, 'experimental');
  assert.equal(modelJson.resourceRequirements.network, false);
  assert.equal(modelJson.resourceRequirements.externalApi, false);
});

test('manifest does not claim to be a routable MAGENAIS runtime model', () => {
  assert.deepEqual(modelJson.runtimes, ['embedded-library']);
  assert.ok(!modelJson.runtimes.includes('builtin-local'));
  assert.ok(modelJson.limitations.some((l: string) => /Not `Model`-shaped/.test(l)));
});

test('manifest does not claim autonomous execution', () => {
  const text = JSON.stringify([modelJson.description, modelJson.nonGoals, modelJson.limitations]);
  assert.match(text, /never executes/i);
  assert.match(text, /Nothing is executed/);
});

test('benchmarkIds resolve to the exported benchmark, and provenance names this code version', () => {
  assert.deepEqual(modelJson.benchmarkIds, [META_INTELLIGENCE_PIPELINE_BENCHMARK_ID]);
  assert.equal(modelJson.provenance.benchmarkedAtCodeVersion, modelJson.version);
  assert.equal(modelJson.uri, `magenais://meta-intelligence@${modelJson.version}`);
});

test('every declared failure mode names only error classes that are exported', () => {
  const exported = new Set(Object.keys(api));
  for (const mode of modelJson.failureModes) {
    const names = ((mode.behavior as string).match(/[A-Z][A-Za-z]*Error/g) ?? []).filter((n) => n !== 'NotAtXStageError');
    // 'out-of-order-stage-call' describes a family (each stage's own NotAt<Stage>StageError) rather than one class.
    if (mode.id === 'out-of-order-stage-call') {
      assert.ok([...exported].filter((n) => /^MetaIntelligenceTaskNotAt.*StageError$/.test(n)).length >= 8);
      continue;
    }
    assert.ok(names.length > 0, `${mode.id} names no error class`);
    for (const name of names) assert.ok(exported.has(name), `${mode.id}: ${name} is not exported`);
  }
});

test('every declared failure mode id is reproducible: its guard exists as a method on the orchestrator', () => {
  const proto = Object.getOwnPropertyNames(MetaIntelligenceOrchestrator.prototype);
  for (const method of ['governAction', 'recordAdaptation', 'recordResult', 'authorizeComposition', 'buildExecutionPlan', 'recordExecutionOutcome', 'recordExecutionAdaptation']) {
    assert.ok(proto.includes(method), method);
  }
  assert.equal(new Set(modelJson.failureModes.map((m: { id: string }) => m.id)).size, modelJson.failureModes.length);
});
