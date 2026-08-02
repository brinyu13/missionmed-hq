import type { IncomingMessage } from "node:http";
import { randomBytes } from "node:crypto";
import { createRemoteJWKSet, jwtVerify, type JWTPayload } from "jose";
import type { PriqRole } from "../../../packages/mir-core/src/index.ts";

export interface PriqPrincipal {
  userId: string;
  role: Extract<PriqRole, "founder" | "admin">;
}

export class PriqAuthError extends Error {
  constructor(readonly status: number, message: string) { super(message); }
}

const jwksByUrl = new Map<string, ReturnType<typeof createRemoteJWKSet>>();
const browserSessions = new Map<string, { principal: PriqPrincipal; expiresAt: number }>();
const browserSessionTtlMs = 8 * 60 * 60 * 1_000;

function csv(value: string | undefined): Set<string> {
  return new Set(String(value ?? "").split(",").map((item) => item.trim().toLowerCase()).filter(Boolean));
}

function bearer(req: IncomingMessage): string {
  const match = String(req.headers.authorization ?? "").match(/^Bearer\s+(.+)$/iu);
  if (!match?.[1]) throw new PriqAuthError(401, "AUTH_REQUIRED");
  return match[1];
}

function metadata(payload: JWTPayload): Record<string, unknown> {
  return payload.app_metadata && typeof payload.app_metadata === "object" ? payload.app_metadata as Record<string, unknown> : {};
}

function verifiedMissionMedAdmin(payload: JWTPayload): boolean {
  const override = metadata(payload).cam_admin_override;
  if (!override || typeof override !== "object") return false;
  const record = override as Record<string, unknown>;
  const expiresAt = Date.parse(String(record.expires_at ?? ""));
  return record.allowed === true && record.verified === true && record.trusted === true && record.revoked !== true
    && record.capability === "manage_options" && Number.isFinite(expiresAt) && expiresAt > Date.now();
}

async function supabasePrincipal(req: IncomingMessage, env: NodeJS.ProcessEnv): Promise<PriqPrincipal> {
  const base = String(env.MMHQ_SUPABASE_URL ?? env.SUPABASE_URL ?? "").replace(/\/+$/u, "");
  if (!base) throw new PriqAuthError(503, "AUTH_RUNTIME_NOT_CONFIGURED");
  const jwksUrl = String(env.SUPABASE_JWKS_URL ?? `${base}/auth/v1/.well-known/jwks.json`);
  let jwks = jwksByUrl.get(jwksUrl);
  if (!jwks) { jwks = createRemoteJWKSet(new URL(jwksUrl)); jwksByUrl.set(jwksUrl, jwks); }
  let payload: JWTPayload;
  try {
    ({ payload } = await jwtVerify(bearer(req), jwks, { issuer: `${base}/auth/v1`, audience: "authenticated" }));
  } catch (error) {
    if (error instanceof PriqAuthError) throw error;
    throw new PriqAuthError(401, "AUTH_INVALID_OR_EXPIRED");
  }
  if (!payload.sub) throw new PriqAuthError(401, "AUTH_SUBJECT_REQUIRED");
  const meta = metadata(payload);
  const claimedRole = String(meta.priq_role ?? "").toLowerCase();
  const founderIds = csv(env.PRIQ_FOUNDER_USER_IDS);
  const founderEmails = csv(env.PRIQ_FOUNDER_EMAILS);
  const email = String(payload.email ?? "").toLowerCase();
  const founder = claimedRole === "founder" || founderIds.has(payload.sub.toLowerCase()) || Boolean(email && founderEmails.has(email));
  if (founder) return { userId: payload.sub, role: "founder" };
  if (claimedRole === "admin" || verifiedMissionMedAdmin(payload)) return { userId: payload.sub, role: "admin" };
  throw new PriqAuthError(403, "FOUNDER_ADMIN_ONLY");
}

function cookie(req: IncomingMessage, name: string): string | undefined {
  for (const part of String(req.headers.cookie ?? "").split(";")) {
    const [key, ...value] = part.trim().split("=");
    if (key === name) return decodeURIComponent(value.join("="));
  }
  return undefined;
}

function browserPrincipal(req: IncomingMessage): PriqPrincipal | undefined {
  const token = cookie(req, "priq_dev_session");
  if (!token) return undefined;
  const session = browserSessions.get(token);
  if (!session) return undefined;
  if (session.expiresAt <= Date.now()) { browserSessions.delete(token); return undefined; }
  return session.principal;
}

export async function exchangeBearerPrincipal(req: IncomingMessage, env: NodeJS.ProcessEnv = process.env): Promise<PriqPrincipal> {
  if (env.PRIQ_AUTH_MODE !== "supabase") throw new PriqAuthError(409, "SESSION_EXCHANGE_REQUIRES_SUPABASE_AUTH");
  return supabasePrincipal(req, env);
}

export function establishBrowserSession(actor: PriqPrincipal): string {
  const token = randomBytes(32).toString("base64url");
  browserSessions.set(token, { principal: actor, expiresAt: Date.now() + browserSessionTtlMs });
  return `priq_dev_session=${token}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${browserSessionTtlMs / 1_000}`;
}

export async function principal(req: IncomingMessage, env: NodeJS.ProcessEnv = process.env): Promise<PriqPrincipal> {
  if (env.PRIQ_AUTH_MODE === "supabase") {
    const session = browserPrincipal(req);
    return session ?? supabasePrincipal(req, env);
  }
  if (env.PRIQ_DEV_AUTH !== "true") throw new PriqAuthError(503, "AUTH_RUNTIME_NOT_CONFIGURED");
  const remote = req.socket.remoteAddress ?? "";
  if (!remote.includes("127.0.0.1") && remote !== "::1") throw new PriqAuthError(403, "DEV_AUTH_LOOPBACK_ONLY");
  const role = String(req.headers["x-priq-role"] ?? "founder");
  if (role !== "founder" && role !== "admin") throw new PriqAuthError(403, "FOUNDER_ADMIN_ONLY");
  return { userId: String(req.headers["x-priq-user"] ?? "local-founder"), role };
}
