# Y1-Y2-CAM-V6-3494 — DELIVERY INTELLIGENCE MODULE CARTRIDGE SPEC

The canonical hot-swap contract. Names are conceptual; Claude Code may adapt identifiers to codebase conventions **but must preserve every field's semantics**.

## 1. Module interface

```ts
interface DIModule {
  id: MetricId;                     // 'speaking_pace' — PERMANENT; Film Room keys on this forever
  displayName: string;              // literal, claim-safe ('SPEAKING PACE')
  category: 'voice'|'body'|'hands'|'camera'|'composite';
  version: string;                  // 'pace@2.1.0' — hot-swap unit
  status: 'active'|'flagged_off'|'unavailable'|'experimental';
  inputs: BusRequirement[];         // e.g. [{bus:'audio', fields:['rms','speaking']}]
  deps: MetricId[];                 // composites list lower modules; resolved via registry ONLY

  // MEASUREMENT/INTERPRETATION
  ingest(frame: AudioFrame|LandmarkFrame|MetricSample): void;
  sample(): MetricSample;           // {t, value, norm 0..1, state, confidence 0..1, coverage OK|LOW|UNAVAILABLE}
  target(ctx: {phase, targetRef}): Corridor;   // {lo, hi, walls?} — 5 permitted refs (3471C)
  events?(): MetricEvent[];         // EVENT-class outputs (gesture candidates, pauses, landings)

  // COACHING (candidate only — shell arbiter decides)
  getCorrection(): {text, severity, correctability, kind}|null;

  // VISUALIZATION (registered renderers, replaceable independently of the above)
  renderers: {
    live?: RendererId;              // 'SPD-C' — approved instrument
    hud?: RendererId;               // compact chip
    film?: RendererId;              // lane renderer
    post?: RendererId;              // post-analysis panel
    mentor?: RendererId;            // mentor detail (confidence/threshold exposure)
  };

  // PERSISTENCE
  evidence: EvidenceSchema;         // what this module writes to AnswerRecord lanes (see Recording spec)
  flags?: string[];                 // feature flags gating this module
  failClosed: 'UNAVAILABLE'|'SUPPRESSED'|'WARMING_UP';  // rendered state when inputs missing
}
```

Renderer contract (unchanged from 3472 §15.0): `mount(el) / update(frame) / setDensity / setMode / destroy`; renderers are pure consumers — no bus writes, no correction banners in live mode.

## 2. Registry

```ts
DIRegistry.register(module)                    // idempotent by (id, version)
DIRegistry.activate(id, version)               // hot-swap: flag flip, no console changes
DIRegistry.get(id) / .all() / .enabled()
DIRegistry.capabilities(id)                    // {live, post, film, hud} — UI queries this
DIRegistry.subscribe(id, cb)                   // MetricBus fan-out
DIRegistry.coverage()                          // denominators for composites + Film Room lanes
```

UI law: HUD, Film Room track list, Analytics Lab, post panels, and mentor views enumerate `DIRegistry.enabled()` filtered by capability. **No component may hardcode a metric list.**

## 3. Cartridge catalog (initial registrations)

| id | cat | Renderers (approved) | Inputs | Initial status |
|---|---|---|---|---|
| voice_volume | voice | VOL-E · hud chip · level lane | audio.rms/clipping | active |
| volume_variation | voice | bracket-on-VOL-E · hud · envelope lane | audio window | active |
| pitch | voice | PIT-A · hud · semitone lane | audio.f0 | flagged_off until `pitch_enabled` |
| pitch_variation | voice | PIT-A bracket · hud | audio.f0 | flagged_off |
| speaking_pace | voice | SPD-C · hud · pace lane | transcript timing + VAD | active (conf-gated) |
| pace_variation | voice | mixer channel · lane | transcript | active |
| cadence | voice | rail-vs-ghost · hud · lane | speech runs | flagged_off until `cadence_enabled` |
| pauses | voice | gaps in rail · EVENT chips | speech/silence | active |
| vocal_landing | voice | landing meter (mentor) · EVENT | audio slope (+f0 later) | experimental |
| head_movement | body | lane · warmth channel | landmarks.face | active |
| face_activity | body | lane · warmth channel | landmarks.face | active |
| torso_posture | body | lane | landmarks.pose | active |
| camera_framing | camera | CAM-C · hud · framing lane | landmarks.face box | active |
| left_hand / right_hand | hands | GF-* markers · presence lanes | landmarks.hands | active |
| gesture_range | hands | GF-* (Founder pick) · hud | landmarks.hands+pose | active |
| gesture_events | hands | registry REG-A · EVENT chips | landmarks + transcript | experimental, `gesture_semantics_enabled` |
| gesture_synchrony | hands | congruence channel · lane | motion peaks × audio peaks | active |
| delivery_congruence | composite | CON-B mixer · lane | deps: per training mix / core set | active |
| warmth_cue_profile | composite | mixer chassis | deps per 3472 §8.3 | active (validation-gated student view) |
| competence_cue_profile | composite | mixer chassis | deps per 3472 §8.4 | active (validation-gated) |
| credibility_authority_cue | composite | mixer (mentor/LAB only) | deps stability subset | active, mentor-only |
| charisma_cue_balance | composite | mixer + headline (PERF only) | deps: warmth, competence, congruence, gesture_effectiveness | active (validation-gated) |

Composite law inside every composite cartridge: `capMaster` (weakest+15 [CALIBRATE], buckets of 5, visible contributors, coverage denominator, no silent renormalization). CORE vs TRAINING-MIX separation lives in the composite cartridge; training mixes never write canonical records.

## 4. Hot-swap procedure (normative)

1. Implement `speaking_pace@2.0.0` as a new module file. 2. `DIRegistry.register(v2)`. 3. Flip `di.speaking_pace.version` flag. 4. Run cartridge acceptance test A. 5. Rollback = flip flag back. Renderer swap identical via renderer registration (`SPD-C`→`SPD-X`). Nothing else in the codebase changes; CI fails the slice if the diff touches console files.

## 5. Claim safety

Module `displayName`, correction strings, event labels, and evidence keys pass the 3472 §13 string-lint in CI. `-CUE PROFILE` suffixes never shortened; gesture events always CANDIDATE-class labels; no deception/credibility inference anywhere in module output.
