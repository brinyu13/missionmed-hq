# MR-WEB-0912 Implementation Report

Date: 2026-09-13
Worktree: `/Users/brianb/MissionMed_worktrees/mr-web-0912-interview-week`
Branch: `codex/mr-web-0912-interview-week`
Authorized base: `ee4b8db6f1bb238f7e5f36eb80405a9ceed8eaa2`
Authority: `DR-246`, `DR-247`
Final status: **MR-WEB-0912 IMPLEMENTATION = BLOCKED**

## Result

A source-controlled Interview Week / Complete web candidate now exists and
passes local fail-closed and responsive checks. It is not deployed. Production
remains on the preserved September 4 commercial release because the new
payment, onboarding, coupon, upgrade-credit, backup, and independent-acceptance
gates are not complete.

The candidate does not inherit `mmed_mr_p0_verified_live_at`. Each offer has
its own MR-WEB-0912 timestamp and acceptance hash, bound to that offer's parent
product ID, variation ID, exact price, exact-only course mapping, and parent
relationship. Price, stock, purchasability, and LearnDash checks also run at
request time. Server-side add-to-cart and cart validation blocks direct/stale
URLs, inactive offers, and carts containing both offers. Unverified rail,
coupon, and upgrade amounts are stripped from the public REST response.

## Authority and startup

- Canonical final decisions were re-read as `DR-246_mr_web_0912_founder_interview_week_commercial_authority.md` and `DR-247_mr_web_0912_bounded_mr_079_execution_amendment.md`.
- Universal BOOT and mission BOOT passed against the current canonical OS.
- The prior transient DR-245/246 names were superseded by the canonical DR-246/247 files.
- The worktree began clean at the exact authorized base. No merge, rebase,
  reset, stash, clean, donor copy, or protected `supabase/.temp/cli-latest`
  write occurred.
- No Mission Residency/commercial-funnel Brain pack existed. The OS decisions,
  mission registry, authority index, product passport, product index, and BOOT
  profile were used directly.

## Source changes

| Path | Change | SHA-256 |
|---|---|---|
| `wp-content/mu-plugins/missionmed-mr-p0.php` | MR-WEB-0912 router, claim cleanup, server-side cart guards, exact request/mapping/parent/price checks, per-offer activation | `04ab7d2bbffbd692bec386ac401bf3c24eba4abb8b4289f9938273801e661235` |
| `wp-content/mu-plugins/missionmed-mr-0912-assets/config/campaign-state.json` | DR-246 offer, dates, schedule, truth flags, all unverified commerce features closed | `ee1db70bdfda3ec0e5141e83456cc3cd1cf09adf5c3650b8e36d3a6e4eea099d` |
| `wp-content/mu-plugins/missionmed-mr-0912-assets/pages/offer.html` | Shared accessible shell using the authentic MissionMed logo | `9aaabfa8a0db5c5af663282b4b78410444fa9802f6d875362bfd0ac565be5216` |
| `wp-content/mu-plugins/missionmed-mr-0912-assets/css/mr-0912.css` | Responsive MissionMed / Mission Residency visual layer | `743c70b75968e30c251bcdd1619cb2cb21fd8835bbbcd9b52cb85c1ca47b93e2` |
| `wp-content/mu-plugins/missionmed-mr-0912-assets/js/mr-0912.js` | Four data-driven views with fail-closed CTA rendering | `64b36ab289d0e2fe355ac91b5a1a2c4369148a1346a47b8ab53bd8eadad5e1d0` |
| `evidence-scripts/validate-release.php` | 64-assertion runtime/config/source harness | `14256e196d0025ec972612121fff0f6eaab9ed2f08bf8b19902c5db3e0b989b3` |

The four rendered view modes are:

- `mission-residency`: problem-led division homepage, schedule, curriculum,
  career value, and two-choice decision.
- `interview-week`: $500 scope, exact approved schedule precision, inclusions,
  exclusions, and double-purchase warning.
- `complete`: $3,499 standard anchor, Interview Week inclusion, fulfillment
  language without an unverified mock count or group availability.
- `compare`: the required simple first-layer comparison.

The new assets use an isolated directory. A later deployment copies that
directory first and switches the MU plugin last; rollback restores the plugin
first. The existing P0 asset directory is never overwritten.

## Verification completed

- PHP syntax: PASS.
- JSON parse: PASS.
- JavaScript syntax: PASS.
- `git diff --check`: PASS.
- Release harness: **64/64 PASS**, including exact parent/variation request
  identity, sibling-variation and direct add-to-cart denial,
  double-product cart denial, exact-only course mappings, parent/variation
  relationships, and separate activation evidence for each offer.
- Browser matrix: 12/12 local route/viewport combinations rendered with no
  horizontal overflow, no checkout link, the disabled verification state, and
  no stale claim text.
- Viewports: desktop 1440, tablet 1024, mobile 390 CSS pixels.
- Browser evidence captured in this task includes the live preimage at desktop
  and 390px, plus the local candidate at desktop and 390px.
- Fresh independent source-candidate review: **PASS** after adversarial checks
  of exact request identity, direct/stale cart paths, mixed-offer carts,
  exact-only mappings, parent relationships, and per-offer acceptance. This is
  not production or lifecycle acceptance.
- Lease V2 writes used exact PATH claims; the active MR-WEB-0912 lease count
  after the tranches was zero.

## Production baseline preserved

- Live MU plugin SHA-256 remains
  `9f72885a8030f41c4e588360f467a7e2f1fed4406972c6e665a2e9d8f3afb1e7`.
- `mmed_mr_p0_verified_live_at` remains the prior September 4 acceptance;
  no new MR-WEB-0912 acceptance option was set.
- Woo products, variations, prices, gateways, coupons, orders, users,
  LearnDash access, pages, caches, and provider files were not changed.
- The authenticated provider UI showed the September 12 manual backup
  `Pre IV Week Promotion` and the September 13 daily backup. No backup was
  created, deleted, restored, or relabeled.

## State delta

| Surface | Before | After this task |
|---|---|---|
| Git candidate | September 4 P0 plugin only; live assets not represented at the production path | MR-WEB-0912 plugin + source-controlled fail-closed assets and verifier |
| Public production | Old Essentials $1,199 / Complete $2,799 release | Unchanged |
| Checkout | Live prior card flow | Unchanged; candidate exposes zero checkout links |
| Entitlements | Existing 3646 / 5227 mappings | Unchanged |
| Claims | Live old count/outcome language remains until deployment | Candidate neutralizes it; production unchanged |
| Provider | Existing manual/daily recovery points | Unchanged |
| Supabase application data | Unchanged | Unchanged; coordination RPCs only |
| Brain | No product pack | Unchanged because production truth did not change |

## Blocking conditions

See `MR-WEB-0912-COMMERCE-AND-ENTITLEMENT.md`. The decisive blockers are:

1. no fresh new mission-labeled recovery point immediately before production mutation;
2. live product names/prices still reflect the prior offer;
3. the new card lifecycle has not been run;
4. Zelle, installments, alumni coupon/stack, and $500 credit are absent or unverified;
5. courses 3646 and 5227 have no current course steps or body content, and no
   matching Interview Week Calendar objects were found;
6. production rendered QA and fresh independent acceptance cannot occur before
   a gated deployment.

## Commit identity

Use `git rev-parse HEAD` after the evidence commit. This report intentionally
does not self-reference a commit hash.
