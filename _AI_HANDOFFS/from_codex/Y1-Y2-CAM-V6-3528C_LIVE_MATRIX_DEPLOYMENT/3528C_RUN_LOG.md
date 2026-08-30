# 3528C Run Log

## Outcome

The frozen 3528B interface is live as an authenticated MissionMed HQ module, connected to the real analytics engines, durable session/result/recording persistence, private R2 media, Results, Library, and Matrix. The former production media `401` is closed. Full AAA acceptance remains pending only where human metric actions and separate live identities were not observed.

## Immutable release facts

- Branch: `codex/y1-y2-cam-v6-3521-live-analytics-runtime`
- Deployed source commit: `a9a3e41e771e95c346cb74ee40468e1c1177348c`
- Frozen frontend baseline: `83265dfe9777c9bccc06ec65dc6d972bc4eac777`
- Production URL: `https://missionmed-hq-production.up.railway.app/iv-prep-analytics/`
- Railway deployment: `33ed7dcd-41cb-410d-a309-29e3d019065c`
- Image: `sha256:8fb93c570ed5fef6c98115851466be2cf86ae7981000bc1b40d9a4f5d62159d6`
- Matrix route: `IV Prep On-Call` -> `/iv-prep-analytics/#/home`
- Supabase migration: `20260830043305` from `20260830040054_ivoc_3528c_session_recording_results.sql`
- Private media: existing `missionmed-cam-production` R2 bucket, `ivoc/recordings` prefix
- Paid provider sessions: `0`
- Donor 3440 modified: `NO`

## Final repair chronology

1. Preserved unrelated staged/untracked worktree state.
2. Diagnosed the custom CDN query-signing seam as incompatible with the production private-media endpoint.
3. Reused the existing private R2 bucket and existing provisioned credentials; no new provider or migration.
4. Implemented server-side S3 SigV4 multipart initiate/upload/complete/HEAD and authenticated same-origin range playback.
5. Passed a real local R2 round trip and the focused `11/11` server suite.
6. Committed/pushed only the four repair files at `a9a3e41`.
7. Deployed from a clean archive of that exact commit.
8. Verified `/health` 200, anonymous denial 401, zero observed 5xx, and zero matching production error logs.
9. Captured and sealed two real production recordings (two-part and six-part), persisted structured Results, reopened Library detail, and streamed private playback as `206 video/webm`.
10. Started a fresh physical analytics session. Camera/microphone and Sherpa readiness were live; no human speech/action signal was observed, so WPM/voice/CV semantic rows remain pending.
11. Released GLOBAL epoch 515 normally; provider table readback reported released, expired, inactive, and zero active leases.

## Test ledger

| Gate | Current result |
|---|---|
| Focused 3528C suite | `3/3 PASS` |
| MissionMed HQ IVOC suite | `11/11 PASS` |
| Historical full `ivprep-v6` baseline before the repair | `529/529 PASS` |
| Post-repair full-suite attempt | Interrupted after 78 passes for Founder serialization; not claimed as a completed run |
| Historical analytics syntax/module check | `PASS`, 65 modules |
| Historical local word-timing focused suite | `20/20 PASS` |
| Production `/health` | `200 {"status":"ok"}` |
| Production anonymous IV Prep request | `401 ivprep_authentication_required` |
| Authenticated Matrix -> IV Prep | PASS as Admin/founder entitlement |
| Production recording storage/replay | PASS |

## Truth boundary

No paid transcription or avatar provider was invoked. Device, engine, automated, and storage evidence does not equal human semantic acceptance. The release is `LIVE_WITH_HUMAN_ACCEPTANCE_PENDING`, not `AAA_FULL_ACCEPTANCE`.
