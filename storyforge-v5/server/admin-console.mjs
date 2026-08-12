const uuidPattern = /^[a-f0-9]{8}-[a-f0-9]{4}-[1-5][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
const statusFilters = new Set(['awaiting', 'in_review', 'changes', 'reviewed', 'approved', 'unscored']);
const reviewStatuses = new Set(['in_review', 'changes', 'reviewed', 'approved']);
const directReviewStatuses = new Set(['awaiting', ...reviewStatuses]);
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
const directoryFilters = new Set([
  'all', 'awaiting', 'needs_review', 'never_active', 'never_started',
  'needs_nudge', 'progressing', 'changes', 'warnings', 'inactive_7', 'inactive_30',
]);
const directorySorts = new Set(['attention', 'name', 'recent', 'quiet', 'stories']);
const queueSorts = new Set(['oldest', 'newest', 'updated', 'student']);

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

export function adminDirectoryForceOff(environment = process.env) {
  return explicitlyDisabled(environment.STORYFORGE_ADMIN_DIRECTORY_FORCE_OFF);
}

export function reviewCheckForceOff(environment = process.env) {
  return explicitlyDisabled(environment.STORYFORGE_REVIEW_CHECK_FORCE_OFF);
}

export function adminReviewControlsForceOff(environment = process.env) {
  return explicitlyDisabled(environment.STORYFORGE_ADMIN_REVIEW_CONTROLS_FORCE_OFF);
}

function storyArchiveForceOff(environment = process.env) {
  return explicitlyDisabled(environment.STORYFORGE_STORY_ARCHIVE_FORCE_OFF);
}

function activityForceOffForAdmin(environment = process.env) {
  return explicitlyDisabled(environment.STORYFORGE_ACTIVITY_FORCE_OFF);
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

function clampedPageSize(value, fallback) {
  if (value == null || value === '') return fallback;
  const size = Number(value);
  if (!Number.isInteger(size) || size < 1) {
    throw new AdminConsoleError('invalid_admin_page', 'Administrator page size must be a positive integer.');
  }
  return Math.min(size, 50);
}

function boundedPage(value) {
  if (value == null || value === '') return 1;
  const page = Number(value);
  if (!Number.isInteger(page) || page < 1 || page > 1_000_000) {
    throw new AdminConsoleError('invalid_admin_page', 'Administrator page must be a positive bounded integer.');
  }
  return page;
}

function boundedText(value, max, code, label) {
  const text = String(value || '').trim();
  if (text.length > max || /[\u0000-\u001f\u007f]/.test(text)) {
    throw new AdminConsoleError(code, `${label} is not valid.`);
  }
  return text;
}

function exactObject(input, allowed, code, message) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new AdminConsoleError(code, message);
  }
  if (Object.keys(input).some((key) => !allowed.has(key))) {
    throw new AdminConsoleError(code, 'Unsupported fields are not accepted.');
  }
}

export function validateDirectoryQuery(query = {}) {
  const filter = String(query.filter || 'all').trim();
  const sort = String(query.sort || 'attention').trim();
  if (!directoryFilters.has(filter)) {
    throw new AdminConsoleError('invalid_admin_filter', 'Directory filter is not recognized.');
  }
  if (!directorySorts.has(sort)) {
    throw new AdminConsoleError('invalid_admin_sort', 'Directory sort is not recognized.');
  }
  return Object.freeze({
    q: boundedText(query.q, 120, 'invalid_admin_search', 'Directory search'),
    filter,
    session: boundedText(query.session, 80, 'invalid_admin_session', 'Directory session'),
    sort,
    page: boundedPage(query.page),
    pageSize: clampedPageSize(query.pageSize, 25),
  });
}

