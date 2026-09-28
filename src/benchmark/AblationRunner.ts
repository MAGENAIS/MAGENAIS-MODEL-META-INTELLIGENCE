/**
 * AblationRunner.ts
 *
 * V5 PHASE 2. Implements V5 MASTER PROMPT §26's Controlled Ablation:
 * "SYSTEM WITHOUT COMPONENT vs SYSTEM WITH COMPONENT... identify whether
 * the component actually contributes measurable value."
 *
 * This is deliberately a thin wrapper over `runBenchmark` +
 * `compareResults`, not a separate statistics implementation: an ablation
 * IS a baseline comparison where "baseline" means "the system with the
 * component removed" rather than "a naive alternative approach". Reusing
 * BaselineComparator keeps the two comparison paths from silently
 * developing different metric-matching or delta semantics over time.
 *
 * Where this differs from calling `runBenchmark`/`compareResults`
 * directly: it takes `componentId` and labels the result under §26's own
 * `without`/`with` vocabulary, so a report reads the way the master
 * prompt phrases it rather than as a generic "baseline/treatment" pair.
 */

import type {
  AblationResult,
  BenchmarkDefinition,
  BenchmarkSubject,
  SubjectDescriptor,
} from './types.ts';
import { runBenchmark, type RunOptions } from './BenchmarkRunner.ts';
import { compareResults } from './BaselineComparator.ts';

/**
 * Run the same benchmark definition with a component present and absent,
 * and compare the two runs. `withoutSubject` and `withSubject` must be
 * genuinely the same system differing only in whether the named component
 * participates — this function has no way to verify that; it is the
 * caller's design responsibility (§26: ablation only means something if
 * everything else is held constant).
 */
export async function runAblation<TInput, TOutput, TExpected>(
  definition: BenchmarkDefinition<TInput, TOutput, TExpected>,
  componentId: string,
  withoutSubject: BenchmarkSubject<TInput, TOutput>,
  withoutDescriptor: SubjectDescriptor,
  withSubject: BenchmarkSubject<TInput, TOutput>,
  withDescriptor: SubjectDescriptor,
  options: RunOptions = {}
): Promise<AblationResult> {
  const without = await runBenchmark(definition, withoutSubject, withoutDescriptor, options);
  const withResult = await runBenchmark(definition, withSubject, withDescriptor, options);

  return {
    componentId,
    without,
    with: withResult,
    comparison: compareResults(without, withResult),
  };
}
