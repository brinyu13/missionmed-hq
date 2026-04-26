import { runWithCronLedger, type CronTriggerSource } from '@/lib/usce/cron/cron-runner';

type SupabaseAny = any;

export type RunArchiveResult = {
  archived_count: number;
  purged_cron_runs: number;
  purged_postmark_events: number;
  skipped?: 'overlap' | 'debounced';
};

export async function runArchiveTerminalJob(
  supabase: SupabaseAny,
  triggerSource: CronTriggerSource = 'manual'
): Promise<RunArchiveResult> {
  const run = await runWithCronLedger(supabase, {
    jobName: 'usce_archive_terminal',
    triggerSource,
    debounceSeconds: 3600,
    run: async () => {
      const now = Date.now();
      const archiveBeforeIso = new Date(now - 90 * 24 * 60 * 60 * 1000).toISOString();
      const purgeCronBeforeIso = new Date(now - 30 * 24 * 60 * 60 * 1000).toISOString();
      const purgePostmarkBeforeIso = new Date(now - 90 * 24 * 60 * 60 * 1000).toISOString();
      const nowIso = new Date(now).toISOString();

      let archivedCount = 0;

      const { data: archiveCandidates } = await supabase
        .schema('command_center')
        .from('usce_requests')
        .select('id')
        .in('status', ['FULFILLED', 'EXPIRED', 'CANCELLED'])
        .lte('updated_at', archiveBeforeIso);

      for (const row of archiveCandidates ?? []) {
        const { error } = await supabase
          .schema('command_center')
          .from('usce_requests')
          .update({
            status: 'ARCHIVED',
            updated_at: nowIso,
          })
          .eq('id', row.id);
        if (!error) archivedCount += 1;
      }

      const { data: cronRows } = await supabase
        .schema('command_center')
        .from('usce_cron_runs')
        .select('id')
        .lte('started_at', purgeCronBeforeIso);

      let purgedCronRuns = 0;
      for (const row of cronRows ?? []) {
        const { error } = await supabase
          .schema('command_center')
          .from('usce_cron_runs')
          .delete()
          .eq('id', row.id);
        if (!error) purgedCronRuns += 1;
      }

      const { data: postmarkRows } = await supabase
        .schema('command_center')
        .from('usce_postmark_events')
        .select('id')
        .lte('received_at', purgePostmarkBeforeIso);

      let purgedPostmarkEvents = 0;
      for (const row of postmarkRows ?? []) {
        const { error } = await supabase
          .schema('command_center')
          .from('usce_postmark_events')
          .delete()
          .eq('id', row.id);
        if (!error) purgedPostmarkEvents += 1;
      }

      return {
        rowsAffected: archivedCount + purgedCronRuns + purgedPostmarkEvents,
        result: {
          archived_count: archivedCount,
          purged_cron_runs: purgedCronRuns,
          purged_postmark_events: purgedPostmarkEvents,
        },
      };
    },
  });

  if (!run.executed) {
    return {
      archived_count: 0,
      purged_cron_runs: 0,
      purged_postmark_events: 0,
      skipped: run.reason,
    };
  }

  return run.result;
}
