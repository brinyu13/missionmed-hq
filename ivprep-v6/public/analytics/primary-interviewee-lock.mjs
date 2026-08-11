export const PRIMARY_LOCK_STATE = Object.freeze({
  SEARCHING: 'SEARCHING',
  LOCK_CANDIDATE: 'LOCK_CANDIDATE',
  PRIMARY_LOCKED: 'PRIMARY_LOCKED',
  PRIMARY_TEMPORARILY_OCCLUDED: 'PRIMARY_TEMPORARILY_OCCLUDED',
  REACQUIRING: 'REACQUIRING',
  PRIMARY_SELECTION_REQUIRED: 'PRIMARY_SELECTION_REQUIRED',
});

export const PRIMARY_LOCK_DEFAULTS = Object.freeze({
  acquisitionHoldMs: 650,
  initialAmbiguityMs: 500,
  reacquireHoldMs: 300,
  selectionRequiredMs: 3_000,
  maximumCenterDistance: 0.24,
  minimumAreaRatio: 0.42,
  maximumAreaRatio: 2.4,
  bystanderContinuityDistance: 0.2,
  bystanderMemoryMs: 1_500,
  motionPredictionHorizonMs: 500,
  maximumWithheldIntervals: 64,
  strikeZone: Object.freeze({ left: 0.28, right: 0.72, top: 0.16, bottom: 0.78 }),
});

const clamp = (value, minimum = 0, maximum = 1) => Math.min(maximum, Math.max(minimum, value));

function finiteTimestamp(value, label = 'Primary-lock timestamp') {
  if (!Number.isFinite(value) || value < 0) throw new TypeError(`${label} must be finite and non-negative.`);
  return Math.round(value);
}

function normalizeBox(value) {
  const box = value?.box || value;
  if (![box?.left, box?.top, box?.width, box?.height].every(Number.isFinite)) return null;
  const left = clamp(box.left);
  const top = clamp(box.top);
  const right = clamp(left + Math.max(0, box.width));
  const bottom = clamp(top + Math.max(0, box.height));
  const width = right - left;
  const height = bottom - top;
  if (width <= 0 || height <= 0) return null;
  return Object.freeze({
    left,
    top,
    width,
    height,
    right,
    bottom,
    centerX: left + width / 2,
    centerY: top + height / 2,
    area: width * height,
  });
}

function centerDistance(first, second) {
  return Math.hypot(first.centerX - second.centerX, first.centerY - second.centerY);
}

function intersectionOverUnion(first, second) {
  const left = Math.max(first.left, second.left);
  const top = Math.max(first.top, second.top);
  const right = Math.min(first.right, second.right);
  const bottom = Math.min(first.bottom, second.bottom);
  const intersection = Math.max(0, right - left) * Math.max(0, bottom - top);
  const union = first.area + second.area - intersection;
  return union > 0 ? intersection / union : 0;
}

function sameCandidate(first, second, maximumCenterDistance = 0.24) {
  if (!first || !second) return false;
  const ratio = second.area / first.area;
  return centerDistance(first, second) <= maximumCenterDistance
    && ratio >= 0.38
    && ratio <= 2.65;
}

function continuityCandidates(lastBox, boxes, config, predictedBox = lastBox) {
  return boxes.map((box) => {
    const distance = centerDistance(lastBox, box);
    const predictedDistance = centerDistance(predictedBox, box);
    const ratio = box.area / lastBox.area;
    const overlap = intersectionOverUnion(lastBox, box);
    const eligible = distance <= config.maximumCenterDistance
      && ratio >= config.minimumAreaRatio
      && ratio <= config.maximumAreaRatio;
    const score = distance * 0.55 + predictedDistance * 0.45
      + Math.abs(Math.log(Math.max(ratio, 0.0001))) * 0.08 - overlap * 0.12;
    return { box, eligible, score };
  }).filter((item) => item.eligible).sort((first, second) => first.score - second.score
    || first.box.centerX - second.box.centerX
    || first.box.centerY - second.box.centerY);
}

function inStrikeZone(box, zone) {
  return Boolean(box
    && box.centerX >= zone.left
    && box.centerX <= zone.right
    && box.centerY >= zone.top
    && box.centerY <= zone.bottom);
}

export function paddedPrimaryRoi(value) {
  const box = normalizeBox(value);
  if (!box) return null;
  const width = clamp(box.width * 4.2, 0.28, 1);
  const height = clamp(box.height * 5.5, 0.42, 1);
  const centerX = box.centerX;
  const top = clamp(box.top - box.height * 0.72, 0, Math.max(0, 1 - height));
  const left = clamp(centerX - width / 2, 0, Math.max(0, 1 - width));
  return Object.freeze({ left, top, width, height });
}

