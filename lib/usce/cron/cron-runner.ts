type SupabaseAny = any;

export type CronTriggerSource = 'pg_cron' | 'mirror_endpoint' | 'manual';

export type CronRunStart =
  | { shouldRun: true; runId: number }
  | { shouldRun: false; reason: 'overlap' | 'debounced' };

export async function startCronRun(
  supabase: SupabaseAny,
  params: {
    jobName: string;
    triggerSource: CronTriggerSource;
    debounceSeconds: number;
  }
): Promise<CronRunStart> {
  const nowMs = Date.now();
  const windowStart = new Date(nowMs - params.debounceSeconds * 1000).toISOString();

  const { data: latest, error: latestError } = await supabase
    .schema('command_center')
    .from('usce_cron_runs')
    .select('id, started_at, completed_at')
    .eq('job_name', params.jobName)
    .order('started_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (latestError) {
    throw new Error(`Failed to read cron ledger: ${latestError.message}`);
  }

  if (latest?.completed_at == null) {
    return { shouldRun: false, reason: 'overlap' };
  }

  if (latest?.started_at && new Date(latest.started_at).toISOString() >= windowStart) {
    return { shouldRun: false, reason: 'debounced' };
  }

  const { data: inserted, error: insertError } = await supabase
    .schema('command_center')
    .from('usce_cron_runs')
    .insert({
      job_name: params.jobName,
      trigger_source: params.triggerSource,
      started_at: new Date(nowMs).toISOString(),
      rows_affected: 0,
      error: null,
      completed_at: null,
    })
    .select('id')
    .single();

  if (insertError || !inserted?.id) {
    throw new Error(`Failed to create cron run row: ${insertError?.message ?? 'unknown error'}`);
  }

  return { shouldRun: true, runId: Number(inserted.id) };
}

export async function finishCronRun(
  supabase: SupabaseAny,
  params: {
    runId: number;
    rowsAffected: number;
    errorText?: string | null;
  }
): Promise<void> {
  const nowIso = new Date().toISOString();
  await supabase
    .schema('command_center')
    .from('usce_cron_runs')
    .update({
      completed_at: nowIso,
      rows_affected: params.rowsAffected,
      error: params.errorText ?? null,
    })
    .eq('id', params.runId);
}

export async function runWithCronLedger<T>(
  supabase: SupabaseAny,
  params: {
    jobName: string;
    triggerSource: CronTriggerSource;
    debounceSeconds: number;
    run: () => Promise<{ rowsAffected: number; result: T }>;
  }
): Promise<
  | { executed: true; runId: number; rowsAffected: number; result: T }
  | { executed: false; reason: 'overlap' | 'debounced' }
> {
  const started = await startCronRun(supabase, {
    jobName: params.jobName,
    triggerSource: params.triggerSource,
    debounceSeconds: params.debounceSeconds,
  });

  if (!started.shouldRun) {
    return { executed: false, reason: started.reason };
  }

  let rowsAffected = 0;
  try {
    const runResult = await params.run();
    rowsAffected = runResult.rowsAffected;
    await finishCronRun(supabase, {
      runId: started.runId,
      rowsAffected,
      errorText: null,
    });
    return {
      executed: true,
      runId: started.runId,
      rowsAffected,
      result: runResult.result,
    };
  } catch (error) {
    await finishCronRun(supabase, {
      runId: started.runId,
      rowsAffected,
      errorText: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}
