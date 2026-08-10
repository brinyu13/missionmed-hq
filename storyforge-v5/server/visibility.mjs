const uuidPattern = /^[a-f0-9]{8}-[a-f0-9]{4}-[1-5][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
const flagScopes = new Set(['off', 'allowlist', 'cohort', 'eligible_all']);

export const mentorshipPolicy = Object.freeze({
  version: 'mentorship-visibility-1',
  updated: '2026-08-07',
});

export class VisibilityError extends Error {
  constructor(code, message, status = 400) {
    super(message);
    this.name = 'VisibilityError';
    this.code = code;
    this.status = status;
  }
}

function explicitlyDisabled(value) {
  return !['0', 'false', 'no', 'off'].includes(String(value ?? '').trim().toLowerCase());
}

export function visibilityConsentForceOff(environment = process.env) {
  return explicitlyDisabled(environment.STORYFORGE_VISIBILITY_CONSENT_FORCE_OFF);
}

function requireFunction(value, name) {
  if (typeof value !== 'function') throw new TypeError(`${name} must be supplied.`);
  return value;
}

function requireStudent(identity) {
  if (
    identity?.role !== 'student'
    || identity?.eligible !== true
    || !uuidPattern.test(String(identity?.sub || ''))
  ) {
    throw new VisibilityError('student_required', 'An eligible student account is required.', 403);
  }
}

function requireAdmin(identity) {
  if (
    (identity?.role !== 'admin' && identity?.wordpressAdmin !== true)
    || identity?.eligible !== true
    || !uuidPattern.test(String(identity?.sub || ''))
  ) {
    throw new VisibilityError('admin_required', 'An eligible administrator account is required.', 403);
  }
}

function withAdminIdentity(withIdentity, identity, operation) {
  return identity?.role === 'admin'
    ? withIdentity(identity, operation)
    : withIdentity(identity, operation, { adminMode: true });
}

function exactObject(input, allowed, code) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new VisibilityError(code, 'A JSON object is required.');
  }
  if (Object.keys(input).some((key) => !allowed.has(key))) {
    throw new VisibilityError(code, 'Unsupported fields are not accepted.');
  }
}

function requireUuid(value, label = 'Resource identifier') {
  const normalized = String(value || '').trim();
  if (!uuidPattern.test(normalized)) {
    throw new VisibilityError('invalid_identifier', `${label} is not valid.`);
  }
  return normalized;
}

function normalizeFlag(row, key = 'visibility_consent') {
  return Object.freeze({
    key,
    scope: flagScopes.has(row?.scope) ? row.scope : 'off',
    allowlist: Array.isArray(row?.allowlist) ? [...row.allowlist] : [],
    cohorts: Array.isArray(row?.cohorts) ? [...row.cohorts] : [],
    updatedBy: row?.updatedBy ?? row?.updated_by ?? null,
    updatedAt: row?.updatedAt ?? row?.updated_at ?? null,
    auditId: row?.auditId == null ? null : String(row.auditId),
  });
}

function unique(values, validator, label, max) {
  if (!Array.isArray(values)) {
    throw new VisibilityError('invalid_feature_scope', `${label} must be an array.`);
  }
  const normalized = [...new Set(values.map((value) => String(value).trim()).filter(Boolean))];
  if (normalized.length > max || normalized.some((value) => !validator(value))) {
    throw new VisibilityError('invalid_feature_scope', `${label} contains an unsupported value.`);
  }
  return normalized;
}

function validateFlag(input) {
  exactObject(input, new Set(['scope', 'allowlist', 'cohorts']), 'invalid_feature_scope');
  const scope = String(input.scope || '').trim();
  if (!flagScopes.has(scope)) {
    throw new VisibilityError('invalid_feature_scope', 'Feature scope is not recognized.');
  }
  const allowlist = unique(input.allowlist, (value) => uuidPattern.test(value), 'Allowlist', 50);
  const cohorts = unique(input.cohorts, (value) => value.length <= 80, 'Cohorts', 20);
  if (
    (scope === 'off' && (allowlist.length || cohorts.length))
    || (scope === 'allowlist' && (!allowlist.length || cohorts.length))
    || (scope === 'cohort' && (!cohorts.length || allowlist.length))
    || (scope === 'eligible_all' && (allowlist.length || cohorts.length))
  ) {
    throw new VisibilityError('invalid_feature_scope', 'Feature scope values do not match the scope.');
  }
  return { scope, allowlist, cohorts };
}

function translateDatabaseError(error) {
  if (error?.code === '40001') {
    throw new VisibilityError('visibility_conflict', 'This story changed. Reload before changing visibility.', 409);
  }
  if (error?.code === '23514' && /visibility_submitted/.test(String(error?.message || ''))) {
    throw new VisibilityError(
      'visibility_submitted',
      'Return this story to Private before changing it to Private — only me.',
      409,
    );
  }
  throw error;
}

