import { createHash, randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import http from "node:http";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { assertCurrentSourceRights } from "./src/source-authorization.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_WEB_DIRECTORY = path.join(here, "web");
const MAX_BODY_BYTES = 64 * 1024;
const MAX_PAGE_SIZE = 50;

const REGION_BY_JURISDICTION = new Map(Object.entries({
  CT: "Northeast", ME: "Northeast", MA: "Northeast", NH: "Northeast", RI: "Northeast", VT: "Northeast",
  NJ: "Northeast", NY: "Northeast", PA: "Northeast",
  IN: "Midwest", IL: "Midwest", MI: "Midwest", OH: "Midwest", WI: "Midwest", IA: "Midwest", KS: "Midwest",
  MN: "Midwest", MO: "Midwest", NE: "Midwest", ND: "Midwest", SD: "Midwest",
  DE: "South", FL: "South", GA: "South", MD: "South", NC: "South", SC: "South", VA: "South", DC: "South",
  WV: "South", AL: "South", KY: "South", MS: "South", TN: "South", AR: "South", LA: "South", OK: "South", TX: "South",
  AZ: "West", CO: "West", ID: "West", MT: "West", NV: "West", NM: "West", UT: "West", WY: "West",
  AK: "West", CA: "West", HI: "West", OR: "West", WA: "West",
}));

const MIME_TYPES = new Map([
  [".html", "text/html; charset=utf-8"],
  [".css", "text/css; charset=utf-8"],
  [".js", "text/javascript; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".svg", "image/svg+xml"],
  [".png", "image/png"],
  [".woff2", "font/woff2"],
]);

function securityHeaders(response, requestId) {
  response.setHeader("Content-Security-Policy", [
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self'",
    "img-src 'self' data:",
    "font-src 'self'",
    "connect-src 'self'",
    "object-src 'none'",
    "base-uri 'none'",
    "frame-ancestors 'none'",
    "form-action 'self'",
  ].join("; "));
  response.setHeader("Cross-Origin-Opener-Policy", "same-origin");
  response.setHeader("Cross-Origin-Resource-Policy", "same-origin");
  response.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=(), payment=()");
  response.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  response.setHeader("X-Content-Type-Options", "nosniff");
  response.setHeader("X-Frame-Options", "DENY");
  response.setHeader("X-Request-ID", requestId);
}

function sendJson(response, status, body, { cache = "no-store", requestId } = {}) {
  response.statusCode = status;
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  response.setHeader("Cache-Control", cache);
  if (requestId) securityHeaders(response, requestId);
  response.end(`${JSON.stringify(body)}\n`);
}

function apiError(response, status, code, message, requestId, details) {
  sendJson(response, status, { error: { code, message, requestId, details } }, { requestId });
}

function normalizeQuery(value) {
  return String(value ?? "").trim().toLocaleLowerCase("en-US");
}

function knownValue(field) {
  return field?.knowledge?.state === "known" ? field.knowledge.value : undefined;
}

function regionFor(state) {
  return REGION_BY_JURISDICTION.get(state) ?? "Territory / Other";
}

function listView(record) {
  const j1 = knownValue(record.fields.J1);
  const h1b = knownValue(record.fields.H1B);
  return {
    id: record.id,
    programSpecialtyId: record.programSpecialtyId,
    lifecycle: record.lifecycle ?? "unknown",
    display: { ...record.display, region: regionFor(record.display.state) },
    designation: record.designation,
    kind: record.kind,
    entryFormat: record.entryFormat,
    browseMemberships: record.browseMemberships,
    programType: knownValue(record.fields["Program Best Described As"]) ?? null,
    visa: {
      j1: j1 === true ? "known_yes" : "unknown",
      h1b: h1b === true ? "known_yes" : "unknown",
    },
    evidence: record.evidence,
    source: {
      authority: record.source.authority,
      retrievedAt: record.source.retrievedAt,
      sourceUpdatedAt: record.source.sourceUpdatedAt,
    },
  };
}

function selectedSpecialtyMatch(record, specialty, includeCombined) {
  if (!specialty) return true;
  if (record.designation === specialty) return true;
  const membership = record.browseMemberships.find((item) => item.browseSpecialty === specialty);
  if (!membership) return false;
  if (membership.relationship === "RELATED_COMBINED") return includeCombined;
  return true;
}

function evidenceBand(percent) {
  if (percent >= 65) return "high";
  if (percent >= 40) return "medium";
  return "low";
}

function searchPrograms(index, searchParams) {
  const query = normalizeQuery(searchParams.get("q"));
  const specialty = String(searchParams.get("specialty") ?? "").trim();
  const jurisdiction = String(searchParams.get("jurisdiction") ?? "").trim();
  const region = String(searchParams.get("region") ?? "").trim();
  const programType = normalizeQuery(searchParams.get("programType"));
  const visa = String(searchParams.get("visa") ?? "").trim().toUpperCase();
  const evidence = String(searchParams.get("evidence") ?? "").trim().toLowerCase();
  const includeCombined = searchParams.get("includeCombined") === "true";
  const sort = String(searchParams.get("sort") ?? "name");
  const page = Math.max(1, Number.parseInt(searchParams.get("page") ?? "1", 10) || 1);
  const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, Number.parseInt(searchParams.get("pageSize") ?? "24", 10) || 24));

  let records = index.programs.filter((record) => {
    if (!selectedSpecialtyMatch(record, specialty, includeCombined)) return false;
    if (jurisdiction && record.display.state !== jurisdiction) return false;
    if (region && regionFor(record.display.state) !== region) return false;
    if (programType && !normalizeQuery(knownValue(record.fields["Program Best Described As"])).includes(programType)) return false;
    if (visa === "J1" && knownValue(record.fields.J1) !== true) return false;
    if (visa === "H1B" && knownValue(record.fields.H1B) !== true) return false;
    if (evidence && evidenceBand(record.evidence.coveragePercent) !== evidence) return false;
    if (!query) return true;
    const haystack = normalizeQuery([
      record.display.programName,
      record.display.institution,
      record.display.hospital,
      record.display.city,
      record.display.state,
      record.designation,
      record.id,
      record.programSpecialtyId,
      ...(record.identifiers ?? []).map((identifier) => identifier.value),
    ].filter(Boolean).join(" "));
    return haystack.includes(query);
  });
  records = [...records].sort((left, right) => {
    if (sort === "jurisdiction") {
      return String(left.display.state).localeCompare(String(right.display.state)) ||
        String(left.display.programName).localeCompare(String(right.display.programName));
    }
    if (sort === "evidence") {
      return right.evidence.coveragePercent - left.evidence.coveragePercent ||
        String(left.display.programName).localeCompare(String(right.display.programName));
    }
    return String(left.display.programName).localeCompare(String(right.display.programName));
  });
  const total = records.length;
  const start = (page - 1) * pageSize;
  const pageRecords = records.slice(start, start + pageSize).map(listView);
  return {
    query: { q: query, specialty, jurisdiction, region, programType, visa, evidence, includeCombined, sort },
    page,
    pageSize,
    total,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
    records: pageRecords,
  };
}

