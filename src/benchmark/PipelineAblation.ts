/**
 * MetaIntelligencePipelineAblation.ts
 *
 * V2-D2. Ablation + failure analysis over the Meta-Intelligence pipeline
 * benchmark, reusing the generic engine (`runAblation()`, `analyzeFailures()`)
 * unchanged.
 *
 * HONEST SCOPE. V5 MASTER PROMPT §26 wants "system without component vs system
 * with component". Meta-Intelligence's components are methods and guards
 * inside ONE class, not separately swappable modules, so there is no true
 * component-removal pair. What can be built without changing any orchestrator
 * behavior is a FAIL-OPEN FAULT INJECTION at the API boundary: the "without"
 * subject wraps the real orchestrator so that one guard's rejection is
 * silently swallowed (the call returns undefined instead of throwing).
 * That answers a narrower but real question -- does the benchmark notice when
 * a given guard stops surfacing its rejection, and are the resulting failures
 * attributable to a declared failure mode? It does NOT measure the runtime
 * value of the guard, and an ablation that fails no case would indicate a
 * blind spot in the benchmark, not a useless guard.
 */

import { MetaIntelligenceOrchestrator } from '../MetaIntelligenceOrchestrator.ts';
import { META_INTELLIGENCE_MANIFEST } from '../manifest.ts';
import type { BenchmarkDefinition, BenchmarkSubject, FailureBreakdown } from './types.ts';
import { runAblation } from './AblationRunner.ts';
import { analyzeFailures } from './FailureAnalyzer.ts';
import type { RunOptions } from './BenchmarkRunner.ts';
import {
  metaIntelligencePipelineBenchmark,
  metaIntelligencePipelineSubject,
  META_INTELLIGENCE_SUBJECT_DESCRIPTOR,
  type MetaIntelligenceScenario,
  type MetaIntelligenceScenarioOutcome,
} from './PipelineBenchmark.ts';

export interface GuardAblation {
  readonly guardId: string;
  readonly description: string;
  /** The declared failure mode this guard corresponds to, or null when the manifest declares none. */
  readonly failureModeId: string | null;
  /** True for the `Error.name` values whose rejection this ablation swallows. */
  readonly swallows: (errorName: string) => boolean;
}

const names = (...n: string[]) => (errorName: string) => n.includes(errorName);

export const GUARD_ABLATIONS: readonly GuardAblation[] = [
  {
    guardId: 'act-selection-guard',
    description: 'governAction() refusing ACT without a selected candidate',
    failureModeId: 'act-without-selection',
    swallows: names('MetaIntelligenceActionNotSelectableError'),
  },
  {
    guardId: 'adaptation-representability-guard',
    description: 'recordAdaptation() refusing verified-against-basis / not-verifiable outcomes',
    failureModeId: 'adaptation-not-representable',
    swallows: names('MetaIntelligenceAdaptationNotRepresentableError'),
  },
  {
    guardId: 'stage-order-guard',
    description: "every stage method's NotAtXStageError rejection",
    failureModeId: 'out-of-order-stage-call',
    swallows: (n) => /^MetaIntelligenceTaskNotAt.+StageError$/.test(n),
  },
  {
    guardId: 'empty-text-guard',
    description: 'empty/whitespace text rejection at intake and the goal/epistemic/capability inputs',
    failureModeId: 'empty-text-input',
    swallows: names(
      'EmptyProblemStatementError',
      'EmptyGoalOrConstraintTextError',
      'EmptyEpistemicItemTextError',
      'EmptyCapabilityRequirementError'
    ),
  },
  {
    guardId: 'result-representability-guard',
    description: 'recordResult() refusing WAIT/ASK-governed tasks',
    failureModeId: 'result-not-representable',
    swallows: names('MetaIntelligenceResultNotRepresentableError'),
  },
  {
    guardId: 'enum-validation-guard',
    description: 'invalid governance decision / result status / adaptation decision rejection',
    failureModeId: 'invalid-enum-value',
    swallows: names('InvalidGovernanceDecisionError', 'InvalidResultStatusError', 'InvalidAdaptationDecisionError'),
  },
  // V2-D5: the former single `v2bc-stage-mechanics-guards` entry bundled three
  // distinct rejections that no one failure mode describes literally, so it is
  // split into one guard per declared mode. The union of swallowed errors is
  // unchanged.
  {
    guardId: 'v2-duplicate-call-guard',
    description: 'authorizeComposition() / recordExecutionOutcome() / recordExecutionAdaptation() refusing a second call for the same task',
    failureModeId: 'duplicate-v2-stage-call',
    swallows: names(
      'MetaIntelligenceCompositionAlreadyBoundError',
      'MetaIntelligenceExecutionResultAlreadyRecordedError',
      'MetaIntelligenceExecutionAdaptationAlreadyRecordedError'
    ),
  },
  {
    guardId: 'execution-plan-authorization-guard',
    description: 'buildExecutionPlan() refusing a composition boundary whose decision is not ACT',
    failureModeId: 'execution-plan-not-authorized',
    swallows: names('MetaIntelligenceExecutionPlanNotAuthorizedError'),
  },
  {
    guardId: 'execution-adaptation-representability-guard',
    description: 'recordExecutionAdaptation() refusing verified-against-basis / not-verifiable execution outcomes',
    failureModeId: 'execution-adaptation-not-representable',
    swallows: names('MetaIntelligenceExecutionAdaptationNotRepresentableError'),
  },
];

