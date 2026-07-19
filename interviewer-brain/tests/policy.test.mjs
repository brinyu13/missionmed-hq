import assert from "node:assert/strict";
import test from "node:test";

import { buildInstructorReview } from "../src/index.mjs";
import { scanJson, scanText } from "./helpers/scanners.mjs";
import { cleanupRun, readDevelopmentFixtures, runFixture } from "./helpers/harness.mjs";

async function runById(id) {
  const corpus = await readDevelopmentFixtures();
  const fixture = corpus.cases.find((entry) => entry.id === id);
  assert.ok(fixture, `Missing fixture ${id}`);
  return runFixture(fixture, { keepDirectory: true });
}

test("answer-specific adaptivity distinguishes a short answer from a detailed rambler", async () => {
  const short = await runById("ADAPT-SHORT-001");
  const detailed = await runById("ADAPT-RAMBLER-001");
  try {
    assert.ok(["clarification", "context"].includes(short.decisions[0].move));
    assert.ok(["focus", "outcome"].includes(detailed.decisions[0].move));
    assert.notEqual(short.decisions[0].policy_rule, detailed.decisions[0].policy_rule);
  } finally {
    await cleanupRun(short);
    await cleanupRun(detailed);
  }
});

test("counterfactual answers produce materially different next targets", async () => {
  const clinic = await runById("CF-TEAM-CLINIC-001");
  const research = await runById("CF-TEAM-RESEARCH-002");
  try {
    const left = clinic.decisions[0];
    const right = research.decisions[0];
    assert.ok(left.move !== right.move || left.policy_rule !== right.policy_rule || left.utterance !== right.utterance);
  } finally {
    await cleanupRun(clinic);
    await cleanupRun(research);
  }
});

test("STAR result gap is probed and a complete STAR answer is not over-probed", async () => {
  const missing = await runById("STAR-MISSING-RESULT-001");
  const complete = await runById("STAR-COMPLETE-NEGATIVE-001");
  try {
    assert.equal(missing.decisions[0].move, "outcome");
    assert.notEqual(complete.decisions[0].move, "star_gap");
    assert.ok(["transition", "reflection"].includes(complete.decisions[0].move));
  } finally {
    await cleanupRun(missing);
    await cleanupRun(complete);
  }
});

test("possible contradictions quote both claims neutrally and consistent facts are not accused", async () => {
  const changed = await runById("CON-DATE-001");
  const consistent = await runById("CON-CONSISTENT-NEGATIVE-001");
  try {
    const decision = changed.decisions.at(-1);
    assert.equal(decision.move, "inconsistency");
    assert.match(decision.utterance, /2022/);
    assert.match(decision.utterance, /2023/);
    assert.doesNotMatch(decision.utterance, /lying|evasive|deceptive|dishonest/i);
    assert.notEqual(consistent.decisions.at(-1).move, "inconsistency");
  } finally {
    await cleanupRun(changed);
    await cleanupRun(consistent);
  }
});

test("injection, sensitive-boundary, Match, and silence fixtures fail closed", async () => {
  const ids = ["INJ-SYSTEM-001", "INJ-ENCODED-002", "SENSITIVE-FAMILY-001", "MATCH-PREDICTION-001", "REC-SILENCE-001"];
  const runs = [];
  try {
    for (const id of ids) runs.push(await runById(id));
    assert.ok(runs.slice(0, 2).every((run) => run.decisions[0].move === "injection_defense"));
    assert.equal(runs[2].decisions[0].move, "policy_refusal");
    assert.equal(runs[3].decisions[0].move, "policy_refusal");
    assert.equal(runs[4].decisions[0].move, "silence_recovery");
    assert.equal(scanJson(runs.map((run) => run.decisions)).pass, true);
  } finally {
    for (const run of runs) await cleanupRun(run);
  }
});

test("probe caps are enforced at one and two probes", async () => {
  const rung0 = await runById("CAP-RUNG0-001");
  const rung2 = await runById("CAP-RUNG2-002");
  try {
    assert.equal(Math.max(...rung0.decisions.map((decision) => decision.probe_index)), 1);
    assert.ok(["transition", "wrap_up"].includes(rung0.decisions.at(-1).move));
    assert.equal(Math.max(...rung2.decisions.map((decision) => decision.probe_index)), 2);
    assert.ok(["transition", "wrap_up"].includes(rung2.decisions.at(-1).move));
  } finally {
    await cleanupRun(rung0);
    await cleanupRun(rung2);
  }
});

test("long-session callback survives restart and uses earlier evidence without confabulation", async () => {
  const run = await runById("MEM-RECONNECT-001");
  try {
    const callback = run.decisions.findLast((decision) => decision.move === "callback");
    assert.ok(callback);
    assert.match(callback.utterance, /night-shift interpreter line|backup video interpreter/i);
    assert.equal(run.session.revisions.at(-1).reconnect_epoch, 1);
  } finally {
    await cleanupRun(run);
  }
});

test("instructor report identifies what happened and why without private reasoning", async () => {
  const run = await runById("CON-DATE-001");
  try {
    const started = performance.now();
    const report = buildInstructorReview(run.session);
    const elapsedSeconds = (performance.now() - started) / 1000;
    assert.equal(report.turns.length, 2);
    assert.ok(report.turns.every((turn) => turn.answer && turn.move && turn.policy_rule && turn.rationale_tags.length > 0));
    assert.ok(report.turns.at(-1).evidence.length >= 2);
    assert.equal(report.contains_private_chain_of_thought, false);
    assert.equal(scanText(JSON.stringify(report)).private_reasoning.length, 0);
    assert.ok(elapsedSeconds < 180);
  } finally {
    await cleanupRun(run);
  }
});
