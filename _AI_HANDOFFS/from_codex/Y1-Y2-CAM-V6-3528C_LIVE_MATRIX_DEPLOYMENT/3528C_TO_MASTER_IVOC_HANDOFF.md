# 3528C Handoff to Master IV Prep On-Call

## What to mount

Mount the deployed prefab at `/iv-prep-analytics/` using the canonical Matrix/HQ cookie session. Reuse `3528C_PREFAB_CONTRACT.md`; do not recreate analytics, WPM, recording, persistence, Results, Library, Mentor access, or calibration in the master app.

## Stable boundaries

- Identity/auth/entitlement: MissionMed HQ session and admission registry.
- Question context: canonical IVOC session.
- Interviewer: `interviewerProvider` slot; current value `missionmed-static`.
- Measurement: `RealAnalyticsEngine` over the shared media stream.
- Recording: `AccountRecordingController`, same stream/time basis.
- Storage: HQ same-origin boundary to private R2 S3 multipart and authenticated playback proxy.
- Results: versioned `ivoc.analytics.v1` structured payload.
- Library/replay: authorized Student/Mentor/Admin scopes and expiring playback URLs.
- Preferences: account-persisted coaching, visibility, recording default, and calibration corridors.

## Integration acceptance available now

- Current code is live in MissionMed HQ and reachable from Matrix.
- Admin/founder entitlement and anonymous denial are production-proven.
- Real device acquisition and local Sherpa startup are production-proven.
- Real private-media save, seal, Library, reopen, and replay are production-proven.
- Security and repository contracts pass focused hostile tests.
- Railway rollback/reapply mechanism is rehearsed on the prior 3528C artifact.

## Remaining acceptance before unqualified AAA claim

1. Human slow/normal/fast, quiet/normal/loud, pitch/variety, face, pose, hands, gestures, smiles, nods, and pause recovery.
2. Separate entitled student, non-entitled user, and assigned/unassigned mentor personas.
3. Timestamp seek and explicit download-button physical UX, if required as separate gates.
4. Artifact-specific rollback/reapply of deployment `33ed7dcd...`, if policy requires repetition rather than the already-proven mechanism.

## Current source anchors

- Frontend: `ivprep-v6/public/ivoc-standalone/`
- Real runtime: `ivprep-v6/public/ivoc-standalone/app/real-runtime.mjs`
- Recording: `ivprep-v6/public/ivoc-standalone/app/recording.mjs`
- Browser API: `ivprep-v6/public/ivoc-standalone/app/api.mjs`
- HQ routes/repository/storage: `missionmed-hq/ivoc/`
- Host: `missionmed-hq/server.mjs`
- Migration: `supabase/migrations/20260830040054_ivoc_3528c_session_recording_results.sql`
- Operational evidence: this directory.
