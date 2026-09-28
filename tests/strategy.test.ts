/**
 * V2-B1: focused tests for the new `MetaIntelligenceStrategy` /
 * `MetaIntelligenceStrategyComponent` / `MetaIntelligenceStrategyDerivation`
 * data model.
 *
 * V2-B1's scope was a pure, additive data shape, not yet produced by any
 * `MetaIntelligenceOrchestrator` method. Those construction-only tests
 * assert the shape itself — that a single-component and a multi-component
 * strategy are both representable, readonly-typed, and reference their
 * source requirements/providers correctly.
 *
 * V2-B2 adds real orchestrator coverage for the new `generateStrategies()`
 * method and `MetaIntelligenceTask.strategies` field: satisfied-requirement
 * generation, the gap/no-candidates edge case, additive coexistence with
 * (and non-interference with) the frozen V1 `candidateStrategies` surface,
 * and this method's own error conditions. `generateCandidateStrategies()`
 * and `evaluateStrategies()` behavior remain covered unmodified by
 * `metaIntelligenceOrchestrator.test.ts` / `metaIntelligenceIntegration.test.ts`.
 *
 * V2-B3 adds coverage for the new `generateStrategyAlternatives()` method
 * and `MetaIntelligenceTask.strategyAlternatives` field: per-provider
 * alternative generation, composed multi-requirement generation, the
 * no-diversity empty-list case, additive non-interference with `strategies`
 * / `candidateStrategies`, id continuation/uniqueness across both fields,
 * and this method's own error conditions. `generateStrategies()`'s existing
 * tests above are completely unmodified.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import type {
  MetaIntelligenceStrategy,
  MetaIntelligenceStrategyComponent,
  MetaIntelligenceStrategyDerivation,
} from '../src/types.ts';
import {
  MetaIntelligenceOrchestrator,
  MetaIntelligenceTaskNotFoundError,
  MetaIntelligenceTaskMissingCapabilityDecompositionError,
  MetaIntelligenceStrategiesAlreadyGeneratedError,
  MetaIntelligenceStrategiesNotYetGeneratedError,
  MetaIntelligenceStrategyAlternativesAlreadyGeneratedError,
  MetaIntelligenceTaskMissingStrategiesError,
  MetaIntelligenceStrategyOptionsAlreadyEvaluatedError,
  InvalidStrategyOptionsEvaluationError,
  MetaIntelligenceTaskMissingStrategyOptionsEvaluationError,
  MetaIntelligenceCompositionAlreadyBoundError,
  InvalidCompositionDecisionError,
  MetaIntelligenceCompositionNotAuthorizableError,
  MetaIntelligenceTaskMissingCompositionBoundaryError,
  MetaIntelligenceExecutionPlanAlreadyBuiltError,
  MetaIntelligenceExecutionPlanNotAuthorizedError,
  MetaIntelligenceTaskMissingExecutionPlanError,
  MetaIntelligenceExecutionResultAlreadyRecordedError,
  InvalidResultStatusError,
  MetaIntelligenceTaskMissingExecutionVerificationError,
  MetaIntelligenceExecutionAdaptationNotRepresentableError,
  MetaIntelligenceExecutionAdaptationAlreadyRecordedError,
  InvalidAdaptationDecisionError,
  MetaIntelligenceTaskNotAtResultVerificationStageError,
} from '../src/MetaIntelligenceOrchestrator.ts';
import type { MetaIntelligenceCognitiveTrace } from '../src/types.ts';
import { CapabilityGraph } from './helpers/capabilityGraph.ts';
import type { ModelManifest } from '../src/contract.ts';

/** Minimal synthetic manifest for capability-decomposition tests, mirroring metaIntelligenceOrchestrator.test.ts's helper. */
function manifest(overrides: Partial<ModelManifest> & { id: string }): ModelManifest {
  return {
    name: overrides.id,
    version: '1.0.0',
    description: 'Synthetic manifest for generateStrategies() tests.',
    author: { name: 'Test Author' },
    type: 'algorithm',
    capabilities: [],
    runtimes: ['embedded-library'],
    license: { type: 'Apache-2.0' },
    pricing: { type: 'free' },
    trust: 'experimental',
    ...overrides,
  } as ModelManifest;
}

/** Advance a fresh orchestrator's task straight to 'capability-decomposition', for generateStrategies() tests. */
function taskAtCapabilityDecomposition(
  orchestrator: MetaIntelligenceOrchestrator,
  graph: Parameters<MetaIntelligenceOrchestrator['decomposeCapabilities']>[1],
  requirements: Parameters<MetaIntelligenceOrchestrator['decomposeCapabilities']>[2]['requirements'],
  id = 'task-1'
) {
  orchestrator.intake({ statement: 'Reduce checkout drop-off.', id });
  orchestrator.understand(id);
  orchestrator.addGoalsConstraints(id, { goals: [], constraints: [] });
  orchestrator.addEpistemicTracking(id, { knowns: [], unknowns: [], assumptions: [], evidence: [] });
  return orchestrator.decomposeCapabilities(id, graph, { requirements });
}

test('MetaIntelligenceStrategy: a single-requirement strategy is representable, mirroring today\'s one-candidate-per-requirement shape', () => {
  const component: MetaIntelligenceStrategyComponent = {
    requirementId: 'requirement-1',
    capability: 'summarization',
    providers: ['model-a'],
  };
  const derivation: MetaIntelligenceStrategyDerivation = 'single-requirement';
  const strategy: MetaIntelligenceStrategy = {
    id: 'strategy-1',
    components: [component],
    derivation,
  };

  assert.equal(strategy.components.length, 1);
  assert.equal(strategy.derivation, 'single-requirement');
  assert.equal(strategy.components[0].requirementId, 'requirement-1');
  assert.deepEqual(strategy.components[0].providers, ['model-a']);
});

test('MetaIntelligenceStrategy: a composed, multi-requirement strategy is representable -- the concrete gap V1 candidates could not express', () => {
  const strategy: MetaIntelligenceStrategy = {
    id: 'strategy-2',
    components: [
      { requirementId: 'requirement-1', capability: 'summarization', providers: ['model-a'] },
      { requirementId: 'requirement-2', capability: 'translation', providers: ['model-b', 'model-c'] },
    ],
    derivation: 'composed',
  };

  assert.equal(strategy.components.length, 2);
  assert.equal(strategy.derivation, 'composed');
  assert.deepEqual(
    strategy.components.map((c) => c.requirementId),
    ['requirement-1', 'requirement-2']
  );
  assert.deepEqual(strategy.components[1].providers, ['model-b', 'model-c']);
});

test('MetaIntelligenceStrategy: a component carries a copy of its requirement\'s providers, not a shared reference', () => {
  const sourceProviders = ['model-a', 'model-b'];
  const component: MetaIntelligenceStrategyComponent = {
    requirementId: 'requirement-1',
    capability: 'summarization',
    providers: [...sourceProviders],
  };

  sourceProviders.push('model-c');

  assert.deepEqual(component.providers, ['model-a', 'model-b']);
});

test('generateStrategies() builds one single-requirement strategy per satisfied requirement, in requirement order', () => {
  const graph = CapabilityGraph.fromManifests([
    manifest({ id: 'magenais.a', capabilities: ['anomaly-detection'] }),
    manifest({ id: 'magenais.b', capabilities: ['anomaly-detection', 'pattern-detection'] }),
  ]);
  const orchestrator = new MetaIntelligenceOrchestrator();
  const before = taskAtCapabilityDecomposition(orchestrator, graph, [
    { capability: 'anomaly-detection', origin: 'caller' },
    { capability: 'strategy-planning', origin: 'extracted' },
    { capability: 'pattern-detection', origin: 'extracted' },
  ]);

  const updated = orchestrator.generateStrategies('task-1');

  // Does not advance stage -- 'strategies' is additive, not a pipeline stage.
  assert.equal(updated.stage, 'capability-decomposition');

  const strategies = updated.strategies!.strategies;
  // The gap ('strategy-planning', requirement 2) yields no strategy; the two satisfied ones do, in requirement order.
  assert.equal(strategies.length, 2);
  const [first, second] = strategies;

  assert.equal(first.derivation, 'single-requirement');
  assert.equal(first.components.length, 1);
  assert.equal(first.components[0].requirementId, before.capabilityDecomposition!.requirements[0].id);
  assert.equal(first.components[0].capability, 'anomaly-detection');
  assert.deepEqual(first.components[0].providers, ['magenais.a', 'magenais.b']);

  assert.equal(second.derivation, 'single-requirement');
  assert.equal(second.components[0].requirementId, before.capabilityDecomposition!.requirements[2].id);
  assert.equal(second.components[0].capability, 'pattern-detection');
  assert.deepEqual(second.components[0].providers, ['magenais.b']);

  assert.equal(new Set(strategies.map((s) => s.id)).size, strategies.length);
  assert.ok(!Number.isNaN(Date.parse(updated.strategies!.generatedAt)));
  assert.deepEqual(orchestrator.getTask('task-1'), updated);
});

