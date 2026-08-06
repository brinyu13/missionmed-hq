# B1-512 Baseline and Change Budget

Date: 2026-08-06 (America/New_York)

## Serialized accepted baseline

- Worktree: `/Users/brianb/MissionMed_worktrees/B1-StoryForge-502`
- Branch: `codex/b1-503-storyforge-product-recovery`
- Starting HEAD and upstream: `f5be73d8b69c9b4a6ef3ed5d8734ef0b93595c8c`
- Starting worktree: clean
- Canonical production URL: `https://missionmedinstitute.com/storyforge/`
- Accepted live release: `v-d45ca5e899878fea`
- Accepted Railway deployment: `17615414-9422-453a-9eb8-7d1b36f462a6`
- B1-511A seal: `STORYFORGE STUDENT WORKFLOW WIDENED — MENTOR NOTES REMAIN IN CONTROLLED PILOT`
- Critical Systems at the baseline: zero failures
- Baseline conformance: 72/72, including the serious-accessibility-violation gate

B1-511A is complete, committed, pushed, and clean. No other StoryForge writer is active. B1-512 begins only from this synchronized baseline.

## Verified pre-change behavior

- Homepage `Finish it` actions use the ordinary story-open control and do not carry completion-guidance intent.
- Story Detail therefore opens normally and does not identify required missing sections.
- Current completion contract is narrow: a story becomes `developmentState=complete` only when the accepted Working Version reaches 40 trimmed words and Learning Lesson is present.
- Current review-submission contract is separately narrow: the accepted working text must contain at least three trimmed characters; title, Learning Lesson, priority, categories, and intended uses remain optional under the current server contract.
- Submission/withdraw/resubmit transitions and the bounded administrator review queue already exist. The repair is to expose the accepted student action and route incomplete attempts into the same completion-guidance treatment, not to create a second workflow.
- Settings already persist a background preference, but selection, temporary preview, saved state, and cancel behavior are not clearly separated.
- Existing taxonomy is represented by stable IDs in the accepted product; database checks and server/browser allowlists are currently static.
- Private R2, signed access, lifecycle cleanup, deletion intents, RLS, and submitted-story administrator boundaries already exist for other StoryForge media classes and may be reused as patterns only.

## Change budget

The following is the maximum expected hand-authored production budget. Generated immutable release assets are excluded and must never be hand-edited.

| Expected file | Founder requirement | Reason / bounded change | Rollback | Unchanged proof |
|---|---|---|---|---|
| `storyforge-v5/public/app.js` | A–G | Extend the sole accepted renderer with Finish-It intent/guidance, existing submission controls, bounded admin Content & Display, text-size and environment preview state, Interview Prep visibility, and story-media UI. | Revert B1-512 frontend commit and republish prior immutable release. | Existing routes, story/editor state, voice, transcript, replay, mentor notes, auth, and identity browser tests. |
| `storyforge-v5/public/styles.css` | A, C–E, G | Add narrowly scoped incomplete, configuration, reading-size, environment-preview, and media styles. No global rewrite. | Revert additive selectors. | Canonical conformance, reduced-motion, accessibility, responsive and no-strobe tests. |
| `storyforge-v5/server/app.mjs` | C, D, F, G | Register authenticated bounded configuration/preference/media routes, project published presentation state, and add the exact already-pinned R2 origin to `img-src` for signed photos. | Force-off flags, then revert route/CSP commit. | Existing API authorization, exact-origin CSP, and complete route regression. |
| `storyforge-v5/server/admin-console.mjs` | C, F | Extend only the current Founder-authorized console with validated Content & Display operations. | Configuration force-off and revert. | Admin/non-admin/anonymous matrices; no private-story broadening. |
| `storyforge-v5/server/product-configuration.mjs` (new) | C–F | Structured defaults, validation, optimistic row versioning, preview payloads, safe fallback, and per-user reading size. | Force off; bundled defaults remain canonical. | Injection, limits, enum, conflict, restore-default and audit tests. |
| `storyforge-v5/server/story-media.mjs` (new) | G | Isolated story-photo/video allocation, verification, authorization, caption/order, retirement, cleanup, and signed playback lifecycle. | Media force-off; retain rows/objects; revert API exposure. | Cross-user, anonymous, private/submitted admin, MIME, size, expiry, cleanup and zero-public-access tests. |
| `storyforge-v5/server/storage.mjs` | G | Reuse the existing private-R2 signer/client through a distinct story-media namespace. | Media force-off and revert storage helpers. | Existing audio/mentor-media storage regression and namespace-isolation tests. |
| `storyforge-v5/server/config.mjs` | C, G | Add default-closed StoryForge-specific configuration/media kill switches and bounded media limits derived from current infrastructure evidence. | Restore prior environment contract. | Config validation and default-off tests. |
| `storyforge-v5/infra/postgres/migrations/<timestamp>_b1_512_configuration_text_media.sql` (new) | C, D, F, G | Add per-user text size, versioned bounded presentation config, stable taxonomy option metadata, private story media, RLS, RPCs, audit, deletion intents, and default-off flags. Replace only static taxonomy-ID checks and `sf_submit_story` validation needed to enforce published review-required fields server-side; existing IDs/data remain unchanged. | Forward-safe disable preserves all rows/objects; restore rehearsal before production. | PostgreSQL/RLS suite, migration rollback/reapply, immutable historical-ID and server-enforced submission tests. |
| `storyforge-v5/infra/wordpress/missionmed-storyforge-route.php` | G | Add only the already-pinned private R2 origin to `img-src`; `media-src` and `connect-src` already use that exact origin. No identity or proxy change. | Restore prior route file atomically. | Route hash, bootstrap/JWT, same-origin gateway and exact-origin CSP tests. |
| `storyforge-v5/scripts/apply-b1-512-production-migration.sh` (new) | C, D, F, G | Guarded migration/verification entry point with exact target, backup, ledger, and rollback checks. | Do not run; or execute the documented forward-safe disable/restore procedure. | Script static tests and production-shaped restore rehearsal. |
| Existing test runners only where registration is necessary | A–G | Register new focused suites without changing existing semantics. Candidate paths: `scripts/run-local.sh`, `scripts/run-postgres-tests.sh`, `scripts/run-e2e.sh`, `scripts/run-integration.sh`, `scripts/run-conformance.sh`, and `tests/postgres/helpers/ephemeral-postgres.mjs`. | Revert registration lines. | Existing suite counts remain green. |
| New focused unit/PostgreSQL/browser tests under `storyforge-v5/tests/` | A–G | Prove every mandatory Stage 1 contract and blast-radius invariant. | Test-only revert. | Full regression plus deterministic build. |
| `_SYSTEM/CRITICAL_SYSTEMS_MANIFEST.json` | Final release only | Reconcile only exact StoryForge pins after independently verified deployment. | Restore prior accepted B1-511A pins. | Enforced gate zero failures before and after. |
| Required B1-512 handoffs and screenshots | Evidence | Preserve before/after, security, rollback, deployment, acceptance, fresh provider/PG18/Kinsta backup receipts, private-media inventory/cleanup, and the exact deferred Stage 2 placeholder contract. | N/A; evidence-only. | SHA-256 manifest verification. |

