import { assertIsoDay } from './billing-engine.mjs';

const TRANSITIONS = {
  pending: new Set(['approved', 'speak', 'denied']),
  speak: new Set(['approved', 'denied']),
  denied: new Set(['pending', 'approved']),
  approved: new Set(['passed', 'followup', 'denied', 'pending']),
  followup: new Set(['approved', 'passed', 'followup', 'pending']),
  passed: new Set(['pending']),
};

export function thirdWednesdayAfter(examOn) {
  const source = new Date(`${assertIsoDay(examOn, 'exam_on')}T12:00:00Z`);
  let count = 0;
  for (let offset = 1; offset <= 35; offset += 1) {
    const candidate = new Date(source);
    candidate.setUTCDate(candidate.getUTCDate() + offset);
    if (candidate.getUTCDay() === 3) count += 1;
    if (count === 3) return candidate.toISOString().slice(0, 10);
  }
  throw new Error('third Wednesday could not be calculated');
}

export function transitionExamPlan({ plan, to, actor, today, result = null, note = null, suggestedOn = null }) {
  if (!plan?.id || !TRANSITIONS[plan.state]?.has(to)) {
    throw new Error(`invalid exam transition ${plan?.state || 'none'} -> ${to}`);
  }
  const at = new Date().toISOString();
  const day = assertIsoDay(today, 'today');
  const audit = {
    kind: 'exam_plan.transition',
    subject_student_id: plan.student_id,
    from_val: plan.state,
    to_val: to,
    reason: note,
    actor,
    at,
  };
  const next = { ...plan, state: to, result, note, decided_by: actor, decided_at: at };
  if (to === 'denied') next.suggested_on = suggestedOn;
  else if (['approved', 'pending'].includes(to)) next.suggested_on = null;
  const effects = { audit, open_grace: null, close_grace: null, reminder: null };

  if (to === 'approved') {
    effects.open_grace = { exam_plan_id: plan.id, student_id: plan.student_id, from_on: plan.exam_on };
    effects.reminder = {
      exam_plan_id: plan.id,
      student_id: plan.student_id,
      due_on: thirdWednesdayAfter(plan.exam_on),
      state: 'scheduled',
      idempotency_key: `${plan.id}:exam-result-checkin`,
    };
  } else if (
    to === 'passed'
    || (['denied', 'pending'].includes(to) && ['approved', 'followup'].includes(plan.state))
    || (to === 'followup' && result)
  ) {
    effects.close_grace = {
      exam_plan_id: plan.id,
      to_on: day,
      closed_reason: to === 'passed' ? 'passed' : result || to,
      closed_at: at,
    };
    effects.reminder = {
      exam_plan_id: plan.id,
      state: 'cancelled',
      cancelled_reason: to === 'passed' ? 'result_recorded' : 'plan_changed',
      idempotency_key: `${plan.id}:exam-result-checkin`,
    };
    if (to === 'passed') next.passed_on = day;
  }

  return { plan: next, effects };
}
