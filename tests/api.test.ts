/**
 * Public API guard. The exported runtime surface is snapshotted so that an
 * accidental export (or removal) fails loudly and must be a reviewed change.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as api from '../src/index.ts';
import * as bench from '../src/benchmark/index.ts';

const VALUES = [
  'META_INTELLIGENCE_MANIFEST',
  'META_INTELLIGENCE_MODEL_ID',
  'META_INTELLIGENCE_URI',
  'META_INTELLIGENCE_VERSION',
  'MetaIntelligenceOrchestrator',
  'scoreWithDecisionScore',
];

const ORCHESTRATOR_METHODS = [
  'intake', 'understand', 'addGoalsConstraints', 'addEpistemicTracking', 'decomposeCapabilities',
  'generateCandidateStrategies', 'generateStrategies', 'generateStrategyAlternatives',
  'evaluateStrategies', 'evaluateStrategyOptions', 'authorizeComposition', 'buildExecutionPlan',
  'governAction', 'recordResult', 'recordExecutionOutcome', 'recordAdaptation', 'recordExecutionAdaptation',
  'getCognitiveTrace', 'getProblemRepresentation', 'getTask', 'tryGetTask', 'listTasks', 'size',
];

test('runtime exports of the main entry point are exactly the reviewed surface', () => {
  const names = Object.keys(api);
  const errors = names.filter((n) => /Error$/.test(n));
  const values = names.filter((n) => !/Error$/.test(n)).sort();
  assert.deepEqual(values, [...VALUES].sort());
  assert.equal(errors.length, 43);
  for (const name of errors) assert.equal(typeof (api as Record<string, unknown>)[name], 'function');
});

test('every exported error is a real Error subclass whose name matches its export name', () => {
  for (const [name, value] of Object.entries(api)) {
    if (!/Error$/.test(name)) continue;
    assert.ok((value as { prototype: unknown }).prototype instanceof Error, name);
  }
});

test('no internal scoring or helper functions leak through the main entry point', () => {
  for (const internal of ['validateInput', 'normalizeWeights', 'scoreAndRank', 'computeDSI', 'computeDFP', 'normalizeWhitespace', 'verifyResult']) {
    assert.equal(internal in api, false, internal);
  }
});

test('orchestrator public method surface is exactly the reviewed V2 surface', () => {
  const methods = Object.getOwnPropertyNames(api.MetaIntelligenceOrchestrator.prototype).filter((n) => n !== 'constructor');
  assert.deepEqual([...methods].sort(), [...ORCHESTRATOR_METHODS].sort());
});

test('benchmark subpath exports the engine, the pipeline benchmark and the guard ablations', () => {
  const names = Object.keys(bench).sort();
  for (const expected of ['runBenchmark', 'runAblation', 'analyzeFailures', 'compareResults', 'summarize', 'metaIntelligencePipelineBenchmark', 'runMetaIntelligencePipelineBenchmark', 'runGuardAblations', 'GUARD_ABLATIONS']) {
    assert.ok(names.includes(expected), expected);
  }
  assert.equal(names.includes('subjectFromModel'), false, 'Model adapter belongs to MAGENAIS, not the standalone package');
});

test('package.json exports map exposes only the documented entry points', () => {
  const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
  assert.deepEqual(Object.keys(pkg.exports).sort(), ['.', './benchmark', './model.json', './package.json']);
});

test('no source file imports from MAGENAIS internals or uses a path outside the package', () => {
  const files = ['index.ts', 'contract.ts', 'types.ts', 'MetaIntelligenceOrchestrator.ts', 'manifest.ts', 'version.ts', 'scoring/decisionScoreScorer.ts', 'scoring/DecisionScoreAlgorithm.ts', 'scoring/DecisionStability.ts', 'benchmark/index.ts', 'benchmark/PipelineBenchmark.ts', 'benchmark/PipelineAblation.ts', 'benchmark/types.ts', 'benchmark/BenchmarkRunner.ts', 'benchmark/AblationRunner.ts', 'benchmark/BaselineComparator.ts', 'benchmark/FailureAnalyzer.ts', 'benchmark/StatisticalAnalysis.ts'];
  for (const file of files) {
    const src = readFileSync(new URL(`../src/${file}`, import.meta.url), 'utf8');
    for (const match of src.matchAll(/from\s+'([^']+)'/g)) {
      const spec = match[1];
      assert.ok(spec.startsWith('./') || spec.startsWith('../') || spec.startsWith('node:'), `${file}: bare import ${spec}`);
      assert.ok(!/ModelsHub|MAGENAIS-main/.test(spec), `${file}: ${spec}`);
    }
  }
});
