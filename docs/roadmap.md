# Roadmap

Meta-Intelligence is built one Atomic Work Unit (AWU) at a time against
the pipeline in the Definition of Done:

```
Problem -> Understand -> Goals/Constraints -> Known/Unknown/Assumptions/Evidence
        -> Capability Decomposition -> Candidate Strategies -> Evaluation/Selection
        -> Execution/Composition -> Verification -> Result -> Adaptation/Re-plan
```

| AWU | Adds | Status |
|---|---|---|
| AWU-01 | Contract + thin orchestrator + entry tests (`intake()`) | Done |
| AWU-02 | Problem normalization / understanding state (`understand()`) | Done |
| AWU-03 | Goals + constraints (caller vs. extracted origin preserved) | Done |
| AWU-04 | Known/unknown/assumption/evidence tracking | Done |
| AWU-05 | Capability decomposition against the capability graph | Done |
| AWU-06 | Candidate strategy representation + minimal generation (non-selecting) | Done |
| AWU-07 | Strategy evaluation/selection (DecisionScore-shaped scoring; explicit selection or 'none selected') | Done |
| AWU-08 | Action governance + execution/composition boundary (ACT/WAIT/ASK/SIMULATE) | Done |
| AWU-09 | Verification + result representation | Done |
| AWU-10 | Adaptation/re-plan/failure-recovery loop | Done |
| AWU-11 | Benchmark + baseline comparison + adversarial cases | Not started |
| AWU-12 | Integration, quality gates, manifest/capability registration, final hardening | Not started |

This table is descriptive of the plan, not a commitment to exact scope
or timing for each AWU — an AWU may be split into sub-AWUs as the build
proceeds. See the MAGENAIS repository's `META_INTELLIGENCE_BUILD_PROMPT_V4.md`
and `.mi/` control plane for the authoritative, current state of the
build this package is produced from.
