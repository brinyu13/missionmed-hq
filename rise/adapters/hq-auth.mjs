import { createHmac } from "node:crypto";

const MAX_RESPONSE_BYTES = 64 * 1024;
const DEFAULT_TIMEOUT_MS = 5_000;

function requiredString(value, name, minimumLength = 1) {
  const normalized = String(value ?? "").trim();
  if (normalized.length < minimumLength) throw new Error(`${name} is required`);
  return normalized;
}

function sessionEndpoint(value, { allowInsecureLoopback = false } = {}) {
  const url = new URL(requiredString(value, "RISE_HQ_AUTH_SESSION_URL"));
  const loopback = new Set(["127.0.0.1", "localhost", "::1"]);
  if (url.username || url.password || url.hash || url.pathname !== "/api/auth/session") {
    throw new Error("RISE_HQ_AUTH_SESSION_URL must identify the exact HQ session endpoint");
  }
  if (url.protocol !== "https:" && !(allowInsecureLoopback && url.protocol === "http:" && loopback.has(url.hostname))) {
    throw new Error("RISE_HQ_AUTH_SESSION_URL must use HTTPS");
  }
  url.search = "";
  url.searchParams.set("audience", "rise");
  return url;
}

function cookieValue(cookieHeader, name) {
  for (const part of String(cookieHeader ?? "").split(";")) {
    const separator = part.indexOf("=");
    if (separator < 1) continue;
    if (part.slice(0, separator).trim() === name) return part.slice(separator + 1).trim();
  }
  return "";
}

async function parseJsonResponse(response) {
  const declaredLength = Number(response.headers.get("content-length") ?? 0);
  if (declaredLength > MAX_RESPONSE_BYTES) throw new Error("HQ auth response exceeds the RISE limit");
  const chunks = [];
  let total = 0;
  for await (const chunk of response.body ?? []) {
    const bytes = Buffer.from(chunk);
    total += bytes.length;
    if (total > MAX_RESPONSE_BYTES) throw new Error("HQ auth response exceeds the RISE limit");
    chunks.push(bytes);
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

export function createHqAuthenticator({
  authSessionUrl = process.env.RISE_HQ_AUTH_SESSION_URL,
  sessionCookieName = process.env.RISE_HQ_SESSION_COOKIE_NAME ?? "mmhq_session",
  bindingHmacKey = process.env.RISE_SESSION_BINDING_HMAC_KEY,
  timeoutMs = Number.parseInt(process.env.RISE_AUTH_TIMEOUT_MS ?? String(DEFAULT_TIMEOUT_MS), 10),
  allowInsecureLoopback = process.env.RISE_ALLOW_INSECURE_LOOPBACK_AUTH === "true",
  fetchImpl = globalThis.fetch,
  now = Date.now,
} = {}) {
  const endpoint = sessionEndpoint(authSessionUrl, { allowInsecureLoopback });
  const cookieName = requiredString(sessionCookieName, "RISE_HQ_SESSION_COOKIE_NAME");
  if (!/^[!#$%&'*+.^_`|~0-9A-Za-z-]+$/.test(cookieName)) {
    throw new Error("RISE_HQ_SESSION_COOKIE_NAME is invalid");
  }
  const hmacKey = requiredString(bindingHmacKey, "RISE_SESSION_BINDING_HMAC_KEY", 32);
  if (typeof fetchImpl !== "function") throw new Error("A fetch implementation is required");
  if (!Number.isInteger(timeoutMs) || timeoutMs < 250 || timeoutMs > 15_000) {
    throw new Error("RISE_AUTH_TIMEOUT_MS must be between 250 and 15000");
  }

  return async function authenticateRiseRequest(request) {
    if (request.headers.authorization) return null;
    const cookie = cookieValue(request.headers.cookie, cookieName);
    if (!cookie) return null;
    let response;
    try {
      response = await fetchImpl(endpoint, {
        method: "GET",
        headers: {
          Accept: "application/json",
          Cookie: `${cookieName}=${cookie}`,
        },
        cache: "no-store",
        redirect: "error",
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch {
      return null;
    }
    if (!response.ok || !String(response.headers.get("content-type") ?? "").toLowerCase().includes("application/json")) {
      return null;
    }
    let payload;
    try {
      payload = await parseJsonResponse(response);
    } catch {
      return null;
    }
    const expiresAt = Date.parse(String(payload?.expiresAt ?? ""));
    const userId = String(payload?.user?.id ?? "").trim();
    const csrfToken = String(payload?.csrfToken ?? "");
    if (
      payload?.authenticated !== true ||
      payload?.sessionPersistent !== true ||
      payload?.revoked === true ||
      payload?.revokedAt ||
      payload?.authAudience !== "rise" ||
      !userId || userId.length > 128 ||
      !Number.isFinite(expiresAt) || expiresAt <= now() ||
      !/^[A-Za-z0-9_-]{24,256}$/.test(csrfToken)
    ) {
      return null;
    }
    const roles = Array.isArray(payload.user?.roles)
      ? payload.user.roles.map((role) => String(role).trim().toLowerCase())
      : [];
    const admin = roles.includes("administrator");
    const subject = `wp:${userId}`;
    const sessionId = createHmac("sha256", hmacKey)
      .update("rise-hq-session-v1\0")
      .update(cookie)
      .update("\0")
      .update(subject)
      .update("\0")
      .update(String(payload.expiresAt))
      .digest("hex");
    return {
      subject,
      role: admin ? "admin" : "student",
      audience: "rise",
      issuer: endpoint.origin,
      capabilities: admin
        ? ["rise:read", "rise:operator", "rise:admin"]
        : ["rise:read"],
      sessionId,
      csrfToken,
      validatedAt: new Date(now()).toISOString(),
      expiresAt: new Date(expiresAt).toISOString(),
    };
  };
}

let defaultAuthenticator;

export async function authenticateRiseRequest(request) {
  defaultAuthenticator ??= createHqAuthenticator();
  return defaultAuthenticator(request);
}
