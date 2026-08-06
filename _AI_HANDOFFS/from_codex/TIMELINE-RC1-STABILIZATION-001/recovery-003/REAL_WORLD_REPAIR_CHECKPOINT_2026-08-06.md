# TIMELINE RC1 REAL-WORLD REPAIR — PRODUCTION CHECKPOINT

Generated: 2026-08-06 11:31 EDT

## Fixed-denominator completion

- Live production journeys passed: **8 / 50 (16%)**.
- Newly passed live journey numbers in this checkpoint: **none**. The release candidate has not replaced the live immutable release.
- Local engineering and browser gate: **702 / 702 PASS** (138 TypeScript/service tests, 525 browser-module/contract tests, 39 full browser workflows across administrator, eligible-360, and removed/read-only personas).

Local proof is not counted as a required live UI journey.

## Live production state

- Live URL: `https://missionmedinstitute.com/timeline/`
- Live source: `aaec3d580e81e3fccf21bd73c3254cf780faa814`
- Live WordPress release: `timeline-wp-7311f6a96acee7cf`
- Live payload SHA-256: `78e01a14b2dada2e006fd98eaeb202663fb0c023be9007bebcd1c959bec7438f`
- Live Railway deployment: `8e0385ce-972c-41af-a81b-43c609ee668f`
- Live API release: `timeline-c9eda9eeb7d6cf98`
- Live schema: `d1-timeline-db-500.1`
- Live admission: enabled, `eligible_360`, canary `[85]`, consent `d1-500-v1`

## Sealed candidate

- Source commit: `eb7c57c8f7b7b870b3c937614623b235569d1599`
- Static release: `timeline-ad2582fe3ac647d7`
- WordPress release: `timeline-wp-aad47d971da67d2d`
- WordPress payload SHA-256: `4e00da5b889830408f0d6f365c15cea8cf338101f0d0440059551d11a27b56e7`
- Branch: `codex/timeline-rc1-stabilization-001`
- Branch is pushed and matches origin.
- No API/server/database source changed; Railway deployment is not required for this candidate.

## Completed repairs

1. Native PDF and DOCX CV extraction, provenance/confidence review, bulk acceptance, and useful event prefill.
2. Durable media identifiers, atomic replacement, reference-safe deletion, retryable retirement queue, and visible Replace/Delete controls.
3. Self-contained PNG/PDF capture CSS, true Letter/A4 pages, preserved 16:9 board geometry, and opened-artifact inspection.
4. Persistent last-good preview keyed to visual state rather than save timestamps.
5. Builder/Home progress and exact resume, Step 2 CS, correct exam chronology, specialty selector, and Personal preset/date/country/icon corrections.
6. Advanced asset rail, media/text duplication, constrained drag/resize, aspect lock, on-canvas text editing, persistent zoom, layering, history, and undo/redo.

Manual year-axis and color-key editing remain outside the current D1-411A protected presentation contract.

## Preview and opened export evidence

- Live-before Home preview: `evidence/RC1_CURRENT_PREVIEW.png`
- Candidate canonical preview: `recovery-003/evidence/export-fidelity-local/canonical-export-preview.png`
- Candidate opened PNG: `recovery-003/evidence/export-fidelity-local/generated-export-1920x1080.png`
- Candidate opened Letter PDF: `recovery-003/evidence/export-fidelity-local/generated-export-letter.pdf`
- Candidate rendered Letter page: `recovery-003/evidence/export-fidelity-local/opened-letter-page.png`
- Candidate opened A4 PDF: `recovery-003/evidence/export-fidelity-local/generated-export-a4.pdf`
- Candidate rendered A4 page: `recovery-003/evidence/export-fidelity-local/opened-a4-page.png`

The candidate artifacts were opened and inspected locally. They do not count as live export journeys until the production downloads are repeated and opened from the canary release.

## Performance

- PNG generation: 288.1 ms in the consolidated browser gate (prior focused run: 289.2 ms).
- Letter PDF: 683.8 ms (prior focused run: 653.4 ms).
- A4 PDF: 546.3 ms (prior focused run: 513.8 ms).
- 3-, 7-, and 13-event rendering: zero collision, out-of-bounds, or text-fit warnings.
- Five live app surfaces use one protected presentation model.
- Browser console errors in the export workflow: zero.

## Backup and rollback state

- New PostgreSQL backup: `ed9de312-0522-4299-b6f1-4845cd464232`, name `TIMELINE-RC1-REAL-WORLD-REPAIR-PRE-20260806T152449Z`, non-expiring.
- New Timeline-scoped Kinsta snapshot: `/www/theresidencyacademy_209/private/timeline-rc1-recovery-backups/20260806T1528Z-real-world-repair`.
- Scoped snapshot contains the exact current release, pointer, SSO plugin, MU route, private settings JSON, and verified `SHA256SUMS`.
- Current pointer, plugin hash, route hash, and payload hash matched the expected live baseline before snapshot creation.
- Immediate WordPress rollback target remains `timeline-wp-7311f6a96acee7cf`.
- Immediate Railway rollback target remains deployment `8e0385ce-972c-41af-a81b-43c609ee668f`.
- No production pointer, option, route, plugin, API, database row, or user entitlement has changed in this checkpoint.

## Genuine blockers

### Kinsta provider-native backup capacity

The live manual-backup inventory is 5/5. The previously authorized deletion target `B1-508 pre deployment 2026-07-31` is absent. The current oldest manual backup is:

- `Pre IV Prep On call Upgrades`
- created Aug 2, 2026 at 2:21 PM EDT
- expires Aug 16, 2026 at 2:21 PM EDT

The earlier conditional authorization required a stop if inventory differed. Deleting this different backup requires a new exact Founder authorization. Cutover remains blocked until a fresh provider-native backup can be created.

### D1-411A presentation-contract amendment

The protected adapter hardcodes adaptive axis mode and the protected board/export pipeline owns the canonical six-category color key. Host-layer code cannot truthfully provide manual year-axis or color-key editing. Completing those journeys requires a bounded D1-411A amendment permitting:

1. a manual axis range/mode override; and
2. six-ID/order-preserving category label/color overrides.

That amendment would touch the presentation schema, protected adapter, locked HTML/SVG/export serializers, protected hashes, and visual/export evidence. It is not implied by ordinary RC1 host repairs.

## Confidence of final live completion

- **82%** that this task reaches the requested fully live Matrix outcome after the two bounded Founder decisions.
- Engineering confidence in the sealed candidate: **94%**.
- Remaining deployment risk is concentrated in provider-backup capacity and production UI journey execution, not in an unbounded engineering failure.

