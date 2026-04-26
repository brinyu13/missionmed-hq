import { NextRequest, NextResponse } from 'next/server';
import { validatePreviewOfferBody } from '@/lib/usce/schemas';
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
  return `usce_preview_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
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

  const parsed = validatePreviewOfferBody(payload);
  if (!parsed.success) {
    return errorResponse(422, {
      code: 'VALIDATION_FAILED',
      message: 'Invalid preview payload.',
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

  const { data: offerRow, error: offerError } = await supabase
    .schema('command_center')
    .from('usce_offers')
    .select('id, request_id, status')
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

  if (!['DRAFT', 'PREVIEWED'].includes(offerRow.status)) {
    return errorResponse(409, {
      code: 'INVALID_TRANSITION',
      message: 'Offer can only be previewed from DRAFT or PREVIEWED.',
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
      message: 'Only the assigned coordinator can preview this offer.',
      requestId: rid,
    });
  }

  const previewHash = await sha256Hex(`${parsed.data.subject}\n${parsed.data.html_body}`);
  const previewedAt = new Date().toISOString();

  const { data: updated, error: updateError } = await supabase
    .schema('command_center')
    .from('usce_offers')
    .update({
      subject: parsed.data.subject,
      html_body: parsed.data.html_body,
      text_body: parsed.data.text_body,
      status: 'PREVIEWED',
      preview_subject_body_hash: previewHash,
      preview_acknowledged_at: previewedAt,
      preview_acknowledged_by: callerUserId,
    })
    .eq('id', id)
    .select('id, status, preview_acknowledged_at, preview_subject_body_hash, subject, html_body, text_body')
    .single();

  if (updateError) {
    return errorResponse(500, {
      code: 'DB_UPDATE_FAILED',
      message: 'Failed to preview offer.',
      requestId: rid,
      details: { supabase: updateError.message },
    });
  }

  return NextResponse.json(
    {
      offer_id: updated.id,
      status: updated.status,
      preview_acknowledged_at: updated.preview_acknowledged_at,
      preview_subject_body_hash_prefix: String(updated.preview_subject_body_hash ?? '').slice(0, 8),
      rendered: {
        subject: updated.subject,
        html: updated.html_body,
        text: updated.text_body,
      },
    },
    { status: 200 }
  );
}
