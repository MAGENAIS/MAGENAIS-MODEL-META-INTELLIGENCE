// 6. Execution planning. The composition boundary records a caller-supplied ACT/WAIT/ASK/SIMULATE
// decision; only ACT allows an execution plan. The plan is a representation: nothing is executed.
import { prepare, show } from './_shared.mjs';

function upToEvaluation(id) {
  const p = prepare({ id, table: { 'form-optimization': ['acme.a'], 'error-analysis': ['acme.b'] }, requirements: ['form-optimization', 'error-analysis'] });
  p.mi.generateStrategies(id);
  p.mi.generateStrategyAlternatives(id); // adds one composed strategy across both requirements
  p.mi.evaluateStrategyOptions(id, { criteria: [{ id: 'evidence', weight: 1, direction: 'maximize' }], scores: { 'strategy-1': { evidence: 3 }, 'strategy-2': { evidence: 2 }, 'strategy-3': { evidence: 9 } } });
  return p.mi;
}

const mi = upToEvaluation('t-act');
show('composition boundary (ACT)', mi.authorizeComposition('t-act', { decision: 'ACT' }).compositionBoundary);
show('execution plan derived from it', mi.buildExecutionPlan('t-act').executionPlan);

const waiting = upToEvaluation('t-wait');
waiting.authorizeComposition('t-wait', { decision: 'WAIT', reason: 'Waiting for legal review.' });
try {
  waiting.buildExecutionPlan('t-wait');
} catch (error) {
  console.log(`\nWAIT blocks planning -> ${error.name}`);
}
