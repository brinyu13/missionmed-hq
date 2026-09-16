import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { readFileSync } from 'node:fs';
import { createMissionAccountsServer } from '../src/server.mjs';
import { PreviewStore, SupabaseRestStore } from '../src/storage/supabase-rest.mjs';

const studentId = '10000000-0000-4000-8000-000000000001';
const cycleKey = '2026-cycle-1';
const config = { production: false, localAuth: true, features: { legacyInvoices: true } };
async function serve(cfg, store, run) {
  const server = createMissionAccountsServer({ config: cfg, store });
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  try { await run(`http://127.0.0.1:${server.address().port}`); }
  finally { server.closeAllConnections(); server.close(); await once(server, 'close'); }
}

test('legacy invoice routes are Dr J-bound, feature-off by default and provider-free', async () => {
  const calls = [];
  const store = new PreviewStore();
  store.legacyInvoicePreview = async args => (calls.push(['preview', args]), { lines: [], total_cents: 0, provider_action_allowed: false });
  store.recordLegacyManualItem = async args => (calls.push(['manual', args]), { duplicate: false });
  store.recordLegacyLiability = async args => (calls.push(['liability', args]), { duplicate: false });
  store.approveLegacyInvoicePreview = async args => (calls.push(['approve', args]), { duplicate: false });
  await serve(config, store, async base => {
    const root = `${base}/api/admin/students/${studentId}/legacy-invoices/${cycleKey}`;
    const preview = await fetch(root, { headers: { 'x-missionaccounts-local-role': 'missionaccounts_admin' } });
    assert.equal(preview.status, 200); assert.equal((await preview.json()).provider_action_allowed, false);
    for (const action of ['manual-items', 'liability', 'approve']) {
      const denied = await fetch(`${root}/${action}`, { method: 'POST', headers: {
        'content-type': 'application/json', 'x-missionaccounts-local-role': 'founder',
        'idempotency-key': 'legacy-route-0001' }, body: '{}' });
      assert.equal(denied.status, 403);
    }
    const manual = await fetch(`${root}/manual-items`, { method: 'POST', headers: {
      'content-type': 'application/json', 'x-missionaccounts-local-role': 'missionaccounts_admin',
      'idempotency-key': 'legacy-route-0002' }, body: JSON.stringify({ kind: 'one_on_one',
      service_key: 'tutorial-1', revision: 1, state: 'attested', service_on: '2026-06-12',
      duration_minutes: 60, rate_cents: 8500, amount_cents: 8500, treatment: 'none',
      source_ref: 'attestation', source_sha256: 'a'.repeat(64), reason: 'Verified tutorial' }) });
    assert.equal(manual.status, 201);
    assert.equal(calls.at(-1)[1].actorRole, 'missionaccounts_admin');
    assert.equal(calls.at(-1)[1].actorId, '00000000-0000-4000-8000-000000000001');
    const invalid = await fetch(`${root}/approve`, { method: 'POST', headers: {
      'content-type': 'application/json', 'x-missionaccounts-local-role': 'missionaccounts_admin',
      'idempotency-key': 'legacy-route-0003' }, body: JSON.stringify({ lines: [], amount_cents: 0 }) });
    assert.equal(invalid.status, 400);
  });
  await serve({ ...config, features: { legacyInvoices: false } }, store, async base => {
    const response = await fetch(`${base}/api/admin/students/${studentId}/legacy-invoices/${cycleKey}`, { headers: { 'x-missionaccounts-local-role': 'missionaccounts_admin' } });
    assert.equal(response.status, 503);
  });
});

test('Supabase legacy methods use exact RPCs and snake-case authority bindings', async () => {
  const store = new SupabaseRestStore({ url: 'https://example.invalid', serviceKey: 'fixture' });
  const calls = []; store.rpc = async (name, args) => (calls.push({ name, args }), { accepted: true });
  const common = { studentId, cycleKey, actorId: 'wp:drj', actorRole: 'missionaccounts_admin', requestId: 'legacy-store-0001' };
  await store.legacyInvoicePreview({ studentId, cycleKey });
  await store.recordLegacyManualItem({ ...common, kind: 'credit', serviceKey: 'credit-1', revision: 1, state: 'attested', serviceOn: '2026-06-12', durationMinutes: null, rateCents: null, amountCents: 1000, treatment: 'none', sourceRef: 'ledger', sourceSha256: 'a'.repeat(64), reason: 'Verified credit' });
  await store.recordLegacyLiability({ ...common, revision: 1, classification: 'direct_charge', sourceRef: 'review', sourceSha256: 'b'.repeat(64), reason: 'Verified liability' });
  await store.approveLegacyInvoicePreview({ ...common, lines: [], amountCents: 1000, previewDigestSha256: 'c'.repeat(64), sourceDigestSha256: 'd'.repeat(64) });
  assert.deepEqual(calls.map(call => call.name), ['legacy_invoice_preview_snapshot', 'api_record_legacy_manual_item', 'api_record_legacy_liability', 'api_approve_legacy_invoice_preview']);
  for (const call of calls.slice(1)) { assert.equal(call.args.p_actor_id, 'wp:drj'); assert.equal(call.args.p_actor_role, 'missionaccounts_admin'); assert.equal(call.args.p_request_id, 'legacy-store-0001'); }
});

test('PreviewStore keeps approval internal and exact-snapshot bound', async () => {
  const store = new PreviewStore();
  const previewStudentId = store.previewStudentRecord.id;
  store.stripeCustomers.set(previewStudentId, { provider_customer_ref: 'preview-customer' });
  const common = { studentId: previewStudentId, cycleKey, actorId: 'wp:drj', actorRole: 'missionaccounts_admin' };
  await store.recordLegacyLiability({ ...common, revision: 1, classification: 'direct_charge',
    sourceRef: 'review', sourceSha256: 'a'.repeat(64), reason: 'Verified',
    requestId: 'legacy-preview-liability-1' });
  const preview = await store.legacyInvoicePreview({ studentId: previewStudentId, cycleKey });
  const receipt = await store.approveLegacyInvoicePreview({ ...common, lines: preview.lines,
    amountCents: preview.total_cents, previewDigestSha256: preview.preview_digest_sha256,
    sourceDigestSha256: preview.source_digest_sha256, requestId: 'legacy-preview-approval-1' });
  assert.equal(receipt.accepted, true);
  assert.equal(preview.provider_action_allowed, false);
  assert.equal((await store.legacyInvoicePreview({ studentId: previewStudentId, cycleKey })).state, 'approval-ready');
  await assert.rejects(() => store.approveLegacyInvoicePreview({ ...common, lines: preview.lines,
    amountCents: preview.total_cents + 1, previewDigestSha256: preview.preview_digest_sha256,
    sourceDigestSha256: preview.source_digest_sha256, requestId: 'legacy-preview-approval-2' }), /held or changed/);
});

test('rendered admin source exposes the bounded responsive workflow and no send control', () => {
  const html = readFileSync(new URL('../public/index.production.html', import.meta.url), 'utf8');
  for (const token of ['#/legacy-invoices', 'Legacy invoice review', 'Load exact preview',
    'Record liability.', 'Add verified 1-on-1.', 'Approve internal snapshot',
    'provider_action_allowed', '@media(max-width:900px){.legacyGrid']) assert.ok(html.includes(token), token);
  assert.doesNotMatch(html, /name="rate_usd"[^>]*value=/);
  assert.doesNotMatch(html, /data-legacy-(?:send|dispatch)|Send legacy invoice/i);
});
