# MX-APPT-5003G-R1 Candidate QA Summary

- Candidate source: `LIVE/scheduler/scheduler_v1.html`
- Candidate SHA-256: `e9e480a9c72b41e9f63d63cc2fcccb818c19647b4a6e2dbd45d0d0f81d1a15f2`
- Candidate bytes: `292441`
- Deterministic preview route: `http://127.0.0.1:8765/#home`
- Production status: three guarded candidate activations were each rolled back after authenticated student QA; production is held at stable V1 SHA-256 `98f87f6998ebce9280dacf9363d86f11016fe1e31ce46f2e52e5e636ea75f195`.
- Visual source: approved Fable R1 prototype and R1/StoryForge screenshots in the 5003F package.

## Visual coverage

- Exact 1440 x 900 PNGs: Home, Book Details, Book Time, Book Review, Upcoming, History, Settings.
- Exact 390 x 844 PNGs: Home, Search Open, Book Details, Book Time, Upcoming.
- Additional exact-width checks: 1024 Home and 768 Book Time.
- Exact 390 viewport instrumentation: `innerWidth=390`, document scroll width `390`, body scroll width `390`; the mobile Book Time layout has no page-level horizontal overflow. Its day row scrolls internally by design.

## Regression

- `node --test tests/scheduler/*.spec.mjs`: 6/6 PASS.
- Scheduler patch audit: 12/12 PASS.
- Current-adapter parity harness: byte-identical; the adapter itself has no worktree diff.
- Grid benchmark: 24–200 slots completed in 0.95–2.38 ms, all `<=16ms` checks PASS, with slot-button parity.
- `git diff --check`: PASS.
- Shared state/core, real API/auth/entitlement contracts, account preference, Force Classic, capability-gated actions, and MX-APPT-5002 repairs remain in place.
- The deterministic fixture is read-only for mutations; it returns `405 candidate_read_only` for any unsupported mutation and is not authenticated production acceptance.

## Browser diagnostics

`browser-diagnostics.json` records page-level Runtime, Console, Log, and Network failure events from the deterministic capture run: all four arrays contain zero events. Browser-process GPU/display stderr is excluded because it is host/headless infrastructure output, not page console output.

## Gate

Founder visual approval was received and guarded live QA was executed. StoryForge Home, Review, Upcoming, History reads, provider hydration, real reschedule, read-after-write reconciliation, Matrix Calendar continuity, and exact rollback were witnessed. Cancellation remains blocked by a read-only backend null-metadata exception; V2 is not live. See `live-deployment-qa.md`.
