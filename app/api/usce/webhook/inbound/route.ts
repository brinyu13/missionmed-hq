import { NextRequest, NextResponse } from 'next/server';
import { createRequestId, errorResponse, isUuid } from '@/lib/usce/http';
import { createUSCESupabaseClientFactoryFromRuntime } from '@/lib/usce/supabaseClient';
import { verifySignedRequest } from '@/lib/usce/security/signed-request';

type HeaderItem = { Name?: string; name?: string; Value?: string; value?: string };

function headerValue(headers: HeaderItem[] | undefined, key: string): string | null {
  if (!Array.isArray(headers)) return null;
  const lower = key.toLowerCase();
  for (const header of headers) {
    const name = String(header.Name ?? header.name ?? '').toLowerCase();
    const value = header.Value ?? header.value;
    if (name === lower && typeof value === 'string' && value.trim()) {
      return value.trim();
    }
  }
  return null;
}

function findOfferMarker(text: string | undefined): string | null {
  if (!text) return null;
  const match = text.match(/#USCE-([0-9a-f-]{36})#/i);
  if (!match) return null;
  return isUuid(match[1]) ? match[1] : null;
}

async function resolveOfferId(supabase: any, payload: any): Promise<{ offerId: string | null; threadId: string | null }> {
  const headers = payload?.Headers as HeaderItem[] | undefined;

  const headerOfferId = headerValue(headers, 'x-usce-offer-id');
  if (headerOfferId && isUuid(headerOfferId)) {
    const { data: offer } = await supabase
      .schema('command_center')
      .from('usce_offers')
      .select('id, request_id')
      .eq('id', headerOfferId)
      .maybeSingle();
    if (offer?.id) return { offerId: offer.id, threadId: offer.request_id ?? null };
  }

  const markerOfferId =
    findOfferMarker(payload?.Subject) ??
    findOfferMarker(payload?.TextBody) ??
    findOfferMarker(payload?.HtmlBody);
  if (markerOfferId) {
    const { data: offer } = await supabase
      .schema('command_center')
      .from('usce_offers')
      .select('id, request_id')
      .eq('id', markerOfferId)
      .maybeSingle();
    if (offer?.id) return { offerId: offer.id, threadId: offer.request_id ?? null };
  }

  const inReplyTo =
    payload?.InReplyTo ??
    payload?.InReplyToMessageId ??
    payload?.OriginalMessageID ??
    headerValue(headers, 'in-reply-to');

  if (typeof inReplyTo === 'string' && inReplyTo.trim()) {
    const { data: comm } = await supabase
      .schema('command_center')
      .from('usce_comms')
      .select('offer_id, thread_id')
      .eq('postmark_message_id', inReplyTo.trim())
      .order('created_at', { ascending: false })
      .maybeSingle();

    if (comm?.offer_id || comm?.thread_id) {
      return {
        offerId: comm.offer_id ?? null,
        threadId: comm.thread_id ?? null,
      };
    }
  }

  return { offerId: null, threadId: null };
}

export async function POST(request: NextRequest) {
  const requestId = createRequestId('usce_postmark_inbound');
  const rawBody = await request.text();

  const factory = await createUSCESupabaseClientFactoryFromRuntime();
  const supabase: any = factory.createServiceRoleClient({ internal: true });

  const check = await verifySignedRequest({
    supabase,
    source: 'postmark_inbound',
    secret: process.env.POSTMARK_INBOUND_SECRET ?? '',
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

  const eventId =
    String(payload?.MessageID ?? payload?.MessageId ?? payload?.ID ?? '').trim() ||
    `postmark_inbound_${Date.now().toString(36)}`;

  const { error: idempotencyError } = await supabase
    .schema('command_center')
    .from('usce_postmark_events')
    .insert({
      id: eventId,
      event_type: 'Inbound',
      payload,
      processed: false,
    });

  if (idempotencyError?.code === '23505') {
    return NextResponse.json(
      {
        resolved_offer_id: null,
        thread_id: null,
        needs_triage: false,
        idempotent: true,
      },
      { status: 200 }
    );
  }

  if (idempotencyError) {
    return errorResponse(500, {
      code: 'DB_INSERT_FAILED',
      message: 'Failed to persist Postmark idempotency event row.',
      requestId,
      details: { supabase: idempotencyError.message },
    });
  }

  const resolved = await resolveOfferId(supabase, payload);
  const needsTriage = !(resolved.offerId && resolved.threadId);

  const { error: commError } = await supabase
    .schema('command_center')
    .from('usce_comms')
    .insert({
      offer_id: resolved.offerId,
      thread_id: resolved.threadId,
      direction: 'IN',
      is_internal_note: false,
      message_status: 'delivered',
      from_email: payload?.From ?? payload?.FromFull?.Email ?? null,
      to_email: payload?.To ?? null,
      subject: payload?.Subject ?? null,
      body_text: payload?.TextBody ?? null,
      body_html: payload?.HtmlBody ?? null,
      postmark_message_id: eventId,
      in_reply_to_postmark_message_id:
        payload?.InReplyTo ?? payload?.InReplyToMessageId ?? null,
      raw_json: payload,
      needs_triage: needsTriage,
      created_by: null,
    });

  if (commError) {
    return errorResponse(500, {
      code: 'DB_INSERT_FAILED',
      message: 'Failed to persist inbound communication row.',
      requestId,
      details: { supabase: commError.message },
    });
  }

  await supabase
    .schema('command_center')
    .from('usce_postmark_events')
    .update({ processed: true })
    .eq('id', eventId);

  return NextResponse.json(
    {
      resolved_offer_id: resolved.offerId,
      thread_id: resolved.threadId,
      needs_triage: needsTriage,
    },
    { status: 200 }
  );
}
