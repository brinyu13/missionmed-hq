export class NotificationGateway {
  constructor({ endpoint = '', token = '', mode = 'disabled' } = {}) {
    this.endpoint = endpoint;
    this.token = token;
    this.mode = mode;
  }

  assertConfigured() {
    let url;
    try { url = new URL(this.endpoint); } catch { /* handled below */ }
    if (this.mode !== 'configured' || !this.token || url?.protocol !== 'https:') {
      throw Object.assign(new Error('MissionAccounts notification transport is not configured'), { status: 503 });
    }
  }

  async send(notification) {
    this.assertConfigured();
    const response = await fetch(this.endpoint, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${this.token}`,
        'content-type': 'application/json',
        'idempotency-key': notification.idempotency_key,
      },
      body: JSON.stringify({
        student_id: notification.student_id,
        channel: notification.channel,
        audience: notification.audience,
        event_kind: notification.event_kind,
        payload: notification.payload,
      }),
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw Object.assign(new Error(body.message || `Notification transport returned HTTP ${response.status}`), { status: response.status });
    }
    const providerRef = String(body.id || body.provider_ref || '').trim();
    if (!providerRef) throw new Error('Notification transport returned no provider reference');
    return { providerRef };
  }
}
