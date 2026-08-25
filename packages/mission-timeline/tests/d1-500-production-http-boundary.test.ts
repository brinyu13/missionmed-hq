import assert from "node:assert/strict";
import { createServer, type Server } from "node:http";
import test from "node:test";

import { createTimelineProductionHttpHandler } from "../src/server/production-http-handler.js";

const gatewaySecret = "timeline-gateway-secret-32-bytes-minimum";
const schemaVersion = "d1-timeline-db-500.1";

async function listen(server: Server): Promise<string> {
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("TEST_SERVER_ADDRESS_MISSING");
  return `http://127.0.0.1:${address.port}`;
}

function api(calls: Request[]) {
  return {
    async handle(request: Request): Promise<Response> {
      calls.push(request);
      const authorization = request.headers.get("authorization") ?? "";
      if (!authorization.startsWith("Bearer ")) {
        return Response.json({ error: { code: "SESSION_REQUIRED", message: "Timeline session is required." } }, { status: 401 });
      }
      if (authorization !== "Bearer valid-token") {
        return Response.json({ error: { code: "TOKEN_INVALID", message: "Timeline session token is invalid." } }, { status: 401 });
      }
      return Response.json({ documents: [] }, { status: 200 });
    },
  };
}

test("production HTTP boundary denies direct access and strips WordPress cookies", async (t) => {
  const calls: Request[] = [];
  const logs: Record<string, unknown>[] = [];
  const server = createServer(createTimelineProductionHttpHandler({
    api: api(calls), gatewaySecret, releaseVersion: "timeline-test-release",
    expectedSchemaVersion: schemaVersion, health: async () => ({ schemaVersion }),
    log: (event) => logs.push(event),
  }));
  t.after(() => server.close());
  const origin = await listen(server);

  const unknown = await fetch(`${origin}/unknown`);
  assert.equal(unknown.status, 404);
  assert.equal(unknown.headers.get("cache-control"), "no-store");

  const direct = await fetch(`${origin}/v1/documents`, { headers: { authorization: "Bearer valid-token" } });
  assert.equal(direct.status, 403);
  assert.equal((await direct.json()).error.code, "GATEWAY_REQUIRED");

  const wrongGateway = await fetch(`${origin}/v1/documents`, { headers: {
    authorization: "Bearer valid-token", "x-missionmed-timeline-gateway-secret": "wrong",
  } });
  assert.equal(wrongGateway.status, 403);

  const noSession = await fetch(`${origin}/v1/documents`, { headers: {
    "x-missionmed-timeline-gateway-secret": gatewaySecret,
  } });
  assert.equal(noSession.status, 401);

  const invalidSession = await fetch(`${origin}/v1/documents`, { headers: {
    authorization: "Bearer malformed-token", "x-missionmed-timeline-gateway-secret": gatewaySecret,
  } });
  assert.equal(invalidSession.status, 401);

  const accepted = await fetch(`${origin}/v1/documents`, { headers: {
    authorization: "Bearer valid-token", cookie: "wordpress_logged_in=must-not-forward",
    "x-missionmed-timeline-gateway-secret": gatewaySecret, "x-request-id": "d1-500-boundary-test",
  } });
  assert.equal(accepted.status, 200);
  assert.equal(accepted.headers.get("x-request-id"), "d1-500-boundary-test");
  assert.equal(accepted.headers.get("cache-control"), "no-store");
  assert.equal(calls.at(-1)?.headers.has("cookie"), false);
  assert.equal(calls.at(-1)?.headers.has("x-missionmed-timeline-gateway-secret"), false);
  assert.equal(calls.at(-1)?.headers.get("x-request-id"), "d1-500-boundary-test");

  const oversized = await fetch(`${origin}/v1/documents`, {
    method: "POST",
    headers: { authorization: "Bearer valid-token", "x-missionmed-timeline-gateway-secret": gatewaySecret, "content-type": "application/json" },
    body: "x".repeat(2 * 1024 * 1024 + 1),
  });
  assert.equal(oversized.status, 413);
  assert.equal((await oversized.json()).error.code, "REQUEST_TOO_LARGE");

  const fileVaultBytes = new Uint8Array(2 * 1024 * 1024 + 1);
  const acceptedFileVaultIngest = await fetch(`${origin}/v1/documents/timeline_filevault_boundary/file-vault/ingestions`, {
    method: "POST",
    headers: {
      authorization: "Bearer valid-token",
      "x-missionmed-timeline-gateway-secret": gatewaySecret,
      "content-type": "application/pdf",
      "x-content-sha256": "a".repeat(64),
      "x-file-vault-id": "27",
      "x-file-vault-version": "22222222-2222-4222-8222-222222222222",
    },
    body: fileVaultBytes,
  });
  assert.equal(acceptedFileVaultIngest.status, 200);
  assert.equal(await calls.at(-1)?.arrayBuffer().then((value) => value.byteLength), fileVaultBytes.byteLength);

  const oversizedFileVaultIngest = await fetch(`${origin}/v1/documents/timeline_filevault_boundary/file-vault/ingestions`, {
    method: "POST",
    headers: {
      authorization: "Bearer valid-token",
      "x-missionmed-timeline-gateway-secret": gatewaySecret,
      "content-type": "application/pdf",
      "x-content-sha256": "a".repeat(64),
      "x-file-vault-id": "27",
      "x-file-vault-version": "22222222-2222-4222-8222-222222222222",
    },
    body: new Uint8Array(20 * 1024 * 1024 + 1),
  });
  assert.equal(oversizedFileVaultIngest.status, 413);
  assert.equal((await oversizedFileVaultIngest.json()).error.code, "REQUEST_TOO_LARGE");

  const fallbackBytes = new Uint8Array(2 * 1024 * 1024 + 1);
  const acceptedMediaFallback = await fetch(`${origin}/v1/objects/upload`, {
    method: "POST",
    headers: {
      authorization: "Bearer valid-token",
      "x-missionmed-timeline-gateway-secret": gatewaySecret,
      "content-type": "image/png",
      "x-timeline-document-id": "timeline_media_test",
      "x-timeline-object-class": "MEDIA",
      "x-content-sha256": "a".repeat(64),
    },
    body: fallbackBytes,
  });
  assert.equal(acceptedMediaFallback.status, 200);
  assert.equal(await calls.at(-1)?.arrayBuffer().then((value) => value.byteLength), fallbackBytes.byteLength);

  const oversizedMediaFallback = await fetch(`${origin}/v1/objects/upload`, {
    method: "POST",
    headers: {
      authorization: "Bearer valid-token",
      "x-missionmed-timeline-gateway-secret": gatewaySecret,
      "content-type": "image/png",
    },
    body: new Uint8Array(15 * 1024 * 1024 + 1),
  });
  assert.equal(oversizedMediaFallback.status, 413);
  assert.equal((await oversizedMediaFallback.json()).error.code, "REQUEST_TOO_LARGE");

  const serializedLogs = JSON.stringify(logs);
  assert.equal(serializedLogs.includes(gatewaySecret), false);
  assert.equal(serializedLogs.includes("valid-token"), false);
  assert.equal(logs.some((event) => event.event === "timeline.gateway.denied"), true);
});