async function readBody(request) {
  let size = 0;
  const chunks = [];
  for await (const chunk of request) {
    size += chunk.length;
    if (size > MAX_BODY_BYTES) {
      const error = new Error("Request body exceeds 64 KiB");
      error.code = "BODY_TOO_LARGE";
      throw error;
    }
    chunks.push(chunk);
  }
  if (!chunks.length) return {};
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    const error = new Error("Request body is not valid JSON");
    error.code = "INVALID_JSON";
    throw error;
  }
}

export function isProductionEnvironment({
  nodeEnv = process.env.NODE_ENV,
  riseEnvironment = process.env.RISE_ENVIRONMENT,
} = {}) {
  return String(nodeEnv ?? "").toLowerCase() === "production" ||
    String(riseEnvironment ?? "").toLowerCase() === "production";
}

function createAuthenticator({ mode, authenticator, audience = "rise", production = false }) {
  if (mode === "local-preview") {
    if (production) {
      throw new Error("local-preview authentication is prohibited in production");
    }
    return async () => ({
      subject: "local-preview",
      role: "admin",
      audience,
      capabilities: ["rise:read", "rise:operator"],
      preview: true,
    });
  }
  if (mode !== "injected" || typeof authenticator !== "function") {
    throw new Error("RISE requires local-preview outside production or an injected host authentication adapter");
  }
  return async (request) => {
    // Production RISE deliberately accepts host-session authentication only.
    // A browser-visible bearer credential must never be forwarded or replayed.
    if (request.headers.authorization) return null;
    const session = await authenticator(request);
    if (!session || typeof session !== "object") return null;
    const actualAudience = session.authAudience ?? session.audience;
    if (actualAudience !== audience || !session.subject) return null;
    return {
      subject: String(session.subject),
      role: String(session.role ?? "student"),
      audience,
      capabilities: Array.isArray(session.capabilities)
        ? [...new Set(session.capabilities.filter((item) => typeof item === "string"))]
        : [],
    };
  };
}

