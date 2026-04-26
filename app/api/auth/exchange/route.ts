/**
 * POST /api/auth/exchange
 * Authority: MISSIONMED_AUTH_SYSTEM_CONTRACT_v1.2_LOCKED (section 6)
 * Prompt: USCE-PH0A-CLAUDE-HIGH-0A0
 *
 * Converts WordPress identity proof into Railway auth state.
 * Accepted grant types: wp_cookie, wp_assertion
 *
 * MODE A (student/Arena): returns { accessToken, refreshToken, expiresAt }
 * MODE B (admin/HQ): returns { accessToken, expiresAt } (no refreshToken)
 *
 * Anti-replay: single-use nonce, 32-byte, 60s TTL
 * Rate limit: 10 exchanges per IP per minute
 */

import { NextRequest, NextResponse } from 'next/server';
import { randomBytes, createHash, createCipheriv, createDecipheriv } from 'crypto';
import {
  type AuthExchangeRequest,
  type AuthExchangeResponse,
  type AuthMode,
  type CanonicalIdentity,
  type AuthAuditLogEntry,
  type SessionAttributes,
  COOKIE_CONFIG,
  NONCE_CONFIG,
  RATE_LIMIT_CONFIG,
  isValidGrantType,
  isValidNonce,
} from '@/lib/usce/auth/auth-contract';
import {
  EXCHANGE_WP_SESSION_INVALID,
  EXCHANGE_RAILWAY_UNREACHABLE,
  EXCHANGE_NONCE_REPLAYED,
  EXCHANGE_RATE_LIMITED,
  EXCHANGE_INVALID_GRANT,
  EXCHANGE_ROLE_MISMATCH,
  EXCHANGE_IDENTITY_CONFLICT,
  buildErrorResponse,
  type USCEError,
} from '@/lib/usce/error-codes';

// ---------------------------------------------------------------------------
// Environment
// ---------------------------------------------------------------------------

const RAILWAY_AUTH_URL = process.env.MMHQ_RAILWAY_URL ?? 'https://missionmed-hq-production.up.railway.app';
const WP_AUTH_ENDPOINT = process.env.MMHQ_WP_AUTH_ENDPOINT ?? '';
const SESSION_SECRET = process.env.MMHQ_SESSION_SECRET ?? '';
const ALLOWED_WP_ROLES = (process.env.MMHQ_ALLOWED_WP_ROLES ?? 'administrator').split(',').map(r => r.trim());

// ---------------------------------------------------------------------------
// In-memory nonce store (production should use Redis or similar)
// ---------------------------------------------------------------------------

const nonceStore = new Map<string, number>(); // nonce -> expiresAt (unix ms)

function purgeExpiredNonces(): void {
  const now = Date.now();
  for (const [nonce, expiresAt] of nonceStore) {
    if (expiresAt <= now) {
      nonceStore.delete(nonce);
    }
  }
}

function consumeNonce(nonce: string): boolean {
  purgeExpiredNonces();
  if (nonceStore.has(nonce)) {
    // Nonce already consumed or still in window from a prior request
    nonceStore.delete(nonce);
    return false; // replay detected
  }
  // Mark as consumed with TTL
  nonceStore.set(nonce, Date.now() + NONCE_CONFIG.TTL_SECONDS * 1000);
  return true;
}

// ---------------------------------------------------------------------------
// In-memory rate limiter (production should use Redis sliding window)
// ---------------------------------------------------------------------------

const rateLimitStore = new Map<string, { count: number; windowStart: number }>();

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimitStore.get(ip);

  if (!entry || now - entry.windowStart > RATE_LIMIT_CONFIG.WINDOW_SECONDS * 1000) {
    rateLimitStore.set(ip, { count: 1, windowStart: now });
    return true;
  }

  if (entry.count >= RATE_LIMIT_CONFIG.MAX_EXCHANGES_PER_WINDOW) {
    return false;
  }

  entry.count += 1;
  return true;
}

// ---------------------------------------------------------------------------
// Session encryption (AES-256-GCM)
// ---------------------------------------------------------------------------

function deriveKey(secret: string): Buffer {
  return createHash('sha256').update(secret).digest();
}

