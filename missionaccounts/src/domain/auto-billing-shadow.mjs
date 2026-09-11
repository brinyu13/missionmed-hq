function validEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || '').trim().toLowerCase());
}

function array(value) {
  return Array.isArray(value) ? value : [];
}

function key(studentId, cycleKey) {
  return `${studentId}:${cycleKey}`;
}

function currentBy(rows, keyOf) {
  return new Map(array(rows).filter(row => row && !row.superseded_by_id).map(row => [keyOf(row), row]));
}

function reasonCount(rows, reason) {
  return rows.filter(row => row.reasons.includes(reason)).length;
}

export function buildAutomaticBillingShadow({
  now,
  attendanceDays = [],
  students = [],
  billingDecisions = [],
  paymentMethods = [],
  billingConsents = [],
  charges = [],
  ruleDecisions = [],
} = {}) {
  const evaluatedAt = new Date(now);
  if (!Number.isFinite(evaluatedAt.getTime())) throw new Error('Automatic-billing shadow requires an evaluation time');
  const nowMs = evaluatedAt.getTime();
  const studentById = new Map(array(students).map(row => [row.id, row]));
  const decisionByStudentCycle = currentBy(billingDecisions, row => key(row.student_id, row.cycle_key));
  const paymentMethodByStudent = new Map(array(paymentMethods).map(row => [row.student_id, row]));
  const consentByStudent = currentBy(billingConsents, row => row.student_id);
  const chargeByDay = new Map(array(charges).map(row => [row.attendance_day_id, row]));
  const reservedByStudentCycle = new Map();
  for (const charge of array(charges)) {
    if (!['pending', 'succeeded'].includes(charge.state)) continue;
    const day = array(attendanceDays).find(row => row.id === charge.attendance_day_id);
    if (!day) continue;
    const chargeKey = key(day.student_id, day.cycle_key);
    reservedByStudentCycle.set(chargeKey, (reservedByStudentCycle.get(chargeKey) || 0) + Number(charge.amount_cents || 0));
  }
  const activeRules = array(ruleDecisions).filter(row => row.rule === 'one_charge_per_calendar_day' && !row.superseded_by_id);

  const rows = array(attendanceDays)
    .filter(day => !day.superseded_at)
    .map(day => {
      const student = studentById.get(day.student_id) || {};
      const decision = decisionByStudentCycle.get(key(day.student_id, day.cycle_key));
      const method = paymentMethodByStudent.get(day.student_id);
      const consent = consentByStudent.get(day.student_id);
      const priorCharge = chargeByDay.get(day.id);
      const computedMs = Date.parse(day.computed_at);
      const ageMs = Number.isFinite(computedMs) ? nowMs - computedMs : Number.POSITIVE_INFINITY;
      const withinWindow = ageMs >= 24 * 60 * 60 * 1000 && ageMs <= 48 * 60 * 60 * 1000;
      const windowState = ageMs < 24 * 60 * 60 * 1000 ? 'not_yet_due'
        : ageMs > 48 * 60 * 60 * 1000 ? 'expired'
          : 'eligible';
      const approvedBasis = Boolean(decision && array(decision.basis?.days).some(item => (
        item?.id === day.id && item?.kind === 'billable'
      )));
      const ruleActive = activeRules.some(rule => String(rule.effective_from || '') <= String(day.day || ''));
      const reserved = reservedByStudentCycle.get(key(day.student_id, day.cycle_key)) || 0;
      const approvedCapacity = Boolean(decision) && reserved + 2500 <= Number(decision.amount_cents || 0);
      const reasons = [];
      if (day.kind !== 'billable') reasons.push(`attendance_day_${day.kind || 'not_billable'}`);
      if (student.identity_state !== 'verified') reasons.push('student_identity_requires_review');
      if ((student.sponsor_type || 'DIRECT') !== 'DIRECT') reasons.push('sponsored_direct_liability_blocked');
      if (!decision || decision.state !== 'approved') reasons.push('approved_billing_decision_required');
      else if (decision.treatment !== 'confirm') reasons.push('per_day_billing_decision_required');
      else if (!approvedBasis) reasons.push('attendance_day_not_in_approved_basis');
      if (!method || method.status !== 'on_file') reasons.push('payment_method_required');
      if (!consent || consent.state !== 'authorized') reasons.push('billing_authorization_required');
      if (!validEmail(student.email)) reasons.push('student_receipt_email_required');
      if (!ruleActive) reasons.push('one_charge_per_calendar_day_rule_required');
      if (!withinWindow) reasons.push(windowState === 'expired' ? 'automatic_charge_window_missed' : 'automatic_charge_window_not_open');
      if (priorCharge) {
        const priorReason = {
          failed: 'explicit_retry_required',
          succeeded: 'charge_already_succeeded',
          refunded: 'refunded_day_requires_review',
          pending: 'charge_already_pending',
        }[priorCharge.state] || 'prior_charge_requires_review';
        reasons.push(priorReason);
      }
      if (decision && !approvedCapacity) reasons.push('approved_amount_exhausted');
      const needsReview = reasons.some(reason => (
        reason === 'student_identity_requires_review'
        || reason === 'approved_billing_decision_required'
        || reason === 'attendance_day_not_in_approved_basis'
        || reason === 'explicit_retry_required'
        || reason === 'refunded_day_requires_review'
        || reason === 'prior_charge_requires_review'
        || reason === 'attendance_day_needs_review'
      ));
      return {
        student_id: day.student_id,
        student: String(student.display_name || 'Unresolved student'),
        date: day.day,
        cycle_key: day.cycle_key,
        attendance_day_id: day.id,
        attendance_evidence: day.same_day_multiple_events ? 'multiple_events_one_day' : 'one_or_more_effective_events',
        billable_status: day.kind,
        sponsor: student.sponsor_type || 'DIRECT',
        recommended_amount_cents: day.kind === 'billable' ? 2500 : 0,
        approved_amount_cents: decision?.state === 'approved' ? Number(decision.amount_cents || 0) : null,
        payment_method_status: method?.status || 'missing',
        payment_method_last4: method?.status === 'on_file' ? String(method.last4 || '') : null,
        consent_state: consent?.state || 'missing',
        active_enrollment_gate: null,
        window_state: windowState,
        prior_charge_state: priorCharge?.state || null,
        status: reasons.length === 0 ? 'WOULD_CHARGE' : needsReview ? 'NEEDS_REVIEW' : 'WOULD_NOT_CHARGE',
        reasons,
      };
    })
    .sort((left, right) => String(left.date).localeCompare(String(right.date))
      || String(left.student).localeCompare(String(right.student))
      || String(left.attendance_day_id).localeCompare(String(right.attendance_day_id)));

  const wouldCharge = rows.filter(row => row.status === 'WOULD_CHARGE');
  return {
    schema_version: 'missionaccounts-auto-billing-shadow-v1',
    evaluated_at: evaluatedAt.toISOString(),
    live_money_moved_cents: 0,
    live_dispatch_enabled: false,
    contract: {
      amount_per_billable_day_cents: 2500,
      dispatch_window_hours: [24, 48],
      active_enrollment_gate: 'absent_from_current_charge_contract',
      failed_charge_retry: 'explicit_human_action_required',
    },
    summary: {
      candidates: rows.length,
      would_charge_students: new Set(wouldCharge.map(row => row.student_id)).size,
      would_charge_days: wouldCharge.length,
      would_charge_total_cents: wouldCharge.reduce((sum, row) => sum + row.recommended_amount_cents, 0),
      sponsored_excluded: rows.filter(row => row.reasons.includes('sponsored_direct_liability_blocked')).length,
      unresolved_or_review: rows.filter(row => row.status === 'NEEDS_REVIEW').length,
      missing_payment_method: reasonCount(rows, 'payment_method_required'),
      missing_consent: reasonCount(rows, 'billing_authorization_required'),
      other_excluded: rows.filter(row => row.status === 'WOULD_NOT_CHARGE'
        && !row.reasons.includes('sponsored_direct_liability_blocked')
        && !row.reasons.includes('payment_method_required')
        && !row.reasons.includes('billing_authorization_required')).length,
    },
    rows,
  };
}
