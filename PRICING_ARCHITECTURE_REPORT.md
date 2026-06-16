# Pricing Architecture Report

Ticket: `MM-LAUNCH-SEV1-002-MEGARUN`

Date: 2026-06-15

Worktree: `/Users/brianb/MissionMed_worktrees/MM-LAUNCH-SEV1-001-FIXES`

## Executive Summary

MissionMed uses intentional early-season pricing. The prior SEV1-001 interpretation that `$3,999` and `$2,799` were WooCommerce conflicts was incorrect under the SEV1-002 pricing lock.

Current source-controlled mitigation now preserves early-season prices and presents them against regular/high-season prices:

| Program | Early Enrollment | Regular / High Season | Savings |
| --- | ---: | ---: | ---: |
| IV Prep Essentials | `$1,499` | `$1,699` | `$200` |
| Match Prep Pro | `$2,799` | `$3,749` | `$950` |
| 360 Match Mentorship | `$3,999` | `$5,499` | `$1,500` |

No WooCommerce prices, checkout behavior, payment gateways, orders, users, or product records were modified.

## Source Of Truth

For this task, the authoritative pricing source is the SEV1-002 ticket pricing lock. WooCommerce Store API confirms the three main products currently match early-season prices:

| Woo Product | Product ID | Store API Price | Architecture Note |
| --- | ---: | ---: | --- |
| IV Prep Complete Masterclass | `5504` | `$1,499` | Public name is legacy; price matches early-season IV Prep Essentials. |
| Match Prep Pro | `3576` | `$2,799` | Price matches early-season Match Prep Pro. |
| 360 Match Mentorship | `3575` | `$3,999` | Price matches early-season 360 Match Mentorship. |

The source-controlled page copy should present early enrollment pricing, savings, and the July 1 increase. WooCommerce should not be changed until an admin-level pricing architecture decision is approved.

## Architecture Map

### WooCommerce

- Main products are exposed through the Woo Store API with early-season product prices.
- Woo `regular_price` and `sale_price` both currently appear to equal the early price for the three main products.
- Payment-plan products are separately exposed:
  - IV payment plan product `5513`: `24983`.
  - Match Prep Pro payment plan product `5512`: `46650`.
  - 360 Match Mentorship payment plan product `5511`: `66650`.
- A legacy product remains exposed:
  - `Interview Prep Foundation`, product `3577`, price `$499`.

### Elementor / WordPress Page Content

Live Elementor content currently contains presentation drift:

- `/mission-residency/` contains early prices but stale high-season references for Match Prep Pro and 360 Match Mentorship (`$3,199`, `$4,499`).
- `/mission-residency-courses/` contains legacy `IV Prep Masterclass` naming and a mixture of upfront, Zelle, installment, and payment-plan amounts.
- `/compare-programs/` has no pricing section and has legacy program naming.
- `/red-flag-match-stories/` contains `360 Elite`.
- `/homepage-arena/` contains concept-demo language.
- `/usce/` contains raw code-fence artifacts.
- `/examprep/` contains a visible `ismissing` artifact.

### Product Pages

Product URLs resolve, but product naming is partly legacy:

- `/product/iv-prep-masterclass/` maps to a live IV product but still exposes `IV Prep Complete Masterclass` through Store API.
- `/product/match-prep-pro/` maps to current Match Prep Pro.
- `/product/360-match-mentorship/` maps to current 360 Match Mentorship.
- `/product/interview-prep-foundation/` remains exposed as a legacy low-price product.

### MatchFirst And Installments

MatchFirst and payment-plan references were not modified. They need admin confirmation before any pricing architecture changes because they may depend on written enrollment terms, Woo product setup, or manual invoice/Zelle workflows.

### July Increase References

Stale July-increase values were detected on `/mission-residency/`:

- Match Prep Pro stale regular/high-season value: `$3,199`.
- 360 Match Mentorship stale regular/high-season value: `$4,499`.

The mu-plugin now converts the public presentation to:

- Match Prep Pro: `$2,799 Early Enrollment`, regular `$3,749` after July 1.
- 360 Match Mentorship: `$3,999 Early Enrollment`, regular `$5,499` after July 1.

## Active References vs Stale References

Active:

- Early-season program prices from SEV1-002.
- Woo Store API prices for main products.
- Regular/high-season prices from SEV1-002 for presentation and July-increase copy.

Stale:

- `IV Prep Masterclass`, `IV Prep Complete Masterclass`, `Interview Prep Foundation`, `Interview Prep Complete`, `Match Prep Complete`, `360 Elite`.
- `$3,199` as Match Prep Pro regular/high-season price.
- `$4,499` as 360 Match Mentorship regular/high-season price.
- Legacy `Interview Prep Foundation` Woo product.

## Determination

Woo pricing for the three main products matches current early-season business rules. The unresolved issue is architecture:

- Woo is not currently representing regular-vs-early pricing as a clean regular/sale relationship.
- Legacy product names/products remain exposed.
- Payment-plan and MatchFirst structures need admin review before changes.

Decision handoff created: `_AI_HANDOFFS/from_codex/MM-LAUNCH-PRICE-DECISION-REQUIRED.md`.