test('generateStrategies() yields an empty strategies list when every requirement is a gap or there are none', () => {
  const graph = CapabilityGraph.fromManifests([]);

  const allGaps = new MetaIntelligenceOrchestrator();
  taskAtCapabilityDecomposition(allGaps, graph, [
    { capability: 'unmet-a', origin: 'caller' },
    { capability: 'unmet-b', origin: 'extracted' },
  ]);
  const gapResult = allGaps.generateStrategies('task-1');
  assert.deepEqual(gapResult.strategies!.strategies, []);
  assert.deepEqual(gapResult.capabilityDecomposition!.gaps, ['unmet-a', 'unmet-b']);

  const none = new MetaIntelligenceOrchestrator();
  taskAtCapabilityDecomposition(none, graph, []);
  const noneResult = none.generateStrategies('task-1');
  assert.deepEqual(noneResult.strategies!.strategies, []);
});

test('generateStrategies() is additive: it does not read, write, or require the frozen V1 candidateStrategies surface', () => {
  const graph = CapabilityGraph.fromManifests([manifest({ id: 'magenais.a', capabilities: ['anomaly-detection'] })]);
  const orchestrator = new MetaIntelligenceOrchestrator();
  taskAtCapabilityDecomposition(orchestrator, graph, [{ capability: 'anomaly-detection', origin: 'caller' }]);

  // Called directly from 'capability-decomposition', before generateCandidateStrategies() ever runs.
  const updated = orchestrator.generateStrategies('task-1');
  assert.equal(updated.candidateStrategies, undefined);
  assert.equal(updated.strategies!.strategies.length, 1);

  // generateCandidateStrategies() still works afterwards, untouched by generateStrategies() having run.
  const withCandidates = orchestrator.generateCandidateStrategies('task-1');
  assert.equal(withCandidates.stage, 'candidate-strategies');
  assert.equal(withCandidates.candidateStrategies!.candidates.length, 1);
  // strategies field survives the V1 stage advancing past it.
  assert.equal(withCandidates.strategies!.strategies.length, 1);
});

test('generateStrategies() also works on a task already past capability-decomposition', () => {
  const graph = CapabilityGraph.fromManifests([manifest({ id: 'magenais.a', capabilities: ['anomaly-detection'] })]);
  const orchestrator = new MetaIntelligenceOrchestrator();
  taskAtCapabilityDecomposition(orchestrator, graph, [{ capability: 'anomaly-detection', origin: 'caller' }]);
  orchestrator.generateCandidateStrategies('task-1');

  const updated = orchestrator.generateStrategies('task-1');

  assert.equal(updated.stage, 'candidate-strategies');
  assert.equal(updated.strategies!.strategies.length, 1);
  // candidateStrategies is untouched by generateStrategies() running afterwards.
  assert.equal(updated.candidateStrategies!.candidates.length, 1);
});

test('generateStrategies() copies providers rather than sharing the decomposition\'s array', () => {
  const graph = CapabilityGraph.fromManifests([manifest({ id: 'magenais.a', capabilities: ['anomaly-detection'] })]);
  const orchestrator = new MetaIntelligenceOrchestrator();
  taskAtCapabilityDecomposition(orchestrator, graph, [{ capability: 'anomaly-detection', origin: 'caller' }]);

  const updated = orchestrator.generateStrategies('task-1');

  assert.notEqual(
    updated.strategies!.strategies[0].components[0].providers,
    updated.capabilityDecomposition!.requirements[0].providers
  );
});

test('generateStrategies() throws MetaIntelligenceTaskNotFoundError for an unknown id', () => {
  const orchestrator = new MetaIntelligenceOrchestrator();
  assert.throws(() => orchestrator.generateStrategies('missing'), MetaIntelligenceTaskNotFoundError);
});

test('generateStrategies() throws MetaIntelligenceTaskMissingCapabilityDecompositionError before capability-decomposition', () => {
  const orchestrator = new MetaIntelligenceOrchestrator();
  orchestrator.intake({ statement: 'Reduce checkout drop-off.', id: 'task-1' });
  orchestrator.understand('task-1');
  orchestrator.addGoalsConstraints('task-1', { goals: [], constraints: [] });
  orchestrator.addEpistemicTracking('task-1', { knowns: [], unknowns: [], assumptions: [], evidence: [] });

  // Still at 'epistemic-tracking' -- decomposeCapabilities() has not run yet.
  assert.throws(
    () => orchestrator.generateStrategies('task-1'),
    MetaIntelligenceTaskMissingCapabilityDecompositionError
  );
});

test('generateStrategies() throws MetaIntelligenceStrategiesAlreadyGeneratedError on a second call for the same task', () => {
  const graph = CapabilityGraph.fromManifests([manifest({ id: 'magenais.a', capabilities: ['anomaly-detection'] })]);
  const orchestrator = new MetaIntelligenceOrchestrator();
  taskAtCapabilityDecomposition(orchestrator, graph, [{ capability: 'anomaly-detection', origin: 'caller' }]);

  orchestrator.generateStrategies('task-1');

  assert.throws(
    () => orchestrator.generateStrategies('task-1'),
    MetaIntelligenceStrategiesAlreadyGeneratedError
  );
});

// -- V2-B3: generateStrategyAlternatives() --------------------------------

test('generateStrategyAlternatives() builds one alternative per extra provider, continuing strategy-N numbering', () => {
  const graph = CapabilityGraph.fromManifests([
    manifest({ id: 'magenais.a', capabilities: ['anomaly-detection'] }),
    manifest({ id: 'magenais.b', capabilities: ['anomaly-detection', 'pattern-detection'] }),
  ]);
  const orchestrator = new MetaIntelligenceOrchestrator();
  const before = taskAtCapabilityDecomposition(orchestrator, graph, [
    { capability: 'anomaly-detection', origin: 'caller' },
    { capability: 'pattern-detection', origin: 'extracted' },
  ]);
  const withStrategies = orchestrator.generateStrategies('task-1');
  // Baseline, unmodified: 2 satisfied requirements -> 2 single-requirement strategies.
  assert.equal(withStrategies.strategies!.strategies.length, 2);

  const updated = orchestrator.generateStrategyAlternatives('task-1');

  // strategies field itself is completely untouched by this call.
  assert.deepEqual(updated.strategies, withStrategies.strategies);
  assert.equal(updated.stage, 'capability-decomposition');

  const alt = updated.strategyAlternatives!.strategies;
  // anomaly-detection has 2 providers -> 1 extra per-provider alternative (for magenais.b alone);
  // pattern-detection has 1 provider -> no per-provider alternative.
  // Plus 1 composed strategy spanning both satisfied requirements (2 > 1).
  assert.equal(alt.length, 2);

  const [providerAlt, composed] = alt;
  assert.equal(providerAlt.derivation, 'single-requirement');
  assert.equal(providerAlt.components.length, 1);
  assert.equal(providerAlt.components[0].requirementId, before.capabilityDecomposition!.requirements[0].id);
  assert.deepEqual(providerAlt.components[0].providers, ['magenais.b']);
  assert.equal(providerAlt.id, 'strategy-3');

  assert.equal(composed.derivation, 'composed');
  assert.equal(composed.components.length, 2);
  assert.deepEqual(
    composed.components.map((c) => c.requirementId),
    [before.capabilityDecomposition!.requirements[0].id, before.capabilityDecomposition!.requirements[1].id]
  );
  assert.deepEqual(composed.components[0].providers, ['magenais.a', 'magenais.b']);
  assert.deepEqual(composed.components[1].providers, ['magenais.b']);
  assert.equal(composed.id, 'strategy-4');

  assert.ok(!Number.isNaN(Date.parse(updated.strategyAlternatives!.generatedAt)));
  assert.deepEqual(orchestrator.getTask('task-1'), updated);
});

test('generateStrategyAlternatives() yields an empty list when the task has no real diversity (single requirement, single provider)', () => {
  const graph = CapabilityGraph.fromManifests([manifest({ id: 'magenais.a', capabilities: ['anomaly-detection'] })]);
  const orchestrator = new MetaIntelligenceOrchestrator();
  taskAtCapabilityDecomposition(orchestrator, graph, [{ capability: 'anomaly-detection', origin: 'caller' }]);
  orchestrator.generateStrategies('task-1');

  const updated = orchestrator.generateStrategyAlternatives('task-1');

  assert.deepEqual(updated.strategyAlternatives!.strategies, []);
});

test('generateStrategyAlternatives() is additive: it does not touch strategies or the frozen V1 candidateStrategies surface', () => {
  const graph = CapabilityGraph.fromManifests([
    manifest({ id: 'magenais.a', capabilities: ['anomaly-detection'] }),
    manifest({ id: 'magenais.b', capabilities: ['anomaly-detection'] }),
  ]);
  const orchestrator = new MetaIntelligenceOrchestrator();
  taskAtCapabilityDecomposition(orchestrator, graph, [{ capability: 'anomaly-detection', origin: 'caller' }]);
  orchestrator.generateStrategies('task-1');
  orchestrator.generateCandidateStrategies('task-1');

  const updated = orchestrator.generateStrategyAlternatives('task-1');

  assert.equal(updated.candidateStrategies!.candidates.length, 1);
  assert.equal(updated.strategies!.strategies.length, 1);
  assert.equal(updated.strategyAlternatives!.strategies.length, 1);
  assert.equal(updated.strategyAlternatives!.strategies[0].derivation, 'single-requirement');
  assert.deepEqual(updated.strategyAlternatives!.strategies[0].components[0].providers, ['magenais.b']);
});

test('generateStrategyAlternatives() throws MetaIntelligenceTaskNotFoundError for an unknown id', () => {
  const orchestrator = new MetaIntelligenceOrchestrator();
  assert.throws(() => orchestrator.generateStrategyAlternatives('missing'), MetaIntelligenceTaskNotFoundError);
});

