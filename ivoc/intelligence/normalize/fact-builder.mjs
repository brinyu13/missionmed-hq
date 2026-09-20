// IVOC Application Intelligence — shared fact construction for normalizers.
// Every fact built here carries full provenance back to its projection receipt.

import {
  assertApplicationFact, sanitizeAttributes, SENSITIVE_REASON_PATTERN,
} from '../contracts/application-fact.mjs';
import { factId } from '../provenance/receipts.mjs';

const NON_EMPTY = (value) => typeof value === 'string' && value.trim().length > 0;

export function timeRangeFrom(entry) {
  if (!entry) return undefined;
  const start = NON_EMPTY(entry.start) ? entry.start : undefined;
  const end = NON_EMPTY(entry.end) ? entry.end : undefined;
  if (!start && !end) return undefined;
  const precision = ['day', 'month', 'year', 'unknown'].includes(entry.precision) ? entry.precision : inferPrecision(start || end);
  return { start: start ?? null, end: end ?? null, precision };
}

function inferPrecision(value) {
  if (!NON_EMPTY(value)) return 'unknown';
  if (/^\d{4}-\d{2}-\d{2}/u.test(value)) return 'day';
  if (/^\d{4}-\d{2}$/u.test(value)) return 'month';
  if (/^\d{4}$/u.test(value)) return 'year';
  return 'unknown';
}

/** Whole months between two ISO dates (YYYY, YYYY-MM or YYYY-MM-DD); null when unknown. */
export function monthsBetween(start, end) {
  const a = parseYearMonth(start);
  const b = parseYearMonth(end);
  if (!a || !b) return null;
  return Math.max(0, (b.year - a.year) * 12 + (b.month - a.month));
}

export function parseYearMonth(value) {
  if (!NON_EMPTY(value)) return null;
  const match = /^(\d{4})(?:-(\d{2}))?/u.exec(value);
  if (!match) return null;
  return { year: Number(match[1]), month: match[2] ? Number(match[2]) : 6 };
}

export function defaultSensitivity(factType, attributes) {
  if (factType === 'exam' || factType === 'applicant_field') return 'restricted';
  if (factType === 'mspe_statement') return 'guarded';
  if (factType === 'gap_period') {
    return NON_EMPTY(attributes?.reason) && SENSITIVE_REASON_PATTERN.test(attributes.reason) ? 'restricted' : 'guarded';
  }
  return 'routine';
}

/**
 * Build one validated fact. `ctx` is the intake context for the projection:
 * `{ projection, receipt, now, excluded }` where `excluded` collects dropped attributes.
 */
export function buildFact(ctx, {
  fact_type, normalized_key, attributes, time_range, extracted_by = 'owner_structured',
  confidence, sensitivity, student_visible = true, excerpt_ref, derived_from,
}) {
  const { attributes: clean, excluded } = sanitizeAttributes(fact_type, attributes);
  if (Object.keys(excluded).length) ctx.excluded.push({ normalized_key, excluded });
  const fact = {
    schema_version: '1',
    fact_id: factId({ fact_type, owner_app: ctx.receipt.owner_app, source_version: ctx.receipt.source_version, normalized_key }),
    subject_id: ctx.projection.subject_id,
    fact_type,
    attributes: clean,
    provenance: {
      projection_id: ctx.receipt.projection_id,
      owner_app: ctx.receipt.owner_app,
      projection_type: ctx.receipt.projection_type,
      source_version: ctx.receipt.source_version,
      source_receipt_hash: ctx.receipt.source_receipt_hash,
      extracted_by,
      extracted_at: ctx.now,
    },
    confidence: confidence ?? (extracted_by === 'owner_structured' ? 1 : extracted_by === 'deterministic_parser' ? 0.95 : 0.8),
    sensitivity: sensitivity ?? defaultSensitivity(fact_type, clean),
    student_visible,
    version: 1,
    stale: ctx.receipt.degraded?.state === 'stale',
  };
  if (time_range) fact.time_range = time_range;
  if (NON_EMPTY(excerpt_ref)) fact.provenance.excerpt_ref = excerpt_ref;
  if (Array.isArray(derived_from) && derived_from.length) fact.provenance.derived_from = derived_from;
  return assertApplicationFact(fact);
}
