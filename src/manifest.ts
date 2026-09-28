/**
 * manifest.ts
 *
 * The standalone package's model manifest, as a typed constant. `model.json`
 * at the repository root is generated from this constant
 * (`npm run manifest:sync`) and `tests/manifest.test.ts` fails if the two
 * ever differ, so there is exactly one source of truth.
 *
 * WHY THIS IS NOT AN ORDINARY ROUTED MODEL. `MetaIntelligenceOrchestrator` is
 * a stateful, multi-call bookkeeping API over a `MetaIntelligenceTask`
 * (`intake()`, `understand()`, `addGoalsConstraints()`, ...), not a single
 * `execute(request) -> response` prediction. Forcing it through that shape
 * would mean pretending one method is "the" execution, or hiding a whole
 * pipeline behind one opaque call — both misrepresent what it does. So the
 * manifest is honest descriptive metadata: `composability`, `executionMode`
 * and `limitations` say what it is, and `runtimes` names the only way it
 * can be used (`embedded-library`, i.e. imported in-process), NOT a MAGENAIS
 * runtime that could dispatch it.
 *
 * WHERE THIS DIFFERS FROM THE MAGENAIS-INTEGRATED MANIFEST
 * (`MAGENAIS-main/src/ModelsHub/meta-intelligence/MetaIntelligenceManifest.ts`)
 * — deliberately, and documented in docs/integration.md:
 *  - `runtimes: ['embedded-library']` instead of `[]`. The MAGENAIS
 *    `model-manifest.schema.json` requires `runtimes` to be non-empty, so an
 *    empty array is only valid in the TypeScript type, not against the
 *    published schema. The standalone manifest must validate against the
 *    schema, and no built-in MAGENAIS runtime is named `embedded-library`,
 *    so nothing can route to it by accident.
 * Version, uri, description, outputs, limitations, provenance and the full
 * `repository` URL were synced into the integrated manifest as well (Models
 * Hub documentation sync), so `runtimes` is the only deliberate difference.
 * Everything else (id, capabilities, type, trust, failure modes, evidence
 * level) is identical to the integrated manifest.
 */

import type { ModelManifest } from './contract.ts';
import { META_INTELLIGENCE_MODEL_ID, META_INTELLIGENCE_URI, META_INTELLIGENCE_VERSION } from './version.ts';

/** Id of the bundled pipeline benchmark (mirrors `META_INTELLIGENCE_PIPELINE_BENCHMARK_ID`; a test keeps them equal). */
const PIPELINE_BENCHMARK_ID = 'magenais.meta-intelligence.pipeline-v1';

