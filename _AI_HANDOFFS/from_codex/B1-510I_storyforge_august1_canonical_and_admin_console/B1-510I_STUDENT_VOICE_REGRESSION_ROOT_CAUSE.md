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

## Acceptance failure, correction, and final PASS

Real browser recordings reached the production WordPress gateway, R2/transcription pipeline, and cleanup lifecycle. The primary transcription provider returned prompt-contaminated or otherwise non-verifiable text during successive canaries. Three bounded backend protections were added and deployed:

1. reject explicit prompt labels;
2. reject raw multi-term vocabulary echoes;
3. send contaminated primary results through the existing accepted Whisper fallback.

The selected physical browser microphone did not reliably capture macOS synthetic speech. The resulting transcript therefore could not be certified against a controlled spoken phrase. No private transcript text is reproduced in repository evidence.

Because B1-510I required a real, recognizable student transcript before broad activation, the feature was initially restored through the audited endpoint to `allowlist:1:0`. The Founder then completed the physical-microphone canary and supplied the binding assessment `PASS — accurate and usable`. The saved transcript persisted.

## Final state

The audited voice flag is now `eligible_all:0:0`. Founder student, Ignacio, and a second eligible student report `voiceCapture=true`; the Founder administrator remains voice-disabled. Transient R2 and segment counts are zero, cross-user direct-ID access is 404, and Critical Systems has zero failures. The saved original-audio Library replay issue remains a separate narrow defect.
