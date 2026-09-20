# DRJ-EXAMPREP-0920A — Durable State

**Last updated:** 2026-09-20T23:25Z
**Foreman:** Codex root  
**Acceptance target:** LIVE `missionmedinstitute.com`

## Current control state

- Phase: `LIVE VERIFIED / READY`
- Production mutations this run: bounded source and provider reconciliation completed under DR-316/DR-317; money moved `0` cents.
- Workers:
  - `commerce_truth`: COMPLETE read-only post-deploy sweep; final PASS with zero unexplained failures
  - `entitlement_truth`: COMPLETE read-only
- Authority: DR-316/DR-317 canonical at MissionMed OS commit `148de68`; BOOT PASS; REGISTRY lease released.
- Next critical path: create/push the closing evidence commit and mark terminal acceptance; optional Founder-only real card/3DS test is outside agent authority.

## Repository / deployment identity

- Worktree: `/Users/brianb/MissionMed_worktrees/drj-examprep-pricing-live`
- Branch: `codex/drj-examprep-pricing-live`; base `2fc76f1575601606f814beb10868a62e8c97af04`; origin branch matched before implementation.
- Dirty state: pre-existing untracked 0904B handoff plus mission-owned 0920A handoff and current candidate files; no unrelated tracked file changed.
- Live preimage Dr J commerce SHA: `9a6f10b9e0bb1182ec0c6d92249eee04355f2d7fa4718bebf25dda76289001fe` (v1.1.0).
- Current live Dr J commerce SHA: `f17dd231bd09fe474fc67bbbb36850a2cdda2572133f85ebe2597ef0d6744f20` (v1.2.0).
- Live access source SHA: `ffab495c8d591d2bb500838334090b816282bcee73c6f55524c0c50b31db43ce`.
- Live legacy drills bridge SHA: `3ea27f4d2fd51e9e2bfded66a7ff9c7f79fe7dc5f93cdad7c7382847dc89f106`.
- Known rollback: exact source preimages and provider JSON are in `/www/theresidencyacademy_209/private/codex-backups/DRJ-EXAMPREP-0920A/`; details are in `DRJ-EXAMPREP-0920A_EXECUTION_REPORT.md`.

## Accepted prior capabilities to preserve

- CART control visible on ExamPrep surfaces.
- Add to Cart reaches the Woo cart.
- ExamPrep checkout bypasses the unrelated Mission Residency upsell.
- Headline: `Your mentor. Not a team of strangers.`
- Tutoring price: `$85`.
- Dedicated ExamPrep Stripe division routing and the 0904B instructor-account regression bridge.

## Commercial truth (Founder locked)

- Live Group Drilling: `$300/month`.
- Drills: Daily Rounds Access standalone: `$99.99/month`, Daily Rounds only.
- Live Drills Daily Rounds add-on: `$19.99/month`, active Live Group eligibility required, Daily Rounds only.
- Exam Guarantee/UCC/MUL special Daily Rounds: `$49.99/month`, restricted eligibility, Daily Rounds only.
- ExamPrep: Arena Pro: `$149.99/month` displayed, locked/Coming Soon, no purchase path or premium entitlement.

## Live product / routing / entitlement truth

- 3651/3668 Live Group: real variable subscription, 300/month, working Dr J routing.
- 6360 Daily Rounds candidate: real subscription, 99.99/month; live name/copy and feature entitlement are wrong.
- 9109 add-on: real hidden subscription, 19.99/month, eligibility metadata present; live missing instructor metadata makes it unpurchasable.
- 9017 is visible at 149.99/month but non-purchasable, Coming Soon, unmapped from Daily Drills, and has zero subscriptions.
- Static cohort coupons are draft/revoked. New qualifying offers are account-bound recurring discounts that produce 49.99/month with uniform Dr J prefixes.
- Daily Rounds course 6357 and the drills-only capability now follow active/pending-cancel subscription truth, preserve pre-existing access, revoke safely on the final terminal subscription, and positively gate direct Daily routes.
- Stripe division routing is live, strict and healthy; no instructor-account regression. The unrelated global 499-dollar Mission Residency Zelle gateway is suppressed only for scoped ExamPrep carts.

## Waiting dependencies

- No configuration/source blocker. Real card/3DS entry remains Founder-only.

## Rollback target

- Founder-stated Kinsta backup plus exact per-file and provider-object preimages captured immediately before deployment. Previous commerce source preimage SHA is recorded above.
