const ENTITLEMENT_VERSION = 'MM-SCHED-050';

const COURSE_KEYS = {
  missionResidency360: 'mission_residency_360',
  matchPrepPro: 'match_prep_pro',
  missionResidencyOther: 'mission_residency_other',
  examPrep: 'exam_prep',
};

const DEFAULT_COURSE_MAPPINGS = {
  [COURSE_KEYS.missionResidency360]: ['3893'],
  [COURSE_KEYS.matchPrepPro]: ['5227'],
  [COURSE_KEYS.missionResidencyOther]: ['3646'],
  // Confirmed 2026-05-19 from read-only WordPress metadata:
  // 3653/3655 are LearnDash ExamPrep courses; 3651/3652 are matching Woo products.
  [COURSE_KEYS.examPrep]: ['3653', '3655', '3651', '3652'],
};

const DIVISIONS = [
  {
    id: 'non-member',
    label: 'Non-Member',
    appointment_type_slugs: ['consult-non-member'],
  },
  {
    id: 'mission-residency',
    label: 'Mission Residency',
    appointment_type_slugs: [
      'mission-residency-1-on-1-advising',
      'mission-residency-personal-statement',
      'mission-residency-1-on-1-mock-iv',
      'mission-residency-eras-application-review',
      'mission-residency-small-group-advising',
      'mission-residency-open-door-office-hours',
    ],
  },
  {
    id: 'exam-prep',
    label: 'Exam Prep',
    appointment_type_slugs: [
      'exam-prep-1-on-1-advising',
      'exam-prep-small-group',
    ],
  },
];

const APPOINTMENT_ACCESS_RULES = [
  {
    slug: 'consult-non-member',
    division: 'non-member',
    label: 'Consult: Non-Member',
    grants: ['registered_user'],
    service_cost_credits: 0,
  },
  {
    slug: 'mission-residency-1-on-1-advising',
    division: 'mission-residency',
    label: 'Mission Residency: 1-on-1 Advising',
    grants: [COURSE_KEYS.missionResidency360],
    service_cost_credits: 500,
    quota_bucket: 'mission_residency_1_on_1',
  },
  {
    slug: 'mission-residency-personal-statement',
    division: 'mission-residency',
    label: 'Mission Residency: Personal Statement',
    grants: [COURSE_KEYS.missionResidency360],
    service_cost_credits: 500,
    quota_bucket: 'mission_residency_1_on_1',
  },
  {
    slug: 'mission-residency-1-on-1-mock-iv',
    division: 'mission-residency',
    label: 'Mission Residency: 1-on-1 Mock IV',
    grants: [COURSE_KEYS.missionResidency360],
    service_cost_credits: 500,
    quota_bucket: 'mission_residency_1_on_1',
  },
  {
    slug: 'mission-residency-eras-application-review',
    division: 'mission-residency',
    label: 'Mission Residency: ERAS Application Review',
    grants: [COURSE_KEYS.missionResidency360],
    service_cost_credits: 500,
    quota_bucket: 'mission_residency_1_on_1',
  },
  {
    slug: 'mission-residency-small-group-advising',
    division: 'mission-residency',
    label: 'Mission Residency: Small Group Advising',
    grants: [COURSE_KEYS.missionResidency360, COURSE_KEYS.matchPrepPro],
    service_cost_credits: 250,
    quota_bucket: 'mission_residency_group',
  },
  {
    slug: 'mission-residency-open-door-office-hours',
    division: 'mission-residency',
    label: 'Mission Residency: Open Door Office Hours',
    grants: [COURSE_KEYS.missionResidency360, COURSE_KEYS.matchPrepPro],
    service_cost_credits: 0,
    quota_bucket: 'mission_residency_group',
  },
  {
    slug: 'exam-prep-1-on-1-advising',
    division: 'exam-prep',
    label: 'Exam Prep: 1-on-1 Advising',
    grants: [COURSE_KEYS.examPrep],
    service_cost_credits: 500,
    quota_bucket: 'exam_prep_1_on_1',
  },
  {
    slug: 'exam-prep-small-group',
    division: 'exam-prep',
    label: 'Exam Prep: Small Group',
    grants: [COURSE_KEYS.examPrep],
    service_cost_credits: 250,
    quota_bucket: 'exam_prep_group',
  },
];

const DEFAULT_QUOTA_RULES = [
  {
    id: '360-season-one-on-one',
    course_key: COURSE_KEYS.missionResidency360,
    bucket: 'mission_residency_1_on_1',
    limit: 12,
    reset: 'season',
    status: 'model_ready',
  },
];

