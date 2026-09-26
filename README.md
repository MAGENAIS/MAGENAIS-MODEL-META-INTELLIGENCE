# Meta-Intelligence

A thin orchestration/composition layer for MAGENAIS's cognitive
pipeline. Part of the
[MAGENAIS Model Hub](https://github.com/MAGENAIS/MAGENAIS-MODELS), but
independent — you can use this package without installing or running
MAGENAIS at all.

> **Early stage.** This repository was created alongside AWU-01 through
> AWU-10 of the Meta-Intelligence build and now implements the full
> nine-stage Definition-of-Done pipeline's *representation* — including
> the AWU-08 ACT/WAIT/ASK/SIMULATE action-governance boundary that gates
> (but does not itself perform) Execution/Composition, the AWU-09
> result-recording + mechanical verification step, and the AWU-10
> retry/re-plan/escalate/accept adaptation decision — but no real
> execution, composition, re-execution, or automatic retry of anything.
> It is not yet a `Model` the MAGENAIS router can call — see
> [Status](#status) before relying on it for anything beyond
> intake/normalization/goals-constraints/epistemic-tracking/capability-decomposition/candidate-strategies/strategy-evaluation/action-governance/result-verification/adaptation.

## The full pipeline (target)

```
Problem -> Understand -> Goals/Constraints -> Known/Unknown/Assumptions/Evidence
        -> Capability Decomposition -> Candidate Strategies -> Evaluation/Selection
        -> Execution/Composition -> Verification -> Result -> Adaptation/Re-plan
```

## Status

| Stage | Implemented? |
|---|---|
| Problem (intake) | ✅ `intake()` — records the caller's statement verbatim |
| Understand | ✅ `understand()` — mechanical whitespace normalization only, no interpretation |
| Goals/Constraints | ✅ `addGoalsConstraints()` — records goals/constraints, each tagged `'caller'` or `'extracted'` |
| Known/Unknown/Assumptions/Evidence | ✅ `addEpistemicTracking()` — records knowns/unknowns/assumptions/evidence, each tagged `'caller'` or `'extracted'` |
| Capability Decomposition | ✅ `decomposeCapabilities()` — checks required capabilities against an existing CapabilityGraph, each tagged `'caller'` or `'extracted'` |
| Candidate Strategies | ✅ `generateCandidateStrategies()` — one candidate per satisfied capability requirement, built from the decomposition; no evaluation, ranking, or selection |
| Evaluation/Selection | ✅ `evaluateStrategies()` — scores the candidates with a DecisionScore-shaped scorer and records an explicit selection (one candidate id, or 'none selected' with a reason); executes nothing |
| Action Governance (ACT/WAIT/ASK/SIMULATE) | ✅ `governAction()` — records an explicit, caller-supplied governance decision against the AWU-07 selection; `'ACT'` is refused unless a candidate was actually selected. Executes nothing |
| Execution/Composition | ❌ not yet |
| Verification | ✅ (partial, via `recordResult()`) — mechanically checks a recorded result against the task's own goals/constraints and knowns; see Result |
| Result | ✅ `recordResult()` — records the caller's claimed outcome (`'succeeded'` \| `'failed'` \| `'not-yet-executed'`) for an ACT/SIMULATE-governed task and its verification outcome together; reachable only from `'ACT'`/`'SIMULATE'` governance. Executes, composes, and adapts nothing |
| Adaptation/Re-plan | ✅ `recordAdaptation()` — records a caller-supplied retry/re-plan/escalate/accept decision for a `'goals-not-met'`/`'insufficient-basis'` verification outcome; `'verified-against-basis'`/`'not-verifiable'` are refused. Executes, re-executes, and automatically retries nothing — not even for `'retry'`/`'re-plan'` |

See `CHANGELOG.md` for which Atomic Work Unit (AWU) added what, and the
MAGENAIS repository's `.mi/CONTEXT_MAP.json` / `META_INTELLIGENCE_BUILD_PROMPT_V4.md`
for the build process this package is produced under.

## What it does today

`MetaIntelligenceOrchestrator` tracks tasks through nine stages:

1. **`intake(request)`** — records a caller's problem statement verbatim
   under a task id, at stage `'received'`. Never rewrites the statement.
2. **`understand(id)`** — collapses incidental whitespace differences in
   an already-`'received'` task's statement into a `normalizedStatement`,
   and advances the task to `'understood'`. This is a mechanical
   transformation only (whitespace collapsing) — **not** semantic
   interpretation, goal extraction, or constraint extraction. The
   original `problem.statement` is never modified; provenance (what the
   caller actually said) is always preserved alongside the derived view.
3. **`addGoalsConstraints(id, request)`** — attaches the caller's goals
   and constraints to an already-`'understood'` task and advances it to
   `'goals-constraints'`. Each item is tagged with its `origin`
   (`'caller'` for text supplied verbatim by the caller, `'extracted'`
   for text Meta-Intelligence derived) — origins are never merged or
   silently rewritten into each other.
4. **`addEpistemicTracking(id, request)`** — attaches the caller's
   knowns, unknowns, assumptions, and evidence to an already-
   `'goals-constraints'` task and advances it to `'epistemic-tracking'`.
   Each of the four is tracked as its own list, and every item is tagged
   with the same `'caller'` / `'extracted'` `origin` used by
   goals/constraints — never merged or silently rewritten into each
   other. Still no capability decomposition.
5. **`decomposeCapabilities(id, graph, request)`** — checks a
   caller-supplied list of required capabilities against `graph` (a
   `CapabilityGraph`-shaped object — an actual MAGENAIS-main
   `CapabilityGraph` built from the live `ModelRegistry` already
   satisfies this shape, see `src/contract.ts`'s `CapabilityGraphLike`)
   and advances an already-`'epistemic-tracking'` task to
   `'capability-decomposition'`. Each requirement is tagged with its
   `origin`, same as every earlier stage, and each ends up with the
   provider model ids the graph reports (`providers`) and whether any
   exist (`satisfied`). An unmet capability is recorded as a **gap**, not
   rejected as an error — this stage does capability *gap detection*,
   not strategy generation or selection.
6. **`generateCandidateStrategies(id)`** — builds a minimal set of
   candidate strategies from an already-`'capability-decomposition'`
   task's own decomposition and advances it to `'candidate-strategies'`.
   One candidate is created per *satisfied* requirement, in requirement
   order, pointing back at that requirement (`requirementId`) and
   carrying a copy of its `providers`; a gap requirement yields no
   candidate and stays visible as `capabilityDecomposition.gaps`. A
   candidate keeps the requirement's full provider list — nothing is
   scored, ranked, or selected, and no single provider is chosen.
7. **`evaluateStrategies(id, request, scorer)`** — scores an
   already-`'candidate-strategies'` task's candidates and records an
   explicit selection, advancing it to `'strategy-evaluation'`. The
   candidates become DecisionScore options (option id = candidate id);
   the criteria, weights, and per-candidate scores come from `request`
   (nothing is invented). `scorer` is a DecisionScore-shaped function
   (`MetaIntelligenceStrategyScorer`: weighted-sum ranking + Decision
   Stability Index + Decision Flip Points) — required here because this
   package has no dependencies; in MAGENAIS-main it defaults to the real
   DecisionScore functions. The top-ranked candidate is selected unless
   there are no candidates (`'no-candidates'`), the top two tie
   (`'tie-for-top'`, candidate order is not a preference), or the
   caller's optional `minStability` exceeds the DSI
   (`'below-stability-threshold'`) — those record an explicit
   `{ status: 'none', reason }`. A selection names a candidate only; it
   does not choose a provider or execute anything.
8. **`governAction(id, request)`** — records an explicit, caller-supplied
   ACT/WAIT/ASK/SIMULATE governance decision against an
   already-`'strategy-evaluation'` task and advances it to
   `'action-governance'`. The decision is exactly what `request.decision`
   asks for — Meta-Intelligence never chooses among ACT/WAIT/ASK/SIMULATE
   on its own — with one mechanical rejection: `'ACT'` is refused (task
   left unchanged) unless the task's AWU-07
   `strategyEvaluation.selection.status === 'selected'`. The recorded
   governance carries a verbatim copy of the selection it gates, so it
   stays traceable to the exact AWU-07 outcome. Executes, verifies, and
   adapts nothing.
9. **`recordResult(id, request)`** — records the caller's claimed outcome
   (`request.status`: `'succeeded'` | `'failed'` | `'not-yet-executed'`)
   for an already-`'action-governance'` task and advances it to
   `'result-verification'`. Reachable only when the task's
   `governance.decision` is `'ACT'` or `'SIMULATE'` — a `'WAIT'`/`'ASK'`
   governed task is refused (task left unchanged), since a deferred
   decision has nothing to have a result yet. `simulated` is NOT
   caller-supplied — it's derived from `governance.decision` (`true` iff
   `'SIMULATE'`). Alongside the result, a verification outcome is
   computed purely mechanically from `status` and the task's own AWU-03
   goals/constraints and AWU-04 knowns: `'not-yet-executed'` →
   `'not-verifiable'`; `'failed'` → `'goals-not-met'`; `'succeeded'` →
   `'verified-against-basis'` only if at least one goal-or-constraint AND
   at least one known are recorded on the task, else
   `'insufficient-basis'`. Executes, composes, and adapts nothing.
10. **`recordAdaptation(id, request)`** — records the caller's chosen
    response (`request.decision`: `'retry'` | `'re-plan'` | `'escalate'` |
    `'accept'`) to a not-succeeded-as-claimed verification outcome,
    advancing an already-`'result-verification'` task to `'adaptation'`
    — the tenth and final stage. Reachable only when
    `verification.outcome` is `'goals-not-met'` or `'insufficient-basis'`
    — a `'verified-against-basis'` or `'not-verifiable'` task is refused
    (task left unchanged), since neither means the task "did not succeed
    as claimed". Meta-Intelligence never chooses retry/re-plan/escalate/
    accept on its own. The recorded adaptation carries a verbatim copy of
    the verification outcome it responds to, so it stays traceable.
    Executes, re-executes, and automatically retries nothing — not even
    for a `'retry'`/`'re-plan'` decision — and never loops the task back
    to an earlier stage.

```ts
import { MetaIntelligenceOrchestrator } from '@magenais/meta-intelligence';

const orchestrator = new MetaIntelligenceOrchestrator();

const task = orchestrator.intake({ statement: 'Reduce checkout drop-off.' });
console.log(task.stage); // 'received'

const understood = orchestrator.understand(task.id);
console.log(understood.stage); // 'understood'
console.log(understood.understanding?.normalizedStatement);

const withGoals = orchestrator.addGoalsConstraints(task.id, {
  goals: [{ text: 'Increase checkout completion rate', origin: 'caller' }],
  constraints: [{ text: 'No changes to the payment provider', origin: 'caller' }],
});
console.log(withGoals.stage); // 'goals-constraints'
console.log(withGoals.goalsConstraints?.goals[0].origin); // 'caller'

const withEpistemics = orchestrator.addEpistemicTracking(task.id, {
  knowns: [{ text: 'Checkout has 5 steps today', origin: 'caller' }],
  unknowns: [{ text: 'Which step causes the most drop-off', origin: 'extracted' }],
  assumptions: [],
  evidence: [],
});
console.log(withEpistemics.stage); // 'epistemic-tracking'
console.log(withEpistemics.epistemicTracking?.knowns[0].origin); // 'caller'

// A CapabilityGraph-shaped object — a real MAGENAIS-main CapabilityGraph
// (built from the live ModelRegistry) already satisfies this shape.
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
console.log(withCapabilities.stage); // 'capability-decomposition'
console.log(withCapabilities.capabilityDecomposition?.gaps); // ['mobile-ux-benchmarking']

const withStrategies = orchestrator.generateCandidateStrategies(task.id);
console.log(withStrategies.stage); // 'candidate-strategies'
console.log(withStrategies.candidateStrategies?.candidates.length); // 1 (the gap yields none)

// `scorer` is any DecisionScore-shaped function (see MetaIntelligenceStrategyScorer).
const evaluated = orchestrator.evaluateStrategies(
  task.id,
  {
    criteria: [{ id: 'impact', weight: 1, direction: 'maximize' }],
    scores: { 'strategy-1': { impact: 8 } },
  },
  scorer
);
console.log(evaluated.stage); // 'strategy-evaluation'
console.log(evaluated.strategyEvaluation?.selection); // { status: 'selected', candidateId: 'strategy-1' }

const governed = orchestrator.governAction(task.id, {
  decision: 'ACT',
  reason: 'Selection is clear-cut; proceeding without human confirmation.',
});
console.log(governed.stage); // 'action-governance'
console.log(governed.governance?.decision); // 'ACT'

const resulted = orchestrator.recordResult(task.id, {
  status: 'succeeded',
  detail: 'Rolled out funnel-analysis change to 100% of mobile traffic.',
});
console.log(resulted.stage); // 'result-verification'
console.log(resulted.result); // { status: 'succeeded', simulated: false, detail: '...', recordedAt: '...' }
console.log(resulted.verification?.outcome); // 'verified-against-basis'

// recordAdaptation() is only reachable for a 'goals-not-met' or
// 'insufficient-basis' outcome — the task above verified successfully, so
// this would throw MetaIntelligenceAdaptationNotRepresentableError for it.
// See examples/basic-usage.mjs for a second, failing task that does adapt.
```

See `examples/basic-usage.mjs` for a runnable version of this.

## Input / output shapes

```ts
interface MetaIntelligenceIntakeRequest {
  statement: string; // must be non-empty after trimming
  id?: string;        // optional caller-supplied id
}

type MetaIntelligenceStage =
  | 'received'
  | 'understood'
  | 'goals-constraints'
  | 'epistemic-tracking'
  | 'capability-decomposition'
  | 'candidate-strategies'
  | 'strategy-evaluation'
  | 'action-governance'
  | 'result-verification'
  | 'adaptation';

interface MetaIntelligenceProblem {
  statement: string;   // verbatim, never rewritten
  receivedAt: string;  // ISO-8601
}

interface MetaIntelligenceUnderstanding {
  normalizedStatement: string; // whitespace-collapsed only
  understoodAt: string;        // ISO-8601
}

type MetaIntelligenceOrigin = 'caller' | 'extracted';

interface MetaIntelligenceGoalOrConstraint {
  id: string;
  text: string;                  // verbatim per its origin
  origin: MetaIntelligenceOrigin;
}

interface MetaIntelligenceGoalsConstraints {
  goals: MetaIntelligenceGoalOrConstraint[];
  constraints: MetaIntelligenceGoalOrConstraint[];
  recordedAt: string; // ISO-8601
}

interface MetaIntelligenceEpistemicItem {
  id: string;
  text: string;                  // verbatim per its origin
  origin: MetaIntelligenceOrigin;
}

interface MetaIntelligenceEpistemicTracking {
  knowns: MetaIntelligenceEpistemicItem[];
  unknowns: MetaIntelligenceEpistemicItem[];
  assumptions: MetaIntelligenceEpistemicItem[];
  evidence: MetaIntelligenceEpistemicItem[];
  recordedAt: string; // ISO-8601
}

interface MetaIntelligenceTask {
  id: string;
  problem: MetaIntelligenceProblem;
  stage: MetaIntelligenceStage;
  understanding?: MetaIntelligenceUnderstanding;       // present once 'understood' or later
  goalsConstraints?: MetaIntelligenceGoalsConstraints; // present once 'goals-constraints' or later
  epistemicTracking?: MetaIntelligenceEpistemicTracking; // present once 'epistemic-tracking' or later
  capabilityDecomposition?: MetaIntelligenceCapabilityDecomposition; // present once 'capability-decomposition' or later
  candidateStrategies?: MetaIntelligenceCandidateStrategies;         // present once 'candidate-strategies' or later
  strategyEvaluation?: MetaIntelligenceStrategyEvaluation;           // present once 'strategy-evaluation' or later
  governance?: MetaIntelligenceGovernance;                           // present once 'action-governance' or later
  result?: MetaIntelligenceResult;                                   // present once 'result-verification' or later
  verification?: MetaIntelligenceVerification;                       // present once 'result-verification' or later
  adaptation?: MetaIntelligenceAdaptation;                           // present once 'adaptation'
}

interface MetaIntelligenceCapabilityRequirement {
  id: string;
  capability: string;             // verbatim per its origin
  origin: MetaIntelligenceOrigin;
  providers: string[];            // model ids the CapabilityGraph reported, at decomposition time
  satisfied: boolean;             // providers.length > 0
}

interface MetaIntelligenceCapabilityDecomposition {
  requirements: MetaIntelligenceCapabilityRequirement[];
  gaps: string[];      // de-duplicated capabilities with no provider, first-seen order
  decomposedAt: string; // ISO-8601
}

interface MetaIntelligenceCandidateStrategy {
  id: string;            // 'strategy-N', unique within the task
  requirementId: string; // the AWU-05 requirement this candidate is built from
  capability: string;    // that requirement's capability, copied verbatim
  providers: string[];   // copy of that requirement's providers; never empty. No provider is chosen.
}

interface MetaIntelligenceCandidateStrategies {
  candidates: MetaIntelligenceCandidateStrategy[]; // unordered options (requirement order, not a preference); no score/rank/selected
  generatedAt: string;                              // ISO-8601
}

type MetaIntelligenceStrategySelection =
  | { status: 'selected'; candidateId: string }  // candidateId is always a candidate id on the same task
  | { status: 'none'; reason: 'no-candidates' | 'tie-for-top' | 'below-stability-threshold' };

interface MetaIntelligenceStrategyEvaluation {
  criteria: DecisionScoreCriterion[];   // as supplied by the caller
  scores: DecisionScoreMatrix;          // scores[candidateId][criterionId], as supplied
  ranking: { candidateId: string; score: number; rank: number }[]; // from the scorer; empty iff no candidates
  dsi: number | null;                   // Decision Stability Index; null if nothing was scored
  dfp: DecisionFlipPoint[];             // Decision Flip Points, unchanged
  minStability: number | null;          // caller's threshold, if any
  selection: MetaIntelligenceStrategySelection;
  evaluatedAt: string;                  // ISO-8601
}

type MetaIntelligenceGovernanceDecision = 'ACT' | 'WAIT' | 'ASK' | 'SIMULATE';

interface MetaIntelligenceGovernance {
  decision: MetaIntelligenceGovernanceDecision;      // exactly the caller's request.decision
  selection: MetaIntelligenceStrategySelection;      // verbatim copy of the AWU-07 selection gated
  reason: string | null;                             // caller-supplied, trimmed, or null
  governedAt: string;                                // ISO-8601
}

type MetaIntelligenceResultStatus = 'succeeded' | 'failed' | 'not-yet-executed';

interface MetaIntelligenceResult {
  status: MetaIntelligenceResultStatus; // exactly the caller's claim
  simulated: boolean;                   // derived from governance.decision === 'SIMULATE'; never caller-supplied
  detail: string | null;                // caller-supplied, trimmed, or null
  recordedAt: string;                   // ISO-8601
}

type MetaIntelligenceVerificationOutcome =
  | 'not-verifiable'        // status === 'not-yet-executed'
  | 'goals-not-met'         // status === 'failed'
  | 'insufficient-basis'    // status === 'succeeded' but no goal/constraint or no known recorded
  | 'verified-against-basis'; // status === 'succeeded' with both present

interface MetaIntelligenceVerification {
  outcome: MetaIntelligenceVerificationOutcome;
  goalIds: string[];       // task's goalsConstraints.goals ids, at verification time
  constraintIds: string[]; // task's goalsConstraints.constraints ids, at verification time
  knownIds: string[];      // task's epistemicTracking.knowns ids, at verification time
  verifiedAt: string;      // ISO-8601; equal to the sibling MetaIntelligenceResult.recordedAt
}

// The two outcomes above for which an adaptation decision is representable.
type MetaIntelligenceAdaptableVerificationOutcome = 'goals-not-met' | 'insufficient-basis';

type MetaIntelligenceAdaptationDecision = 'retry' | 're-plan' | 'escalate' | 'accept';

interface MetaIntelligenceAdaptation {
  decision: MetaIntelligenceAdaptationDecision;             // exactly the caller's request.decision
  outcome: MetaIntelligenceAdaptableVerificationOutcome;     // verbatim copy of verification.outcome
  reason: string | null;                                     // caller-supplied, trimmed, or null
  adaptedAt: string;                                         // ISO-8601
}
```

## Limitations

- No real execution, composition, re-execution, or automatic retry.
  Calling anything beyond `intake()` / `understand()` /
  `addGoalsConstraints()` / `addEpistemicTracking()` /
  `decomposeCapabilities()` / `generateCandidateStrategies()` /
  `evaluateStrategies()` / `governAction()` / `recordResult()` /
  `recordAdaptation()` does not exist — there is nothing else to call.
- `governAction()` never chooses among ACT/WAIT/ASK/SIMULATE itself — the
  decision is exactly what the caller requests, with one mechanical
  rejection (`'ACT'` requires an actual AWU-07 selection).
- `recordResult()` never executes, verifies-then-overwrites, or invents a
  result — `status` is exactly the caller's claim about what happened
  elsewhere. Verification is purely mechanical (presence of a recorded
  goal/constraint and known, plus `status` itself), never a semantic
  judgement that a claimed success is independently confirmed true.
- `recordAdaptation()` never chooses among retry/re-plan/escalate/accept
  itself, and never actually retries, re-plans, or re-executes anything —
  even a `'retry'`/`'re-plan'` decision is representation only, and the
  task is never looped back to an earlier stage for a live re-plan.
- `generateCandidateStrategies()` only lists options: it does not judge
  which candidate is better, choose among a candidate's providers, or
  build multi-capability combinations.
- `evaluateStrategies()` does not invent criteria, weights, or
  per-candidate scores — the caller supplies them — and it selects a
  candidate, not a provider. It takes a DecisionScore-shaped scorer as a
  parameter (mirrored types in `src/contract.ts`) rather than importing
  MAGENAIS-main's DecisionScore, and this package does not bundle one; the
  scorer's result is checked to trace back to the task's candidates, but
  its scoring quality is the scorer's. DecisionScore's own caveats (weights
  only, not score uncertainty) apply.
- `decomposeCapabilities()` takes a `CapabilityGraph`-shaped object as a
  parameter rather than importing MAGENAIS-main's `CapabilityGraph`
  class, to keep this package's zero-dependency guarantee — see
  `src/contract.ts`'s `CapabilityGraphLike`. It does not build or own a
  capability graph itself.
- Not yet wired into a MAGENAIS `ModelHub`/`ModelRegistry` — this
  repository and the copy under MAGENAIS-main's
  `src/ModelsHub/meta-intelligence/` are kept in sync by hand, the same
  way DecisionScore/PatternSense/AnomalyMind were before their own
  connection phases (see this repo's `CONTRIBUTING.md`).

## Version

`0.1.0` — versioned independently of MAGENAIS itself. Expect breaking
changes to `MetaIntelligenceTask`'s shape as later AWUs add stages.

## License

Apache-2.0. See `LICENSE`.
