import { transitionExamPlan as applyExamTransition } from '../domain/exam-engine.mjs';
import { buildDecisionBasis, calculateCycleAmount } from '../domain/billing-engine.mjs';

function sanitizedPaymentMethod(row) {
  if (!row) return null;
  const { provider_pm_ref: _providerPaymentMethodRef, last_error: _lastError, ...safe } = row;
  return safe;
}

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

  async currentExamPlanForStudent(studentId) {
    const rows = await this.request(`exam_plan?student_id=eq.${encodeURIComponent(studentId)}&superseded_by_id=is.null&select=id,student_id,step,exam_on,state,result,note,passed_on&limit=1`);
    return rows[0] || null;
  }

  async stripeCustomerForStudent(studentId) {
    const rows = await this.request(`stripe_customer_private?student_id=eq.${encodeURIComponent(studentId)}&select=student_id,provider_customer_ref&limit=1`);
    return rows[0] || null;
  }

  async saveStripeCustomer({ studentId, customerId }) {
    const rows = await this.request('stripe_customer_private?on_conflict=student_id', {
      method: 'POST',
      body: { student_id: studentId, provider: 'stripe', provider_customer_ref: customerId },
      headers: { prefer: 'resolution=ignore-duplicates,return=representation' },
    });
    const binding = rows?.[0] || await this.stripeCustomerForStudent(studentId);
    if (!binding || binding.provider_customer_ref !== customerId) {
      throw Object.assign(new Error('Stripe customer binding conflict'), { status: 409 });
    }
    return binding;
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

  async processStripeSetupIntent({ eventId, studentId, customerId, paymentMethodId, brand, last4, expMonth, expYear }) {
    return this.rpc('api_process_stripe_setup_intent', {
      p_provider_event_id: eventId,
      p_student_id: studentId,
      p_customer_ref: customerId,
      p_payment_method_ref: paymentMethodId,
      p_brand: brand || null,
      p_last4: last4,
      p_exp_month: expMonth,
      p_exp_year: expYear,
    });
  }

  async preparePaymentMethodRemoval({ studentId, actorId, actorRole, requestId }) {
    return this.rpc('api_prepare_payment_method_removal', {
      p_student_id: studentId,
      p_actor_id: actorId,
      p_actor_role: actorRole,
      p_request_id: requestId,
    });
  }

  async finishPaymentMethodRemoval({ studentId, requestId, succeeded, error }) {
    return this.rpc('api_finish_payment_method_removal', {
      p_student_id: studentId,
      p_request_id: requestId,
      p_succeeded: succeeded === true,
      p_error: error || null,
    });
  }

  async prepareDayCharge({ attendanceDayId, actorId, actorRole, requestId, explicitRetry }) {
    return this.rpc('api_prepare_day_charge', {
      p_attendance_day_id: attendanceDayId,
      p_actor_id: actorId,
      p_actor_role: actorRole,
      p_request_id: requestId,
      p_explicit_retry: explicitRetry === true,
    });
  }

  async processStripePaymentIntent({ eventId, eventType, paymentIntentId, studentId, attendanceDayId, failureCode, failureMessage }) {
    return this.rpc('api_process_stripe_payment_intent', {
      p_provider_event_id: eventId,
      p_event_type: eventType,
      p_payment_intent_ref: paymentIntentId,
      p_student_id: studentId,
      p_attendance_day_id: attendanceDayId,
      p_failure_code: failureCode || null,
      p_failure_message: failureMessage || null,
    });
  }

  async claimNotifications({ workerId, limit, now }) {
    return this.rpc('api_claim_notifications', {
      p_worker_id: workerId,
      p_limit: limit,
      p_now: now,
    });
  }

  async finishNotification({ notificationId, workerId, succeeded, providerRef, error, now }) {
    return this.rpc('api_finish_notification', {
      p_notification_id: notificationId,
      p_worker_id: workerId,
      p_succeeded: succeeded,
      p_provider_ref: providerRef || null,
      p_error: error || null,
      p_now: now,
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
    if (rows?.length) return { status: 'received', duplicate: false };
    const existing = await this.request(`provider_event_inbox?provider=eq.${encodeURIComponent(provider)}&provider_event_id=eq.${encodeURIComponent(eventId)}&select=state&limit=1`);
    return { status: existing[0]?.state || 'duplicate', duplicate: true };
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

  async adminStudents({ q = '', missing = null } = {}) {
    const [students, paymentMethods, consents] = await Promise.all([
      this.request('student?select=id,display_name,email,joined_at,comp_days_allowance,identity_state&order=display_name.asc&limit=1000'),
      this.request('payment_method?select=id,student_id,brand,last4,exp_month,exp_year,status,verified_at'),
      this.request('billing_consent?superseded_by_id=is.null&select=id,student_id,terms_version,state,accepted_at,revoked_at'),
    ]);
    const methodsByStudent = new Map(paymentMethods.map(row => [row.student_id, row]));
    const consentByStudent = new Map(consents.map(row => [row.student_id, row]));
    const needle = q.trim().toLocaleLowerCase();
    return students.map(student => ({
      ...student,
      payment_method: methodsByStudent.get(student.id) || null,
      billing_consent: consentByStudent.get(student.id) || null,
    })).filter(student => {
      if (needle && !`${student.display_name} ${student.email || ''}`.toLocaleLowerCase().includes(needle)) return false;
      if (missing === 'email' && student.email) return false;
      if (missing === 'setup' && student.payment_method?.status === 'on_file' && student.billing_consent?.state === 'authorized') return false;
      return true;
    });
  }

  async adminHome({ today }) {
    const [students, attendanceDays, decisions, examPlans, reminders, invoices, identityClusters] = await Promise.all([
      this.adminStudents(),
      this.request('attendance_day?superseded_at=is.null&select=id,student_id,cycle_key,kind'),
      this.request('billing_decision?superseded_by_id=is.null&select=id,student_id,cycle_key,state,amount_cents'),
      this.request('exam_plan?superseded_by_id=is.null&select=id,student_id,step,exam_on,state'),
      this.request('reminder?state=in.(scheduled,due)&select=id,student_id,exam_plan_id,due_on,state'),
      this.request('invoice?state=in.(draft,ready,sent)&select=id,student_id,cycle_key,state,amount_cents'),
      this.request('identity_cluster?state=eq.open&select=ref'),
    ]);
    return {
      questions: students.filter(student => student.identity_state === 'needs_review').length
        + attendanceDays.filter(day => day.kind === 'needs_review').length
        + identityClusters.length,
      identity_questions: identityClusters.length,
      missing_payment_setup: students.filter(student => student.payment_method?.status !== 'on_file' || student.billing_consent?.state !== 'authorized').length,
      stale_decisions: decisions.filter(decision => decision.state === 'stale').length,
      ready_invoices: invoices.filter(invoice => invoice.state === 'ready').length,
      pending_exam_plans: examPlans.filter(plan => ['pending', 'speak'].includes(plan.state)).length,
      upcoming_exam_plans: examPlans.filter(plan => ['approved'].includes(plan.state) && plan.exam_on >= today),
      due_reminders: reminders.filter(reminder => reminder.due_on <= today),
    };
  }

  async adminCycle(cycleKey) {
    const [cycles, attendanceDays, decisions, invoices] = await Promise.all([
      this.request(`cycle?key=eq.${encodeURIComponent(cycleKey)}&select=key,label,starts_on,ends_on,state&limit=1`),
      this.request(`attendance_day?cycle_key=eq.${encodeURIComponent(cycleKey)}&superseded_at=is.null&select=id,student_id,day,kind,comp_index,same_day_multiple_events,engine_version&order=day.asc`),
      this.request(`billing_decision?cycle_key=eq.${encodeURIComponent(cycleKey)}&superseded_by_id=is.null&select=id,student_id,treatment,amount_cents,basis,state,decided_at`),
      this.request(`invoice?cycle_key=eq.${encodeURIComponent(cycleKey)}&select=id,student_id,decision_id,state,amount_cents,sent_at,paid_at`),
    ]);
    if (!cycles[0]) return null;
    return { cycle: cycles[0], attendance_days: attendanceDays, billing_decisions: decisions, invoices };
  }

  async adminIdentityClusters({ state = 'open' } = {}) {
    const stateFilter = state === 'all' ? '' : `&state=eq.${encodeURIComponent(state)}`;
    const [clusters, members, aliases, decisions] = await Promise.all([
      this.request(`identity_cluster?select=ref,state,evidence,created_at,updated_at${stateFilter}&order=ref.asc`),
      this.request('identity_cluster_member?select=cluster_ref,identity_alias_id'),
      this.request('identity_alias?select=id,student_id,source_key,display_value,relationship_state,confidence'),
      this.request('identity_decision?superseded_by_id=is.null&select=id,cluster_ref,decision,canonical_student_id,note,decided_by,decided_at'),
    ]);
    const aliasesById = new Map(aliases.map(alias => [alias.id, alias]));
    const membersByCluster = new Map();
    for (const member of members) {
      const alias = aliasesById.get(member.identity_alias_id);
      if (!alias) continue;
      const list = membersByCluster.get(member.cluster_ref) || [];
      list.push(alias);
      membersByCluster.set(member.cluster_ref, list);
    }
    const decisionByCluster = new Map(decisions.map(decision => [decision.cluster_ref, decision]));
    return clusters.map(cluster => ({
      ...cluster,
      members: membersByCluster.get(cluster.ref) || [],
      decision: decisionByCluster.get(cluster.ref) || null,
    }));
  }

  async adminStudent(studentId) {
    const rows = await this.request(`student?id=eq.${encodeURIComponent(studentId)}&select=id,display_name,email,phone,joined_at,comp_days_allowance,identity_state&limit=1`);
    const student = rows[0];
    if (!student) return null;
    const [attendance, billing, payment_method, billing_consent, exam_plan] = await Promise.all([
      this.attendanceForStudent(studentId),
      this.billingForStudent(studentId),
      this.paymentMethodForStudent(studentId),
      this.billingConsentForStudent(studentId),
      this.currentExamPlanForStudent(studentId),
    ]);
    return { student, attendance, billing, payment_method, billing_consent, exam_plan };
  }
}

export class PreviewStore {
  constructor() {
    this.providerEvents = new Map();
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
    this.paymentRemovalMutations = new Map();
    this.stripeCustomers = new Map();
    this.chargesByDay = new Map();
    this.chargeMutations = new Map();
    this.notifications = new Map();
    this.identityClusters = new Map();
  }

  async studentByMatrixUser(userId) {
    return { id: userId, matrix_user_ref: userId, display_name: 'Preview Student', email: 'student.preview@invalid.local', joined_at: null, comp_days_allowance: 0, identity_state: 'verified' };
  }
  async attendanceForStudent() { return []; }
  async billingForStudent() { return []; }
  async paymentMethodForStudent(studentId) { return sanitizedPaymentMethod(this.paymentMethods.get(studentId)); }
  async billingConsentForStudent(studentId) { return this.billingConsents.get(studentId) || null; }
  async currentBillingTerms() {
    const approved = [...this.billingTerms.values()].filter(terms => terms.status === 'approved');
    return approved.at(-1) || null;
  }
  async currentExamPlanForStudent(studentId) { return this.examPlans.get(studentId) || null; }
  seedPaymentMethod(studentId, paymentMethod) {
    this.paymentMethods.set(studentId, {
      id: paymentMethod.id || `preview-payment-method-${this.paymentMethods.size + 1}`,
      brand: paymentMethod.brand || null,
      last4: paymentMethod.last4 || null,
      exp_month: paymentMethod.exp_month || null,
      exp_year: paymentMethod.exp_year || null,
      status: paymentMethod.status || 'on_file',
      verified_at: paymentMethod.verified_at || null,
      provider_pm_ref: paymentMethod.provider_pm_ref || `pm_preview_${studentId}`,
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
  async stripeCustomerForStudent(studentId) { return this.stripeCustomers.get(studentId) || null; }
  async saveStripeCustomer({ studentId, customerId }) {
    const existing = this.stripeCustomers.get(studentId);
    if (existing && existing.provider_customer_ref !== customerId) throw Object.assign(new Error('Stripe customer binding conflict'), { status: 409 });
    const binding = existing || { student_id: studentId, provider_customer_ref: customerId };
    this.stripeCustomers.set(studentId, binding);
    return binding;
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
  async processStripeSetupIntent({ eventId, studentId, customerId, paymentMethodId, brand, last4, expMonth, expYear }) {
    const event = this.providerEvents.get(`stripe:${eventId}`);
    if (!event) throw Object.assign(new Error('Stripe event not found'), { status: 409 });
    if (event.state === 'processed') return { accepted: true, duplicate: true, payment_method: this.paymentMethods.get(studentId) || null };
    const object = event.payload?.data?.object;
    if (!event.signatureVerified || event.eventType !== 'setup_intent.succeeded'
      || object?.metadata?.student_id !== studentId || object?.customer !== customerId || object?.payment_method !== paymentMethodId) {
      throw Object.assign(new Error('Stripe event binding mismatch'), { status: 409 });
    }
    if (this.stripeCustomers.get(studentId)?.provider_customer_ref !== customerId) {
      throw Object.assign(new Error('Stripe customer binding mismatch'), { status: 409 });
    }
    this.seedPaymentMethod(studentId, {
      brand,
      last4,
      exp_month: expMonth,
      exp_year: expYear,
      status: 'on_file',
      verified_at: new Date().toISOString(),
      provider_pm_ref: paymentMethodId,
    });
    event.state = 'processed';
    return { accepted: true, duplicate: false, audit_event_id: `preview-stripe-audit-${eventId}`, payment_method: this.paymentMethods.get(studentId) };
  }
  async preparePaymentMethodRemoval({ studentId, actorId, actorRole, requestId }) {
    if (actorRole !== 'student' || actorId !== studentId) throw Object.assign(new Error('Payment method removal forbidden'), { status: 403 });
    const fingerprint = JSON.stringify({ studentId, actorId });
    const existing = this.paymentRemovalMutations.get(requestId);
    const method = this.paymentMethods.get(studentId);
    if (existing) {
      if (existing.fingerprint !== fingerprint) throw Object.assign(new Error('Idempotency key was already used for another mutation'), { status: 409 });
      if (method?.status === 'on_file') method.status = 'removal_pending';
      return { accepted: true, duplicate: true, provider_payment_method_ref: method?.provider_pm_ref, payment_method: sanitizedPaymentMethod(method) };
    }
    if (!method || method.status !== 'on_file') return { accepted: false, reason: 'payment_method_not_on_file', duplicate: false };
    const consent = this.billingConsents.get(studentId);
    if (consent?.state === 'authorized') {
      await this.setBillingConsent({
        studentId,
        action: 'revoke',
        termsVersion: null,
        acceptedIp: null,
        reason: 'Automatic billing authorization revoked because the payment method was removed',
        actorId,
        requestId: `${requestId}:consent`,
      });
    }
    method.status = 'removal_pending';
    const result = { accepted: true, provider_payment_method_ref: method.provider_pm_ref, payment_method: sanitizedPaymentMethod(method) };
    this.paymentRemovalMutations.set(requestId, { fingerprint, result });
    return result;
  }
  async finishPaymentMethodRemoval({ studentId, requestId, succeeded, error }) {
    const mutation = this.paymentRemovalMutations.get(requestId);
    if (!mutation) throw Object.assign(new Error('Payment method removal was not prepared'), { status: 409 });
    const method = this.paymentMethods.get(studentId);
    if (!method || method.status !== 'removal_pending') throw Object.assign(new Error('Payment method removal state mismatch'), { status: 409 });
    method.status = succeeded ? 'removed' : 'on_file';
    method.last_error = succeeded ? null : error || 'Provider removal failed';
    return { accepted: true, duplicate: false, payment_method: sanitizedPaymentMethod(method) };
  }
  async prepareDayCharge({ attendanceDayId, actorId, requestId, explicitRetry }) {
    const fingerprint = JSON.stringify({ attendanceDayId, actorId, explicitRetry: explicitRetry === true });
    const priorMutation = this.chargeMutations.get(requestId);
    if (priorMutation) {
      if (priorMutation.fingerprint !== fingerprint) throw Object.assign(new Error('Idempotency key was already used for another mutation'), { status: 409 });
      return { ...priorMutation.result, duplicate: true };
    }
    let studentId = null;
    let cycleKey = null;
    let day = null;
    for (const [key, days] of this.attendanceDays) {
      const match = days.find(item => item.id === attendanceDayId);
      if (match) {
        [studentId, cycleKey] = key.split(':');
        day = match;
        break;
      }
    }
    const decision = studentId ? this.billingDecisions.get(`${studentId}:${cycleKey}`) : null;
    const method = studentId ? this.paymentMethods.get(studentId) : null;
    const consent = studentId ? this.billingConsents.get(studentId) : null;
    const existingCharge = this.chargesByDay.get(attendanceDayId) || null;
    let rejection = null;
    if (!day) rejection = 'current_attendance_day_not_found';
    else if (day.kind !== 'billable') rejection = 'attendance_day_not_billable';
    else if (!decision || decision.state !== 'approved') rejection = 'approved_billing_decision_required';
    else if (decision.treatment !== 'confirm') rejection = 'per_day_billing_decision_required';
    else if (method?.status !== 'on_file') rejection = 'payment_method_required';
    else if (consent?.state !== 'authorized') rejection = 'billing_authorization_required';
    else if (existingCharge?.state === 'failed' && explicitRetry !== true) rejection = 'explicit_retry_required';
    else if (existingCharge?.state === 'succeeded') rejection = 'charge_already_succeeded';
    else if (existingCharge?.state === 'refunded') rejection = 'refunded_day_requires_review';
    else if (existingCharge && existingCharge.state !== 'failed') rejection = 'charge_already_pending';
    const reservedAmount = [...this.chargesByDay.values()]
      .filter(charge => charge.student_id === studentId && charge.cycle_key === cycleKey && charge.attendance_day_id !== attendanceDayId && ['pending', 'succeeded'].includes(charge.state))
      .reduce((sum, charge) => sum + charge.amount_cents, 0);
    if (!rejection && reservedAmount + 2_500 > decision.amount_cents) rejection = 'approved_amount_exhausted';
    const ordinal = this.chargeMutations.size + 1;
    if (rejection) {
      const result = { accepted: false, reason: rejection, audit_event_id: `preview-charge-audit-${ordinal}` };
      this.chargeMutations.set(requestId, { fingerprint, result });
      return result;
    }
    const charge = existingCharge || {
      id: `preview-charge-${this.chargesByDay.size + 1}`,
      student_id: studentId,
      cycle_key: cycleKey,
      attendance_day_id: attendanceDayId,
      amount_cents: 2_500,
      idempotency_key: `missionaccounts:billable-day:${attendanceDayId}:v1`,
    };
    charge.state = 'pending';
    this.chargesByDay.set(attendanceDayId, charge);
    const customer = this.stripeCustomers.get(studentId);
    const result = {
      accepted: true,
      charge: { ...charge },
      customer_ref: customer?.provider_customer_ref || null,
      payment_method_ref: `pm_preview_${studentId}`,
      audit_event_id: `preview-charge-audit-${ordinal}`,
    };
    this.chargeMutations.set(requestId, { fingerprint, result });
    return result;
  }
  async processStripePaymentIntent({ eventId, eventType, paymentIntentId, studentId, attendanceDayId, failureCode, failureMessage }) {
    const event = this.providerEvents.get(`stripe:${eventId}`);
    const charge = this.chargesByDay.get(attendanceDayId);
    if (!event || !charge) throw Object.assign(new Error('Stripe charge event cannot be matched'), { status: 409 });
    if (event.state === 'processed') return { accepted: true, duplicate: true, charge: { ...charge } };
    const object = event.payload?.data?.object;
    if (!event.signatureVerified || event.eventType !== eventType || object?.id !== paymentIntentId
      || object?.metadata?.student_id !== studentId || object?.metadata?.attendance_day_id !== attendanceDayId
      || charge.student_id !== studentId || (charge.provider_ref && charge.provider_ref !== paymentIntentId)) {
      throw Object.assign(new Error('Stripe charge event binding mismatch'), { status: 409 });
    }
    charge.provider_ref = paymentIntentId;
    charge.state = eventType === 'payment_intent.succeeded' ? 'succeeded' : 'failed';
    charge.failure_code = failureCode || null;
    charge.failure_message = failureMessage || null;
    event.state = 'processed';
    return { accepted: true, duplicate: false, audit_event_id: `preview-charge-webhook-audit-${eventId}`, charge: { ...charge } };
  }
  seedNotification(notification) {
    const id = notification.id || `preview-notification-${this.notifications.size + 1}`;
    const row = {
      id,
      student_id: notification.student_id || null,
      channel: notification.channel || 'matrix',
      event_kind: notification.event_kind,
      payload: notification.payload || {},
      state: notification.state || 'pending',
      idempotency_key: notification.idempotency_key,
      available_at: notification.available_at || new Date(0).toISOString(),
      sent_at: null,
      attempt_count: notification.attempt_count || 0,
      locked_by: null,
      locked_at: null,
      provider_ref: null,
      last_error: null,
    };
    this.notifications.set(id, row);
    return row;
  }
  seedIdentityCluster(cluster) {
    this.identityClusters.set(cluster.ref, {
      ref: cluster.ref,
      state: cluster.state || 'open',
      evidence: cluster.evidence || {},
      members: (cluster.members || []).map(member => ({ ...member })),
      decision: cluster.decision || null,
    });
  }
  async claimNotifications({ workerId, limit, now }) {
    const nowMs = Date.parse(now);
    const rows = [...this.notifications.values()]
      .filter(row => ['pending', 'failed'].includes(row.state) && Date.parse(row.available_at) <= nowMs && row.attempt_count < 5 && !row.locked_at)
      .sort((a, b) => a.available_at.localeCompare(b.available_at))
      .slice(0, limit);
    for (const row of rows) {
      row.state = 'sending';
      row.attempt_count += 1;
      row.locked_by = workerId;
      row.locked_at = now;
      row.last_error = null;
    }
    return rows.map(row => ({ ...row }));
  }
  async finishNotification({ notificationId, workerId, succeeded, providerRef, error, now }) {
    const row = this.notifications.get(notificationId);
    if (!row || row.state !== 'sending' || row.locked_by !== workerId) throw Object.assign(new Error('Notification claim mismatch'), { status: 409 });
    row.state = succeeded ? 'sent' : 'failed';
    row.sent_at = succeeded ? now : null;
    row.provider_ref = succeeded ? providerRef : row.provider_ref;
    row.last_error = succeeded ? null : error;
    row.available_at = succeeded ? row.available_at : new Date(Date.parse(now) + Math.min(60, 2 ** row.attempt_count) * 60_000).toISOString();
    row.locked_by = null;
    row.locked_at = null;
    return { ...row };
  }
  async recordProviderEvent({ provider, eventId, providerObjectId, eventType, payload, signatureVerified }) {
    const key = `${provider}:${eventId}`;
    const existing = this.providerEvents.get(key);
    if (existing) return { status: existing.state, duplicate: true };
    this.providerEvents.set(key, { providerObjectId, eventType, payload, signatureVerified, state: 'received' });
    return { status: 'received', duplicate: false };
  }
  previewStudent() {
    const student = { id: '00000000-0000-4000-8000-000000000001', display_name: 'Preview Student', email: 'student.preview@invalid.local', phone: null, joined_at: null, comp_days_allowance: 0, identity_state: 'verified' };
    return {
      ...student,
      payment_method: sanitizedPaymentMethod(this.paymentMethods.get(student.id)),
      billing_consent: this.billingConsents.get(student.id) || null,
    };
  }
  async adminStudents({ q = '', missing = null } = {}) {
    const student = this.previewStudent();
    const matches = !q || `${student.display_name} ${student.email}`.toLocaleLowerCase().includes(q.toLocaleLowerCase());
    const missingMatch = missing === 'email' ? !student.email
      : missing === 'setup' ? student.payment_method?.status !== 'on_file' || student.billing_consent?.state !== 'authorized'
        : true;
    return matches && missingMatch ? [student] : [];
  }
  async adminHome({ today }) {
    const students = await this.adminStudents();
    const examPlans = [...this.examPlans.values()];
    return {
      questions: students.filter(student => student.identity_state === 'needs_review').length
        + [...this.identityClusters.values()].filter(cluster => cluster.state === 'open').length,
      identity_questions: [...this.identityClusters.values()].filter(cluster => cluster.state === 'open').length,
      missing_payment_setup: students.filter(student => student.payment_method?.status !== 'on_file' || student.billing_consent?.state !== 'authorized').length,
      stale_decisions: [...this.billingDecisions.values()].filter(decision => decision.state === 'stale').length,
      ready_invoices: 0,
      pending_exam_plans: examPlans.filter(plan => ['pending', 'speak'].includes(plan.state)).length,
      upcoming_exam_plans: examPlans.filter(plan => plan.state === 'approved' && plan.exam_on >= today),
      due_reminders: [],
    };
  }
  async adminCycle(cycleKey) {
    const attendance = [...this.attendanceDays.entries()].filter(([key]) => key.endsWith(`:${cycleKey}`)).flatMap(([, days]) => days);
    const decisions = [...this.billingDecisions.entries()].filter(([key]) => key.endsWith(`:${cycleKey}`)).map(([, decision]) => decision);
    return { cycle: { key: cycleKey, label: cycleKey, starts_on: null, ends_on: null, state: 'preview' }, attendance_days: attendance, billing_decisions: decisions, invoices: [] };
  }
  async adminIdentityClusters({ state = 'open' } = {}) {
    return [...this.identityClusters.values()]
      .filter(cluster => state === 'all' || cluster.state === state)
      .map(cluster => ({ ...cluster, members: cluster.members.map(member => ({ ...member })) }));
  }
  async adminStudent(studentId) {
    if (studentId !== this.previewStudent().id) return null;
    const student = this.previewStudent();
    return {
      student,
      attendance: [...this.attendanceDays.entries()].filter(([key]) => key.startsWith(`${studentId}:`)).flatMap(([, days]) => days),
      billing: [...this.billingDecisions.entries()].filter(([key]) => key.startsWith(`${studentId}:`)).map(([, decision]) => decision),
      payment_method: student.payment_method,
      billing_consent: student.billing_consent,
      exam_plan: this.examPlans.get(studentId) || null,
    };
  }
  async adminHealth() { return { mode: 'preview', review_students: null, failed_provider_events: null, failed_notifications: null, latest_zoom_sync: null }; }
}