function hasCapability(session, capability) {
  return session.capabilities.includes("rise:admin") || session.capabilities.includes(capability);
}

export function validateListenConfiguration({
  host,
  authMode,
  nodeEnv = process.env.NODE_ENV,
  riseEnvironment = process.env.RISE_ENVIRONMENT,
} = {}) {
  const loopback = new Set(["127.0.0.1", "localhost", "::1"]);
  if (authMode === "local-preview" && !loopback.has(host)) {
    throw new Error("local-preview authentication may listen only on a loopback address");
  }
  if (authMode === "local-preview" && isProductionEnvironment({ nodeEnv, riseEnvironment })) {
    throw new Error("local-preview authentication is prohibited in production");
  }
  return true;
}

function rateLimiter({ limit = 120, windowMs = 60_000, maxBuckets = 10_000 } = {}) {
  const buckets = new Map();
  return (key, cost = 1) => {
    const now = Date.now();
    if (buckets.size >= maxBuckets) {
      for (const [candidate, bucket] of buckets) {
        if (bucket.resetAt <= now) buckets.delete(candidate);
      }
      if (buckets.size >= maxBuckets && !buckets.has(key)) return false;
    }
    const current = buckets.get(key);
    if (!current || current.resetAt <= now) {
      buckets.set(key, { count: cost, resetAt: now + windowMs });
      return cost <= limit;
    }
    current.count += cost;
    return current.count <= limit;
  };
}

function requestRateCost(url) {
  if (url.pathname !== "/api/rise/v1/programs") return 1;
  const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, Number.parseInt(url.searchParams.get("pageSize") ?? "24", 10) || 24));
  return 1 + Math.ceil(pageSize / 10);
}

function localAbuseController() {
  const allowGlobal = rateLimiter({ limit: 2_000, windowMs: 60_000, maxBuckets: 1 });
  const allowSubject = rateLimiter();
  return {
    scope: "process_local_test_only",
    async allowPreAuth() {
      return allowGlobal("global", 1);
    },
    async allowAuthenticatedSubject({ subject, cost }) {
      return allowSubject(subject, cost);
    },
  };
}

function resolveAbuseController(controller, { production }) {
  if (!controller) {
    if (production) {
      throw new Error("Production RISE requires an injected shared durable abuse controller");
    }
    return localAbuseController();
  }
  if (
    typeof controller.allowPreAuth !== "function" ||
    typeof controller.allowAuthenticatedSubject !== "function" ||
    (production && controller.scope !== "shared_durable")
  ) {
    throw new Error("RISE abuse controller must provide pre-auth and authenticated-subject controls; production scope must be shared_durable");
  }
  return controller;
}

