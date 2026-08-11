import {
  ANALYTICS_ENGINE_VERSION,
  MATURITY,
  SESSION_SCHEMA,
  createEvidenceEvent,
  sanitizeTranscriptForCounting,
  serializeAnalyticsEnvelope,
  validateEvidenceTimeline,
} from './event-contract.mjs';
import { AudioSignalAnalyzer } from './audio-signal.mjs';
import { VisionEpisodeAnalyzer } from './episode-detectors.mjs';
import { SessionClock } from './session-clock.mjs';
import { VALIDATION_RECORD, maturityForSignal, projectStudentEvents, signalDefinition } from './signal-registry.mjs';

const SOURCE = Object.freeze({
  clock: { engine: 'missionmed-monotonic-clock', engineVersion: ANALYTICS_ENGINE_VERSION, modelVersion: null, input: 'clock' },
  mic: { engine: 'missionmed-web-audio', engineVersion: ANALYTICS_ENGINE_VERSION, modelVersion: null, input: 'mic' },
  camera: { engine: 'mediapipe-holistic-local', engineVersion: ANALYTICS_ENGINE_VERSION, modelVersion: 'holistic_landmarker.float16.v1', input: 'camera' },
  faceDetector: { engine: 'mediapipe-face-detector-local', engineVersion: ANALYTICS_ENGINE_VERSION, modelVersion: 'blaze_face_short_range.float16.latest', input: 'camera' },
  transcript: { engine: 'missionmed-existing-browser-transcript', engineVersion: ANALYTICS_ENGINE_VERSION, modelVersion: null, input: 'transcript' },
  system: { engine: 'missionmed-local-runtime', engineVersion: ANALYTICS_ENGINE_VERSION, modelVersion: null, input: 'system' },
});

function quality({ coverage = 0, sampleCount = 0, available = true, limitations = [], provenance = 'derived' } = {}) {
  const reliability = !available ? 'unavailable' : coverage >= 0.9 ? 'high' : coverage >= 0.8 ? 'medium' : coverage > 0 ? 'low' : 'unavailable';
  return { provenance, reliability, coverage, sampleCount, limitations };
}

function fillerCount(text) {
  const matches = text.toLowerCase().match(/\b(?:um+|uh+|erm+|like|you know|i mean)\b/gu);
  return matches?.length || 0;
}

function finite(value, places = 4) {
  return Number.isFinite(value) ? Number(value.toFixed(places)) : null;
}

export class AnalyticsSession {
  constructor({ sessionId, now, wallClock } = {}) {
    this.sessionId = String(sessionId || `analytics-${crypto.randomUUID?.() || Math.random().toString(36).slice(2)}`);
    this.clock = new SessionClock({ sessionId: this.sessionId, now, wallClock });
    this.audio = new AudioSignalAnalyzer();
    this.vision = new VisionEpisodeAnalyzer();
    this.active = null;
    this.answerCounter = 0;
  }

  beginAnswer({ answerId = null, hasMic = false, hasCamera = false, mediaId = null, mediaStartedAt = null } = {}) {
    if (this.active) throw new TypeError('An analytics answer is already active.');
    const id = String(answerId || `answer-${++this.answerCounter}`);
    const answer = this.clock.startAnswer(id);
    this.audio.begin(answer.startedAtMs);
    this.vision.begin(answer.startedAtMs);
    const mediaStartedAtMs = Number.isFinite(mediaStartedAt) ? this.clock.projectMs(mediaStartedAt) : null;
    this.active = { ...answer, hasMic: Boolean(hasMic), hasCamera: Boolean(hasCamera), mediaId: mediaId ? String(mediaId) : null, mediaStartedAtMs };
    return Object.freeze({ sessionId: this.sessionId, answerId: id, startedAtMs: answer.startedAtMs });
  }

  ingestAudio(frame) {
    if (!this.active || !this.active.hasMic) return false;
    this.audio.ingest(frame);
    return true;
  }

  ingestVision(frame) {
    if (!this.active || !this.active.hasCamera) return false;
    this.vision.ingest(frame);
    return true;
  }

  observationGap({ startMs, endMs, reason, modality = 'vision' }) {
    if (!this.active) return;
    if (modality === 'all' || modality === 'audio') this.audio.gap(startMs, endMs, reason);
    if (modality === 'all' || modality === 'vision') this.vision.gap(startMs, endMs, reason);
  }

