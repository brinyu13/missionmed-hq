# B1-502M Security, Privacy, and Authorization

Recorded: 2026-07-27

## Identity boundary

- WordPress remains the interactive login authority.
- No second StoryForge login is introduced.
- The WordPress session cookie is used only against WordPress.
- The browser holds the StoryForge JWT in memory only.
- The Worker strips cookies before proxying to Railway.
- JWT verification requires signature, issuer, audience/purpose, expiry,
  issuance time, unique token ID, positive WordPress user ID, stable UUID,
  application role, and eligibility.
- The database transaction binds both the signed UUID and WordPress ID.
- A mismatched, expired, malformed, revoked, or ineligible identity fails
  closed.

## Founder-only authorization

- The initial allowlist is empty.
- Enabling by WordPress role is prohibited.
- Exactly one founder account is configured in protected runtime state.
- The founder is mapped to StoryForge student workflow, not an all-access admin
  role.
- The other six WordPress administrators remain denied.
- General students, mentors, advisors, and coaches remain denied.
- Direct URL access does not bypass bootstrap, token, user-row, or RLS checks.

## Database privacy

- `storyforge_app` is a least-privilege login and does not bypass RLS.
- Authenticated identity is set transaction-locally.
- Private stories are protected in list and direct-ID paths.
- Original content and revisions are immutable/append-only where required.
- audit events and notifications remain server/transaction controlled.
- the initial production database contains no demo records, stories,
  assignments, imports, audio, AI results, or mentor data.

## Network and cache privacy

- WordPress token/bootstrap responses are private and noncacheable.
- All StoryForge API responses and errors are private and noncacheable.
- Static HTML is noncacheable.
- Fingerprinted public assets alone receive immutable caching.
- No service-role credential, JWT signer, database password, private key,
  WordPress cookie, or founder raw identifier is present in source or bundles.
- Logs and evidence retain only resource IDs, counts, hashes, and the opaque
  founder handle.

## Feature gates

- AI features: disabled.
- Audio/transcription: disabled and unconfigured.
- Mentor access: disabled.
- General student population: disabled.
- Local fixtures and developer authentication: disabled in production.
- Story submission with zero active mentor assignment: denied truthfully.

## Mandatory rollback triggers

Rollback is immediate for any incorrect founder entitlement, other-account
access, mentor access, private-story leakage, demo-data exposure, secret
exposure, broken logout/revocation, route shadowing, infinite loading,
mismatched assets, database corruption, or shared Matrix regression.
