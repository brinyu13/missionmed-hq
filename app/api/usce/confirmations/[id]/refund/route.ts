import { NextRequest, NextResponse } from 'next/server';
import { createRequestId, errorResponse, isUuid } from '@/lib/usce/http';
import { requireUserSession, withDbError } from '@/lib/usce/session';

function canRefund(user: any): boolean {
  const role = user?.app_metadata?.mm_role;
  if (role === 'admin' || role === 'coordinator') return true;
  const roles = user?.user_metadata?.roles;
  return Array.isArray(roles) && (roles.includes('admin') || roles.includes('coordinator'));
}

function buildRefundId(confirmationId: string): string {
  return `re_stub_${confirmationId.replace(/-/g, '').slice(0, 24)}_${Date.now().toString(36)}`;
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const requestId = createRequestId('usce_refund');
  const { id } = await context.params;

  if (!isUuid(id)) {
    return errorResponse(400, {
      code: 'VALIDATION_FAILED',
      message: 'Path id must be a valid UUID.',
      requestId,
    });
  }

  const auth = await requireUserSession(request, requestId);
  if ('response' in auth) return auth.response;

  if (!canRefund(auth.user)) {
    return errorResponse(403, {
      code: 'FORBIDDEN',
      message: 'Only coordinator/admin roles can issue refunds.',
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

  const reason = typeof (payload as any)?.reason === 'string' ? (payload as any).reason.trim() : '';
  if (reason.length < 10) {
    return errorResponse(422, {
      code: 'VALIDATION_FAILED',
      message: 'reason is required and must be at least 10 characters.',
      requestId,
    });
  }

  const supabase: any = auth.supabase;
  const { data: confirmation, error: confirmationError } = await supabase
    .schema('command_center')
    .from('usce_confirmations')
    .select('id, offer_id, status')
    .eq('id', id)
    .maybeSingle();

  if (confirmationError) {
    return withDbError(
      requestId,
      confirmationError,
      'DB_QUERY_FAILED',
      'Failed to load confirmation.'
    ).response;
  }

  if (!confirmation) {
    return errorResponse(404, {
      code: 'NOT_FOUND',
      message: 'Confirmation not found.',
      requestId,
    });
  }

  if (!['PAYMENT_CAPTURED', 'ENROLLED', 'REFUNDED'].includes(confirmation.status)) {
    return errorResponse(409, {
      code: 'INVALID_TRANSITION',
      message: `Refund is not allowed from ${confirmation.status}.`,
      requestId,
    });
  }

  if (confirmation.status === 'REFUNDED') {
    return NextResponse.json(
      {
        confirmation_status: 'REFUNDED',
        stripe_refund_id: null,
        idempotent: true,
      },
      { status: 200 }
    );
  }

  const stripeRefundId = buildRefundId(confirmation.id);
  const nowIso = new Date().toISOString();

  const { error: confirmationUpdateError } = await supabase
    .schema('command_center')
    .from('usce_confirmations')
    .update({
      status: 'REFUNDED',
      refunded_at: nowIso,
      refunded_by: auth.user.id,
      refund_reason: reason,
      updated_at: nowIso,
    })
    .eq('id', confirmation.id);

  if (confirmationUpdateError) {
    await supabase
      .schema('command_center')
      .from('usce_dead_letter')
      .insert({
        source: 'refund_endpoint',
        entity_type: 'confirmation',
        entity_id: confirmation.id,
        payload: {
          confirmation_id: confirmation.id,
          stripe_refund_id: stripeRefundId,
          reason,
        },
        error: confirmationUpdateError.message,
        retryable: true,
        recovered: false,
      });

    return NextResponse.json(
      {
        code: 'PARTIAL_FAILURE',
        message: 'Refund initiated but DB reconciliation failed. Dead-letter entry recorded.',
        requestId,
        stripe_refund_id: stripeRefundId,
      },
      { status: 202 }
    );
  }

  const { data: offer } = await supabase
    .schema('command_center')
    .from('usce_offers')
    .select('id, program_seat_id')
    .eq('id', confirmation.offer_id)
    .maybeSingle();

  if (offer?.program_seat_id) {
    const { data: seat } = await supabase
      .schema('command_center')
      .from('usce_program_seats')
      .select('id, seats_filled')
      .eq('id', offer.program_seat_id)
      .maybeSingle();

    if (seat?.id) {
      const seatsFilled = Number(seat.seats_filled ?? 0);
      await supabase
        .schema('command_center')
        .from('usce_program_seats')
        .update({
          seats_filled: seatsFilled > 0 ? seatsFilled - 1 : 0,
        })
        .eq('id', seat.id);
    }
  }

  return NextResponse.json(
    {
      confirmation_status: 'REFUNDED',
      stripe_refund_id: stripeRefundId,
    },
    { status: 200 }
  );
}
