# B1-501 Project Memory

## Durable lessons

1. The protected Matrix guard can confirm live/origin hashes while still blocking local edits because source files are absent. A matching public hash is not edit authority.
2. B1-501 does not need protected `missionmed-hub` edits. A separate, default-off plugin can provide the SSO and server-rendered navigation seams through filters, menu hooks, and shortcodes.
3. WordPress behind a local edge proxy needs the forwarded public host applied before WordPress canonical redirect logic. Otherwise a valid permalink can redirect to itself indefinitely.
4. Removing `content-length` and `content-encoding` from a decompressed proxy response prevents truncated WordPress login pages.
5. Production tokens remain memory-only. The legacy local browser suite can survive reload by persisting only a non-secret fixture persona and minting a new loopback-only token.
6. B1-500 defines the `sf_mentor_assignments` enforcement table but not the production WP assignment owner. A clean local reconciliation is necessary evidence, not proof of production fidelity.
7. Existing screenshot-producing suites should be run from an isolated working directory so accepted evidence is not overwritten.
8. `/storyforge/*` route precedence and ordinary WP permalink behavior must be tested together; testing only the SPA path is insufficient.

## Resume point

B1-501 is locally complete. Resume only under B1-502 authority, beginning with the unresolved inputs and deployment checklist in the combined handoff. Do not treat these local receipts as staging or production readiness.
