import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  getUsceAdminPublicIntakeAction,
  isUsceAdminPublicIntakeControlledTestPath,
  isUsceAdminPublicIntakeListPath,
} from '../routes/usce-public-intake.mjs';
import {
  isUsceAdminOfferPath,
  isUsceOfferPortalPublicPath,
} from '../routes/usce-offer-portal.mjs';
import { isUsceStudentStatusPath } from '../routes/usce-status-tracker.mjs';

const testsDir = path.dirname(fileURLToPath(import.meta.url));
const serverPath = path.resolve(testsDir, '..', 'server.mjs');

test('USCE path classifiers cover the live admin, offer, and student contracts', () => {
  assert.equal(isUsceAdminPublicIntakeListPath('/api/usce/admin/public-intake-requests'), true);
  assert.equal(isUsceAdminPublicIntakeControlledTestPath('/api/usce/admin/public-intake-requests/controlled-test'), true);
  assert.deepEqual(
    getUsceAdminPublicIntakeAction('/api/usce/admin/public-intake-requests/11111111-1111-4111-8111-111111111111/status'),
    { requestId: '11111111-1111-4111-8111-111111111111', action: 'status' },
  );
  assert.equal(isUsceAdminOfferPath('/api/usce/admin/intake-requests/11111111-1111-4111-8111-111111111111/offer-draft'), true);
  assert.equal(isUsceAdminOfferPath('/api/usce/admin/offers/11111111-1111-4111-8111-111111111111/message-preview'), true);
  assert.equal(isUsceOfferPortalPublicPath('/api/usce/offer/abcdefghijklmnopqrstuvwxyzABCDE1234567890_-'), true);
  assert.equal(isUsceStudentStatusPath('/api/usce/student/status'), true);
});

test('HQ server wires protected USCE routes and preserves the admin role gate', async () => {
  const source = await readFile(serverPath, 'utf8');

  assert.match(source, /isUsceAdminPublicIntakeListPath\(pathname\)/u);
  assert.match(source, /handleUsceAdminOfferRoute\(request, response, url, \{ session, authHeaders \}\)/u);
  assert.match(source, /handleUsceOfferPortalPublicRoute\(request, response, url\)/u);
  assert.match(source, /handleUsceStudentStatusRoute\(request, response, url/u);
  assert.match(source, /handleGmailSyncPreviewRoute\(request, response, url, \{ session, authHeaders \}\)/u);
  assert.match(source, /CONFIG\.authRequired && !isAuthorizedWordPressUser/u);
  assert.match(source, /error: 'hq_role_required'/u);
  assert.match(source, /csrf_validation_failed/u);
});
