// Y1-Y2-CAM-V6-3521 — presentation-only visibility state.
//
// This module deliberately knows nothing about media, detectors, projectors, sessions,
// or persistence of analytics evidence. It stores only an allowlisted set of visual IDs.

export const VISIBILITY_STORAGE_KEY = 'missionmed.ivprep.live-analytics.visibility.v1';

export const ANALYTICS_FAMILIES = Object.freeze({
  'head-face': Object.freeze([
    'head-face.region-status',
    'head-face.smile-pattern',
    'head-face.smile-events',
    'head-face.camera-facing-balance',
    'head-face.blink-rate',
    'head-face.speaking-pace',
    'head-face.head-nods',
    'head-face.geometry-trend',
  ]),
  'body-posture': Object.freeze([
    'body-posture.wireframe',
    'body-posture.alignment',
    'body-posture.in-frame',
    'body-posture.hands-visible',
    'body-posture.gesture-activity',
    'body-posture.movement-level',
    'body-posture.repetitive-movement',
    'body-posture.notes-detection',
    'body-posture.movement-trend',
    'body-posture.notes-confidence',
  ]),
  'voice-delivery': Object.freeze([
    'voice-delivery.volume',
    'voice-delivery.speaking-speed',
    'voice-delivery.volume-modulation',
    'voice-delivery.pitch',
  ]),
});

export const ANALYTICS_METRIC_IDS = Object.freeze(Object.values(ANALYTICS_FAMILIES).flat());
export const MINIMAL_ANALYTICS_METRICS = Object.freeze([
  'head-face.camera-facing-balance',
  'voice-delivery.volume',
]);
export const ANALYTICS_PRESETS = Object.freeze(['full', 'custom', 'minimal', 'interview']);
const ALLOWED = new Set(ANALYTICS_METRIC_IDS);

const LEGACY_MODULE_METRIC = Object.freeze({
  'head-face': ANALYTICS_FAMILIES['head-face'],
  body: ANALYTICS_FAMILIES['body-posture'],
  volume: ['voice-delivery.volume'],
  speed: ['voice-delivery.speaking-speed'],
  modulation: ['voice-delivery.volume-modulation'],
  pitch: ['voice-delivery.pitch'],
});

function ordered(values) {
  const set = values instanceof Set ? values : new Set(values);
  return ANALYTICS_METRIC_IDS.filter((id) => set.has(id));
}

function frozenSnapshot(preset, visible) {
  const visibleMetricIds = Object.freeze(ordered(visible));
  const hiddenMetricIds = Object.freeze(ANALYTICS_METRIC_IDS.filter((id) => !visible.has(id)));
  const familyState = Object.freeze(Object.fromEntries(Object.entries(ANALYTICS_FAMILIES).map(([family, ids]) => {
    const count = ids.filter((id) => visible.has(id)).length;
    return [family, count === 0 ? 'off' : count === ids.length ? 'on' : 'mixed'];
  })));
  const legacyVisible = Object.freeze(Object.entries(LEGACY_MODULE_METRIC)
    .filter(([, ids]) => ids.some((id) => visible.has(id)))
    .map(([name]) => name));
  const legacyHidden = Object.freeze(Object.keys(LEGACY_MODULE_METRIC).filter((name) => !legacyVisible.includes(name)));
  return Object.freeze({
    preset,
    mode: preset === 'interview' ? 'interview' : 'coaching',
    visibleMetricIds,
    hiddenMetricIds,
    familyState,
    visible: legacyVisible,
    hidden: legacyHidden,
  });
}

function safeStorage(candidate) {
  if (!candidate || typeof candidate.getItem !== 'function' || typeof candidate.setItem !== 'function') return null;
  return candidate;
}

function defaultStorage() {
  try { return globalThis.localStorage; } catch { return null; }
}

export class AnalyticsVisibilityState {
  constructor({ preset = 'minimal', storage } = {}) {
    if (!ANALYTICS_PRESETS.includes(preset)) throw new TypeError('Unknown analytics visibility preset.');
    this.storage = safeStorage(storage === undefined ? defaultStorage() : storage);
    this.savedCustom = this.#loadCustom();
    this.rememberedFamilies = new Map();
    this.preInterviewPreset = null;
    this.preset = preset;
    this.visible = this.#setForPreset(preset);
  }

