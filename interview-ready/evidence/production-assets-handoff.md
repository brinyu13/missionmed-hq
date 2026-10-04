# Phase 1 permitted media build handoff — 2026-10-04

Outcome: local rights-safe Phase 1 payload is available without authorizing release. Existing preview/source originals and accepted presentation styles remain preserved.

Authority: universal BOOT dependency validation PASS against HQ tip `0feee579b0a9f2c90529220899f6cf6d21b8cd05`; OS pull already up to date. Exact IR mission/passport/authority routes remain absent. `interview-ready/TASK_PACKET.md` records explicit Founder authority for unprotected local frontend/data/build/QA and the protected publication barrier. This change touches only the assigned product build/QA files. No protected runtime, provider, OS registry, deployment, account integration or source-original deletion.

## Exact changes

- `production-assets.json`: explicit default-deny, SHA-256-pinned allowlist of 16 Founder-approved supplied-board derivatives and the Canon R50, Shure SM7B and Stream Deck + licensed CC derivatives. Evidence paths, license/source/author information are included; media originals remain unchanged.
- `build.py`: `--asset-profile production` builds a local rights-safe candidate. `--production` automatically selects that profile only after the existing release/site/account/media guard passes; no flags are changed. `--output-dir` permits temporary builds without altering tracked `dist`. Production asset selection is explicit, with hash validation and hard failure on an unapproved local image reference. Preview remains the default and retains the full source data/media.
- Production payload clears deferred in-person catalog/fashion products/outfits and Travel review data. Uncleared catalog photos/credits and external review thumbnail identifiers are excluded; original research/reviewer/manufacturer links remain available. Unknown asset references cannot fall back to local or remote image URLs.
- The generated production home uses a sourced board mark and information-only founder/product treatments where photos lack rights. The Phase 1 product renderer uses exact-model information rather than substituting a scene or generated SKU photo. Licensed photos retain visible credits. Before the Phase 1 wrapper installs, production initialization skips deferred renderers to support direct Phase 2 deep links against empty data.
- `qa-production-assets.py`: focused reproducibility, denied-byte/reference exclusion, approved bytes/credits, deferred-data exclusion, JavaScript syntax, asset-resolver denial, preview compatibility, negative release guard and optional local headless rendering checks. Uses temporary output directories and suppresses import bytecode writes.

## Verification

Command: `python3 interview-ready/qa-production-assets.py --browser` — PASS.

- 19 permitted assets embedded; all 35 other image assets denied by bytes and name (including uncleared manufacturer/retailer WebPs and legacy imagery).
- Safe candidate is deterministic: SHA-256 `0e3b3bb3bac6cb37fed846cb8f5d1873c8975c34e0bf407aadb588412b5410a7`, 1,448,074 bytes.
- Default preview remains deterministic and renders the three-tier camera deck: SHA-256 `9585410a43f711ffead5574bb30395b4683eeeed5225af400db1b862fcefe1bb`.
- Local headless builder smoke: 12 route cases; home, all four deferred initial deep links, camera/audio/accessory decks, experts, deals, kit and default preview. No page errors. Licensed product photographs load from embedded WebP data; information-only cards coexist with them. HTTPS requests are aborted during the smoke test.
- `python3 interview-ready/build.py --production --output-dir /tmp/ir-release-denial-test` rejects before writing output: protected release acceptance, account-backed persistence/isolation QA and commercial-media completion remain unrecorded. Site registration is concurrently updated by a separate scoped worker; this task neither changes nor asserts its approval.
- `git diff --check` — PASS. Tracked `dist` has no changes.
- `editorial.css` unchanged SHA-256 `d22e49621f9e5e73b6945499a32e04af051141f534b97b3cdef7f4551587e7ae`.
- `completion.css` unchanged SHA-256 `9a1fed84dd0cd81f2e1ea86c766841a3d44d01add151a18338e6092e54d42781`.

## Remaining boundary

These are builder/local candidate checks, not independent acceptance, a genuine free-account isolation/persistence result, production-site approval, deployment or live QA. Protected registration/decision authority and the existing release prerequisites remain blocking. The allowlist preserves the supplied approved board derivatives under Founder scope; it does not confer rights on a new donor or changed media. Existing manufacturer photos and Phase 2 retailer media remain preview-only. No push, merge or deployment is performed by this task. Candidate hashes reflect the shared `phase1.json` state at verification and must be regenerated if another scoped worker changes it.
