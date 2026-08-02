import { timingSafeEqual } from "node:crypto";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";

import pg from "pg";

import { TimelineHttpApi } from "../api/http-api.js";
import type { ObjectRecord, PrincipalContext } from "../contracts/types.js";
import { TimelineError } from "../core/errors.js";
import { TimelineService } from "../domain/timeline-service.js";
import { PostgresTimelinePrincipalDirectory } from "../identity/postgres-principal-directory.js";
import { WordPressTimelineJwtVerifier } from "../identity/wordpress-timeline-jwt.js";
import { PostgresTimelineRepository } from "../persistence/postgres/repository.js";
import { POSTGRES_TIMELINE_PRODUCTION_SCHEMA_VERSION, postgresClaimsFromPrincipal } from "../persistence/postgres/types.js";
import type { PrivateObjectStore, SignedDownload, SignedUpload, UploadRequest } from "../storage/private-object-store.js";
import { PrivacySafeTelemetry, type TelemetryEvent, type TelemetrySink } from "../telemetry/telemetry.js";

const MAX_REQUEST_BYTES = 2 * 1024 * 1024;
const RELEASE_VERSION = process.env.TIMELINE_RELEASE_VERSION?.trim() || "d1-411c-local";

function required(name: string, minimumLength = 1): string {
  const value = process.env[name]?.trim() ?? "";
  if (value.length < minimumLength) throw new Error(`${name}_REQUIRED`);
  return value;
}

function safeEqual(left: string, right: string): boolean {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
}

class ConsoleTelemetrySink implements TelemetrySink {
  emit(event: TelemetryEvent): void {
    process.stdout.write(`${JSON.stringify(event)}\n`);
  }
}

class UnconfiguredPrivateObjectStore implements PrivateObjectStore {
  private unavailable(): never {
    throw new TimelineError("PRIVATE_OBJECT_STORAGE_UNAVAILABLE", "Private object storage is not configured.", 503);
  }
  async signUpload(_context: PrincipalContext, _request: UploadRequest): Promise<SignedUpload> { return this.unavailable(); }
  async confirmUpload(_context: PrincipalContext, _objectId: string, _token: string): Promise<ObjectRecord> { return this.unavailable(); }
  async signDownload(_context: PrincipalContext, _objectId: string): Promise<SignedDownload> { return this.unavailable(); }
  async putServiceObject(_context: PrincipalContext, _request: UploadRequest, _bytes: Uint8Array): Promise<ObjectRecord> { return this.unavailable(); }
  async getObject(_objectId: string): Promise<ObjectRecord | null> { return this.unavailable(); }
  async deleteObject(_context: PrincipalContext, _objectId: string): Promise<void> { return this.unavailable(); }
}

async function requestBody(message: IncomingMessage): Promise<string | undefined> {
  if (message.method === "GET" || message.method === "HEAD") return undefined;
  const declared = Number(message.headers["content-length"] ?? 0);
  if (declared > MAX_REQUEST_BYTES) throw new TimelineError("REQUEST_TOO_LARGE", "Request is too large.", 413);
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of message) {
    const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += bytes.byteLength;
    if (size > MAX_REQUEST_BYTES) throw new TimelineError("REQUEST_TOO_LARGE", "Request is too large.", 413);
    chunks.push(bytes);
  }
  return chunks.length ? Buffer.concat(chunks).toString("utf8") : undefined;
}

function nodeHeaders(message: IncomingMessage): Headers {
  const headers = new Headers();
  for (const [name, value] of Object.entries(message.headers)) {
    if (Array.isArray(value)) value.forEach((item) => headers.append(name, item));
    else if (value !== undefined) headers.set(name, value);
  }
  return headers;
}

async function send(response: ServerResponse, webResponse: Response): Promise<void> {
  response.statusCode = webResponse.status;
  for (const [name, value] of webResponse.headers) response.setHeader(name, value);
  response.setHeader("cache-control", "no-store");
  response.end(Buffer.from(await webResponse.arrayBuffer()));
}

const databaseUrl = required("DATABASE_URL");
const gatewaySecret = required("TIMELINE_GATEWAY_SECRET", 32);
const activeKeyId = required("TIMELINE_JWT_ACTIVE_KEY_ID");
const activeSecret = required("TIMELINE_JWT_SECRET", 32);
const secrets = new Map<string, Uint8Array>([[activeKeyId, new TextEncoder().encode(activeSecret)]]);
const previousKeyId = process.env.TIMELINE_JWT_PREVIOUS_KEY_ID?.trim() ?? "";
const previousSecret = process.env.TIMELINE_JWT_PREVIOUS_SECRET?.trim() ?? "";
if (previousKeyId || previousSecret) {
  if (!previousKeyId || previousSecret.length < 32 || previousKeyId === activeKeyId) throw new Error("TIMELINE_JWT_PREVIOUS_KEY_INVALID");
  secrets.set(previousKeyId, new TextEncoder().encode(previousSecret));
}

