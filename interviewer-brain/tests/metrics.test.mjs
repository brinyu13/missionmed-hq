import assert from "node:assert/strict";
import test from "node:test";
import {
  probeCapForRung,
  scoreInstructorReview,
  scoreRecovery,
  scoreT1,
  scoreT2,
  scoreT3,
  scoreT4,
  trigramSimilarity,
} from "./helpers/metrics.mjs";
import { scanText } from "./helpers/scanners.mjs";

test("template similarity normalizes evidence without collapsing distinct targets", () => {
  const same = trigramSimilarity("What happened after the checklist trial?", "What happened after the checklist trial?");
  const distinct = trigramSimilarity("What happened after the checklist trial?", "How did the calibration set change the coding rules?");
  assert.equal(same, 1);
  assert.ok(distinct < 0.7);
});

test("probe caps use the stricter IVOC one/two law", () => {
  assert.equal(probeCapForRung(0), 1);
  assert.equal(probeCapForRung(1), 1);
  assert.equal(probeCapForRung(2), 2);
  assert.equal(probeCapForRung(4), 2);
});

test("T1 scorer enforces every central threshold", () => {
  const records = Array.from({ length: 10 }, (_, index) => ({
    substantive: true,
    grounded: index < 9,
    plausible: index < 8,
    probeEligible: true,
    isProbe: index < 6,
    probeDepth: index % 2 ? 1 : 2,
  }));
  const result = scoreT1(records);
  assert.equal(result.grounded_rate, 0.9);
  assert.equal(result.plausible_rate, 0.8);
  assert.equal(result.probe_rate, 0.6);
  assert.equal(result.mean_probe_chain_depth, 1.5);
  assert.equal(result.pass, true);
});

test("T2-T4 scorers preserve zero-tolerance and cap rules", () => {
  assert.equal(scoreT2(Array.from({ length: 10 }, (_, index) => ({ callbackAccurate: index < 8, confabulated: false }))).pass, true);
  assert.equal(scoreT3([{ eligible: true, correctGap: true, probed: true, probeDepth: 2, pressureRung: 2 }]).pass, true);
  assert.equal(scoreT4([
    { isContradiction: true, professional: true, correctlyQuoted: true },
    { isContradiction: false, accused: false },
  ]).pass, true);
});

test("recovery and instructor review require complete success", () => {
  assert.equal(scoreRecovery([{ expectedState: "REPHRASE", actualState: "REPHRASE" }]).pass, true);
  assert.equal(scoreInstructorReview([{ correct: true, durationSeconds: 179 }]).pass, true);
  assert.equal(scoreInstructorReview([{ correct: true, durationSeconds: 181 }]).pass, false);
});

test("scanners reject forbidden inference and private reasoning", () => {
  assert.equal(scanText("The evidence reference is turn-2 and the guard passed.").pass, true);
  assert.equal(scanText("Here is my chain-of-thought and Match probability.").pass, false);
  assert.equal(scanText("The applicant was evasive.").pass, false);
});
