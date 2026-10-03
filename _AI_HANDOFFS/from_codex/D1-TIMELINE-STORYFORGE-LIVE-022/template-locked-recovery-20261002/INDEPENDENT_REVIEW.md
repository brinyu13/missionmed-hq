# Independent Timeline review — founder decisions

Sealed 2026-10-03. This is an independent engineering and saved-artifact review, not Fable 5.1, native-application acceptance, founder acceptance, or deployment authority.

**Final bounded result:** No unresolved regression was found within the checks below at `7e5b6314434ee9b86fb7bb2dc0c55ba278d28b07`. The four requested fixtures pass factual survival and saved-artifact inspection. Two independently reproduced media-boundary failures were repaired and retested; a parent-discovered image-load omission was also independently checked. This does not establish universal layout sendability or acceptance of M20.

## Identity, scope and custody

The initial packet named `65c1a80677aed2a4247e8c5bb765d3715872e109`. At initial inspection, its 186 source hashes matched with zero drift; HEAD had advanced to the allowed legacy-test commit `69fff864e983c579a4b19ecedf97077c65c92d68`. See `review/source-start.json` (original source manifest SHA `b758e3f6f06c21bd54fb163be0d1155112e83a5cf7821f01944dd522e50433fe`). Parent authorized the subsequent bounded media repairs and final source recheck. Intermediate drift observations were retained rather than portrayed as frozen-source passes.

Final HEAD and manifest HEAD both equal `7e5b6314434ee9b86fb7bb2dc0c55ba278d28b07`. All 353 source/test hashes match; scoped Git status is clean. Final manifest SHA-256: `716f15f3ee84996461a3f2846c4a7ab3e5eb2d8712678d70fb4c3c3908e8b024`. Verification time: 2026-10-03T05:06:06Z. See `review/sealed-final-source.json`.

The actual reference PNG was visually inspected. Both reference files were rehashed:

- `FOUNDER_KEYNOTE_2025_TEMPLATE.key`: `113d22efb8ca2c00c29d8e57b92c1eb24ff2c66931f7138bbf23daa66dbba706`.
- `FOUNDER_KEYNOTE_2025_GOLDEN.001.png`: `bf48d25b2d46a75c868f98692d480147f8c7d8f234955608a27ca50b3b808836`.

Full authority paths are recorded in `review/source-seal-c1f2346.json`. The latest direct G1/G2/G4 decisions were read and take precedence over previously unresolved gates. Sources and exports were read only. Writes were limited to this report and this directory's `review/` diagnostics. No UI, browser, native app, provider, deployment, source edit, or commit was performed by this reviewer. Earlier template-locked seals were untouched.

## Priority-ranked findings and resolution

1. **P1 — private media crossed the actual public export boundary; closed at final target.** `buildExportPreviewInput` had retained ADVISOR_ONLY media and then instructed the renderer to use EVERYTHING. Direct public serialization excluded the photo, while request-path serialization painted it. The first repair excluded canonical `visibilityState` values but still admitted the supported legacy `visibility` field: ADVISOR_ONLY, STUDENT_ONLY, ADVISOR, STUDENT and whitespace variants could be resolved and painted. This was reproduced through actual request → local adapter control flow, not inferred solely from source. Evidence: `stored-media-before-privacy-fix.json`, `legacy-media-privacy.json`, `final-media-c1f2346.json`. The final shared normalization/projection fixes both paths. `final-media-post-alias.json` records 12 private cases: zero retained media, zero resolver calls, zero painted media, unchanged input. Explicit LOR-only sharing remains included only for LOR, and excluded for Interview-safe and Professional Connection. The focused regression also checks canonical-private versus legacy-safe precedence.

2. **P2 — synchronous completeness gate blocked valid stored media before async resolution; closed.** On the initial source, a profile photo with a storagePath and a resolver that could produce an image failed `buildExportRequest` with TIMELINE_EXPORT_MISSING_FIELDS. Calling the async serializer and actual adapter directly resolved it once and painted it. Initial output provenance is explicitly documented in `stored-media-initial-observation.json`: it reconstructs the tool observation because the original diagnostic JSON was overwritten during the second reproduction. It is not mislabeled as an untouched original capture. On final source, `stored-media-sealed-final.json` shows synchronous request acceptance, one resolver call and painted media, while the private control is excluded. Missing resolution still rejects PNG/PDF/PPTX before rasterization/inlining. Deferral is limited to pending media; it does not waive the final artifact gate.

