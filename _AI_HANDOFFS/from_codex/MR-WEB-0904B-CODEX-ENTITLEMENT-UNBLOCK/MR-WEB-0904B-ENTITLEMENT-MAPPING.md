# MR-WEB-0904B Authoritative Entitlement Mapping

Status: **PASS**

The official LearnDash WooCommerce integration is the Mission Residency course-access authority. Product and active-variation `_related_course` metadata is the authoritative mapping. The MissionMed Hub patch prevents its historical direct-access fallback from issuing an independent Residency grant, avoiding two entitlement systems that can drift.

| Program | Woo parent | Active variation | LearnDash course | Granting status | Revocation | Account flow |
|---|---:|---:|---:|---|---|---|
| IV Prep Complete | 3576 | 5865 | 5227 | Processing / Completed | Refunded / Cancelled / Failed | Account required; checkout registration enabled |
| IV Prep Essentials | 5504 | 5867 | 3646 | Processing / Completed | Refunded / Cancelled / Failed | Account required; checkout registration enabled |
| 360 Match Mentorship | 3575 | 5862, 5863 preserved | 3893 | No public grant path | Non-purchasable | Enrollment closed |

Safety controls:

- Guest checkout is disabled for the launch flow.
- Checkout account creation is enabled.
- Complete and Essentials mappings exist on both the preserved parent/product family and active variation.
- The native integration owns order-ID counters, duplicate-event idempotency, grant, and revocation.
- The Hub retains its unrelated non-Residency behavior; the bounded patch changes only Residency access ownership.
- Production Hub patch SHA-256: `ecaebcf172f43735fe5a96cb0c8481944646462c1866f85cbe2a8738ee74886f`.

Implementation evidence: [MissionMed Hub native Residency entitlement patch](evidence-scripts/missionmed-hub-native-residency-entitlement.patch).
