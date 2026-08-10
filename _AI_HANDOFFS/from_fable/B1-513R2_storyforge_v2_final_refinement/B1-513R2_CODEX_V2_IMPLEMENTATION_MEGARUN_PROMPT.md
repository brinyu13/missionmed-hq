# B1-513R2 — Codex V2 Implementation Megarun Prompt

**STATUS: INERT UNTIL FOUNDER PROTOTYPE APPROVAL (FD-R1 on the B1-513R2 prototype).** After approval — with any Founder amendments folded in — this document is the binding execution prompt for the StoryForge V1→V2 production upgrade. It supersedes the B1-513R megarun prompt (which never became executable) and does not become authority because Fable produced it.

---

## ROLE & ORCHESTRATION
You are Codex, implementing StoryForge V2 in production through the staged release train V2-R1 → V2-R2 → V2-R3 → V2-RA → V2-R4. Run specialized **read-only** analysis/review agents (privacy, migration, UI-fidelity, test) as needed, but exactly **one supervisor owns writes and deployment**. Report percentage checkpoints per release (baseline locked 10% · implemented 50% · tests green 70% · deployed+canaried 90% · receipts 100%). Model routing: **GPT-5.6 Sol High** for privacy/consent, guest invitation security + lifecycle webhooks, schema/migrations, the Survival engine, the version/provenance engine (incl. V2.1 seams), RLS, and complex UI integration; **Terra High** for frozen builds, routine regression, backup verification, immutable packaging, and routine cutover/canaries/receipts after implementation freezes. Do not spend Sol tokens on mechanical work.

## AUTHORITY (strict hierarchy — you may not reinterpret any layer)
1. Live B1-512 production (`v-10688bb24bca7965`, source `8ca5d60f…`) controls all unchanged surfaces.
2. The Founder-approved `B1-513R2_FINAL_WORKING_PROTOTYPE.html` + `prototype_source/` (88-step build ledger, extension layers, additive CSS incl. the light-theme design) controls approved V2 visuals/interactions — reuse its markup and copy verbatim except FD amendments. The B1-513R prototype remains reference for surfaces pass 2 did not touch.
3. B1-513R2 contracts (this directory) + B1-513R package + inherited B1-513 satellites control data/security/authorization/migration/lifecycle. Key: Survival Contract, Data/RLS delta, Request-a-Story Postmark & Guest Contract, **V2.1 Prewiring Contract**, Acceptance & Red-Team Matrix, Mapping ledger.
4. Discard all prototype scaffolding listed in the Mapping doc §1 (shim, synthetic data/students, simulated Postmark/dictation, blob: audio, demo tokens, light-theme `!important` repaint).

## PRECONDITIONS (verify before any write; mismatch = STOP-SAFE)
Canonical worktree `/Users/brianb/MissionMed_worktrees/B1-StoryForge-502` at the latest accepted pushed lineage; MissionMed OS authority + active-run serialization confirmed (no other StoryForge writer); live release still `v-10688bb24bca7965` on Railway `d0756a3d…` (if production advanced, re-run the B1-513 baseline procedure and reconcile); Critical Systems 0 FAIL; **FD-R1 approval receipt in hand**; FD-R2 receipt before any V2-RA external surface; FD-R5 answers folded into recommend seeds.

## STANDING LAWS (every release)
- **100% V1 Story Survival**: fresh locked Railway backup + MyKinsta snapshot + PG18 dump with isolated restore rehearsal, receipts, THEN pre-migration Survival Manifest → guarded single-transaction additive migration → post-manifest → zero-mismatch comparison. Any mismatch = STOP-SAFE. Never rush a migration to beat a backup window — take a fresh backup instead.
- Additive migrations only; reuse existing services (recorder pipeline, story creation, notifications, audit, signed-URL storage, Content & Display machinery, **USCE Postmark pattern**); no rediscovery, no unrelated refactoring, no second renderer, no parallel systems, no Gmail OAuth or new mail architecture.
- **Postmark**: triple-gated flags default off; delivery/bounce state only from signed webhooks; **verify From/Reply-To against the live Postmark server** (USCE precedent `clinicals@missionmedinstitute.com`) — never assume; external wording exactly as FD-R2 approves.
- **V2.1**: implement ONLY the five prewiring seams (V21 contract) during V2-R2. Do not opportunistically build follow-up AI, providers, or UI. "AI MAY ASK. AI MAY NOT INVENT" is carried dormant.
- Double-gated flags, default off; scope ladder off→Founder→consenting student→eligible_all; independent rollback per release; prior releases preserved. Private Story Media stays force-off unless its separate gates clear. Avatar Studio consumed read-only (flag-off initials fallback per FD-R4); no identity duplication.
- Identity exclusively from the signed session (B1-512 trust chain); RLS enforces every pass-2 requirement in the Data/RLS contract §2 — especially active-only question exposure through pins, server-generated question IDs on import, terminal bounce/revoke, and token-scoped bounded guest writes.
- Truthful receipts always; no simulated success; append-only audit; no force-push/history rewrite; normal push + clean custody.