export function faceDetectionCandidates(detections, frameWidth, frameHeight) {
  if (!Number.isFinite(frameWidth) || frameWidth <= 0 || !Number.isFinite(frameHeight) || frameHeight <= 0) return [];
  return (Array.isArray(detections) ? detections : []).map((detection) => {
    const source = detection?.boundingBox;
    if (![source?.originX, source?.originY, source?.width, source?.height].every(Number.isFinite)) return null;
    const box = normalizeBox({
      left: source.originX / frameWidth,
      top: source.originY / frameHeight,
      width: source.width / frameWidth,
      height: source.height / frameHeight,
    });
    if (!box) return null;
    return Object.freeze({ box });
  }).filter(Boolean).sort((first, second) => first.box.centerX - second.box.centerX
    || first.box.centerY - second.box.centerY
    || first.box.area - second.box.area);
}

export function primaryLockDiagnostic(value = {}) {
  const state = Object.values(PRIMARY_LOCK_STATE).includes(value.state) ? value.state : PRIMARY_LOCK_STATE.SEARCHING;
  const intervals = (Array.isArray(value.withheldIntervals) ? value.withheldIntervals : []).slice(0, PRIMARY_LOCK_DEFAULTS.maximumWithheldIntervals).map((interval) => Object.freeze({
    startMs: finiteTimestamp(interval?.startMs, 'Withheld interval start'),
    endMs: finiteTimestamp(interval?.endMs, 'Withheld interval end'),
    reason: String(interval?.reason || 'primary_unavailable').slice(0, 80),
    ...(interval?.open === true ? { open: true } : {}),
  }));
  return Object.freeze({
    state,
    zoneStatus: String(value.zoneStatus || 'empty').slice(0, 40),
    continuity: String(value.continuity || 'searching').slice(0, 80),
    bystanderCount: Math.max(0, Math.round(Number(value.bystanderCount) || 0)),
    excludedDurationMs: Math.max(0, Math.round(Number(value.excludedDurationMs) || 0)),
    reacquisitionCount: Math.max(0, Math.round(Number(value.reacquisitionCount) || 0)),
    withheldIntervals: Object.freeze(intervals),
    withheldIntervalsTruncated: value.withheldIntervalsTruncated === true,
  });
}

export class PrimaryIntervieweeLock {
  constructor(options = {}) {
    this.config = Object.freeze({
      ...PRIMARY_LOCK_DEFAULTS,
      ...options,
      strikeZone: Object.freeze({ ...PRIMARY_LOCK_DEFAULTS.strikeZone, ...(options.strikeZone || {}) }),
    });
    for (const key of ['acquisitionHoldMs', 'initialAmbiguityMs', 'reacquireHoldMs', 'selectionRequiredMs']) {
      if (!Number.isFinite(this.config[key]) || this.config[key] < 0) throw new TypeError(`Invalid primary-lock ${key}.`);
    }
    if (!Number.isInteger(this.config.maximumWithheldIntervals) || this.config.maximumWithheldIntervals < 1) throw new TypeError('Invalid primary-lock interval capacity.');
    this.trackSequence = 0;
    this.reset();
  }

  reset() {
    this.state = PRIMARY_LOCK_STATE.SEARCHING;
    this.lastAtMs = null;
    this.candidateBox = null;
    this.candidateSinceMs = null;
    this.ambiguitySinceMs = null;
    this.primaryBox = null;
    this.primaryMotion = { xPerMs: 0, yPerMs: 0 };
    this.reacquireBox = null;
    this.reacquireSinceMs = null;
    this.reacquisitionAmbiguous = false;
    this.knownBystanders = [];
    this.lastSeenAtMs = null;
    this.primaryTrackId = null;
    this.reacquisitionCount = 0;
    this.withheldIntervals = [];
    this.openWithheld = null;
    this.withheldIntervalsTruncated = false;
    this.excludedDurationMs = 0;
    this.lastBystanderCount = 0;
    this.lastFaceCount = 0;
    this.continuity = 'searching';
    this.selectionRestartRequired = false;
    return this.snapshot(0, []);
  }

