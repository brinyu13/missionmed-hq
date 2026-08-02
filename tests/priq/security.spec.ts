import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { AuditLedger, opaqueIdentifier } from "../../packages/mir-telemetry/src/index.ts";

test("audit ledger is tenant-scoped and stores metadata without source bytes", () => {
  const ledger = new AuditLedger();
  ledger.record({ tenantId: "t1", actorId: "u1", action: "feature_flag.updated", targetType: "flag", targetId: "copilot", metadata: { enabled: false } });
  ledger.record({ tenantId: "t2", actorId: "u2", action: "source.viewed", targetType: "source", targetId: opaqueIdentifier("private/path"), metadata: {} });
  assert.equal(ledger.list("t1").length, 1);
  assert.equal(ledger.list("t1")[0].metadata.enabled, false);
  assert.match(opaqueIdentifier("private/path"), /^[a-f0-9]{64}$/);
});

test("isolated migration enables RLS, avoids open policies, and makes audit append-only", async () => {
  const sql = await readFile(resolve("infra/priq/migrations/20260802095500_priq_foundation.sql"), "utf8");
  assert.match(sql, /ENABLE ROW LEVEL SECURITY/g);
  assert.doesNotMatch(sql, /USING\s*\(\s*true\s*\)/i);
  assert.match(sql, /REVOKE UPDATE, DELETE ON priq\.audit_events/);
  assert.match(sql, /^BEGIN;[\s\S]*COMMIT;\s*$/);
});