async function serveStatic(requestPath, response, webDirectory, requestId) {
  let relative = requestPath === "/rise/" || requestPath === "/rise" ? "index.html" : requestPath.slice("/rise/".length);
  if (requestPath === "/vendor/lucide.js") {
    const bundledVendorPath = path.resolve(webDirectory, "vendor/lucide.js");
    const dependencyVendorPath = path.resolve(here, "../node_modules/lucide/dist/umd/lucide.min.js");
    let body;
    try {
      body = await fs.readFile(bundledVendorPath);
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
      body = await fs.readFile(dependencyVendorPath);
    }
    response.statusCode = 200;
    response.setHeader("Content-Type", "text/javascript; charset=utf-8");
    response.setHeader("Cache-Control", "no-cache");
    securityHeaders(response, requestId);
    response.end(body);
    return true;
  }
  if (!requestPath.startsWith("/rise")) return false;
  try {
    relative = decodeURIComponent(relative || "index.html");
  } catch {
    return false;
  }
  const absolute = path.resolve(webDirectory, relative);
  const root = `${path.resolve(webDirectory)}${path.sep}`;
  if (!absolute.startsWith(root) && absolute !== path.resolve(webDirectory, "index.html")) return false;
  try {
    const body = await fs.readFile(absolute);
    response.statusCode = 200;
    response.setHeader("Content-Type", MIME_TYPES.get(path.extname(absolute)) ?? "application/octet-stream");
    response.setHeader("Cache-Control", "no-cache");
    securityHeaders(response, requestId);
    response.end(body);
    return true;
  } catch (error) {
    if (error.code === "ENOENT") return false;
    throw error;
  }
}

