# Owner intelligence integrations

IVOC consumes bounded authorized versioned projections. Owner canonical storage/permission logic remains owner-side. Package grants no permission to alter siblings. Missing projection is not automatically a human blocker: consult CURRENT owner passport and sanctioned mission path first, implement only if permitted; otherwise isolate exact authority/data gap.

## RISE

missionmed-hq/ivoc/rise-projection.mjs + lib/auth/rise-current-eligibility.mjs.
Current WP broker /wp-json/missionmed-rise/v1/ivoc-eligibility verifies audience ivoc-rise-owner-projection, subject, nonce/freshness/allowed/Admin receipt. A RISE audience session cannot call HQ app APIs. Do not “fix” rise_audience_isolated by allowing it; normal HQ session receives a scoped verified owner projection identity.

Real search query supports q/specialty/jurisdiction/programType/page. Exact selected program ID retained, then minimized rise.program_cheat_sheet/v1 fresh receipt/context. Current dated registry6245programs from rise_registry_acgme_2026-09-20_50d08ea6f2da is owner evidence, not static UI fixture. Bounded projection up to8facts/4leadership roles with sources; names intentionally minimized. Unavailable fields truthful.

Search/readable selection/context accepted; spoken program-informed questioning still needs complete current interview proof. Never invent PD/APD/faculty facts or duplicate RISE registry.

## File Vault / CV

missionmed-hq/ivoc/file-vault-projection.mjs and ivoc/intelligence/normalize/normalizers/filevault-document.mjs.

Owner read:
GET /wp-json/mmed/v2/file-vault/projections/ivoc/cv/{wpUserId}
Owner reviewed publish:
POST /wp-json/mmed/v2/file-vault/files/{fileId}/projections/ivoc-cv

Contract: authorized exact wp subject, current canonical file/version, document CV, schema/projection version, bounded extracted facts, freshness/hash/version receipt, student_consent with consent_ref ivoc-session:<canonicalUUID>, invalidation and provenance. Current review/publish requires actual authorized file/version, authorization reference and1–120reviewed facts; raw upload alone is not proof.

Intuitive Upload/Update CV should go to canonical File Vault owner upload/review flow. IVOC does not copy storage, parse raw PDFs during realtime or invent a second CV table. Future sessions hydrate CURRENT authorized version; replacing file requires fresh reviewed projection.

Engineering consumer/owner contract present; positive genuine current CV data acceptance pending. Do not recreate donor0867deb; it is already integrated.

## StoryForge

missionmed-hq/ivoc/storyforge-projection.mjs and ivoc/intelligence/normalize/normalizers/storyforge-stories.mjs.

WP broker POST /wp-json/missionmed/v1/storyforge/ivoc-token → short-lived scoped owner identity.
GET /storyforge/api/ivoc/projection
Owner consent /storyforge/api/ivoc/consent.

Projection storyforge.approved_stories: exact authorized student, promoted/Admin-approved versions plus student consent, story IDs/tags/applicability, bounded approved content, freshness/version/hash/provenance. Up to12stories, summaries≤60words; owner UUID/version identity. Edits invalidate prior consent/version. Mentor notes only where separately authorized; never expose private notes to native Actor merely because Admin can review them.

Engineering exists; need genuine promoted/consented story and reactive/proactive spoken context proof.

## Other owner seams

IVOC-owned versioned Mentor Top3 exists with private-note exclusion. Do not invent MCC generic API if owner contract absent. Calendar/Scheduler authorized appointment projection is implemented. Live Mock/Webex media remains exact event/provider evidence, not simulated recording. Match Bridge clip version/consent/revocation working; low-priority boundary, not permission to share a session.

Tests: HQ file-vault-projection, storyforge-projection, rise-projection, application-intelligence, context-provider; ivoc/intelligence contracts/intake/assemble/triggers/acceptance. Positive fixtures prove deterministic logic only.
