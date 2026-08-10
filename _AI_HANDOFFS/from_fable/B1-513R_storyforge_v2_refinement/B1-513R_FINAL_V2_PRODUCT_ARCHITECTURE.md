# B1-513R Final V2 Product Architecture

StoryForge V1 → V2: the accepted B1-513 Stage 2 architecture (committed at `_AI_HANDOFFS/from_cowork/B1-513_storyforge_stage2_architecture_and_prototype/`, which remains the satellite authority for versions, visibility/consent, analytics, admin configuration, RLS, and data model) refined by Founder review, plus one new major module. This document is the V2 map; deltas only.

## 1. Authority hierarchy (binding for Codex)

1. **Live B1-512 production** (`v-10688bb24bca7965`) controls every unchanged existing surface.
2. **The Founder-approved B1-513R prototype** (`B1-513R_FINAL_WORKING_PROTOTYPE.html`) controls approved V2 visual/interaction additions.
3. **B1-513R contracts** (this package) + inherited B1-513 satellites control data/security/authorization/migration/lifecycle.
4. Codex implements only the approved delta; Codex may not reinterpret the live product or the approved prototype.

## 2. V2 systems

| System | Status vs B1-513 | Owning contract |
|---|---|---|
| Multi-version composition (Original 🔒 / Full Story / 30-Second / NNQ) | Inherited + refined: universal 🎤 Add/Retell, Previous Tellings language, spoken-time guidance, save triad | B1-513/03 + changelog #4/5/15 |
| Visibility / consent / notifications | Inherited unchanged (orthogonality re-probed); contribution promotions start Private | B1-513/07 + doc 09 §5 |
| Inspiration | **Reworked**: Browse-first library + optional Guide Me (no who-gate for self) | doc 08 |
| **Request a Story** | **New major module**: guest magic-link contributions → candidates → promote | doc 09 |
| Founder console | **Mirror law**: Admin = StoryForge + superpowers; attention-bucket Home; card Students; "Maya's StoryForge" workspace; same-renderer review + Mentor Review rail; Content Studio / System Controls split | doc 07 (admin UX) |
| Avatar identity | **New consumption integration**: Avatar Studio headshots/full-body; StoryForge never generates | doc 11 |
| Settings | Grouped IA incl. Invitations | doc 12 |
| Activity analytics | Inherited unchanged | B1-513/08 |
| Story Media | Unchanged, force-off; referenced by video greeting only as deferred design | B1-513/11 + doc 09 §6 |

## 3. Architecture contract deltas (per capability: reused / new / schema / flag / why-not-smaller)

**Inspiration Browse** — Reused: prompt bank + selection + save-later + promotion path (B1-513/R3 schema, zero change); new: browse read function (filter/search over active prompts) + `sf_inspiration_favorites` (user_id, prompt_id — the only new table); flag: same `inspiration`; why-not-smaller: favorites are server state (cross-device continuity), one two-column table is the floor.

**Request a Story** — Reused: recorder pipeline, story creation path, audit stream, notification domain (delivery status), deferred Story Media design (greeting); new: `sf_story_invitations`, `sf_story_contributions`, guest route class, email templating; flags: `request_a_story` + `guest_contributions`; why-not-smaller: an inbox of candidates (not auto-stories) is the Founder requirement and the privacy floor — direct-to-story would grant guests write access to the canonical Library.

**Admin mirror** — Reused: the Story Room renderer itself (admin review = same room + rail), directory function, adminReview endpoint, Content & Display machinery; new: attention-bucket derivation (pure read composition over directory aggregates — no schema), Mentor Review rail component, Content Studio page (rehosting existing config surfaces); schema: none; flag: `admin_review_controls` (rail) + existing `admin_directory`; why-not-smaller: the rail replaces a whole parallel renderer — this is a net deletion of divergence.

**Avatar identity** — Reused: Avatar Studio (external canonical system) + a read-only asset-reference join; new: `avatar_ref` columns nowhere — StoryForge stores nothing; session/directory/review payloads carry avatar URLs resolved from Avatar Studio's registry at read time; flag: `avatar_identity`; why-not-smaller: literally no StoryForge persistence.

**Refined Library/Story Detail/save triad/time guidance** — presentation-layer only; zero schema; ship with their parent flags (`story_versions`, base release).

## 4. Cross-cutting invariants (inherited, re-affirmed)

One renderer, one release, all identities; additive migrations only; append-only audit; double-gated default-off flags; truthful data (no fabricated analytics/notifications); Story Media force-off; Interview Prep hidden-intact; NNQ vocabulary canonical; Platform-shaped patterns documented, not generalized (adds: guest-capability tokens and avatar-consumption as Platform v1 candidates — doc B1-513/15 extension noted in doc 20 §7). **Plus the V2 absolute: the Story Survival Contract (doc 03) gates every migrating release.**

## 5. The final quality test (self-assessment against the prototype)

A current student lands in V2: same shell, Home, Library (their stories in the same order with clearer rows), same New Story, same recorder, same Settings entry — habits intact (shots 01–05). They then discover: version tabs with Previous Tellings, clearer voice editing, a browsable Inspiration, Request a Story, their avatar, labeled priority, grouped Settings. The Founder enters Administrator View and sees StoryForge itself — orange, same cards, same Story Room — answering "who needs my attention today?" with mentor superpowers in a rail. The reaction this package is built for: **"YES. This is StoryForge — but now it feels complete."**
