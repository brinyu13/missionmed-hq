/**
 * USCE Session Enforcement
 * Authority: W-028 + W-025
 * Prompt: USCE-PH0A-CLAUDE-HIGH-0A2
 *
 * Enforces authenticated identity for USCE API routes.
 * Integrates with detect-context.ts (Step 0.1) for route classification,
 * then applies mode-specific session enforcement.
 *
 * CRITICAL RULES:
 *   Student mode: supabase.auth.getUser() is the ONLY identity source
 *   Admin mode: Bearer token (Railway encrypted session) is the ONLY identity source
 *   Portal token is NEVER used for identity in either mode
 *   Failed auth MUST stop execution (throw, never return null)
 */

import { createClient } from '@supabase/supabase-js';
import { createHash, createDecipheriv } from 'crypto';
import type { AuthMode, SessionAttributes } from './auth-contract';
import { COOKIE_CONFIG } from './auth-contract';
import {
  detectAuthContext,
  type AuthContext,
  type DetectContextInput,
} from './detect-context';
import {
  AUTH_SESSION_MISSING,
  AUTH_SESSION_EXPIRED,
  AUTH_SESSION_INVALID,
  AUTH_BEARER_MISSING,
  AUTH_BEARER_EXPIRED,
  AUTH_BEARER_INVALID,
  AUTH_CONTEXT_AMBIGUOUS,
  AUTH_CONTEXT_MISMATCH,
  type ErrorDefinition,
} from '../error-codes';

// ---------------------------------------------------------------------------
// Environment
// ---------------------------------------------------------------------------

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'https://fglyvdykwgbuivikqoah.supabase.co';
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';
const SESSION_SECRET = process.env.MMHQ_SESSION_SECRET ?? '';

// ---------------------------------------------------------------------------
// Auth enforcement error (thrown, never returned as null)
// ---------------------------------------------------------------------------

export class AuthEnforcementError extends Error {
  public readonly definition: ErrorDefinition;
  public readonly requestId: string;
  public readonly details?: Record<string, unknown>;

  constructor(
    definition: ErrorDefinition,
    requestId: string,
    details?: Record<string, unknown>
  ) {
    super(definition.message);
    this.name = 'AuthEnforcementError';
    this.definition = definition;
    this.requestId = requestId;
    this.details = details;
  }

  /** Build a JSON-safe error response body */
  toResponse(): { status: number; body: { code: string; message: string; requestId: string; details?: Record<string, unknown> } } {
    return {
      status: this.definition.status,
      body: {
        code: this.definition.code,
        message: this.definition.message,
        requestId: this.requestId,
        ...(this.details ? { details: this.details } : {}),
      },
    };
  }
}

// ---------------------------------------------------------------------------
// Student session identity (returned on success)
// ---------------------------------------------------------------------------

export interface StudentIdentity {
  mode: 'student';
  userId: string;
  email: string;
  role: string;
  /** Portal token (CONTEXT only: which offer to display, NOT identity) */
  portalToken?: string;
}

// ---------------------------------------------------------------------------
// Admin session identity (returned on success)
// ---------------------------------------------------------------------------

export interface AdminIdentity {
  mode: 'admin';
  userId: string;
  email: string;
  role: string;
  roles: string[];
  accessToken: string;
  subject: string;
  wpUserId: number;
}

// ---------------------------------------------------------------------------
// Unified enforcement result
// ---------------------------------------------------------------------------

export type EnforcedIdentity = StudentIdentity | AdminIdentity;

// ---------------------------------------------------------------------------
// Bearer token decryption (AES-256-GCM, matches exchange encryption)
// ---------------------------------------------------------------------------

function deriveKey(secret: string): Buffer {
  return createHash('sha256').update(secret).digest();
}

