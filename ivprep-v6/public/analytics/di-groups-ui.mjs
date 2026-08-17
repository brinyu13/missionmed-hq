// Hierarchical Delivery Intelligence groups — the Flight Recorder ontology.
//
// Y1-Y2-CAM-V6-3505. FACE was a single lane while the engine now produces ten
// cartridges, and real F0 existed with nowhere to render. This panel is the visible
// surface for both: collapsible groups with per-lane show/hide and solo, in the
// GarageBand idiom, mounted alongside the existing cockpit rather than replacing it.
//
// LAWS THIS FILE ENFORCES
//
//  * Display state never controls measurement state. Collapsing a group or hiding a
//    lane changes rendering only; the engine keeps measuring. There is no code path
//    from a toggle to the pipeline.
//  * Fail closed and say so. A lane whose engine reports UNAVAILABLE renders the word
//    UNAVAILABLE with its reason. Nothing is interpolated, defaulted or blanked to
//    zero, because a zero reads as a measurement.
//  * Claim-safe vocabulary only. Lane labels are observational geometry, never affect.
//  * Pitch is speaker-relative. Semitones against the speaker's own median. No
//    universal target Hz is displayed anywhere, and no lane is coloured "good".
//  * Not every lane is open by default. Students see a small default set; the rest is
//    available on demand and to Mentor/Admin.

const UNAVAILABLE = 'UNAVAILABLE';

/**
 * Group and lane definitions. `open` controls the DEFAULT disclosure state only -
 * a closed group is still measured.
 */
export const DI_GROUPS = Object.freeze([
  Object.freeze({
    id: 'VOICE', label: 'Voice', open: true,
    lanes: Object.freeze([
      Object.freeze({ id: 'VOICE.VOLUME', label: 'Volume', defaultOn: true }),
      Object.freeze({ id: 'VOICE.VOLUME_VARIATION', label: 'Volume variation', defaultOn: true }),
      Object.freeze({ id: 'VOICE.PITCH', label: 'Pitch', defaultOn: true }),
      Object.freeze({ id: 'VOICE.PITCH_VARIATION', label: 'Pitch variation', defaultOn: true }),
      Object.freeze({ id: 'VOICE.PITCH_RANGE', label: 'Pitch range', defaultOn: false }),
      Object.freeze({ id: 'VOICE.PAUSE', label: 'Pause', defaultOn: true }),
    ]),
  }),
  Object.freeze({
    id: 'FACE', label: 'Face', open: true,
    lanes: Object.freeze([
      Object.freeze({ id: 'FACE.SMILE', label: 'Mouth-corner elevation', defaultOn: true }),
      Object.freeze({ id: 'FACE.MOUTH_MOVEMENT', label: 'Mouth movement', defaultOn: true }),
      Object.freeze({ id: 'FACE.EYE_APERTURE', label: 'Eye aperture', defaultOn: false }),
      Object.freeze({ id: 'FACE.BLINK', label: 'Blink', defaultOn: false }),
      Object.freeze({ id: 'FACE.BROW', label: 'Brow movement', defaultOn: false }),
      Object.freeze({ id: 'FACE.PERIOCULAR', label: 'Periocular contraction', defaultOn: false }),
      Object.freeze({ id: 'FACE.GAZE', label: 'Gaze proxy', defaultOn: true }),
      Object.freeze({ id: 'FACE.CAMERA_DWELL', label: 'Camera-facing dwell', defaultOn: true }),
      Object.freeze({ id: 'FACE.GAZE_SHIFT', label: 'Gaze shifts', defaultOn: false }),
      Object.freeze({ id: 'FACE.MOVEMENT_VARIABILITY', label: 'Movement variability', defaultOn: false }),
    ]),
  }),
  Object.freeze({
    id: 'HANDS', label: 'Hands', open: false,
    lanes: Object.freeze([
      Object.freeze({ id: 'HANDS.LEFT', label: 'Left hand', defaultOn: true }),
      Object.freeze({ id: 'HANDS.RIGHT', label: 'Right hand', defaultOn: true }),
      Object.freeze({ id: 'HANDS.ZONE', label: 'Gesture zone', defaultOn: false }),
    ]),
  }),
  Object.freeze({
    id: 'BODY', label: 'Body', open: false,
    lanes: Object.freeze([
      Object.freeze({ id: 'BODY.YAW', label: 'Head yaw', defaultOn: true }),
      Object.freeze({ id: 'BODY.PITCH', label: 'Head pitch', defaultOn: false }),
      Object.freeze({ id: 'BODY.ROLL', label: 'Head roll', defaultOn: false }),
      Object.freeze({ id: 'BODY.LEAN', label: 'Torso lean', defaultOn: true }),
      Object.freeze({ id: 'BODY.FRAMING', label: 'Camera framing', defaultOn: true }),
    ]),
  }),
]);

