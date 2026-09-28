// 4. Uncertainty. Meta-Intelligence does NOT output a calibrated probability.
// Uncertainty is represented structurally: DecisionScore stability (DSI) and flip points (DFP),
// origin-tagged knowns/unknowns/assumptions, and explicit "none selected" outcomes with a reason.
import { prepare, show } from './_shared.mjs';

function evaluate(scores, extra = {}) {
  const { mi, id } = prepare({ table: { 'form-optimization': ['acme.a', 'acme.b'] }, requirements: ['form-optimization'] });
  mi.generateStrategies(id);
  mi.generateStrategyAlternatives(id); // strategy-1 (both providers), strategy-2 (b only)
  return mi.evaluateStrategyOptions(id, { criteria: [{ id: 'impact', weight: 0.51, direction: 'maximize' }, { id: 'cost', weight: 0.49, direction: 'maximize' }], scores, ...extra }).strategyOptionsEvaluation;
}

const narrow = { 'strategy-1': { impact: 10, cost: 0 }, 'strategy-2': { impact: 0, cost: 10 } };
const a = evaluate(narrow);
show('narrow win: selected, but DSI < 1 and DFP names how little would flip it', { selection: a.selection, dsi: a.dsi, dfp: a.dfp });

const b = evaluate(narrow, { minStability: 1 });
show('same scores, caller demands perfect stability -> abstains', { selection: b.selection, dsi: b.dsi });

const tie = { 'strategy-1': { impact: 5, cost: 5 }, 'strategy-2': { impact: 5, cost: 5 } };
show('exact tie -> abstains rather than breaking the tie by order', evaluate(tie).selection);

const { mi, id } = prepare({ table: {}, requirements: ['form-optimization'] });
show('epistemic state the caller recorded (unknowns/assumptions are first-class)', {
  unknowns: mi.getTask(id).epistemicTracking.unknowns,
  assumptions: mi.getTask(id).epistemicTracking.assumptions,
});
