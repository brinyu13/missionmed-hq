# 3528C Handoff to Master IV Prep On-Call

## What to mount

Mount the deployed prefab at `/iv-prep-analytics/` using the canonical Matrix/HQ cookie session. Reuse the contracts in `3528C_PREFAB_CONTRACT.md`; do not recreate analytics, WPM, recording, session persistence, Results, Library, Mentor access, or calibration in the master app.

## Stable boundaries

- Identity/auth/entitlement: MissionMed HQ session and admission registry.
- Question context: passed when creating the canonical IVOC session.
- Interviewer: `interviewerProvider` slot; current value `missionmed-static`.
- Measurement: `RealAnalyticsEngine` over the shared media stream.
- Recording: `AccountRecordingController`, same stream/time basis.
- Storage: HQ same-origin proxy to private CDN/R2.
- Results: versioned `ivoc.analytics.v1` structured payload.
- Library/replay: server-authorized student/Mentor/Admin scopes and expiring playback URLs.
- Preferences: account-persisted coaching, visibility, recording default, and calibration corridors.

## Integration acceptance already available

- Current code is live in MissionMed HQ and reachable from Matrix.
- Admin/founder entitlement and anonymous denial are production-proven.
- Real device acquisition and local Sherpa startup are production-proven.
- Security and repository contracts pass automated hostile tests.
- Railway rollback/reapply is rehearsed.

## Do not promote yet

Do not claim the complete student journey or AAA launch until:

1. The CDN worker accepts HQ-signed private uploads.
2. A recording saves, survives close/reopen, plays, seeks, and downloads.
3. Results/Library/Progress display that durable session.
4. A human completes slow/normal/fast, quiet/normal/loud, pitch/variety, face, pose, hands, gestures, smiles, nods, and pause recovery.
5. Separate entitled student, non-entitled user, and assigned/unassigned mentor personas complete live access checks.

## Current source anchors

- Frontend: `ivprep-v6/public/ivoc-standalone/`
- Real runtime: `ivprep-v6/public/ivoc-standalone/app/real-runtime.mjs`
- Recording: `ivprep-v6/public/ivoc-standalone/app/recording.mjs`
- Browser API: `ivprep-v6/public/ivoc-standalone/app/api.mjs`
- HQ routes/repository/storage: `missionmed-hq/ivoc/`
- Host: `missionmed-hq/server.mjs`
- Migration: `supabase/migrations/20260830040054_ivoc_3528c_session_recording_results.sql`
- Full operational evidence: this directory.
