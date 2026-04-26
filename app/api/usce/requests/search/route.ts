import { NextRequest, NextResponse } from 'next/server';
import { createUSCESupabaseClientFactoryFromRuntime } from '@/lib/usce/supabaseClient';

type ErrorBody = {
  code: string;
  message: string;
  requestId: string;
  details?: unknown;
};

function requestId(): string {
  return `usce_search_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
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

function escapeLikeValue(input: string): string {
  return input.replace(/[%_]/g, '');
}

export async function GET(request: NextRequest) {
  const rid = requestId();

  const accessToken = extractBearerToken(request);
  if (!accessToken) {
    return errorResponse(401, {
      code: 'AUTH_SESSION_MISSING',
      message: 'Authorization Bearer token is required.',
      requestId: rid,
    });
  }

  const factory = await createUSCESupabaseClientFactoryFromRuntime();
  const supabase: any = factory.createUserFacingClient({ accessToken });

  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData?.user?.id) {
    return errorResponse(401, {
      code: 'AUTH_SESSION_INVALID',
      message: 'Authenticated user session is required.',
      requestId: rid,
      details: userError ? { supabase: userError.message } : undefined,
    });
  }

  const { searchParams } = new URL(request.url);
  const qRaw = (searchParams.get('q') ?? '').trim();
  const q = escapeLikeValue(qRaw);
  const limitRaw = Number(searchParams.get('limit') ?? '20');
  const limit = Number.isInteger(limitRaw)
    ? Math.max(1, Math.min(50, limitRaw))
    : 20;

  if (q.length < 2 || q.length > 200) {
    return errorResponse(400, {
      code: 'VALIDATION_FAILED',
      message: 'q must be between 2 and 200 characters.',
      requestId: rid,
    });
  }

  const like = `%${q}%`;
  const { data, error, count } = await supabase
    .schema('command_center')
    .from('usce_requests')
    .select(
      'id, applicant_name, applicant_email, program_name, status, created_at',
      { count: 'exact' }
    )
    .eq('assigned_coordinator_id', userData.user.id)
    .or(
      `applicant_name.ilike.${like},applicant_email.ilike.${like},program_name.ilike.${like}`
    )
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    return errorResponse(500, {
      code: 'DB_QUERY_FAILED',
      message: 'Failed to search requests.',
      requestId: rid,
      details: { supabase: error.message },
    });
  }

  return NextResponse.json(
    {
      items: data ?? [],
      total: count ?? 0,
    },
    { status: 200 }
  );
}
