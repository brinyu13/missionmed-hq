import { runWithCronLedger, type CronTriggerSource } from '@/lib/usce/cron/cron-runner';

type SupabaseAny = any;

const ACTIVE_REQUEST_OFFER_STATUSES = ['SENT', 'REMINDED', 'ACCEPTED', 'PENDING_PAYMENT', 'FAILED_PAYMENT', 'PAID'];

async function releaseHardHold(supabase: SupabaseAny, programSeatId: string): Promise<boolean> {
  const { data: seat } = await supabase
    .schema('command_center')
    .from('usce_program_seats')
    .select('id, seats_held_hard')
    .eq('id', programSeatId)
    .maybeSingle();

  if (!seat?.id) return false;
  const current = Number(seat.seats_held_hard ?? 0);
  const next = current > 0 ? current - 1 : 0;
  if (next === current) return false;

  const { error } = await supabase
    .schema('command_center')
    .from('usce_program_seats')
    .update({ seats_held_hard: next })
    .eq('id', seat.id);

  return !error;
}

export type RunPaymentTimeoutResult = {
  payment_timeouts_processed: number;
  seats_released: number;
  skipped?: 'overlap' | 'debounced';
};

export async function runPaymentTimeoutJob(
  supabase: SupabaseAny,
  triggerSource: CronTriggerSource = 'manual'
): Promise<RunPaymentTimeoutResult> {
  const run = await runWithCronLedger(supabase, {
    jobName: 'usce_payment_timeout',
    triggerSource,
    debounceSeconds: 240,
    run: async () => {
      const now = Date.now();
      const timeoutIso = new Date(now - 30 * 60 * 1000).toISOString();
      const nowIso = new Date(now).toISOString();

      let processed = 0;
      let seatsReleased = 0;
      const touchedRequestIds = new Set<string>();

      const { data: pendingRows } = await supabase
        .schema('command_center')
        .from('usce_offers')
        .select('id, request_id, program_seat_id')
        .eq('status', 'PENDING_PAYMENT')
        .lte('payment_intent_created_at', timeoutIso);

      for (const row of pendingRows ?? []) {
        const { error: offerError } = await supabase
          .schema('command_center')
          .from('usce_offers')
          .update({
            status: 'FAILED_PAYMENT',
            failed_at: nowIso,
            updated_at: nowIso,
          })
          .eq('id', row.id);

        if (offerError) continue;

        await supabase
          .schema('command_center')
          .from('usce_confirmations')
          .update({
            status: 'FAILED',
            failed_at: nowIso,
            failed_reason: 'timeout',
            updated_at: nowIso,
          })
          .eq('offer_id', row.id)
          .in('status', ['PENDING_PAYMENT', 'PAYMENT_AUTHORIZED']);

        const released = await releaseHardHold(supabase, row.program_seat_id);
        if (released) seatsReleased += 1;
        processed += 1;
        if (row.request_id) touchedRequestIds.add(row.request_id);
      }

      const { data: exhaustedRows } = await supabase
        .schema('command_center')
        .from('usce_offers')
        .select('id, request_id, program_seat_id')
        .eq('status', 'FAILED_PAYMENT')
        .gte('retry_count', 2)
        .lte('failed_at', timeoutIso);

      for (const row of exhaustedRows ?? []) {
        const { error } = await supabase
          .schema('command_center')
          .from('usce_offers')
          .update({
            status: 'EXPIRED',
            expired_at: nowIso,
            updated_at: nowIso,
          })
          .eq('id', row.id);
        if (error) continue;

        const released = await releaseHardHold(supabase, row.program_seat_id);
        if (released) seatsReleased += 1;
        if (row.request_id) touchedRequestIds.add(row.request_id);
      }

      for (const requestId of touchedRequestIds) {
        const { data: active } = await supabase
          .schema('command_center')
          .from('usce_offers')
          .select('id')
          .eq('request_id', requestId)
          .in('status', ACTIVE_REQUEST_OFFER_STATUSES)
          .limit(1);

        if (!active || active.length === 0) {
          await supabase
            .schema('command_center')
            .from('usce_requests')
            .update({
              status: 'IN_REVIEW',
              updated_at: nowIso,
            })
            .eq('id', requestId)
            .eq('status', 'OFFERED');
        }
      }

      return {
        rowsAffected: processed + seatsReleased,
        result: {
          payment_timeouts_processed: processed,
          seats_released: seatsReleased,
        },
      };
    },
  });

  if (!run.executed) {
    return {
      payment_timeouts_processed: 0,
      seats_released: 0,
      skipped: run.reason,
    };
  }

  return run.result;
}
