import { NextRequest, NextResponse } from 'next/server';
import { createUSCESupabaseClientFactoryFromRuntime } from '@/lib/usce/supabaseClient';

type ErrorBody = {
  code: string;
  message: string;
  requestId: string;
  details?: unknown;
};

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function requestId(): string {
  return `usce_program_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

function errorResponse(status: number, body: ErrorBody): NextResponse<ErrorBody> {
  return NextResponse.json(body, { status });
}

function extractBearerToken(request: NextRequest): string | null {
  const authorization = request.headers.get('authorization');
  if (!authorization || !authorization.startsWith('Bearer ')) {
    return null;
  }
  const token = authorization.slice(7).trim();
  return token.length > 0 ? token : null;
}

function isAdminUser(user: any): boolean {
  const appRole = user?.app_metadata?.mm_role;
  const roles = user?.app_metadata?.roles ?? user?.user_metadata?.roles;
  if (appRole === 'admin') return true;
  if (Array.isArray(roles) && roles.includes('admin')) return true;
  return false;
}

async function requireAuthedUser(request: NextRequest, rid: string) {
  const accessToken = extractBearerToken(request);
  if (!accessToken) {
    return {
      response: errorResponse(401, {
        code: 'AUTH_SESSION_MISSING',
        message: 'Authorization Bearer token is required.',
        requestId: rid,
      }),
    };
  }

  const factory = await createUSCESupabaseClientFactoryFromRuntime();
  const supabase: any = factory.createUserFacingClient({ accessToken });

  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData?.user?.id) {
    return {
      response: errorResponse(401, {
        code: 'AUTH_SESSION_INVALID',
        message: 'Authenticated user session is required.',
        requestId: rid,
        details: userError ? { supabase: userError.message } : undefined,
      }),
    };
  }

  return { supabase, user: userData.user };
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const rid = requestId();
  const { id } = await context.params;

  if (!UUID_RE.test(id)) {
    return errorResponse(400, {
      code: 'VALIDATION_FAILED',
      message: 'Path id must be a valid UUID.',
      requestId: rid,
    });
  }

  const auth = await requireAuthedUser(request, rid);
  if ('response' in auth) return auth.response;

  const { supabase } = auth;

  const { data, error } = await supabase
    .schema('command_center')
    .from('usce_program_seats')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (error) {
    return errorResponse(500, {
      code: 'DB_QUERY_FAILED',
      message: 'Failed to load program.',
      requestId: rid,
      details: { supabase: error.message },
    });
  }

  if (!data) {
    return errorResponse(404, {
      code: 'NOT_FOUND',
      message: 'Program not found.',
      requestId: rid,
    });
  }

  const seatsAvailable =
    Number(data.seats_total) -
    Number(data.seats_held_soft) -
    Number(data.seats_held_hard) -
    Number(data.seats_filled);

  return NextResponse.json(
    {
      program: {
        ...data,
        seats_available: seatsAvailable,
      },
    },
    { status: 200 }
  );
}

export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const rid = requestId();
  const { id } = await context.params;

  if (!UUID_RE.test(id)) {
    return errorResponse(400, {
      code: 'VALIDATION_FAILED',
      message: 'Path id must be a valid UUID.',
      requestId: rid,
    });
  }

  const auth = await requireAuthedUser(request, rid);
  if ('response' in auth) return auth.response;

  const { supabase, user } = auth;
  if (!isAdminUser(user)) {
    return errorResponse(403, {
      code: 'FORBIDDEN',
      message: 'Admin access is required to update programs.',
      requestId: rid,
    });
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return errorResponse(400, {
      code: 'INVALID_JSON',
      message: 'Request body must be valid JSON.',
      requestId: rid,
    });
  }

  const { data: existing, error: existingError } = await supabase
    .schema('command_center')
    .from('usce_program_seats')
    .select('id, seats_filled')
    .eq('id', id)
    .maybeSingle();

  if (existingError) {
    return errorResponse(500, {
      code: 'DB_QUERY_FAILED',
      message: 'Failed to load existing program.',
      requestId: rid,
      details: { supabase: existingError.message },
    });
  }

  if (!existing) {
    return errorResponse(404, {
      code: 'NOT_FOUND',
      message: 'Program not found.',
      requestId: rid,
    });
  }

  const updates: Record<string, unknown> = {};

  if ((payload as any).program_name !== undefined) {
    const value =
      typeof (payload as any).program_name === 'string'
        ? (payload as any).program_name.trim()
        : '';
    if (value.length < 2 || value.length > 200) {
      return errorResponse(400, {
        code: 'VALIDATION_FAILED',
        message: 'program_name must be between 2 and 200 characters.',
        requestId: rid,
      });
    }
    updates.program_name = value;
  }

  if ((payload as any).active !== undefined) {
    if (typeof (payload as any).active !== 'boolean') {
      return errorResponse(400, {
        code: 'VALIDATION_FAILED',
        message: 'active must be boolean.',
        requestId: rid,
      });
    }
    updates.active = (payload as any).active;
  }

  if ((payload as any).seats_total !== undefined) {
    const seatsTotal = Number((payload as any).seats_total);
    if (!Number.isInteger(seatsTotal) || seatsTotal < 1) {
      return errorResponse(400, {
        code: 'VALIDATION_FAILED',
        message: 'seats_total must be an integer greater than or equal to 1.',
        requestId: rid,
      });
    }
    if (seatsTotal < Number(existing.seats_filled)) {
      return errorResponse(409, {
        code: 'SEATS_BELOW_FILLED',
        message: 'seats_total cannot be reduced below seats_filled.',
        requestId: rid,
        details: { seats_filled: existing.seats_filled },
      });
    }
    updates.seats_total = seatsTotal;
  }

  if (Object.keys(updates).length === 0) {
    return errorResponse(400, {
      code: 'VALIDATION_FAILED',
      message: 'At least one field must be provided for update.',
      requestId: rid,
    });
  }

  const { data: updated, error: updateError } = await supabase
    .schema('command_center')
    .from('usce_program_seats')
    .update(updates)
    .eq('id', id)
    .select('*')
    .single();

  if (updateError) {
    return errorResponse(500, {
      code: 'DB_UPDATE_FAILED',
      message: 'Failed to update program.',
      requestId: rid,
      details: { supabase: updateError.message },
    });
  }

  return NextResponse.json({ program: updated }, { status: 200 });
}
