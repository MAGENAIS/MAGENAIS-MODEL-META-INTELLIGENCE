// Shared helpers for the runnable examples. Not part of the public API.
import { MetaIntelligenceOrchestrator } from '../src/index.ts';

/** A minimal capability graph: any object with providersOf(capability) works. */
export function graphOf(table) {
  return { providersOf: (capability) => [...(table[capability] ?? [])] };
}

/** Print a titled JSON block. */
export function show(title, value) {
  console.log(`\n== ${title}`);
  console.log(JSON.stringify(value, null, 2));
}

/**
 * Take a task through intake -> understand -> goals/constraints -> epistemic
 * tracking, then decompose the given required capabilities against `table`
 * (capability -> provider ids). Returns the orchestrator and the task id.
 */
export function prepare({ table, requirements, id = 'task-1' } = {}) {
  const mi = new MetaIntelligenceOrchestrator();
  mi.intake({ id, statement: 'Reduce   checkout\n\tdrop-off on mobile.' });
  mi.understand(id);
  mi.addGoalsConstraints(id, {
    goals: [{ text: 'Increase mobile checkout completion rate.', origin: 'caller' }],
    constraints: [{ text: 'No change to the payment provider.', origin: 'caller' }],
  });
  mi.addEpistemicTracking(id, {
    knowns: [{ text: 'Checkout has three steps.', origin: 'caller' }],
    unknowns: [{ text: 'Which step loses the most users.', origin: 'caller' }],
    assumptions: [{ text: 'Drop-off is mostly caused by form length.', origin: 'caller' }],
    evidence: [{ text: 'Funnel export, week 38.', origin: 'caller' }],
  });
  mi.decomposeCapabilities(id, graphOf(table), {
    requirements: requirements.map((capability) => ({ capability, origin: 'caller' })),
  });
  return { mi, id };
}