const DEFAULT_CREDIT_POOLS = [
  {
    id: '360-monthly',
    course_key: COURSE_KEYS.missionResidency360,
    allocation: 1000,
    reset: 'monthly',
    status: 'model_ready',
  },
];

export function buildSchedulerEntitlementConfig(env = process.env) {
  const configuredMappings = {
    [COURSE_KEYS.missionResidency360]: envList(env.SCHEDULER_ENTITLEMENT_COURSE_360_IDS, DEFAULT_COURSE_MAPPINGS[COURSE_KEYS.missionResidency360]),
    [COURSE_KEYS.matchPrepPro]: envList(env.SCHEDULER_ENTITLEMENT_COURSE_MATCH_PREP_PRO_IDS, DEFAULT_COURSE_MAPPINGS[COURSE_KEYS.matchPrepPro]),
    [COURSE_KEYS.missionResidencyOther]: envList(env.SCHEDULER_ENTITLEMENT_COURSE_MISSION_RESIDENCY_OTHER_IDS, DEFAULT_COURSE_MAPPINGS[COURSE_KEYS.missionResidencyOther]),
    [COURSE_KEYS.examPrep]: envList(env.SCHEDULER_ENTITLEMENT_COURSE_EXAM_PREP_IDS, DEFAULT_COURSE_MAPPINGS[COURSE_KEYS.examPrep]),
  };
  const externalRules = parseJsonConfig(env.SCHEDULER_ENTITLEMENT_RULES_JSON);
  const mode = String(env.SCHEDULER_ENTITLEMENT_MODE || 'model_ready').trim() || 'model_ready';

  return {
    version: ENTITLEMENT_VERSION,
    enabled: envFlag(env.SCHEDULER_ENTITLEMENT_ENABLED, true),
    mode,
    source: 'scheduler_server_entitlements',
    course_mappings: configuredMappings,
    divisions: DIVISIONS,
    appointment_type_rules: Array.isArray(externalRules) ? externalRules : APPOINTMENT_ACCESS_RULES,
    quota_rules: DEFAULT_QUOTA_RULES,
    credit_pools: DEFAULT_CREDIT_POOLS,
    browser_eligibility_trusted: false,
    browser_credits_trusted: false,
    warnings: entitlementConfigWarnings(configuredMappings),
  };
}

export function buildSchedulerEntitlementAdminConfig(env = process.env) {
  const config = buildSchedulerEntitlementConfig(env);
  return {
    ...config,
    admin_controls: {
      division_access_rules: true,
      appointment_type_gating: true,
      course_product_mapping: true,
      tier_rules: true,
      quota_mode_ready: true,
      credit_mode_ready: true,
      manual_adjustments_ready: false,
      persistence: 'env_or_scheduler_tables_required_for_live_editing',
    },
    replacement_contract: {
      preferred_source: 'server-side LearnDash/WooCommerce/Matrix entitlement facts',
      required_session_fields: ['course_ids', 'tier_keys', 'division_keys'],
      fail_closed_for_unknown_restricted_access: true,
      non_member_consult_available_to_registered_users: true,
    },
  };
}

export function schedulerEntitlementPolicySummary(env = process.env) {
  const config = buildSchedulerEntitlementConfig(env);
  return {
    enabled: config.enabled,
    mode: config.mode,
    source: config.source,
    non_member_consult_enabled: true,
    restricted_types_require_server_facts: true,
    course_mappings_configured: Object.fromEntries(
      Object.entries(config.course_mappings).map(([key, value]) => [key, value.length > 0]),
    ),
    quota_model_ready: true,
    credit_model_ready: true,
    browser_eligibility_trusted: false,
    browser_credits_trusted: false,
  };
}

export function normalizeSchedulerEntitlementFacts(input = {}) {
  const facts = input && typeof input === 'object' && !Array.isArray(input) ? input : {};
  const courseIds = mergeValues(
    facts.course_ids,
    facts.courseIds,
    facts.learndash_course_ids,
    facts.learndashCourseIds,
    facts.enrolled_course_ids,
    facts.enrolledCourseIds,
  );
  const productIds = mergeValues(facts.product_ids, facts.productIds, facts.woocommerce_product_ids, facts.woocommerceProductIds);
  const tierKeys = mergeValues(facts.tier_keys, facts.tierKeys, facts.tiers, facts.tier);
  const divisionKeys = mergeValues(facts.division_keys, facts.divisionKeys, facts.divisions, facts.division);
  const appointmentTypeSlugs = mergeValues(facts.appointment_type_slugs, facts.appointmentTypeSlugs, facts.appointmentTypes);

  return {
    courseIds,
    productIds,
    tierKeys,
    divisionKeys,
    appointmentTypeSlugs,
    quota: objectOrEmpty(facts.quota || facts.quotas),
    credits: objectOrEmpty(facts.credits || facts.credit_pool || facts.creditPool),
    source: String(facts.source || facts.entitlement_source || '').trim() || null,
    configured: Boolean(courseIds.length || productIds.length || tierKeys.length || divisionKeys.length || appointmentTypeSlugs.length),
  };
}

