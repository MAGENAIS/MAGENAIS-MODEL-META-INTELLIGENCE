// 8. Cognitive trace and problem representation: derived, read-only views (never stored on the task).
import { prepare, show } from './_shared.mjs';

const { mi, id } = prepare({ table: { 'form-optimization': ['acme.a'] }, requirements: ['form-optimization'] });
mi.generateStrategies(id);
mi.evaluateStrategyOptions(id, { criteria: [{ id: 'evidence', weight: 1, direction: 'maximize' }], scores: { 'strategy-1': { evidence: 5 } } });
mi.authorizeComposition(id, { decision: 'ACT' });

show('cognitive trace: one entry per field reached, in pipeline order, with ids it names', mi.getCognitiveTrace(id).entries);
const rep = mi.getProblemRepresentation(id);
show('problem representation presence flags', {
  understanding: rep.understanding.present,
  goalsConstraints: rep.goalsConstraints.present,
  epistemicTracking: rep.epistemicTracking.present,
});
