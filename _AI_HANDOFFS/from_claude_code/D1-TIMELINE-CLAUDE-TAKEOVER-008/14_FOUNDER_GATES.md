# 14 — Founder Gates

Everything that does **not** require Founder-only authorization has been done. What remains
is listed here exactly, with nothing bundled in that I could have done myself.

## Gate 1 — RESOLVED, not a gate (correcting my earlier report)

I previously reported the four `TIMELINE_AI_*` Railway variables as **absent**, and listed
installing them as a Founder action. That came from the inherited Codex handoff and was
**stale**.

All four are present in `missionmed-timeline` → production:
`TIMELINE_AI_PROVIDER`, `TIMELINE_AI_API_KEY`, `TIMELINE_AI_MODEL`,
`TIMELINE_AI_CONSENT_VERSION` (names only — no value was read, printed or stored).

`src/server/production-server.ts` throws `TIMELINE_AI_*` startup errors on *partial*
configuration and rejects any provider other than `openai`. The service is **Online** and
`/healthz` returns ok, which proves the four are present and internally consistent. **The
OpenAI CV intelligence provider is live in production.** No Founder action is required here.

## Gate 2 — GENUINELY BLOCKED: the Kinsta backup slot

I could not verify this myself: there is no Kinsta CLI on this machine and the provider
console requires an authenticated browser session that was not available. What follows is
the **inherited record**, not something I re-confirmed, and it must be re-checked in the
console before anything is deleted.

Per the Codex checkpoint:

- Manual backup capacity: **5 / 5 (full)**
- Exact oldest manual backup: **`Post Timeline Builder Success`**
- Exact creation time: **Aug 4, 2026 at 10:08 PM**
- Newer manual backups exist: **yes — four of them**
- Daily backups exist: **yes — available through Aug 13, 2026 at the checkpoint**
- No governing Timeline evidence identifies the oldest manual backup as a sole restore point

**The backup I propose deleting: `Post Timeline Builder Success` (Aug 4, 2026, 10:08 PM)** —
the oldest of the five, superseded by four newer manual backups and by the daily series.

Deleting it frees the slot for the mandatory pre-deploy backup
`D1-TIMELINE-CLAUDE-TAKEOVER-008-PRE-<UTC>`.

**I did not delete it.** Existing deletion authority names *different* backups, so no
standing authorization covers this one, and destroying a recovery point is exactly the class
of irreversible action that needs an explicit decision. I need one sentence from you:
authorize deleting that specific backup, or name a different one.

Please re-confirm the five entries in the console first — the inventory above is over two
weeks old.

## Gate 3 — GENUINELY BLOCKED: an authenticated production session

`https://missionmedinstitute.com/timeline/` 303-redirects to `/member-dashboard/`. Without a
logged-in session I cannot run the canary journeys, the persona matrix, a live CV upload, the
File Vault chooser, live media, live exports, or the Matrix round trip — so none of those can
be claimed.

**The single highest-value use of that session takes five minutes** and should happen before
anything else: fetch these three URLs while logged in and confirm they return 200.

```bash
curl -sI https://missionmedinstitute.com/timeline/presentation/d1-409h-a1/assets/tex/board_denim.jpg
curl -sI https://missionmedinstitute.com/timeline/presentation/d1-409h-a1/assets/tex/paper_bond.png
curl -sI https://missionmedinstitute.com/timeline/presentation/d1-409h-a1/assets/tex/leather_pebble.png
```

The protected kernel probes exactly those three before it will render anything, and throws
`ASSET_LOAD_FAILED` if any is missing — a failure the host cannot recover from on a first
load. If they 404 in production, every student's timeline is blank. Unauthenticated they
currently return the WordPress 404 page, which is expected for an auth-gated tree and proves
nothing either way.

## What I did instead of waiting on those gates

- Closed the mechanism that could ship a missing asset silently: the WordPress runtime
  builder now fails the build on an unresolvable asset literal instead of leaving it
  relative, and `check-release` verifies 24 runtime-critical assets are present and
  non-empty. Both pass on the current build.
- Rebuilt `dist-api/server.mjs`, which was still serving a File Vault cross-student
  existence oracle from an intermediate build.
- Everything in `12_CONTINUATION_STATUS.md` and `13_LANE_IMPLEMENTATION_AND_VERIFICATION.md`.
