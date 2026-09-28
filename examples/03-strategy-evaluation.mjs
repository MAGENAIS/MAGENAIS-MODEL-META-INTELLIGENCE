// 3. Strategy evaluation with the bundled DecisionScore scorer.
// A risk or cost dimension is an ordinary criterion with direction 'minimize'.
import { prepare, show } from './_shared.mjs';

const { mi, id } = prepare({
  table: { 'form-optimization': ['acme.a', 'acme.b'], 'error-analysis': ['acme.b'] },
  requirements: ['form-optimization', 'error-analysis'],
});
mi.generateStrategies(id);
mi.generateStrategyAlternatives(id); // strategy-1..4

const task = mi.evaluateStrategyOptions(id, {
  criteria: [
    { id: 'evidence', weight: 0.4, direction: 'maximize' },
    { id: 'risk', weight: 0.6, direction: 'minimize' },
  ],
  scores: {
    'strategy-1': { evidence: 8, risk: 2 },
    'strategy-2': { evidence: 2, risk: 2 },
    'strategy-3': { evidence: 5, risk: 1 },
    'strategy-4': { evidence: 9, risk: 9 }, // most evidence, but far the riskiest
  },
});
const ev = task.strategyOptionsEvaluation;
show('ranking', ev.ranking);
show('selection', ev.selection);
console.log('\nDSI (ranking stability, 0..1):', ev.dsi);
