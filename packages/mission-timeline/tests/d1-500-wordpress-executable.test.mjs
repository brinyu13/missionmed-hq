import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import test from "node:test";

test("WordPress canary, consent, and JWT seams execute in a bounded harness", () => {
  const result = spawnSync("php", ["tests/fixtures/wordpress-integration-harness.php"], {
    cwd: new URL("../", import.meta.url),
    encoding: "utf8",
  });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  const receipt = JSON.parse(result.stdout);
  assert.equal(receipt.pass, true);
  assert.deepEqual(receipt.checks, {
    student_canary: true,
    first_use_principal_is_valid: true,
    first_use_principal_is_stable: true,
    first_use_principal_does_not_write_meta: true,
    admin_canary: true,
    nonallowlisted_denied: true,
    consent_denied: true,
    consent_recorded: true,
    consent_withdrawn: true,
    jwt_round_trip: true,
    jwt_remote_sync_allowed: true,
    first_use_jwt_issued: true,
    first_use_jwt_is_local_only: true,
    entitlement_change_rejects_token: true,
    filevault_source_owner_bound: true,
    filevault_source_storage_opaque: true,
    filevault_source_cross_owner_denied: true,
    filevault_source_unconfirmed_denied: true,
  });
});
