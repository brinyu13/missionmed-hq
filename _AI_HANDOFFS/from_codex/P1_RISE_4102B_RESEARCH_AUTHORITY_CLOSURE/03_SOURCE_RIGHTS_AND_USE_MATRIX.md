# 03 SOURCE RIGHTS AND USE MATRIX

This is an operational governance matrix, not legal advice. `SOURCE_USE_POLICY.json` is the controlling machine-readable policy. Unknown or absent source classes default to `DO_NOT_USE`.

| Source class | Research | Internal storage | Student display | Raw redistribution | Derived intelligence |
|---|---|---|---|---|---|
| MissionMed canonical identity metadata | Authorized for exact routing joins | Authorized | Not authorized | Not authorized | Routing/continuity only; never program facts |
| Inherited FREIDA payload | Not authorized, including as a discovery or matching input | Existing immutable quarantine only | Not authorized | Not authorized | Not authorized |
| Residency Explorer | Do not use absent written AAMC authorization | Not authorized | Not authorized | Not authorized | Not authorized |
| Official residency program page | Denied by default; conditionally allowed only by a hash-pinned per-domain decision | Denied until that decision; then minimal discrete facts + provenance | Not authorized by this release | Not authorized | Conditional, provenance-bound, publication candidate only |
| Official hospital/institution page | Denied by default; conditionally allowed only by a hash-pinned per-domain decision | Denied until that decision; then minimal discrete facts + provenance | Not authorized by this release | Not authorized | Conditional, provenance-bound, publication candidate only |
| Official faculty/leadership page | Denied until domain and privacy-minimization decisions pass | Denied until those decisions | Not authorized | Not authorized | Conditional |
| Official resident roster | Denied until domain access and named pre-collection privacy approvals pass | Denied until controller, purpose, access, retention, deletion, and expiry are approved | Not authorized | Not authorized | Conditional; no sensitive inference |
| AAMC general public materials | Manual policy reference only | Minimal citation record | Not authorized | Not authorized | Not authorized without source-specific review |
| ACGME public site/reports | Manual reference only | Minimal citation record | Not authorized | Not authorized | Not authorized without license/review |
| NRMP reports/data | Manual policy reference only | Minimal citation record | Not authorized | Not authorized | Not authorized without permission/license |
| ABFM reports/data | Manual reference only | Minimal citation record | Not authorized | Not authorized | Program-rate ingestion not authorized |
| ABIM reports/data | Manual reference only | Not authorized pending review | Not authorized | Not authorized | Not authorized pending review |
| MissionMed internal records | Case-by-case owner/consent review | Not authorized by this release | Not authorized | Not authorized | Not authorized |
| Unofficial aggregators/blogs | Not authoritative; do not use | Not authorized | Not authorized | Not authorized | Not authorized |

## Controlling evidence reviewed 2026-08-10

- AMA Terms of Use: https://www.ama-assn.org/about/terms-use
- FREIDA provenance: https://assets.ama-assn.org/resources/doc/freida/x-pub/freida-about-freida.pdf
- Residency Explorer Terms and Conditions: https://students-residents.aamc.org/applying-residency/residency-explorer-terms-and-conditions
- AAMC Website Terms and Conditions: https://www.aamc.org/website-terms-conditions
- ACGME Terms of Use: https://www.acgme.org/about/legal/terms-of-use/
- ACGME Publication/Document Usage: https://www.acgme.org/about/legal/publication-document-usage/
- NRMP Match Data request/licensing page: https://www.nrmp.org/match-data-submit-request/
- ABFM Terms of Use: https://www.theabfm.org/terms-of-use/
- ABIM Data and Reports: https://www.abim.org/about/data-and-reports/
- U.S. Copyright Office facts guidance: https://www.copyright.gov/help/faq/faq-protect.html

## Fail-closed rule

Every accepted fact requires an allowed source class, a hash-pinned conforming source-access decision for its exact domain, separately allowing research and minimal storage, a URL, an evidence locator, a retrieval date, an identity check, and a maturity state. Derivation and automation each require their own positive decision. Resident-roster collection additionally requires a hash-pinned privacy decision. Both decision files must pass their executable validators and be unexpired. If any requirement fails, leave the field blank and record the unresolved reason. A source permission failure blocks only the affected source, operation, field, record, or program unless identity itself is uncertain.
