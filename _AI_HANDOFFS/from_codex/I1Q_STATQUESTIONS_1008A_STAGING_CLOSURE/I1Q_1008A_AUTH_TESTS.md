# I1Q-1008A Auth Tests

## Local Result

`PASS, LOCAL SYNTHETIC ONLY`

The final immutable product candidate at commit `fd7ddcd` passed the full Node estate with 287 tests, 285 passes, zero failures, and two intentional database-target skips. The focused browser UI regression suite passed 19 of 19 tests.

Covered locally:

- correct issuer, audience, subject, session, expiry, and remote user binding
- wrong issuer and audience
- service-role and anonymous-token rejection
- expired and future-issued tokens
- malformed and missing bearer
- provider and role-profile outage
- actor mismatch, revoked profile, and missing role
- forged browser role rejection
- mandatory `i1q.identity.v1` contract version
- mandatory canonical actor equality
- expired credential evidence
- physician placeholder remains unverified
- trusted-origin and bearer enforcement on writes
- CSRF rejection for missing, wrong, and hostile-origin requests
- fail-closed non-demo static access
- fail-closed readiness composition
- canonical logout composition and synthetic old-bearer rejection
- safe public errors and token-free failure audit events
- answer and restricted-source route isolation
- feature-gated internal and review routes

## Fixture Estate

The nonmedical fixture file contains platform administrator, editorial reviewer, unverified physician placeholder, privacy reviewer, release manager, read-only auditor, unauthorized student, unauthenticated visitor, revoked user, and expired session personas.

These UUIDs and identities are deterministic local fixtures. They are not MissionMed accounts, database grants, or medical credentials.

## Not Run

- canonical WordPress login to I1Q
- HQ handoff replay and nonce consumption
- real RANKLISTIQ role membership
- refresh and rotation
- real provider logout, global revocation, and old-tab denial
- canonical staging CORS and cookie behavior
- authenticated direct URL and browser journeys

No unrun item is reported as pass.

## Evidence Boundary

The synthetic fixtures prove the local adapter and server boundary behavior. They are not authenticated MissionMed users and do not close the canonical identity lifecycle. State A remains unachieved until the owner-ratified identity profile is composed with real nonproduction identities and its end-to-end attacks pass.
