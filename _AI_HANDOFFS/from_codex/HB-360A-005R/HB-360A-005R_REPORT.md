# HB-360A-005R Execution Report

RESULT: PARTIAL

SUMMARY: The governance unblock, authority registration, privacy-safe reads, consumer discovery, provider truth, and reconciliation manifest are complete. Product/provider security mutations were not promoted past proposal where source identity, caller dependency, live-flow preservation, or a provider control-plane fact remained unproven.

RECOMMENDATION: NO-GO for HB-360A-005D.

## Control-plane prerequisite

- Global lint forward repair: PASS. MissionMed OS moved from `a282fc6e984a6417091bffcfc97cc2eed1db071a` through repair `be54e718ac68885d01473a55452688181bccb8f6` to closeout `275b92a0a72cd4bd9477ca8ba0e0118917d9fe9e`.
- Exact Constitution Revision 3 was restored; SHA-256 `aea2be8e5e75495b2dee63f48de6c9ea63883c90c4b6f1d7ab4daa1989c232ce`.
- HQ Constitution custody commit: `e71b3902f40e82e4d27813cc54aa836bc13d2c35`.
- Initial 005R registration: OS commit `c0e0710112ccecd04e630e7aa4011d2936dab1ab`; DR-187/188; active mission/profile/product/authority/CURRENT routes.
- Full phase registration: OS commit `6fd4563aac2154f2e7826c0f8069e24f0ce3d51c`; 005B design authority and blocked non-executing 005C/005D/005E routes.
- BOOT/lint/enforcement: universal lint PASS, report-only enforcement PASS, and BOOT profiles 005R/005C/005D/005E PASS.
- Lease truth: expired epochs were preserved in receipts; filing epoch 1269 released successfully; provider readback returned zero active leases and zero waiters.
- Output custody: PATH epoch 1270 expired during authoring; fresh exact twelve-file filing fence 1274 was acquired for validation, commit, push, readback, and release.
- MR-079 SHA-256: `9638e67841e98b278244c0d4f9ecd0ccbdc7a9e17c50a67dd45d1d31895a0357`.

## WP-1 — Matrix runtime-lock reconciliation

Classification: CONFIRMED drift; UNKNOWN cause; mutation BLOCKED.

Current public hashes:

- student shell JS: `38507e1ac8a555baa4eca6015c8cefd014e414a2d3159929f3cd451a47ad937a`
- student shell CSS: `707ab52f7157db618be307f83548b2410d5cdb82359fc6c0f47025996c275260`
- shared PHP class: `b3f797c7ef5ff1ebadd6b482aa95f283273201d536ad5749c83926e96c4ac02d`
- calendar JS: `6a1ca3d7e4b955ea4cbea13f956b08f1533b638264d94c11ded5ead6703cb480`
- calendar CSS: `b6a858491aade89770383b498433578a657d87b71d738dc71b49c216f420598e`

The dirty-root manifest hash, canonical origin/main manifest, and two dedicated branch manifests diverge. The guard returned BLOCKED. Exact required approval phrase:

`Brian explicitly approves Matrix runtime lock override for <ticket> and <asset keys>.`

Proposal: after that phrase, re-fetch the exact public bytes and deployment receipt, select either manifest-forward alignment or locked-byte redeploy, execute only the selected asset keys, and verify all three hashes agree. Mutation: NONE. Rollback: `ROLLBACK_WP1_MATRIX_RUNTIME_LOCK.md`.

## WP-2 — Mission and authority registration

Classification: CONFIRMED and CLOSED.

Reads established the current registry schema, canonical Matrix product route, DR-187 sibling-ticket authority, Lease V2 registrar contract, and phase definitions in master sections 34–35 plus the architecture manifest. Writes were control-plane only:

- 005R remains active under DR-187/188.
- 005B is recorded as the design-only authority artifact set.
- 005C, 005D, and 005E are registered as blocked, non-executing routes with explicit activation conditions; registration confers no future product/provider lease.

Readback: feature branch and origin/main both resolve `6fd4563aac2154f2e7826c0f8069e24f0ce3d51c`; four mission BOOT profiles pass; REGISTRY released; provider clear. Receipts: `HB-360A-005R_RECEIPTS/`. Rollback: `ROLLBACK_WP2_AUTHORITY.md`.

## WP-3 — MMVS containment and registry reconciliation

Classification: CONFIRMED exposure and consumers; BLOCKED containment.

Runtime origin: `https://mmvs-backend-production.up.railway.app`. Safe metadata checks:

| Route | Anonymous observation | Consumer class | Consumers found |
|---|---|---|---|
| `/api/drills` | 200 JSON; 97 rows; schema/count only retained | STUDENT_FACING_CONSUMER | Drills, Daily, Arena variants, public WordPress proxy |
| `/videos` | 200 JSON; 313 IDs; no titles/paths retained | INTERNAL_CONSUMER | authenticated HQ Content Studio bridge |
| `/transcripts/{asset_id}` | 404 for a fabricated ID, not an auth denial | INTERNAL_CONSUMER | authenticated HQ bridge |
| `/api/media/search` | 422 missing-query validation, not an auth denial | INTERNAL_CONSUMER | authenticated HQ bridge |
| `/review/queue` | 200; aggregate counts/schema only retained | NO_CONSUMER | no consumer found in searched HQ/plugin/student surfaces |
| `/health` | 200 | NO_CONSUMER for public detail | direct health observation only |

The health payload identifies version 0.1.0, R2/OpenAI/local-whisper/watcher configuration states, but exposes no deploy commit; current backend source is locally ignored and has no proven Git/build custody. The public WordPress proxy forwards `/api/drills` to Railway without authentication. Current containment would risk live student flows, so no route was restricted.