const fixed = (value, digits = 2) => (Number.isFinite(value) ? value.toFixed(digits) : null);

/** Pitch, expressed speaker-relative. Never an absolute target. */
export function pitchLaneReadouts(pitch) {
  const summary = pitch?.summary;
  if (!summary?.available) {
    const reason = summary?.reason === 'INSUFFICIENT_VOICED_AUDIO'
      ? 'UNAVAILABLE — KEEP SPEAKING TO ESTABLISH YOUR RANGE'
      : 'UNAVAILABLE — NO VALIDATED F0 INPUT';
    return Object.freeze({
      'VOICE.PITCH': reason,
      'VOICE.PITCH_VARIATION': UNAVAILABLE,
      'VOICE.PITCH_RANGE': UNAVAILABLE,
    });
  }
  // Live register relative to the speaker's own median, in semitones.
  const offset = pitch.voiced && Number.isFinite(pitch.f0Hz) && Number.isFinite(summary.medianHz)
    ? 12 * Math.log2(pitch.f0Hz / summary.medianHz)
    : null;
  const register = offset === null
    ? 'UNVOICED'
    : `${offset >= 0 ? '+' : ''}${fixed(offset, 1)} st vs your median`;
  return Object.freeze({
    'VOICE.PITCH': `${register} · median ${Math.round(summary.medianHz)} Hz`,
    'VOICE.PITCH_VARIATION': `${fixed(summary.variationSemitones, 2)} st`,
    'VOICE.PITCH_RANGE': `${fixed(summary.rangeSemitones, 1)} st (${Math.round(summary.minHz)}–${Math.round(summary.maxHz)} Hz)`,
  });
}

/** FACE lanes, each honouring its own availability. */
export function faceLaneReadouts(faceFamily) {
  if (!faceFamily?.available) {
    const readouts = {};
    for (const lane of DI_GROUPS.find((g) => g.id === 'FACE').lanes) {
      readouts[lane.id] = faceFamily?.reason === 'NO_FACE_BLENDSHAPES'
        ? 'UNAVAILABLE — NO FACE IN FRAME'
        : UNAVAILABLE;
    }
    return Object.freeze(readouts);
  }

  const value = (id, render) => {
    const cartridge = faceFamily[id];
    if (!cartridge || cartridge.availability === 'UNAVAILABLE') return UNAVAILABLE;
    const text = render(cartridge);
    return text === null ? UNAVAILABLE : (cartridge.availability === 'PARTIAL' ? `${text} · PARTIAL` : text);
  };

  const dwell = faceFamily.cameraDwell;
  const shifts = faceFamily.gazeShifts;
  const variability = faceFamily.movementVariability;

  return Object.freeze({
    'FACE.SMILE': value('FACE.SMILE', (c) => `${fixed(c.bilateral)}${c.active ? ' · ACTIVE' : ''} · symmetry ${fixed(c.symmetry)}`),
    'FACE.MOUTH_MOVEMENT': value('FACE.MOUTH_MOVEMENT', (c) => `open ${fixed(c.jawOpen)}`),
    'FACE.EYE_APERTURE': value('FACE.EYE_APERTURE', (c) => (c.changeFromBaseline === null
      ? `${fixed(c.bilateral)} (no baseline yet)`
      : `${fixed(c.bilateral)} · ${c.changeFromBaseline >= 0 ? '+' : ''}${fixed(c.changeFromBaseline)} vs your baseline`)),
    'FACE.BLINK': value('FACE.BLINK', (c) => `${c.count} events`),
    'FACE.BROW': value('FACE.BROW', (c) => `${fixed(c.magnitude)}${c.active ? ' · ACTIVE' : ''}`),
    'FACE.PERIOCULAR': value('FACE.PERIOCULAR', (c) => `${fixed(c.bilateral)}${c.active ? ' · ACTIVE' : ''}`),
    'FACE.GAZE': value('FACE.GAZE', (c) => `${c.cameraFacing ? 'CAMERA-FACING' : 'OFF-CENTRE'} · h ${fixed(c.horizontal)}`),
    // No target is rendered. Dwell is a distribution, not a score.
    'FACE.CAMERA_DWELL': dwell?.available
      ? `${Math.round(dwell.cameraFacingRatio * 100)}% facing · longest ${(dwell.longestFacingRunMs / 1000).toFixed(1)}s · ${dwell.gazeReleases} releases`
      : UNAVAILABLE,
    'FACE.GAZE_SHIFT': Array.isArray(shifts) && shifts.length
      ? `${shifts.length} shifts · last ${shifts.at(-1).from}→${shifts.at(-1).to}`
      : (Array.isArray(shifts) ? '0 shifts' : UNAVAILABLE),
    'FACE.MOVEMENT_VARIABILITY': variability?.available
      ? `${fixed(variability.value, 3)} · coverage ${Math.round(variability.coverage * 100)}%`
      : UNAVAILABLE,
  });
}

