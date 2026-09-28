/**
 * End-to-end V2 walk-through using ONLY the public entry point (src/index.ts)
 * and the bundled default scorer: every V2 capability in one realistic path,
 * plus the abstention paths and the immutability/provenance properties.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  MetaIntelligenceOrchestrator,
  MetaIntelligenceExecutionPlanNotAuthorizedError,
  MetaIntelligenceCompositionNotAuthorizableError,
  scoreWithDecisionScore,
  type CapabilityGraphLike,
} from '../src/index.ts';

const graph: CapabilityGraphLike = {
  providersOf: (c) => ({ 'form-optimization': ['a', 'b'], 'error-analysis': ['b'] } as Record<string, string[]>)[c] ?? [],
};

function ready(id = 't') {
  const mi = new MetaIntelligenceOrchestrator();
  mi.intake({ id, statement: '  Reduce   checkout drop-off.  ' });
  mi.understand(id);
  mi.addGoalsConstraints(id, { goals: [{ text: 'Raise completion.', origin: 'caller' }], constraints: [{ text: 'Keep payment provider.', origin: 'extracted' }] });
  mi.addEpistemicTracking(id, { knowns: [{ text: 'Three steps.', origin: 'caller' }], unknowns: [{ text: 'Worst step.', origin: 'caller' }], assumptions: [], evidence: [{ text: 'Funnel export.', origin: 'caller' }] });
  mi.decomposeCapabilities(id, graph, { requirements: [{ capability: 'form-optimization', origin: 'caller' }, { capability: 'error-analysis', origin: 'caller' }, { capability: 'ux-research', origin: 'caller' }] });
  mi.generateStrategies(id);
  mi.generateStrategyAlternatives(id);
  return mi;
}

const CRITERIA = [{ id: 'evidence', weight: 0.4, direction: 'maximize' as const }, { id: 'risk', weight: 0.6, direction: 'minimize' as const }];
const SCORES = { 'strategy-1': { evidence: 8, risk: 2 }, 'strategy-2': { evidence: 2, risk: 2 }, 'strategy-3': { evidence: 5, risk: 1 }, 'strategy-4': { evidence: 9, risk: 9 } };

test('full V2 path: problem -> alternatives -> evaluation -> composition -> plan -> outcome -> adaptation -> trace', () => {
  const mi = ready();
  const afterAlternatives = mi.getTask('t');
  assert.equal(afterAlternatives.stage, 'capability-decomposition'); // V2 strategy fields never advance the stage
  assert.deepEqual(afterAlternatives.capabilityDecomposition!.gaps, ['ux-research']);
  assert.equal(afterAlternatives.strategies!.strategies.length, 2);
  assert.deepEqual(afterAlternatives.strategyAlternatives!.strategies.map((s) => s.derivation), ['single-requirement', 'composed']);

  const evaluated = mi.evaluateStrategyOptions('t', { criteria: CRITERIA, scores: SCORES }).strategyOptionsEvaluation!;
  assert.equal(evaluated.selection.status, 'selected');
  assert.equal(evaluated.ranking[0]!.strategyId, 'strategy-1');
  assert.notEqual(evaluated.ranking.at(-1)!.strategyId, 'strategy-1');
  assert.ok(evaluated.dsi !== null && evaluated.dsi >= 0 && evaluated.dsi <= 1);

  const bound = mi.authorizeComposition('t', { decision: 'ACT' }).compositionBoundary!;
  assert.equal(bound.decision, 'ACT');
  const plan = mi.buildExecutionPlan('t').executionPlan!;
  assert.equal(plan.steps.length, bound.components!.length);

  const failed = mi.recordExecutionOutcome('t', { status: 'failed' });
  assert.equal(failed.executionVerification!.outcome, 'goals-not-met');
  assert.equal(failed.executionResult!.simulated, false);
  const adapted = mi.recordExecutionAdaptation('t', { decision: 're-plan', reason: 'Use provider b.' });
  assert.equal(adapted.executionAdaptation!.decision, 're-plan');
  assert.equal(adapted.stage, 'capability-decomposition'); // nothing was executed or advanced

  const trace = mi.getCognitiveTrace('t');
  assert.deepEqual(trace.entries.map((e) => e.field), [
    'problem', 'understanding', 'goalsConstraints', 'epistemicTracking', 'capabilityDecomposition', 'strategies', 'strategyAlternatives',
    'strategyOptionsEvaluation', 'compositionBoundary', 'executionPlan', 'executionResult', 'executionVerification', 'executionAdaptation',
  ]);
});

test('provenance: origin tags and the verbatim problem statement survive every later stage', () => {
  const mi = ready();
  const task = mi.getTask('t');
  assert.equal(task.problem.statement, '  Reduce   checkout drop-off.  '.trim());
  assert.equal(task.understanding!.normalizedStatement, 'Reduce checkout drop-off.');
  assert.deepEqual(task.goalsConstraints!.constraints.map((c) => c.origin), ['extracted']);
  assert.deepEqual(task.epistemicTracking!.evidence.map((e) => e.origin), ['caller']);
});

test('abstention: a tie or an unmet stability threshold selects nothing, and ACT is then refused', () => {
  const tie = { 'strategy-1': { evidence: 5, risk: 5 }, 'strategy-2': { evidence: 5, risk: 5 }, 'strategy-3': { evidence: 5, risk: 5 }, 'strategy-4': { evidence: 5, risk: 5 } };
  const mi = ready();
  const sel = mi.evaluateStrategyOptions('t', { criteria: CRITERIA, scores: tie }).strategyOptionsEvaluation!.selection;
  assert.deepEqual(sel, { status: 'none', reason: 'tie-for-top' });
  assert.throws(() => mi.authorizeComposition('t', { decision: 'ACT' }), MetaIntelligenceCompositionNotAuthorizableError);

  const strict = ready('u');
  const s2 = strict.evaluateStrategyOptions('u', { criteria: CRITERIA, scores: SCORES, minStability: 1.0, scorerOptions: { perturbationMagnitude: 5, perturbationTrials: 50, seed: 1 } }).strategyOptionsEvaluation!;
  assert.ok(s2.selection.status === 'none' ? s2.selection.reason === 'below-stability-threshold' : (s2.dsi ?? 0) >= 1);
});

test('WAIT keeps an execution plan unreachable and leaves the task unchanged', () => {
  const mi = ready();
  mi.evaluateStrategyOptions('t', { criteria: CRITERIA, scores: SCORES });
  mi.authorizeComposition('t', { decision: 'WAIT' });
  const before = JSON.stringify(mi.getTask('t'));
  assert.throws(() => mi.buildExecutionPlan('t'), MetaIntelligenceExecutionPlanNotAuthorizedError);
  assert.equal(JSON.stringify(mi.getTask('t')), before);
});

test('the default scorer is exactly the exported scoreWithDecisionScore and a custom scorer is honoured', () => {
  const input = { options: [{ id: 'strategy-1' }, { id: 'strategy-2' }], criteria: [{ id: 'evidence', weight: 1, direction: 'maximize' as const }], scores: { 'strategy-1': { evidence: 1 }, 'strategy-2': { evidence: 2 } } };
  const out = scoreWithDecisionScore(input);
  assert.equal(out.topOptionId, 'strategy-2');

  const mi = new MetaIntelligenceOrchestrator();
  mi.intake({ id: 'c', statement: 'x' });
  mi.understand('c');
  mi.addGoalsConstraints('c', { goals: [], constraints: [] });
  mi.addEpistemicTracking('c', { knowns: [], unknowns: [], assumptions: [], evidence: [] });
  mi.decomposeCapabilities('c', graph, { requirements: [{ capability: 'form-optimization', origin: 'caller' }, { capability: 'error-analysis', origin: 'caller' }] });
  mi.generateStrategies('c');
  let calls = 0;
  mi.evaluateStrategyOptions('c', { criteria: [{ id: 'evidence', weight: 1, direction: 'maximize' }], scores: { 'strategy-1': { evidence: 1 }, 'strategy-2': { evidence: 2 } } }, (i, o) => {
    calls += 1;
    return scoreWithDecisionScore(i, o);
  });
  assert.equal(calls, 1);
});

test('two orchestrators are fully isolated (no shared module state)', () => {
  const a = new MetaIntelligenceOrchestrator();
  const b = new MetaIntelligenceOrchestrator();
  a.intake({ id: 'same', statement: 'one' });
  b.intake({ id: 'same', statement: 'two' });
  assert.equal(a.getTask('same').problem.statement, 'one');
  assert.equal(b.getTask('same').problem.statement, 'two');
  assert.equal(a.size, 1);
});
