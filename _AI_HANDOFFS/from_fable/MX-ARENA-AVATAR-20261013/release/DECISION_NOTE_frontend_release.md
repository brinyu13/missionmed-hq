# Decision note — MX-ARENA-AVATAR-20261013 Arena frontend polish release (input packet for MissionMed OS filing)

Authority: Founder directive 2026-10-13 20:05 ET ("SURGICAL FRONTEND POLISH + AVATAR DELETION SAFETY"), executed by Fable 5.1.
Surface: Cloudflare R2/CDN object `html-system/LIVE/arena.html` (served inline by the `/arena` WordPress wrapper) + one new immutable asset `arena/assets/branding/missionmed-institute-logo-9f960ed9c3.png` (official logo supplied by the founder 2026-10-13 20:28 ET; pixels unchanged, PNG losslessly optimized, 280×113, 31,611 B).

## Ownership check (2026-10-13 20:10 ET, live registry)
- `missionmed_ops.engineering_resource_leases`: **no active leases**.
- MX-IVPREP-LIVE-ARENA-20261012's leases covered only `wp-content/mu-plugins/missionmed-ivprep-live-arena/*` and `tests/ivprep-live-arena/*` (last released 2026-10-12 16:54 UTC); its worktree's `LIVE/arena.html` is the May build. It does **not** own the CDN Arena surface.
- The current live bytes (sha256 `bd44e33f0c8b75dc28bf63190f0ab9c462af1700df287e7bcd377116dea7444c`, 975,617 B, CDN last-modified 2026-10-12 11:04 UTC) were written by Cowork mission DRJ-DAILY-DRILLS-RECOVERY-20261009 (lease write_paths include `rollback/arena.html.PATCHED_20261012.html`) without updating the critical pin (`19a519f5…`). That handoff folder is not in any mounted repo/worktree; the CDN object itself is the baseline.

## Reconciliation and release mechanics
1. `git_reconcile_and_commit.sh`: commit live bytes as `LIVE/arena.html` baseline on `fable/mx-arena-avatar-20261013` → commit the candidate (sha256 `4caa7d900e05b0a48a0514c8ec8518b23a5cc34d75247b8ac5ed61332a2749bb`, 994,271 B) → pin `CRITICAL_SYSTEMS_MANIFEST.json cdn_arena_live.approved_sha256` to the candidate + CHANGELOG entry → push.
2. `deploy_arena_single_surface.sh`: drift gate (live must still be `bd44e33f…`), pre-image saved as rollback, brand asset PUT (immutable, verified), candidate → STAGING (verified) → LIVE (verified by sha), purge, receipt. Single object; stat/drills/daily untouched (the canonical 4-file manifest would have pushed stale repo copies).
3. `rollback_arena_single_surface.sh`: restores the pre-image.

## Scope
Beta banner removal (CSS + creator function + stale copy in locked-mode modal) · official logo in Avatar Studio topbar, Create Your Avatar header, locker Avatar Studio tile (single `ARENA_BRAND_LOGO_URL`, `<img data-mm-brand-logo>` slots) · two-step deletion modal (server-confirmed, active-avatar note, in-flight guard, loading/error states) · Download same-origin blob fix · reference-photo SHA-256 integrity check · gender toggle on preview step. No backend, Supabase, auth, routing, Drills/Daily/STAT or Matrix changes.

## Independence
Builder = verifier (Fable). Offline evidence in `release/` (harness 11/11, banner absence at 1440/375, 26 inline scripts parse, validate_deploy markers all present). Live acceptance to be recorded in `ACCEPTANCE_FRONTEND.md` after deployment. Registry filing (missions.json / DR number) remains with the Foreman/Codex registrar; this note is the packet.

## Outcome (2026-10-14 01:20 UTC)
Released from the device VM (`r2_sigv4.py` signer): r1 `4caa7d90…` 00:48Z → r2 `a1d76893…` 01:04Z → **r3 `4d6580fa0b8c4752b0921db8247b35b01097c8438910eb73d518e8a3f099da28` 01:09Z (live, pinned in the worktree manifest)**. Receipts in `release/receipts/`. Live acceptance A–N PASS (`ACCEPTANCE_FRONTEND.md`). Git commits/push pending on the Mac (`git_reconcile_and_commit.sh`). Rollback images: `receipts/arena.html.ROLLBACK_bd44e33f` (pre-release), `arena.html.ROLLBACK_4caa7d90` (r1), `arena.html.ROLLBACK` (r2).
