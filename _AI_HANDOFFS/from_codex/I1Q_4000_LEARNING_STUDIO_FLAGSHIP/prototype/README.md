# MissionMed Learning Studio — I1Q-4000 P4

This directory contains the standalone, fully interactive Founder-review prototype requested by I1Q-4000. It is a local synthetic product exploration, not a production implementation or an adopted MissionMed runtime.

## Run locally

For Founder review, return to the package root and double-click `OPEN_IN_CHROME.command`. The shared launcher keeps the stable `http://localhost:3000/` origin, opens the browser only after the application identity check passes, and owns only the server it starts.

For engineering diagnostics, the underlying requirements remain Node.js 22.13 or newer and pnpm 11.9.0. `pnpm-lock.yaml` is the only dependency lock:

```bash
pnpm install --frozen-lockfile
pnpm dev
```

Open `http://localhost:3000/`. A simulated Daily Drills entry is also available at `http://localhost:3000/#/daily`.

## Validate

```bash
pnpm test
pnpm run lint
pnpm exec tsc --noEmit --incremental false
```

`pnpm test` performs an optimized local build and runs deterministic shell, boundary, unique-queue, reducer-ordering, persistence-recovery, reset, and malformed-state checks.

## What is functional

- direct and simulated Daily Drills entry;
- single- or multi-drill and single- or mixed-subject exact intersections;
- Quick Review, Board Review, Clinical Mastery, and Adaptive learning contracts;
- answer/confidence/commit/reveal sequencing and Quick Review self-report;
- replay, unavailable replay, Zoom Notes, local Question Note, and optional Rounds states;
- favorites, flags, pause, reload, exact resume, empty-state recovery, and local reset;
- current-session, lifetime, mastery-proxy, heatmap, trend, replay, explanation, and confidence views;
- current, rolling, last-eight, lifetime-trend, and simulated confidence-interval prediction presentation;
- browser-local Founder review notes.

## Data and safety boundary

All bundled questions, drills, histories, scores, media anchors, and integration surfaces are synthetic fixtures. No Dr. J corpus, Gold Set, external or protected learner/account record, Zoom workspace, replay service, protected API, auth system, database, analytics service, or production runtime is connected. Local synthetic session state is stored unencrypted in the browser.

The only application persistence key is `missionmed.learning-studio.i1q4000.v1`. User-entered Question Notes and Founder notes remain unencrypted in that browser. Do not enter patient, credential, or other sensitive information. The FNV-1a checksum detects accidental local-state damage; it is not cryptographic authentication.

The restrictive content policy disallows external origins. It intentionally permits same-origin resources, inline framework scripts/styles, and `data:` image/font/media sources. The client UI makes no external fetch, XHR, or WebSocket call; the worker only performs same-origin application and asset serving.

## Explicit limits

- `NOT DEPLOYED`
- `NOT PRODUCTION-INTEGRATED`
- `NOT MEDICALLY VALIDATED`
- `NOT PSYCHOMETRICALLY VALIDATED`
- `NOT ACCESSIBILITY-CERTIFIED`
- `NOT CANONICAL PRODUCT ADOPTION`

Template time ranges are design targets, not measured completion times. The prediction model and 95% confidence interval are seeded, simulated presentation fixtures and are neither calibrated nor learner-derived. The Clinical Mastery P4 demonstrates a three-stage session sequence, not a per-concept multi-rung Ladder. Rounds remains an optional, bounded branch and the I1Q-2002 verdict is not inherited as product canon.

The Sites-compatible worker, empty D1 schema, and `.openai/hosting.json` are retained build scaffolding only; D1/R2 are null and unused. This package is not deployed; production deployment remains outside this P4 handoff and gated by the active product passport and DR-006.

See the package-level combined handoff and `SCREENSHOT_BOOK/README.md` one directory above for evidence and review guidance.
