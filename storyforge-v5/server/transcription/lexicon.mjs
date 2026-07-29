export const medicalLexiconVersion = '2026-07-29.1';

export const medicalLexicon = Object.freeze([
  'anastomosis',
  'auscultation',
  'CBC',
  'creatinine',
  'enoxaparin',
  'hemoglobin',
  'ICU',
  'Lasix',
  'metoprolol',
  'NSTEMI',
  'paracentesis',
  'PEA',
  'systolic',
  'troponin',
  'Whipple',
]);

function normalized(value) {
  return String(value || '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

function editDistance(left, right) {
  const a = normalized(left);
  const b = normalized(right);
  if (!a) return b.length;
  if (!b) return a.length;
  const previous = Array.from({ length: b.length + 1 }, (_, index) => index);
  for (let row = 1; row <= a.length; row += 1) {
    const current = [row];
    for (let column = 1; column <= b.length; column += 1) {
      current[column] = Math.min(
        current[column - 1] + 1,
        previous[column] + 1,
        previous[column - 1] + (a[row - 1] === b[column - 1] ? 0 : 1),
      );
    }
    previous.splice(0, previous.length, ...current);
  }
  return previous[b.length];
}

function distanceLimit(term) {
  const length = normalized(term).length;
  if (length < 5) return 0;
  if (length < 8) return 1;
  return 2;
}

export function flagLexiconTerms(text, lexicon = medicalLexicon) {
  const tokens = String(text || '').match(/[A-Za-z][A-Za-z0-9-]*/g) || [];
  const flags = [];
  const seen = new Set();
  for (const heard of tokens) {
    let candidate = null;
    let bestDistance = Number.POSITIVE_INFINITY;
    for (const expected of lexicon) {
      const distance = editDistance(heard, expected);
      if (distance > distanceLimit(expected) || distance >= bestDistance) continue;
      bestDistance = distance;
      candidate = expected;
    }
    if (!candidate) continue;
    const sameLetters = normalized(heard) === normalized(candidate);
    if (sameLetters && heard === candidate) continue;
    const key = `${heard}\0${candidate}`;
    if (seen.has(key)) continue;
    seen.add(key);
    flags.push(Object.freeze({
      from: heard,
      to: candidate,
      source: 'lexicon',
      lexiconVersion: medicalLexiconVersion,
    }));
  }
  return flags;
}

export const lexiconInternals = Object.freeze({
  editDistance,
  normalized,
});
