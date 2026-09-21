# Purchase-Success Architecture

## Shared flow

Authoritative Woo order → gather real line-item product/variation IDs → classify family → gather subscriptions/status/dates → resolve family/product configuration → render one shared MissionMed shell.

Family classification uses, in order, stamped order owner/division metadata, exact product/parent identities, and product categories. It does not infer from URL slugs or visible text. Multiple recognized families produce a neutral `mixed` fallback; an unknown product produces a neutral `generic` fallback. Neither can receive clinical instructions.

## Family behavior

| Family | Primary destination | Support | Context |
| --- | --- | --- | --- |
| ExamPrep | Product-aware onboarding/account/Arena/schedule/scheduling CTA | `drj@missionmedinstitute.com` | Actual product(s), payment, access, subscription, cadence, next billing/trial when present |
| Mission Residency | Matrix Dashboard v2.0 | `info@missionmedinstitute.com` | Actual program/tier and residency-relevant steps |
| USCE | Matrix clinical onboarding | `clinicals@missionmedinstitute.com` | Hospital paperwork and rotation preparation only for verified clinical orders |
| Unknown/mixed | Neutral MissionMed account/contact path | `info@missionmedinstitute.com` | No clinical assumptions |

## Founder acceptance

The live order-received page for `9148` rendered:

- `data-purchase-family="examprep"` and version `2026.09.21`;
- `Drills: Daily Rounds Access` from the order;
- payment confirmed;
- cancelled subscription/access state after requested cancellation;
- `$99.99/month` renewal contract;
- `drj@missionmedinstitute.com`;
- ExamPrep/account/Arena next steps;
- two-column desktop hero with `Your Enrollment` summary;
- no hospital, rotation, clinical onboarding, or clinical support copy;
- no horizontal overflow at desktop or 390px.

Mission Residency order `8987`, USCE order `6514`, legacy ExamPrep, unknown, and mixed fixtures passed deterministic read-only rendering checks. No new charge was created.

## Email consistency

No theme or content override of Woo’s immediate customer email templates was found. The active Woo email path remains generic order/subscription content; repository and live template scans found no ExamPrep/Mission Residency email injection of hospital paperwork, rotation preparation, or the clinical support address. The shared success renderer keeps family-specific web copy separate from the core receipt.
