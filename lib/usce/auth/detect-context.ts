/**
 * USCE Auth Context Detection
 * Authority: W-028 + W-025
 * Prompt: USCE-PH0A-CLAUDE-HIGH-0A1
 *
 * Deterministic auth context resolver for all USCE API routes.
 * Classifies route FIRST, then applies mode-specific detection.
 *
 * Three route classes:
 *   STUDENT: /api/usce/portal/*  (requires Supabase session via getUser)
 *   ADMIN:   /api/usce/requests/*, offers/*, confirmations/*, programs/*, search/*, analytics/*
 *            (requires Authorization: Bearer header)
 *   SYSTEM:  /api/usce/webhook/*, cron/*, health
 *            (requires signature/secret, EXEMPT from MODE A/B detection)
 *
 * Portal token = CONTEXT only (which offer to display), NOT identity.
 * Identity MUST come from session (getUser for student, Bearer for admin).
 */

import { createClient } from '@supabase/supabase-js';
import type { AuthMode } from './auth-contract';
import {
  AUTH_CONTEXT_AMBIGUOUS,
  AUTH_SYSTEM_SECRET_INVALID,
  buildErrorResponse,
  type ErrorDefinition,
} from '../error-codes';

// ---------------------------------------------------------------------------
// Re-export AuthMode from auth-contract (single source)
// ---------------------------------------------------------------------------

export type { AuthMode } from './auth-contract';

// ---------------------------------------------------------------------------
// Route class
// ---------------------------------------------------------------------------

export type RouteClass = 'student' | 'admin' | 'system';

// ---------------------------------------------------------------------------
// System auth method (for system routes)
// ---------------------------------------------------------------------------

export type SystemAuthMethod = 'stripe_signature' | 'cron_secret' | 'postmark_hmac' | 'internal_secret';

// ---------------------------------------------------------------------------
// Auth context (returned to callers)
// ---------------------------------------------------------------------------

export interface AuthContext {
  /** Resolved auth mode: student or admin. Undefined for system routes. */
  mode?: AuthMode;

  /** Route classification (always present) */
  routeClass: RouteClass;

  /** Whether identity has been verified (getUser for student, Bearer decode for admin, sig for system) */
  verified: boolean;

  /** Supabase auth.uid or decoded Bearer subject. Present only after verification. */
  userId?: string;

  /** Admin Bearer token (present for admin routes after extraction) */
  bearerToken?: string;

  /** Portal token from URL path (present for student routes, CONTEXT only, NOT identity) */
  portalToken?: string;

  /** System auth method (present for system routes) */
  systemAuthMethod?: SystemAuthMethod;

  /** User email (present after identity resolution) */
  email?: string;

  /** User roles (present after identity resolution) */
  roles?: string[];

  /** Canonical subject: wp:{wp_user_id} (present after identity resolution) */
  subject?: string;
}

// ---------------------------------------------------------------------------
// Route classification matrix (deterministic, no inference)
// ---------------------------------------------------------------------------

const STUDENT_ROUTE_PREFIX = '/api/usce/portal';

const ADMIN_ROUTE_PREFIXES = [
  '/api/usce/requests',
  '/api/usce/offers',
  '/api/usce/confirmations',
  '/api/usce/programs',
  '/api/usce/search',
  '/api/usce/analytics',
] as const;

const SYSTEM_ROUTE_PREFIXES = [
  '/api/usce/webhook',
  '/api/usce/cron',
] as const;

const SYSTEM_EXACT_ROUTES = [
  '/api/usce/health',
] as const;

/**
 * Classify a route path into its route class.
 * Classification is prefix-based and deterministic.
 * Unknown paths return null (will trigger AUTH_CONTEXT_AMBIGUOUS).
 */
export function classifyRoute(pathname: string): RouteClass | null {
  // Normalize: strip trailing slash, lowercase for comparison
  const normalized = pathname.replace(/\/+$/, '').toLowerCase();

  // System exact matches first (most specific)
  for (const route of SYSTEM_EXACT_ROUTES) {
    if (normalized === route) return 'system';
  }

  // System prefix matches
  for (const prefix of SYSTEM_ROUTE_PREFIXES) {
    if (normalized === prefix || normalized.startsWith(`${prefix}/`)) {
      return 'system';
    }
  }

  // Student prefix match
  if (normalized === STUDENT_ROUTE_PREFIX || normalized.startsWith(`${STUDENT_ROUTE_PREFIX}/`)) {
    return 'student';
  }

  // Admin prefix matches
  for (const prefix of ADMIN_ROUTE_PREFIXES) {
    if (normalized === prefix || normalized.startsWith(`${prefix}/`)) {
      return 'admin';
    }
  }

  // Unknown route: not in classification matrix
  return null;
}