Registry result: live 313 unique IDs, local ignored snapshot 303 unique IDs, ten live-only, zero local-only. The ID-only manifest is `HB-360A-005R_MMVS_RECONCILIATION_MANIFEST.json`; nothing was deleted.

Proposal: establish source/build custody; migrate internal consumers to an authenticated service actor; feature-flag the student route behind authenticated actor plus explicit MissionMed origins; browser-test a student persona; then close public/internal access by class, refuse untrusted-origin credentialed CORS, publish commit-bearing `/healthz`, and import registry references to `media_sources.legacy_registry_ref` in 005D. Mutation: NONE. N17: FAIL/NOT RUN because current public posture is not contained. Rollback: `ROLLBACK_PENDING_PROVIDER_MUTATIONS.md`.

## WP-4 — Growth Engine media-table isolation

Classification: CONFIRMED high-risk configuration; mutation BLOCKED.

Supabase project `plgndqcplokwiuimwhzh` has eight `media_*` tables. All eight have RLS disabled, no policies, and SELECT/INSERT/UPDATE/DELETE grants to anon and authenticated. Safe row counts were 2 clips, 0 playlist items, 2 playlists, 0 tags, 0 transcript chunks, 4 user-state rows, 2 user-video-tag rows, and 0 video-tag rows. No row content was read.

`match_media_transcript_chunks(query_embedding vector, match_count integer)` is SECURITY INVOKER and executable by anon/authenticated. Key/project references occur in HQ, MMVS pipeline/client code, contracts, manifests/logs, and environment-file locations; no values were printed.

Proposal: complete dependent-client inventory, apply deny-by-default RLS and grant revocation in a reviewed migration, gate any proven client before revocation, then rotate distributed keys with owner-approved cutover. Mutation: NONE because breaking unknown clients or rotating incompletely would be unsafe. N18: FAIL in current posture. Advisor: critical findings remain. Gate: OPEN.

## WP-5 — RankListIQ identity resolver

Classification: CONFIRMED resolver/grants; STRONG INFERENCE for no active browser caller; mutation BLOCKED.

Project `fglyvdykwgbuivikqoah` exposes `public.resolve_supabase_user_uuid(text,text)`, SECURITY DEFINER, search path `public, auth`, definition MD5 `961b140d15fc9d8b3740bfaa585be03c`. EXECUTE is granted to PUBLIC, anon, authenticated, postgres, and service_role. The function reads WordPress metadata/email from `auth.users` and does not check `auth.uid()`.

The RPC is declared in migration/Arena artifacts, but current Arena resolution uses `supabase.auth.getUser()` and no active `.rpc('resolve_supabase_user_uuid')` call was found. That is not proof that no live caller exists.

Proposal: prove callers, migrate/gate any dependent surface, revoke PUBLIC/anon/authenticated execution, restrict to the service actor, and pin `search_path` to the minimum including `pg_temp`; verify anon denial. Mutation: NONE. N18: FAIL. Gate: OPEN.

## WP-6 — HomeBase lineage and identity ambiguity

Classification: CONFIRMED partial lineage and identity defects; BLOCKED branch patch.

- Existing read-only source worktree HEAD: `e869d63b92f72acd55b2004b035941d72ecbe421`.
- Previously claimed deployment source `112921f1423a5f341cbcff8064c16ac9efa5edf7` is an ancestor of `e869d63`; their differences are static/WordPress artifacts, not API/migrations.
- Railway API deployment is successful, but its image has no source-repository/commit metadata. `/healthz` returns service/database health only, not release lineage.
- Live `hb_enrollments_wp_user` is a non-unique partial index.
- `hb_own_enrollment_ids()` is SECURITY DEFINER with `search_path=public, pg_temp`; PUBLIC EXECUTE remains.
- No migration-ledger table exists, so the live migration head cannot be proven.
- JWT `jti` is shape-checked as a UUID but there is no revocation/replay ledger.

Proposal: first establish the authoritative release branch and current runtime source/migration head; then add branch-only lineage health fields, a release-receipt convention/table, and CI mismatch checks. Carry the non-unique identity map, resolver grant, and jti ledger into D1. Mutation: NONE. Gate: OPEN.

## WP-7 — Provider truth

Classification details are in `HB-360A-005R_PROVIDER_TRUTH.md`.

- Webex: meeting scheduling and transcript/AI settings exist; service-app, scope, webhook, ownership, retention, consent, and multi-host facts remain unproven. OPEN.
- Cloudflare: R2 and Stream are present; clip-by-range capability is confirmed by provider documentation. Current signing-key/watermark/per-video restrictions are unproven; R2 video delivery is public with wildcard read CORS. OPEN.
- CIE/Studio: hosted backend/frontend exist; protected unified routes deny unauthenticated requests; HQ points to the backend. CLOSED, with a low-severity health metadata disclosure noted.
- Scheduler staging/CAM dev: donor security posture reviewed read-only; CAM is the stronger least-privilege donor. No writes.

## Mutations and approvals

The only completed mutations were the Founder-authorized control-plane/global-lint transactions. No Matrix, MMVS, Growth, RankListIQ, HomeBase product branch, Webex, Cloudflare, CIE, Scheduler, or CAM configuration/database/source write occurred. This report does not convert proposals into approval.

## Final decision

G-AUTH and G-CIE are CLOSED. G-RT is an allowed documented deferral only for the Matrix host. G-MMVS, G-GROWTH, G-RLIQ, G-HB-ID, G-WEBEX, and G-CF remain P0 OPEN, so 005D is NO-GO.
