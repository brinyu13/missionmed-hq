export const EXAMPREP_CONTRACT_VERSION = 'examprep-business-contract-2026-09-16-v1';
export const EXAMPREP_CONTRACT_SHA256 = 'd57b8d8486f0be0741132d474130dcdbe4e8d600138081a1b4e62e88005d503d';

export const EXAMPREP_OFFERS = Object.freeze({
  tutoring_hourly: Object.freeze({ amount_cents: 8500, unit: 'hour' }),
  tutoring_planning: Object.freeze({ amount_cents: 5000, unit: '30_minutes' }),
  tutoring_ten_pack: Object.freeze({ amount_cents: 80000, unit: 'ten_sessions' }),
  live_group_monthly: Object.freeze({ amount_cents: 30000, unit: 'month_prepaid' }),
  live_group_pay_go: Object.freeze({ amount_cents: 2500, unit: 'distinct_attended_billable_day' }),
  daily_drills_addon: Object.freeze({ amount_cents: 1999, unit: 'month' }),
  daily_drills_standalone: Object.freeze({ amount_cents: 9999, unit: 'month' }),
  daily_drills_audio_notes: Object.freeze({ amount_cents: 14999, unit: 'month' }),
});

export const PRIVATE_DAILY_DRILLS_AMOUNT_CENTS = 3999;
export const TRIAL_ATTENDED_DAY_LIMIT = 5;
export const SELECTABLE_LIVE_GROUP_PLANS = Object.freeze(['monthly', 'pay_go']);

export function normalizeCommercePlan(value) {
  const plan = String(value || '').trim().toLowerCase();
  if (!SELECTABLE_LIVE_GROUP_PLANS.includes(plan)) {
    throw Object.assign(new Error('Choose the $300 monthly plan or $25 pay-go plan.'), { status: 400, field: 'plan' });
  }
  return plan;
}

export function commercePlanState({
  attendedDays = [], overrideGranted = false, selection = null,
  existingPlan = null, liveGroupEligible = true,
} = {}) {
  const distinct = [...new Set(attendedDays.map(String).filter(day => /^\d{4}-\d{2}-\d{2}$/.test(day)))].sort();
  const used = overrideGranted ? 0 : Math.min(distinct.length, TRIAL_ATTENDED_DAY_LIMIT);
  const remaining = Math.max(0, TRIAL_ATTENDED_DAY_LIMIT - used);
  const inherited = SELECTABLE_LIVE_GROUP_PLANS.includes(existingPlan) ? existingPlan : null;
  const selected = inherited || (SELECTABLE_LIVE_GROUP_PLANS.includes(selection) ? selection : null);
  const eligible = liveGroupEligible === true || inherited !== null;
  return Object.freeze({
    eligible,
    attended_trial_days: eligible ? used : 0,
    trial_days_remaining: eligible ? remaining : TRIAL_ATTENDED_DAY_LIMIT,
    trial_complete: eligible && remaining === 0,
    plan_required: eligible && remaining === 0 && !selected,
    selected_plan: selected,
    selection_source: inherited ? 'existing_active_arrangement' : selected ? 'explicit_5404e_selection' : null,
    state: !eligible ? 'NOT_ELIGIBLE' : selected ? selected.toUpperCase() : remaining === 0 ? 'PLAN_REQUIRED' : 'TRIAL',
  });
}

export function contractPublicSummary() {
  return {
    version: EXAMPREP_CONTRACT_VERSION,
    sha256: EXAMPREP_CONTRACT_SHA256,
    prices: EXAMPREP_OFFERS,
    trial: {
      attended_day_limit: TRIAL_ATTENDED_DAY_LIMIT,
      absences_count: false,
      same_day_sessions_count: 1,
      automatic_conversion: false,
      automatic_charge: false,
    },
    automatic_billing_dispatch: false,
    hosted_invoice_sending: false,
  };
}
