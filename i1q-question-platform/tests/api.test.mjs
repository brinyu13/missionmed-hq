import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { createQuestionPlatformServer } from '../src/server.mjs';

async function withServer(options, operation) {
  const server = createQuestionPlatformServer(options);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  try {
    await operation(`http://127.0.0.1:${address.port}`);
  } finally {
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
}

test('health is public but reports auth adapter requirement', async () => {
  await withServer({ localDemo: false }, async (baseUrl) => {
    const health = await fetch(`${baseUrl}/api/health`);
    assert.equal(health.status, 200);
    assert.equal((await health.json()).mode, 'AUTH_ADAPTER_REQUIRED');
    const dashboard = await fetch(`${baseUrl}/api/v1/dashboard`);
    assert.equal(dashboard.status, 401);
    assert.equal((await dashboard.json()).error, 'production_identity_adapter_required');
  });
});

test('localhost demo serves synthetic dashboard with security headers', async () => {
  await withServer({ localDemo: true }, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/v1/dashboard`);
    assert.equal(response.status, 200);
    assert.match(response.headers.get('content-security-policy'), /frame-ancestors 'none'/);
    assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
    const payload = await response.json();
    assert.equal(payload.inventory_sources, 1);
    assert.equal(payload.production_gate, 'BLOCKED_EXTERNAL_AUTH_AND_GOVERNANCE');
  });
});

test('resource pagination is bounded and unknown resources fail closed', async () => {
  await withServer({ localDemo: true }, async (baseUrl) => {
    const page = await fetch(`${baseUrl}/api/v1/resources/inventory_sources?limit=9999`);
    assert.equal(page.status, 200);
    assert.equal((await page.json()).rows.length, 1);
    const unknown = await fetch(`${baseUrl}/api/v1/resources/not_a_resource`);
    assert.equal(unknown.status, 404);
  });
});

test('malformed JSON and traversal attempts fail without details', async () => {
  await withServer({ localDemo: true }, async (baseUrl) => {
    const malformed = await fetch(`${baseUrl}/api/v1/resources/concepts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{bad',
    });
    assert.equal(malformed.status, 400);
    assert.equal((await malformed.json()).error, 'invalid_json');
    const traversal = await fetch(`${baseUrl}/..%2F..%2Fetc%2Fpasswd`);
    assert.equal(traversal.status, 404);
  });
});

test('generic resource API cannot forge workflow-owned records', async () => {
  await withServer({ localDemo: true }, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/v1/resources/review_events`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ verdict: 'pass', to_status: 'approved' }),
    });
    assert.equal(response.status, 422);
    assert.match((await response.json()).error, /workflow_endpoint_required/);
  });
});

test('governance and feature flags use explicit administrator workflows', async () => {
  await withServer({ localDemo: true }, async (baseUrl) => {
    const governance = await fetch(`${baseUrl}/api/v1/governance/editorial_lead`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reviewer_id: 'reviewer_local_demo' }),
    });
    assert.equal(governance.status, 200);
    assert.equal((await governance.json()).editorial_lead, 'reviewer_local_demo');

    const flag = await fetch(`${baseUrl}/api/v1/feature-flags/internal_platform_enabled`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled: false, scope: { audience: 'none' } }),
    });
    assert.equal(flag.status, 200);
    const flagPayload = await flag.json();
    assert.equal(flagPayload.enabled, false);
    assert.equal(flagPayload.key, 'internal_platform_enabled');
  });
});

test('draft candidate submission uses the explicit lifecycle route', async () => {
  await withServer({ localDemo: true }, async (baseUrl) => {
    const revisionsResponse = await fetch(`${baseUrl}/api/v1/resources/item_revisions?limit=200`);
    assert.equal(revisionsResponse.status, 200);
    const revisions = await revisionsResponse.json();
    assert.equal(revisions.rows.length, 1);
    assert.equal(revisions.rows[0].workflow_status, 'draft');

    const submitted = await fetch(`${baseUrl}/api/v1/item-revisions/${encodeURIComponent(revisions.rows[0].id)}/submit-candidate`, {
      method: 'POST',
    });
    assert.equal(submitted.status, 200);
    assert.equal((await submitted.json()).workflow_status, 'candidate');

    const duplicate = await fetch(`${baseUrl}/api/v1/item-revisions/${encodeURIComponent(revisions.rows[0].id)}/submit-candidate`, {
      method: 'POST',
    });
    assert.equal(duplicate.status, 422);
    assert.equal((await duplicate.json()).error, 'request_rejected');
  });
});

test('OpenAPI path and feature-flag contracts match the live HTTP surface', async () => {
  const openapi = JSON.parse(await readFile(new URL('../openapi.json', import.meta.url), 'utf8'));
  assert.deepEqual(Object.keys(openapi.paths).sort(), [
    '/api/health',
    '/api/v1/dashboard',
    '/api/v1/feature-flags/{key}',
    '/api/v1/governance',
    '/api/v1/governance/{slot}',
    '/api/v1/item-revisions',
    '/api/v1/item-revisions/{itemRevisionId}/draft',
    '/api/v1/item-revisions/{itemRevisionId}/submit-candidate',
    '/api/v1/releases',
    '/api/v1/releases/{releaseId}/artifacts/{channel}',
    '/api/v1/releases/{releaseId}/promotions',
    '/api/v1/releases/{releaseId}/validations',
    '/api/v1/resources/{entityType}',
    '/api/v1/resources/{entityType}/{id}',
    '/api/v1/review-assignments',
    '/api/v1/review-assignments/{assignmentId}/accept',
    '/api/v1/review-events',
    '/api/v1/reviewers',
    '/api/v1/session',
  ].sort());
  assert.deepEqual(new Set(openapi.paths['/api/v1/feature-flags/{key}'].put.parameters[0].schema.enum), new Set([
    'internal_platform_enabled',
    'internal_review_enabled',
    'student_content_enabled',
    'student_release_enabled',
    'stat_adapter_enabled',
    'drills_adapter_enabled',
  ]));
  const artifactParameters = openapi.paths['/api/v1/releases/{releaseId}/artifacts/{channel}'].get.parameters;
  assert.equal(artifactParameters.some((parameter) => parameter.name === 'phase'), false);
});
