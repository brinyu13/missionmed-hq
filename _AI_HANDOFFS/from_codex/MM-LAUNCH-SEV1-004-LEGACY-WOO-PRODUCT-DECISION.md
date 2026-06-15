# MM-LAUNCH-SEV1-004 Legacy Woo Product Decision

Date: 2026-06-15

## Product

- Product ID: `3577`
- Current name: `Interview Prep Foundation`
- Current public URL: `https://missionmedinstitute.com/product/interview-prep-foundation/`
- Current price: `$499`
- Current Store API state: public, purchasable, in stock

## Public Risk

This legacy product remains exposed at a much lower price than the current Mission Residency public tier architecture. It creates launch risk because students can discover and purchase a legacy-priced offer that no longer matches the current public program names, positioning, and pricing presentation.

No WooCommerce product data, checkout behavior, pricing, inventory, user, order, or payment configuration was changed in SEV1-004.

## Decision Options

### A. Hide from catalog/search

Hide the product from public catalog/search while preserving the product record for historical orders and internal admin use.

Pros:
- Safest launch action.
- Does not alter price, checkout settings, or historical order records.
- Reduces public pricing confusion immediately.

Cons:
- Direct product URL may still work unless also redirected or made private.

### B. Redirect to IV Prep Essentials

Redirect public traffic from `/product/interview-prep-foundation/` to the current IV Prep Essentials product or course comparison page.

Pros:
- Prevents students from landing on the legacy offer.
- Sends traffic into the current architecture.

Cons:
- Requires an approved destination product URL and redirect policy.
- Should be tested carefully around carts and historical order links.

### C. Rename to IV Prep Essentials legacy/private

Rename the product to communicate that it is a legacy/private product.

Pros:
- Preserves continuity if the product is still needed internally.
- Reduces naming drift.

Cons:
- Still leaves a low-price product publicly discoverable unless visibility changes too.

### D. Preserve for internal legacy enrollment

Keep the product unchanged for staff/internal use only.

Pros:
- No disruption to any legacy workflow.

Cons:
- Public launch risk remains if discoverability is not restricted.

## Recommended Safest Launch Action

Recommendation: **A. Hide from catalog/search**, then separately decide whether direct URL traffic should redirect to the current IV Prep Essentials or Mission Residency courses page.

Reason: hiding from catalog/search is the least destructive WooCommerce action because it avoids changing price, payment, checkout, existing orders, or product identity while removing the main public discovery risk.
