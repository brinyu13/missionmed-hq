import { CAPABILITY_REGISTRY } from "./capabilities.mjs";
import { isVerifiedPrincipal } from "./authority.mjs";
import { CieError, invariant } from "./errors.mjs";

const API_CONTRACTS = Object.freeze([
  "POST /v1/cie/sessions",
  "POST /v1/cie/sessions/:id/consents",
  "POST /v1/cie/skill-snapshots",
  "PUT /v1/cie/sessions/:id/priorities",
  "POST /v1/cie/sessions/:id/track-items",
  "POST /v1/cie/sessions/:id/moments",
  "POST /v1/cie/sessions/:id/opportunities",
  "POST /v1/cie/sessions/:id/grants",
  "DELETE /v1/cie/sessions/:id/grants/:grantId",
  "GET /v1/cie/sessions/:id/timeline",
  "GET /v1/cie/review/:sessionId/:momentId",
  "DELETE /v1/cie/sessions/:id",
  "POST /v1/cie/deletion-jobs/:id/run-local",
  "POST /v1/cie/deletion-jobs/:id/proofs/:resourceClass",
  "GET /v1/cie/deletion-jobs/:id"
]);

function header(headers, name) {
  if (!headers) return null;
  if (typeof headers.get === "function") return headers.get(name);
  const target = name.toLowerCase();
  const key = Object.keys(headers).find((entry) => entry.toLowerCase() === target);
  return key ? headers[key] : null;
}

function rowVersion(headers) {
  const value = header(headers, "if-match");
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(String(value).replace(/^W\//u, "").replaceAll('"', ""));
  invariant(Number.isSafeInteger(parsed) && parsed >= 1, 400, "ROW_VERSION_INVALID", "If-Match row version is invalid");
  return parsed;
}

function mutationMeta(request) {
  return {
    idempotencyKey: header(request.headers, "idempotency-key"),
    requestId: header(request.headers, "x-request-id"),
    correlationId: header(request.headers, "x-correlation-id") || header(request.headers, "x-request-id"),
    causationId: header(request.headers, "x-causation-id"),
    expectedRowVersion: rowVersion(request.headers)
  };
}

function pathParts(pathname) {
  const value = String(pathname || "").split("?", 1)[0];
  invariant(value.startsWith("/"), 400, "PATH_INVALID", "API path is invalid");
  return value.split("/").filter(Boolean).map((part) => {
    const decoded = decodeURIComponent(part);
    invariant(/^[A-Za-z0-9][A-Za-z0-9._:-]{0,179}$/u.test(decoded), 400, "PATH_IDENTIFIER_INVALID", "API path identifier is invalid");
    return decoded;
  });
}

function success(data, requestId, status = 200) {
  return { status, headers: { "content-type": "application/json; charset=utf-8", "x-request-id": requestId || "read-only" }, body: { ok: true, data, request_id: requestId || null } };
}

function failure(error, requestId) {
  const known = error instanceof CieError;
  const status = known ? error.status : 500;
  return {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", "x-request-id": requestId || "unavailable" },
    body: {
      ok: false,
      error: {
        code: known ? error.code : "INTERNAL_ERROR",
        message: known ? error.message : "The request could not be completed"
      },
      request_id: requestId || null
    }
  };
}

export class CieApiAdapter {
  #service;
  #playbackIssuer;

  constructor(service, options = {}) {
    this.#service = service;
    this.#playbackIssuer = options.playbackIssuer || null;
  }

  async handle(request) {
    const requestId = header(request.headers, "x-request-id");
    try {
      const method = String(request.method || "GET").toUpperCase();
      const parts = pathParts(request.path);
      const body = request.body || {};
      if (method === "GET" && parts.join("/") === "v1/cie/contracts") {
        return success({ contract_version: "cie.c0.v1", contracts: API_CONTRACTS, capabilities: CAPABILITY_REGISTRY }, requestId);
      }
      invariant(parts[0] === "v1" && parts[1] === "cie", 404, "ROUTE_NOT_FOUND", "Route was not found");
      const auth = request.auth;
      invariant(isVerifiedPrincipal(auth), 401, "AUTH_CONTEXT_UNVERIFIED", "An opaque MissionMed principal is required");
      const meta = mutationMeta(request);
      let data;
      let status = 200;

      if (method === "POST" && parts.join("/") === "v1/cie/sessions") {
        data = await this.#service.createSession(auth, body, meta);
        status = 201;
      } else if (method === "POST" && parts.length === 5 && parts[0] === "v1" && parts[1] === "cie" && parts[2] === "sessions" && parts[4] === "consents") {
        data = await this.#service.recordConsent(auth, parts[3], body, meta);
        status = 201;
      } else if (method === "POST" && parts.join("/") === "v1/cie/skill-snapshots") {
        data = await this.#service.importSkillSnapshot(auth, body.owner_user_id, body.snapshot, meta);
        status = 201;
      } else if (method === "PUT" && parts.length === 5 && parts[2] === "sessions" && parts[4] === "priorities") {
        data = await this.#service.setPriorities(auth, parts[3], body, meta);
      } else if (method === "POST" && parts.length === 5 && parts[2] === "sessions" && parts[4] === "track-items") {
        data = await this.#service.appendTrackItem(auth, parts[3], body, meta);
        status = 201;
      } else if (method === "POST" && parts.length === 5 && parts[2] === "sessions" && parts[4] === "moments") {
        data = await this.#service.createMoment(auth, parts[3], body, meta);
        status = 201;
      } else if (method === "POST" && parts.length === 5 && parts[2] === "sessions" && parts[4] === "opportunities") {
        data = await this.#service.createOpportunity(auth, parts[3], body, meta);
        status = 201;
      } else if (method === "POST" && parts.length === 5 && parts[2] === "sessions" && parts[4] === "grants") {
        data = await this.#service.grantAccess(auth, parts[3], body, meta);
        status = 201;
      } else if (method === "DELETE" && parts.length === 6 && parts[2] === "sessions" && parts[4] === "grants") {
        data = await this.#service.revokeAccess(auth, parts[3], parts[5], meta);
      } else if (method === "GET" && parts.length === 5 && parts[2] === "sessions" && parts[4] === "timeline") {
        data = this.#service.listTimeline(auth, parts[3], request.query || {});
      } else if (method === "GET" && parts.length === 5 && parts[2] === "review") {
        data = this.#service.resolveMomentLink(auth, parts[3], parts[4]);
        if (this.#playbackIssuer) data = { ...data, replay: { ...data.replay, playback_capability: await this.#playbackIssuer({ auth, session: data.session, moment: data.moment }) } };
      } else if (method === "DELETE" && parts.length === 4 && parts[2] === "sessions") {
        data = await this.#service.requestSessionDeletion(auth, parts[3], meta);
        status = 202;
      } else if (method === "POST" && parts.length === 5 && parts[2] === "deletion-jobs" && parts[4] === "run-local") {
        data = await this.#service.runLocalDeletion(auth, parts[3], meta);
      } else if (method === "POST" && parts.length === 6 && parts[2] === "deletion-jobs" && parts[4] === "proofs") {
        data = await this.#service.recordExternalDeletionProof(auth, parts[3], parts[5], body, meta);
      } else if (method === "GET" && parts.length === 4 && parts[2] === "deletion-jobs") {
        data = this.#service.getDeletionStatus(auth, parts[3]);
      } else {
        throw new CieError(404, "ROUTE_NOT_FOUND", "Route was not found");
      }
      return success(data, requestId, status);
    } catch (error) {
      return failure(error, requestId);
    }
  }
}

export { API_CONTRACTS };