export function resolveSchedulerEntitlementDecision(payload = {}, options = {}) {
  const env = options.env || process.env;
  const config = buildSchedulerEntitlementConfig(env);
  if (!config.enabled) return null;

  const actor = payload.actor || {};
  const appointmentType = payload.appointmentType || payload.appointment_type || {};
  const rule = appointmentAccessRule(appointmentType, config);
  if (!rule) {
    return strictUnknownDecision(config, payload, 'scheduler_entitlement_rule_missing', 'Scheduler entitlement rule is not configured for this appointment type.');
  }

  if (!actor.userId) {
    return entitlementDecision(false, 'authentication_required', rule, payload, 'Registered MissionMed login is required before booking.');
  }

  if (rule.division === 'non-member' || rule.grants.includes('registered_user')) {
    return entitlementDecision(true, 'registered_non_member_consult', rule, payload, 'Registered user can book the non-member consult path.');
  }

  const facts = normalizeSchedulerEntitlementFacts(actor.entitlementFacts || actor.schedulerEntitlements || {});
  if (!facts.configured) {
    return strictUnknownDecision(config, payload, 'scheduler_entitlement_facts_missing', 'Restricted Scheduler booking requires server-side course or product entitlement facts.');
  }

  const grant = matchingGrant(rule, facts, config);
  if (grant) {
    return entitlementDecision(true, `entitlement_${grant}`, rule, payload, 'Scheduler entitlement confirms this appointment type.');
  }

  return entitlementDecision(false, 'scheduler_entitlement_ineligible', rule, payload, 'This account is not entitled to book this appointment type.');
}

export function decorateAppointmentTypesForEntitlements(types = [], actor = {}, options = {}) {
  return types.map((type) => {
    const rule = appointmentAccessRule(type, buildSchedulerEntitlementConfig(options.env || process.env));
    const decision = resolveSchedulerEntitlementDecision({ appointmentType: type, actor }, options);
    const status = decision
      ? decision.eligible ? 'eligible' : decision.status || 'locked'
      : rule ? 'server_facts_pending' : 'rule_missing';
    return {
      ...type,
      division: rule?.division || type.division || type.student_config?.division || null,
      visit_type: rule?.label || type.name || type.slug || type.id,
      entitlement: {
        status,
        locked: decision ? decision.eligible !== true : false,
        reason: decision?.reason || (rule ? 'server_facts_pending' : 'scheduler_entitlement_rule_missing'),
        message: decision?.message || (rule
          ? 'Server-side entitlement facts will be checked before booking.'
          : 'Scheduler entitlement rule is not configured for this appointment type.'),
        quota_bucket: rule?.quota_bucket || null,
        service_cost_credits: rule?.service_cost_credits ?? null,
      },
    };
  });
}

export function schedulerEntitlementBootstrapSummary(actor = {}, env = process.env) {
  const facts = normalizeSchedulerEntitlementFacts(actor.entitlementFacts || {});
  const config = buildSchedulerEntitlementConfig(env);
  return {
    policy: schedulerEntitlementPolicySummary(env),
    facts_configured: facts.configured,
    available_divisions: visibleDivisionsForFacts(facts, config),
    quotas: {
      model_ready: true,
      active: false,
      rules: config.quota_rules,
    },
    credits: {
      model_ready: true,
      active: false,
      pools: config.credit_pools,
    },
  };
}

function visibleDivisionsForFacts(facts = {}, config = buildSchedulerEntitlementConfig()) {
  const divisions = ['non-member'];
  if (hasGrant(COURSE_KEYS.missionResidency360, facts, config) || hasGrant(COURSE_KEYS.matchPrepPro, facts, config)) {
    divisions.push('mission-residency');
  }
  if (hasGrant(COURSE_KEYS.examPrep, facts, config)) {
    divisions.push('exam-prep');
  }
  return divisions;
}