test('generateStrategyAlternatives() throws MetaIntelligenceStrategiesNotYetGeneratedError before generateStrategies() has run', () => {
  const graph = CapabilityGraph.fromManifests([manifest({ id: 'magenais.a', capabilities: ['anomaly-detection'] })]);
  const orchestrator = new MetaIntelligenceOrchestrator();
  taskAtCapabilityDecomposition(orchestrator, graph, [{ capability: 'anomaly-detection', origin: 'caller' }]);

  assert.throws(
    () => orchestrator.generateStrategyAlternatives('task-1'),
    MetaIntelligenceStrategiesNotYetGeneratedError
  );
});

test('generateStrategyAlternatives() throws MetaIntelligenceStrategyAlternativesAlreadyGeneratedError on a second call for the same task', () => {
  const graph = CapabilityGraph.fromManifests([
    manifest({ id: 'magenais.a', capabilities: ['anomaly-detection'] }),
    manifest({ id: 'magenais.b', capabilities: ['anomaly-detection'] }),
  ]);
  const orchestrator = new MetaIntelligenceOrchestrator();
  taskAtCapabilityDecomposition(orchestrator, graph, [{ capability: 'anomaly-detection', origin: 'caller' }]);
  orchestrator.generateStrategies('task-1');

  orchestrator.generateStrategyAlternatives('task-1');

  assert.throws(
    () => orchestrator.generateStrategyAlternatives('task-1'),
    MetaIntelligenceStrategyAlternativesAlreadyGeneratedError
  );
});

// -- V2-B4: evaluateStrategyOptions() ---------------------------------------

test('evaluateStrategyOptions() scores the combined strategies + strategyAlternatives option set and records an explicit selection', () => {
  const graph = CapabilityGraph.fromManifests([
    manifest({ id: 'magenais.a', capabilities: ['anomaly-detection'] }),
    manifest({ id: 'magenais.b', capabilities: ['anomaly-detection', 'pattern-detection'] }),
  ]);
  const orchestrator = new MetaIntelligenceOrchestrator();
  taskAtCapabilityDecomposition(orchestrator, graph, [
    { capability: 'anomaly-detection', origin: 'caller' },
    { capability: 'pattern-detection', origin: 'extracted' },
  ]);
  orchestrator.generateStrategies('task-1');
  orchestrator.generateStrategyAlternatives('task-1');

  // strategy-1, strategy-2 (generateStrategies()) + strategy-3, strategy-4 (alternatives) = 4 options.
  const criteria = [{ id: 'evidence', weight: 1, direction: 'maximize' as const }];
  const scores = {
    'strategy-1': { evidence: 4 },
    'strategy-2': { evidence: 2 },
    'strategy-3': { evidence: 1 },
    'strategy-4': { evidence: 9 },
  };

  const updated = orchestrator.evaluateStrategyOptions('task-1', { criteria, scores });

  const evaluation = updated.strategyOptionsEvaluation!;
  assert.equal(evaluation.ranking.length, 4);
  assert.deepEqual(
    evaluation.ranking.map((entry) => entry.strategyId).sort(),
    ['strategy-1', 'strategy-2', 'strategy-3', 'strategy-4']
  );
  assert.deepEqual(evaluation.selection, { status: 'selected', strategyId: 'strategy-4' });
  assert.equal(evaluation.minStability, null);
  assert.ok(!Number.isNaN(Date.parse(evaluation.evaluatedAt)));

  // Does not advance stage or touch any earlier-stage/V1 field.
  assert.equal(updated.stage, 'capability-decomposition');
  assert.equal(updated.strategyEvaluation, undefined);
  assert.equal(updated.candidateStrategies, undefined);
  assert.deepEqual(orchestrator.getTask('task-1'), updated);
});

test('evaluateStrategyOptions() works from strategies alone, before generateStrategyAlternatives() has run', () => {
  const graph = CapabilityGraph.fromManifests([manifest({ id: 'magenais.a', capabilities: ['anomaly-detection'] })]);
  const orchestrator = new MetaIntelligenceOrchestrator();
  taskAtCapabilityDecomposition(orchestrator, graph, [{ capability: 'anomaly-detection', origin: 'caller' }]);
  orchestrator.generateStrategies('task-1');

  const updated = orchestrator.evaluateStrategyOptions('task-1', {
    criteria: [{ id: 'evidence', weight: 1, direction: 'maximize' }],
    scores: { 'strategy-1': { evidence: 5 } },
  });

  assert.equal(updated.strategyOptionsEvaluation!.ranking.length, 1);
  assert.deepEqual(updated.strategyOptionsEvaluation!.selection, { status: 'selected', strategyId: 'strategy-1' });
});

test('evaluateStrategyOptions(): a risk criterion (direction \'minimize\') materially changes which strategy is selected', () => {
  const graph = CapabilityGraph.fromManifests([
    manifest({ id: 'magenais.a', capabilities: ['anomaly-detection'] }),
    manifest({ id: 'magenais.b', capabilities: ['pattern-detection'] }),
  ]);
  const orchestrator = new MetaIntelligenceOrchestrator();
  taskAtCapabilityDecomposition(orchestrator, graph, [
    { capability: 'anomaly-detection', origin: 'caller' },
    { capability: 'pattern-detection', origin: 'caller' },
  ]);
  orchestrator.generateStrategies('task-1');
  const riskCriteria = [{ id: 'risk', weight: 1, direction: 'minimize' as const }];

  const lowerRiskFirst = orchestrator.evaluateStrategyOptions('task-1', {
    criteria: riskCriteria,
    scores: { 'strategy-1': { risk: 1 }, 'strategy-2': { risk: 5 } },
  });
  assert.deepEqual(lowerRiskFirst.strategyOptionsEvaluation!.selection, { status: 'selected', strategyId: 'strategy-1' });

  const orchestrator2 = new MetaIntelligenceOrchestrator();
  taskAtCapabilityDecomposition(orchestrator2, graph, [
    { capability: 'anomaly-detection', origin: 'caller' },
    { capability: 'pattern-detection', origin: 'caller' },
  ]);
  orchestrator2.generateStrategies('task-1');

  const lowerRiskSecond = orchestrator2.evaluateStrategyOptions('task-1', {
    criteria: riskCriteria,
    scores: { 'strategy-1': { risk: 5 }, 'strategy-2': { risk: 1 } },
  });
  // Same criterion, only the risk scores swapped -- selection flips accordingly.
  assert.deepEqual(lowerRiskSecond.strategyOptionsEvaluation!.selection, { status: 'selected', strategyId: 'strategy-2' });
});

test('evaluateStrategyOptions() records "none selected" (no-candidates) without calling the scorer when there are no strategy options', () => {
  const graph = CapabilityGraph.fromManifests([]);
  const orchestrator = new MetaIntelligenceOrchestrator();
  taskAtCapabilityDecomposition(orchestrator, graph, [{ capability: 'anomaly-detection', origin: 'caller' }]);
  orchestrator.generateStrategies('task-1'); // no satisfied requirements -> strategies: []

  const throwingScorer = () => {
    throw new Error('scorer must not be called with zero options');
  };
  const updated = orchestrator.evaluateStrategyOptions('task-1', { criteria: [], scores: {} }, throwingScorer);

  assert.deepEqual(updated.strategyOptionsEvaluation!.selection, { status: 'none', reason: 'no-candidates' });
  assert.equal(updated.strategyOptionsEvaluation!.dsi, null);
  assert.deepEqual(updated.strategyOptionsEvaluation!.ranking, []);
});

test('evaluateStrategyOptions() is additive: it does not touch strategies, strategyAlternatives, or the frozen V1 candidateStrategies/strategyEvaluation surface', () => {
  const graph = CapabilityGraph.fromManifests([manifest({ id: 'magenais.a', capabilities: ['anomaly-detection'] })]);
  const orchestrator = new MetaIntelligenceOrchestrator();
  taskAtCapabilityDecomposition(orchestrator, graph, [{ capability: 'anomaly-detection', origin: 'caller' }]);
  const withStrategies = orchestrator.generateStrategies('task-1');
  const withAlternatives = orchestrator.generateStrategyAlternatives('task-1');
  orchestrator.generateCandidateStrategies('task-1');

  const updated = orchestrator.evaluateStrategyOptions('task-1', {
    criteria: [{ id: 'evidence', weight: 1, direction: 'maximize' }],
    scores: { 'strategy-1': { evidence: 3 } },
  });

  assert.deepEqual(updated.strategies, withStrategies.strategies);
  assert.deepEqual(updated.strategyAlternatives, withAlternatives.strategyAlternatives);
  assert.equal(updated.candidateStrategies!.candidates.length, 1);
  assert.equal(updated.strategyEvaluation, undefined);
});

test('evaluateStrategyOptions() throws MetaIntelligenceTaskNotFoundError for an unknown id', () => {
  const orchestrator = new MetaIntelligenceOrchestrator();
  assert.throws(
    () => orchestrator.evaluateStrategyOptions('missing', { criteria: [], scores: {} }),
    MetaIntelligenceTaskNotFoundError
  );
});

