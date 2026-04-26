import { NextRequest, NextResponse } from 'next/server';
import { createRequestId, errorResponse } from '@/lib/usce/http';
import { hashPortalToken } from '@/lib/usce/portal-token-crypto';
import { resolvePortalUiState } from '@/lib/usce/portal-ui-state';
import { requireUserSession, withDbError } from '@/lib/usce/session';

function isLikelyPortalToken(token: string): boolean {
  return /^[A-Za-z0-9_-]{20,200}$/.test(token);
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ token: string }> }
) {
  const requestId = createRequestId('usce_portal_get');
  const { token } = await context.params;

  if (!isLikelyPortalToken(token)) {
    return errorResponse(401, {
      code: 'INVALID_TOKEN',
      message: 'Portal token is malformed.',
      requestId,
    });
  }

  const auth = await requireUserSession(request, requestId, { portalToken: token });
  if ('response' in auth) return auth.response;

  const supabase: any = auth.supabase;
  const tokenHash = hashPortalToken(token);

  const { data: offer, error: offerError } = await supabase
    .schema('command_center')
    .from('usce_offers')
    .select(
      [
        'id',
        'request_id',
        'applicant_user_id',
        'program_seat_id',
        'amount_cents',
        'currency',
        'status',
        'subject',
        'html_body',
        'text_body',
        'portal_token_expires_at',
        'responded_at',
        'response',
        'payment_intent_id',
        'payment_intent_created_at',
        'retry_count',
        'failed_at',
        'paid_at',
        'expired_at',
        'invalidated_at',
        'invalidated_reason',
        'revoked_at',
        'created_at',
      ].join(', ')
    )
    .eq('portal_token_hash', tokenHash)
    .maybeSingle();

  if (offerError) {
    return withDbError(
      requestId,
      offerError,
      'DB_QUERY_FAILED',
      'Failed to resolve portal offer.',
      'Offer lookup is blocked by access policy.'
    ).response;
  }

  if (!offer) {
    return errorResponse(401, {
      code: 'INVALID_TOKEN',
      message: 'Portal token is invalid.',
      requestId,
    });
  }

  if (offer.applicant_user_id !== auth.user.id) {
    return errorResponse(403, {
      code: 'IDENTITY_OFFER_MISMATCH',
      message: 'Authenticated user does not match this offer.',
      requestId,
    });
  }

  const expiresAt = offer.portal_token_expires_at ? new Date(offer.portal_token_expires_at) : null;
  const isExpired = !expiresAt || expiresAt.getTime() <= Date.now();
  if (isExpired) {
    return errorResponse(410, {
      code: 'EXPIRED',
      message: 'This portal token has expired.',
      requestId,
    });
  }

  const { data: confirmation, error: confirmationError } = await supabase
    .schema('command_center')
    .from('usce_confirmations')
    .select(
      [
        'id',
        'offer_id',
        'request_id',
        'status',
        'amount_cents',
        'currency',
        'stripe_payment_intent_id',
        'seat_lock_type',
        'seat_lock_expires_at',
        'manual_payment',
        'manual_reference',
        'captured_at',
        'failed_at',
        'failed_reason',
        'refunded_at',
        'refund_reason',
        'enrolled_at',
        'created_at',
      ].join(', ')
    )
    .eq('offer_id', offer.id)
    .order('created_at', { ascending: false })
    .maybeSingle();

  if (confirmationError) {
    return withDbError(
      requestId,
      confirmationError,
      'DB_QUERY_FAILED',
      'Failed to load confirmation state.'
    ).response;
  }

  const uiState = resolvePortalUiState({
    offerStatus: offer.status,
    confirmationStatus: confirmation?.status ?? null,
    retryCount: Number(offer.retry_count ?? 0),
    isTokenExpired: isExpired,
  });

  return NextResponse.json(
    {
      offer: {
        id: offer.id,
        request_id: offer.request_id,
        program_seat_id: offer.program_seat_id,
        amount_cents: offer.amount_cents,
        currency: offer.currency,
        status: offer.status,
        subject: offer.subject,
        html_body: offer.html_body,
        text_body: offer.text_body,
        portal_token_expires_at: offer.portal_token_expires_at,
        responded_at: offer.responded_at,
        response: offer.response,
        payment_intent_id: offer.payment_intent_id,
        payment_intent_created_at: offer.payment_intent_created_at,
        retry_count: offer.retry_count,
        failed_at: offer.failed_at,
        paid_at: offer.paid_at,
        expired_at: offer.expired_at,
        invalidated_at: offer.invalidated_at,
        invalidated_reason: offer.invalidated_reason,
        revoked_at: offer.revoked_at,
        created_at: offer.created_at,
      },
      confirmation: confirmation ?? null,
      ui_state: uiState,
    },
    { status: 200 }
  );
}