  #loadCustom() {
    if (!this.storage) return new Set(MINIMAL_ANALYTICS_METRICS);
    try {
      const raw = this.storage.getItem(VISIBILITY_STORAGE_KEY);
      if (!raw || raw.length > 10_000) return new Set(MINIMAL_ANALYTICS_METRICS);
      const parsed = JSON.parse(raw);
      if (parsed?.version !== 1 || !Array.isArray(parsed.visibleMetricIds)) return new Set(MINIMAL_ANALYTICS_METRICS);
      const values = parsed.visibleMetricIds.filter((id) => typeof id === 'string' && ALLOWED.has(id));
      if (values.length !== parsed.visibleMetricIds.length) return new Set(MINIMAL_ANALYTICS_METRICS);
      return new Set(values);
    } catch {
      return new Set(MINIMAL_ANALYTICS_METRICS);
    }
  }

  #persist() {
    if (!this.storage) return false;
    try {
      this.storage.setItem(VISIBILITY_STORAGE_KEY, JSON.stringify({
        version: 1,
        visibleMetricIds: ordered(this.savedCustom),
      }));
      return true;
    } catch {
      return false;
    }
  }

  #setForPreset(preset) {
    if (preset === 'full') return new Set(ANALYTICS_METRIC_IDS);
    if (preset === 'custom') return new Set(this.savedCustom);
    if (preset === 'minimal') return new Set(MINIMAL_ANALYTICS_METRICS);
    return new Set();
  }

  #assertMetric(id) {
    if (!ALLOWED.has(id)) throw new TypeError(`Unknown analytics metric: ${id}`);
  }

  #assertFamily(id) {
    if (!Object.hasOwn(ANALYTICS_FAMILIES, id)) throw new TypeError(`Unknown analytics family: ${id}`);
  }

  #becomeCustom() {
    this.preset = 'custom';
    this.savedCustom = new Set(this.visible);
    this.#persist();
  }

  selectPreset(preset) {
    if (!ANALYTICS_PRESETS.includes(preset)) throw new TypeError('Unknown analytics visibility preset.');
    this.preset = preset;
    this.visible = this.#setForPreset(preset);
    return this.snapshot();
  }

  setMetricVisible(id, visible) {
    this.#assertMetric(id);
    if (visible) this.visible.add(id);
    else this.visible.delete(id);
    this.#becomeCustom();
    return this.snapshot();
  }

  toggleMetric(id) {
    this.#assertMetric(id);
    return this.setMetricVisible(id, !this.visible.has(id));
  }

  setFamilyVisible(family, visible) {
    this.#assertFamily(family);
    const ids = ANALYTICS_FAMILIES[family];
    if (!visible) {
      const subset = ids.filter((id) => this.visible.has(id));
      if (subset.length) this.rememberedFamilies.set(family, subset);
      ids.forEach((id) => this.visible.delete(id));
    } else {
      const subset = this.rememberedFamilies.get(family);
      (subset?.length ? subset : ids).forEach((id) => this.visible.add(id));
    }
    this.#becomeCustom();
    return this.snapshot();
  }

  toggleFamily(family) {
    const state = this.familyState(family);
    return this.setFamilyVisible(family, state === 'off');
  }

  familyState(family) {
    this.#assertFamily(family);
    const ids = ANALYTICS_FAMILIES[family];
    const count = ids.filter((id) => this.visible.has(id)).length;
    return count === 0 ? 'off' : count === ids.length ? 'on' : 'mixed';
  }

  resetCustom() {
    this.savedCustom = new Set(MINIMAL_ANALYTICS_METRICS);
    this.rememberedFamilies.clear();
    try { this.storage?.removeItem?.(VISIBILITY_STORAGE_KEY); } catch {}
    this.preset = 'minimal';
    this.visible = new Set(MINIMAL_ANALYTICS_METRICS);
    return this.snapshot();
  }

  // Compatibility seams for the original six-module runtime contract.
  setMode(mode) {
    if (mode === 'interview') {
      if (this.preset !== 'interview') this.preInterviewPreset = this.preset;
      return this.selectPreset('interview');
    }
    const restore = this.preInterviewPreset && this.preInterviewPreset !== 'interview'
      ? this.preInterviewPreset
      : 'full';
    this.preInterviewPreset = null;
    return this.selectPreset(restore);
  }
  setModuleVisible(name, visible) {
    const ids = LEGACY_MODULE_METRIC[name];
    if (!ids) throw new TypeError(`Unknown analytics module: ${name}`);
    if (name === 'head-face') return this.setFamilyVisible('head-face', visible);
    if (name === 'body') return this.setFamilyVisible('body-posture', visible);
    return this.setMetricVisible(ids[0], visible);
  }
  toggleModule(name) {
    const ids = LEGACY_MODULE_METRIC[name];
    if (!ids) throw new TypeError(`Unknown analytics module: ${name}`);
    return this.setModuleVisible(name, !ids.some((id) => this.visible.has(id)));
  }
  setRailVisible(rail, visible) {
    const families = rail === 'vision' ? ['head-face', 'body-posture'] : rail === 'voice' ? ['voice-delivery'] : null;
    if (!families) throw new TypeError('Unknown analytics rail.');
    families.forEach((family) => {
      const ids = ANALYTICS_FAMILIES[family];
      if (!visible) {
        const subset = ids.filter((id) => this.visible.has(id));
        if (subset.length) this.rememberedFamilies.set(family, subset);
        ids.forEach((id) => this.visible.delete(id));
      } else {
        const subset = this.rememberedFamilies.get(family);
        (subset?.length ? subset : ids).forEach((id) => this.visible.add(id));
      }
    });
    this.#becomeCustom();
    return this.snapshot();
  }
  hideAll() { return this.selectPreset('interview'); }
  restoreAll() { return this.selectPreset('full'); }
  snapshot() { return frozenSnapshot(this.preset, this.visible); }
}

export function createAnalyticsVisibilityState(options) {
  return new AnalyticsVisibilityState(options);
}
