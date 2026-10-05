import test from 'node:test';
import assert from 'node:assert/strict';
import { MissionResidencyFinancialService } from '../src/mission-residency-finance/service.mjs';
import { loadSealedBundle, SEALED_INPUT } from '../src/mission-residency-finance/phase0c-import.mjs';

test('explicit finance resolver required; generic WordPress roles and students denied', async () => {
  assert.throws(() => new MissionResidencyFinancialService({ store: { rpc() {} } }));
  let called = false;
  const svc = new MissionResidencyFinancialService({ store: { rpc() { called = true; } }, resolveFinancialPrincipal: async () => null });
  for (const session of [null, { role: 'administrator' }, { role: 'student' }]) await assert.rejects(svc.accounts(session), /denied/);
  assert.equal(called, false);
});
test('Stripe/Zelle receipt adapters share one atomic RPC and cannot dispatch', async () => {
  const calls = [];
  const svc = new MissionResidencyFinancialService({ store: { rpc: async (name,body) => { calls.push({name,body}); } },
    resolveFinancialPrincipal: async () => ({ actorId: 'fixture-finance', authorityRef: 'fixture', capabilities: ['settle'] }) });
  for (const provider of ['Stripe','Chase']) await svc.recordVerifiedPayment({}, { provider });
  assert.deepEqual(calls.map(x => x.name), Array(2).fill('api_record_verified_financial_payment'));
  assert.equal(Object.getOwnPropertyNames(MissionResidencyFinancialService.prototype).some(x => /charge|invoice|payNow|dispatch/.test(x)), false);
});
test('sealed imports reject altered source bytes before constructing a bundle', async () => {
  assert.equal(SEALED_INPUT.ledger.length, 64);
  await assert.rejects(loadSealedBundle({ ledgerPath: new URL(import.meta.url), crosswalkPath: new URL(import.meta.url), evidencePath: new URL(import.meta.url) }), /integrity/);
});
