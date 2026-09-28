// 2. Multiple strategy alternatives.
// Alternatives come only from diversity already present in the capability decomposition:
// one extra strategy per additional provider, plus one composed strategy across requirements.
import { prepare, show } from './_shared.mjs';

const { mi, id } = prepare({
  table: { 'form-optimization': ['acme.a', 'acme.b'], 'error-analysis': ['acme.b'] },
  requirements: ['form-optimization', 'error-analysis'],
});
mi.generateStrategies(id);
const task = mi.generateStrategyAlternatives(id);

show('base strategies', task.strategies.strategies.map((s) => ({ id: s.id, derivation: s.derivation, components: s.components.map((c) => `${c.capability}[${c.providers}]`) })));
show('alternatives', task.strategyAlternatives.strategies.map((s) => ({ id: s.id, derivation: s.derivation, components: s.components.map((c) => `${c.capability}[${c.providers}]`) })));
