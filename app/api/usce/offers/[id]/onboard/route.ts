import { randomBytes } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { createRequestId, errorResponse, isUuid } from '@/lib/usce/http';
import { createUSCESupabaseClientFactoryFromRuntime } from '@/lib/usce/supabaseClient';

function isSystemAuthorized(request: NextRequest): boolean {
  const incoming = request.headers.get('x-system-secret');
  const expected = process.env.USCE_SYSTEM_SECRET;
  return Boolean(expected && incoming && incoming === expected);
}

function randomPassword(): string {
  return `${randomBytes(12).toString('base64url')}A9!`;
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const requestId = createRequestId('usce_onboard');
  const { id } = await context.params;

  if (!isUuid(id)) {
    return errorResponse(400, {
      code: 'VALIDATION_FAILED',
      message: 'Path id must be a valid UUID.',
      requestId,
    });
  }

  if (!isSystemAuthorized(request)) {
    return errorResponse(401, {
      code: 'UNAUTHORIZED',
      message: 'Missing or invalid system secret.',
      requestId,
    });
  }

  const factory = await createUSCESupabaseClientFactoryFromRuntime();
  const supabase: any = factory.createServiceRoleClient({ internal: true });

  const { data: offer, error: offerError } = await supabase
    .schema('command_center')
    .from('usce_offers')
    .select('id, request_id, applicant_user_id, status')
    .eq('id', id)
    .maybeSingle();

  if (offerError) {
    return errorResponse(500, {
      code: 'DB_QUERY_FAILED',
      message: 'Failed to load offer.',
      requestId,
      details: { supabase: offerError.message },
    });
  }

  if (!offer) {
    return errorResponse(404, {
      code: 'NOT_FOUND',
      message: 'Offer not found.',
      requestId,
    });
  }

  const { data: confirmation, error: confirmationError } = await supabase
    .schema('command_center')
    .from('usce_confirmations')
    .select('id, status')
    .eq('offer_id', offer.id)
    .order('created_at', { ascending: false })
    .maybeSingle();

  if (confirmationError) {
    return errorResponse(500, {
      code: 'DB_QUERY_FAILED',
      message: 'Failed to load confirmation.',
      requestId,
      details: { supabase: confirmationError.message },
    });
  }

  if (!confirmation) {
    return errorResponse(409, {
      code: 'INVALID_TRANSITION',
      message: 'No confirmation row exists for this offer.',
      requestId,
    });
  }

  if (confirmation.status === 'ENROLLED') {
    const { data: retention } = await supabase
      .schema('command_center')
      .from('usce_retention')
      .select('id')
      .eq('request_id', offer.request_id)
      .order('retained_at', { ascending: false })
      .maybeSingle();

    return NextResponse.json(
      {
        auth_user_id: offer.applicant_user_id,
        retention_id: retention?.id ?? null,
        confirmation_status: 'ENROLLED',
        idempotent: true,
      },
      { status: 200 }
    );
  }

  if (confirmation.status !== 'PAYMENT_CAPTURED') {
    return errorResponse(409, {
      code: 'INVALID_TRANSITION',
      message: 'Confirmation must be PAYMENT_CAPTURED before onboarding.',
      requestId,
      details: { current_status: confirmation.status },
    });
  }

  const { data: requestRow, error: requestError } = await supabase
    .schema('command_center')
    .from('usce_requests')
    .select('id, applicant_email, applicant_name')
    .eq('id', offer.request_id)
    .maybeSingle();

  if (requestError || !requestRow) {
    return errorResponse(500, {
      code: 'DB_QUERY_FAILED',
      message: 'Failed to resolve applicant record.',
      requestId,
      details: requestError ? { supabase: requestError.message } : undefined,
    });
  }

  let authUserId: string = offer.applicant_user_id;
  try {
    if (requestRow.applicant_email) {
      const created = await supabase.auth.admin.createUser({
        email: requestRow.applicant_email,
        password: randomPassword(),
        email_confirm: true,
        user_metadata: {
          full_name: requestRow.applicant_name ?? null,
          roles: ['student'],
        },
        app_metadata: {
          mm_role: 'student',
        },
      });

      if (created?.data?.user?.id) {
        authUserId = created.data.user.id;
      }
    }
  } catch {
    // Provisioning can be eventually consistent. Continue with existing applicant_user_id binding.
  }

  const nowIso = new Date().toISOString();
  const { data: retention, error: retentionError } = await supabase
    .schema('command_center')
    .from('usce_retention')
    .insert({
      request_id: offer.request_id,
      by_user: null,
      notes: 'auto onboarding trigger post-payment',
      retained_at: nowIso,
    })
    .select('id')
    .maybeSingle();

  if (retentionError) {
    await supabase
      .schema('command_center')
      .from('usce_outbox')
      .insert({
        entity_type: 'request',
        entity_id: offer.request_id,
        action: 'onboarding_retry',
        payload: {
          offer_id: offer.id,
          confirmation_id: confirmation.id,
          reason: retentionError.message,
        },
        status: 'pending',
        idempotency_key: `${offer.id}:onboard:${Math.floor(Date.now() / 1000)}`,
      });

    return errorResponse(502, {
      code: 'ONBOARDING_RETRY_QUEUED',
      message: 'Transient onboarding failure. Retry queued in outbox.',
      requestId,
    });
  }

  const { error: confirmUpdateError } = await supabase
    .schema('command_center')
    .from('usce_confirmations')
    .update({
      status: 'ENROLLED',
      enrolled_at: nowIso,
      updated_at: nowIso,
    })
    .eq('id', confirmation.id);

  if (confirmUpdateError) {
    await supabase
      .schema('command_center')
      .from('usce_dead_letter')
      .insert({
        source: 'onboarding_trigger',
        entity_type: 'confirmation',
        entity_id: confirmation.id,
        payload: {
          offer_id: offer.id,
          retention_id: retention?.id ?? null,
          auth_user_id: authUserId,
        },
        error: confirmUpdateError.message,
        retryable: true,
        recovered: false,
      });

    return errorResponse(502, {
      code: 'ONBOARDING_RECONCILE_REQUIRED',
      message: 'Onboarding partial failure logged for reconciliation.',
      requestId,
    });
  }

  return NextResponse.json(
    {
      auth_user_id: authUserId,
      retention_id: retention?.id ?? null,
      confirmation_status: 'ENROLLED',
    },
    { status: 200 }
  );
}
