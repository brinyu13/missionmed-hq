import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const migrationUrl = new URL("../migrations/20260717090000_y1_cie_c0_foundation.sql", import.meta.url);

test("foundation migration is additive, force-RLS, and grants no authenticated direct DML", async () => {
  const sql = await readFile(migrationUrl, "utf8");
  assert.match(sql, /create schema if not exists cie/iu);
  assert.match(sql, /force row level security/iu);
  assert.match(sql, /revoke all on cie\.%I from public, anon, authenticated/iu);
  assert.doesNotMatch(sql, /drop\s+(table|schema)|truncate\s+|delete\s+from/iu);
  assert.doesNotMatch(sql, /grant\s+(insert|update|delete)\s+on/iu);
  assert.match(sql, /C0 intentionally grants no direct authenticated table DML/iu);
});