3. **P2 — attached-image load failure could export an empty area; parent-discovered, final behavior independently checked.** The adapter now rejects MEDIA_FAIL_SOFT warnings before encoding or native PPTX construction. `final-media-post-alias.json` exercises PNG, PDF and PPTX with an injected load failure and separately with an unresolved expected ID. All six negative cases return TIMELINE_EXPORT_MISSING_FIELDS for the expected media and never encode. This independently proves adapter control flow; the reviewer did not perform a browser network/404 test.

## Four-fixture factual and visual verdicts

The actual 1920 PNGs and rendered Letter/A4 PDFs were visually inspected, alongside the actual reference PNG. Both PNG dimensions were verified. Final PNGs and both PDFs are byte-identical to the inspected iteration-2 artifacts. Final PPTX contents match iteration-2 except `docProps/core.xml`; slide XML, recovery records, media and relationships are unchanged. These comparisons were performed by this reviewer, not accepted from a parent summary.

| Fixture | Source events | Visible representation | Independent visual verdict |
|---|---:|---|---|
| M01 normal | 6 | 4 arrows, 2 milestones | Clear direct event labels, institutions and dates. The title, ribbon, six-row key and framed profile retain the reference grammar. Empty image/interview objects are absent. The lower-right area is sparse after optional furniture removal. |
| M02 sparse | 2 | 1 arrow, 1 milestone | The long work period and degree remain legible, with substantial unused space. No invented content fills the space. The input itself supplies Synthetic Hospital for the degree milestone and Synthetic Medical College in the profile; both survive. That source inconsistency is not introduced by rendering and is not adjudicated by this synthetic fixture. |
| M03 dense | 24 | 22 arrows, 2 milestones | All numbered hospital rotations and baseline events remain separate and nearby their dates/institutions. No observed material clipping or furniture occlusion in the saved PNG/PDFs. The clustered right half is demanding to scan; native PNG readability does not imply comfortable Letter handout reading. Roughly 18px labels become about 7.4pt when a 1920-unit board spans an 11-inch page. Density remains a visual acceptance limitation. |
| M06 overlapping | 3 | 3 full-span arrows | All three Jan 2023–Dec 2024 periods are visible; the key no longer hides arrow bodies. The compact lower-left profile retains its paper/corners and full-size text. Large vertical gaps around the key remain, but there is no replacement layout or consolidated record list. |

Both PDF page sizes preserve the same content and aspect ratio with white page margins. Eight PDF renders completed without diagnostics. The 2560 PNGs have the expected 2560×1440 dimensions; downsample comparison differs only at the low level expected from rasterization/resampling (mean absolute RGB differences roughly 1.0–1.6/255), not evidence of a content change.

Actual native PPTX XML was inspected, not merely recovery metadata. Event title, site, start and end text survived for all 6/2/24/3 source events. Corresponding recovered factual fields match the source, and SVG text matches the PPTX text. Each recovery text object was checked against its actual native shape ID/text. M01/M02/M03/M06 have 33/18/87/22 native text objects and 10/6/28/7 native groups; all structural validations and factual checks pass. Files are 16:9, with no duplicate native IDs or missing image relationships. See `actual-pptx-review.json` and `native-text-id-check.json`. This establishes native editable objects and material text presence, not native font rendering or a successful Keynote edit/save/reopen journey.

## Composition and regression challenge

- Two distinct completed education spans retain their individual source links, titles, schools and YEAR-precision start/end wording in the existing profile, with two completion flags, zero education arrows and six legend rows. No source mutation. This extends beyond the four saved fixtures, which contain no completed education-duration profile spans.
- Three same-month milestones remain distinct, retain full institutions/date text and keep the six-row key. M14 was checked at source level only; its saved artifacts are outside this seal.
- Explicit M06 profile geometry stays exactly `13,661,545,410` and collision-gates instead of silently compacting an authored layout. Automatic M06 compaction with a long school, visa text and supplied profile photo retains visible content and grows to `13,785,545,286`; no photo placeholder substitutes for the supplied image.
- Editing retains empty slots while program-facing output omits them. Tested edit/export axes match for M01/M02/M03/M06/M14; export request projection SVG equals public renderer SVG for these fixtures. Automatic composition does not mutate the source. These are source/helper checks, not live pointer or keyboard acceptance.
- Independently executed final tests: **31 passed, 0 failed, 0 skipped** across founder decisions, education mapping and presentation privacy. Log: `focused-tests-post-alias.txt`. The parent's broader suite and local build results are not recast as independent reviewer execution.

