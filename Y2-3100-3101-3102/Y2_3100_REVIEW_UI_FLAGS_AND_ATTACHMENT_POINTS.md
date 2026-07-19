# Y2-3100 Review, UI, Flags, And Attachment Points

## Review

Reviewer identity is directory-derived and write authority is grant-bound at `/Users/brianb/MissionMed_worktrees/Y1-CAM-3000/Y1-CAM-4008A/candidates/cam-api/src/routes/reviews.mjs:187`. The database enforces one human Order per lawful review context at `migrations/20260715190000_y1_cam_4008a_integrity_expand.sql:371`.

The Brain may produce evidence-linked turn decisions and an instructor summary. It cannot create an Order, convert an observation into coaching, or publish a learner judgment.

## UI

Current `cast`, `meet`, and `room` surfaces are scripted at `candidates/cam-hq/public/cam/index.html:651`; the shell owns a single media stream at `:1418`. There is no accepted adaptive interviewer surface. Phase 0 therefore exposes only a local instructor-readable report, with no student UI.

## Flags

`candidates/cam-api/src/config.mjs:151-178` explicitly marks transcript and AI storage unimplemented. No `CAM_INTERVIEWER_*`, LiveKit, ElevenLabs, STT, TTS, model-provider, voice, or avatar runtime exists.

Any later flags must be server-side, false when absent or unknown, and incapable of activation from a URL, frontend state, Matrix, Arena, or user metadata. Rollback must disable acceptance and publication while deletion remains active.

## Future Attachment Points

1. Existing CAM API gateway and authority session.
2. Purpose-specific consent receipt.
3. CIE clock/track-item/Moment adapter.
4. Private Brain worker with least-privilege job contract.
5. Explicit mentor review grant and safe projection.
6. Existing audit/deletion orchestrator.
