import { randomUUID, timingSafeEqual } from "node:crypto";
import type { IncomingMessage, ServerResponse } from "node:http";

import type { TimelineHttpApi } from "../api/http-api.js";
import { TimelineError } from "../core/errors.js";

const MAX_REQUEST_BYTES = 2 * 1024 * 1024;

export interface TimelineHealthDependency {
  schemaVersion: string;
}

export interface TimelineProductionHttpHandlerOptions {
  api: Pick<TimelineHttpApi, "handle">;
  gatewaySecret: string;
  releaseVersion: string;
  expectedSchemaVersion: string;
  health: () => Promise<TimelineHealthDependency>;
  healthTimeoutMs?: number;
  log?: (event: Record<string, unknown>) => void;
}

function safeEqual(left: string, right: string): boolean {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
}

function requestId(message: IncomingMessage): string {
  const supplied = String(message.headers["x-request-id"] ?? "");
  return /^[A-Za-z0-9._:-]{1,128}$/.test(supplied) ? supplied : randomUUID();
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

function nodeHeaders(message: IncomingMessage, id: string): Headers {
  const headers = new Headers({ "x-request-id": id });
  for (const [name, value] of Object.entries(message.headers)) {
    if (name === "cookie" || name === "x-missionmed-timeline-gateway-secret" || name === "x-request-id") continue;
    if (Array.isArray(value)) value.forEach((item) => headers.append(name, item));
    else if (value !== undefined) headers.set(name, value);
  }
  return headers;
}

async function send(response: ServerResponse, webResponse: Response, id: string): Promise<void> {
  response.statusCode = webResponse.status;
  for (const [name, value] of webResponse.headers) response.setHeader(name, value);
  response.setHeader("cache-control", "no-store");
  response.setHeader("x-request-id", id);
  response.end(Buffer.from(await webResponse.arrayBuffer()));
}

function json(value: unknown, status: number): Response {
  return new Response(JSON.stringify(value), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_resolve, reject) => {
        timeout = setTimeout(() => reject(new Error("HEALTH_TIMEOUT")), timeoutMs);
        timeout.unref?.();
      }),
    ]);
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

export function createTimelineProductionHttpHandler(options: TimelineProductionHttpHandlerOptions) {
  const healthTimeoutMs = Math.max(100, Math.min(10_000, options.healthTimeoutMs ?? 4_000));
  const log = options.log ?? (() => {});
  let healthInFlight: Promise<TimelineHealthDependency> | null = null;
  const healthDependency = (): Promise<TimelineHealthDependency> => {
    if (!healthInFlight) {
      healthInFlight = options.health().finally(() => {
        healthInFlight = null;
      });
    }
    return healthInFlight;
  };
  return async (message: IncomingMessage, response: ServerResponse): Promise<void> => {
    const id = requestId(message);
    const path = message.url ? new URL(message.url, "http://timeline.internal").pathname : "/";
    try {
      if (path === "/healthz" && message.method === "GET") {
        try {
          const dependency = await withTimeout(healthDependency(), healthTimeoutMs);
          if (dependency.schemaVersion !== options.expectedSchemaVersion) {
            log({ event: "timeline.health", request_id: id, status: 503, dependency_code: "SCHEMA_VERSION_MISMATCH" });
            await send(response, json({ ok: false, service: "mission-timeline", version: options.releaseVersion, dependency: "SCHEMA_VERSION_MISMATCH" }, 503), id);
            return;
          }
          log({ event: "timeline.health", request_id: id, status: 200, dependency_code: "READY" });
          await send(response, json({ ok: true, service: "mission-timeline", version: options.releaseVersion, schemaVersion: dependency.schemaVersion }, 200), id);
          return;
        } catch (error) {
          const dependency = (error as Error).message === "HEALTH_TIMEOUT" ? "DATABASE_TIMEOUT" : "DATABASE_UNAVAILABLE";
          log({ event: "timeline.health", request_id: id, status: 503, dependency_code: dependency });
          await send(response, json({ ok: false, service: "mission-timeline", version: options.releaseVersion, dependency }, 503), id);
          return;
        }
      }
      if (!path.startsWith("/v1/")) {
        await send(response, json({ error: { code: "ROUTE_NOT_FOUND", message: "Timeline route not found." } }, 404), id);
        return;
      }
      const suppliedGatewaySecret = String(message.headers["x-missionmed-timeline-gateway-secret"] ?? "");
      if (!safeEqual(suppliedGatewaySecret, options.gatewaySecret)) {
        log({ event: "timeline.gateway.denied", request_id: id, status: 403, route_class: "api" });
        await send(response, json({ error: { code: "GATEWAY_REQUIRED", message: "Timeline gateway is required." } }, 403), id);
        return;
      }
      const body = await requestBody(message);
      const request = new Request(`http://timeline.internal${message.url ?? "/"}`, {
        method: message.method,
        headers: nodeHeaders(message, id),
        ...(body ? { body } : {}),
      });
      await send(response, await options.api.handle(request), id);
    } catch (error) {
      const status = error instanceof TimelineError ? error.status : 500;
      const code = error instanceof TimelineError ? error.code : "INTERNAL_ERROR";
      log({ event: "timeline.server.error", request_id: id, status, error_code: code });
      await send(response, json({ error: { code, message: status >= 500 ? "Timeline service error." : String((error as Error).message) } }, status), id);
    }
  };
}
