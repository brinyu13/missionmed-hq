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
const recordedMs = (value) => value !== null && value !== undefined && value !== ''
  && Number.isFinite(Number(value)) && Number(value) >= 0 ? Number(value) : null;

export function normalizeNameUseCoaching(value) {
  if (value?.schema !== 'ivoc.name-use.v1' || value.enabled !== true || value.source !== 'manual'
      || typeof value.name !== 'string') return null;
  const name = value.name.normalize('NFKC').trim();
  if (!name || name.length > 100 || /[\p{Cc}\p{Cf}]/u.test(name) || !/\p{L}/u.test(name)) return null;
  return Object.freeze({ schema: 'ivoc.name-use.v1', enabled: true, name, source: 'manual' });
}

const nameTokens = value => String(value).normalize('NFKC').toLowerCase().match(/[\p{L}\p{M}\p{N}]+/gu) || [];

// This is a lexical observation, never a judgment of rapport or direct address.
// Only the saved session's opt-in and canonical candidate turns are inputs.
export function projectInterviewerNameUse(session = {}, envelope = null) {
  const unassessed = reason => Object.freeze({ status: 'UNASSESSED', reason, matches: Object.freeze([]) });
  const payload = session?.results?.payload ?? envelope;
  const config = normalizeNameUseCoaching(payload?.nameUseCoaching);
  if (!config || !session?.id || payload?.sessionId !== session.id
      || payload.nameUseCoaching.sessionId !== session.id) return unassessed('NOT_SELECTED_FOR_SAVED_ATTEMPT');
  if (session.spine?.candidateAttribution?.status !== 'VERIFIED') return unassessed('CANDIDATE_AUDIO_SOURCE_UNVERIFIED');
  const turns = Array.isArray(session?.spine?.turns) ? session.spine.turns : [];
  const refs = new Map(); const suffixes = new Map();
  for (const turn of turns) {
    const ref = turn?.transcript?.canonical_ref;
    if (typeof ref !== 'string' || ref.length > 2048 || ref.trim() !== ref || !ref.includes('#')) continue;
    const suffix = ref.split('#').at(-1);
    if (!suffix || suffix.length > 96 || suffix.trim() !== suffix) continue;
    refs.set(ref, (refs.get(ref) || 0) + 1);
    suffixes.set(suffix, (suffixes.get(suffix) || 0) + 1);
  }
  const candidateTurns = turns.filter(turn => turn?.speaker === 'student'
    && typeof turn?.transcript?.text === 'string' && turn.transcript.text.trim()
    && refs.get(turn.transcript.canonical_ref) === 1
    && suffixes.get(turn.transcript.canonical_ref.split('#').at(-1)) === 1).slice(0, 128);
  if (!candidateTurns.length) return unassessed('NO_UNAMBIGUOUS_CANONICAL_CANDIDATE_TRANSCRIPT');
  const needle = nameTokens(config.name);
  const duration = recordedMs(session?.recording?.durationMs ?? payload.playableDurationMs);
  const matches = [];
  for (const turn of candidateTurns) {
    const text = turn.transcript.text.slice(0, 20_000);
    const words = nameTokens(text);
    if (!words.some((_, index) => needle.every((word, offset) => words[index + offset] === word))) continue;
    const startMs = recordedMs(turn.startMs); const endMs = recordedMs(turn.endMs);
    const timed = duration > 0 && startMs !== null && endMs !== null && endMs > startMs && endMs <= duration;
    // A turn crossing a third boundary cannot locate the name within that turn.
    const first = timed ? Math.min(2, Math.floor(startMs / (duration / 3))) : null;
    const last = timed ? Math.min(2, Math.ceil(endMs / (duration / 3)) - 1) : null;
    matches.push(Object.freeze({ ref: turn.transcript.canonical_ref,
      segmentId: turn.transcript.canonical_ref.split('#').at(-1), text,
      startMs: timed ? startMs : null, endMs: timed ? endMs : null,
      third: timed && first === last ? ['first', 'middle', 'final'][first] : null }));
  }
  return Object.freeze({ status: 'AVAILABLE', name: config.name, source: 'manual',
    matches: Object.freeze(matches.slice(0, 8)),
    basis: 'CANONICAL_CANDIDATE_TRANSCRIPT_LEXICAL_MATCH',
    limitation: 'Possible mentions only (up to eight cited turns). Saved transcript coverage may be incomplete; no mention is not a failure. Turn ranges are not word timestamps or greeting/closing intent.' });
}

export function projectTranscriptMetrics(result = {}) {
  const transcript = result?.transcript || {};
  const text = boundedText(transcript.text, 20_000);
  if (transcript.status !== 'AVAILABLE' || !text) return Object.freeze({ status: 'UNAVAILABLE' });
  const segments = (Array.isArray(transcript.segments) ? transcript.segments : [])
    .map((segment, index) => ({
      id: boundedText(segment?.id || `seg-${index + 1}`, 96),
      startMs: recordedMs(segment?.startMs),
      endMs: recordedMs(segment?.endMs),
    }))
    .filter((segment) => segment.id && segment.startMs !== null && segment.endMs !== null && segment.endMs > segment.startMs);
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
    confidence: Object.freeze({ score, coverage, label: confidenceLabel(score, coverage), limitations,
      coverageBasis: analysis.coverageBasis || 'provider_estimate' }),
  });
}

