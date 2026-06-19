import assert from 'node:assert/strict';
import { Readable } from 'node:stream';
import test from 'node:test';
import { handleUsceAdminOfferRoute } from '../missionmed-hq/routes/usce-offer-portal.mjs';

const OFFER_ID = '22222222-2222-4222-8222-222222222222';
const TOKEN = 'usce_' + 'B'.repeat(43);
const MESSAGE_PAYLOAD = {
  category: 'offer_ready',
  variant: 'coordinator_clear',
  to_email: 'student@example.test',
  subject: 'Legacy plain text preview',
  body: [
    'Hi Jordan,',
    '',
    'Great news - we have a confirmed slot for you.',
    '',
    'Program: IMG',
    'Specialty: Family Medicine',
    'Location: Miami, FL',
    'Length: 6 weeks',
    'Month(s) offered: Aug 2026 or Sep 2026',
    'Proposed start: 2026-08-10',
    'Offer expires: Jun 25, 2026 at 3:00 PM',
    '',
    `Review offer: https://cdn.missionmedinstitute.com/html-system/LIVE/usce_offer.html?offer=${TOKEN}`,
    '',
    'Best,',
    'Phil',
    'MissionMed Clinicals Team',
  ].join('\n'),
};

const ORIGINAL_ENV = { ...process.env };

function resetEnv() {
  process.env = { ...ORIGINAL_ENV };
  process.env.MMHQ_SUPABASE_URL = 'https://fglyvdykwgbuivikqoah.supabase.co';
  process.env.MMHQ_SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key';
  process.env.USCE_POSTMARK_ENABLED = 'true';
  process.env.USCE_POSTMARK_DRY_RUN = 'false';
  process.env.USCE_POSTMARK_LIVE_SEND_ENABLED = 'true';
  process.env.POSTMARK_SERVER_TOKEN = 'postmark-test-token';
}

function jsonRequest(method, body = undefined, headers = {}) {
  const chunks = body === undefined ? [] : [Buffer.from(JSON.stringify(body))];
  const request = Readable.from(chunks);
  request.method = method;
  request.headers = {
    'content-type': 'application/json',
    ...headers,
  };
  request.socket = { remoteAddress: '127.0.0.1' };
  return request;
}

function mockResponse() {
  const chunks = [];
  return {
    statusCode: 0,
    headers: {},
    body: '',
    writeHead(statusCode, headers = {}) {
      this.statusCode = statusCode;
      this.headers = headers;
    },
    end(chunk = '') {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk)));
      this.body = Buffer.concat(chunks).toString('utf8');
    },
    json() {
      return JSON.parse(this.body || '{}');
    },
  };
}

function jsonFetchResponse(payload, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    async text() {
      return JSON.stringify(payload);
    },
  };
}

async function callAdminOfferRoute(path, payload, headers = {}) {
  const response = mockResponse();
  const handled = await handleUsceAdminOfferRoute(
    jsonRequest('POST', payload, headers),
    response,
    new URL(`https://missionmed-hq-production.up.railway.app${path}`),
    {
      session: {
        user: {
          id: 12,
          login: 'philperri',
          email: 'phil@example.test',
          roles: ['administrator'],
        },
      },
      authHeaders: {},
    },
  );
  assert.equal(handled, true);
  return response;
}

test('admin preview and live send share the canonical offer email renderer', async () => {
  resetEnv();
  const rpcCalls = [];
  const postmarkCalls = [];
  const originalFetch = global.fetch;

  global.fetch = async (url, init) => {
    const target = String(url);
    const body = JSON.parse(init.body);

    if (target === 'https://api.postmarkapp.com/email') {
      postmarkCalls.push(body);
      return jsonFetchResponse({ MessageID: 'postmark-message-003' });
    }

    rpcCalls.push({ url: target, body });
    if (target.endsWith('/rest/v1/rpc/update_usce_offer_message_preview')) {
      return jsonFetchResponse({ ok: true, preview_recorded: true });
    }
    if (target.endsWith('/rest/v1/rpc/record_usce_offer_postmark_send')) {
      return jsonFetchResponse({ ok: true, send_recorded: true });
    }

    throw new Error(`Unexpected fetch target: ${target}`);
  };

  try {
    const previewResponse = await callAdminOfferRoute(
      `/api/usce/admin/offers/${OFFER_ID}/message-preview`,
      MESSAGE_PAYLOAD,
    );
    assert.equal(previewResponse.statusCode, 200);
    const previewPayload = previewResponse.json();
    const previewRendered = previewPayload.rendered_email;

    assert.equal(previewRendered.template, 'usce_offer_ready_canonical_v1');
    assert.match(previewRendered.htmlBody, /data-mm-cta="accept-offer"/);
    assert.match(previewRendered.htmlBody, /data-mm-cta="decline-offer"/);
    assert.equal((previewRendered.htmlBody.match(/data-mm-cta=/g) || []).length, 2);
    assert.doesNotMatch(previewRendered.htmlBody, /coordinator will share secure link later/i);
    assert.doesNotMatch(previewRendered.htmlBody, /respond\('declined'\)/);

    const previewRpc = rpcCalls.find((call) => call.url.endsWith('/update_usce_offer_message_preview'));
    assert.ok(previewRpc, 'preview RPC should be called');
    assert.equal(previewRpc.body.p_offer_id, OFFER_ID);
    assert.equal(previewRpc.body.p_message.rendered_email.htmlBody, previewRendered.htmlBody);
    assert.equal(previewRpc.body.p_message.rendered_email.template, 'usce_offer_ready_canonical_v1');

    const sendResponse = await callAdminOfferRoute(
      `/api/usce/admin/offers/${OFFER_ID}/send`,
      {
        ...MESSAGE_PAYLOAD,
        approve_live_send: true,
        idempotency_key: 'offer-flow-003-canonical-test',
      },
    );
    assert.equal(sendResponse.statusCode, 200);
    assert.equal(postmarkCalls.length, 1);
    assert.equal(postmarkCalls[0].HtmlBody, previewRendered.htmlBody);
    assert.equal(postmarkCalls[0].TextBody, previewRendered.textBody);
    assert.equal(postmarkCalls[0].Subject, previewRendered.subject);
    assert.match(postmarkCalls[0].HtmlBody, /MissionMed/);
    assert.match(postmarkCalls[0].HtmlBody, /Offer summary/);

    const sendRpc = rpcCalls.find((call) => call.url.endsWith('/record_usce_offer_postmark_send'));
    assert.ok(sendRpc, 'send record RPC should be called');
    assert.equal(sendRpc.body.p_message.rendered_email.htmlBody, previewRendered.htmlBody);
    assert.equal(sendRpc.body.p_message.rendered_email.textBody, previewRendered.textBody);
    assert.equal(sendRpc.body.p_message.rendered_email.template, 'usce_offer_ready_canonical_v1');

    const acceptUrl = new URL(previewRendered.accept_url);
    assert.equal(acceptUrl.origin + acceptUrl.pathname, 'https://missionmedinstitute.com/product/usce-clinical-rotations/');
    assert.equal(acceptUrl.searchParams.get('offer_id'), OFFER_ID);
    assert.equal(acceptUrl.searchParams.get('token'), TOKEN);

    const declineUrl = new URL(previewRendered.decline_url);
    assert.equal(declineUrl.origin + declineUrl.pathname, 'https://missionmed-hq-production.up.railway.app/usce-decline-confirm');
    assert.equal(declineUrl.searchParams.get('offer_id'), OFFER_ID);
    assert.equal(declineUrl.searchParams.get('token'), TOKEN);
  } finally {
    global.fetch = originalFetch;
  }
});
