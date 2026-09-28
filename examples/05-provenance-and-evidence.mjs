// 5. Provenance / evidence. Every recorded item carries its origin ('caller' or 'extracted') and a
// timestamp; verification records exactly which goal/constraint/known ids formed the basis.
import { prepare, show } from './_shared.mjs';

const { mi, id } = prepare({ table: { 'form-optimization': ['acme.a'] }, requirements: ['form-optimization'] });
mi.generateStrategies(id);
mi.evaluateStrategyOptions(id, { criteria: [{ id: 'evidence', weight: 1, direction: 'maximize' }], scores: { 'strategy-1': { evidence: 5 } } });
mi.authorizeComposition(id, { decision: 'ACT', reason: 'Approved by the product owner.' });
mi.buildExecutionPlan(id);
const task = mi.recordExecutionOutcome(id, { status: 'succeeded', detail: 'Form shortened; completion up in the A/B test.' });

show('evidence items with origin + ids', task.epistemicTracking.evidence);
show('what the "success" claim was checked against (ids, not prose)', task.executionVerification);
console.log('\nNote: verified-against-basis means a goals/constraints/knowns basis exists and is recorded;');
console.log('it does NOT mean the claim was independently confirmed true.');
