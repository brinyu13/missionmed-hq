# Y2-3100 DISC-05 Frontend Runtime

## Current Surface Inventory

- **VERIFIED:** `/Users/brianb/MissionMed_worktrees/Y1-CAM-3000/Y1-CAM-4008A/candidates/cam-hq/public/cam/index.html:1270` through `:1273` registers 15 student views: `home`, `builder`, `qsets`, `cast`, `meet`, `perm`, `station`, `room`, `selfrate`, `analysis`, `order`, `vault`, `ghost`, `season`, and `stories`.
- **VERIFIED:** Lines `:1282` through `:1292` perform view and flow navigation.
- **VERIFIED:** There is no `data-view="interviewer"` adaptive interview room. The label "Interviewer" maps to the scripted `cast` and `meet` steps at lines `:788` through `:820`.
- **VERIFIED:** Four scripted persona cards are present. They are presentation content, not a persona service or adaptive policy engine.
- **VERIFIED:** `PACKS` is empty and `applyPack` is disabled at lines `:2246` through `:2249`.
- **VERIFIED:** The locked premium foundation panel remains at lines `:1062` through `:1071`; it does not prove an active feature.

## Capture Boundary

- **VERIFIED:** The page invokes `getUserMedia` beginning near `index.html:1431`.
- **VERIFIED:** Capture begins through `CaptureSession` at lines `:1579` through `:1594` and finalizes at `:1612` through `:1638`.
- **VERIFIED:** `/Users/brianb/MissionMed_worktrees/Y1-CAM-3000/Y1-CAM-4008A/candidates/cam-hq/public/cam/cam-runtime-integrity.js:55` through `:65` negotiates recording MIME; the capture FSM begins at line `:152`.
- **INFERENCE:** A future WebRTC room must adopt the already-authorized stream or use an explicit handoff state machine. Independently calling `getUserMedia` would create competing device ownership and conflicting consent/recovery state.

## Safe Attachment Points

| Need | Existing surface | Status |
|---|---|---|
| Persona selection | `cast` | Scripted presentation donor only |
| Pre-interview introduction | `meet` | Scripted presentation donor only |
| Device permission and recovery | `perm` / `station` | Reusable capture boundary |
| Live answer capture | `room` | Existing non-adaptive practice surface |
| Instructor review | admin review surface documented in DISC-07 | Reusable only through exact grants |

- **UNKNOWN:** No reusable `PersonaPanel` component was found. Any such name in the blueprint is conceptual.
- **VERIFIED:** The governing kill rule authorizes no student-facing insertion while the Brain capability failure remains active.
- **VERIFIED:** The amended ticket forbids changing existing Foundation labels to imply that the adaptive interviewer works.

## Boundary Verdict

The shell has useful presentation and capture donors. It has no hidden adaptive interviewer UI. Any future attachment requires a separate release ticket after the Brain capability gate passes.
