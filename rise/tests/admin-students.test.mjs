import assert from "node:assert/strict";
import fs from "node:fs/promises";
import test from "node:test";

import { createMemoryStudentStore } from "../server.mjs";

test("student and admin views share one canonical gold-star relationship", async () => {
  const store = createMemoryStudentStore();
  await store.registerIdentity({ subject: "wp:101", displayName: "Student One", email: "one@example.test" });
  await store.put({ subject: "wp:101", programSpecialtyId: "ps-a", state: "SAVED", notes: "private", goldStarred: true });
  await store.put({ subject: "wp:101", programSpecialtyId: "ps-b", state: "APPLIED", notes: "private", goldStarred: false });
  const own = await store.list({ subject: "wp:101" });
  assert.equal(own.filter(record => record.goldStarred).length, 1);
  const index = await store.adminList({ q: "student one", goldOnly: true });
  assert.equal(index.total, 1);
  assert.equal(index.records[0].programCount, 2);
  assert.equal(index.records[0].goldStarCount, 1);
  const detail = await store.adminRead({ studentKey: "wp:101" });
  assert.equal(detail.records.length, 2);
  assert.equal(detail.records.find(record => record.programSpecialtyId === "ps-a").goldStarred, true);
});

test("5014 migration and routes are additive, RLS-bound, and admin read-only", async () => {
  const [migration, server, app] = await Promise.all([
    fs.readFile(new URL("../sql/015_admin_students_application_intelligence.sql", import.meta.url), "utf8"),
    fs.readFile(new URL("../server.mjs", import.meta.url), "utf8"),
    fs.readFile(new URL("../web/app.js", import.meta.url), "utf8"),
  ]);
  assert.match(migration, /ADD COLUMN IF NOT EXISTS gold_starred boolean NOT NULL DEFAULT false/);
  assert.match(migration, /CREATE TABLE IF NOT EXISTS rise_runtime\.student_program_subjects/);
  assert.match(migration, /FORCE ROW LEVEL SECURITY/g);
  assert.match(migration, /current_setting\('rise\.is_admin', true\) = 'true'/);
  assert.doesNotMatch(migration, /GRANT [^;]+ TO (?:anon|authenticated|PUBLIC)/i);
  assert.match(server, /GET" && url\.pathname === "\/api\/rise\/v1\/operator\/students"[\s\S]*hasCapability\(session, "rise:operator"\)/);
  assert.match(server, /operatorStudentMatch[\s\S]*request\.method === "GET"/);
  assert.doesNotMatch(server, /operator\/students[^\n]+(?:PATCH|PUT|DELETE)/);
  assert.match(app, /Student choices can only be changed by the student/);
  assert.match(app, /goldStarred: record\.goldStarred === true/);
});
