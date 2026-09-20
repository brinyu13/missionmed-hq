// Normalizer: `rise.program_cheat_sheet` → program_interest facts + pack program block.
//
//   payload = { program_id, name, specialty?, state?, type?,
//               high_yield_facts?: [{ fact, source_ref, as_of }],
//               people?: [{ role, source_ref, as_of? }] }
//
// Only sourced facts (with source_ref) become facts the Actor may speak. People are
// carried as roles with source refs only; no names enter this lane.

import { buildFact } from '../fact-builder.mjs';
import { NormalizerError } from './filevault-document.mjs';

export const PROJECTION_TYPE = 'rise.program_cheat_sheet';
const NON_EMPTY = (value) => typeof value === 'string' && value.trim().length > 0;

export function normalize(ctx) {
  const payload = ctx.projection.payload;
  if (!NON_EMPTY(payload?.program_id) || !NON_EMPTY(payload?.name)) {
    throw new NormalizerError('invalid_program_payload', 'payload.program_id and payload.name are required');
  }
  const facts = [];
  facts.push(buildFact(ctx, {
    fact_type: 'program_interest',
    normalized_key: `program:${payload.program_id}:identity`,
    attributes: { program_id: payload.program_id, name: payload.name, specialty: payload.specialty },
  }));
  const highYield = payload.high_yield_facts ?? [];
  if (!Array.isArray(highYield)) throw new NormalizerError('invalid_program_payload', 'payload.high_yield_facts must be an array');
  highYield.forEach((item, index) => {
    if (!NON_EMPTY(item.fact) || !NON_EMPTY(item.source_ref)) {
      ctx.dropped_items.push({ projection_id: ctx.receipt.projection_id, item: `high_yield_facts[${index}]`, reason: 'unsourced_program_fact' });
      return;
    }
    facts.push(buildFact(ctx, {
      fact_type: 'program_interest',
      normalized_key: `program:${payload.program_id}:fact:${index}:${item.source_ref}`,
      attributes: { program_id: payload.program_id, specialty: payload.specialty, fact: item.fact, source_ref: item.source_ref, as_of: item.as_of },
    }));
  });
  const people = payload.people ?? [];
  if (!Array.isArray(people)) throw new NormalizerError('invalid_program_payload', 'payload.people must be an array');
  people.forEach((person, index) => {
    if (!NON_EMPTY(person.role) || !NON_EMPTY(person.source_ref)) {
      ctx.dropped_items.push({ projection_id: ctx.receipt.projection_id, item: `people[${index}]`, reason: 'unsourced_person_role' });
      return;
    }
    facts.push(buildFact(ctx, {
      fact_type: 'program_interest',
      normalized_key: `program:${payload.program_id}:people:${index}:${person.source_ref}`,
      attributes: { program_id: payload.program_id, people_role: person.role, source_ref: person.source_ref, as_of: person.as_of },
    }));
  });
  ctx.program = Object.freeze({
    program_ref: payload.program_id,
    name: payload.name,
    specialty: payload.specialty ?? null,
    projection_id: ctx.receipt.projection_id,
    source_version: ctx.receipt.source_version,
  });
  return facts;
}