/** Voice level/pause lanes from the existing audio diagnostic. */
export function voiceLaneReadouts(audio) {
  if (!audio?.available) {
    return Object.freeze({
      'VOICE.VOLUME': UNAVAILABLE, 'VOICE.VOLUME_VARIATION': UNAVAILABLE, 'VOICE.PAUSE': UNAVAILABLE,
    });
  }
  return Object.freeze({
    'VOICE.VOLUME': Number.isFinite(audio.capturedLevelDbfs) ? `${fixed(audio.capturedLevelDbfs, 1)} dBFS` : UNAVAILABLE,
    'VOICE.VOLUME_VARIATION': Number.isFinite(audio.energyVariationDb) ? `${fixed(audio.energyVariationDb, 1)} dB` : UNAVAILABLE,
    'VOICE.PAUSE': audio.speaking ? 'SPEAKING' : `PAUSE ${((audio.pauseInProgressMs || 0) / 1000).toFixed(1)}s`,
  });
}

/** Hands/body lanes from the existing vision geometry. */
export function bodyLaneReadouts(geometry) {
  if (!geometry) {
    const out = {};
    for (const id of ['HANDS.LEFT', 'HANDS.RIGHT', 'HANDS.ZONE', 'BODY.YAW', 'BODY.PITCH', 'BODY.ROLL', 'BODY.LEAN', 'BODY.FRAMING']) out[id] = UNAVAILABLE;
    return Object.freeze(out);
  }
  const head = geometry.face || {};
  const pose = geometry.pose || {};
  const hands = geometry.hands || {};
  const deg = (v) => (Number.isFinite(v) ? `${fixed(v, 1)}°` : UNAVAILABLE);
  return Object.freeze({
    'HANDS.LEFT': hands.left?.present ? `TRACKED · ${hands.left.zone ?? 'zone unavailable'}` : 'NOT IN FRAME',
    'HANDS.RIGHT': hands.right?.present ? `TRACKED · ${hands.right.zone ?? 'zone unavailable'}` : 'NOT IN FRAME',
    'HANDS.ZONE': hands.left?.zone || hands.right?.zone || UNAVAILABLE,
    'BODY.YAW': deg(head.yawDeg),
    'BODY.PITCH': deg(head.pitchDeg),
    'BODY.ROLL': deg(head.rollDeg),
    'BODY.LEAN': pose.torsoPresent ? deg(pose.lateralLeanDeg) : 'TORSO UNAVAILABLE',
    'BODY.FRAMING': Number.isFinite(geometry.framingCenter) ? fixed(geometry.framingCenter) : (head.present ? 'IN FRAME' : UNAVAILABLE),
  });
}

/**
 * Collapsible group panel. Pure DOM, no framework, mounts into any container.
 *
 * `visibility` and `solo` are presentation state held here and nowhere else, which is
 * what structurally guarantees the display-does-not-control-measurement law.
 */
export class DeliveryIntelligenceGroups {
  #root;
  #open = new Map();
  #visible = new Map();
  #solo = null;
  #laneValueNodes = new Map();
  #readouts = {};

  constructor(root, { document: doc = globalThis.document } = {}) {
    if (!root) throw new TypeError('A container element is required.');
    this.#root = root;
    this.doc = doc;
    for (const group of DI_GROUPS) {
      this.#open.set(group.id, group.open);
      for (const lane of group.lanes) this.#visible.set(lane.id, lane.defaultOn);
    }
    this.#build();
  }

