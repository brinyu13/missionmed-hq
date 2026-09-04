# MR-WEB-0904B Production Deploy Log

Status: **PASS**

The bounded production entitlement and commerce configuration was applied in place. Existing Woo product IDs, orders, student records, unrelated products, and WordPress content were preserved.

Applied controls:

- IV Prep Complete: parent 3576; active Session D variation 5865; $2,799; mapped to course 5227.
- IV Prep Essentials: parent 5504; active Session D variation 5867; $1,199; mapped to course 3646.
- Past Session C variations 5864/5866 closed.
- 360 parent 3575 and variations 5862/5863 retained but made non-purchasable.
- Legacy plan parents 5511/5512/5513 and variations 5868–5873 closed.
- Guest checkout disabled and account creation enabled.
- Card-only launch controls retained; BACS, Affirm, Klarna, and legacy surcharge were not enabled.
- MissionMed Hub Residency fallback grant removed in favor of the official LearnDash WooCommerce integration.

Production configuration readback passed **20/20**. The transaction-safe controller stores its exact preimage at `/www/theresidencyacademy_209/private/mr-web-0904b/preimage.json`; the file is outside the web root and was not committed.

Controller: [MR-WEB-0904B production state controller](evidence-scripts/mr-web-0904b-production.php).
