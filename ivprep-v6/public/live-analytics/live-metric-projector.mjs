// Y1-Y2-CAM-V6-3521 — live diagnostic -> presentation metric projection.
//
// This module is deliberately downstream of BrowserAnalyticsPipeline. It does not
// acquire media, run DSP, retain raw samples, inspect transcript text, or infer a
// person's internal state. It projects compact, already-derived diagnostic fields
// into the six instruments in the Live Analytics Runtime.

export const LIVE_METRIC_IDS = Object.freeze([
  'VOLUME',
  'SPEED_WPM',
  'VOLUME_MODULATION',
  'PITCH',
  'HEAD_FACE',
  'BODY_HANDS',
]);

export const TRUSTED_TRANSCRIPT_TIMING_SOURCES = Object.freeze([
  'LOCAL_TIMED_TRANSCRIPT',
  'OBSERVED_TRANSCRIPT_SEGMENTS',
]);
const DETERMINISTIC_TEST_TIMING_SOURCE = 'DETERMINISTIC_TEST_TRANSCRIPT_TIMING';

const UNSUPPORTED_REASON = 'UNSUPPORTED_INFERENCE';
const DEFAULT_MAXIMUM_TRANSCRIPT_GAP_MS = 5_000;

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

function unavailable(reason, detail = null) {
  return deepFreeze({
    available: false,
    reason,
    ...(detail ? { detail } : {}),
  });
}

/**
 * Claims intentionally absent from the runtime measurement surface.
 *
 * Keeping these explicit lets diagnostics explain a closed capability without a UI
 * substituting a weaker proxy. Statistical F0 clarity is not the same as a claim
 * about speaker confidence; the latter remains unavailable here.
 */
export const UNSUPPORTED_LIVE_CLAIMS = deepFreeze({
  gestureMeaning: unavailable(UNSUPPORTED_REASON),
  noteTakingBehavior: unavailable(UNSUPPORTED_REASON),
  fidgetOrRestlessness: unavailable(UNSUPPORTED_REASON),
  emotionOrAffect: unavailable(UNSUPPORTED_REASON),
  duchenneOrGenuineSmile: unavailable(UNSUPPORTED_REASON),
  honestyOrSincerity: unavailable(UNSUPPORTED_REASON),
  personalityOrIntent: unavailable(UNSUPPORTED_REASON),
  speakerConfidence: unavailable(UNSUPPORTED_REASON),
  hiringSuitability: unavailable(UNSUPPORTED_REASON),
  clinicalOrDiagnosticState: unavailable(UNSUPPORTED_REASON),
});

function finite(value) {
  return Number.isFinite(value) ? Number(value) : null;
}

function clamp(value, minimum, maximum) {
  return Math.max(minimum, Math.min(maximum, value));
}

function round(value, places = 3) {
  return Number.isFinite(value) ? Number(value.toFixed(places)) : null;
}

function mean(values) {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
}

function standardDeviation(values) {
  if (values.length < 2) return null;
  const average = mean(values);
  return Math.sqrt(values.reduce((sum, value) => sum + (value - average) ** 2, 0) / values.length);
}

/** RMS -> dBFS with an explicit presentation floor, never a fabricated midpoint. */
export function rmsToDbfs(rms, floorDbfs = -96) {
  if (!Number.isFinite(rms) || rms < 0) return null;
  if (rms === 0) return floorDbfs;
  return clamp(20 * Math.log10(rms), floorDbfs, 0);
}

function pitchRegister(semitones) {
  if (!Number.isFinite(semitones)) return null;
  if (semitones <= -4) return -2;
  if (semitones <= -1.5) return -1;
  if (semitones < 1.5) return 0;
  if (semitones < 4) return 1;
  return 2;
}

function compactPoint(value) {
  if (!value || !Number.isFinite(value.centerX) || !Number.isFinite(value.centerY)) return null;
  return deepFreeze({ centerX: Number(value.centerX), centerY: Number(value.centerY) });
}