  restartSelection(atMs) {
    const at = finiteTimestamp(atMs);
    if (this.lastAtMs !== null && at < this.lastAtMs) throw new TypeError('Primary-lock timestamps must be monotonic.');
    this.closeWithheld(at);
    this.state = PRIMARY_LOCK_STATE.SEARCHING;
    this.lastAtMs = at;
    this.candidateBox = null;
    this.candidateSinceMs = null;
    this.ambiguitySinceMs = null;
    this.primaryBox = null;
    this.primaryMotion = { xPerMs: 0, yPerMs: 0 };
    this.reacquireBox = null;
    this.reacquireSinceMs = null;
    this.reacquisitionAmbiguous = false;
    this.knownBystanders = [];
    this.lastSeenAtMs = null;
    this.primaryTrackId = null;
    this.selectionRestartRequired = false;
    this.continuity = 'explicit_selection_restart';
    this.setWithheld(at, 'searching_after_explicit_selection');
    return this.snapshot(at, []);
  }

  setWithheld(atMs, reason) {
    if (this.openWithheld?.reason === reason) return;
    this.closeWithheld(atMs);
    this.openWithheld = { startMs: atMs, reason };
  }

  closeWithheld(atMs) {
    if (!this.openWithheld) return;
    const interval = Object.freeze({
      startMs: this.openWithheld.startMs,
      endMs: Math.max(this.openWithheld.startMs, atMs),
      reason: this.openWithheld.reason,
    });
    this.excludedDurationMs += interval.endMs - interval.startMs;
    if (this.withheldIntervals.length < this.config.maximumWithheldIntervals) this.withheldIntervals.push(interval);
    else this.withheldIntervalsTruncated = true;
    this.openWithheld = null;
  }

  requireSelection(atMs, reason) {
    this.state = PRIMARY_LOCK_STATE.PRIMARY_SELECTION_REQUIRED;
    this.selectionRestartRequired = true;
    this.candidateBox = null;
    this.candidateSinceMs = null;
    this.reacquireBox = null;
    this.reacquireSinceMs = null;
    this.reacquisitionAmbiguous = false;
    this.primaryBox = null;
    this.primaryMotion = { xPerMs: 0, yPerMs: 0 };
    this.primaryTrackId = null;
    this.continuity = 'selection_required';
    this.setWithheld(atMs, reason);
  }

  acquire(box, atMs) {
    this.trackSequence += 1;
    this.primaryTrackId = `primary-${this.trackSequence}`;
    this.primaryBox = box;
    this.primaryMotion = { xPerMs: 0, yPerMs: 0 };
    this.reacquisitionAmbiguous = false;
    this.lastSeenAtMs = atMs;
    this.state = PRIMARY_LOCK_STATE.PRIMARY_LOCKED;
    this.candidateBox = null;
    this.candidateSinceMs = null;
    this.ambiguitySinceMs = null;
    this.continuity = 'locked';
    this.knownBystanders = [];
    this.closeWithheld(atMs);
  }

  updateInitial(atMs, boxes) {
    const strike = boxes.filter((box) => inStrikeZone(box, this.config.strikeZone));
    if (strike.length > 1) {
      if (this.ambiguitySinceMs === null) this.ambiguitySinceMs = atMs;
      this.state = PRIMARY_LOCK_STATE.LOCK_CANDIDATE;
      this.candidateBox = null;
      this.candidateSinceMs = null;
      this.continuity = 'initial_ambiguity';
      this.setWithheld(atMs, 'initial_primary_ambiguity');
      if (atMs - this.ambiguitySinceMs >= this.config.initialAmbiguityMs) this.requireSelection(atMs, 'initial_primary_selection_required');
      return;
    }
    this.ambiguitySinceMs = null;
    if (strike.length === 0) {
      this.state = PRIMARY_LOCK_STATE.SEARCHING;
      this.candidateBox = null;
      this.candidateSinceMs = null;
      this.continuity = 'searching';
      this.setWithheld(atMs, 'primary_not_acquired');
      return;
    }
    const box = strike[0];
    if (!sameCandidate(this.candidateBox, box, this.config.maximumCenterDistance)) {
      this.candidateBox = box;
      this.candidateSinceMs = atMs;
    } else this.candidateBox = box;
    this.state = PRIMARY_LOCK_STATE.LOCK_CANDIDATE;
    this.continuity = 'candidate_stable';
    this.setWithheld(atMs, 'primary_lock_candidate');
    if (atMs - this.candidateSinceMs >= this.config.acquisitionHoldMs) this.acquire(box, atMs);
  }

