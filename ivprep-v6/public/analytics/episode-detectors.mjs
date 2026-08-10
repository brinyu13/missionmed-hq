function distance(a, b) {
  if (!a || !b || !Number.isFinite(a.x) || !Number.isFinite(b.x)) return null;
  return Math.hypot(a.x - b.x, a.y - b.y);
}

class EpisodeTracker {
  constructor({ metric, minimumMs = 500, releaseMs = 300 } = {}) {
    this.metric = metric;
    this.minimumMs = minimumMs;
    this.releaseMs = releaseMs;
    this.activeAt = null;
    this.lastTrueAt = null;
    this.value = null;
    this.episodes = [];
    this.droppedEpisodes = 0;
  }

  update(atMs, active, value = true) {
    if (active) {
      if (this.activeAt === null) this.activeAt = atMs;
      this.lastTrueAt = atMs;
      this.value = value;
      return;
    }
    if (this.activeAt !== null && this.lastTrueAt !== null && atMs - this.lastTrueAt >= this.releaseMs) this.close(this.lastTrueAt);
  }

  close(atMs, reason = null) {
    if (this.activeAt === null) return;
    const endMs = Math.max(this.activeAt, atMs);
    if (endMs - this.activeAt >= this.minimumMs) {
      if (this.episodes.length < 40) this.episodes.push({ metric: this.metric, startMs: this.activeAt, endMs, value: this.value, reason });
      else this.droppedEpisodes += 1;
    }
    this.activeAt = null;
    this.lastTrueAt = null;
    this.value = null;
  }
}

export class VisionEpisodeAnalyzer {
  constructor() {
    this.reset();
  }

  reset() {
    this.startedAtMs = null;
    this.lastAtMs = null;
    this.frames = 0;
    this.analyzableFrames = 0;
    this.faceFrames = 0;
    this.poseFrames = 0;
    this.handFrames = 0;
    this.multiFaceFrames = 0;
    this.multiFaceProtectionUnavailableFrames = 0;
    this.personSpecificFrames = 0;
    this.facingFrames = 0;
    this.centeredFrames = 0;
    this.priorHands = { left: null, right: null };
    this.trackers = {
      handLeft: new EpisodeTracker({ metric: 'hand_motion_episode', minimumMs: 300, releaseMs: 250 }),
      handRight: new EpisodeTracker({ metric: 'hand_motion_episode', minimumMs: 300, releaseMs: 250 }),
      handBoth: new EpisodeTracker({ metric: 'hand_motion_episode', minimumMs: 300, releaseMs: 250 }),
      lean: new EpisodeTracker({ metric: 'lateral_torso_lean', minimumMs: 750, releaseMs: 500 }),
      sway: new EpisodeTracker({ metric: 'body_sway_episode', minimumMs: 1_000, releaseMs: 500 }),
      turned: new EpisodeTracker({ metric: 'sustained_head_turn_episode', minimumMs: 750, releaseMs: 500 }),
      faceMove: new EpisodeTracker({ metric: 'facial_movement_episode', minimumMs: 300, releaseMs: 300 }),
    };
    this.lastPoseCenterX = null;
    this.lastPoseDirection = 0;
    this.swayChanges = [];
    this.gaps = [];
    this.droppedGaps = 0;
    this.inferenceMs = [];
    this.cadenceMs = [];
    this.headSamples = [];
    this.gestureZones = { left: {}, right: {} };
  }

  begin(startedAtMs) {
    if (!Number.isFinite(startedAtMs)) throw new TypeError('Vision start timestamp must be finite.');
    this.reset();
    this.startedAtMs = Math.round(startedAtMs);
  }

  gap(startMs, endMs, reason) {
    if (!Number.isFinite(startMs) || !Number.isFinite(endMs)) throw new TypeError('Vision gap timestamps must be finite.');
    if (endMs <= startMs) return;
    for (const tracker of Object.values(this.trackers)) tracker.close(tracker.lastTrueAt ?? startMs, 'tracking_gap');
    this.priorHands = { left: null, right: null };
    this.lastPoseCenterX = null;
    this.lastPoseDirection = 0;
    this.swayChanges = [];
    if (this.gaps.length < 50) this.gaps.push({ metric: 'observation_gap', startMs, endMs, value: reason });
    else this.droppedGaps += 1;
    this.lastAtMs = Math.max(this.lastAtMs ?? this.startedAtMs ?? 0, Math.round(endMs));
  }