export function createRiseServer({
  registryIndex,
  webDirectory = DEFAULT_WEB_DIRECTORY,
  authMode = process.env.RISE_AUTH_MODE ?? "local-preview",
  authenticator,
  buildId = process.env.RISE_BUILD_ID ?? "local-unversioned",
  environment = process.env.RISE_ENVIRONMENT ?? (process.env.NODE_ENV === "production" ? "production" : "local"),
  production = isProductionEnvironment({ riseEnvironment: environment }),
  expectedSourceAuthorizationSha256s = process.env.RISE_SOURCE_AUTHORIZATION_SHA256S,
  revokedSourceAuthorizationSha256s = process.env.RISE_REVOKED_SOURCE_AUTHORIZATION_SHA256S,
  abuseController,
  logger = console,
} = {}) {
  if (!registryIndex?.programs || !registryIndex?.registryReleaseId) {
    throw new Error("A validated RISE API index is required");
  }
  const syntheticTestFixture = registryIndex.dataClassification === "synthetic_test_fixture";
  const sourceRightsApproved = registryIndex.releaseGate?.sourceRightsApproved === true;
  if (!syntheticTestFixture) {
    assertCurrentSourceRights(registryIndex.releaseGate, {
      production,
      expectedAuthorizationSha256s: expectedSourceAuthorizationSha256s,
      revokedAuthorizationSha256s: revokedSourceAuthorizationSha256s,
    });
  }
  if (production && syntheticTestFixture) {
    throw new Error("Synthetic RISE fixtures are prohibited in production");
  }
  const byProgramSpecialtyId = new Map(registryIndex.programs.map((record) => [record.programSpecialtyId, record]));
  const authenticate = createAuthenticator({ mode: authMode, authenticator, production });
  const abuse = resolveAbuseController(abuseController, { production });
  return http.createServer(async (request, response) => {
    const requestId = randomUUID();
    const startedAt = performance.now();
    let status = 500;
    let subjectAuditId = null;
    try {
      const url = new URL(request.url ?? "/", "http://rise.local");
      const preAuthAllowed = await abuse.allowPreAuth({
        method: request.method,
        path: url.pathname,
        remoteAddress: request.socket.remoteAddress ?? null,
      });
      if (!preAuthAllowed) {
        status = 429;
        response.setHeader("Retry-After", "60");
        apiError(response, 429, "PRE_AUTH_RATE_LIMITED", "RISE ingress request budget exceeded", requestId);
        return;
      }
      if (url.pathname === "/api/rise/v1/health") {
        let sourceRightsCurrent = true;
        if (!syntheticTestFixture) {
          try {
            assertCurrentSourceRights(registryIndex.releaseGate, {
              production,
              expectedAuthorizationSha256s: expectedSourceAuthorizationSha256s,
              revokedAuthorizationSha256s: revokedSourceAuthorizationSha256s,
            });
          } catch {
            sourceRightsCurrent = false;
          }
        }
        status = sourceRightsCurrent ? 200 : 503;
        sendJson(response, status, {
          ok: sourceRightsCurrent,
          service: "missionmed-rise",
          registryReleaseId: registryIndex.registryReleaseId,
          buildId,
          environment,
          sourceRightsCurrent,
        }, { cache: "no-store", requestId });
        return;
      }
      if (url.pathname === "/") {
        status = 302;
        response.statusCode = 302;
        response.setHeader("Location", "/rise/");
        securityHeaders(response, requestId);
        response.end();
        return;
      }
      const session = await authenticate(request);
      if (!session) {
        status = 401;
        apiError(response, 401, "UNAUTHENTICATED", "A valid RISE host session is required", requestId);
        return;
      }
      if (!hasCapability(session, "rise:read")) {
        status = 403;
        apiError(response, 403, "FORBIDDEN", "RISE read capability required", requestId);
        return;
      }
      subjectAuditId = createHash("sha256").update(session.subject).digest("hex").slice(0, 16);
      if (!await abuse.allowAuthenticatedSubject({
        subject: session.subject,
        method: request.method,
        path: url.pathname,
        cost: requestRateCost(url),
      })) {
        status = 429;
        response.setHeader("Retry-After", "60");
        apiError(response, 429, "RATE_LIMITED", "Authenticated RISE request budget exceeded", requestId);
        return;
      }
      if (!syntheticTestFixture) {
        assertCurrentSourceRights(registryIndex.releaseGate, {
          production,
          expectedAuthorizationSha256s: expectedSourceAuthorizationSha256s,
          revokedAuthorizationSha256s: revokedSourceAuthorizationSha256s,
        });
      }
      if (authMode === "local-preview") response.setHeader("X-RISE-Preview", "true");

      if (!url.pathname.startsWith("/api/rise/v1/")) {
        if (!new Set(["GET", "HEAD"]).has(request.method)) {
          status = 405;
          apiError(response, 405, "METHOD_NOT_ALLOWED", "Static RISE routes accept GET or HEAD only", requestId);
          return;
        }
        const served = await serveStatic(url.pathname, response, webDirectory, requestId);
        if (served) {
          status = 200;
          return;
        }
        status = 404;
        apiError(response, 404, "NOT_FOUND", "Route not found", requestId);
        return;
      }

      if (request.method === "GET" && url.pathname === "/api/rise/v1/session") {
        status = 200;
        sendJson(response, 200, session, { requestId });
        return;
      }
      if (request.method === "GET" && url.pathname === "/api/rise/v1/status") {
        status = 200;
        sendJson(response, 200, {
          registryReleaseId: registryIndex.registryReleaseId,
          sourceSnapshotId: registryIndex.sourceSnapshotId,
          counts: registryIndex.counts,
          activationStatus: registryIndex.activationStatus ?? "offline_shadow_only",
          dataClassification: registryIndex.dataClassification ?? "source_controlled_registry",
          sourceRightsApproved,
          buildId,
          environment,
          integrations: { matrix: "disabled", actn: "disabled", cam: "disabled", storyforge: "disabled" },
          sourcePolicy: registryIndex.sourcePolicy ?? {
            freida: "written_authorization_required",
            residencyExplorer: "written_authorization_required",
          },
        }, { requestId });
        return;
      }
      if (request.method === "GET" && url.pathname === "/api/rise/v1/programs") {
        const result = searchPrograms(registryIndex, url.searchParams);
        status = 200;
        sendJson(response, 200, {
          registryReleaseId: registryIndex.registryReleaseId,
          ...result,
          filterOptions: registryIndex.filters,
        }, { cache: "private, max-age=60", requestId });
        return;
      }
      const profileMatch = url.pathname.match(/^\/api\/rise\/v1\/program-specialties\/([^/]+)$/);
      if (request.method === "GET" && profileMatch) {
        const record = byProgramSpecialtyId.get(decodeURIComponent(profileMatch[1]));
        if (!record) {
          status = 404;
          apiError(response, 404, "PROGRAM_NOT_FOUND", "Program specialty not found", requestId);
          return;
        }
        status = 200;
        sendJson(response, 200, { registryReleaseId: registryIndex.registryReleaseId, program: record }, {
          cache: "no-store",
          requestId,
        });
        return;
      }
      const evidenceMatch = url.pathname.match(/^\/api\/rise\/v1\/program-specialties\/([^/]+)\/evidence$/);
      if (request.method === "GET" && evidenceMatch) {
        const record = byProgramSpecialtyId.get(decodeURIComponent(evidenceMatch[1]));
        if (!record) {
          status = 404;
          apiError(response, 404, "PROGRAM_NOT_FOUND", "Program specialty not found", requestId);
          return;
        }
        status = 200;
        sendJson(response, 200, {
          registryReleaseId: registryIndex.registryReleaseId,
          programSpecialtyId: record.programSpecialtyId,
          evidence: record.fields,
          source: record.source,
        }, { cache: "no-store", requestId });
        return;
      }
      if (request.method === "POST" && url.pathname === "/api/rise/v1/matches:evaluate") {
        await readBody(request);
        status = 409;
        apiError(response, 409, "MATCHING_EVIDENCE_NOT_READY",
          "The current registry release has no current-cycle, source-located hard-match claims", requestId, {
            matchableClaims: registryIndex.counts.matchableClaims,
          });
        return;
      }
      const handoffMatch = url.pathname.match(/^\/api\/rise\/v1\/handoffs\/(actn|cam|storyforge)$/);
      if (request.method === "POST" && handoffMatch) {
        await readBody(request);
        status = 409;
        apiError(response, 409, "INTEGRATION_DISABLED", `${handoffMatch[1]} integration is disabled`, requestId);
        return;
      }
      if (request.method === "GET" && url.pathname === "/api/rise/v1/operator/queue") {
        if (!hasCapability(session, "rise:operator")) {
          status = 403;
          apiError(response, 403, "FORBIDDEN", "Operator capability required", requestId);
          return;
        }
        status = 409;
        apiError(response, 409, "OPERATOR_BACKEND_DISABLED",
          "The offline release exposes quarantine counts, but no authorized operator backend exists", requestId, {
            quarantinedSourceRows: registryIndex.counts.quarantinedSourceRows,
          });
        return;
      }
      status = 404;
      apiError(response, 404, "NOT_FOUND", "API route not found", requestId);
    } catch (error) {
      if (error.code === "BODY_TOO_LARGE") {
        status = 413;
        apiError(response, 413, error.code, error.message, requestId);
      } else if (error.code === "INVALID_JSON") {
        status = 400;
        apiError(response, 400, error.code, error.message, requestId);
      } else {
        status = 500;
        logger.error?.({ event: "rise_request_error", requestId, message: error.message });
        apiError(response, 500, "INTERNAL_ERROR", "Unexpected service error", requestId);
      }
    } finally {
      logger.info?.({
        event: "rise_request",
        requestId,
        method: request.method,
        path: String(request.url ?? "").split("?", 1)[0],
        status,
        durationMs: Math.round((performance.now() - startedAt) * 10) / 10,
        subjectAuditId,
      });
    }
  });
}

