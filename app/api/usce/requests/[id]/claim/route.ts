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
  return `usce_claim_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
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

  const { data: existing, error: existingError } = await supabase
    .schema('command_center')
    .from('usce_requests')
    .select('id, status, assigned_coordinator_id, sla_offer_deadline')
    .eq('id', id)
    .maybeSingle();

  if (existingError) {
    return errorResponse(500, {
      code: 'DB_QUERY_FAILED',
      message: 'Failed to load request.',
      requestId: rid,
      details: { supabase: existingError.message },
    });
  }

  if (!existing) {
    return errorResponse(404, {
      code: 'NOT_FOUND',
      message: 'Request not found.',
      requestId: rid,
    });
  }

  if (
    existing.assigned_coordinator_id &&
    existing.assigned_coordinator_id !== callerUserId
  ) {
    return errorResponse(409, {
      code: 'ALREADY_ASSIGNED',
      message: 'Request is already assigned to another coordinator.',
      requestId: rid,
      details: { current_coordinator_id: existing.assigned_coordinator_id },
    });
  }

  if (existing.status !== 'NEW' && !(existing.status === 'IN_REVIEW' && existing.assigned_coordinator_id === callerUserId)) {
    return errorResponse(409, {
      code: 'INVALID_TRANSITION',
      message: 'Only NEW requests can be claimed.',
      requestId: rid,
      details: { current_status: existing.status },
    });
  }

  const offerDeadline = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();

  const { data: updated, error: updateError } = await supabase
    .schema('command_center')
    .from('usce_requests')
    .update({
      assigned_coordinator_id: callerUserId,
      status: 'IN_REVIEW',
      sla_offer_deadline: offerDeadline,
    })
    .eq('id', id)
    .select('*')
    .single();

  if (updateError) {
    if (updateError.code === '42501') {
      return errorResponse(403, {
        code: 'FORBIDDEN',
        message: 'Authenticated user is not allowed to claim this request.',
        requestId: rid,
      });
    }

    return errorResponse(500, {
      code: 'DB_UPDATE_FAILED',
      message: 'Failed to claim request.',
      requestId: rid,
      details: { supabase: updateError.message },
    });
  }

  return NextResponse.json({ request: updated }, { status: 200 });
}
