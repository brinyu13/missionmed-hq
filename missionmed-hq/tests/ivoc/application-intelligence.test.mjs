import assert from 'node:assert/strict';
import test from 'node:test';

import { createIvocApplicationIntelligence, readSessionContextReceipts } from '../../ivoc/application-intelligence.mjs';

const SESSION_ID = '00000000-0000-4000-8000-000000000042';
const NOW = '2026-09-20T14:55:00.000Z';

function repository() {
  const upserts = [];
  return {
    upserts,
    upsert: async (table, conflict, body) => {
      upserts.push({ table, conflict, body });
      return body;
    },
    single: async (path) => {
      const pack = upserts.find((entry) => entry.table === 'ivoc_context_packs')?.body;
      if (path.startsWith(`ivoc_context_packs?session_id=eq.${SESSION_ID}`)
          && path.includes('owner_subject=eq.wp%3A42') && pack) return pack;
      const contract = upserts.find((entry) => entry.table === 'ivoc_session_contracts')?.body;
      if (path.startsWith(`ivoc_session_contracts?session_id=eq.${SESSION_ID}`) && contract) return contract;
      return null;
    },
  };
}

function sessionRow() {
  return {
    id: SESSION_ID,
    owner_subject: 'wp:42',
    session_type: 'question',
    question_id: 'CORE-01',
    interviewer_provider: 'gpt-live',
    analytics_schema: 'ivoc.analytics.v1',
    context: {},
    started_at: NOW,
  };
}

test('session preparation persists one fail-closed pack and pins its server receipt', async () => {
  const repo = repository();
  const service = createIvocApplicationIntelligence({ repository: repo, now: () => Date.parse(NOW) });
  const prepared = await service.prepareSession({ actor: 'wp:42', sessionRow: sessionRow() });

  const packWrite = repo.upserts.find((entry) => entry.table === 'ivoc_context_packs');
  const contractWrite = repo.upserts.find((entry) => entry.table === 'ivoc_session_contracts');
  assert.equal(packWrite.conflict, 'session_id,pack_version');
  assert.equal(packWrite.body.schema_name, 'ivoc.interview_context_pack.v1');
  assert.equal(packWrite.body.owner_subject, 'wp:42');
  assert.deepEqual(packWrite.body.pack.facts, []);
  assert.deepEqual(packWrite.body.pack.signals, []);
  assert.ok(Buffer.byteLength(packWrite.body.actor_block) <= 6144);
  assert.match(prepared.receipt, /^ctxpack:[0-9a-f-]+@[0-9a-f]{64}$/u);
  assert.deepEqual(contractWrite.body.context_receipts, [prepared.receipt]);
  assert.equal(contractWrite.body.practice_goal, 'individual_question');
  assert.equal(contractWrite.body.contract_state, 'ready_check');
});

test('actor context read is owner-scoped and returns only the bounded actor projection', async () => {
  const repo = repository();
  const service = createIvocApplicationIntelligence({ repository: repo, now: () => Date.parse(NOW) });
  const prepared = await service.prepareSession({ actor: 'wp:42', sessionRow: sessionRow() });
  const actorContext = await service.getActorContext({ actor: 'wp:42', sessionId: SESSION_ID });
  assert.equal(actorContext.receipt, prepared.receipt);
  assert.equal(typeof actorContext.actorBlock, 'string');
  assert.deepEqual(Object.keys(actorContext).sort(), ['actorBlock', 'receipt']);
});

test('receipt readback accepts only persisted context-pack receipts', async () => {
  const repo = {
    single: async () => ({ context_receipts: ['forged:browser', 'ctxpack:a@b', 'ctxpack:a@b', 42] }),
  };
  assert.deepEqual(await readSessionContextReceipts(repo, SESSION_ID), ['ctxpack:a@b']);
});
