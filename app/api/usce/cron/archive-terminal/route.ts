import { NextRequest, NextResponse } from 'next/server';
import { createRequestId, errorResponse } from '@/lib/usce/http';
import { createUSCESupabaseClientFactoryFromRuntime } from '@/lib/usce/supabaseClient';
import { runArchiveTerminalJob } from '@/lib/usce/cron/run-archive';
import { verifySignedRequest } from '@/lib/usce/security/signed-request';

export async function POST(request: NextRequest) {
  const requestId = createRequestId('usce_cron_archive');
  const factory = await createUSCESupabaseClientFactoryFromRuntime();
  const supabase: any = factory.createServiceRoleClient({ internal: true });
  const rawBody = await request.text();

  const check = await verifySignedRequest({
    supabase,
    source: 'cron_archive_terminal',
    secret: process.env.USCE_CRON_HMAC_SECRET ?? process.env.USCE_CRON_SECRET ?? '',
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

  const result = await runArchiveTerminalJob(supabase, 'mirror_endpoint');
  return NextResponse.json(result, { status: 200 });
}
