// IVOC Application Intelligence — provider-neutral SemanticMatcher interface.
//
// A future model or embedding service may implement `match(pack, text)`; the core
// never calls a model itself. Absence or failure yields `{ state: 'unavailable' }`
// and the Director proceeds on lexical triggers only (donor packet §4.6).
//
// Contract:
//   matcher.match(pack, text) → Promise<{ state: 'ok', matches: [{signal_id, score}] } | { state: 'unavailable', reason }>
// Every returned signal_id must exist in the pack; unknown ids are discarded.

export const SEMANTIC_MATCHER_CONTRACT = 'ivoc.semantic_matcher.v1';

/** Deterministic test implementation: lexical overlap ratio, no network, no model. */
export class DeterministicSemanticMatcher {
  #tokenize;

  constructor({ tokenize }) {
    if (typeof tokenize !== 'function') throw new TypeError('tokenize is required');
    this.#tokenize = tokenize;
  }

  async match(pack, text) {
    if (!pack || !Array.isArray(pack.signals) || typeof text !== 'string') return { state: 'unavailable', reason: 'invalid_input' };
    const words = new Set(this.#tokenize(text));
    if (words.size === 0) return { state: 'ok', matches: [] };
    const matches = [];
    for (const signal of pack.signals) {
      const triggers = signal.reactive_triggers;
      if (!triggers.length) continue;
      const overlap = triggers.filter((t) => words.has(t)).length;
      if (overlap > 0) matches.push({ signal_id: signal.signal_id, score: Math.round((overlap / triggers.length) * 1000) / 1000 });
    }
    return { state: 'ok', matches: matches.sort((a, b) => b.score - a.score || (a.signal_id < b.signal_id ? -1 : 1)) };
  }
}

/** Always unavailable: models the provider being absent or failing closed. */
export class UnavailableSemanticMatcher {
  async match() {
    return { state: 'unavailable', reason: 'no_semantic_provider_configured' };
  }
}

/** Normalize any matcher result so callers never see unknown ids or malformed shapes. */
export function sanitizeMatcherResult(pack, result) {
  if (!result || result.state !== 'ok' || !Array.isArray(result.matches)) return { state: 'unavailable', reason: result?.reason || 'malformed_result' };
  const known = new Set(pack.signals.map((s) => s.signal_id));
  return {
    state: 'ok',
    matches: result.matches.filter((m) => m && known.has(m.signal_id) && Number.isFinite(m.score) && m.score >= 0 && m.score <= 1),
  };
}
