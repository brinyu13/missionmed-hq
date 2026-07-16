# I1Q-1008A Staging Security

## Verdict

`VETO: NO I1Q-1008A SUCCESS STATE IS SECURITY-CERTIFIED`

The local candidate has strong fail-closed controls, but no authorized preview database, canonical authenticated I1Q journey, or non-localhost staging runtime exists. Local synthetic proof cannot satisfy the ticket's preview or staging attack gates.

## Verified Local Controls

- The final immutable product candidate at commit `fd7ddcd` passes 287 tests with 285 passes, zero failures, and two intentional database-target skips.
- Fresh disposable PostgreSQL runs pass 13 of 13 base attacks and 1 of 1 1008A runtime-role, compensation, and reapplication proof.
- The evidence validator passes all 20 expected files with zero errors and reports `BLOCKED`.
- Identity resolution pins the RANKLISTIQ Supabase project, rejects privileged keys, validates bearer claims remotely, and resolves I1Q memberships only through the caller-scoped database RPC.
- Browser or token role claims never create application authority.
- Identity failures are public-detail-free and emit token-free audit events.
- The browser session projection is closed to actor ID, roles, expiry, and request-verification state.
- Mutations require session-bound request integrity and exact trusted origin.
- Non-demo static content denies access without an explicit access adapter.
- Logout fails closed without the canonical revocation adapter; the local UI clears in-memory state after successful revocation.
- Readiness fails unless identity, static access, logout, datastore, migration, audit, and all-flags-off gates are explicitly true.
- Stale draft writes require an exact client-observed SHA-256 and fail without overwriting the accepted write.
- Public bundle scans found no answer map, restricted-source location, service credential, or raw-source field.
- The 1008A role migration rejects role-name collisions with unexpected ownership, membership, ACL, or direct privilege.
- `i1q_identity_profile_reader` has only caller-scoped identity capability; `i1q_app_runtime` remains deny-all and browser-inaccessible pending an authorized actor binder and grant manifest.
- The browser drains validated cursor pages, rejects changing snapshots and overlapping IDs, and passes a 250-row regression instead of silently stopping at the first 200 rows.
- Table scroll regions establish their own positioning context so visually hidden table headers cannot expand the page root. Direct browser checks passed the formerly failing table workflows at 320 and 768 pixels while preserving independent table scrolling.

## Preview Workflow Security

The unrun preview workflow is fail-closed and requires:

- a separate secret-free source validation job;
- step-scoped preview secrets;
- one exact authorized operation;
- exact candidate commit and SQL/workflow hashes;
- an exact separately committed approval record and digest;
- an approved complete remote migration-history hash;
- provider backup and tested-restore references;
- production project and host denial;
- separate apply, compensation, and reapplication history stages;
- post-operation role, forced-RLS, direct-grant, and all-flags-off checks;
- evidence upload only after the redaction step succeeds.

These controls are static candidates. They do not prove an actual backup, restore, hosted attack suite, project-pinned schema diff, or preview execution.

## Open High Gates

- The protected HQ auth chain has unresolved expiry, configured-signing, credentialed-origin, and nonce-replay findings that require the protected owner process or exact runtime disproof.
- The direct bearer candidate and Lorentz's proposed HQ assertion contract are not one owner-ratified closed identity profile.
- No canonical test users, refresh path, durable revocation path, old-tab proof, or registered staging origin exists.
- No application actor binder, exact workflow grants, pool-clearing proof, or hosted RLS matrix exists.
- No deployed HTTPS headers, CORS, cache, rate control, log-redaction, monitoring, or rollback evidence exists.

## Isolation Verdicts

- Answer isolation: `PASS LOCAL SYNTHETIC; STAGING NOT RUN`.
- Explanation isolation before finalization: `PASS LOCAL SYNTHETIC; STAGING NOT RUN`.
- Restricted-source isolation: `PASS LOCAL SYNTHETIC; STAGING NOT RUN`.
- Raw transcript leakage: `NO TRANSCRIPTS CONNECTED; STAGING NOT RUN`.
- Audit immutability: `PASS LOCAL AND DISPOSABLE DATABASE; HOSTED NOT RUN`.

All feature flags remain off. No preview, staging, production, auth, database, or protected-system write was performed.
