const uuidPattern = /^[a-f0-9]{8}-[a-f0-9]{4}-[1-5][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
const surfaces = new Set([
  'home', 'library', 'story_detail', 'capture', 'settings',
  'notifications', 'interview_prep', 'inspiration',
]);
const flagScopes = new Set(['off', 'allowlist', 'cohort', 'eligible_all']);

export class ActivityError extends Error {
  constructor(code, message, status = 400) {
    super(message);
    this.name = 'ActivityError';
    this.code = code;
    this.status = status;
  }
}

function explicitlyDisabled(value) {
  return !['0', 'false', 'no', 'off'].includes(String(value ?? '').trim().toLowerCase());
}

export function activityForceOff(environment = process.env) {
  return explicitlyDisabled(environment.STORYFORGE_ACTIVITY_FORCE_OFF);
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
    throw new ActivityError('student_required', 'An eligible student account is required.', 403);
  }
}

function requireAdmin(identity) {
  if (
    (identity?.role !== 'admin' && identity?.wordpressAdmin !== true)
    || identity?.eligible !== true
    || !uuidPattern.test(String(identity?.sub || ''))
  ) {
    throw new ActivityError('admin_required', 'An eligible administrator account is required.', 403);
  }
}

function withAdminIdentity(withIdentity, identity, operation) {
  return identity?.role === 'admin'
    ? withIdentity(identity, operation)
    : withIdentity(identity, operation, { adminMode: true });
}

function exactObject(input, allowed, code) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new ActivityError(code, 'A JSON object is required.');
  }
  if (Object.keys(input).some((key) => !allowed.has(key))) {
    throw new ActivityError(code, 'Unsupported fields are not accepted.');
  }
}

function requireUuid(value, label) {
  const normalized = String(value || '').trim();
  if (!uuidPattern.test(normalized)) {
    throw new ActivityError('invalid_identifier', `${label} is not valid.`);
  }
  return normalized;
}

function unique(values, validator, label, max) {
  if (!Array.isArray(values)) {
    throw new ActivityError('invalid_feature_scope', `${label} must be an array.`);
  }
  const normalized = [...new Set(values.map((value) => String(value).trim()).filter(Boolean))];
  if (normalized.length > max || normalized.some((value) => !validator(value))) {
    throw new ActivityError('invalid_feature_scope', `${label} contains an unsupported value.`);
  }
  return normalized;
}

function validateFlag(input) {
  exactObject(input, new Set(['scope', 'allowlist', 'cohorts']), 'invalid_feature_scope');
  const scope = String(input.scope || '').trim();
  if (!flagScopes.has(scope)) {
    throw new ActivityError('invalid_feature_scope', 'Feature scope is not recognized.');
  }
  const allowlist = unique(input.allowlist, (value) => uuidPattern.test(value), 'Allowlist', 50);
  const cohorts = unique(input.cohorts, (value) => value.length <= 80, 'Cohorts', 20);
  if (
    (scope === 'off' && (allowlist.length || cohorts.length))
    || (scope === 'allowlist' && (!allowlist.length || cohorts.length))
    || (scope === 'cohort' && (!cohorts.length || allowlist.length))
    || (scope === 'eligible_all' && (allowlist.length || cohorts.length))
  ) {
    throw new ActivityError('invalid_feature_scope', 'Feature scope values do not match the scope.');
  }
  return { scope, allowlist, cohorts };
}

function normalizeFlag(row) {
  return Object.freeze({
    key: 'activity_tracking',
    scope: flagScopes.has(row?.scope) ? row.scope : 'off',
    allowlist: Array.isArray(row?.allowlist) ? [...row.allowlist] : [],
    cohorts: Array.isArray(row?.cohorts) ? [...row.cohorts] : [],
    updatedBy: row?.updatedBy ?? row?.updated_by ?? null,
    updatedAt: row?.updatedAt ?? row?.updated_at ?? null,
    auditId: row?.auditId == null ? null : String(row.auditId),
  });
}

export function validateHeartbeat(input) {
  exactObject(input, new Set(['sessionId', 'surface', 'activeMs']), 'invalid_activity_heartbeat');
  const sessionId = requireUuid(input.sessionId, 'Activity session identifier');
  const surface = String(input.surface || '').trim();
  const activeMs = Number(input.activeMs);
  if (!surfaces.has(surface)) {
    throw new ActivityError('invalid_activity_heartbeat', 'Activity surface is not recognized.');
  }
  if (!Number.isSafeInteger(activeMs) || activeMs < 0 || activeMs > 60_000) {
    throw new ActivityError('invalid_activity_heartbeat', 'Activity interval must be from 0 to 60000 milliseconds.');
  }
  return Object.freeze({ sessionId, surface, activeMs });
}

export function createActivityService({
  withIdentity,
  environment = process.env,
} = {}) {
  requireFunction(withIdentity, 'withIdentity');

  async function capability(identity) {
    if (activityForceOff(environment)) return false;
    if (identity?.role !== 'student' || identity?.eligible !== true) return false;
    try {
      return await withIdentity(identity, async (client) => {
        const result = await client.query(
          'SELECT public.sf_activity_tracking_enabled() AS enabled',
        );
        return result.rows[0]?.enabled === true;
      });
    } catch (error) {
      if (['42501', '42883', '42P01'].includes(error?.code)) return false;
      throw error;
    }
  }

  async function heartbeat(identity, input) {
    requireStudent(identity);
    const heartbeatPayload = validateHeartbeat(input);
    if (activityForceOff(environment)) {
      return { accepted: false, reason: 'force_off' };
    }
    return withIdentity(identity, async (client) => {
      const result = await client.query(
        'SELECT public.sf_activity_heartbeat($1, $2, $3) AS payload',
        [heartbeatPayload.sessionId, heartbeatPayload.surface, heartbeatPayload.activeMs],
      );
      return result.rows[0]?.payload || { accepted: false, reason: 'unavailable' };
    });
  }

  async function adminRead(identity, studentId) {
    requireAdmin(identity);
    if (activityForceOff(environment)) {
      throw new ActivityError(
        'activity_force_off',
        'Activity tracking is disabled by the runtime kill switch.',
        403,
      );
    }
    return withAdminIdentity(withIdentity, identity, async (client) => {
      const result = await client.query(
        'SELECT public.sf_admin_activity_for_student($1) AS payload',
        [requireUuid(studentId, 'Student identifier')],
      );
      return result.rows[0]?.payload;
    });
  }

  async function getFlag(identity) {
    requireAdmin(identity);
    return withAdminIdentity(withIdentity, identity, async (client) => {
      const result = await client.query(
        `SELECT key, scope, allowlist, cohorts, updated_by, updated_at
           FROM public.sf_feature_flags
          WHERE key = 'activity_tracking'`,
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
           'activity_tracking', $1, $2::uuid[], $3::text[]
         ) AS payload`,
        [next.scope, next.allowlist, next.cohorts],
      );
      return normalizeFlag(result.rows[0]?.payload);
    });
  }

  return Object.freeze({
    capability,
    heartbeat,
    adminRead,
    getFlag,
    updateFlag,
  });
}
