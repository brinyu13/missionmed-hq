# B1-511 Allowed and Forbidden Scope

Authority: DR-021 B1-511 StoryForge Founder-authorized bounded product enhancement
Date: 2026-08-05

## ALLOWED

### Product Features (B1-511 items 1-14)

- A1. Restore Founder administrator-console access for WordPress username `brinyu` using the existing bounded StoryForge administrator identity.
- A2. Ship one canonical StoryForge release serving both students and administrators; role differences are server-authorized capabilities only.
- A3. Implement explicit student submission for mentor review; unsubmitted stories remain private and inaccessible to non-authors.
- A4. Add bounded StoryForge-owned categories and category filters within the existing product UI.
- A5. Correct and expand "Where it could be used" labels to exactly: Personal Statement, Interview Set, Letter of Recommendation, MyERAS Experiences, MyERAS Most Impactful, Someday / Fellowship.
- A6. Default Story Library sorting by student priority 5 through 1.
- A7. Permit inline student-priority editing without opening the story.
- A8. Eliminate Library blinking and full-shell rerender during priority/star updates.
- A9. Repair the one-character-at-a-time search-input defect and add bounded autocomplete within the existing product.
- A10. Extend the existing bounded review workflow for the new submission and mentor-feedback features.
- A11. Add mentor text and voice notes with transcription and private audio playback, using StoryForge-owned namespaced storage.
- A12. Keep internal notes hidden from students at the server level.

### Infrastructure (bounded extensions)

- A13. Additive database migrations that are minimal, RLS-protected, least-privilege, production-shaped restore-tested, and safely dormant or reversible.
- A14. Narrow extension of existing private R2, signed-URL, transcription, cleanup, and audit patterns for mentor voice notes only.
- A15. New API endpoints within the existing isolated Railway application for submission, category, priority, mentor-feedback, and voice-note operations.
- A16. Server-enforced role resolution using the existing WordPress session and JWT exchange; no new authentication flow.
- A17. Independent feature rollback capability for each B1-511 feature.
- A18. Fresh restore points covering all B1-511 schema additions.

### Deployment

- A19. Staged local/restored-database proof before any production mutation.
- A20. Founder-only production canary.
- A21. Existing authorized population activation only after canary acceptance.
- A22. Feature-off deployment before any feature enablement.

### Documentation

- A23. Platform Summit observations may be documented as documentation-only notes.
- A24. B1-511A differential proof for each feature change in isolation.

## FORBIDDEN

### Platform and Architecture

- F1. Creating shared MissionMed Platform infrastructure (event buses, universal taxonomy, universal mentor review, shared services).
- F2. Cross-application hydration or state sharing.
- F3. Redesigning or permanently replacing authentication, authorization, identity, WordPress integration, LearnDash integration, Railway topology, PostgreSQL platform architecture, Matrix shell, application registry, shared routing, shared notifications, shared AI infrastructure, shared media infrastructure, platform event bus, or cross-application persistence.
- F4. Implementing any Platform Summit scope item.

### Identity and Authorization

- F5. Introducing synthetic WordPress roles (e.g., "360").
- F6. Broad administrator RLS bypass.
- F7. New authentication flows or identity providers.
- F8. Altering existing JWT exchange, signature verification, or audience/issuer claims.
- F9. Changing the exact-user allowlist mechanism.

### Privacy

- F10. Accessing unsubmitted private stories by administrators or mentors merely because they exist.
- F11. Cross-student access to any story, review, or note.
- F12. Exposing internal notes to students.
- F13. Using student-owned recording keys for mentor audio.

### Infrastructure

- F14. DNS, Cloudflare, Nginx, or catch-all route changes.
- F15. Shared WordPress framework changes.
- F16. Unrelated database, provider service, or user population changes.
- F17. Protected `missionmed-hub` asset modification (read-only preserved).
- F18. Legacy StoryForge asset modification (preserved for fallback).
- F19. Destructive migrations or shared database restores.
- F20. Frontend service-role keys or server credentials in client code.
- F21. Broad cache purges.
- F22. Raw JavaScript, CSS, font, license, or HTML copies publicly addressable under WordPress paths.
- F23. Non-StoryForge Railway project or database mutations.

### Code Quality

- F24. Unrelated refactors or dependency upgrades.
- F25. Platform redesign.
- F26. Broad CSS rewrites.
- F27. Duplicate renderers or alternate admin builds.
- F28. Historical data rewrites.

### Release

- F29. Production mutation without all DR-014 gates passing.
- F30. Production mutation without B1-511A differential proof.
- F31. Non-Founder production deployment before canary acceptance.
- F32. Unrelated production mutations in the same deployment.
- F33. Force-push, history rewrite, or merge of the 47 existing local commits without explicit custody authorization.

## NEAR-ZERO-BLAST-RADIUS REQUIREMENTS (B1-511A)

- Each B1-511 feature must be independently rollbackable.
- Feature enablement must be independently controlled.
- Schema additions must be safely dormant when features are disabled.
- Mentor voice-note storage must be namespaced and isolated from student recordings.
- Search repair must not affect existing story data or metadata.
- Priority/star update optimization must not alter stored priority values.
- Category additions must not modify existing story associations.
- Submission state must be explicitly opt-in; no retroactive submission of existing stories.
