import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFile } from "node:fs/promises";

const require = createRequire(import.meta.url);
const rules = require("../src/dual-mode/signal-rules.js");
const config = JSON.parse(await readFile(new URL("../config/eras-signal-rules.2027.v1.json", import.meta.url)));

test("all official rows resolve by exact AAMC label", () => {
  assert.equal(config.rule_facts.length, 29);
  for (const fact of config.rule_facts) {
    const resolved = rules.resolveRule(config, fact.aamc_label);
    assert.equal(resolved.key, fact.key);
    assert.equal(resolved.status, fact.signal_system);
    assert.ok(["aamc_label", "rise_designation"].includes(resolved.source));
  }
});

test("every approved RISE designation resolves without fuzzy matching", () => {
  for (const fact of config.rule_facts) {
    for (const designation of fact.rise_designations) {
      const resolved = rules.resolveRule(config, designation);
      assert.equal(resolved.key, fact.key);
      assert.equal(resolved.source, "rise_designation");
    }
  }
  assert.equal(rules.resolveRule(config, "Emergency Medicine").status, "unresolved");
});

test("unverified config retains facts but disables allocation", () => {
  const unverified = structuredClone(config);
  unverified.verification.status = "unverified";
  const resolved = rules.resolveRule(unverified, config.rule_facts[0].aamc_label);
  assert.equal(resolved.verified, false);
});