## Evidence hashes and limits

`review/sealed-final-artifacts.json` is the exact final artifact identity/mtime inventory, SHA-256 `fe0b8310caa22c5f95a70ed27dffe4d869678707d58da944a650615bb7143763`. `sealed-final-parity.json` SHA-256 is `25f0dbb860fb41648c2f7f40fb78067d584a0977f22dbc46a88c974f06c84d5b`. The final matrix receipt mtime is 2026-10-03T05:04:10Z and SHA-256 `e0c571d2fbf85b528422debb30d757001b15671c260674e2d194a5b5538e3ad6`.

The receipt is not a visual verdict for all 20 cases. M20 was not visually inspected in this bounded four-fixture review; its dense-layout sendability remains unaccepted here even if a mechanical gate passes. No real student facts, universal overflow guarantee, native application compatibility, provider delivery or deployment were accepted. Media tests use synthetic data and an inert renderer stub; load-failure tests inject rasterizer warnings. The actual exported four-fixture PNG/PDF/PPTX files provide separate real artifact evidence.

Reviewer evidence index: `review/sealed-evidence-index.json`, SHA-256 `40169b936fb09fae5cff66ee82b786897d1d9d160bad02fdd6a825da755f0a7e`. The report is sealed after the following artifact inventory; no further work is authorized by this report.

| Final artifact | SHA-256 |
|---|---|
| M01-png-1920x1080.png | `5119a0dd9d5a741f4509e21396dd3efce253e5ad0a5968f166599794bc699fef` |
| M01-png-2560x1440.png | `46f86d1248547a54312a84e7c2c4286b8c85c679ed491a38fcd580f79d6cf81a` |
| M01-pdf-letter-landscape.pdf | `c212fdecc435a97de5aef1ddeee57eb9dc273031188ae40ba195c7ea774e62d7` |
| M01-pdf-a4-landscape.pdf | `4dd18b2ae46f9ab7c74d4cc239580b060e27b351e716f2ccbb672378fdc16a0e` |
| M01-pptx-editable.pptx | `6523b88bdab5fe51c53dee860e8d7cc9e9751abde46c8ecd1e3a73b0023370f9` |
| M02-png-1920x1080.png | `51b58970dbbc71554dfaf17dc2c30cc5935660f4e69c201ba6622a8a12a68f74` |
| M02-png-2560x1440.png | `995186212fc95674601be063a9f779c27109922c991f4443e72fd7a493c71845` |
| M02-pdf-letter-landscape.pdf | `4c0d3a4263fc1427cbb6040516093adc84df6dc29dd31ac3c24f04959cd66353` |
| M02-pdf-a4-landscape.pdf | `6d2cb338991602a153b4e879e08fb6b0ee4add4930c96b2f5ca2e17a4a9d22b5` |
| M02-pptx-editable.pptx | `4066a67eacefa361b6cd13e4c0db2a46d4667c9b27d1e79cd667720949bb6304` |
| M03-png-1920x1080.png | `9f236efb0fc82bc880437efe3ec83ef23e9cc8681b2c93c4b4c936f9097208d4` |
| M03-png-2560x1440.png | `469940401f42a3728037360bf399d005ad9c202ec9d72086ce00c24873fdc7da` |
| M03-pdf-letter-landscape.pdf | `581ce76384eeb65ca71f31f26435cbe00423cddb2b6a1b4d0dc646aa4f455db7` |
| M03-pdf-a4-landscape.pdf | `a6bb46a45aea440ee0353f2064b55fef8877f3650b0af1641a457d161950c1d2` |
| M03-pptx-editable.pptx | `a09efd466019eeba26c2edd28da5265203aeb39937c116d41829f71e2895fbe9` |
| M06-png-1920x1080.png | `7a36937bac2f3eac21c9f3b10953225cc20d00c0f7bf28a79b09d864364c2f7a` |
| M06-png-2560x1440.png | `cc0d281d5bcac512fb9fe03119af574de176230c80109b0e7e74c9cb34bbd170` |
| M06-pdf-letter-landscape.pdf | `7a9338823e4f4d19a5046768e5001d60b090afb8dcc9a0ffe6d7c2c1ff19d314` |
| M06-pdf-a4-landscape.pdf | `936f5cbae17fddf43679c74e0c2fd3e4a8c7bab38e809465313a1a330f4ce113` |
| M06-pptx-editable.pptx | `165c04232ce9fc00370f945a62ad6ef8e63e00b2901cd2442b8f7ef7b12ed8cb` |