const pool = new pg.Pool({
  connectionString: databaseUrl,
  max: Math.max(1, Math.min(20, Number(process.env.TIMELINE_DATABASE_POOL_MAX ?? 10))),
  connectionTimeoutMillis: 5_000,
  idleTimeoutMillis: 30_000,
  ...(process.env.TIMELINE_DATABASE_SSL === "require" ? { ssl: { rejectUnauthorized: true } } : {}),
});
const runtimeRole = process.env.TIMELINE_DATABASE_RUNTIME_ROLE?.trim() || "timeline_authenticated";
const directory = new PostgresTimelinePrincipalDirectory(pool, runtimeRole);
const identity = new WordPressTimelineJwtVerifier({
  issuer: required("TIMELINE_JWT_ISSUER"),
  audience: process.env.TIMELINE_JWT_AUDIENCE?.trim() || "mission-timeline",
  secretsByKeyId: secrets,
  principalDirectory: directory,
});
const telemetry = new PrivacySafeTelemetry(new ConsoleTelemetrySink(), process.env.TIMELINE_ENVIRONMENT?.trim() || "production");
const objectStore = new UnconfiguredPrivateObjectStore();
const serviceProvider = (context: PrincipalContext) => new TimelineService(new PostgresTimelineRepository(pool, {
  rlsClaims: postgresClaimsFromPrincipal(context),
  runtimeRole,
  expectedSchemaVersion: POSTGRES_TIMELINE_PRODUCTION_SCHEMA_VERSION,
}));
const api = new TimelineHttpApi(serviceProvider, identity, objectStore, telemetry, RELEASE_VERSION, true);

await new PostgresTimelineRepository(pool, { expectedSchemaVersion: POSTGRES_TIMELINE_PRODUCTION_SCHEMA_VERSION }).initialize();
const productionSchema = await pool.query("select to_regclass('timeline.admin_resource_grants') is not null as admin_grants_ready");
if (productionSchema.rows[0]?.admin_grants_ready !== true) throw new Error("TIMELINE_PRODUCTION_SCHEMA_INCOMPLETE");

const server = createServer(async (message, response) => {
  try {
    const path = message.url ? new URL(message.url, "http://timeline.internal").pathname : "/";
    if (path === "/healthz" && message.method === "GET") {
      await send(response, new Response(JSON.stringify({ ok: true, service: "mission-timeline", version: RELEASE_VERSION }), {
        status: 200,
        headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
      }));
      return;
    }
    if (!path.startsWith("/v1/")) {
      await send(response, new Response(JSON.stringify({ error: { code: "ROUTE_NOT_FOUND", message: "Timeline route not found." } }), {
        status: 404,
        headers: { "content-type": "application/json; charset=utf-8" },
      }));
      return;
    }
    const suppliedGatewaySecret = String(message.headers["x-missionmed-timeline-gateway-secret"] ?? "");
    if (!safeEqual(suppliedGatewaySecret, gatewaySecret)) {
      await send(response, new Response(JSON.stringify({ error: { code: "GATEWAY_REQUIRED", message: "Timeline gateway is required." } }), {
        status: 403,
        headers: { "content-type": "application/json; charset=utf-8" },
      }));
      return;
    }
    const body = await requestBody(message);
    const request = new Request(`http://timeline.internal${message.url ?? "/"}`, {
      method: message.method,
      headers: nodeHeaders(message),
      ...(body ? { body } : {}),
    });
    await send(response, await api.handle(request));
  } catch (error) {
    const status = error instanceof TimelineError ? error.status : 500;
    const code = error instanceof TimelineError ? error.code : "INTERNAL_ERROR";
    await send(response, new Response(JSON.stringify({ error: { code, message: status >= 500 ? "Timeline service error." : String((error as Error).message) } }), {
      status,
      headers: { "content-type": "application/json; charset=utf-8" },
    }));
  }
});

const port = Number(process.env.PORT ?? 3000);
server.listen(port, "0.0.0.0", () => {
  process.stdout.write(`${JSON.stringify({ event: "timeline.server.ready", port, version: RELEASE_VERSION })}\n`);
});

const shutdown = async () => {
  server.close();
  await pool.end();
};
process.once("SIGTERM", shutdown);
process.once("SIGINT", shutdown);