## Explicit shared-file expansion justification

`public/app.js`, `server/app.mjs`, `server/admin-console.mjs`, `server/storage.mjs`, and the guarded WordPress route are shared StoryForge seams. Their inclusion is necessary to preserve the existing single renderer, authenticated API, current Founder console, proven private-R2 client, and canonical WordPress route. Creating parallel substitutes would violate the ticket. Every change in those files must be localized and independently regression-tested.

The taxonomy migration may replace static ID checks with validation against stable option IDs because the explicit Founder requirement to add categories and intended-use values cannot work while static checks reject every new ID. This is a minimal, non-destructive constraint evolution: existing IDs and associations are preserved byte-for-byte; no historical story is rewritten.

## Evidence-derived media bounds

- Photos: JPEG/PNG/WebP only, maximum 5 MB.
- Short video: MP4/WebM only, maximum 50 MB and 60 seconds.
- Signed URLs: 300 seconds, within the existing 60–900 second server bound.
- Pending upload service cleanup: 24 hours; pending-prefix R2 lifecycle backstop: 7 days.
- Story archive: retain verified media, omit it from ordinary lists, deny signed access while archived, and restore access with story restoration.
- Explicit Remove: durable retirement/deletion intent, object deletion, resolved intent, bounded metadata/audit retention, and no remaining usable URL.
- Current production R2 evidence already proves private-bucket, exact-origin GET/PUT CORS, Range playback, and Object Read & Write credential scope.

Only the authenticated Cloudflare action to add the seven-day pending-prefix lifecycle rule and real-device Founder media canary remain external gates. No unlimited threshold or fabricated behavior will be introduced.

## Rollback order

1. Disable the new configuration/media feature flags and runtime kill switches.
2. Restore the B1-511A immutable frontend pointer and exact WordPress route/runtime hashes.
3. Roll back the Railway service to deployment `17615414-9422-453a-9eb8-7d1b36f462a6`.
4. Preserve additive rows/objects while removing exposure; never destructively drop private data during emergency rollback.
5. Verify Founder, eligible, ineligible, anonymous, Critical Systems, and zero-`5xx` gates.

## Behaviors that must remain unchanged

Authentication, signed JWT identity, immutable StoryForge user mapping, LearnDash eligibility, WordPress roles, Matrix routing, story ownership, existing RLS, story creation, Library, Story Detail, Learning Lesson, priority, search, student voice, provider/model, transcription, audio replay, mentor review, mentor notes, current branding, reduced-motion core, and every B1-511/B1-511A privacy boundary.
