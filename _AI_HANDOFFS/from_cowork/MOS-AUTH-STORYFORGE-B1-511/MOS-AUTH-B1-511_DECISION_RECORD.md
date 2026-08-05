---
decision: DR-021 B1-511 StoryForge Founder-authorized bounded product enhancement
date: 2026-08-05
decider: Brian
scope: Founder-approved bounded StoryForge product enhancement under B1-511 and B1-511A integrity addendum. Limited supersession of DR-014 for expanded administrator, submission, category, priority, search, mentor feedback, and voice-note scope only. All DR-014 privacy, identity, RLS, rollback, and canonical-product protections are preserved. Platform Summit constraint is binding.
evidence: Founder explicit B1-511 authorization; Founder explicit B1-511A integrity addendum; verified production baseline v-cf6c4b91bad6ac65 at release commit 4e9472bc21f0ceeaeb67f7f0276b0c7d8339e981; Railway deployment 0b64c2fc-9292-4d1a-9469-94f21b1a1ca4 SUCCESS; Critical Systems 112 PASS / 2 accepted WARN / 0 FAIL; existing B1-507B through B1-510K accepted production lineage; StoryForge worktree HEAD 0271dd7b232db58cda2a81a2132b6a508b7da48a clean.
rollback: Per DR-014 rollback protocol. Additionally for B1-511 features: disable each new feature independently; revert additive schema changes to dormant; restore prior review, category, priority, and mentor-feedback state; verify no data loss for existing stories, reviews, or audit records; verify Founder administrator console access is unaffected by feature rollback; verify Matrix, WordPress, authentication, unrelated routes, and legacy fallback are healthy.
expiry: null
---

# Finding

The existing StoryForge production infrastructure is verified healthy. The live release at v-cf6c4b91bad6ac65 with release commit 4e9472bc21f0ceeaeb67f7f0276b0c7d8339e981 passes all Critical Systems checks (112 PASS / 2 accepted WARN / 0 FAIL). The StoryForge worktree is clean with an accepted production lineage of 47 local commits (B1-507B through B1-510K).

The Founder has explicitly authorized B1-511 and its B1-511A integrity addendum as bounded StoryForge product enhancements. These do not redesign the StoryForge product; they extend it within tight boundaries. B1-511 scope is strictly a StoryForge-owned product enhancement and does not create shared MissionMed Platform infrastructure.

DR-014 established product-conformance recovery authority. B1-511 extends beyond DR-014's scope to authorize new product features while preserving every DR-014 protection that is not explicitly superseded.

# Product Authority

DECISION: B1-511 and B1-511A are Founder-approved executable StoryForge product authority.

DECISION: The authorized bounded StoryForge scope is exactly:

1. Restore reliable Founder administrator-console access for WordPress username `brinyu`.
2. Preserve one canonical StoryForge release for students and administrators.
3. Enable explicit student submission for mentor review while keeping unsubmitted stories private.
4. Add bounded StoryForge-owned categories and category filters.
5. Correct and expand "Where it could be used" labels: Personal Statement, Interview Set, Letter of Recommendation, MyERAS Experiences, MyERAS Most Impactful, Someday / Fellowship.
6. Default Story Library sorting by student priority 5 through 1.
7. Permit inline student-priority editing without opening the story.
8. Eliminate Library blinking/full-shell rerender during priority/star updates.
9. Repair the one-character-at-a-time search-input defect and add bounded autocomplete.
10. Extend the existing bounded review workflow.
11. Add mentor text and voice notes with transcription and private audio playback.
12. Keep internal notes hidden from students.
13. Preserve all existing identity, entitlement, JWT, RLS, recording, transcription, audio replay, Matrix routing, canonical UI, Learning Lesson, provider, storage, and production safeguards.
14. Follow the B1-511A preservation, change-budget, staged-release, differential-proof, rollback, and stop-line requirements.

DECISION: This is not authority to create shared MissionMed Platform infrastructure. MissionMed Platform v1 is still under design. Platform observations may be documented but not implemented.

# Limited Supersession of DR-014

DECISION: B1-511 and B1-511A supersede DR-014 only for:

