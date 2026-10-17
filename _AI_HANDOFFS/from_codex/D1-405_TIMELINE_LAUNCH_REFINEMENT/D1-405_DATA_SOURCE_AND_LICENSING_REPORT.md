# D1-405 Data Source and Licensing Report

## Scope and release boundary

This report covers the locally bundled medical-school registry implemented for
the D1-405 Core Info milestone. The candidate is local-only and no-deploy.
There are no production, Matrix, cloud-storage, or runtime network writes.

The registry loads one bundled JSON chunk. Search, filtering, selection,
normalization queuing, persistence, and analytics eligibility are evaluated
locally.

This is an engineering assessment, not legal advice.

Implementation checkpoint:
`3f7923f feat(timeline): normalize core medical education data`.

## Source and rights matrix

| Source | Use in candidate | Rights assessment | Decision |
|---|---|---|---|
| [U.S. Department of Education DAPIP](https://ope.ed.gov/dapip/) | Agency-filtered U.S. MD/DO institution results, exact active program-profile verification, accreditation metadata | Public federal service data. No affirmative redistribution license statement was found during the engineering review. | Bundled only in the local/no-deploy candidate. Production redistribution requires legal confirmation. |
| [Wikidata](https://www.wikidata.org/) | High-confidence medical-school display names and aliases | Structured data is available under [CC0 1.0](https://www.wikidata.org/wiki/Wikidata:Licensing). | Bundled as attributed CC0 enrichment with response and query evidence. |
| [World Directory of Medical Schools](https://www.wdoms.org/) | None | Public terms and subscription terms do not provide authority for this candidate to redistribute a WDOMS compilation. | Not ingested, bundled, queried at runtime, or represented as coverage authority. |
| [LCME directory](https://lcme.org/directory/) | None | Directory content was not used as a redistributable dataset. | Not ingested or bundled. DAPIP agency/program records are the only LCME-related source evidence. |
| [AACOM terms](https://www.aacom.org/home/Policies/terms-of-use) and [AOA/COCA accreditation](https://osteopathic.org/accreditation/) | None | No directory compilation was treated as authorized for redistribution. | Not ingested or bundled. DAPIP agency/program records are the only COCA-related source evidence. |

## Ingestion and provenance

- Dataset version: `us-dapip-2026-07-30`
- Retrieved: `2026-07-30T23:39:11.186Z`
- Ingestion tool: `ingest-medical-school-registry.mjs` version `1.1.0`
- DAPIP agency/program pairs:
  - agency `46`, program `78`, `MD`
  - agency `48`, program `52`, `DO`
- DAPIP method:
  1. agency-filtered advanced search;
  2. exact institution specialized-profile lookup;
  3. active agency/program record match;
  4. bounded Wikidata medical-school name/alias enrichment.
- Runtime network requests: none.

## Record and quality ledger

| Measure | Result |
|---|---:|
| Source-reported records | 196 |
| MD records | 154 |
| DO records | 42 |
| Exact active institution-program records | 179 |
| Agency results without an exact active program record | 17 |
| Normalized display-name records | 125 |
| Records requiring name or crosswalk review | 71 |
| Superseded duplicate crosswalk records | 1 |
| Completeness claim | Not asserted |

The 17 agency-only records remain selectable for truthful student matching, but
are program-review-needed and analytics-ineligible. Records without a
high-confidence name match retain a source-derived label and remain
normalization-review-needed and analytics-ineligible.

One stale Medical College of Georgia DAPIP crosswalk is preserved for
provenance, linked to the current canonical record, excluded from selection,
and excluded from verified analytics.

## Stable identity and alias rules

- Exact canonical ID:
  `mm-school-us-dapip-unit-{unitid}-program-{programId}`
- Agency-only canonical ID:
  `mm-school-us-dapip-unit-{unitid}-agency-{agencyId}-program-unconfirmed`
- DAPIP record sequence is retained only in `accreditation_record_id`.
- Aliases are search aids, not alternate canonical identities.
- Unrelated dental, dentistry, divinity, and hospital aliases are rejected.
- Ambiguous Wikidata matches are rejected.
- Stale duplicate crosswalks remain source evidence but are not selectable.
- Unlisted and international submissions receive a local `unverified:` ID,
  enter the durable normalization queue, and are excluded from verified
  analytics.

## Integrity evidence

| Artifact | SHA-256 |
|---|---|
| Ingestion script | `70761d690ec0a13dc2ee15b4186d8e100484cb871523a539f58f31a695a9e8bf` |
| Dataset file | `432eb2f7e7686ef0bc20fa6ed6eeb3c269d11919bcca1152736fcc7dbb79ca0b` |
| Dataset records payload | `41674dfba514744a685a0aa4073c4e8de5c341a0d57f50e1c59692c8891a5b04` |
| External manifest | `9acacaa3c14d67f6bcbe7c8363245270dad16e41993fbab3ac47a71c268a8745` |
| Raw source snapshot | `0cfd57c29402ab5ba16f92f91bf43d54d57f975a677d481c863c3040931114f0` |
| DAPIP accreditation-response aggregate | `5af3eac7032bf53270319f821284ca7c16af8386b3a2e495e8b482969289f9d1` |
| Wikidata response | `f34a8156ffcefd5c4946480527bfcd2a52859542bc525c8933d8bcdbd183875c` |

Raw evidence:

`evidence/data-sources/medical-school-source-snapshot-2026-07-30.json`

The snapshot retains the exact DAPIP request bodies, search responses, program
metadata, all 196 specialized-profile responses, the Wikidata query and
response, retrieval metadata, and response hashes.

## Limitations and release gate

- DAPIP is agency-reported, unaudited, and may be incomplete or stale.
- No completeness percentage or missing-school inventory is asserted.
- U.S. MD/DO coverage is the only bundled registry coverage.
- International schools use the explicit unverified normalization path.
- No WDOMS, LCME-directory, AACOM, or COCA-directory compilation is bundled.
- Production redistribution of the DAPIP-derived bundle requires affirmative
  legal confirmation. This is a production-only external gate and does not
  block the local/no-deploy D1-405 milestone.