export function validateQueueQuery(query = {}) {
  const sort = String(query.sort || 'oldest').trim();
  if (!queueSorts.has(sort)) {
    throw new AdminConsoleError('invalid_admin_sort', 'Review queue sort is not recognized.');
  }
  return Object.freeze({
    q: boundedText(query.q, 120, 'invalid_admin_search', 'Review queue search'),
    status: optionalStatus(query.status),
    session: boundedText(query.session, 80, 'invalid_admin_session', 'Review queue session'),
    sort,
    page: boundedPage(query.page),
    pageSize: clampedPageSize(query.pageSize, 20),
  });
}

export function validateSavedView(input) {
  exactObject(
    input,
    new Set(['label', 'state']),
    'invalid_admin_saved_view',
    'A saved-view definition is required.',
  );
  exactObject(
    input.state,
    new Set(['filter', 'session', 'sort']),
    'invalid_admin_saved_view',
    'Saved-view filter state is required.',
  );
  const label = boundedText(input.label, 80, 'invalid_admin_saved_view', 'Saved-view label');
  if (!label) {
    throw new AdminConsoleError('invalid_admin_saved_view', 'Saved-view label is required.');
  }
  const directory = validateDirectoryQuery({ ...input.state, page: 1, pageSize: 25 });
  return Object.freeze({
    label,
    state: Object.freeze({
      filter: directory.filter,
      session: directory.session,
      sort: directory.sort,
    }),
  });
}

export function validateReviewCheck(input) {
  exactObject(
    input,
    new Set(['studentId', 'preview']),
    'invalid_review_check',
    'Review Check input is required.',
  );
  if (Object.hasOwn(input, 'preview') && typeof input.preview !== 'boolean') {
    throw new AdminConsoleError('invalid_review_check', 'Review Check preview must be a boolean.');
  }
  return Object.freeze({
    studentId: requireUuid(input.studentId, 'Student identifier'),
    preview: input.preview === true,
  });
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

export function validateUseReviews(input) {
  const expectedVersion = Number(input?.expectedVersion);
  if (!Number.isSafeInteger(expectedVersion) || expectedVersion < 0 || !Array.isArray(input?.reviews) || input.reviews.length > 6) {
    throw new AdminConsoleError('invalid_use_reviews', 'A valid story version and bounded use reviews are required.');
  }
  const seen = new Set();
  const reviews = input.reviews.map((item) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)
      || Object.keys(item).some((key) => !['useId', 'qualifies', 'score'].includes(key))) {
      throw new AdminConsoleError('invalid_use_reviews', 'A use review contains unsupported fields.');
    }
    const useId = String(item.useId || '').trim();
    if (!intendedUseValues.has(useId) || seen.has(useId)) {
      throw new AdminConsoleError('invalid_use_reviews', 'A use review is invalid or duplicated.');
    }
    seen.add(useId);
    const score = item.score == null ? null : Number(item.score);
    if (score !== null && (!Number.isInteger(score) || score < 1 || score > 5)) {
      throw new AdminConsoleError('invalid_use_reviews', 'A per-use score must be from 1 to 5.');
    }
    return { useId, qualifies: item.qualifies === true, score };
  });
  return Object.freeze({ expectedVersion, reviews });
}

function validatePromotion(input) {
  const expectedVersion = Number(input?.expectedVersion);
  if (!Number.isSafeInteger(expectedVersion) || expectedVersion < 0) {
    throw new AdminConsoleError('invalid_story_promotion', 'Expected story version is required.');
  }
  return Object.freeze({
    expectedVersion,
    active: input?.active !== false,
    confirmReplace: input?.confirmReplace === true,
  });
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
  if (
    (identity?.role !== 'admin' && identity?.wordpressAdmin !== true)
    || identity?.eligible !== true
    || !uuidPattern.test(String(identity?.sub || ''))
  ) {
    throw new AdminConsoleError('admin_required', 'An eligible administrator account is required.', 403);
  }
}

