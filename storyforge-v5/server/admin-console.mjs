const uuidPattern = /^[a-f0-9]{8}-[a-f0-9]{4}-[1-5][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
const statusFilters = new Set(['awaiting', 'in_review', 'changes', 'reviewed', 'approved', 'unscored']);
const reviewStatuses = new Set(['in_review', 'changes', 'reviewed', 'approved']);
const suitabilityValues = new Set(['ps_only', 'interview_only', 'both', 'neither']);
const flagScopes = new Set(['off', 'allowlist']);
const reviewFields = new Set(['status', 'mentorScore', 'suitability', 'studentFeedback', 'internalNote']);
const categoryValues = new Set([
  'clinical',
  'personal',
  'research',
  'leadership',
  'teaching',
  'volunteer_service',
  'adversity_challenge',
  'teamwork',
  'communication',
  'ethics_professionalism',
  'other',
]);
const intendedUseValues = new Set([
  'ps',
  'iv',
  'letter',
  'myeras_experiences',
  'myeras_most_impactful',
  'later',
]);

export class AdminConsoleError extends Error {
  constructor(code, message, status = 400) {
    super(message);
    this.name = 'AdminConsoleError';
    this.code = code;
    this.status = status;
  }
}

function explicitlyDisabled(value) {
  return !['0', 'false', 'no', 'off'].includes(String(value ?? '').trim().toLowerCase());
}

export function adminConsoleForceOff(environment = process.env) {
  return explicitlyDisabled(environment.STORYFORGE_ADMIN_CONSOLE_FORCE_OFF);
}

function requireFunction(value, name) {
  if (typeof value !== 'function') throw new TypeError(`${name} must be supplied.`);
  return value;
}

function requireUuid(value, label) {
  const normalized = String(value || '').trim();
  if (!uuidPattern.test(normalized)) {
    throw new AdminConsoleError('invalid_identifier', `${label} is not valid.`);
  }
  return normalized;
}

function boundedLimit(value, fallback = 25) {
  if (value == null || value === '') return fallback;
  const limit = Number(value);
  if (!Number.isInteger(limit) || limit < 1 || limit > 50) {
    throw new AdminConsoleError('invalid_admin_limit', 'Administrator page limit must be between 1 and 50.');
  }
  return limit;
}

function optionalTimestamp(value, label) {
  if (!value) return null;
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) {
    throw new AdminConsoleError('invalid_admin_cursor', `${label} is invalid.`);
  }
  return date.toISOString();
}

function optionalStatus(value) {
  if (!value) return null;
  const status = String(value).trim();
  if (!statusFilters.has(status)) {
    throw new AdminConsoleError('invalid_admin_filter', 'Review status filter is not recognized.');
  }
  return status;
}

function uniqueUuids(values) {
  if (!Array.isArray(values)) {
    throw new AdminConsoleError('invalid_admin_allowlist', 'Administrator allowlist must be an array.');
  }
  const normalized = [...new Set(values.map((value) => String(value).trim()).filter(Boolean))];
  if (normalized.length > 10 || normalized.some((value) => !uuidPattern.test(value))) {
    throw new AdminConsoleError('invalid_admin_allowlist', 'Administrator allowlist entries must be StoryForge user identifiers.');
  }
  return normalized;
}

function normalizeFlag(row) {
  return Object.freeze({
    key: 'admin_console',
    scope: flagScopes.has(row?.scope) ? row.scope : 'off',
    allowlist: Array.isArray(row?.allowlist) ? [...row.allowlist] : [],
    cohorts: [],
    updatedBy: row?.updatedBy ?? row?.updated_by ?? null,
    updatedAt: row?.updatedAt ?? row?.updated_at ?? null,
  });
}

function validateFlagMutation(input) {
  const scope = String(input?.scope || '').trim();
  if (!flagScopes.has(scope)) {
    throw new AdminConsoleError('invalid_admin_scope', 'Administrator console scope is not recognized.');
  }
  const allowlist = uniqueUuids(input?.allowlist);
  if (scope === 'off' && allowlist.length) {
    throw new AdminConsoleError('invalid_admin_scope_values', 'The off scope cannot retain an administrator allowlist.');
  }
  if (scope === 'allowlist' && !allowlist.length) {
    throw new AdminConsoleError('invalid_admin_scope_values', 'The allowlist scope requires at least one administrator.');
  }
  return { scope, allowlist };
}

