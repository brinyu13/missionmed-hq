# Y1-Y2-CAM-V6-3440 local integration receipt

Status: BUILDER LOCAL FOLLOW-UP PASS; fresh independent post-push review required; production admission remains closed.

## Custody and authority

- Worktree: `/Users/brianb/MissionMed_worktrees/Y1-Y2-CAM-V6-3440`
- Branch: `codex/y1-y2-cam-v6-3440-aaa-unified-production-admin-canary`
- Rollback anchor: `9c1fa72e6b056db8b6fe0e17031fcaa688f78569`
- Canonical OS authority: DR-051 at `8e6ea6756b6fe0aec2dde5167499877e15bf098a`
- Forward-only correction: DR-052 at `defdac3e67b249d56995eb74c70aeed571823602`
- Accepted shell donor: `0f45098794360d038dd11211496f6b4eb43bb298`
- Accepted analytics donor: `4c92d299a186ce0c7825b4054a9a8ecc3b9e79aa`
- Accepted avatar donor: `fcdf36af33a9a1eb507b0b9f1ad4f8bc17810b4f`

## Implemented local boundary

- Mounted `/iv-prep-on-call/**` and `/api/ivprep-v6/**` into the HQ Node runtime.
- Rejects bearer authorization and credential-bearing query parameters, accepts only a strict current HQ cookie session, and derives mutation authority from a sealed HQ base origin rather than request Host or forwarded headers.
- Requires an explicit server-side IV Prep entitlement, same-origin mutation, exact CSRF, WP subject, cookie fingerprint, and entitlement revision.
- HQ logout sends one product-local, domain-separated cookie-fingerprint notification. The shared logout response and shared auth/session semantics are unchanged.
- Start idempotency binds the canonical request hash, WP subject, cookie fingerprint, and entitlement revision. Changed-body, replacement-cookie, entitlement-revision, concurrent-start, and logout replay all fail closed.
- Durable vault reads return an empty set until later database authority; donor fixture sessions are not projected.
- Product and admin-canary feature flags default off. Video has a separate default-off flag and cannot start without an injected provider controller.
- Provider lifecycle is monotonic and terminal, with one subject/test reservation, room, scoped browser participant, named `JRP_NEVER` dispatch, agent session, and avatar session; retry, reconnect, redispatch, worker restart, and session recreation are zero/disabled.
- Test 1 architecture is Profile B only: OpenAI native audio through LiveKit AgentSession to LemonSlice AvatarSession. Profile A and the ElevenLabs plugin remain uninstalled and gated.
- HQ owns admission, the reservation, one room, one scoped participant token, the named dispatch, termination request, and durable-state observation only. It never receives an AgentSession and never creates, terminates, or reads LemonSlice. Video start is two-phase: the admitted start response returns one ephemeral scoped LiveKit connection without logging or browser storage; browser decoded-video/playable-audio readiness is recorded separately; status never reprojects the token.
- The child-process worker exclusively owns OpenAI Realtime, AgentSession, LemonSlice creation, provider termination/status, and provider reconciliation. It atomically claims the exact nonce/job/dispatch/room/agent binding, waits for the authorized participant before provider creation, and terminates on the exact durable HQ signal, participant disconnect, reconnect/reconnected/disconnect, session error/close, or the 45-second deadline.
- Every terminal trigger synchronously closes startup and shares one child-owned teardown promise. The termination watcher receives an AbortSignal, every awaited startup boundary rechecks terminal state, and an in-flight avatar-create, AgentSession-start, claim, or worker-join promise is owned before reconciliation. New agent output is closed immediately and again after any in-flight AgentSession start settles, LemonSlice termination and one status read begin without waiting for the SDK runner, durable reconciliation completes, and only then does the child request SDK shutdown. The pinned runner's later shutdown callback only joins that same promise as a fallback and cannot create a second cleanup path.
- The pinned Node AgentServer/defineAgent/AgentSession worker is materialized with `maxRetry: 0` and a bounded 20-second shutdown-process allowance. Its concrete module-local durable gate denies every claim/write/reconcile by default. The canonical HQ provider factory, browser LiveKit attachment, and exact Supabase durable adapter intentionally remain unwired, so paid Test 1 is impossible under the local-only decision.
- LemonSlice uses the pinned `start(agentSession, room, options)` contract, `waitForJoin()`, 45-second idle timeout, `X-API-Key`, `{event:"terminate"}`, and a single terminal status/cost read. Unknown creation, cleanup, or nonterminal status trips the kill switch and cannot refund as confirmed cleanup.
- A pre-reservation entitlement denial advances directly from `ELIGIBLE` to terminal `FAILED_CLOSED`, returns the store's structured denial, and performs zero room, participant, dispatch, or worker operations.
- The corrected conditional ElevenLabs URL is `GET wss://api.elevenlabs.io/v1/text-to-speech/{voice_id}/multi-stream-input`.
- MediaPipe assets are vendored and hash-bound. `analytics:assets` now fails closed instead of downloading models.

## Validation

- Exact dependency pins were locked with package scripts disabled; repository `node_modules/**` remained absent.
- Fresh disposable install: `npm ci --ignore-scripts` in `/tmp/missionmed-3440.*`.
- Syntax and analytics checks: PASS.
- Full merged suite: 250 tests, 247 pass, 0 fail, 3 expected skips: the actual-HQ-logout and HQ source-boundary tests depend on absent `missionmed-hq/server.mjs`, and the offline-migration test depends on the absent repository migration.
- Repository-context 3440 matrix: 36 tests, 31 pass, 0 fail, 5 expected skips because repository `node_modules/**` is prohibited; the real AgentServer, pre-create/during-create/during-AgentSession-start terminal-race, and pinned-runner shutdown-order tests pass in the fresh isolated install.
- The repository-context matrix starts the actual HQ server with a synthetic encrypted cookie and proves wrong-CSRF logout does not revoke or clear it, correct-CSRF logout preserves the existing cookie-clearing response, and subsequent cookie replay is denied.
- The offline SQL contract enforces 45/45/59 seconds, one reservation per subject/test number, composite interview/subject ownership, current video eligibility for every paid reservation, and current Founder eligibility for Test 3. Its service-role-only invoker RPCs atomically reserve entitlement balance, bind one dispatch, refund safely before any job/provider create, claim the exact job, record worker/browser readiness, request and observe the exact termination signal, and reconcile terminal status/cost. Successful terminal-reservation and entitlement-balance writes share a guarded subtransaction; a constraint or CAS failure rolls both back, retains the reserved balance, records `FAILED_CLOSED`, and trips the singleton kill switch. Forced RLS and sealed search paths remain; the migration was not applied.
- Fresh isolated `npm ci --ignore-scripts` reported zero vulnerabilities for the IV Prep dependency tree.
- Browser loopback before the server-only follow-up: desktop and 390×844 mobile PASS; admitted navigation, voice-only start, two-step end/cleanup, empty durable vault, mobile rail, and clean browser console verified. A follow-up in-app navigation attempt was blocked by the browser client before page load; no UI byte changed in the follow-up.
- Paid provider requests: NONE.
- LemonSlice/LiveAvatar credit use: ZERO.
- Product Supabase queries or migration apply: NONE.
- Railway/deployment mutation: NONE.

## Closed gates

The SQL migration at `supabase/migrations/20260811170000_ivprep_3440_admin_canary.sql` is offline-only and MUST NOT be applied without a later exact database decision. Production deployment, durable multi-instance revocation, product Supabase, Railway mutation, ordinary-student admission, and every paid provider test remain closed. Test 3 and video acceptance remain Founder-only under the 45/45/59 and no-Test-4 law.
