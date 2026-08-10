# B1-513 Stage 2 Product Architecture

The umbrella architecture for StoryForge Stage 2. Detail lives in the satellite contracts; this document is the map, the per-capability architecture contract, and the record of why each design cannot reasonably be smaller.

## 1. Product thesis

Stage 2 is the next release of the live StoryForge, not a new product: **current StoryForge → next StoryForge**. Four coherent, independently releasable systems extend the accepted B1-512 core: (A) multi-version story composition, (B) Inspiration, (C) the Founder/Admin operating console, (D) mentorship visibility/consent/notifications. Preservation outranks novelty: every existing surface is UNCHANGED or EXTENDED (doc 21); the sole renderer, trust chain, schema, flags discipline, release mechanics, and visual identity are inherited, and the prototype proves it byte-level (doc 22).

## 2. Document map

| # | Document | Owns |
|---|---|---|
| 01 | CURRENT_CANONICAL_BASELINE | Production truth + continuity vocabulary |
| 03 | MULTI_VERSION_STORY_CONTRACT | System A |
| 04/05 | INSPIRATION_PRODUCT_AND_PEDAGOGY / RESEARCH_APPENDIX | System B |
| 06 | FOUNDER_ADMIN_OPERATING_CONSOLE | System C |
| 07 | MENTOR_VISIBILITY_CONSENT_AND_PRIVACY | System D |
| 08 | ACTIVITY_ANALYTICS_CONTRACT | Analytics |
| 09 | ADMIN_CONFIGURATION_CONTRACT | Founder configuration |
| 10 | DATA_MODEL_AND_MIGRATION_PLAN | Schema/migrations/rollback data rules |
| 11 | AUTHORIZATION_RLS_AND_MEDIA_BOUNDARIES | Security |
| 12 | UI_UX_INFORMATION_ARCHITECTURE | IA/components/a11y/responsive |
| 13 | FEATURE_FLAGS_RELEASE_TRAIN_AND_ROLLBACK | Flags, train, rollback |
| 14 | ACCEPTANCE_AND_ADVERSARIAL_TEST_MATRIX | Gates + adversarial probes |
| 15 | PLATFORM_SUMMIT_OBSERVATIONS | Platform v1 notes (not built) |
| 16 | FOUNDER_DECISIONS_REQUIRED | FD-1…FD-4 |
| 17 | CODEX_IMPLEMENTATION_BLUEPRINT | Execution plan post-approval |
| 21/22/23 | Continuity audit / prototype mapping / screenshot index | Evidence |

## 3. Architecture contract per capability

Legend: *Reused* = production component/service reused; *New* = smallest new bounded component; *Schema* = new schema (only if unavoidable); *Flag* = feature flag + kill switch; *AuthZ* = authorization boundary; *Why-not-smaller* = why the design cannot reasonably shrink.

### A. Multi-version composition (R2)
- **Reused:** stories table (Full Story = existing working text, zero-copy), immutable-original provenance, `.voiceTabs`/Story Room renderer, recorder pipeline + permanent audio, audit stream, Content & Display machinery for the registry, optimistic-concurrency pattern.
- **New:** `b1513VersionSurface` renderer region; version mutation API; version registry validation.
- **Schema:** `sf_story_versions`, `sf_story_version_revisions` (unavoidable: two new tellings with independent history cannot live in the single working-text column without rewriting the core story contract).
- **Flag:** `story_versions`. **AuthZ:** owner-only writes; reviewer reads via `observable()`; original/full_story unrepresentable in the new table (CHECK). **Migration/rollback/compat:** doc 10 §R2; off-flag returns the exact two-tab room. **Canaries:** Founder all-4-versions incl. real mic → one student → all. **Blast radius:** additive tables + one renderer region; existing text untouched by construction. **Platform-v1 dependency:** none.
- **Why not smaller:** a "just add two textareas on the story" design (no revisions table) loses Retell recovery and provenance, violating the never-silently-overwritten rule; a full generic version store for all four tellings rewrites production data for aesthetics (rejected in doc 03 §1.1). Two additive tables is the floor.

