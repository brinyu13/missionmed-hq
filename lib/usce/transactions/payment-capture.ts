type SupabaseAny = any;

type StripeMetadata = {
  offer_id?: string;
  confirmation_id?: string;
  request_id?: string;
  student_id?: string;
};

export type PaymentCaptureInput = {
  eventId: string;
  paymentIntentId: string;
  metadata: StripeMetadata;
  payload: Record<string, unknown>;
};

export type PaymentCaptureResult =
  | {
      status: 'captured';
      confirmation_id: string;
      offer_id: string;
      request_id: string;
      invalidated_siblings: number;
    }
  | { status: 'idempotent'; reason: string }
  | { status: 'blocked'; code: string; reason: string }
  | { status: 'metadata_mismatch'; code: string; reason: string };

const HOLDING_HARD = new Set(['ACCEPTED', 'PENDING_PAYMENT', 'FAILED_PAYMENT']);
const HOLDING_SOFT = new Set(['SENT', 'REMINDED']);
const ACTIVE_SIBLINGS = new Set([
  'SENT',
  'REMINDED',
  'ACCEPTED',
  'PENDING_PAYMENT',
  'FAILED_PAYMENT',
]);

async function decrementSeatCounter(
  supabase: SupabaseAny,
  seatId: string,
  column: 'seats_held_hard' | 'seats_held_soft'
): Promise<void> {
  const { data: seat } = await supabase
    .schema('command_center')
    .from('usce_program_seats')
    .select(`id, ${column}`)
    .eq('id', seatId)
    .maybeSingle();

  if (!seat?.id) return;

  const current = Number(seat[column] ?? 0);
  const next = current > 0 ? current - 1 : 0;
  await supabase
    .schema('command_center')
    .from('usce_program_seats')
    .update({ [column]: next })
    .eq('id', seatId);
}

async function convertHardHoldToFilled(
  supabase: SupabaseAny,
  seatId: string
): Promise<void> {
  const { data: seat } = await supabase
    .schema('command_center')
    .from('usce_program_seats')
    .select('id, seats_held_hard, seats_filled')
    .eq('id', seatId)
    .maybeSingle();

  if (!seat?.id) return;

  const heldHard = Number(seat.seats_held_hard ?? 0);
  const filled = Number(seat.seats_filled ?? 0);

  await supabase
    .schema('command_center')
    .from('usce_program_seats')
    .update({
      seats_held_hard: heldHard > 0 ? heldHard - 1 : 0,
      seats_filled: filled + 1,
    })
    .eq('id', seatId);
}

function hasRequiredMetadata(metadata: StripeMetadata): metadata is Required<StripeMetadata> {
  return Boolean(
    metadata.offer_id &&
      metadata.confirmation_id &&
      metadata.request_id &&
      metadata.student_id
  );
}

async function insertDeadLetter(
  supabase: SupabaseAny,
  source: string,
  error: string,
  payload: Record<string, unknown>,
  entityId?: string
): Promise<void> {
  await supabase.schema('command_center').from('usce_dead_letter').insert({
    source,
    entity_type: 'stripe_event',
    entity_id: entityId ?? null,
    payload,
    error,
    retryable: false,
    recovered: false,
  });
}

