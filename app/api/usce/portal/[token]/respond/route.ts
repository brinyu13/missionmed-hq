import { NextRequest, NextResponse } from 'next/server';
import { validateRespondPortalBody } from '@/lib/usce/schemas';
import { createRequestId, errorResponse } from '@/lib/usce/http';
import { hashPortalToken } from '@/lib/usce/portal-token-crypto';
import { requireUserSession, withDbError } from '@/lib/usce/session';

function isLikelyPortalToken(token: string): boolean {
  return /^[A-Za-z0-9_-]{20,200}$/.test(token);
}

function buildPaymentIntentId(tokenHash: string): string {
  return `pi_stub_${tokenHash.slice(0, 24)}_${Date.now().toString(36)}`;
}

function extractRpcCode(message: string | undefined): string {
  const normalized = (message ?? '').toUpperCase();
  if (normalized.includes('IDENTITY_OFFER_MISMATCH')) return 'IDENTITY_OFFER_MISMATCH';
  if (normalized.includes('INVALID_TOKEN')) return 'INVALID_TOKEN';
  if (normalized.includes('EXPIRED')) return 'EXPIRED';
  if (normalized.includes('NO_SEATS')) return 'NO_SEATS';
  if (normalized.includes('ALREADY_ACCEPTED')) return 'ALREADY_ACCEPTED';
  if (normalized.includes('INVALID_TRANSITION')) return 'INVALID_TRANSITION';
  if (normalized.includes('PORTAL_MUTATION_FORBIDDEN')) return 'PORTAL_MUTATION_FORBIDDEN';
  return 'RPC_FAILED';
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ token: string }> }
) {
  const requestId = createRequestId('usce_portal_respond');
  const { token } = await context.params;

  if (!isLikelyPortalToken(token)) {
    return errorResponse(401, {
      code: 'INVALID_TOKEN',
      message: 'Portal token is malformed.',
      requestId,
    });
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return errorResponse(400, {
      code: 'INVALID_JSON',
      message: 'Request body must be valid JSON.',
      requestId,
    });
  }

  const parsed = validateRespondPortalBody(payload);
  if (!parsed.success) {
    return errorResponse(422, {
      code: 'VALIDATION_FAILED',
      message: 'Invalid portal response payload.',
      requestId,
      details: parsed.errors,
    });
  }

  const auth = await requireUserSession(request, requestId, { portalToken: token });
  if ('response' in auth) return auth.response;

  const supabase: any = auth.supabase;
  const tokenHash = hashPortalToken(token);
  const paymentIntentId =
    parsed.data.action === 'ACCEPT' ? buildPaymentIntentId(tokenHash) : null;

  const { data: rpcData, error: rpcError } = await supabase.rpc('usce_portal_respond', {
    p_portal_token_hash: tokenHash,
    p_action: parsed.data.action,
    p_payment_intent_id: paymentIntentId,
    p_caller_user_id: auth.user.id,
  });

  if (rpcError) {
    const code = extractRpcCode(rpcError.message);

    if (code === 'IDENTITY_OFFER_MISMATCH') {
      return errorResponse(403, {
        code,
        message: 'Authenticated user does not match this offer.',
        requestId,
      });
    }

    if (code === 'INVALID_TOKEN') {
      return errorResponse(401, {
        code,
        message: 'Portal token is invalid.',
        requestId,
      });
    }

    if (code === 'EXPIRED') {
      return errorResponse(410, {
        code,
        message: 'Portal token has expired.',
        requestId,
      });
    }

    if (['NO_SEATS', 'ALREADY_ACCEPTED', 'INVALID_TRANSITION'].includes(code)) {
      return errorResponse(409, {
        code,
        message: 'Portal response cannot be processed in the current state.',
        requestId,
        details: { supabase: rpcError.message },
      });
    }

    return withDbError(
      requestId,
      rpcError,
      'RPC_FAILED',
      'Failed to execute portal response RPC.'
    ).response;
  }

  const status = String(rpcData?.status ?? '').toUpperCase();
  if (status === 'DECLINED') {
    return NextResponse.json(
      {
        status: 'DECLINED',
        offer_id: rpcData?.offer_id ?? null,
        request_id: rpcData?.request_id ?? null,
      },
      { status: 200 }
    );
  }

  const confirmationId = rpcData?.confirmation_id ?? null;
  const redirectTo = `/usce/portal/${encodeURIComponent(token)}/pay`;
  const stripeClientSecret = `cs_stub_${String(confirmationId ?? 'pending')}`;

  return NextResponse.json(
    {
      status: 'ACCEPTED',
      redirect_to: redirectTo,
      stripe_client_secret: stripeClientSecret,
      confirmation_id: confirmationId,
      payment_intent_id: rpcData?.payment_intent_id ?? paymentIntentId,
    },
    { status: 200 }
  );
}
