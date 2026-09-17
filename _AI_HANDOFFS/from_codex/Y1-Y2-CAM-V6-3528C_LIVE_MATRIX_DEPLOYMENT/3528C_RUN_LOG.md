# 3528C Run Log

## Outcome

The frozen 3528B interface was mounted as an authenticated MissionMed HQ module, connected to the existing real analytics engines, backed by additive server-side session/result/recording persistence, activated from Matrix, and deployed to Railway. The release is usable for authenticated Admin analytics review but is not end-to-end accepted because the production CDN rejects valid-looking private-media signed PUTs with `401 Unauthorized`.

## Immutable release facts

- Branch: `codex/y1-y2-cam-v6-3521-live-analytics-runtime`
- Deployed source commit: `7d7ff104b9a1d4a8897915672e35436901c7844c`
- Frozen frontend baseline: `83265dfe9777c9bccc06ec65dc6d972bc4eac777`
- Production URL: `https://missionmed-hq-production.up.railway.app/iv-prep-analytics/`
- Final Railway deployment: `646ac336-9afd-4db5-9ac1-cdaa20ab12a3`
- Final image: `sha256:dba943d20cbfe2d99e9e22f4f773a1e926dea8af640f839a0c8fdca164f80979`
- Matrix route: `IV Prep On-Call` -> `/iv-prep-analytics/#/home`
- Supabase migration: `20260830043305` from `20260830040054_ivoc_3528c_session_recording_results.sql`
- Paid provider sessions: `0`
- Donor 3440 modified: `NO`

## Execution chronology

1. Preserved the unrelated staged/untracked worktree state and established the pre-mutation Railway, Matrix, Supabase, and source baselines.
2. Registered the bounded 3528C authority/write set and used Lease V2 keepers for product, backend, routing, Matrix, and documentation paths.
3. Added the authenticated frontend/API boundary, real analytics adapter, recording controller, durable server repository/storage/routes, additive Supabase schema, and Matrix handoff.
4. Applied the migration with RLS enabled and all browser-role grants revoked.
5. Activated the guarded Matrix route after creating immutable production backups and validating source/deployed hashes.
6. Deployed the MissionMed HQ service. A wrongly rooted CLI archive produced one short failed deployment (`34e9103c-3559-4c30-a16d-62b025b9b01f`); the canonical repository-root deploy immediately restored service.
7. Fixed same-origin recording upload proxying, the established private-media key format, canonical CDN target, sanitized upstream diagnostics, and Railway packaging of the Sherpa vocabulary.
8. Verified authenticated Admin Matrix entry, anonymous denial, real device acquisition, and production Sherpa engine readiness.
9. Recorded a real browser media blob. Final upload failed after bounded retries because the canonical CDN returned `401`; the blob remains in the originating Chrome tab for retry and was not represented as saved.
10. Rehearsed Railway rollback to prior known-good image `sha256:be571da5...` as deployment `06d5c9b3-019c-4940-bff0-f156a4830949`, verified `/health`, then reapplied exact current image as `646ac336-9afd-4db5-9ac1-cdaa20ab12a3` and verified `/health` plus anonymous `401` again.

## Test ledger

| Gate | Current result |
|---|---|
| Full `ivprep-v6` suite | `529/529 PASS` |
| Focused 3528C suite | `3/3 PASS` |
| MissionMed HQ IVOC suite | `9/9 PASS` |
| Analytics syntax/module check | `PASS`, 65 modules |
| Local word-timing focused suite | `20/20 PASS` |
| Production `/health` | `200 {"status":"ok"}` |
| Production anonymous IV Prep request | `401 ivprep_authentication_required` |
| Authenticated Matrix -> IV Prep | `PASS` as Admin/founder entitlement |
| Production recording upload | `BLOCKED`, upstream CDN `401` |

## Truth boundary

No paid transcription or avatar provider was invoked. Local/automated/device evidence does not equal human physical acceptance. The final release status is `BLOCKED`, not `LIVE_ACCEPTED`.
