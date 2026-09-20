# DRJ-EXAMPREP-0920A — Durable State

**Last updated:** 2026-09-20T22:40Z  
**Foreman:** Codex root  
**Acceptance target:** LIVE `missionmedinstitute.com`

## Current control state

- Phase: `LOCAL IMPLEMENTATION / PREDEPLOY VERIFICATION`
- Production mutations this run: none yet
- Workers:
  - `commerce_truth`: COMPLETE read-only
  - `entitlement_truth`: COMPLETE read-only
- Authority: DR-316/DR-317 canonical at MissionMed OS commit `148de68`; BOOT PASS; REGISTRY lease released.
- Next critical path: finish local checks, commit candidate, capture exact production preimages, deploy source/provider objects under narrow leases, then live and independent verification.

## Repository / deployment identity

- Worktree: `/Users/brianb/MissionMed_worktrees/drj-examprep-pricing-live`
- Branch: `codex/drj-examprep-pricing-live`; base `2fc76f1575601606f814beb10868a62e8c97af04`; origin branch matched before implementation.
- Dirty state: pre-existing untracked 0904B handoff plus mission-owned 0920A handoff and current candidate files; no unrelated tracked file changed.
- Live preimage Dr J commerce SHA: `9a6f10b9e0bb1182ec0c6d92249eee04355f2d7fa4718bebf25dda76289001fe` (v1.1.0).
- Live access source SHA: `ffab495c8d591d2bb500838334090b816282bcee73c6f55524c0c50b31db43ce`.
- Live legacy drills bridge SHA: `3ea27f4d2fd51e9e2bfded66a7ff9c7f79fe7dc5f93cdad7c7382847dc89f106`.
- Known rollback: Kinsta backup stated present; exact per-file rollback targets will be captured before mutation.

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
- 9017: real public 149.99/month subscription, currently purchasable and incorrectly mapped to Daily Drills; zero subscriptions.
- Static DRJGROUPS/DRJMUL/DRJUCC/DRJGUARANTEE codes are unrestricted live and must be retired; current private issuer is account-bound but uses the wrong recurring coupon type and 39.99 math.
- Daily Rounds course 6357 is not connected to the existing drills-only role/cap lifecycle. Direct Daily routes lack a positive server gate. The candidate adds a subscription-truth reconciler, direct capability ownership, safe preservation flags, legacy-bridge partition and positive route gate.
- Stripe division route is live, strict and healthy; no current instructor-account regression for scoped products. Product 9109 requires instructor 845 metadata before it can reach checkout.

## Waiting dependencies

- No human blocker before deployment. Real card entry remains Founder-only and is not required for configuration/source deployment.

## Rollback target

- Founder-stated Kinsta backup plus exact per-file and provider-object preimages captured immediately before deployment. Previous commerce source preimage SHA is recorded above.
