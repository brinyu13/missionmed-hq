import { transitionExamPlan as applyExamTransition } from '../domain/exam-engine.mjs';

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

  async rpc(name, body) {
    return this.request(`rpc/${name}`, { method: 'POST', body });
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

  async submitExamPlan({ studentId, step, examOn, actorId, actorRole, requestId }) {
    return this.rpc('api_submit_exam_plan', {
      p_student_id: studentId,
      p_step: step,
      p_exam_on: examOn,
      p_actor_id: actorId,
      p_actor_role: actorRole,
      p_request_id: requestId,
    });
  }

  async setCompAllowance({ studentId, allowance, joinedOn, reason, applyRetroactively, actorId, actorRole, requestId }) {
    return this.rpc('api_set_comp_allowance', {
      p_student_id: studentId,
      p_allowance: allowance,
      p_joined_on: joinedOn || null,
      p_reason: reason,
      p_apply_retroactively: applyRetroactively,
      p_actor_id: actorId,
      p_actor_role: actorRole,
      p_request_id: requestId,
    });
  }

  async transitionExamPlan({ planId, toState, result, note, today, actorId, actorRole, requestId }) {
    return this.rpc('api_transition_exam_plan', {
      p_plan_id: planId,
      p_to_state: toState,
      p_result: result || null,
      p_note: note || null,
      p_today: today,
      p_actor_id: actorId,
      p_actor_role: actorRole,
      p_request_id: requestId,
    });
  }

  async recordProviderEvent({ provider, eventId, providerObjectId, eventType, payload, signatureVerified }) {
    const rows = await this.request('provider_event_inbox?on_conflict=provider%2Cprovider_event_id', {
      method: 'POST',
      body: {
        provider,
        provider_event_id: eventId,
        provider_object_id: providerObjectId || null,
        event_type: eventType,
        payload,
        signature_verified: signatureVerified,
        state: 'received',
      },
      headers: { prefer: 'resolution=ignore-duplicates,return=representation' },
    });
    return { status: rows?.length ? 'received' : 'duplicate' };
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
  constructor() {
    this.providerEvents = new Set();
    this.examPlans = new Map();
    this.examMutations = new Map();
    this.compSettings = new Map();
    this.compMutations = new Map();
    this.examTransitions = new Map();
  }

  async studentByMatrixUser(userId) {
    return { id: userId, matrix_user_ref: userId, display_name: 'Preview Student', email: 'student.preview@invalid.local', joined_at: null, comp_days_allowance: 0, identity_state: 'verified' };
  }
  async attendanceForStudent() { return []; }
  async billingForStudent() { return []; }
  async paymentMethodForStudent() { return null; }
  async submitExamPlan({ studentId, step, examOn, actorId, requestId }) {
    const fingerprint = JSON.stringify({ studentId, step, examOn, actorId });
    const existing = this.examMutations.get(requestId);
    if (existing) {
      if (existing.fingerprint !== fingerprint) throw Object.assign(new Error('Idempotency key was already used for another mutation'), { status: 409 });
      return { ...existing.result, duplicate: true };
    }
    const prior = this.examPlans.get(studentId) || null;
    const ordinal = this.examMutations.size + 1;
    const plan = {
      id: `00000000-0000-4000-9000-${String(ordinal).padStart(12, '0')}`,
      student_id: studentId,
      step,
      exam_on: examOn,
      state: 'pending',
      submitted_by: actorId,
      supersedes_id: prior?.id || null,
    };
    const result = { plan, audit_event_id: `preview-audit-${ordinal}` };
    this.examPlans.set(studentId, plan);
    this.examMutations.set(requestId, { fingerprint, result });
    return result;
  }
  async setCompAllowance({ studentId, allowance, joinedOn, reason, applyRetroactively, actorId, requestId }) {
    const fingerprint = JSON.stringify({ studentId, allowance, joinedOn, reason, applyRetroactively, actorId });
    const existing = this.compMutations.get(requestId);
    if (existing) {
      if (existing.fingerprint !== fingerprint) throw Object.assign(new Error('Idempotency key was already used for another mutation'), { status: 409 });
      return { ...existing.result, duplicate: true };
    }
    const prior = this.compSettings.get(studentId) || { allowance: 0, joined_on: null };
    const student = {
      id: studentId,
      comp_days_allowance: allowance,
      joined_at: joinedOn || prior.joined_on,
    };
    const ordinal = this.compMutations.size + 1;
    const result = {
      student,
      change_id: `preview-comp-change-${ordinal}`,
      audit_event_id: `preview-comp-audit-${ordinal}`,
      released_days: applyRetroactively && allowance < prior.allowance ? prior.allowance - allowance : 0,
    };
    this.compSettings.set(studentId, { allowance, joined_on: student.joined_at });
    this.compMutations.set(requestId, { fingerprint, result });
    return result;
  }
  async transitionExamPlan({ planId, toState, result, note, today, actorId, requestId }) {
    const fingerprint = JSON.stringify({ planId, toState, result, note, today, actorId });
    const existing = this.examTransitions.get(requestId);
    if (existing) {
      if (existing.fingerprint !== fingerprint) throw Object.assign(new Error('Idempotency key was already used for another mutation'), { status: 409 });
      return { ...existing.result, duplicate: true };
    }
    const entry = [...this.examPlans.entries()].find(([, plan]) => plan.id === planId);
    if (!entry) throw Object.assign(new Error('Exam plan not found'), { status: 404 });
    const [studentId, plan] = entry;
    let resultPayload;
    try {
      const transition = applyExamTransition({ plan, to: toState, actor: actorId, today, result, note });
      this.examPlans.set(studentId, transition.plan);
      resultPayload = {
        accepted: true,
        plan: transition.plan,
        effects: transition.effects,
        audit_event_id: `preview-exam-audit-${this.examTransitions.size + 1}`,
      };
    } catch (error) {
      resultPayload = {
        accepted: false,
        plan,
        effects: null,
        reason: error.message,
        audit_event_id: `preview-exam-audit-${this.examTransitions.size + 1}`,
      };
    }
    this.examTransitions.set(requestId, { fingerprint, result: resultPayload });
    return resultPayload;
  }
  async recordProviderEvent({ provider, eventId }) {
    const key = `${provider}:${eventId}`;
    if (this.providerEvents.has(key)) return { status: 'duplicate' };
    this.providerEvents.add(key);
    return { status: 'received' };
  }
  async adminHealth() { return { mode: 'preview', review_students: null, failed_provider_events: null, failed_notifications: null, latest_zoom_sync: null }; }
}
