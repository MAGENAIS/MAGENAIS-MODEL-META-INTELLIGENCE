# Architecture (V2)

## Shape

One class, `MetaIntelligenceOrchestrator`, holds a `Map<taskId, MetaIntelligenceTask>` in memory. Every method takes a task
id, validates the call, and returns the updated (immutable-by-convention, deeply `readonly`) task. On any
rejection the task is left exactly as it was. There is no I/O, no clock other than timestamps, no randomness
except DecisionScore's seeded perturbation.

```
src/
  index.ts                         public API (explicit exports only)
  MetaIntelligenceOrchestrator.ts  the orchestrator + all typed errors
  types.ts                         task, stage, strategy, plan, trace, request/result types
  contract.ts                      shared shapes: manifest subset, CapabilityGraphLike, DecisionScore I/O
  manifest.ts / version.ts         manifest constant (source of model.json) / version constants
  scoring/                         bundled DecisionScore algorithm + default scorer adapter
  benchmark/                       separate subpath: engine, 51-case pipeline benchmark, guard ablations
```

## Two lanes over one task

**Frozen V1 lane** (stage-gated, one call per stage, forward only):
`received → understood → goals-constraints → epistemic-tracking → capability-decomposition → candidate-strategies →
strategy-evaluation → action-governance → result-verification → adaptation`.

**V2 additive lane** (does *not* advance `stage`; each call is guarded by the fields it needs):
`generateStrategies → generateStrategyAlternatives → evaluateStrategyOptions → authorizeComposition → buildExecutionPlan →
recordExecutionOutcome → recordExecutionAdaptation`, plus the derived views. V2 was built additively so the V1 surface
stayed frozen; a V2 task therefore stays at `capability-decomposition` while V2 fields accumulate. This is intentional.

## Principles that shape behaviour

1. **Caller decides, component records.** Goals, evidence, capabilities, criteria, scores, governance, composition,
   outcome and adaptation are supplied by the caller. The component constrains mechanically (e.g. `ACT` needs a selected strategy).
2. **Provenance everywhere.** Items are tagged `caller` or `extracted`; text is kept verbatim (trimmed only); the
   normalized statement sits *beside* the original, never replacing it.
3. **Abstain rather than guess.** Ties, empty option sets and unmet stability thresholds produce
   `{ status: 'none', reason }`, and `ACT` is then refused.
4. **No hidden execution.** Plans, boundaries and adaptations are data.
5. **Structural uncertainty.** DSI (0..1 ranking stability under seeded weight/score perturbation), DFP (smallest
   perturbation that flips the winner), origin-tagged knowns/unknowns/assumptions, explicit abstentions. No probabilities.
6. **Reject duplicates.** Second calls to once-only V2 steps throw; records are never silently recomputed.

## Strategy generation (V2-B)

Derived only from the capability decomposition: one strategy per *satisfied* requirement; alternatives add one strategy
per additional provider and one `composed` strategy across requirements. Requirements with no provider are **gaps** and
yield no strategy. Ids are `strategy-1..n` in a stable order.

## Evaluation

`evaluateStrategyOptions` scores all strategy options (base + alternatives) through a scorer of type
`MetaIntelligenceStrategyScorer`. The default is the vendored DecisionScore weighted-sum algorithm (`scoreWithDecisionScore`);
pass your own as the third argument. Risk or cost is an ordinary criterion with `direction: 'minimize'`.

## Verification semantics

`succeeded` → `verified-against-basis` only if ≥1 goal/constraint **and** ≥1 known were recorded, else `insufficient-basis`;
`failed` → `goals-not-met`; `not-yet-executed` → `not-verifiable`. This is a mechanical basis check, not confirmation the claim is true.

## Isolation

No import leaves the package. `CapabilityGraphLike` is structural; a MAGENAIS `CapabilityGraph` satisfies it
without an adapter. See [`integration.md`](integration.md).
