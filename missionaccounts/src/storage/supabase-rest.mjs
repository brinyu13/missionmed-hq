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

  async requestAll(path, { pageSize = 1_000 } = {}) {
    const rows = [];
    for (let offset = 0; ; offset += pageSize) {
      const page = await this.request(path, { headers: { range: `${offset}-${offset + pageSize - 1}` } });
      if (!Array.isArray(page)) throw new Error('MissionAccounts paginated database response is invalid');
      rows.push(...page);
      if (page.length < pageSize) return rows;
    }
  }

  async studentByMatrixUser(userId) {
    const rows = await this.request(`student?matrix_user_ref=eq.${encodeURIComponent(userId)}&select=id,matrix_user_ref,display_name,email,joined_at,comp_days_allowance,identity_state&limit=1`);
    return rows[0] || null;
  }

  async billingCycles() {
    return this.request('cycle?select=key,label,starts_on,ends_on,state&order=starts_on.asc');
  }

  async linkStudentAccount({ studentId, matrixUserId, joinedOn, today, reason, actorId, actorRole, requestId }) {
    return this.rpc('api_link_student_account', {
      p_student_id: studentId,
      p_matrix_user_ref: matrixUserId,
      p_joined_on: joinedOn || null,
      p_today: today,
      p_reason: reason,
      p_actor_id: actorId,
      p_actor_role: actorRole,
      p_request_id: requestId,
    });
  }

  async setStudentContact({ studentId, email, phone, reason, actorId, actorRole, requestId }) {
    return this.rpc('api_set_student_contact', {
      p_student_id: studentId,
      p_email: email || null,
      p_phone: phone || null,
      p_reason: reason,
      p_actor_id: actorId,
      p_actor_role: actorRole,
      p_request_id: requestId,
    });
  }

  async decideFullCycleCeiling({ studentId, cycleKey, status, reason, actorId, actorRole, requestId }) {
    return this.rpc('api_decide_full_cycle_ceiling', {
      p_student_id: studentId,
      p_cycle_key: cycleKey,
      p_status: status,
      p_reason: reason,
      p_actor_id: actorId,
      p_actor_role: actorRole,
      p_request_id: requestId,
    });
  }

  async canonicalUiData({ scope, studentId = null }) {
    const admin = scope === 'admin';
    if (!admin && !studentId) throw new Error('Student canonical projection requires a student id');
    const studentFilter = admin ? '' : `&student_id=eq.${encodeURIComponent(studentId)}`;
    const studentPath = admin
      ? 'student?select=id,display_name,email,phone,joined_at,comp_days_allowance,identity_state&order=display_name.asc&limit=1000'
      : `student?id=eq.${encodeURIComponent(studentId)}&select=id,display_name,email,phone,joined_at,comp_days_allowance,identity_state&limit=1`;
    const aliasPath = admin
      ? 'identity_alias?superseded_by_id=is.null&select=id,student_id,source_key,display_value,relationship_state,confidence&order=created_at.asc'
      : `identity_alias?student_id=eq.${encodeURIComponent(studentId)}&superseded_by_id=is.null&select=id,student_id,source_key,display_value,relationship_state,confidence&order=created_at.asc`;
    const sessionSelect = admin
      ? 'id,cycle_key,provider_meeting_id,starts_at,held_on,time_zone,step,state'
      : 'id,cycle_key,starts_at,held_on,time_zone,step,state';
    const [
      cycles, sessions, students, aliases, attendanceEvents, attendanceDays,
      billingDecisions, invoices, examPlans, examTransitions, graceWindows, reminders,
      corrections, ceilings, cyclePolicies, ruleDecisions,
    ] = await Promise.all([
      this.billingCycles(),
      this.requestAll(`session?state=eq.confirmed&superseded_by_id=is.null&select=${sessionSelect}&order=starts_at.asc`),
      this.requestAll(studentPath),
      this.requestAll(aliasPath),
      this.requestAll(`attendance_event_projection?superseded_by_id=is.null${studentFilter}&select=id,student_id,session_id,cycle_key,local_day,step,interpretation_state,duration_minutes,source_row_count,source_display_name&order=local_day.asc`),
      this.requestAll(`attendance_day?superseded_at=is.null${studentFilter}&select=id,student_id,cycle_key,day,kind,comp_index,same_day_multiple_events,engine_version&order=day.asc`),
      this.requestAll(`billing_decision?superseded_by_id=is.null${studentFilter}&select=id,student_id,cycle_key,treatment,amount_cents,basis,state,decided_at&order=created_at.asc`),
      this.requestAll(`invoice?${admin ? '' : `student_id=eq.${encodeURIComponent(studentId)}&`}select=id,student_id,cycle_key,decision_id,state,amount_cents,sent_at,paid_at&order=created_at.asc`),
      this.requestAll(`exam_plan?${admin ? '' : `student_id=eq.${encodeURIComponent(studentId)}&`}select=id,student_id,step,exam_on,state,result,note,suggested_on,passed_on,submitted_at,decided_at,withdrawn_at,superseded_by_id&order=submitted_at.asc`),
      this.requestAll(`exam_transition?accepted=eq.true${studentFilter}&select=id,exam_plan_id,student_id,from_state,to_state,result,reason,actor_role,created_at&order=created_at.asc`),
      this.requestAll(`grace_window?${admin ? '' : `student_id=eq.${encodeURIComponent(studentId)}&`}select=id,student_id,exam_plan_id,from_on,to_on,state,closed_reason,created_at&order=created_at.asc`),
      this.requestAll(`reminder?${admin ? '' : `student_id=eq.${encodeURIComponent(studentId)}&`}select=id,student_id,exam_plan_id,due_on,state,cancelled_reason,created_at&order=created_at.asc`),
      this.requestAll(`attendance_correction?${admin ? '' : `student_id=eq.${encodeURIComponent(studentId)}&`}select=id,student_id,attendance_event_id,session_id,type,from_val,to_val,reason,reverts_id,reverted_by_id,created_at&order=created_at.asc`),
      this.requestAll(`full_cycle_ceiling?superseded_by_id=is.null${studentFilter}${admin ? '' : '&status=eq.verified'}&select=id,student_id,cycle_key,status,ceiling_cents,basis,decided_at&order=created_at.asc`),
      this.requestAll('cycle_policy?superseded_by_id=is.null&select=id,cycle_key,key,value,reason,set_at&order=set_at.asc'),
      this.requestAll('rule_decision?superseded_by_id=is.null&select=id,rule,mode,effective_from,basis,decided_at&order=decided_at.asc'),
    ]);
    const projection = {
      schema_version: 'missionaccounts-canonical-data-v1',
      scope,
      cycles,
      sessions,
      students,
      aliases,
      attendance_events: attendanceEvents,
      attendance_days: attendanceDays,
      billing_decisions: billingDecisions,
      invoices,
      exam_plans: examPlans,
      exam_transitions: examTransitions,
      grace_windows: graceWindows,
      reminders,
      attendance_corrections: corrections,
      full_cycle_ceilings: ceilings,
      cycle_policies: cyclePolicies,
      rule_decisions: ruleDecisions,
    };
    if (admin) projection.identity_clusters = await this.adminIdentityClusters({ state: 'all' });
    return projection;
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
    const rows = await this.request(`exam_plan?student_id=eq.${encodeURIComponent(studentId)}&superseded_by_id=is.null&withdrawn_at=is.null&select=id,student_id,step,exam_on,state,result,note,suggested_on,passed_on&limit=1`);
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

  async submitExamPlan({ studentId, step, examOn, today, actorId, actorRole, requestId }) {
    return this.rpc('api_submit_exam_plan', {
      p_student_id: studentId,
      p_step: step,
      p_exam_on: examOn,
      p_today: today,
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

  async transitionExamPlan({ planId, toState, result, note, suggestedOn, today, actorId, actorRole, requestId }) {
    return this.rpc('api_transition_exam_plan', {
      p_plan_id: planId,
      p_to_state: toState,
      p_result: result || null,
      p_note: note || null,
      p_today: today,
      p_actor_id: actorId,
      p_actor_role: actorRole,
      p_request_id: requestId,
      p_suggested_on: suggestedOn || null,
    });
  }

  async withdrawExamPlan({ planId, today, actorId, actorRole, reason, requestId }) {
    return this.rpc('api_withdraw_exam_plan', {
      p_plan_id: planId,
      p_today: today,
      p_actor_id: actorId,
      p_actor_role: actorRole,
      p_reason: reason,
      p_request_id: requestId,
    });
  }

  async setCyclePolicy({ cycleKey, decision, reason, actorId, actorRole, requestId }) {
    return this.rpc('api_set_cycle_policy', {
      p_cycle_key: cycleKey,
      p_decision: decision,
      p_reason: reason,
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

  async setInvoiceReadiness({ invoiceId, ready, reason, actorId, actorRole, requestId }) {
    return this.rpc('api_set_invoice_readiness', {
      p_invoice_id: invoiceId,
      p_ready: ready,
      p_reason: reason,
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

  async claimDueDayCharges({ now, workerId, limit }) {
    return this.rpc('api_claim_due_day_charges', {
      p_now: now,
      p_worker_id: workerId,
      p_limit: limit,
    });
  }

  async finishAutoChargeDispatch({ dispatchId, workerId, succeeded, providerRef, error, now }) {
    return this.rpc('api_finish_auto_charge_dispatch', {
      p_dispatch_id: dispatchId,
      p_worker_id: workerId,
      p_succeeded: succeeded === true,
      p_provider_ref: providerRef || null,
      p_error: error || null,
      p_now: now,
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

  async enqueueDueExamReminders({ today, now, limit }) {
    return this.rpc('api_enqueue_due_exam_reminders', {
      p_today: today,
      p_now: now,
      p_limit: limit,
    });
  }

  async notificationDeliverable({ notificationId }) {
    const notifications = await this.request(`notification_outbox?id=eq.${encodeURIComponent(notificationId)}&select=state,reminder_id&limit=1`);
    const notification = notifications[0];
    if (!notification || notification.state !== 'sending') return false;
    if (!notification.reminder_id) return true;
    const reminders = await this.request(`reminder?id=eq.${encodeURIComponent(notification.reminder_id)}&select=state&limit=1`);
    return ['scheduled', 'due'].includes(reminders[0]?.state);
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
    const [students, inbox, outbox, exceptions, syncs] = await Promise.all([
      this.request('student?select=id&identity_state=eq.needs_review'),
      this.request('provider_event_inbox?select=id&state=eq.failed'),
      this.request('notification_outbox?select=id&state=eq.failed'),
      this.request('integration_exception?select=id&state=eq.open'),
      this.request('sync_run?select=state,started_at,finished_at,stats,error&order=started_at.desc&limit=1'),
    ]);
    return {
      review_students: students.length,
      failed_provider_events: inbox.length,
      failed_notifications: outbox.length,
      open_integration_exceptions: exceptions.length,
      latest_zoom_sync: syncs[0] || null,
    };
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
      this.request('exam_plan?superseded_by_id=is.null&withdrawn_at=is.null&select=id,student_id,step,exam_on,state'),
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
    const [cycles, attendanceDays, decisions, invoices, policies] = await Promise.all([
      this.request(`cycle?key=eq.${encodeURIComponent(cycleKey)}&select=key,label,starts_on,ends_on,state&limit=1`),
      this.request(`attendance_day?cycle_key=eq.${encodeURIComponent(cycleKey)}&superseded_at=is.null&select=id,student_id,day,kind,comp_index,same_day_multiple_events,engine_version&order=day.asc`),
      this.request(`billing_decision?cycle_key=eq.${encodeURIComponent(cycleKey)}&superseded_by_id=is.null&select=id,student_id,treatment,amount_cents,basis,state,decided_at`),
      this.request(`invoice?cycle_key=eq.${encodeURIComponent(cycleKey)}&select=id,student_id,decision_id,state,amount_cents,sent_at,paid_at`),
      this.request(`cycle_policy?cycle_key=eq.${encodeURIComponent(cycleKey)}&superseded_by_id=is.null&select=id,cycle_key,key,value,set_by,reason,set_at`),
    ]);
    if (!cycles[0]) return null;
    return { cycle: cycles[0], attendance_days: attendanceDays, billing_decisions: decisions, invoices, policies };
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
    this.examWithdrawals = new Map();
    this.priorExamPlans = [];
    this.examHistoryRows = [];
    this.cyclePolicies = new Map();
    this.policyMutations = new Map();
    this.attendanceDays = new Map();
    this.billingCaps = new Map();
    this.billingCapMutations = new Map();
    this.billingDecisions = new Map();
    this.billingMutations = new Map();
    this.invoices = new Map();
    this.invoiceReadinessMutations = new Map();
    this.contactMutations = new Map();
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
    this.autoChargeDispatches = new Map();
    this.integrationExceptions = new Map();
    this.notifications = new Map();
    this.reminders = new Map();
    this.identityClusters = new Map();
    this.accountLinkMutations = new Map();
    this.previewStudentRecord = {
      id: '00000000-0000-4000-8000-000000000001',
      matrix_user_ref: '00000000-0000-4000-8000-000000000001',
      display_name: 'Preview Student',
      email: 'student.preview@invalid.local',
      phone: null,
      joined_at: null,
      comp_days_allowance: 0,
      identity_state: 'verified',
    };
  }

  async studentByMatrixUser(userId) {
    return this.previewStudentRecord.matrix_user_ref === userId ? { ...this.previewStudentRecord } : null;
  }
  async billingCycles() {
    return [
      { key: '2026-cycle-1', label: 'June Cycle', starts_on: '2026-06-08', ends_on: '2026-07-13', state: 'estimate' },
      { key: '2026-cycle-2', label: 'July Cycle', starts_on: '2026-07-14', ends_on: '2026-08-11', state: 'estimate' },
      { key: '2026-cycle-3', label: 'August Cycle', starts_on: '2026-08-12', ends_on: '2026-09-04', state: 'estimate' },
    ];
  }
  async canonicalUiData({ scope, studentId = null }) {
    const admin = scope === 'admin';
    const student = this.previewStudent();
    if (!admin && studentId !== student.id) throw Object.assign(new Error('Student record not found'), { status: 404 });
    const relevantStudentIds = new Set(admin ? [student.id] : [studentId]);
    const valuesFor = map => [...map.values()].filter(row => !row.student_id || relevantStudentIds.has(row.student_id));
    return {
      schema_version: 'missionaccounts-canonical-data-v1',
      scope,
      cycles: await this.billingCycles(),
      sessions: [],
      students: [student],
      aliases: [],
      attendance_events: valuesFor(this.attendanceEvents),
      attendance_days: [...this.attendanceDays.entries()]
        .filter(([key]) => relevantStudentIds.has(key.split(':')[0]))
        .flatMap(([, rows]) => rows.map(row => ({ ...row }))),
      billing_decisions: valuesFor(this.billingDecisions),
      invoices: valuesFor(this.invoices),
      exam_plans: [
        ...this.priorExamPlans.filter(plan => relevantStudentIds.has(plan.student_id)),
        ...valuesFor(this.examPlans),
      ].map(plan => ({ ...plan })),
      exam_transitions: this.examHistoryRows.filter(row => relevantStudentIds.has(row.student_id)).map(row => ({ ...row })),
      grace_windows: [],
      reminders: valuesFor(this.reminders),
      attendance_corrections: this.attendanceCorrections.filter(row => relevantStudentIds.has(row.student_id)),
      full_cycle_ceilings: valuesFor(this.billingCaps),
      cycle_policies: [...this.cyclePolicies.values()].map(row => ({ ...row })),
      rule_decisions: [{ rule: 'one_charge_per_calendar_day', mode: 'retroactive', effective_from: '2026-06-08' }],
      ...(admin ? { identity_clusters: await this.adminIdentityClusters({ state: 'all' }) } : {}),
    };
  }
  async linkStudentAccount({ studentId, matrixUserId, joinedOn, today, reason, actorId, actorRole, requestId }) {
    if (!['missionaccounts_admin', 'founder'].includes(actorRole)) throw Object.assign(new Error('Account link requires administrator authority'), { status: 403 });
    const fingerprint = JSON.stringify({ studentId, matrixUserId, joinedOn, reason, actorId, actorRole });
    const existing = this.accountLinkMutations.get(requestId);
    if (existing) {
      if (existing.fingerprint !== fingerprint) throw Object.assign(new Error('Idempotency key was already used for another mutation'), { status: 409 });
      return { ...existing.result, duplicate: true };
    }
    if (studentId !== this.previewStudentRecord.id) throw Object.assign(new Error('Student record not found'), { status: 404 });
    if (this.previewStudentRecord.matrix_user_ref) throw Object.assign(new Error('Student account is already linked'), { status: 409 });
    const effectiveJoinedOn = joinedOn || today;
    const priorAllowance = this.previewStudentRecord.comp_days_allowance;
    this.previewStudentRecord.matrix_user_ref = matrixUserId;
    this.previewStudentRecord.joined_at = effectiveJoinedOn;
    if (priorAllowance === 0 && effectiveJoinedOn > '2026-09-05') this.previewStudentRecord.comp_days_allowance = 5;
    const ordinal = this.accountLinkMutations.size + 1;
    const result = {
      student: { ...this.previewStudentRecord },
      change_id: `preview-account-link-${ordinal}`,
      audit_event_id: `preview-account-link-audit-${ordinal}`,
      attendance_recompute: { trigger: `${requestId}:account-link` },
    };
    this.accountLinkMutations.set(requestId, { fingerprint, result });
    return { ...result, duplicate: false };
  }
  async setStudentContact({ studentId, email, phone, reason, actorId, actorRole, requestId }) {
    if (!['missionaccounts_admin', 'founder'].includes(actorRole)) throw Object.assign(new Error('Student contact change requires administrator authority'), { status: 403 });
    const fingerprint = JSON.stringify({ studentId, email, phone, reason, actorId, actorRole });
    const existing = this.contactMutations.get(requestId);
    if (existing) {
      if (existing.fingerprint !== fingerprint) throw Object.assign(new Error('Idempotency key was already used for another mutation'), { status: 409 });
      return { ...existing.result, duplicate: true };
    }
    if (studentId !== this.previewStudentRecord.id) throw Object.assign(new Error('Student record not found'), { status: 404 });
    this.previewStudentRecord.email = email || null;
    this.previewStudentRecord.phone = phone || null;
    this.previewStudentRecord.updated_at = new Date().toISOString();
    let demotedReadyInvoices = 0;
    if (!email) {
      for (const [id, invoice] of this.invoices) {
        if (invoice.student_id === studentId && invoice.state === 'ready') {
          this.invoices.set(id, { ...invoice, state: 'draft' });
          demotedReadyInvoices += 1;
        }
      }
    }
    const ordinal = this.contactMutations.size + 1;
    const result = {
      student: this.previewStudent(),
      change_id: `preview-contact-change-${ordinal}`,
      demoted_ready_invoices: demotedReadyInvoices,
      audit_event_id: `preview-contact-audit-${ordinal}`,
    };
    this.contactMutations.set(requestId, { fingerprint, result });
    return { ...result, duplicate: false };
  }
  async attendanceForStudent() { return []; }
  async billingForStudent() { return []; }
  async paymentMethodForStudent(studentId) { return sanitizedPaymentMethod(this.paymentMethods.get(studentId)); }
  async billingConsentForStudent(studentId) { return this.billingConsents.get(studentId) || null; }
  async currentBillingTerms() {
    const approved = [...this.billingTerms.values()].filter(terms => terms.status === 'approved');
    return approved.at(-1) || null;
  }
  async currentExamPlanForStudent(studentId) {
    const plan = this.examPlans.get(studentId) || null;
    return plan?.withdrawn_at ? null : plan;
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
  async submitExamPlan({ studentId, step, examOn, today, actorId, actorRole, requestId }) {
    const effectiveRole = actorRole || (actorId === studentId ? 'student' : 'missionaccounts_admin');
    if (!['student', 'missionaccounts_admin', 'founder'].includes(effectiveRole)
      || (effectiveRole === 'student' && actorId !== studentId)) {
      throw Object.assign(new Error('Exam plan submission forbidden'), { status: 403 });
    }
    const fingerprint = JSON.stringify({ studentId, step, examOn, actorId, actorRole: effectiveRole });
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
      superseded_by_id: null,
    };
    const closedGraceWindows = prior && ['approved', 'followup'].includes(prior.state) ? 1 : 0;
    if (prior) {
      this.priorExamPlans.push({ ...prior, superseded_by_id: plan.id });
      for (const reminder of this.reminders.values()) {
        if (reminder.exam_plan_id !== prior.id || !['scheduled', 'due'].includes(reminder.state)) continue;
        reminder.state = 'cancelled';
        reminder.cancelled_reason = 'plan_replaced';
        for (const notification of this.notifications.values()) {
          if (notification.reminder_id === reminder.id && ['pending', 'failed', 'sending'].includes(notification.state)) {
            notification.state = 'cancelled';
            notification.locked_by = null;
            notification.locked_at = null;
            notification.last_error = 'plan_replaced';
          }
        }
      }
    }
    const result = {
      plan,
      closed_grace_windows: closedGraceWindows,
      attendance_recompute: closedGraceWindows ? { trigger: `${requestId}:exam-plan-replaced`, today } : null,
      audit_event_id: `preview-audit-${ordinal}`,
    };
    this.examPlans.set(studentId, plan);
    this.examHistoryRows.push({
      id: `preview-exam-history-${this.examHistoryRows.length + 1}`,
      exam_plan_id: plan.id,
      student_id: studentId,
      from_state: null,
      to_state: 'pending',
      result: null,
      accepted: true,
      reason: 'submitted',
      actor_role: effectiveRole,
      created_at: new Date().toISOString(),
    });
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
    if (studentId === this.previewStudentRecord.id) {
      this.previewStudentRecord.comp_days_allowance = allowance;
      this.previewStudentRecord.joined_at = student.joined_at;
    }
    this.compMutations.set(requestId, { fingerprint, result });
    return result;
  }
  async transitionExamPlan({ planId, toState, result, note, suggestedOn, today, actorId, actorRole, requestId }) {
    const effectiveRole = actorRole || (actorId === this.previewStudentRecord.id ? 'student' : 'missionaccounts_admin');
    const fingerprint = JSON.stringify({ planId, toState, result, note, suggestedOn, today, actorId, actorRole: effectiveRole });
    const existing = this.examTransitions.get(requestId);
    if (existing) {
      if (existing.fingerprint !== fingerprint) throw Object.assign(new Error('Idempotency key was already used for another mutation'), { status: 409 });
      return { ...existing.result, duplicate: true };
    }
    const entry = [...this.examPlans.entries()].find(([, plan]) => plan.id === planId);
    if (!entry) throw Object.assign(new Error('Exam plan not found'), { status: 404 });
    const [studentId, plan] = entry;
    if (plan.withdrawn_at) throw Object.assign(new Error('Current exam plan not found'), { status: 404 });
    let resultPayload;
    try {
      const transition = applyExamTransition({ plan, to: toState, actor: actorId, today, result, note, suggestedOn });
      this.examPlans.set(studentId, transition.plan);
      this.examHistoryRows.push({
        id: `preview-exam-history-${this.examHistoryRows.length + 1}`,
        exam_plan_id: plan.id,
        student_id: studentId,
        from_state: plan.state,
        to_state: toState,
        result: result || null,
        accepted: true,
        reason: note || null,
        actor_role: effectiveRole,
        created_at: new Date().toISOString(),
      });
      if (transition.effects.reminder?.state === 'scheduled') {
        const existingReminder = [...this.reminders.values()].find(row => row.exam_plan_id === plan.id);
        const reminder = existingReminder || {
          id: `00000000-0000-4000-a000-${String(this.reminders.size + 1).padStart(12, '0')}`,
          student_id: studentId,
          exam_plan_id: plan.id,
          created_at: new Date().toISOString(),
        };
        Object.assign(reminder, transition.effects.reminder, { cancelled_reason: null });
        this.reminders.set(reminder.id, reminder);
      } else if (transition.effects.reminder?.state === 'cancelled') {
        for (const reminder of this.reminders.values()) {
          if (reminder.exam_plan_id !== plan.id || !['scheduled', 'due'].includes(reminder.state)) continue;
          reminder.state = 'cancelled';
          reminder.cancelled_reason = transition.effects.reminder.cancelled_reason;
          for (const notification of this.notifications.values()) {
            if (notification.reminder_id === reminder.id && ['pending', 'failed', 'sending'].includes(notification.state)) {
              notification.state = 'cancelled';
              notification.locked_by = null;
              notification.locked_at = null;
              notification.last_error = transition.effects.reminder.cancelled_reason;
            }
          }
        }
      }
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
  async withdrawExamPlan({ planId, today, actorId, actorRole, reason, requestId }) {
    const fingerprint = JSON.stringify({ planId, today, actorId, actorRole, reason });
    const existing = this.examWithdrawals.get(requestId);
    if (existing) {
      if (existing.fingerprint !== fingerprint) throw Object.assign(new Error('Idempotency key was already used for another mutation'), { status: 409 });
      return { ...existing.result, duplicate: true };
    }
    const entry = [...this.examPlans.entries()].find(([, plan]) => plan.id === planId && !plan.withdrawn_at);
    if (!entry) throw Object.assign(new Error('Current exam plan not found'), { status: 404 });
    const [studentId, plan] = entry;
    const allowed = plan.state !== 'passed' && (
      ['missionaccounts_admin', 'founder'].includes(actorRole)
      || (actorRole === 'student' && actorId === studentId)
    );
    if (!allowed) {
      const result = { accepted: false, plan: { ...plan }, audit_event_id: `preview-exam-withdraw-audit-${this.examWithdrawals.size + 1}` };
      this.examWithdrawals.set(requestId, { fingerprint, result });
      return result;
    }
    let closedGraceWindows = 0;
    if (['approved', 'followup'].includes(plan.state)) closedGraceWindows = 1;
    plan.withdrawn_at = new Date().toISOString();
    plan.withdrawn_by = actorId;
    this.examHistoryRows.push({
      id: `preview-exam-history-${this.examHistoryRows.length + 1}`,
      exam_plan_id: plan.id,
      student_id: studentId,
      from_state: plan.state,
      to_state: 'withdrawn',
      result: null,
      accepted: true,
      reason,
      actor_role: actorRole,
      created_at: plan.withdrawn_at,
    });
    for (const reminder of this.reminders.values()) {
      if (reminder.exam_plan_id !== plan.id || !['scheduled', 'due'].includes(reminder.state)) continue;
      reminder.state = 'cancelled';
      reminder.cancelled_reason = 'plan_withdrawn';
      for (const notification of this.notifications.values()) {
        if (notification.reminder_id === reminder.id && ['pending', 'failed', 'sending'].includes(notification.state)) {
          notification.state = 'cancelled';
          notification.locked_by = null;
          notification.locked_at = null;
          notification.last_error = 'plan_withdrawn';
        }
      }
    }
    const result = {
      accepted: true,
      plan: { ...plan },
      closed_grace_windows: closedGraceWindows,
      attendance_recompute: closedGraceWindows ? { trigger: `${requestId}:exam-plan-withdrawn`, today } : null,
      audit_event_id: `preview-exam-withdraw-audit-${this.examWithdrawals.size + 1}`,
    };
    this.examWithdrawals.set(requestId, { fingerprint, result });
    return result;
  }
  async setCyclePolicy({ cycleKey, decision, reason, actorId, requestId }) {
    const fingerprint = JSON.stringify({ cycleKey, decision, reason, actorId });
    const existing = this.policyMutations.get(requestId);
    if (existing) {
      if (existing.fingerprint !== fingerprint) throw Object.assign(new Error('Idempotency key was already used for another mutation'), { status: 409 });
      return { ...existing.result, duplicate: true };
    }
    const prior = this.cyclePolicies.get(cycleKey) || null;
    const ordinal = this.policyMutations.size + 1;
    const policy = {
      id: `preview-cycle-policy-${ordinal}`,
      cycle_key: cycleKey,
      key: 'cap_13_15',
      value: { decision },
      set_by: actorId,
      reason,
      request_id: requestId,
      superseded_by_id: null,
    };
    if (prior) prior.superseded_by_id = policy.id;
    this.cyclePolicies.set(cycleKey, policy);
    let staleDecisions = 0;
    for (const [key, billingDecision] of this.billingDecisions) {
      if (key.endsWith(`:${cycleKey}`) && billingDecision.state === 'approved') {
        this.billingDecisions.set(key, { ...billingDecision, state: 'stale' });
        staleDecisions += 1;
      }
    }
    const result = {
      accepted: true,
      policy,
      stale_decisions: staleDecisions,
      audit_event_id: `preview-cycle-policy-audit-${ordinal}`,
    };
    this.policyMutations.set(requestId, { fingerprint, result });
    return result;
  }
  seedAttendanceDays(studentId, cycleKey, days) {
    this.attendanceDays.set(`${studentId}:${cycleKey}`, days.map(day => ({ ...day })));
  }
  seedBillingCap(studentId, cycleKey, cap) {
    this.billingCaps.set(`${studentId}:${cycleKey}`, { student_id: studentId, cycle_key: cycleKey, ...cap });
  }
  async decideFullCycleCeiling({ studentId, cycleKey, status, reason, actorId, actorRole, requestId }) {
    if (!['missionaccounts_admin', 'founder'].includes(actorRole)) throw Object.assign(new Error('Full-cycle ceiling requires administrator authority'), { status: 403 });
    const fingerprint = JSON.stringify({ studentId, cycleKey, status, reason, actorId, actorRole });
    const existing = this.billingCapMutations.get(requestId);
    if (existing) {
      if (existing.fingerprint !== fingerprint) throw Object.assign(new Error('Idempotency key was already used for another mutation'), { status: 409 });
      return { ...existing.result, duplicate: true };
    }
    const key = `${studentId}:${cycleKey}`;
    const current = this.billingCaps.get(key);
    if (!current) throw Object.assign(new Error('Full-cycle ceiling candidate not found'), { status: 404 });
    if (current.status === status) throw Object.assign(new Error('Full-cycle ceiling state is unchanged'), { status: 409 });
    const ordinal = this.billingCapMutations.size + 1;
    const ceiling = {
      ...current,
      id: `preview-cap-decision-${ordinal}`,
      status,
      verified: status === 'verified',
      ceiling_cents: 30_000,
      decided_by: actorId,
      reason,
    };
    this.billingCaps.set(key, ceiling);
    let staleDecisions = 0;
    const decision = this.billingDecisions.get(key);
    if (decision?.state === 'approved') {
      decision.state = 'stale';
      staleDecisions = 1;
    }
    const result = {
      ceiling,
      audit_event_id: `preview-cap-audit-${ordinal}`,
      stale_decisions: staleDecisions,
      void_invoices: staleDecisions,
    };
    this.billingCapMutations.set(requestId, { fingerprint, result });
    return { ...result, duplicate: false };
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
    const billableCount = days.filter(day => day.kind === 'billable').length;
    const rawAmount = billableCount * 2_500;
    const cycleCapDecision = this.cyclePolicies.get(cycleKey)?.value?.decision || null;
    let rejection = null;
    if (days.some(day => day.kind === 'needs_review')) rejection = 'attendance_requires_review';
    else if (treatment === 'fullcycle' && cap?.verified !== true) rejection = 'verified_full_cycle_ceiling_required';
    else if (treatment === 'confirm' && billableCount >= 13 && billableCount <= 15 && !['cap', 'per'].includes(cycleCapDecision)) rejection = 'cycle_cap_policy_requires_review';
    else if (cap?.status === 'candidate' && rawAmount > 30_000 && !(billableCount >= 13 && billableCount <= 15 && cycleCapDecision === 'cap')) rejection = 'cap_candidate_requires_review';
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
    if (treatment === 'confirm' && billableCount >= 13 && billableCount <= 15 && cycleCapDecision === 'cap') amountCents = 30_000;
    if (cap?.verified === true) amountCents = Math.min(amountCents, Number(cap.ceiling_cents || 30_000));
    const basis = buildDecisionBasis(days, { treatment, amount_cents: amountCents, cap, cycle_cap_13_15: cycleCapDecision });
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
    const invoice = amountCents > 0 ? {
      id: `20000000-0000-4000-9000-${String(ordinal).padStart(12, '0')}`,
      student_id: studentId,
      cycle_key: cycleKey,
      decision_id: decision.id,
      state: 'draft',
      amount_cents: amountCents,
      lines: { total_cents: amountCents },
    } : null;
    const result = { accepted: true, decision, invoice, audit_event_id: `preview-billing-audit-${ordinal}` };
    this.billingDecisions.set(`${studentId}:${cycleKey}`, decision);
    for (const [id, existingInvoice] of this.invoices) {
      if (existingInvoice.student_id === studentId && existingInvoice.cycle_key === cycleKey && ['draft', 'ready'].includes(existingInvoice.state)) {
        this.invoices.set(id, { ...existingInvoice, state: 'void' });
      }
    }
    if (invoice) this.invoices.set(invoice.id, invoice);
    this.billingMutations.set(requestId, { fingerprint, result });
    return result;
  }
  async setInvoiceReadiness({ invoiceId, ready, reason, actorId, actorRole, requestId }) {
    if (!['missionaccounts_admin', 'founder'].includes(actorRole)) throw Object.assign(new Error('Invoice readiness requires administrator authority'), { status: 403 });
    const fingerprint = JSON.stringify({ invoiceId, ready, reason, actorId, actorRole });
    const existingMutation = this.invoiceReadinessMutations.get(requestId);
    if (existingMutation) {
      if (existingMutation.fingerprint !== fingerprint) throw Object.assign(new Error('Idempotency key was already used for another mutation'), { status: 409 });
      return { ...existingMutation.result, duplicate: true };
    }
    const invoice = this.invoices.get(invoiceId);
    if (!invoice) throw Object.assign(new Error('Invoice not found'), { status: 404 });
    let rejection = null;
    const decision = this.billingDecisions.get(`${invoice.student_id}:${invoice.cycle_key}`);
    if (!['draft', 'ready'].includes(invoice.state)) rejection = 'invoice_state_is_final';
    else if (ready && !this.previewStudentRecord.email) rejection = 'student_email_required';
    else if (ready && (!decision || decision.id !== invoice.decision_id || decision.state !== 'approved' || decision.amount_cents !== invoice.amount_cents)) rejection = 'current_approved_decision_required';
    const nextInvoice = rejection ? invoice : { ...invoice, state: ready ? 'ready' : 'draft' };
    if (!rejection) this.invoices.set(invoiceId, nextInvoice);
    const ordinal = this.invoiceReadinessMutations.size + 1;
    const result = {
      accepted: !rejection,
      reason: rejection,
      invoice: nextInvoice,
      audit_event_id: `preview-invoice-readiness-audit-${ordinal}`,
    };
    this.invoiceReadinessMutations.set(requestId, { fingerprint, result });
    return { ...result, duplicate: false };
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
    else if (!(decision.basis?.day_states || decision.basis?.days || []).some(item => item.id === attendanceDayId && item.kind === 'billable')) rejection = 'attendance_day_not_in_approved_basis';
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
  async claimDueDayCharges({ now, workerId, limit }) {
    const nowMs = Date.parse(now);
    if (!Number.isFinite(nowMs) || !workerId || !Number.isInteger(limit) || limit < 1 || limit > 25) {
      throw Object.assign(new Error('Invalid automatic charge claim'), { status: 400 });
    }
    let expired = 0;
    const claimable = [];
    for (const [key, days] of this.attendanceDays) {
      const [studentId, cycleKey] = key.split(':');
      const decision = this.billingDecisions.get(key);
      const method = this.paymentMethods.get(studentId);
      const consent = this.billingConsents.get(studentId);
      for (const day of days) {
        let dispatch = this.autoChargeDispatches.get(day.id);
        const existingCharge = this.chargesByDay.get(day.id);
        const computedMs = Date.parse(day.computed_at || '');
        const prerequisites = this.previewStudentRecord.id === studentId
          && this.previewStudentRecord.identity_state === 'verified'
          && day.kind === 'billable'
          && decision?.state === 'approved'
          && decision?.treatment === 'confirm'
          && (decision.basis?.day_states || decision.basis?.days || []).some(item => item.id === day.id && item.kind === 'billable')
          && method?.status === 'on_file'
          && consent?.state === 'authorized'
          && (!existingCharge || (dispatch?.state === 'claimed' && existingCharge.state === 'pending'));
        if (!prerequisites || !Number.isFinite(computedMs)) continue;
        const ageHours = (nowMs - computedMs) / 3_600_000;
        if (ageHours > 48) {
          const exceptionKey = `missionaccounts:auto-charge-window:${day.id}:v1`;
          if (!this.integrationExceptions.has(exceptionKey)) {
            this.integrationExceptions.set(exceptionKey, {
              id: `preview-integration-exception-${this.integrationExceptions.size + 1}`,
              provider: 'stripe', kind: 'automatic_charge_window_missed', student_id: studentId,
              attendance_day_id: day.id, state: 'open', idempotency_key: exceptionKey,
            });
            expired += 1;
          }
          if (dispatch && ['eligible', 'claimed'].includes(dispatch.state)) dispatch.state = 'expired';
          continue;
        }
        if (ageHours < 24) continue;
        if (!dispatch) {
          dispatch = {
            id: `preview-auto-charge-dispatch-${this.autoChargeDispatches.size + 1}`,
            attendance_day_id: day.id,
            state: 'eligible', idempotency_key: `missionaccounts:auto-charge:${day.id}:v1`,
            attempt_count: 0,
          };
          this.autoChargeDispatches.set(day.id, dispatch);
        }
        const staleClaim = dispatch.state === 'claimed'
          && Date.parse(dispatch.locked_at || '') < nowMs - 600_000;
        if (dispatch.state === 'eligible' || staleClaim) claimable.push({ dispatch, studentId, cycleKey, day });
      }
    }
    const claimed = [];
    for (const { dispatch, day } of claimable.slice(0, limit)) {
      dispatch.state = 'claimed';
      dispatch.worker_id = workerId;
      dispatch.locked_at = now;
      dispatch.attempt_count += 1;
      const prepared = await this.prepareDayCharge({
        attendanceDayId: day.id,
        actorId: 'missionaccounts:auto-charge',
        actorRole: 'service',
        requestId: dispatch.idempotency_key,
        explicitRetry: false,
      });
      if (!prepared.accepted) {
        dispatch.state = 'failed';
        dispatch.last_error = prepared.reason;
        continue;
      }
      claimed.push({
        dispatch_id: dispatch.id,
        attendance_day_id: day.id,
        customer_ref: prepared.customer_ref,
        payment_method_ref: prepared.payment_method_ref,
        charge: prepared.charge,
      });
    }
    return { claimed, expired, now };
  }
  async finishAutoChargeDispatch({ dispatchId, workerId, succeeded, providerRef, error, now }) {
    const dispatch = [...this.autoChargeDispatches.values()].find(item => item.id === dispatchId);
    if (!dispatch || dispatch.state !== 'claimed' || dispatch.worker_id !== workerId) {
      throw Object.assign(new Error('Automatic charge claim mismatch'), { status: 409 });
    }
    const charge = this.chargesByDay.get(dispatch.attendance_day_id);
    if (!charge) throw Object.assign(new Error('Automatic charge not found'), { status: 409 });
    dispatch.worker_id = null;
    dispatch.locked_at = null;
    if (succeeded) {
      dispatch.state = 'submitted';
      dispatch.provider_ref = providerRef;
      dispatch.submitted_at = now;
      charge.provider_ref = providerRef;
    } else {
      dispatch.state = 'failed';
      dispatch.last_error = error;
      charge.state = 'failed';
      const exceptionKey = `${dispatch.idempotency_key}:submission-failed`;
      this.integrationExceptions.set(exceptionKey, {
        id: `preview-integration-exception-${this.integrationExceptions.size + 1}`,
        provider: 'stripe', kind: 'automatic_charge_submission_failed',
        student_id: charge.student_id, attendance_day_id: charge.attendance_day_id,
        state: 'open', idempotency_key: exceptionKey,
      });
      for (const audience of ['student', 'missionaccounts_admin']) {
        this.seedNotification({
          student_id: charge.student_id, audience, event_kind: 'charge.failed',
          idempotency_key: `${dispatch.idempotency_key}:charge-failed-${audience}`,
          payload: { attendance_day_id: charge.attendance_day_id, amount_cents: charge.amount_cents, state: 'failed' },
        });
      }
    }
    return { accepted: true, duplicate: false, dispatch: { ...dispatch }, charge: { ...charge } };
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
      reminder_id: notification.reminder_id || null,
      channel: notification.channel || 'matrix',
      audience: notification.audience || 'student',
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

  async enqueueDueExamReminders({ today, now, limit }) {
    const due = [...this.reminders.values()]
      .filter(reminder => ['scheduled', 'due'].includes(reminder.state) && reminder.due_on <= today)
      .filter(reminder => ![...this.notifications.values()].some(notification => notification.reminder_id === reminder.id && notification.state !== 'cancelled'))
      .sort((left, right) => left.due_on.localeCompare(right.due_on) || left.id.localeCompare(right.id))
      .slice(0, limit);
    for (const reminder of due) {
      reminder.state = 'due';
      const cancelled = [...this.notifications.values()].find(notification => notification.reminder_id === reminder.id && notification.state === 'cancelled');
      const notification = cancelled || this.seedNotification({
        id: `preview-reminder-notification-${this.notifications.size + 1}`,
        student_id: reminder.student_id,
        reminder_id: reminder.id,
        audience: 'student',
        event_kind: 'exam_result_checkin',
        idempotency_key: `${reminder.id}:exam-result-checkin`,
      });
      Object.assign(notification, {
        student_id: reminder.student_id,
        reminder_id: reminder.id,
        channel: 'matrix',
        audience: 'student',
        event_kind: 'exam_result_checkin',
        payload: {
          student_id: reminder.student_id,
          exam_plan_id: reminder.exam_plan_id,
          reminder_id: reminder.id,
          due_on: reminder.due_on,
        },
        state: 'pending',
        available_at: now,
        sent_at: null,
        locked_by: null,
        locked_at: null,
        provider_ref: null,
        last_error: null,
      });
    }
    return { selected: due.length, queued: due.length, today, now };
  }

  async notificationDeliverable({ notificationId }) {
    const notification = this.notifications.get(notificationId);
    if (!notification || notification.state !== 'sending') return false;
    if (!notification.reminder_id) return true;
    return ['scheduled', 'due'].includes(this.reminders.get(notification.reminder_id)?.state);
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
    if (succeeded && row.reminder_id) {
      const reminder = this.reminders.get(row.reminder_id);
      if (reminder && ['scheduled', 'due'].includes(reminder.state)) reminder.state = 'sent';
    }
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
    const { matrix_user_ref: _matrixUserRef, ...student } = this.previewStudentRecord;
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
    const examPlans = [...this.examPlans.values()].filter(plan => !plan.withdrawn_at);
    return {
      questions: students.filter(student => student.identity_state === 'needs_review').length
        + [...this.identityClusters.values()].filter(cluster => cluster.state === 'open').length,
      identity_questions: [...this.identityClusters.values()].filter(cluster => cluster.state === 'open').length,
      missing_payment_setup: students.filter(student => student.payment_method?.status !== 'on_file' || student.billing_consent?.state !== 'authorized').length,
      stale_decisions: [...this.billingDecisions.values()].filter(decision => decision.state === 'stale').length,
      ready_invoices: [...this.invoices.values()].filter(invoice => invoice.state === 'ready').length,
      pending_exam_plans: examPlans.filter(plan => ['pending', 'speak'].includes(plan.state)).length,
      upcoming_exam_plans: examPlans.filter(plan => plan.state === 'approved' && plan.exam_on >= today),
      due_reminders: [],
    };
  }
  async adminCycle(cycleKey) {
    const attendance = [...this.attendanceDays.entries()].filter(([key]) => key.endsWith(`:${cycleKey}`)).flatMap(([, days]) => days);
    const decisions = [...this.billingDecisions.entries()].filter(([key]) => key.endsWith(`:${cycleKey}`)).map(([, decision]) => decision);
    const policy = this.cyclePolicies.get(cycleKey);
    return {
      cycle: { key: cycleKey, label: cycleKey, starts_on: null, ends_on: null, state: 'preview' },
      attendance_days: attendance,
      billing_decisions: decisions,
      invoices: [...this.invoices.values()].filter(invoice => invoice.cycle_key === cycleKey),
      policies: policy ? [{ ...policy }] : [],
    };
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
      exam_plan: await this.currentExamPlanForStudent(studentId),
    };
  }
  async adminHealth() {
    return {
      mode: 'preview', review_students: null, failed_provider_events: null,
      failed_notifications: null, open_integration_exceptions: this.integrationExceptions.size,
      latest_zoom_sync: null,
    };
  }
}