// ---------------------------------------------------------------------------
// Signal extractors (pure functions, no side effects)
// ---------------------------------------------------------------------------

/**
 * Extract Bearer token from Authorization header.
 * Returns null if header is missing or malformed.
 */
export function extractBearerToken(authorizationHeader: string | null | undefined): string | null {
  if (!authorizationHeader) return null;
  if (!authorizationHeader.startsWith('Bearer ')) return null;
  const token = authorizationHeader.slice(7).trim();
  return token.length > 0 ? token : null;
}

/**
 * Extract portal token from a student route path.
 * Expected format: /api/usce/portal/{portal_token}/...
 * Portal token is CONTEXT only (which offer to display), NOT identity.
 */
export function extractPortalToken(pathname: string): string | null {
  const match = pathname.match(/^\/api\/usce\/portal\/([a-zA-Z0-9_-]+)/);
  return match ? match[1] : null;
}

/**
 * Extract Stripe signature from request headers.
 */
export function extractStripeSignature(headers: Headers): string | null {
  return headers.get('stripe-signature');
}

/**
 * Extract Postmark webhook credentials.
 * Uses HMAC(timestamp + raw body) verification model.
 */
export function extractPostmarkAuth(headers: Headers): { timestamp: string | null; signature: string | null } {
  return {
    timestamp: headers.get('x-postmark-timestamp'),
    signature: headers.get('x-postmark-signature'),
  };
}

/**
 * Extract cron shared secret from request headers or query params.
 */
export function extractCronSecret(headers: Headers, searchParams?: URLSearchParams): string | null {
  // Prefer header-based auth
  const headerSecret = headers.get('x-cron-secret') ?? headers.get('authorization');
  if (headerSecret) {
    // Strip "Bearer " if present
    return headerSecret.startsWith('Bearer ') ? headerSecret.slice(7).trim() : headerSecret;
  }
  // Fallback to query param (for simple cron services)
  return searchParams?.get('cron_secret') ?? null;
}

// ---------------------------------------------------------------------------
// Environment
// ---------------------------------------------------------------------------

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'https://fglyvdykwgbuivikqoah.supabase.co';
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';
const CRON_SHARED_SECRET = process.env.USCE_CRON_SHARED_SECRET ?? '';
const STRIPE_WEBHOOK_SECRET = process.env.USCE_STRIPE_WEBHOOK_SECRET ?? '';
const POSTMARK_WEBHOOK_SECRET = process.env.USCE_POSTMARK_WEBHOOK_SECRET ?? '';

// ---------------------------------------------------------------------------
// Student identity verification (Supabase getUser)
// ---------------------------------------------------------------------------

/**
 * Verify student identity via Supabase session.
 * The student must have completed the full bootstrap chain:
 *   exchange -> bootstrap -> setSession -> getUser
 *
 * We extract the Supabase access token from the Authorization header
 * (which for student/portal routes carries the Supabase JWT, not Railway Bearer).
 */
async function verifyStudentIdentity(
  supabaseAccessToken: string
): Promise<{ userId: string; email: string } | null> {
  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
      global: {
        headers: { Authorization: `Bearer ${supabaseAccessToken}` },
      },
    });

    const { data, error } = await supabase.auth.getUser();

    if (error || !data.user) return null;

    return {
      userId: data.user.id,
      email: data.user.email ?? '',
    };
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// System route auth verification
// ---------------------------------------------------------------------------

/**
 * Determine system auth method from route path and available headers.
 */
function detectSystemAuthMethod(
  pathname: string,
  headers: Headers
): SystemAuthMethod | null {
  const normalized = pathname.toLowerCase();

  // Webhook routes: check for Stripe or Postmark signatures
  if (normalized.startsWith('/api/usce/webhook')) {
    if (normalized.includes('stripe') || headers.has('stripe-signature')) {
      return 'stripe_signature';
    }
    if (normalized.includes('postmark') || headers.has('x-postmark-signature')) {
      return 'postmark_hmac';
    }
    // Generic webhook with internal secret
    if (headers.has('x-webhook-secret')) {
      return 'internal_secret';
    }
    return null;
  }

  // Cron routes: check for shared secret
  if (normalized.startsWith('/api/usce/cron')) {
    return 'cron_secret';
  }

  // Health endpoint: no auth required
  if (normalized === '/api/usce/health') {
    return 'internal_secret'; // Treated as always-valid system route
  }

  return null;
}

