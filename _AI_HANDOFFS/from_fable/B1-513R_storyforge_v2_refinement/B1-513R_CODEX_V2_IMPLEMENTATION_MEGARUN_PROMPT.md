# B1-513R — Codex V2 Implementation Megarun Prompt

**STATUS: INERT UNTIL FOUNDER PROTOTYPE APPROVAL (FD-R1).** After approval, this document — with any Founder amendments folded in — is the binding execution prompt for the StoryForge V1→V2 production upgrade. It does not become authority because Fable produced it.

---

## ROLE
You are Codex, implementing StoryForge V2 in production through the staged release train V2-R1 → V2-R2 → V2-R3 → V2-RA → V2-R4. Model routing: GPT-5.6 Sol High for privacy/consent, guest invitation security, schema/migrations, the Survival engine, the version engine, Request-a-Story data/security, mirrored-room UI state, and RLS; Terra High for frozen builds, routine regression, backup verification, immutable packaging, and routine cutover/canaries/receipts after implementation freezes. Do not spend Sol tokens on mechanical work.

## AUTHORITY (strict hierarchy — you may not reinterpret any layer)
1. Live B1-512 production (`v-10688bb24bca7965`, source `8ca5d60f…`) controls all unchanged surfaces.
2. The Founder-approved `B1-513R_FINAL_WORKING_PROTOTYPE.html` + `prototype_source/` (56-patch ledger, extension layers, additive CSS) controls approved V2 visuals/interactions — reuse its markup and copy verbatim except FD amendments.
3. B1-513R contracts (this directory) + inherited B1-513 satellites (`_AI_HANDOFFS/from_cowork/B1-513_…`) control data/security/authorization/migration/lifecycle. Key: Survival Contract (03), Request-a-Story (09), data/RLS delta (13), flags/train (14), acceptance matrix (15), mapping (16).
4. Discard all prototype scaffolding listed in doc 16 §1 (shims, synthetic backend/data/avatars, blob: audio, simulated dictation, demo tokens).

## PRECONDITIONS (verify before any write; mismatch = STOP-SAFE)
Canonical worktree `/Users/brianb/MissionMed_worktrees/B1-StoryForge-502` at the latest accepted pushed lineage (≥ custody `1fb19f4d…`); MissionMed OS authority + active-run serialization confirmed (no other StoryForge writer); live release still `v-10688bb24bca7965` on Railway `d0756a3d…` (if production advanced, re-run the B1-513 doc 01 baseline procedure first and reconcile); Critical Systems 0 FAIL; FD-R1 approval receipt in hand; FD-R2 receipt before V2-RA external surfaces.

## STANDING LAWS (every release)
- **100% V1 Story Survival**: fresh locked Railway backup + MyKinsta snapshot + PG18 dump with isolated restore rehearsal, receipts, THEN pre-migration Survival Manifest → guarded single-transaction additive migration → post-manifest → zero-mismatch comparison per doc 03 §3. Any mismatch = STOP-SAFE.
- Additive migrations only; reuse existing services (recorder pipeline, story creation, notifications, audit, signed-URL storage, Content & Display machinery); no rediscovery, no unrelated refactoring, no second renderer, no parallel systems.
- Double-gated flags per doc 14, default off; scope ladder off→Founder→consenting student→eligible_all; independent rollback per release; prior releases preserved.
- Private Story Media stays force-off unless its separate gates clear (video greeting ships as dormant reference only).
- Avatar Studio consumed read-only per doc 11; no identity duplication; flag-off fallback if not ready (FD-R4).
- Truthful receipts always; no simulated success; append-only audit; no force-push/history rewrite; normal push + clean custody.

## PER-RELEASE EXECUTION (repeat for V2-R1, R2, R3, RA, R4 per doc 14 §2)
1. Baseline lock + change-budget ledger naming every file you expect to touch (pattern: B1-511/512 ledgers). Expected surfaces: `public/app.js` (sole renderer, seams per doc 16 §2), `public/styles.css` (namespaced additive), `server/app.mjs` + new bounded modules (`visibility.mjs`, `activity.mjs`, `story-versions.mjs`, `inspiration.mjs`, `requests.mjs`/guest route class, `survival-manifest` tooling), `server/admin-console.mjs`, `server/product-configuration.mjs`, `server/config.mjs`/`flags.mjs`, one migration per doc 10/13, focused tests, release generators untouched except registration. Never touch: `missionmed-hub` protected assets, WordPress roles/identity, LearnDash, provider config, R2 ACLs, media force-off, Matrix, root `supabase/migrations`, `auth.js` trust chain.
2. Implement the approved delta. For mirrored review: extend `renderStoryRoom` exactly as the prototype does (mentor semantics + rail); retire `renderAdminStory` from the flow behind `admin_mirror` without deleting it.
3. Tests: full inherited suites green (unit/PostgreSQL/acceptance/browser/conformance-accessibility) + the release's focused suites from doc 15 (incl. RLS/privacy/guest-token abuse/cross-user/admin-denial; the 27-probe prototype suite becomes production negative tests) + axe 0 serious/critical at 3 text sizes + 390px zero-overflow + secret scan + npm audit + `git diff --check`.
4. Deterministic release, backups/restore rehearsal, Survival Manifest cycle, guarded migration, Railway (`--path-as-root storyforge-v5/`) + Kinsta immutable pointer promotion, post-cutover verification (public hashes, health, anonymous 401, bad-origin 403, zero 5xx window), Critical Systems reconciliation to 0 FAIL.
5. Canaries per doc 14 §2: Founder `brinyu` first, always; then the named consenting student; ineligible + anonymous probes; guest canary (FD-R3 person) for V2-RA; screenshot visual comparison against the approved prototype for each shipped surface.
6. Widen scopes only after canary receipts; each widening audited.
7. Receipts per release (baseline, budget, tests, backups, manifest pair + comparison, deployment, canary, rollback status) + `MANIFEST.sha256`, under `_AI_HANDOFFS/from_codex/B1-51x_…/` (suggested tickets: B1-514=V2-R1, B1-515=V2-R2, B1-516=V2-R3, B1-517=V2-RA, B1-518=V2-R4).

## SELF-RESOLUTION VS STOP-SAFE
Self-resolve ordinary implementation/test failures in bounded loops (fix → re-run → document). **STOP-SAFE immediately** (halt, restore posture, report, no fix-forward) on: any P0/P1 finding, any Survival Manifest mismatch, any privacy leak or cross-user access, identity ambiguity, missing backup/restore proof, wrong deployment package/root, unexpected production drift from the pinned baseline, or any instruction that would require reinterpreting the live product or approved prototype.

## FINAL DELIVERABLE
One complete combined handoff sufficient for the orchestrating thread, per release train completion, with the full receipt chain and a final live acceptance walk mirroring the approved prototype screens.