function decryptBearerToken(token: string): SessionAttributes | null {
  try {
    if (!SESSION_SECRET) return null;

    const key = deriveKey(SESSION_SECRET);
    const raw = Buffer.from(token, 'base64url');

    // Format: iv (12 bytes) + authTag (16 bytes) + ciphertext
    if (raw.length < 28) return null;

    const iv = raw.subarray(0, 12);
    const tag = raw.subarray(12, 28);
    const ciphertext = raw.subarray(28);

    const decipher = createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(tag);

    const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
    return JSON.parse(decrypted.toString('utf8')) as SessionAttributes;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// 1. enforceStudentSession
// ---------------------------------------------------------------------------

/**
 * Enforce student identity via Supabase session.
 *
 * Identity source: supabase.auth.getUser() ONLY
 * Portal token: extracted as context, NEVER used for identity
 *
 * The student must have completed the full bootstrap chain:
 *   exchange -> bootstrap -> setSession -> getUser
 *
 * Throws AuthEnforcementError on failure. Never returns null.
 *
 * @param supabaseAccessToken  Supabase JWT from Authorization header
 * @param requestId            Request ID for error tracking
 * @param portalToken          Optional portal token (context only)
 */
export async function enforceStudentSession(
  supabaseAccessToken: string | null | undefined,
  requestId: string,
  portalToken?: string
): Promise<StudentIdentity> {
  // ---- Check token presence ----
  if (!supabaseAccessToken) {
    throw new AuthEnforcementError(AUTH_SESSION_MISSING, requestId, {
      reason: 'No Supabase access token provided. Student must complete the bootstrap chain: exchange -> bootstrap -> setSession -> getUser.',
    });
  }

  // ---- Create Supabase client with the student token ----
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: {
      headers: { Authorization: `Bearer ${supabaseAccessToken}` },
    },
  });

  // ---- Call getUser() as the ONLY identity source ----
  let data;
  let error;
  try {
    const result = await supabase.auth.getUser();
    data = result.data;
    error = result.error;
  } catch (err) {
    throw new AuthEnforcementError(AUTH_SESSION_INVALID, requestId, {
      reason: 'Supabase getUser() threw an unexpected error.',
      error: err instanceof Error ? err.message : String(err),
    });
  }

  // ---- Handle getUser errors ----
  if (error) {
    // Distinguish expired from invalid
    const isExpired =
      error.message?.toLowerCase().includes('expired') ||
      error.message?.toLowerCase().includes('jwt expired') ||
      error.status === 401;

    if (isExpired) {
      throw new AuthEnforcementError(AUTH_SESSION_EXPIRED, requestId, {
        reason: 'Supabase session token has expired. Student must re-authenticate.',
      });
    }

    throw new AuthEnforcementError(AUTH_SESSION_INVALID, requestId, {
      reason: 'Supabase getUser() returned an error.',
      supabaseError: error.message,
    });
  }

  // ---- Validate user data ----
  if (!data?.user?.id) {
    throw new AuthEnforcementError(AUTH_SESSION_INVALID, requestId, {
      reason: 'Supabase getUser() returned no user data.',
    });
  }

  // ---- Extract role from user metadata ----
  const metadata = data.user.user_metadata ?? {};
  const role = metadata.roles?.[0] ?? metadata.role ?? 'student';

  return {
    mode: 'student',
    userId: data.user.id,
    email: data.user.email ?? '',
    role,
    portalToken,
  };
}

// ---------------------------------------------------------------------------
// 2. enforceAdminSession
// ---------------------------------------------------------------------------

/**
 * Enforce admin identity via Railway Bearer token.
 *
 * Identity source: Bearer token decryption ONLY
 * MUST NOT call supabase.auth.setSession() or getUser()
 *
 * Throws AuthEnforcementError on failure. Never returns null.
 *
 * @param bearerToken  Railway encrypted access token from Authorization header
 * @param requestId    Request ID for error tracking
 */
export async function enforceAdminSession(
  bearerToken: string | null | undefined,
  requestId: string
): Promise<AdminIdentity> {
  // ---- Check token presence ----
  if (!bearerToken) {
    throw new AuthEnforcementError(AUTH_BEARER_MISSING, requestId, {
      reason: 'No Authorization Bearer token found. Admin must complete exchange flow.',
    });
  }

  // ---- Decrypt and validate session ----
  const session = decryptBearerToken(bearerToken);

  if (!session) {
    throw new AuthEnforcementError(AUTH_BEARER_INVALID, requestId, {
      reason: 'Bearer token decryption failed. Token may be malformed or encrypted with a different key.',
    });
  }

  // ---- Check expiry ----
  const expiresAt = new Date(session.expiresAt).getTime();
  if (Number.isNaN(expiresAt) || expiresAt < Date.now()) {
    throw new AuthEnforcementError(AUTH_BEARER_EXPIRED, requestId, {
      reason: 'Bearer token has expired.',
      expiresAt: session.expiresAt,
      serverTime: new Date().toISOString(),
    });
  }

  // ---- Validate session attributes ----
  if (!session.userId || !session.email || !session.subject) {
    throw new AuthEnforcementError(AUTH_BEARER_INVALID, requestId, {
      reason: 'Decrypted session is missing required identity fields.',
      hasUserId: !!session.userId,
      hasEmail: !!session.email,
      hasSubject: !!session.subject,
    });
  }

  // ---- Return admin identity (no Supabase calls) ----
  return {
    mode: 'admin',
    userId: session.userId,
    email: session.email,
    role: session.role,
    roles: session.roles,
    accessToken: bearerToken,
    subject: session.subject,
    wpUserId: session.wpUserId,
  };
}

// ---------------------------------------------------------------------------
// 3. enforceAuth (unified entry point)
// ---------------------------------------------------------------------------

/**
 * Unified auth enforcement for all USCE routes.
 *
 * 1. Calls detectAuthContext() to classify route and extract signals
 * 2. Routes to enforceStudentSession or enforceAdminSession based on mode
 * 3. Returns typed identity with mode
 *
 * System routes are NOT handled here. They use their own verification
 * (Stripe sig, Postmark HMAC, cron secret) inside their route handlers.
 * Calling enforceAuth on a system route will throw AUTH_CONTEXT_MISMATCH.
 *
 * Throws AuthEnforcementError on any failure. Never returns null.
 *
 * @param input       Pathname, headers, and optional search params
 * @param requestId   Request ID for error tracking
 */
