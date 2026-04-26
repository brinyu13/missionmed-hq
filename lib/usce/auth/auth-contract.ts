/**
 * USCE Auth Contract
 * Authority: MISSIONMED_AUTH_SYSTEM_CONTRACT_v1.2_LOCKED + MM-AUTH-SYSTEM-NOTE
 * Prompt: USCE-PH0A-CLAUDE-HIGH-0A0
 *
 * Defines the type-level contract for /api/auth/exchange and /api/auth/bootstrap.
 * All downstream auth consumers import from this file.
 */

import type { ErrorDefinition } from '../error-codes';

// ---------------------------------------------------------------------------
// 1. Grant types (contract section 5)
// ---------------------------------------------------------------------------

export type GrantType = 'wp_cookie' | 'wp_assertion';

// ---------------------------------------------------------------------------
// 2. Auth modes
// ---------------------------------------------------------------------------

/** MODE A = Arena (student): full Supabase bootstrap, gets refreshToken */
/** MODE B = HQ (admin): bearer-only, no Supabase client auth */
export type AuthMode = 'student' | 'admin';

// ---------------------------------------------------------------------------
// 3. Exchange types
// ---------------------------------------------------------------------------

export interface AuthExchangeRequest {
  /** Grant type: wp_cookie (same-origin proxy) or wp_assertion (cross-origin signed) */
  grant_type: GrantType;

  /** Signed WordPress assertion token (required for wp_assertion grant) */
  assertion?: string;

  /** Single-use exchange nonce for replay protection (32 bytes, hex-encoded) */
  nonce: string;

  /** Target application context */
  app?: 'arena' | 'hq';
}

export interface AuthExchangeResponse {
  /** Encrypted Railway access token */
  accessToken: string;

  /** Refresh token (MODE A / student only; absent for MODE B / admin) */
  refreshToken?: string;

  /** Token expiry as ISO 8601 timestamp */
  expiresAt: string;

  /** Seconds until token expiry */
  expiresIn: number;

  /** Canonical subject: wp:{wp_user_id} */
  subject: string;

  /** User roles from WordPress */
  roles: string[];
}

// ---------------------------------------------------------------------------
// 4. Bootstrap types
// ---------------------------------------------------------------------------

export interface AuthBootstrapRequest {
  /** Railway access token obtained from /exchange */
  accessToken: string;
}

export interface AuthBootstrapResponse {
  /** Supabase access token for client-side session */
  supabase_access_token: string;

  /** Supabase refresh token for client-side session */
  supabase_refresh_token: string;

  /** Seconds until Supabase token expiry */
  expires_in: number;
}

// ---------------------------------------------------------------------------
// 5. Cookie attribute constants (contract section 4 + MM-AUTH-SYSTEM-NOTE section 7)
// ---------------------------------------------------------------------------

export const COOKIE_CONFIG = {
  /** Railway session cookie name */
  SESSION_COOKIE_NAME: 'mm_session',

  /** HttpOnly: prevents client-side JS access */
  HTTP_ONLY: true,

  /** Secure: HTTPS only */
  SECURE: true,

  /** SameSite: Lax (allows top-level navigation) */
  SAME_SITE: 'Lax' as const,

  /** Cookie path scoped to auth API */
  PATH: '/api',

  /** Railway session TTL: 8 hours in seconds */
  SESSION_TTL_SECONDS: 8 * 60 * 60,

  /** Railway access token TTL: 15 minutes in seconds (recommended max per contract 11) */
  ACCESS_TOKEN_TTL_SECONDS: 15 * 60,
} as const;

// ---------------------------------------------------------------------------
// 6. Session attribute schema
// ---------------------------------------------------------------------------

export interface SessionAttributes {
  /** Internal user ID (Supabase auth.uid or equivalent) */
  userId: string;

  /** User email address */
  email: string;

  /** Resolved role (from WordPress roles) */
  role: string;

  /** Auth mode: student (Arena) or admin (HQ) */
  mode: AuthMode;

  /** Session issued at (ISO 8601) */
  issuedAt: string;

  /** Session expires at (ISO 8601) */
  expiresAt: string;

  /** Canonical subject: wp:{wp_user_id} */
  subject: string;

