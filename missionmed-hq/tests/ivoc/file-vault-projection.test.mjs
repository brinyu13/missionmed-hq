import assert from 'node:assert/strict';
import test from 'node:test';

import { createFileVaultCvProjectionSource } from '../../ivoc/file-vault-projection.mjs';

const SESSION_ID = '00000000-0000-4000-8000-000000000042';
const AUTHORIZATION = `Bearer ${'a'.repeat(32)}`;

function projection(subject = 'wp:42') {
  return {
    projection_id: 'filevault-cv:document-42',
    owner_app: 'filevault',
    projection_type: 'filevault.document_projection',
    schema_version: '1',
    subject_id: subject,
    source_version: 'cv:document-42@version-3',
    produced_at: '2026-09-20T12:00:00.000Z',
    authorization: { basis: 'student_consent', scope: ['entries'], consent_ref: `ivoc-session:${SESSION_ID}` },
    minimization: { fields_included: ['entries'] },
    payload: {
      doc_id: 'document-42', kind: 'cv', version: '3', content_hash: 'b'.repeat(64), as_of: '2026-09-20',
      entries: [{ entry_id: 'leadership-1', entry_type: 'leadership_role', role: 'Team lead', extracted_by: 'owner_reviewed' }],
    },
    source_receipt: { owner_ref: 'filevault:document-42@version-3', hash: 'c'.repeat(64) },
    revocation: { revocable: true },
  };
}

test('reads the bounded current-CV projection through the authenticated owner route', async () => {
  const calls = [];
  const source = createFileVaultCvProjectionSource({
    wordPressBase: 'https://missionmed.example.test',
    fetchImpl: async (url, options) => {
      calls.push({ url: String(url), options });
      return new Response(JSON.stringify(projection()), { status: 200, headers: { 'Content-Type': 'application/json' } });
    },
  });
  const value = await source.read({ actor: 'wp:42', sessionId: SESSION_ID, authorization: AUTHORIZATION });
  assert.equal(value.subject_id, 'wp:42');
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, `https://missionmed.example.test/wp-json/mmed/v2/file-vault/projections/ivoc/cv/42?session_id=${SESSION_ID}`);
  assert.equal(calls[0].options.redirect, 'error');
  assert.equal(calls[0].options.headers.Authorization, AUTHORIZATION);
  assert.equal(calls[0].options.headers['X-MMED-Consumer'], 'ivoc');
});

test('returns null only for an owner-declared unavailable projection', async () => {
  const source = createFileVaultCvProjectionSource({
    wordPressBase: 'https://missionmed.example.test',
    fetchImpl: async () => new Response('{}', { status: 404 }),
  });
  assert.equal(await source.read({ actor: 'wp:42', sessionId: SESSION_ID, authorization: AUTHORIZATION }), null);
});

test('fails closed on missing auth, cross-subject data, oversized data, and upstream denial', async () => {
  let called = false;
  const noAuth = createFileVaultCvProjectionSource({
    wordPressBase: 'https://missionmed.example.test',
    fetchImpl: async () => { called = true; return new Response('{}'); },
  });
  await assert.rejects(() => noAuth.read({ actor: 'wp:42', sessionId: SESSION_ID }), /authorization_required/u);
  assert.equal(called, false);

  const crossSubject = createFileVaultCvProjectionSource({
    wordPressBase: 'https://missionmed.example.test',
    fetchImpl: async () => new Response(JSON.stringify(projection('wp:7'))),
  });
  await assert.rejects(
    () => crossSubject.read({ actor: 'wp:42', sessionId: SESSION_ID, authorization: AUTHORIZATION }),
    /projection_invalid/u,
  );

  const oversized = createFileVaultCvProjectionSource({
    wordPressBase: 'https://missionmed.example.test',
    fetchImpl: async () => new Response('{}', { headers: { 'Content-Length': String(65 * 1024) } }),
  });
  await assert.rejects(
    () => oversized.read({ actor: 'wp:42', sessionId: SESSION_ID, authorization: AUTHORIZATION }),
    /projection_too_large/u,
  );

  const denied = createFileVaultCvProjectionSource({
    wordPressBase: 'https://missionmed.example.test',
    fetchImpl: async () => new Response('{"error":"forbidden"}', { status: 403 }),
  });
  await assert.rejects(
    () => denied.read({ actor: 'wp:42', sessionId: SESSION_ID, authorization: AUTHORIZATION }),
    /upstream_403/u,
  );
});

