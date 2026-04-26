import { NextRequest, NextResponse } from 'next/server';
import { createUSCESupabaseClientFactoryFromRuntime } from '@/lib/usce/supabaseClient';

type ErrorBody = {
  code: string;
  message: string;
  requestId: string;
  details?: unknown;
};

function requestId(): string {
  return `usce_programs_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
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

function parseBooleanParam(value: string | null, defaultValue: boolean): boolean {
  if (value === null) return defaultValue;
  if (value.toLowerCase() === 'true') return true;
  if (value.toLowerCase() === 'false') return false;
  return defaultValue;
}

function isIsoDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00.000Z`));
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

export async function GET(request: NextRequest) {
  const rid = requestId();
  const auth = await requireAuthedUser(request, rid);
  if ('response' in auth) return auth.response;

  const { supabase } = auth;
  const { searchParams } = new URL(request.url);

  const active = parseBooleanParam(searchParams.get('active'), true);
  const specialty = searchParams.get('specialty')?.trim() ?? '';
  const location = searchParams.get('location')?.trim() ?? '';
  const limitRaw = Number(searchParams.get('limit') ?? '50');
  const limit = Number.isInteger(limitRaw)
    ? Math.max(1, Math.min(200, limitRaw))
    : 50;

  let query = supabase
    .schema('command_center')
    .from('usce_program_seats')
    .select('*')
    .eq('active', active);

  if (specialty.length > 0) {
    query = query.ilike('specialty', `%${specialty}%`);
  }
  if (location.length > 0) {
    query = query.ilike('location', `%${location}%`);
  }

  const { data, error } = await query
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    return errorResponse(500, {
      code: 'DB_QUERY_FAILED',
      message: 'Failed to list programs.',
      requestId: rid,
      details: { supabase: error.message },
    });
  }

  const items = (data ?? []).map((row: any) => ({
    ...row,
    seats_available:
      Number(row.seats_total) -
      Number(row.seats_held_soft) -
      Number(row.seats_held_hard) -
      Number(row.seats_filled),
  }));

  return NextResponse.json(
    {
      items,
      next_cursor: null,
    },
    { status: 200 }
  );
}

export async function POST(request: NextRequest) {
  const rid = requestId();
  const auth = await requireAuthedUser(request, rid);
  if ('response' in auth) return auth.response;

  const { supabase, user } = auth;

  if (!isAdminUser(user)) {
    return errorResponse(403, {
      code: 'FORBIDDEN',
      message: 'Admin access is required to create programs.',
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

  const programName =
    typeof (payload as any)?.program_name === 'string'
      ? (payload as any).program_name.trim()
      : '';
  const specialty =
    typeof (payload as any)?.specialty === 'string'
      ? (payload as any).specialty.trim()
      : '';
  const location =
    typeof (payload as any)?.location === 'string'
      ? (payload as any).location.trim()
      : '';
  const cohortStartDate =
    typeof (payload as any)?.cohort_start_date === 'string'
      ? (payload as any).cohort_start_date.trim()
      : '';
  const seatsTotal = Number((payload as any)?.seats_total);

  if (programName.length < 2 || programName.length > 200) {
    return errorResponse(400, {
      code: 'VALIDATION_FAILED',
      message: 'program_name must be between 2 and 200 characters.',
      requestId: rid,
    });
  }
  if (specialty.length < 2 || specialty.length > 80) {
    return errorResponse(400, {
      code: 'VALIDATION_FAILED',
      message: 'specialty must be between 2 and 80 characters.',
      requestId: rid,
    });
  }
  if (location.length < 2 || location.length > 120) {
    return errorResponse(400, {
      code: 'VALIDATION_FAILED',
      message: 'location must be between 2 and 120 characters.',
      requestId: rid,
    });
  }
  if (!isIsoDate(cohortStartDate)) {
    return errorResponse(400, {
      code: 'VALIDATION_FAILED',
      message: 'cohort_start_date must be a valid ISO date (YYYY-MM-DD).',
      requestId: rid,
    });
  }
  if (!Number.isInteger(seatsTotal) || seatsTotal < 1) {
    return errorResponse(400, {
      code: 'VALIDATION_FAILED',
      message: 'seats_total must be an integer greater than or equal to 1.',
      requestId: rid,
    });
  }

  const { data, error } = await supabase
    .schema('command_center')
    .from('usce_program_seats')
    .insert({
      program_name: programName,
      specialty,
      location,
      cohort_start_date: cohortStartDate,
      seats_total: seatsTotal,
      active: true,
    })
    .select('id, program_name, seats_total, created_at')
    .single();

  if (error) {
    return errorResponse(500, {
      code: 'DB_INSERT_FAILED',
      message: 'Failed to create program.',
      requestId: rid,
      details: { supabase: error.message },
    });
  }

  return NextResponse.json(data, { status: 201 });
}