export async function loadRegistryIndex(indexPath, {
  expectedSha256 = process.env.RISE_INDEX_SHA256,
  manifestPath = process.env.RISE_INDEX_MANIFEST_PATH,
  production = isProductionEnvironment(),
  expectedSourceAuthorizationSha256s = process.env.RISE_SOURCE_AUTHORIZATION_SHA256S,
  revokedSourceAuthorizationSha256s = process.env.RISE_REVOKED_SOURCE_AUTHORIZATION_SHA256S,
} = {}) {
  if (production && !expectedSha256) {
    throw new Error("RISE_INDEX_SHA256 is required in production");
  }
  let preReadManifest = null;
  if (production || manifestPath) {
    if (!manifestPath) throw new Error("RISE_INDEX_MANIFEST_PATH is required in production");
    preReadManifest = JSON.parse(await fs.readFile(manifestPath, "utf8"));
    if (
      preReadManifest.schemaVersion !== 1 ||
      preReadManifest.immutable !== true ||
      !/^[a-f0-9]{64}$/.test(preReadManifest.apiIndexSha256 ?? "") ||
      preReadManifest.apiIndexSha256 !== expectedSha256
    ) {
      throw new Error("RISE index manifest does not match the runtime index pin");
    }
    if (production && preReadManifest.dataClassification === "synthetic_test_fixture") {
      throw new Error("Synthetic RISE fixtures are prohibited in production");
    }
    if (preReadManifest.dataClassification !== "synthetic_test_fixture") {
      assertCurrentSourceRights({
        sourceRightsApproved: preReadManifest.sourceRightsApproved,
        sourceRights: preReadManifest.sourceRights,
      }, {
        production,
        expectedAuthorizationSha256s: expectedSourceAuthorizationSha256s,
        revokedAuthorizationSha256s: revokedSourceAuthorizationSha256s,
      });
    }
  }
  const source = await fs.readFile(indexPath);
  const actualSha256 = createHash("sha256").update(source).digest("hex");
  if (expectedSha256 && actualSha256 !== expectedSha256) {
    throw new Error(`RISE API index hash mismatch: expected ${expectedSha256}, received ${actualSha256}`);
  }
  const index = JSON.parse(source.toString("utf8"));
  if (index.schemaVersion !== 1 || !Array.isArray(index.programs)) throw new Error("Unsupported RISE API index");
  if (preReadManifest && index.registryReleaseId !== preReadManifest.registryReleaseId) {
    throw new Error("RISE index release does not match its pre-read manifest");
  }
  if (production && index.dataClassification === "synthetic_test_fixture") {
    throw new Error("Synthetic RISE fixtures are prohibited in production");
  }
  if (index.dataClassification !== "synthetic_test_fixture") {
    assertCurrentSourceRights(index.releaseGate, {
      production,
      expectedAuthorizationSha256s: expectedSourceAuthorizationSha256s,
      revokedAuthorizationSha256s: revokedSourceAuthorizationSha256s,
    });
  }
  return index;
}

