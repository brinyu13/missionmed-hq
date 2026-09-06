export class SupabaseRestStore {
  constructor({ url, serviceKey, schema = 'missionaccounts' }) {
    if (!url || !serviceKey) throw new Error('MissionAccounts database is not configured');
    this.base = `${url.replace(/\/$/, '')}/rest/v1`;
    this.serviceKey = serviceKey;
    this.schema = schema;
  }

  async request(path, { method = 'GET', body, headers = {} } = {}) {
    const response = await fetch(`${this.base}/${path}`, {
      method,
      body: body === undefined ? undefined : JSON.stringify(body),
      headers: {
        apikey: this.serviceKey,
        authorization: `Bearer ${this.serviceKey}`,
        'accept-profile': this.schema,
        'content-profile': this.schema,
        'content-type': 'application/json',
        ...headers,
      },
    });
    const text = await response.text();
    const result = text ? JSON.parse(text) : null;
    if (!response.ok) throw Object.assign(new Error(result?.message || 'MissionAccounts database request failed'), { status: response.status, result });
    return result;
  }

  async studentByMatrixUser(userId) {
    const rows = await this.request(`student?matrix_user_ref=eq.${encodeURIComponent(userId)}&select=id,matrix_user_ref,display_name,email,joined_at,comp_days_allowance,identity_state&limit=1`);
    return rows[0] || null;
  }

  async attendanceForStudent(studentId, cycleKey) {
    const cycle = cycleKey ? `&cycle_key=eq.${encodeURIComponent(cycleKey)}` : '';
    return this.request(`attendance_day?student_id=eq.${encodeURIComponent(studentId)}${cycle}&superseded_at=is.null&select=id,cycle_key,day,kind,comp_index,same_day_multiple_events,engine_version&order=day.asc`);
  }

  async billingForStudent(studentId) {
    return this.request(`billing_decision?student_id=eq.${encodeURIComponent(studentId)}&superseded_by_id=is.null&select=id,cycle_key,treatment,amount_cents,basis,state,decided_at&order=created_at.desc`);
  }

  async paymentMethodForStudent(studentId) {
    const rows = await this.request(`payment_method?student_id=eq.${encodeURIComponent(studentId)}&select=id,brand,last4,exp_month,exp_year,status,verified_at&limit=1`);
    return rows[0] || null;
  }

  async adminHealth() {
    const [students, inbox, outbox, syncs] = await Promise.all([
      this.request('student?select=id&identity_state=eq.needs_review'),
      this.request('provider_event_inbox?select=id&state=eq.failed'),
      this.request('notification_outbox?select=id&state=eq.failed'),
      this.request('sync_run?select=state,started_at,finished_at,stats,error&order=started_at.desc&limit=1'),
    ]);
    return { review_students: students.length, failed_provider_events: inbox.length, failed_notifications: outbox.length, latest_zoom_sync: syncs[0] || null };
  }
}

export class PreviewStore {
  async studentByMatrixUser(userId) {
    return { id: userId, matrix_user_ref: userId, display_name: 'Preview Student', email: 'student.preview@invalid.local', joined_at: null, comp_days_allowance: 0, identity_state: 'verified' };
  }
  async attendanceForStudent() { return []; }
  async billingForStudent() { return []; }
  async paymentMethodForStudent() { return null; }
  async adminHealth() { return { mode: 'preview', review_students: null, failed_provider_events: null, failed_notifications: null, latest_zoom_sync: null }; }
}
