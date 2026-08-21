# 01 — Takeover Baseline (D1-TIMELINE-CLAUDE-TAKEOVER-008)

Owner: Claude Code. Date: 2026-08-19.

## Source of truth (proved, not assumed)

| Repo | Branch | HEAD | Tree | Verdict |
|---|---|---|---|---|
| `TIMELINE-RC1-STABILIZATION-001` | `codex/timeline-rc1-stabilization-001` | `e0c87ce` | clean | **SOURCE OF TRUTH** |
| `D1-MacProTimeline-UXR-002` | `codex/d1-411b-beta-integration` | `49ba56d` | dirty (docs) | superseded |

Proof:
- `git merge-base --is-ancestor 49ba56d e0c87ce` → **true**.
- Commits in RC1 not in UXR-002: **173**. Commits in UXR-002 not in RC1: **0**.
- UXR-002's only tracked *code* delta is one npm script alias
  (`build:standalone`) in `packages/mission-timeline/package.json`, plus untracked
  standalone build scripts and handoff docs. **No UX-007 work is lost** by working in RC1.

No destructive git operation was run in either repository. No `reset --hard`,
no `clean`, no stash, no branch replacement. UXR-002 dirty state is preserved untouched.

## Codex checkpoint inherited

Codex closed at `RESULT: STOP_SAFE`, 4/6 phases (66.7%). Local implementation and
packaging complete; **no production mutation performed**. Inherited blockers:

1. Kinsta manual backup capacity 5/5 — the mandatory fresh pre-deploy backup cannot be
   created without Founder authorization to delete exactly one existing backup.
2. Railway `mission-timeline-api` lacks the four server-only AI variables
   (`TIMELINE_AI_PROVIDER`, `TIMELINE_AI_API_KEY`, `TIMELINE_AI_MODEL`,
   `TIMELINE_AI_CONSENT_VERSION`). Absent = safe local-limited mode; **partial = startup stop**.
3. Authenticated Chrome control unavailable for live production personas.
4. File Vault exact-version byte ingestion seam unproven live.

## First-hour findings — reproduced live in a real browser

The Founder's verdict ("automated PASS is not sufficient") is **correct**. Driving the
real app immediately reproduced release-blocking defects that the 711/711 automated
suite does not catch, because the automated harness does not exercise the served
runtime path.

### D-01 (fixed) — Canonical timeline never renders on the local served runtime
`scripts/serve.mjs` sent `frame-ancestors 'none'` + `x-frame-options: DENY` for the
protected kernel iframe. The CSP exemption matched only `/web/presentation/d1-409h-a1/`,
but the app requests the kernel under the `/timeline/` mount
(`/timeline/presentation/d1-409h-a1/D1-409H_FINAL_VISUAL_MASTER.html?defer=1`).
Result: `net::ERR_BLOCKED_BY_RESPONSE`, canvas stuck on "Preparing your timeline…"
forever, console `Timeline canvas update unavailable {surface: edit, code: 18}`.
**Fixed** — exemption now covers both mount prefixes.

### D-02 — A missing decorative texture kills the entire canvas
The eight `presentation/d1-409h-a1/assets/tex/*` textures are build-time *accepted
assets*; they exist in `dist/` but not in `web/`. When they 404 the protected kernel
raises `ASSET_LOAD_FAILED` from its **core** asset gate
(`D1-409H_VISUAL_MASTER.js:666`). `kernel-host.js` fail-soft only omits *media* with a
resolvable `error.path`; a core-asset failure has none, so `omitFailedMediaFromKernelModel`
returns `omitted:false` and the host rethrows — **the student's whole timeline goes blank**.
A decorative texture must never be able to blank a timeline. Architectural, not local-only.

### D-03 — Home "Latest timeline preview" is a dead grey box
With 15 events present the Home kernel reports
`ready:"false"`, `error:"TEXT_FIT_UNRESOLVED"`,
`errorMessage:"We could not display your timeline. Your saved information is still safe."`
The student's **first screen** shows an empty grey panel. Release-blocking.

### D-04 — Layout engine cannot place a routine 15-event timeline
Edit surface rendered only via `EXISTING_LAYOUT_OVERLAP_RECOVERED` after 8
`EVENT_LANE_AUTOASSIGNED` warnings. Visible result: overlapping/jumbled event labels
(the "Fixture Clinics/Teaching Hospital" cluster), the Color Key panel covering a live
event arrow, and a student-facing banner reading
"Some items overlap. Your timeline is still available; move an item slightly to improve the layout."
Asking a student to hand-fix the layout is precisely the failure this commission exists to end.

### D-05 — Empty-state canvas renders no default background/furniture
With zero events the edit canvas is an empty dark panel. Ticket §1 requires the default
background/furniture to always render.

## Local runtime now usable for human acceptance testing
`.claude/launch.json` config `timeline-rc1` runs the package `serve` script with
`TIMELINE_ACCEPTED_WEB_ASSET_ROOT` pointed at the built `dist/` tree so the accepted
private assets resolve. This restores a faithful local student runtime.
