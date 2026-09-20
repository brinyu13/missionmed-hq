// IVOC Application Intelligence — reactive trigger index.
// Browser-safe: no Node imports, no I/O. The same code runs server-side (authority)
// and may run in the browser as a latency pre-match (never authority).

export const STOPWORDS = new Set([
  'about', 'after', 'again', 'also', 'although', 'always', 'another', 'around', 'because', 'been', 'before',
  'being', 'between', 'both', 'could', 'department', 'does', 'doing', 'done', 'during', 'each', 'either',
  'even', 'every', 'from', 'general', 'have', 'having', 'here', 'hospital', 'into', 'just', 'like', 'made',
  'make', 'many', 'medical', 'medicine', 'more', 'most', 'much', 'other', 'over', 'part', 'really', 'same',
  'several', 'since', 'some', 'something', 'still', 'such', 'than', 'that', 'their', 'them', 'then', 'there',
  'these', 'they', 'thing', 'things', 'this', 'those', 'three', 'through', 'time', 'university', 'very',
  'want', 'well', 'were', 'what', 'when', 'where', 'which', 'while', 'with', 'within', 'without', 'work',
  'worked', 'working', 'would', 'year', 'years', 'your',
]);

const MIN_LEXEME_LENGTH = 4;

/** Lowercase, strip diacritics and punctuation, crude English singularization. */
export function normalizeLexeme(word) {
  let w = String(word || '').normalize('NFKD').replace(/[̀-ͯ]/gu, '').toLowerCase();
  w = w.replace(/[^a-z0-9]+/gu, '');
  if (w.length > 5 && w.endsWith('ies')) w = `${w.slice(0, -3)}y`;
  else if (w.length > 4 && w.endsWith('es') && !w.endsWith('ses')) w = w.slice(0, -2);
  else if (w.length > 4 && w.endsWith('s') && !w.endsWith('ss')) w = w.slice(0, -1);
  return w;
}

export function tokenize(text) {
  return String(text || '').split(/[^A-Za-z0-9À-ɏ'-]+/u).map(normalizeLexeme).filter((w) => w.length >= MIN_LEXEME_LENGTH && !STOPWORDS.has(w));
}

/** Distinct lexemes from free text, in first-seen order, capped. */
export function lexemesFromText(text, max = 12) {
  const out = [];
  for (const token of tokenize(text)) {
    if (!out.includes(token)) out.push(token);
    if (out.length >= max) break;
  }
  return out;
}

/** Build lexeme → sorted signal ids, capped at `max` entries by signal salience. */
export function buildTriggerIndex(signals, { max = 200 } = {}) {
  const weights = new Map();
  for (const signal of signals) {
    for (const trigger of signal.reactive_triggers) {
      const key = normalizeLexeme(trigger);
      if (!key) continue;
      const entry = weights.get(key) || { ids: new Set(), weight: 0 };
      entry.ids.add(signal.signal_id);
      entry.weight = Math.max(entry.weight, signal.salience);
      weights.set(key, entry);
    }
  }
  const ordered = [...weights.entries()].sort((a, b) => b[1].weight - a[1].weight || (a[0] < b[0] ? -1 : 1)).slice(0, max);
  const index = {};
  for (const [key, entry] of ordered) index[key] = [...entry.ids].sort();
  return index;
}
