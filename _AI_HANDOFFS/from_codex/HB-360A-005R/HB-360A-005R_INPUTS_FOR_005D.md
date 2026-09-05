# HB-360A-005R Inputs for HB-360A-005D

Status: NOT READY TO EXECUTE. These are confirmed inputs, not implementation authority.

## Authority and phase order

- 005B is the design-only authority set.
- 005C, 005D, and 005E exist as blocked non-executing routes at MissionMed OS `6fd4563aac2154f2e7826c0f8069e24f0ce3d51c`.
- 005D requires Founder approval of 005B and 005C plus closure of non-deferred 005R P0 gates.
- 005E governs pilot after D2 and production acceptance after D5; neither is authorized by 005D registration.

## Media and delivery

- Preserve `/api/drills` until its Drills/Daily/Arena consumers have migrated and passed authenticated student-browser testing.
- MMVS internal consumers are HQ Content Studio routes; `/review/queue` has no located consumer.
- Reconciliation target: ten live-only IDs in `HB-360A-005R_MMVS_RECONCILIATION_MANIFEST.json`; import references to `media_sources.legacy_registry_ref`; delete nothing.
- Establish a tracked MMVS source/build manifest and commit-bearing `/healthz` before containment.
- Use separately materialized Cloudflare Stream clip UIDs for cross-audience ranges. Client-side range locks are not authorization.
- Require signed playback, explicit allowed origins, an approved watermark profile, and documented revocation/retention. Do not assume signing keys or watermark profiles are currently configured.
- Do not add a separate launch Delivery Gateway unless later evidence proves a separately authorized need.

## Identity and security

- HomeBase WP-user enrollment index is non-unique; carry this as a D1 identity-model input.
- `hb_own_enrollment_ids()` remains SECURITY DEFINER with PUBLIC execution; propose minimum-role revoke in the 005D identity/security migration.
- JWT `jti` is UUID-shape-only; design a revocation/replay ledger before relying on it as an anti-replay control.
- Add `static_release`, `api_release`, `migration_head`, and nullable `worker_release` to `/healthz`, plus a release-receipt ledger/convention and CI approved-set check, only after runtime source and migration head are proven.
- Do not reuse Growth Engine media tables or the RankListIQ resolver for Wave 2.

## Webex

- Current site enables recording transcripts, AI notes/action items, chapters, and automatic AI Assistant.
- App type, scopes, webhooks, secret validation, auto-record, ownership, retention, consent, and intended-host scheduling remain unknown.
- Proposed minimum scopes are schedules, participants, recordings, and transcripts in the intended service-app model; obtain native developer/Control Hub readback first.

## Key and project-reference locations

Values were never retained. Search/review these locations before any rotation:

- HQ `server.mjs`, routes, auth/client libraries, validation scripts, contracts/manifests/logs.
- MMVS pipeline modules for drill registry and transcript indexing.
- Environment-file locations in HQ and `VIDEO_SYSTEM`, including backups; inspect values only inside an approved secret-handling process.
- WordPress/public proxy source that currently forwards `/api/drills`.

## Required closures before D1

1. MMVS source/deploy custody and class-specific containment with N17.
2. Growth RLS/grants/key dependency migration with N18 and clean advisor result.
3. RankList resolver caller proof and anon/PUBLIC revoke negative test.
4. HomeBase runtime source, migration head, and lineage branch patch.
5. Webex developer/Control Hub truth.
6. Cloudflare signing-key/watermark/per-video privacy truth.

G-RT may remain a documented condition only while the Matrix host is deferred; it must close before Matrix-host activation.
