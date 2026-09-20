// Normalizer: `filevault.document_projection` → ApplicationFacts.
//
// IVOC-side payload contract the File Vault owner (or a later DocumentExcerptor)
// targets. IVOC never parses PDFs here; it consumes typed entries.
//
//   payload = {
//     doc_id, kind: 'cv'|'ps'|'mspe'|'application'|'coaching', version, content_hash, as_of,
//     entries?:    [{ entry_id, entry_type, start?, end?, precision?, excerpt_ref?, extracted_by?, ...attributes }],
//     claims?:     [{ claim_id, text (≤40 words), themes?, claim_type?, asserts?, excerpt_ref? }],   // ps
//     statements?: [{ statement_id, text (≤60 words), topic?, excerpt_ref? }],                       // mspe
//   }
//
// entry_type ∈ research_item | publication | presentation | clinical_experience | education |
//              exam | chronology_period | leadership_role | teaching_role | language

import { buildFact, timeRangeFrom, monthsBetween } from '../fact-builder.mjs';

export const PROJECTION_TYPE = 'filevault.document_projection';
export const DOCUMENT_KINDS = Object.freeze(['cv', 'ps', 'mspe', 'application', 'coaching']);
const ENTRY_TYPES = new Set([
  'research_item', 'publication', 'presentation', 'clinical_experience', 'education',
  'exam', 'chronology_period', 'leadership_role', 'teaching_role', 'language',
]);
const NON_EMPTY = (value) => typeof value === 'string' && value.trim().length > 0;

export class NormalizerError extends TypeError {
  constructor(code, message) { super(message || code); this.name = 'NormalizerError'; this.code = code; }
}

export function documentPointer(payload) {
  for (const key of ['doc_id', 'kind', 'version', 'content_hash', 'as_of']) {
    if (!NON_EMPTY(payload?.[key])) throw new NormalizerError('invalid_document_payload', `payload.${key} is required`);
  }
  if (!DOCUMENT_KINDS.includes(payload.kind)) throw new NormalizerError('invalid_document_payload', 'payload.kind is invalid');
  return Object.freeze({ doc_id: payload.doc_id, kind: payload.kind, version: payload.version, content_hash: payload.content_hash, as_of: payload.as_of });
}

export function normalize(ctx) {
  const payload = ctx.projection.payload;
  const pointer = documentPointer(payload);
  ctx.documents.push(pointer);
  const facts = [];
  const prefix = `${pointer.kind}:${pointer.doc_id}`;

  for (const entry of asArray(payload.entries, 'entries')) {
    if (!NON_EMPTY(entry.entry_id) || !ENTRY_TYPES.has(entry.entry_type)) {
      throw new NormalizerError('invalid_entry', 'each entry needs entry_id and a supported entry_type');
    }
    const { entry_id, entry_type, start, end, precision, excerpt_ref, extracted_by, ...attributes } = entry;
    const time_range = timeRangeFrom({ start, end, precision });
    if (entry_type === 'clinical_experience' && attributes.duration_months === undefined && time_range?.start && time_range?.end) {
      const months = monthsBetween(time_range.start, time_range.end);
      if (months !== null) attributes.duration_months = months;
    }
    facts.push(buildFact(ctx, {
      fact_type: entry_type,
      normalized_key: `${prefix}:entry:${entry_id}`,
      attributes,
      time_range,
      excerpt_ref,
      extracted_by: extracted_by ?? 'owner_structured',
    }));
  }

  for (const claim of asArray(payload.claims, 'claims')) {
    if (!NON_EMPTY(claim.claim_id) || !NON_EMPTY(claim.text)) throw new NormalizerError('invalid_claim', 'each claim needs claim_id and text');
    facts.push(buildFact(ctx, {
      fact_type: 'personal_statement_claim',
      normalized_key: `${prefix}:claim:${claim.claim_id}`,
      attributes: { text: claim.text, themes: claim.themes, claim_type: claim.claim_type, asserts: claim.asserts },
      excerpt_ref: claim.excerpt_ref,
      extracted_by: claim.extracted_by ?? 'owner_structured',
    }));
  }

  for (const statement of asArray(payload.statements, 'statements')) {
    if (!NON_EMPTY(statement.statement_id) || !NON_EMPTY(statement.text)) throw new NormalizerError('invalid_statement', 'each statement needs statement_id and text');
    facts.push(buildFact(ctx, {
      fact_type: 'mspe_statement',
      normalized_key: `${prefix}:statement:${statement.statement_id}`,
      attributes: { text: statement.text, topic: statement.topic },
      excerpt_ref: statement.excerpt_ref,
      extracted_by: statement.extracted_by ?? 'owner_structured',
      sensitivity: 'guarded',
    }));
  }
  return facts;
}

function asArray(value, label) {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value)) throw new NormalizerError('invalid_document_payload', `payload.${label} must be an array`);
  return value;
}
