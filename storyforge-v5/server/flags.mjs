const voiceFlagKey = 'voice_capture';
const voiceScopes = new Set(['off', 'allowlist', 'cohort', 'eligible_all']);
const uuidPattern = /^[a-f0-9]{8}-[a-f0-9]{4}-[1-5][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
const graceWindowMs = 10 * 60 * 1000;

export class VoiceFlagError extends Error {
  constructor(code, message, status = 400) {
    super(message);
    this.name = 'VoiceFlagError';
    this.code = code;
    this.status = status;
  }
}

function enabled(value) {
  return ['1', 'true', 'yes', 'on'].includes(String(value || '').trim().toLowerCase());
}

function uniqueStrings(values) {
  return [...new Set(values.map((value) => String(value).trim()).filter(Boolean))];
}

function validCohortsFrom(environment) {
  return new Set(uniqueStrings(String(environment.STORYFORGE_VALID_COHORTS || '').split(',')));
}

async function queryFeatureAuditTail(_identity, client) {
  const result = await client.query(
    'SELECT * FROM public.sf_feature_audit_tail($1)',
    [20],
  );
  return result.rows;
}

async function queryVoiceErrorSummary(_identity, client) {
  const result = await client.query(
    'SELECT * FROM public.sf_voice_error_summary()',
  );
  return result.rows;
}

async function queryReconciliationReport(_identity, client) {
  const result = await client.query(
    'SELECT * FROM public.sf_reconciliation_report($1)',
    [5],
  );
  return result.rows;
}

function normalizedFlag(row) {
  if (!row) {
    return {
      key: voiceFlagKey,
      scope: 'off',
      allowlist: [],
      cohorts: [],
      updatedBy: null,
      updatedAt: null,
    };
  }
  return {
    key: voiceFlagKey,
    scope: voiceScopes.has(row.scope) ? row.scope : 'off',
    allowlist: Array.isArray(row.allowlist) ? [...row.allowlist] : [],
    cohorts: Array.isArray(row.cohorts) ? [...row.cohorts] : [],
    updatedBy: row.updated_by ?? row.updatedBy ?? null,
    updatedAt: row.updated_at ?? row.updatedAt ?? null,
  };
}

function normalizedIdentity(identity) {
  return {
    sub: String(identity?.sub || ''),
    role: String(identity?.role || ''),
    eligible: identity?.eligible === true,
    cohort: String(identity?.cohort || '').trim(),
  };
}

export function evaluateVoiceCapability(flag, identity) {
  const current = normalizedFlag(flag);
  const caller = normalizedIdentity(identity);
  if (!caller.eligible || caller.role !== 'student' || !uuidPattern.test(caller.sub)) return false;
  if (current.scope === 'allowlist') return current.allowlist.includes(caller.sub);
  if (current.scope === 'cohort') {
    return Boolean(caller.cohort) && current.cohorts.includes(caller.cohort);
  }
  if (current.scope === 'eligible_all') return true;
  return false;
}

function validateMutation(input, environment, { allowEligibleAll = false } = {}) {
  const scope = String(input?.scope || '').trim();
  if (!voiceScopes.has(scope)) {
    throw new VoiceFlagError('invalid_voice_scope', 'Voice capture scope is not recognized.');
  }
  if (scope === 'eligible_all' && !allowEligibleAll) {
    throw new VoiceFlagError(
      'eligible_all_locked',
      'All-eligible activation requires a separate founder ruling.',
      403,
    );
  }

  if (!Array.isArray(input?.allowlist) || !Array.isArray(input?.cohorts)) {
    throw new VoiceFlagError(
      'invalid_voice_scope_values',
      'Allowlist and cohorts must be arrays.',
    );
  }
  if (input.allowlist.length > 50) {
    throw new VoiceFlagError(
      'invalid_voice_allowlist',
      'Allowlist entries must be StoryForge user identifiers.',
    );
  }
  if (input.cohorts.length > 20) {
    throw new VoiceFlagError(
      'invalid_voice_cohort',
      'Not a recognized 360 cohort.',
    );
  }
  if (input.allowlist.some((value) => !String(value).trim())) {
    throw new VoiceFlagError(
      'invalid_voice_allowlist',
      'Allowlist entries must be StoryForge user identifiers.',
    );
  }
  if (input.cohorts.some((value) => !String(value).trim())) {
    throw new VoiceFlagError(
      'invalid_voice_cohort',
      'Not a recognized 360 cohort.',
    );
  }
  const allowlist = uniqueStrings(input.allowlist);
  if (allowlist.some((value) => !uuidPattern.test(value))) {
    throw new VoiceFlagError(
      'invalid_voice_allowlist',
      'Allowlist entries must be StoryForge user identifiers.',
    );
  }
  const cohorts = uniqueStrings(input.cohorts);
  const validCohorts = validCohortsFrom(environment);
  if (cohorts.some((value) => !validCohorts.has(value))) {
    throw new VoiceFlagError(
      'invalid_voice_cohort',
      'Not a recognized 360 cohort.',
    );
  }
  return { scope, allowlist, cohorts };
}

function requireFunction(value, name) {
  if (typeof value !== 'function') {
    throw new TypeError(`${name} must be supplied.`);
  }
  return value;
}

export function createPostgresFlagStore({
  withIdentity,
  withServiceTransaction,
  appendAudit,
  readFeatureAuditTail = queryFeatureAuditTail,
  readVoiceErrorSummary = queryVoiceErrorSummary,
  readReconciliationReport = queryReconciliationReport,
}) {
  requireFunction(withIdentity, 'withIdentity');
  requireFunction(withServiceTransaction, 'withServiceTransaction');
  requireFunction(appendAudit, 'appendAudit');

  async function readVoiceFlag() {
    return withServiceTransaction(async (client) => {
      const result = await client.query(
        `SELECT key, scope, allowlist, cohorts, updated_by, updated_at
           FROM public.sf_feature_flags
          WHERE key = $1`,
        [voiceFlagKey],
      );
      return normalizedFlag(result.rows[0]);
    });
  }

  async function auditAdminDenial(identity, surface) {
    try {
      return await withIdentity(identity, async (client) => appendAudit(client, {
        action: 'unauthorized_denied',
        entityType: 'feature_flag',
        entityId: null,
        surface: 'system',
        studentId: identity.sub,
        previousValue: null,
        newValue: { surface, errorCategory: 'auth' },
      }));
    } catch (error) {
      if (
        error?.code === 'audit_writer_unavailable'
        && error?.cause?.code === '42501'
        && /live identity required/i.test(String(error?.cause?.message || ''))
      ) {
        return null;
      }
      throw error;
    }
  }

  async function readAdminFeatures(identity) {
    if (typeof readFeatureAuditTail !== 'function') {
      throw new VoiceFlagError(
        'feature_audit_unavailable',
        'Feature history requires the approved audit query.',
        503,
      );
    }
    return withIdentity(identity, async (client) => {
      const flagResult = await client.query(
        `SELECT key, scope, allowlist, cohorts, updated_by, updated_at
           FROM public.sf_feature_flags
          WHERE key = $1`,
        [voiceFlagKey],
      );
      let auditRows;
      try {
        auditRows = await readFeatureAuditTail(identity, client);
      } catch (cause) {
        if (cause instanceof VoiceFlagError) throw cause;
        throw new VoiceFlagError(
          'feature_audit_unavailable',
          'Feature history requires the approved audit query.',
          503,
        );
      }
      return {
        flag: normalizedFlag(flagResult.rows[0]),
        audit: auditRows.map((row) => ({
          id: String(row.id),
          actorId: row.actor_id,
          action: row.action,
          previous: row.previous_value,
          current: row.new_value,
          createdAt: row.created_at,
        })),
      };
    });
  }

  async function updateVoiceFlag(identity, next) {
    return withIdentity(identity, async (client) => {
      const locked = await client.query(
        `SELECT key, scope, allowlist, cohorts, updated_by, updated_at
           FROM public.sf_feature_flags
          WHERE key = $1
          FOR UPDATE`,
        [voiceFlagKey],
      );
      const previous = normalizedFlag(locked.rows[0]);
      if (!locked.rows[0]) {
        throw new VoiceFlagError(
          'voice_flag_unavailable',
          'Voice capture controls are unavailable.',
          503,
        );
      }
      const result = await client.query(
        `UPDATE public.sf_feature_flags
            SET scope = $2,
                allowlist = $3::uuid[],
                cohorts = $4::text[],
                updated_by = $5,
                updated_at = now()
          WHERE key = $1
          RETURNING key, scope, allowlist, cohorts, updated_by, updated_at`,
        [voiceFlagKey, next.scope, next.allowlist, next.cohorts, identity.sub],
      );
      const current = normalizedFlag(result.rows[0]);
      await appendAudit(client, {
        action: 'feature_scope_changed',
        entityType: 'feature_flag',
        entityId: null,
        surface: 'system',
        studentId: null,
        previousValue: {
          scope: previous.scope,
          allowlist: previous.allowlist,
          cohorts: previous.cohorts,
        },
        newValue: {
          scope: current.scope,
          allowlist: current.allowlist,
          cohorts: current.cohorts,
        },
      });
      return current;
    });
  }

  async function readVoiceHealth(identity) {
    const states = await withServiceTransaction(async (client) => {
      const result = await client.query(
        `SELECT state, count(*)::integer AS count
           FROM public.sf_recording_sessions
          WHERE created_at > now() - interval '24 hours'
          GROUP BY state
          ORDER BY state`,
      );
      return result.rows.map((row) => ({
        state: row.state,
        count: Number(row.count),
      }));
    });
    if (typeof readVoiceErrorSummary !== 'function') {
      throw new VoiceFlagError(
        'voice_health_audit_unavailable',
        'Voice health error summaries require the approved audit query.',
        503,
      );
    }
    const errors = await withIdentity(identity, async (client) => {
      try {
        return await readVoiceErrorSummary(identity, client);
      } catch (cause) {
        if (cause instanceof VoiceFlagError) throw cause;
        throw new VoiceFlagError(
          'voice_health_audit_unavailable',
          'Voice health error summaries require the approved audit query.',
          503,
        );
      }
    });
    const permittedCategories = new Set([
      'mic',
      'upload',
      'transcribe',
      'assembly',
      'save',
      'auth',
    ]);
    if (errors.some((row) => (
      !permittedCategories.has(String(row.errorCategory ?? row.error_category ?? ''))
      || !Number.isInteger(Number(row.count))
      || Number(row.count) < 0
    ))) {
      throw new VoiceFlagError(
        'voice_health_audit_invalid',
        'Voice health error summaries did not satisfy the content-free contract.',
        503,
      );
    }
    let reconciliation = null;
    if (typeof readReconciliationReport === 'function') {
      try {
        const rows = await withIdentity(identity, (client) => (
          readReconciliationReport(identity, client)
        ));
        const requiredCounts = [
          'pages_listed',
          'keys_evaluated',
          'candidates',
          'preserved',
          'deleted_confirmed',
          'object_absent',
          'retried',
          'failed',
        ];
        if (
          !Array.isArray(rows)
          || rows.some((row) => (
            !['dry_run', 'on'].includes(row.mode)
            || requiredCounts.some((key) => (
              !Number.isInteger(Number(row[key] ?? row[key.replace(/_([a-z])/g, (_, char) => char.toUpperCase())]))
              || Number(row[key] ?? row[key.replace(/_([a-z])/g, (_, char) => char.toUpperCase())]) < 0
            ))
          ))
        ) {
          throw new Error('invalid_reconciliation_report');
        }
        reconciliation = rows.map((row) => ({
          runId: row.run_id ?? row.runId,
          mode: row.mode,
          startedAt: row.started_at ?? row.startedAt,
          finishedAt: row.finished_at ?? row.finishedAt,
          pagesListed: Number(row.pages_listed ?? row.pagesListed),
          keysEvaluated: Number(row.keys_evaluated ?? row.keysEvaluated),
          candidates: Number(row.candidates),
          preserved: Number(row.preserved),
          deletedConfirmed: Number(row.deleted_confirmed ?? row.deletedConfirmed),
          objectAbsent: Number(row.object_absent ?? row.objectAbsent),
          retried: Number(row.retried),
          failed: Number(row.failed),
          abortReason: row.abort_reason ?? row.abortReason ?? null,
          suspended: row.suspended === true,
          suspensionReason: row.suspension_reason ?? row.suspensionReason ?? null,
          cursorDigestStart: row.cursor_digest_start ?? row.cursorDigestStart ?? '',
          cursorDigestEnd: row.cursor_digest_end ?? row.cursorDigestEnd ?? '',
          replicaId: row.replica_id ?? row.replicaId,
        }));
      } catch {
        reconciliation = null;
      }
    }
    return {
      windowHours: 24,
      sessionsByState: states,
      errorsByCategory: errors.map((row) => ({
        errorCategory: row.errorCategory ?? row.error_category,
        count: Number(row.count),
      })),
      reconciliation,
    };
  }

  return Object.freeze({
    auditAdminDenial,
    readAdminFeatures,
    readVoiceFlag,
    readVoiceHealth,
    updateVoiceFlag,
  });
}

export function createFlagService({
  store,
  environment = process.env,
  now = () => new Date(),
  allowEligibleAll = false,
  emitEvent = () => {},
}) {
  if (!store || typeof store.readVoiceFlag !== 'function') {
    throw new TypeError('A production flag store must be supplied.');
  }

  function forceOff() {
    return enabled(environment.STORYFORGE_VOICE_FORCE_OFF);
  }

  function emit(event, fields = {}) {
    emitEvent(Object.freeze({
      t: now().toISOString(),
      event,
      ...fields,
    }));
  }

  async function voiceState(identity) {
    const killed = forceOff();
    if (killed) {
      return {
        flag: normalizedFlag(null),
        forceOff: true,
        enabled: false,
      };
    }
    const flag = await store.readVoiceFlag();
    return {
      flag,
      forceOff: false,
      enabled: evaluateVoiceCapability(flag, identity),
    };
  }

  async function voiceCapture(identity) {
    return (await voiceState(identity)).enabled;
  }

  async function assertVoiceEnabled(identity, {
    allowGrace = false,
    session = null,
  } = {}) {
    const current = await voiceState(identity);
    if (current.forceOff) {
      emit('voice_denied', { studentId: identity?.sub, errorCategory: 'auth' });
      throw new VoiceFlagError(
        'voice_disabled',
        'Voice capture is currently unavailable. Every word so far is kept in your draft. You can keep typing.',
        403,
      );
    }
    if (current.enabled) return current.flag;
    if (allowGrace && session && ['recording', 'finishing'].includes(session.state)) {
      const changedAt = Date.parse(current.flag.updatedAt || '');
      const openedAt = Date.parse(session.createdAt || session.created_at || '');
      const currentTime = now().getTime();
      if (
        Number.isFinite(changedAt)
        && Number.isFinite(openedAt)
        && openedAt <= changedAt
        && currentTime >= changedAt
        && currentTime - changedAt <= graceWindowMs
      ) {
        return current.flag;
      }
    }
    emit('voice_denied', { studentId: identity?.sub, errorCategory: 'auth' });
    throw new VoiceFlagError(
      'voice_disabled',
      'Voice capture is currently unavailable. Every word so far is kept in your draft. You can keep typing.',
      403,
    );
  }

  async function requireAdmin(identity, surface) {
    if (identity?.role === 'admin' && identity?.eligible === true) return;
    await store.auditAdminDenial(identity, surface);
    emit('unauthorized_denied', {
      studentId: identity?.sub,
      errorCategory: 'auth',
    });
    throw new VoiceFlagError(
      'admin_required',
      'An administrator account is required.',
      403,
    );
  }

  async function getAdminFeatures(identity) {
    await requireAdmin(identity, 'features');
    return store.readAdminFeatures(identity);
  }

  async function updateVoiceCapture(identity, input) {
    await requireAdmin(identity, 'voice_capture');
    const next = validateMutation(input, environment, { allowEligibleAll });
    const current = await store.updateVoiceFlag(identity, next);
    emit('feature_scope_changed', { studentId: identity?.sub });
    return current;
  }

  async function getVoiceHealth(identity) {
    await requireAdmin(identity, 'voice_health');
    return store.readVoiceHealth(identity);
  }

  return Object.freeze({
    assertVoiceEnabled,
    getAdminFeatures,
    getVoiceHealth,
    updateVoiceCapture,
    voiceCapture,
    voiceForceOff: forceOff,
    voiceState,
  });
}

export const voiceFlagConstants = Object.freeze({
  key: voiceFlagKey,
  scopes: Object.freeze([...voiceScopes]),
  graceWindowMs,
});