function encryptSession(payload: SessionAttributes): string {
  const key = deriveKey(SESSION_SECRET);
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);

  const json = JSON.stringify(payload);
  const encrypted = Buffer.concat([cipher.update(json, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();

  // Format: base64(iv + tag + ciphertext)
  return Buffer.concat([iv, tag, encrypted]).toString('base64url');
}

// ---------------------------------------------------------------------------
// Request ID generator
// ---------------------------------------------------------------------------

function generateRequestId(): string {
  return `exch_${Date.now().toString(36)}_${randomBytes(8).toString('hex')}`;
}

// ---------------------------------------------------------------------------
// Resolve auth mode from roles
// ---------------------------------------------------------------------------

function resolveAuthMode(roles: string[]): AuthMode {
  // If user has any admin-level role, they get MODE B (admin)
  const adminRoles = ALLOWED_WP_ROLES;
  const hasAdminRole = roles.some(r => adminRoles.includes(r));
  return hasAdminRole ? 'admin' : 'student';
}

// ---------------------------------------------------------------------------
// WordPress session validation via Railway
// ---------------------------------------------------------------------------

async function validateWordPressSession(
  grantType: 'wp_cookie' | 'wp_assertion',
  headers: Headers,
  assertion?: string
): Promise<{ identity: CanonicalIdentity; error?: never } | { identity?: never; error: typeof EXCHANGE_WP_SESSION_INVALID | typeof EXCHANGE_RAILWAY_UNREACHABLE | typeof EXCHANGE_ROLE_MISMATCH }> {
  try {
    const validationUrl = `${RAILWAY_AUTH_URL}/api/auth/validate-wp`;

    const requestBody: Record<string, unknown> = {
      grant_type: grantType,
    };

    if (grantType === 'wp_assertion' && assertion) {
      requestBody.assertion = assertion;
    }

    // Forward relevant cookies for wp_cookie grant
    const forwardHeaders: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (grantType === 'wp_cookie') {
      const cookieHeader = headers.get('cookie');
      if (!cookieHeader) {
        return { error: EXCHANGE_WP_SESSION_INVALID };
      }
      // Forward only WordPress auth cookies, not the full jar (contract section 9)
      const wpCookies = cookieHeader
        .split(';')
        .map(c => c.trim())
        .filter(c => c.startsWith('wordpress_logged_in_') || c.startsWith('wordpress_sec_'))
        .join('; ');

      if (!wpCookies) {
        return { error: EXCHANGE_WP_SESSION_INVALID };
      }
      forwardHeaders['Cookie'] = wpCookies;
    }

    const response = await fetch(validationUrl, {
      method: 'POST',
      headers: forwardHeaders,
      body: JSON.stringify(requestBody),
      signal: AbortSignal.timeout(10000), // 10s timeout
    });

    if (!response.ok) {
      if (response.status === 401) {
        return { error: EXCHANGE_WP_SESSION_INVALID };
      }
      if (response.status === 403) {
        return { error: EXCHANGE_ROLE_MISMATCH };
      }
      return { error: EXCHANGE_RAILWAY_UNREACHABLE };
    }

    const data = await response.json() as CanonicalIdentity;

    // Validate canonical identity shape
    if (!data.sub || !data.wp_user_id || !data.email || !Array.isArray(data.roles)) {
      return { error: EXCHANGE_WP_SESSION_INVALID };
    }

    // Validate subject format: wp:{id}
    if (!data.sub.startsWith('wp:')) {
      return { error: EXCHANGE_WP_SESSION_INVALID };
    }

    // Role check
    if (!data.roles.some(r => ALLOWED_WP_ROLES.includes(r)) && resolveAuthMode(data.roles) === 'admin') {
      return { error: EXCHANGE_ROLE_MISMATCH };
    }

    return { identity: data };
  } catch (err) {
    // Network errors, timeouts
    return { error: EXCHANGE_RAILWAY_UNREACHABLE };
  }
}

// ---------------------------------------------------------------------------
// Audit logger (structured, contract section 14)
// ---------------------------------------------------------------------------

function emitAuditLog(entry: AuthAuditLogEntry): void {
  // In production, this writes to structured log sink (e.g., Railway logs, Datadog)
  // For now, console.log with JSON structure
  console.log(JSON.stringify({ ...entry, _type: 'auth_audit' }));
}

// ---------------------------------------------------------------------------
// POST handler
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest) {
  const requestId = generateRequestId();
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    ?? request.headers.get('x-real-ip')
    ?? 'unknown';

  // ---- Rate limit check ----
  if (!checkRateLimit(ip)) {
    const { status, body } = buildErrorResponse(EXCHANGE_RATE_LIMITED, requestId, { ip });
    emitAuditLog({
      timestamp: new Date().toISOString(),
      requestId,
      grant_type: 'wp_cookie',
      endpoint: '/api/auth/exchange',
      result: 'fail',
      error_code: EXCHANGE_RATE_LIMITED.code,
      ip,
    });
    return NextResponse.json(body, {
      status,
      headers: { 'Cache-Control': 'no-store' },
    });
  }

  // ---- Parse body ----
  let body: AuthExchangeRequest;
  try {
    body = await request.json() as AuthExchangeRequest;
  } catch {
    const { status, body: errBody } = buildErrorResponse(EXCHANGE_INVALID_GRANT, requestId, {
      reason: 'Malformed request body',
    });
    return NextResponse.json(errBody, {
      status,
      headers: { 'Cache-Control': 'no-store' },
    });
  }

  // ---- Validate grant_type ----
  if (!isValidGrantType(body.grant_type)) {
    const { status, body: errBody } = buildErrorResponse(EXCHANGE_INVALID_GRANT, requestId, {
      received: body.grant_type,
      supported: ['wp_cookie', 'wp_assertion'],
    });
    emitAuditLog({
      timestamp: new Date().toISOString(),
      requestId,
      grant_type: 'wp_cookie',
      endpoint: '/api/auth/exchange',
      result: 'fail',
      error_code: EXCHANGE_INVALID_GRANT.code,
      ip,
    });
    return NextResponse.json(errBody, {
      status,
      headers: { 'Cache-Control': 'no-store' },
    });
  }

  // ---- Validate nonce (anti-replay) ----
  if (!isValidNonce(body.nonce)) {
    const { status, body: errBody } = buildErrorResponse(EXCHANGE_NONCE_REPLAYED, requestId, {
      reason: 'Nonce must be a 64-character hex string (32 bytes)',
    });
    return NextResponse.json(errBody, {
      status,
      headers: { 'Cache-Control': 'no-store' },
    });
  }

  if (!consumeNonce(body.nonce)) {
    const { status, body: errBody } = buildErrorResponse(EXCHANGE_NONCE_REPLAYED, requestId);
    emitAuditLog({
      timestamp: new Date().toISOString(),
      requestId,
      grant_type: body.grant_type,
      endpoint: '/api/auth/exchange',
      result: 'fail',
      error_code: EXCHANGE_NONCE_REPLAYED.code,
      ip,
    });
    return NextResponse.json(errBody, {
      status,
      headers: { 'Cache-Control': 'no-store' },
    });
  }

  // ---- Validate WordPress session via Railway ----
  const validationResult = await validateWordPressSession(
    body.grant_type,
    request.headers,
    body.assertion
  );

  if (validationResult.error) {
    const errorDef = validationResult.error;
    const { status, body: errBody } = buildErrorResponse(errorDef, requestId);
    emitAuditLog({
      timestamp: new Date().toISOString(),
      requestId,
      grant_type: body.grant_type,
      endpoint: '/api/auth/exchange',
      result: 'fail',
      error_code: errorDef.code,
      ip,
    });
    return NextResponse.json(errBody, {
      status,
      headers: { 'Cache-Control': 'no-store' },
    });
  }

  const identity = validationResult.identity;

  // ---- Resolve auth mode ----
  const mode = resolveAuthMode(identity.roles);
  const isStudent = mode === 'student';

  // ---- Build session attributes ----
  const now = new Date();
  const expiresAt = new Date(now.getTime() + COOKIE_CONFIG.ACCESS_TOKEN_TTL_SECONDS * 1000);

  const session: SessionAttributes = {
    userId: identity.sub,
    email: identity.email,
    role: identity.roles[0] ?? 'subscriber',
    mode,
    issuedAt: now.toISOString(),
    expiresAt: expiresAt.toISOString(),
    subject: identity.sub,
    wpUserId: identity.wp_user_id,
    roles: identity.roles,
  };

  // ---- Encrypt session into access token ----
  const accessToken = encryptSession(session);

  // ---- Build refresh token for MODE A (student) only ----
  let refreshToken: string | undefined;
  if (isStudent) {
    const refreshPayload: SessionAttributes = {
      ...session,
      expiresAt: new Date(now.getTime() + COOKIE_CONFIG.SESSION_TTL_SECONDS * 1000).toISOString(),
    };
    refreshToken = encryptSession(refreshPayload);
  }

  // ---- Build response ----
  const responseBody: AuthExchangeResponse = {
    accessToken,
    expiresAt: expiresAt.toISOString(),
    expiresIn: COOKIE_CONFIG.ACCESS_TOKEN_TTL_SECONDS,
    subject: identity.sub,
    roles: identity.roles,
    ...(refreshToken ? { refreshToken } : {}),
  };

  // ---- Set session cookie (contract section 4) ----
  const cookieValue = encryptSession({
    ...session,
    expiresAt: new Date(now.getTime() + COOKIE_CONFIG.SESSION_TTL_SECONDS * 1000).toISOString(),
  });

  const response = NextResponse.json(responseBody, {
    status: 200,
    headers: { 'Cache-Control': 'no-store' },
  });

  response.cookies.set(COOKIE_CONFIG.SESSION_COOKIE_NAME, cookieValue, {
    httpOnly: COOKIE_CONFIG.HTTP_ONLY,
    secure: COOKIE_CONFIG.SECURE,
    sameSite: COOKIE_CONFIG.SAME_SITE.toLowerCase() as 'lax',
    path: COOKIE_CONFIG.PATH,
    maxAge: COOKIE_CONFIG.SESSION_TTL_SECONDS,
  });

  // ---- Audit log ----
  emitAuditLog({
    timestamp: now.toISOString(),
    requestId,
    subject: identity.sub,
    grant_type: body.grant_type,
    endpoint: '/api/auth/exchange',
    result: 'success',
    ip,
    user_agent: request.headers.get('user-agent') ?? undefined,
  });

  return response;
}