  /** WordPress user ID */
  wpUserId: number;

  /** All WordPress roles */
  roles: string[];
}

// ---------------------------------------------------------------------------
// 7. Replay protection interface
// ---------------------------------------------------------------------------

export interface NonceStore {
  /**
   * Consume a nonce. Returns true if the nonce was valid and unused.
   * Returns false if the nonce was already consumed or expired.
   * Nonce requirements: 32-byte random, hex-encoded (64 chars), 60-second TTL.
   */
  consume(nonce: string): Promise<boolean>;

  /**
   * Generate a new single-use nonce.
   * Returns hex-encoded 32-byte random value.
   */
  generate(): Promise<string>;

  /**
   * Purge expired nonces from the store.
   * Called periodically or on consume().
   */
  purgeExpired(): Promise<number>;
}

export const NONCE_CONFIG = {
  /** Nonce byte length */
  BYTE_LENGTH: 32,

  /** Nonce hex string length (2 chars per byte) */
  HEX_LENGTH: 64,

  /** Nonce TTL in seconds */
  TTL_SECONDS: 60,
} as const;

// ---------------------------------------------------------------------------
// 8. Rate limiter interface
// ---------------------------------------------------------------------------

export interface RateLimiter {
  /**
   * Check if a request from the given IP is within rate limits.
   * Returns true if allowed, false if rate-limited.
   */
  check(ip: string): Promise<boolean>;

  /**
   * Record a request from the given IP.
   */
  record(ip: string): Promise<void>;
}

export const RATE_LIMIT_CONFIG = {
  /** Max exchanges per IP per window */
  MAX_EXCHANGES_PER_WINDOW: 10,

  /** Window duration in seconds */
  WINDOW_SECONDS: 60,
} as const;

// ---------------------------------------------------------------------------
// 9. Identity payload (contract section 3)
// ---------------------------------------------------------------------------

export interface CanonicalIdentity {
  /** Canonical subject: wp:{wp_user_id} */
  sub: string;

  /** WordPress user ID */
  wp_user_id: number;

  /** User email */
  email: string;

  /** Whether email has been verified by WordPress */
  email_verified: boolean;

  /** WordPress roles array */
  roles: string[];

  /** When this identity payload was issued (ISO 8601) */
  issued_at: string;
}

// ---------------------------------------------------------------------------
// 10. WordPress assertion claims (contract section 5)
// ---------------------------------------------------------------------------

export interface WPAssertionClaims {
  /** Issuer: WordPress instance URL */
  iss: string;

  /** Audience: must be 'missionmed-railway-auth' */
  aud: 'missionmed-railway-auth';

  /** Subject: wp:{id} */
  sub: string;

  /** Expiry (Unix timestamp, max 60s after iat) */
  exp: number;

  /** Not before (Unix timestamp) */
  nbf?: number;

  /** Issued at (Unix timestamp) */
  iat: number;

  /** Unique nonce for replay protection */
  jti: string;

  /** WordPress roles */
  roles: string[];

  /** User email */
  email: string;
}

// ---------------------------------------------------------------------------
// 11. Structured auth audit log entry (contract section 14)
// ---------------------------------------------------------------------------

export interface AuthAuditLogEntry {
  timestamp: string;
  requestId: string;
  subject?: string;
  grant_type: GrantType | 'bearer';
  endpoint: '/api/auth/exchange' | '/api/auth/bootstrap' | '/api/auth/session' | '/api/auth/logout' | '/api/auth/start';
  result: 'success' | 'fail';
  error_code?: string;
  issuer?: string;
  ip?: string;
  user_agent?: string;
}

// ---------------------------------------------------------------------------
// 12. Error response helper type
// ---------------------------------------------------------------------------

export interface AuthErrorResponse {
  code: string;
  message: string;
  requestId: string;
  details?: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// 13. Type guards
// ---------------------------------------------------------------------------

export function isValidGrantType(value: unknown): value is GrantType {
  return value === 'wp_cookie' || value === 'wp_assertion';
}

export function isValidAuthMode(value: unknown): value is AuthMode {
  return value === 'student' || value === 'admin';
}

export function isValidNonce(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  return /^[a-f0-9]{64}$/i.test(value);
}
