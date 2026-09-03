# Y1-Y2-CAM-V6-3521 — Physical Runtime Visual Regression Correction

Date: 2026-08-22

Status: VISUAL REGRESSION CORRECTED; PHYSICAL ACCEPTANCE REMAINS PAUSED

Founder-approved visual source of truth: `6946523504652f7fb49c2db73b5d9f80a36d059a`

## Scope and evidence boundary

This checkpoint corrects presentation parity between deterministic and physical input modes. It does not claim physical camera, microphone, pitch, modulation, hand, pose, face, or speaking-speed acceptance. No physical acceptance was resumed while preparing this evidence.

## Root cause

The runtime constructed `AnalyticsVisibilityState` with its default `minimal` preset, then fixture-only setup mutated the deterministic surface to `full`. Physical mode therefore mounted a reduced presentation while deterministic mode mounted the Founder-approved full presentation.

The generic unavailable painter also drew an opaque diagnostic treatment over the anatomical scanner canvases when camera observations were absent. That made the physical-before-measurement screen lose the Founder scanner assets even after the presentation preset was corrected.

## Bounded correction

- The runtime now mounts the `full` Founder presentation for every input source.
- Deterministic fixture setup no longer mutates presentation state.
- Signal availability changes readouts and acquisition labels only; it does not change the layout.
- Head/Face and Body unavailable paths clear only their transparent telemetry overlay canvases, leaving the Founder anatomical scanner assets visible.
- No visual hierarchy, module order, scanner asset, or center-stage composition was redesigned.

## 1626 x 968 parity measurement

Both modes were measured in the same browser harness at exactly 1626 x 968 before physical measurement began.

| Major region | Deterministic geometry | Physical geometry | Deviation |
| --- | --- | --- | --- |
| Shell | x 0, y 62, w 1626, h 906 | x 0, y 62, w 1626, h 906 | 0.00% |
| Left rail | x 11, y 71, w 423, h 886 | x 11, y 71, w 423, h 886 | 0.00% |
| Center stage | x 447, y 71, w 788.015625, h 886 | x 447, y 71, w 788.015625, h 886 | 0.00% |
| Right rail | x 1248.015625, y 71, w 366.984375, h 886 | x 1248.015625, y 71, w 366.984375, h 886 | 0.00% |
| Head/Face | x 11, y 71, w 423, h 568.421875 | x 11, y 71, w 423, h 568.421875 | 0.00% |
| Body/Posture | x 11, y 643.421875, w 423, h 313.578125 | x 11, y 643.421875, w 423, h 313.578125 | 0.00% |
| Volume | x 1248.015625, y 104, w 366.984375, h 214.703125 | x 1248.015625, y 104, w 366.984375, h 214.703125 | 0.00% |
| Speaking Speed | x 1248.015625, y 327.703125, w 366.984375, h 230.6015625 | x 1248.015625, y 327.703125, w 366.984375, h 230.6015625 | 0.00% |
| Vocal Variation | x 1248.015625, y 567.3046875, w 366.984375, h 179.9140625 | x 1248.015625, y 567.3046875, w 366.984375, h 179.9140625 | 0.00% |
| Pitch | x 1248.015625, y 756.21875, w 366.984375, h 200.78125 | x 1248.015625, y 756.21875, w 366.984375, h 200.78125 | 0.00% |

Maximum major-region deviation: **0.00%**. Browser checks reported no horizontal or vertical document scroll in either mode.

Both modes retained:

- the exact same three-column component tree;
- complete Head/Face and Body/Posture modules;
- the same Founder face and body scanner assets;
- the right-rail order Volume, Speaking Speed, Vocal Variation, Pitch;
- the dominant center interview stage;
- `full` presentation state with neither rail nor left module collapsed.

## Screenshot evidence

- `DETERMINISTIC_LOCKED_RUNTIME.png` — 1626 x 968 — SHA-256 `2e2c9d69ac541d4d8491ea21922278fc69d4e6c4da8a86b3569d00dfef1c3a34`
- `PHYSICAL_RUNTIME_BEFORE_MEASUREMENT.png` — 1626 x 968 — SHA-256 `1ed71501278b8629d5137075755b17db873488b9c7bfc0fba7ee0dacee437083`
- `DETERMINISTIC_VS_PHYSICAL_SIDE_BY_SIDE.png` — 3252 x 968 — SHA-256 `1c553c09e1ec4bd67ecf94ff323b81b966e877602892a8a272bebfc7ee78f9bb`

## Regression validation

- Focused 3521 runtime suite: 67/67 PASS.
- Combined analytics and 3521 suite: 257/257 PASS.
- Analytics syntax validation: 42 modules PASS.
- Direct syntax checks for both changed runtime modules: PASS.
- Git diff whitespace check: PASS.

The new regression test proves that physical and deterministic sources mount the identical full Founder presentation before measurement, fixture setup cannot mutate presentation state, scanner assets remain visible through unavailable states, and right-rail module ordering stays locked.

## Safety and custody

- Physical acceptance: PAUSED.
- Production modified: NO.
- Railway touched: NO.
- Paid provider sessions: 0.
- Donor worktree 3440 modified by this work: NO.
