import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

import { evaluateCorpus, loadCorpus } from "./evaluation-core.mjs";

function option(name, fallback) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : fallback;
}

const output = resolve(option("--output", "../Y2-3100-3101-3102/evidence/Y2_3101_DEVELOPMENT_EVALUATION.json"));
const label = option("--label", "development-baseline");
const corpus = await loadCorpus();
const report = await evaluateCorpus(corpus, { label, deterministicRerun: true });
await mkdir(dirname(output), { recursive: true });
await writeFile(output, `${JSON.stringify(report, null, 2)}\n`, { mode: 0o600 });
console.log(JSON.stringify({ output, fixture_count: report.fixture_count, fixture_passes: report.fixture_passes, metrics: Object.fromEntries(Object.entries(report.metrics).map(([key, value]) => [key, value.pass])), determinism: report.determinism.pass, decision: report.decision, pass: report.pass }));
if (!report.pass) process.exitCode = 1;
