const FACET_LABELS = Object.freeze({
  structure: 'Structure',
  evidence: 'Evidence',
  specificity: 'Specificity',
  concision: 'Concision',
});

const FACET_DRILLS = Object.freeze({
  structure: 'Practice a three-part answer: direct opening, one supporting example, and a one-sentence close.',
  evidence: 'Rehearse one example as situation → your action → result, keeping your own contribution explicit.',
  specificity: 'Replace one general statement with a concrete action, decision, or outcome from the cited moment.',
  concision: 'Repeat the answer in 60–90 seconds while keeping the cited evidence and removing repetition.',
});

const boundedText = (value, limit = 500) => String(value || '').trim().slice(0, limit);
const boundedScore = (value) => Number.isFinite(Number(value))
  ? Math.max(0, Math.min(1, Number(value)))
  : 0;

function patternView(pattern = {}) {
  const facet = Object.hasOwn(FACET_LABELS, pattern.facet) ? pattern.facet : null;
  const polarity = ['strength', 'weakness'].includes(pattern.polarity) ? pattern.polarity : null;
  const text = boundedText(pattern.text);
  const refs = [...new Set((Array.isArray(pattern.transcriptSegmentIds) ? pattern.transcriptSegmentIds : [])
    .map((item) => boundedText(item, 96)).filter(Boolean))].slice(0, 8);
  if (!facet || !polarity || !text || !refs.length) return null;
  return Object.freeze({ facet, facetLabel: FACET_LABELS[facet], polarity, text, refs: Object.freeze(refs) });
}

function confidenceLabel(score, coverage) {
  const floor = Math.min(score, coverage);
  if (floor >= 0.8) return 'HIGH';
  if (floor >= 0.6) return 'MODERATE';
  return 'LIMITED';
}

export function projectContextResults(result = {}) {
  const analysis = result?.analysis || null;
  if (analysis?.status !== 'AVAILABLE') return Object.freeze({ status: 'UNAVAILABLE' });
  const patterns = (Array.isArray(analysis.coachingPatterns) ? analysis.coachingPatterns : [])
    .map(patternView).filter(Boolean);
  const strongest = patterns.find((item) => item.polarity === 'strength') || null;
  const improvement = patterns.find((item) => item.polarity === 'weakness') || null;
  const score = boundedScore(analysis.score);
  const coverage = boundedScore(analysis.coverage);
  const limitations = Object.freeze((Array.isArray(analysis.limitations) ? analysis.limitations : [])
    .map((item) => boundedText(item, 240)).filter(Boolean).slice(0, 8));
  return Object.freeze({
    status: 'AVAILABLE',
    strongest,
    improvement,
    drill: improvement ? Object.freeze({
      facet: improvement.facet,
      facetLabel: improvement.facetLabel,
      text: FACET_DRILLS[improvement.facet],
      refs: improvement.refs,
    }) : null,
    confidence: Object.freeze({ score, coverage, label: confidenceLabel(score, coverage), limitations }),
  });
}

