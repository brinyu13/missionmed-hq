# Y2-3100 DISC-09 Privacy and Retention

## Existing Evidence Contract

- **VERIFIED:** `/Users/brianb/MissionMed_worktrees/Y1-CAM-3000/Y1-CAM-4008A/4008A_CAPTURE_TIMELINE_AND_PROVENANCE_CONTRACT.md:7` through `:22` defines clock provenance.
- **VERIFIED:** Lines `:24` through `:43` define immutable media-revision facts including a consent reference.
- **VERIFIED:** Lines `:45` through `:59` define measurement provenance.
- **VERIFIED:** Lines `:61` through `:72` separate capture terminal state, durable persistence, provider lifecycle, and deletion evidence.
- **VERIFIED:** The inspected CAM migrations and mounted routes do not contain a current `cam_consent_receipts` table or consent command family.
- **UNKNOWN:** A current automatic retention duration cannot be derived from the inspected code. Provider objects persist until an explicit deletion workflow or provider policy removes them.

## Required Y2 Consent Purposes

The following is a draft requirement for later legal/founder review, not settled policy:

1. Live microphone capture.
2. Live camera capture when enabled.
3. Cloud media storage.
4. Transcript generation and retention.
5. Automated assistive interview processing.
6. Instructor or mentor review.
7. Optional applicant-pack use.
8. Any separately authorized research use.

- **VERIFIED:** The governing consent doctrine distinguishes membership or entitlement from consent.
- **INFERENCE:** A conforming Y2 consent receipt must bind each purpose to an immutable policy hash/version, subject, scope, grant time, withdrawal state, expiry where applicable, and server authority.
- **VERIFIED:** The governing CAM doctrine keeps optional physiological telemetry independent and owner-private by default; it does not inherit general media or mentor consent.
- **INFERENCE:** Withdrawal during a session should stop new capture and processing, revoke provider capabilities and review grants, seal the ledger truthfully, and start deletion closure.
- **INFERENCE:** Data minimization requires raw sensitive applicant answers not to be retained merely because the response was refused. The current synthetic harness reproduced that privacy defect and is not pilot-ready.
- **VERIFIED:** The amended pilot law requires consent and retention text to be reconciled before a ten-student pilot; the current pilot protocol remains blocked.

## Data Classification

| Data | Minimum classification | Current status |
|---|---|---|
| Audio/video | sensitive student media | Existing CAM provider boundary only |
| Transcript | sensitive derived artifact | Unmounted/inactive |
| Applicant pack | sensitive educational/profile data | Synthetic-only harness input |
| Turn ledger | sensitive decision and conversation record | Isolated local harness only |
| Instructor report | sensitive human-review projection | Synthetic local output only |
| Model/guard traces | restricted operational evidence | Must exclude secrets and hidden reasoning |

## Boundary Verdict

The provenance doctrine is useful, but runtime consent and retention for the adaptive interviewer are absent. That absence independently blocks any student pilot.
