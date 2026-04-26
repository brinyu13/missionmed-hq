import { runWithCronLedger, type CronTriggerSource } from '@/lib/usce/cron/cron-runner';

type SupabaseAny = any;

type RequestRow = {
  id: string;
  status: string;
  sla_status: string;
  sla_claim_deadline: string | null;
  sla_offer_deadline: string | null;
};

async function insertSlaNote(
  supabase: SupabaseAny,
  requestId: string,
  status: 'at_risk' | 'breached',
  reason: string
): Promise<void> {
  await supabase
    .schema('command_center')
    .from('usce_comms')
    .insert({
      offer_id: null,
      thread_id: requestId,
      direction: 'SYS',
      is_internal_note: true,
      message_status: 'sent',
      subject: `SLA ${status.toUpperCase()}`,
      body_text: reason,
      body_html: null,
      needs_triage: status === 'breached',
      raw_json: { source: 'coordinator_sla_cron', status, reason },
      created_by: null,
    });
}

async function emitSlaEvent(
  supabase: SupabaseAny,
  requestId: string,
  payload: Record<string, unknown>
): Promise<void> {
  await supabase
    .schema('command_center')
    .from('usce_outbox')
    .insert({
      entity_type: 'request',
      entity_id: requestId,
      action: 'dashboard_event_sla',
      payload,
      status: 'pending',
      idempotency_key: `${requestId}:sla:${payload.state}:${Math.floor(Date.now() / 60_000)}`,
    });
}

function hoursFromNow(hours: number): Date {
  return new Date(Date.now() + hours * 60 * 60 * 1000);
}

export type RunCoordinatorSlaResult = {
  new_at_risk: number;
  new_breached: number;
  skipped?: 'overlap' | 'debounced';
};

export async function runCoordinatorSlaJob(
  supabase: SupabaseAny,
  triggerSource: CronTriggerSource = 'manual'
): Promise<RunCoordinatorSlaResult> {
  const run = await runWithCronLedger(supabase, {
    jobName: 'usce_sla_coordinator',
    triggerSource,
    debounceSeconds: 840,
    run: async () => {
      const nowIso = new Date().toISOString();
      const atRiskClaimThreshold = hoursFromNow(4).toISOString();
      const atRiskOfferThreshold = hoursFromNow(8).toISOString();

      let atRiskCount = 0;
      let breachedCount = 0;

      const { data: rows } = await supabase
        .schema('command_center')
        .from('usce_requests')
        .select('id, status, sla_status, sla_claim_deadline, sla_offer_deadline')
        .in('status', ['NEW', 'IN_REVIEW']);

      for (const row of (rows ?? []) as RequestRow[]) {
        const claimDeadline = row.sla_claim_deadline ? new Date(row.sla_claim_deadline).toISOString() : null;
        const offerDeadline = row.sla_offer_deadline ? new Date(row.sla_offer_deadline).toISOString() : null;

        let nextState: 'at_risk' | 'breached' | null = null;
        let breachReason: string | null = null;

        if (row.status === 'NEW' && claimDeadline) {
          if (claimDeadline <= nowIso) {
            nextState = 'breached';
            breachReason = 'unclaimed';
          } else if (claimDeadline <= atRiskClaimThreshold && row.sla_status === 'on_track') {
            nextState = 'at_risk';
          }
        }

        if (row.status === 'IN_REVIEW' && offerDeadline) {
          if (offerDeadline <= nowIso) {
            nextState = 'breached';
            breachReason = 'no_offer_created';
          } else if (offerDeadline <= atRiskOfferThreshold && row.sla_status === 'on_track') {
            nextState = 'at_risk';
          }
        }

        if (!nextState) continue;

        const updatePayload: Record<string, unknown> = {
          sla_status: nextState,
          updated_at: nowIso,
        };

        if (nextState === 'breached') {
          updatePayload.sla_breached_at = nowIso;
          updatePayload.sla_breach_reason = breachReason ?? 'no_offer_created';
        }

        const { error } = await supabase
          .schema('command_center')
          .from('usce_requests')
          .update(updatePayload)
          .eq('id', row.id);

        if (error) continue;

        if (nextState === 'at_risk') {
          atRiskCount += 1;
          await insertSlaNote(
            supabase,
            row.id,
            'at_risk',
            'Request approaching SLA deadline and requires coordinator action.'
          );
          await emitSlaEvent(supabase, row.id, {
            state: 'at_risk',
            request_id: row.id,
          });
        } else {
          breachedCount += 1;
          await insertSlaNote(
            supabase,
            row.id,
            'breached',
            `SLA breached for request. reason=${breachReason ?? 'unknown'}`
          );
          await emitSlaEvent(supabase, row.id, {
            state: 'breached',
            request_id: row.id,
            reason: breachReason ?? 'unknown',
          });
        }
      }

      return {
        rowsAffected: atRiskCount + breachedCount,
        result: {
          new_at_risk: atRiskCount,
          new_breached: breachedCount,
        },
      };
    },
  });

  if (!run.executed) {
    return {
      new_at_risk: 0,
      new_breached: 0,
      skipped: run.reason,
    };
  }

  return run.result;
}