export async function runPaymentCaptureTransaction(
  supabase: SupabaseAny,
  input: PaymentCaptureInput
): Promise<PaymentCaptureResult> {
  if (!hasRequiredMetadata(input.metadata)) {
    await insertDeadLetter(
      supabase,
      'stripe_webhook',
      'STRIPE_METADATA_MISSING',
      input.payload
    );
    return {
      status: 'blocked',
      code: 'STRIPE_METADATA_MISSING',
      reason: 'Required Stripe metadata fields are missing.',
    };
  }

  const metadata = input.metadata;

  const { data: confirmation, error: confirmationError } = await supabase
    .schema('command_center')
    .from('usce_confirmations')
    .select('id, offer_id, request_id, applicant_user_id, status, seat_lock_type')
    .eq('id', metadata.confirmation_id)
    .maybeSingle();

  if (confirmationError || !confirmation) {
    return {
      status: 'metadata_mismatch',
      code: 'STRIPE_METADATA_MISMATCH',
      reason: 'Confirmation row could not be resolved for Stripe metadata.',
    };
  }

  if (
    confirmation.offer_id !== metadata.offer_id ||
    confirmation.request_id !== metadata.request_id ||
    confirmation.applicant_user_id !== metadata.student_id
  ) {
    return {
      status: 'metadata_mismatch',
      code: 'STRIPE_METADATA_MISMATCH',
      reason: 'Stripe metadata does not match DB identity binding.',
    };
  }

  if (confirmation.status === 'PAYMENT_CAPTURED' || confirmation.status === 'ENROLLED') {
    return {
      status: 'idempotent',
      reason: 'Confirmation already captured.',
    };
  }

  if (!['PENDING_PAYMENT', 'PAYMENT_AUTHORIZED'].includes(confirmation.status)) {
    return {
      status: 'blocked',
      code: 'STRIPE_INVALID_TRANSITION',
      reason: `Cannot capture from ${confirmation.status}.`,
    };
  }

  const nowIso = new Date().toISOString();

  const { data: offer, error: offerError } = await supabase
    .schema('command_center')
    .from('usce_offers')
    .select('id, request_id, status, program_seat_id')
    .eq('id', metadata.offer_id)
    .maybeSingle();

  if (offerError || !offer) {
    return {
      status: 'metadata_mismatch',
      code: 'STRIPE_METADATA_MISMATCH',
      reason: 'Offer row could not be resolved.',
    };
  }

  if (!['PENDING_PAYMENT', 'ACCEPTED', 'FAILED_PAYMENT'].includes(offer.status)) {
    if (offer.status === 'PAID') {
      return { status: 'idempotent', reason: 'Offer already PAID.' };
    }
    return {
      status: 'blocked',
      code: 'STRIPE_INVALID_TRANSITION',
      reason: `Offer cannot move to PAID from ${offer.status}.`,
    };
  }

  const { error: confirmationUpdateError } = await supabase
    .schema('command_center')
    .from('usce_confirmations')
    .update({
      status: 'PAYMENT_CAPTURED',
      stripe_payment_intent_id: input.paymentIntentId,
      captured_at: nowIso,
      updated_at: nowIso,
    })
    .eq('id', confirmation.id);

  if (confirmationUpdateError) {
    return {
      status: 'blocked',
      code: 'DB_UPDATE_FAILED',
      reason: confirmationUpdateError.message,
    };
  }

  const { error: offerUpdateError } = await supabase
    .schema('command_center')
    .from('usce_offers')
    .update({
      status: 'PAID',
      payment_intent_id: input.paymentIntentId,
      paid_at: nowIso,
      updated_at: nowIso,
    })
    .eq('id', offer.id);

  if (offerUpdateError) {
    return {
      status: 'blocked',
      code: 'DB_UPDATE_FAILED',
      reason: offerUpdateError.message,
    };
  }

  await convertHardHoldToFilled(supabase, offer.program_seat_id);

  await supabase
    .schema('command_center')
    .from('usce_requests')
    .update({
      status: 'FULFILLED',
      updated_at: nowIso,
    })
    .eq('id', offer.request_id);

  const { data: siblings, error: siblingsError } = await supabase
    .schema('command_center')
    .from('usce_offers')
    .select('id, status, program_seat_id')
    .eq('request_id', offer.request_id)
    .neq('id', offer.id);

  if (siblingsError) {
    return {
      status: 'blocked',
      code: 'DB_QUERY_FAILED',
      reason: siblingsError.message,
    };
  }

  const siblingsToInvalidate = (siblings ?? []).filter((row: any) =>
    ACTIVE_SIBLINGS.has(row.status)
  );

  let invalidatedCount = 0;
  for (const sibling of siblingsToInvalidate) {
    const { error: invalidateError } = await supabase
      .schema('command_center')
      .from('usce_offers')
      .update({
        status: 'INVALIDATED',
        invalidated_at: nowIso,
        invalidated_reason: 'sibling_paid',
        updated_at: nowIso,
      })
      .eq('id', sibling.id);

    if (invalidateError) {
      return {
        status: 'blocked',
        code: 'DB_UPDATE_FAILED',
        reason: invalidateError.message,
      };
    }

    if (HOLDING_HARD.has(sibling.status)) {
      await decrementSeatCounter(supabase, sibling.program_seat_id, 'seats_held_hard');
    } else if (HOLDING_SOFT.has(sibling.status)) {
      await decrementSeatCounter(supabase, sibling.program_seat_id, 'seats_held_soft');
    }

    invalidatedCount += 1;
  }

  return {
    status: 'captured',
    confirmation_id: confirmation.id,
    offer_id: offer.id,
    request_id: offer.request_id,
    invalidated_siblings: invalidatedCount,
  };
}