### B. Inspiration (R3)
- **Reused:** story creation path (promotion), capture/recorder experience, Library/Story Room as the destination, panel/chip/button components, notification-free quiet UX.
- **New:** wizard renderer + selection endpoint; prompt bank tables; save-for-later store.
- **Schema:** `sf_inspiration_prompts/saved/events` + nullable `stories.origin` (unavoidable: admin-governed stable-ID content and resumable drafts are server state; a parallel story repository was explicitly rejected — promotion writes canonical stories immediately, so no later migration can exist).
- **Flag:** `inspiration`, `inspiration_admin`. **AuthZ:** prompts world-readable-eligible, saved/events owner-only; promotion inherits story RLS. **Canary:** Founder wizard walk + prompt content review → widen. **Blast radius:** one new nav destination; zero change to existing student flows when off. **Platform-v1:** none.
- **Why not smaller:** a hardcoded prompt list in app.js would forbid Founder governance (System C requirement) and make retirement/ordering a source edit — the config-registry cost is the minimum that satisfies "no source editing."

### C. Founder/Admin operating console (R1)
- **Reused:** Administrator View shell/toggle/nav, admin story review surface, mentor-note architecture, bounded SECURITY DEFINER + audit pattern, existing notifications domain (Review Check delivery), scope-laddered flag endpoint.
- **New:** directory endpoint/UI + profile drawer; direct review controls; Review Check flow; activity aggregates.
- **Schema:** `sf_review_checks`, activity tables (doc 10) — unavoidable append-only operational records.
- **Flags:** `admin_directory`, `admin_review_controls`, `review_check`, `activity_tracking`. **AuthZ:** admin-capability-gated functions; private content structurally absent (counts only). **Canary:** Founder-only by nature initially. **Blast radius:** admin-side only; students see nothing except Review Check notifications (explicit sends). **Platform-v1:** directory/notification/heartbeat patterns recorded in doc 15.
- **Why not smaller:** reusing the submitted-only students endpoint cannot show never-active students (its population is wrong by definition); a new bounded read function over the existing entitlement bridge is the smallest correct primitive.

### D. Visibility / consent / notifications (R1)
- **Reused:** status model verbatim, withdraw-to-private rule, audit stream, story history, signed-URL audio path, Settings page.
- **New:** consent modal + Settings panel; visibility card/chips; `observable()` predicate.
- **Schema:** two nullable story columns + `sf_mentorship_consent` (unavoidable: a consent decision without a durable versioned receipt is not consent).
- **Flag:** `visibility_consent`. **AuthZ:** doc 07 §5 / doc 11. **Historical data:** NULL semantics, no backfill, no silent conversion. **Canary:** Founder → one consenting student → all. **Blast radius:** the one deliberate meaning change in Stage 2, executed as opt-in per student. **Platform-v1:** consent-registry pattern recorded.
- **Why not smaller:** cannot be — this is the minimum that implements the Founder's product direction with affirmative consent, per-story control, and truthful history.

## 4. Cross-cutting invariants

1. One renderer, one release, all identities; capability differences signed and server-enforced (unchanged).
2. Additive migrations only; append-only audit; immutable originals; no destructive emergency rollback.
3. Every lane double-gated (flag + kill switch), default off, Founder-first canaries, scope ladder.
4. No fabricated data anywhere: analytics boundaries, truthful Review Check text, honest empty states.
5. Story Media stays force-off and architecturally untouched; media attaches to the canonical story only.
6. Interview Prep stays hidden-but-intact; NNQ vocabulary is reused, not reinvented.
7. Platform-shaped patterns are built boundedly and documented for the Summit, never generalized here.

## 5. The macOS test (self-assessment against the prototype)

An existing student landing in Stage 2 sees: the same shell, greeting, hero capture, Library, story rows, status chips, Settings, and recording flow, in the same places with the same words (screenshots 01/02/18). Their habits keep working — capture, Finish It, submit, withdraw, priority, search. New power is discoverable, not imposed: one new rail entry (Inspiration), two quiet new tabs in a familiar tab strip, one new card in the story rail, and — once — a plain-language mentorship choice. The Founder lands in the same Administrator View and finds Students now shows everyone. Verified against screenshots in doc 23 and by the independent continuity verifier (doc 18 §verification).
