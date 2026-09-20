import assert from 'node:assert/strict';
import test from 'node:test';

import {
  createIvocApplicationIntelligence,
  createIvocProjectionProvider,
  readSessionContextReceipts,
} from '../../ivoc/application-intelligence.mjs';

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

test('repository-backed Mentor Top 3 becomes a provenance-bound interviewer attention signal', async () => {
  const writes = repository();
  const priorityRow = {
    subject_id: 'wp:42', version: 3,
    priorities: [{ id: 'leadership', text: 'Can you give me one concrete example that shows your leadership?', rank: 1 }],
    mentor_notes: [{ id: 'private', text: 'Student tends to bury the point.', visibility: 'mentor_only' }],
    set_by: 'wp:1', created_at: NOW,
  };
  const originalSingle = writes.single;
  writes.single = async (path) => path.startsWith('ivoc_mentor_priority_sets?subject_id=eq.wp%3A42')
    ? priorityRow : originalSingle(path);

  const provider = createIvocProjectionProvider({ repository: writes });
  const projections = await provider({ actor: 'wp:42' });
  assert.equal(projections.length, 1);
  assert.equal(projections[0].projection_type, 'ivoc.mentor_priorities');
  assert.equal(projections[0].source_version, 'mp-v3');
  assert.match(projections[0].source_receipt.hash, /^[0-9a-f]{64}$/u);

  const service = createIvocApplicationIntelligence({ repository: writes, now: () => Date.parse(NOW) });
  await service.prepareSession({ actor: 'wp:42', sessionRow: sessionRow() });
  const pack = writes.upserts.find((entry) => entry.table === 'ivoc_context_packs').body.pack;
  assert.ok(pack.inputs.some((input) => input.projection_type === 'ivoc.mentor_priorities'));
  assert.ok(pack.facts.some((fact) => fact.fact_type === 'mentor_priority' && fact.student_visible === false));
  assert.ok(pack.signals.some((signal) => signal.rule_id === 'AIS-R09'));
  assert.match(pack.actor_block, /Can you give me one concrete example that shows your leadership\?/u);
  assert.doesNotMatch(pack.actor_block, /bury the point/u);
});
