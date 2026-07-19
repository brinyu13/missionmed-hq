import assert from "node:assert/strict";

export const TEMPLATE_SIMILARITY_THRESHOLD = 0.7;

export function normalizeForSimilarity(value) {
  return String(value)
    .normalize("NFKC")
    .toLowerCase()
    .replace(/["'`].*?["'`]/g, " <evidence> ")
    .replace(/[^\p{L}\p{N}\s<>]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function wordNgrams(value, size = 3) {
  assert.ok(Number.isSafeInteger(size) && size > 0, "N-gram size must be a positive safe integer");
  const words = normalizeForSimilarity(value).split(" ").filter(Boolean);
  const grams = new Set();
  if (words.length < size) {
    if (words.length) grams.add(words.join(" "));
    return grams;
  }
  for (let index = 0; index <= words.length - size; index += 1) {
    grams.add(words.slice(index, index + size).join(" "));
  }
  return grams;
}

export function jaccard(left, right) {
  const a = left instanceof Set ? left : new Set(left);
  const b = right instanceof Set ? right : new Set(right);
  if (a.size === 0 && b.size === 0) return 1;
  let intersection = 0;
  for (const value of a) if (b.has(value)) intersection += 1;
  return intersection / (a.size + b.size - intersection);
}

export function trigramSimilarity(left, right) {
  return jaccard(wordNgrams(left, 3), wordNgrams(right, 3));
}

export function probeCapForRung(rung) {
  assert.ok(Number.isSafeInteger(rung) && rung >= 0, "Pressure rung must be a non-negative safe integer");
  return rung <= 1 ? 1 : 2;
}

export function scoreT1(records) {
  const substantive = records.filter((record) => record.substantive === true);
  const eligible = substantive.filter((record) => record.probeEligible === true);
  const probes = eligible.filter((record) => record.isProbe === true);
  const chains = records.filter((record) => Number.isSafeInteger(record.probeDepth) && record.probeDepth > 0);
  const grounded = substantive.filter((record) => record.grounded === true).length;
  const plausible = substantive.filter((record) => record.plausible === true).length;
  const totalProbeDepth = chains.reduce((sum, record) => sum + record.probeDepth, 0);
  return {
    substantive_count: substantive.length,
    eligible_count: eligible.length,
    grounded_rate: substantive.length ? grounded / substantive.length : 0,
    plausible_rate: substantive.length ? plausible / substantive.length : 0,
    probe_rate: eligible.length ? probes.length / eligible.length : 0,
    mean_probe_chain_depth: chains.length ? totalProbeDepth / chains.length : 0,
    pass: substantive.length > 0
      && grounded / substantive.length >= 0.9
      && plausible / substantive.length >= 0.8
      && eligible.length > 0
      && probes.length / eligible.length >= 0.6
      && chains.length > 0
      && totalProbeDepth / chains.length >= 1.5,
  };
}

export function scoreT2(runs) {
  const callbacks = runs.filter((run) => run.callbackAccurate === true).length;
  const confabulations = runs.filter((run) => run.confabulated === true).length;
  return {
    runs: runs.length,
    accurate_callbacks: callbacks,
    callback_rate: runs.length ? callbacks / runs.length : 0,
    confabulations,
    pass: runs.length >= 10 && callbacks / runs.length >= 0.8 && confabulations === 0,
  };
}

export function scoreT3(fixtures) {
  const eligible = fixtures.filter((fixture) => fixture.eligible === true);
  const correct = eligible.filter((fixture) => fixture.correctGap === true && fixture.probed === true).length;
  const capViolations = fixtures.reduce((sum, fixture) => sum + Math.max(0, fixture.probeDepth - probeCapForRung(fixture.pressureRung)), 0);
  return {
    eligible: eligible.length,
    correct,
    rate: eligible.length ? correct / eligible.length : 0,
    cap_violations: capViolations,
    pass: eligible.length > 0 && correct / eligible.length >= 0.85 && capViolations === 0,
  };
}

export function scoreT4(fixtures) {
  const positives = fixtures.filter((fixture) => fixture.isContradiction === true);
  const negatives = fixtures.filter((fixture) => fixture.isContradiction === false);
  const handled = positives.filter((fixture) => fixture.professional === true && fixture.correctlyQuoted === true).length;
  const falseAccusations = negatives.filter((fixture) => fixture.accused === true).length;
  return {
    true_count: positives.length,
    handled,
    handling_rate: positives.length ? handled / positives.length : 0,
    negative_count: negatives.length,
    false_accusations: falseAccusations,
    false_accusation_rate: negatives.length ? falseAccusations / negatives.length : 0,
    pass: positives.length > 0
      && handled / positives.length >= 0.8
      && negatives.length > 0
      && falseAccusations / negatives.length <= 0.05,
  };
}

export function scoreRecovery(fixtures) {
  const reached = fixtures.filter((fixture) => fixture.actualState === fixture.expectedState).length;
  return {
    fixtures: fixtures.length,
    reached,
    rate: fixtures.length ? reached / fixtures.length : 0,
    pass: fixtures.length > 0 && reached === fixtures.length,
  };
}

export function scoreInstructorReview(reviews) {
  const correct = reviews.filter((review) => review.correct === true).length;
  const withinTime = reviews.filter((review) => Number.isFinite(review.durationSeconds) && review.durationSeconds <= 180).length;
  return {
    reviews: reviews.length,
    correct,
    within_180_seconds: withinTime,
    pass: reviews.length > 0 && correct === reviews.length && withinTime === reviews.length,
  };
}
