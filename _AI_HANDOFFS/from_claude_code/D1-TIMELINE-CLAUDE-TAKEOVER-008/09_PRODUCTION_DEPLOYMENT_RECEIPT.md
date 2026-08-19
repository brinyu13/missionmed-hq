# 09 — Production Deployment Receipt

## RESULT: NO PRODUCTION MUTATION OCCURRED

Production is exactly as it was at takeover. No backup was created or deleted, no release
was packaged for cutover, no WordPress pointer moved, no Railway deploy was triggered, and
no environment variable was written.

This is not a failure to attempt the work — it is the governing safety gate the ticket
itself mandates ("Before production mutation: verify fresh appropriate backup or snapshot").
Two of the three blockers are Founder-only by construction.

## Blocking gates, and why each is Founder-only

### 1. Fresh pre-deploy backup cannot be created (hard blocker)
Kinsta manual backup capacity is 5/5. Creating the mandatory `D1-TIMELINE-CLAUDE-TAKEOVER-008-PRE-<UTC>`
backup requires deleting exactly one existing backup. The existing deletion authority names
*different* backups than the current oldest (`Post Timeline Builder Success`, Aug 4 2026,
10:08 PM), so no standing authorization covers it. **Deleting a recovery point is exactly
the class of irreversible action that requires explicit Founder authorization**, and I did
not take it.

### 2. AI provider variables are absent (blocks §7 live claim)
Railway `mission-timeline-api` → production still lacks `TIMELINE_AI_PROVIDER`,
`TIMELINE_AI_API_KEY`, `TIMELINE_AI_MODEL`, `TIMELINE_AI_CONSENT_VERSION`. All four absent is
a **safe** local-limited configuration; **partial configuration stops service startup**, so
they must be installed together. The values are secrets and must not pass through an agent
session. The Railway CLI is authenticated here as `info@missionmedinstitute.com`, so the
Founder can install them directly.

### 3. Authenticated production sessions were unavailable
`https://missionmedinstitute.com/timeline/` 303-redirects to `/member-dashboard/`. Without an
authenticated student/admin session, the canary journeys, the persona matrix, the live CV
journey, live media, live exports and the Matrix round trip cannot be executed or claimed.

## Live production observations (read-only, no mutation)

| Check | Result |
|---|---|
| `GET /timeline/` | `303 → /member-dashboard/?timeline_return_to=…` (auth gate active) |
| Timeline API `/healthz` | `{"ok":true,"service":"mission-timeline","version":"timeline-c9eda9eeb7d6cf98","schemaVersion":"d1-timeline-db-500.1"}` |
| Railway service | `mission-timeline-api` — **Online**, US West, deployment `2d815dbd-85b2-4d12-8ed0-8aea8fbc1347` |
| `GET /timeline/presentation/d1-409h-a1/assets/tex/board_denim.jpg` (unauthenticated) | `404` — see below |

## The production risk that most deserves the Founder's attention

The unauthenticated `404` on the texture above is **not conclusive** — the whole `/timeline/`
tree is auth-gated and returns the WordPress 404 page to anonymous requests. But it sits on
top of a confirmed, verified finding that is genuinely dangerous:

> **B-01 / F-01** — 38 runtime binary assets (8 textures, `us_flag.png`, 29 keynote PNGs)
> exist only in the accepted-asset root and in `dist/`, never in `web/` and in no git object.
> The protected kernel's core asset gate probes three of those textures and throws
> `ASSET_LOAD_FAILED` if **any** of them 404. That gate is **unreachable by the host
> fail-soft path**, because a core-asset failure carries no `error.path`, so the host
> rethrows and the board goes blank. `F-02` compounds it: `build-wordpress-runtime.mjs`
> silently leaves unresolvable JS asset literals relative, where the CSS and HTML rewriters
> throw — so a single missed rewrite ships quietly.

**If those assets 404 in production, every student's timeline is blank.** The very first
action of any deployment session should be to fetch those three texture URLs with an
authenticated session and confirm 200s. That is a five-minute check that de-risks the entire
release, and I could not perform it without a session.

## What is ready for cutover when the gates clear

- Source commit: **`b8b871d`** on `codex/timeline-rc1-stabilization-001`
  (baseline `e0c87ce`).
- Regression: **714/714 pass** (567 JS, 147 TS); `typecheck` clean.
- Protected D1-409H hashes: **all three verified unchanged**.
- Export evidence: 25 artifacts across five densities, zero console errors, all opened and
  visually inspected.
- No database migration is introduced, so no schema reversal is required.

An immutable release was deliberately **not** packaged: `build-static.mjs` refuses to run
while untracked files exist under `packages/mission-timeline` (finding F-11), and the
handoff tree is untracked by design. Packaging should be done from a clean checkout at
`b8b871d` as the first step of the deployment session.
