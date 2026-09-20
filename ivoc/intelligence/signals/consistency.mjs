// IVOC Application Intelligence — cross-source consistency (AIS-R07 support).
//
// Finds pairs of facts from different sources that describe the same thing and do
// not line up. Output is a neutral comparison record; wording and stance law are
// applied by the rules module. Nothing here asserts wrongdoing.

import { monthsBetween } from '../normalize/fact-builder.mjs';

export const OBJECTIVE_CONCERN_RELATIONS = new Set(['count_mismatch', 'institution_mismatch']);
export const OBJECTIVE_CONCERN_MIN_CONFIDENCE = 0.9;
const DATE_TOLERANCE_MONTHS = 1;

export function norm(value) {
  return String(value || '').toLowerCase().replace(/[^a-z0-9]+/gu, ' ').trim();
}

/** Stable key describing "the same experience" across sources; null when not keyable. */
export function experienceKey(fact) {
  const a = fact.attributes || {};
  switch (fact.fact_type) {
    case 'clinical_experience':
      return a.institution ? `${a.subtype}:${norm(a.institution)}` : null;
    case 'education':
      return a.institution ? `education:${norm(a.institution)}` : null;
    case 'research_item':
      return a.institution ? `research:${norm(a.institution)}` : null;
    case 'chronology_period':
      return a.organization ? `${norm(a.kind || a.role)}:${norm(a.organization)}` : null;
    case 'leadership_role':
      return a.organization ? `leadership:${norm(a.organization)}` : null;
    default:
      return null;
  }
}

export function durationMonths(fact) {
  const a = fact.attributes || {};
  if (Number.isFinite(a.duration_months)) return a.duration_months;
  if (fact.time_range?.start && fact.time_range?.end) return monthsBetween(fact.time_range.start, fact.time_range.end);
  return null;
}

function differentSources(a, b) {
  return a.provenance.projection_id !== b.provenance.projection_id;
}

/**
 * @returns {Array<{relation, a, b, detail, both_confident}>}
 */
export function findInconsistencies(facts) {
  const findings = [];
  const byKey = new Map();
  for (const fact of facts) {
    const key = experienceKey(fact);
    if (!key) continue;
    if (!byKey.has(key)) byKey.set(key, []);
    byKey.get(key).push(fact);
  }

  // 1. Same experience described by two sources with different durations or roles.
  for (const [key, group] of byKey) {
    for (let i = 0; i < group.length; i += 1) {
      for (let j = i + 1; j < group.length; j += 1) {
        const a = group[i];
        const b = group[j];
        if (!differentSources(a, b)) continue;
        const da = durationMonths(a);
        const db = durationMonths(b);
        if (da !== null && db !== null && Math.abs(da - db) > DATE_TOLERANCE_MONTHS) {
          findings.push(record('date_range_mismatch', a, b, `${key}: ${da} vs ${db} months`, { magnitude: relativeDifference(da, db) }));
        }
        const ra = norm(a.attributes.role || a.attributes.supervisor_role);
        const rb = norm(b.attributes.role || b.attributes.supervisor_role);
        if (ra && rb && ra !== rb) findings.push(record('role_title_mismatch', a, b, `${key}: "${ra}" vs "${rb}"`, { magnitude: 0.5 }));
      }
    }
  }

  // 2. Personal-statement claims with structured assertions checked against document facts.
  const claims = facts.filter((fact) => fact.fact_type === 'personal_statement_claim' && fact.attributes.asserts && typeof fact.attributes.asserts === 'object');
  for (const claim of claims) {
    const asserts = claim.attributes.asserts;
    if (asserts.experience_key) {
      const targets = (byKey.get(String(asserts.experience_key)) || []).filter((fact) => differentSources(fact, claim));
      if (targets.length === 0) {
        if (asserts.institution) findings.push(record('claim_absent_in_source', claim, claim, `no document fact matches ${asserts.experience_key}`, { self: true, magnitude: 0.5 }));
        continue;
      }
      for (const target of targets) {
        const dt = durationMonths(target);
        if (Number.isFinite(asserts.duration_months) && dt !== null && Math.abs(asserts.duration_months - dt) > DATE_TOLERANCE_MONTHS) {
          findings.push(record('date_range_mismatch', claim, target, `claim says ${asserts.duration_months} months; document says ${dt}`, { magnitude: relativeDifference(asserts.duration_months, dt) }));
        }
        if (asserts.institution && target.attributes.institution && norm(asserts.institution) !== norm(target.attributes.institution)) {
          findings.push(record('institution_mismatch', claim, target, `claim names a different institution than the document`, { magnitude: 0.75 }));
        }
      }
    }
    if (asserts.count_of && Number.isFinite(asserts.count)) {
      const actual = facts.filter((fact) => fact.fact_type === asserts.count_of && differentSources(fact, claim));
      if (actual.length > 0 && actual.length !== asserts.count) {
        findings.push(record('count_mismatch', claim, actual[0], `claim counts ${asserts.count} ${asserts.count_of}; documents list ${actual.length}`, { magnitude: relativeDifference(asserts.count, actual.length) }));
      }
    }
  }

  return dedupe(findings);
}

/** 0 when equal, approaching 1 as the two values diverge. */
export function relativeDifference(x, y) {
  const max = Math.max(Math.abs(x), Math.abs(y));
  if (!Number.isFinite(max) || max === 0) return 0;
  return Math.min(1, Math.abs(x - y) / max);
}

function record(relation, a, b, detail, { self = false, magnitude = 0.5 } = {}) {
  return {
    relation,
    a: a.fact_id,
    b: b.fact_id,
    detail,
    magnitude: Math.round(magnitude * 1000) / 1000,
    fact_refs: self ? [a.fact_id] : [a.fact_id, b.fact_id],
    both_confident: a.confidence >= OBJECTIVE_CONCERN_MIN_CONFIDENCE && b.confidence >= OBJECTIVE_CONCERN_MIN_CONFIDENCE,
    max_sensitivity: [a.sensitivity, b.sensitivity].includes('restricted') ? 'restricted' : [a.sensitivity, b.sensitivity].includes('guarded') ? 'guarded' : 'routine',
  };
}

function dedupe(findings) {
  const seen = new Set();
  return findings.filter((finding) => {
    const key = `${finding.relation}|${[finding.a, finding.b].sort().join('|')}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).sort((x, y) => (x.relation + x.a + x.b < y.relation + y.a + y.b ? -1 : 1));
}
