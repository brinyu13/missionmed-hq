# B1-502M Security, Privacy, and Authorization

Recorded: 2026-07-27

## Identity boundary

- WordPress remains the interactive login authority.
- No second StoryForge login is introduced.
- The WordPress session cookie is used only against WordPress.
- The browser holds the StoryForge JWT in memory only.
- The isolated Kinsta MU gateway strips WordPress cookies, nonces, referrers,
  forwarding headers, and caller-selected targets before proxying to Railway.
- JWT verification requires signature, issuer, audience/purpose, expiry,
  issuance time, unique token ID, positive WordPress user ID, stable UUID,
  application role, and eligibility.
- The database transaction binds both the signed UUID and WordPress ID.
- A mismatched, expired, malformed, revoked, or ineligible identity fails
  closed.

## Founder-only authorization

- The initial allowlist is empty.
- Enabling by WordPress role is prohibited.
- No founder account is bound or enabled. The feature flag is false and the
  feature-off production retry is physically rolled back.
- Stage B may configure exactly one founder account in protected runtime state
  and map it to StoryForge student workflow, not an all-access admin role.
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
- Only approved non-index `/storyforge/_asset/<sha12>` aliases whose generated
  cache class is `immutable` receive immutable caching.
- No service-role credential, JWT signer, database password, private key,
  WordPress cookie, or founder raw identifier is present in source or bundles.
- Logs and evidence retain only resource IDs, counts, hashes, and the opaque
  founder handle.

## Execution-private asset boundary

- The sibling private 14-file release at commit
  `94504372c710372ea121a0b62ad7094e893e026b` is byte-verified immutable evidence
  only; Kinsta PHP-FPM does not use it as runtime.
- Runtime bytes exist only in one deterministic generated `release.php` under
  `wp-content/mu-plugins/missionmed-storyforge-runtime/releases/<exact-product-commit>/`.
- The gateway verifies the bundle hash, byte size, release identifier, complete
  logical manifest, and every selected asset's alias, full SHA-256, size, MIME
  type, cache class, and decoded bytes before serving.
- The atomic runtime `current` pointer may select only an immutable direct child
  whose directory name is the exact final product commit.
- `release.php` lives below the root MU-plugin autoload directory and returns a
  zero-content 404 unless WordPress has already defined `ABSPATH`.
- No release PHP, loader, duplicate, backup, or temporary PHP file may exist in
  the root MU-plugin directory.
- Raw JavaScript, CSS, font, license, or HTML files may not be publicly
  addressable under `wp-content` or another web path.
- Only non-index assets may resolve through unique lowercase 12-hex aliases.
  Unknown, malformed, colliding, or index aliases return a nonstorable 404.
- Production mode `0444`/`0555` provides a read-only drift barrier, but it is
  not a host-enforced privilege boundary on this managed environment: Kinsta
  PHP-FPM and the authorized deployment session share the same Unix owner.
  That owner can in principle change modes or unlink entries from an
  owner-writable parent.

Exact cache-repair commit
`4bd956b6ea222d20428c41415236a73b93576447` was committed, pushed, installed
feature-off, and physically rolled back after the live cache gate. Its
route/bundle, direct-execution, alias, protected-hash, and feature-off checks
passed. Cloudflare remained `DYNAMIC`, but Kinsta's server cache became `HIT`
and rewrote the response policy. The route and active pointer are absent; the
exact release is dormant; no account is enabled.

Founder enablement requires both a Kinsta server/full-page and corresponding
edge-cache exclusion for paths beginning exactly with `/storyforge`, and either
provider-enforced different-principal ownership or explicit Founder acceptance
of the same-UID residual for this exact one-founder pilot. Any acceptance must
expire before non-founder enablement or a hosting-principal change.

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
