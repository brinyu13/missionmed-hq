# Y1-Y2-CAM-V6-3440 local integration receipt

Status: LOCAL PHASE PASS; production admission remains closed.

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
- Rejects bearer authorization and accepts only a strict, current HQ cookie session.
- Requires an explicit server-side IV Prep entitlement, same-origin mutation, exact CSRF, WP subject, cookie fingerprint, and entitlement revision.
- HQ logout sends one product-local, domain-separated cookie-fingerprint notification. The shared logout response and shared auth/session semantics are unchanged.
- Concurrent starts, account switching, cookie switching, entitlement revision switching, replay after logout, and missing/expired session cases fail closed.
- Durable vault reads return an empty set until later database authority; donor fixture sessions are not projected.
- Product and admin-canary feature flags default off. Video has a separate default-off flag and cannot start without an injected provider controller.
- Provider lifecycle is monotonic and terminal, with one reservation, room, `JRP_NEVER` dispatch, agent session, and avatar session; retry, reconnect, redispatch, and session recreation are zero/disabled.
- Test 1 architecture is Profile B only: OpenAI native audio through LiveKit AgentSession to LemonSlice AvatarSession. Profile A and the ElevenLabs plugin remain uninstalled and gated.
- The corrected conditional ElevenLabs URL is `GET wss://api.elevenlabs.io/v1/text-to-speech/{voice_id}/multi-stream-input`.
- MediaPipe assets are vendored and hash-bound. `analytics:assets` now fails closed instead of downloading models.

## Validation

- Exact dependency pins were locked with package scripts disabled; repository `node_modules/**` remained absent.
- Fresh disposable install: `npm ci --ignore-scripts` in `/tmp/missionmed-3440.*`.
- Syntax and analytics checks: PASS.
- Full merged suite: 233 tests, 231 pass, 0 fail, 2 expected skips because the isolated IV Prep copy intentionally excludes `missionmed-hq` and the repository-level offline migration.
- Repository-context 3440 matrix: 19 pass, 0 fail, including the HQ mount and offline migration assertions.
- Browser loopback: desktop and 390×844 mobile PASS; admitted navigation, voice-only start, two-step end/cleanup, empty durable vault, mobile rail, and clean browser console verified.
- Paid provider requests: NONE.
- LemonSlice/LiveAvatar credit use: ZERO.
- Product Supabase queries or migration apply: NONE.
- Railway/deployment mutation: NONE.

## Closed gates

The SQL migration at `supabase/migrations/20260811170000_ivprep_3440_admin_canary.sql` is offline-only and MUST NOT be applied without a later exact database decision. Production deployment, durable multi-instance revocation, product Supabase, Railway mutation, ordinary-student admission, and every paid provider test remain closed. Test 3 and video acceptance remain Founder-only under the 45/45/59 and no-Test-4 law.
