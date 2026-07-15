# V1-8010A Decision 04 — One Canonical Writer

**Status:** ACCEPTED

## Decision

The V1 command service and its repository are the only writers of canonical
Plan state. Calendar, legacy Study rows, Admin OS, Session Manager, Courses,
Arena, StoryForge, Vault, Profile, mentors, appointment systems, adapters, and
browser storage cannot write Plan tables directly.

Imports, evidence, mentor proposals, focus sessions, UI actions, and external
outcomes enter through versioned V1 commands with actor, learner owner,
idempotency key, expected revision, provenance, and an atomic operation record.
Read models are rebuildable projections, never a second truth.

## Forbidden shortcuts

- dual-write to Calendar and Plan;
- silent completion from an external outcome;
- mutable localStorage authority;
- admin impersonation;
- restoring mutable legacy behavior after a learner’s V1 cutover watermark.

## Verification

Architecture tests must prove that no adapter has table-write credentials or a
repository bypass. Rollback preserves Plan data and disables both writers after
cutover.
