// IVOC Application Intelligence — reactive trigger evaluation.
// Browser-safe: no Node imports. Pure lexical matching over the pack's trigger
// index (donor packet §4.8). Semantic matching, if ever added, goes behind
// `SemanticMatcher` (see ./semantic-matcher.mjs) and never replaces this authority.

import { tokenize } from '../pack/trigger-index.mjs';

const NUMBER_WORDS = Object.freeze({
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12,
  half: 0.5, couple: 2, few: 3, several: 3,
});
const DURATION_PATTERN = /\b(\d+(?:\.\d+)?|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|half|couple(?: of)?|few|several)\s+(?:of\s+)?(week|month|year)s?\b/giu;

/**
 * Match answer text against the pack's trigger index.
 * @returns {Array<{signal_id, matched_lexemes: string[], matches: number, salience: number, sensitivity: string}>}
 */
export function evaluateReactiveTriggers(pack, text, { max = 3 } = {}) {
  if (!pack || typeof pack.trigger_index !== 'object') throw new TypeError('pack with trigger_index is required');
  if (typeof text !== 'string') throw new TypeError('text must be a string');
  const byId = new Map(pack.signals.map((s) => [s.signal_id, s]));
  const hits = new Map();
  for (const lexeme of new Set(tokenize(text))) {
    const ids = pack.trigger_index[lexeme];
    if (!ids) continue;
    for (const id of ids) {
      const entry = hits.get(id) || { signal_id: id, matched_lexemes: [] };
      entry.matched_lexemes.push(lexeme);
      hits.set(id, entry);
    }
  }
  return [...hits.values()]
    .map((entry) => {
      const signal = byId.get(entry.signal_id);
      return {
        ...entry,
        matched_lexemes: entry.matched_lexemes.sort(),
        matches: entry.matched_lexemes.length,
        salience: signal?.salience ?? 0,
        sensitivity: signal?.sensitivity ?? 'routine',
        stance: signal?.stance ?? 'interviewer_plausible',
        kind: signal?.kind ?? null,
      };
    })
    .filter((entry) => entry.kind !== null)
    .sort((a, b) => b.matches - a.matches || b.salience - a.salience || (a.signal_id < b.signal_id ? -1 : 1))
    .slice(0, max);
}

/** Deterministic duration mentions in text, in months. */
export function extractDurationMentions(text) {
  const out = [];
  for (const match of String(text || '').matchAll(DURATION_PATTERN)) {
    const raw = match[1].toLowerCase().replace(/\s+of$/u, '');
    const amount = Number.isFinite(Number(raw)) ? Number(raw) : NUMBER_WORDS[raw];
    if (!Number.isFinite(amount)) continue;
    const unit = match[2].toLowerCase();
    const months = unit === 'year' ? amount * 12 : unit === 'week' ? amount / 4 : amount;
    out.push({ text: match[0], months: Math.round(months * 10) / 10 });
  }
  return out;
}

/**
 * Answer-versus-document consistency: when the answer mentions a duration for an
 * experience the pack knows (matched by lexeme) and the two differ by more than a
 * month, return a neutral clarification candidate. Never an accusation.
 */
export function evaluateLiveConsistency(pack, text, { tolerance_months = 1 } = {}) {
  const mentions = extractDurationMentions(text);
  if (mentions.length === 0) return [];
  const lexemes = new Set(tokenize(text));
  const candidates = [];
  for (const fact of pack.facts) {
    if (fact.sensitivity === 'restricted') continue;
    const a = fact.attributes || {};
    const duration = Number.isFinite(a.duration_months) ? a.duration_months : null;
    if (duration === null) continue;
    const anchor = [a.institution, a.organization, a.setting, a.subtype, a.title].filter((v) => typeof v === 'string').join(' ');
    const anchorLexemes = tokenize(anchor);
    if (!anchorLexemes.some((w) => lexemes.has(w))) continue;
    for (const mention of mentions) {
      if (Math.abs(mention.months - duration) > tolerance_months) {
        candidates.push({
          kind: 'consistency_check',
          relation: 'date_range_mismatch',
          stance: 'interviewer_plausible',
          fact_refs: [fact.fact_id],
          detail: `answer mentions ${mention.text}; document lists ${duration} months`,
          probe: `Help me line up the timeline of ${a.institution || a.organization || 'that experience'}.`,
        });
      }
    }
  }
  return candidates.sort((x, y) => (x.fact_refs[0] < y.fact_refs[0] ? -1 : 1));
}
