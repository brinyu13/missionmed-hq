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

function resourceEntitlement(studentId, overrides = {}) {
  return {
    studentId,
    active: true,
    tier: 'tier3_360',
    lorEnabled: true,
    revoked: false,
    canaryEnabled: true,
    canaryConsented: true,
    producerStatus: 'WORDPRESS_RESOURCE_ADMISSION_V1_SIGNED_S2S',
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

test('database-owned case access selects faculty and mentor roles without trusting session role fields', async () => {
  for (const [actorRole, resourceStudentId] of [
    ['faculty', 'wp:456'],
    ['mentor', 'wp:789'],
  ]) {
    const calls = [];
    const resourceCalls = [];
    const adapter = createWordPressCurrentUserAdmission({
      s2sClient: { async admit() { return receipt(); } },
      actorResolver: {
        async resolve(input) {
          calls.push(input);
          return {
            schemaVersion: 'missionmed.lor.actor-case-access.v1',
            authoritySource: 'database_verified_case_access',
            actorRole,
            actorId: 'wp:123',
            resourceStudentId,
            caseId: 'case-role-1',
          };
        },
      },
      resourceEntitlementResolver: {
        signedS2s: true,
        async resolve(input) {
          resourceCalls.push(input);
          return resourceEntitlement(resourceStudentId);
        },
      },
      clock: () => new Date(NOW),
    });
    const projection = await adapter.resolve({
      subject: 'wp:123',
      // These fields are attacker-controlled noise and must never select the role.
      session: session({ user: { id: 'wp:123', role: 'admin', roles: ['administrator'] } }),
      request: { url: '/api/lor-studio/cases/case-role-1/faculty-private' },
    });
    assert.deepEqual(calls, [{ authenticatedSubject: 'wp:123', caseId: 'case-role-1' }]);
    assert.deepEqual(resourceCalls, [{
      authenticatedSubject: 'wp:123',
      actorRole,
      studentId: resourceStudentId,
    }]);
    assert.equal(projection.actorId, 'wp:123');
    assert.equal(projection.role, actorRole);
    assert.equal(projection.studentId, resourceStudentId);
    const context = adapter.consumeTrustedRequestContext(projection);
    assert.equal(context.authenticatedSubject, 'wp:123');
    assert.equal(context.actorRole, actorRole);
    assert.equal(context.clientAsserted, false);
    await runWithTrustedRequestContext(context, async () => {
      assert.deepEqual(
        { ...await adapter.getStudentEntitlement({ studentId: resourceStudentId }) },
        resourceEntitlement(resourceStudentId),
      );
    });
    assert.deepEqual(resourceCalls, [
      {
        authenticatedSubject: 'wp:123',
        actorRole,
        studentId: resourceStudentId,
      },
      {
        authenticatedSubject: 'wp:123',
        actorRole,
        studentId: resourceStudentId,
      },
    ]);
  }
});

test('faculty and mentor case access requires fresh signed resource-student entitlement', async () => {
  const actorResolver = {
    async resolve() {
      return {
        schemaVersion: 'missionmed.lor.actor-case-access.v1',
        authoritySource: 'database_verified_case_access',
        actorRole: 'faculty',
        actorId: 'wp:123',
        resourceStudentId: 'wp:456',
        caseId: 'case-role-1',
      };
    },
  };
  const request = {
    subject: 'wp:123',
    session: session(),
    request: { url: '/api/lor-studio/cases/case-role-1' },
  };

  const absent = createWordPressCurrentUserAdmission({
    s2sClient: { async admit() { return receipt(); } },
    actorResolver,
    clock: () => new Date(NOW),
  });
  await assert.rejects(absent.resolve(request), /RESOURCE_ENTITLEMENT_DENIED/u);

  for (const unsafe of [
    resourceEntitlement('wp:999'),
    resourceEntitlement('wp:456', { active: false }),
    resourceEntitlement('wp:456', { revoked: true }),
    resourceEntitlement('wp:456', { lorEnabled: false }),
    resourceEntitlement('wp:456', { producerStatus: 'browser_asserted' }),
    { ...resourceEntitlement('wp:456'), extra: true },
  ]) {
    const adapter = createWordPressCurrentUserAdmission({
      s2sClient: { async admit() { return receipt(); } },
      actorResolver,
      resourceEntitlementResolver: {
        signedS2s: true,
        async resolve() { return unsafe; },
      },
      clock: () => new Date(NOW),
    });
    await assert.rejects(adapter.resolve(request), /RESOURCE_ENTITLEMENT_DENIED/u);
  }
});

test('case access resolver is required to return one exact database-bound role result', async () => {
  const unsafeResults = [
    null,
    {
      schemaVersion: 'missionmed.lor.actor-case-access.v1',
      authoritySource: 'browser_asserted',
      actorRole: 'faculty',
      actorId: 'wp:123',
      resourceStudentId: 'wp:456',
      caseId: 'case-role-1',
    },
    {
      schemaVersion: 'missionmed.lor.actor-case-access.v1',
      authoritySource: 'database_verified_case_access',
      actorRole: 'admin',
      actorId: 'wp:123',
      resourceStudentId: 'wp:456',
      caseId: 'case-role-1',
    },
    {
      schemaVersion: 'missionmed.lor.actor-case-access.v1',
      authoritySource: 'database_verified_case_access',
      actorRole: 'faculty',
      actorId: 'wp:999',
      resourceStudentId: 'wp:456',
      caseId: 'case-role-1',
    },
    {
      schemaVersion: 'missionmed.lor.actor-case-access.v1',
      authoritySource: 'database_verified_case_access',
      actorRole: 'student',
      actorId: 'wp:123',
      resourceStudentId: 'wp:456',
      caseId: 'case-role-1',
    },
  ];
  for (const result of unsafeResults) {
    const adapter = createWordPressCurrentUserAdmission({
      s2sClient: { async admit() { return receipt(); } },
      actorResolver: { async resolve() { return result; } },
      clock: () => new Date(NOW),
    });
    await assert.rejects(
      adapter.resolve({
        subject: 'wp:123',
        session: session(),
        request: { url: '/api/lor-studio/cases/case-role-1' },
      }),
      (error) => error instanceof WordPressCurrentUserAdmissionError
        && error.code === 'CASE_ACCESS_DENIED',
    );
  }
});

test('non-case requests retain student admission and never ask the role resolver', async () => {
  let calls = 0;
  const adapter = createWordPressCurrentUserAdmission({
    s2sClient: { async admit() { return receipt(); } },
    actorResolver: { async resolve() { calls += 1; throw new Error('must not run'); } },
    clock: () => new Date(NOW),
  });
  const projection = await adapter.resolve({
    subject: 'wp:123',
    session: session(),
    request: { url: '/api/lor-studio/bootstrap' },
  });
  assert.equal(calls, 0);
  assert.equal(projection.role, 'student');
  assert.equal(adapter.consumeTrustedRequestContext(projection).actorRole, 'student');
});

test('exact invitation page and verification API paths create faculty-candidate context without case access', async () => {
  const observed = [];
  for (const url of [
    '/lor-studio/invitations/invitation-1',
    '/lor-studio/invitations/invitation-1/',
    '/api/lor-studio/invitations/invitation-1/bootstrap',
    '/api/lor-studio/invitations/invitation-1/verify',
  ]) {
    let resolverCalls = 0;
    const adapter = createWordPressCurrentUserAdmission({
      s2sClient: { async admit() { return receipt(); } },
      actorResolver: {
        async resolve() { resolverCalls += 1; throw new Error('case access must not run'); },
      },
      clock: () => new Date(NOW),
    });
    const projection = await adapter.resolve({
      subject: 'wp:123',
      session: session({ user: { id: 'wp:123', role: 'administrator' } }),
      request: { url },
    });
    assert.equal(resolverCalls, 0);
    assert.equal(projection.actorId, 'wp:123');
    assert.equal(projection.studentId, 'wp:123');
    assert.equal(projection.role, 'faculty');
    const context = adapter.consumeTrustedRequestContext(projection);
    assert.equal(context.authenticatedSubject, 'wp:123');
    assert.equal(context.actorRole, 'faculty');
    assert.equal(context.clientAsserted, false);
    observed.push(context.proofHash);
  }
  assert.equal(new Set(observed).size, 1, 'page and API bind the same invitation candidate proof');
});

test('faculty-candidate proof is invitation-bound and malformed invitation paths fail closed', async () => {
  async function contextFor(invitationId) {
    const adapter = admission();
    const projection = await adapter.resolve({
      subject: 'wp:123',
      session: session(),
      request: { url: `/api/lor-studio/invitations/${invitationId}/verify` },
    });
    return adapter.consumeTrustedRequestContext(projection);
  }
  const first = await contextFor('invitation-1');
  const second = await contextFor('invitation-2');
  assert.notEqual(first.proofHash, second.proofHash);
  for (const url of [
    '/api/lor-studio/invitations/%2F/verify',
    '/lor-studio/invitations/%00',
  ]) {
    const adapter = admission();
    await assert.rejects(
      adapter.resolve({ subject: 'wp:123', session: session(), request: { url } }),
      (error) => error instanceof WordPressCurrentUserAdmissionError
        && error.code === 'INVITATION_CANDIDATE_INVALID',
    );
  }
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
