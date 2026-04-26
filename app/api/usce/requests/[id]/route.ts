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
  return `usce_req_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
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

  const { data: requestRow, error: requestError } = await supabase
    .schema('command_center')
    .from('usce_requests')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (requestError) {
    return errorResponse(500, {
      code: 'DB_QUERY_FAILED',
      message: 'Failed to load request.',
      requestId: rid,
      details: { supabase: requestError.message },
    });
  }

  if (!requestRow) {
    return errorResponse(404, {
      code: 'NOT_FOUND',
      message: 'Request not found.',
      requestId: rid,
    });
  }

  const { data: offers, error: offersError } = await supabase
    .schema('command_center')
    .from('usce_offers')
    .select('*')
    .eq('request_id', id)
    .order('created_at', { ascending: false });

  if (offersError) {
    return errorResponse(500, {
      code: 'DB_QUERY_FAILED',
      message: 'Failed to load offers.',
      requestId: rid,
      details: { supabase: offersError.message },
    });
  }

  const { data: commsRows, error: commsError } = await supabase
    .schema('command_center')
    .from('usce_comms')
    .select('*')
    .eq('thread_id', id)
    .order('created_at', { ascending: false });

  if (commsError) {
    return errorResponse(500, {
      code: 'DB_QUERY_FAILED',
      message: 'Failed to load communications.',
      requestId: rid,
      details: { supabase: commsError.message },
    });
  }

  const { data: auditRows, error: auditError } = await supabase
    .schema('command_center')
    .from('usce_audit')
    .select('*')
    .eq('entity_id', id)
    .order('created_at', { ascending: false });

  if (auditError) {
    return errorResponse(500, {
      code: 'DB_QUERY_FAILED',
      message: 'Failed to load audit history.',
      requestId: rid,
      details: { supabase: auditError.message },
    });
  }

  const comms = commsRows ?? [];
  const commsExternal = comms.filter((row: any) => row.is_internal_note === false);
  const commsInternalNotes = comms.filter((row: any) => row.is_internal_note === true);

  return NextResponse.json(
    {
      request: requestRow,
      offers: offers ?? [],
      comms_external: commsExternal,
      comms_internal_notes: commsInternalNotes,
      audit: auditRows ?? [],
    },
    { status: 200 }
  );
}
