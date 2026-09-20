// Normalizer: `matrix.applicant_fields` → applicant_field facts (restricted by default).
//
//   payload = { fields: [{ field, value, as_of? }] }
//
// Matrix owns applicant fields (RISE passport). Everything here is `restricted`:
// never proactive, never in the actor block, reactive only under a profile that allows it.

import { buildFact } from '../fact-builder.mjs';
import { isProhibitedAttributeKey } from '../../contracts/application-fact.mjs';
import { NormalizerError } from './filevault-document.mjs';

export const PROJECTION_TYPE = 'matrix.applicant_fields';
const NON_EMPTY = (value) => typeof value === 'string' && value.trim().length > 0;

export function normalize(ctx) {
  const fields = ctx.projection.payload?.fields;
  if (!Array.isArray(fields)) throw new NormalizerError('invalid_applicant_fields_payload', 'payload.fields must be an array');
  const facts = [];
  for (const item of fields) {
    if (!NON_EMPTY(item.field)) throw new NormalizerError('invalid_applicant_field', 'each field needs a name');
    if (isProhibitedAttributeKey(item.field)) {
      ctx.dropped_items.push({ projection_id: ctx.receipt.projection_id, item: item.field, reason: 'prohibited_attribute' });
      continue;
    }
    if (item.value === undefined || item.value === null || item.value === '') {
      ctx.dropped_items.push({ projection_id: ctx.receipt.projection_id, item: item.field, reason: 'empty' });
      continue;
    }
    facts.push(buildFact(ctx, {
      fact_type: 'applicant_field',
      normalized_key: `field:${item.field}`,
      attributes: { field: item.field, value: String(item.value), as_of: item.as_of },
      sensitivity: 'restricted',
    }));
  }
  return facts;
}
