import { NextRequest, NextResponse } from 'next/server';
import { createRequestId, errorResponse, parseIsoDate } from '@/lib/usce/http';
import { requireUserSession } from '@/lib/usce/session';

function isAdminOrCoordinator(user: any): boolean {
  const role = user?.app_metadata?.mm_role;
  if (role === 'admin' || role === 'coordinator') return true;
  const roles = user?.user_metadata?.roles;
  return Array.isArray(roles) && (roles.includes('admin') || roles.includes('coordinator'));
}

function hoursBetween(startIso: string | null | undefined, endIso: string | null | undefined): number | null {
  if (!startIso || !endIso) return null;
  const start = new Date(startIso).getTime();
  const end = new Date(endIso).getTime();
  if (Number.isNaN(start) || Number.isNaN(end) || end < start) return null;
  return (end - start) / (1000 * 60 * 60);
}

function average(values: number[]): number {
  if (values.length === 0) return 0;
  return Number((values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(2));
}

export async function GET(request: NextRequest) {
  const requestId = createRequestId('usce_analytics');
  const auth = await requireUserSession(request, requestId);
  if ('response' in auth) return auth.response;

  if (!isAdminOrCoordinator(auth.user)) {
    return errorResponse(403, {
      code: 'FORBIDDEN',
      message: 'Only coordinator/admin roles can access analytics summary.',
      requestId,
    });
  }

  const url = new URL(request.url);
  const fromInput = parseIsoDate(url.searchParams.get('from'));
  const toInput = parseIsoDate(url.searchParams.get('to'));
  const to = toInput ?? new Date();
  const from = fromInput ?? new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  if (from.getTime() > to.getTime()) {
    return errorResponse(400, {
      code: 'VALIDATION_FAILED',
      message: 'from must be earlier than or equal to to.',
      requestId,
    });
  }

  const fromIso = from.toISOString();
  const toIso = to.toISOString();
  const supabase: any = auth.supabase;

  const { data: requests, error: requestsError } = await supabase
    .schema('command_center')
    .from('usce_requests')
    .select('id, status, created_at, updated_at, sla_status, assigned_coordinator_id')
    .gte('created_at', fromIso)
    .lte('created_at', toIso);

  if (requestsError) {
    return errorResponse(500, {
      code: 'DB_QUERY_FAILED',
      message: 'Failed to query requests analytics.',
      requestId,
      details: { supabase: requestsError.message },
    });
  }

  const { data: offers, error: offersError } = await supabase
    .schema('command_center')
    .from('usce_offers')
    .select(
      'id, request_id, status, amount_cents, created_at, sent_at, responded_at, paid_at, retry_count'
    )
    .gte('created_at', fromIso)
    .lte('created_at', toIso);

  if (offersError) {
    return errorResponse(500, {
      code: 'DB_QUERY_FAILED',
      message: 'Failed to query offers analytics.',
      requestId,
      details: { supabase: offersError.message },
    });
  }

  const { data: confirmations } = await supabase
    .schema('command_center')
    .from('usce_confirmations')
    .select('id, status, amount_cents, captured_at, created_at')
    .gte('created_at', fromIso)
    .lte('created_at', toIso);

  const { data: seats } = await supabase
    .schema('command_center')
    .from('usce_program_seats')
    .select('program_name, seats_total, seats_filled');

  const requestRows = requests ?? [];
  const offerRows = offers ?? [];
  const confirmationRows = confirmations ?? [];

  const requestsByStatus: Record<string, number> = {};
  for (const row of requestRows) {
    const key = String(row.status ?? 'UNKNOWN');
    requestsByStatus[key] = (requestsByStatus[key] ?? 0) + 1;
  }

  const offersSent = offerRows.filter((row: any) => ['SENT', 'REMINDED', 'ACCEPTED', 'PENDING_PAYMENT', 'PAID', 'FAILED_PAYMENT', 'DECLINED', 'EXPIRED', 'INVALIDATED', 'REVOKED'].includes(row.status)).length;
  const offersAccepted = offerRows.filter((row: any) => ['ACCEPTED', 'PENDING_PAYMENT', 'PAID'].includes(row.status)).length;
  const offersPaid = offerRows.filter((row: any) => row.status === 'PAID').length;
  const offersDeclined = offerRows.filter((row: any) => row.status === 'DECLINED').length;
  const offersExpired = offerRows.filter((row: any) => row.status === 'EXPIRED').length;

  const revenueTotalCents = confirmationRows
    .filter((row: any) => ['PAYMENT_CAPTURED', 'ENROLLED'].includes(row.status))
    .reduce((sum: number, row: any) => sum + Number(row.amount_cents ?? 0), 0);

  const claimDurations: number[] = [];
  for (const row of requestRows) {
    if (row.assigned_coordinator_id) {
      const hours = hoursBetween(row.created_at, row.updated_at);
      if (hours != null) claimDurations.push(hours);
    }
  }

  const offerDurations: number[] = [];
  const requestById = new Map<string, any>(requestRows.map((row: any) => [row.id, row]));
  for (const row of offerRows) {
    if (!row.sent_at) continue;
    const requestRow = requestById.get(row.request_id);
    const hours = hoursBetween(requestRow?.created_at, row.sent_at);
    if (hours != null) offerDurations.push(hours);
  }

  const acceptDurations: number[] = [];
  for (const row of offerRows) {
    if (!row.sent_at || !row.responded_at) continue;
    const hours = hoursBetween(row.sent_at, row.responded_at);
    if (hours != null) acceptDurations.push(hours);
  }

  const slaBreaches = requestRows.filter((row: any) => row.sla_status === 'breached').length;
  const slaEligible = requestRows.filter((row: any) => ['met', 'breached', 'waived'].includes(row.sla_status));
  const slaCompliant = slaEligible.filter((row: any) => row.sla_status === 'met' || row.sla_status === 'waived').length;
  const slaComplianceRate = slaEligible.length > 0 ? Number(((slaCompliant / slaEligible.length) * 100).toFixed(2)) : 0;

  const seatsUtilization = (seats ?? []).map((row: any) => {
    const total = Number(row.seats_total ?? 0);
    const filled = Number(row.seats_filled ?? 0);
    const utilization = total > 0 ? Number(((filled / total) * 100).toFixed(2)) : 0;
    return {
      program_name: row.program_name,
      seats_total: total,
      seats_filled: filled,
      utilization_pct: utilization,
    };
  });

  const conversionRate = offersSent > 0 ? Number(((offersPaid / offersSent) * 100).toFixed(2)) : 0;

  return NextResponse.json(
    {
      requests_total: requestRows.length,
      requests_by_status: requestsByStatus,
      offers_sent: offersSent,
      offers_accepted: offersAccepted,
      offers_paid: offersPaid,
      offers_declined: offersDeclined,
      offers_expired: offersExpired,
      conversion_rate_sent_to_paid: conversionRate,
      revenue_total_cents: revenueTotalCents,
      avg_time_to_claim_hours: average(claimDurations),
      avg_time_to_offer_hours: average(offerDurations),
      avg_time_to_accept_hours: average(acceptDurations),
      sla_compliance_rate: slaComplianceRate,
      sla_breaches: slaBreaches,
      seats_utilization: seatsUtilization,
      from: fromIso,
      to: toIso,
    },
    { status: 200 }
  );
}
