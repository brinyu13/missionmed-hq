import { NextRequest, NextResponse } from 'next/server';
import { createUSCESupabaseClientFactoryFromRuntime } from '@/lib/usce/supabaseClient';

type ErrorBody = {
  code: string;
  message: string;
  requestId: string;
  details?: unknown;
};

type OverrideAction = 'force_approve' | 'force_revoke' | 'manual_status_override';
type OverrideEntity = 'offer' | 'request' | 'confirmation';

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const OFFER_STATUSES = new Set([
  'DRAFT',
  'PREVIEWED',
  'APPROVED',
  'SENT',
  'REMINDED',
  'ACCEPTED',
  'PENDING_PAYMENT',
  'PAID',
  'FAILED_PAYMENT',
  'DECLINED',
  'EXPIRED',
  'INVALIDATED',
  'REVOKED',
]);

const REQUEST_STATUSES = new Set([
  'NEW',
  'IN_REVIEW',
  'OFFERED',
  'FULFILLED',
  'EXPIRED',
  'CANCELLED',
  'ARCHIVED',
]);

const CONFIRMATION_STATUSES = new Set([
  'PENDING_PAYMENT',
  'PAYMENT_AUTHORIZED',
  'PAYMENT_CAPTURED',
  'FAILED',
  'REFUNDED',
  'ENROLLED',
]);

function requestId(): string {
  return `usce_override_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
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

function isCoordinatorOrAdmin(user: any): boolean {
  const appRole = user?.app_metadata?.mm_role;
  const roles = user?.app_metadata?.roles ?? user?.user_metadata?.roles;
  if (appRole === 'admin' || appRole === 'coordinator') return true;
  if (Array.isArray(roles) && (roles.includes('admin') || roles.includes('coordinator'))) {
    return true;
  }
  return false;
}

function parseAction(value: unknown): OverrideAction | null {
  if (
    value === 'force_approve' ||
    value === 'force_revoke' ||
    value === 'manual_status_override'
  ) {
    return value;
  }
  return null;
}

function parseEntity(value: unknown): OverrideEntity | null {
  if (value === 'offer' || value === 'request' || value === 'confirmation') {
    return value;
  }
  return null;
}

function parseUuid(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  return UUID_RE.test(value) ? value : null;
}

function validateStatus(entity: OverrideEntity, status: string): boolean {
  if (entity === 'offer') return OFFER_STATUSES.has(status);
  if (entity === 'request') return REQUEST_STATUSES.has(status);
  return CONFIRMATION_STATUSES.has(status);
}

export async function POST(request: NextRequest) {
  const rid = requestId();

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

  if (!isCoordinatorOrAdmin(userData.user)) {
    return errorResponse(403, {
      code: 'FORBIDDEN',
      message: 'Only coordinator/admin roles may execute admin overrides.',
      requestId: rid,
    });
  }

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

  const action = parseAction((payload as any)?.action);
  if (!action) {
    return errorResponse(400, {
      code: 'VALIDATION_FAILED',
      message:
        "action is required and must be one of: 'force_approve', 'force_revoke', 'manual_status_override'.",
      requestId: rid,
    });
  }

  const actorId = userData.user.id;

  if (action === 'force_approve') {
    const offerId = parseUuid((payload as any)?.offer_id);
    if (!offerId) {
      return errorResponse(400, {
        code: 'VALIDATION_FAILED',
        message: 'offer_id is required and must be a valid UUID for force_approve.',
        requestId: rid,
      });
    }

    const { data: updated, error } = await supabase
      .schema('command_center')
      .from('usce_offers')
      .update({
        status: 'APPROVED',
        approved_by: actorId,
        approved_at: new Date().toISOString(),
      })
      .eq('id', offerId)
      .select('*')
      .single();

    if (error) {
      const code = error.code === '42501' ? 403 : 500;
      return errorResponse(code, {
        code: code === 403 ? 'FORBIDDEN' : 'DB_UPDATE_FAILED',
        message:
          code === 403
            ? 'Override not permitted by role or RLS policy.'
            : 'Failed to force-approve offer.',
        requestId: rid,
        details: { supabase: error.message },
      });
    }

    return NextResponse.json(
      {
        action,
        updated: updated,
      },
      { status: 200 }
    );
  }

  if (action === 'force_revoke') {
    const offerId = parseUuid((payload as any)?.offer_id);
    if (!offerId) {
      return errorResponse(400, {
        code: 'VALIDATION_FAILED',
        message: 'offer_id is required and must be a valid UUID for force_revoke.',
        requestId: rid,
      });
    }

    const reason =
      typeof (payload as any)?.reason === 'string' && (payload as any).reason.trim().length > 0
        ? (payload as any).reason.trim()
        : 'admin override revoke';

    const { data: updated, error } = await supabase
      .schema('command_center')
      .from('usce_offers')
      .update({
        status: 'REVOKED',
        revoked_at: new Date().toISOString(),
        revoked_by: actorId,
        invalidated_reason: reason,
      })
      .eq('id', offerId)
      .select('*')
      .single();

    if (error) {
      const code = error.code === '42501' ? 403 : 500;
      return errorResponse(code, {
        code: code === 403 ? 'FORBIDDEN' : 'DB_UPDATE_FAILED',
        message:
          code === 403
            ? 'Override not permitted by role or RLS policy.'
            : 'Failed to force-revoke offer.',
        requestId: rid,
        details: { supabase: error.message },
      });
    }

    return NextResponse.json(
      {
        action,
        updated: updated,
      },
      { status: 200 }
    );
  }

  const entity = parseEntity((payload as any)?.entity);
  const targetId = parseUuid((payload as any)?.target_id);
  const status =
    typeof (payload as any)?.status === 'string' ? (payload as any).status.trim() : '';

  if (!entity || !targetId || status.length === 0) {
    return errorResponse(400, {
      code: 'VALIDATION_FAILED',
      message:
        "manual_status_override requires entity ('offer'|'request'|'confirmation'), target_id (uuid), and status.",
      requestId: rid,
    });
  }

  if (!validateStatus(entity, status)) {
    return errorResponse(400, {
      code: 'VALIDATION_FAILED',
      message: `Invalid status '${status}' for entity '${entity}'.`,
      requestId: rid,
    });
  }

  let tableName: string;
  if (entity === 'offer') tableName = 'usce_offers';
  else if (entity === 'request') tableName = 'usce_requests';
  else tableName = 'usce_confirmations';

  const patch: Record<string, unknown> = { status };

  if (entity === 'offer' && status === 'APPROVED') {
    patch.approved_by = actorId;
    patch.approved_at = new Date().toISOString();
  }

  if (entity === 'offer' && status === 'REVOKED') {
    patch.revoked_by = actorId;
    patch.revoked_at = new Date().toISOString();
  }

  const { data: updated, error: updateError } = await supabase
    .schema('command_center')
    .from(tableName)
    .update(patch)
    .eq('id', targetId)
    .select('*')
    .single();

  if (updateError) {
    const code = updateError.code === '42501' ? 403 : 500;
    return errorResponse(code, {
      code: code === 403 ? 'FORBIDDEN' : 'DB_UPDATE_FAILED',
      message:
        code === 403
          ? 'Override not permitted by role or RLS policy.'
          : 'Failed to apply manual status override.',
      requestId: rid,
      details: { supabase: updateError.message },
    });
  }

  return NextResponse.json(
    {
      action,
      entity,
      updated: updated,
    },
    { status: 200 }
  );
}
