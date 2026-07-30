# B1-507A Current Implementation State

Date: 2026-07-29

## Verified Git state

| Field | Value |
|---|---|
| Repository/worktree | `/Users/brianb/MissionMed_worktrees/B1-StoryForge-502` |
| Branch | `codex/b1-503-storyforge-product-recovery` |
| Local HEAD | `82669485c187cd3127ab2c84cb79864d827e0aef` |
| Upstream | `origin/codex/b1-503-storyforge-product-recovery` |
| Upstream SHA | `0bd7da46b5f25122ad53cd73f8eaf6eb1f546409` |
| Divergence | 18 ahead, 0 behind |
| Pre-dossier state | Clean |
| Current untracked content | Only this B1-507A dossier and screenshots |
| Application-source commit | `df42c5e05dd11f63c7ea17f99127e43e2d03347c` |
| Deterministic release candidate | `v-0892c26c62d96206` |
| GitHub custody | Local candidate is not yet pushed; branch is unprotected; no StoryForge PR/check/release was found |

## Build and artifact state

- Generated app JavaScript SHA-256: `3ae148bb…`
- Generated auth JavaScript SHA-256: `d2cfc4…`
- Generated CSS SHA-256: `08a392…`
- Canonical V5 SHA-256: `3ac2871ff286552abe89a785ff43967df3315922e3718f67a136b83db1ba8db1`
- V5.5 prototype SHA-256: `0df61b561b2a6dfa3e132255381bef05028fd384597adfc8969929c646129c90`
- V5.5 r2 prototype SHA-256: `95104069500fdca8b92dbe81d5ce9ee7701a5f97400e1d1653414d19d4f13c0b`
- The deterministic candidate and B1-506C handoff exist locally. Production remains on the B1-503 release and does not contain these assets.

## Latest recorded verification at this HEAD lineage

| Suite | Result |
|---|---:|
| Unit | 189/189 passing across 26 files |
| PostgreSQL | 150/150 passing: 67 authorization + 71 B1-503 conformance + 12 TAP |
| Browser E2E | 45/45 passing across 8 specs |
| Product conformance | 72/72 passing |
| B1-506C authorized ledger | 36/36 implemented |

The integration script was not freshly rerun because it performs prohibited destructive local-container teardown. A historical 7/7 is not current real-voice evidence. The voice browser tests use fake microphone/provider/storage/assembly boundaries. No real provider, R2, WordPress multipart/DELETE, physical-device, or production voice test has passed.

## Migrations in the release candidate

The candidate includes:

- `storyforge-v5/infra/postgres/migrations/20260729000100_b1_506_voice_recording_sessions.sql`
- `storyforge-v5/infra/postgres/migrations/20260729000200_b1_506_feature_flags.sql`
- `storyforge-v5/infra/postgres/migrations/20260729010000_b1_506a_voice_audit_lifecycle.sql`

Fresh production inspection found only the five B1-503-era migration rows. `sf_recording_sessions`, `sf_recording_segments`, and `sf_feature_flags` do not exist in production.

## Live production baseline

| Component | Current state |
|---|---|
| Git commit | `6f45dbbd2150ba11000236a4959f70434f6edb77` |
| Release ID | `v-0912286e7dfc2327` |
| Railway API | `storyforge-v5-api`, successful deployment, exactly one observed running instance |
| Production PostgreSQL | PostgreSQL 18.4; five applied migrations; 25 RLS tables; one user; zero stories/drafts/notifications/audit/mentor assignments |
| Kinsta pointer | `releases/6f45dbbd2150ba11000236a4959f70434f6edb77` |
| Live route | `https://missionmedinstitute.com/storyforge/` |
| Live voice state | `audioAvailable: false`; provider/R2/reconciliation variables absent |
| Cloudflare | No StoryForge Worker or Worker route found |
| R2 | No StoryForge audio bucket found |
| OpenAI | No StoryForge-scoped project/key verified |

Live health is consistent with a healthy B1-503 text product: `/healthz` returns 200, the Railway root returns 404, `/api/config` reports audio unavailable and all AI disabled, `/api/stories` requires authentication, and unapproved origins fail.

## Generated integration files

- `storyforge-v5/infra/wordpress/missionmed-storyforge-route.php`
- `storyforge-v5/infra/wordpress/missionmed-storyforge-sso/missionmed-storyforge-sso.php`
- deterministic `storyforge-v5/dist/` release assets
- release/rollback scripts and the B1-506C rollback amendment

The WordPress route is generated and safe for the current JSON text API, but it currently permits only GET/POST/PATCH and requires JSON for POST/PATCH. That makes it incompatible with Phase 1’s multipart segment upload and DELETE audio endpoint.

## Manifest state

`_SYSTEM/CRITICAL_SYSTEMS_MANIFEST.json` is not current enough for Phase 1 cutover. It contains B1-503-era hashes/release data and a pending Cloudflare Worker decommission state contradicted by the fresh Cloudflare inspection. It must be refreshed through its authorized generation path; it must not be hand-edited.