  predictedPrimaryBox(atMs) {
    if (!this.primaryBox || this.lastSeenAtMs === null) return this.primaryBox;
    const elapsed = Math.min(this.config.motionPredictionHorizonMs, Math.max(0, atMs - this.lastSeenAtMs));
    return normalizeBox({
      left: this.primaryBox.left + this.primaryMotion.xPerMs * elapsed,
      top: this.primaryBox.top + this.primaryMotion.yPerMs * elapsed,
      width: this.primaryBox.width,
      height: this.primaryBox.height,
    }) || this.primaryBox;
  }

  updatePrimaryMotion(atMs, box) {
    if (!this.primaryBox || this.lastSeenAtMs === null || atMs <= this.lastSeenAtMs) {
      this.primaryMotion = { xPerMs: 0, yPerMs: 0 };
      return;
    }
    const elapsed = atMs - this.lastSeenAtMs;
    const nextX = (box.centerX - this.primaryBox.centerX) / elapsed;
    const nextY = (box.centerY - this.primaryBox.centerY) / elapsed;
    this.primaryMotion = {
      xPerMs: this.primaryMotion.xPerMs * 0.5 + nextX * 0.5,
      yPerMs: this.primaryMotion.yPerMs * 0.5 + nextY * 0.5,
    };
  }

  matchPrimary(atMs, boxes) {
    const matches = continuityCandidates(this.primaryBox, boxes, this.config, this.predictedPrimaryBox(atMs));
    return Object.freeze({
      matched: matches.length === 1 ? matches[0].box : null,
      matches: Object.freeze(matches.map((item) => item.box)),
    });
  }

  rememberBystanders(atMs, boxes) {
    const fresh = this.state === PRIMARY_LOCK_STATE.PRIMARY_LOCKED
      ? this.knownBystanders.filter((item) => atMs - item.atMs <= this.config.bystanderMemoryMs)
      : [...this.knownBystanders];
    for (const box of boxes) fresh.push({ box, atMs });
    this.knownBystanders = fresh.slice(-12);
  }

  knownBystanderMatches(atMs, box) {
    this.rememberBystanders(atMs, []);
    const continuityDistance = Math.max(this.config.bystanderContinuityDistance, this.config.maximumCenterDistance);
    return this.knownBystanders.some((item) => sameCandidate(item.box, box, continuityDistance));
  }

  updateLocked(atMs, boxes) {
    const classification = this.matchPrimary(atMs, boxes);
    const matched = classification.matched;
    const outsideContinuity = boxes.filter((box) => !classification.matches.includes(box));
    this.rememberBystanders(atMs, outsideContinuity);
    if (classification.matches.length > 1) this.reacquisitionAmbiguous = true;
    if (matched && this.state === PRIMARY_LOCK_STATE.PRIMARY_LOCKED) {
      this.updatePrimaryMotion(atMs, matched);
      this.primaryBox = matched;
      this.lastSeenAtMs = atMs;
      this.rememberBystanders(atMs, boxes.filter((box) => box !== matched));
      this.continuity = boxes.length > 1 ? 'locked_bystander_excluded' : 'locked';
      this.closeWithheld(atMs);
      return;
    }
    if (matched) {
      if (this.reacquisitionAmbiguous) {
        this.state = PRIMARY_LOCK_STATE.PRIMARY_TEMPORARILY_OCCLUDED;
        this.reacquireBox = null;
        this.reacquireSinceMs = null;
        this.continuity = 'crossing_reacquisition_ambiguous';
        this.setWithheld(atMs, 'crossing_reacquisition_ambiguous');
        if (this.lastSeenAtMs !== null && atMs - this.lastSeenAtMs >= this.config.selectionRequiredMs) this.requireSelection(atMs, 'primary_absence_selection_required');
        return;
      }
      if (this.knownBystanderMatches(atMs, matched)) {
        this.rememberBystanders(atMs, [matched]);
        this.state = PRIMARY_LOCK_STATE.PRIMARY_TEMPORARILY_OCCLUDED;
        this.reacquireBox = null;
        this.reacquireSinceMs = null;
        this.continuity = 'bystander_reacquisition_unsafe';
        this.setWithheld(atMs, 'bystander_reacquisition_unsafe');
        if (this.lastSeenAtMs !== null && atMs - this.lastSeenAtMs >= this.config.selectionRequiredMs) this.requireSelection(atMs, 'primary_absence_selection_required');
        return;
      }
      if (this.state !== PRIMARY_LOCK_STATE.REACQUIRING || !sameCandidate(this.reacquireBox, matched, this.config.maximumCenterDistance)) {
        this.state = PRIMARY_LOCK_STATE.REACQUIRING;
        this.reacquireBox = matched;
        this.reacquireSinceMs = atMs;
        this.continuity = 'reacquiring';
        this.setWithheld(atMs, 'primary_reacquiring');
        return;
      }
      this.reacquireBox = matched;
      if (atMs - this.reacquireSinceMs >= this.config.reacquireHoldMs) {
        this.updatePrimaryMotion(atMs, matched);
        this.primaryBox = matched;
        this.lastSeenAtMs = atMs;
        this.state = PRIMARY_LOCK_STATE.PRIMARY_LOCKED;
        this.reacquireBox = null;
        this.reacquireSinceMs = null;
        this.reacquisitionCount += 1;
        this.knownBystanders = this.knownBystanders.filter((item) => !sameCandidate(item.box, matched, this.config.bystanderContinuityDistance));
        this.continuity = 'reacquired';
        this.closeWithheld(atMs);
      }
      return;
    }
    this.state = PRIMARY_LOCK_STATE.PRIMARY_TEMPORARILY_OCCLUDED;
    this.reacquireBox = null;
    this.reacquireSinceMs = null;
    this.continuity = boxes.length ? 'ambiguous_or_discontinuous' : 'temporarily_occluded';
    this.setWithheld(atMs, this.continuity);
    if (this.lastSeenAtMs !== null && atMs - this.lastSeenAtMs >= this.config.selectionRequiredMs) this.requireSelection(atMs, 'primary_absence_selection_required');
  }

