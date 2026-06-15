# SEV1-005 Woo Validation

**Date:** 2026-06-15
**Ticket:** `MM-LAUNCH-SEV1-005-WOO-LEGACY-PRODUCT`

## Preflight

| Check | Result |
|---|---|
| Git status | clean before work |
| Git branch | `codex/mm-launch-sev1-001-fixes` |
| Git HEAD | `f8ba620f6c141e62b6e28e430d4ff2b16de858f6` |
| Production backup | `/www/theresidencyacademy_209/missionmed_deploy_backups/MM-LAUNCH-SEV1-005-20260615T210909Z/` |

## Product 3577 Inspection

| Field | Result |
|---|---|
| Raw title | `Interview Prep Foundation` |
| Slug | `interview-prep-foundation` |
| Status | `publish` |
| Product type | `simple` |
| Price | `499` |
| Regular price | `499` |
| Sale price | empty |
| Catalog visibility before | `visible` |
| Catalog visibility after | `hidden` |
| Visibility terms after | `exclude-from-catalog`, `exclude-from-search` |
| Purchasable | `true` |
| Stock status | `instock` |
| Linked LearnDash metadata | `_related_course` -> serialized course ID `3646` |

## Change Safety

| Check | Result | Evidence |
|---|---:|---|
| Price unchanged | PASS | `$499` before and after |
| Title unchanged | PASS | raw title remained `Interview Prep Foundation` |
| Slug unchanged | PASS | `interview-prep-foundation` before and after |
| Status unchanged | PASS | `publish` before and after |
| Purchasable unchanged | PASS | `true` before and after |
| LearnDash untouched | PASS | `_related_course` inspected only; no course edit made |
| Checkout untouched | PASS | no checkout/payment/order command run |
| Main product prices unchanged | PASS | `5504=149900`, `3576=279900`, `3575=399900` |

## Public Validation

| URL / Probe | Result | Evidence |
|---|---:|---|
| `/product/interview-prep-foundation/` | PASS | Returns 200; direct access preserved |
| `/?s=Interview+Prep+Foundation&post_type=product` | PASS | Does not expose legacy product; redirects/lands on current IV product page |
| `/wp-json/wc/store/v1/products/3577` | PASS | Direct product-by-ID returns 200; direct access preserved |
| `/wp-json/wc/store/v1/products?search=Interview%20Prep%20Foundation&per_page=20` | PASS | `json_list_count=0`, `has3577=false` |
| `/wp-json/wc/store/v1/products?per_page=100` | PASS | `has3577=false` |
| `/wp-json/wc/store/v1/products?catalog_visibility=visible&per_page=100` | PASS | `has3577=false` |
| `/wp-json/wc/store/v1/products?catalog_visibility=hidden&per_page=100` | PASS | `has3577=false` after launch mu-plugin Store API collection guard |
| `/wp-admin/` | PASS | Redirects to WordPress login; no fatal or white screen |
| `/mission-residency-courses/` | PASS | Returns 200; no fatal |

## Mu-Plugin Validation

| Check | Result |
|---|---|
| Local PHP lint | PASS |
| Remote PHP lint | PASS |
| `git diff --check` before deployment | PASS |
| Final production SHA256 | `0395ce6aad8fe74fdae3c9beb2482b1246f8c9784d0a888b9fada98a4434274c` |

## Cache Notes

WordPress/Kinsta cache clear printed success and then hit the known WP-CLI segmentation fault. Woo product transients, Autoptimize cache, and Elementor cache clear commands completed after that. Final validation used cache-busting query strings.