test("dependency-aware health fails closed and recovers", async (t) => {
  let mode: "healthy" | "failed" | "wrong" = "healthy";
  const logs: Record<string, unknown>[] = [];
  const server = createServer(createTimelineProductionHttpHandler({
    api: api([]), gatewaySecret, releaseVersion: "timeline-test-release",
    expectedSchemaVersion: schemaVersion,
    health: async () => {
      if (mode === "failed") throw new Error("connection details must not escape");
      return { schemaVersion: mode === "wrong" ? "wrong-schema" : schemaVersion };
    },
    log: (event) => logs.push(event),
  }));
  t.after(() => server.close());
  const origin = await listen(server);

  const healthy = await fetch(`${origin}/healthz`, { headers: { "x-request-id": "health-ready" } });
  assert.equal(healthy.status, 200);
  assert.deepEqual(await healthy.json(), { ok: true, service: "mission-timeline", version: "timeline-test-release", schemaVersion });

  mode = "failed";
  const failed = await fetch(`${origin}/healthz`);
  assert.equal(failed.status, 503);
  const failedBody = await failed.text();
  assert.equal(failedBody.includes("connection details"), false);
  assert.equal(JSON.parse(failedBody).dependency, "DATABASE_UNAVAILABLE");

  mode = "wrong";
  const wrong = await fetch(`${origin}/healthz`);
  assert.equal(wrong.status, 503);
  assert.equal((await wrong.json()).dependency, "SCHEMA_VERSION_MISMATCH");

  mode = "healthy";
  assert.equal((await fetch(`${origin}/healthz`)).status, 200);
  assert.equal(logs.some((event) => event.request_id === "health-ready" && event.dependency_code === "READY"), true);
});

test("dependency-aware health times out without leaking an internal error", async (t) => {
  let dependencyCalls = 0;
  const server = createServer(createTimelineProductionHttpHandler({
    api: api([]), gatewaySecret, releaseVersion: "timeline-test-release",
    expectedSchemaVersion: schemaVersion, healthTimeoutMs: 100,
    health: async () => {
      dependencyCalls += 1;
      return new Promise(() => {});
    },
  }));
  t.after(() => server.close());
  const origin = await listen(server);
  const responses = await Promise.all(Array.from({ length: 5 }, () => fetch(`${origin}/healthz`)));
  for (const response of responses) {
    assert.equal(response.status, 503);
    assert.equal((await response.json()).dependency, "DATABASE_TIMEOUT");
  }
  assert.equal(dependencyCalls, 1);
});
