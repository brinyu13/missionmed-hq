# MX-DASH-6000B — Matrix Dashboard 2.0 · Implementation Handoff

STATUS: PROTOTYPE — AWAITING FOUNDER APPROVAL

Do not build from this document until Dr. Brian has reviewed the prototype and changed this status line. Nothing in this ticket authorizes production work, deployment, or any change to Matrix V1, authentication, permissions, Supabase, WordPress, Cloudflare, or Railway.

Prepared by: Fable 5 · 2026-09-02
Next AI after approval: Claude Code / Codex (implementation contractor)
Governance: Matrix is a protected active runtime (`PRODUCT_PASSPORTS/matrix.md`). Implementation requires its own mission record, decision records, and the Matrix runtime guard preflight before any protected asset is touched. This handoff describes *what* to build, not authority to build it.

---

## 1. Inputs

| Artifact | Path |
|---|---|
| Interactive prototype (single file, no backend) | `_AI_HANDOFFS/from_fable/MX-DASH-6000B_DASHBOARD_2_0_PROTOTYPE.html` |
| Design rationale + app design table + Fortnite borrowed/rejected | `_AI_HANDOFFS/from_fable/MX-DASH-6000B_DESIGN_RATIONALE.md` |
| Card art (8 SVGs, 1280×800 export + contact sheet) | `_AI_HANDOFFS/from_fable/MX-DASH-6000B_assets/card-art/` |
| Evidence screenshots (desktop + 390px) | `_AI_HANDOFFS/from_fable/MX-DASH-6000B_assets/evidence/` |
| StoryForge design authority | brinyu13/missionmed-hq @ 084ce55c1ce377595314580ab979c213f1c0405f (`styles.css`) |
| Dashboard V1 source of truth | Matrix runtime lock manifest canonical worktrees — `wp-content/plugins/missionmed-hub/assets/student-os.{js,css}`, `includes/class-mmed-student-os.php` |

---

## 2. Scope after approval (additive only)

Build Dashboard 2.0 as a **second renderer for the existing `dashboard` route**, selected by a server-stored experience preference. Dashboard V1 stays byte-identical and remains the fallback.

In scope:
1. Experience preference contract (mirrors Calendar V2 / MX-CAL-4200):
   - user meta `_mmed_dashboard_experience` ∈ {`classic`, `matrix2`}
   - option `mmed_dashboard_experience_default` ∈ {`classic`, `matrix2`}
   - option `mmed_dashboard_force_classic` (bool) — emergency rollback
   - precedence: force-classic → user preference → admin default → `classic`
   - server-resolved, exposed in the existing bootstrap payload; **no localStorage authority**
2. Dashboard 2.0 renderer (`student-os-dashboard-v2.js/.css`, lazy-loaded only when resolved experience = `matrix2`):
   - hero launcher, suggestion chips, featured apps (8), detail overlay, Today panel, Continue row
   - All Apps view (catalog grouped by existing module `section`)
   - Settings additions: Dashboard experience, Canvas (light/deep), Today panel density
   - Admin perspective content (nav additions, admin subtitles, admin Today tiles) — rendered only when the **server** says the user is an administrator
3. Shared family tokens file (`matrix-family-tokens.css`) so Calendar V2, Appointments V2, and Dashboard 2.0 draw from one source: fonts, ember accent, panel construction, role switch, buttons.
4. Classic remains reachable from Settings in both directions.

Out of scope (explicitly):
- Any change to V1 rendering, routes, App Mode contracts, or module registration.
- Semantic/AI routing. The launcher ships with the deterministic keyword tables from the prototype (`ROUTES`), extended as needed. Copy must never imply intelligence.
- New backend services, new tables, new auth paths. Today panel data comes from the endpoints V1 already calls (`/user/stats`, `/events`, scheduler `/calendar-feed`, `/messages`, `/files`, `/todos`).

---

## 3. Data mapping for the Today panel (truthful data only)

| Prototype element | Production source (existing) | Notes |
|---|---|---|
| Next up | earliest of `/events` + scheduler `/calendar-feed` within 7 days | Join link only when the event provides one; otherwise "Manage" only |
| Due soon | `/todos` (open, sorted by due) | Cap at 3 |
| Messages | `/messages?limit=5` + `unread_messages` from `/user/stats` | |
| Progress | `tasks_approved / tasks_total` + `next_step_label` | Same numbers V1's stat row shows |
| Continue | most-recent items from StoryForge bootstrap + any module exposing `recent` | Omit the row if fewer than 2 items; never fabricate |
| Admin tiles/signals | only if an existing admin endpoint provides the count; otherwise the tile is omitted | Prototype signals are illustrative — do not ship "signals" without a real source |

Empty states must exist for every panel (the prototype does not show them — design them from V1's `sos-empty` pattern with family tokens).

---

## 4. Featured app registry

Ship a static registry (`dashboard-v2-apps.json`) with the eight entries from the prototype's `APPS` array: id, name, category, hue, student subtitle, admin subtitle, one-liner, problem, how, benefits[], outcome, when, primary CTA, secondary CTA, launch route. Card art ships as the exported SVGs (inline for first paint of the eight cards; lazy for thumbnails).

Launch routes map to existing Matrix routes: `#dashboard` (HomeBase = Dashboard 2.0 home), `#calendar`, `#scheduler`, `#storyforge`, `#interview-prep` or the IV Prep launch URL, `#rise` (or its launch URL), `#ranklist`, `#lor`. Where a module is not enabled for the user (`modules[]` from PHP), the card still renders with its explainer and the CTA becomes "Not in your plan yet → Help"; never a broken launch.

Open naming decisions for Dr. Brian before build: **Scheduler vs Appointments**, **LOR Builder vs LOR Writer**. Both are single-string changes in the registry and nav.

---

## 5. Acceptance (after approval)

- V1: `matrix_runtime_guard.py preflight` passes; V1 assets unchanged by hash; Classic renders identically to production today.
- Experience precedence verified server-side for: no preference, user=matrix2, admin default=matrix2, force-classic on.
- Dashboard 2.0 does not hydrate full app modules (passport smoke test); featured cards + detail work with zero module loads.
- Every App Mode still shows "Return to Matrix Dashboard".
- Admin content never renders from client-side perspective state alone.
- 390px: horizontal featured row, sheet-style detail, drawer nav, tab bar; no horizontal page scroll.
- Keyboard: cards focusable, overlay traps focus, Esc closes, ←/→ browse; reduced-motion respected.
- Performance budget: unchanged from V1's dashboard module (`requests: 60, usableMs: 2000`).
- Rollback: flipping `mmed_dashboard_force_classic` returns every student to V1 with no deploy.

---

## 6. Rollback

Force Classic option (server) → all users on V1 immediately. If the V2 asset itself must be withdrawn, unregister the lazy asset; V1 code path is untouched, so no restore is needed.

---

STATUS: PROTOTYPE — AWAITING FOUNDER APPROVAL