  ingest({ atMs, geometry, inferenceMs = null, expectedFrameMs = 125 }) {
    if (this.startedAtMs === null) throw new TypeError('Vision analyzer has not begun.');
    if (!Number.isFinite(atMs) || atMs < this.startedAtMs || (this.lastAtMs !== null && atMs < this.lastAtMs)) throw new TypeError('Vision frame timestamps must be finite and monotonic.');
    const time = Math.round(atMs);
    const priorAtMs = this.lastAtMs;
    const cadence = Number.isFinite(expectedFrameMs) && expectedFrameMs > 0 ? expectedFrameMs : 125;
    this.cadenceMs.push(cadence);
    if (this.cadenceMs.length > 7_200) this.cadenceMs.shift();
    const gapThresholdMs = Math.max(500, cadence * 1.75);
    if (priorAtMs === null && time - this.startedAtMs > gapThresholdMs) this.gap(this.startedAtMs, time, 'visual_startup_gap');
    else if (priorAtMs !== null && time - priorAtMs > gapThresholdMs) this.gap(priorAtMs, time, 'visual_tracking_gap');
    this.lastAtMs = time;
    this.frames += 1;
    if (Number.isFinite(inferenceMs)) this.inferenceMs.push(inferenceMs);
    if (!geometry) return;
    this.analyzableFrames += 1;
    const multiFace = Number.isFinite(geometry.faceCount) && geometry.faceCount > 1;
    if (multiFace) this.multiFaceFrames += 1;
    if (geometry.faceCount === null) this.multiFaceProtectionUnavailableFrames += 1;
    const suppressPerson = multiFace || geometry.faceCount !== 1;
    if (!suppressPerson) this.personSpecificFrames += 1;

    const face = geometry.face || {};
    const pose = geometry.pose || {};
    const hands = geometry.hands || {};
    if (!suppressPerson && face.present) this.faceFrames += 1;
    if (!suppressPerson && pose.torsoPresent) this.poseFrames += 1;
    if (!suppressPerson && (hands.left?.present || hands.right?.present)) this.handFrames += 1;

    if (!suppressPerson && face.present) {
      this.headSamples.push({ yaw: face.yawProxyDeg, pitch: face.pitchProxyDeg, roll: face.rollProxyDeg });
      const facing = Math.abs(face.yawProxyDeg || 0) <= 20 && Math.abs(face.pitchProxyDeg || 0) <= 15 && Math.abs(face.rollProxyDeg || 0) <= 15;
      if (facing) this.facingFrames += 1;
      const box = face.box;
      const centered = box && box.centerX >= 0.3 && box.centerX <= 0.7 && box.centerY >= 0.2 && box.centerY <= 0.65 && box.width >= 0.12;
      if (centered) this.centeredFrames += 1;
      this.trackers.turned.update(time, !facing, { facing: false, yawProxyDeg: face.yawProxyDeg, pitchProxyDeg: face.pitchProxyDeg, rollProxyDeg: face.rollProxyDeg });
      this.trackers.faceMove.update(time, Number(face.movementRatePerSecond) >= 0.64, face.movementRatePerSecond);
    } else {
      this.trackers.turned.update(time, false);
      this.trackers.faceMove.update(time, false);
    }

    if (!suppressPerson && pose.torsoPresent) {
      const lean = Number(pose.lateralLeanDeg) || 0;
      this.trackers.lean.update(time, Math.abs(lean) >= 12, { degrees: lean, direction: lean < 0 ? 'left' : 'right' });
      if (this.lastPoseCenterX !== null) {
        const delta = pose.centerX - this.lastPoseCenterX;
        const direction = Math.abs(delta) >= 0.012 ? Math.sign(delta) : 0;
        if (direction && this.lastPoseDirection && direction !== this.lastPoseDirection) this.swayChanges.push(time);
        if (direction) this.lastPoseDirection = direction;
        this.swayChanges = this.swayChanges.filter((value) => time - value <= 2_000);
        this.trackers.sway.update(time, this.swayChanges.length >= 3, { directionChanges: this.swayChanges.length });
      }
      this.lastPoseCenterX = pose.centerX;
    } else {
      this.trackers.lean.update(time, false);
      this.trackers.sway.update(time, false);
    }

    const movingSides = [];
    for (const side of ['left', 'right']) {
      const current = hands[side]?.present ? { x: hands[side].wristX, y: hands[side].wristY, atMs: time } : null;
      const prior = this.priorHands[side];
      const moved = distance(current, prior);
      const seconds = prior ? Math.max((time - prior.atMs) / 1_000, 0.001) : null;
      const shoulderScale = Math.max(Number(pose.shoulderWidth) || 0.2, 0.05);
      const speed = moved !== null && seconds ? moved / seconds / shoulderScale : null;
      if (!suppressPerson && speed !== null && speed >= 1.4) movingSides.push(side);
      if (!suppressPerson && hands[side]?.present && hands[side].zone) {
        const zone = hands[side].zone;
        this.gestureZones[side][zone] = (this.gestureZones[side][zone] || 0) + 1;
      }
      this.priorHands[side] = current;
    }
    this.trackers.handLeft.update(time, movingSides.includes('left'), { hands: 'left', leftZone: hands.left?.zone || 'unresolved', rightZone: null });
    this.trackers.handRight.update(time, movingSides.includes('right'), { hands: 'right', leftZone: null, rightZone: hands.right?.zone || 'unresolved' });
    this.trackers.handBoth.update(time, movingSides.length === 2, { hands: 'both', leftZone: hands.left?.zone || 'unresolved', rightZone: hands.right?.zone || 'unresolved' });
  }

