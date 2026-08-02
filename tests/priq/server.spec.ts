import test from "node:test";
import assert from "node:assert/strict";
import { server } from "../../apps/priq-api/src/server.ts";

process.env.PRIQ_DEV_AUTH = "true";

test("local API is founder/admin only, keeps student access off, and requires founder hydration", async (t) => {
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  t.after(() => new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve())));
  const address = server.address(); if (!address || typeof address === "string") throw new Error("NO_TEST_ADDRESS");
  const base = `http://127.0.0.1:${address.port}`;
  const entry = await fetch(`${base}/auth-entry`);
  assert.equal(entry.status, 200);
  assert.match(await entry.text(), /closed to students/);
  const health = await fetch(`${base}/health`, { headers: { "x-priq-role": "founder" } });
  assert.equal(health.status, 200);
  const healthPayload = await health.json() as { status: string; provider: Record<string, unknown> };
  assert.equal(healthPayload.status, "ok");
  assert.deepEqual(healthPayload.provider, { configured: false });
  const denied = await fetch(`${base}/api/workspace`, { headers: { "x-priq-role": "student" } });
  assert.equal(denied.status, 403);
  const report = await fetch(`${base}/api/student/report`, { headers: { "x-priq-role": "student" } });
  assert.equal(report.status, 403); assert.deepEqual(await report.json(), { error: "FOUNDER_ADMIN_ONLY" });
  for (const key of ["studentWorkspaceEnabled", "studentPublicationEnabled"]) {
    const response = await fetch(`${base}/api/control/flags`, {
      method: "PATCH", headers: { "content-type": "application/json", "x-priq-role": "founder" },
      body: JSON.stringify({ key, value: true }),
    });
    assert.equal(response.status, 423); assert.deepEqual(await response.json(), { error: "STUDENT_ACCESS_LOCKED_OFF" });
  }
  const hydrationByAdmin = await fetch(`${base}/api/control/hydration`, { method: "POST", headers: { "content-type": "application/json", "x-priq-role": "admin" }, body: JSON.stringify({ state: true, reason: "test" }) });
  assert.equal(hydrationByAdmin.status, 403);
  const hydrationWithoutProvider = await fetch(`${base}/api/control/hydration`, { method: "POST", headers: { "content-type": "application/json", "x-priq-role": "founder" }, body: JSON.stringify({ state: true, reason: "test" }) });
  assert.equal(hydrationWithoutProvider.status, 503); assert.deepEqual(await hydrationWithoutProvider.json(), { error: "OPENAI_CREDENTIAL_HEALTH_ERROR" });
  const stateResponse = await fetch(`${base}/api/ui-state`, { headers: { "x-priq-role": "founder" } });
  assert.equal(stateResponse.status, 200);
  const state = await stateResponse.json() as { states: Array<{ code: string }>; provider: Record<string, unknown>; hydration: { enabled: boolean }; access: { role: string; founderAdminOnly: boolean; studentAccess: boolean }; authority: { developmentConnected: boolean; productionConnected: boolean; migrationsApplied: boolean } };
  assert.equal(state.states.length, 10);
  assert.deepEqual(new Set(state.states.map((item) => item.code)), new Set([
    "FOUNDATION_READY", "CREDENTIAL_BLOCKED", "STUDENT_INTAKE_BLOCKED", "MEDIA_BLOCKED", "RESEARCH_IN_PROGRESS",
    "FOUNDER_REVIEW_REQUIRED", "STUDENT_PUBLICATION_DISABLED", "AI_KILL_SWITCH_ACTIVE", "DEGRADED_READ_ONLY", "VERTICAL_SLICE_READY",
  ]));
  assert.deepEqual(state.authority, { persistence: "local in-memory provisional", developmentConnected: false, productionConnected: false, migrationsApplied: false });
  assert.deepEqual(state.provider, { configured: false });
  assert.deepEqual(state.access, { role: "founder", founderAdminOnly: true, studentAccess: false });
  assert.equal(state.hydration.enabled, false);

  const toggle = await fetch(`${base}/api/control/flags`, {
    method: "PATCH", headers: { "content-type": "application/json", "x-priq-role": "founder" },
    body: JSON.stringify({ key: "weightedBirdEnabled", value: false }),
  });
  assert.equal(toggle.status, 200); assert.equal((await toggle.json() as { weightedBirdEnabled: boolean }).weightedBirdEnabled, false);
  const interlock = await fetch(`${base}/api/control/flags`, {
    method: "PATCH", headers: { "content-type": "application/json", "x-priq-role": "founder" },
    body: JSON.stringify({ key: "humanReviewRequired", value: false }),
  });
  assert.equal(interlock.status, 423); assert.deepEqual(await interlock.json(), { error: "HUMAN_REVIEW_INTERLOCK" });
  const setting = await fetch(`${base}/api/control/settings`, {
    method: "PATCH", headers: { "content-type": "application/json", "x-priq-role": "founder" },
    body: JSON.stringify({ key: "monthlyBudgetUsd", value: 275 }),
  });
  assert.equal(setting.status, 200);
  const stateAfterBudget = await fetch(`${base}/api/ui-state`, { headers: { "x-priq-role": "founder" } });
  const budgetState = await stateAfterBudget.json() as { runtime: { budget: { monthlyLimitUsd: number } } };
  assert.equal(budgetState.runtime.budget.monthlyLimitUsd, 275);
  const firstCue = await fetch(`${base}/api/copilot/cues`, {
    method: "POST", headers: { "content-type": "application/json", "x-priq-role": "admin" },
    body: JSON.stringify({ transcript: "Um I would begin with the patient", now: 100_000 }),
  });
  assert.equal((await firstCue.json() as { cues: unknown[] }).cues.length, 1);
  const rateLimitedCue = await fetch(`${base}/api/copilot/cues`, {
    method: "POST", headers: { "content-type": "application/json", "x-priq-role": "admin" },
    body: JSON.stringify({ transcript: "um another answer", now: 101_000 }),
  });
  assert.equal((await rateLimitedCue.json() as { cues: unknown[] }).cues.length, 0);
  const killed = await fetch(`${base}/api/control/kill-switch`, {
    method: "POST", headers: { "content-type": "application/json", "x-priq-role": "founder" },
    body: JSON.stringify({ state: true, reason: "automated recovery validation" }),
  });
  assert.equal(killed.status, 200); assert.equal((await killed.json() as { killed: boolean }).killed, true);
  const audit = await fetch(`${base}/api/control/audit`, { headers: { "x-priq-role": "founder" } });
  const events = await audit.json() as Array<{ action: string }>;
  assert.ok(events.some((event) => event.action === "feature_flag.updated"));
  assert.ok(events.some((event) => event.action === "kill_switch.engaged"));
  await fetch(`${base}/api/control/kill-switch`, {
    method: "POST", headers: { "content-type": "application/json", "x-priq-role": "founder" },
    body: JSON.stringify({ state: false, reason: "automated recovery validation complete" }),
  });

  const page = await fetch(base); assert.equal(page.status, 200);
  const pageHtml = await page.text();
  assert.match(pageHtml, /PRIQ · MissionMed — Final Prototype/); assert.match(pageHtml, /\/priq\/bootstrap\.js/);
});
