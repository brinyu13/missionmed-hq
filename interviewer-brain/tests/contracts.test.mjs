import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import test from "node:test";

import {
  InactiveAvatarAdapter,
  InactiveVoiceRailAdapter,
  RuleModelAdapter,
  VERSIONS,
  loadPersona,
  loadPlan,
  sealContent,
  validateInterviewPlan,
  validatePersonaPack,
} from "../src/index.mjs";

test("versioned synthetic personas and interview plan validate with canonical hashes", async () => {
  const warm = await loadPersona(new URL("../personas/warm-structured.v1.json", import.meta.url));
  const direct = await loadPersona(new URL("../personas/direct-program-director.v1.json", import.meta.url));
  const plan = await loadPlan(new URL("../plans/core-img-interview.v1.json", import.meta.url));

  assert.equal(warm.contract_version, VERSIONS.persona);
  assert.equal(direct.contract_version, VERSIONS.persona);
  assert.notEqual(warm.persona_id, direct.persona_id);
  assert.notEqual(warm.pressure_rung, direct.pressure_rung);
  assert.equal(plan.persona_ref.content_hash, warm.content_hash);
  assert.equal(plan.synthetic_only, true);
});

test("runtime validators reject unsupported persona and prohibited plan language", async () => {
  const warm = await loadPersona(new URL("../personas/warm-structured.v1.json", import.meta.url));
  const plan = await loadPlan(new URL("../plans/core-img-interview.v1.json", import.meta.url));

  assert.throws(
    () => validatePersonaPack(sealContent({ ...warm, voice_reference: "provider:voice" })),
    (error) => error.code === "PERSONA_VOICE_MUST_BE_NULL",
  );
  const questions = plan.questions.map((question, index) => index === 0
    ? { ...question, prompt: "What is your Match probability?" }
    : question);
  assert.throws(
    () => validateInterviewPlan(sealContent({ ...plan, questions })),
    (error) => error.code === "UNSUPPORTED_INFERENCE_LANGUAGE",
  );
});

test("model boundary is provider-neutral and voice/avatar boundaries fail closed", async () => {
  const model = new RuleModelAdapter();
  assert.equal(model.descriptor.network_access, false);
  assert.equal(model.descriptor.provider, null);
  assert.equal(model.descriptor.raw_output_persisted, false);

  for (const adapter of [new InactiveVoiceRailAdapter(), new InactiveAvatarAdapter()]) {
    assert.equal(adapter.descriptor.activation_state, "INACTIVE");
    assert.equal(adapter.descriptor.provider, null);
    await assert.rejects(() => adapter.invoke({}), (error) => error.code === "CAPABILITY_INACTIVE");
    await assert.rejects(() => adapter.write({}), (error) => ["CAPABILITY_INACTIVE", "CAPABILITY_WRITE_FORBIDDEN", "CAPABILITY_WRITES_DISABLED"].includes(error.code));
  }
});

test("all checked-in JSON schemas are parseable and prohibit additional properties", async () => {
  const directory = new URL("../schemas/", import.meta.url);
  const names = (await readdir(directory)).filter((name) => name.endsWith(".json")).sort();
  assert.equal(names.length, 8);
  for (const name of names) {
    const schema = JSON.parse(await readFile(new URL(name, directory), "utf8"));
    assert.equal(schema.$schema, "https://json-schema.org/draft/2020-12/schema");
    assert.equal(schema.type, "object");
    assert.equal(schema.additionalProperties, false);
    assert.ok(Array.isArray(schema.required) && schema.required.length > 0);
    assert.ok(schema.properties && typeof schema.properties === "object");
    for (const required of schema.required) assert.ok(required in schema.properties, `${name} is missing a required property schema for ${required}`);
  }
});
