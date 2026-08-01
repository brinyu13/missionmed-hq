# B1-510I Admin Console Product and Security Contract

Status: design/security investigation complete; implementation not authorized to begin because Phase A did not pass.

## Safe future boundary

An additive admin console can be implemented without weakening student RLS if it uses bounded administrator-only server functions and never adds a broad `is_admin` branch to existing student policies.

The safe initial story population is:

- submitted for review;
- not private-only;
- not archived;
- returned through bounded, audited, server-side administrator APIs.

Administrators must not receive unrestricted browser/database access or silent access to private/unsubmitted/archived stories. Any Founder requirement to include those records needs separate explicit authority.

## Minimum future data/API shape

- bounded student search with server-side pagination and authorization;
- bounded story review lookup by authorized story identifier;
- existing review-status and suitability concepts reused where present;
- separate student-visible feedback and internal-only admin notes;
- reviewer identity, timestamp, and append-only audit event for every write;
- strict enums for score/status/suitability;
- direct-ID and cross-student denial tests;
- admin-console kill switch independent of the student product.

## Role behavior

- student: no admin routes, search, score, suitability, or internal-note access;
- mentor: only the existing authorized subset, not automatic admin parity;
- administrator: bounded operational views and audited review writes;
- anonymous/ineligible: no admin surface.

This document records the investigated safe contract only. It does not create architecture authority or claim implementation.
