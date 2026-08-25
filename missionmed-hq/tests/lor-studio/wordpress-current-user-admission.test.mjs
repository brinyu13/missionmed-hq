import assert from 'node:assert/strict';
import test from 'node:test';

import {
  WORDPRESS_LOR_ADMISSION_CONTRACT,
  WORDPRESS_LOR_ADMISSION_PATH,
  WORDPRESS_LOR_BINDING_PROVENANCE,
  WordPressCurrentUserAdmissionError,
  createWordPressCurrentUserAdmission,
} from '../../lor-studio/adapters/wordpress-current-user-admission.mjs';
import { runWithTrustedRequestContext } from '../../lor-studio/security/trusted-request-context.mjs';

const NOW = Date.parse('2026-08-25T16:00:00.000Z');
const BINDING = `lorb1_${'a'.repeat(43)}`;

function receipt(overrides = {}) {
  return {
    contract: WORDPRESS_LOR_ADMISSION_CONTRACT,
    subject: 'wp:123',
    admitted: true,
    evaluatedAt: '2026-08-25T15:59:30.000Z',
    expiresAt: '2026-08-25T16:03:30.000Z',
    ...overrides,
  };
}

function session(overrides = {}) {
  return {
    user: { id: 'wp:123', role: 'student', roles: ['student'] },
    lorAdmissionBindingId: BINDING,
    lorAdmissionBindingProvenance: WORDPRESS_LOR_BINDING_PROVENANCE,
    lorAdmissionBindingExpiresAt: '2026-08-25T20:00:00.000Z',
    ...overrides,
  };
}

function admission(client = { async admit() { return receipt(); } }) {
  return createWordPressCurrentUserAdmission({
    s2sClient: client,
    clock: () => new Date(NOW),
  });
}

async function resolvesToContext(overrides = {}) {
  const adapter = admission({ async admit() { return receipt(overrides.receipt); } });
  const projection = await adapter.resolve({
    subject: 'wp:123',
    session: session(overrides.session),
  });
  return { adapter, projection, context: adapter.consumeTrustedRequestContext(projection) };
}

test('uses a non-secret binding for one fresh signed-client admission and never returns it', async () => {
  let observed;
  const adapter = admission({
    async admit(input) {
      observed = input;
      return receipt();
    },
  });
  const projection = await adapter.resolve({ subject: 'wp:123', session: session() });
  assert.deepEqual(observed, { bindingId: BINDING, subject: 'wp:123' });
  assert.equal(JSON.stringify(projection).includes(BINDING), false);
  const context = adapter.consumeTrustedRequestContext(projection);
  assert.equal(JSON.stringify(context).includes(BINDING), false);
  assert.equal(context.authenticatedSubject, 'wp:123');
  assert.equal(context.actorRole, 'student');
  assert.match(context.sourceReferenceHash, /^[a-f0-9]{64}$/u);
  assert.match(context.proofHash, /^[a-f0-9]{64}$/u);
  assert.equal(context.clientAsserted, false);
});

test('stable database identity proof excludes ephemeral binding and receipt time', async () => {
  const first = await resolvesToContext();
  const second = await resolvesToContext({
    receipt: {
      evaluatedAt: '2026-08-25T15:59:45.000Z',
      expiresAt: '2026-08-25T16:04:00.000Z',
    },
    session: { lorAdmissionBindingId: `lorb1_${'b'.repeat(43)}` },
  });
  assert.equal(first.context.sourceReferenceHash, second.context.sourceReferenceHash);
  assert.equal(first.context.proofHash, second.context.proofHash);
});

test('trusted context is single-use and cannot be forged', async () => {
  const adapter = admission();
  const projection = await adapter.resolve({ subject: 'wp:123', session: session() });
  adapter.consumeTrustedRequestContext(projection);
  assert.throws(
    () => adapter.consumeTrustedRequestContext(projection),
    /TRUSTED_CONTEXT_UNAVAILABLE/u,
  );
  assert.throws(
    () => adapter.consumeTrustedRequestContext({ ...projection }),
    /TRUSTED_CONTEXT_UNAVAILABLE/u,
  );
});