export function validateAdminReview(input) {
  const expectedVersion = Number(input?.expectedVersion);
  if (!Number.isInteger(expectedVersion) || expectedVersion < 0) {
    throw new AdminConsoleError('invalid_admin_review', 'Expected story version is required.');
  }
  const sourcePatch = input?.patch;
  if (!sourcePatch || typeof sourcePatch !== 'object' || Array.isArray(sourcePatch)) {
    throw new AdminConsoleError('invalid_admin_review', 'Administrator review patch is required.');
  }
  const patch = { ...sourcePatch };
  const keys = Object.keys(patch);
  if (!keys.length || keys.some((key) => !reviewFields.has(key))) {
    throw new AdminConsoleError('invalid_admin_review', 'Administrator review contains unsupported fields.');
  }
  if (Object.hasOwn(patch, 'status') && !reviewStatuses.has(String(patch.status))) {
    throw new AdminConsoleError('invalid_admin_review', 'Administrator review status is not recognized.');
  }
  if (Object.hasOwn(patch, 'mentorScore')) {
    const score = patch.mentorScore;
    if (score !== null && (!Number.isInteger(score) || score < 1 || score > 5)) {
      throw new AdminConsoleError('invalid_admin_review', 'Administrator score must be from 1 to 5.');
    }
  }
  if (Object.hasOwn(patch, 'suitability')) {
    const suitability = patch.suitability;
    if (suitability !== null && !suitabilityValues.has(String(suitability))) {
      throw new AdminConsoleError('invalid_admin_review', 'Story suitability is not recognized.');
    }
  }
  for (const field of ['studentFeedback', 'internalNote']) {
    if (!Object.hasOwn(patch, field)) continue;
    const body = String(patch[field] || '').trim();
    if (!body || body.length > 10_000) {
      throw new AdminConsoleError('invalid_admin_review', `${field} must contain between 1 and 10000 characters.`);
    }
    patch[field] = body;
  }
  return { expectedVersion, patch: { ...patch } };
}

function boundedEnumArray(value, allowed, label) {
  if (!Array.isArray(value)) {
    throw new AdminConsoleError('invalid_admin_taxonomy', `${label} must be an array.`);
  }
  const normalized = [...new Set(value.map((item) => String(item || '').trim()).filter(Boolean))];
  if (normalized.length > allowed.size || normalized.some((item) => !allowed.has(item))) {
    throw new AdminConsoleError('invalid_admin_taxonomy', `${label} contains an unsupported value.`);
  }
  return normalized;
}

export function validateAdminTaxonomy(input) {
  const version = Number(input?.expectedVersion);
  if (!Number.isInteger(version) || version < 0) {
    throw new AdminConsoleError('invalid_admin_taxonomy', 'Expected story version is required.');
  }
  return Object.freeze({
    expectedVersion: version,
    categories: boundedEnumArray(input?.categories, categoryValues, 'Story categories'),
    uses: boundedEnumArray(input?.uses, intendedUseValues, 'Intended uses'),
  });
}

function requireAdmin(identity) {
  if (identity?.role !== 'admin' || identity?.eligible !== true || !uuidPattern.test(String(identity?.sub || ''))) {
    throw new AdminConsoleError('admin_required', 'An eligible administrator account is required.', 403);
  }
}

function translateDatabaseError(error) {
  if (error?.code === '40001') {
    throw new AdminConsoleError('admin_review_conflict', 'This story changed. Reload before saving the review.', 409);
  }
  if (error?.code === '42501') {
    throw new AdminConsoleError('admin_console_disabled', 'The administrator console is not enabled.', 403);
  }
  throw error;
}

