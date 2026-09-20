// Normalizer: `mcc.priorities` → mentor_priority facts.
//
//   payload = { top3: [{ id, text, set_by, set_at, rank? }], drills?: [], mentor_notes?: [{ id, text, visibility }] }
//
// Until an MCC owner exists, IVOC hosts mentor Top 3 in this exact shape as
// `ivoc.mentor_priorities` (donor packet §7 decision); the normalizer is identical.

import { buildFact } from '../fact-builder.mjs';
import { NormalizerError } from './filevault-document.mjs';

export const PROJECTION_TYPE = 'mcc.priorities';
export const ALIAS_PROJECTION_TYPE = 'ivoc.mentor_priorities';
const NON_EMPTY = (value) => typeof value === 'string' && value.trim().length > 0;

export function normalize(ctx) {
  const payload = ctx.projection.payload;
  const top3 = payload?.top3 ?? [];
  if (!Array.isArray(top3) || top3.length > 3) throw new NormalizerError('invalid_priorities_payload', 'payload.top3 must be an array of at most three items');
  const facts = [];
  top3.forEach((item, index) => {
    if (!NON_EMPTY(item.id) || !NON_EMPTY(item.text) || !NON_EMPTY(item.set_by) || !NON_EMPTY(item.set_at)) {
      throw new NormalizerError('invalid_priority', 'each top3 item needs id, text, set_by and set_at');
    }
    facts.push(buildFact(ctx, {
      fact_type: 'mentor_priority',
      normalized_key: `priority:${item.id}`,
      attributes: { priority_id: item.id, text: item.text, set_by: item.set_by, set_at: item.set_at, rank: Number.isInteger(item.rank) ? item.rank : index + 1, visibility: 'shared' },
    }));
  });
  const notes = payload?.mentor_notes ?? [];
  if (!Array.isArray(notes)) throw new NormalizerError('invalid_priorities_payload', 'payload.mentor_notes must be an array');
  for (const note of notes) {
    if (!NON_EMPTY(note.id) || !NON_EMPTY(note.text)) throw new NormalizerError('invalid_note', 'each mentor note needs id and text');
    const mentorOnly = note.visibility !== 'shared';
    facts.push(buildFact(ctx, {
      fact_type: 'mentor_priority',
      normalized_key: `note:${note.id}`,
      attributes: { priority_id: note.id, text: note.text, visibility: mentorOnly ? 'mentor_only' : 'shared' },
      sensitivity: mentorOnly ? 'guarded' : 'routine',
      student_visible: !mentorOnly,
    }));
  }
  return facts;
}
