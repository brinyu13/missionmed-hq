# P1 RISE 4006 Test And Stress Evidence

## Automated Results

| Command | Result | Scope |
|---|---|---|
| `npm run test:rise` | 66 passed, 0 failed | Identity, specialty, evidence, pre-read source/grant authorization, exporter/importer lineage, pre-read index integrity, durable abuse adapter, runtime/auth, matching, distance, CAM, SQL lifecycle contracts |
| `npm run test:rise:browser` | 26 passed, 0 failed | Chrome real-browser functional, accessibility, focus, race, provenance, history, responsive, slow-response, dialog, and adversarial checks |
| `npm run test:rise:stress -- --out .../synthetic-stress-report.json` | Pass | 6,500 synthetic programs; 100 concurrent injected-session subjects/searches |
| `node --test missionmed-hq/tests/mmc-private-mount-validation.mjs` | 1 passed, 0 failed | Existing HQ private-mount validation |
| `npm test` | Exit 0; **0 tests discovered** | Not counted as meaningful coverage |
| `npm audit --audit-level=high` | 0 vulnerabilities | Clean install audited 171 packages |
| `git diff --check` | Pass | Whitespace integrity |
| `node --check` over tracked RISE JS/MJS source | Pass | Syntax integrity |
| credential-pattern scan | No matches | RISE source, handoff, package metadata |

## Browser Coverage

Playwright used installed Chrome with reduced-motion preference and dark color scheme. Automated viewport checks covered 390x844, 430x932, 768x1024, 1024x768, and 1440x900. The in-app Browser independently exercised the repaired Explorer, Profile, Evidence, and Compare views and verified persistent fixture/current-availability warnings, per-field provenance, absent/unknown accounting, unique action identities, and no stale cached candidate after moving to a fresh test origin.

Covered journeys include Command Home, Explorer, combined-specialty membership, search, filters, bounded pagination, program profile tabs, field provenance, authoritative absent/unknown counts, comparison, compare/profile focus restoration, disabled ACTN/CAM controls, operator-disabled state, browser back/forward, deep links, skip link, route focus/scroll, dialogs and 20 repeated modal cycles, stale Explorer/Profile/Compare/Queue response suppression, slow response recovery, empty results, Unicode/XSS-shaped input, duplicate-name action labels, mobile filter disclosure, axe scans, 44px compare removal targets, and responsive layout.

## Stress Result

| Metric | Result |
|---|---:|
| Synthetic programs | 6,500 |
| Concurrent HTTP searches | 100 |
| Successful responses | 100/100 |
| Wall time | 492.2 ms |
| Median request | 295.7 ms |
| p95 request | 462.3 ms |
| Maximum request | 480.2 ms |
| RSS after run | 166.3 MB |
| Heap used after run | 27.8 MB |

This is a local, single-process synthetic stress result. The harness uses the injected host-session boundary with a unique opaque subject per concurrent request. A separate core regression proves that weighted bulk requests from one subject receive `429`, a second subject has an independent bucket, the bucket map is bounded, and logs contain only a short subject digest. The stress result does not establish production database, network, cache, multi-instance, or real-identity performance.

## Build Evidence

`npm run build:rise` passed with build ID `rise_web_cc8f346c0ac1`. Source and generated web assets are byte-identical. Manifest hashes:

| Asset | SHA-256 prefix |
|---|---|
| `index.html` | `d1adca99` |
| `styles.css` | `25159271` |
| `app.js` | `9029582c` |
| `vendor/lucide.js` | `40bee90e` |

Generated `rise/dist` and registry data are ignored and were not committed as production artifacts.

## Evidence Files

- `artifacts/playwright-report.json`
- `artifacts/synthetic-stress-report.json`
- `artifacts/screenshots/rise-explorer-1440x900.png`
- `artifacts/screenshots/rise-explorer-390x844.png`
- `artifacts/screenshots/rise-explorer-430x932.png`
- `artifacts/screenshots/rise-explorer-768x1024.png`
- `artifacts/screenshots/rise-explorer-1024x768.png`

**Test verdict:** `ISOLATED_CANDIDATE_PASS_PRODUCTION_TEST_MATRIX_INCOMPLETE`