test('evaluateStrategyOptions() throws MetaIntelligenceTaskMissingStrategiesError before generateStrategies() has run', () => {
  const graph = CapabilityGraph.fromManifests([manifest({ id: 'magenais.a', capabilities: ['anomaly-detection'] })]);
  const orchestrator = new MetaIntelligenceOrchestrator();
  taskAtCapabilityDecomposition(orchestrator, graph, [{ capability: 'anomaly-detection', origin: 'caller' }]);

  assert.throws(
    () => orchestrator.evaluateStrategyOptions('task-1', { criteria: [], scores: {} }),
    MetaIntelligenceTaskMissingStrategiesError
  );
});

test('evaluateStrategyOptions() throws MetaIntelligenceStrategyOptionsAlreadyEvaluatedError on a second call for the same task', () => {
  const graph = CapabilityGraph.fromManifests([manifest({ id: 'magenais.a', capabilities: ['anomaly-detection'] })]);
  const orchestrator = new MetaIntelligenceOrchestrator();
  taskAtCapabilityDecomposition(orchestrator, graph, [{ capability: 'anomaly-detection', origin: 'caller' }]);
  orchestrator.generateStrategies('task-1');
  const request = { criteria: [{ id: 'evidence', weight: 1, direction: 'maximize' as const }], scores: { 'strategy-1': { evidence: 3 } } };

  orchestrator.evaluateStrategyOptions('task-1', request);

  assert.throws(
    () => orchestrator.evaluateStrategyOptions('task-1', request),
    MetaIntelligenceStrategyOptionsAlreadyEvaluatedError
  );
});

test('evaluateStrategyOptions() rejects an invalid minStability and leaves the task unchanged', () => {
  const graph = CapabilityGraph.fromManifests([manifest({ id: 'magenais.a', capabilities: ['anomaly-detection'] })]);
  const orchestrator = new MetaIntelligenceOrchestrator();
  taskAtCapabilityDecomposition(orchestrator, graph, [{ capability: 'anomaly-detection', origin: 'caller' }]);
  orchestrator.generateStrategies('task-1');
  const request = { criteria: [{ id: 'evidence', weight: 1, direction: 'maximize' as const }], scores: { 'strategy-1': { evidence: 3 } }, minStability: 1.5 };

  assert.throws(() => orchestrator.evaluateStrategyOptions('task-1', request), InvalidStrategyOptionsEvaluationError);
  assert.equal(orchestrator.getTask('task-1').strategyOptionsEvaluation, undefined);
});

test('evaluateStrategyOptions() rejects a scorer result that does not trace back to this task\'s strategy options', () => {
  const graph = CapabilityGraph.fromManifests([manifest({ id: 'magenais.a', capabilities: ['anomaly-detection'] })]);
  const orchestrator = new MetaIntelligenceOrchestrator();
  taskAtCapabilityDecomposition(orchestrator, graph, [{ capability: 'anomaly-detection', origin: 'caller' }]);
  orchestrator.generateStrategies('task-1');
  const request = { criteria: [{ id: 'evidence', weight: 1, direction: 'maximize' as const }], scores: { 'strategy-1': { evidence: 3 } } };

  const foreign = () => ({
    ranking: [{ optionId: 'not-a-real-strategy', score: 1, rank: 1 }],
    topOptionId: 'not-a-real-strategy',
    dsi: 1,
    dfp: [],
  });
  assert.throws(() => orchestrator.evaluateStrategyOptions('task-1', request, foreign), InvalidStrategyOptionsEvaluationError);
});

// -- V2-C1: authorizeComposition() -------------------------------------------

test('authorizeComposition(): \'ACT\' resolves and attaches the selected strategy\'s components verbatim, including an alternative-derived strategy', () => {
  const graph = CapabilityGraph.fromManifests([
    manifest({ id: 'magenais.a', capabilities: ['anomaly-detection'] }),
    manifest({ id: 'magenais.b', capabilities: ['anomaly-detection', 'pattern-detection'] }),
  ]);
  const orchestrator = new MetaIntelligenceOrchestrator();
  taskAtCapabilityDecomposition(orchestrator, graph, [
    { capability: 'anomaly-detection', origin: 'caller' },
    { capability: 'pattern-detection', origin: 'extracted' },
  ]);
  orchestrator.generateStrategies('task-1');
  orchestrator.generateStrategyAlternatives('task-1'); // strategy-3, strategy-4 (composed)
  orchestrator.evaluateStrategyOptions('task-1', {
    criteria: [{ id: 'evidence', weight: 1, direction: 'maximize' }],
    scores: {
      'strategy-1': { evidence: 1 },
      'strategy-2': { evidence: 1 },
      'strategy-3': { evidence: 9 }, // the alternative single-provider strategy wins
      'strategy-4': { evidence: 1 },
    },
  });

  const updated = orchestrator.authorizeComposition('task-1', { decision: 'ACT' });

  const boundary = updated.compositionBoundary!;
  assert.equal(boundary.decision, 'ACT');
  assert.deepEqual(boundary.selection, { status: 'selected', strategyId: 'strategy-3' });
  const expected = updated.strategyAlternatives!.strategies.find((s) => s.id === 'strategy-3')!;
  assert.deepEqual(boundary.components, expected.components);
  assert.equal(boundary.reason, null);
  assert.ok(!Number.isNaN(Date.parse(boundary.boundAt)));

  // Does not advance stage or touch governance/frozen fields.
  assert.equal(updated.stage, 'capability-decomposition');
  assert.equal(updated.governance, undefined);
  assert.deepEqual(orchestrator.getTask('task-1'), updated);
});

test('authorizeComposition(): components are a copy, not a shared reference, of the resolved strategy\'s components', () => {
  const graph = CapabilityGraph.fromManifests([manifest({ id: 'magenais.a', capabilities: ['anomaly-detection'] })]);
  const orchestrator = new MetaIntelligenceOrchestrator();
  taskAtCapabilityDecomposition(orchestrator, graph, [{ capability: 'anomaly-detection', origin: 'caller' }]);
  const withStrategies = orchestrator.generateStrategies('task-1');
  orchestrator.evaluateStrategyOptions('task-1', {
    criteria: [{ id: 'evidence', weight: 1, direction: 'maximize' }],
    scores: { 'strategy-1': { evidence: 5 } },
  });

  const updated = orchestrator.authorizeComposition('task-1', { decision: 'ACT' });

  assert.deepEqual(updated.compositionBoundary!.components, withStrategies.strategies!.strategies[0].components);
  assert.notEqual(updated.compositionBoundary!.components, withStrategies.strategies!.strategies[0].components);
});

test('authorizeComposition(): \'WAIT\'/\'ASK\'/\'SIMULATE\' may be recorded even when selection.status is \'none\', with null components', () => {
  const graph = CapabilityGraph.fromManifests([]);
  const orchestrator = new MetaIntelligenceOrchestrator();
  taskAtCapabilityDecomposition(orchestrator, graph, [{ capability: 'anomaly-detection', origin: 'caller' }]);
  orchestrator.generateStrategies('task-1'); // no satisfied requirements -> strategies: []
  orchestrator.evaluateStrategyOptions('task-1', { criteria: [], scores: {} });

  const updated = orchestrator.authorizeComposition('task-1', { decision: 'WAIT', reason: '  needs review  ' });

  assert.equal(updated.compositionBoundary!.decision, 'WAIT');
  assert.deepEqual(updated.compositionBoundary!.selection, { status: 'none', reason: 'no-candidates' });
  assert.equal(updated.compositionBoundary!.components, null);
  assert.equal(updated.compositionBoundary!.reason, 'needs review');
});

test('authorizeComposition() rejects \'ACT\' when selection.status is not \'selected\', and leaves the task unchanged', () => {
  const graph = CapabilityGraph.fromManifests([]);
  const orchestrator = new MetaIntelligenceOrchestrator();
  taskAtCapabilityDecomposition(orchestrator, graph, [{ capability: 'anomaly-detection', origin: 'caller' }]);
  orchestrator.generateStrategies('task-1');
  orchestrator.evaluateStrategyOptions('task-1', { criteria: [], scores: {} });

  assert.throws(
    () => orchestrator.authorizeComposition('task-1', { decision: 'ACT' }),
    MetaIntelligenceCompositionNotAuthorizableError
  );
  assert.equal(orchestrator.getTask('task-1').compositionBoundary, undefined);
});

test('authorizeComposition() throws MetaIntelligenceTaskNotFoundError for an unknown id', () => {
  const orchestrator = new MetaIntelligenceOrchestrator();
  assert.throws(
    () => orchestrator.authorizeComposition('missing', { decision: 'WAIT' }),
    MetaIntelligenceTaskNotFoundError
  );
});

test('authorizeComposition() throws MetaIntelligenceTaskMissingStrategyOptionsEvaluationError before evaluateStrategyOptions() has run', () => {
  const graph = CapabilityGraph.fromManifests([manifest({ id: 'magenais.a', capabilities: ['anomaly-detection'] })]);
  const orchestrator = new MetaIntelligenceOrchestrator();
  taskAtCapabilityDecomposition(orchestrator, graph, [{ capability: 'anomaly-detection', origin: 'caller' }]);
  orchestrator.generateStrategies('task-1');

  assert.throws(
    () => orchestrator.authorizeComposition('task-1', { decision: 'WAIT' }),
    MetaIntelligenceTaskMissingStrategyOptionsEvaluationError
  );
});