  update({ atMs, candidates = [] } = {}) {
    const at = finiteTimestamp(atMs);
    if (this.lastAtMs !== null && at < this.lastAtMs) throw new TypeError('Primary-lock timestamps must be monotonic.');
    this.lastAtMs = at;
    const boxes = (Array.isArray(candidates) ? candidates : []).map(normalizeBox).filter(Boolean)
      .sort((first, second) => first.centerX - second.centerX || first.centerY - second.centerY || first.area - second.area);
    this.lastFaceCount = boxes.length;
    if (this.state === PRIMARY_LOCK_STATE.PRIMARY_SELECTION_REQUIRED) {
      this.lastBystanderCount = boxes.length;
      this.setWithheld(at, 'primary_selection_required');
      return this.snapshot(at, boxes);
    }
    if (this.primaryTrackId === null) this.updateInitial(at, boxes);
    else this.updateLocked(at, boxes);
    const primaryUsable = this.state === PRIMARY_LOCK_STATE.PRIMARY_LOCKED && Boolean(this.primaryBox);
    this.lastBystanderCount = primaryUsable ? Math.max(0, boxes.length - 1) : Math.max(0, boxes.length);
    return this.snapshot(at, boxes);
  }

  snapshot(atMs = this.lastAtMs ?? 0, boxes = []) {
    const at = finiteTimestamp(atMs);
    const primaryUsable = this.state === PRIMARY_LOCK_STATE.PRIMARY_LOCKED && Boolean(this.primaryBox);
    const openDuration = this.openWithheld ? Math.max(0, at - this.openWithheld.startMs) : 0;
    const intervals = this.withheldIntervals.map((interval) => Object.freeze({ ...interval }));
    if (this.openWithheld) intervals.push(Object.freeze({
      startMs: this.openWithheld.startMs,
      endMs: at,
      reason: this.openWithheld.reason,
      open: true,
    }));
    let zoneStatus = 'empty';
    const strikeCount = boxes.filter((box) => inStrikeZone(box, this.config.strikeZone)).length;
    if (strikeCount > 1) zoneStatus = 'ambiguous';
    else if (strikeCount === 1) zoneStatus = 'single';
    if (this.primaryBox) zoneStatus = inStrikeZone(this.primaryBox, this.config.strikeZone) ? 'primary_inside' : 'primary_outside';
    return Object.freeze({
      state: this.state,
      primaryTrackId: this.primaryTrackId,
      primaryUsable,
      primaryRoi: primaryUsable ? paddedPrimaryRoi(this.primaryBox) : null,
      faceCount: this.lastFaceCount,
      bystanderCount: this.lastBystanderCount,
      zoneStatus,
      continuity: this.continuity,
      selectionRequired: this.selectionRestartRequired,
      excludedDurationMs: this.excludedDurationMs + openDuration,
      reacquisitionCount: this.reacquisitionCount,
      withheldIntervals: Object.freeze(intervals),
      withheldIntervalsTruncated: this.withheldIntervalsTruncated,
    });
  }
}
