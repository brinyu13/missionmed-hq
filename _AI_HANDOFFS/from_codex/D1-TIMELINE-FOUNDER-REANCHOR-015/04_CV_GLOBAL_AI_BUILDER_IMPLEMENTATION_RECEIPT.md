# D1-TIMELINE-FOUNDER-REANCHOR-015 — CV, Global Intelligence, and AI-First Builder Receipt

Date: 2026-08-24
Scope: bounded local implementation only
Production mutation: **NONE**

## Result

**IMPLEMENTED / TARGETED TESTS PASS**

This lane adds an evidence-bound semantic review contract, conservative date/category validation, high/medium/low review actions, approval-driven Timeline and profile prefill, current global country coverage, a maintainable rights-compatible global medical-school identity registry with an explicit unverified fallback, and a last-good Builder preview wrapper. It does not edit the protected renderer, Advanced Studio, export renderer, File Vault owner, shared providers, or production.

## AI and privacy law preserved

- The OpenAI call remains server-side.
- The request explicitly sets `store: false`.
- Strict structured output remains enabled.
- The provider receives the source hash and evidence blocks, but not the student-visible source filename.
- Non-null factual fields must be tied to supplied source evidence.
- Impossible dates, unsupported normalized months/days, contradictory open-ended ranges, and open-ended claims without `Present`/`Current`/`Ongoing` evidence are rejected.
- No candidate is silently accepted. High-confidence evidence-safe candidates may be bulk accepted by the student; medium-confidence candidates require quick confirmation; low-confidence candidates receive one smallest targeted question.

OpenAI's current official data-controls documentation was checked before preserving this design; the explicit `store: false` request is intentional.

## Student workload reduction

After the student approves CV suggestions:

- approved events are added as one undoable batch;
- supported medical-education facts prefill only blank profile fields;
- existing student-entered profile values are never overwritten;
- source-claimed medical schools remain review-required and analytics-ineligible until normalization;
- exam candidates enter a concise confirmation queue rather than forcing retyping;
- Builder displays a plain-language “AI did the first pass” summary.

## Provenance and confidence contract

Schema/prompt version: `d1-timeline-cv-intelligence-2` / `d1-timeline-cv-prompt-2`

Each validated candidate now carries:

- normalized semantic interpretation;
- source object ID and SHA-256;
- local source filename for student-facing provenance only;
- block, page, section, exact excerpt, and character span when exact;
- evidence fields and explicit/inferred support;
- reason and uncertainty;
- calibrated confidence;
- review lane, action, missing fields, and smallest question.

## Global country and school sources

### Countries

- 249 current ISO 3166-1 alpha-2 countries/territories.
- Generated from the public-domain `tzdata` `iso3166.tab` snapshot identified in the manifest.
- Deprecated aliases previously produced by brute-force `Intl.DisplayNames` probing are excluded.

### Medical schools

- Existing U.S. MD/DO path remains the governed Department of Education DAPIP snapshot.
- Global path contains 1,560 rights-compatible Wikidata CC0 medical-school identities spanning 122 current ISO countries/territories.
- Search supports official name, aliases, city/alternate city, country, and country code.
- Global matches expressly do **not** assert accreditation, active status, degree authority, or analytics eligibility.
- `School not listed` creates an explicit unverified, local normalization-queue record excluded from analytics.
- WDOMS was not redistributed or scraped because its current terms restrict commercial copying/redistribution. This avoids introducing an unlicensed dataset while keeping the source seam replaceable with a future licensed/approved registry.

Dataset receipts:

- `global-wikidata-2026-08-24.json` file SHA-256: `c8a4c4be87b154a997e3b42dc76937baf7f31ee58e63e61ebaeb15caa3379beb`
- compact records SHA-256: `7ef320b7dcba3c1c1c3f1abd562f7d765b26ce61152b3f14ac400e137189e8df` (matches embedded manifest)
- `global-manifest.json` SHA-256: `091f0113bb5bbb12574625f7d91f291b8e96258108ba558874c8056036494b1b`
- `iso-3166-1-alpha-2-2024.json` SHA-256: `e049a5eebee04c9baadd15fef2355be688c94ec11305cc613b2c694bbcaa39e3`
- generated browser module SHA-256: `da272a85b11fdb3cdc22ddbd671b984741128ac9851df80c057591a325fbc280`

## Last-good Builder preview

The Builder route now wraps the existing canonical preview entrypoint without changing renderer-owned code. A valid SVG becomes the document's last-good preview. An isolated render failure or exception retains that preview and shows a small status overlay instead of replacing the Timeline with a blank/loading state.

## Files changed in this lane

### Server intelligence

- `packages/mission-timeline/src/intelligence/cv-intelligence-schema.ts`
- `packages/mission-timeline/src/intelligence/cv-intelligence-service.ts`
- `packages/mission-timeline/src/intelligence/cv-post-validator.ts`
- `packages/mission-timeline/src/intelligence/openai-cv-intelligence.ts`

### Builder/intake integration

- `packages/mission-timeline/web/js/uxr-002/app.js`
- `packages/mission-timeline/web/js/uxr-002/builder.js`
- `packages/mission-timeline/web/js/uxr-002/intake-d1-408-adapter.js`
- `packages/mission-timeline/web/js/uxr-002/intake.js`
- `packages/mission-timeline/web/js/uxr-002/last-good-builder-preview.js`

### Global reference data

- `packages/mission-timeline/scripts/build-global-reference-data.mjs`
- `packages/mission-timeline/web/js/uxr-002/datasets.js`
- `packages/mission-timeline/web/js/uxr-002/iso-country-codes.js`
- `packages/mission-timeline/web/js/uxr-002/medical-school-registry.js`
- `packages/mission-timeline/web/data/geography/iso-3166-1-alpha-2-2024.json`
- `packages/mission-timeline/web/data/medical-schools/global-manifest.json`
- `packages/mission-timeline/web/data/medical-schools/global-wikidata-2026-08-24.json`

### Packaging and tests

- `packages/mission-timeline/scripts/build-static.mjs`
- `packages/mission-timeline/scripts/build-wordpress-runtime.mjs`
- `packages/mission-timeline/tests/d1-reanchor-cv-global-intelligence.test.ts`
- `packages/mission-timeline/tests/d1-reanchor-global-builder.test.mjs`
- `packages/mission-timeline/tests/fixtures/d1-timeline-founder-reanchor-015/synthetic-international-cv-eval.json`

## Verification

- Focused TypeScript and JavaScript regression bundle: **65/65 PASS**
  - TypeScript: 16/16
  - JavaScript: 49/49
- Latest international/date-validation subset: **10/10 PASS**
- Latest global Builder subset: **5/5 PASS**
- Typecheck: **PASS** before the final fixture-only import and stricter date-evidence test update; the updated TypeScript test executed successfully through `tsx`.
- JavaScript syntax checks: **PASS**
- `git diff --check`: **PASS**
- Dataset embedded-record integrity: **PASS**

No live OpenAI request, real student data, provider mutation, production deployment, or production browser claim is included in this receipt.

## Release integration dependency

Before immutable release packaging, regenerate/review `packages/mission-timeline/release/manifest.json` after all concurrent lanes settle. Both release builders now require:

`web/data/medical-schools/global-wikidata-2026-08-24.json`

The current pre-change release manifest does not yet contain that asset, so a release build must remain fail-closed until the accepted manifest is regenerated and reviewed. This is the only known packaging dependency from this lane.