test('authorizeComposition() throws MetaIntelligenceCompositionAlreadyBoundError on a second call for the same task', () => {
  const graph = CapabilityGraph.fromManifests([manifest({ id: 'magenais.a', capabilities: ['anomaly-detection'] })]);
  const orchestrator = new MetaIntelligenceOrchestrator();
  taskAtCapabilityDecomposition(orchestrator, graph, [{ capability: 'anomaly-detection', origin: 'caller' }]);
  orchestrator.generateStrategies('task-1');
  orchestrator.evaluateStrategyOptions('task-1', {
    criteria: [{ id: 'evidence', weight: 1, direction: 'maximize' }],
    scores: { 'strategy-1': { evidence: 5 } },
  });
  orchestrator.authorizeComposition('task-1', { decision: 'ACT' });

  assert.throws(
    () => orchestrator.authorizeComposition('task-1', { decision: 'WAIT' }),
    MetaIntelligenceCompositionAlreadyBoundError
  );
});

test('authorizeComposition() throws InvalidCompositionDecisionError for a decision outside the four allowed values, and leaves the task unchanged', () => {
  const graph = CapabilityGraph.fromManifests([manifest({ id: 'magenais.a', capabilities: ['anomaly-detection'] })]);
  const orchestrator = new MetaIntelligenceOrchestrator();
  taskAtCapabilityDecomposition(orchestrator, graph, [{ capability: 'anomaly-detection', origin: 'caller' }]);
  orchestrator.generateStrategies('task-1');
  orchestrator.evaluateStrategyOptions('task-1', {
    criteria: [{ id: 'evidence', weight: 1, direction: 'maximize' }],
    scores: { 'strategy-1': { evidence: 5 } },
  });

  assert.throws(
    // @ts-expect-error deliberately invalid decision for this negative test
    () => orchestrator.authorizeComposition('task-1', { decision: 'MAYBE' }),
    InvalidCompositionDecisionError
  );
  assert.equal(orchestrator.getTask('task-1').compositionBoundary, undefined);
});

// -- V2-C2: buildExecutionPlan() ----------------------------------------------

test('buildExecutionPlan(): an \'ACT\'-decided boundary produces a plan whose steps are a verbatim, order-preserving copy of the boundary\'s components', () => {
  const graph = CapabilityGraph.fromManifests([
    manifest({ id: 'magenais.a', capabilities: ['anomaly-detection'] }),
    manifest({ id: 'magenais.b', capabilities: ['anomaly-detection', 'pattern-detection'] }),
  ]);
  const orchestrator = new MetaIntelligenceOrchestrator();
  taskAtCapabilityDecomposition(orchestrator, graph, [
    { capability: 'anomaly-detection', origin: 'caller' },
    { capability: 'pattern-detection', origin: 'extracted' },
  ]);
  orchestrator.generateStrategies('task-1');
  orchestrator.generateStrategyAlternatives('task-1'); // strategy-3, strategy-4 (composed)
  orchestrator.evaluateStrategyOptions('task-1', {
    criteria: [{ id: 'evidence', weight: 1, direction: 'maximize' }],
    scores: {
      'strategy-1': { evidence: 1 },
      'strategy-2': { evidence: 1 },
      'strategy-3': { evidence: 9 },
      'strategy-4': { evidence: 1 },
    },
  });
  const bound = orchestrator.authorizeComposition('task-1', { decision: 'ACT' });

  const updated = orchestrator.buildExecutionPlan('task-1');

  const plan = updated.executionPlan!;
  assert.deepEqual(plan.steps, bound.compositionBoundary!.components);
  assert.notEqual(plan.steps, bound.compositionBoundary!.components);
  assert.ok(!Number.isNaN(Date.parse(plan.derivedAt)));

  // Does not advance stage or touch compositionBoundary/governance/frozen fields.
  assert.equal(updated.stage, 'capability-decomposition');
  assert.deepEqual(updated.compositionBoundary, bound.compositionBoundary);
  assert.equal(updated.governance, undefined);
  assert.deepEqual(orchestrator.getTask('task-1'), updated);
});

test('buildExecutionPlan() throws MetaIntelligenceTaskNotFoundError for an unknown id', () => {
  const orchestrator = new MetaIntelligenceOrchestrator();
  assert.throws(() => orchestrator.buildExecutionPlan('missing'), MetaIntelligenceTaskNotFoundError);
});

test('buildExecutionPlan() throws MetaIntelligenceTaskMissingCompositionBoundaryError before authorizeComposition() has run', () => {
  const graph = CapabilityGraph.fromManifests([manifest({ id: 'magenais.a', capabilities: ['anomaly-detection'] })]);
  const orchestrator = new MetaIntelligenceOrchestrator();
  taskAtCapabilityDecomposition(orchestrator, graph, [{ capability: 'anomaly-detection', origin: 'caller' }]);
  orchestrator.generateStrategies('task-1');
  orchestrator.evaluateStrategyOptions('task-1', {
    criteria: [{ id: 'evidence', weight: 1, direction: 'maximize' }],
    scores: { 'strategy-1': { evidence: 5 } },
  });

  assert.throws(
    () => orchestrator.buildExecutionPlan('task-1'),
    MetaIntelligenceTaskMissingCompositionBoundaryError
  );
});

test('buildExecutionPlan() throws MetaIntelligenceExecutionPlanNotAuthorizedError when compositionBoundary.decision is not \'ACT\', even with resolved components', () => {
  const graph = CapabilityGraph.fromManifests([manifest({ id: 'magenais.a', capabilities: ['anomaly-detection'] })]);
  const orchestrator = new MetaIntelligenceOrchestrator();
  taskAtCapabilityDecomposition(orchestrator, graph, [{ capability: 'anomaly-detection', origin: 'caller' }]);
  orchestrator.generateStrategies('task-1');
  orchestrator.evaluateStrategyOptions('task-1', {
    criteria: [{ id: 'evidence', weight: 1, direction: 'maximize' }],
    scores: { 'strategy-1': { evidence: 5 } },
  });
  // 'WAIT' over a 'selected' strategy still populates components (V2-C1),
  // but must NOT be enough to authorize an execution plan (V2-C2's one
  // real gap: existence-gating to 'ACT' specifically).
  const bound = orchestrator.authorizeComposition('task-1', { decision: 'WAIT' });
  assert.notEqual(bound.compositionBoundary!.components, null);

  assert.throws(
    () => orchestrator.buildExecutionPlan('task-1'),
    MetaIntelligenceExecutionPlanNotAuthorizedError
  );
  assert.equal(orchestrator.getTask('task-1').executionPlan, undefined);
});

test('buildExecutionPlan() throws MetaIntelligenceExecutionPlanAlreadyBuiltError on a second call for the same task', () => {
  const graph = CapabilityGraph.fromManifests([manifest({ id: 'magenais.a', capabilities: ['anomaly-detection'] })]);
  const orchestrator = new MetaIntelligenceOrchestrator();
  taskAtCapabilityDecomposition(orchestrator, graph, [{ capability: 'anomaly-detection', origin: 'caller' }]);
  orchestrator.generateStrategies('task-1');
  orchestrator.evaluateStrategyOptions('task-1', {
    criteria: [{ id: 'evidence', weight: 1, direction: 'maximize' }],
    scores: { 'strategy-1': { evidence: 5 } },
  });
  orchestrator.authorizeComposition('task-1', { decision: 'ACT' });
  orchestrator.buildExecutionPlan('task-1');

  assert.throws(
    () => orchestrator.buildExecutionPlan('task-1'),
    MetaIntelligenceExecutionPlanAlreadyBuiltError
  );
});

// -- V2-C3: getCognitiveTrace() ------------------------------------------

test('getCognitiveTrace(): a freshly-intaken task has exactly one entry, for \'problem\', with no ids', () => {
  const orchestrator = new MetaIntelligenceOrchestrator();
  const task = orchestrator.intake({ statement: 'Reduce checkout drop-off.', id: 'task-1' });

  const trace: MetaIntelligenceCognitiveTrace = orchestrator.getCognitiveTrace('task-1');

  assert.equal(trace.taskId, 'task-1');
  assert.equal(trace.stage, 'received');
  assert.equal(trace.entries.length, 1);
  assert.equal(trace.entries[0].field, 'problem');
  assert.equal(trace.entries[0].recordedAt, task.problem.receivedAt);
  assert.deepEqual(trace.entries[0].idsTouched, []);
  assert.ok(!Number.isNaN(Date.parse(trace.derivedAt)));

  // Read-only: getTask() is unaffected, and no field was added to the task.
  assert.deepEqual(orchestrator.getTask('task-1'), task);
});

test('getCognitiveTrace(): available for a partially-progressed task -- no \'ACT\'-only gate, unlike buildExecutionPlan()', () => {
  const orchestrator = new MetaIntelligenceOrchestrator();
  orchestrator.intake({ statement: 'Reduce checkout drop-off.', id: 'task-1' });
  orchestrator.understand('task-1');
  const afterGoals = orchestrator.addGoalsConstraints('task-1', {
    goals: [{ text: 'Increase conversion', origin: 'caller' }],
    constraints: [{ text: 'No new vendors', origin: 'caller' }],
  });

  const trace = orchestrator.getCognitiveTrace('task-1');

  assert.deepEqual(
    trace.entries.map((e) => e.field),
    ['problem', 'understanding', 'goalsConstraints']
  );
  assert.equal(trace.entries[1].recordedAt, afterGoals.understanding!.understoodAt);
  assert.equal(trace.entries[2].recordedAt, afterGoals.goalsConstraints!.recordedAt);
  assert.deepEqual(
    trace.entries[2].idsTouched,
    [...afterGoals.goalsConstraints!.goals.map((g) => g.id), ...afterGoals.goalsConstraints!.constraints.map((c) => c.id)]
  );
});

