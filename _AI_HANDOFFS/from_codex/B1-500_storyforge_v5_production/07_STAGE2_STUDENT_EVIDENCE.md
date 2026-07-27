# B1-500 Stage 2 — Student Experience Evidence

**Outcome:** `PARTIAL`

## Verified in headless Google Chrome against real PostgreSQL

- V5-responsive shell with Student Home, Library, Capture, Prep, Notifications, and Workspace.
- Private text capture and durable save.
- Self score rendered as stoplight dots with `Self` label and full aria names.
- Editable private/needs-revision states and read-only submitted states.
- Explicit submit, mentor round trip, notification deep link, revise, resubmit, and final approved view.
- Immutable original remains visible beside current text.
- Desktop and 390-pixel mobile layouts rendered and were captured.
- Core Student Home produced no serious or critical axe violations.
- AI copy is explicitly gated; no generated or canned result is displayed.
- With R2 absent, Record mode says storage is unavailable and its start control is disabled; no capture/upload is claimed.

## Screenshot receipts

- `_AI_HANDOFFS/from_codex/B1-500_storyforge_v5_production/evidence/storyforge-v5-student-home.png`
  - SHA-256 `4a615cf2d2904b8ee55f5138c0103912b474038224e637a81fa2e4c5d7f48a73`
- `_AI_HANDOFFS/from_codex/B1-500_storyforge_v5_production/evidence/storyforge-v5-student-mobile.png`
  - SHA-256 `a735c6b192a33c583bad9b260af7254078088b234ee81c4ecae530dd995a16f7`

## Release-blocking gaps

- Browser identity is a signed local fixture, not real WordPress staging SSO.
- Private audio signing/verification code exists, but no approved bucket or credentials exist and MediaRecorder/upload recovery is not release-verified.
- Screenshot behavior was visually inspected against the canonical authority, but no approved pixel-diff baseline has been ratified.
- Full canonical student detail powers—story-question proposals, suggestion acceptance/edit history, and every legacy-data path—are not complete.

Stage 2 therefore cannot be labeled production-complete.
