# Y1-Y2-CAM-V6-3420R unified V6 integration contract

## Intended consumer

Later unified V6 reconciliation ticket only. This package does not authorize a
merge into canonical V6 or a deployment.

## Reconciliation order

1. Verify the 3420R source commit, `DR-035`, and
   `ivprep-v6/ALLOWED_PATHS_3420R.txt`.
2. Preserve canonical/frozen V6 and the accepted 3410/3410A and 3430 behavior.
3. Take the isolated new families first:
   - `ivprep-v6/analytics/**`
   - `ivprep-v6/public/analytics/**`
   - `ivprep-v6/test/analytics/**`
   - `ivprep-v6/scripts/analytics/**`
   - `ivprep-v6/fixtures/analytics/**`
   - `ivprep-v6/public/vendor/mediapipe/**`
4. Reconcile bounded host seams deliberately:
   - `ivprep-v6/public/index.html`
   - `ivprep-v6/server/serve.mjs`
   - `ivprep-v6/package.json`
   - `ivprep-v6/package-lock.json`
   - `ivprep-v6/README.md`
5. Do not take any apparent change in providers, `public/v6-integration.mjs`,
   `public/conversation-rail.mjs`, configuration, `persistence/alpha-store.mjs`,
   frozen baseline, or pre-existing tests; this lane has no diff there.
6. Run the complete reproduction matrix before accepting the reconciliation.

## Host-seam intent

### `public/index.html`

- adds the admin Founder navigation/view and results anchor;
- imports the optional analytics entry module;
- begins, seals, abandons, and releases analytics around the existing media
  lifecycle using fail-soft calls;
- maps replay and analytics evidence to the same take;
- keeps 3420R legacy heuristic coaching hidden while the bounded engine owns the
  observation path;
- projects only sealed student-safe results and persists only their revalidated
  minimum;
- revokes tab-local media URLs on every terminal path;
- strips legacy pause-count/longest-pause values from 3420R provider context,
  without changing the protected provider adapter.

### `server/serve.mjs`

- adds `.wasm`, `.task`, and `.tflite` MIME types;
- adds self-only worker policy and WASM execution CSP support;
- preserves the existing same-origin plus configured LiveKit connect policy;
- changes this isolated lane's default local port to 8420 to avoid the active
  protected 3410 process on 8343.

### package files

- pin `@mediapipe/tasks-vision` exactly to `1.0.1`;
- add analytics syntax, validation, privacy, performance, and asset commands;
- include `test/analytics/*.test.mjs` in the normal test command;
- do not change LiveKit or ws versions.

## Conflict rules

- Preserve the literal 3410 room-navigation cancellation sequence and fallback
  default.
- Never attach analytics to avatar media or provider credentials.
- Do not let analytics stop shared media tracks directly or close the caller's
  AudioContext.
- Keep Founder and ordinary-interview pipelines separate.
- Keep the worker/model same-origin guard before the MediaPipe import.
- Keep every visual, VAD, pause, and transcript metric Founder-only until a new
  authority-backed validation record explicitly promotes it.
- If a validation seal, privacy attestation, event payload, duration, coverage,
  source engine, or replay/media correlation mismatches, fail closed.

## Acceptance gate for reconciliation

Required automated checks and exact commands are in
`Y1_Y2_CAM_V6_3420R_COMPLETE_COMBINED_HANDOFF.md`. In addition, the reconciler
must perform the remaining real-camera/microphone Founder run and real 10–15
minute browser endurance described in
`Y1_Y2_CAM_V6_3420R_VALIDATION_RESULTS.md`.

Protected-lane preservation must be rechecked from the canonical reconciliation
baseline, not assumed from this worktree's hash record.