/** Wraps a real orchestrator so rejections matching `swallows` return undefined instead of throwing. */
function failOpen(mi: MetaIntelligenceOrchestrator, swallows: (errorName: string) => boolean): MetaIntelligenceOrchestrator {
  return new Proxy(mi, {
    get(target, prop) {
      const value = Reflect.get(target, prop, target);
      if (typeof value !== 'function') return value;
      return (...args: unknown[]) => {
        try {
          return Reflect.apply(value, target, args);
        } catch (err) {
          if (err instanceof Error && swallows(err.name)) return undefined;
          throw err;
        }
      };
    },
  });
}

export function ablatedPipelineSubject(
  swallows: (errorName: string) => boolean
): BenchmarkSubject<MetaIntelligenceScenario, MetaIntelligenceScenarioOutcome> {
  return async (scenario) => ({ output: scenario(failOpen(new MetaIntelligenceOrchestrator(), swallows)) });
}

export interface GuardAblationReport {
  readonly guardId: string;
  readonly failureModeId: string | null;
  readonly passRateWith: number | undefined;
  readonly passRateWithout: number | undefined;
  readonly failedCaseIds: readonly string[];
  readonly breakdown: FailureBreakdown;
}

export async function runGuardAblations(options: RunOptions = {}): Promise<GuardAblationReport[]> {
  const reports: GuardAblationReport[] = [];
  for (const g of GUARD_ABLATIONS) {
    const result = await runAblation(
      metaIntelligencePipelineBenchmark,
      g.guardId,
      ablatedPipelineSubject(g.swallows),
      { ...META_INTELLIGENCE_SUBJECT_DESCRIPTOR, id: `${META_INTELLIGENCE_SUBJECT_DESCRIPTOR.id}#without-${g.guardId}` },
      metaIntelligencePipelineSubject,
      META_INTELLIGENCE_SUBJECT_DESCRIPTOR,
      options
    );
    const breakdown = analyzeFailures(
      result.without,
      // analyzeFailures() only reads case ids and probesFailureModes, so widening the generics is safe.
      metaIntelligencePipelineBenchmark as unknown as BenchmarkDefinition<unknown, unknown, unknown>,
      META_INTELLIGENCE_MANIFEST.failureModes ?? []
    );
    reports.push({
      guardId: g.guardId,
      failureModeId: g.failureModeId,
      passRateWith: result.with.passRate,
      passRateWithout: result.without.passRate,
      failedCaseIds: result.without.cases.filter((c) => c.passed === false || c.error !== undefined).map((c) => c.caseId),
      breakdown,
    });
  }
  return reports;
}
