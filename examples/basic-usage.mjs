// Runnable example: intake -> understand -> addGoalsConstraints ->
// addEpistemicTracking -> decomposeCapabilities -> generateCandidateStrategies ->
// evaluateStrategies -> governAction -> recordResult -> recordAdaptation.
// Run with: npm run example
// (node --experimental-strip-types examples/basic-usage.mjs)

import { MetaIntelligenceOrchestrator } from '../src/index.ts';

const orchestrator = new MetaIntelligenceOrchestrator();

const task = orchestrator.intake({
  statement: 'Reduce   checkout\n\tdrop-off on mobile.',
});
console.log('stage after intake:', task.stage);
console.log('verbatim statement:', JSON.stringify(task.problem.statement));

const understood = orchestrator.understand(task.id);
console.log('stage after understand:', understood.stage);
console.log('normalized statement:', JSON.stringify(understood.understanding.normalizedStatement));
console.log('verbatim statement unchanged:', JSON.stringify(understood.problem.statement));

const withGoals = orchestrator.addGoalsConstraints(task.id, {
  goals: [
    { text: 'Increase mobile checkout completion rate', origin: 'caller' },
    { text: 'Reduce steps in the mobile checkout funnel', origin: 'extracted' },
  ],
  constraints: [{ text: 'No changes to the payment provider', origin: 'caller' }],
});
console.log('stage after addGoalsConstraints:', withGoals.stage);
console.log(
  'goals:',
  withGoals.goalsConstraints.goals.map((g) => `[${g.origin}] ${g.text}`)
);
console.log(
  'constraints:',
  withGoals.goalsConstraints.constraints.map((c) => `[${c.origin}] ${c.text}`)
);

const withEpistemics = orchestrator.addEpistemicTracking(task.id, {
  knowns: [{ text: 'Checkout has 5 steps today', origin: 'caller' }],
  unknowns: [{ text: 'Which step causes the most drop-off', origin: 'extracted' }],
  assumptions: [{ text: 'Mobile users behave like desktop users', origin: 'extracted' }],
  evidence: [{ text: 'Analytics show 40% drop-off at step 3', origin: 'caller' }],
});
console.log('stage after addEpistemicTracking:', withEpistemics.stage);
console.log(
  'knowns:',
  withEpistemics.epistemicTracking.knowns.map((k) => `[${k.origin}] ${k.text}`)
);
console.log(
  'unknowns:',
  withEpistemics.epistemicTracking.unknowns.map((u) => `[${u.origin}] ${u.text}`)
);
console.log(
  'assumptions:',
  withEpistemics.epistemicTracking.assumptions.map((a) => `[${a.origin}] ${a.text}`)
);
console.log(
  'evidence:',
  withEpistemics.epistemicTracking.evidence.map((e) => `[${e.origin}] ${e.text}`)
);

// A minimal CapabilityGraph-shaped object — a real MAGENAIS-main
// CapabilityGraph (built from the live ModelRegistry) already satisfies
// this same providersOf() shape; see src/contract.ts's CapabilityGraphLike.
const capabilityGraph = {
  providersOf(capability) {
    return { 'funnel-analysis': ['magenais.funnel-model'] }[capability] ?? [];
  },
};

const withCapabilities = orchestrator.decomposeCapabilities(task.id, capabilityGraph, {
  requirements: [
    { capability: 'funnel-analysis', origin: 'extracted' },
    { capability: 'mobile-ux-benchmarking', origin: 'extracted' },
  ],
});
console.log('stage after decomposeCapabilities:', withCapabilities.stage);
console.log(
  'requirements:',
  withCapabilities.capabilityDecomposition.requirements.map(
    (r) => `[${r.origin}] ${r.capability} -> ${r.satisfied ? r.providers.join(', ') : 'GAP'}`
  )
);
console.log('gaps:', withCapabilities.capabilityDecomposition.gaps);

// Candidate strategies are built only from the decomposition above: one
// candidate per satisfied requirement (the gap yields none). Nothing is
// scored, ranked, or selected -- that is a later stage.
const withStrategies = orchestrator.generateCandidateStrategies(task.id);
console.log('stage after generateCandidateStrategies:', withStrategies.stage);
console.log(
  'candidates:',
  withStrategies.candidateStrategies.candidates.map(
    (c) => `${c.id}: ${c.capability} (requirement ${c.requirementId}) via ${c.providers.join(', ')}`
  )
);