test('getCognitiveTrace(): idsTouched surfaces the selected strategyId out of a discriminated-union selection -- not reproducible by reading task fields at a glance', () => {
  const graph = CapabilityGraph.fromManifests([
    manifest({ id: 'magenais.a', capabilities: ['anomaly-detection'] }),
    manifest({ id: 'magenais.b', capabilities: ['anomaly-detection', 'pattern-detection'] }),
  ]);
  const orchestrator = new MetaIntelligenceOrchestrator();
  taskAtCapabilityDecomposition(orchestrator, graph, [
    { capability: 'anomaly-detection', origin: 'caller' },
    { capability: 'pattern-detection', origin: 'extracted' },
  ]);
  orchestrator.generateStrategies('task-1');
  orchestrator.generateStrategyAlternatives('task-1'); // adds strategy-3 (composed)
  const evaluated = orchestrator.evaluateStrategyOptions('task-1', {
    criteria: [{ id: 'evidence', weight: 1, direction: 'maximize' }],
    scores: {
      'strategy-1': { evidence: 1 },
      'strategy-2': { evidence: 1 },
      'strategy-3': { evidence: 9 },
      'strategy-4': { evidence: 1 },
    },
  });
  const bound = orchestrator.authorizeComposition('task-1', { decision: 'ACT' });
  const withPlan = orchestrator.buildExecutionPlan('task-1');

  const trace = orchestrator.getCognitiveTrace('task-1');

  const selection = evaluated.strategyOptionsEvaluation!.selection;
  assert.equal(selection.status, 'selected');
  const selectedId = selection.status === 'selected' ? selection.strategyId : null;

  const optionsEntry = trace.entries.find((e) => e.field === 'strategyOptionsEvaluation')!;
  assert.deepEqual(optionsEntry.idsTouched, [selectedId]);
  assert.equal(optionsEntry.recordedAt, evaluated.strategyOptionsEvaluation!.evaluatedAt);

  const boundaryEntry = trace.entries.find((e) => e.field === 'compositionBoundary')!;
  assert.deepEqual(boundaryEntry.idsTouched, [selectedId]);
  assert.equal(boundaryEntry.recordedAt, bound.compositionBoundary!.boundAt);

  const planEntry = trace.entries.find((e) => e.field === 'executionPlan')!;
  assert.deepEqual(planEntry.idsTouched, withPlan.executionPlan!.steps.map((s) => s.requirementId));
  assert.equal(planEntry.recordedAt, withPlan.executionPlan!.derivedAt);

  assert.deepEqual(
    trace.entries.map((e) => e.field),
    [
      'problem',
      'understanding',
      'goalsConstraints',
      'epistemicTracking',
      'capabilityDecomposition',
      'strategies',
      'strategyAlternatives',
      'strategyOptionsEvaluation',
      'compositionBoundary',
      'executionPlan',
    ]
  );
});

test('getCognitiveTrace(): a \'none\' selection yields an empty idsTouched for that entry, never invented', () => {
  const graph = CapabilityGraph.fromManifests([]);
  const orchestrator = new MetaIntelligenceOrchestrator();
  taskAtCapabilityDecomposition(orchestrator, graph, [{ capability: 'anomaly-detection', origin: 'caller' }]);
  orchestrator.generateStrategies('task-1'); // no satisfied requirements -> strategies: []
  orchestrator.evaluateStrategyOptions('task-1', { criteria: [], scores: {} });

  const trace = orchestrator.getCognitiveTrace('task-1');

  const optionsEntry = trace.entries.find((e) => e.field === 'strategyOptionsEvaluation')!;
  assert.deepEqual(optionsEntry.idsTouched, []);
});

test('getCognitiveTrace() throws MetaIntelligenceTaskNotFoundError for an unknown id', () => {
  const orchestrator = new MetaIntelligenceOrchestrator();
  assert.throws(() => orchestrator.getCognitiveTrace('missing'), MetaIntelligenceTaskNotFoundError);
});

test('getCognitiveTrace() is purely derived: calling it twice never mutates the task and produces the same entries', () => {
  const orchestrator = new MetaIntelligenceOrchestrator();
  orchestrator.intake({ statement: 'Reduce checkout drop-off.', id: 'task-1' });
  orchestrator.understand('task-1');
  const beforeTrace = orchestrator.getTask('task-1');

  const first = orchestrator.getCognitiveTrace('task-1');
  const second = orchestrator.getCognitiveTrace('task-1');

  assert.deepEqual(first.entries, second.entries);
  // No new field was added to the task by deriving a trace, and its own state is untouched.
  assert.deepEqual(orchestrator.getTask('task-1'), beforeTrace);
  assert.ok(!('cognitiveTrace' in orchestrator.getTask('task-1')));
});

// -- V2-C4: recordExecutionOutcome() --------------------------------------

/** Advance a task all the way through an 'ACT'-authorized executionPlan, for recordExecutionOutcome() tests. */
function taskWithExecutionPlan(
  orchestrator: MetaIntelligenceOrchestrator,
  graph: Parameters<MetaIntelligenceOrchestrator['decomposeCapabilities']>[1],
  requirements: Parameters<MetaIntelligenceOrchestrator['decomposeCapabilities']>[2]['requirements'],
  id = 'task-1'
) {
  taskAtCapabilityDecomposition(orchestrator, graph, requirements, id);
  orchestrator.generateStrategies(id);
  orchestrator.evaluateStrategyOptions(id, {
    criteria: [{ id: 'evidence', weight: 1, direction: 'maximize' }],
    scores: { 'strategy-1': { evidence: 5 } },
  });
  orchestrator.authorizeComposition(id, { decision: 'ACT' });
  return orchestrator.buildExecutionPlan(id);
}

test('recordExecutionOutcome(): \'succeeded\' with a recorded goal and known verifies against basis, mirroring recordResult()\'s own logic', () => {
  const graph = CapabilityGraph.fromManifests([manifest({ id: 'magenais.a', capabilities: ['anomaly-detection'] })]);
  const orchestrator = new MetaIntelligenceOrchestrator();
  orchestrator.intake({ statement: 'Reduce checkout drop-off.', id: 'task-1' });
  orchestrator.understand('task-1');
  orchestrator.addGoalsConstraints('task-1', {
    goals: [{ text: 'Increase conversion', origin: 'caller' }],
    constraints: [],
  });
  orchestrator.addEpistemicTracking('task-1', {
    knowns: [{ text: 'Checkout has 3 steps', origin: 'caller' }],
    unknowns: [],
    assumptions: [],
    evidence: [],
  });
  const graph2 = CapabilityGraph.fromManifests([manifest({ id: 'magenais.a', capabilities: ['anomaly-detection'] })]);
  orchestrator.decomposeCapabilities('task-1', graph2, {
    requirements: [{ capability: 'anomaly-detection', origin: 'caller' }],
  });
  orchestrator.generateStrategies('task-1');
  orchestrator.evaluateStrategyOptions('task-1', {
    criteria: [{ id: 'evidence', weight: 1, direction: 'maximize' }],
    scores: { 'strategy-1': { evidence: 5 } },
  });
  orchestrator.authorizeComposition('task-1', { decision: 'ACT' });
  orchestrator.buildExecutionPlan('task-1');

  const updated = orchestrator.recordExecutionOutcome('task-1', { status: 'succeeded', detail: '  done  ' });

  assert.equal(updated.executionResult!.status, 'succeeded');
  assert.equal(updated.executionResult!.simulated, false);
  assert.equal(updated.executionResult!.detail, 'done');
  assert.equal(updated.executionVerification!.outcome, 'verified-against-basis');
  assert.deepEqual(updated.executionVerification!.goalIds, updated.goalsConstraints!.goals.map((g) => g.id));
  assert.deepEqual(updated.executionVerification!.knownIds, updated.epistemicTracking!.knowns.map((k) => k.id));
  assert.equal(updated.executionVerification!.verifiedAt, updated.executionResult!.recordedAt);

  // Does not advance stage or touch the frozen V1 result/verification/governance surface.
  assert.equal(updated.stage, 'capability-decomposition');
  assert.equal(updated.result, undefined);
  assert.equal(updated.verification, undefined);
  assert.equal(updated.governance, undefined);
  assert.deepEqual(orchestrator.getTask('task-1'), updated);
});

test('recordExecutionOutcome(): \'succeeded\' with no recorded goal/known yields insufficient-basis, exactly as recordResult() would', () => {
  const graph = CapabilityGraph.fromManifests([manifest({ id: 'magenais.a', capabilities: ['anomaly-detection'] })]);
  const orchestrator = new MetaIntelligenceOrchestrator();
  const withPlan = taskWithExecutionPlan(orchestrator, graph, [{ capability: 'anomaly-detection', origin: 'caller' }]);
  assert.deepEqual(withPlan.goalsConstraints!.goals, []);
  assert.deepEqual(withPlan.epistemicTracking!.knowns, []);

  const updated = orchestrator.recordExecutionOutcome('task-1', { status: 'succeeded' });

  assert.equal(updated.executionVerification!.outcome, 'insufficient-basis');
  assert.deepEqual(updated.executionVerification!.goalIds, []);
  assert.deepEqual(updated.executionVerification!.knownIds, []);
});

