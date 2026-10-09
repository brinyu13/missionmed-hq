function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function tokenizeWords(text = '') {
  return String(text || '')
    .replace(/\s+/gu, ' ')
    .trim()
    .split(/\s+/u)
    .filter(Boolean);
}

function normalizeText(text = '') {
  return String(text || '').replace(/\s+/gu, ' ').trim();
}

function escapeRegex(value = '') {
  return String(value || '').replace(/[|\\{}()[\]^$+*?.]/gu, '\\$&');
}

function countPhrase(haystack = '', phrase = '') {
  const safePhrase = String(phrase || '').trim();
  if (!safePhrase) {
    return 0;
  }
  const pattern = new RegExp(`\\b${escapeRegex(safePhrase)}\\b`, 'giu');
  const matches = String(haystack || '').match(pattern);
  return Array.isArray(matches) ? matches.length : 0;
}

function extractOpeningWords(words = []) {
  if (!Array.isArray(words) || words.length === 0) {
    return [];
  }
  const size = Math.max(1, Math.ceil(words.length * 0.2));
  return words.slice(0, size);
}

function extractClosingWords(words = []) {
  if (!Array.isArray(words) || words.length === 0) {
    return [];
  }
  const size = Math.max(1, Math.ceil(words.length * 0.1));
  return words.slice(Math.max(0, words.length - size));
}

function mapRawToCompletionScore(rawScore = 0) {
  const normalized = clamp(Number(rawScore) || 0, 0, 10);
  if (normalized >= 7) {
    return 10;
  }
  if (normalized >= 4) {
    return 5;
  }
  return 0;
}

function adjectiveForScore(score = 0) {
  const numeric = clamp(Number(score) || 0, 0, 10);
  if (numeric <= 3) {
    return 'needs work';
  }
  if (numeric <= 6) {
    return 'solid';
  }
  if (numeric <= 8) {
    return 'strong';
  }
  return 'excellent';
}

function computeStartSimpleScore(openingWords = [], fullText = '') {
  const openingText = openingWords.join(' ').toLowerCase();
  const fillers = ['um', 'uh', 'well', 'so', 'like'];
  const fillerCount = fillers.reduce((sum, token) => sum + countPhrase(openingText, token), 0);
  const firstSentence = String(fullText || '').split(/[.!?]+/u)[0] || '';
  const trimmedSentence = firstSentence.trim();
  const startsDeclarative = /^(i|my|the)\b/iu.test(trimmedSentence) && !trimmedSentence.includes('?');

  let raw = 10 - (fillerCount * 2);
  if (startsDeclarative) {
    raw += 2;
  }
  raw = clamp(raw, 0, 10);

  return {
    raw,
    score: mapRawToCompletionScore(raw),
    filler_count: fillerCount,
    starts_declarative: startsDeclarative,
  };
}

function computeAddReasonsScore(fullText = '') {
  const text = String(fullText || '').toLowerCase();
  const markers = ['because', 'due to', 'since', 'as a result', 'for example', 'first', 'second', 'additionally'];
  const reasonCount = markers.reduce((sum, marker) => sum + countPhrase(text, marker), 0);

  let raw = 0;
  if (reasonCount === 1) {
    raw = 3;
  } else if (reasonCount === 2) {
    raw = 5;
  } else if (reasonCount === 3) {
    raw = 7;
  } else if (reasonCount === 4) {
    raw = 8;
  } else if (reasonCount >= 5) {
    raw = 10;
  }

  return {
    raw,
    score: mapRawToCompletionScore(raw),
    reason_count: reasonCount,
  };
}

