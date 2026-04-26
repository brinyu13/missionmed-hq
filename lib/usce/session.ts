import { NextRequest } from 'next/server';
import { createUSCESupabaseClientFactoryFromRuntime } from '@/lib/usce/supabaseClient';
import { errorResponse, extractBearerToken, type ErrorBody } from '@/lib/usce/http';

type AuthFailure = {
  response: ReturnType<typeof errorResponse>;
};

export type AuthenticatedUser = {
  id: string;
  email?: string | null;
  app_metadata?: Record<string, unknown>;
  user_metadata?: Record<string, unknown>;
};

type SupabaseLike = {
  auth: {
    getUser: () => Promise<{
      data: { user: AuthenticatedUser | null };
      error: { message: string } | null;
    }>;
  };
};

export async function requireUserSession(
  request: NextRequest,
  requestId: string,
  options?: { portalToken?: string }
): Promise<
  | {
      accessToken: string;
      supabase: SupabaseLike & Record<string, unknown>;
      user: AuthenticatedUser;
    }
  | AuthFailure
> {
  const accessToken = extractBearerToken(request);
  if (!accessToken) {
    return {
      response: errorResponse(401, {
        code: 'AUTH_SESSION_MISSING',
        message: 'Authorization Bearer token is required.',
        requestId,
      }),
    };
  }

  const factory = await createUSCESupabaseClientFactoryFromRuntime();
  const supabase: SupabaseLike & Record<string, unknown> = options?.portalToken
    ? (factory.createPortalContextClient({
        accessToken,
        portalToken: options.portalToken,
      }) as SupabaseLike & Record<string, unknown>)
    : (factory.createUserFacingClient({ accessToken }) as SupabaseLike & Record<string, unknown>);

  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user?.id) {
    return {
      response: errorResponse(401, {
        code: 'AUTH_SESSION_INVALID',
        message: 'Authenticated user session is required.',
        requestId,
        details: error ? { supabase: error.message } : undefined,
      }),
    };
  }

  return {
    accessToken,
    supabase,
    user: data.user,
  };
}

export function isCoordinatorOrAdmin(user: AuthenticatedUser): boolean {
  const appRole = user?.app_metadata?.mm_role;
  if (appRole === 'admin' || appRole === 'coordinator') {
    return true;
  }

  const userRoles = user?.user_metadata?.roles;
  if (Array.isArray(userRoles)) {
    return userRoles.includes('admin') || userRoles.includes('coordinator');
  }

  return false;
}

export function withForbidden(
  requestId: string,
  message = 'Insufficient privileges.'
): { response: ReturnType<typeof errorResponse> } {
  return {
    response: errorResponse(403, {
      code: 'FORBIDDEN',
      message,
      requestId,
    }),
  };
}

export function withDbError(
  requestId: string,
  error: { code?: string; message: string } | null | undefined,
  fallbackCode: string,
  fallbackMessage: string,
  forbiddenMessage?: string
): { response: ReturnType<typeof errorResponse> } {
  if (error?.code === '42501') {
    return {
      response: errorResponse(403, {
        code: 'FORBIDDEN',
        message: forbiddenMessage ?? 'Operation blocked by RLS policy.',
        requestId,
        details: { supabase: error.message },
      }),
    };
  }

  const body: ErrorBody = {
    code: fallbackCode,
    message: fallbackMessage,
    requestId,
    details: error ? { supabase: error.message } : undefined,
  };
  return { response: errorResponse(500, body) };
}
