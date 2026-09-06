import test from 'node:test';
import assert from 'node:assert/strict';
import { NotificationGateway } from '../src/notifications/notification-gateway.mjs';

test('notification transport is disabled until an HTTPS endpoint and token are explicitly configured', async () => {
  const disabled = new NotificationGateway();
  await assert.rejects(() => disabled.send({}), /not configured/);
  const insecure = new NotificationGateway({ mode: 'configured', endpoint: 'http://example.invalid/messages', token: 'secret' });
  await assert.rejects(() => insecure.send({}), /not configured/);
});

test('notification transport forwards an idempotency key and returns only its provider reference', async () => {
  const originalFetch = globalThis.fetch;
  let captured;
  globalThis.fetch = async (url, options) => {
    captured = { url, options };
    return { ok: true, json: async () => ({ id: 'message-provider-1' }) };
  };
  try {
    const gateway = new NotificationGateway({
      mode: 'configured',
      endpoint: 'https://notifications.missionmed.example/v1/messages',
      token: 'provider-secret',
    });
    const result = await gateway.send({
      student_id: 'student-1',
      channel: 'matrix',
      event_kind: 'exam_plan.approved',
      payload: { exam_plan_id: 'plan-1' },
      idempotency_key: 'notification-1',
    });
    assert.deepEqual(result, { providerRef: 'message-provider-1' });
    assert.equal(captured.url, 'https://notifications.missionmed.example/v1/messages');
    assert.equal(captured.options.headers['idempotency-key'], 'notification-1');
    assert.equal(captured.options.headers.authorization, 'Bearer provider-secret');
    assert.equal(JSON.parse(captured.options.body).event_kind, 'exam_plan.approved');
  } finally {
    globalThis.fetch = originalFetch;
  }
});
