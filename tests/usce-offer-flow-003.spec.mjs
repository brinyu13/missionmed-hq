import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Readable } from 'node:stream';
import test from 'node:test';
import {
  buildOfferEmailPresentation,
  handleUsceOfferPortalPublicRoute,
  hashOfferToken,
  isOfferStatusVisibleInAdmin,
} from '../missionmed-hq/routes/usce-offer-portal.mjs';

const OFFER_ID = '11111111-1111-4111-8111-111111111111';
const TOKEN = 'usce_' + 'A'.repeat(43);
const OFFER_BODY = [
  'Hi Taylor,',
  '',
  'Great news - we have a confirmed slot for you.',
  '',
  'Program: MS4',
  'Specialty: Internal Medicine',
  'Location: Chicago, IL',
  'Length: 4 weeks',
  'Month(s) offered: Jul 2026 or Aug 2026',
  'Proposed start: 2026-07-13',
  'Offer expires: Jun 24, 2026 at 5:00 PM',
  '',
  `Review offer: https://cdn.missionmedinstitute.com/html-system/LIVE/usce_offer.html?offer=${TOKEN}`,
  '',
  'Best,',
  'Phil',
  'MissionMed Clinicals Team',
].join('\n');

const ORIGINAL_ENV = { ...process.env };

function resetEnv() {
  process.env = { ...ORIGINAL_ENV };
  process.env.MMHQ_SUPABASE_URL = 'https://fglyvdykwgbuivikqoah.supabase.co';
  process.env.MMHQ_SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key';
}

