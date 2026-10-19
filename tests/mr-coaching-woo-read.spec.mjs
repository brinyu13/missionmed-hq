import test from 'node:test';
import assert from 'node:assert/strict';
import { createWooCoachingAllowanceReader } from '../missionmed-hq/lib/scheduler/coaching-woo-read.mjs';

const SECOND = 1800000000;
const USER = 'f0459c60-0b79-41e3-a2f4-bc7e080cba2a';
const AUTH = 'Basic Zml4dHVyZTpub3QtYS1yZWFsLWNyZWRlbnRpYWw=';
const session = () => ({ supabaseUserId: USER, user: { wpUserId: 42, roles: ['student'] } });
function pkg(sku = 'three', order = 1001) {
  const counts = { single: { mock: 1 }, three: { strategy: 1, mock: 3, debrief: 2 }, five: { strategy: 1, mock: 5, debrief: 3 } }[sku];
  const p = { order_id: order, order_item_id: order + 1000, product_id: 900001, sku, snapshot_digest: 'a'.repeat(64), eligibility_revision: 1, units: [] };
  for (const [service, count] of Object.entries(counts)) for (let ordinal = 1; ordinal <= count; ordinal++) p.units.push({ unit_id: `coaching-unit:v1:${p.order_id}:${p.order_item_id}:${service}:${ordinal}`, order_id: p.order_id, order_item_id: p.order_item_id, owner_wp_user_id: 42, product_id: p.product_id, sku, service, ordinal, duration_minutes: { strategy: 120, mock: 105, debrief: 45 }[service], snapshot_digest: p.snapshot_digest });
  return p;
}
function fixture({ mutate = () => {}, response, headers = { Authorization: AUTH }, now = () => SECOND * 1000, headerError } = {}) {
  const calls = [];
  const read = createWooCoachingAllowanceReader({ now, getServiceHeaders: async () => { if (headerError) throw headerError; return headers; }, fetchImpl: async (url, options) => {
    calls.push({ url, options });
    const request = JSON.parse(options.body);
    const body = { schema: 'missionmed.coaching.allowances.v1', request_id: request.request_id, subject_wp_user_id: request.subject_wp_user_id, subject_user_id: request.subject_user_id, checked_at: SECOND, valid_until: SECOND + 15, complete: true, packages: [pkg()] };
    mutate(body);
    return response ? response(body, calls) : new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } });
  } });
  return { read, calls };
}
async function denied(call) { await assert.rejects(call, e => e.code === 'coaching_woo_allowances_unavailable' && e.status === 503 && !e.message.includes(AUTH)); }

