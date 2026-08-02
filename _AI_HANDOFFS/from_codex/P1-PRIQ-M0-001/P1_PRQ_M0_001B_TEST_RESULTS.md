# P1-PRIQ-M0-001B test results

Final local gate on 2026-08-02: PASS.

| Gate | Result |
|---|---|
| `npm run typecheck` | PASS |
| `npm run priq:test` | PASS, 22/22 |
| `npm run priq:a11y` | PASS, 46 named buttons and 6 primary navigation controls statically checked; live switches received names/keyboard semantics |
| `npm run priq:visual` | PASS, frozen SHA plus 13 structural/interaction contracts |
| `npm run priq:build` | PASS, exact frozen index copied to `dist` |
| `npm run priq:preview` | PASS at 4312; recovery state `ready`, exact viewport, local authority visible |
| 1512x982 browser sequence | PASS: six rooms, Prepare, four modals, kill, release, preview |
| 1440x900 and 1728x1117 | PASS: all six rooms, exact body/viewport dimensions, no body scroll |
| `git diff --check` | PASS |
| frozen source SHA | PASS: `995bf401...a8a477` |

Browser control proof produced audit events for access, Copilot, Lab, Birds, research, video, founder-note use, publication, budget, provider route, cue gap, kill, and release. Independent API reads confirmed disabled endpoints fail closed, the runtime budget changes with the UI, and the human-review rule rejects disable attempts.

Dependency audit: direct `form-data` and `ws` high-severity findings were upgraded to fixed versions. One low-severity Windows-only `esbuild` development-server advisory remains through `tsx@4.21.0`; this macOS loopback app does not use the esbuild development server.
