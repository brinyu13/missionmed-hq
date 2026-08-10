# B1-513R Feature Flags, Release Train, and Rollback

Extends the inherited R1–R4 train (B1-513 doc 13 — accepted rationale unchanged: consent first, analytics boundary early, versions before Inspiration). V2 additions slot in as follows; every lane keeps the double gate (DB flag + env kill switch), default off, Founder-first canary ladder, and non-destructive rollback. **Every migrating release adds the Survival Manifest STOP-SAFE gate (doc 03).**

## 1. Flags (V2 delta)

| Flag | Kill switch | Gates | Release |
|---|---|---|---|
| `library_refined_rows` | `STORYFORGE_LIBRARY_ROWS_FORCE_OFF` | Progressive-disclosure rows + labeled priority (off = exact B1-512 rows via retained legacy template) | V2-R1 |
| `admin_mirror` | `STORYFORGE_ADMIN_MIRROR_FORCE_OFF` | Attention Home, card Students, mirrored workspace, same-renderer review + rail, Studio/System split (off = B1-513 admin surfaces) | V2-R1 |
| `avatar_identity` | `STORYFORGE_AVATAR_IDENTITY_FORCE_OFF` | Identity frames + full-body heroes (off = initials everywhere; never blocks) | V2-R1 |
| `inspiration_browse` | `STORYFORGE_INSPIRATION_BROWSE_FORCE_OFF` | Browse mode + favorites (off = Guide-Me-only B1-513 layout) | V2-R3 |
| `request_a_story` | `STORYFORGE_REQUEST_A_STORY_FORCE_OFF` | Student module (invitations/candidates/Settings panel) | V2-RA |
| `guest_contributions` | `STORYFORGE_GUEST_FORCE_OFF` | Public guest surface + email sends (independently killable; token sweep as third brake) | V2-RA |
| Inherited | — | `visibility_consent`, `admin_directory`, `activity_tracking`, `review_check`, `admin_review_controls`, `story_versions`, `inspiration`, `inspiration_admin` | R1–R4 |

## 2. Recommended train (evaluated)

The V1→V2 production path merges the inherited train with the refinements so each release stays standalone, bounded, and independently rollbackable:

| Release | Ships | Depends on | Migration? | Canary gate |
|---|---|---|---|---|
| **V2-R1 — Foundation & Founder ops** | Inherited R1 (consent/visibility, directory, activity, Review Check, direct controls) + `admin_mirror` + `library_refined_rows` + `avatar_identity` + Studio/System split + save triad + Story Detail fixes | — | R1 migration (inherited) + **Survival Manifest** | Founder 7 days → consenting student → all |
| **V2-R2 — Multi-version composition** | Inherited R2 + universal 🎤 Add/Retell + Previous Tellings + time guidance | V2-R1 | R2 migration + Manifest | Founder all-4-versions with real mic → student → all |
| **V2-R3 — Inspiration** | Inherited R3 + `inspiration_browse` + favorites | V2-R1 (visibility default), V2-R2 (landing room) | R3 migration + favorites + Manifest | Founder browse+guide walk + content review → widen |
| **V2-RA — Request a Story** | `request_a_story` then `guest_contributions` (two-step within the release) | V2-R1 (visibility), V2-R2 (promotion lands well) | RA migration + Manifest | Founder invites a **consenting family member** end-to-end (real email, real phone) before any student gets the module; FD-R2 approved first |
| **V2-R4 — Content depth & analytics refinement** | Inherited R4 + Request-a-Story prompt editor + optional bulk-visibility tool (FD-4) | V2-R3, V2-RA | none expected | Founder-only surface |

Why RA sits after R3, not before: the guest surface is the largest new attack surface and the only externally-reachable one — it ships last among the student-value releases, after the visibility/versioning substrate is proven in production, and its email leg (FD-R2) is the longest Founder-approval pole. Why the refinements ride R1 rather than a separate release: they are presentation-layer, zero-schema, individually flagged, and the Founder sees the corrected admin experience from day one.

## 3. Rollback

Inherited uniform order (flags → pointer → Railway → dormant schema → verify) plus: `admin_mirror` off restores the B1-513 admin surfaces exactly; `library_refined_rows` off restores B1-512 rows byte-identically (legacy template retained in-build); `guest_contributions` off kills the public surface instantly while student data/UI persist; token sweep available for emergency link invalidation without any deploy. No rollback touches contributor or student rows. Any Survival Manifest mismatch at any point = STOP-SAFE (doc 03 §3).

## 4. Codex model routing (V2 delta)

GPT-5.6 Sol High: guest token/authz path + rate limiting, RA migration + RLS, promotion transaction + provenance, mirrored-room state integration (room reuse without renderer forks), Survival Manifest engine. Terra High: attention-bucket composition, card/row templates, Settings/Studio re-homing, avatar frame plumbing + fallbacks, email templating, favorites CRUD, screenshots/receipts/canary execution, manifest tooling runs. Evidence-based: escalate a Terra lane only on a demonstrated correctness wall.
