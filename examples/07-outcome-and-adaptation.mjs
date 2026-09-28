// 7. Execution outcome + adaptation. The caller reports what happened; Meta-Intelligence records the
// claim, checks it against the recorded basis, and records an explicit adaptation decision.
// It does not retry or re-plan anything itself, even for 'retry' / 're-plan'.
import { prepare, show } from './_shared.mjs';

const { mi, id } = prepare({ table: { 'form-optimization': ['acme.a'] }, requirements: ['form-optimization'] });
mi.generateStrategies(id);
mi.evaluateStrategyOptions(id, { criteria: [{ id: 'evidence', weight: 1, direction: 'maximize' }], scores: { 'strategy-1': { evidence: 5 } } });
mi.authorizeComposition(id, { decision: 'ACT' });
mi.buildExecutionPlan(id);

let task = mi.recordExecutionOutcome(id, { status: 'failed', detail: 'Completion rate did not improve.' });
show('claimed outcome', task.executionResult);
show('verification outcome', task.executionVerification);

task = mi.recordExecutionAdaptation(id, { decision: 're-plan', reason: 'Try the alternative provider next iteration.' });
show('recorded adaptation decision (representation only)', task.executionAdaptation);
