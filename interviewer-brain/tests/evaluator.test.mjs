import assert from "node:assert/strict";
import test from "node:test";

import { evaluateCorpus, loadCorpus } from "../scripts/evaluation-core.mjs";
import { scoreT1, scoreT2, scoreT3, scoreT4 } from "./helpers/metrics.mjs";

test("metric negative controls cannot pass", () => {
  const generic = Array.from({ length: 10 }, () => ({ substantive: true, grounded: false, plausible: false, probeEligible: true, isProbe: false, probeDepth: 0 }));
  assert.equal(scoreT1(generic).pass, false);
  assert.equal(scoreT2(Array.from({ length: 10 }, () => ({ callbackAccurate: false, confabulated: true }))).pass, false);
  assert.equal(scoreT3([{ eligible: true, correctGap: false, probed: false, probeDepth: 3, pressureRung: 1 }]).pass, false);
  assert.equal(scoreT4([{ isContradiction: true, professional: false, correctlyQuoted: false, accused: true }, { isContradiction: false, accused: true }]).pass, false);
});

test("complete development evaluation passes every named T1-T7 gate", { timeout: 120_000 }, async () => {
  const report = await evaluateCorpus(await loadCorpus(), { label: "unit-development", deterministicRerun: true });
  assert.equal(report.fixture_count, 20);
  assert.equal(report.fixture_failures, 0, JSON.stringify(report.cases.filter((entry) => !entry.pass), null, 2));
  for (const name of ["T1", "T2", "T3", "T4", "T5", "T6", "T7"]) assert.equal(report.metrics[name].pass, true, `${name} failed`);
  assert.equal(report.determinism.pass, true);
  assert.equal(report.decision, "CONTINUE");
  assert.equal(report.pass, true);
});