function initialMetrics() {
  return {
    VOLUME: unavailable('NO_AUDIO_FRAMES'),
    SPEED_WPM: unavailable('NO_TRUSTWORTHY_TRANSCRIPT_TIMING'),
    VOLUME_MODULATION: unavailable('NEED_MORE_RMS_HISTORY'),
    PITCH: unavailable('NO_VALIDATED_F0'),
    HEAD_FACE: unavailable('NO_VISION_FRAMES'),
    BODY_HANDS: unavailable('NO_VISION_FRAMES'),
  };
}

/**
 * Stateful only where a real rolling window is required. State is bounded and
 * contains derived scalars only: no PCM, pixels, landmarks, blendshape arrays, or
 * transcript content can enter it.
 */
export class LiveMetricProjector {
  #audioHistory = [];
  #faceHistory = [];
  #bodyHistory = [];
  #priorBody = null;
  #gestureWasActive = false;
  #gestureEventCount = 0;
  #metrics = initialMetrics();
  #latest = null;
  #lastAcceptedAtMs = { audio: null, vision: null, transcript: null };
  #lastTranscriptWindowEndedAtMs = null;
  #maximumAudioFrames;
  #minimumModulationFrames;
  #maximumTranscriptGapMs;

  constructor({
    maximumAudioFrames = 160,
    minimumModulationFrames = 12,
    maximumTranscriptGapMs = DEFAULT_MAXIMUM_TRANSCRIPT_GAP_MS,
  } = {}) {
    this.#maximumAudioFrames = Math.round(clamp(Number(maximumAudioFrames) || 160, 12, 600));
    this.#minimumModulationFrames = Math.round(clamp(Number(minimumModulationFrames) || 12, 3, this.#maximumAudioFrames));
    this.#maximumTranscriptGapMs = Math.round(clamp(
      Number(maximumTranscriptGapMs) || DEFAULT_MAXIMUM_TRANSCRIPT_GAP_MS,
      1_000,
      30_000,
    ));
    this.#latest = this.#snapshot(null);
  }

  get latest() { return this.#latest; }

  reset() {
    this.#audioHistory = [];
    this.#faceHistory = [];
    this.#bodyHistory = [];
    this.#priorBody = null;
    this.#gestureWasActive = false;
    this.#gestureEventCount = 0;
    this.#metrics = initialMetrics();
    this.#lastAcceptedAtMs = { audio: null, vision: null, transcript: null };
    this.#lastTranscriptWindowEndedAtMs = null;
    this.#latest = this.#snapshot(null);
    return this;
  }

  /** Feed one BrowserAnalyticsPipeline `diagnostic` event detail. */
  ingest(detail = {}) {
    if (detail?.modality === 'audio') return this.#ingestAudio(detail);
    if (detail?.modality === 'vision') return this.#ingestVision(detail);
    return this.#latest;
  }

  /**
   * The only WPM entrance. It accepts aggregate observed timing, never text.
   * A caller must identify a proven timing source and affirm that the window was
   * observed. Missing or malformed provenance fails closed.
   */
  ingestTranscriptTiming(evidence = {}, { allowDeterministicFixture = false } = {}) {
    const startedAtMs = finite(evidence.windowStartedAtMs);
    const endedAtMs = finite(evidence.windowEndedAtMs);
    const atMs = finite(evidence.atMs) ?? endedAtMs;
    const wordCount = Number.isInteger(evidence.wordCount) ? evidence.wordCount : null;
    const provenance = evidence.provenance || null;
    const observedTrusted = provenance?.kind === 'OBSERVED_TRANSCRIPT_TIMING'
      && provenance.observed === true
      && TRUSTED_TRANSCRIPT_TIMING_SOURCES.includes(provenance.source);
    const deterministicTrusted = allowDeterministicFixture === true
      && provenance?.kind === 'DETERMINISTIC_TEST_TRANSCRIPT_TIMING'
      && provenance.observed === false
      && provenance.source === DETERMINISTIC_TEST_TIMING_SOURCE
      && provenance.fixture === 'DETERMINISTIC_LOCAL_TEST_SIGNAL';
    const trusted = observedTrusted || deterministicTrusted;

    if (!trusted) {
      this.#metrics.SPEED_WPM = unavailable('NO_TRUSTWORTHY_TRANSCRIPT_TIMING');
      this.#latest = this.#snapshot(atMs);
      return this.#latest;
    }
    if (![startedAtMs, endedAtMs, atMs].every(Number.isFinite)
      || endedAtMs <= startedAtMs
      || atMs < endedAtMs
      || wordCount === null
      || wordCount < 0) {
      this.#metrics.SPEED_WPM = unavailable('INVALID_TRANSCRIPT_TIMING_WINDOW');
      this.#latest = this.#snapshot(atMs);
      return this.#latest;
    }
    if (this.#isStale('transcript', atMs)) return this.#latest;

    const durationMs = endedAtMs - startedAtMs;
    const timingGapMs = atMs - endedAtMs;
    if (timingGapMs > this.#maximumTranscriptGapMs) {
      this.#metrics.SPEED_WPM = unavailable('STALE_TRANSCRIPT_TIMING', {
        timingGapMs,
        maximumGapMs: this.#maximumTranscriptGapMs,
      });
    } else if (durationMs < 1_000 || wordCount < 3) {
      this.#metrics.SPEED_WPM = unavailable('NEED_MORE_TIMED_WORDS');
    } else {
      const wordsPerMinute = wordCount * 60_000 / durationMs;
      this.#metrics.SPEED_WPM = deepFreeze({
        available: true,
        wordsPerMinute: round(wordsPerMinute, 1),
        wordCount,
        windowStartedAtMs: startedAtMs,
        windowEndedAtMs: endedAtMs,
        windowDurationMs: durationMs,
        timingSource: provenance.source,
        source: deterministicTrusted ? 'DETERMINISTIC_TEST_FIXTURE' : 'TRUSTED_TRANSCRIPT_TIMING',
        fixture: deterministicTrusted,
      });
    }
    this.#lastTranscriptWindowEndedAtMs = endedAtMs;
    this.#lastAcceptedAtMs.transcript = atMs;
    this.#latest = this.#snapshot(atMs);
    return this.#latest;
  }

  #ingestAudio(detail) {
    const atMs = finite(detail.atMs);
    if (atMs === null) {
      this.#metrics.VOLUME = unavailable('INVALID_AUDIO_TIMESTAMP');
      this.#metrics.VOLUME_MODULATION = unavailable('INVALID_AUDIO_TIMESTAMP');
      this.#metrics.PITCH = unavailable('INVALID_AUDIO_TIMESTAMP');
      this.#latest = this.#snapshot(null);
      return this.#latest;
    }
    if (this.#isStale('audio', atMs)) return this.#latest;

    const rms = finite(detail.rms);
    const dbfs = rms === null ? null : rmsToDbfs(rms);
    if (dbfs === null) {
      this.#metrics.VOLUME = unavailable('NO_MIC_RMS');
      this.#metrics.VOLUME_MODULATION = unavailable('NO_MIC_RMS');
    } else {
      this.#metrics.VOLUME = deepFreeze({
        available: true,
        dbfs: round(dbfs, 2),
        rms,
        peak: finite(detail.peak),
        clippedFraction: finite(detail.clippedFraction),
        normalized: round(clamp((dbfs + 60) / 60, 0, 1), 4),
        state: 'observed',
        source: 'MIC_RMS',
        atMs,
      });

      this.#audioHistory.push(deepFreeze({ atMs, dbfs: round(dbfs, 3) }));
      if (this.#audioHistory.length > this.#maximumAudioFrames) this.#audioHistory.shift();
      if (this.#audioHistory.length < this.#minimumModulationFrames) {
        this.#metrics.VOLUME_MODULATION = unavailable('NEED_MORE_RMS_HISTORY', {
          observedFrames: this.#audioHistory.length,
          requiredFrames: this.#minimumModulationFrames,
        });
      } else {
        const values = this.#audioHistory.map((frame) => frame.dbfs);
        const rangeDb = Math.max(...values) - Math.min(...values);
        const stdDevDb = standardDeviation(values);
        this.#metrics.VOLUME_MODULATION = deepFreeze({
          available: true,
          trace: this.#audioHistory.map((frame) => ({ ...frame })),
          observedFrames: this.#audioHistory.length,
          rangeDb: round(rangeDb, 3),
          stdDevDb: round(stdDevDb, 3),
          normalized: round(clamp(rangeDb / 24, 0, 1), 4),
          source: 'MIC_RMS_HISTORY',
          atMs,
        });
      }
    }

    this.#metrics.PITCH = this.#projectPitch(detail.pitch, atMs);
    this.#expireTranscriptTiming(atMs);
    this.#lastAcceptedAtMs.audio = atMs;
    this.#latest = this.#snapshot(atMs);
    return this.#latest;
  }

  #projectPitch(pitch, atMs) {
    const summary = pitch?.summary;
    if (!summary?.available || !Number.isFinite(summary.medianHz) || summary.medianHz <= 0) {
      return unavailable(summary?.reason === 'INSUFFICIENT_VOICED_AUDIO'
        ? 'ESTABLISHING_SPEAKER_RANGE'
        : 'NO_VALIDATED_F0');
    }

    const voiced = pitch?.voiced === true && Number.isFinite(pitch.f0Hz) && pitch.f0Hz > 0;
    const semitones = voiced ? 12 * Math.log2(pitch.f0Hz / summary.medianHz) : null;
    return deepFreeze({
      available: true,
      voiced,
      f0Hz: voiced ? round(pitch.f0Hz, 3) : null,
      medianHz: round(summary.medianHz, 3),
      semitonesFromSpeakerMedian: round(semitones, 3),
      register: pitchRegister(semitones),
      rangeSemitones: finite(summary.rangeSemitones),
      variationSemitones: finite(summary.variationSemitones),
      voicedRatio: finite(summary.voicedRatio),
      reference: 'SPEAKER_ROLLING_MEDIAN',
      absoluteHzTarget: null,
      source: 'VALIDATED_F0',
      atMs,
    });
  }

  #ingestVision(detail) {
    const atMs = finite(detail.atMs);
    if (atMs === null) {
      this.#metrics.HEAD_FACE = unavailable('INVALID_VISION_TIMESTAMP');
      this.#metrics.BODY_HANDS = unavailable('INVALID_VISION_TIMESTAMP');
      this.#latest = this.#snapshot(null);
      return this.#latest;
    }
    if (this.#isStale('vision', atMs)) return this.#latest;

    const primaryLock = detail.primaryLock || null;
    const primaryLocked = primaryLock?.state === 'PRIMARY_LOCKED'
      && primaryLock?.selectionRequired !== true;
    const geometry = detail.geometry || null;
    if (!primaryLocked) {
      const reason = !primaryLock
        ? 'PRIMARY_LOCK_UNAVAILABLE'
        : primaryLock.selectionRequired === true || primaryLock.state === 'PRIMARY_SELECTION_REQUIRED'
          ? 'PRIMARY_SELECTION_REQUIRED'
          : ['PRIMARY_TEMPORARILY_OCCLUDED', 'REACQUIRING'].includes(primaryLock.state)
            ? 'PRIMARY_TEMPORARILY_UNAVAILABLE'
            : 'PRIMARY_NOT_LOCKED';
      const withheld = unavailable(reason, {
        primaryLockState: typeof primaryLock?.state === 'string' ? primaryLock.state : 'UNAVAILABLE',
      });
      this.#metrics.HEAD_FACE = withheld;
      this.#metrics.BODY_HANDS = withheld;
    } else if (!geometry) {
      this.#metrics.HEAD_FACE = unavailable('NO_VISION_GEOMETRY');
      this.#metrics.BODY_HANDS = unavailable('NO_VISION_GEOMETRY');
    } else {
      this.#metrics.HEAD_FACE = this.#projectHeadFace(geometry.face, detail.faceFamily, detail.faceFamilySummary, atMs);
      this.#metrics.BODY_HANDS = this.#projectBodyHands(geometry, detail.live, atMs);
    }

    this.#expireTranscriptTiming(atMs);
    this.#lastAcceptedAtMs.vision = atMs;
    this.#latest = this.#snapshot(atMs);
    return this.#latest;
  }

  #projectHeadFace(face, faceFamily, faceSummary, atMs) {
    if (!face) return unavailable('NO_FACE_GEOMETRY');
    const yaw = finite(face.yawProxyDeg);
    const pitch = finite(face.pitchProxyDeg);
    const roll = finite(face.rollProxyDeg);
    const box = face.box || null;
    const centered = Number.isFinite(box?.centerX) && Number.isFinite(box?.centerY)
      ? box.centerX >= 0.35 && box.centerX <= 0.65 && box.centerY >= 0.2 && box.centerY <= 0.72
      : null;
    const familyAvailable = faceFamily?.available === true;
    const mouth = familyAvailable ? faceFamily['FACE.SMILE'] : null;
    const blink = familyAvailable ? faceFamily['FACE.BLINK'] : null;
    const brow = familyAvailable ? faceFamily['FACE.BROW'] : null;
    const periocular = familyAvailable ? faceFamily['FACE.PERIOCULAR'] : null;
    const gaze = familyAvailable ? faceFamily['FACE.GAZE'] : null;
    const smileSummary = faceSummary?.cartridges?.['FACE.SMILE'];
    const blinkSummary = faceSummary?.cartridges?.['FACE.BLINK'];
    const dwell = faceSummary?.cameraDwell;
    const observedDurationMs = finite(faceSummary?.observedDurationMs)
      ?? (Number.isFinite(atMs) && atMs > 0 ? atMs : null);
    const movementValue = finite(faceSummary?.movementVariability?.value)
      ?? finite(faceSummary?.movementVariability?.normalized);
    if (movementValue !== null) {
      this.#faceHistory.push({ atMs, value: round(movementValue, 4) });
      if (this.#faceHistory.length > 120) this.#faceHistory.shift();
    }

    return deepFreeze({
      available: true,
      facePresent: face.present === true,
      faceCentered: centered,
      faceBox: box && ['left', 'top', 'width', 'height', 'centerX', 'centerY'].every((key) => Number.isFinite(box[key]))
        ? {
          left: box.left, top: box.top, width: box.width, height: box.height,
          centerX: box.centerX, centerY: box.centerY,
        }
        : null,
      orientation: {
        available: [yaw, pitch, roll].some(Number.isFinite),
        yawProxyDeg: yaw,
        pitchProxyDeg: pitch,
        rollProxyDeg: roll,
        cameraFacingProxy: yaw === null ? null : Math.abs(yaw) < 18,
        method: 'LANDMARK_GEOMETRY_PROXY',
      },
      mouthCornerElevation: mouth?.availability === 'AVAILABLE' || mouth?.availability === 'PARTIAL'
        ? {
          available: true,
          active: mouth.active === true,
          bilateral: finite(mouth.bilateral),
          symmetry: finite(mouth.symmetry),
          claim: 'OBSERVABLE_MOUTH_CORNER_ELEVATION',
        }
        : unavailable('NO_MOUTH_CORNER_CHANNELS'),
      blink: blink?.availability === 'AVAILABLE' || blink?.availability === 'PARTIAL'
        ? { available: true, closing: blink.closing === true, count: finite(blink.count) }
        : unavailable('NO_BLINK_CHANNELS'),
      browMovement: brow?.availability === 'AVAILABLE' || brow?.availability === 'PARTIAL'
        ? { available: true, active: brow.active === true, magnitude: finite(brow.magnitude) }
        : unavailable('NO_BROW_CHANNELS'),
      periocularContraction: periocular?.availability === 'AVAILABLE' || periocular?.availability === 'PARTIAL'
        ? { available: true, active: periocular.active === true, bilateral: finite(periocular.bilateral) }
        : unavailable('NO_PERIOCULAR_CHANNELS'),
      gazeProxy: gaze?.availability === 'AVAILABLE' || gaze?.availability === 'PARTIAL'
        ? {
          available: true,
          horizontal: finite(gaze.horizontal),
          vertical: finite(gaze.vertical),
          offCentreMagnitude: finite(gaze.offCentreMagnitude),
          cameraFacing: gaze.cameraFacing === true,
          method: 'BLENDSHAPE_GAZE_PROXY',
          target: null,
        }
        : unavailable('NO_GAZE_PROXY_CHANNELS'),
      smileEvents: Number.isFinite(smileSummary?.eventCount)
        ? { available: true, count: Number(smileSummary.eventCount), source: 'FACE_SMILE_EVENT_SUMMARY' }
        : unavailable('NO_SMILE_EVENT_SUMMARY'),
      cameraFacingDwell: dwell?.available === true
        && Number.isFinite(dwell.cameraFacingRatio)
        && Number.isFinite(dwell.offCameraRatio)
        ? {
          available: true,
          cameraFacingRatio: dwell.cameraFacingRatio,
          offCameraRatio: dwell.offCameraRatio,
          longestFacingRunMs: finite(dwell.longestFacingRunMs),
          gazeReleases: finite(dwell.gazeReleases),
          target: null,
          source: 'CAMERA_RELATIVE_GAZE_DWELL_PROXY',
        }
        : unavailable('NO_CAMERA_FACING_DWELL'),
      blinkRate: Number.isFinite(blinkSummary?.eventCount) && Number.isFinite(observedDurationMs) && observedDurationMs >= 1_000
        ? {
          available: true,
          eventsPerMinute: round(Number(blinkSummary.eventCount) * 60_000 / observedDurationMs, 1),
          eventCount: Number(blinkSummary.eventCount),
          observedDurationMs,
          source: 'FACE_BLINK_EVENT_SUMMARY',
        }
        : unavailable('NEED_MORE_BLINK_HISTORY'),
      geometryTrend: this.#faceHistory.length
        ? { available: true, values: this.#faceHistory.map((entry) => ({ ...entry })), source: 'FACE_MOVEMENT_VARIABILITY_HISTORY' }
        : unavailable('NEED_MORE_FACE_HISTORY'),
      headNods: unavailable('NO_VALIDATED_HEAD_NOD_DETECTOR'),
      affectClassification: unavailable(UNSUPPORTED_REASON),
      genuineSmileClassification: unavailable(UNSUPPORTED_REASON),
      source: 'COMPACT_VISION_GEOMETRY_AND_FACE_CARTRIDGES',
      atMs,
    });
  }

  #projectBodyHands(geometry, live, atMs) {
    const pose = geometry.pose || null;
    const hands = geometry.hands || null;
    if (!pose && !hands) return unavailable('NO_BODY_OR_HAND_GEOMETRY');
    const left = hands?.left || null;
    const right = hands?.right || null;
    const currentBody = {
      x: finite(pose?.centerX),
      y: finite(pose?.centerY),
      lean: finite(pose?.lateralLeanDeg),
      leftX: finite(left?.centerX),
      leftY: finite(left?.centerY),
      rightX: finite(right?.centerX),
      rightY: finite(right?.centerY),
    };
    const deltas = Object.keys(currentBody)
      .filter((key) => Number.isFinite(currentBody[key]) && Number.isFinite(this.#priorBody?.[key]))
      .map((key) => Math.abs(currentBody[key] - this.#priorBody[key]));
    const movementLevel = deltas.length ? mean(deltas) : null;
    if (movementLevel !== null) {
      this.#bodyHistory.push({ atMs, value: round(movementLevel, 5) });
      if (this.#bodyHistory.length > 120) this.#bodyHistory.shift();
    }
    this.#priorBody = currentBody;
    const gestureActive = ['left', 'right', 'both'].includes(live?.gestureActive);
    if (gestureActive && !this.#gestureWasActive) this.#gestureEventCount += 1;
    this.#gestureWasActive = gestureActive;

    return deepFreeze({
      available: true,
      torsoPresent: pose?.torsoPresent === true,
      bodyCenter: Number.isFinite(pose?.centerX) && Number.isFinite(pose?.centerY)
        ? { x: pose.centerX, y: pose.centerY }
        : null,
      shoulderWidth: finite(pose?.shoulderWidth),
      lateralLeanDeg: finite(pose?.lateralLeanDeg),
      hands: {
        available: Boolean(hands),
        left: {
          present: left?.present === true,
          zone: typeof left?.zone === 'string' ? left.zone : null,
          position: compactPoint(left),
        },
        right: {
          present: right?.present === true,
          zone: typeof right?.zone === 'string' ? right.zone : null,
          position: compactPoint(right),
        },
        bothPresent: left?.present === true && right?.present === true,
      },
      observableActivity: {
        handRegionActive: ['left', 'right', 'both'].includes(live?.gestureActive) ? live.gestureActive : null,
        headTurnActive: live?.headTurnActive === true,
        postureMovementActive: live?.postureMovementActive === true,
      },
      movementLevel: movementLevel === null
        ? unavailable('NEED_MORE_BODY_HISTORY')
        : {
          available: true,
          normalizedDelta: round(movementLevel, 5),
          active: live?.postureMovementActive === true || gestureActive,
          source: 'COMPACT_GEOMETRY_TEMPORAL_DELTA',
        },
      movementTrend: this.#bodyHistory.length
        ? { available: true, values: this.#bodyHistory.map((entry) => ({ ...entry })), source: 'COMPACT_GEOMETRY_MOVEMENT_HISTORY' }
        : unavailable('NEED_MORE_BODY_HISTORY'),
      gestureEvents: {
        available: true,
        count: this.#gestureEventCount,
        activeRegion: ['left', 'right', 'both'].includes(live?.gestureActive) ? live.gestureActive : null,
        source: 'OBSERVED_HAND_REGION_ACTIVITY',
      },
      gestureClassification: unavailable(UNSUPPORTED_REASON),
      noteTakingClassification: unavailable(UNSUPPORTED_REASON),
      fidgetClassification: unavailable(UNSUPPORTED_REASON),
      source: 'COMPACT_VISION_GEOMETRY',
      atMs,
    });
  }

  #isStale(modality, atMs) {
    const prior = this.#lastAcceptedAtMs[modality];
    return Number.isFinite(prior) && atMs < prior;
  }

  #expireTranscriptTiming(atMs) {
    if (!this.#metrics.SPEED_WPM?.available
      || !Number.isFinite(this.#lastTranscriptWindowEndedAtMs)
      || !Number.isFinite(atMs)) return false;
    const timingGapMs = atMs - this.#lastTranscriptWindowEndedAtMs;
    if (timingGapMs <= this.#maximumTranscriptGapMs) return false;
    this.#metrics.SPEED_WPM = unavailable('STALE_TRANSCRIPT_TIMING', {
      timingGapMs,
      maximumGapMs: this.#maximumTranscriptGapMs,
    });
    return true;
  }

  #snapshot(atMs) {
    return deepFreeze({
      atMs: Number.isFinite(atMs) ? atMs : null,
      metrics: { ...this.#metrics },
      unsupportedClaims: UNSUPPORTED_LIVE_CLAIMS,
      clock: {
        basis: 'ANALYTICS_SESSION_MS',
        lastAcceptedAtMs: { ...this.#lastAcceptedAtMs },
      },
    });
  }
}
