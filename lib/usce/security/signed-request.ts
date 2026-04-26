import { createHash, createHmac, timingSafeEqual } from 'crypto';

type SupabaseAny = any;

export type SignedRequestCheckInput = {
  supabase: SupabaseAny;
  source: string;
  secret: string;
  headers: Headers;
  rawBody: string;
  maxSkewSeconds?: number;
};

export type SignedRequestCheckResult =
  | { ok: true }
  | { ok: false; code: string; message: string };

function sha256Hex(input: string): string {
  return createHash('sha256').update(input, 'utf8').digest('hex');
}

function safeCompareHex(aHex: string, bHex: string): boolean {
  try {
    const a = Buffer.from(aHex, 'hex');
    const b = Buffer.from(bHex, 'hex');
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

function parseTimestampToMs(timestamp: string): number | null {
  if (!timestamp) return null;
  if (/^\d{10}$/.test(timestamp)) return Number(timestamp) * 1000;
  if (/^\d{13}$/.test(timestamp)) return Number(timestamp);
  const parsed = Date.parse(timestamp);
  return Number.isNaN(parsed) ? null : parsed;
}

export async function verifySignedRequest(
  input: SignedRequestCheckInput
): Promise<SignedRequestCheckResult> {
  const maxSkewSeconds = input.maxSkewSeconds ?? 300;

  if (!input.secret) {
    return {
      ok: false,
      code: 'SIGNATURE_NOT_CONFIGURED',
      message: 'Signing secret is not configured.',
    };
  }

  const timestamp = input.headers.get('x-usce-timestamp') ?? '';
  const signature = input.headers.get('x-usce-signature') ?? '';
  const nonce = input.headers.get('x-usce-nonce') ?? '';

  if (!timestamp || !signature || !nonce) {
    return {
      ok: false,
      code: 'SIGNATURE_INVALID',
      message: 'Missing signature headers.',
    };
  }

  const timestampMs = parseTimestampToMs(timestamp);
  if (!timestampMs) {
    return {
      ok: false,
      code: 'SIGNATURE_INVALID',
      message: 'Invalid timestamp format.',
    };
  }

  const skewSeconds = Math.abs(Date.now() - timestampMs) / 1000;
  if (skewSeconds > maxSkewSeconds) {
    return {
      ok: false,
      code: 'CLOCK_SKEW_EXCEEDED',
      message: 'Timestamp outside allowed clock skew window.',
    };
  }

  const signed = `${timestamp}.${nonce}.${input.rawBody}`;
  const expected = createHmac('sha256', input.secret).update(signed, 'utf8').digest('hex');
  if (!safeCompareHex(expected, signature)) {
    return {
      ok: false,
      code: 'SIGNATURE_INVALID',
      message: 'HMAC signature mismatch.',
    };
  }

  const nowIso = new Date().toISOString();
  const { data: existing, error: existingError } = await input.supabase
    .schema('command_center')
    .from('usce_webhook_nonces')
    .select('nonce, source, expires_at')
    .eq('nonce', nonce)
    .eq('source', input.source)
    .maybeSingle();

  if (existingError) {
    return {
      ok: false,
      code: 'NONCE_STORE_ERROR',
      message: existingError.message,
    };
  }

  if (existing && new Date(existing.expires_at).getTime() > Date.now()) {
    return {
      ok: false,
      code: 'REPLAY_DETECTED',
      message: 'Nonce has already been used.',
    };
  }

  const expiresAt = new Date(Date.now() + maxSkewSeconds * 1000).toISOString();
  const { error: nonceInsertError } = await input.supabase
    .schema('command_center')
    .from('usce_webhook_nonces')
    .upsert(
      {
        nonce,
        source: input.source,
        received_at: nowIso,
        expires_at: expiresAt,
        payload_hash: sha256Hex(input.rawBody),
      },
      {
        onConflict: 'nonce,source',
      }
    );

  if (nonceInsertError) {
    return {
      ok: false,
      code: 'NONCE_STORE_ERROR',
      message: nonceInsertError.message,
    };
  }

  return { ok: true };
}
