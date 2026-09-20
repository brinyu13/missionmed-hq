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

const FILLER_TOKEN_PATTERN = /\b(?:um+|uh+|erm+|like|you know|i mean)\b/giu;

export function projectTranscriptMetrics(result = {}) {
  const transcript = result?.transcript || {};
  const text = boundedText(transcript.text, 20_000);
  if (transcript.status !== 'AVAILABLE' || !text) return Object.freeze({ status: 'UNAVAILABLE' });
  const segments = (Array.isArray(transcript.segments) ? transcript.segments : [])
    .map((segment, index) => ({
      id: boundedText(segment?.id || `seg-${index + 1}`, 96),
      startMs: Math.max(0, Math.trunc(Number(segment?.startMs) || 0)),
      endMs: Math.max(0, Math.trunc(Number(segment?.endMs) || 0)),
    }))
    .filter((segment) => segment.id && segment.endMs >= segment.startMs);
  const words = text.split(/\s+/u).filter(Boolean);
  const matches = [...text.matchAll(FILLER_TOKEN_PATTERN)];
  const startMs = segments.length ? Math.min(...segments.map((segment) => segment.startMs)) : null;
  const endMs = segments.length ? Math.max(...segments.map((segment) => segment.endMs)) : null;
  return Object.freeze({
    status: 'AVAILABLE',
    wordCount: words.length,
    fillerTokenCount: matches.length,
    segmentCount: segments.length,
    startMs,
    endMs,
    basis: 'CANONICAL_PERSISTED_TRANSCRIPT',
    limitations: Object.freeze(['bounded_lexical_candidates_not_all_disfluencies']),
  });
}

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

const evidenceRefs = (row = {}) => Object.freeze([...(Array.isArray(row.refs) ? row.refs : [])]
  .map((item) => boundedText(String(item?.ref || '').split('#').at(-1), 96))
  .filter(Boolean).slice(0, 8));

export function contextResultFromSessionSpine(session = {}) {
  const spine = session?.spine || {};
  const turns = (Array.isArray(spine.turns) ? spine.turns : [])
    .filter((turn) => turn?.speaker === 'student' && turn?.transcript?.canonical_ref && boundedText(turn?.transcript?.text));
  if (!turns.length) return Object.freeze({ transcript: Object.freeze({ status: 'UNAVAILABLE', reason: 'NO_PERSISTED_TRANSCRIPT' }) });
  const evidence = Array.isArray(spine.evidence) ? spine.evidence : [];
  const semanticObservations = evidence
    .filter((row) => ['semantic.supported_claim', 'semantic.answer_structure'].includes(row?.dimension))
    .map((row) => Object.freeze({
      kind: row.dimension === 'semantic.answer_structure' ? 'ANSWER_STRUCTURE' : 'SUPPORTED_CLAIM',
      text: boundedText(row?.interpretation?.text),
      transcriptSegmentIds: evidenceRefs(row),
    })).filter((item) => item.text && item.transcriptSegmentIds.length);
  const coachingPatterns = evidence
    .filter((row) => row?.dimension === 'semantic.coaching_pattern')
    .map((row) => Object.freeze({
      facet: boundedText(row?.interpretation?.facet, 40).toLowerCase(),
      polarity: boundedText(row?.interpretation?.polarity, 40).toLowerCase(),
      text: boundedText(row?.interpretation?.text),
      transcriptSegmentIds: evidenceRefs(row),
    })).filter((item) => item.text && item.transcriptSegmentIds.length);
  const scored = evidence.map((row) => Number(row?.score?.value)).filter(Number.isFinite);
  const covered = evidence.map((row) => Number(row?.confidence)).filter(Number.isFinite);
  const limitations = [...new Set(evidence.flatMap((row) => Array.isArray(row?.limitations) ? row.limitations : [])
    .map((item) => boundedText(item, 240)).filter(Boolean))].slice(0, 8);
  return Object.freeze({
    transcript: Object.freeze({
      status: 'AVAILABLE',
      text: turns.map((turn) => boundedText(turn.transcript.text)).join(' '),
      segments: Object.freeze(turns.map((turn, index) => Object.freeze({
        id: boundedText(String(turn.transcript.canonical_ref).split('#').at(-1) || `seg-${index + 1}`, 96),
        startMs: Math.max(0, Math.trunc(Number(turn.startMs) || 0)),
        endMs: Math.max(0, Math.trunc(Number(turn.endMs) || 0)),
      }))),
    }),
    analysis: Object.freeze({
      status: semanticObservations.length || coachingPatterns.length ? 'AVAILABLE' : 'UNAVAILABLE',
      semanticObservations: Object.freeze(semanticObservations),
      coachingPatterns: Object.freeze(coachingPatterns),
      score: scored.length ? Math.min(...scored) : 0,
      coverage: covered.length ? Math.min(...covered) : 0,
      limitations: Object.freeze(limitations),
    }),
    persistence: Object.freeze({ transcript: true }),
  });
}