export async function loadWebBuild(webDirectory, {
  expectedManifestSha256 = process.env.RISE_ASSET_MANIFEST_SHA256,
  production = isProductionEnvironment(),
} = {}) {
  const manifestPath = path.join(webDirectory, "asset-manifest.json");
  let bytes;
  try {
    bytes = await fs.readFile(manifestPath);
  } catch (error) {
    if (error.code === "ENOENT" && !production) return { buildId: "local-unversioned", files: null };
    throw error;
  }
  const actualManifestSha256 = createHash("sha256").update(bytes).digest("hex");
  if (production && !expectedManifestSha256) throw new Error("RISE_ASSET_MANIFEST_SHA256 is required in production");
  if (expectedManifestSha256 && actualManifestSha256 !== expectedManifestSha256) {
    throw new Error("RISE web asset manifest hash mismatch");
  }
  const manifest = JSON.parse(bytes.toString("utf8"));
  if (manifest.schemaVersion !== 1 || !manifest.buildId || !manifest.files || typeof manifest.files !== "object") {
    throw new Error("Unsupported RISE web asset manifest");
  }
  const root = `${path.resolve(webDirectory)}${path.sep}`;
  for (const [relative, expected] of Object.entries(manifest.files)) {
    const absolute = path.resolve(webDirectory, relative);
    if (!absolute.startsWith(root) || !/^[a-f0-9]{64}$/.test(expected)) {
      throw new Error(`Invalid RISE web asset manifest entry: ${relative}`);
    }
    const actual = createHash("sha256").update(await fs.readFile(absolute)).digest("hex");
    if (actual !== expected) throw new Error(`RISE web asset hash mismatch: ${relative}`);
  }
  return { ...manifest, manifestSha256: actualManifestSha256 };
}

