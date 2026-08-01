# B1-510I Student Voice Regression Root Cause

## Finding

The missing eligible-student recorder was caused by production feature scope:

- mode: `allowlist`
- allowlist members: `1`
- cohort scopes: `0`
- trusted eligible StoryForge students: `440`

The application bundle, WordPress route, JWT bridge, identity mapping, API configuration, provider configuration, and browser cache were not the source of the role difference. The server's production flag service also did not explicitly opt into the already-implemented `eligible_all` mode until B1-510I.

## Repair attempted

Commit `3aeceee` explicitly wires `allowEligibleAll: true` into the production flag service and adds tests proving that the scope is student-only. The audited admin flag endpoint was used to change the production scope to `eligible_all`. A non-Founder eligible student then received HTTP 200, a trusted eligible-student identity, and `voiceCapture=true`. Administrators remained voice-disabled; anonymous access remained HTTP 401.

## New acceptance failure and rollback

Real browser recordings reached the production WordPress gateway, R2/transcription pipeline, and cleanup lifecycle. The primary transcription provider returned prompt-contaminated or otherwise non-verifiable text during successive canaries. Three bounded backend protections were added and deployed:

1. reject explicit prompt labels;
2. reject raw multi-term vocabulary echoes;
3. send contaminated primary results through the existing accepted Whisper fallback.

The selected physical browser microphone did not reliably capture macOS synthetic speech. The resulting transcript therefore could not be certified against a controlled spoken phrase. No private transcript text is reproduced in repository evidence.

Because B1-510I requires a real, recognizable student transcript before broad activation, the feature was immediately restored through the audited endpoint to `allowlist:1:0`. The latest recording canary was cancelled, its segments were removed, and no story was saved.

## Smallest remaining action

With an allowlisted Founder student session, speak a short, non-private controlled phrase directly into the selected physical microphone. Confirm the returned transcript is faithful, then repeat cleanup/R2/orphan checks. Only after that pass may the scope be changed to `eligible_all` and the Critical Systems release identity updated.