/**
 * Verify system route authentication.
 * Each system route type has its own verification mechanism.
 * This function checks that the correct secret/signature is present.
 * Actual signature validation (e.g., Stripe sig verification) happens in the route handler.
 */
function verifySystemAuth(
  method: SystemAuthMethod,
  headers: Headers,
  searchParams?: URLSearchParams
): boolean {
  switch (method) {
    case 'stripe_signature': {
      const sig = extractStripeSignature(headers);
      // Presence check only. Full verification with stripe.webhooks.constructEvent
      // happens in the webhook route handler where the raw body is available.
      return sig !== null && sig.length > 0;
    }

    case 'postmark_hmac': {
      const { timestamp, signature } = extractPostmarkAuth(headers);
      // Presence check. Full HMAC(timestamp + raw_body) verification in route handler.
      return timestamp !== null && signature !== null;
    }

    case 'cron_secret': {
      const secret = extractCronSecret(headers, searchParams);
      if (!secret || !CRON_SHARED_SECRET) return false;
      // Constant-time comparison
      if (secret.length !== CRON_SHARED_SECRET.length) return false;
      let mismatch = 0;
      for (let i = 0; i < secret.length; i++) {
        mismatch |= secret.charCodeAt(i) ^ CRON_SHARED_SECRET.charCodeAt(i);
      }
      return mismatch === 0;
    }

    case 'internal_secret': {
      // Health endpoint or generic internal: always passes
      return true;
    }

    default:
      return false;
  }
}

// ---------------------------------------------------------------------------
// Main context detection function
// ---------------------------------------------------------------------------

export interface DetectContextInput {
  /** Request pathname (e.g., /api/usce/portal/abc123/view) */
  pathname: string;

  /** Request headers */
  headers: Headers;

  /** URL search params (for cron secret fallback) */
  searchParams?: URLSearchParams;
}

export interface DetectContextResult {
  context: AuthContext;
  error?: never;
}

export interface DetectContextError {
  context?: never;
  error: {
    definition: ErrorDefinition;
    requestId: string;
    details?: Record<string, unknown>;
  };
}

/**
 * Detect auth context from request signals.
 *
 * Algorithm:
 * 1. Classify route (deterministic, prefix-based)
 * 2. If route is unclassified: throw AUTH_CONTEXT_AMBIGUOUS
 * 3. For SYSTEM routes: verify system auth, return context (no MODE A/B detection)
 * 4. For STUDENT routes: extract portal token, verify Supabase session
 * 5. For ADMIN routes: extract and validate Bearer token
 * 6. If required signals are missing: throw AUTH_CONTEXT_AMBIGUOUS
 */
