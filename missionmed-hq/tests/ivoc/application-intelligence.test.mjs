import assert from 'node:assert/strict';
import test from 'node:test';

import {
  createIvocApplicationIntelligence,
  createIvocProjectionProvider,
  longitudinalProjection,
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
    request: async () => [],
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

test('selected File Vault CV is owner-read once and becomes provenance-bound application context', async () => {
  const repo = repository();
  const reads = [];
  const fileVaultSource = {
    read: async (input) => {
      reads.push(input);
      return {
        projection_id: 'filevault-cv:document-42', owner_app: 'filevault',
        projection_type: 'filevault.document_projection', schema_version: '1', subject_id: 'wp:42',
        source_version: 'cv:document-42@version-3', produced_at: NOW,
        authorization: { basis: 'student_consent', scope: ['entries'], consent_ref: `ivoc-session:${SESSION_ID}` },
        minimization: { fields_included: ['entries'] },
        payload: {
          doc_id: 'document-42', kind: 'cv', version: '3', content_hash: 'b'.repeat(64), as_of: '2026-09-20',
          entries: [{ entry_id: 'research-1', entry_type: 'research_item', title: 'A verified quality-improvement project', role: 'lead' }],
        },
        source_receipt: { owner_ref: 'filevault:document-42@version-3', hash: 'c'.repeat(64) },
        revocation: { revocable: true },
      };
    },
  };
  const row = sessionRow();
  row.context = { contextSources: ['CV'] };
  const service = createIvocApplicationIntelligence({ repository: repo, fileVaultSource, now: () => Date.parse(NOW) });
  await service.prepareSession({ actor: 'wp:42', sessionRow: row, authorization: 'Bearer owner-session-token' });
  assert.deepEqual(reads, [{ actor: 'wp:42', sessionId: SESSION_ID, authorization: 'Bearer owner-session-token' }]);
  const pack = repo.upserts.find((entry) => entry.table === 'ivoc_context_packs').body.pack;
  assert.ok(pack.inputs.some((input) => input.projection_type === 'filevault.document_projection'));
  assert.ok(pack.facts.some((fact) => fact.fact_type === 'research_item'));
  assert.match(pack.actor_block, /quality-improvement project/u);
});

test('File Vault is not read unless selected, and a selected unavailable projection fails closed', async () => {
  const repo = repository();
  let reads = 0;
  const fileVaultSource = { read: async () => { reads += 1; return null; } };
  const provider = createIvocProjectionProvider({ repository: repo, fileVaultSource });
  await provider({ actor: 'wp:42', session: sessionRow(), authorization: 'Bearer owner-session-token' });
  assert.equal(reads, 0);

  const selected = sessionRow();
  selected.context = { contextSources: ['File Vault'] };
  await assert.rejects(
    () => provider({ actor: 'wp:42', session: selected, authorization: 'Bearer owner-session-token' }),
    /projection_unavailable/u,
  );
  assert.equal(reads, 1);
});

test('selected StoryForge is owner-read once and enters the context pack as consented story evidence', async () => {
  const repo = repository();
  const reads = [];
  const storyForgeSource = {
    read: async (input) => {
      reads.push(input);
      return {
        projection_id: 'storyforge-approved-stories:wp:42', owner_app: 'storyforge',
        projection_type: 'storyforge.approved_stories', schema_version: '1', subject_id: 'wp:42',
        source_version: 'sf-ivoc-42', produced_at: NOW,
        authorization: { basis: 'student_consent', scope: ['approved_story_summary'], consent_ref: 'storyforge:consent-42' },
        minimization: { fields_included: ['stories'] },
        payload: { stories: [{
          story_id: '33333333-3333-4333-8333-333333333333', version: '7', consent_state: 'granted',
          title: 'Night shift turnaround', themes: ['teamwork'],
          summary: 'I clarified roles, closed two safety gaps, and confirmed shared ownership.',
        }] },
        source_receipt: { owner_ref: 'storyforge:wp:42@sf-ivoc-42', hash: 'd'.repeat(64) },
        revocation: { revocable: true },
      };
    },
  };
  const row = sessionRow();
  row.context = { contextSources: ['StoryForge'] };
  const service = createIvocApplicationIntelligence({ repository: repo, storyForgeSource, now: () => Date.parse(NOW) });
  await service.prepareSession({ actor: 'wp:42', sessionRow: row, authorization: 'Bearer owner-session-token' });
  assert.deepEqual(reads, [{ actor: 'wp:42', sessionId: SESSION_ID, authorization: 'Bearer owner-session-token' }]);
  const pack = repo.upserts.find((entry) => entry.table === 'ivoc_context_packs').body.pack;
  assert.ok(pack.inputs.some((input) => input.projection_type === 'storyforge.approved_stories'));
  assert.ok(pack.facts.some((fact) => fact.fact_type === 'story_theme' && fact.attributes.consent_state === 'granted'));
});

test('StoryForge is not read unless selected, and selected absence fails closed', async () => {
  const repo = repository();
  let reads = 0;
  const storyForgeSource = { read: async () => { reads += 1; return null; } };
  const provider = createIvocProjectionProvider({ repository: repo, storyForgeSource });
  await provider({ actor: 'wp:42', session: sessionRow(), authorization: 'Bearer owner-session-token' });
  assert.equal(reads, 0);

  const selected = sessionRow();
  selected.context = { contextSources: ['StoryForge'] };
  await assert.rejects(
    () => provider({ actor: 'wp:42', session: selected, authorization: 'Bearer owner-session-token' }),
    /storyforge_projection_unavailable/u,
  );
  assert.equal(reads, 1);
});

test('prior-IVOC projection requires two distinct saved sessions and bounded structured evidence', async () => {
  const rows = [
    {
      evidence_id: 'evidence:a:1', session_id: 'session-a', subject_id: 'wp:42',
      dimension: 'semantic.coaching_pattern', refs: [{ kind: 'transcript_span', ref: 'transcript:a#seg-1' }],
      interpretation: { facet: 'structure', polarity: 'weakness', text: 'The main point arrives after the detail.' },
      score: { value: 0.82, scale: '0..1', basis: 'context_analysis' }, confidence: 0.88, limitations: [], version: 1, created_at: '2026-09-18T10:00:00.000Z',
    },
    {
      evidence_id: 'evidence:b:1', session_id: 'session-b', subject_id: 'wp:42',
      dimension: 'semantic.coaching_pattern', refs: [{ kind: 'transcript_span', ref: 'transcript:b#seg-1' }],
      interpretation: { facet: 'structure', polarity: 'weakness', text: 'The main point arrives after the detail.' },
      score: { value: 0.84, scale: '0..1', basis: 'context_analysis' }, confidence: 0.9, limitations: [], version: 1, created_at: '2026-09-19T10:00:00.000Z',
    },
    {
      evidence_id: 'evidence:c:1', session_id: 'session-c', subject_id: 'wp:42',
      dimension: 'semantic.coaching_pattern', refs: [{ kind: 'transcript_span', ref: 'transcript:c#seg-1' }],
      interpretation: { facet: 'specificity', polarity: 'strength', text: 'A concrete example is present.' },
      score: { value: 0.9, scale: '0..1', basis: 'context_analysis' }, confidence: 0.91, limitations: [], version: 1, created_at: '2026-09-19T11:00:00.000Z',
    },
    {
      evidence_id: 'evidence:low:1', session_id: 'session-d', subject_id: 'wp:42',
      dimension: 'semantic.coaching_pattern', refs: [{ kind: 'transcript_span', ref: 'transcript:d#seg-1' }],
      interpretation: { facet: 'structure', polarity: 'weakness', text: 'Low-confidence observation.' },
      score: { value: 0.4, scale: '0..1', basis: 'context_analysis' }, confidence: 0.4, limitations: [], version: 1, created_at: '2026-09-19T12:00:00.000Z',
    },
  ];
  const projection = longitudinalProjection(rows, 'wp:42');
  assert.equal(projection.projection_type, 'ivoc.longitudinal_summary');
  assert.deepEqual(projection.payload.recurring.weaknesses, [{
    facet: 'structure', sessions: ['session-a', 'session-b'], evidence_refs: ['evidence:a:1', 'evidence:b:1'],
  }]);
  assert.deepEqual(projection.payload.recurring.strengths, []);
  assert.equal(projection.produced_at, '2026-09-19T10:00:00.000Z');
  assert.match(projection.source_receipt.hash, /^[0-9a-f]{64}$/u);
  assert.equal(longitudinalProjection(rows.slice(0, 1), 'wp:42'), null);
});

test('provider excludes the active session and emits prior-IVOC context only from saved owner evidence', async () => {
  const repo = repository();
  const calls = [];
  repo.request = async (path) => {
    calls.push(path);
    if (path.startsWith('ivoc_sessions?')) return [{ id: SESSION_ID }, { id: 'session-a' }, { id: 'session-b' }];
    if (path.startsWith('ivoc_coaching_evidence?')) return [
      {
        evidence_id: 'evidence:a', session_id: 'session-a', subject_id: 'wp:42', dimension: 'semantic.coaching_pattern',
        refs: [{ kind: 'transcript_span', ref: 'a#1' }], interpretation: { facet: 'evidence', polarity: 'weakness' },
        score: { value: 0.9, scale: '0..1', basis: 'context_analysis' }, confidence: 0.9, limitations: [], version: 1, created_at: '2026-09-18T10:00:00Z',
      },
      {
        evidence_id: 'evidence:b', session_id: 'session-b', subject_id: 'wp:42', dimension: 'semantic.coaching_pattern',
        refs: [{ kind: 'transcript_span', ref: 'b#1' }], interpretation: { facet: 'evidence', polarity: 'weakness' },
        score: { value: 0.9, scale: '0..1', basis: 'context_analysis' }, confidence: 0.9, limitations: [], version: 1, created_at: '2026-09-19T10:00:00Z',
      },
    ];
    return [];
  };
  const provider = createIvocProjectionProvider({ repository: repo });
  const projections = await provider({ actor: 'wp:42', session: sessionRow() });
  assert.equal(projections.length, 1);
  assert.equal(projections[0].projection_type, 'ivoc.longitudinal_summary');
  assert.ok(calls[1].includes('session_id=in.(session-a,session-b)'));

  const service = createIvocApplicationIntelligence({ repository: repo, now: () => Date.parse(NOW) });
  await service.prepareSession({ actor: 'wp:42', sessionRow: sessionRow() });
  const pack = repo.upserts.find((entry) => entry.table === 'ivoc_context_packs').body.pack;
  assert.ok(pack.signals.some((signal) => signal.rule_id === 'AIS-R10'));
  assert.doesNotMatch(pack.actor_block, /session-a|session-b/u);
});

test('session contract pins the exact versioned Admin Analytics and InterviewBrain configuration', async () => {
  const repo = repository();
  const originalSingle = repo.single;
  repo.single = async (path) => path.startsWith('ivoc_admin_config_versions?')
    ? {
      version: 4,
      analytics_config_version: 'ivoc.analytics.v4',
      brain_pack_version: 'gpt-live-1:meridian',
      ais_rules_version: '2026-09-18.2',
      pressure_defaults: { default_follow_up_intensity: 2 },
    }
    : originalSingle(path);
  const service = createIvocApplicationIntelligence({ repository: repo, now: () => Date.parse(NOW) });
  await service.prepareSession({ actor: 'wp:42', sessionRow: sessionRow() });
  const contract = repo.upserts.find((entry) => entry.table === 'ivoc_session_contracts').body;
  assert.equal(contract.admin_config_version, 4);
  assert.equal(contract.analytics_config_version, 'ivoc.analytics.v4');
  assert.equal(contract.brain_pack_version, 'gpt-live-1:meridian');
  assert.equal(contract.ais_rules_version, '2026-09-18.2');
  assert.equal(contract.follow_up_intensity, 2);
});
