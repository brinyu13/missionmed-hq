// Local evidence only. No production network call or business write is possible:
// every fetch is intercepted before invoking any route; unexpected calls throw.
import assert from 'node:assert/strict';
import { Readable } from 'node:stream';
import { handleUsceAdminOfferRoute } from '../../../../missionmed-hq/routes/usce-offer-portal.mjs';

const calls = [];
let providerCalls = 0;
let records = 0;
globalThis.fetch = async (url) => {
  if (url === 'https://api.postmarkapp.com/email') {
    calls.push('mock_provider_send');
    providerCalls += 1;
    return new Response(JSON.stringify({ MessageID: `synthetic-message-${providerCalls}` }), { status: 200 });
  }
  if (url === 'https://fglyvdykwgbuivikqoah.supabase.co/rest/v1/rpc/record_usce_offer_postmark_send') {
    calls.push('mock_durable_record');
    records += 1;
    return new Response(JSON.stringify({ ok: true, idempotent: records > 1, mode: 'live', dry_run: false }), { status: 200 });
  }
  throw new Error('Unrecognized mocked network boundary');
};

// Process-local fake configuration. These are not usable credentials.
process.env.MMHQ_SUPABASE_URL = 'https://fglyvdykwgbuivikqoah.supabase.co';
process.env.MMHQ_SUPABASE_SERVICE_ROLE_KEY = 'SYNTHETIC-NOT-A-CREDENTIAL';
process.env.USCE_POSTMARK_SERVER_TOKEN = 'SYNTHETIC-NOT-A-CREDENTIAL';
process.env.USCE_POSTMARK_ENABLED = 'true';
process.env.USCE_POSTMARK_DRY_RUN = 'false';
process.env.USCE_POSTMARK_LIVE_SEND_ENABLED = 'true';

const url = new URL('https://synthetic.invalid/api/usce/admin/offers/11111111-1111-4111-8111-111111111111/send');
const body = {
  category: 'offer_ready', subject: 'Synthetic fixture', body: 'Synthetic fixture; no real offer',
  to_email: 'synthetic@example.invalid', approve_live_send: true, idempotency_key: 'same-synthetic-key',
};
const outcomes = [];
for (let i = 0; i < 2; i += 1) {
  const request = Readable.from([Buffer.from(JSON.stringify(body))]);
  request.method = 'POST';
  request.headers = { 'content-type': 'application/json', 'x-mm-usce-idempotency-key': 'same-synthetic-key' };
  const response = {
    writeHead(status) { this.status = status; },
    end(data) { outcomes.push({ status: this.status, payload: JSON.parse(data) }); },
  };
  await handleUsceAdminOfferRoute(request, response, url, {
    session: { user: { login: 'synthetic-coordinator' } }, authHeaders: {},
  });
}
assert.equal(providerCalls, 2);
assert.equal(records, 2);
assert.equal(outcomes[1].payload.idempotent, true);
console.log(JSON.stringify({
  evidence: 'local route reproduction using fetch stubs only', calls,
  provider_calls: providerCalls, durable_record_calls: records,
  second_record_idempotent: outcomes[1].payload.idempotent,
  duplicate_provider_send_prevented: false, real_network_calls: 0, production_writes: 0,
}));
