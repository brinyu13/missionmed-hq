// IVOC Application Intelligence — salience and confidence (donor packet §3.5).
//
//   salience = clamp(0.35·recency + 0.25·role_weight + 0.25·program_affinity + 0.15·corroboration)
//
// Deterministic given `now`. Pure module.

import { parseYearMonth } from '../normalize/fact-builder.mjs';

export const SALIENCE_WEIGHTS = Object.freeze({ recency: 0.35, role: 0.25, program: 0.25, corroboration: 0.15 });
const RECENCY_HORIZON_YEARS = 5;

const ROLE_WEIGHTS = Object.freeze({
  first_author: 1, lead: 1, principal: 1, presenter: 1, principal_investigator: 1, founder: 1, president: 1, chief: 1,
  co_author: 0.6, co_lead: 0.6, member: 0.6, resident: 0.6, coordinator: 0.6, senior: 0.6,
  contributor: 0.4, assistant: 0.4, volunteer: 0.4, observer: 0.4, participant: 0.4,
});

export function clamp01(value) {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value));
}

/** 1 for events within the last months, decaying linearly to 0 at the horizon. */
export function recencyScore(fact, now) {
  const anchor = fact.time_range?.end || fact.time_range?.start || (fact.attributes?.year ? String(fact.attributes.year) : null) || fact.attributes?.as_of;
  const a = parseYearMonth(anchor);
  const n = parseYearMonth(now);
  if (!a || !n) return 0.5; // unknown recency is neither fresh nor stale
  const years = ((n.year - a.year) * 12 + (n.month - a.month)) / 12;
  if (years <= 0) return 1;
  return clamp01(1 - years / RECENCY_HORIZON_YEARS);
}

export function roleWeight(fact) {
  const role = String(fact.attributes?.role || fact.attributes?.supervisor_role || '').toLowerCase().replace(/[\s-]+/gu, '_');
  if (!role) return 0.5;
  for (const [key, weight] of Object.entries(ROLE_WEIGHTS)) {
    if (role.includes(key)) return weight;
  }
  return 0.5;
}

export function specialtyTags(fact) {
  const tags = new Set();
  const push = (value) => { if (typeof value === 'string' && value.trim()) tags.add(value.trim().toLowerCase()); };
  if (Array.isArray(fact.attributes?.specialty_tags)) fact.attributes.specialty_tags.forEach(push);
  push(fact.attributes?.specialty);
  push(fact.attributes?.field);
  if (Array.isArray(fact.attributes?.themes)) fact.attributes.themes.forEach(push);
  return tags;
}

/** 1 when any of the fact's specialty tags matches the program's specialty; 0 without a program. */
export function programAffinity(fact, program) {
  if (!program?.specialty) return 0;
  const target = String(program.specialty).toLowerCase();
  for (const tag of specialtyTags(fact)) {
    if (tag === target || target.includes(tag) || tag.includes(target)) return 1;
  }
  return 0;
}

/** 0 for one source, 0.5 for two, 1 for three or more distinct owner projections. */
export function corroborationScore(facts) {
  const sources = new Set(facts.map((fact) => fact.provenance.projection_id));
  return clamp01((sources.size - 1) / 2);
}

export function salienceFor(facts, { now, program }) {
  if (!Array.isArray(facts) || facts.length === 0) return 0;
  const recency = Math.max(...facts.map((fact) => recencyScore(fact, now)));
  const role = Math.max(...facts.map(roleWeight));
  const affinity = Math.max(...facts.map((fact) => programAffinity(fact, program)));
  const corroboration = corroborationScore(facts);
  const score = SALIENCE_WEIGHTS.recency * recency
    + SALIENCE_WEIGHTS.role * role
    + SALIENCE_WEIGHTS.program * affinity
    + SALIENCE_WEIGHTS.corroboration * corroboration;
  return round(clamp01(score));
}

export function confidenceFor(facts) {
  if (!Array.isArray(facts) || facts.length === 0) return 0;
  return round(Math.min(...facts.map((fact) => fact.confidence)));
}

export function round(value) {
  return Math.round(value * 1000) / 1000;
}