function translateDatabaseError(error) {
  if (error?.code === '40001' && error?.message === 'publication replacement confirmation required') {
    throw new AdminConsoleError(
      'story_publication_replace_required',
      'Another story is already promoted to this destination. Confirm replacement to continue.',
      409,
    );
  }
  if (error?.code === '40001') {
    throw new AdminConsoleError('admin_review_conflict', 'This story changed. Reload before saving the review.', 409);
  }
  if (error?.code === '42501') {
    throw new AdminConsoleError('admin_console_disabled', 'The administrator console is not enabled.', 403);
  }
  if (error?.code === 'P0002') {
    throw new AdminConsoleError('not_found', 'The requested administrator resource was not found.', 404);
  }
  if (error?.code === 'P0003') {
    throw new AdminConsoleError(
      'review_check_rate_limited',
      'A Review Check was already sent to this student in the last 24 hours.',
      429,
    );
  }
  if (['42883', '42P01'].includes(error?.code)) {
    throw new AdminConsoleError(
      'admin_v2_unavailable',
      'This administrator capability is not available in the current release.',
      503,
    );
  }
  throw error;
}

export function createAdminConsoleService({
  withIdentity,
  environment = process.env,
} = {}) {
  requireFunction(withIdentity, 'withIdentity');

  function withAdminIdentity(identity, operation) {
    return identity?.role === 'admin'
      ? withIdentity(identity, operation)
      : withIdentity(identity, operation, { adminMode: true });
  }

  async function capability(identity) {
    if (adminConsoleForceOff(environment)) return false;
    if (
      (identity?.role !== 'admin' && identity?.wordpressAdmin !== true)
      || identity?.eligible !== true
    ) return false;
    try {
      return withAdminIdentity(identity, async (client) => {
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

  async function v2Capabilities(identity) {
    if (!await capability(identity)) {
      return { directory: false, reviewCheck: false, reviewControls: false };
    }
    return withAdminIdentity(identity, async (client) => {
      const result = await client.query(
        `SELECT
           public.sf_story_feature_enabled('admin_directory', ARRAY['admin']) AS directory,
           public.sf_story_feature_enabled('review_check', ARRAY['admin']) AS review_check,
           public.sf_story_feature_enabled('admin_review_controls', ARRAY['admin']) AS review_controls`,
      );
      const row = result.rows[0] || {};
      return {
        directory: !adminDirectoryForceOff(environment) && row.directory === true,
        reviewCheck: !reviewCheckForceOff(environment) && row.review_check === true,
        reviewControls: !adminReviewControlsForceOff(environment) && row.review_controls === true,
      };
    }).catch((error) => {
      if (['42501', '42883', '42P01'].includes(error?.code)) {
        return { directory: false, reviewCheck: false, reviewControls: false };
      }
      throw error;
    });
  }

  async function rpc(identity, sql, values) {
    await requireEnabled(identity);
    try {
      return await withAdminIdentity(identity, async (client) => {
        const result = await client.query(sql, values);
        return result.rows[0]?.payload ?? null;
      });
    } catch (error) {
      return translateDatabaseError(error);
    }
  }

  async function surfaceRpc(identity, forceOff, code, message, sql, values) {
    if (forceOff(environment)) {
      throw new AdminConsoleError(code, message, 403);
    }
    return rpc(identity, sql, values);
  }

function reviewStory(identity, storyId, input, requireDirectControls = false) {
    if (requireDirectControls && adminReviewControlsForceOff(environment)) {
      throw new AdminConsoleError(
        'admin_review_controls_force_off',
        'Direct administrator review controls are disabled by the runtime kill switch.',
        403,
      );
    }
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
  }

  function setStoryCollection(identity, storyId, input) {
    if (storyArchiveForceOff(environment)) {
      throw new AdminConsoleError(
        'story_archive_force_off',
        'Story collections are disabled by the runtime kill switch.',
        403,
      );
    }
    exactObject(
      input,
      new Set(['collection', 'expectedVersion']),
      'invalid_story_collection',
      'Story collection input is required.',
    );
    const collection = String(input.collection || '').trim();
    if (!['active', 'archived', 'trashed'].includes(collection)) {
      throw new AdminConsoleError('invalid_story_collection', 'Story collection is not recognized.');
    }
    const version = Number(input.expectedVersion);
    if (!Number.isSafeInteger(version) || version < 0) {
      throw new AdminConsoleError('invalid_story_version', 'A valid story version is required.');
    }
    return rpc(
      identity,
      "SELECT public.sf_set_story_collection($1,$2,$3,'workspace') AS payload",
      [requireUuid(storyId, 'Story identifier'), version, collection],
    );
  }

  async function getFlag(identity) {
    requireAdmin(identity);
    return withAdminIdentity(identity, async (client) => {
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
    return withAdminIdentity(identity, async (client) => {
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
    v2Capabilities,
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
    directory: (identity, query = {}) => {
      const value = validateDirectoryQuery(query);
      return surfaceRpc(
        identity,
        adminDirectoryForceOff,
        'admin_directory_force_off',
        'The StoryForge student directory is disabled by the runtime kill switch.',
        'SELECT public.sf_admin_directory($1, $2, $3, $4, $5, $6) AS payload',
        [value.q, value.filter, value.session, value.sort, value.page, value.pageSize],
      );
    },
    directoryStudent: (identity, studentId) => surfaceRpc(
      identity,
      adminDirectoryForceOff,
      'admin_directory_force_off',
      'The StoryForge student directory is disabled by the runtime kill switch.',
      'SELECT public.sf_admin_directory_student($1) AS payload',
      [requireUuid(studentId, 'Student identifier')],
    ),
    savedViews: (identity) => surfaceRpc(
      identity,
      adminDirectoryForceOff,
      'admin_directory_force_off',
      'The StoryForge student directory is disabled by the runtime kill switch.',
      'SELECT public.sf_admin_saved_views() AS payload',
      [],
    ),
    saveView: (identity, input) => {
      const view = validateSavedView(input);
      return surfaceRpc(
        identity,
        adminDirectoryForceOff,
        'admin_directory_force_off',
        'The StoryForge student directory is disabled by the runtime kill switch.',
        'SELECT public.sf_admin_save_view($1, $2::jsonb) AS payload',
        [view.label, JSON.stringify(view.state)],
      );
    },
    deleteView: (identity, viewId) => surfaceRpc(
      identity,
      adminDirectoryForceOff,
      'admin_directory_force_off',
      'The StoryForge student directory is disabled by the runtime kill switch.',
      'SELECT public.sf_admin_delete_saved_view($1) AS payload',
      [requireUuid(viewId, 'Saved-view identifier')],
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
    queueScaled: (identity, query = {}) => {
      const value = validateQueueQuery(query);
      return rpc(
        identity,
        'SELECT public.sf_admin_review_queue_scaled($1, $2, $3, $4, $5, $6) AS payload',
        [value.q, value.status, value.session, value.sort, value.page, value.pageSize],
      );
    },
    activity: (identity, studentId) => surfaceRpc(
      identity,
      activityForceOffForAdmin,
      'activity_force_off',
      'Activity tracking is disabled by the runtime kill switch.',
      'SELECT public.sf_admin_activity_for_student($1) AS payload',
      [requireUuid(studentId, 'Student identifier')],
    ),
    reviewCheck: (identity, input) => {
      const check = validateReviewCheck(input);
      return surfaceRpc(
        identity,
        reviewCheckForceOff,
        'review_check_force_off',
        'Review Check is disabled by the runtime kill switch.',
        'SELECT public.sf_record_review_check($1, $2) AS payload',
        [check.studentId, check.preview],
      );
    },
    story: (identity, storyId) => rpc(
      identity,
      `WITH detail AS (
         SELECT public.sf_admin_story_detail($1) AS payload
       )
       SELECT CASE
         WHEN detail.payload IS NULL THEN NULL
         ELSE detail.payload || jsonb_build_object(
           'visibility', story.visibility,
           'story', coalesce(detail.payload -> 'story', '{}'::jsonb)
             || jsonb_build_object('visibility', story.visibility),
           'useReviews', coalesce((SELECT jsonb_agg(jsonb_build_object(
             'useId', review.use_id, 'qualifies', review.qualifies, 'score', review.score,
             'reviewerId', review.reviewer_id, 'rowVersion', review.row_version,
             'updatedAt', review.updated_at
           ) ORDER BY review.use_id) FROM public.sf_story_use_reviews review WHERE review.story_id=$1), '[]'::jsonb),
           'publications', coalesce((SELECT jsonb_agg(jsonb_build_object(
             'id', publication.id, 'destination', publication.destination,
             'active', publication.active, 'activatedAt', publication.activated_at,
             'revokedAt', publication.revoked_at, 'rowVersion', publication.row_version
           ) ORDER BY publication.created_at, publication.id)
             FROM public.sf_story_publications publication WHERE publication.story_id=$1), '[]'::jsonb)
         )
       END AS payload
       FROM detail
       LEFT JOIN public.sf_stories story ON story.id = $1`,
      [requireUuid(storyId, 'Story identifier')],
    ),
    review: (identity, storyId, input) => reviewStory(identity, storyId, input),
    directReview: (identity, storyId, input) => reviewStory(identity, storyId, input, true),
    reviewStatus: (identity, storyId, input) => {
      if (adminReviewControlsForceOff(environment)) {
        throw new AdminConsoleError('admin_review_controls_force_off', 'Direct administrator review controls are disabled.', 403);
      }
      const expectedVersion = Number(input?.expectedVersion);
      const status = String(input?.status || '');
      if (!Number.isSafeInteger(expectedVersion) || expectedVersion < 0 || !directReviewStatuses.has(status)
          || Object.keys(input || {}).some((key) => !['expectedVersion', 'status'].includes(key))) {
        throw new AdminConsoleError('invalid_admin_review', 'A recognized direct review status and story version are required.');
      }
      return rpc(
        identity,
        'SELECT public.sf_admin_set_review_status_v201($1,$2,$3) AS payload',
        [requireUuid(storyId, 'Story identifier'), expectedVersion, status],
      );
    },
    useReviews: (identity, storyId, input) => {
      if (adminReviewControlsForceOff(environment)) {
        throw new AdminConsoleError('admin_review_controls_force_off', 'Direct administrator review controls are disabled.', 403);
      }
      const reviews = validateUseReviews(input);
      return rpc(
        identity,
        'SELECT public.sf_admin_save_use_reviews($1,$2,$3::jsonb) AS payload',
        [requireUuid(storyId, 'Story identifier'), reviews.expectedVersion, JSON.stringify(reviews.reviews)],
      );
    },
    promotion: (identity, storyId, destination, input) => {
      const promotion = validatePromotion(input);
      const destinationMap = new Map([
        ['personal-statement', 'personal_statement'],
        ['interview-prep', 'iv_prep_on_call'],
      ]);
      if (!destinationMap.has(destination)) {
        throw new AdminConsoleError('invalid_story_promotion', 'Story promotion destination is not recognized.');
      }
      return rpc(
        identity,
        'SELECT public.sf_admin_set_story_publication($1,$2,$3,$4,$5) AS payload',
        [requireUuid(storyId, 'Story identifier'), promotion.expectedVersion, destinationMap.get(destination), promotion.active, promotion.confirmReplace],
      );
    },
    collection: setStoryCollection,
    taxonomy: (identity, storyId, input) => {
      const taxonomy = validateAdminTaxonomy(input);
      return rpc(
        identity,
        `SELECT public.sf_update_story_taxonomy_configured(
           $1, $2, $3::text[], $4::text[], 'workspace', true
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
