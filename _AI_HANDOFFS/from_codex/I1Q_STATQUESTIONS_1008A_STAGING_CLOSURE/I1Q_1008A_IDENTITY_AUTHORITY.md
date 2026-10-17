# I1Q-1008A Identity Authority

## Root Ruling

`VERIFIED`: DR-006 authorizes an additive I1Q identity adapter and prohibits weakening or replacing shared MissionMed authentication.

`ROOT IMPLEMENTATION DECISION`: `i1q.identity.v1` is the only identity contract accepted by the I1Q server candidate. This decision is scoped to I1Q and does not recreate the missing global `MM-AUTH-ARCH-001` authority.

The selected candidate profile is:

1. The browser presents a current RANKLISTIQ Supabase bearer obtained through the existing MissionMed identity chain.
2. I1Q pins the RANKLISTIQ issuer and project.
3. Supabase Auth `/auth/v1/user` verifies the bearer remotely.
4. The lowercase verified Supabase UUID is both `canonical_actor_id` and `supabase_user_id`.
5. `wordpress_user_id` and email are optional trace data only. Neither can authorize a request.
6. I1Q roles come only from active `i1q.actor_role_memberships` rows returned by the caller-scoped database RPC.
7. A physician reviewer role is not medical approval authority. Credential, assignment, conflict, evidence, governance, and exact-revision gates remain separate.

## Prohibitions

- No email-only authorization.
- No WordPress role conversion into I1Q roles.
- No request-supplied actor or role.
- No derived or random UUID fallback.
- No localStorage identity authority.
- No service-role key in browser code.
- No shared HQ, WordPress, Arena, Matrix, STAT, or Drills auth mutation in this ticket.

## Open Authority

`OPEN`: `MM-AUTH-ARCH-001.md` is absent from the canonical path referenced by MR-078A, MR-078B, and MR-079.

`OPEN`: the exact token-acquisition, refresh, one-time handoff, global logout, and durable revocation journey has not been owner-ratified for an I1Q staging host.

`OPEN HIGH`: tracked HQ source appears to tolerate invalid session-expiry metadata, use a process-random signing fallback, and omit proved one-time nonce consumption. Herschel also observed credentialed arbitrary-origin CORS reflection on the live HQ endpoint. I1Q did not modify these protected systems.

These open items block authenticated staging. They do not invalidate the local fail-closed adapter tests.