function appointmentAccessRule(appointmentType = {}, config = buildSchedulerEntitlementConfig()) {
  const slug = String(
    appointmentType.slug
      || appointmentType.appointment_type_slug
      || appointmentType.metadata?.slug
      || appointmentType.student_config?.slug
      || '',
  ).trim();
  const rules = config.appointment_type_rules || APPOINTMENT_ACCESS_RULES;
  if (slug) {
    const direct = rules.find((rule) => String(rule.slug) === slug);
    if (direct) return direct;
  }

  const metadata = appointmentType.metadata && typeof appointmentType.metadata === 'object' ? appointmentType.metadata : {};
  const division = metadata.division || appointmentType.division || appointmentType.student_config?.division;
  const visitType = metadata.visit_type || appointmentType.visit_type || appointmentType.student_config?.visit_type;
  if (division && visitType) {
    const normalized = normalizeSlug(`${division}-${visitType}`);
    return rules.find((rule) => normalizeSlug(rule.slug) === normalized || normalizeSlug(rule.label) === normalized) || null;
  }
  return null;
}

function matchingGrant(rule = {}, facts = {}, config = buildSchedulerEntitlementConfig()) {
  if ((facts.appointmentTypeSlugs || []).includes(rule.slug)) return 'direct_appointment_type';
  for (const grant of rule.grants || []) {
    if (hasGrant(grant, facts, config)) return grant;
  }
  return null;
}

function hasGrant(grant, facts = {}, config = buildSchedulerEntitlementConfig()) {
  const token = normalizeToken(grant);
  if ((facts.tierKeys || []).includes(token) || (facts.divisionKeys || []).includes(token)) return true;
  const courseIds = new Set((facts.courseIds || []).map(normalizeToken));
  const productIds = new Set((facts.productIds || []).map(normalizeToken));
  for (const id of config.course_mappings?.[grant] || []) {
    if (courseIds.has(normalizeToken(id)) || productIds.has(normalizeToken(id))) return true;
  }
  return false;
}

function strictUnknownDecision(config, payload, reason, message) {
  if (String(config.mode || '').trim().toLowerCase() === 'strict') {
    return entitlementDecision(false, reason, appointmentAccessRule(payload.appointmentType || payload.appointment_type || {}, config), payload, message, 'unknown');
  }
  return null;
}

function entitlementDecision(eligible, reason, rule, payload = {}, message, status = null) {
  return {
    ok: eligible,
    status: status || (eligible ? 'eligible' : 'ineligible'),
    eligible,
    reason,
    mode: 'scheduler_entitlements',
    checked: {
      appointment_type_id: payload.appointmentTypeId ?? payload.appointment_type_id ?? payload.appointmentType?.id ?? payload.appointment_type?.id ?? null,
      appointment_type_slug: rule?.slug || payload.appointmentType?.slug || payload.appointment_type?.slug || null,
      student_user_id: payload.actor?.userId ?? payload.studentUserId ?? payload.student_user_id ?? null,
      student_wp_user_id: payload.actor?.wpUserId ?? payload.studentWpUserId ?? payload.student_wp_user_id ?? null,
      division: rule?.division || null,
    },
    entitlement: {
      division: rule?.division || null,
      appointment_type_slug: rule?.slug || null,
      quota_bucket: rule?.quota_bucket || null,
      service_cost_credits: rule?.service_cost_credits ?? null,
    },
    message,
  };
}

function entitlementConfigWarnings(courseMappings = {}) {
  const warnings = [];
  if (!courseMappings[COURSE_KEYS.missionResidency360]?.length) warnings.push('360 Match Mentorship course mapping is missing.');
  if (!courseMappings[COURSE_KEYS.matchPrepPro]?.length) warnings.push('Match Prep Pro course mapping is missing.');
  if (!courseMappings[COURSE_KEYS.examPrep]?.length) warnings.push('Exam Prep course mapping is missing.');
  return warnings;
}

function envList(value, fallback = []) {
  const parsed = mergeValues(value);
  return parsed.length ? parsed : fallback.map(normalizeToken).filter(Boolean);
}

function mergeValues(...values) {
  return values
    .flatMap((value) => {
      if (Array.isArray(value)) return value;
      if (value && typeof value === 'object') return Object.values(value);
      return String(value || '').split(',');
    })
    .map(normalizeToken)
    .filter(Boolean);
}

function normalizeToken(value) {
  return String(value ?? '').trim().toLowerCase();
}

function normalizeSlug(value) {
  return normalizeToken(value).replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/gu, '');
}

function objectOrEmpty(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function envFlag(value, fallback = false) {
  const normalized = String(value ?? '').trim().toLowerCase();
  if (!normalized) return fallback;
  return ['1', 'true', 'yes', 'on'].includes(normalized);
}

function parseJsonConfig(value) {
  const text = String(value || '').trim();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}
