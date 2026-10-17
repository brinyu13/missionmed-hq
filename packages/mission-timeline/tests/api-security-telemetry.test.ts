import assert from "node:assert/strict";
import test from "node:test";

import { TimelineHttpApi } from "../src/api/http-api.js";
import { TimelineService } from "../src/domain/timeline-service.js";
import { InMemoryPrincipalDirectory, MatrixSessionExchange } from "../src/identity/matrix-identity.js";
import { InMemoryTimelineRepository } from "../src/persistence/repository.js";
import { InMemoryPrivateObjectStore } from "../src/storage/private-object-store.js";
import { InMemoryTelemetrySink, PrivacySafeTelemetry } from "../src/telemetry/telemetry.js";
import { fixedClock, student } from "./fixtures.js";

function request(path: string, method = "GET", token?: string, payload?: unknown): Request {
  return new Request(`https://timeline.local${path}`, {
    method,
    headers: {
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...(payload === undefined ? {} : { "content-type": "application/json" }),
      "x-request-id": "request_api_test",
    },
    body: payload === undefined ? undefined : JSON.stringify(payload),
  });
}

async function setupApi() {
  const repository = new InMemoryTimelineRepository();
  const service = new TimelineService(repository, fixedClock);
  const directory = new InMemoryPrincipalDirectory();
  directory.register({
    principalId: student.principalId,
    wpUserId: 42,
    role: "STUDENT",
    programIds: student.programIds,
    assignedDocumentIds: [],
    active: true,
  });
  const identity = new MatrixSessionExchange(directory, { verify: async () => true }, "0123456789abcdef0123456789abcdef", 600, fixedClock);
  const sink = new InMemoryTelemetrySink();
  const telemetry = new PrivacySafeTelemetry(sink, "test", fixedClock);
  const api = new TimelineHttpApi(
    service,
    identity,
    new InMemoryPrivateObjectStore("test", "0123456789abcdef0123456789abcdef", fixedClock),
    telemetry,
  );
  const matrixIdentity = { wpUserId: 42, displayName: "Student", nonceVerified: true, sessionId: "matrix_session" };
  return { api, sink, matrixIdentity };
}

test("health is public but every document route requires a Timeline session", async () => {
  const { api } = await setupApi();
  const health = await api.handle(request("/v1/health"));
  assert.equal(health.status, 200);
  assert.equal((await health.json()).productionWrites, false);
  const denied = await api.handle(request("/v1/documents"));
  assert.equal(denied.status, 401);
  assert.equal((await denied.json()).error.code, "SESSION_REQUIRED");
});

test("trusted Matrix exchange produces a short-lived token used by document API", async () => {
  const { api, matrixIdentity, sink } = await setupApi();
  const exchange = await api.handle(request("/v1/session/exchange", "POST"), matrixIdentity);
  assert.equal(exchange.status, 200);
  const { token } = await exchange.json();
  const created = await api.handle(
    request("/v1/documents", "POST", token, {
      id: "timeline_test",
      programId: "program_internal_medicine",
      title: "Mission Timeline",
      document: { events: [] },
    }),
  );
  assert.equal(created.status, 201);
  assert.equal((await created.json()).document.studentOwnerId, student.principalId);
  const listed = await api.handle(request("/v1/documents", "GET", token));
  assert.equal((await listed.json()).documents.length, 1);
  assert.ok(sink.events.some((event) => event.name === "api.request" && event.attributes.route_class === "documents"));
  assert.equal(JSON.stringify(sink.events).includes("Mission Timeline"), false);
});

test("session exchange rejects caller-supplied identity without trusted BFF context", async () => {
  const { api } = await setupApi();
  const response = await api.handle(request("/v1/session/exchange", "POST", undefined, { wpUserId: 42, nonceVerified: true }));
  assert.equal(response.status, 401);
  assert.equal((await response.json()).error.code, "TRUSTED_MATRIX_CONTEXT_REQUIRED");
});

test("telemetry rejects PII keys, URLs, tokens, and unknown event types", async () => {
  const telemetry = new PrivacySafeTelemetry(new InMemoryTelemetrySink(), "test", fixedClock);
  await assert.rejects(telemetry.emit("document.created", { email: "student@example.com" }), /TELEMETRY_ATTRIBUTE_PROHIBITED/);
  await assert.rejects(telemetry.emit("api.error", { error_code: "X", target: "https://signed.invalid/object" }), /TELEMETRY_VALUE_PROHIBITED/);
  await assert.rejects(telemetry.emit("custom.unreviewed", {}), /TELEMETRY_EVENT_NOT_ALLOWED/);
});

test("HTTP errors expose stable codes without internal stack details", async () => {
  const { api, matrixIdentity } = await setupApi();
  const exchange = await api.handle(request("/v1/session/exchange", "POST"), matrixIdentity);
  const { token } = await exchange.json();
  const missing = await api.handle(request("/v1/not-a-route", "GET", token));
  const payload = await missing.json();
  assert.equal(missing.status, 404);
  assert.equal(payload.error.code, "ROUTE_NOT_FOUND");
  assert.equal("stack" in payload.error, false);
});