export const META_INTELLIGENCE_MANIFEST: ModelManifest = {
  id: META_INTELLIGENCE_MODEL_ID,
  name: 'Meta-Intelligence',
  version: META_INTELLIGENCE_VERSION,
  description:
    'A thin, stateful orchestrator that advances a caller\'s task through a ten-stage Definition-of-Done pipeline ' +
    '(Problem -> Understand -> Goals/Constraints -> Known/Unknown/Assumptions/Evidence -> Capability Decomposition -> ' +
    'Candidate Strategies -> Evaluation/Selection -> Action Governance -> Result/Verification -> Adaptation) plus the V2 ' +
    'cognitive-strategy and closed-loop layer: real strategies and alternatives built from the capability decomposition, ' +
    'DecisionScore-backed evaluation of those options with stability (DSI) and flip points (DFP), an explicit ' +
    'ACT/WAIT/ASK/SIMULATE composition boundary, a derived execution plan, recorded and mechanically verified execution ' +
    'outcomes, a recorded adaptation decision, a derived problem representation and a derived cognitive trace. ' +
    'Provenance (caller vs extracted origin, timestamps, referenced ids) is preserved at every step. It never executes, ' +
    'composes, re-executes or automatically retries anything: every step records a decision, a plan or a claim, it does ' +
    'not carry one out.',
  author: { name: 'MAGENAIS', organization: 'MAGENAIS' },
  type: 'algorithm',
  capabilities: ['meta-orchestration'],
  // See this file's header: not `Model`-shaped, so it is used in-process as a
  // library; no registered MAGENAIS runtime can dispatch it.
  runtimes: ['embedded-library'],
  license: { type: 'Apache-2.0', url: 'https://www.apache.org/licenses/LICENSE-2.0' },
  pricing: { type: 'free' },
  trust: 'experimental',
  uri: META_INTELLIGENCE_URI,
  repository: 'https://github.com/MAGENAIS/MAGENAIS-MODEL-META-INTELLIGENCE',
  documentation: 'https://github.com/MAGENAIS/MAGENAIS-MODEL-META-INTELLIGENCE#readme',
  demo: 'https://magenais.github.io/MAGENAIS-MODEL-META-INTELLIGENCE/',

  // ---- V5 §8 cognitive contract -----------------------------------
  layer: 'composite-model',
  family: 'metacognition',
  purpose:
    'Advance a caller\'s task through a structured plan/act/verify/adapt pipeline, recording every stage\'s ' +
    'decision with provenance rather than silently collapsing them into a single opaque answer.',
  problem:
    'Turning a stated problem into action usually collapses understanding, planning, execution, and judging the ' +
    'result into one opaque step — so it is impossible to tell afterward which parts were the caller\'s own claims, ' +
    'which were derived, which capabilities were actually available, which alternatives existed, and whether a ' +
    'claimed success was ever checked against anything.',
  nonGoals: [
    'Does not execute, compose, re-execute, or automatically retry anything — an ACT composition boundary and the ' +
      'execution plan derived from it are representations, and even a `retry`/`re-plan` adaptation decision is ' +
      'representation only.',
    'Does not choose ACT/WAIT/ASK/SIMULATE governance or composition decisions, or retry/re-plan/escalate/accept ' +
      'adaptation decisions, on its own — all are caller-supplied decisions that this component only records and ' +
      'mechanically constrains.',
    'Does not invent goals, constraints, knowns, unknowns, assumptions, evidence, or required capabilities from the ' +
      'problem text — every such item is caller- or extraction-supplied and tagged with its origin, never derived ' +
      'by semantic interpretation here.',
    'Does not invent strategies: every strategy and alternative is derived only from the capability decomposition ' +
      '(per satisfied requirement, per additional provider, and one composed strategy).',
    'Does not produce a calibrated probability or confidence value: uncertainty is represented structurally ' +
      '(DecisionScore stability index and flip points, origin-tagged epistemic tracking, verification outcomes, ' +
      'and explicit "none selected" outcomes with a reason), not as a probability.',
    'Does not maintain its own parallel capability or provider model — capability decomposition queries the ' +
      'capability graph (`providersOf`) the caller passes in.',
    'Does not independently confirm a caller\'s claimed success is actually true — result/outcome recording checks ' +
      'that a goals/constraints-and-knowns basis exists and is recorded, not that the claim is externally verified.',
  ],
  inputs: [
    {
      type: 'meta-intelligence-request',
      description:
        'Per call: a problem statement (intake), then caller-supplied goals/constraints, epistemic items, ' +
        'capability requirements, a capability graph (`providersOf`), DecisionScore-shaped evaluation ' +
        'criteria/scores (and optionally a scorer), and governance/composition/result/adaptation decisions — ' +
        'never inferred by this component.',
      required: true,
    },
  ],
  outputs: [
    {
      type: 'meta-intelligence-task',
      description:
        'A MetaIntelligenceTask carrying every stage and V2 field recorded so far (problem, understanding, ' +
        'goals/constraints, epistemic tracking, capability decomposition, candidate strategies, strategies, ' +
        'strategy alternatives, strategy evaluation / options evaluation, governance, composition boundary, ' +
        'execution plan, result/execution result, verification/execution verification, adaptation/execution ' +
        'adaptation), each tagged with origin/timestamps for provenance.',
    },
    {
      type: 'meta-intelligence-problem-representation',
      description: 'A derived, read-only view of the problem, understanding, goals/constraints and epistemic tracking with explicit presence flags.',
      required: false,
    },
    {
      type: 'meta-intelligence-cognitive-trace',
      description: 'A derived, read-only, ordered record of the fields a task has reached, with their timestamps and the ids they name.',
      required: false,
    },
  ],
  executionMode: 'synchronous',
  resourceRequirements: {
    compute:
      'O(1) bookkeeping per stage call, plus the embedded DecisionScore scoring cost ' +
      '(O(options x criteria x perturbations)) during evaluateStrategies()/evaluateStrategyOptions() only.',
    network: false,
    externalApi: false,
    latencyExpectation: 'sub-millisecond per stage call, excluding embedded DecisionScore scoring cost.',
  },
  scientificStatus: 'experimental',
  // The bundled benchmark (51 cases) measures pipeline correctness, V2
  // mechanics and strategy-generation/selection quality. A stateful,
  // non-predictive orchestrator has no meaningful naive-baseline pairing, so
  // this is 'benchmarked' (evidence exists) rather than 'baseline-compared'.
  // Do not bump this without a real baseline methodology to justify it.
  evidenceLevel: 'benchmarked',
  benchmarkIds: [PIPELINE_BENCHMARK_ID],
  limitations: [
    'Not `Model`-shaped: cannot be dispatched through MAGENAIS ModelRegistry/ModelRouter/LocalRuntime (see ' +
      '`runtimes` and docs/integration.md); it is used in-process as a library.',
    'Nothing is executed: the composition boundary, execution plan and adaptation decision are representations. ' +
      'A caller (or a future executor) performs any real action and reports the outcome back.',
    'evaluateStrategies()/evaluateStrategyOptions() default to the bundled DecisionScore weighted-sum scorer; a ' +
      'caller-supplied scorer can replace it, but the default carries DecisionScore\'s own limitations ' +
      '(weighted-sum, compensatory criteria, caller-supplied criteria and scores).',
    'Strategy generation is deliberately minimal: per-requirement strategies, per-additional-provider alternatives ' +
      'and one composed strategy. Provider availability is exactly what the caller\'s capability graph reports.',
    'Governance, composition and adaptation decisions are caller-supplied, not chosen by this component — a caller ' +
      'that always requests ACT/accept gets no independent check on whether that judgement was sound.',
    'Result verification checks that a goals/constraints-and-knowns basis exists and is recorded, not that a ' +
      'claimed success is independently, externally confirmed true.',
    'The bundled benchmark measures pipeline mechanics and strategy generation/selection quality on synthetic ' +
      'fixtures; it does not measure real-world task outcomes and has no baseline pairing.',
  ],
  failureModes: [
    {
      id: 'act-without-selection',
      description: 'Caller requests ACT governance for a task with no selected candidate.',
      behavior: 'Rejected via MetaIntelligenceActionNotSelectableError before any governance is recorded.',
      category: 'unsupported-condition',
    },
    {
      id: 'adaptation-not-representable',
      description:
        'Caller calls recordAdaptation() when verification.outcome is verified-against-basis or not-verifiable.',
      behavior: 'Rejected via MetaIntelligenceAdaptationNotRepresentableError; no adaptation is recorded.',
      category: 'unsupported-condition',
    },
    {
      id: 'out-of-order-stage-call',
      description: 'A stage method is called on a task not currently at that stage\'s required prior stage.',
      behavior: 'Rejected via that stage\'s own NotAtXStageError; the task is left unchanged.',
      category: 'malformed-input',
    },
    {
      id: 'empty-text-input',
      description: 'A problem statement, goal/constraint, epistemic item, or capability requirement is empty/whitespace-only.',
      behavior:
        'Rejected before any state change (EmptyProblemStatementError / EmptyGoalOrConstraintTextError / ' +
        'EmptyEpistemicItemTextError / EmptyCapabilityRequirementError).',
      category: 'malformed-input',
    },
    {
      id: 'result-not-representable',
      description: 'Caller calls recordResult() on a task whose governance decision is WAIT or ASK.',
      behavior: 'Rejected via MetaIntelligenceResultNotRepresentableError; the task is left unchanged.',
      category: 'unsupported-condition',
    },
    {
      id: 'invalid-enum-value',
      description:
        'A governance decision, result status or adaptation decision outside its allowed values is passed to ' +
        'governAction(), recordResult()/recordExecutionOutcome(), or recordAdaptation()/recordExecutionAdaptation().',
      behavior:
        'Rejected via InvalidGovernanceDecisionError / InvalidResultStatusError / InvalidAdaptationDecisionError respectively.',
      category: 'malformed-input',
    },
    {
      id: 'duplicate-v2-stage-call',
      description:
        'authorizeComposition(), recordExecutionOutcome() or recordExecutionAdaptation() is called a second time for the same task.',
      behavior:
        'Rejected via MetaIntelligenceCompositionAlreadyBoundError / MetaIntelligenceExecutionResultAlreadyRecordedError / ' +
        'MetaIntelligenceExecutionAdaptationAlreadyRecordedError; the existing record is never recomputed.',
      category: 'malformed-input',
    },
    {
      id: 'execution-plan-not-authorized',
      description: 'Caller calls buildExecutionPlan() when the task\'s composition boundary decision is not ACT.',
      behavior: 'Rejected via MetaIntelligenceExecutionPlanNotAuthorizedError; no execution plan is built.',
      category: 'unsupported-condition',
    },
    {
      id: 'execution-adaptation-not-representable',
      description:
        'Caller calls recordExecutionAdaptation() when executionVerification.outcome is verified-against-basis or not-verifiable.',
      behavior: 'Rejected via MetaIntelligenceExecutionAdaptationNotRepresentableError; the task is left unchanged.',
      category: 'unsupported-condition',
    },
  ],
  verificationStatus: 'not-ready',
  composability: {
    // Stages 1-6 need only a caller-supplied capability graph; the default
    // scorer embeds DecisionScore's algorithm (src/scoring), so Meta-Intelligence
    // produces a meaningful result with no other model present.
    independentlyExecutable: true,
    composesWith: ['magenais.decision-score'],
  },
  provenance: {
    origin: 'MAGENAIS V5-5 (V1, AWU-01..12) and V5-6 (V2, phases A-D)',
    basedOn: [
      'V5 MASTER PROMPT §14 Definition-of-Done pipeline',
      'DecisionScore weighted multi-criteria evaluation (bundled default scorer)',
    ],
    benchmarkedAtCodeVersion: META_INTELLIGENCE_VERSION,
  },
  implementationStatus: 'implemented',
  dependencies: {
    // A capability-level dependency, satisfied in-package by the bundled
    // scorer (src/scoring); no live model lookup is performed.
    requiresCapabilities: ['decision-ranking'],
  },
};
