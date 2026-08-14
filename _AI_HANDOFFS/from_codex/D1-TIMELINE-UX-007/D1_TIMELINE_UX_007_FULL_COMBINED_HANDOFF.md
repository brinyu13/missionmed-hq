# D1 Timeline UX-007 — Full Combined Handoff

## Continuation checkpoint — 2026-08-14T16:38:59Z

The bounded File Vault V1 exact-version handoff and Timeline CV-intelligence integration are sealed at source commit `6faf34f84d3feeb270847ed76ac4b425122e3250`, static release `timeline-3e39c798e391e103`, WordPress release `timeline-wp-fc10bb67802a8888`, and API bundle SHA-256 `144f608cf001e08dbd5e12789e168fa8e545bd8c63287ce90a27b080445316af`. Automated regression is 711/711 PASS; protected-kernel browser verification is 42/42 PASS; UX-007 direct editor verification is 9/9 PASS with zero browser errors.

Production remains unchanged on WordPress `timeline-wp-ed84301a63d1ed11` and Railway deployment `8e0385ce-972c-41af-a81b-43c609ee668f`. Kinsta manual backup capacity is 5/5. The exact oldest backup is `Post Timeline Builder Success`, created Aug 4, 2026 at 10:08 PM; four newer manual backups and current daily backups remain visible, and no governing Timeline evidence identifies the oldest manual backup as the sole restore point. Existing deletion authority names other backups, so the release remains `STOP_SAFE` pending exact Founder authorization to delete only this backup and create the mandatory fresh `D1-TIMELINE-UX-007-PRE-<UTC>` backup. Unrelated application impact remains NONE.

## Verdict

RESULT: STOP_SAFE. The Timeline-owned candidate is implemented, tested, committed, pushed, and packaged, but no production mutation occurred. The fresh Kinsta provider-native backup and authenticated live-browser gate are unresolved; AI provider variables and the final File Vault byte-ingest seam also prevent truthful COMPLETE.

## Authority, source, and baseline

Worktree `/Users/brianb/MissionMed_worktrees/TIMELINE-RC1-STABILIZATION-001`, branch `codex/timeline-rc1-stabilization-001`, candidate commit `bdb5beced707687ab450ba4a73dc12e94dbd87bb`. Baseline before UX-007 was `d784ab086fd7b7547fccc623a51cffefe810dac3`. Accepted private visual assets were consumed read-only from commit `49ba56dacd2cddfc2fb2241839d54a03e85bc271`; unrelated dirty files were preserved.

The D1-409H protected master remains exact: HTML `bb471c57223c4a8d6c44d2398cc3c2a0da4467b61e7a2d779323c5be38e52c24`, CSS `4efd5088696a93914d5f6c3b7e14e98426239453b16712f152eb5bfe68598ef7`, JS `ed46fdf21588554aaaadbeaebacd81321177d45ad357c7e8cb8570a20786cb32`.

Current production remains `https://missionmedinstitute.com/timeline/`, WordPress `timeline-wp-ed84301a63d1ed11`, SSO SHA `e29b713e2c8aac0a6fcfa71818a01e8a00e35b8c73eed6d6059ec4833b3e8ba5`, and Railway `8e0385ce-972c-41af-a81b-43c609ee668f`. No production state changed.

## Canva laws and editor repair

Canva was directly operated. UX-007 reproduces the subset's mental model: visible selection, local pointer drag, direct eight-handle resize, lock proportions, modifier/marquee multi-selection, durable grouping/ungrouping, direct text editing, click/drag rail insertion, transient guides, locking/layering, and viewport-only zoom/pan/history. Collaboration, marketplaces, stock/AI/video/page features are intentionally excluded.

The protected D1-411A overlay is now the single live interaction layer for Advanced media, text, and elements. Scene state adds shared z-order, media geometry/crop/fit, text fit/minimum/line-height/alignment, and durable groups without destructive migration. Gestures cache snap anchors, use local animation-frame transforms, and commit once on release. Live text editing preserves the mounted overlay; group handles no longer sit beneath children. Fatal updates retain the last valid canvas. Zoom is transient and does not alter document revision.

## AI CV intelligence

The existing browser PDF/DOCX extractor now uploads the source through private Timeline SOURCE custody and calls owner-only `POST /v1/documents/{documentId}/intake/analyze`. The optional server OpenAI Responses adapter sends bounded source blocks only, sets `store:false`, and requires strict structured output. Deterministic post-validation binds every factual field to valid source blocks/excerpts, enforces canonical taxonomy/dates, derives confidence, rejects unsupported facts, performs deduplication, and permits bulk acceptance only for wholly explicit safe candidates. The quality assistant returns explainable accept/edit/dismiss suggestions without silent mutation. Provider/schema/outage failure preserves a clearly labeled limited parser; award, education, certification, and research-fellow rules were corrected. No database migration was added.

Production currently lacks the required names `TIMELINE_AI_PROVIDER`, `TIMELINE_AI_API_KEY`, `TIMELINE_AI_MODEL`, `TIMELINE_AI_CONSENT_VERSION`. All absent is safe local-limited mode; partial configuration stops startup. Values were never printed or requested.

## File Vault

Timeline SSO now provides read-only same-origin source list/detail routes backed only by the existing File Vault V1 contract. They require login, Origin, nonce, Timeline entitlement/consent, immutable principal, owner, and confirmed current version. Administrators are filtered to their own source records; output is storage-opaque metadata only. Missing/cross-owner/unconfirmed sources are indistinguishable 404s and an unhealthy contract returns truthful 503 plus local-upload fallback. The browser adapter supports real list/search/select and nonce renewal without sending a Timeline bearer.

