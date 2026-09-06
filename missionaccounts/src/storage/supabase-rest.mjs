import { transitionExamPlan as applyExamTransition } from '../domain/exam-engine.mjs';
import { buildDecisionBasis, calculateCycleAmount } from '../domain/billing-engine.mjs';

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

  async billingConsentForStudent(studentId) {
    const rows = await this.request(`billing_consent?student_id=eq.${encodeURIComponent(studentId)}&superseded_by_id=is.null&select=id,terms_version,accepted_at,revoked_at,state,created_at&limit=1`);
    return rows[0] || null;
  }

  async currentBillingTerms() {
    const rows = await this.request('billing_terms?status=eq.approved&select=version,summary,body_sha256,status&order=approved_at.desc&limit=1');
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

  async approveBillingDecision({ studentId, cycleKey, treatment, requestedAmountCents, note, actorId, actorRole, requestId }) {
    return this.rpc('api_approve_billing_decision', {
      p_student_id: studentId,
      p_cycle_key: cycleKey,
      p_treatment: treatment,
      p_requested_amount_cents: requestedAmountCents ?? null,
      p_note: note || null,
      p_actor_id: actorId,
      p_actor_role: actorRole,
      p_request_id: requestId,
    });
  }

  async appendAttendanceCorrection({ studentId, sessionId, attendanceEventId, type, fromVal, toVal, reason, revertsId, actorId, actorRole, requestId }) {
    return this.rpc('api_append_attendance_correction', {
      p_student_id: studentId,
      p_session_id: sessionId || null,
      p_attendance_event_id: attendanceEventId || null,
      p_type: type,
      p_from_val: fromVal ?? null,
      p_to_val: toVal ?? null,
      p_reason: reason,
      p_reverts_id: revertsId || null,
      p_actor_id: actorId,
      p_actor_role: actorRole,
      p_request_id: requestId,
    });
  }

  async setBillingConsent({ studentId, action, termsVersion, acceptedIp, reason, actorId, actorRole, requestId }) {
    return this.rpc('api_set_billing_consent', {
      p_student_id: studentId,
      p_action: action,
      p_terms_version: termsVersion || null,
      p_accepted_ip: acceptedIp || null,
      p_reason: reason || null,
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
    this.attendanceDays = new Map();
    this.billingCaps = new Map();
    this.billingDecisions = new Map();
    this.billingMutations = new Map();
    this.attendanceEvents = new Map();
    this.attendanceCorrections = [];
    this.correctionMutations = new Map();
    this.paymentMethods = new Map();
    this.billingTerms = new Map();
    this.billingConsents = new Map();
    this.consentMutations = new Map();
  }

  async studentByMatrixUser(userId) {
    return { id: userId, matrix_user_ref: userId, display_name: 'Preview Student', email: 'student.preview@invalid.local', joined_at: null, comp_days_allowance: 0, identity_state: 'verified' };
  }
  async attendanceForStudent() { return []; }
  async billingForStudent() { return []; }
  async paymentMethodForStudent(studentId) { return this.paymentMethods.get(studentId) || null; }
  async billingConsentForStudent(studentId) { return this.billingConsents.get(studentId) || null; }
  async currentBillingTerms() {
    const approved = [...this.billingTerms.values()].filter(terms => terms.status === 'approved');
    return approved.at(-1) || null;
  }
  seedPaymentMethod(studentId, paymentMethod) {
    this.paymentMethods.set(studentId, {
      id: paymentMethod.id || `preview-payment-method-${this.paymentMethods.size + 1}`,
      brand: paymentMethod.brand || null,
      last4: paymentMethod.last4 || null,
      exp_month: paymentMethod.exp_month || null,
      exp_year: paymentMethod.exp_year || null,
      status: paymentMethod.status || 'on_file',
      verified_at: paymentMethod.verified_at || null,
    });
  }
  seedBillingTerms(version, terms = {}) {
    this.billingTerms.set(version, {
      version,
      summary: terms.summary || 'Preview-only automatic billing terms',
      body_sha256: terms.body_sha256 || 'c'.repeat(64),
      status: terms.status || 'approved',
    });
  }
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
  seedAttendanceDays(studentId, cycleKey, days) {
    this.attendanceDays.set(`${studentId}:${cycleKey}`, days.map(day => ({ ...day })));
  }
  seedBillingCap(studentId, cycleKey, cap) {
    this.billingCaps.set(`${studentId}:${cycleKey}`, { ...cap });
  }
  async approveBillingDecision({ studentId, cycleKey, treatment, requestedAmountCents, note, actorId, requestId }) {
    const fingerprint = JSON.stringify({ studentId, cycleKey, treatment, requestedAmountCents, note, actorId });
    const existing = this.billingMutations.get(requestId);
    if (existing) {
      if (existing.fingerprint !== fingerprint) throw Object.assign(new Error('Idempotency key was already used for another mutation'), { status: 409 });
      return { ...existing.result, duplicate: true };
    }
    const days = this.attendanceDays.get(`${studentId}:${cycleKey}`) || [];
    const cap = this.billingCaps.get(`${studentId}:${cycleKey}`) || null;
    const rawAmount = days.filter(day => day.kind === 'billable').length * 2_500;
    let rejection = null;
    if (days.some(day => day.kind === 'needs_review')) rejection = 'attendance_requires_review';
    else if (treatment === 'fullcycle' && cap?.verified !== true) rejection = 'verified_full_cycle_ceiling_required';
    else if (cap?.status === 'candidate' && rawAmount > 30_000) rejection = 'cap_candidate_requires_review';
    if (rejection) {
      const result = { accepted: false, reason: rejection, audit_event_id: `preview-billing-audit-${this.billingMutations.size + 1}` };
      this.billingMutations.set(requestId, { fingerprint, result });
      return result;
    }
    const zeroTreatments = new Set(['ucc', 'mul', 'waived', 'prepaid', 'already_paid', 'already_invoiced']);
    const calculated = calculateCycleAmount({
      days,
      treatment: zeroTreatments.has(treatment) ? treatment : null,
      historicalArrangement: cap?.verified === true ? { verified: true, type: 'full_cycle_300' } : null,
    });
    let amountCents = ['other', 'special'].includes(treatment) ? requestedAmountCents : calculated.amount_cents;
    if (cap?.verified === true) amountCents = Math.min(amountCents, Number(cap.ceiling_cents || 30_000));
    const basis = buildDecisionBasis(days, { treatment, amount_cents: amountCents, cap });
    const ordinal = this.billingMutations.size + 1;
    const decision = {
      id: `preview-billing-decision-${ordinal}`,
      student_id: studentId,
      cycle_key: cycleKey,
      treatment,
      amount_cents: amountCents,
      note: note || null,
      basis,
      basis_sha256: basis.basis_sha256,
      state: 'approved',
      decided_by: actorId,
    };
    const invoice = amountCents > 0 ? { id: `preview-invoice-${ordinal}`, decision_id: decision.id, state: 'draft', amount_cents: amountCents } : null;
    const result = { accepted: true, decision, invoice, audit_event_id: `preview-billing-audit-${ordinal}` };
    this.billingDecisions.set(`${studentId}:${cycleKey}`, decision);
    this.billingMutations.set(requestId, { fingerprint, result });
    return result;
  }
  seedAttendanceEvent(event) {
    this.attendanceEvents.set(event.id, { ...event });
  }
  async appendAttendanceCorrection({ studentId, sessionId, attendanceEventId, type, fromVal, toVal, reason, revertsId, actorId, requestId }) {
    const fingerprint = JSON.stringify({ studentId, sessionId, attendanceEventId, type, fromVal, toVal, reason, revertsId, actorId });
    const existing = this.correctionMutations.get(requestId);
    if (existing) {
      if (existing.fingerprint !== fingerprint) throw Object.assign(new Error('Idempotency key was already used for another mutation'), { status: 409 });
      return { ...existing.result, duplicate: true };
    }
    let event = attendanceEventId ? this.attendanceEvents.get(attendanceEventId) : [...this.attendanceEvents.values()].find(item => item.student_id === studentId && item.session_id === sessionId);
    if (event && event.student_id !== studentId) throw Object.assign(new Error('Attendance event not found'), { status: 404 });
    if (type === 'add' && !event) {
      const ordinal = this.attendanceEvents.size + 1;
      event = {
        id: `10000000-0000-4000-9000-${String(ordinal).padStart(12, '0')}`,
        student_id: studentId,
        session_id: sessionId,
      };
      this.attendanceEvents.set(event.id, event);
    }
    if (['remove', 'step_relabel'].includes(type) && !event) throw Object.assign(new Error('Attendance event not found'), { status: 404 });
    const ordinal = this.attendanceCorrections.length + 1;
    const correction = {
      id: `preview-correction-${ordinal}`,
      student_id: studentId,
      session_id: sessionId || event?.session_id || null,
      attendance_event_id: event?.id || null,
      type,
      from_val: fromVal ?? null,
      to_val: toVal ?? null,
      reason,
      reverts_id: revertsId || null,
      actor_id: actorId,
    };
    this.attendanceCorrections.push(correction);
    let staleDecisions = 0;
    for (const [key, decision] of this.billingDecisions) {
      if (key.startsWith(`${studentId}:`) && ['add', 'remove', 'step_relabel'].includes(type) && decision.state === 'approved') {
        this.billingDecisions.set(key, { ...decision, state: 'stale' });
        staleDecisions += 1;
      }
    }
    const result = {
      accepted: true,
      correction,
      attendance_event_id: event?.id || null,
      stale_decisions: staleDecisions,
      audit_event_id: `preview-correction-audit-${ordinal}`,
    };
    this.correctionMutations.set(requestId, { fingerprint, result });
    return result;
  }
  async setBillingConsent({ studentId, action, termsVersion, acceptedIp, reason, actorId, requestId }) {
    const fingerprint = JSON.stringify({ studentId, action, termsVersion, reason, actorId });
    const existingMutation = this.consentMutations.get(requestId);
    if (existingMutation) {
      if (existingMutation.fingerprint !== fingerprint) throw Object.assign(new Error('Idempotency key was already used for another mutation'), { status: 409 });
      return { ...existingMutation.result, duplicate: true };
    }
    const current = this.billingConsents.get(studentId) || null;
    let rejection = null;
    if (action === 'authorize') {
      if (this.billingTerms.get(termsVersion)?.status !== 'approved') rejection = 'approved_billing_terms_required';
      else if (this.paymentMethods.get(studentId)?.status !== 'on_file') rejection = 'payment_method_required';
      else if (current?.state === 'authorized' && current.terms_version === termsVersion) rejection = 'authorization_already_active';
    } else if (action === 'revoke') {
      if (current?.state !== 'authorized') rejection = 'active_authorization_not_found';
    } else {
      throw Object.assign(new Error('Billing consent action is invalid'), { status: 400 });
    }
    const ordinal = this.consentMutations.size + 1;
    if (rejection) {
      const result = { accepted: false, reason: rejection, audit_event_id: `preview-consent-audit-${ordinal}` };
      this.consentMutations.set(requestId, { fingerprint, result });
      return result;
    }
    const consent = {
      id: `preview-billing-consent-${ordinal}`,
      student_id: studentId,
      terms_version: action === 'authorize' ? termsVersion : current.terms_version,
      accepted_at: action === 'authorize' ? new Date().toISOString() : current.accepted_at,
      revoked_at: action === 'revoke' ? new Date().toISOString() : null,
      state: action === 'authorize' ? 'authorized' : 'revoked',
      actor_id: actorId,
      accepted_ip: action === 'authorize' ? acceptedIp : current.accepted_ip,
      superseded_by_id: null,
    };
    if (current) current.superseded_by_id = consent.id;
    this.billingConsents.set(studentId, consent);
    const result = { accepted: true, consent, audit_event_id: `preview-consent-audit-${ordinal}` };
    this.consentMutations.set(requestId, { fingerprint, result });
    return result;
  }
  async recordProviderEvent({ provider, eventId }) {
    const key = `${provider}:${eventId}`;
    if (this.providerEvents.has(key)) return { status: 'duplicate' };
    this.providerEvents.add(key);
    return { status: 'received' };
  }
  async adminHealth() { return { mode: 'preview', review_students: null, failed_provider_events: null, failed_notifications: null, latest_zoom_sync: null }; }
}
