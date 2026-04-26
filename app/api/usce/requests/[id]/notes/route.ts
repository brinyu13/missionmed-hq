import { NextRequest, NextResponse } from 'next/server';
import { validateCreateInternalNoteBody } from '@/lib/usce/schemas';
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
  return `usce_note_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
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

export async function POST(
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

  const parsed = validateCreateInternalNoteBody(payload);
  if (!parsed.success) {
    return errorResponse(400, {
      code: 'VALIDATION_FAILED',
      message: 'Invalid internal note payload.',
      requestId: rid,
      details: parsed.errors,
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

  const callerUserId = userData.user.id;

  const { data: requestRow, error: requestError } = await supabase
    .schema('command_center')
    .from('usce_requests')
    .select('id, assigned_coordinator_id')
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

  if (requestRow.assigned_coordinator_id && requestRow.assigned_coordinator_id !== callerUserId) {
    return errorResponse(403, {
      code: 'FORBIDDEN',
      message: 'Only the assigned coordinator can add notes to this request.',
      requestId: rid,
    });
  }

  if (parsed.data.offer_id) {
    const { data: offerRow, error: offerError } = await supabase
      .schema('command_center')
      .from('usce_offers')
      .select('id, request_id')
      .eq('id', parsed.data.offer_id)
      .eq('request_id', id)
      .maybeSingle();

    if (offerError) {
      return errorResponse(500, {
        code: 'DB_QUERY_FAILED',
        message: 'Failed to validate offer reference.',
        requestId: rid,
        details: { supabase: offerError.message },
      });
    }

    if (!offerRow) {
      return errorResponse(400, {
        code: 'VALIDATION_FAILED',
        message: 'offer_id must reference an offer under this request.',
        requestId: rid,
      });
    }
  }

  const { data: comm, error: insertError } = await supabase
    .schema('command_center')
    .from('usce_comms')
    .insert({
      offer_id: parsed.data.offer_id ?? null,
      thread_id: id,
      direction: 'SYS',
      is_internal_note: true,
      message_status: 'sent',
      body_text: parsed.data.body_text,
      created_by: callerUserId,
      raw_json: {},
    })
    .select('id, thread_id, is_internal_note, created_at')
    .single();

  if (insertError) {
    if (insertError.code === '42501') {
      return errorResponse(403, {
        code: 'FORBIDDEN',
        message: 'Authenticated user is not allowed to create internal notes.',
        requestId: rid,
      });
    }

    return errorResponse(500, {
      code: 'DB_INSERT_FAILED',
      message: 'Failed to create internal note.',
      requestId: rid,
      details: { supabase: insertError.message },
    });
  }

  return NextResponse.json(
    {
      comm_id: comm.id,
      thread_id: comm.thread_id,
      is_internal_note: comm.is_internal_note,
      created_at: comm.created_at,
    },
    { status: 201 }
  );
}
