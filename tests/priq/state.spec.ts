import test from "node:test";
import assert from "node:assert/strict";
import { lockedDefaults } from "../../apps/priq-api/src/features.ts";
import { deriveUiStates } from "../../apps/priq-api/src/state.ts";

test("all ten recovery states are deterministic and ready remains fail closed", () => {
  const blocked = deriveUiStates({
    flags: lockedDefaults, credentialConfigured: false, restrictedProviderApproved: false,
    authorizedPrivatePacket: false, audiovisualSource: false, researchInProgress: false, founderApproved: false,
  });
  assert.equal(blocked.length, 10);
  assert.equal(blocked.find((state) => state.code === "VERTICAL_SLICE_READY")?.active, false);
  assert.equal(blocked.find((state) => state.code === "CREDENTIAL_BLOCKED")?.active, true);

  const enabled = { ...lockedDefaults, studentPublicationEnabled: true, hydrationEnabled: true };
  const ready = deriveUiStates({
    flags: enabled, credentialConfigured: true, restrictedProviderApproved: true,
    authorizedPrivatePacket: true, audiovisualSource: true, researchInProgress: false, founderApproved: true,
  });
  assert.equal(ready.find((state) => state.code === "VERTICAL_SLICE_READY")?.active, true);
  assert.equal(ready.find((state) => state.code === "DEGRADED_READ_ONLY")?.active, false);
});
