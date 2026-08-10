# B1-513 Feature Flags, Release Train, and Rollback

## 1. Flags

Every Stage 2 lane fails closed behind **two independent gates** (DB feature flag + env kill switch), the exact pattern proven by mentor notes and Content & Display:

| Flag (DB) | Kill switch (env) | Gates | Release |
|---|---|---|---|
| `visibility_consent` | `STORYFORGE_VISIBILITY_CONSENT_FORCE_OFF` | Consent modal, visibility column semantics, per-story control, Settings panel | R1 |
| `admin_directory` | `STORYFORGE_ADMIN_DIRECTORY_FORCE_OFF` | Directory endpoint + UI, profile drawer | R1 |
| `activity_tracking` | `STORYFORGE_ACTIVITY_FORCE_OFF` | Heartbeat ingestion + Activity tab (off = "Not available before activity tracking was enabled.") | R1 |
| `review_check` | `STORYFORGE_REVIEW_CHECK_FORCE_OFF` | Preview/send/receipt/notification | R1 |
| `admin_review_controls` | `STORYFORGE_ADMIN_REVIEW_CONTROLS_FORCE_OFF` | Direct stars/pills/chips UI (off = B1-511 selects render) | R1 |
| `story_versions` | `STORYFORGE_STORY_VERSIONS_FORCE_OFF` | Version tabs/API/config registry (off = exact two-tab Story Room) | R2 |
| `inspiration` | `STORYFORGE_INSPIRATION_FORCE_OFF` | Student destination + nav entry + promotion | R3 |
| `inspiration_admin` | `STORYFORGE_INSPIRATION_ADMIN_FORCE_OFF` | Content-manager surface | R3/R4 |

All default `off`. Scope ladder per flag: `off → allowlist (Founder brinyu) → allowlist (+one consenting student) → eligible_all`, using the existing audited flag endpoint and scope-audit trail. `STORYFORGE_STORY_MEDIA_FORCE_OFF=1` is untouched by every Stage 2 release.

## 2. Release train (evaluated, not assumed)

The candidate grouping R1 consent/ops → R2 versions → R3 Inspiration MVP → R4 depth was evaluated against two alternatives and **accepted with one adjustment** (Review Check and direct review controls pulled into R1):

- *Alternative "versions first":* rejected — versions expand the mentor-observable surface (new tellings), so shipping them before the consent architecture either leaks scope or forces a second privacy transition later. Consent-first sequences the privacy meaning change exactly once.
- *Alternative "Inspiration first":* rejected — Inspiration's promotion path writes canonical stories whose default visibility depends on consent state (R1) and whose best landing experience is the version-aware Story Room (R2). Dependency-driven order is R1→R2→R3.
- *R1 composition:* consent/visibility + directory + activity foundation + Review Check + direct review controls all share the property of being **zero-risk to student data** (additive columns, admin-side UI, append-only logs) while giving the Founder immediate operational value. Analytics must start recording as early as possible because its truthful boundary means data before activation is gone forever — every week R1 waits is a week of "Available from" boundary lost.

| Release | Ships | Standalone value | Depends on | Canary gate |
|---|---|---|---|---|
| **R1 — Mentorship foundation & Founder operations** | visibility/consent, directory, activity foundation, Review Check, direct review controls | Founder sees every eligible student, truthful engagement data begins, review ergonomics improve, consent groundwork laid | — | Founder-only 7 days → one consenting student → eligible_all consent rollout |
| **R2 — Multi-version composition** | version tables/API/tabs, version config registry, "Full Story" label publish | Students shape interview-ready tellings; Original protected | R1 (observability of new tellings) | Founder authors all 4 versions on an own story incl. real-mic voice; then one student; then all |
| **R3 — Inspiration MVP** | wizard, prompt bank seed, save-for-later, promotion | Broadened recall → more canonical stories | R1 (visibility default), R2 (landing room) | Founder full wizard walk + promotion; content review of served prompts; then widen |
| **R4 — Inspiration administration & analytics depth** | content-manager depth, analytics refinement, optional bulk-visibility tool (FD-4) | Founder self-serve content ops | R3 | Founder-only surface; no student exposure |

Each release: bounded scope, previous releases preserved, independently disableable (flags above), production-shaped tests before cutover (unit/PG/browser/conformance + the release's focused suites), fresh locked backups + restore rehearsal before any migration, Critical Systems zero-fail before and after, exact acceptance gates in doc 14.

## 3. Rollback

Uniform, rehearsed, and identical in shape to B1-511A/B1-512C practice:

1. **Flag rollback (minutes):** set the release's env kill switch, flip DB flags off. Surfaces vanish; data stays dormant. This is the default response to any product-level defect.
2. **Frontend rollback:** restore prior immutable Kinsta pointer + route (receipts retained per release) if the shipped renderer itself must revert.
3. **Backend rollback:** redeploy the prior retained Railway deployment.
4. **Schema:** stays in place, dormant, additive. Destructive rollback of student data is prohibited; pre-activation empty-object rollback scripts exist for the never-activated case only.
5. **Verify:** Founder/eligible/ineligible/anonymous smoke, zero 5xx window, Critical Systems 0 FAIL, and — for R1 — proof that legacy behavior returned exactly (new story defaults, two-tab room, B1-511 admin selects).

Special cases: rolling back `visibility_consent` after students have made per-story choices preserves those rows dormant (they re-apply if re-enabled; documented in the consent policy). Rolling back `story_versions` after tellings exist hides the tabs but loses nothing; the acceptance suite proves re-enable restores them byte-identical.

## 4. Codex model routing (per-lane)

GPT-5.6 Sol High: R1 visibility predicate + RLS + consent transaction; R2 version engine/migration/conflict semantics; R3 selection logic + promotion transaction; any defect on privacy paths. Terra High: directory/profile CRUD UI, Review Check plumbing, activity beacon + counters, admin config panels, release packaging, backups/receipts/canary scripts, screenshot evidence. Rationale: spend deep reasoning only where a wrong answer is a privacy or data-loss event.