File Vault selection does not yet stream the exact version into Timeline AI. A fresh authenticated V1 list/detail/download proof and bounded one-use server ingestion/provenance seam remain required. No File Vault, Matrix, shared DB/R2, CDN, DNS, or provider object was changed; V2 and direct shared-storage bypass remain prohibited.

## Implementation and files

Commit `bdb5bec` changes 40 files (2,790 additions, 102 deletions): Timeline intelligence/API/server/storage modules; editor kernel, domain projection, canvas, Advanced Studio, intake and auth clients; Timeline SSO File Vault gateway; OpenAPI/security docs; PHP harness; unit/integration/browser tests. Frozen presentation, existing documents, Matrix shell, and unrelated applications were not changed.

## Tests and browser evidence

Full authoritative regression: 709/709 PASS (145 TypeScript/security/API; 564 JavaScript/browser/domain). Typecheck, API build, API-only boundary, PHP lint, `git diff --check`, and all three protected hashes PASS.

Direct browser interaction receipt: 9/9 PASS, zero page/console errors. Proven actions: one-commit pointer drag; locked and freeform resize; lock/unlock; direct inline text; modifier multi-select; group move/resize/ungroup; click-to-add; physical rail pointer drop at exact (1500,820); useful panels containing 13 Elements, 20 Shapes, 28 Icons, 276 Flags, 2 Text presets, 12 Backgrounds, and Brand; mounted viewport-only zoom; direct-manipulation undo/redo.

The nine journeys ran in 7.7 seconds; per-journey median 411.6 ms, p95 1,001.2 ms, max 1,109.2 ms. These are whole-journey wall times, not fabricated frame telemetry. Large-data regression thresholds also pass. Production performance telemetry remains pending.

## Export fidelity

The same protected kernel produced editor, preview, PNG, Letter PDF, and A4 PDF. `RC1_TIMELINE_1920x1080.png` was opened and inspected. Letter and A4 PDFs were rendered and opened: single-page 792×612 pt/922,895 bytes and 841.89×595.28 pt/922,936 bytes. Background, texture, fonts, axis, Color Key, profile card, events, and Advanced composition were present without collision, clipping, or missing assets. Live exports must be repeated/opened after cutover.

## Immutable candidate

- Source: `bdb5beced707687ab450ba4a73dc12e94dbd87bb`.
- Static: `timeline-ea605f39719b1f57`, 63/63 hashes verified.
- WordPress: `timeline-wp-77d5940be11cd434`.
- WordPress payload SHA: `3dcc7d8bfd6704999c0e90712285ede846826118fe32fa2d4ae8414e0dd9f15e`.
- API bundle SHA: `5364c525eda2250f8b20c512c125ab7366cc1240d182db7e9c9f7d076819a93f`.
- App asset: `app.a1c9f7b531dd.js`, SHA `a1c9f7b531dd5b9fc3a6ff7519cc0a9d33baaf52554c3e016bbedd1e7af7c939`.

## Security and blast radius

Identity, entitlement, consent, owner/document/source binding, RLS, private media, direct-API denial, strict provider output, content-free telemetry, and File Vault storage-opacity tests pass. Live personas must rerun after deployment. Unrelated application impact is NONE. No Matrix, StoryForge, Arena, USCE, File Vault runtime, shared Railway service, Cloudflare, DNS, Supabase, public storage, or unrelated WordPress system was modified.

## Backup and rollback

Existing accepted rollback evidence: provider backup `TIMELINE-RC1-EDITOR-UX-004-PRE-20260808T161951Z`, scoped snapshot `/www/theresidencyacademy_209/private/timeline-rc1-recovery-backups/20260808T170309Z-export-save-hotfix`, code target `timeline-wp-05a4b831501cfc59`. For UX-007 cutover, reverify inventory and create `D1-TIMELINE-UX-007-PRE-<UTC>`, preserve current WordPress `timeline-wp-ed84301a63d1ed11` and Railway `8e0385ce-972c-41af-a81b-43c609ee668f`, and create a fresh checksum-verified scoped snapshot. Rollback is kill switch -> atomic WordPress pointer reversal -> Railway rollback, with no schema reversal because UX-007 adds no migration.

## Fixed-denominator status and blockers

Execution phases: 4/6 complete (66.7%). Local/editor/API candidate and verification are complete; production preparation/canary and live release verification remain. Confidence of final live completion after gates clear: 72%.

Blockers:

1. Chrome extension control is unavailable even though Chrome, extension, and native-host diagnostics pass. Policy requires Founder permission before opening a fresh selected-profile Chrome window.
2. Kinsta provider-native inventory cannot therefore be freshly verified and the mandatory predeployment backup cannot be created. No production mutation is allowed before it.
3. Railway needs the four server-only AI variables at service `mission-timeline-api` -> production -> Variables. Secret values must not enter chat/evidence.
4. File Vault needs authenticated live V1 list/detail/download proof and the bounded exact-version one-use ingestion seam before journey 19 can pass.

After clearing these gates: create/verify backups, deploy the API from the Timeline package root, install the immutable WordPress release, run canary, all 25 production journeys, open live PNG/PDF artifacts, rerun security personas and Matrix return, then update this handoff and checksums. Do not label COMPLETE before those steps.