test('case-service entitlement remains request-context bound and subject exact', async () => {
  const { adapter, context } = await resolvesToContext();
  await assert.rejects(adapter.getStudentEntitlement({ studentId: 'wp:123' }), /TRUSTED_CONTEXT_UNAVAILABLE/u);
  await runWithTrustedRequestContext(context, async () => {
    assert.deepEqual(await adapter.getStudentEntitlement({ studentId: 'wp:123' }), {
      studentId: 'wp:123',
      active: true,
      tier: 'tier3_360',
      lorEnabled: true,
      revoked: false,
      canaryEnabled: true,
      canaryConsented: true,
      producerStatus: 'WORDPRESS_ADMISSION_V2_SIGNED_S2S',
    });
    await assert.rejects(
      adapter.getStudentEntitlement({ studentId: 'wp:456' }),
      /ENTITLEMENT_SUBJECT_MISMATCH/u,
    );
  });
});

test('rejects noncanonical/cross-subject sessions before the client call', async () => {
  let calls = 0;
  const adapter = admission({ async admit() { calls += 1; return receipt(); } });
  for (const input of [
    { subject: '123', session: session() },
    { subject: 'wp:123', session: session({ user: { id: 'wp:456', role: 'student' } }) },
    { subject: 'wp:123', session: session({ user: { id: 'student-123', role: 'student' } }) },
  ]) {
    await assert.rejects(adapter.resolve(input), WordPressCurrentUserAdmissionError);
  }
  assert.equal(calls, 0);
});

test('requires exact binding shape, provenance, and unexpired server session', async () => {
  const adapter = admission();
  for (const overrides of [
    { lorAdmissionBindingId: '' },
    { lorAdmissionBindingId: `lorb1_${'x'.repeat(42)}` },
    { lorAdmissionBindingProvenance: 'browser_assertion' },
    { lorAdmissionBindingExpiresAt: '2026-08-25T16:00:00.000Z' },
    { lorAdmissionBindingExpiresAt: 'not-an-instant' },
  ]) {
    await assert.rejects(
      adapter.resolve({ subject: 'wp:123', session: session(overrides) }),
      (error) => error instanceof WordPressCurrentUserAdmissionError
        && error.code === 'BINDING_UNAVAILABLE'
        && !error.message.includes(BINDING),
    );
  }
});

test('maps transport/provider details to one safe admission denial', async () => {
  const secretText = 'provider detail containing credential-like material';
  const adapter = admission({ async admit() { throw new Error(secretText); } });
  await assert.rejects(
    adapter.resolve({ subject: 'wp:123', session: session() }),
    (error) => error instanceof WordPressCurrentUserAdmissionError
      && error.code === 'ADMISSION_DENIED'
      && !error.message.includes(secretText),
  );
});

test('rejects malformed client receipts even if the client is replaced', async () => {
  for (const candidate of [
    null,
    { ...receipt(), subject: 'wp:456' },
    { ...receipt(), admitted: false },
    { ...receipt(), contract: 'missionmed.lor.wordpress-admission.v1' },
  ]) {
    const adapter = admission({ async admit() { return candidate; } });
    await assert.rejects(
      adapter.resolve({ subject: 'wp:123', session: session() }),
      /ADMISSION_DENIED/u,
    );
  }
});

test('contract is signed POST and never a reusable browser grant', () => {
  assert.equal(WORDPRESS_LOR_ADMISSION_PATH, '/wp-json/missionmed/v1/lor-studio/current-user-admission');
  const source = String(createWordPressCurrentUserAdmission);
  assert.doesNotMatch(source, /lorAdmissionGrant|X-MissionMed-LOR-Admission/u);
});