test('recordExecutionOutcome(): \'failed\' yields goals-not-met, and \'not-yet-executed\' yields not-verifiable', () => {
  const graph = CapabilityGraph.fromManifests([manifest({ id: 'magenais.a', capabilities: ['anomaly-detection'] })]);

  const failedOrchestrator = new MetaIntelligenceOrchestrator();
  taskWithExecutionPlan(failedOrchestrator, graph, [{ capability: 'anomaly-detection', origin: 'caller' }]);
  const failed = failedOrchestrator.recordExecutionOutcome('task-1', { status: 'failed' });
  assert.equal(failed.executionVerification!.outcome, 'goals-not-met');
  assert.equal(failed.executionResult!.status, 'failed');

  const notYetOrchestrator = new MetaIntelligenceOrchestrator();
  taskWithExecutionPlan(notYetOrchestrator, graph, [{ capability: 'anomaly-detection', origin: 'caller' }]);
  const notYet = notYetOrchestrator.recordExecutionOutcome('task-1', { status: 'not-yet-executed' });
  assert.equal(notYet.executionVerification!.outcome, 'not-verifiable');
});

test('recordExecutionOutcome(): simulated is always false -- buildExecutionPlan() only ever derives from an \'ACT\'-decided boundary', () => {
  const graph = CapabilityGraph.fromManifests([manifest({ id: 'magenais.a', capabilities: ['anomaly-detection'] })]);
  const orchestrator = new MetaIntelligenceOrchestrator();
  taskWithExecutionPlan(orchestrator, graph, [{ capability: 'anomaly-detection', origin: 'caller' }]);

  const updated = orchestrator.recordExecutionOutcome('task-1', { status: 'succeeded' });

  assert.equal(updated.executionResult!.simulated, false);
});

test('recordExecutionOutcome() throws MetaIntelligenceTaskNotFoundError for an unknown id', () => {
  const orchestrator = new MetaIntelligenceOrchestrator();
  assert.throws(
    () => orchestrator.recordExecutionOutcome('missing', { status: 'succeeded' }),
    MetaIntelligenceTaskNotFoundError
  );
});

test('recordExecutionOutcome() throws MetaIntelligenceTaskMissingExecutionPlanError before buildExecutionPlan() has run', () => {
  const graph = CapabilityGraph.fromManifests([manifest({ id: 'magenais.a', capabilities: ['anomaly-detection'] })]);
  const orchestrator = new MetaIntelligenceOrchestrator();
  taskAtCapabilityDecomposition(orchestrator, graph, [{ capability: 'anomaly-detection', origin: 'caller' }]);

  assert.throws(
    () => orchestrator.recordExecutionOutcome('task-1', { status: 'succeeded' }),
    MetaIntelligenceTaskMissingExecutionPlanError
  );
});

test('recordExecutionOutcome() throws MetaIntelligenceExecutionResultAlreadyRecordedError on a second call for the same task', () => {
  const graph = CapabilityGraph.fromManifests([manifest({ id: 'magenais.a', capabilities: ['anomaly-detection'] })]);
  const orchestrator = new MetaIntelligenceOrchestrator();
  taskWithExecutionPlan(orchestrator, graph, [{ capability: 'anomaly-detection', origin: 'caller' }]);
  orchestrator.recordExecutionOutcome('task-1', { status: 'succeeded' });

  assert.throws(
    () => orchestrator.recordExecutionOutcome('task-1', { status: 'failed' }),
    MetaIntelligenceExecutionResultAlreadyRecordedError
  );
});

test('recordExecutionOutcome() throws InvalidResultStatusError for a status outside the three allowed values, and leaves the task unchanged', () => {
  const graph = CapabilityGraph.fromManifests([manifest({ id: 'magenais.a', capabilities: ['anomaly-detection'] })]);
  const orchestrator = new MetaIntelligenceOrchestrator();
  taskWithExecutionPlan(orchestrator, graph, [{ capability: 'anomaly-detection', origin: 'caller' }]);

  assert.throws(
    // @ts-expect-error deliberately invalid status for this negative test
    () => orchestrator.recordExecutionOutcome('task-1', { status: 'maybe' }),
    InvalidResultStatusError
  );
  assert.equal(orchestrator.getTask('task-1').executionResult, undefined);
});

// -- V2-C5: getCognitiveTrace() extension for executionResult/executionVerification --

test('getCognitiveTrace(): now includes executionResult/executionVerification entries for a task that has them, in pipeline order after executionPlan', () => {
  const graph = CapabilityGraph.fromManifests([manifest({ id: 'magenais.a', capabilities: ['anomaly-detection'] })]);
  const orchestrator = new MetaIntelligenceOrchestrator();
  taskWithExecutionPlan(orchestrator, graph, [{ capability: 'anomaly-detection', origin: 'caller' }]);
  const withOutcome = orchestrator.recordExecutionOutcome('task-1', { status: 'failed', detail: 'timed out' });

  const trace = orchestrator.getCognitiveTrace('task-1');

  assert.deepEqual(
    trace.entries.map((e) => e.field),
    [
      'problem',
      'understanding',
      'goalsConstraints',
      'epistemicTracking',
      'capabilityDecomposition',
      'strategies',
      'strategyOptionsEvaluation',
      'compositionBoundary',
      'executionPlan',
      'executionResult',
      'executionVerification',
    ]
  );

  const resultEntry = trace.entries.find((e) => e.field === 'executionResult')!;
  assert.equal(resultEntry.recordedAt, withOutcome.executionResult!.recordedAt);
  assert.deepEqual(resultEntry.idsTouched, []);

  const verificationEntry = trace.entries.find((e) => e.field === 'executionVerification')!;
  assert.equal(verificationEntry.recordedAt, withOutcome.executionVerification!.verifiedAt);
  assert.deepEqual(verificationEntry.idsTouched, [
    ...withOutcome.executionVerification!.goalIds,
    ...withOutcome.executionVerification!.constraintIds,
    ...withOutcome.executionVerification!.knownIds,
  ]);

  // This task only went through recordExecutionOutcome(), never
  // recordExecutionAdaptation() -- so it has no executionAdaptation field
  // at all, and (per V2-D1) getCognitiveTrace() correctly omits an entry
  // for a field the task hasn't reached, exactly like every other field.
  assert.ok(!trace.entries.some((e) => e.field === 'executionAdaptation'));
});

// -- V2-D1: getCognitiveTrace() extension for executionAdaptation ---------

test('getCognitiveTrace(): now includes an executionAdaptation entry for a task that has one, in pipeline order after executionVerification', () => {
  const graph = CapabilityGraph.fromManifests([manifest({ id: 'magenais.a', capabilities: ['anomaly-detection'] })]);
  const orchestrator = new MetaIntelligenceOrchestrator();
  taskWithExecutionPlan(orchestrator, graph, [{ capability: 'anomaly-detection', origin: 'caller' }]);
  orchestrator.recordExecutionOutcome('task-1', { status: 'failed', detail: 'timed out' });
  const withAdaptation = orchestrator.recordExecutionAdaptation('task-1', { decision: 're-plan' });

  const trace = orchestrator.getCognitiveTrace('task-1');

  assert.deepEqual(
    trace.entries.map((e) => e.field),
    [
      'problem',
      'understanding',
      'goalsConstraints',
      'epistemicTracking',
      'capabilityDecomposition',
      'strategies',
      'strategyOptionsEvaluation',
      'compositionBoundary',
      'executionPlan',
      'executionResult',
      'executionVerification',
      'executionAdaptation',
    ]
  );

  const adaptationEntry = trace.entries.find((e) => e.field === 'executionAdaptation')!;
  assert.equal(adaptationEntry.recordedAt, withAdaptation.executionAdaptation!.adaptedAt);
  assert.deepEqual(adaptationEntry.idsTouched, []);
});

test('getCognitiveTrace(): a task that predates V2-C5 (no executionAdaptation) is completely unaffected by this AWU\'s change', () => {
  const graph = CapabilityGraph.fromManifests([manifest({ id: 'magenais.a', capabilities: ['anomaly-detection'] })]);
  const orchestrator = new MetaIntelligenceOrchestrator();
  taskWithExecutionPlan(orchestrator, graph, [{ capability: 'anomaly-detection', origin: 'caller' }]);
  orchestrator.recordExecutionOutcome('task-1', { status: 'failed', detail: 'timed out' });

  const trace = orchestrator.getCognitiveTrace('task-1');

  assert.deepEqual(
    trace.entries.map((e) => e.field),
    [
      'problem',
      'understanding',
      'goalsConstraints',
      'epistemicTracking',
      'capabilityDecomposition',
      'strategies',
      'strategyOptionsEvaluation',
      'compositionBoundary',
      'executionPlan',
      'executionResult',
      'executionVerification',
    ]
  );
});

test('getCognitiveTrace(): a task that predates V2-C4 (no executionResult/executionVerification) is completely unaffected by this AWU\'s change', () => {
  const orchestrator = new MetaIntelligenceOrchestrator();
  orchestrator.intake({ statement: 'Reduce checkout drop-off.', id: 'task-1' });
  orchestrator.understand('task-1');

  const trace = orchestrator.getCognitiveTrace('task-1');

  assert.deepEqual(
    trace.entries.map((e) => e.field),
    ['problem', 'understanding']
  );
});