  endAnswer({ transcript = '', mediaAvailable = false, endAt = undefined, blockedExternalAttemptCount = 0 } = {}) {
    if (!this.active) return null;
    const active = this.active;
    try {
    const ended = this.clock.endAnswer(active.answerId, endAt);
    const audio = active.hasMic ? this.audio.finish(ended.endedAtMs) : null;
    const vision = active.hasCamera ? this.vision.finish(ended.endedAtMs) : null;
    const descriptors = [];
    const add = ({ family, metric, startMs = active.startedAtMs, endMs = ended.endedAtMs, source, observation, eventQuality, maturity = maturityForSignal(metric) }) => {
      descriptors.push({ family, metric, startMs, endMs, source, observation, quality: eventQuality, maturity });
    };

    add({
      family: 'voice', metric: 'answer_duration_ms', source: SOURCE.clock,
      observation: { value: ended.durationMs, unit: 'ms', qualifiers: ['monotonic'] },
      eventQuality: quality({ coverage: 1, sampleCount: 2, provenance: 'observed' }),
    });

    if (audio) {
      const audioQuality = quality({ coverage: audio.coverage, sampleCount: audio.frameCount, available: !audio.samplingGapDetected, limitations: [...(audio.coverage < 0.8 ? ['insufficient_audio_coverage'] : []), ...(audio.samplingGapDetected ? ['audio_sampling_gap'] : []), ...(audio.samplingGapsDropped ? ['audio_gap_timeline_capped'] : [])] });
      const vadQuality = quality({
        coverage: audio.coverage,
        sampleCount: audio.frameCount,
        available: false,
        limitations: [
          'voice_activity_ground_truth_not_validated',
          'startup_noise_or_quiet_speech_ambiguous',
          ...(audio.pauseEpisodesDropped ? ['pause_episode_timeline_capped'] : []),
        ],
      });
      if (audio.capturedLevelDbfs !== null) add({
        family: 'voice', metric: 'captured_level_dbfs', source: SOURCE.mic,
        observation: { value: finite(audio.capturedLevelDbfs, 2), unit: 'dBFS', qualifiers: ['device_capture_not_calibrated_loudness'] }, eventQuality: audioQuality,
      });
      add({
        family: 'voice', metric: 'digital_clipping_fraction', source: SOURCE.mic,
        observation: { value: finite(audio.digitalClippingFraction), unit: 'fraction', qualifiers: ['digital_samples_only'] }, eventQuality: audioQuality,
      });
      if (audio.responseStartLatencyMs !== null) add({
        family: 'voice', metric: 'response_start_latency_ms', startMs: active.startedAtMs, endMs: active.startedAtMs + audio.responseStartLatencyMs, source: SOURCE.mic,
        observation: { value: audio.responseStartLatencyMs, unit: 'ms', qualifiers: ['voice_activity_estimate'] }, eventQuality: vadQuality,
      });
      add({
        family: 'voice', metric: 'speech_active_ratio', source: SOURCE.mic,
        observation: { value: finite(audio.speechActiveRatio), unit: 'fraction', qualifiers: ['voice_activity_estimate'] }, eventQuality: vadQuality,
      });
      if (audio.energyIqrDb !== null) add({
        family: 'voice', metric: 'energy_variation_db', source: SOURCE.mic,
        observation: { value: finite(audio.energyIqrDb, 2), unit: 'dB', qualifiers: ['captured_energy_only', 'delivery_quality_not_inferred'] }, eventQuality: audioQuality,
      });
      if (audio.capturedLevelDbfs !== null) add({
        family: 'voice', metric: 'low_captured_level', source: SOURCE.mic,
        observation: { value: audio.capturedLevelDbfs < -35, unit: null, qualifiers: ['device_capture_only', 'unavailable_without_signal_to_noise_validation'] },
        eventQuality: quality({ coverage: audio.coverage, sampleCount: audio.frameCount, available: false, limitations: ['signal_to_noise_not_validated'] }),
      });
      for (const pause of audio.pauseEpisodes) add({
        family: 'pause', metric: 'pause_episode', startMs: pause.startMs, endMs: pause.endMs, source: SOURCE.mic,
        observation: { value: pause.durationMs, unit: 'ms', qualifiers: ['silence_between_detected_speech', 'intent_not_inferred'] }, eventQuality: vadQuality,
      });
      for (const gap of audio.samplingGaps) add({
        family: 'system', metric: 'observation_gap', startMs: gap.startMs, endMs: gap.endMs, source: SOURCE.system,
        observation: { value: gap.reason, unit: null, qualifiers: ['audio'] },
        eventQuality: quality({ available: false, limitations: [gap.reason], provenance: 'unresolved' }),
      });
    } else add({
      family: 'system', metric: 'observation_gap', source: SOURCE.system,
      observation: { value: 'microphone_unavailable', unit: null, qualifiers: [] },
      eventQuality: quality({ available: false, limitations: ['microphone_unavailable'], provenance: 'unresolved' }),
    });

    const cleanTranscript = sanitizeTranscriptForCounting(transcript);
    if (cleanTranscript.trim()) {
      const words = cleanTranscript.trim().split(/\s+/u).length;
      add({
        family: 'voice', metric: 'word_rate_wpm', source: SOURCE.transcript,
        observation: { value: ended.durationMs >= 5_000 ? Math.round(words / (ended.durationMs / 60_000)) : null, unit: 'words_per_minute', qualifiers: ['existing_transcript_path', 'not_verbatim_validated'] },
        eventQuality: quality({ coverage: 0.5, sampleCount: words, limitations: ['browser_transcript_not_validated'], provenance: 'derived' }),
      });
      add({
        family: 'voice', metric: 'filler_token_count', source: SOURCE.transcript,
        observation: { value: fillerCount(cleanTranscript), unit: 'tokens', qualifiers: ['existing_transcript_path', 'not_verbatim_validated'] },
        eventQuality: quality({ coverage: 0.5, sampleCount: words, limitations: ['browser_transcript_not_validated'], provenance: 'derived' }),
      });
    }

    if (vision) {
      const personSpecificAvailable = vision.personSpecificAvailable;
      const visionQuality = quality({
        coverage: vision.personSpecificCoverage,
        sampleCount: vision.personSpecificSampleCount,
        available: personSpecificAvailable && vision.personSpecificCoverage > 0,
        limitations: [
          ...(vision.personSpecificCoverage < 0.8 ? ['insufficient_safe_person_specific_coverage'] : []),
          ...(vision.faceAbsenceSampleCount > 0 ? ['face_absence_intervals_excluded'] : []),
          ...(vision.multipleFaceSampleCount > 0 ? ['multiple_face_intervals_excluded'] : []),
          ...(vision.multipleFacesDetected ? ['sustained_multiple_faces_detected'] : []),
          ...(!vision.multiFaceProtectionAvailable ? ['unprotected_intervals_excluded'] : []),
          ...((vision.faceAbsenceSampleCount > 0 || vision.multipleFaceSampleCount > 0 || !vision.multiFaceProtectionAvailable) ? ['identity_continuity_not_established'] : []),
          ...(vision.trackingGapDetected ? ['visual_tracking_gap'] : []),
          ...(vision.timelineTruncated ? ['visual_episode_timeline_capped'] : []),
        ],
      });
      if (vision.timelineTruncated || vision.trackingGapDetected) visionQuality.reliability = 'low';
      for (const episode of vision.multiFaceEpisodes) add({
        family: 'system', metric: 'multiple_faces_detected', startMs: episode.startMs, endMs: episode.endMs, source: SOURCE.faceDetector,
        observation: { value: true, unit: null, qualifiers: ['affected_interval_suppressed', 'no_identity_selection'] },
        eventQuality: quality({ coverage: vision.coverage, sampleCount: episode.sampleCount, provenance: 'observed', limitations: ['sustained_face_count_above_one'] }),
      });
      if (personSpecificAvailable) {
        for (const [metric, value] of [
          ['face_presence', vision.facePresenceRatio],
          ['torso_presence', vision.torsoPresenceRatio],
          ['hand_presence', vision.handPresenceRatio],
          ['camera_facing_proxy', vision.cameraFacingRatio],
          ['framing_center', vision.framingCenteredRatio],
        ]) {
          if (value !== null) add({
            family: signalDefinition(metric).family, metric, source: SOURCE.camera,
            observation: { value: finite(value), unit: 'fraction', qualifiers: metric === 'camera_facing_proxy' ? ['head_orientation_not_gaze'] : [] }, eventQuality: visionQuality,
          });
        }
        add({
          family: 'face', metric: 'head_orientation_proxy', source: SOURCE.camera,
          observation: { value: vision.headOrientationProxy, unit: 'degrees', qualifiers: ['head_orientation_not_gaze'] }, eventQuality: visionQuality,
        });
        add({
          family: 'gesture', metric: 'gesture_zone', source: SOURCE.camera,
          observation: { value: vision.gestureZones, unit: 'frame_counts', qualifiers: ['anatomical_left_right_from_mediapipe_channels'] }, eventQuality: visionQuality,
        });
        for (const episode of vision.episodes.filter((item) => item.metric !== 'observation_gap')) add({
          family: signalDefinition(episode.metric).family,
          metric: episode.metric,
          startMs: episode.startMs,
          endMs: episode.endMs,
          source: SOURCE.camera,
          observation: { value: episode.value, unit: episode.metric === 'lateral_torso_lean' || episode.metric === 'sustained_head_turn_episode' ? 'degrees' : episode.metric === 'facial_movement_episode' ? 'score_change_per_second' : null, qualifiers: episode.reason ? [episode.reason] : [] },
          eventQuality: visionQuality,
        });
      }
      const visualGaps = vision.episodes.filter((item) => item.metric === 'observation_gap');
      if (!personSpecificAvailable && visualGaps.length === 0) add({
        family: 'system', metric: 'observation_gap', source: SOURCE.system,
        observation: { value: 'no_safe_single_face_samples', unit: null, qualifiers: ['person_specific_visual_signals_suppressed'] },
        eventQuality: quality({ available: false, limitations: ['no_safe_single_face_samples'], provenance: 'unresolved' }),
      });
      for (const episode of visualGaps) add({
        family: 'system', metric: 'observation_gap', startMs: episode.startMs, endMs: episode.endMs, source: SOURCE.system,
        observation: { value: episode.value, unit: null, qualifiers: ['vision', ...(episode.reason ? [episode.reason] : [])] },
        eventQuality: quality({ available: false, limitations: [String(episode.value)], provenance: 'unresolved' }),
      });
    } else add({
      family: 'system', metric: 'observation_gap', source: SOURCE.system,
      observation: { value: 'camera_unavailable', unit: null, qualifiers: [] },
      eventQuality: quality({ available: false, limitations: ['camera_unavailable'], provenance: 'unresolved' }),
    });

    descriptors.sort((a, b) => a.startMs - b.startMs || a.endMs - b.endMs || a.metric.localeCompare(b.metric));
    const evidenceOriginMs = mediaAvailable && active.mediaStartedAtMs !== null ? active.mediaStartedAtMs : active.startedAtMs;
    const events = descriptors.map((descriptor, index) => createEvidenceEvent({
      ...descriptor,
      eventId: `${this.sessionId}:${active.answerId}:${String(index + 1).padStart(4, '0')}`,
      sessionId: this.sessionId,
      answerId: active.answerId,
      sequence: index + 1,
      evidenceRef: {
        mediaId: mediaAvailable && active.mediaId ? active.mediaId : null,
        mediaStartMs: Math.max(0, descriptor.startMs - evidenceOriginMs),
        mediaEndMs: Math.max(0, descriptor.endMs - evidenceOriginMs),
        transcriptSegmentIds: [],
      },
    }));
    validateEvidenceTimeline(events, { sessionId: this.sessionId, durationMs: ended.endedAtMs });
    const studentEvents = projectStudentEvents(events);
    const result = Object.freeze({
      schema: SESSION_SCHEMA,
      engineVersion: ANALYTICS_ENGINE_VERSION,
      validationRecordId: VALIDATION_RECORD.id,
      validationManifestSha256: VALIDATION_RECORD.fixtureManifestSha256,
      sessionId: this.sessionId,
      answerId: active.answerId,
      startedAtMs: active.startedAtMs,
      endedAtMs: ended.endedAtMs,
      durationMs: ended.durationMs,
      mediaTimelineDurationMs: mediaAvailable ? Math.max(0, ended.endedAtMs - evidenceOriginMs) : null,
      modalities: Object.freeze({
        mic: Object.freeze({ available: active.hasMic, coverage: audio?.coverage ?? 0, frameCount: audio?.frameCount ?? 0 }),
        camera: Object.freeze({
          available: active.hasCamera,
          coverage: vision?.coverage ?? 0,
          frameCount: vision?.frameCount ?? 0,
          analyzableFrames: vision?.analyzableFrames ?? 0,
          personSpecificCoverage: vision?.personSpecificCoverage ?? 0,
          personSpecificSampleCount: vision?.personSpecificSampleCount ?? 0,
        }),
      }),
      performance: Object.freeze({ visualInferenceP95Ms: finite(vision?.inferenceP95Ms, 2) }),
      events: Object.freeze(events),
      studentEvents: Object.freeze(studentEvents),
      privacy: Object.freeze({ rawAudioStored: false, rawFramesStored: false, rawLandmarksStored: false, externalAnalyticsCalls: false, blockedExternalAttemptCount: Math.max(0, Math.round(Number(blockedExternalAttemptCount) || 0)) }),
    });
    serializeAnalyticsEnvelope(result);
    this.active = null;
    return result;
    } catch (error) {
      this.audio.reset();
      this.vision.reset();
      this.active = null;
      throw error;
    }
  }

  abandonAnswer() {
    if (!this.active) return false;
    this.audio.reset();
    this.vision.reset();
    this.active = null;
    return true;
  }
}
