import assert from "node:assert/strict";
import test from "node:test";
import { CAPABILITY_REGISTRY, requireActiveCapability } from "../src/capabilities.mjs";

test("only manual mentor Opportunity writes are active in C0", () => {
  assert.equal(requireActiveCapability("mentor_manual_opportunity").phase, "C0");
  for (const entry of CAPABILITY_REGISTRY.filter((value) => value.capability_key !== "mentor_manual_opportunity")) {
    assert.equal(entry.activation_state, "INACTIVE");
    assert.equal(entry.accepted_writes, false);
    assert.equal(entry.implementation_ref, null);
    assert.equal(entry.provider_ref, null);
    assert.throws(() => requireActiveCapability(entry.capability_key), { code: "CAPABILITY_INACTIVE" });
  }
});