function countSpecificityMarkers(words = []) {
  const markers = [];
  for (let index = 0; index < words.length; index += 1) {
    const token = String(words[index] || '');
    const bare = token.replace(/[^a-zA-Z0-9/-]/gu, '');
    if (!bare) {
      continue;
    }

    let isMarker = false;
    if (/^\d{1,4}$/u.test(bare)) {
      isMarker = true;
    }
    if (/\d/u.test(bare) && /[a-zA-Z]/u.test(bare)) {
      isMarker = true;
    }
    if (/^(jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*$/iu.test(bare)) {
      isMarker = true;
    }
    if (!isMarker && /^[A-Z][a-z]+$/u.test(token) && index > 0) {
      const lowered = token.toLowerCase();
      if (!['i', 'my', 'the', 'and', 'but', 'because'].includes(lowered)) {
        isMarker = true;
      }
    }

    if (isMarker) {
      markers.push(index);
    }
  }
  return markers;
}

function computeExampleCount(words = []) {
  const markerIndexes = countSpecificityMarkers(words);
  if (!markerIndexes.length) {
    return 0;
  }

  let clusters = 0;
  let windowStart = markerIndexes[0];
  let countInWindow = 1;

  for (let idx = 1; idx < markerIndexes.length; idx += 1) {
    const nextIndex = markerIndexes[idx];
    if (nextIndex - windowStart <= 50) {
      countInWindow += 1;
    } else {
      if (countInWindow >= 3) {
        clusters += 1;
      }
      windowStart = nextIndex;
      countInWindow = 1;
    }
  }

  if (countInWindow >= 3) {
    clusters += 1;
  }

  return clusters;
}

function computeFocusScore(words = []) {
  const exampleCount = computeExampleCount(words);

  let raw = 0;
  if (exampleCount === 1) {
    raw = 6;
  } else if (exampleCount >= 2) {
    raw = 10;
  }

  if (exampleCount > 3) {
    raw = clamp(raw - 3, 0, 10);
  }

  return {
    raw,
    score: mapRawToCompletionScore(raw),
    example_count: exampleCount,
  };
}

function computeEndStrongScore(closingWords = []) {
  const closingText = closingWords.join(' ').toLowerCase();
  const conclusiveTokens = ['overall', 'ultimately', 'in summary', 'i believe', 'in conclusion', 'thank you'];
  const trailingFillers = ['um', 'uh', 'like', 'you know'];

  let raw = 5;
  const hasConclusiveLanguage = conclusiveTokens.some((token) => countPhrase(closingText, token) > 0);
  if (hasConclusiveLanguage) {
    raw += 3;
  }

  const trailingFillerCount = trailingFillers.reduce((sum, token) => sum + countPhrase(closingText, token), 0);
  if (trailingFillerCount > 0) {
    raw -= 2;
  }

  const hasQuestionEnding = /\?/u.test(closingWords.join(' '));
  if (hasQuestionEnding) {
    raw -= 3;
  }

  raw = clamp(raw, 0, 10);

  return {
    raw,
    score: mapRawToCompletionScore(raw),
    has_conclusive_language: hasConclusiveLanguage,
    trailing_filler_count: trailingFillerCount,
    has_question_ending: hasQuestionEnding,
  };
}

function deriveOverallLabel(scores = {}) {
  const values = [scores.s_score, scores.a_reasons, scores.f_focus, scores.e_closing]
    .map((value) => Number(value) || 0);
  const presentCount = values.filter((value) => value === 10).length;
  const nonMissingCount = values.filter((value) => value > 0).length;

  if (presentCount === 4 || (presentCount === 3 && nonMissingCount === 4)) {
    return 'strong';
  }
  if (nonMissingCount >= 2) {
    return 'developing';
  }
  return 'missing';
}

function buildFeedbackTemplate(context = {}) {
  const openingAdj = adjectiveForScore(context.startRaw);
  const closingAdj = adjectiveForScore(context.endRaw);
  const reasonCount = Number(context.reasonCount || 0);
  const exampleCount = Number(context.exampleCount || 0);

  let exampleAssessment = 'You did not anchor one concrete example yet.';
  if (exampleCount === 1) {
    exampleAssessment = 'You focused on one concrete example, which improved clarity.';
  } else if (exampleCount >= 2) {
    exampleAssessment = `You referenced ${exampleCount} specific examples.`;
  }

  return [
    `Your opening was ${openingAdj}.`,
    `You provided ${reasonCount} supporting ${reasonCount === 1 ? 'reason' : 'reasons'}.`,
    exampleAssessment,
    `Your closing was ${closingAdj}.`,
  ].join(' ');
}

function deriveRedFlags(result = {}) {
  const flags = [];
  if ((Number(result.s_score) || 0) < 5) {
    flags.push('weak_opening');
  }
  if ((Number(result.a_reasons) || 0) < 5) {
    flags.push('weak_reasons');
  }
  if ((Number(result.f_focus) || 0) < 5) {
    flags.push('weak_example_focus');
  }
  if ((Number(result.e_closing) || 0) < 5) {
    flags.push('weak_closing');
  }
  return flags;
}

export function analyzeSafTranscript(transcriptText = '') {
  const normalized = normalizeText(transcriptText);
  const words = tokenizeWords(normalized);
  const openingWords = extractOpeningWords(words);
  const closingWords = extractClosingWords(words);

  const start = computeStartSimpleScore(openingWords, normalized);
  const reasons = computeAddReasonsScore(normalized);
  const focus = computeFocusScore(words);
  const end = computeEndStrongScore(closingWords);

  const result = {
    s_score: start.score,
    a_reasons: reasons.score,
    f_focus: focus.score,
    e_closing: end.score,
  };

  result.feedback_text = buildFeedbackTemplate({
    startRaw: start.raw,
    endRaw: end.raw,
    reasonCount: reasons.reason_count,
    exampleCount: focus.example_count,
  });
  result.overall_label = deriveOverallLabel(result);
  result.reason_count = reasons.reason_count;
  result.example_count = focus.example_count;
  result.red_flags = deriveRedFlags(result);

  return result;
}