test('fresh exact owned allowance with monotonic integer revision', async () => {
  const f = fixture(); const data = await f.read(session());
  assert.equal(data.packages[0].eligibility_revision, 1); assert.equal(data.packages[0].units.length, 6);
  assert.ok(!JSON.stringify(data).includes(AUTH));
  const { url, options } = f.calls[0];
  assert.equal(url, 'https://missionmedinstitute.com/wp-json/mmed-coaching/v1/allowances');
  assert.equal(options.redirect, 'error'); assert.equal(options.credentials, 'omit'); assert.equal(options.cache, 'no-store');
  assert.deepEqual(Object.keys(options.headers).sort(), ['Accept', 'Authorization', 'Content-Type']);
  assert.deepEqual(Object.keys(JSON.parse(options.body)).sort(), ['request_id', 'subject_user_id', 'subject_wp_user_id']);
  assert.equal(options.method, 'POST'); assert.ok(options.signal instanceof AbortSignal);
});
for (const [label, subject] of Object.entries({ unauthenticated: null, fallbackOnly: { user: { id: 42 } }, rolesAlone: { roles: ['administrator'], user: { id: 42 } }, malformedUuid: { supabaseUserId: 'not-confirmed', user: { wpUserId: 42 } }, missingWp: { supabaseUserId: USER }, fractionalWp: { supabaseUserId: USER, user: { wpUserId: 42.5 } }, unsafeWp: { supabaseUserId: USER, user: { wpUserId: Number.MAX_SAFE_INTEGER + 1 } } })) test('authentication rejects ' + label, async () => { const f = fixture(); await denied(() => f.read(subject)); assert.equal(f.calls.length, 0); });
for (const headers of [null, {}, { Authorization: 'Bearer browser-token' }, { Authorization: AUTH, Cookie: 'student=cookie' }, { Authorization: AUTH, 'X-Student-Id': '42' }, { authorization: AUTH }]) test('unsafe service header shape ' + JSON.stringify(headers), async () => { const f = fixture({ headers }); await denied(() => f.read(session())); assert.equal(f.calls.length, 0); });
test('secret-bearing header lookup failure is sanitized', async () => { const f = fixture({ headerError: new Error(AUTH) }); await denied(() => f.read(session())); });
test('browser extra identity and URL arguments cannot enter request', async () => { const f = fixture(); await f.read(session(), { subject_wp_user_id: 999, subject_user_id: 'browser', url: 'https://evil.invalid', Cookie: 'x' }); const body = JSON.parse(f.calls[0].options.body); assert.equal(body.subject_wp_user_id, 42); assert.equal(body.subject_user_id, USER); assert.ok(!JSON.stringify(f.calls).includes('evil.invalid')); });
for (const [label, mutate] of Object.entries({ extraIdentity: b => { b.actor = 99; }, wrongOwner: b => { b.subject_wp_user_id = 99; }, wrongSubject: b => { b.subject_user_id = 'b'.repeat(36); }, wrongNonce: b => { b.request_id = 'b'.repeat(48); }, incomplete: b => { b.complete = false; }, unknownSchema: b => { b.schema = 'other'; }, stale: b => { b.checked_at = SECOND - 16; b.valid_until = b.checked_at + 15; }, future: b => { b.checked_at = SECOND + 2; b.valid_until = b.checked_at + 15; }, wrongTtl: b => { b.valid_until++; }, packageOverflow: b => { b.packages = Array.from({ length: 101 }, (_, i) => pkg('single', 1001 + i)); }, credentialExtra: b => { b.Authorization = AUTH; } })) test('response schema/freshness rejects ' + label, async () => { const f = fixture({ mutate }); await denied(() => f.read(session())); });
test('exact valid-until boundary expires', async () => { let reads = 0; const f = fixture({ now: () => (SECOND + (reads++ ? 15 : 0)) * 1000 }); await denied(() => f.read(session())); });
for (const invalid of [NaN, Infinity, -1]) test('uncertain server clock denied ' + invalid, async () => { const f = fixture({ now: () => invalid, mutate: b => { b.packages = []; } }); await denied(() => f.read(session())); });
test('clock reversal denied', async () => { let reads = 0; const f = fixture({ now: () => (SECOND - (reads++ ? 5 : 0)) * 1000 }); await denied(() => f.read(session())); });
for (const revision of [0, -1, 1.5, '1', 'a'.repeat(64), null, Number.MAX_SAFE_INTEGER + 1]) test('revision is positive safe integer only ' + revision, async () => { const f = fixture({ mutate: b => { b.packages[0].eligibility_revision = revision; } }); await denied(() => f.read(session())); });
test('fresh requests use distinct challenge IDs; old response cannot replay', async () => { let prior; const f = fixture({ response: body => { const send = prior || body; prior = structuredClone(body); return new Response(JSON.stringify(send), { headers: { 'Content-Type': 'application/json' } }); } }); await f.read(session()); await denied(() => f.read(session())); assert.notEqual(JSON.parse(f.calls[0].options.body).request_id, JSON.parse(f.calls[1].options.body).request_id); });
for (const [label, mutate] of Object.entries({ extraPackageSecret: p => { p.secret = AUTH; }, wrongUnitOwner: p => { p.units[0].owner_wp_user_id = 99; }, wrongUnitOrder: p => { p.units[0].order_id++; }, wrongItem: p => { p.units[0].order_item_id++; }, wrongProduct: p => { p.units[0].product_id++; }, wrongSnapshot: p => { p.units[0].snapshot_digest = 'b'.repeat(64); }, badDuration: p => { p.units[0].duration_minutes = 30; }, missingUnit: p => { p.units.pop(); }, duplicateUnit: p => { p.units[1] = structuredClone(p.units[0]); }, extraUnitIdentity: p => { p.units[0].browser_user_id = 42; }, wrongStableId: p => { p.units[0].unit_id = 'forged'; }, extraService: p => { p.units[0].service = 'day'; }, outOfRangeOrdinal: p => { p.units[0].ordinal = 100; }, unknownSku: p => { p.sku = 'emergency'; }, stringOrder: p => { p.order_id = '1001'; } })) test('package/unit poisoning denied ' + label, async () => { const f = fixture({ mutate: b => mutate(b.packages[0]) }); await denied(() => f.read(session())); });
test('all three exact package counts accepted', async () => { const f = fixture({ mutate: b => { b.packages = ['single', 'three', 'five'].map((sku, i) => pkg(sku, 1001 + i)); } }); const data = await f.read(session()); assert.deepEqual(data.packages.map(p => p.units.length), [1, 6, 9]); });
test('duplicate package order denied', async () => { const f = fixture({ mutate: b => { b.packages.push(structuredClone(b.packages[0])); } }); await denied(() => f.read(session())); });
test('explicit complete known-empty result is valid, not guessed', async () => { const f = fixture({ mutate: b => { b.packages = []; } }); assert.deepEqual((await f.read(session())).packages, []); });
for (const [label, response] of Object.entries({ httpFailure: () => new Response('{}', { status: 503 }), wrongMime: () => new Response('{}', { headers: { 'Content-Type': 'text/html' } }), malformedJson: () => new Response('{', { headers: { 'Content-Type': 'application/json' } }), advertisedOversize: () => new Response('{}', { headers: { 'Content-Type': 'application/json', 'Content-Length': '131073' } }), streamedOversize: () => new Response('x'.repeat(131073), { headers: { 'Content-Type': 'application/json' } }), redirectFailure: () => { throw new TypeError('redirect blocked'); }, timeout: () => { throw new DOMException('timeout', 'TimeoutError'); } })) test('transport uncertainty cannot become zero allowances: ' + label, async () => { const f = fixture({ response }); await denied(() => f.read(session())); });