export function createVisibilityService({
  withIdentity,
  environment = process.env,
} = {}) {
  requireFunction(withIdentity, 'withIdentity');

  async function capability(identity) {
    if (visibilityConsentForceOff(environment)) return false;
    if (identity?.role !== 'student' || identity?.eligible !== true) return false;
    try {
      return await withIdentity(identity, async (client) => {
        const result = await client.query(
          'SELECT public.sf_visibility_consent_enabled() AS enabled',
        );
        return result.rows[0]?.enabled === true;
      });
    } catch (error) {
      if (['42501', '42883', '42P01'].includes(error?.code)) return false;
      throw error;
    }
  }

  async function read(identity) {
    if (identity?.role !== 'student' || identity?.eligible !== true) {
      return { enabled: false, policy: mentorshipPolicy, consent: null };
    }
    requireStudent(identity);
    if (visibilityConsentForceOff(environment)) {
      return { enabled: false, policy: mentorshipPolicy, consent: null };
    }
    const consent = await withIdentity(identity, async (client) => {
      try {
        const result = await client.query(
          'SELECT public.sf_get_mentorship_consent() AS payload',
        );
        return result.rows[0]?.payload ?? null;
      } catch (error) {
        if (['42883', '42P01'].includes(error?.code)) return null;
        throw error;
      }
    });
    return {
      enabled: await capability(identity),
      policy: mentorshipPolicy,
      consent,
    };
  }

  async function decide(identity, input) {
    requireStudent(identity);
    if (visibilityConsentForceOff(environment)) {
      throw new VisibilityError(
        'visibility_consent_force_off',
        'Mentorship visibility is disabled by the runtime kill switch.',
        403,
      );
    }
    exactObject(input, new Set(['decision']), 'invalid_consent_decision');
    const decision = String(input.decision || '').trim();
    if (!['accept', 'defer'].includes(decision)) {
      throw new VisibilityError('invalid_consent_decision', 'Consent decision is not recognized.');
    }
    return withIdentity(identity, async (client) => {
      const result = await client.query(
        'SELECT public.sf_decide_mentorship_consent($1, $2) AS payload',
        [mentorshipPolicy.version, decision],
      );
      return result.rows[0]?.payload;
    });
  }

  async function setStoryVisibility(identity, storyId, input) {
    requireStudent(identity);
    if (visibilityConsentForceOff(environment)) {
      throw new VisibilityError(
        'visibility_consent_force_off',
        'Mentorship visibility is disabled by the runtime kill switch.',
        403,
      );
    }
    exactObject(input, new Set(['visibility', 'expectedVersion']), 'invalid_story_visibility');
    const visibility = String(input.visibility || '').trim();
    const expectedVersion = Number(input.expectedVersion);
    if (!['mentor_visible', 'private'].includes(visibility)) {
      throw new VisibilityError('invalid_story_visibility', 'Story visibility is not recognized.');
    }
    if (!Number.isSafeInteger(expectedVersion) || expectedVersion < 0) {
      throw new VisibilityError('invalid_story_visibility', 'Expected story version is required.');
    }
    try {
      return await withIdentity(identity, async (client) => {
        const result = await client.query(
          'SELECT * FROM public.sf_set_story_visibility($1, $2, $3)',
          [requireUuid(storyId, 'Story identifier'), visibility, expectedVersion],
        );
        return result.rows[0] || null;
      });
    } catch (error) {
      return translateDatabaseError(error);
    }
  }

  async function getFlag(identity) {
    requireAdmin(identity);
    return withAdminIdentity(withIdentity, identity, async (client) => {
      const result = await client.query(
        `SELECT key, scope, allowlist, cohorts, updated_by, updated_at
           FROM public.sf_feature_flags
          WHERE key = 'visibility_consent'`,
      );
      return normalizeFlag(result.rows[0]);
    });
  }

  async function updateFlag(identity, input) {
    requireAdmin(identity);
    const next = validateFlag(input);
    return withAdminIdentity(withIdentity, identity, async (client) => {
      const result = await client.query(
        `SELECT public.sf_admin_set_b1_514_feature_flag(
           'visibility_consent', $1, $2::uuid[], $3::text[]
         ) AS payload`,
        [next.scope, next.allowlist, next.cohorts],
      );
      return normalizeFlag(result.rows[0]?.payload);
    });
  }

  return Object.freeze({
    capability,
    read,
    decide,
    setStoryVisibility,
    getFlag,
    updateFlag,
  });
}
