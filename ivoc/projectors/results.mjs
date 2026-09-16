import { assertResultSet } from '../contracts/results.mjs';

const finite = (values) => values.filter(Number.isFinite);
const average = (values) => values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;

export function projectResults({ session, segments, analyticsSummary, producedAt, projectorVersion = 'm1-results-v1' }) {
  const dimensions = [];
  const limitations = [];
  for (const [signalId, summary] of Object.entries(analyticsSummary ?? {})) {
    const values = finite(summary.values ?? []);
    const valid = summary.availability === 'ok' && values.length > 0;
    dimensions.push({
      dimension: signalId,
      valid,
      ...(valid ? { score: Number(average(values).toFixed(2)), scale: summary.scale === '0_10' ? '0_10' : 'raw' } : {}),
      evidence_refs: valid ? [`signal:${session.session_id}:${signalId}`] : [],
    });
    if (!valid) limitations.push(`${signalId}: ${summary.reason ?? 'not available'}`);
  }
  if (!dimensions.length) limitations.push('No measured analytics were available.');
  const result = {
    result_id: `${session.session_id}:result:v1`,
    session_id: session.session_id,
    subject_id: session.subject_id,
    schema_version: '1',
    projector_version: projectorVersion,
    analytics_config_version: session.analytics_config_version,
    status: 'provisional',
    produced_at: producedAt,
    dimensions,
    segments: segments.map((segment) => segment.segment_id),
    coaching: [],
    limitations,
    evidence_index_ref: `${session.session_id}:evidence-index:v1`,
  };
  return assertResultSet(result);
}
