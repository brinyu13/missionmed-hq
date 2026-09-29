# MR-WEB-0912 Stale-String Classification

## CURRENT — changed

All current operational/customer-facing occurrences in the active Mission Residency source and the scoped Woo copy were changed from `Interview Week` to `Interview Bootcamp Week`.

Live, logged-out rendered checks found no current customer-facing exact phrase `Interview Week` across the landing, its opened Bootcamp-choice intercept modal, Bootcamp product, Complete product, comparison, homepage, cart/checkout labels, or QA checkout review rows.

The active-source sweep (excluding historical handoffs, uploads, dependencies, and Git internals) returned no exact `Interview Week` / `interview week` occurrences after the change.

## TECHNICAL — intentionally preserved

The following remain unchanged because they are durable identity or routing rather than customer-facing naming:

- internal offer key / analytics variant: `interview_week`;
- Woo parent slug `iv-prep-masterclass`;
- Woo variation slug `iv-prep-essentials-interview-week-session-d-oct-11th-2026`;
- Woo IDs `5504`, `5867`, `3576`, `5865`, `5513`, `5873`;
- LearnDash IDs `3646`, `5227`;
- existing canonical URLs and add-to-cart contracts.

## HISTORICAL — intentionally preserved

Prior reports, handoffs, screenshots, campaign evidence, historical orders, archived emails, and other audit material were not rewritten. Those records preserve what was true when created.

## FALSE POSITIVES / non-current scope

- The source worktree directory name `mr-web-0912-interview-week` is an implementation container, not customer-facing copy.
- Existing handoff directory names and evidence filenames are audit identifiers.
- Exact old technical slugs can appear in URLs without rendering the retired display name.

## Result

The first independent verifier correctly found one stale all-caps `INTERVIEW WEEK` label in the interactive enrollment intercept. Commit `0aa0c6dc3fcfdbe65526d64dbabc6a1e34471d98` replaced it with `INTERVIEW BOOTCAMP WEEK`; live Chrome and the final three-width automated matrix opened the modal and verified the correction. No stale current customer-facing `Interview Week` label is known to remain. Preserved instances are technical identity or historical evidence only.
