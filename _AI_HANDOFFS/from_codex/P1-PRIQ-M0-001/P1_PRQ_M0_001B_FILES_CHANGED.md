# P1-PRIQ-M0-001B files changed

## Recovery source

- Replaced `apps/priq-web/public/index.html` with the exact frozen artifact.
- Removed incorrect `apps/priq-web/public/app.js` and `styles.css` after preserving their hashes/content summary.
- Added six frontend recovery adapter files under `apps/priq-web/public/priq/`.
- Added backend fixture/state modules and hardened domain, flags, research, server, and MIR budget behavior.
- Added build/accessibility/visual scripts under `scripts/` and generated `apps/priq-web/dist/`.
- Updated package scripts/lock, strict config, env tracking, ignore rules, and README.
- Reconciled to `infra/priq/migrations/20260802095500_priq_foundation.sql`; removed the unapplied competing Supabase candidate.
- Updated/added PRIQ tests under `tests/priq/`.
- Added 38 visual evidence PNGs under `evidence/priq-001b/screenshots/`.
- Updated the 001A audit and created all required 001B handoffs.

## Preserved source

MIR core/providers/queue/telemetry, contracts, prompt/schema assets, integration boundaries, and valid prior handoffs remain in the tree. No sibling-product file, production system, database, auth provider, storage service, or deployment target changed.

Implementation commit: `3a4b336` (`feat(priq): restore frozen interface and governed local foundation`). The documentation/evidence commit is reported in the final task response because a commit cannot self-record its own hash.