## RELEASE SCOPE (delta on the B1-513R train)
- **V2-R1** (foundation & Founder ops): + DARK/LIGHT/AUTO as first-class tokens (light design from approved screenshots; kill the prototype's `!important` pass), environments incl. Ember Storm/Lumen Drift + energy labels + persistence, brand header, page introductions, admin scale surfaces (above-the-fold Home aggregate endpoint, directory + queue toolbars with clamped pagination, saved views per-admin, session labels consumed from the canonical 360 source — verify it first, §19 fallback only if absent).
- **V2-R2** (versions): + the five V2.1 prewiring seams (segment IDs, source_role, dormant `story_followup` flag).
- **V2-R3** (Inspiration): + list-first with LIST|GRID + layout preference, pins table + reorder, Dr Brian Recommends (FD-R5 seeds), Home recommend strip, single-add + bulk CSV import (quote-aware parse, server-side re-validation, server IDs, drafts only, audited publish).
- **V2-RA** (Request a Story): + truthful lifecycle columns + webhook handlers, preview-before-send flow (create=draft, draft-only update, send only from preview), terminal bounce with re-invite path, relationship allowlist + journeys from the governed contributor library, guest `started` signal, transcript/duration bounds, IP rate limiting.
- **V2-R4** (content depth): + Content Studio tabs with reorder, Request-a-Story prompt governance surface.

## PER-RELEASE EXECUTION
1. Baseline lock + change-budget ledger naming every file you expect to touch. Expected surfaces: `public/app.js` (sole renderer, seams per Mapping §2), `public/styles.css` (token pass + namespaced additive), `server/app.mjs` + bounded modules (`visibility.mjs`, `activity.mjs`, `story-versions.mjs`, `inspiration.mjs`, `requests.mjs` + guest route class + postmark webhook handler, `survival-manifest` tooling), `server/admin-console.mjs`, `server/product-configuration.mjs`, `server/config.mjs`/`flags.mjs`, one migration per release per the Data/RLS delta, focused tests. Never touch: `missionmed-hub` protected assets, WordPress roles/identity, LearnDash, provider config, R2 ACLs, media force-off, Matrix, root `supabase/migrations`, `auth.js` trust chain.
2. Implement the approved delta; reuse prototype markup/copy verbatim except FD amendments.
3. Tests: full inherited suites green + the release's focused suites (RLS/privacy/guest-token abuse/cross-user/admin-denial; **the 61-probe prototype suite becomes production negative tests**, incl. RT-A/RT-B/RT-C regressions) + axe 0 serious/critical at 3 text sizes **in dark and light** + 390px zero-overflow + secret scan + npm audit + `git diff --check`.
4. Deterministic release, backups/restore rehearsal, Survival Manifest cycle, guarded migration, Railway (`--path-as-root storyforge-v5/`) + Kinsta immutable pointer promotion, post-cutover verification (public hashes, health, anonymous 401, bad-origin 403, zero 5xx window), Critical Systems reconciliation to 0 FAIL.
5. Canaries: Founder `brinyu` first, always; then the named consenting student; ordinary-student, ineligible, anonymous probes; guest canary (FD-R3 person, real email on a real phone) for V2-RA; **screenshot comparison against the approved prototype for each shipped surface, dark AND light**.
6. Widen scopes only after canary receipts; each widening audited.
7. Receipts per release (baseline, budget, tests, backups, manifest pair + comparison, deployment, canary, rollback status) + `MANIFEST.sha256`, under `_AI_HANDOFFS/from_codex/B1-51x_…/` (B1-514=R1, B1-515=R2, B1-516=R3, B1-517=RA, B1-518=R4).

## SELF-RESOLUTION VS STOP-SAFE
Self-resolve ordinary implementation/test failures in bounded loops (fix → re-run → document). **STOP-SAFE immediately** (halt, restore posture, report, no fix-forward) on: any P0/P1 finding, Survival Manifest mismatch, privacy leak or cross-user access, identity ambiguity, missing backup/restore proof, wrong deployment package/root, unexpected production drift from the pinned baseline, unverifiable Postmark sender identity at RA time, or any instruction that would require reinterpreting the live product or approved prototype.

## FINAL DELIVERABLE
One complete combined handoff per release-train completion with the full receipt chain and a final live acceptance walk mirroring the approved prototype screens (both themes), sufficient for the orchestrating thread without reading anything else.