export function createAdminConsoleService({
  withIdentity,
  environment = process.env,
} = {}) {
  requireFunction(withIdentity, 'withIdentity');

  async function capability(identity) {
    if (adminConsoleForceOff(environment)) return false;
    if (identity?.role !== 'admin' || identity?.eligible !== true) return false;
    try {
      return withIdentity(identity, async (client) => {
        const result = await client.query('SELECT public.sf_admin_console_enabled() AS enabled');
        return result.rows[0]?.enabled === true;
      });
    } catch (error) {
      if (['42501', '42883', '42P01'].includes(error?.code)) return false;
      throw error;
    }
  }

  async function requireEnabled(identity) {
    requireAdmin(identity);
    if (adminConsoleForceOff(environment)) {
      throw new AdminConsoleError('admin_console_force_off', 'The administrator console is disabled by the runtime kill switch.', 403);
    }
    if (!await capability(identity)) {
      throw new AdminConsoleError('admin_console_disabled', 'The administrator console is not enabled.', 403);
    }
  }

  async function rpc(identity, sql, values) {
    await requireEnabled(identity);
    try {
      return await withIdentity(identity, async (client) => {
        const result = await client.query(sql, values);
        return result.rows[0]?.payload ?? null;
      });
    } catch (error) {
      return translateDatabaseError(error);
    }
  }

  async function getFlag(identity) {
    requireAdmin(identity);
    return withIdentity(identity, async (client) => {
      const result = await client.query(
        `SELECT key, scope, allowlist, cohorts, updated_by, updated_at
           FROM public.sf_feature_flags
          WHERE key = 'admin_console'`,
      );
      return normalizeFlag(result.rows[0]);
    });
  }

  async function updateFlag(identity, input) {
    requireAdmin(identity);
    const next = validateFlagMutation(input);
    return withIdentity(identity, async (client) => {
      const result = await client.query(
        'SELECT public.sf_admin_set_console_flag($1, $2::uuid[]) AS payload',
        [next.scope, next.allowlist],
      );
      if (!result.rows[0]?.payload) {
        throw new AdminConsoleError('admin_console_unavailable', 'Administrator console flag is unavailable.', 503);
      }
      return normalizeFlag(result.rows[0].payload);
    });
  }

  return Object.freeze({
    capability,
    getFlag,
    updateFlag,
    home: (identity, query = {}) => rpc(
      identity,
      'SELECT public.sf_admin_home($1) AS payload',
      [boundedLimit(query.limit, 8)],
    ),
    students: (identity, query = {}) => rpc(
      identity,
      'SELECT public.sf_admin_search_students($1, $2, $3, $4, $5) AS payload',
      [
        String(query.q || '').trim().slice(0, 120),
        optionalStatus(query.status),
        query.afterName ? String(query.afterName).slice(0, 120) : null,
        query.afterId ? requireUuid(query.afterId, 'Student cursor') : null,
        boundedLimit(query.limit),
      ],
    ),
    student: (identity, studentId, query = {}) => rpc(
      identity,
      'SELECT public.sf_admin_student_detail($1, $2, $3, $4) AS payload',
      [
        requireUuid(studentId, 'Student identifier'),
        optionalTimestamp(query.afterAt, 'Student cursor timestamp'),
        query.afterId ? requireUuid(query.afterId, 'Story cursor') : null,
        boundedLimit(query.limit),
      ],
    ),
    queue: (identity, query = {}) => rpc(
      identity,
      'SELECT public.sf_admin_review_queue($1, $2, $3, $4, $5) AS payload',
      [
        optionalStatus(query.status),
        query.studentId ? requireUuid(query.studentId, 'Student identifier') : null,
        optionalTimestamp(query.afterAt, 'Queue cursor timestamp'),
        query.afterId ? requireUuid(query.afterId, 'Queue cursor') : null,
        boundedLimit(query.limit),
      ],
    ),
    story: (identity, storyId) => rpc(
      identity,
      'SELECT public.sf_admin_story_detail($1) AS payload',
      [requireUuid(storyId, 'Story identifier')],
    ),
    review: (identity, storyId, input) => {
      const review = validateAdminReview(input);
      return rpc(
        identity,
        `SELECT public.sf_admin_review_story($1, $2, $3::jsonb, 'workspace') AS payload`,
        [
          requireUuid(storyId, 'Story identifier'),
          review.expectedVersion,
          JSON.stringify(review.patch),
        ],
      );
    },
    taxonomy: (identity, storyId, input) => {
      const taxonomy = validateAdminTaxonomy(input);
      return rpc(
        identity,
        `SELECT public.sf_admin_update_story_taxonomy(
           $1, $2, $3::text[], $4::text[], 'workspace'
         ) AS payload`,
        [
          requireUuid(storyId, 'Story identifier'),
          taxonomy.expectedVersion,
          taxonomy.categories,
          taxonomy.uses,
        ],
      );
    },
  });
}
