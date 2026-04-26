import { NextRequest, NextResponse } from 'next/server';
import { createRequestId, errorResponse } from '@/lib/usce/http';
import { createUSCESupabaseClientFactoryFromRuntime } from '@/lib/usce/supabaseClient';
import { verifySignedRequest } from '@/lib/usce/security/signed-request';

function normalizeEventType(payload: any): 'Delivery' | 'Open' | 'Bounce' | 'SpamComplaint' | null {
  const raw = String(payload?.RecordType ?? payload?.Type ?? payload?.event ?? '').toLowerCase();
  if (raw === 'delivery') return 'Delivery';
  if (raw === 'open') return 'Open';
  if (raw === 'bounce') return 'Bounce';
  if (raw === 'spamcomplaint' || raw === 'spam_complaint') return 'SpamComplaint';
  return null;
}

function statusForEvent(eventType: 'Delivery' | 'Open' | 'Bounce' | 'SpamComplaint') {
  if (eventType === 'Delivery') return 'delivered';
  if (eventType === 'Open') return 'opened';
  if (eventType === 'Bounce') return 'bounced';
  return 'complained';
}

export async function POST(request: NextRequest) {
  const requestId = createRequestId('usce_postmark_delivery');
  const rawBody = await request.text();

  const factory = await createUSCESupabaseClientFactoryFromRuntime();
  const supabase: any = factory.createServiceRoleClient({ internal: true });

  const check = await verifySignedRequest({
    supabase,
    source: 'postmark_delivery',
    secret: process.env.POSTMARK_DELIVERY_SECRET ?? '',
    headers: request.headers,
    rawBody,
    maxSkewSeconds: 300,
  });

  if (!check.ok) {
    return errorResponse(401, {
      code: check.code,
      message: check.message,
      requestId,
    });
  }

  let payload: any;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return errorResponse(400, {
      code: 'INVALID_PAYLOAD',
      message: 'Postmark payload must be valid JSON.',
      requestId,
    });
  }

  const eventType = normalizeEventType(payload);
  if (!eventType) {
    return NextResponse.json(
      {
        updated_comm_id: null,
        new_message_status: null,
        ignored: true,
      },
      { status: 200 }
    );
  }

  const messageId = String(payload?.MessageID ?? payload?.MessageId ?? '').trim();
  if (!messageId) {
    return errorResponse(400, {
      code: 'INVALID_PAYLOAD',
      message: 'MessageID is required.',
      requestId,
    });
  }

  const eventId = `${eventType}:${messageId}`;
  const { error: idempotencyError } = await supabase
    .schema('command_center')
    .from('usce_postmark_events')
    .insert({
      id: eventId,
      event_type: eventType,
      payload,
      processed: false,
    });

  if (idempotencyError?.code === '23505') {
    return NextResponse.json(
      {
        updated_comm_id: null,
        new_message_status: statusForEvent(eventType),
        idempotent: true,
      },
      { status: 200 }
    );
  }

  if (idempotencyError) {
    return errorResponse(500, {
      code: 'DB_INSERT_FAILED',
      message: 'Failed to persist Postmark delivery idempotency row.',
      requestId,
      details: { supabase: idempotencyError.message },
    });
  }

  const { data: comm } = await supabase
    .schema('command_center')
    .from('usce_comms')
    .select('id, thread_id')
    .eq('postmark_message_id', messageId)
    .order('created_at', { ascending: false })
    .maybeSingle();

  if (!comm?.id) {
    await supabase
      .schema('command_center')
      .from('usce_postmark_events')
      .update({ processed: true })
      .eq('id', eventId);

    return NextResponse.json(
      {
        updated_comm_id: null,
        new_message_status: statusForEvent(eventType),
      },
      { status: 200 }
    );
  }

  const nowIso = new Date().toISOString();
  const updatePayload: Record<string, unknown> = {
    message_status: statusForEvent(eventType),
  };

  if (eventType === 'Delivery') updatePayload.delivered_at = nowIso;
  if (eventType === 'Open') updatePayload.opened_at = nowIso;
  if (eventType === 'Bounce' || eventType === 'SpamComplaint') {
    updatePayload.failed_at = nowIso;
    updatePayload.needs_triage = true;
  }

  const { error: commUpdateError } = await supabase
    .schema('command_center')
    .from('usce_comms')
    .update(updatePayload)
    .eq('id', comm.id);

  if (commUpdateError) {
    return errorResponse(500, {
      code: 'DB_UPDATE_FAILED',
      message: 'Failed to update communication delivery status.',
      requestId,
      details: { supabase: commUpdateError.message },
    });
  }

  if (eventType === 'Bounce' || eventType === 'SpamComplaint') {
    await supabase
      .schema('command_center')
      .from('usce_comms')
      .insert({
        offer_id: null,
        thread_id: comm.thread_id ?? null,
        direction: 'SYS',
        is_internal_note: true,
        message_status: 'sent',
        subject: eventType === 'Bounce' ? 'Email bounced' : 'Spam complaint received',
        body_text:
          eventType === 'Bounce'
            ? `Postmark bounce received for message ${messageId}.`
            : `Postmark spam complaint received for message ${messageId}.`,
        body_html: null,
        postmark_message_id: null,
        raw_json: payload,
        needs_triage: true,
        created_by: null,
      });
  }

  await supabase
    .schema('command_center')
    .from('usce_postmark_events')
    .update({ processed: true })
    .eq('id', eventId);

  return NextResponse.json(
    {
      updated_comm_id: comm.id,
      new_message_status: statusForEvent(eventType),
    },
    { status: 200 }
  );
}
