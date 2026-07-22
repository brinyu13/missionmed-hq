# Product Passport

RESULT: `TRUTHFUL_LOCAL_MENTOR_PRODUCT_PASSPORT`

| Field | Value |
| --- | --- |
| Canonical application | Matrix Mentor Console |
| Product identity | CAM v2 Mentor Intelligence Operating System |
| Ticket family | A1 MMC CAM |
| Current run | 007 — Mentor Experience and Operations |
| Primary product owner | Dr Brian / Founder |
| Runtime/on-call owner | `OWNER UNKNOWN` until staging ownership is explicitly assigned |
| Lifecycle | Local/fixture mentor release candidate awaiting Founder design judgment and 008 continuation |
| Production state | `NOT DEPLOYED` |
| Staging state | `NOT APPLIED · NOT DEPLOYED · NOT TESTED` |
| Monitoring state | `NOT WATCHED` outside deterministic local validation |
| Health state | Local automated suites pass at recorded scope; no deployed health claim |
| Canonical worktree | `/Users/brianb/MissionMed_worktrees/A1-MacAirMMCMentorIntelligence-005` |
| Canonical branch | `a1-mmc-cam-mentor-experience-007` |
| Starting source | `a764ff6b87f432b61c8b30112e75f20ca921c5dd` |
| Final code and evidence source | `90cd9998b29beeb1dc484380bd32b5759478822d` |
| Remote verification | `origin/a1-mmc-cam-mentor-experience-007` matched the final code/evidence source before the documentation-only certification commit |

## Purpose

MMC helps Dr Brian identify the most consequential next mentoring action, prepare a call, preserve presence during capture, review evidence and machine assistance before consequence, close commitments, and maintain longitudinal continuity. The future student plane benefits students through a separate, privacy-safe publication and agency product; it is not part of 007.

## Canonical mentor entry points

```text
/mmc-private/today
/mmc-private/students
/mmc-private/students/:subjectLinkId/overview
/mmc-private/students/:subjectLinkId/plan
/mmc-private/students/:subjectLinkId/history
/mmc-private/students/:subjectLinkId/history/sessions/:sessionId
/mmc-private/students/:subjectLinkId/files
/mmc-private/students/:subjectLinkId/prep
/mmc-private/sessions/:sessionId/live
/mmc-private/sessions/:sessionId/review
/mmc-private/work
/mmc-private/reviews/:queueKind?/:reviewId?
/mmc-private/operations/:area?/:itemId?
```

API family: `/api/mmc/v2/mentor/**`. Local review command: `node missionmed-hq/tests/mmc-cam/browser/launch-mentor-review.mjs --headed`.

## Authentication and authorization

The shared MissionMed HQ session is the private gateway. Every runtime mentor query/command derives a bounded principal server-side. Mentor and operator roles are distinct; Operations additionally requires `mmc:operations`. Cookie-backed mutation requires same-origin validation and CSRF. Local browser fixtures use an isolated synthetic session and never claim production authentication proof.

## Data, reads, and writes

- Authoritative 007 runtime data: deterministic synthetic, in-memory, process-local.
- Query API: exact `{data, meta}` envelope with environment, freshness, section state, `asOf`, and correlation ID.
- Command API: raw typed committed result with object versions, audit ID, correlation ID, replay state, and readback.
- External writes: none.
- Durable configured writes: none.
- Providers: disabled.
- Student publication: disabled until 008.

## Product-state truth

The 007 mentor loop is reviewable and interactive locally. It is not durable across process restart, not connected to real students, not connected to production data, not deployed, not observed by production monitoring, and not production complete. The checked-in CAM v2 schema remains unapplied. No percentage or score in an architecture report overrides these facts.
