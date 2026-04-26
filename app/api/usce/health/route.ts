import { NextRequest, NextResponse } from 'next/server';
import { createRequestId, errorResponse } from '@/lib/usce/http';
import { createUSCESupabaseClientFactoryFromRuntime } from '@/lib/usce/supabaseClient';

function isSystemAuthorized(request: NextRequest): boolean {
  const incoming = request.headers.get('x-system-secret');
  const expected = process.env.USCE_SYSTEM_SECRET;
  return Boolean(expected && incoming && incoming === expected);
}

export async function GET(request: NextRequest) {
  const requestId = createRequestId('usce_health');
  if (!isSystemAuthorized(request)) {
    return errorResponse(401, {
      code: 'UNAUTHORIZED',
      message: 'Missing or invalid system secret.',
      requestId,
    });
  }

  const factory = await createUSCESupabaseClientFactoryFromRuntime();
  const supabase: any = factory.createServiceRoleClient({ internal: true });

  let supabaseConnected = true;
  let cronCount = 0;

  try {
    const { error: pingError } = await supabase
      .schema('command_center')
      .from('usce_requests')
      .select('id')
      .limit(1);
    if (pingError) supabaseConnected = false;

    const { count } = await supabase
      .schema('command_center')
      .from('usce_cron_runs')
      .select('id', { count: 'exact', head: true });
    cronCount = Number(count ?? 0);
  } catch {
    supabaseConnected = false;
  }

  const stripeConfigured = Boolean(
    (process.env.STRIPE_SECRET_KEY ?? '').trim() &&
      (process.env.STRIPE_WEBHOOK_SECRET ?? '').trim()
  );
  const postmarkConfigured = Boolean(
    (process.env.POSTMARK_SERVER_TOKEN ?? '').trim() &&
      (process.env.POSTMARK_INBOUND_SECRET ?? '').trim() &&
      (process.env.POSTMARK_DELIVERY_SECRET ?? '').trim()
  );

  return NextResponse.json(
    {
      status: supabaseConnected ? 'ok' : 'degraded',
      version: process.env.VERCEL_GIT_COMMIT_SHA ?? process.env.npm_package_version ?? 'dev',
      supabase: supabaseConnected,
      stripe: stripeConfigured,
      postmark: postmarkConfigured,
      cron_jobs_registered: cronCount,
      timestamp: new Date().toISOString(),
    },
    { status: 200 }
  );
}
