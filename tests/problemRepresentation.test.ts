/**
 * V2-A2: focused tests for `MetaIntelligenceOrchestrator.getProblemRepresentation()`
 * and the `MetaIntelligenceProblemRepresentation` type it returns.
 *
 * Scope is exactly V2-A2's objective: a purely-derived, read-only view
 * composing the existing `problem`/`understanding`/`goalsConstraints`/
 * `epistemicTracking` task fields, honest about which of them a task has
 * not reached yet (explicit `{ present: false }`, never a silently-
 * defaulted empty value). Does not test any V1 stage method itself —
 * those remain covered by `metaIntelligenceOrchestrator.test.ts`.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  MetaIntelligenceOrchestrator,
  MetaIntelligenceTaskNotFoundError,
} from '../src/MetaIntelligenceOrchestrator.ts';

test('getProblemRepresentation: at "received", problem is present but understanding/goalsConstraints/epistemicTracking are explicit absence', () => {
  const orchestrator = new MetaIntelligenceOrchestrator();
  orchestrator.intake({ statement: 'Reduce checkout drop-off.', id: 'task-1' });

  const rep = orchestrator.getProblemRepresentation('task-1');

  assert.equal(rep.taskId, 'task-1');
  assert.equal(rep.stage, 'received');
  assert.equal(rep.problem.statement, 'Reduce checkout drop-off.');
  assert.deepEqual(rep.understanding, { present: false });
  assert.deepEqual(rep.goalsConstraints, { present: false });
  assert.deepEqual(rep.epistemicTracking, { present: false });
  assert.equal(typeof rep.derivedAt, 'string');
  assert.ok(!Number.isNaN(Date.parse(rep.derivedAt)));
});

test('getProblemRepresentation: reflects "understood" once understand() has run, other sections still absent', () => {
  const orchestrator = new MetaIntelligenceOrchestrator();
  orchestrator.intake({ statement: 'Reduce  checkout   drop-off.', id: 'task-1' });
  orchestrator.understand('task-1');

  const rep = orchestrator.getProblemRepresentation('task-1');

  assert.equal(rep.stage, 'understood');
  assert.equal(rep.understanding.present, true);
  if (rep.understanding.present) {
    assert.equal(rep.understanding.value.normalizedStatement, 'Reduce checkout drop-off.');
  }
  assert.deepEqual(rep.goalsConstraints, { present: false });
  assert.deepEqual(rep.epistemicTracking, { present: false });
});

test('getProblemRepresentation: an empty-but-recorded goalsConstraints is present (not confused with absence)', () => {
  const orchestrator = new MetaIntelligenceOrchestrator();
  orchestrator.intake({ statement: 'Reduce checkout drop-off.', id: 'task-1' });
  orchestrator.understand('task-1');
  orchestrator.addGoalsConstraints('task-1', { goals: [], constraints: [] });

  const rep = orchestrator.getProblemRepresentation('task-1');

  assert.equal(rep.stage, 'goals-constraints');
  assert.equal(rep.goalsConstraints.present, true);
  if (rep.goalsConstraints.present) {
    assert.deepEqual(rep.goalsConstraints.value.goals, []);
    assert.deepEqual(rep.goalsConstraints.value.constraints, []);
  }
  // Still not reached: epistemic-tracking.
  assert.deepEqual(rep.epistemicTracking, { present: false });
});

test('getProblemRepresentation: all four sections present once epistemic-tracking is reached', () => {
  const orchestrator = new MetaIntelligenceOrchestrator();
  orchestrator.intake({ statement: 'Reduce checkout drop-off.', id: 'task-1' });
  orchestrator.understand('task-1');
  orchestrator.addGoalsConstraints('task-1', {
    goals: [{ text: 'Increase conversion', origin: 'caller' }],
    constraints: [],
  });
  orchestrator.addEpistemicTracking('task-1', {
    knowns: [{ text: 'Drop-off spikes at payment step', origin: 'caller' }],
    unknowns: [],
    assumptions: [],
    evidence: [],
  });

  const rep = orchestrator.getProblemRepresentation('task-1');

  assert.equal(rep.stage, 'epistemic-tracking');
  assert.equal(rep.understanding.present, true);
  assert.equal(rep.goalsConstraints.present, true);
  assert.equal(rep.epistemicTracking.present, true);
  if (rep.epistemicTracking.present) {
    assert.equal(rep.epistemicTracking.value.knowns.length, 1);
  }
});

test('getProblemRepresentation: throws MetaIntelligenceTaskNotFoundError for an unknown id, same as getTask()', () => {
  const orchestrator = new MetaIntelligenceOrchestrator();
  assert.throws(() => orchestrator.getProblemRepresentation('missing'), MetaIntelligenceTaskNotFoundError);
});

test('getProblemRepresentation: is read-only — calling it does not change the task or its stage', () => {
  const orchestrator = new MetaIntelligenceOrchestrator();
  orchestrator.intake({ statement: 'Reduce checkout drop-off.', id: 'task-1' });

  orchestrator.getProblemRepresentation('task-1');
  orchestrator.getProblemRepresentation('task-1');
  const task = orchestrator.getTask('task-1');

  assert.equal(task.stage, 'received');
  assert.equal(orchestrator.size, 1);
});
