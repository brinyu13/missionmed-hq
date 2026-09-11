import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PreviewStore } from '../src/storage/supabase-rest.mjs';

const migration = await readFile(new URL('../supabase/migrations/20260911131140_sponsor_control.sql', import.meta.url), 'utf8');
const html = await readFile(new URL('../public/index.production.html', import.meta.url), 'utf8');

test('migration installs durable sponsor authority and guards every direct-liability path', () => {
  assert.match(migration, /sponsor_type in \('DIRECT','UCC','MUL'\)/);
  for (const seam of ['billing_decision_sponsor_guard','invoice_sponsor_guard','charge_sponsor_guard','manual_cycle_charge_sponsor_guard','auto_charge_dispatch_sponsor_exclusion']) assert.match(migration, new RegExp(seam));
  assert.match(migration, /student\.sponsor_assigned/);
  assert.match(migration, /sponsored_direct_liability_blocked/);
  assert.doesNotMatch(migration, /update missionaccounts\.(attendance_day|attendance_event|invoice|charge|manual_cycle_charge)/i);
});

test('preview runtime preserves DIRECT behavior and rejects sponsored collectible liability', async () => {
  const store = new PreviewStore();
  const id = store.previewStudentRecord.id;
  store.attendanceDays.set(`${id}:2026-cycle-1`, [{ id:'day-1', kind:'billable', day:'2026-06-10', event_ids:['event-1'] }]);
  let direct = await store.approveBillingDecision({ studentId:id, cycleKey:'2026-cycle-1', treatment:'confirm', requestedAmountCents:null, note:'direct', actorId:'admin', requestId:'sponsor-direct-1' });
  assert.equal(direct.accepted, true);
  assert.equal(direct.decision.amount_cents, 2500);
  store.previewStudentRecord.sponsor_type = 'UCC';
  const blocked = await store.approveBillingDecision({ studentId:id, cycleKey:'2026-cycle-2', treatment:'confirm', requestedAmountCents:null, note:'blocked', actorId:'admin', requestId:'sponsor-ucc-block-1' });
  assert.deepEqual({accepted:blocked.accepted,reason:blocked.reason},{accepted:false,reason:'sponsored_direct_liability_blocked'});
  const zero = await store.approveBillingDecision({ studentId:id, cycleKey:'2026-cycle-2', treatment:'ucc', requestedAmountCents:0, note:'sponsor', actorId:'admin', requestId:'sponsor-ucc-zero-1' });
  assert.equal(zero.accepted, true);
  assert.equal(zero.decision.amount_cents, 0);
});

test('rendered app exposes sponsor state, zero due, and no sponsored charge control', () => {
  assert.match(html, /\$0 due from student/);
  assert.match(html, /Sponsored student direct liability is \$0/);
  assert.match(html, /sponsor:\['UCC','MUL'\]/);
  assert.match(html, /MissionAccounts will not use it for sponsored Drills liability/);
});