export async function startFromEnvironment() {
  const indexPath = process.env.RISE_INDEX_PATH;
  if (!indexPath) throw new Error("RISE_INDEX_PATH is required");
  const production = isProductionEnvironment();
  const index = await loadRegistryIndex(path.resolve(indexPath), { production });
  const webDirectory = process.env.RISE_WEB_DIRECTORY
    ? path.resolve(process.env.RISE_WEB_DIRECTORY)
    : DEFAULT_WEB_DIRECTORY;
  const authMode = process.env.RISE_AUTH_MODE ?? "local-preview";
  let authenticator;
  let abuseController;
  if (authMode === "injected") {
    const adapterPath = process.env.RISE_AUTH_ADAPTER_MODULE;
    if (!adapterPath) throw new Error("RISE_AUTH_ADAPTER_MODULE is required for injected authentication");
    const adapter = await import(pathToFileURL(path.resolve(adapterPath)).href);
    if (typeof adapter.authenticateRiseRequest !== "function") {
      throw new Error("RISE auth adapter must export authenticateRiseRequest(request)");
    }
    authenticator = adapter.authenticateRiseRequest;
  }
  const abuseAdapterPath = process.env.RISE_ABUSE_ADAPTER_MODULE;
  if (abuseAdapterPath) {
    const adapter = await import(pathToFileURL(path.resolve(abuseAdapterPath)).href);
    if (typeof adapter.createRiseAbuseController !== "function") {
      throw new Error("RISE abuse adapter must export createRiseAbuseController()");
    }
    abuseController = await adapter.createRiseAbuseController();
  }
  const webBuild = await loadWebBuild(webDirectory, { production });
  if (process.env.RISE_BUILD_ID && process.env.RISE_BUILD_ID !== webBuild.buildId) {
    throw new Error("RISE_BUILD_ID does not match the authenticated web build");
  }
  const host = process.env.RISE_HOST ?? (production ? "0.0.0.0" : "127.0.0.1");
  validateListenConfiguration({ host, authMode, riseEnvironment: process.env.RISE_ENVIRONMENT });
  const server = createRiseServer({
    registryIndex: index,
    webDirectory,
    authMode,
    authenticator,
    abuseController,
    buildId: webBuild.buildId,
    production,
  });
  const port = Number.parseInt(process.env.PORT ?? "4177", 10);
  server.listen(port, host, () => {
    process.stdout.write(`${JSON.stringify({
      service: "missionmed-rise",
      url: `http://${host}:${port}/rise/`,
      registryReleaseId: index.registryReleaseId,
      authMode,
    })}\n`);
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  startFromEnvironment().catch((error) => {
    process.stderr.write(`${JSON.stringify({ error: error.message })}\n`);
    process.exitCode = 1;
  });
}
