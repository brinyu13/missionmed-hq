import { runWithCronLedger, type CronTriggerSource } from '@/lib/usce/cron/cron-runner';

type SupabaseAny = any;

const ACTIVE_REQUEST_OFFER_STATUSES = ['SENT', 'REMINDED', 'ACCEPTED', 'PENDING_PAYMENT', 'FAILED_PAYMENT', 'PAID'];

export type RunSlaResult = {
  reminded_flagged: number;
  expired: number;
  payment_timeouts: number;
  skipped?: 'overlap' | 'debounced';
};

export async function runSlaJob(
  supabase: SupabaseAny,
  triggerSource: CronTriggerSource = 'manual'
): Promise<RunSlaResult> {
  const run = await runWithCronLedger(supabase, {
    jobName: 'usce_sla_hourly',
    triggerSource,
    debounceSeconds: 240,
    run: async () => {
      const now = Date.now();
      const remindBeforeIso = new Date(now - 24 * 60 * 60 * 1000).toISOString();
      const expireBeforeIso = new Date(now - 48 * 60 * 60 * 1000).toISOString();
      const nowIso = new Date(now).toISOString();

      let remindedCount = 0;
      let expiredCount = 0;

      const { data: remindRows } = await supabase
        .schema('command_center')
        .from('usce_offers')
        .select('id')
        .eq('status', 'SENT')
        .is('reminder_sent_at', null)
        .lte('sent_at', remindBeforeIso);

      for (const row of remindRows ?? []) {
        const { error } = await supabase
          .schema('command_center')
          .from('usce_offers')
          .update({
            status: 'REMINDED',
            needs_reminder: true,
            reminder_sent_at: nowIso,
            updated_at: nowIso,
          })
          .eq('id', row.id);
        if (!error) remindedCount += 1;
      }

      const { data: expireRows } = await supabase
        .schema('command_center')
        .from('usce_offers')
        .select('id, request_id')
        .in('status', ['SENT', 'REMINDED'])
        .lte('sent_at', expireBeforeIso);

      const touchedRequestIds = new Set<string>();
      for (const row of expireRows ?? []) {
        const { error } = await supabase
          .schema('command_center')
          .from('usce_offers')
          .update({
            status: 'EXPIRED',
            expired_at: nowIso,
            updated_at: nowIso,
          })
          .eq('id', row.id);
        if (!error) {
          expiredCount += 1;
          if (row.request_id) touchedRequestIds.add(row.request_id);
        }
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
              status: 'EXPIRED',
              updated_at: nowIso,
            })
            .eq('id', requestId)
            .eq('status', 'OFFERED');
        }
      }

      return {
        rowsAffected: remindedCount + expiredCount,
        result: {
          reminded_flagged: remindedCount,
          expired: expiredCount,
          payment_timeouts: 0,
        },
      };
    },
  });

  if (!run.executed) {
    return {
      reminded_flagged: 0,
      expired: 0,
      payment_timeouts: 0,
      skipped: run.reason,
    };
  }

  return run.result;
}
