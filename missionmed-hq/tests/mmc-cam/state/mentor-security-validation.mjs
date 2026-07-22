#!/usr/bin/env node

import crypto from 'node:crypto';

import { MMC_CAM_UI_SECURITY_HEADERS } from '../../../lib/mmc/trust/security.mjs';
import { PRIMARY_SUBJECT_ID } from '../browser/fixture-data.mjs';
import { withReviewServer } from '../browser/review-server.mjs';
import { assert, assertEqual, runChecks } from '../browser/review-test-kit.mjs';

await withReviewServer({ scenario: 'default' }, async (review) => {
  const sessionUrl = new URL('/api/auth/session', review.baseUrl);
  const bootstrap = await fetch(sessionUrl);
  const bootstrapPayload = await bootstrap.json();
  const csrfToken = bootstrapPayload.csrfToken;
  const command = {
    commandId: crypto.randomUUID(),
    idempotencyKey: `fixture-security-${crypto.randomUUID()}`,
    expectedVersion: 0,
    targetId: crypto.randomUUID(),
    kind: 'session.start',
    purpose: 'Validate isolated fixture command security',
    payload: {
      subjectLinkId: PRIMARY_SUBJECT_ID,
      objective: 'Validate exact-origin fixture command behavior.',
    },
    schemaVersion: 1,
  };

  await runChecks('MMC CAM 007 isolated fixture security', [
    ['document uses production-intent security headers', async () => {
      const response = await fetch(review.url('/mmc-private/today'));
      assertEqual(response.status, 200, 'CAM document did not load');
      for (const [name, value] of Object.entries(MMC_CAM_UI_SECURITY_HEADERS)) {
        assertEqual(response.headers.get(name), value, `Security header drift for ${name}`);
      }
      assertEqual(response.headers.get('pragma'), 'no-cache', 'Pragma no-cache is missing');
      assert(!response.headers.get('server'), 'Fixture server exposed an implementation Server header');
    }],
    ['session bootstrap is synthetic no-store and bounded', async () => {
      assertEqual(bootstrap.status, 200, 'Synthetic session bootstrap failed');
      assertEqual(bootstrap.headers.get('cache-control'), 'no-store, max-age=0', 'Session bootstrap may be cached');
      assertEqual(bootstrapPayload.authenticated, true, 'Synthetic session is not authenticated');
      assertEqual(csrfToken, 'fixture-csrf-token', 'Synthetic CSRF binding drifted');
      assertEqual(bootstrapPayload.accessToken, '', 'Fixture bootstrap exposed an access token');
      assertEqual(bootstrapPayload.user.email.endsWith('.invalid'), true, 'Fixture identity is not clearly synthetic');
    }],
    ['query endpoint returns exact envelope and no-store', async () => {
      const response = await fetch(new URL('/api/mmc/v2/mentor/today', review.baseUrl));
      const payload = await response.json();
      assertEqual(response.status, 200, 'Today fixture query failed');
      assertEqual(response.headers.get('cache-control'), 'no-store, max-age=0', 'Fixture query may be cached');
      assertEqual(Object.keys(payload).sort().join(','), 'data,meta', 'Fixture query envelope is not exact');
      assertEqual(Object.keys(payload.meta).sort().join(','), 'asOf,correlationId,environment,freshness,sections', 'Fixture query metadata is not exact');
      assertEqual(payload.data.kind, 'MENTOR_TODAY', 'Fixture query kind drifted');
    }],
    ['historical private client assets are denied', async () => {
      for (const pathname of [
        '/mmc-private/src/app.js',
        '/mmc-private/src/styles.css',
        '/mmc-private/src/mmc-data-adapters.js',
        '/mmc-private/src/mmc-ownership-layer.js',
      ]) {
        const response = await fetch(new URL(pathname, review.baseUrl));
        const payload = await response.json();
        assertEqual(response.status, 404, `Historical asset was not denied: ${pathname}`);
        assertEqual(Object.keys(payload).join(','), 'error', `Historical asset error was not a safe exact envelope: ${pathname}`);
        assert(!JSON.stringify(payload).includes('/Users/'), `Historical asset error leaked a path: ${pathname}`);
      }
    }],
    ['encoded traversal is denied without path disclosure', async () => {
      const response = await fetch(`${review.baseUrl}/mmc-private/src/cam/%2e%2e%2fapp.js`);
      const payload = await response.json();
      assertEqual(response.status, 400, 'Encoded traversal was not denied');
      assertEqual(payload.error.code, 'PATH_TRAVERSAL_FORBIDDEN', 'Traversal error code drifted');
      assert(!JSON.stringify(payload).includes('/Users/'), 'Traversal denial leaked an absolute path');
    }],
    ['command rejects missing exact origin', async () => {
      const response = await postCommand(review.baseUrl, command, csrfToken, null);
      const payload = await response.json();
      assertEqual(response.status, 403, 'Origin-less command was not rejected');
      assertEqual(payload.error.code, 'ORIGIN_FORBIDDEN', 'Origin denial code drifted');
    }],
    ['command rejects invalid CSRF', async () => {
      const response = await postCommand(review.baseUrl, command, 'wrong-token', review.baseUrl);
      const payload = await response.json();
      assertEqual(response.status, 403, 'Invalid CSRF command was not rejected');
      assertEqual(payload.error.code, 'CSRF_INVALID', 'CSRF denial code drifted');
    }],
    ['command returns raw exact typed result', async () => {
      const response = await postCommand(review.baseUrl, command, csrfToken, review.baseUrl);
      const payload = await response.json();
      assertEqual(response.status, 200, 'Valid fixture command failed');
      assertEqual(Object.keys(payload).sort().join(','), [
        'aggregateVersion', 'auditId', 'commandId', 'correlationId', 'objectResults',
        'ok', 'readback', 'replayed', 'status',
      ].sort().join(','), 'Command result shape is not exact');
      assertEqual(payload.status, 'COMMITTED', 'Command was not committed');
      assertEqual(payload.replayed, false, 'First command unexpectedly replayed');
      assertEqual(payload.readback.subjectLinkId, PRIMARY_SUBJECT_ID, 'Command readback changed subject');
    }],
    ['identical retry is idempotent and policy-safe', async () => {
      const response = await postCommand(review.baseUrl, command, csrfToken, review.baseUrl);
      const payload = await response.json();
      assertEqual(response.status, 200, 'Idempotent retry failed');
      assertEqual(payload.replayed, true, 'Identical retry was not marked replayed');
      assertEqual(payload.commandId, command.commandId, 'Replay command identity drifted');
    }],
    ['client authority fields are rejected', async () => {
      const unsafe = structuredClone(command);
      unsafe.commandId = crypto.randomUUID();
      unsafe.idempotencyKey = `fixture-authority-${crypto.randomUUID()}`;
      unsafe.targetId = crypto.randomUUID();
      unsafe.payload.role = 'admin';
      const response = await postCommand(review.baseUrl, unsafe, csrfToken, review.baseUrl);
      const payload = await response.json();
      assertEqual(response.status, 422, 'Client authority field was not rejected');
      assert(
        ['CLIENT_AUTHORITY_FIELD_FORBIDDEN', 'MENTOR_UNKNOWN_FIELD'].includes(payload.error.code),
        `Authority denial code drifted: ${payload.error.code}`,
      );
    }],
    ['oversized JSON and unsupported methods fail closed', async () => {
      const oversized = await fetch(new URL('/api/mmc/v2/mentor/commands', review.baseUrl), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Origin: review.baseUrl,
          'X-MMHQ-CSRF': csrfToken,
        },
        body: JSON.stringify({ text: 'x'.repeat(70_000) }),
      });
      assertEqual(oversized.status, 413, 'Oversized body was not rejected');
      const method = await fetch(new URL('/api/mmc/v2/mentor/today', review.baseUrl), { method: 'DELETE' });
      assertEqual(method.status, 405, 'Unsupported mentor API method was not rejected');
    }],
  ]);
});

function postCommand(baseUrl, command, csrfToken, origin) {
  const headers = {
    'Content-Type': 'application/json',
    'X-MMHQ-CSRF': csrfToken,
  };
  if (origin) headers.Origin = origin;
  return fetch(new URL('/api/mmc/v2/mentor/commands', baseUrl), {
    method: 'POST',
    headers,
    body: JSON.stringify(command),
  });
}
