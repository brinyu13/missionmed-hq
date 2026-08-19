import { createServer } from "node:http";

import pg from "pg";

import { TimelineHttpApi } from "../api/http-api.js";
import type { ObjectRecord, PrincipalContext } from "../contracts/types.js";
import { TimelineError } from "../core/errors.js";
import { TimelineService } from "../domain/timeline-service.js";
import { CvIntelligenceService } from "../intelligence/cv-intelligence-service.js";
import { OpenAiCvIntelligenceProvider } from "../intelligence/openai-cv-intelligence.js";
import { PostgresTimelinePrincipalDirectory } from "../identity/postgres-principal-directory.js";
import { WordPressTimelineJwtVerifier } from "../identity/wordpress-timeline-jwt.js";
import { PostgresTimelineRepository } from "../persistence/postgres/repository.js";
import { POSTGRES_TIMELINE_PRODUCTION_SCHEMA_VERSION, postgresClaimsFromPrincipal } from "../persistence/postgres/types.js";
import type { PrivateObjectStore, SignedDownload, SignedUpload, UploadRequest } from "../storage/private-object-store.js";
import { createR2PrivateObjectStoreFromEnvironment } from "../storage/production/index.js";
import { PrivacySafeTelemetry, type TelemetryEvent, type TelemetrySink } from "../telemetry/telemetry.js";
import { createTimelineProductionHttpHandler } from "./production-http-handler.js";

function required(name: string, minimumLength = 1): string {
  const value = process.env[name]?.trim() ?? "";
  if (value.length < minimumLength) throw new Error(`${name}_REQUIRED`);
  return value;
}

const RELEASE_VERSION = required("TIMELINE_RELEASE_VERSION");

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
  async putOwnedObject(_context: PrincipalContext, _request: UploadRequest, _bytes: Uint8Array): Promise<ObjectRecord> { return this.unavailable(); }
  async getObject(_objectId: string): Promise<ObjectRecord | null> { return this.unavailable(); }
  async getAuthorizedObject(_context: PrincipalContext, _objectId: string): Promise<ObjectRecord | null> { return this.unavailable(); }
  async deleteObject(_context: PrincipalContext, _objectId: string): Promise<void> { return this.unavailable(); }
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
const objectStore: PrivateObjectStore = createR2PrivateObjectStoreFromEnvironment({
  env: process.env,
  pool,
  runtimeRole,
  tokenSecret: gatewaySecret,
}) ?? new UnconfiguredPrivateObjectStore();
const aiProviderName = process.env.TIMELINE_AI_PROVIDER?.trim().toLowerCase() ?? "";
const aiApiKey = process.env.TIMELINE_AI_API_KEY?.trim() ?? "";
const aiModel = process.env.TIMELINE_AI_MODEL?.trim() ?? "";
const aiConsentVersion = process.env.TIMELINE_AI_CONSENT_VERSION?.trim() ?? "";
if ([aiProviderName, aiApiKey, aiModel, aiConsentVersion].some(Boolean) && ![aiProviderName, aiApiKey, aiModel, aiConsentVersion].every(Boolean)) {
  throw new Error("TIMELINE_AI_CONFIGURATION_INCOMPLETE");
}
if (aiProviderName && aiProviderName !== "openai") throw new Error("TIMELINE_AI_PROVIDER_UNSUPPORTED");
const cvIntelligence = new CvIntelligenceService({
  provider: aiProviderName === "openai" ? new OpenAiCvIntelligenceProvider({ apiKey: aiApiKey, model: aiModel }) : null,
  expectedConsentVersion: aiProviderName ? aiConsentVersion : null,
});
const serviceProvider = (context: PrincipalContext) => new TimelineService(new PostgresTimelineRepository(pool, {
  rlsClaims: postgresClaimsFromPrincipal(context),
  runtimeRole,
  expectedSchemaVersion: POSTGRES_TIMELINE_PRODUCTION_SCHEMA_VERSION,
}));
const api = new TimelineHttpApi(serviceProvider, identity, objectStore, telemetry, RELEASE_VERSION, true, cvIntelligence);

await new PostgresTimelineRepository(pool, { expectedSchemaVersion: POSTGRES_TIMELINE_PRODUCTION_SCHEMA_VERSION }).initialize();
const productionSchema = await pool.query("select to_regclass('timeline.admin_resource_grants') is not null as admin_grants_ready");
if (productionSchema.rows[0]?.admin_grants_ready !== true) throw new Error("TIMELINE_PRODUCTION_SCHEMA_INCOMPLETE");

const handler = createTimelineProductionHttpHandler({
  api,
  gatewaySecret,
  releaseVersion: RELEASE_VERSION,
  expectedSchemaVersion: POSTGRES_TIMELINE_PRODUCTION_SCHEMA_VERSION,
  health: async () => {
    const client = await pool.connect();
    let transaction = false;
    try {
      await client.query("begin");
      transaction = true;
      await client.query("set local statement_timeout = '3500ms'");
      const result = await client.query("select timeline.schema_version() as schema_version");
      await client.query("commit");
      transaction = false;
      return { schemaVersion: String(result.rows[0]?.schema_version ?? "") };
    } finally {
      if (transaction) await client.query("rollback").catch(() => {});
      client.release();
    }
  },
  log: (event) => process.stdout.write(`${JSON.stringify(event)}\n`),
});
const server = createServer(handler);

const port = Number(process.env.PORT ?? 3000);
server.listen(port, "0.0.0.0", () => {
  process.stdout.write(`${JSON.stringify({ event: "timeline.server.ready", port, version: RELEASE_VERSION })}\n`);
});

let shuttingDown = false;
const shutdown = async () => {
  if (shuttingDown) return;
  shuttingDown = true;
  await new Promise<void>((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
  });
  await pool.end();
};
const onSignal = () => {
  shutdown().catch(() => {
    process.stderr.write(`${JSON.stringify({ event: "timeline.server.shutdown_failed", error_code: "SHUTDOWN_FAILED" })}\n`);
    process.exitCode = 1;
  });
};
process.once("SIGTERM", onSignal);
process.once("SIGINT", onSignal);