  finish(endedAtMs) {
    if (this.startedAtMs === null) throw new TypeError('Vision analyzer has not begun.');
    if (!Number.isFinite(endedAtMs) || endedAtMs < this.startedAtMs || (this.lastAtMs !== null && endedAtMs < this.lastAtMs)) throw new TypeError('Vision end timestamp must be finite and monotonic.');
    const end = Math.round(endedAtMs);
    const sortedCadence = [...this.cadenceMs].sort((a, b) => a - b);
    const representativeCadence = sortedCadence.length ? sortedCadence[Math.floor(sortedCadence.length / 2)] : 125;
    if (this.lastAtMs !== null && end - this.lastAtMs > Math.max(500, representativeCadence * 1.75)) this.gap(this.lastAtMs, end, 'visual_trailing_gap');
    for (const tracker of Object.values(this.trackers)) tracker.close(tracker.lastTrueAt ?? end, 'answer_end');
    const durationMs = end - (this.startedAtMs ?? end);
    const expectedFrames = Math.max(1, durationMs / representativeCadence);
    const coverage = Math.min(1, this.analyzableFrames / expectedFrames);
    const episodes = Object.values(this.trackers).flatMap((tracker) => tracker.episodes).concat(this.gaps).sort((a, b) => a.startMs - b.startMs);
    const sortedInference = [...this.inferenceMs].sort((a, b) => a - b);
    const droppedEpisodes = Object.values(this.trackers).reduce((sum, tracker) => sum + tracker.droppedEpisodes, 0);
    const averageHead = (axis) => {
      const values = this.headSamples.map((sample) => sample[axis]).filter(Number.isFinite);
      return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
    };
    const result = {
      durationMs,
      coverage: Number(coverage.toFixed(4)),
      frameCount: this.frames,
      analyzableFrames: this.analyzableFrames,
      facePresenceRatio: this.analyzableFrames ? this.faceFrames / this.analyzableFrames : null,
      torsoPresenceRatio: this.analyzableFrames ? this.poseFrames / this.analyzableFrames : null,
      handPresenceRatio: this.analyzableFrames ? this.handFrames / this.analyzableFrames : null,
      cameraFacingRatio: this.faceFrames ? this.facingFrames / this.faceFrames : null,
      framingCenteredRatio: this.faceFrames ? this.centeredFrames / this.faceFrames : null,
      multipleFacesDetected: this.multiFaceFrames > 0,
      multiFaceProtectionAvailable: this.frames > 0 && this.multiFaceProtectionUnavailableFrames === 0,
      personSpecificAvailable: this.personSpecificFrames > 0 && this.multiFaceProtectionUnavailableFrames === 0 && this.multiFaceFrames === 0,
      headOrientationProxy: { yawDeg: averageHead('yaw'), pitchDeg: averageHead('pitch'), rollDeg: averageHead('roll') },
      gestureZones: this.gestureZones,
      episodes,
      droppedEpisodes,
      droppedGaps: this.droppedGaps,
      timelineTruncated: droppedEpisodes > 0 || this.droppedGaps > 0,
      trackingGapDetected: this.gaps.length > 0 || this.droppedGaps > 0,
      inferenceP95Ms: sortedInference.length ? sortedInference[Math.max(0, Math.ceil(sortedInference.length * 0.95) - 1)] : null,
    };
    this.reset();
    return result;
  }
}
