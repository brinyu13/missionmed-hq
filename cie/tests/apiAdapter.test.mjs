import assert from "node:assert/strict";
import test from "node:test";
import { createAuthorityAdapter } from "../src/authority.mjs";
import { CieApiAdapter } from "../src/apiAdapter.mjs";
import { MemoryCieRepository } from "../src/repository/memoryRepository.mjs";
import { CieService } from "../src/service.mjs";
import { sessionClock } from "./fixtures.mjs";

const authority = createAuthorityAdapter(async (value) => value, "cie-api-test-authority");
const auth = await authority.verify({ subject_id: "student_api", role: "student", capabilities: [], authority_session_ref: "api-session" });

function headers(name) {
  return {
    "idempotency-key": `idem-${name}`,
    "x-request-id": `request-${name}`,
    "x-correlation-id": "correlation-api"
  };
}

test("host adapter requires pre-verified auth and caller-stable mutation metadata", async () => {
  const repository = new MemoryCieRepository();
  let id = 0;
  const service = new CieService(repository, { now: () => new Date("2026-07-17T12:00:00.000Z"), uuid: () => `api_id_${++id}` });
  const adapter = new CieApiAdapter(service);
  const contracts = await adapter.handle({ method: "GET", path: "/v1/cie/contracts", headers: {} });
  assert.equal(contracts.status, 200);
  assert.equal(contracts.body.data.contracts.includes("GET /v1/cie/review/:sessionId/:momentId"), true);

  const missingAuth = await adapter.handle({ method: "POST", path: "/v1/cie/sessions", headers: headers("missing-auth"), body: {} });
  assert.equal(missingAuth.status, 401);
  assert.equal(missingAuth.body.error.code, "AUTH_CONTEXT_UNVERIFIED");
  const forged = await adapter.handle({ method: "POST", path: "/v1/cie/sessions", auth: { verified: true, subject_id: "forged", role: "admin", capabilities: ["cie:review:write"] }, headers: headers("forged"), body: {} });
  assert.equal(forged.status, 401);
  assert.equal(forged.body.error.code, "AUTH_CONTEXT_UNVERIFIED");

  const missingIdempotency = await adapter.handle({ method: "POST", path: "/v1/cie/sessions", auth, headers: { "x-request-id": "request-only" }, body: {} });
  assert.equal(missingIdempotency.status, 400);
  assert.equal(missingIdempotency.body.error.code, "IDEMPOTENCY_KEY_REQUIRED");

  const created = await adapter.handle({
    method: "POST",
    path: "/v1/cie/sessions",
    auth,
    headers: headers("create"),
    body: { external_session_ref: "cam-api-session", mode_ref: "M1", media_revision_ref: "media_revision_1", clock: sessionClock }
  });
  assert.equal(created.status, 201);
  assert.equal(created.body.data.owner_user_id, auth.subject_id);
  assert.equal(created.body.request_id, "request-create");
  assert.equal(repository.getSession(created.body.data.id).state, "DRAFT");

  const wrongPrefix = await adapter.handle({ method: "GET", path: `/not-cie/sessions/${created.body.data.id}/timeline`, auth, headers: {} });
  assert.equal(wrongPrefix.status, 404);
  assert.equal(wrongPrefix.body.error.code, "ROUTE_NOT_FOUND");
});

test("host adapter redacts unexpected exceptions", async () => {
  const adapter = new CieApiAdapter({ listTimeline() { throw new Error("database password secret-value"); } });
  const result = await adapter.handle({ method: "GET", path: "/v1/cie/sessions/session_1/timeline", auth, headers: {} });
  assert.equal(result.status, 500);
  assert.equal(result.body.error.code, "INTERNAL_ERROR");
  assert.equal(JSON.stringify(result.body).includes("secret-value"), false);
});
