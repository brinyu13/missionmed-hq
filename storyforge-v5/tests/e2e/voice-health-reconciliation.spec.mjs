import { test, expect } from '@playwright/test';
import pg from 'pg';

import { createAssemblyExecutorForEnvironment } from '../../server/app.mjs';

async function tokenFor(request, persona) {
  const response = await request.post(`/api/dev/session/${persona}`, { data: {} });
  expect(response.ok()).toBeTruthy();
  return (await response.json()).token;
}

function bearer(token) {
  return { Authorization: `Bearer ${token}` };
}

async function databaseOperation(operation) {
  const client = new pg.Client({ connectionString: process.env.STORYFORGE_DATABASE_URL });
  await client.connect();
  try {
    return await operation(client);
  } finally {
    await client.end();
  }
}

test('T3-16 admin E13 returns the bounded reconciliation report', async ({ request }) => {
  await databaseOperation((client) => client.query(
    `INSERT INTO public.sf_reconciliation_runs
       (mode, finished_at, pages_listed, keys_evaluated, candidates, preserved,
        deleted_confirmed, object_absent, retried, failed, replica_id)
     VALUES ('dry_run', now(), 1, 4, 2, 2, 0, 0, 0, 0, 'e2e-report')`,
  ));
  const admin = await tokenFor(request, 'admin');
  const response = await request.get('/api/admin/voice/health', {
    headers: bearer(admin),
  });
  expect(response.status()).toBe(200);
  const body = await response.json();
  expect(body.reconciliation[0]).toMatchObject({
    mode: 'dry_run',
    pagesListed: 1,
    keysEvaluated: 4,
    candidates: 2,
    preserved: 2,
    replicaId: 'e2e-report',
  });
});

test('T3-17 E13 admin gate rejects non-admin and unauthenticated access', async ({ request }) => {
  const admin = await tokenFor(request, 'admin');
  const student = await tokenFor(request, 'student');

  const adminResponse = await request.get('/api/admin/voice/health', {
    headers: bearer(admin),
  });
  expect(adminResponse.status()).toBe(200);
  expect(await adminResponse.json()).toHaveProperty('reconciliation');

  // Revocation makes any accidental report invocation fail. The expected 403
  // therefore proves the outer admin gate rejects the request before E13 reads
  // sf_reconciliation_report; a reached handler would degrade to HTTP 200/null.
  await databaseOperation((client) => client.query(
    'REVOKE EXECUTE ON FUNCTION public.sf_reconciliation_report(integer) FROM authenticated',
  ));
  try {
    const nonAdminResponse = await request.get('/api/admin/voice/health', {
      headers: bearer(student),
    });
    expect(nonAdminResponse.status()).toBe(403);
    const nonAdminBody = await nonAdminResponse.json();
    expect(nonAdminBody.error.code).toBe('admin_required');
    expect(nonAdminBody).not.toHaveProperty('reconciliation');
    expect(nonAdminBody).not.toHaveProperty('sessionsByState');
    expect(nonAdminBody).not.toHaveProperty('errorsByCategory');

    const unauthenticatedResponse = await request.get('/api/admin/voice/health');
    expect(unauthenticatedResponse.status()).toBe(401);
    const unauthenticatedBody = await unauthenticatedResponse.json();
    expect(unauthenticatedBody.error.code).toBe('auth_required');
    expect(unauthenticatedBody).not.toHaveProperty('reconciliation');
    expect(unauthenticatedBody).not.toHaveProperty('sessionsByState');
    expect(unauthenticatedBody).not.toHaveProperty('errorsByCategory');
  } finally {
    await databaseOperation((client) => client.query(
      'GRANT EXECUTE ON FUNCTION public.sf_reconciliation_report(integer) TO authenticated',
    ));
  }
});

test('T3-18 report failure degrades only reconciliation to null', async ({ request }) => {
  const admin = await tokenFor(request, 'admin');
  await databaseOperation((client) => client.query(
    'REVOKE EXECUTE ON FUNCTION public.sf_reconciliation_report(integer) FROM authenticated',
  ));
  try {
    const response = await request.get('/api/admin/voice/health', {
      headers: bearer(admin),
    });
    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body.reconciliation).toBeNull();
    expect(body).toHaveProperty('windowHours', 24);
    expect(body).toHaveProperty('sessionsByState');
    expect(body).toHaveProperty('errorsByCategory');
  } finally {
    await databaseOperation((client) => client.query(
      'GRANT EXECUTE ON FUNCTION public.sf_reconciliation_report(integer) TO authenticated',
    ));
  }
});

function executorFixture(value) {
  const storageCalls = [];
  const executor = createAssemblyExecutorForEnvironment({
    environment: value === undefined
      ? {}
      : { STORYFORGE_ASSEMBLY_EXECUTOR: value },
    serviceTransaction: async (operation) => operation({
      async query() {
        return {
          rows: [{
            seq: 0,
            mime_type: 'audio/webm',
            object_key: 'storyforge-rec/student/session/seg-00000.webm',
          }],
        };
      },
    }),
    storage: {
      async getRecordingSegment() {
        storageCalls.push('get');
        return Buffer.from('segment');
      },
      async headAudioObject() {
        storageCalls.push('head');
        return { byteSize: 7, metadata: { seq: '0' } };
      },
      async putRecordingSegment() {
        storageCalls.push('put');
      },
    },
  });
  return { executor, storageCalls };
}

test('T8-16 concat selects the ffmpeg assembly boundary', async () => {
  const { executor } = executorFixture('concat');
  expect(executor.available).toBe(true);
  expect(executor.option).toBe('A');
});

test('T8-17 copy selects the segment-copy assembly boundary', async () => {
  const { executor } = executorFixture('copy');
  expect(executor.available).toBe(true);
  expect(executor.option).toBe('B');
});

test('T8-18 absent executor fails closed with assembly_authority_blocked', async () => {
  const { executor } = executorFixture(undefined);
  expect(() => executor.assembleRecording({})).toThrow(
    expect.objectContaining({
      code: 'assembly_authority_blocked',
      status: 503,
    }),
  );
});

test('T8-19 invalid executor fails closed with assembly_authority_blocked', async () => {
  const { executor } = executorFixture('invalid');
  expect(() => executor.assembleRecording({})).toThrow(
    expect.objectContaining({
      code: 'assembly_authority_blocked',
      status: 503,
    }),
  );
});
