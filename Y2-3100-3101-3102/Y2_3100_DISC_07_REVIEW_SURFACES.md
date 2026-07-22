# Y2-3100 DISC-07 Review Surfaces

## Review API

- **VERIFIED:** `/Users/brianb/MissionMed_worktrees/Y1-CAM-3000/Y1-CAM-4008A/candidates/cam-api/src/routes/reviews.mjs:49` through `:52` reject caller-supplied reviewer identity.
- **VERIFIED:** Lines `:67` through `:76` define exact review permissions.
- **VERIFIED:** Lines `:94` through `:141` normalize note and Order requests and enforce one Order per review context.
- **VERIFIED:** Lines `:187` through `:199` require the authenticated reviewer to hold the exact active grant.
- **VERIFIED:** Lines `:209` onward dispatch review commands; `:289` through `:309` execute note and Order mutations.
- **VERIFIED:** `/Users/brianb/MissionMed_worktrees/Y1-CAM-3000/Y1-CAM-4008A/candidates/cam-api/src/lib/mentorDirectory.mjs:98` through `:174` limits reviewer resolution to current approved public mentors.
- **VERIFIED:** `/Users/brianb/MissionMed_worktrees/Y1-CAM-3000/Y1-CAM-4008A/candidates/cam-api/migrations/20260715190000_y1_cam_4008a_integrity_expand.sql:170` through `:184` creates normalized review Orders and a one-active-Order uniqueness rule.
- **VERIFIED:** The reviewer RPC functions are defined in `20260713120000_y1_cam_4004_runtime_closure.sql:315` through `:425` and later hardened by 4008A migrations.

## Frontend Review Donors

- **VERIFIED:** `/Users/brianb/MissionMed_worktrees/Y1-CAM-3000/Y1-CAM-4008A/candidates/cam-hq/public/cam/index.html:1149` through `:1217` contains the review-facing views.
- **VERIFIED:** `/Users/brianb/MissionMed_worktrees/Y1-CAM-3000/Y1-CAM-4008A/candidates/cam-hq/public/cam/cam-dev-adapter.js:1722` through `:1892` handles grant creation, review opening, attributed notes, and one Order.

## Y2 Attachment Analysis

- **INFERENCE:** A future Interview Event Summary and Focus Follow-Through panel belongs in an exact-grant reviewer projection, not in an unrestricted model-output endpoint.
- **INFERENCE:** Instructor pre-session configuration should be a separately authorized interview-plan object. It should not masquerade as a mentor note, Order, or broad review grant.
- **INFERENCE:** A future model may propose bounded evidence for review but cannot become the attributed mentor, create an Order, or expose unreviewed raw output.
- **INFERENCE:** A conforming Y2 review projection must preserve artifact-specific, revocable, consent-bound, and non-enumerating authorization.
- **UNKNOWN:** No current CAM review surface implements Y2 Event Summary or Focus Follow-Through semantics.

## Boundary Verdict

The review lane is a viable future projection point. It is not evidence that instructor visibility, adaptive interview summaries, or a production mentor workflow for Y2 currently exists.