// -- V2-C5: recordExecutionAdaptation() -----------------------------------

/** Advance a task through recordExecutionOutcome() with a given claimed status, for recordExecutionAdaptation() tests. */
function taskWithExecutionOutcome(
  orchestrator: MetaIntelligenceOrchestrator,
  graph: Parameters<MetaIntelligenceOrchestrator['decomposeCapabilities']>[1],
  requirements: Parameters<MetaIntelligenceOrchestrator['decomposeCapabilities']>[2]['requirements'],
  status: 'succeeded' | 'failed' | 'not-yet-executed',
  id = 'task-1'
) {
  taskWithExecutionPlan(orchestrator, graph, requirements, id);
  return orchestrator.recordExecutionOutcome(id, { status });
}

test('recordExecutionAdaptation(): records a caller decision against a \'goals-not-met\' executionVerification outcome (a \'failed\' claim)', () => {
  const graph = CapabilityGraph.fromManifests([manifest({ id: 'magenais.a', capabilities: ['anomaly-detection'] })]);
  const orchestrator = new MetaIntelligenceOrchestrator();
  const withOutcome = taskWithExecutionOutcome(
    orchestrator,
    graph,
    [{ capability: 'anomaly-detection', origin: 'caller' }],
    'failed'
  );
  assert.equal(withOutcome.executionVerification!.outcome, 'goals-not-met');

  const updated = orchestrator.recordExecutionAdaptation('task-1', { decision: 're-plan', reason: '  try a different provider  ' });

  assert.equal(updated.executionAdaptation!.decision, 're-plan');
  assert.equal(updated.executionAdaptation!.outcome, 'goals-not-met');
  assert.equal(updated.executionAdaptation!.reason, 'try a different provider');
  assert.ok(updated.executionAdaptation!.adaptedAt);

  // Does not advance stage or touch the frozen V1 adaptation/result/verification/governance surface.
  assert.equal(updated.stage, 'capability-decomposition');
  assert.equal(updated.adaptation, undefined);
  assert.equal(updated.result, undefined);
  assert.equal(updated.verification, undefined);
  assert.equal(updated.governance, undefined);
  assert.deepEqual(orchestrator.getTask('task-1'), updated);
});

test('recordExecutionAdaptation(): records a caller decision against an \'insufficient-basis\' executionVerification outcome (a \'succeeded\' claim with no recorded basis)', () => {
  const graph = CapabilityGraph.fromManifests([manifest({ id: 'magenais.a', capabilities: ['anomaly-detection'] })]);
  const orchestrator = new MetaIntelligenceOrchestrator();
  const withOutcome = taskWithExecutionOutcome(
    orchestrator,
    graph,
    [{ capability: 'anomaly-detection', origin: 'caller' }],
    'succeeded'
  );
  assert.equal(withOutcome.executionVerification!.outcome, 'insufficient-basis');

  const updated = orchestrator.recordExecutionAdaptation('task-1', { decision: 'accept' });

  assert.equal(updated.executionAdaptation!.decision, 'accept');
  assert.equal(updated.executionAdaptation!.outcome, 'insufficient-basis');
  assert.equal(updated.executionAdaptation!.reason, null);
});

test('recordExecutionAdaptation(): materially differs from recordAdaptation() -- succeeds on an executionPlan-only task where recordAdaptation() cannot even be reached', () => {
  const graph = CapabilityGraph.fromManifests([manifest({ id: 'magenais.a', capabilities: ['anomaly-detection'] })]);
  const orchestrator = new MetaIntelligenceOrchestrator();
  taskWithExecutionOutcome(orchestrator, graph, [{ capability: 'anomaly-detection', origin: 'caller' }], 'failed');

  // The frozen V1 recordAdaptation() is gated to task.stage === 'result-verification', which this
  // task -- whose outcome went through compositionBoundary/executionPlan/recordExecutionOutcome(),
  // never through governAction()/recordResult() -- can never reach.
  assert.throws(
    () => orchestrator.recordAdaptation('task-1', { decision: 're-plan' }),
    MetaIntelligenceTaskNotAtResultVerificationStageError
  );

  // recordExecutionAdaptation() succeeds on the exact same task, over executionVerification instead.
  const updated = orchestrator.recordExecutionAdaptation('task-1', { decision: 're-plan' });
  assert.equal(updated.executionAdaptation!.decision, 're-plan');
});

test('recordExecutionAdaptation() throws MetaIntelligenceTaskNotFoundError for an unknown id', () => {
  const orchestrator = new MetaIntelligenceOrchestrator();
  assert.throws(
    () => orchestrator.recordExecutionAdaptation('missing', { decision: 'accept' }),
    MetaIntelligenceTaskNotFoundError
  );
});

test('recordExecutionAdaptation() throws MetaIntelligenceTaskMissingExecutionVerificationError before recordExecutionOutcome() has run', () => {
  const graph = CapabilityGraph.fromManifests([manifest({ id: 'magenais.a', capabilities: ['anomaly-detection'] })]);
  const orchestrator = new MetaIntelligenceOrchestrator();
  taskWithExecutionPlan(orchestrator, graph, [{ capability: 'anomaly-detection', origin: 'caller' }]);

  assert.throws(
    () => orchestrator.recordExecutionAdaptation('task-1', { decision: 'accept' }),
    MetaIntelligenceTaskMissingExecutionVerificationError
  );
});

test('recordExecutionAdaptation() throws MetaIntelligenceExecutionAdaptationNotRepresentableError for \'verified-against-basis\' and \'not-verifiable\' outcomes', () => {
  const graph = CapabilityGraph.fromManifests([manifest({ id: 'magenais.a', capabilities: ['anomaly-detection'] })]);

  const verifiedOrchestrator = new MetaIntelligenceOrchestrator();
  verifiedOrchestrator.intake({ statement: 'Reduce checkout drop-off.', id: 'task-1' });
  verifiedOrchestrator.understand('task-1');
  verifiedOrchestrator.addGoalsConstraints('task-1', {
    goals: [{ text: 'Increase conversion', origin: 'caller' }],
    constraints: [],
  });
  verifiedOrchestrator.addEpistemicTracking('task-1', {
    knowns: [{ text: 'Checkout has 3 steps', origin: 'caller' }],
    unknowns: [],
    assumptions: [],
    evidence: [],
  });
  verifiedOrchestrator.decomposeCapabilities('task-1', graph, {
    requirements: [{ capability: 'anomaly-detection', origin: 'caller' }],
  });
  verifiedOrchestrator.generateStrategies('task-1');
  verifiedOrchestrator.evaluateStrategyOptions('task-1', {
    criteria: [{ id: 'evidence', weight: 1, direction: 'maximize' }],
    scores: { 'strategy-1': { evidence: 5 } },
  });
  verifiedOrchestrator.authorizeComposition('task-1', { decision: 'ACT' });
  verifiedOrchestrator.buildExecutionPlan('task-1');
  verifiedOrchestrator.recordExecutionOutcome('task-1', { status: 'succeeded' });
  assert.throws(
    () => verifiedOrchestrator.recordExecutionAdaptation('task-1', { decision: 'accept' }),
    MetaIntelligenceExecutionAdaptationNotRepresentableError
  );

  const notVerifiableOrchestrator = new MetaIntelligenceOrchestrator();
  taskWithExecutionOutcome(
    notVerifiableOrchestrator,
    graph,
    [{ capability: 'anomaly-detection', origin: 'caller' }],
    'not-yet-executed'
  );
  assert.throws(
    () => notVerifiableOrchestrator.recordExecutionAdaptation('task-1', { decision: 'accept' }),
    MetaIntelligenceExecutionAdaptationNotRepresentableError
  );
});

test('recordExecutionAdaptation() throws MetaIntelligenceExecutionAdaptationAlreadyRecordedError on a second call for the same task', () => {
  const graph = CapabilityGraph.fromManifests([manifest({ id: 'magenais.a', capabilities: ['anomaly-detection'] })]);
  const orchestrator = new MetaIntelligenceOrchestrator();
  taskWithExecutionOutcome(orchestrator, graph, [{ capability: 'anomaly-detection', origin: 'caller' }], 'failed');
  orchestrator.recordExecutionAdaptation('task-1', { decision: 'accept' });

  assert.throws(
    () => orchestrator.recordExecutionAdaptation('task-1', { decision: 'retry' }),
    MetaIntelligenceExecutionAdaptationAlreadyRecordedError
  );
});

test('recordExecutionAdaptation() throws InvalidAdaptationDecisionError for a decision outside the four allowed values, and leaves the task unchanged', () => {
  const graph = CapabilityGraph.fromManifests([manifest({ id: 'magenais.a', capabilities: ['anomaly-detection'] })]);
  const orchestrator = new MetaIntelligenceOrchestrator();
  taskWithExecutionOutcome(orchestrator, graph, [{ capability: 'anomaly-detection', origin: 'caller' }], 'failed');

  assert.throws(
    // @ts-expect-error deliberately invalid decision for this negative test
    () => orchestrator.recordExecutionAdaptation('task-1', { decision: 'ignore' }),
    InvalidAdaptationDecisionError
  );
  assert.equal(orchestrator.getTask('task-1').executionAdaptation, undefined);
});