- Expanded access already established by accepted B1-510 lineage.
- Founder administrator workflow (item 1).
- Submitted-story mentor review (item 3).
- Category and intended-use metadata (items 4, 5).
- Student priority workflow (items 6, 7, 8).
- Search and rerender repairs (items 8, 9).
- Mentor feedback and mentor-owned voice notes (items 10, 11, 12).
- Required additive schema, API, and UI changes for the above.
- Staged production deployment under B1-511A gates.

DECISION: B1-511 does not supersede DR-014's:

- Privacy protections (private-by-default, no access to unsubmitted stories).
- Least-privilege identity and authorization model.
- RLS enforcement and PostgreSQL identity binding.
- Rollback and restore requirements.
- Audit and evidence requirements.
- Canonical-product protections (no redesign, no reinterpretation).
- Founder-only pilot population control.
- Feature-off deployment requirement.
- Terminal gate ("Would the Founder immediately recognize this?").

# Privacy Boundary

DECISION: New stories remain private by default. Administrators and mentors may not access unsubmitted private stories merely because they exist. Student review requires explicit submission or equivalent accepted consent state. Internal notes remain hidden from students. Cross-student access remains prohibited.

# Role Boundary

DECISION: Founder WordPress username `brinyu` must resolve to the existing bounded StoryForge administrator identity. Administrators and students use the same canonical product release. Role differences are server-authorized capabilities, not alternate builds. Existing eligible-student access and entitlement remain unchanged. No synthetic WordPress role such as "360" may be introduced.

# Mentor Voice Boundary

DECISION: Mentor audio is StoryForge-owned, private, namespaced, and access-controlled. It must not reuse student-owned recording keys. Only published mentor feedback is student-visible. Existing private R2, signed-URL, transcription, cleanup, and audit patterns may be extended narrowly. Shared platform media architecture is out of scope.

# Database Boundary

DECISION: Existing accepted schema and review APIs must be reused where possible. Any new migration must be additive, minimal, RLS-protected, least-privilege, production-shaped restore-tested, and safely dormant or reversible. No broad administrator RLS bypass is authorized.

# Deployment Boundary

DECISION: Staged deployment sequence:

1. Staged local / restored-database proof.
2. Founder-only production canary.
3. Existing authorized population only after canary acceptance.
4. Independent feature rollback for each B1-511 feature.
5. No unrelated production mutation.

# Integrity Boundary

DECISION: B1-511A is binding. Preservation outranks feature completion. No unrelated refactor, dependency upgrade, platform redesign, broad CSS rewrite, duplicate renderer, alternate admin build, or historical data rewrite is authorized.

# Platform Summit Boundary

DECISION: Cross-application hydration, event buses, universal taxonomy, universal mentor review, and shared platform services may be documented only. They are not executable under B1-511.

# Preserved Infrastructure

DECISION: All DR-011, DR-012, DR-013, and DR-014 infrastructure boundaries remain active:

- WordPress session ownership, short-lived signed JWT exchange, exact-user allowlist, PostgreSQL identity binding and RLS, Kinsta MU route, execution-private versioned PHP bundle, atomic current pointer, extensionless SHA-derived aliases, isolated Railway resources, Matrix integration, legacy fallback, and layer-independent rollback remain unchanged.
- Protected `missionmed-hub` and legacy StoryForge assets remain read-only.
- No DNS, Cloudflare, Nginx, catch-all route, shared WordPress framework, unrelated database, unrelated provider service, or general user population change is authorized.

# Required Gates Before Production Mutation

Before any B1-511 production mutation, all existing DR-014 gates must pass, plus:

1. B1-511A differential proof demonstrating each feature change in isolation.
2. Mentor voice-note privacy and access-control verification.
3. Submission-state privacy verification (unsubmitted stories remain inaccessible).
4. Category and priority schema migration dormancy/reversibility proof.
5. Search repair regression testing.
6. Independent feature rollback proof for each B1-511 feature.
7. Founder administrator-console access verification.
8. Fresh restore points covering all B1-511 schema additions.

# Terminal Gate

Release is permitted only when the evidence-backed answer to both questions is YES:

1. "Would the Founder immediately recognize this as the same StoryForge V5 product he approved?" (DR-014 terminal gate, preserved).
2. "Does each B1-511 feature operate within its declared scope without affecting any existing StoryForge behavior?" (B1-511 terminal gate).
