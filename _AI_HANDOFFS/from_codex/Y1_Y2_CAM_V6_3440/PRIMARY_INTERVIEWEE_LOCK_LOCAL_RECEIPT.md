# Y1-Y2-CAM-V6-3440 Primary Interviewee Lock Local Receipt

Date: 2026-08-11

## Authority and custody

- MissionMed OS authority: DR-056 at canonical commit `b98d3fef02dcfd825e11c8561825f5af5dbd0e25`.
- Product worktree: `/Users/brianb/MissionMed_worktrees/Y1-Y2-CAM-V6-3440`.
- Product branch: `codex/y1-y2-cam-v6-3440-aaa-unified-production-admin-canary`.
- Pre-write product candidate and rollback point: `735055fded16ba0755929a08db6770abb858ad82`.
- DR-009 product-path lease: epoch `3`, binding `39969379c3a217ba9ff66bb198f13a4e95b090c61596a22caf2f383a62331634`.
- The accepted 3420R donor remained read-only. No donor bytes were materialized or changed.
- `supabase/.temp/cli-latest` was not touched.

## Implemented local contract

- A deterministic elapsed-time state machine now owns central strike-zone acquisition, stability, anonymous session-local track custody, weighted overlap/center/scale/motion continuity, temporary occlusion, conservative geometric reacquisition, and explicit selection-required recovery. Once multiple candidates enter the locked primary's continuity envelope, that unresolved crossing lineage remains withheld even if only one candidate later remains; geometry alone cannot transfer the existing lock, and the state advances to explicit reselection on expiry.
- Initial ambiguity never guesses. A later single candidate remains blocked until the user invokes the same-session `LOCK TO ME / RESELECT PRIMARY` action.
- A bystander does not clear the primary lock, stop primary analytics, invalidate the answer, or enter the student projection. A bystander cannot be promoted after the primary is lost, including if the bystander later moves into the prior primary geometry: the unsafe lineage uses at least the full primary-eligibility continuity envelope, is refreshed while the primary is unavailable, and remains withheld through the explicit-selection deadline rather than aging into eligibility.
- The Holistic worker analyzes an in-memory padded ROI owned by the locked primary and remaps only transient geometry to the student-video coordinate system. Face/head, pose/body, and hands therefore share one primary association.
- The operational student-surface controller physically anchors a transient canvas to `#pipvid` for live interview and to an ephemeral wrapper around `#playback` for replay. Its accessible controls independently toggle Face and Body/Hands, and its swap action changes the actual room layout while the canvas remains inside the student surface through native, Zoom, Webex, Teams, primary/inset, and mirrored/unmirrored layouts.
- Playback creates a separate ephemeral `BrowserAnalyticsPipeline` answer that uses the same FaceDetector -> primary ROI -> Holistic worker path. Pause, seek, route change, reset, or teardown abandons that playback answer without finalizing or persisting an analytics result.
- The student-surface controller is default-denied and no client-callable configuration method is exposed on `window.V6CommunicationAnalytics`. It creates no canvas, layout change, playback analysis, or student control until a later server-authorized policy adapter exists; this local implementation did not activate student access.
- Founder diagnostics contain only the bounded lock state, strike-zone status, continuity classification, bystander count, excluded duration, reacquisition count, and exact bounded withheld intervals/reasons. Bystander presence never becomes a student penalty, warning, score, quality deduction, or invalidation.
- Candidate boxes, ROI geometry, anonymous track identifiers, landmarks, crops, and rendered overlay bitmaps remain ephemeral. Visibility/media discontinuity, answer seal, reset, shutdown, session end, and worker termination clear the applicable state. No analytics-network egress or new storage path was introduced.
- No identity, recognition, embedding, demographic, emotion, personality, honesty, human-confidence, gaze, intent, psychometric, diagnostic, or hidden-trait inference was added.

## Deterministic evidence

- DR-056 selected matrix: `94` tests, `94` pass, `0` fail, `0` skip under `node --test --test-concurrency=1`.
- Aggregate local repository-context matrix: `238` tests, `226` pass, `7` fail, `5` skip. The seven failures are unchanged dependency-availability failures because repository `node_modules` is absent and the `ws` package cannot be resolved. The five skips are the existing dependency-gated Profile B AgentServer/race/order checks. DR-056 did not authorize package installation.
- Acceptance A through F is covered directly by the primary-lock state-machine tests.
- Acceptance G is covered by an actual playback-source capture through the shared worker path, a bystander-preserving primary ROI handoff, independent Face and Body/Hands worker controls, ephemeral playback-session destruction, and actual canvas drawing on the playback surface.
- Acceptance H is covered by behavioral DOM tests that move the actual room between student-primary and student-inset layouts while retaining the same live overlay node under `#selfpip`, plus mirror and Zoom-style surface assertions. The runtime derives native/Zoom/Webex/Teams layout state from the real room classes rather than from a receipt-only descriptor.
- Additional checks cover cadence invariance, same-primary face/body/hand association, bounded interval storage, no auto-promotion, worker reset/shutdown destruction, same-origin-only workers, no raw result geometry, and student-safe projection.

## Process disclosure

Early bounded local test invocations omitted the filed `--test-concurrency=1` flag. They performed no product write, network call, provider action, database action, or external side effect. Their results are not used as completion evidence. The official selected and aggregate evidence above was rerun with `--test-concurrency=1`.

One read-only manifest-containment shell check mistakenly used zsh's reserved `path` variable, which emptied command lookup only inside that subprocess and produced false `command not found` / `MISSING_MANIFEST_PATH` lines. It changed no file or external state and is not used as evidence. The corrected check used a non-reserved variable, returned exactly `17` changed paths with no missing manifest path, and emitted no diff-check error.

## Closed gates

This receipt proves local/offline implementation only. It does not claim real-device visual acceptance, connected Supabase evidence, database or restore readiness, Railway readiness, provider readiness, paid-test readiness, deployment, canary admission, production activation, or student activation. No database, Supabase product, Railway, provider, paid-test, deployment, canary, production, or student mutation occurred.

The product transaction may be committed and non-force pushed only after exact path/hash freeze, fresh lease heartbeat, and fresh independent authority and security PASS. The lease must remain held through post-push verification, then release immediately.