// Evaluation/selection: the candidates are scored by a DecisionScore-shaped
// scorer. This package has no dependencies, so a scorer is passed in. In
// MAGENAIS-main the default is the real DecisionScore
// (`scoreWithDecisionScore`); this one is a toy single-criterion stand-in
// with the same input/output shape. Criteria and scores are caller-supplied.
function scorer(input) {
  const ranking = input.options
    .map((o) => ({ optionId: o.id, score: input.scores[o.id][input.criteria[0].id] / 10 }))
    .sort((a, b) => b.score - a.score)
    .map((entry, index) => ({ ...entry, rank: index + 1 }));
  return { ranking, topOptionId: ranking[0].optionId, dsi: 1, dfp: [] };
}
const evaluated = orchestrator.evaluateStrategies(
  task.id,
  {
    criteria: [{ id: 'impact', weight: 1, direction: 'maximize' }],
    scores: { 'strategy-1': { impact: 8 } },
  },
  scorer
);
console.log('stage after evaluateStrategies:', evaluated.stage);
console.log('selection:', JSON.stringify(evaluated.strategyEvaluation.selection));

// Action governance: an explicit ACT/WAIT/ASK/SIMULATE decision, gating any
// future use of the selection above. 'ACT' is refused unless a candidate was
// actually selected (see governAction()'s own doc comment for the rule).
const governed = orchestrator.governAction(task.id, {
  decision: 'ACT',
  reason: 'Selection is clear-cut; proceeding without human confirmation.',
});
console.log('stage after governAction:', governed.stage);
console.log('governance:', JSON.stringify(governed.governance));

// Result + verification: the caller's claimed outcome for the governed
// decision, recorded and mechanically verified against the task's own
// goals/constraints (AWU-03) and knowns (AWU-04). No real execution
// happens here -- recordResult() only represents and checks a claim.
// 'simulated' is derived from governance.decision, not from this request.
const resulted = orchestrator.recordResult(task.id, {
  status: 'succeeded',
  detail: 'Rolled out funnel-analysis change to 100% of mobile traffic.',
});
console.log('stage after recordResult:', resulted.stage);
console.log('result:', JSON.stringify(resulted.result));
console.log('verification:', JSON.stringify(resulted.verification));

// Adaptation: only representable when the verification outcome above means
// the task did NOT succeed as claimed ('goals-not-met' / 'insufficient-basis').
// The task above verified successfully ('verified-against-basis'), so it has
// nothing to adapt -- recordAdaptation() would throw
// MetaIntelligenceAdaptationNotRepresentableError for it. A second, minimal
// task demonstrates the case that DOES adapt: a governed action whose
// claimed result is 'failed'.
const failingTask = orchestrator.intake({ statement: 'Reduce checkout drop-off on desktop.', id: 'task-2' });
orchestrator.understand(failingTask.id);
orchestrator.addGoalsConstraints(failingTask.id, {
  goals: [{ text: 'Increase desktop checkout completion rate', origin: 'caller' }],
  constraints: [],
});
orchestrator.addEpistemicTracking(failingTask.id, {
  knowns: [{ text: 'Desktop checkout has 4 steps today', origin: 'caller' }],
  unknowns: [],
  assumptions: [],
  evidence: [],
});
const failingCapabilities = orchestrator.decomposeCapabilities(failingTask.id, capabilityGraph, {
  requirements: [{ capability: 'funnel-analysis', origin: 'extracted' }],
});
orchestrator.generateCandidateStrategies(failingTask.id);
orchestrator.evaluateStrategies(
  failingTask.id,
  { criteria: [{ id: 'impact', weight: 1, direction: 'maximize' }], scores: { 'strategy-1': { impact: 8 } } },
  scorer
);
orchestrator.governAction(failingTask.id, { decision: 'ACT' });
const failedResult = orchestrator.recordResult(failingTask.id, {
  status: 'failed',
  detail: 'Rollout was reverted after a conversion regression.',
});
console.log('failing task verification:', JSON.stringify(failedResult.verification));

// recordAdaptation() records the caller's chosen response
// (retry/re-plan/escalate/accept) to that not-succeeded-as-claimed
// outcome. It does NOT retry, re-plan, or re-execute anything itself --
// it only represents the decision, traceable back to the outcome above.
const adapted = orchestrator.recordAdaptation(failingTask.id, {
  decision: 're-plan',
  reason: 'Desktop funnel needs a different strategy than the mobile one.',
});
console.log('stage after recordAdaptation:', adapted.stage);
console.log('adaptation:', JSON.stringify(adapted.adaptation));
