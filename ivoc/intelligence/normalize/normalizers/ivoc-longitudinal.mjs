// Normalizer: `ivoc.longitudinal_summary` (8000 §17 shape) → prior_ivoc_pattern facts.
//
//   payload = { recurring: { weaknesses: [{ facet, sessions[], evidence_refs[] }], strengths: [...] } }
//
// Only recurring facets (≥ 2 sessions) become facts; single observations are not patterns.

import { buildFact } from '../fact-builder.mjs';
import { NormalizerError } from './filevault-document.mjs';

export const PROJECTION_TYPE = 'ivoc.longitudinal_summary';
const NON_EMPTY = (value) => typeof value === 'string' && value.trim().length > 0;

export function normalize(ctx) {
  const recurring = ctx.projection.payload?.recurring;
  if (!recurring || typeof recurring !== 'object') throw new NormalizerError('invalid_longitudinal_payload', 'payload.recurring is required');
  const facts = [];
  for (const polarity of ['weakness', 'strength']) {
    const list = recurring[`${polarity === 'weakness' ? 'weaknesses' : 'strengths'}`] ?? [];
    if (!Array.isArray(list)) throw new NormalizerError('invalid_longitudinal_payload', `payload.recurring.${polarity} list must be an array`);
    for (const item of list) {
      if (!NON_EMPTY(item.facet)) throw new NormalizerError('invalid_pattern', 'each recurring item needs a facet');
      const sessions = Array.isArray(item.sessions) ? item.sessions : [];
      if (sessions.length < 2) {
        ctx.dropped_items.push({ projection_id: ctx.receipt.projection_id, item: item.facet, reason: 'not_recurring' });
        continue;
      }
      facts.push(buildFact(ctx, {
        fact_type: 'prior_ivoc_pattern',
        normalized_key: `pattern:${polarity}:${item.facet}`,
        attributes: { facet: item.facet, polarity, sessions, evidence_refs: Array.isArray(item.evidence_refs) ? item.evidence_refs : undefined },
        sensitivity: 'guarded',
      }));
    }
  }
  return facts;
}
