# MM-LAUNCH-SEV1-005 Woo Legacy Product Report

**Date:** 2026-06-15
**Ticket:** `MM-LAUNCH-SEV1-005-WOO-LEGACY-PRODUCT`
**Worktree:** `/Users/brianb/MissionMed_worktrees/MM-LAUNCH-SEV1-001-FIXES`
**Branch:** `codex/mm-launch-sev1-001-fixes`
**Preflight HEAD:** `f8ba620f6c141e62b6e28e430d4ff2b16de858f6`
**Risk Level:** HIGH
**Final Verdict:** GO

## Executive Summary

Product `3577` is no longer publicly promoted as a current Mission Residency product. The WooCommerce product record was preserved, pricing was not changed, checkout was not modified, and the product remains directly/admin/order accessible.

## Product Inspected

| Field | Before | After |
|---|---|---|
| Product ID | `3577` | `3577` |
| Raw title | `Interview Prep Foundation` | `Interview Prep Foundation` |
| Public canonicalized title | `IV Prep Essentials` via launch mu-plugin title filter | unchanged |
| Slug | `interview-prep-foundation` | unchanged |
| Status | `publish` | unchanged |
| Price | `$499` | unchanged |
| Regular price | `$499` | unchanged |
| Sale price | empty | unchanged |
| Purchasable | `true` | unchanged |
| Stock status | `instock` | unchanged |
| Catalog visibility | `visible` | `hidden` |
| Visibility terms | none | `exclude-from-catalog`, `exclude-from-search` |
| Linked LearnDash metadata | `_related_course` -> course `3646` | unchanged |

## Changes Made

1. Set WooCommerce catalog visibility for product `3577` to `hidden` using Woo's product API.
2. Did not change product title, slug, status, price, regular price, sale price, purchasability, stock status, orders, users, checkout, payments, LearnDash, Matrix, Scheduler, or Arena backend.
3. Added a narrow launch mu-plugin guard that excludes only product `3577` from public Woo Store API product collection/search responses, because this Woo version's default Store API collection returns hidden products unless `catalog_visibility=visible` is explicitly requested.

Direct product access remains available:

- `https://missionmedinstitute.com/product/interview-prep-foundation/` returns 200.
- `https://missionmedinstitute.com/wp-json/wc/store/v1/products/3577` returns 200.

## Backups

Production backup folder:

- `/www/theresidencyacademy_209/missionmed_deploy_backups/MM-LAUNCH-SEV1-005-20260615T210909Z/`

Backups created:

- `product-3577-post.before.json`
- `product-3577-postmeta.before.json`
- `product-3577-terms.before.json`
- `product-3577-post.after.json`
- `product-3577-postmeta.after.json`
- `product-3577-terms.after.json`
- `missionmed-launch-sev1-fixes.before-store-api-filter.php`

## Deployment

Only this source file was deployed:

- `wp-content/mu-plugins/missionmed-launch-sev1-fixes.php`

Final production mu-plugin SHA256:

- `0395ce6aad8fe74fdae3c9beb2482b1246f8c9784d0a888b9fada98a4434274c`

## Cache Status

- Woo product transients cleared.
- WordPress/Kinsta cache clear printed success and then hit the known WP-CLI post-success segmentation fault.
- Autoptimize cache cleared.
- Elementor cache cleared.

## Verification

Frontend:
- Pages load: PASS
- Layout renders: PASS by HTTP/content smoke checks on product and Mission Residency courses pages
- Navigation: PASS for direct product URL and Mission Residency courses URL

Backend:
- `/wp-admin`: PASS, returns WordPress login screen without fatal error
- PHP errors: PASS, local and remote mu-plugin lint passed
- DB connections: PASS, WP-CLI product read/write and Store API probes succeeded

Functional:
- Core interactions: PASS for product visibility/public discovery checks; no checkout submission performed
- No regressions: PASS for main three product Store API prices

## Validation Highlights

- Product `3577` catalog visibility is now `hidden`.
- Product `3577` has `exclude-from-catalog` and `exclude-from-search`.
- Product `3577` no longer appears in Woo Store API search for `Interview Prep Foundation`.
- Product `3577` no longer appears in default Woo Store API product collection.
- Product `3577` no longer appears even when Store API collection requests `catalog_visibility=hidden`.
- Site product search for `Interview Prep Foundation` does not expose the legacy product.
- Direct product URL remains 200 and purchasable.
- Main product prices remain unchanged:
  - `5504`: `149900`
  - `3576`: `279900`
  - `3575`: `399900`

## Remaining Risks

- Direct URL access remains available by design. This preserves direct/admin/order access, but anyone with the exact URL can still load the product.
- Direct Store API product-by-ID access remains available by design.
- The raw Woo product title remains `Interview Prep Foundation`; public title presentation is canonicalized by the existing launch mu-plugin.
- WP-CLI still emits known translation notices and may segfault after cache-clear success output.

## Recommended Next Action

Proceed with launch validation. If Brian later wants the exact direct URL to redirect or become private, that is a separate business decision because it would reduce direct/purchasable access beyond the approved safe launch action.

