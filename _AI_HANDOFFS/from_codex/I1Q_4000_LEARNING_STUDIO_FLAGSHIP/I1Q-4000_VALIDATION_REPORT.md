# I1Q-4000 Validation Report

Date: 2026-07-22<br>
Lane: local synthetic P4<br>
Engineering outcome: `PROTOTYPE_COMPLETE (P4) — LOCAL SYNTHETIC ONLY`<br>
Release/adoption outcome: `LOCAL_P4_INTERACTION_CANDIDATE`

## Serialized automated validation

Executed from `prototype/` after the final source freeze:

```text
pnpm run test
pnpm run lint
pnpm exec tsc --noEmit --incremental false
```

Results:

- optimized local vinext build: PASS
- Node test suite: PASS, 9/9
- ESLint: PASS, zero errors
- TypeScript no-emit check: PASS

The nine tests cover shell/CSP, required product surfaces, boundary wording and external-request absence, persistence/recovery and responsive contracts, unique exact-intersection queues, catalog count/subject consistency, reducer ordering and durable Quick reveal, explicit builder presets plus active-session hydration, and checksum-valid malformed-state rejection.

## Sealed package validation

Executed from the package root after the final documentation and screenshot repair:

```text
node tools/validate-package.mjs
```

Result: PASS. The seal contains 60 included artifacts with 60 matching SHA-256 ledger entries, 21 distinct true-PNG scenario captures, five independently rechecked external/predecessor source hashes, no included symlinks, and null D1/R2 hosting fields. Dependency and generated runtime state (`node_modules`, `dist`, and `.wrangler`) is explicitly excluded and must remain unstaged.

## Browser interaction checks

The live local application was exercised through the browser at `http://localhost:3000/`.

- direct and simulated Daily Drills launch paths
- all four templates and three builder steps
- single/multi drill and subject selection with exact-intersection disclosure
- answer → confidence → lock → reveal ordering
- question-map reveal gate and focus restoration
- Quick reveal/self-report persistence contract
- pause, reload-oriented persistence, resume, active-session recovery, removal, favorites, and reset
- replay, unavailable replay, Zoom Notes, local note, and bounded Rounds states
- all eight analytics tabs and keyboard tab navigation
- simulated prediction disclosure and separate observed/fixture labels
- corrupt/future schema recovery and cross-tab conflict messaging by source/test contract

Responsive probes covered 320, 390, 720, and 1440 CSS-pixel widths with no document horizontal overflow. At 390 CSS pixels, visible enabled buttons met the 44 × 44 CSS-pixel target check. The mobile drawer, builder, reset dialog, and side panel trap focus, close with Escape, inert their background, and restore the trigger. The 720 capture is a reflow proxy only; actual browser 200% zoom was not tested.

## Screenshot evidence

- 21 current screenshots
- all files have verified PNG signatures
- all 21 scenario captures have distinct byte digests
- desktop captures use a 1440 CSS-pixel-wide browser state; page scenarios use full-page capture while panel scenarios 07, 08, and 21 use the 1440 × 900 viewport
- mobile captures use a 390 × 844 CSS-pixel viewport
- all screenshot modification times postdate the final prototype source freeze

See `SCREENSHOT_BOOK/README.md` for per-image provenance and limitations.

## Independent review

- Vitruvius: PASS for the local P4 accessibility/responsive gate after keyboard, focus, semantics, target-size, readability, and contrast repairs; not formal WCAG or assistive-technology certification.
- Turing: initial PARTIAL stress result identified reset, malformed-payload, reducer-ordering, Quick-reveal, and dead-control defects; each identified blocker was fixed and covered by the final tests/browser pass.
- Sagan: no remaining release-blocking active-UI truth or functional defect after hardening; prompt preservation remains PARTIAL because a 30–60 minute Founder session was not timed and no production/medical/canonical claim is authorized.
- Sentinel: final PASS for the sealed local review package: exact included-tree/manifest/ledger parity, 60/60 checksums, 21 distinct meaningful PNG scenarios, no sealed secrets or client network/production wiring, null D1/R2, and all required deliverables. This is not deployment or release approval.

## Known limits

- no human Founder approval or 30–60 minute timed exploration was performed;
- no real medical content or teaching was evaluated;
- no screen-reader lab, assistive-technology matrix, or actual 200% zoom certification was performed;
- target template durations are design targets, not measured completion times;
- prediction and mastery displays are seeded/simulated and uncalibrated;
- the FNV-1a local-state checksum detects accidental corruption only and is not cryptographic authentication;
- no deployment, remote persistence, auth, telemetry, production API, or protected integration exists.

Validation verdict: the implementation is a complete, locally runnable P4 interaction package. Its production readiness, medical validity, psychometric validity, accessibility certification, canonical adoption, and learner release remain unproven and unauthorized.
