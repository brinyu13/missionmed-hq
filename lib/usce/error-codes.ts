/**
 * USCE Error Codes
 * Authority: MISSIONMED_AUTH_SYSTEM_CONTRACT_v1.2_LOCKED
 * Prompt: USCE-PH0A-CLAUDE-HIGH-0A0
 *
 * Deterministic error contract for all USCE auth endpoints.
 * Every error includes: code (machine-readable), message (human-readable),
 * requestId, and optional details.
 */

// ---------------------------------------------------------------------------
// Base error shape (contract section 13)
// ---------------------------------------------------------------------------

export interface USCEError {
  code: string;
  message: string;
  requestId: string;
  details?: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Exchange endpoint failure codes
// ---------------------------------------------------------------------------

export const EXCHANGE_WP_SESSION_INVALID = {
  code: 'EXCHANGE_WP_SESSION_INVALID',
  status: 401,
  message: 'WordPress cookie missing or expired.',
} as const;

export const EXCHANGE_RAILWAY_UNREACHABLE = {
  code: 'EXCHANGE_RAILWAY_UNREACHABLE',
  status: 502,
  message: 'Railway session validation service is unreachable.',
} as const;

export const EXCHANGE_NONCE_REPLAYED = {
  code: 'EXCHANGE_NONCE_REPLAYED',
  status: 403,
  message: 'Exchange nonce has already been used.',
} as const;

export const EXCHANGE_RATE_LIMITED = {
  code: 'EXCHANGE_RATE_LIMITED',
  status: 429,
  message: 'Too many exchange requests. Try again later.',
} as const;

export const EXCHANGE_INVALID_GRANT = {
  code: 'EXCHANGE_INVALID_GRANT',
  status: 400,
  message: 'Unsupported or malformed grant type.',
} as const;

export const EXCHANGE_ROLE_MISMATCH = {
  code: 'EXCHANGE_ROLE_MISMATCH',
  status: 403,
  message: 'Authenticated user does not have a permitted role.',
} as const;

export const EXCHANGE_IDENTITY_CONFLICT = {
  code: 'EXCHANGE_IDENTITY_CONFLICT',
  status: 409,
  message: 'Identity conflict detected during exchange.',
} as const;

// ---------------------------------------------------------------------------
// Bootstrap endpoint failure codes
// ---------------------------------------------------------------------------

export const BOOTSTRAP_TOKEN_INVALID = {
  code: 'BOOTSTRAP_TOKEN_INVALID',
  status: 401,
  message: 'Exchange token is missing or expired.',
} as const;

export const BOOTSTRAP_SUPABASE_FAILED = {
  code: 'BOOTSTRAP_SUPABASE_FAILED',
  status: 502,
  message: 'Supabase session creation failed.',
} as const;

export const BOOTSTRAP_USER_NOT_FOUND = {
  code: 'BOOTSTRAP_USER_NOT_FOUND',
  status: 404,
  message: 'No matching Supabase user could be resolved.',
} as const;

export const BOOTSTRAP_SUBJECT_MISMATCH = {
  code: 'BOOTSTRAP_SUBJECT_MISMATCH',
  status: 409,
  message: 'Subject in Railway token does not match Supabase session subject.',
} as const;

// ---------------------------------------------------------------------------
// Shared / general auth failure codes
// ---------------------------------------------------------------------------

export const AUTH_CSRF_FAILED = {
  code: 'AUTH_CSRF_FAILED',
  status: 403,
  message: 'CSRF validation failed.',
} as const;

export const AUTH_SESSION_EXPIRED = {
  code: 'AUTH_SESSION_EXPIRED',
  status: 401,
  message: 'Session has expired. Re-authentication required.',
} as const;

export const AUTH_CONTEXT_AMBIGUOUS = {
  code: 'AUTH_CONTEXT_AMBIGUOUS',
  status: 400,
  message: 'Auth mode could not be determined from request signals.',
} as const;

export const AUTH_SYSTEM_SECRET_INVALID = {
  code: 'AUTH_SYSTEM_SECRET_INVALID',
  status: 401,
  message: 'System route authentication failed. Invalid signature or secret.',
} as const;

// ---------------------------------------------------------------------------
// Session enforcement failure codes (enforce-session.ts)
// ---------------------------------------------------------------------------

export const AUTH_SESSION_MISSING = {
  code: 'AUTH_SESSION_MISSING',
  status: 401,
  message: 'No Supabase session found. Student must complete bootstrap chain.',
} as const;

export const AUTH_SESSION_INVALID = {
  code: 'AUTH_SESSION_INVALID',
  status: 401,
  message: 'Supabase session verification failed. getUser() returned an error.',
} as const;

export const AUTH_BEARER_MISSING = {
  code: 'AUTH_BEARER_MISSING',
  status: 401,
  message: 'No Authorization Bearer token found in request headers.',
} as const;

export const AUTH_BEARER_EXPIRED = {
  code: 'AUTH_BEARER_EXPIRED',
  status: 401,
  message: 'Bearer token has expired. Re-authentication required.',
} as const;

export const AUTH_BEARER_INVALID = {
  code: 'AUTH_BEARER_INVALID',
  status: 401,
  message: 'Bearer token decryption or validation failed.',
} as const;

export const AUTH_CONTEXT_MISMATCH = {
  code: 'AUTH_CONTEXT_MISMATCH',
  status: 403,
  message: 'Auth mode does not match the expected mode for this route.',
} as const;

// ---------------------------------------------------------------------------
// Failure matrix lookup
// ---------------------------------------------------------------------------

export type ErrorDefinition = {
  readonly code: string;
  readonly status: number;
  readonly message: string;
};

export const FAILURE_MATRIX: Record<string, ErrorDefinition> = {
  EXCHANGE_WP_SESSION_INVALID,
  EXCHANGE_RAILWAY_UNREACHABLE,
  EXCHANGE_NONCE_REPLAYED,
  EXCHANGE_RATE_LIMITED,
  EXCHANGE_INVALID_GRANT,
  EXCHANGE_ROLE_MISMATCH,
  EXCHANGE_IDENTITY_CONFLICT,
  BOOTSTRAP_TOKEN_INVALID,
  BOOTSTRAP_SUPABASE_FAILED,
  BOOTSTRAP_USER_NOT_FOUND,
  BOOTSTRAP_SUBJECT_MISMATCH,
  AUTH_CSRF_FAILED,
  AUTH_SESSION_EXPIRED,
  AUTH_CONTEXT_AMBIGUOUS,
  AUTH_SYSTEM_SECRET_INVALID,
  AUTH_SESSION_MISSING,
  AUTH_SESSION_INVALID,
  AUTH_BEARER_MISSING,
  AUTH_BEARER_EXPIRED,
  AUTH_BEARER_INVALID,
  AUTH_CONTEXT_MISMATCH,
} as const;

// ---------------------------------------------------------------------------
// Helper: build a USCEError response body from a failure code
// ---------------------------------------------------------------------------

export function buildErrorResponse(
  errorDef: ErrorDefinition,
  requestId: string,
  details?: Record<string, unknown>
): { status: number; body: USCEError } {
  return {
    status: errorDef.status,
    body: {
      code: errorDef.code,
      message: errorDef.message,
      requestId,
      ...(details ? { details } : {}),
    },
  };
}
