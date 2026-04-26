import { createHmac, timingSafeEqual } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { createRequestId, errorResponse } from '@/lib/usce/http';
import { createUSCESupabaseClientFactoryFromRuntime } from '@/lib/usce/supabaseClient';
import {
  runPaymentCaptureTransaction,
  type PaymentCaptureResult,
} from '@/lib/usce/transactions/payment-capture';

type StripeEvent = {
  id: string;
  type: string;
  created?: number;
  data?: {
    object?: Record<string, any>;
  };
};

function parseStripeSignature(header: string | null): { timestamp: string; v1: string } | null {
  if (!header) return null;

  const pairs = header.split(',').map((part) => part.trim());
  let timestamp = '';
  let v1 = '';

  for (const pair of pairs) {
    const [key, value] = pair.split('=');
    if (key === 't' && value) timestamp = value;
    if (key === 'v1' && value) v1 = value;
  }

  if (!timestamp || !v1) return null;
  return { timestamp, v1 };
}

function verifyStripeSignature(
  rawBody: string,
  signatureHeader: string | null,
  secret: string
): boolean {
  const parsed = parseStripeSignature(signatureHeader);
  if (!parsed) return false;

  const signedPayload = `${parsed.timestamp}.${rawBody}`;
  const digest = createHmac('sha256', secret).update(signedPayload, 'utf8').digest('hex');

  const expected = Buffer.from(digest, 'hex');
  const received = Buffer.from(parsed.v1, 'hex');
  if (expected.length !== received.length) return false;
  return timingSafeEqual(expected, received);
}

function normalizeCaptureResponse(result: PaymentCaptureResult): NextResponse {
  if (result.status === 'captured' || result.status === 'idempotent') {
    return NextResponse.json({ received: true, result }, { status: 200 });
  }

  if (result.status === 'metadata_mismatch') {
    return errorResponse(409, {
      code: result.code,
      message: result.reason,
      requestId: 'stripe_capture',
    });
  }

  if (result.code === 'STRIPE_METADATA_MISSING' || result.code === 'STRIPE_INVALID_TRANSITION') {
    return NextResponse.json(
      {
        received: true,
        acknowledged_without_mutation: true,
        code: result.code,
      },
      { status: 200 }
    );
  }

  return NextResponse.json(
    {
      received: true,
      acknowledged_without_mutation: true,
      code: result.code,
      reason: result.reason,
    },
    { status: 200 }
  );
}

export async function POST(request: NextRequest) {
  const requestId = createRequestId('usce_stripe_webhook');
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET ?? '';

  if (!webhookSecret) {
    return errorResponse(503, {
      code: 'SERVICE_UNAVAILABLE',
      message: 'Stripe webhook secret is not configured.',
      requestId,
    });
  }

  const rawBody = await request.text();
  const signature = request.headers.get('stripe-signature');
  if (!verifyStripeSignature(rawBody, signature, webhookSecret)) {
    return errorResponse(400, {
      code: 'INVALID_SIGNATURE',
      message: 'Stripe signature verification failed.',
      requestId,
    });
  }

  let event: StripeEvent;
  try {
    event = JSON.parse(rawBody) as StripeEvent;
  } catch {
    return errorResponse(400, {
      code: 'INVALID_PAYLOAD',
      message: 'Webhook payload must be valid JSON.',
      requestId,
    });
  }

  if (!event.id || !event.type) {
    return errorResponse(400, {
      code: 'INVALID_PAYLOAD',
      message: 'Stripe event payload missing required fields.',
      requestId,
    });
  }

  const factory = await createUSCESupabaseClientFactoryFromRuntime();
  const supabase: any = factory.createServiceRoleClient({ internal: true });

  const { error: insertEventError } = await supabase
    .schema('command_center')
    .from('usce_stripe_events')
    .insert({
      id: event.id,
      type: event.type,
      received_at: new Date().toISOString(),
      payload: event,
    });

  if (insertEventError?.code === '23505') {
    return NextResponse.json({ received: true, idempotent: true }, { status: 200 });
  }

  if (insertEventError) {
    return errorResponse(500, {
      code: 'DB_INSERT_FAILED',
      message: 'Failed to persist Stripe idempotency event row.',
      requestId,
      details: { supabase: insertEventError.message },
    });
  }

  const object = event.data?.object ?? {};
  const metadata = (object.metadata ?? {}) as Record<string, string | undefined>;

  if (event.type === 'payment_intent.succeeded') {
    const result = await runPaymentCaptureTransaction(supabase, {
      eventId: event.id,
      paymentIntentId: String(object.id ?? ''),
      metadata: {
        offer_id: metadata.offer_id,
        confirmation_id: metadata.confirmation_id,
        request_id: metadata.request_id,
        student_id: metadata.student_id,
      },
      payload: event as unknown as Record<string, unknown>,
    });

    return normalizeCaptureResponse(result);
  }

  if (event.type === 'payment_intent.payment_failed') {
    const offerId = metadata.offer_id;
    const confirmationId = metadata.confirmation_id;
    const nowIso = new Date().toISOString();

    if (offerId) {
      await supabase
        .schema('command_center')
        .from('usce_offers')
        .update({
          status: 'FAILED_PAYMENT',
          failed_at: nowIso,
          updated_at: nowIso,
        })
        .eq('id', offerId);
    }

    if (confirmationId) {
      await supabase
        .schema('command_center')
        .from('usce_confirmations')
        .update({
          status: 'FAILED',
          failed_at: nowIso,
          failed_reason: 'stripe_payment_failed',
          updated_at: nowIso,
        })
        .eq('id', confirmationId);
    }

    return NextResponse.json({ received: true }, { status: 200 });
  }

  if (event.type === 'payment_intent.requires_action') {
    return NextResponse.json(
      {
        received: true,
        acknowledged_without_mutation: true,
      },
      { status: 200 }
    );
  }

  if (event.type === 'charge.refunded') {
    const confirmationId = metadata.confirmation_id;
    const nowIso = new Date().toISOString();

    if (confirmationId) {
      await supabase
        .schema('command_center')
        .from('usce_confirmations')
        .update({
          status: 'REFUNDED',
          refunded_at: nowIso,
          updated_at: nowIso,
        })
        .eq('id', confirmationId);
    }

    return NextResponse.json({ received: true }, { status: 200 });
  }

  return NextResponse.json(
    {
      received: true,
      ignored: true,
      event_type: event.type,
    },
    { status: 200 }
  );
}
