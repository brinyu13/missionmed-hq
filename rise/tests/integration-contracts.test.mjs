import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const contractsRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../contracts");

async function readJson(name) {
  return JSON.parse(await fs.readFile(path.join(contractsRoot, name), "utf8"));
}

test("cross-product integrations remain owner-gated with explicit executable contracts", async () => {
  const manifest = await readJson("integrations.v1.json");
  assert.equal(manifest.schemaVersion, 1);
  assert.equal(manifest.defaultState, "disabled");
  assert.equal(manifest.browserCredentialsAllowed, false);
  assert.deepEqual(Object.keys(manifest.targets), ["matrix", "actn", "cam", "storyforge"]);
  for (const target of Object.values(manifest.targets)) {
    assert.equal(target.requiresOwnerDecision, true);
    assert.equal(target.currentState, "owner_contract_unapproved");
    assert.ok(Number.isInteger(target.timeoutMs));
    assert.ok(Number.isInteger(target.automaticRetries));
  }
  assert.equal(manifest.targets.matrix.direction, "read_only_into_rise");
  assert.equal(manifest.targets.actn.direction, "read_only_into_rise");
  assert.equal(manifest.targets.cam.idempotency, "single_use_jti");
});

test("Matrix projection is consent-bound, purpose-limited, and unknown-preserving", async () => {
  const schema = await readJson("matrix-projection.schema.json");
  assert.equal(schema.additionalProperties, false);
  assert.equal(schema.properties.purpose.const, "rise_program_compatibility");
  assert.equal(schema.properties.dataClassification.const, "protected_applicant_profile");
  assert.ok(schema.required.includes("consentReceiptSha256"));
  const field = schema.properties.fields.items;
  assert.equal(field.additionalProperties, false);
  assert.deepEqual(field.properties.knowledge.enum, ["known", "unknown"]);
  assert.equal(field.allOf[0].else.not.required[0], "value");
});

test("ACTN and StoryForge contracts expose references without copying owned content", async () => {
  const actn = await readJson("actn-context.schema.json");
  const storyforge = await readJson("storyforge-context.schema.json");
  assert.equal(actn.additionalProperties, false);
  assert.deepEqual(actn.properties.entries.items.properties.visibility.enum, ["student_visible", "mentor_only"]);
  assert.equal(storyforge.additionalProperties, false);
  assert.ok(storyforge.required.includes("consentReceiptSha256"));
  assert.ok(storyforge.required.includes("referenceIds"));
  const serialized = JSON.stringify({ actn, storyforge }).toLowerCase();
  for (const forbidden of ["personname", "email", "phone", "storytext"]) {
    assert.equal(serialized.includes(forbidden), false);
  }
});
