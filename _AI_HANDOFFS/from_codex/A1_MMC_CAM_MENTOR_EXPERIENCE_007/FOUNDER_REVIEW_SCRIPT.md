# Founder Review Script

RESULT: `TEN_MINUTE_LOCAL_REVIEW_SCRIPT_READY`

## 0:00–1:00 — Launch and truth check

Run:

```bash
node missionmed-hq/tests/mmc-cam/browser/launch-mentor-review.mjs --headed
```

Confirm the chrome says `Fixture · synthetic data`, `Connected`, and the current save state. This is a local review, not production.

## 1:00–2:30 — Today

- Identify the first student, why now, due time, trust state, and next safe action.
- Confirm the first tier contains three conditions and the remaining tier is disclosed rather than competing.
- Open the evidence inspector; judge whether source, freshness, and review state are legible without dominating the page.
- Try Defer or Dismiss and confirm versioned readback updates the queue.

## 2:30–4:00 — Students and one-minute brief

- Open Students, choose a student, and confirm the URL owns identity.
- Review Overview: what changed, next move, commitments, continuity, and publication boundary.
- Visit Plan, History, a session detail, and Files. Judge whether each object has one predictable home.

## 4:00–5:30 — Call Prep and Session

- Open Prepare Call and enter Focus mode.
- Start a synthetic session; confirm the student is pinned.
- Save a typed capture, pause/resume, and end for review.
- Confirm offline/conflict messaging never calls unsaved work saved.

## 5:30–7:00 — Human review and follow-through

- Decide one eligible review item; confirm decisions are item-level.
- Confirm publication candidates are disabled rather than silently promoted.
- Open Work and judge owner/due/action clarity.
- Open Reviews and confirm it is a human decision workspace, not a bulk-approval queue.

## 7:00–8:00 — Operations boundary

- Open Operations.
- Confirm provider, durable persistence, job repair, and student publication are truthfully unavailable.
- Judge whether operational machinery is separate enough from mentoring.

## 8:00–9:00 — Responsive and state evidence

Review the hashed images under `missionmed-hq/tests/mmc-cam/visual/evidence/mentor-007/`, especially Today at 1440, 768, 390, and 320; Overview; Reviews; Operations; long RTL/transcript; and loading/empty/partial/stale/error/revoked/offline/conflict.

## 9:00–10:00 — Decision

Judge visual design, typography, density, navigation, terminology, hierarchy, motion, evidence presentation, and mobile behavior. Return one verdict:

- `APPROVE FOR CONTINUED 008/009 RELEASE-CANDIDATE WORK`
- `APPROVE WITH FINAL CHANGES` and list bounded changes
- `REVISE` and name the blocking product/design issue

Stop the review server with `Ctrl-C`. Do not interpret review approval as production deployment authority.
