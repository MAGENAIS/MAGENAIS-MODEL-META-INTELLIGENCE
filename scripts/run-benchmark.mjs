// Runs the bundled pipeline benchmark and the guard ablations, printing a summary.
// Results are deterministic apart from wall-clock latency. Usage: npm run benchmark
import { runMetaIntelligencePipelineBenchmark, runGuardAblations } from '../src/benchmark/index.ts';
import { META_INTELLIGENCE_VERSION } from '../src/index.ts';

const options = { codeVersion: META_INTELLIGENCE_VERSION };
const run = await runMetaIntelligencePipelineBenchmark(options);
const passed = run.cases.filter((c) => c.passed === true).length;
console.log(`benchmark ${run.benchmarkId}@${run.benchmarkVersion}: ${passed}/${run.cases.length} cases passed (passRate ${run.passRate})`);
const byCategory = {};
for (const c of run.cases) byCategory[c.category] = (byCategory[c.category] ?? 0) + 1;
console.log('cases by category:', JSON.stringify(byCategory));
for (const c of run.cases.filter((c) => c.passed !== true)) console.log(`  FAIL ${c.caseId}: ${c.error ?? JSON.stringify(c.notes)}`);

const reports = await runGuardAblations(options);
console.log(`\nguard ablations (fail-open fault injection): ${reports.length}`);
for (const r of reports) console.log(`  ${r.guardId}: ${r.breakdown.failedCases + "/" + r.breakdown.totalCases} failing case(s)`);
process.exit(passed === run.cases.length ? 0 : 1);
