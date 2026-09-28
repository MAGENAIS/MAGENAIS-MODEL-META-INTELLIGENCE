/**
 * AWU-01 through AWU-10: focused tests for the
 * Meta-Intelligence contract + thin orchestrator. Covers intake,
 * mechanical normalization ("understand"), goals/constraints
 * ("addGoalsConstraints"), known/unknown/assumption/evidence tracking
 * ("addEpistemicTracking"), and capability decomposition against the
 * existing CapabilityGraph ("decomposeCapabilities"), and non-selecting
 * candidate-strategy generation ("generateCandidateStrategies"), and
 * DecisionScore-backed strategy evaluation/selection ("evaluateStrategies"),
 * and the ACT/WAIT/ASK/SIMULATE action-governance boundary ("governAction"),
 * and mechanical result recording + verification ("recordResult"), and the
 * retry/re-plan/escalate/accept adaptation decision ("recordAdaptation") —
 * no real execution/composition or automatic retry exists yet to test.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  MetaIntelligenceOrchestrator,
  EmptyProblemStatementError,
  MetaIntelligenceTaskAlreadyExistsError,
  MetaIntelligenceTaskNotFoundError,
  MetaIntelligenceTaskNotAtReceivedStageError,
  MetaIntelligenceTaskNotAtUnderstoodStageError,
  EmptyGoalOrConstraintTextError,
  MetaIntelligenceTaskNotAtGoalsConstraintsStageError,
  EmptyEpistemicItemTextError,
  MetaIntelligenceTaskNotAtEpistemicTrackingStageError,
  EmptyCapabilityRequirementError,
  MetaIntelligenceTaskNotAtCapabilityDecompositionStageError,
  MetaIntelligenceTaskNotAtCandidateStrategiesStageError,
  InvalidStrategyEvaluationError,
  MetaIntelligenceTaskNotAtStrategyEvaluationStageError,
  InvalidGovernanceDecisionError,
  MetaIntelligenceActionNotSelectableError,
  MetaIntelligenceTaskNotAtActionGovernanceStageError,
  MetaIntelligenceResultNotRepresentableError,
  InvalidResultStatusError,
  MetaIntelligenceTaskNotAtResultVerificationStageError,
  MetaIntelligenceAdaptationNotRepresentableError,
  InvalidAdaptationDecisionError,
} from '../src/MetaIntelligenceOrchestrator.ts';
import type { MetaIntelligenceTask } from '../src/types.ts';
import { CapabilityGraph } from './helpers/capabilityGraph.ts';
import type { ModelManifest } from '../src/contract.ts';
import { scoreWithDecisionScore } from '../src/scoring/decisionScoreScorer.ts';
import { DecisionScoreValidationError, scoreAndRank } from '../src/scoring/DecisionScoreAlgorithm.ts';
import { computeDSI } from '../src/scoring/DecisionStability.ts';

/** Advance a fresh orchestrator's task straight to 'goals-constraints', for epistemic-tracking tests. */
function taskAtGoalsConstraints(orchestrator: MetaIntelligenceOrchestrator, id = 'task-1'): void {
  orchestrator.intake({ statement: 'Reduce checkout drop-off.', id });
  orchestrator.understand(id);
  orchestrator.addGoalsConstraints(id, { goals: [], constraints: [] });
}

/** Advance a fresh orchestrator's task straight to 'epistemic-tracking', for capability-decomposition tests. */
function taskAtEpistemicTracking(orchestrator: MetaIntelligenceOrchestrator, id = 'task-1'): void {
  taskAtGoalsConstraints(orchestrator, id);
  orchestrator.addEpistemicTracking(id, { knowns: [], unknowns: [], assumptions: [], evidence: [] });
}

