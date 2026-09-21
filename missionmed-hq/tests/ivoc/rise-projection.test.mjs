import assert from 'node:assert/strict';
import test from 'node:test';

import { createRiseProgramProjectionSource } from '../../ivoc/rise-projection.mjs';

const SESSION_ID = '00000000-0000-4000-8000-000000000042';
const PROGRAM_ID = 'rise_ps_169f5a95-4ddb-5e5f-b733-a265615c5cc0';
const RELEASE_ID = 'rise_registry_20260920_0123456789ab';

function projection(overrides = {}) {
  return {
    projection_id: `rise-program:wp:42:${PROGRAM_ID}`,
    owner_app: 'rise', projection_type: 'rise.program_cheat_sheet', schema_version: '1', subject_id: 'wp:42',
    source_version: 'rise-ivoc-test', produced_at: '2026-09-20T12:00:00.000Z',
    authorization: { basis: 'owner_policy', consent_ref: `ivoc-session:${SESSION_ID}`, scope: ['program_identity'] },
    minimization: {
      fields_included: ['program_id', 'name', 'high_yield_facts', 'people'],
      fields_excluded_reason: { people_names: 'not required by the initial IVOC Actor projection' },
    },
    payload: {
      program_id: PROGRAM_ID, name: 'Example Internal Medicine Residency', specialty: 'Internal Medicine',
      high_yield_facts: [{ fact: 'Curriculum: Resident-led quality improvement', source_ref: 'https://rise.test/source' }],
      people: [{ role: 'Program Director', source_ref: 'rise:program:leadership' }],
    },
    source_receipt: { owner_ref: 'rise:test', hash: 'a'.repeat(64) },
    revocation: { revocable: true },
    ...overrides,
  };
}

test('forwards only the bounded HQ session cookie and validates the minimized RISE projection', async () => {
  const calls = [];
  const source = createRiseProgramProjectionSource({
    riseBase: 'https://rise.test',
    fetchImpl: async (url, init) => {
      calls.push({ url: String(url), init });
      return new Response(JSON.stringify(projection()), { status: 200 });
    },
  });
  const result = await source.read({
    actor: 'wp:42', sessionId: SESSION_ID, sessionCookie: `mmhq_session=${'s'.repeat(32)}`,
    programId: PROGRAM_ID, registryReleaseId: RELEASE_ID,
  });
  assert.equal(result.projection_type, 'rise.program_cheat_sheet');
  assert.match(calls[0].url, new RegExp(`${PROGRAM_ID}\\?session_id=${SESSION_ID}.*release_id=${RELEASE_ID}`, 'u'));
  assert.equal(calls[0].init.headers.Cookie, `mmhq_session=${'s'.repeat(32)}`);
  assert.equal(calls[0].init.headers['X-MMED-Consumer'], 'ivoc');
  assert.equal(calls[0].init.headers.Authorization, undefined);
});

test('rejects missing authorization, wrong subjects, named people fields, and oversized responses', async () => {
  const common = { actor: 'wp:42', sessionId: SESSION_ID, programId: PROGRAM_ID, registryReleaseId: RELEASE_ID };
  const noCookie = createRiseProgramProjectionSource({ riseBase: 'https://rise.test', fetchImpl: async () => new Response('{}') });
  await assert.rejects(() => noCookie.read(common), /authorization_required/u);

  const wrongSubject = createRiseProgramProjectionSource({
    riseBase: 'https://rise.test',
    fetchImpl: async () => new Response(JSON.stringify(projection({ subject_id: 'wp:43' }))),
  });
  await assert.rejects(() => wrongSubject.read({ ...common, sessionCookie: `mmhq_session=${'s'.repeat(32)}` }), /projection_invalid/u);

  const namedPerson = projection();
  namedPerson.payload.people = [{ role: 'Program Director', name: 'Private Name', source_ref: 'rise:test' }];
  const names = createRiseProgramProjectionSource({ riseBase: 'https://rise.test', fetchImpl: async () => new Response(JSON.stringify(namedPerson)) });
  await assert.rejects(() => names.read({ ...common, sessionCookie: `mmhq_session=${'s'.repeat(32)}` }), /projection_invalid/u);

  const oversized = createRiseProgramProjectionSource({
    riseBase: 'https://rise.test',
    fetchImpl: async () => new Response('x', { headers: { 'content-length': String(70 * 1024) } }),
  });
  await assert.rejects(() => oversized.read({ ...common, sessionCookie: `mmhq_session=${'s'.repeat(32)}` }), /too_large/u);
});
