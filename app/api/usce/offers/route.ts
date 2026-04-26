import { NextRequest, NextResponse } from 'next/server';
import { validateCreateOfferBody } from '@/lib/usce/schemas';
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
  return `usce_offer_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
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

function toBase64Url(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return bufferToHex(digest);
}

function resolveApplicantUserId(
  requestRow: any,
  callerUserId: string,
  callerEmail: string | null
): string | null {
  const candidate = requestRow?.intake_payload?.applicant_user_id;
  if (typeof candidate === 'string' && UUID_RE.test(candidate)) {
    return candidate;
  }

  if (
    callerEmail &&
    typeof requestRow?.applicant_email === 'string' &&
    requestRow.applicant_email.toLowerCase() === callerEmail.toLowerCase()
  ) {
    return callerUserId;
  }

  return null;
}

export async function POST(request: NextRequest) {
  const rid = requestId();

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

  const parsed = validateCreateOfferBody(payload);
  if (!parsed.success) {
    return errorResponse(422, {
      code: 'VALIDATION_FAILED',
      message: 'Invalid create offer payload.',
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
  const callerEmail = userData.user.email ?? null;

  const { data: requestRow, error: requestError } = await supabase
    .schema('command_center')
    .from('usce_requests')
    .select('id, status, assigned_coordinator_id, applicant_email, intake_payload')
    .eq('id', parsed.data.request_id)
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

  if (requestRow.assigned_coordinator_id !== callerUserId) {
    return errorResponse(403, {
      code: 'FORBIDDEN',
      message: 'Only the assigned coordinator can create offers for this request.',
      requestId: rid,
    });
  }

  if (!['IN_REVIEW', 'OFFERED'].includes(requestRow.status)) {
    return errorResponse(409, {
      code: 'INVALID_TRANSITION',
      message: 'Offers can only be created while request status is IN_REVIEW or OFFERED.',
      requestId: rid,
      details: { current_status: requestRow.status },
    });
  }

  const { count: offerCount, error: countError } = await supabase
    .schema('command_center')
    .from('usce_offers')
    .select('id', { count: 'exact', head: true })
    .eq('request_id', parsed.data.request_id);

  if (countError) {
    return errorResponse(500, {
      code: 'DB_QUERY_FAILED',
      message: 'Failed to check offer limits.',
      requestId: rid,
      details: { supabase: countError.message },
    });
  }

  if ((offerCount ?? 0) >= 3) {
    return errorResponse(409, {
      code: 'OFFER_LIMIT_REACHED',
      message: 'A request can have at most three offers.',
      requestId: rid,
    });
  }

  const { data: seatRow, error: seatError } = await supabase
    .schema('command_center')
    .from('usce_program_seats')
    .select('id, seats_total, seats_held_soft, seats_held_hard, seats_filled, active')
    .eq('id', parsed.data.program_seat_id)
    .eq('active', true)
    .maybeSingle();

  if (seatError) {
    return errorResponse(500, {
      code: 'DB_QUERY_FAILED',
      message: 'Failed to validate program seat.',
      requestId: rid,
      details: { supabase: seatError.message },
    });
  }

  if (!seatRow) {
    return errorResponse(409, {
      code: 'INVALID_TRANSITION',
      message: 'Program seat does not exist or is inactive.',
      requestId: rid,
    });
  }

  const seatsAvailable =
    Number(seatRow.seats_total) -
    Number(seatRow.seats_held_soft) -
    Number(seatRow.seats_held_hard) -
    Number(seatRow.seats_filled);

  if (seatsAvailable < 1) {
    return errorResponse(409, {
      code: 'NO_SEATS',
      message: 'No seats available for the selected program seat.',
      requestId: rid,
    });
  }

  const applicantUserId = resolveApplicantUserId(requestRow, callerUserId, callerEmail);
  if (!applicantUserId) {
    return errorResponse(422, {
      code: 'APPLICANT_USER_UNRESOLVED',
      message: 'Unable to resolve applicant user identity for offer creation.',
      requestId: rid,
    });
  }

  const tokenBytes = new Uint8Array(32);
  crypto.getRandomValues(tokenBytes);
  const rawPortalToken = toBase64Url(tokenBytes);
  const portalTokenHash = await sha256Hex(rawPortalToken);

  const { data: createdOffer, error: insertError } = await supabase
    .schema('command_center')
    .from('usce_offers')
    .insert({
      request_id: parsed.data.request_id,
      applicant_user_id: applicantUserId,
      program_seat_id: parsed.data.program_seat_id,
      amount_cents: parsed.data.amount_cents,
      currency: 'USD',
      status: 'DRAFT',
      subject: parsed.data.subject,
      html_body: parsed.data.html_body,
      text_body: parsed.data.text_body,
      portal_token_hash: portalTokenHash,
      portal_token_expires_at: null,
      portal_token_encrypted: null,
    })
    .select('id, status')
    .single();

  if (insertError) {
    if (insertError.code === '42501') {
      return errorResponse(403, {
        code: 'FORBIDDEN',
        message: 'Authenticated user is not allowed to create offers.',
        requestId: rid,
      });
    }

    return errorResponse(500, {
      code: 'DB_INSERT_FAILED',
      message: 'Failed to create offer.',
      requestId: rid,
      details: { supabase: insertError.message },
    });
  }

  return NextResponse.json(
    {
      id: createdOffer.id,
      status: createdOffer.status,
      raw_portal_token: rawPortalToken,
    },
    { status: 201 }
  );
}
