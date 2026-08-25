const FORBIDDEN = /(?:pcm|sample|pixel|landmark|blendshape|transcript|image|bitmap|blob|raw(?:audio|video|frame)?)/iu;

function sanitize(value, key = '') {
  if (FORBIDDEN.test(key)) return undefined;
  if (value === null || ['string', 'number', 'boolean'].includes(typeof value)) return value;
  if (Array.isArray(value)) return value.map((item) => sanitize(item)).filter((item) => item !== undefined);
  if (!value || typeof value !== 'object') return undefined;
  const output = {};
  for (const [childKey, child] of Object.entries(value)) {
    const safe = sanitize(child, childKey);
    if (safe !== undefined) output[childKey] = safe;
  }
  return output;
}

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.values(value).forEach(deepFreeze);
  return Object.freeze(value);
}

function deliveryObservation(envelope = {}) {
  const behavior = envelope.behavior || {};
  const wordTiming = behavior.wordTiming || {};
  const loudness = behavior.audio?.loudness || {};
  const orientation = behavior.orientation || {};
  if (wordTiming.available === true && Number.isFinite(wordTiming.wordsPerMinute)) {
    return {
      kind: 'positive',
      category: 'delivery',
      text: `Validated word timing measured this answer at ${Math.round(wordTiming.wordsPerMinute)} WPM.`,
    };
  }
  if (loudness.available === true && Number.isFinite(loudness.speechLufsK)) {
    return {
      kind: 'positive',
      category: 'delivery',
      text: 'Local microphone evidence produced a usable speech-loudness history.',
    };
  }
  if (orientation.orientation && orientation.orientation !== 'UNKNOWN') {
    return {
      kind: 'positive',
      category: 'delivery',
      text: `Observed camera-orientation geometry remained available (${String(orientation.orientation).toLowerCase()}).`,
    };
  }
  return {
    kind: 'unavailable',
    category: 'delivery',
    text: 'Delivery note unavailable — more measured speech or camera coverage is required.',
  };
}

function nextAnswerGoal(envelope = {}) {
  const behavior = envelope.behavior || {};
  const wordTiming = behavior.wordTiming || {};
  const zone = wordTiming.deliverySpeed?.zone;
  if (zone === 'TOO_FAST') return 'Next answer: use one deliberate pause between your main points.';
  if (zone === 'TOO_SLOW') return 'Next answer: keep each point moving toward one concrete example.';
  if (Number(behavior.turnMetrics?.longPauseCount) > 0) return 'Next answer: use a short bridge before any pause longer than one second.';
  if (behavior.setup?.ready === true) return 'Next answer: keep this measured microphone and framing setup unchanged.';
  return 'Next answer: complete the microphone and framing setup before evaluating delivery.';
}

/** Claim-safe, derived-only card shown briefly between question turns. */
export function buildPostAnswerCard(envelope = {}, { displayMs = 15_000 } = {}) {
  const boundedDisplayMs = Math.max(10_000, Math.min(20_000, Math.round(Number(displayMs) || 15_000)));
  const items = [
    deliveryObservation(envelope),
    {
      kind: 'unavailable',
      category: 'structure',
      text: 'Structure note unavailable — no validated content-analysis source is connected.',
    },
  ].slice(0, 2);
  return deepFreeze({
    schema: 'missionmed.ivprep.post-answer-card.v1',
    displayMs: boundedDisplayMs,
    items,
    nextGoal: nextAnswerGoal(envelope),
    replay: { available: false, reason: 'RAW_MEDIA_NOT_RETAINED' },
    rawMediaRetained: false,
    claimBoundary: 'OBSERVED_PROCESS_AND_DELIVERY_ONLY',
  });
}

/** Bounded, derived-only post-answer envelopes; never a raw-media store. */
export class PostAnswerStore {
  constructor({ maximumAnswers = 20 } = {}) {
    this.maximumAnswers = Math.max(1, Math.min(100, Math.round(maximumAnswers)));
    this.answers = [];
  }

  retain(envelope = {}) {
    const safe = sanitize(envelope);
    if (!safe?.answerId || !Number.isFinite(safe.startedAtMs) || !Number.isFinite(safe.endedAtMs) || safe.endedAtMs < safe.startedAtMs) {
      throw new TypeError('Post-answer envelopes require answerId and monotonic bounds.');
    }
    const record = deepFreeze({
      schema: 'missionmed.ivprep.behavior-answer.v1',
      ...safe,
      durationMs: safe.endedAtMs - safe.startedAtMs,
      rawMediaRetained: false,
    });
    this.answers.push(record);
    if (this.answers.length > this.maximumAnswers) this.answers.shift();
    return record;
  }

  latest() { return this.answers.at(-1) || null; }

  exportObject() {
    return deepFreeze({
      schema: 'missionmed.ivprep.behavior-export.v1',
      rawMediaIncluded: false,
      answers: [...this.answers],
    });
  }

  exportJson(space = 2) {
    return JSON.stringify(this.exportObject(), null, space);
  }

  clear() { this.answers = []; }
}
