# MR-CACHE-011 STAT V3 Async Human Parity Follow-Up

Generated: 2026-05-09

## RESULT

PARTIAL: source patch applied for STAT V3 async-human parity gaps; full two-account live duel execution was blocked by auth exchange returning 401 for the provided test accounts in headless validation. No deploy, purge, or push was performed.

## Scope

Modified:

- `LIVE/stat_v3.html`

Created:

- `_AI_HANDOFFS/from_codex/MR-CACHE-011_POST_ASYNC_PATCH_VALIDATION.md`
- `_AI_HANDOFFS/from_codex/MR-CACHE-011_STATV3_ASYNC_PARITY_REPORT.md`

Untouched:

- `LIVE/stat.html`
- `LIVE/arena.html`
- `LIVE/daily.html`
- `LIVE/drills.html`
- `LIVE/daily_drills_v3.html`
- auth/login/session/bootstrap/exchange
- Supabase schema/RLS/functions
- Railway/backend
- WooCommerce/LearnDash/payment/USCE/video/secrets

## Legacy Contract Checked

Legacy `LIVE/stat.html` includes these async-human mechanics:

- Human roster and search through `duel_roster`, `stat_player_search`, and profile fallback lookup.
- Human challenge creation through `create_duel` with `p_opponent_id`, falling back to `opponent_id`.
- Incoming challenge polling against `duel_challenges`, with a `duel_roster` fallback.
- Challenge acceptance through `accept_duel` with `p_duel_id`, falling back to `duel_id`.
- Same-pack loading through `get_duel_pack`.
- Attempt submission through `submit_attempt`.
- Results polling through `fetch_results` after the first player submits, so the first player does not dead-end while waiting for the second.
- Rematch starts another duel against the previous human opponent.

## V3 Gaps Found

Before this patch, `LIVE/stat_v3.html` had partial human async wiring but was not equivalent to legacy:

- No incoming challenge polling/banner for the second student.
- No fallback RPC signatures for `create_duel` and `accept_duel`.
- Search depended mainly on `duel_roster`/`stat_player_search` and lacked the legacy profile fallback.
- After submit, V3 fetched results once and could remain stuck waiting instead of polling until the opponent finished.
- The Legacy STAT option on tab 1 pointed to `/stat`, which does not open the local legacy artifact from `http://localhost:8765/LIVE/stat_v3.html`.

## Changes Applied

- Added legacy-style safe RPC wrapper and signature fallbacks:
  - `statV3CreateDuelWithOpponent()`
  - `statV3AcceptDuelById()`
- Added incoming challenge polling:
  - direct `duel_challenges` read path
  - `duel_roster` fallback
  - session-scoped ignored challenge list
  - visible incoming challenge banner with Accept/Ignore actions
- Added profile-search fallback for opponent search:
  - profile term normalization
  - profile row normalization into V3 roster cards
  - profile-card enrichment by user ids returned from roster
- Added result polling after human submit and after loading an existing duel with a saved attempt.
- Added a waiting-for-opponent results state instead of rendering a final-looking result while the opponent is unfinished.
- Fixed the Legacy STAT card/link:
  - local `/LIVE/stat_v3.html` now opens `/LIVE/stat.html`
  - production still opens `/stat`

## Validation Performed

Static:

- `node --check` against extracted `<script>` content: PASS
- `git diff --check`: PASS
- Safety search: no `service_role`, no `supabase.auth.signUp`, no deprecated Supabase project marker found.

Local browser automation:

- Opened `http://localhost:8765/LIVE/stat_v3.html`.
- Confirmed `statV3LegacyStatUrl()` resolves to `/LIVE/stat.html`.
- Clicked the Legacy STAT card and confirmed navigation to `http://localhost:8765/LIVE/stat.html`.
- Injected a synthetic incoming challenge into V3 state and confirmed the Accept/Ignore banner renders.
- Clicked Ignore and confirmed the banner clears.
- Confirmed async functions are present in the runtime:
  - create fallback
  - accept fallback
  - incoming poll
  - result poll
  - profile search fallback

Authenticated two-account validation:

- WordPress login succeeded for provided test accounts in headless Playwright.
- Both legacy `/stat` and V3 `/stat-v3` received `401` from `https://missionmed-hq-production.up.railway.app/api/auth/exchange` after that login.
- Because the same auth-exchange block affected legacy and V3, no real duel was created and no Supabase write was performed.
- I did not modify auth/session/Railway/Supabase to work around this.

Live-state validation:

Command:

```bash
bash VALIDATION/validate_live_state.sh --strict --output _AI_HANDOFFS/from_codex/MR-CACHE-011_POST_ASYNC_PATCH_VALIDATION.md
```

Result: nonzero, expected for this source-only patch before deploy.

Key classifications:

- `/stat-v3`: SOURCE/DEPLOY MISMATCH because local source now intentionally differs from currently deployed CDN.
- `/stat`: LIVE CURRENT.
- `/daily`: LIVE CURRENT.
- `/drills`: LIVE CURRENT.
- `/daily-drills-v3`: LIVE CURRENT.
- `/arena`: SOURCE/DEPLOY MISMATCH from prior local/source changes, not modified by this patch.

## Best-of-3 Handling

I did not invent new backend series state. Legacy appears to implement rematch as a new duel against the prior human opponent rather than a separate persisted best-of-3 series table in this runtime file. V3 now preserves that same practical contract: finish a duel, then Rematch creates the next human duel against the previous opponent.

## Deploy / Purge / Push

- Deploy performed: NO
- Purge performed: NO
- CDN invalidation performed: NO
- Push performed: NO

## Remaining Risk

The V3 source now mirrors the legacy async-human frontend contract much more closely, but I could not complete a real two-account Supabase duel from this environment because auth exchange returned 401 for the provided test accounts in both legacy and V3. Brian should validate with an already-working authenticated browser session, or investigate why the test accounts can log into WordPress but cannot exchange into the Railway/Supabase session.

## Recommended Next Step

Review this patch locally at:

```text
http://localhost:8765/LIVE/stat_v3.html
```

Then, before deploy approval, test with an authenticated browser session that already passes the MissionMed auth exchange:

1. Student A opens STAT V3, searches Student B, and creates a match.
2. Student B opens STAT V3 later and sees the incoming challenge banner.
3. Student B accepts and loads the same duel pack.
4. Student A submits first and sees Waiting for opponent.
5. Student B submits later.
6. Both see final results.
7. Rematch creates the next duel against the same opponent.

Confidence: 82%.

Reservation: The source-level parity gaps are patched and local browser checks pass, but full production async proof remains blocked by auth exchange for the provided test accounts.