function jsonRequest(method, body = undefined, headers = {}) {
  const chunks = body === undefined ? [] : [Buffer.from(JSON.stringify(body))];
  const request = Readable.from(chunks);
  request.method = method;
  request.headers = {
    origin: 'https://missionmedinstitute.com',
    'user-agent': 'node-test',
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

test('offer email renderer produces branded offer email with exactly two student CTAs', () => {
  resetEnv();

  const rendered = buildOfferEmailPresentation({
    offerId: OFFER_ID,
    message: {
      category: 'offer_ready',
      variant: 'coordinator_clear',
      to_email: 'student@example.test',
      subject: 'Legacy subject should not become the canonical offer subject',
      body: OFFER_BODY,
    },
  });

  assert.equal(rendered.template, 'usce_offer_ready_canonical_v1');
  assert.equal(rendered.subject, 'Your Clinical Rotation Offer from MissionMed');
  assert.match(rendered.htmlBody, /MissionMed/);
  assert.match(rendered.htmlBody, /Clinical Rotation Offer/);
  assert.match(rendered.htmlBody, /Offer summary/);
  assert.match(rendered.htmlBody, /Internal Medicine/);
  assert.match(rendered.htmlBody, /Chicago, IL/);
  assert.match(rendered.htmlBody, /Jul 2026 or Aug 2026/);
  assert.match(rendered.htmlBody, /4 weeks/);
  assert.match(rendered.htmlBody, /Jun 24, 2026/);
  assert.equal((rendered.htmlBody.match(/data-mm-cta=/g) || []).length, 2);
  assert.equal((rendered.htmlBody.match(/<a\s+/g) || []).length, 2);
  assert.match(rendered.htmlBody, /Accept This Offer/);
  assert.match(rendered.htmlBody, /Decline This Offer/);
  assert.doesNotMatch(rendered.htmlBody, /coordinator will share secure link later/i);
  assert.doesNotMatch(rendered.textBody, /coordinator will share secure link later/i);

  const acceptUrl = new URL(rendered.accept_url);
  assert.equal(acceptUrl.origin + acceptUrl.pathname, 'https://missionmedinstitute.com/product/usce-clinical-rotations/');
  assert.equal(acceptUrl.searchParams.get('offer_id'), OFFER_ID);
  assert.equal(acceptUrl.searchParams.get('token'), TOKEN);
  assert.equal(acceptUrl.searchParams.get('usce_offer_approved'), '1');

  const declineUrl = new URL(rendered.decline_url);
  assert.equal(declineUrl.origin + declineUrl.pathname, 'https://missionmed-hq-production.up.railway.app/usce-decline-confirm');
  assert.equal(declineUrl.searchParams.get('offer_id'), OFFER_ID);
  assert.equal(declineUrl.searchParams.get('token'), TOKEN);
});

test('decline click route records pending state only', async () => {
  resetEnv();
  const fetchCalls = [];
  const originalFetch = global.fetch;
  global.fetch = async (url, init) => {
    fetchCalls.push({ url: String(url), body: JSON.parse(init.body) });
    return jsonFetchResponse({ ok: true, recorded: true });
  };

  try {
    const response = mockResponse();
    const handled = await handleUsceOfferPortalPublicRoute(
      jsonRequest('POST'),
      response,
      new URL(`https://missionmed-hq-production.up.railway.app/api/usce/offer/${TOKEN}/decline`),
    );

    assert.equal(handled, true);
    assert.equal(response.statusCode, 200);
    assert.equal(fetchCalls.length, 1);
    assert.match(fetchCalls[0].url, /respond_usce_offer_by_token_hash$/);
    assert.equal(fetchCalls[0].body.p_token_hash, hashOfferToken(TOKEN));
    assert.equal(fetchCalls[0].body.p_action, 'decline_pending');
    assert.equal(fetchCalls[0].body.p_consent, false);
    assert.equal(fetchCalls[0].body.p_metadata.stage, 'pending');
  } finally {
    global.fetch = originalFetch;
  }
});

test('confirmed decline records future-notification preference', async () => {
  resetEnv();
  const fetchCalls = [];
  const originalFetch = global.fetch;
  global.fetch = async (url, init) => {
    fetchCalls.push({ url: String(url), body: JSON.parse(init.body) });
    return jsonFetchResponse({ ok: true, recorded: true });
  };

  try {
    for (const [notify_future_rotations, expectedAction] of [
      [true, 'decline_notify_future'],
      [false, 'decline_no_notify'],
    ]) {
      const response = mockResponse();
      await handleUsceOfferPortalPublicRoute(
        jsonRequest('POST', { notify_future_rotations, note: 'Student confirmed.' }),
        response,
        new URL(`https://missionmed-hq-production.up.railway.app/api/usce/offer/${TOKEN}/decline/confirm`),
      );

      assert.equal(response.statusCode, 200);
      const call = fetchCalls.at(-1);
      assert.equal(call.body.p_action, expectedAction);
      assert.equal(call.body.p_consent, true);
      assert.equal(call.body.p_metadata.stage, 'confirmed');
      assert.equal(call.body.p_metadata.notify_future_rotations, notify_future_rotations);
    }
  } finally {
    global.fetch = originalFetch;
  }
});

test('confirmed decline requires notification preference before RPC write', async () => {
  resetEnv();
  let fetchCount = 0;
  const originalFetch = global.fetch;
  global.fetch = async () => {
    fetchCount += 1;
    return jsonFetchResponse({ ok: true });
  };

  try {
    const response = mockResponse();
    await handleUsceOfferPortalPublicRoute(
      jsonRequest('POST', { note: 'No preference selected.' }),
      response,
      new URL(`https://missionmed-hq-production.up.railway.app/api/usce/offer/${TOKEN}/decline/confirm`),
    );

    assert.equal(response.statusCode, 400);
    assert.equal(response.json().error, 'decline_notify_preference_required');
    assert.equal(fetchCount, 0);
  } finally {
    global.fetch = originalFetch;
  }
});

test('admin status visibility includes full offer lifecycle', () => {
  const statuses = [
    'OFFER_SENT',
    'OFFER_ACCEPTED',
    'OFFER_DECLINE_PENDING',
    'OFFER_DECLINED_NOTIFY_FUTURE',
    'OFFER_DECLINED_NO_NOTIFY',
  ];

  for (const status of statuses) {
    assert.equal(isOfferStatusVisibleInAdmin(status), true, `${status} should be admin-visible`);
  }

  for (const file of ['LIVE/usce_admin.html', 'missionmed-hq/public/usce-admin.html']) {
    const source = readFileSync(file, 'utf8');
    for (const status of statuses) {
      assert.match(source, new RegExp(status, 'u'), `${file} should include ${status}`);
    }
  }
});

test('decline confirmation page and offer page avoid old direct-decline markers', () => {
  const offerPage = readFileSync('LIVE/usce_offer.html', 'utf8');
  const declinePage = readFileSync('missionmed-hq/public/usce-decline-confirm.html', 'utf8');

  assert.match(offerPage, /usce-decline-confirm/);
  assert.match(offerPage, /openDeclineConfirmation/);
  assert.doesNotMatch(offerPage, /respond\('declined'\)/);
  assert.doesNotMatch(offerPage, /respondToOffer\(token,\s*'decline'/);

  assert.match(declinePage, /notify_future_rotations/);
  assert.match(declinePage, /future rotations/);
  assert.match(declinePage, /\/decline\/confirm/);
  assert.match(declinePage, /slot may be released/i);
});
