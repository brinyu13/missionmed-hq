import { medicalLexicon } from './lexicon.mjs';

function titleTokens(value) {
  return [...new Set(
    (String(value || '').match(/[A-Za-z][A-Za-z0-9-]{3,}/g) || [])
      .map((token) => token.trim())
      .filter(Boolean),
  )].slice(0, 12);
}

export function keywordsForDraft({ draftTitle = '' } = {}) {
  return [...new Set([...medicalLexicon, ...titleTokens(draftTitle)])];
}

export const keywordInternals = Object.freeze({ titleTokens });