  #build() {
    this.#root.replaceChildren();
    this.#root.className = 'di-groups';
    for (const group of DI_GROUPS) {
      const section = this.doc.createElement('section');
      section.className = 'di-group';
      section.dataset.group = group.id;

      const header = this.doc.createElement('button');
      header.type = 'button';
      header.className = 'di-group-header';
      header.setAttribute('aria-expanded', String(this.#open.get(group.id)));
      header.dataset.groupToggle = group.id;
      header.textContent = `${this.#open.get(group.id) ? '▼' : '▶'} ${group.label.toUpperCase()}`;
      header.addEventListener('click', () => this.toggleGroup(group.id));
      section.append(header);

      const list = this.doc.createElement('div');
      list.className = 'di-lanes';
      list.dataset.groupLanes = group.id;
      list.hidden = !this.#open.get(group.id);

      for (const lane of group.lanes) {
        const row = this.doc.createElement('div');
        row.className = 'di-lane';
        row.dataset.lane = lane.id;

        const eye = this.doc.createElement('button');
        eye.type = 'button';
        eye.className = 'di-lane-eye';
        eye.dataset.laneEye = lane.id;
        eye.setAttribute('aria-pressed', String(this.#visible.get(lane.id)));
        eye.setAttribute('aria-label', `Show or hide ${lane.label}`);
        eye.textContent = this.#visible.get(lane.id) ? '👁' : '–';
        eye.addEventListener('click', () => this.toggleLane(lane.id));

        const solo = this.doc.createElement('button');
        solo.type = 'button';
        solo.className = 'di-lane-solo';
        solo.dataset.laneSolo = lane.id;
        solo.setAttribute('aria-pressed', 'false');
        solo.setAttribute('aria-label', `Solo ${lane.label}`);
        solo.textContent = 'S';
        solo.addEventListener('click', () => this.toggleSolo(lane.id));

        const label = this.doc.createElement('span');
        label.className = 'di-lane-label';
        label.textContent = lane.label;

        const value = this.doc.createElement('span');
        value.className = 'di-lane-value';
        value.dataset.laneValue = lane.id;
        value.textContent = UNAVAILABLE;
        this.#laneValueNodes.set(lane.id, value);

        row.append(eye, solo, label, value);
        list.append(row);
      }
      section.append(list);
      this.#root.append(section);
    }
    this.#applyVisibility();
  }

  toggleGroup(groupId) {
    this.#open.set(groupId, !this.#open.get(groupId));
    const group = DI_GROUPS.find((g) => g.id === groupId);
    const header = this.#root.querySelector(`[data-group-toggle="${groupId}"]`);
    const lanes = this.#root.querySelector(`[data-group-lanes="${groupId}"]`);
    if (header) {
      header.setAttribute('aria-expanded', String(this.#open.get(groupId)));
      header.textContent = `${this.#open.get(groupId) ? '▼' : '▶'} ${group.label.toUpperCase()}`;
    }
    if (lanes) lanes.hidden = !this.#open.get(groupId);
    return this;
  }

  toggleLane(laneId) {
    this.#visible.set(laneId, !this.#visible.get(laneId));
    this.#applyVisibility();
    return this;
  }

  toggleSolo(laneId) {
    this.#solo = this.#solo === laneId ? null : laneId;
    this.#applyVisibility();
    return this;
  }

  get soloLane() { return this.#solo; }

  isLaneVisible(laneId) {
    if (this.#solo) return this.#solo === laneId;
    return this.#visible.get(laneId) === true;
  }

  #applyVisibility() {
    for (const group of DI_GROUPS) {
      for (const lane of group.lanes) {
        const row = this.#root.querySelector(`[data-lane="${lane.id}"]`);
        if (row) row.dataset.hidden = String(!this.isLaneVisible(lane.id));
        const eye = this.#root.querySelector(`[data-lane-eye="${lane.id}"]`);
        if (eye) {
          eye.setAttribute('aria-pressed', String(this.#visible.get(lane.id)));
          eye.textContent = this.#visible.get(lane.id) ? '👁' : '–';
        }
        const solo = this.#root.querySelector(`[data-lane-solo="${lane.id}"]`);
        if (solo) solo.setAttribute('aria-pressed', String(this.#solo === lane.id));
      }
    }
  }

  /**
   * Push a diagnostic frame. Accepts the audio and vision diagnostics the pipeline
   * already dispatches; unknown modalities are ignored.
   *
   * Rendering is the ONLY thing this does. There is deliberately no path from here
   * back into the pipeline, so measurement continues regardless of what is displayed.
   */
  ingest(detail = {}) {
    if (detail.modality === 'audio') {
      this.#readouts = { ...this.#readouts, ...voiceLaneReadouts(detail), ...pitchLaneReadouts(detail.pitch) };
    } else if (detail.modality === 'vision') {
      this.#readouts = { ...this.#readouts, ...faceLaneReadouts(detail.faceFamily), ...bodyLaneReadouts(detail.geometry) };
    } else {
      return this;
    }
    for (const [laneId, node] of this.#laneValueNodes) {
      const text = this.#readouts[laneId];
      if (typeof text === 'string') node.textContent = text;
    }
    return this;
  }

  get readouts() { return Object.freeze({ ...this.#readouts }); }
}
