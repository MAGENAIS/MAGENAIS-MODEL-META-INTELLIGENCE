// 1. Basic problem -> strategy.
// Run: node --experimental-strip-types examples/01-basic-problem-to-strategy.mjs
import { prepare, show } from './_shared.mjs';

const { mi, id } = prepare({
  table: { 'form-optimization': ['acme.form-model'], 'error-analysis': ['acme.log-model'] },
  requirements: ['form-optimization', 'error-analysis', 'ux-research'], // the last has no provider
});

let task = mi.getTask(id);
show('problem (verbatim) and normalized understanding', {
  statement: task.problem.statement,
  normalized: task.understanding.normalizedStatement,
});
show('capability decomposition', task.capabilityDecomposition);

task = mi.generateStrategies(id);
show('strategies (one per satisfied requirement; the gap yields none)', task.strategies.strategies);
console.log('\nstage after generateStrategies():', task.stage, '(V2 strategy fields are additive, they do not advance the stage)');
