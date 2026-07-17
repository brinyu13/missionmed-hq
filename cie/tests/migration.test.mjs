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

test("runtime integrity migration closes ownership, revision, grant, future, and deletion boundaries", async () => {
  const sql = await readFile(new URL("../migrations/20260717091000_y1_cie_c0_runtime_integrity.sql", import.meta.url), "utf8");
  for (const required of [
    "cie_track_event_seq_unique",
    "cie_track_session_owner_fk",
    "cie_opportunity_source_moment_fk",
    "cie_visibility_one_live_grant_idx",
    "cie.reject_immutable_change_v1",
    "cie.enforce_track_revision_identity_v1",
    "cie.enforce_visibility_revoke_only_v1",
    "create table cie.capability_registry",
    "create table cie.deletion_jobs",
    "create table cie.deletion_steps",
    "force row level security",
    "revoke all on all tables in schema cie from public, anon, authenticated",
    "revoke all on all functions in schema cie from public, anon, authenticated"
  ]) assert.match(sql, new RegExp(required.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&"), "u"));
  for (const inactive of ["transcript_generation", "storyforge_linkage", "polar_ingestion", "mode_pack_registry", "wordpress_skill_sync", "ai_opportunity_source", "voice_persona_provider"]) {
    assert.match(sql, new RegExp(`'${inactive}'.*'INACTIVE',false`, "u"));
  }
  assert.doesNotMatch(sql, /grant\s+(?:insert|update|delete|all).*\bauthenticated\b/iu);
  assert.doesNotMatch(sql, /drop\s+(?:table|schema)|truncate\s+|delete\s+from\s+/iu);
});