const evidenceRefs = (row = {}) => Object.freeze([...(Array.isArray(row.refs) ? row.refs : [])]
  .map((item) => boundedText(String(item?.ref || '').split('#').at(-1), 96))
  .filter(Boolean).slice(0, 8));

export function contextResultFromSessionSpine(session = {}) {
  const spine = session?.spine || {};
  if (spine.candidateAttribution?.status !== 'VERIFIED') return Object.freeze({
    transcript: Object.freeze({ status: 'UNAVAILABLE', reason: 'CANDIDATE_AUDIO_SOURCE_UNVERIFIED' }),
    analysis: Object.freeze({ status: 'UNAVAILABLE', reason: 'CANDIDATE_AUDIO_SOURCE_UNVERIFIED' }),
  });
  const turns = (Array.isArray(spine.turns) ? spine.turns : [])
    .filter((turn) => turn?.speaker === 'student' && turn?.transcript?.canonical_ref && boundedText(turn?.transcript?.text));
  if (!turns.length) return Object.freeze({ transcript: Object.freeze({ status: 'UNAVAILABLE', reason: 'NO_PERSISTED_TRANSCRIPT' }) });
  const rows = Array.isArray(spine.evidence) ? spine.evidence : [];
  const refCounts = new Map();
  const segmentCounts = new Map();
  for (const turn of turns) {
    const ref = turn.transcript.canonical_ref;
    const segment = typeof ref === 'string' && ref.includes('#') ? ref.split('#').at(-1) : null;
    if (!segment || segment.length > 96 || segment.trim() !== segment) continue;
    refCounts.set(ref, (refCounts.get(ref) || 0) + 1);
    segmentCounts.set(segment, (segmentCounts.get(segment) || 0) + 1);
  }
  // Historical persisted rows cross the same trust boundary as new analysis.
  // Matching only "seg-1" can attach a foreign transcript to this answer.
  // Reject the whole claim on any invalid/ambiguous reference, not just that ref.
  const evidence = rows.filter(row => {
    if (!['semantic.supported_claim', 'semantic.answer_structure', 'semantic.coaching_pattern'].includes(row?.dimension)
        || !boundedText(row?.interpretation?.text) || !Array.isArray(row.refs) || !row.refs.length || row.refs.length > 8) return false;
    if (!row.refs.every(item => typeof item?.ref === 'string' && refCounts.get(item.ref) === 1
        && segmentCounts.get(item.ref.split('#').at(-1)) === 1)) return false;
    return row.dimension !== 'semantic.coaching_pattern'
      || (Object.hasOwn(FACET_LABELS, row.interpretation.facet)
        && ['strength', 'weakness'].includes(row.interpretation.polarity));
  });
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
  const quality = value => value !== null && value !== undefined && value !== ''
    && Number.isFinite(Number(value)) && Number(value) >= 0 && Number(value) <= 1;
  const scored = evidence.map((row) => row?.score?.value).filter(quality).map(Number);
  const covered = evidence.map((row) => row?.confidence).filter(quality).map(Number);
  const incompleteQuality = evidence.some(row => !quality(row.confidence)
    || (row.dimension === 'semantic.coaching_pattern' && !quality(row.score?.value)));
  const limitations = [...new Set(evidence.flatMap((row) => Array.isArray(row?.limitations) ? row.limitations : [])
    .map((item) => boundedText(item, 240)).filter(Boolean))].slice(0, 8);
  if (evidence.length !== rows.length) limitations.unshift('Some saved observations were omitted because their supporting evidence could not be verified.');
  if (incompleteQuality) limitations.unshift('Confidence is limited because some cited coaching has no saved quality estimate.');
  return Object.freeze({
    transcript: Object.freeze({
      status: 'AVAILABLE',
      text: turns.map((turn) => boundedText(turn.transcript.text)).join(' '),
      segments: Object.freeze(turns.map(turn => {
        const ref = turn.transcript.canonical_ref;
        const suffix = typeof ref === 'string' ? ref.split('#').at(-1) : null;
        const valid = refCounts.get(ref) === 1 && segmentCounts.get(suffix) === 1;
        // Retain transcript wording, but never invent/truncate a replay identity.
        return Object.freeze({ id: valid ? suffix : null,
          startMs: valid ? recordedMs(turn.startMs) : null,
          endMs: valid ? recordedMs(turn.endMs) : null });
      })),
    }),
    analysis: Object.freeze({
      status: semanticObservations.length || coachingPatterns.length ? 'AVAILABLE' : 'UNAVAILABLE',
      semanticObservations: Object.freeze(semanticObservations),
      coachingPatterns: Object.freeze(coachingPatterns),
      score: scored.length ? Math.min(...scored) : 0,
      coverage: !incompleteQuality && covered.length ? Math.min(...covered) : 0,
      coverageBasis: 'evidence_confidence',
      limitations: Object.freeze(limitations),
    }),
    persistence: Object.freeze({ transcript: true }),
  });
}
