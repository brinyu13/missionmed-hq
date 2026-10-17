import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFile } from "node:fs/promises";

const require = createRequire(import.meta.url);
const signals = require("../src/dual-mode/signal-allocation.js");
const config = JSON.parse(await readFile(new URL("../config/eras-signal-rules.2027.v1.json", import.meta.url)));
const tieredFact = config.rule_facts.find((fact) => fact.signal_system === "tiered");
const singleFact = config.rule_facts.find((fact) => fact.signal_system === "single" && fact.rise_designations.length);

function programsFor(fact, count) {
  return Array.from({ length: count }, (_, index) => ({ id: `p${index}`, specialty: fact.aamc_label }));
}

test("tier limit is enforced exactly and assignment is immutable", () => {
  const programs = programsFor(tieredFact, tieredFact.gold_limit + 1);
  let application = { decisions: {}, signals: {} };
  for (let index = 0; index < tieredFact.gold_limit; index += 1) {
    const previous = application;
    application = signals.assign(config, application, programs, programs[index].id, "gold");
    assert.notEqual(application, previous);
  }
  const check = signals.canAssign(config, application, programs, programs.at(-1).id, "gold");
  assert.deepEqual(check, { ok: false, reason: "LIMIT_REACHED", used: tieredFact.gold_limit, limit: tieredFact.gold_limit });
});

test("one tier per program and clear only changes the target", () => {
  const programs = programsFor(tieredFact, 2);
  let application = { decisions: {}, signals: {} };
  application = signals.assign(config, application, programs, programs[0].id, "gold");
  application = signals.assign(config, application, programs, programs[0].id, "silver");
  assert.deepEqual(application.signals, { [programs[0].id]: "silver" });
  const cleared = signals.clear(application, programs[0].id);
  assert.deepEqual(cleared.signals, {});
  assert.equal(application.signals[programs[0].id], "silver");
});

test("single-tier, unresolved, skip, and unverified paths are explicit", () => {
  const programs = [{ id: "single", specialty: singleFact.aamc_label }, { id: "unknown", specialty: "Unknown Specialty" }];
  assert.equal(signals.canAssign(config, { decisions: {}, signals: {} }, programs, "single", "gold").reason, "TIER_NOT_OFFERED");
  assert.equal(signals.canAssign(config, { decisions: {}, signals: {} }, programs, "unknown", "single").reason, "UNRESOLVED_RULE");
  assert.equal(signals.canAssign(config, { decisions: { single: "skip" }, signals: {} }, programs, "single", "single").reason, "DECISION_SKIP");
  const unverified = structuredClone(config);
  unverified.verification.status = "unverified";
  assert.equal(signals.canAssign(unverified, { decisions: {}, signals: {} }, programs, "single", "single").reason, "RULES_UNVERIFIED");
});

test("validate reports an overage after a limit drops", () => {
  const programs = programsFor(singleFact, singleFact.single_limit);
  const application = { decisions: {}, signals: Object.fromEntries(programs.map((program) => [program.id, "single"])) };
  const reduced = structuredClone(config);
  reduced.rule_facts.find((fact) => fact.key === singleFact.key).single_limit -= 1;
  assert.deepEqual(signals.validate(reduced, application, programs), [{
    key: singleFact.key,
    tier: "single",
    used: singleFact.single_limit,
    limit: singleFact.single_limit - 1,
    overBy: 1
  }]);
});

