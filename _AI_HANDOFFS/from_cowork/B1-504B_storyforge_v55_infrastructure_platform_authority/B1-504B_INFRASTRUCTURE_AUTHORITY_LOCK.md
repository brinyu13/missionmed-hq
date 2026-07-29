# B1-504B · Infrastructure Authority Lock

Labels: VERIFIED PRODUCTION TRUTH (VPT, from B1-503 receipts dated 2026-07-28 or live evidence) · VERIFIED SOURCE TRUTH (VST, inspected in the worktree this run) · PRODUCT AUTHORITY (PA) · ARCHITECTURE AUTHORITY (AA, binding) · RECOMMENDATION (REC) · REQUIRED PROBE (RP-n, defined in the Discovery Packet) · FOUNDER GATE (FG) · BLOCKER · SUPERSEDED · UNKNOWN.
Readiness ladder for this package: L0 unknown · L1 located · L2 source/config verified · L3 deployed dormant · L4 tested in controlled production-like environment · L5 proven end-to-end in production. (B1-504A used a similar ladder with different numbering; this document's ladder governs B1-504B.)

## 1. Topology, locked to the extent evidence permits

Request path for Phase 1 (AA, binding once probes close):

Student browser
-> `https://missionmedinstitute.com/storyforge/` (public URL, VPT: B1-503 route + authenticated validation)
-> Cloudflare DNS + proxy for the zone `missionmedinstitute.com` (VPT: B1-503 cache evidence, Cloudflare DYNAMIC)
-> Kinsta-hosted WordPress origin serving the StoryForge static runtime through the isolated MU route (`infra/wordpress/missionmed-storyforge-route.php` + `missionmed-storyforge-runtime`, VST; live release pointer discipline VPT: B1-503 `releases/6f45dbbd...`, release ID `v-0912286e7dfc2327`)
-> WordPress SSO plugin token exchange `/wp-json/missionmed/v1/storyforge/token` (VST plugin; VPT: exercised in B1-503 validation)
-> StoryForge API on Railway, API-only origin (VST `railway.json`, build `npm run build:api`, start `node server/app.mjs`, healthcheck `/healthz`; VPT: Railway deployment `fa7ad084-4dae-4039-a154-2250a407d95e` SUCCESS, image sha256 recorded)
-> isolated PostgreSQL 18 on Railway (VPT: B1-503 prestate names Railway PostgreSQL deployment `f5c7179e-b805-4e82-b080-d2349a0a47cf`; five migration rows, 25 RLS tables in the final database)
-> Cloudflare R2 for audio (VST seam in `server/storage.mjs`; production configuration UNKNOWN, RP-6)
-> StoryForge transcription adapter (does not exist yet; to be built per the Transcription Lock)
-> OpenAI transcription API (account VST via `missionmed-hq/server.mjs`; StoryForge-scoped key UNKNOWN, RP-7).

## 2. The Supabase question, resolved (AA)

"Supabase" in the StoryForge context means NOTHING in production. Evidence: the worktree `AGENTS.md` (VST) orders StoryForge migrations kept out of the root `supabase/migrations`; the root `supabase/` directory (VST: `migrations`, `snippets`) belongs to other MissionMed systems; B1-502M pinned an isolated Railway PostgreSQL target with a private migration ledger (VST AGENTS.md); B1-503 receipts record the Railway PostgreSQL deployment and its five StoryForge migrations (VPT). Binding: StoryForge Phase 1 uses Railway-hosted PostgreSQL 18 exclusively. No Supabase Auth, Storage, Edge Functions, or Supabase-managed PostgreSQL participates. Any instruction elsewhere that says "Supabase/PostgreSQL" resolves to this Railway PostgreSQL. Codex may not touch the root `supabase/` directory.

## 3. Component register

| Component | Canonical name | Owner | Trust boundary and identity | Secrets | Deploy / rollback mechanism | Level |
|---|---|---|---|---|---|---|
| Public zone | `missionmedinstitute.com` (Cloudflare) | Founder org | Internet edge; anonymous in | none in zone | Cloudflare dashboard; DNS unchanged in Phase 1 | L5 (VPT) |
| WordPress + Kinsta | MissionMed WordPress, Kinsta install | Founder org | Session-authenticated members; issues StoryForge JWTs | `mmsf_secret()` HS256 signing secret (>= 32 chars enforced, VST) | Kinsta immutable releases + pointer scripts `scripts/install-b1-503-kinsta-release.sh` / `rollback-...` (VST; VPT used in B1-503) | L5 |
| SSO plugin | `missionmed-storyforge-sso` | StoryForge | Mints HS256 JWT: claims locked in the Routing Spec | signing secret | WP plugin files; backup-first rule (Acceptance 2b of B1-504A, carried) | L5 for pilot |
| Frontend runtime | StoryForge static runtime via WP MU route | StoryForge | Serves HTML/JS/CSS only; no data authority | none | Kinsta release + pointer | L5 |
| Edge worker (dormant candidate) | `missionmed-storyforge-v5` Cloudflare Worker (`infra/edge/`, VST) | StoryForge | Would serve `/storyforge/*` if routed | `STORYFORGE_ORIGIN` var | wrangler; NOT part of Phase 1 | L1; routing status UNKNOWN, RP-4. AA: Phase 1 does not use the worker; if RP-4 finds it routed in production, that is a BLOCKER returned to Fable, not something Codex reroutes. |
| API service | StoryForge API on Railway | StoryForge | Verifies JWT (jose); all authorization server-side | `STORYFORGE_*` env: DATABASE_URL, JWT secret or JWKS, R2 set, allowed origins; future `STORYFORGE_OPENAI_API_KEY` | Railway deploys; rollback = redeploy prior build | L5 for current app; voice additions L0 |
| Database | StoryForge PostgreSQL 18 on Railway | StoryForge | Roles `anon`, `authenticated`, `storyforge_app` (VST bootstrap_production.sql); RLS on 25 tables (VPT) | `STORYFORGE_DATABASE_URL` | Guarded runner `scripts/apply-production-migrations.sh` (VST); PG dump + rehearsed restore (VPT discipline) | L5 |
| R2 audio | `missionmed-storyforge-audio-prod` / `-staging` (AA names from B1-504A, carried) | StoryForge | Presigned URLs only; no public access | scoped R2 token (to be minted) | Cloudflare R2; lifecycle rules | L1 seam; buckets UNKNOWN, RP-6 |
| Transcription provider | OpenAI API (StoryForge-scoped key) | StoryForge | Server-to-server only | `STORYFORGE_OPENAI_API_KEY` (new, separate from hq keys) | config swap behind adapter | L0 for StoryForge; account L2 via hq usage |
| Audit store | `public.sf_audit_events` (append-only, VST) | StoryForge | written in-transaction | n/a | migrations | L5 |
| Monitoring | Railway logs (structured JSON) + Cloudflare/R2 metrics + `/api/admin/voice/health` (to build) | StoryForge | admin-only surface | n/a | with API deploys | L0 for voice events |
| Backups | Kinsta recovery points; PG dumps with restore rehearsal; Railway variable export; WP plugin/settings backup | StoryForge ops | n/a | n/a | per B1-503 discipline (VPT) | L5 discipline |
| Staging | UNKNOWN. RP-9. AA fallback if absent: local harness `scripts/run-local.sh` (dev-auth loopback, VST) + staging R2 bucket; no invented staging deployment | | | | | L0 |

## 4. Secret ownership (AA)

- WP HS256 signing secret: owned by WordPress; never present in Railway; the API verifies with `STORYFORGE_JWT_SECRET` (same shared secret) or `STORYFORGE_JWKS_URL` (VST config.mjs). Production uses the shared-secret HS256 path today (VPT: B1-503 exact-account pilot; JWKS not configured). Binding: keep HS256 shared secret for Phase 1; no auth-mechanism migration inside this release.
- `STORYFORGE_R2_*`: owned by the Railway API service only. Scoped token restricted to the two StoryForge buckets. Never in WP, never client-side, never in the worker.
- `STORYFORGE_OPENAI_API_KEY`: owned by the Railway API service only; separate from `OPENAI_API_KEY`/`MMHQ_OPENAI_API_KEY` used by missionmed-hq (VST), so rotation and limits are independent.
- Rotation: R2 token and OpenAI key rotate independently; playback signatures expire within minutes; no student-facing invalidation needed.

## 5. Reconciliation duties before implementation (RP summary)

The full probe definitions with outcome tables are in `B1-504B_CODEX_DISCOVERY_ONLY_PACKET.md`: RP-1 B1-505 completed authority; RP-2 worktree git health on the Mac (the sandbox mount could not traverse the worktree link; expected mount artifact, must be proven); RP-3 live baseline identity vs B1-503 receipts (authenticated via the founder's pilot session only); RP-4 Cloudflare route audit for `/storyforge/*` (worker must be un-routed); RP-5 Railway service + ALL variable names; RP-6 R2 bucket + `STORYFORGE_R2_*` state; RP-7 StoryForge OpenAI key + models listing (bounded secret-use rule inside the packet); RP-8 ffmpeg feasibility (local Nixpacks build only); RP-9 staging existence + harness boot proof; RP-10 WP settings summary + deployed-plugin hash vs worktree + iframe check; RP-11 provider bake-off (implementation run); RP-12 provider data-handling posture; RP-13 database introspection (service-role attributes, sf_users columns, audit PK shape, story-deletion model, runner transaction behavior, ownership/grant patterns).

## 6. Deactivated-student deletion rights (FG-1 PROPOSED, not binding until ruled)

The retention copy promises "delete anytime," but a student whose 360 eligibility ends can no longer mint a token, so self-service deletion would silently vanish exactly when they may want it most. PROPOSED ruling for the FG-1 sitting (until ruled, the Flag Authority's immediate-token-stop description remains the operative truth): revocation starts a 30-day wind-down during which the student's StoryForge access (and therefore playback and deletion) remains, with new recording already gone via the flag; after wind-down, deletion happens through a support request handled under the account-level process. The consent notice needs no change (deletion remains available throughout access, and account-closure deletion is already specified); the founder may amend the wind-down length at FG-1.
