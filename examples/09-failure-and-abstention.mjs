// 9. Failure and abstention behavior. Invalid or unsupported calls throw typed errors and leave the
// task unchanged; ambiguous evaluations abstain ("none selected") instead of guessing.
import { MetaIntelligenceOrchestrator } from '../src/index.ts';
import { prepare } from './_shared.mjs';

const attempt = (label, fn) => {
  try {
    fn();
    console.log(`${label}: (no error)`);
  } catch (error) {
    console.log(`${label}: ${error.name}`);
  }
};

const empty = new MetaIntelligenceOrchestrator();
attempt('empty problem statement', () => empty.intake({ statement: '   ' }));
empty.intake({ id: 't', statement: 'A problem.' });
attempt('out-of-order stage call', () => empty.addGoalsConstraints('t', { goals: [], constraints: [] }));
attempt('unknown task id', () => empty.getTask('missing'));

const { mi, id } = prepare({ table: {}, requirements: ['form-optimization'] }); // every requirement is a gap
mi.generateStrategies(id);
console.log('strategies for an all-gap task:', mi.getTask(id).strategies.strategies.length);
const task = mi.evaluateStrategyOptions(id, { criteria: [], scores: {} });
console.log('selection with nothing to choose from:', JSON.stringify(task.strategyOptionsEvaluation.selection));
attempt('ACT without a selected strategy', () => mi.authorizeComposition(id, { decision: 'ACT' }));
attempt('plan without an ACT boundary', () => mi.buildExecutionPlan(id));
attempt('invalid enum value', () => mi.authorizeComposition(id, { decision: 'MAYBE' }));