export async function enforceAuth(
  input: DetectContextInput,
  requestId: string
): Promise<EnforcedIdentity> {
  // ---- Step 1: Detect context ----
  const result = await detectAuthContext(input, requestId);

  // Handle detection errors
  if (result.error) {
    throw new AuthEnforcementError(
      result.error.definition,
      requestId,
      result.error.details
    );
  }

  const ctx = result.context;

  // ---- Step 2: System routes are not handled by enforceAuth ----
  if (ctx.routeClass === 'system') {
    throw new AuthEnforcementError(AUTH_CONTEXT_MISMATCH, requestId, {
      reason: 'System routes must not use enforceAuth(). Use system-specific verification in the route handler.',
      routeClass: ctx.routeClass,
      pathname: input.pathname,
    });
  }

  // ---- Step 3: Route to mode-specific enforcement ----
  if (ctx.mode === 'student') {
    // Student: extract Supabase JWT from Authorization header
    const authHeader = input.headers.get('authorization');
    const supabaseToken = authHeader?.startsWith('Bearer ')
      ? authHeader.slice(7).trim()
      : null;

    return enforceStudentSession(supabaseToken, requestId, ctx.portalToken);
  }

  if (ctx.mode === 'admin') {
    return enforceAdminSession(ctx.bearerToken, requestId);
  }

  // ---- Unreachable: mode should always be set for non-system routes ----
  throw new AuthEnforcementError(AUTH_CONTEXT_AMBIGUOUS, requestId, {
    reason: 'Auth mode was not resolved by context detection.',
    routeClass: ctx.routeClass,
    pathname: input.pathname,
  });
}

// ---------------------------------------------------------------------------
// Convenience: wrap a Next.js route handler with auth enforcement
// ---------------------------------------------------------------------------

import { NextRequest, NextResponse } from 'next/server';
import { randomBytes } from 'crypto';

/**
 * Generate a request ID for tracking.
 */
function generateRequestId(prefix: string = 'usce'): string {
  return `${prefix}_${Date.now().toString(36)}_${randomBytes(6).toString('hex')}`;
}

/**
 * Higher-order function that wraps a Next.js route handler with auth enforcement.
 * Automatically handles AuthEnforcementError and returns proper JSON error responses.
 *
 * Usage:
 *   export const POST = withAuth(async (request, identity) => {
 *     // identity is StudentIdentity | AdminIdentity
 *     // identity.mode tells you which one
 *     return NextResponse.json({ ok: true });
 *   });
 */
export function withAuth(
  handler: (request: NextRequest, identity: EnforcedIdentity, requestId: string) => Promise<NextResponse>
): (request: NextRequest) => Promise<NextResponse> {
  return async (request: NextRequest) => {
    const requestId = generateRequestId();
    const url = new URL(request.url);

    try {
      const identity = await enforceAuth(
        {
          pathname: url.pathname,
          headers: request.headers,
          searchParams: url.searchParams,
        },
        requestId
      );

      return handler(request, identity, requestId);
    } catch (err) {
      if (err instanceof AuthEnforcementError) {
        const { status, body } = err.toResponse();
        return NextResponse.json(body, {
          status,
          headers: { 'Cache-Control': 'no-store' },
        });
      }

      // Unexpected error
      return NextResponse.json(
        {
          code: 'INTERNAL_ERROR',
          message: 'An unexpected authentication error occurred.',
          requestId,
        },
        {
          status: 500,
          headers: { 'Cache-Control': 'no-store' },
        }
      );
    }
  };
}

/**
 * Variant: wrap a handler that expects student-only access.
 * Throws AUTH_CONTEXT_MISMATCH if an admin token is presented on a student route.
 */
export function withStudentAuth(
  handler: (request: NextRequest, identity: StudentIdentity, requestId: string) => Promise<NextResponse>
): (request: NextRequest) => Promise<NextResponse> {
  return withAuth(async (request, identity, requestId) => {
    if (identity.mode !== 'student') {
      throw new AuthEnforcementError(AUTH_CONTEXT_MISMATCH, requestId, {
        reason: 'This route requires student authentication.',
        expected: 'student',
        received: identity.mode,
      });
    }
    return handler(request, identity as StudentIdentity, requestId);
  });
}

/**
 * Variant: wrap a handler that expects admin-only access.
 * Throws AUTH_CONTEXT_MISMATCH if a student token is presented on an admin route.
 */
export function withAdminAuth(
  handler: (request: NextRequest, identity: AdminIdentity, requestId: string) => Promise<NextResponse>
): (request: NextRequest) => Promise<NextResponse> {
  return withAuth(async (request, identity, requestId) => {
    if (identity.mode !== 'admin') {
      throw new AuthEnforcementError(AUTH_CONTEXT_MISMATCH, requestId, {
        reason: 'This route requires admin authentication.',
        expected: 'admin',
        received: identity.mode,
      });
    }
    return handler(request, identity as AdminIdentity, requestId);
  });
}
