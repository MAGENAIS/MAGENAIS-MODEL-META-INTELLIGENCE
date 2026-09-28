# Roadmap

Status vocabulary: **implemented** (exists and tested) · **planned** (intended, not started) · **not implemented** (deliberately absent).

## Implemented in 2.0.0

The full V1 ten-stage pipeline (AWU-01..10), the V1 benchmark and hardening (AWU-11..12), and V2 phases A–D: problem
representation, strategy generation and alternatives, DecisionScore-backed option evaluation, composition boundary,
execution plan, outcome verification, adaptation, cognitive trace, provenance, failure states and the sensitivity ablations.

## Planned (no commitment to scope or date)

- An **executor** that consumes an execution plan and reports outcomes back. Not started; today the caller executes.
- Persistence / serialization of tasks. Not started.
- A baseline methodology that could justify raising `evidenceLevel` above `benchmarked`. Not started.
- An owner decision on `verificationStatus` (stays `not-ready`). The model is listed in the public MAGENAIS catalog and shown in the Models Hub as an information-only entry.
- Shared uncertainty primitives across future models (the source project scheduled a decision-only check before any further model). Not started.

## Not implemented, by design

Autonomous execution or retry; inventing goals/evidence/strategies; calibrated probabilities; registering as an ordinary routed model.
