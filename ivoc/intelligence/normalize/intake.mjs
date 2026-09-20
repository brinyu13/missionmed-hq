// IVOC Application Intelligence — projection intake.
//
// Accepts `matrix.projection.v1` envelopes (validated with the existing F1
// `assertProjectionEnvelope`), enforces subject separation, drops revoked or
// unavailable inputs, labels stale ones, and routes each payload to its
// deterministic normalizer. Fails closed: malformed or unsupported input throws;
// nothing is guessed.

import { assertProjectionEnvelope } from '../../contracts/projection-envelope.mjs';
import { sourceReceiptFromProjection } from '../provenance/receipts.mjs';
import * as filevaultDocument from './normalizers/filevault-document.mjs';
import * as storyforgeStories from './normalizers/storyforge-stories.mjs';
import * as riseProgram from './normalizers/rise-program.mjs';
import * as mccPriorities from './normalizers/mcc-priorities.mjs';
import * as ivocLongitudinal from './normalizers/ivoc-longitudinal.mjs';
import * as timelineChronology from './normalizers/timeline-chronology.mjs';
import * as matrixApplicantFields from './normalizers/matrix-applicant-fields.mjs';

const NORMALIZERS = Object.freeze({
  [filevaultDocument.PROJECTION_TYPE]: filevaultDocument.normalize,
  [storyforgeStories.PROJECTION_TYPE]: storyforgeStories.normalize,
  [riseProgram.PROJECTION_TYPE]: riseProgram.normalize,
  [mccPriorities.PROJECTION_TYPE]: mccPriorities.normalize,
  [mccPriorities.ALIAS_PROJECTION_TYPE]: mccPriorities.normalize,
  [ivocLongitudinal.PROJECTION_TYPE]: ivocLongitudinal.normalize,
  [timelineChronology.PROJECTION_TYPE]: timelineChronology.normalize,
  [matrixApplicantFields.PROJECTION_TYPE]: matrixApplicantFields.normalize,
});

export const SUPPORTED_PROJECTION_TYPES = Object.freeze(Object.keys(NORMALIZERS));

const NON_EMPTY = (value) => typeof value === 'string' && value.trim().length > 0;

export class IntakeError extends TypeError {
  constructor(code, message, detail) {
    super(message || code);
    this.name = 'IntakeError';
    this.code = code;
    if (detail !== undefined) this.detail = detail;
  }
}

/**
 * @param {object[]} projections  matrix.projection.v1 envelopes
 * @param {object} options
 * @param {string} options.subject_id   the one subject this intake may serve
 * @param {string} options.now          ISO timestamp used for freshness and extraction time
 * @param {Iterable<string>} [options.revoked]  projection ids revoked since production
 * @returns {{ facts, receipts, documents, program, dropped, dropped_items, excluded }}
 */
export function intakeProjections(projections, { subject_id, now, revoked = [] } = {}) {
  if (!Array.isArray(projections)) throw new IntakeError('invalid_input', 'projections must be an array');
  if (!NON_EMPTY(subject_id)) throw new IntakeError('invalid_input', 'subject_id is required');
  if (!NON_EMPTY(now) || Number.isNaN(Date.parse(now))) throw new IntakeError('invalid_input', 'now must be an ISO timestamp');
  const revokedSet = new Set(revoked);
  const result = { facts: [], receipts: [], documents: [], program: null, dropped: [], dropped_items: [], excluded: [] };
  const seen = new Set();
  const factIds = new Set();

  for (const projection of projections) {
    let envelope;
    try {
      envelope = assertProjectionEnvelope(projection);
    } catch (error) {
      throw new IntakeError('malformed_projection', `projection rejected: ${error.message}`, { projection_id: projection?.projection_id ?? null });
    }
    if (envelope.subject_id !== subject_id) {
      throw new IntakeError('subject_mismatch', 'projection belongs to a different subject', { projection_id: envelope.projection_id });
    }
    if (seen.has(envelope.projection_id)) throw new IntakeError('duplicate_projection', `duplicate projection ${envelope.projection_id}`);
    seen.add(envelope.projection_id);
    const normalize = NORMALIZERS[envelope.projection_type];
    if (!normalize) throw new IntakeError('unsupported_projection_type', `unsupported projection_type ${envelope.projection_type}`, { projection_id: envelope.projection_id });

    const receipt = sourceReceiptFromProjection(envelope, { now });
    if (revokedSet.has(envelope.projection_id)) {
      result.dropped.push({ projection_id: envelope.projection_id, reason: 'revoked' });
      continue;
    }
    if (receipt.degraded?.state === 'unavailable') {
      result.dropped.push({ projection_id: envelope.projection_id, reason: `unavailable: ${receipt.degraded.reason}` });
      continue;
    }
    result.receipts.push(receipt);

    const ctx = { projection: envelope, receipt, now, documents: result.documents, dropped_items: result.dropped_items, excluded: result.excluded, program: null };
    let facts;
    try {
      facts = normalize(ctx);
    } catch (error) {
      throw new IntakeError('normalization_failed', `projection ${envelope.projection_id}: ${error.message}`, { projection_id: envelope.projection_id, code: error.code ?? null });
    }
    for (const fact of facts) {
      if (fact.subject_id !== subject_id) throw new IntakeError('subject_mismatch', 'normalizer produced a fact for a different subject');
      if (factIds.has(fact.fact_id)) throw new IntakeError('duplicate_fact', `duplicate fact ${fact.fact_id}`);
      factIds.add(fact.fact_id);
      result.facts.push(fact);
    }
    if (ctx.program) {
      if (result.program && result.program.program_ref !== ctx.program.program_ref) {
        throw new IntakeError('program_conflict', 'two program projections name different programs');
      }
      result.program = ctx.program;
    }
  }
  result.facts.sort((a, b) => (a.fact_id < b.fact_id ? -1 : a.fact_id > b.fact_id ? 1 : 0));
  result.receipts.sort((a, b) => (a.projection_id < b.projection_id ? -1 : 1));
  return result;
}