/** Minimal synthetic manifest for capability-decomposition tests, mirroring capabilityGraph.test.ts's helper. */
function manifest(overrides: Partial<ModelManifest> & { id: string }): ModelManifest {
  return {
    name: overrides.id,
    version: '1.0.0',
    description: 'Synthetic manifest for capability-decomposition tests.',
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

test('intake records the caller statement verbatim at the "received" stage', () => {
  const orchestrator = new MetaIntelligenceOrchestrator();
  const task = orchestrator.intake({ statement: '  Reduce checkout drop-off.  '.trim() });

  assert.equal(task.problem.statement, 'Reduce checkout drop-off.');
  assert.equal(task.stage, 'received');
  assert.equal(typeof task.id, 'string');
  assert.ok(task.id.length > 0);
  assert.equal(typeof task.problem.receivedAt, 'string');
  assert.ok(!Number.isNaN(Date.parse(task.problem.receivedAt)));
});

test('intake trims whitespace-only statements and rejects them as empty', () => {
  const orchestrator = new MetaIntelligenceOrchestrator();
  assert.throws(() => orchestrator.intake({ statement: '   ' }), EmptyProblemStatementError);
  assert.throws(() => orchestrator.intake({ statement: '' }), EmptyProblemStatementError);
});

test('intake assigns distinct generated ids when none is supplied', () => {
  const orchestrator = new MetaIntelligenceOrchestrator();
  const a = orchestrator.intake({ statement: 'Problem A' });
  const b = orchestrator.intake({ statement: 'Problem B' });
  assert.notEqual(a.id, b.id);
});

test('intake honors a caller-supplied id and rejects a duplicate', () => {
  const orchestrator = new MetaIntelligenceOrchestrator();
  const task = orchestrator.intake({ statement: 'Problem A', id: 'task-1' });
  assert.equal(task.id, 'task-1');
  assert.throws(
    () => orchestrator.intake({ statement: 'Problem A again', id: 'task-1' }),
    MetaIntelligenceTaskAlreadyExistsError
  );
});

test('getTask / tryGetTask / listTasks / size reflect tracked tasks', () => {
  const orchestrator = new MetaIntelligenceOrchestrator();
  assert.equal(orchestrator.size, 0);
  assert.equal(orchestrator.tryGetTask('missing'), undefined);
  assert.throws(() => orchestrator.getTask('missing'), MetaIntelligenceTaskNotFoundError);

  const task = orchestrator.intake({ statement: 'Problem A', id: 'task-1' });
  assert.equal(orchestrator.size, 1);
  assert.deepEqual(orchestrator.getTask('task-1'), task);
  assert.deepEqual(orchestrator.tryGetTask('task-1'), task);

  const listed: MetaIntelligenceTask[] = orchestrator.listTasks();
  assert.equal(listed.length, 1);
  assert.deepEqual(listed[0], task);
});

test('understand() collapses whitespace into a normalizedStatement without touching the verbatim problem', () => {
  const orchestrator = new MetaIntelligenceOrchestrator();
  const task = orchestrator.intake({ statement: 'Reduce   checkout\n\tdrop-off.', id: 'task-1' });
  assert.equal(task.problem.statement, 'Reduce   checkout\n\tdrop-off.');
  assert.equal(task.stage, 'received');
  assert.equal(task.understanding, undefined);

  const understood = orchestrator.understand('task-1');
  assert.equal(understood.stage, 'understood');
  assert.equal(understood.understanding?.normalizedStatement, 'Reduce checkout drop-off.');
  // The verbatim statement is unchanged.
  assert.equal(understood.problem.statement, 'Reduce   checkout\n\tdrop-off.');
  assert.ok(!Number.isNaN(Date.parse(understood.understanding!.understoodAt)));

  // getTask reflects the update.
  assert.deepEqual(orchestrator.getTask('task-1'), understood);
});

test('understand() throws MetaIntelligenceTaskNotFoundError for an unknown id', () => {
  const orchestrator = new MetaIntelligenceOrchestrator();
  assert.throws(() => orchestrator.understand('missing'), MetaIntelligenceTaskNotFoundError);
});

test('understand() rejects a task that is not at the "received" stage', () => {
  const orchestrator = new MetaIntelligenceOrchestrator();
  orchestrator.intake({ statement: 'Problem A', id: 'task-1' });
  orchestrator.understand('task-1');
  assert.throws(
    () => orchestrator.understand('task-1'),
    MetaIntelligenceTaskNotAtReceivedStageError
  );
});

test('addGoalsConstraints() records goals/constraints with origin and advances to "goals-constraints"', () => {
  const orchestrator = new MetaIntelligenceOrchestrator();
  orchestrator.intake({ statement: 'Reduce checkout drop-off.', id: 'task-1' });
  orchestrator.understand('task-1');

  const updated = orchestrator.addGoalsConstraints('task-1', {
    goals: [
      { text: 'Increase checkout completion rate', origin: 'caller' },
      { text: 'Improve funnel conversion', origin: 'extracted' },
    ],
    constraints: [{ text: 'No changes to the payment provider', origin: 'caller' }],
  });

  assert.equal(updated.stage, 'goals-constraints');
  assert.equal(updated.goalsConstraints?.goals.length, 2);
  assert.equal(updated.goalsConstraints?.goals[0].text, 'Increase checkout completion rate');
  assert.equal(updated.goalsConstraints?.goals[0].origin, 'caller');
  assert.equal(updated.goalsConstraints?.goals[1].origin, 'extracted');
  assert.equal(updated.goalsConstraints?.constraints.length, 1);
  assert.equal(updated.goalsConstraints?.constraints[0].origin, 'caller');
  assert.ok(!Number.isNaN(Date.parse(updated.goalsConstraints!.recordedAt)));

  // Every item gets a stable, unique id.
  const ids = [...updated.goalsConstraints!.goals, ...updated.goalsConstraints!.constraints].map((g) => g.id);
  assert.equal(new Set(ids).size, ids.length);

  // AWU-01/AWU-02 state remains unchanged and readable.
  assert.equal(updated.problem.statement, 'Reduce checkout drop-off.');
  assert.equal(updated.understanding?.normalizedStatement, 'Reduce checkout drop-off.');

  // getTask reflects the update.
  assert.deepEqual(orchestrator.getTask('task-1'), updated);
});

test('addGoalsConstraints() keeps caller and extracted items separate, never merging them', () => {
  const orchestrator = new MetaIntelligenceOrchestrator();
  orchestrator.intake({ statement: 'Reduce checkout drop-off.', id: 'task-1' });
  orchestrator.understand('task-1');

  const updated = orchestrator.addGoalsConstraints('task-1', {
    goals: [
      { text: 'Same wording', origin: 'caller' },
      { text: 'Same wording', origin: 'extracted' },
    ],
    constraints: [],
  });

  assert.equal(updated.goalsConstraints?.goals.length, 2);
  assert.notEqual(updated.goalsConstraints?.goals[0].id, updated.goalsConstraints?.goals[1].id);
  assert.equal(updated.goalsConstraints?.goals[0].origin, 'caller');
  assert.equal(updated.goalsConstraints?.goals[1].origin, 'extracted');
});

test('addGoalsConstraints() rejects an empty/whitespace-only goal or constraint text', () => {
  const orchestrator = new MetaIntelligenceOrchestrator();
  orchestrator.intake({ statement: 'Problem A', id: 'task-1' });
  orchestrator.understand('task-1');

  assert.throws(
    () => orchestrator.addGoalsConstraints('task-1', { goals: [{ text: '   ', origin: 'caller' }], constraints: [] }),
    EmptyGoalOrConstraintTextError
  );
  assert.throws(
    () => orchestrator.addGoalsConstraints('task-1', { goals: [], constraints: [{ text: '', origin: 'extracted' }] }),
    EmptyGoalOrConstraintTextError
  );

  // A rejected call must not have advanced the stage.
  assert.equal(orchestrator.getTask('task-1').stage, 'understood');
});

test('addGoalsConstraints() throws MetaIntelligenceTaskNotFoundError for an unknown id', () => {
  const orchestrator = new MetaIntelligenceOrchestrator();
  assert.throws(
    () => orchestrator.addGoalsConstraints('missing', { goals: [], constraints: [] }),
    MetaIntelligenceTaskNotFoundError
  );
});

test('addGoalsConstraints() rejects a task that is not at the "understood" stage', () => {
  const orchestrator = new MetaIntelligenceOrchestrator();
  orchestrator.intake({ statement: 'Problem A', id: 'task-1' });

  // Still at 'received' — understand() has not run yet.
  assert.throws(
    () => orchestrator.addGoalsConstraints('task-1', { goals: [], constraints: [] }),
    MetaIntelligenceTaskNotAtUnderstoodStageError
  );

  orchestrator.understand('task-1');
  orchestrator.addGoalsConstraints('task-1', { goals: [], constraints: [] });

  // Already at 'goals-constraints' — calling again must be rejected.
  assert.throws(
    () => orchestrator.addGoalsConstraints('task-1', { goals: [], constraints: [] }),
    MetaIntelligenceTaskNotAtUnderstoodStageError
  );
});

test('two orchestrator instances track tasks independently', () => {
  const first = new MetaIntelligenceOrchestrator();
  const second = new MetaIntelligenceOrchestrator();
  first.intake({ statement: 'Only in first', id: 'task-1' });
  assert.equal(first.size, 1);
  assert.equal(second.size, 0);
});

test('addEpistemicTracking() records knowns/unknowns/assumptions/evidence with origin and advances to "epistemic-tracking"', () => {
  const orchestrator = new MetaIntelligenceOrchestrator();
  taskAtGoalsConstraints(orchestrator);

  const updated = orchestrator.addEpistemicTracking('task-1', {
    knowns: [{ text: 'Checkout has 5 steps today', origin: 'caller' }],
    unknowns: [{ text: 'Which step causes the most drop-off', origin: 'extracted' }],
    assumptions: [{ text: 'Mobile users behave like desktop users', origin: 'extracted' }],
    evidence: [{ text: 'Analytics show 40% drop-off at step 3', origin: 'caller' }],
  });

  assert.equal(updated.stage, 'epistemic-tracking');
  assert.equal(updated.epistemicTracking?.knowns.length, 1);
  assert.equal(updated.epistemicTracking?.knowns[0].origin, 'caller');
  assert.equal(updated.epistemicTracking?.unknowns.length, 1);
  assert.equal(updated.epistemicTracking?.unknowns[0].origin, 'extracted');
  assert.equal(updated.epistemicTracking?.assumptions.length, 1);
  assert.equal(updated.epistemicTracking?.evidence.length, 1);
  assert.ok(!Number.isNaN(Date.parse(updated.epistemicTracking!.recordedAt)));

  // Every item gets a stable, unique id.
  const ids = [
    ...updated.epistemicTracking!.knowns,
    ...updated.epistemicTracking!.unknowns,
    ...updated.epistemicTracking!.assumptions,
    ...updated.epistemicTracking!.evidence,
  ].map((item) => item.id);
  assert.equal(new Set(ids).size, ids.length);

  // AWU-01/AWU-02/AWU-03 state remains unchanged and readable.
  assert.equal(updated.problem.statement, 'Reduce checkout drop-off.');
  assert.equal(updated.understanding?.normalizedStatement, 'Reduce checkout drop-off.');
  assert.deepEqual(updated.goalsConstraints?.goals, []);

  // getTask reflects the update.
  assert.deepEqual(orchestrator.getTask('task-1'), updated);
});

test('addEpistemicTracking() keeps caller and extracted items separate, never merging them', () => {
  const orchestrator = new MetaIntelligenceOrchestrator();
  taskAtGoalsConstraints(orchestrator);

  const updated = orchestrator.addEpistemicTracking('task-1', {
    knowns: [
      { text: 'Same wording', origin: 'caller' },
      { text: 'Same wording', origin: 'extracted' },
    ],
    unknowns: [],
    assumptions: [],
    evidence: [],
  });

  assert.equal(updated.epistemicTracking?.knowns.length, 2);
  assert.notEqual(updated.epistemicTracking?.knowns[0].id, updated.epistemicTracking?.knowns[1].id);
  assert.equal(updated.epistemicTracking?.knowns[0].origin, 'caller');
  assert.equal(updated.epistemicTracking?.knowns[1].origin, 'extracted');
});

test('addEpistemicTracking() rejects an empty/whitespace-only item text in any category', () => {
  const orchestrator = new MetaIntelligenceOrchestrator();
  taskAtGoalsConstraints(orchestrator);

  assert.throws(
    () =>
      orchestrator.addEpistemicTracking('task-1', {
        knowns: [{ text: '   ', origin: 'caller' }],
        unknowns: [],
        assumptions: [],
        evidence: [],
      }),
    EmptyEpistemicItemTextError
  );
  assert.throws(
    () =>
      orchestrator.addEpistemicTracking('task-1', {
        knowns: [],
        unknowns: [],
        assumptions: [],
        evidence: [{ text: '', origin: 'extracted' }],
      }),
    EmptyEpistemicItemTextError
  );

  // A rejected call must not have advanced the stage.
  assert.equal(orchestrator.getTask('task-1').stage, 'goals-constraints');
});

test('addEpistemicTracking() throws MetaIntelligenceTaskNotFoundError for an unknown id', () => {
  const orchestrator = new MetaIntelligenceOrchestrator();
  assert.throws(
    () => orchestrator.addEpistemicTracking('missing', { knowns: [], unknowns: [], assumptions: [], evidence: [] }),
    MetaIntelligenceTaskNotFoundError
  );
});

test('addEpistemicTracking() rejects a task that is not at the "goals-constraints" stage', () => {
  const orchestrator = new MetaIntelligenceOrchestrator();
  orchestrator.intake({ statement: 'Problem A', id: 'task-1' });
  orchestrator.understand('task-1');

  // Still at 'understood' — addGoalsConstraints() has not run yet.
  assert.throws(
    () => orchestrator.addEpistemicTracking('task-1', { knowns: [], unknowns: [], assumptions: [], evidence: [] }),
    MetaIntelligenceTaskNotAtGoalsConstraintsStageError
  );

  orchestrator.addGoalsConstraints('task-1', { goals: [], constraints: [] });
  orchestrator.addEpistemicTracking('task-1', { knowns: [], unknowns: [], assumptions: [], evidence: [] });

  // Already at 'epistemic-tracking' — calling again must be rejected.
  assert.throws(
    () => orchestrator.addEpistemicTracking('task-1', { knowns: [], unknowns: [], assumptions: [], evidence: [] }),
    MetaIntelligenceTaskNotAtGoalsConstraintsStageError
  );
});

test('decomposeCapabilities() checks requirements against the CapabilityGraph and advances to "capability-decomposition"', () => {
  const graph = CapabilityGraph.fromManifests([
    manifest({ id: 'magenais.a', capabilities: ['anomaly-detection'] }),
    manifest({ id: 'magenais.b', capabilities: ['anomaly-detection', 'pattern-detection'] }),
  ]);

  const orchestrator = new MetaIntelligenceOrchestrator();
  taskAtEpistemicTracking(orchestrator);

  const updated = orchestrator.decomposeCapabilities('task-1', graph, {
    requirements: [
      { capability: 'anomaly-detection', origin: 'caller' },
      { capability: 'pattern-detection', origin: 'extracted' },
      { capability: 'strategy-planning', origin: 'extracted' },
    ],
  });

  assert.equal(updated.stage, 'capability-decomposition');
  const [anomaly, pattern, gap] = updated.capabilityDecomposition!.requirements;

  assert.equal(anomaly.capability, 'anomaly-detection');
  assert.equal(anomaly.origin, 'caller');
  assert.deepEqual(anomaly.providers, ['magenais.a', 'magenais.b']);
  assert.equal(anomaly.satisfied, true);

  assert.equal(pattern.capability, 'pattern-detection');
  assert.equal(pattern.origin, 'extracted');
  assert.deepEqual(pattern.providers, ['magenais.b']);
  assert.equal(pattern.satisfied, true);

  assert.equal(gap.capability, 'strategy-planning');
  assert.deepEqual(gap.providers, []);
  assert.equal(gap.satisfied, false);

  assert.deepEqual(updated.capabilityDecomposition!.gaps, ['strategy-planning']);
  assert.ok(!Number.isNaN(Date.parse(updated.capabilityDecomposition!.decomposedAt)));

  // Every item gets a stable, unique id.
  const ids = updated.capabilityDecomposition!.requirements.map((r) => r.id);
  assert.equal(new Set(ids).size, ids.length);

  // AWU-01/AWU-02/AWU-03/AWU-04 state remains unchanged and readable.
  assert.equal(updated.problem.statement, 'Reduce checkout drop-off.');
  assert.equal(updated.understanding?.normalizedStatement, 'Reduce checkout drop-off.');
  assert.deepEqual(updated.goalsConstraints?.goals, []);
  assert.deepEqual(updated.epistemicTracking?.knowns, []);

  // getTask reflects the update.
  assert.deepEqual(orchestrator.getTask('task-1'), updated);
});

test('decomposeCapabilities() de-duplicates repeated gaps while keeping each requirement as its own item', () => {
  const graph = CapabilityGraph.fromManifests([]);
  const orchestrator = new MetaIntelligenceOrchestrator();
  taskAtEpistemicTracking(orchestrator);

  const updated = orchestrator.decomposeCapabilities('task-1', graph, {
    requirements: [
      { capability: 'unmet-capability', origin: 'caller' },
      { capability: 'unmet-capability', origin: 'extracted' },
    ],
  });

  assert.equal(updated.capabilityDecomposition?.requirements.length, 2);
  assert.notEqual(
    updated.capabilityDecomposition?.requirements[0].id,
    updated.capabilityDecomposition?.requirements[1].id
  );
  assert.deepEqual(updated.capabilityDecomposition?.gaps, ['unmet-capability']);
});

test('decomposeCapabilities() rejects an empty/whitespace-only capability name', () => {
  const graph = CapabilityGraph.fromManifests([]);
  const orchestrator = new MetaIntelligenceOrchestrator();
  taskAtEpistemicTracking(orchestrator);

  assert.throws(
    () => orchestrator.decomposeCapabilities('task-1', graph, { requirements: [{ capability: '   ', origin: 'caller' }] }),
    EmptyCapabilityRequirementError
  );

  // A rejected call must not have advanced the stage.
  assert.equal(orchestrator.getTask('task-1').stage, 'epistemic-tracking');
});

test('decomposeCapabilities() throws MetaIntelligenceTaskNotFoundError for an unknown id', () => {
  const graph = CapabilityGraph.fromManifests([]);
  const orchestrator = new MetaIntelligenceOrchestrator();
  assert.throws(
    () => orchestrator.decomposeCapabilities('missing', graph, { requirements: [] }),
    MetaIntelligenceTaskNotFoundError
  );
});

test('decomposeCapabilities() rejects a task that is not at the "epistemic-tracking" stage', () => {
  const graph = CapabilityGraph.fromManifests([]);
  const orchestrator = new MetaIntelligenceOrchestrator();
  orchestrator.intake({ statement: 'Problem A', id: 'task-1' });
  orchestrator.understand('task-1');
  orchestrator.addGoalsConstraints('task-1', { goals: [], constraints: [] });

  // Still at 'goals-constraints' — addEpistemicTracking() has not run yet.
  assert.throws(
    () => orchestrator.decomposeCapabilities('task-1', graph, { requirements: [] }),
    MetaIntelligenceTaskNotAtEpistemicTrackingStageError
  );

  orchestrator.addEpistemicTracking('task-1', { knowns: [], unknowns: [], assumptions: [], evidence: [] });
  orchestrator.decomposeCapabilities('task-1', graph, { requirements: [] });

  // Already at 'capability-decomposition' — calling again must be rejected.
  assert.throws(
    () => orchestrator.decomposeCapabilities('task-1', graph, { requirements: [] }),
    MetaIntelligenceTaskNotAtEpistemicTrackingStageError
  );
});

/** Advance a fresh orchestrator's task straight to 'capability-decomposition', for candidate-strategies tests. */
function taskAtCapabilityDecomposition(
  orchestrator: MetaIntelligenceOrchestrator,
  graph: Parameters<MetaIntelligenceOrchestrator['decomposeCapabilities']>[1],
  requirements: Parameters<MetaIntelligenceOrchestrator['decomposeCapabilities']>[2]['requirements'],
  id = 'task-1'
): MetaIntelligenceTask {
  taskAtEpistemicTracking(orchestrator, id);
  return orchestrator.decomposeCapabilities(id, graph, { requirements });
}

test('generateCandidateStrategies() builds one candidate per satisfied requirement and advances to "candidate-strategies"', () => {
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

  const updated = orchestrator.generateCandidateStrategies('task-1');

  assert.equal(updated.stage, 'candidate-strategies');
  const candidates = updated.candidateStrategies!.candidates;

  // The gap ('strategy-planning', requirement 2) yields no candidate; the two satisfied ones do, in requirement order.
  assert.equal(candidates.length, 2);
  const [first, second] = candidates;

  assert.equal(first.requirementId, before.capabilityDecomposition!.requirements[0].id);
  assert.equal(first.capability, 'anomaly-detection');
  assert.deepEqual(first.providers, ['magenais.a', 'magenais.b']);

  assert.equal(second.requirementId, before.capabilityDecomposition!.requirements[2].id);
  assert.equal(second.capability, 'pattern-detection');
  assert.deepEqual(second.providers, ['magenais.b']);

  // Every candidate gets a stable, unique id, and none is built from a gap.
  assert.equal(new Set(candidates.map((c) => c.id)).size, candidates.length);
  assert.ok(candidates.every((c) => c.providers.length > 0));
  assert.ok(!Number.isNaN(Date.parse(updated.candidateStrategies!.generatedAt)));

  // getTask reflects the update.
  assert.deepEqual(orchestrator.getTask('task-1'), updated);
});

test('generateCandidateStrategies() leaves AWU-01 through AWU-05 state unchanged and readable', () => {
  const graph = CapabilityGraph.fromManifests([
    manifest({ id: 'magenais.a', capabilities: ['anomaly-detection'] }),
    manifest({ id: 'magenais.b', capabilities: ['anomaly-detection', 'pattern-detection'] }),
  ]);
  const orchestrator = new MetaIntelligenceOrchestrator();
  const before = taskAtCapabilityDecomposition(orchestrator, graph, [
    { capability: 'anomaly-detection', origin: 'caller' },
    { capability: 'strategy-planning', origin: 'extracted' },
  ]);

  const updated = orchestrator.generateCandidateStrategies('task-1');

  assert.equal(updated.problem.statement, 'Reduce checkout drop-off.');
  assert.deepEqual(updated.problem, before.problem);
  assert.deepEqual(updated.understanding, before.understanding);
  assert.deepEqual(updated.goalsConstraints, before.goalsConstraints);
  assert.deepEqual(updated.epistemicTracking, before.epistemicTracking);
  assert.deepEqual(updated.capabilityDecomposition, before.capabilityDecomposition);
  assert.deepEqual(updated.capabilityDecomposition!.gaps, ['strategy-planning']);
});

test('generateCandidateStrategies() does not evaluate, rank, or select: candidates carry no score/rank/selected fields', () => {
  const graph = CapabilityGraph.fromManifests([
    manifest({ id: 'magenais.a', capabilities: ['anomaly-detection'] }),
    manifest({ id: 'magenais.b', capabilities: ['anomaly-detection', 'pattern-detection'] }),
  ]);
  const orchestrator = new MetaIntelligenceOrchestrator();
  taskAtCapabilityDecomposition(orchestrator, graph, [{ capability: 'anomaly-detection', origin: 'caller' }]);

  const updated = orchestrator.generateCandidateStrategies('task-1');

  assert.deepEqual(Object.keys(updated.candidateStrategies!).sort(), ['candidates', 'generatedAt']);
  for (const candidate of updated.candidateStrategies!.candidates) {
    assert.deepEqual(Object.keys(candidate).sort(), ['capability', 'id', 'providers', 'requirementId']);
  }
  // A candidate keeps the requirement's full provider list; no single provider has been chosen.
  assert.deepEqual(updated.candidateStrategies!.candidates[0].providers, ['magenais.a', 'magenais.b']);
  // No selection lives on the task itself either.
  assert.ok(!('selectedStrategy' in updated));
  assert.ok(!('selection' in updated));
});

test('generateCandidateStrategies() copies providers rather than sharing the decomposition\'s array', () => {
  const graph = CapabilityGraph.fromManifests([
    manifest({ id: 'magenais.a', capabilities: ['anomaly-detection'] }),
    manifest({ id: 'magenais.b', capabilities: ['anomaly-detection', 'pattern-detection'] }),
  ]);
  const orchestrator = new MetaIntelligenceOrchestrator();
  taskAtCapabilityDecomposition(orchestrator, graph, [{ capability: 'anomaly-detection', origin: 'caller' }]);

  const updated = orchestrator.generateCandidateStrategies('task-1');

  assert.notEqual(
    updated.candidateStrategies!.candidates[0].providers,
    updated.capabilityDecomposition!.requirements[0].providers
  );
});

test('generateCandidateStrategies() yields an empty candidate list (still advancing) when every requirement is a gap or there are none', () => {
  const graph = CapabilityGraph.fromManifests([]);

  const allGaps = new MetaIntelligenceOrchestrator();
  taskAtCapabilityDecomposition(allGaps, graph, [
    { capability: 'unmet-a', origin: 'caller' },
    { capability: 'unmet-b', origin: 'extracted' },
  ]);
  const gapResult = allGaps.generateCandidateStrategies('task-1');
  assert.equal(gapResult.stage, 'candidate-strategies');
  assert.deepEqual(gapResult.candidateStrategies!.candidates, []);
  assert.deepEqual(gapResult.capabilityDecomposition!.gaps, ['unmet-a', 'unmet-b']);

  const none = new MetaIntelligenceOrchestrator();
  taskAtCapabilityDecomposition(none, graph, []);
  const noneResult = none.generateCandidateStrategies('task-1');
  assert.equal(noneResult.stage, 'candidate-strategies');
  assert.deepEqual(noneResult.candidateStrategies!.candidates, []);
});

test('generateCandidateStrategies() keeps one candidate per satisfied requirement, even for a repeated capability', () => {
  const graph = CapabilityGraph.fromManifests([
    manifest({ id: 'magenais.a', capabilities: ['anomaly-detection'] }),
    manifest({ id: 'magenais.b', capabilities: ['anomaly-detection', 'pattern-detection'] }),
  ]);
  const orchestrator = new MetaIntelligenceOrchestrator();
  taskAtCapabilityDecomposition(orchestrator, graph, [
    { capability: 'pattern-detection', origin: 'caller' },
    { capability: 'pattern-detection', origin: 'extracted' },
  ]);

  const candidates = orchestrator.generateCandidateStrategies('task-1').candidateStrategies!.candidates;

  assert.equal(candidates.length, 2);
  assert.notEqual(candidates[0].id, candidates[1].id);
  assert.notEqual(candidates[0].requirementId, candidates[1].requirementId);
});

test('generateCandidateStrategies() throws MetaIntelligenceTaskNotFoundError for an unknown id', () => {
  const orchestrator = new MetaIntelligenceOrchestrator();
  assert.throws(() => orchestrator.generateCandidateStrategies('missing'), MetaIntelligenceTaskNotFoundError);
});

test('generateCandidateStrategies() is reachable only from "capability-decomposition"', () => {
  const graph = CapabilityGraph.fromManifests([]);
  const orchestrator = new MetaIntelligenceOrchestrator();
  taskAtEpistemicTracking(orchestrator);

  // At 'epistemic-tracking' — decomposeCapabilities() has not run yet.
  assert.throws(
    () => orchestrator.generateCandidateStrategies('task-1'),
    MetaIntelligenceTaskNotAtCapabilityDecompositionStageError
  );
  assert.equal(orchestrator.getTask('task-1').stage, 'epistemic-tracking');

  orchestrator.decomposeCapabilities('task-1', graph, { requirements: [] });
  orchestrator.generateCandidateStrategies('task-1');

  // Already at 'candidate-strategies' — calling again must be rejected.
  assert.throws(
    () => orchestrator.generateCandidateStrategies('task-1'),
    MetaIntelligenceTaskNotAtCapabilityDecompositionStageError
  );
});

/** Real CapabilityGraph from a capability -> providers map (AWU-07 helper). */
function graphFor(providersByCapability: Record<string, string[]>): CapabilityGraph {
  const providers = new Set(Object.values(providersByCapability).flat());
  return CapabilityGraph.fromManifests(
    [...providers].map((id) =>
      manifest({
        id,
        capabilities: Object.keys(providersByCapability).filter((cap) => providersByCapability[cap].includes(id)),
      })
    )
  );
}

/** Uses the orchestrator's default scorer: the real DecisionScore functions. */
function evaluate(
  orchestrator: MetaIntelligenceOrchestrator,
  id: string,
  request: Parameters<MetaIntelligenceOrchestrator['evaluateStrategies']>[1]
): MetaIntelligenceTask {
  return orchestrator.evaluateStrategies(id, request);
}

// ---------------------------------------------------------------------------
// AWU-07: evaluateStrategies() — DecisionScore-backed evaluation/selection.
// ---------------------------------------------------------------------------

const AD = 'anomaly-detection';
const PD = 'pattern-detection';

/** Task at 'candidate-strategies' with two candidates: strategy-1 (anomaly-detection) and strategy-2 (pattern-detection), plus one gap. */
function taskAtCandidateStrategies(orchestrator: MetaIntelligenceOrchestrator, id = 'task-1'): MetaIntelligenceTask {
  const graph = graphFor({ [AD]: ['magenais.a', 'magenais.b'], [PD]: ['magenais.b'] });
  taskAtCapabilityDecomposition(
    orchestrator,
    graph,
    [
      { capability: AD, origin: 'caller' },
      { capability: PD, origin: 'caller' },
      { capability: 'strategy-planning', origin: 'caller' },
    ],
    id
  );
  return orchestrator.generateCandidateStrategies(id);
}

const CRITERIA = [
  { id: 'impact', weight: 0.6, direction: 'maximize' as const },
  { id: 'cost', weight: 0.4, direction: 'minimize' as const },
];
/** strategy-1 dominates strategy-2 on both criteria. */
const CLEAR_SCORES = {
  'strategy-1': { impact: 9, cost: 2 },
  'strategy-2': { impact: 4, cost: 7 },
};
/** Trade-off with weights 0.51/0.49: strategy-1 wins narrowly, so the ranking is not perfectly stable. */
const NARROW_CRITERIA = [
  { id: 'impact', weight: 0.51, direction: 'maximize' as const },
  { id: 'cost', weight: 0.49, direction: 'maximize' as const },
];
const NARROW_SCORES = {
  'strategy-1': { impact: 10, cost: 0 },
  'strategy-2': { impact: 0, cost: 10 },
};

test('evaluateStrategies() scores candidates, records an explicit selection, and advances to "strategy-evaluation"', () => {
  const orchestrator = new MetaIntelligenceOrchestrator();
  taskAtCandidateStrategies(orchestrator);

  const updated = evaluate(orchestrator, 'task-1', { criteria: CRITERIA, scores: CLEAR_SCORES });
  assert.equal(updated.stage, 'strategy-evaluation');
  assert.equal(orchestrator.getTask('task-1').stage, 'strategy-evaluation');

  const evaluation = updated.strategyEvaluation!;
  assert.deepEqual(evaluation.selection, { status: 'selected', candidateId: 'strategy-1' });
  assert.deepEqual(
    evaluation.ranking.map((r) => [r.candidateId, r.rank]),
    [
      ['strategy-1', 1],
      ['strategy-2', 2],
    ]
  );
  assert.ok(evaluation.ranking[0].score > evaluation.ranking[1].score);
  assert.ok(evaluation.ranking.every((r) => r.score >= 0 && r.score <= 1));
  assert.ok(typeof evaluation.dsi === 'number' && evaluation.dsi >= 0 && evaluation.dsi <= 1);
  assert.ok(Array.isArray(evaluation.dfp));
  assert.equal(evaluation.minStability, null);
  assert.deepEqual(evaluation.criteria, CRITERIA);
  assert.deepEqual(evaluation.scores, CLEAR_SCORES);
  assert.ok(!Number.isNaN(Date.parse(evaluation.evaluatedAt)));
});

test('evaluateStrategies() selection is traceable to a candidate id on the same task', () => {
  const orchestrator = new MetaIntelligenceOrchestrator();
  taskAtCandidateStrategies(orchestrator);
  // Flip the winner so the selection is not just "the first candidate".
  const flipped = { 'strategy-1': CLEAR_SCORES['strategy-2'], 'strategy-2': CLEAR_SCORES['strategy-1'] };
  const updated = evaluate(orchestrator, 'task-1', { criteria: CRITERIA, scores: flipped });

  const selection = updated.strategyEvaluation!.selection;
  assert.equal(selection.status, 'selected');
  assert.equal(selection.status === 'selected' && selection.candidateId, 'strategy-2');
  const candidateIds = updated.candidateStrategies!.candidates.map((c) => c.id);
  assert.ok(selection.status === 'selected' && candidateIds.includes(selection.candidateId));
  // Only a candidate is selected — no provider has been chosen from its list.
  assert.deepEqual(Object.keys(selection).sort(), ['candidateId', 'status']);
});

test('evaluateStrategies() leaves AWU-01..06 state unchanged and readable', () => {
  const orchestrator = new MetaIntelligenceOrchestrator();
  const before = taskAtCandidateStrategies(orchestrator);
  const snapshot = JSON.parse(JSON.stringify(before));

  const after = evaluate(orchestrator, 'task-1', { criteria: CRITERIA, scores: CLEAR_SCORES });
  for (const key of [
    'id',
    'problem',
    'understanding',
    'goalsConstraints',
    'epistemicTracking',
    'capabilityDecomposition',
    'candidateStrategies',
  ] as const) {
    assert.deepEqual(after[key], snapshot[key], `${key} must be unchanged`);
  }
  // Candidates still carry no score/rank/selected fields; evaluation state lives beside them.
  for (const candidate of after.candidateStrategies!.candidates) {
    assert.deepEqual(Object.keys(candidate).sort(), ['capability', 'id', 'providers', 'requirementId']);
  }
  assert.deepEqual(after.capabilityDecomposition!.gaps, ['strategy-planning']);
});

test('evaluateStrategies() records "none selected" (no-candidates) without calling the scorer when there are no candidates', () => {
  const orchestrator = new MetaIntelligenceOrchestrator();
  taskAtCapabilityDecomposition(orchestrator, graphFor({}), [{ capability: 'strategy-planning', origin: 'caller' }]);
  orchestrator.generateCandidateStrategies('task-1');

  const throwingScorer = () => {
    throw new Error('scorer must not be called with zero candidates');
  };
  const updated = orchestrator.evaluateStrategies('task-1', { criteria: [], scores: {} }, throwingScorer);
  const evaluation = updated.strategyEvaluation!;

  assert.equal(updated.stage, 'strategy-evaluation');
  assert.deepEqual(evaluation.selection, { status: 'none', reason: 'no-candidates' });
  assert.deepEqual(evaluation.ranking, []);
  assert.deepEqual(evaluation.dfp, []);
  assert.equal(evaluation.dsi, null);
});

test('evaluateStrategies() records "none selected" (tie-for-top) instead of breaking a tie by candidate order', () => {
  const orchestrator = new MetaIntelligenceOrchestrator();
  taskAtCandidateStrategies(orchestrator);

  const updated = evaluate(orchestrator, 'task-1', {
    criteria: CRITERIA,
    scores: { 'strategy-1': { impact: 5, cost: 5 }, 'strategy-2': { impact: 5, cost: 5 } },
  });
  const evaluation = updated.strategyEvaluation!;
  assert.deepEqual(evaluation.selection, { status: 'none', reason: 'tie-for-top' });
  // The ranking is still recorded for inspection.
  assert.equal(evaluation.ranking.length, 2);
});

test('evaluateStrategies() applies minStability: below-threshold DSI records "none selected", otherwise selects', () => {
  const run = (minStability?: number) => {
    const orchestrator = new MetaIntelligenceOrchestrator();
    taskAtCandidateStrategies(orchestrator);
    return evaluate(orchestrator, 'task-1', { criteria: NARROW_CRITERIA, scores: NARROW_SCORES, minStability })
      .strategyEvaluation!;
  };

  const unconstrained = run();
  assert.equal(unconstrained.selection.status, 'selected');
  assert.ok(unconstrained.dsi! < 1, 'fixture must be a not-perfectly-stable ranking');

  const strict = run(1);
  assert.equal(strict.minStability, 1);
  assert.deepEqual(strict.selection, { status: 'none', reason: 'below-stability-threshold' });
  assert.equal(strict.ranking[0].candidateId, 'strategy-1'); // ranking still recorded

  const lenient = run(0);
  assert.deepEqual(lenient.selection, { status: 'selected', candidateId: 'strategy-1' });
});

test('evaluateStrategies() rejects an invalid minStability and leaves the task unchanged', () => {
  const orchestrator = new MetaIntelligenceOrchestrator();
  taskAtCandidateStrategies(orchestrator);
  for (const bad of [-0.1, 1.5, Number.NaN]) {
    assert.throws(
      () => evaluate(orchestrator, 'task-1', { criteria: CRITERIA, scores: CLEAR_SCORES, minStability: bad }),
      InvalidStrategyEvaluationError
    );
  }
  assert.equal(orchestrator.getTask('task-1').stage, 'candidate-strategies');
  assert.equal(orchestrator.getTask('task-1').strategyEvaluation, undefined);
});

test('evaluateStrategies() is reachable only from "candidate-strategies"', () => {
  const orchestrator = new MetaIntelligenceOrchestrator();
  const request = { criteria: CRITERIA, scores: CLEAR_SCORES };

  assert.throws(() => evaluate(orchestrator, 'missing', request), MetaIntelligenceTaskNotFoundError);

  orchestrator.intake({ statement: 'Reduce checkout drop-off.', id: 'task-1' });
  assert.throws(() => evaluate(orchestrator, 'task-1', request), MetaIntelligenceTaskNotAtCandidateStrategiesStageError);
  orchestrator.understand('task-1');
  assert.throws(() => evaluate(orchestrator, 'task-1', request), MetaIntelligenceTaskNotAtCandidateStrategiesStageError);
  orchestrator.addGoalsConstraints('task-1', { goals: [], constraints: [] });
  assert.throws(() => evaluate(orchestrator, 'task-1', request), MetaIntelligenceTaskNotAtCandidateStrategiesStageError);
  orchestrator.addEpistemicTracking('task-1', { knowns: [], unknowns: [], assumptions: [], evidence: [] });
  assert.throws(() => evaluate(orchestrator, 'task-1', request), MetaIntelligenceTaskNotAtCandidateStrategiesStageError);
  orchestrator.decomposeCapabilities('task-1', graphFor({ [AD]: ['magenais.a'] }), {
    requirements: [{ capability: AD, origin: 'caller' }],
  });
  assert.throws(() => evaluate(orchestrator, 'task-1', request), MetaIntelligenceTaskNotAtCandidateStrategiesStageError);
  assert.equal(orchestrator.getTask('task-1').stage, 'capability-decomposition');

  orchestrator.generateCandidateStrategies('task-1');
  evaluate(orchestrator, 'task-1', { criteria: CRITERIA, scores: { 'strategy-1': { impact: 1, cost: 1 } } });

  // Already evaluated — calling again is rejected, and the earlier generation step can't be re-run either.
  assert.throws(() => evaluate(orchestrator, 'task-1', request), MetaIntelligenceTaskNotAtCandidateStrategiesStageError);
  assert.throws(() => orchestrator.generateCandidateStrategies('task-1'), MetaIntelligenceTaskNotAtCapabilityDecompositionStageError);
});

test('evaluateStrategies() leaves the task unchanged when the scorer rejects the input (e.g. missing scores)', () => {
  const orchestrator = new MetaIntelligenceOrchestrator();
  taskAtCandidateStrategies(orchestrator);

  assert.throws(() => evaluate(orchestrator, 'task-1', { criteria: CRITERIA, scores: { 'strategy-1': { impact: 1, cost: 1 } } }));
  assert.throws(() => evaluate(orchestrator, 'task-1', { criteria: [], scores: {} }));
  assert.equal(orchestrator.getTask('task-1').stage, 'candidate-strategies');
  assert.equal(orchestrator.getTask('task-1').strategyEvaluation, undefined);
});

test('evaluateStrategies() rejects a scorer result that does not trace back to this task\'s candidates', () => {
  const orchestrator = new MetaIntelligenceOrchestrator();
  taskAtCandidateStrategies(orchestrator);
  const request = { criteria: CRITERIA, scores: CLEAR_SCORES };

  const foreign = () => ({
    ranking: [
      { optionId: 'strategy-1', score: 0.9, rank: 1 },
      { optionId: 'not-a-candidate', score: 0.1, rank: 2 },
    ],
    topOptionId: 'strategy-1',
    dsi: 1,
    dfp: [],
  });
  assert.throws(() => orchestrator.evaluateStrategies('task-1', request, foreign), InvalidStrategyEvaluationError);

  const badTop = () => ({
    ranking: [
      { optionId: 'strategy-1', score: 0.9, rank: 1 },
      { optionId: 'strategy-2', score: 0.1, rank: 2 },
    ],
    topOptionId: 'strategy-2',
    dsi: 1,
    dfp: [],
  });
  assert.throws(() => orchestrator.evaluateStrategies('task-1', request, badTop), InvalidStrategyEvaluationError);

  assert.equal(orchestrator.getTask('task-1').stage, 'candidate-strategies');
  assert.equal(orchestrator.getTask('task-1').strategyEvaluation, undefined);
});

test('evaluateStrategies() records copies: mutating the request afterwards cannot alter the recorded evaluation', () => {
  const orchestrator = new MetaIntelligenceOrchestrator();
  taskAtCandidateStrategies(orchestrator);
  const criteria = CRITERIA.map((c) => ({ ...c }));
  const scores = { 'strategy-1': { ...CLEAR_SCORES['strategy-1'] }, 'strategy-2': { ...CLEAR_SCORES['strategy-2'] } };

  const updated = evaluate(orchestrator, 'task-1', { criteria, scores });
  criteria[0].weight = 99;
  scores['strategy-1'].impact = -1;

  assert.deepEqual(updated.strategyEvaluation!.criteria, CRITERIA);
  assert.deepEqual(updated.strategyEvaluation!.scores, CLEAR_SCORES);
});

test('evaluateStrategies() adds no execution, verification, or adaptation', () => {
  const orchestrator = new MetaIntelligenceOrchestrator();
  taskAtCandidateStrategies(orchestrator);
  const updated = evaluate(orchestrator, 'task-1', { criteria: CRITERIA, scores: CLEAR_SCORES });

  assert.deepEqual(Object.keys(updated.strategyEvaluation!).sort(), [
    'criteria',
    'dfp',
    'dsi',
    'evaluatedAt',
    'minStability',
    'ranking',
    'scores',
    'selection',
  ]);
  for (const name of ['execute', 'verify', 'adapt', 'replan', 'compose']) {
    assert.equal((orchestrator as unknown as Record<string, unknown>)[name], undefined, `${name} must not exist yet`);
  }
});

test('evaluateStrategies() default scorer is the real DecisionScore pipeline (same ranking, score, and DSI)', () => {
  const orchestrator = new MetaIntelligenceOrchestrator();
  taskAtCandidateStrategies(orchestrator);
  const evaluation = evaluate(orchestrator, 'task-1', { criteria: NARROW_CRITERIA, scores: NARROW_SCORES }).strategyEvaluation!;

  const input = {
    options: [{ id: 'strategy-1' }, { id: 'strategy-2' }],
    criteria: NARROW_CRITERIA,
    scores: NARROW_SCORES,
  };
  const direct = scoreAndRank(input).ranking;
  assert.deepEqual(
    evaluation.ranking,
    direct.map((r) => ({ candidateId: r.optionId, score: r.score, rank: r.rank }))
  );
  assert.equal(evaluation.dsi, computeDSI(input, direct[0].optionId).dsi); // default seed => deterministic
  assert.deepEqual(scoreWithDecisionScore(input).ranking, direct);
});

test('evaluateStrategies() default scorer surfaces DecisionScore validation errors and passes scorerOptions through', () => {
  const orchestrator = new MetaIntelligenceOrchestrator();
  taskAtCandidateStrategies(orchestrator);
  assert.throws(
    () => evaluate(orchestrator, 'task-1', { criteria: CRITERIA, scores: { 'strategy-1': { impact: 1, cost: 1 } } }),
    DecisionScoreValidationError
  );

  const seen: unknown[] = [];
  orchestrator.evaluateStrategies('task-1', { criteria: CRITERIA, scores: CLEAR_SCORES, scorerOptions: { seed: 7 } }, (input, options) => {
    seen.push(options);
    return scoreWithDecisionScore(input, options);
  });
  assert.deepEqual(seen, [{ seed: 7 }]);
});

// ---------------------------------------------------------------------------
// AWU-08: governAction() — ACT/WAIT/ASK/SIMULATE action-governance boundary.
// ---------------------------------------------------------------------------

/** Task at 'strategy-evaluation' with candidate strategy-1 selected (CLEAR_SCORES makes strategy-1 the clear winner). */
function taskAtStrategyEvaluationSelected(orchestrator: MetaIntelligenceOrchestrator, id = 'task-1'): MetaIntelligenceTask {
  taskAtCandidateStrategies(orchestrator, id);
  return evaluate(orchestrator, id, { criteria: CRITERIA, scores: CLEAR_SCORES });
}

/** Task at 'strategy-evaluation' with no candidates, so the selection is {status:'none', reason:'no-candidates'}. */
function taskAtStrategyEvaluationNone(orchestrator: MetaIntelligenceOrchestrator, id = 'task-1'): MetaIntelligenceTask {
  const graph = graphFor({});
  taskAtCapabilityDecomposition(orchestrator, graph, [{ capability: 'strategy-planning', origin: 'caller' }], id);
  orchestrator.generateCandidateStrategies(id);
  return evaluate(orchestrator, id, { criteria: [], scores: {} });
}

test('governAction() records ACT for a selected task and advances to "action-governance"', () => {
  const orchestrator = new MetaIntelligenceOrchestrator();
  const before = taskAtStrategyEvaluationSelected(orchestrator);
  assert.equal(before.strategyEvaluation!.selection.status, 'selected');

  const updated = orchestrator.governAction('task-1', { decision: 'ACT' });

  assert.equal(updated.stage, 'action-governance');
  assert.equal(updated.governance!.decision, 'ACT');
  assert.deepEqual(updated.governance!.selection, before.strategyEvaluation!.selection);
  assert.equal(updated.governance!.reason, null);
  assert.equal(typeof updated.governance!.governedAt, 'string');
  // Earlier-stage state, including strategyEvaluation, is untouched.
  assert.deepEqual(updated.strategyEvaluation, before.strategyEvaluation);
});

test('governAction() records WAIT/ASK/SIMULATE for a selected task without requiring ACT', () => {
  for (const decision of ['WAIT', 'ASK', 'SIMULATE'] as const) {
    const orchestrator = new MetaIntelligenceOrchestrator();
    taskAtStrategyEvaluationSelected(orchestrator);
    const updated = orchestrator.governAction('task-1', { decision, reason: `because ${decision}` });
    assert.equal(updated.governance!.decision, decision);
    assert.equal(updated.governance!.reason, `because ${decision}`);
  }
});

test('governAction() rejects ACT when the task has no selection ("none")', () => {
  const orchestrator = new MetaIntelligenceOrchestrator();
  const before = taskAtStrategyEvaluationNone(orchestrator);
  assert.equal(before.strategyEvaluation!.selection.status, 'none');

  assert.throws(() => orchestrator.governAction('task-1', { decision: 'ACT' }), MetaIntelligenceActionNotSelectableError);

  // Rejected: task left unchanged, still at 'strategy-evaluation'.
  assert.equal(orchestrator.getTask('task-1').stage, 'strategy-evaluation');
  assert.equal(orchestrator.getTask('task-1').governance, undefined);
});

test('governAction() allows WAIT/ASK/SIMULATE when the task has no selection ("none")', () => {
  for (const decision of ['WAIT', 'ASK', 'SIMULATE'] as const) {
    const orchestrator = new MetaIntelligenceOrchestrator();
    taskAtStrategyEvaluationNone(orchestrator);
    const updated = orchestrator.governAction('task-1', { decision });
    assert.equal(updated.stage, 'action-governance');
    assert.equal(updated.governance!.decision, decision);
    assert.equal(updated.governance!.selection.status, 'none');
  }
});

test('governAction() rejects an invalid decision value', () => {
  const orchestrator = new MetaIntelligenceOrchestrator();
  taskAtStrategyEvaluationSelected(orchestrator);
  assert.throws(
    () => orchestrator.governAction('task-1', { decision: 'PROCEED' as unknown as 'ACT' }),
    InvalidGovernanceDecisionError
  );
  assert.equal(orchestrator.getTask('task-1').stage, 'strategy-evaluation');
});

test('governAction() rejects a task not at "strategy-evaluation"', () => {
  const orchestrator = new MetaIntelligenceOrchestrator();
  taskAtCandidateStrategies(orchestrator); // stage: 'candidate-strategies', not 'strategy-evaluation'
  assert.throws(
    () => orchestrator.governAction('task-1', { decision: 'WAIT' }),
    MetaIntelligenceTaskNotAtStrategyEvaluationStageError
  );

  const orchestrator2 = new MetaIntelligenceOrchestrator();
  taskAtStrategyEvaluationSelected(orchestrator2);
  orchestrator2.governAction('task-1', { decision: 'WAIT' }); // now at 'action-governance'
  assert.throws(
    () => orchestrator2.governAction('task-1', { decision: 'WAIT' }),
    MetaIntelligenceTaskNotAtStrategyEvaluationStageError
  );
});

test('governAction() records a verbatim copy of the selection: later state changes cannot alter it', () => {
  const orchestrator = new MetaIntelligenceOrchestrator();
  taskAtStrategyEvaluationSelected(orchestrator);
  const updated = orchestrator.governAction('task-1', { decision: 'WAIT' });
  const recordedSelection = updated.governance!.selection;

  assert.notEqual(recordedSelection, updated.strategyEvaluation!.selection, 'must be a copy, not the same reference');
  assert.deepEqual(recordedSelection, updated.strategyEvaluation!.selection);
});

test('governAction() treats a blank/whitespace-only reason as no reason (null)', () => {
  const orchestrator = new MetaIntelligenceOrchestrator();
  taskAtStrategyEvaluationSelected(orchestrator);
  const updated = orchestrator.governAction('task-1', { decision: 'WAIT', reason: '   ' });
  assert.equal(updated.governance!.reason, null);
});

test('governAction() adds no execution, verification, or adaptation', () => {
  const orchestrator = new MetaIntelligenceOrchestrator();
  taskAtStrategyEvaluationSelected(orchestrator);
  const updated = orchestrator.governAction('task-1', { decision: 'SIMULATE' });

  assert.deepEqual(Object.keys(updated.governance!).sort(), ['decision', 'governedAt', 'reason', 'selection']);
  for (const name of ['execute', 'verify', 'adapt', 'replan', 'compose']) {
    assert.equal((orchestrator as unknown as Record<string, unknown>)[name], undefined, `${name} must not exist yet`);
  }
});

// ---------------------------------------------------------------------------
// AWU-09: recordResult() — mechanical result representation + verification.
// ---------------------------------------------------------------------------

/** Task at 'strategy-evaluation' (selected) with one goal, one constraint, and one known, then governed to `decision`. */
function taskAtActionGovernance(
  orchestrator: MetaIntelligenceOrchestrator,
  decision: 'ACT' | 'WAIT' | 'ASK' | 'SIMULATE',
  id = 'task-1'
): MetaIntelligenceTask {
  orchestrator.intake({ statement: 'Reduce checkout drop-off.', id });
  orchestrator.understand(id);
  orchestrator.addGoalsConstraints(id, {
    goals: [{ text: 'Increase completion rate.', origin: 'caller' }],
    constraints: [],
  });
  orchestrator.addEpistemicTracking(id, {
    knowns: [{ text: 'Checkout has 3 steps.', origin: 'caller' }],
    unknowns: [],
    assumptions: [],
    evidence: [],
  });
  const graph = graphFor({ [AD]: ['magenais.a'] });
  orchestrator.decomposeCapabilities(id, graph, { requirements: [{ capability: AD, origin: 'caller' }] });
  orchestrator.generateCandidateStrategies(id);
  evaluate(orchestrator, id, { criteria: [{ id: 'impact', weight: 1, direction: 'maximize' }], scores: { 'strategy-1': { impact: 5 } } });
  return orchestrator.governAction(id, { decision });
}

test('recordResult() records "succeeded" under ACT, verifies against basis, advances to "result-verification"', () => {
  const orchestrator = new MetaIntelligenceOrchestrator();
  const before = taskAtActionGovernance(orchestrator, 'ACT');

  const updated = orchestrator.recordResult('task-1', { status: 'succeeded' });

  assert.equal(updated.stage, 'result-verification');
  assert.equal(updated.result!.status, 'succeeded');
  assert.equal(updated.result!.simulated, false);
  assert.equal(updated.result!.detail, null);
  assert.ok(!Number.isNaN(Date.parse(updated.result!.recordedAt)));

  assert.equal(updated.verification!.outcome, 'verified-against-basis');
  assert.deepEqual(updated.verification!.goalIds, ['goal-1']);
  assert.deepEqual(updated.verification!.constraintIds, []);
  assert.deepEqual(updated.verification!.knownIds, ['known-1']);
  assert.equal(updated.verification!.verifiedAt, updated.result!.recordedAt);

  // Earlier-stage state, including governance, is untouched.
  assert.deepEqual(updated.governance, before.governance);
});

test('recordResult() marks simulated:true under SIMULATE governance, false under ACT', () => {
  const orchestratorAct = new MetaIntelligenceOrchestrator();
  taskAtActionGovernance(orchestratorAct, 'ACT');
  const act = orchestratorAct.recordResult('task-1', { status: 'succeeded' });
  assert.equal(act.result!.simulated, false);

  const orchestratorSim = new MetaIntelligenceOrchestrator();
  taskAtActionGovernance(orchestratorSim, 'SIMULATE');
  const sim = orchestratorSim.recordResult('task-1', { status: 'succeeded' });
  assert.equal(sim.result!.simulated, true);
});

test('recordResult() records "failed" as verification outcome "goals-not-met" regardless of basis', () => {
  const orchestrator = new MetaIntelligenceOrchestrator();
  taskAtActionGovernance(orchestrator, 'ACT');
  const updated = orchestrator.recordResult('task-1', { status: 'failed', detail: 'Timed out.' });

  assert.equal(updated.result!.status, 'failed');
  assert.equal(updated.result!.detail, 'Timed out.');
  assert.equal(updated.verification!.outcome, 'goals-not-met');
  // Basis ids are still recorded even though the outcome doesn't depend on their content.
  assert.deepEqual(updated.verification!.goalIds, ['goal-1']);
});

test('recordResult() records "not-yet-executed" as verification outcome "not-verifiable"', () => {
  const orchestrator = new MetaIntelligenceOrchestrator();
  taskAtActionGovernance(orchestrator, 'SIMULATE');
  const updated = orchestrator.recordResult('task-1', { status: 'not-yet-executed' });

  assert.equal(updated.result!.status, 'not-yet-executed');
  assert.equal(updated.verification!.outcome, 'not-verifiable');
});

test('recordResult() records "insufficient-basis" for a "succeeded" claim with no goals/constraints or no knowns', () => {
  const orchestrator = new MetaIntelligenceOrchestrator();
  orchestrator.intake({ statement: 'Reduce checkout drop-off.', id: 'task-1' });
  orchestrator.understand('task-1');
  orchestrator.addGoalsConstraints('task-1', { goals: [], constraints: [] }); // no goals/constraints
  orchestrator.addEpistemicTracking('task-1', {
    knowns: [{ text: 'Checkout has 3 steps.', origin: 'caller' }],
    unknowns: [],
    assumptions: [],
    evidence: [],
  });
  const graph = graphFor({ [AD]: ['magenais.a'] });
  orchestrator.decomposeCapabilities('task-1', graph, { requirements: [{ capability: AD, origin: 'caller' }] });
  orchestrator.generateCandidateStrategies('task-1');
  evaluate(orchestrator, 'task-1', { criteria: [{ id: 'impact', weight: 1, direction: 'maximize' }], scores: { 'strategy-1': { impact: 5 } } });
  orchestrator.governAction('task-1', { decision: 'ACT' });

  const updated = orchestrator.recordResult('task-1', { status: 'succeeded' });
  assert.equal(updated.verification!.outcome, 'insufficient-basis');
  assert.deepEqual(updated.verification!.goalIds, []);
  assert.deepEqual(updated.verification!.knownIds, ['known-1']);
});

test('recordResult() is reachable only when governance.decision is ACT or SIMULATE', () => {
  for (const decision of ['WAIT', 'ASK'] as const) {
    const orchestrator = new MetaIntelligenceOrchestrator();
    taskAtActionGovernance(orchestrator, decision);
    assert.throws(
      () => orchestrator.recordResult('task-1', { status: 'succeeded' }),
      MetaIntelligenceResultNotRepresentableError
    );
    // Rejected: task left unchanged, still at 'action-governance'.
    assert.equal(orchestrator.getTask('task-1').stage, 'action-governance');
    assert.equal(orchestrator.getTask('task-1').result, undefined);
  }

  for (const decision of ['ACT', 'SIMULATE'] as const) {
    const orchestrator = new MetaIntelligenceOrchestrator();
    taskAtActionGovernance(orchestrator, decision);
    const updated = orchestrator.recordResult('task-1', { status: 'succeeded' });
    assert.equal(updated.stage, 'result-verification');
  }
});

test('recordResult() rejects an invalid status value', () => {
  const orchestrator = new MetaIntelligenceOrchestrator();
  taskAtActionGovernance(orchestrator, 'ACT');
  assert.throws(
    () => orchestrator.recordResult('task-1', { status: 'done' as unknown as 'succeeded' }),
    InvalidResultStatusError
  );
  assert.equal(orchestrator.getTask('task-1').stage, 'action-governance');
});

test('recordResult() rejects a task not at "action-governance"', () => {
  const orchestrator = new MetaIntelligenceOrchestrator();
  taskAtStrategyEvaluationSelected(orchestrator); // stage: 'strategy-evaluation', not 'action-governance'
  assert.throws(
    () => orchestrator.recordResult('task-1', { status: 'succeeded' }),
    MetaIntelligenceTaskNotAtActionGovernanceStageError
  );

  const orchestrator2 = new MetaIntelligenceOrchestrator();
  taskAtActionGovernance(orchestrator2, 'ACT');
  orchestrator2.recordResult('task-1', { status: 'succeeded' }); // now at 'result-verification'
  assert.throws(
    () => orchestrator2.recordResult('task-1', { status: 'succeeded' }),
    MetaIntelligenceTaskNotAtActionGovernanceStageError
  );
});

test('recordResult() treats a blank/whitespace-only detail as no detail (null)', () => {
  const orchestrator = new MetaIntelligenceOrchestrator();
  taskAtActionGovernance(orchestrator, 'ACT');
  const updated = orchestrator.recordResult('task-1', { status: 'succeeded', detail: '   ' });
  assert.equal(updated.result!.detail, null);
});

test('recordResult() leaves AWU-01..08 state unchanged and readable', () => {
  const orchestrator = new MetaIntelligenceOrchestrator();
  const before = taskAtActionGovernance(orchestrator, 'ACT');

  const after = orchestrator.recordResult('task-1', { status: 'succeeded' });
  for (const key of [
    'id',
    'problem',
    'understanding',
    'goalsConstraints',
    'epistemicTracking',
    'capabilityDecomposition',
    'candidateStrategies',
    'strategyEvaluation',
    'governance',
  ] as const) {
    // Compared directly (not via a JSON round-trip snapshot): `before` is
    // never mutated by recordResult() (each stage method returns a fresh
    // task object), and a JSON round-trip would silently drop DFP's
    // `undefined`-valued fields (e.g. `challengerOptionId`), producing a
    // false mismatch against the live object's own `undefined` keys.
    assert.deepEqual(after[key], before[key], `${key} must be unchanged`);
  }
});

test('recordResult() adds no real execution, composition, or adaptation', () => {
  const orchestrator = new MetaIntelligenceOrchestrator();
  taskAtActionGovernance(orchestrator, 'SIMULATE');
  const updated = orchestrator.recordResult('task-1', { status: 'not-yet-executed' });

  assert.deepEqual(Object.keys(updated.result!).sort(), ['detail', 'recordedAt', 'simulated', 'status']);
  assert.deepEqual(Object.keys(updated.verification!).sort(), ['constraintIds', 'goalIds', 'knownIds', 'outcome', 'verifiedAt']);
  for (const name of ['execute', 'compose', 'adapt', 'replan']) {
    assert.equal((orchestrator as unknown as Record<string, unknown>)[name], undefined, `${name} must not exist yet`);
  }
});

// ---------------------------------------------------------------------------
// AWU-10: recordAdaptation() — retry/re-plan/escalate/accept decision.
// ---------------------------------------------------------------------------

/**
 * Task at 'result-verification' with the given verification outcome, via
 * `taskAtActionGovernance()` (one goal, one constraint-free, one known)
 * governed ACT/SIMULATE and then `recordResult()`'d to the status that
 * mechanically yields `outcome` (see `verifyResult()`). `'insufficient-basis'`
 * needs a task with no goals/constraints (mirrors the AWU-09 test that
 * builds that case by hand), so it is assembled directly instead of going
 * through `taskAtActionGovernance()`.
 */
function taskAtResultVerification(
  orchestrator: MetaIntelligenceOrchestrator,
  outcome: 'verified-against-basis' | 'goals-not-met' | 'insufficient-basis' | 'not-verifiable',
  id = 'task-1'
): MetaIntelligenceTask {
  if (outcome === 'insufficient-basis') {
    orchestrator.intake({ statement: 'Reduce checkout drop-off.', id });
    orchestrator.understand(id);
    orchestrator.addGoalsConstraints(id, { goals: [], constraints: [] }); // no basis
    orchestrator.addEpistemicTracking(id, { knowns: [], unknowns: [], assumptions: [], evidence: [] });
    const graph = graphFor({ [AD]: ['magenais.a'] });
    orchestrator.decomposeCapabilities(id, graph, { requirements: [{ capability: AD, origin: 'caller' }] });
    orchestrator.generateCandidateStrategies(id);
    evaluate(orchestrator, id, { criteria: [{ id: 'impact', weight: 1, direction: 'maximize' }], scores: { 'strategy-1': { impact: 5 } } });
    orchestrator.governAction(id, { decision: 'ACT' });
    return orchestrator.recordResult(id, { status: 'succeeded' });
  }
  const governanceDecision = outcome === 'not-verifiable' ? 'SIMULATE' : 'ACT';
  taskAtActionGovernance(orchestrator, governanceDecision, id);
  const status = outcome === 'not-verifiable' ? 'not-yet-executed' : outcome === 'goals-not-met' ? 'failed' : 'succeeded';
  return orchestrator.recordResult(id, { status });
}

test('recordAdaptation() records a decision for "goals-not-met" and advances to "adaptation"', () => {
  const orchestrator = new MetaIntelligenceOrchestrator();
  const before = taskAtResultVerification(orchestrator, 'goals-not-met');
  assert.equal(before.verification!.outcome, 'goals-not-met');

  const updated = orchestrator.recordAdaptation('task-1', { decision: 'retry' });

  assert.equal(updated.stage, 'adaptation');
  assert.equal(updated.adaptation!.decision, 'retry');
  assert.equal(updated.adaptation!.outcome, 'goals-not-met');
  assert.equal(updated.adaptation!.reason, null);
  assert.ok(!Number.isNaN(Date.parse(updated.adaptation!.adaptedAt)));
  // Earlier-stage state, including result/verification, is untouched.
  assert.deepEqual(updated.result, before.result);
  assert.deepEqual(updated.verification, before.verification);
});

test('recordAdaptation() records a decision for "insufficient-basis" and advances to "adaptation"', () => {
  const orchestrator = new MetaIntelligenceOrchestrator();
  const before = taskAtResultVerification(orchestrator, 'insufficient-basis');
  assert.equal(before.verification!.outcome, 'insufficient-basis');

  const updated = orchestrator.recordAdaptation('task-1', { decision: 'escalate', reason: 'no basis was recorded' });

  assert.equal(updated.stage, 'adaptation');
  assert.equal(updated.adaptation!.decision, 'escalate');
  assert.equal(updated.adaptation!.outcome, 'insufficient-basis');
  assert.equal(updated.adaptation!.reason, 'no basis was recorded');
});

test('recordAdaptation() accepts all four decision values (retry/re-plan/escalate/accept)', () => {
  for (const decision of ['retry', 're-plan', 'escalate', 'accept'] as const) {
    const orchestrator = new MetaIntelligenceOrchestrator();
    taskAtResultVerification(orchestrator, 'goals-not-met');
    const updated = orchestrator.recordAdaptation('task-1', { decision });
    assert.equal(updated.adaptation!.decision, decision);
  }
});

test('recordAdaptation() rejects "verified-against-basis" (a supported success needs no adaptation)', () => {
  const orchestrator = new MetaIntelligenceOrchestrator();
  const before = taskAtResultVerification(orchestrator, 'verified-against-basis');
  assert.equal(before.verification!.outcome, 'verified-against-basis');

  assert.throws(
    () => orchestrator.recordAdaptation('task-1', { decision: 'accept' }),
    MetaIntelligenceAdaptationNotRepresentableError
  );
  // Rejected: task left unchanged, still at 'result-verification'.
  assert.equal(orchestrator.getTask('task-1').stage, 'result-verification');
  assert.equal(orchestrator.getTask('task-1').adaptation, undefined);
});

test('recordAdaptation() rejects "not-verifiable" (nothing has happened yet, so nothing to adapt to)', () => {
  const orchestrator = new MetaIntelligenceOrchestrator();
  const before = taskAtResultVerification(orchestrator, 'not-verifiable');
  assert.equal(before.verification!.outcome, 'not-verifiable');

  assert.throws(
    () => orchestrator.recordAdaptation('task-1', { decision: 'retry' }),
    MetaIntelligenceAdaptationNotRepresentableError
  );
  assert.equal(orchestrator.getTask('task-1').stage, 'result-verification');
  assert.equal(orchestrator.getTask('task-1').adaptation, undefined);
});

test('recordAdaptation() rejects an invalid decision value', () => {
  const orchestrator = new MetaIntelligenceOrchestrator();
  taskAtResultVerification(orchestrator, 'goals-not-met');
  assert.throws(
    () => orchestrator.recordAdaptation('task-1', { decision: 'ignore' as unknown as 'retry' }),
    InvalidAdaptationDecisionError
  );
  assert.equal(orchestrator.getTask('task-1').stage, 'result-verification');
});

test('recordAdaptation() rejects a task not at "result-verification"', () => {
  const orchestrator = new MetaIntelligenceOrchestrator();
  taskAtActionGovernance(orchestrator, 'ACT'); // stage: 'action-governance', not 'result-verification'
  assert.throws(
    () => orchestrator.recordAdaptation('task-1', { decision: 'retry' }),
    MetaIntelligenceTaskNotAtResultVerificationStageError
  );

  const orchestrator2 = new MetaIntelligenceOrchestrator();
  taskAtResultVerification(orchestrator2, 'goals-not-met');
  orchestrator2.recordAdaptation('task-1', { decision: 'retry' }); // now at 'adaptation'
  assert.throws(
    () => orchestrator2.recordAdaptation('task-1', { decision: 'retry' }),
    MetaIntelligenceTaskNotAtResultVerificationStageError
  );
});

test('recordAdaptation() records a verbatim copy of the verification outcome: later state changes cannot alter it', () => {
  const orchestrator = new MetaIntelligenceOrchestrator();
  const before = taskAtResultVerification(orchestrator, 'goals-not-met');
  const updated = orchestrator.recordAdaptation('task-1', { decision: 'retry' });
  assert.equal(updated.adaptation!.outcome, before.verification!.outcome);
  assert.deepEqual(updated.verification, before.verification, 'verification itself remains untouched');
});

test('recordAdaptation() treats a blank/whitespace-only reason as no reason (null)', () => {
  const orchestrator = new MetaIntelligenceOrchestrator();
  taskAtResultVerification(orchestrator, 'goals-not-met');
  const updated = orchestrator.recordAdaptation('task-1', { decision: 'accept', reason: '   ' });
  assert.equal(updated.adaptation!.reason, null);
});

test('recordAdaptation() leaves AWU-01..09 state unchanged and readable', () => {
  const orchestrator = new MetaIntelligenceOrchestrator();
  const before = taskAtResultVerification(orchestrator, 'insufficient-basis');

  const after = orchestrator.recordAdaptation('task-1', { decision: 're-plan' });
  for (const key of [
    'id',
    'problem',
    'understanding',
    'goalsConstraints',
    'epistemicTracking',
    'capabilityDecomposition',
    'candidateStrategies',
    'strategyEvaluation',
    'governance',
    'result',
    'verification',
  ] as const) {
    // Compared directly (not via a JSON round-trip snapshot) for the same
    // reason AWU-09's equivalent test gives: `before` is never mutated by
    // recordAdaptation() (each stage method returns a fresh task object),
    // and a JSON round-trip would silently drop DFP's `undefined`-valued
    // fields, producing a false mismatch against the live object.
    assert.deepEqual(after[key], before[key], `${key} must be unchanged`);
  }
});

test('recordAdaptation() adds no real execution, re-composition, or automatic retry', () => {
  const orchestrator = new MetaIntelligenceOrchestrator();
  taskAtResultVerification(orchestrator, 'goals-not-met');
  const updated = orchestrator.recordAdaptation('task-1', { decision: 'retry' });

  assert.deepEqual(Object.keys(updated.adaptation!).sort(), ['adaptedAt', 'decision', 'outcome', 'reason']);
  // A 'retry'/'re-plan' decision does not actually loop the task back to
  // an earlier stage or touch strategyEvaluation/candidateStrategies.
  assert.equal(updated.stage, 'adaptation');
  for (const name of ['execute', 'compose', 'reexecute', 'retryTask', 'replanTask']) {
    assert.equal((orchestrator as unknown as Record<string, unknown>)[name], undefined, `${name} must not exist`);
  }
});
