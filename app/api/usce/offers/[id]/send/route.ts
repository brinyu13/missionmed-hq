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
  return `usce_send_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
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

function bufferToHex(bytes: ArrayBuffer): string {
  const arr = new Uint8Array(bytes);
  return Array.from(arr)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return bufferToHex(digest);
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

  const { data: offerRow, error: offerError } = await supabase
    .schema('command_center')
    .from('usce_offers')
    .select('id, request_id, status, subject, html_body, approved_subject_body_hash')
    .eq('id', id)
    .maybeSingle();

  if (offerError) {
    return errorResponse(500, {
      code: 'DB_QUERY_FAILED',
      message: 'Failed to load offer.',
      requestId: rid,
      details: { supabase: offerError.message },
    });
  }

  if (!offerRow) {
    return errorResponse(404, {
      code: 'NOT_FOUND',
      message: 'Offer not found.',
      requestId: rid,
    });
  }

  if (!['APPROVED', 'SENT', 'REMINDED'].includes(offerRow.status)) {
    return errorResponse(409, {
      code: 'INVALID_TRANSITION',
      message: 'Offer can only be sent from APPROVED or re-sent from SENT/REMINDED.',
      requestId: rid,
      details: { current_status: offerRow.status },
    });
  }

  const { data: requestRow, error: requestError } = await supabase
    .schema('command_center')
    .from('usce_requests')
    .select('id, assigned_coordinator_id')
    .eq('id', offerRow.request_id)
    .maybeSingle();

  if (requestError) {
    return errorResponse(500, {
      code: 'DB_QUERY_FAILED',
      message: 'Failed to load parent request.',
      requestId: rid,
      details: { supabase: requestError.message },
    });
  }

  if (!requestRow || requestRow.assigned_coordinator_id !== callerUserId) {
    return errorResponse(403, {
      code: 'FORBIDDEN',
      message: 'Only the assigned coordinator can send this offer.',
      requestId: rid,
    });
  }

  const contentHash = await sha256Hex(`${offerRow.subject}\n${offerRow.html_body}`);
  if (!offerRow.approved_subject_body_hash || contentHash !== offerRow.approved_subject_body_hash) {
    return errorResponse(409, {
      code: 'APPROVAL_STALE',
      message: 'Offer content no longer matches approved content hash.',
      requestId: rid,
    });
  }

  const sentAt = new Date().toISOString();
  const portalTokenExpiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();
  const postmarkMessageId = `mock_pm_${Date.now().toString(36)}_${id.slice(0, 8)}`;

  const { data: updated, error: updateError } = await supabase
    .schema('command_center')
    .from('usce_offers')
    .update({
      status: 'SENT',
      sent_at: sentAt,
      portal_token_expires_at: portalTokenExpiresAt,
      postmark_message_id: postmarkMessageId,
    })
    .eq('id', id)
    .select('postmark_message_id, sent_at, portal_token_expires_at')
    .single();

  if (updateError) {
    return errorResponse(500, {
      code: 'DB_UPDATE_FAILED',
      message: 'Failed to send offer.',
      requestId: rid,
      details: { supabase: updateError.message },
    });
  }

  return NextResponse.json(
    {
      postmark_message_id: updated.postmark_message_id,
      sent_at: updated.sent_at,
      portal_token_expires_at: updated.portal_token_expires_at,
    },
    { status: 200 }
  );
}
