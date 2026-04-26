import { NextRequest, NextResponse } from 'next/server';
import { createRequestId, errorResponse } from '@/lib/usce/http';
import { hashPortalToken } from '@/lib/usce/portal-token-crypto';
import { requireUserSession, withDbError } from '@/lib/usce/session';

const RETRY_WINDOW_MS = 30 * 60 * 1000;

function isLikelyPortalToken(token: string): boolean {
  return /^[A-Za-z0-9_-]{20,200}$/.test(token);
}

function makeIntentId(offerId: string, nextRetryCount: number): string {
  const bucket = Math.floor(Date.now() / (5 * 60 * 1000));
  return `pi_retry_${offerId.replace(/-/g, '').slice(0, 16)}_${nextRetryCount}_${bucket}`;
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ token: string }> }
) {
  const requestId = createRequestId('usce_retry_payment');
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
        'status',
        'retry_count',
        'failed_at',
        'payment_intent_id',
        'payment_intent_created_at',
        'portal_token_expires_at',
      ].join(', ')
    )
    .eq('portal_token_hash', tokenHash)
    .maybeSingle();

  if (offerError) {
    return withDbError(
      requestId,
      offerError,
      'DB_QUERY_FAILED',
      'Failed to load offer for payment retry.'
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
  if (!expiresAt || expiresAt.getTime() <= Date.now()) {
    return errorResponse(410, {
      code: 'EXPIRED',
      message: 'Portal token has expired.',
      requestId,
    });
  }

  if (offer.status !== 'FAILED_PAYMENT') {
    return errorResponse(409, {
      code: 'INVALID_TRANSITION',
      message: 'Retry is only available for FAILED_PAYMENT offers.',
      requestId,
      details: { current_status: offer.status },
    });
  }

  const currentRetryCount = Number(offer.retry_count ?? 0);
  if (currentRetryCount >= 2) {
    return errorResponse(409, {
      code: 'RETRY_LIMIT_REACHED',
      message: 'Payment retry limit has been reached.',
      requestId,
    });
  }

  const failedAtMs = offer.failed_at ? new Date(offer.failed_at).getTime() : NaN;
  if (!Number.isNaN(failedAtMs) && Date.now() - failedAtMs > RETRY_WINDOW_MS) {
    return errorResponse(409, {
      code: 'WINDOW_EXPIRED',
      message: 'The retry window has expired.',
      requestId,
    });
  }

  const nextRetryCount = currentRetryCount + 1;
  const paymentIntentId = makeIntentId(offer.id, nextRetryCount);
  const seatLockExpiresAt = new Date(Date.now() + RETRY_WINDOW_MS).toISOString();

  if (offer.payment_intent_id) {
    await supabase
      .schema('command_center')
      .from('usce_outbox')
      .insert({
        entity_type: 'offer',
        entity_id: offer.id,
        action: 'stripe_payment_intent_cancel',
        payload: {
          offer_id: offer.id,
          request_id: offer.request_id,
          stale_payment_intent_id: offer.payment_intent_id,
        },
        status: 'pending',
        idempotency_key: `${offer.id}:cancel:${currentRetryCount}`,
      });
  }

  const { data: updatedOffer, error: updateOfferError } = await supabase
    .schema('command_center')
    .from('usce_offers')
    .update({
      status: 'PENDING_PAYMENT',
      retry_count: nextRetryCount,
      payment_intent_id: paymentIntentId,
      payment_intent_created_at: new Date().toISOString(),
      failed_at: null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', offer.id)
    .eq('retry_count', currentRetryCount)
    .select('id, retry_count, payment_intent_id')
    .maybeSingle();

  if (updateOfferError) {
    return withDbError(
      requestId,
      updateOfferError,
      'DB_UPDATE_FAILED',
      'Failed to transition offer into PENDING_PAYMENT.'
    ).response;
  }

  if (!updatedOffer) {
    const { data: existingPending, error: existingPendingError } = await supabase
      .schema('command_center')
      .from('usce_offers')
      .select('retry_count, payment_intent_id, status')
      .eq('id', offer.id)
      .maybeSingle();

    if (existingPendingError) {
      return withDbError(
        requestId,
        existingPendingError,
        'DB_QUERY_FAILED',
        'Unable to resolve concurrent retry state.'
      ).response;
    }

    if (existingPending?.status === 'PENDING_PAYMENT' && existingPending.payment_intent_id) {
      return NextResponse.json(
        {
          stripe_client_secret: `cs_retry_${existingPending.payment_intent_id}`,
          retry_count: existingPending.retry_count,
          seat_lock_expires_at: seatLockExpiresAt,
        },
        { status: 200 }
      );
    }

    return errorResponse(409, {
      code: 'INVALID_TRANSITION',
      message: 'Concurrent retry conflict. Please refresh and retry once.',
      requestId,
    });
  }

  const { data: confirmation, error: confirmationError } = await supabase
    .schema('command_center')
    .from('usce_confirmations')
    .select('id, status, seat_lock_expires_at')
    .eq('offer_id', offer.id)
    .order('created_at', { ascending: false })
    .maybeSingle();

  if (confirmationError) {
    return withDbError(
      requestId,
      confirmationError,
      'DB_QUERY_FAILED',
      'Failed to load confirmation for payment retry.'
    ).response;
  }

  if (confirmation?.id) {
    const { error: updateConfirmationError } = await supabase
      .schema('command_center')
      .from('usce_confirmations')
      .update({
        status: 'PENDING_PAYMENT',
        stripe_payment_intent_id: paymentIntentId,
        seat_lock_expires_at: seatLockExpiresAt,
        failed_at: null,
        failed_reason: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', confirmation.id);

    if (updateConfirmationError) {
      return withDbError(
        requestId,
        updateConfirmationError,
        'DB_UPDATE_FAILED',
        'Failed to update confirmation during retry.'
      ).response;
    }
  }

  return NextResponse.json(
    {
      stripe_client_secret: `cs_retry_${paymentIntentId}`,
      retry_count: updatedOffer.retry_count,
      seat_lock_expires_at: confirmation?.seat_lock_expires_at ?? seatLockExpiresAt,
      payment_intent_id: paymentIntentId,
    },
    { status: 200 }
  );
}
