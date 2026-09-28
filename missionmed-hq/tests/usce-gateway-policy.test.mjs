import assert from 'node:assert/strict';
import test from 'node:test';
import { isUsceGatewayPath } from '../usce-gateway-policy.mjs';

test('USCE gateway admits only the narrow runtime contract', () => {
  for (const pathname of [
    '/health',
    '/api/health',
    '/api/auth/session',
    '/api/auth/logout',
    '/api/integrations/gmail/sync-preview',
    '/api/usce/health',
    '/api/usce/student/status',
    '/api/usce/admin/public-intake-requests',
    '/api/usce/admin/offers/11111111-1111-4111-8111-111111111111',
    '/api/usce/public/config',
    '/api/usce/offer/example-token',
  ]) {
    assert.equal(isUsceGatewayPath(pathname), true, pathname);
  }
});

test('USCE gateway denies unrelated MissionMed and privileged integration paths', () => {
  for (const pathname of [
    '/',
    '/hq',
    '/health/lor-studio',
    '/lor-studio/',
    '/api/auth/start',
    '/api/auth/bootstrap',
    '/api/bridge/health',
    '/api/integrations/gmail/metadata-proof',
    '/api/integrations/gmail/comms-review-write',
    '/api/usce/cron/process',
    '/api/usce/webhook/stripe',
    '/api/usce/analytics/summary',
    '/api/ivoc/v1',
    '/api/ivprep-v6',
    '/api/payments',
  ]) {
    assert.equal(isUsceGatewayPath(pathname), false, pathname);
  }
});

