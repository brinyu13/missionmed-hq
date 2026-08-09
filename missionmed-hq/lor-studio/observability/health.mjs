const DEPENDENCY_STATES = new Set(['ready', 'degraded', 'unavailable', 'disabled', 'unknown']);

function dependency(value = {}) {
  const state = DEPENDENCY_STATES.has(value.state) ? value.state : 'unknown';
  return Object.freeze({
    state,
    required: value.required === true,
    errorCode: String(value.errorCode || '').slice(0, 80),
  });
}

export function createLorStudioHealthSnapshot({
  flags = {},
  storage = {},
  entitlement = {},
  aiProvider = {},
  documentProvider = {},
  emailProvider = {},
  auditSink = {},
  at = new Date(),
} = {}) {
  const dependencies = Object.freeze({
    storage: dependency({ ...storage, required: true }),
    entitlement: dependency({ ...entitlement, required: true }),
    aiProvider: dependency({ ...aiProvider, required: false }),
    documentProvider: dependency({ ...documentProvider, required: true }),
    emailProvider: dependency({ ...emailProvider, required: true }),
    auditSink: dependency({ ...auditSink, required: true }),
  });

  let status = 'ready';
  let reason = 'all_required_dependencies_ready';
  if (flags.enabled !== true) {
    status = 'closed';
    reason = 'feature_disabled';
  } else if (flags.killSwitch !== false) {
    status = 'paused';
    reason = 'kill_switch_active';
  } else if (storage.durable !== true || dependencies.storage.state !== 'ready') {
    status = 'blocked';
    reason = 'durable_storage_unavailable';
  } else {
    const requiredFailure = Object.values(dependencies).find((item) => item.required && item.state !== 'ready');
    if (requiredFailure) {
      status = 'blocked';
      reason = 'required_dependency_unavailable';
    } else if (dependencies.aiProvider.state !== 'ready') {
      status = 'degraded';
      reason = 'non_ai_fallback_required';
    }
  }

  return Object.freeze({
    service: 'missionmed-lor-studio',
    schemaVersion: 1,
    at: (at instanceof Date ? at : new Date(at)).toISOString(),
    status,
    reason,
    productionOperational: status === 'ready' || status === 'degraded',
    dependencies,
  });
}

export function evaluateLorStudioAlerts(metrics = {}) {
  const values = {
    authDenialRate: Number(metrics.authDenialRate || 0),
    errorRate: Number(metrics.errorRate || 0),
    p95LatencyMs: Number(metrics.p95LatencyMs || 0),
    staleWriteRate: Number(metrics.staleWriteRate || 0),
    artifactFailureRate: Number(metrics.artifactFailureRate || 0),
  };
  if (Object.values(values).some((value) => !Number.isFinite(value) || value < 0)) {
    throw new Error('Alert metrics must be finite, nonnegative aggregates.');
  }
  const alerts = [];
  if (values.errorRate >= 0.05) alerts.push({ code: 'lor_error_rate_high', severity: 'critical' });
  if (values.p95LatencyMs >= 2_500) alerts.push({ code: 'lor_latency_high', severity: 'warning' });
  if (values.staleWriteRate >= 0.1) alerts.push({ code: 'lor_stale_write_rate_high', severity: 'warning' });
  if (values.artifactFailureRate >= 0.02) alerts.push({ code: 'lor_artifact_failures_high', severity: 'critical' });
  if (values.authDenialRate >= 0.35) alerts.push({ code: 'lor_auth_denial_rate_high', severity: 'warning' });
  return Object.freeze(alerts.map(Object.freeze));
}
