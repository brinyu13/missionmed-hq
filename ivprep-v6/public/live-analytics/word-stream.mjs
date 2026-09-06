// Y1-Y2-CAM-V6-3526 — bounded, transcript-free session word-event stream.
//
// Only intervals and confidence enter this store. No token text is accepted or
// retained. Overlapping recognizer windows are de-duplicated before a rolling
// articulation rate is calculated from observed speech occupancy.

const MAXIMUM_PLAUSIBLE_WPM = 360;
const DEFAULT_WINDOW_SPEECH_MS = 10_000;
const DEFAULT_MAXIMUM_EVENTS = 1_024;

function finite(value) {
  return Number.isFinite(value) ? Number(value) : null;
}

function freeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.values(value).forEach(freeze);
  return Object.freeze(value);
}

function validEvent(word) {
  const startMs = finite(word?.startMs);
  const endMs = finite(word?.endMs);
  const probability = word?.probability === null || word?.probability === undefined
    ? null
    : finite(word.probability);
  if (startMs === null || endMs === null || endMs <= startMs) return null;
  if (probability !== null && (probability < 0 || probability > 1)) return null;
  return { startMs, endMs, probability };
}

function overlaps(a, b, toleranceMs = 80) {
  const intersection = Math.max(0, Math.min(a.endMs, b.endMs) - Math.max(a.startMs, b.startMs));
  const shorter = Math.min(a.endMs - a.startMs, b.endMs - b.startMs);
  const centersNear = Math.abs((a.startMs + a.endMs) / 2 - (b.startMs + b.endMs) / 2) <= toleranceMs;
  return intersection / shorter >= 0.55 || centersNear;
}

function occupancy(events) {
  if (!events.length) return 0;
  let total = 0;
  let start = events[0].startMs;
  let end = events[0].endMs;
  for (let index = 1; index < events.length; index += 1) {
    const item = events[index];
    if (item.startMs <= end) end = Math.max(end, item.endMs);
    else {
      total += end - start;
      start = item.startMs;
      end = item.endMs;
    }
  }
  return total + end - start;
}

export class WordEventStream {
  constructor({ maximumEvents = DEFAULT_MAXIMUM_EVENTS, maximumPlausibleWpm = MAXIMUM_PLAUSIBLE_WPM } = {}) {
    this.maximumEvents = Math.max(32, Math.min(4_096, Math.round(Number(maximumEvents) || DEFAULT_MAXIMUM_EVENTS)));
    this.maximumPlausibleWpm = Math.max(120, Math.min(600, Number(maximumPlausibleWpm) || MAXIMUM_PLAUSIBLE_WPM));
    this.reset();
  }

  reset() {
    this.events = [];
    this.lastAcceptedAtMs = null;
    return this;
  }

  ingest(words = [], { atMs = null, source = 'OBSERVED_WORD_TIMING' } = {}) {
    if (!Array.isArray(words)) return freeze({ accepted: 0, rejected: 0, reason: 'WORD_EVENTS_REQUIRED' });
    const candidates = words.map(validEvent).filter(Boolean).sort((a, b) => a.startMs - b.startMs);
    let accepted = 0;
    let duplicate = 0;
    let implausible = 0;
    for (const candidate of candidates) {
      const match = this.events.find((event) => overlaps(event, candidate));
      if (match) {
        duplicate += 1;
        if ((candidate.probability ?? -1) > (match.probability ?? -1)) match.probability = candidate.probability;
        match.startMs = Math.min(match.startMs, candidate.startMs);
        match.endMs = Math.max(match.endMs, candidate.endMs);
        continue;
      }
      const previous = this.events.at(-1);
      if (previous) {
        const spanMs = candidate.endMs - previous.startMs;
        const localCount = this.events.filter((event) => event.startMs >= previous.startMs).length + 1;
        if (spanMs > 0 && localCount * 60_000 / spanMs > this.maximumPlausibleWpm * 1.5) {
          implausible += 1;
          continue;
        }
      }
      this.events.push({ ...candidate, source });
      accepted += 1;
    }
    this.events.sort((a, b) => a.startMs - b.startMs);
    if (this.events.length > this.maximumEvents) this.events.splice(0, this.events.length - this.maximumEvents);
    this.lastAcceptedAtMs = finite(atMs) ?? this.events.at(-1)?.endMs ?? this.lastAcceptedAtMs;
    return freeze({ accepted, duplicate, implausible, total: this.events.length });
  }

  articulationRate({ atMs = this.lastAcceptedAtMs, windowSpeechMs = DEFAULT_WINDOW_SPEECH_MS } = {}) {
    const endMs = finite(atMs);
    if (endMs === null || !this.events.length) return freeze({ available: false, reason: 'NO_WORD_EVENTS' });
    const desiredSpeechMs = Math.max(3_000, Math.min(60_000, Number(windowSpeechMs) || DEFAULT_WINDOW_SPEECH_MS));
    const selected = [];
    let occupiedMs = 0;
    for (let index = this.events.length - 1; index >= 0; index -= 1) {
      const event = this.events[index];
      if (event.endMs > endMs + 25) continue;
      selected.unshift(event);
      occupiedMs = occupancy(selected);
      if (occupiedMs >= desiredSpeechMs) break;
    }
    if (selected.length < 8 || occupiedMs < 3_000) {
      return freeze({
        available: false,
        reason: selected.length < 8 ? 'INSUFFICIENT_WORD_EVENTS' : 'INSUFFICIENT_SPEECH_TIME',
        wordCount: selected.length,
        speechDurationMs: occupiedMs,
      });
    }
    const wpm = selected.length * 60_000 / occupiedMs;
    if (!(wpm > 0 && wpm <= this.maximumPlausibleWpm)) {
      return freeze({ available: false, reason: 'IMPLAUSIBLE_ARTICULATION_RATE', wordCount: selected.length, speechDurationMs: occupiedMs });
    }
    return freeze({
      available: true,
      wordsPerMinute: Number(wpm.toFixed(1)),
      articulationWordsPerMinute: Number(wpm.toFixed(1)),
      wordCount: selected.length,
      speechDurationMs: Math.round(occupiedMs),
      windowStartedAtMs: selected[0].startMs,
      windowEndedAtMs: selected.at(-1).endMs,
      source: 'DEDUPLICATED_OBSERVED_WORD_STREAM',
    });
  }

  snapshot() {
    return freeze({
      eventCount: this.events.length,
      lastAcceptedAtMs: this.lastAcceptedAtMs,
      events: this.events.map((event) => ({ ...event })),
      rawTextRetained: false,
    });
  }
}

export function createWordEventStream(options) {
  return new WordEventStream(options);
}
