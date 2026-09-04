# MR-WEB-0904C Woo Product Mutations

Verification: **12/12 PASS** at `2026-09-04T18:02:35Z`

| ID | Purpose | Final live state |
|---:|---|---|
| 3576 | Complete parent | IV Prep Complete; published; visible; in stock; legacy slug retained |
| 5865 | Complete Session D | Published; in stock; $2,799; `_related_course=[5227]` |
| 5504 | Essentials parent | IV Prep Essentials; published; visible; in stock; legacy slug retained |
| 5867 | Essentials Session D | Published; in stock; $1,199; `_related_course=[3646]` |
| 3575 | 360 parent | 360 Match Mentorship; published/visible anchor; out of stock |
| 5862, 5863 | 360 variations | $5,499 reference; out of stock |
| 5864, 5866 | Past Session C variations | Draft/out of stock |
| 5511, 5512, 5513 | Legacy plan parents | Draft, hidden, out of stock |
| 5868–5873 | Legacy plan variations | Draft/out of stock |
| 6319 | Temporary $1 test | Restored to `Mission Residency - $1 Test`; draft, hidden, out of stock; $1; no course mapping |

No product was recreated and no product ID or slug migration was performed. Existing orders, users, course records, Elementor archives, and unrelated Dr J / ExamPrep products were not mutated.

Exact pre-mutation state is held outside the web root at `/www/theresidencyacademy_209/private/mr-web-0904c/woo-product-truth-preimage.json` with mode `0600`.

Controller and verifier: [MR-WEB-0904C product truth script](evidence-scripts/mr-web-0904c-products.php).