export async function detectAuthContext(
  input: DetectContextInput,
  requestId: string
): Promise<DetectContextResult | DetectContextError> {
  const { pathname, headers, searchParams } = input;

  // ---- Step 1: Classify route ----
  const routeClass = classifyRoute(pathname);

  if (routeClass === null) {
    return {
      error: {
        definition: AUTH_CONTEXT_AMBIGUOUS,
        requestId,
        details: {
          pathname,
          reason: 'Route does not match any known USCE route classification',
        },
      },
    };
  }

  // ---- Step 2: SYSTEM routes (exempt from MODE A/B) ----
  if (routeClass === 'system') {
    const authMethod = detectSystemAuthMethod(pathname, headers);

    if (!authMethod) {
      return {
        error: {
          definition: AUTH_SYSTEM_SECRET_INVALID,
          requestId,
          details: {
            pathname,
            reason: 'No recognized system auth signal found',
          },
        },
      };
    }

    const verified = verifySystemAuth(authMethod, headers, searchParams);

    return {
      context: {
        routeClass: 'system',
        verified,
        systemAuthMethod: authMethod,
        // No mode, userId, bearerToken, or portalToken for system routes
      },
    };
  }

  // ---- Step 3: STUDENT routes ----
  if (routeClass === 'student') {
    const portalToken = extractPortalToken(pathname);
    const authHeader = headers.get('authorization');
    const supabaseToken = extractBearerToken(authHeader);

    // Student routes REQUIRE a Supabase session token for identity
    if (!supabaseToken) {
      return {
        error: {
          definition: AUTH_CONTEXT_AMBIGUOUS,
          requestId,
          details: {
            pathname,
            routeClass: 'student',
            reason: 'Student route requires Supabase session token in Authorization header',
            hasPortalToken: portalToken !== null,
          },
        },
      };
    }

    // Verify identity via Supabase getUser
    const identity = await verifyStudentIdentity(supabaseToken);

    return {
      context: {
        mode: 'student',
        routeClass: 'student',
        verified: identity !== null,
        userId: identity?.userId,
        email: identity?.email,
        portalToken: portalToken ?? undefined,
        // No bearerToken for student routes (they use Supabase JWT)
      },
    };
  }

  // ---- Step 4: ADMIN routes ----
  if (routeClass === 'admin') {
    const authHeader = headers.get('authorization');
    const bearerToken = extractBearerToken(authHeader);

    // Admin routes REQUIRE a Railway Bearer token for identity
    if (!bearerToken) {
      return {
        error: {
          definition: AUTH_CONTEXT_AMBIGUOUS,
          requestId,
          details: {
            pathname,
            routeClass: 'admin',
            reason: 'Admin route requires Railway Bearer token in Authorization header',
          },
        },
      };
    }

    // Bearer token decryption and session validation happens in the route handler
    // or middleware layer. Here we confirm the signal is present and well-formed.
    return {
      context: {
        mode: 'admin',
        routeClass: 'admin',
        verified: false, // Caller must decrypt + validate session to set verified=true
        bearerToken,
        // No portalToken for admin routes
      },
    };
  }

  // ---- Unreachable (all route classes handled above) ----
  return {
    error: {
      definition: AUTH_CONTEXT_AMBIGUOUS,
      requestId,
      details: {
        pathname,
        reason: 'Unexpected route classification failure',
      },
    },
  };
}

// ---------------------------------------------------------------------------
// Convenience: check if context is verified
// ---------------------------------------------------------------------------

export function isVerifiedContext(ctx: AuthContext): boolean {
  return ctx.verified === true && ctx.userId !== undefined;
}

export function isSystemRoute(ctx: AuthContext): boolean {
  return ctx.routeClass === 'system';
}

export function isStudentRoute(ctx: AuthContext): boolean {
  return ctx.routeClass === 'student' && ctx.mode === 'student';
}

export function isAdminRoute(ctx: AuthContext): boolean {
  return ctx.routeClass === 'admin' && ctx.mode === 'admin';
}

// ---------------------------------------------------------------------------
// Convenience: require verified context or throw
// ---------------------------------------------------------------------------

export function requireVerifiedStudent(ctx: AuthContext): asserts ctx is AuthContext & { mode: 'student'; verified: true; userId: string } {
  if (ctx.routeClass !== 'student' || ctx.mode !== 'student' || !ctx.verified || !ctx.userId) {
    throw new Error(`AUTH_CONTEXT_AMBIGUOUS: Expected verified student context, got routeClass=${ctx.routeClass} mode=${ctx.mode} verified=${ctx.verified}`);
  }
}

export function requireVerifiedAdmin(ctx: AuthContext): asserts ctx is AuthContext & { mode: 'admin'; verified: true; userId: string; bearerToken: string } {
  if (ctx.routeClass !== 'admin' || ctx.mode !== 'admin' || !ctx.verified || !ctx.userId || !ctx.bearerToken) {
    throw new Error(`AUTH_CONTEXT_AMBIGUOUS: Expected verified admin context, got routeClass=${ctx.routeClass} mode=${ctx.mode} verified=${ctx.verified}`);
  }
}

export function requireVerifiedSystem(ctx: AuthContext): asserts ctx is AuthContext & { routeClass: 'system'; verified: true; systemAuthMethod: SystemAuthMethod } {
  if (ctx.routeClass !== 'system' || !ctx.verified || !ctx.systemAuthMethod) {
    throw new Error(`AUTH_SYSTEM_SECRET_INVALID: Expected verified system context, got routeClass=${ctx.routeClass} verified=${ctx.verified}`);
  }
}
