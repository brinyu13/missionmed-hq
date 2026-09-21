# Independent production acceptance

## Verdict

**APPROVE**

No launch-critical issue was found by the fresh read-only verifier.

## Verified evidence

- Production source matches commit `2b1f0592f5b3d1f66e6a3adaf641946a85cc2699` across the deployed plugin, campaign config, JavaScript, CSS, and landing script hashes.
- Landing calls to action lead to the canonical rich product pages before checkout.
- IV Prep Complete renders:
  - `$3,099` paid in full through September 26 and `$3,499` standard tuition;
  - `$1,000` today plus 6 x `$400` (`$3,400` total);
  - `$3,099` Zelle with no discount and no access while the order remains on hold;
  - Interview Week included with no additional charge;
  - calendar, proof, FAQ, season support, and payment selector.
- Interview Week renders:
  - `$549` card and `$499` Zelle;
  - no access while a Zelle order remains on hold;
  - curriculum, schedule, proof, FAQ, and payment selector.
- The rendered schedule uses October 1, 4, 6, 8, 10, and 11.
- Runtime reports public opening September 22, 2026 at 12 PM ET and the Complete early-tuition deadline September 26 at 11:59:59 PM ET.
- Anonymous direct product requests return `303` to the private-access prompt with signed resume tokens preserving the exact offer, destination, and incoming UTM parameters. The private code is not publicly disclosed.
- Runtime mappings pass:
  - Woo `5504/5867` to LearnDash `3646`;
  - Woo `3576/5865` to LearnDash `5227`;
  - Woo `5513/5873` to LearnDash `5227`.
- Logged-out rendering passed at exact 1440, 1024, and 390 CSS-pixel widths for the landing page, both product pages, pre-checkout, and empty cart/checkout states:
  - no horizontal overflow;
  - no desktop-only warning;
  - no OUT OF STOCK leakage;
  - no WordPress admin toolbar.
- GTM/GA4 bootstrap is present with `GT-PJ7SPCWF`; landing-to-product UTM propagation and product-CTA analytics hooks are present.

The product pages were rendered with an existing private-access browser session. The verifier did not enter the private code and performed no add-to-cart action, checkout submission, order, payment, refund, entitlement change, or production mutation.

`LIVE FINANCIAL TRANSACTION TEST = FOUNDER-WAIVED / NOT PERFORMED`
