/**
 * FailureAnalyzer.ts
 *
 * V5 PHASE 2. Operationalizes V5 MASTER PROMPT §27 (Failure-First
 * Engineering) and the failure-analysis half of §25: it cross-checks a
 * benchmark run's actual failing cases against the subject's DECLARED
 * failure taxonomy (`ModelManifest.failureModes`, from `CognitiveContract`
 * — V5 Phase 1).
 *
 * The point is not to count failures — `BenchmarkRunResult.passRate`
 * already does that. The point is to catch the gap §27 warns about: "a
 * model is not complete merely because its happy path works." A case can
 * fail in a way the model's own documentation never anticipated, and a
 * pass-rate number alone hides that distinction completely — 90% passing
 * looks identical whether the 10% failures are all the one documented edge
 * case or ten different undocumented ones. `undocumented` makes that
 * difference visible.
 *
 * A case only counts as "documented" if it BOTH names a
 * `probesFailureModes` id AND that id appears in the subject's own
 * declared `failureModes`. Naming an id the model doesn't actually declare
 * is treated as undocumented too — the benchmark author's guess about a
 * failure mode isn't evidence that the model's own passport documents it.
 */

import type { FailureMode } from '../contract.ts';
import type { BenchmarkDefinition, BenchmarkRunResult, CaseResult, FailureBreakdown } from './types.ts';

function isFailure(caseResult: CaseResult): boolean {
  return caseResult.passed === false || caseResult.error !== undefined;
}

/**
 * Cross-check a run's failures against a definition's own case metadata
 * and a subject's declared failure taxonomy.
 */
export function analyzeFailures(
  result: BenchmarkRunResult,
  definition: BenchmarkDefinition<unknown, unknown, unknown>,
  declaredFailureModes: readonly FailureMode[]
): FailureBreakdown {
  const declaredIds = new Set(declaredFailureModes.map((fm) => fm.id));
  const caseById = new Map(definition.cases.map((c) => [c.id, c] as const));

  const byDeclaredFailureMode: Record<string, number> = {};
  const undocumented: CaseResult[] = [];

  const failures = result.cases.filter(isFailure);

  for (const caseResult of failures) {
    const probed = (caseById.get(caseResult.caseId)?.probesFailureModes ?? []).filter((id) => declaredIds.has(id));

    if (probed.length === 0) {
      undocumented.push(caseResult);
      continue;
    }

    for (const id of probed) {
      byDeclaredFailureMode[id] = (byDeclaredFailureMode[id] ?? 0) + 1;
    }
  }

  return {
    totalCases: result.cases.length,
    failedCases: failures.length,
    byDeclaredFailureMode,
    undocumented,
  };
}
