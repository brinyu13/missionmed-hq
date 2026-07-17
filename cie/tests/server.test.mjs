import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { createLocalCieServer } from "../src/server.mjs";
import { sessionClock } from "./fixtures.mjs";
import { TEST_SUBJECTS, testUuid } from "./testIds.mjs";

test("local API is loopback-bound, explicitly local, and durably persists C0 state", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "cie-local-api-"));
  const statePath = path.join(directory, "state.json");
  const witnessPath = path.join(directory, "witness", "state.jsonl");
  let running;
  try {
    let id = 0;
    running = await createLocalCieServer({
      runtimeMode: "local",
      statePath,
      witnessPath,
      serviceOptions: { now: () => new Date("2026-07-17T12:00:00.000Z"), uuid: () => testUuid(++id) }
    });
    await new Promise((resolve) => running.server.listen(0, "127.0.0.1", resolve));
    const address = running.server.address();
    const base = `http://127.0.0.1:${address.port}`;
    const health = await fetch(`${base}/health`);
    assert.equal(health.status, 200);
    assert.deepEqual(await health.json(), { ok: true, service: "missionmed-cie-c0", runtime_mode: "local", production_ready: false });

    const review = await fetch(`${base}/review/session_safe/moment_safe`);
    assert.equal(review.status, 200);
    assert.match(review.headers.get("content-type"), /^text\/html/u);
    assert.match(review.headers.get("content-security-policy"), /script-src 'self'/u);
    assert.match(review.headers.get("content-security-policy"), /frame-ancestors 'none'/u);
    assert.equal(review.headers.get("x-robots-tag"), "noindex, nofollow, noarchive");
    assert.match(await review.text(), /<main id="main-content">/u);

    const css = await fetch(`${base}/cie/review.css`);
    assert.equal(css.status, 200);
    assert.match(css.headers.get("content-type"), /^text\/css/u);
    assert.match(await css.text(), /prefers-reduced-motion/u);

    const script = await fetch(`${base}/cie/review.js`);
    assert.equal(script.status, 200);
    assert.match(script.headers.get("content-type"), /^text\/javascript/u);
    assert.match(await script.text(), /RESOURCE_UNAVAILABLE|unavailable/u);

    const denied = await fetch(`${base}/v1/cie/review/session_safe/moment_safe`);
    assert.equal(denied.status, 401);
    assert.deepEqual((await denied.json()).error, { code: "AUTH_CONTEXT_UNVERIFIED", message: "An opaque MissionMed principal is required" });

    const unsafeReview = await fetch(`${base}/review/session%20unsafe/moment_safe`);
    assert.notEqual(unsafeReview.headers.get("content-type"), "text/html; charset=utf-8");

    const createdResponse = await fetch(`${base}/v1/cie/sessions`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-cie-local-subject": TEST_SUBJECTS.httpStudent,
        "x-cie-local-role": "student",
        "idempotency-key": "http-session-create",
        "x-request-id": "http-request-create"
      },
      body: JSON.stringify({ external_session_ref: "cam-http-session", mode_ref: "M1", media_revision_ref: "media_revision_1", clock: sessionClock })
    });
    assert.equal(createdResponse.status, 201);
    assert.match(createdResponse.headers.get("content-security-policy"), /default-src 'none'/u);
    const created = await createdResponse.json();
    assert.equal(created.ok, true);
    await new Promise((resolve, reject) => running.server.close((error) => error ? reject(error) : resolve()));
    running = null;

    const reopened = await createLocalCieServer({ runtimeMode: "local", statePath, witnessPath });
    assert.equal(reopened.repository.getSession(created.data.id).external_session_ref, "cam-http-session");
    await new Promise((resolve) => reopened.server.close(resolve));
  } finally {
    if (running) await new Promise((resolve) => running.server.close(resolve));
    await rm(directory, { recursive: true, force: true });
  }
});

test("local server refuses non-local runtime activation", async () => {
  await assert.rejects(createLocalCieServer({ runtimeMode: "production", statePath: "/tmp/never-written-cie.json" }), /refuses to start/u);
  await assert.rejects(createLocalCieServer({ runtimeMode: "local", host: "0.0.0.0", statePath: "/tmp/never-written-cie.json" }), /loopback host/u);
});
