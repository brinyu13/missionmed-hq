# B1-510I Phase A Deployment and Live Voice Receipt

## Deployments

| System | Identifier | Result |
|---|---|---|
| Kinsta static release | `releases/3aeceee268ed6fd9a8eaa50138b8c00e8f13211b` | published; exact public hashes verified |
| Railway attempt | `825381fb-...` | build failed before replacing runtime because the upload root was wrong |
| Railway | `ae9f8488-ca6b-4e69-809b-ffc20daa319d` | eligible-all runtime seam deployed |
| Railway | `391474f5-...` | explicit prompt-label guard deployed |
| Railway | `35b5ecbd-...` | raw vocabulary guard deployed |
| Railway final | `80e39e8e-954f-4964-9bfc-6b7c98fac1a4` | primary contamination failover deployed; service online |

Final health response: `{"ok":true,"service":"storyforge-v5"}`.

## Live acceptance

The audited flag change to `eligible_all` successfully granted voice to the eligible student boundary without granting it to administrators or anonymous users. Real MediaRecorder uploads reached the live WordPress gateway and provider path. Several canaries were discarded without saving stories.

The physical-microphone transcript could not be matched to a controlled phrase because the chosen microphone did not reliably capture synthetic system speech. This prevents the required statements “transcription works” and “real production student canary passes.”

## Final safe state

- feature scope: `allowlist`
- allowlist count: `1`
- cohort count: `0`
- broad eligible-student voice: OFF
- reconciliation: OFF
- latest canary recording: cancelled; zero retained segments
- story created by canary: none

This receipt is therefore a deployment-and-rollback receipt, not a Phase A success receipt.
