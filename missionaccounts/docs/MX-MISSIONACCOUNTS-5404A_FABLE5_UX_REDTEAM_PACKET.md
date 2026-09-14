# MX-MISSIONACCOUNTS-5404A — Fable 5 UX Red-Team Packet

## Review boundary

Review the implemented dedicated ExamPrep onboarding experience only. Classify findings as `UX P0`, `UX P1`, `P2 polish`, or `optional`. Only a demonstrated P0 or P1 should block the next gate.

Do not propose access enforcement, a 48-hour requirement, automated outreach, notification delivery, billing activation, invoice changes, pricing changes, Zoom changes, public-page work, password collection, card collection, or a new enrollment source of truth.

## Product outcome under review

The implementation adds an authenticated student onboarding route at `#/me/onboarding` and a Dr J queue at `#/onboarding`. It stores one private profile per canonical `missionaccounts.student.id`, reuses the existing canonical contact, payment-method, consent, exam-plan, sponsor, and recovery authorities, and derives completion on the server.

Onboarding itself grants no access, blocks no access, sends no message, grants no billing consent, creates no charge or invoice, and changes no dispatch state.

## Exact source to inspect

- Branch: `codex/mx-missionaccounts-5404a`
- Source base: `8450144bda8aabb3bac2a671e524b6af9d64b1a4`
- Candidate: the reviewed PR head containing this packet
- Student UI: `missionaccounts/public/index.production.html`, function `viewMeOnboarding`
- Admin UI: `missionaccounts/public/index.production.html`, function `viewAdminOnboarding`
- Browser mutation bridge: `missionaccounts/public/missionaccounts-runtime.js`, action `onboarding-save`
- Server/API: `missionaccounts/src/server.mjs`
- Storage adapter: `missionaccounts/src/storage/supabase-rest.mjs`
- Migration: `missionaccounts/supabase/migrations/20260914111824_dedicated_examprep_onboarding_5404a.sql`
- Acceptance evidence: `missionaccounts/evidence/MX-MISSIONACCOUNTS-5404A_SOURCE_ACCEPTANCE.json`

## Interactive local review

Use a clean checkout of the candidate. Serve the production shell with a `PreviewStore`, `production: false`, `localAuth: true`, `routeEnabled: true`, and only `onboarding: true` plus the existing read-only exam-plan capability. Copy `public/index.production.html` to a temporary public directory as `index.html`; do not edit the checkout.

Review:

- Student: `http://127.0.0.1:<port>/missionaccounts/#/me/onboarding`
- Dr J: send local preview headers `x-missionaccounts-local-role: missionaccounts_admin` and `x-missionaccounts-local-user: dr-j`, then open `http://127.0.0.1:<port>/missionaccounts/#/onboarding`

Do not point this source review at production and do not enter real student information.

## Rendered implementation observations

### Student, first visit

- Left rail exposes `Onboarding` inside ExamPrep.
- Five-second message: `Your ExamPrep account, ready in one place.`
- Dominant action: `Save progress`.
- Progress card shows an explicit percentage, completed/applicable-step count, and `Not started`, `In progress`, or `Complete`.
- Profile form explains that login name, email, and phone remain in the canonical MissionMed account.
- Checklist links to the existing exam plan, payment/billing workspace, and WordPress recovery.
- Direct students see payment method and billing authorization as separate requirements.
- Sponsored UCC/MUL students receive `NOT_APPLICABLE` for payment and consent.

### Student, save/resume witness

A synthetic local student saved an approved-field profile incrementally. The UI rerendered from revision 0 / `Not started` to revision 1 / `In progress`, moved progress from 43% to 57%, and preserved the profile on another GET. A student may save any populated approved field without completing the full form. No notification, charge, invoice, consent, enrollment, or access state changed.

### Dr J

- Left rail exposes `Onboarding` without Student Preview or impersonation.
- Five-second message: `Who is ready, and what is missing.`
- Summary gives complete, in-progress, not-started, and student counts for current canonical ExamPrep enrollment only.
- Each row gives display/preferred name, status, missing steps, and last update.
- Queue omits mailing address, email, phone, Stripe references, and provider secrets.

### Responsive evidence

Browser rendering was inspected at exact CSS widths 1440, 1024, and 390. At each width the onboarding entry, student form, dominant save action, and checklist remained reachable. DOM geometry reported `body.scrollWidth == body.clientWidth` and `main.scrollWidth == main.clientWidth`; no horizontal overflow was present. At 390 px the canonical rail becomes the fixed mobile navigation and the form/checklist stack to one column.

## Acceptance criteria

Inspect only:

1. Five-second comprehension.
2. Sequence and progressive disclosure.
3. One dominant student action.
4. Progress and missing-step clarity.
5. Save/resume/reload comprehension.
6. Student confusion or anxiety points.
7. Dr J completion visibility without impersonation.
8. Loading, empty, error, and wrong-role/admin-flash risks.
9. Keyboard, focus, labels, and accessible state.
10. Responsive behavior at 390, 1024, and 1440.
11. StoryForge-family coherence.

## Required response

Return:

```text
FABLE 5 UX RED-TEAM: PASS / FAIL
UX P0: [count and exact findings]
UX P1: [count and exact findings]
P2 POLISH: [concise findings]
OPTIONAL: [concise findings]
DEPLOYMENT-BLOCKING UX FINDINGS: YES / NO
EXACT CANDIDATE SHA REVIEWED: [sha]
```

Do not claim technical security verification, deployment authority, production deployment, or genuine-role acceptance. Those are separate gates.
