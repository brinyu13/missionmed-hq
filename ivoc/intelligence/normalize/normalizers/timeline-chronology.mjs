// Normalizer: `timeline.chronology` → chronology_period facts.
//
//   payload = { periods: [{ period_id, start, end?, precision?, role, organization?, kind?, country? }] }
//
// Gaps are NOT emitted here; they are derived deterministically by the rules
// (AIS-R02) from the ordered chronology so the derivation is one place only.

import { buildFact, timeRangeFrom } from '../fact-builder.mjs';
import { NormalizerError } from './filevault-document.mjs';

export const PROJECTION_TYPE = 'timeline.chronology';
const NON_EMPTY = (value) => typeof value === 'string' && value.trim().length > 0;

export function normalize(ctx) {
  const periods = ctx.projection.payload?.periods;
  if (!Array.isArray(periods)) throw new NormalizerError('invalid_chronology_payload', 'payload.periods must be an array');
  return periods.map((period) => {
    if (!NON_EMPTY(period.period_id) || !NON_EMPTY(period.role) || !NON_EMPTY(period.start)) {
      throw new NormalizerError('invalid_period', 'each period needs period_id, role and start');
    }
    return buildFact(ctx, {
      fact_type: 'chronology_period',
      normalized_key: `period:${period.period_id}`,
      attributes: { role: period.role, organization: period.organization, kind: period.kind, country: period.country },
      time_range: timeRangeFrom(period),
    });
  });
}
