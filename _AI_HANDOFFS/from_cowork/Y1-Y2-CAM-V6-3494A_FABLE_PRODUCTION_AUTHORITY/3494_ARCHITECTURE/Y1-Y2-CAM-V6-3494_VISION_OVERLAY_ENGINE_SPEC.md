# Y1-Y2-CAM-V6-3494 — VISION OVERLAY ENGINE SPEC

Non-negotiable core system. One landmark pipeline, many independent consumers; rendering is one consumer among equals.

## 1. Coordinate law (canonical LandmarkFrame)

```ts
interface LandmarkFrame {
  t: number;                       // SessionClock seconds — monotonic, shared with audio
  source: { w:number, h:number, mirrored:boolean };   // capture frame geometry
  face?:  { box:NRect, mesh?:NPoint[], axes?:{yaw,pitch,roll}, conf:number };
  pose?:  { shoulders:[NPoint,NPoint], torso:NPoint[], conf:number };
  hands:  { L?:Hand, R?:Hand };    // Hand = { points:NPoint[21], center:NPoint, conf:number }
  faceCount: number;               // ≠1 ⇒ framing SUPPRESSED per 3471C
}
// NPoint = {x:0..1, y:0..1, z?:normalized}  — NEVER pixel-space on any bus
```

All coordinates normalized 0..1 against source frame + timestamp + confidence. Any renderer maps to its own canvas size at draw time — the identical recorded stream renders correctly in live student video, mentor view, Film Room, Compare, and mobile. Mirroring resolved once at capture, flagged in `source`, never re-guessed downstream.

## 2. Pipeline topology (independence law)

```
Camera → LandmarkDetector (worker; MediaPipe-class face/pose/hands) → LandmarkBus
   ├── VisionOverlayEngine   (render-only; per-surface canvas; display config store)
   ├── gesture cartridges    (range, L/R, events, synchrony)
   ├── camera_framing cartridge
   └── EvidenceRecorder      (compact evidence stream — see Recording spec)
```

Detection runs in a worker at its own cadence (target ≥15 fps hands, ≥10 fps pose; report actual fps to diagnostics). **Overlay DOM/canvas visibility has zero effect on the bus.** Backpressure: drop frames, never queue; dropped-frame count is a diagnostic, and sustained drops degrade `coverage` to LOW honestly.

## 3. Overlay layers (independent toggles)

`face_mesh · face_box_safe_frame · head_axes · shoulder_line · torso_skeleton · left_arm · right_arm · left_hand · right_hand · fingers · gesture_zone · gesture_envelope · camera_safe_frame · motion_trails`

Modes map to layer sets: **OFF** (none) · **MINIMAL** (safe frame + hand presence dots) · **STANDARD** (+ hands, gesture zone, shoulder line) · **LAB** (everything incl. mesh, axes, fingers, trails). Advanced per-layer checkboxes override within the mode (3493 UI carried forward). Role defaults: student live = OFF/MINIMAL; mentor = STANDARD; Analytics Lab/Founder = LAB. No overlay is ever permanently forced onto the student's face.

## 4. Renderer contract

One `VisionOverlayEngine` instance per video surface: `attach(canvas, surfaceGeom)`, `setMode(mode)`, `setLayers(set)`, `draw(frame)` — pure function of (frame, config, geometry); 3492 tokens for stroke colors (gold L / info R / ok safe-frame / dim skeleton); ≤2ms draw budget at STANDARD; trails as fixed-length ring buffers in the renderer (render state, never bus state).

## 5. Display ≠ measurement (structural)

Overlay config lives in `OverlayDisplayStore` (render layer). Cartridges and EvidenceRecorder import LandmarkBus only — a lint rule forbids pipeline modules from importing the display store. Acceptance: toggle every layer off with live camera → gesture/camera telemetry and evidence continue unchanged (wireframe acceptance test).

## 6. Evidence interplay

The EvidenceRecorder subscribes to the same bus and persists the compact landmark evidence stream defined in the Recording spec (downsampled centers/boxes/events — not full meshes). Film Room replays overlays from evidence through this same renderer (same coordinate law), so replay wireframes match live wireframes without recomputing video.
