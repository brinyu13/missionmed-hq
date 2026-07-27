# B1-502M WordPress and Matrix Evidence

Recorded: 2026-07-27

## Production before-state

- Kinsta SSH alias `missionmed-kinsta` resolves to the canonical production
  environment.
- WordPress commands use `--path=public` beneath
  `/www/theresidencyacademy_209`.
- WordPress site URL is `https://missionmedinstitute.com`.
- WordPress is 7.0.2 on PHP 8.2.29.
- `missionmed-hub` 1.5.1 is active.
- `missionmed-storyforge-sso` is absent.
- `missionmed_storyforge_settings` has zero rows.
- Seven administrator accounts exist.
- The exact founder account was selected without persisting its raw numeric ID
  in repository evidence.
- Anonymous `/member-dashboard/` redirects to the existing WordPress login.

## Isolated integration contract

The B1-502M SSO plugin:

- defaults the feature flag to false and forces it false on activation;
- uses a default-empty exact `allowed_user_ids` allowlist;
- does not infer admission from the administrator role;
- maps only the exact founder pilot account to StoryForge student workflow;
- exposes no UI role toggle;
- admits navigation, bootstrap, and token issuance only after the same
  server-side access decision;
- uses an existing WordPress session and REST nonce;
- issues a short-lived signed token with required `exp`, `iat`, `jti`,
  `wp_user_id`, stable StoryForge UUID, role, and eligibility claims;
- returns private `no-store` headers for successful and denied bootstrap/token
  responses;
- loads an isolated Matrix adapter only for an eligible account;
- intercepts only the StoryForge Matrix control and `#storyforge`;
- leaves all protected `missionmed-hub` files unchanged;
- disables itself and clears its rate-limit state on deactivation.

The separate isolated MU route gateway:

- claims only the canonical host and exact `/storyforge` route family;
- loads one guarded generated bundle from
  `wp-content/mu-plugins/missionmed-storyforge-runtime/releases/<exact-product-commit>/release.php`
  through an atomic runtime `current` pointer;
- verifies the bundle hash, size, release identifier, complete 14-file logical
  manifest, exact bytes, full hashes, sizes, MIME types, and cache classes;
- serves the application shell only from `/storyforge/` or extensionless SPA
  deep links and serves non-index assets only through exact
  `/storyforge/_asset/<sha12>` aliases;
- rejects unknown, malformed, colliding, or index aliases and raw
  extension-bearing asset paths;
- keeps `release.php` below the root MU-plugin autoload boundary and requires it
  to return a zero-content 404 when requested directly without `ABSPATH`;
- proxies only health and API paths to one pinned Railway HTTPS hostname;
- never forwards WordPress cookies, nonces, referrers, forwarding headers, or
  caller-selected targets;
- blocks protected API proxying immediately while the feature is off or the
  SSO owner is unavailable;
- applies bounded request/response sizes, zero redirects, JSON validation,
  private no-store API/error policy, manifest-specific cache classes for
  approved SHA-derived aliases, and the approved security headers;
- is removed atomically by moving one file out of `mu-plugins`, restoring the
  recorded WordPress 404 without editing `missionmed-hub`.

The sibling private 14-file release at
`private/b1-502m/runtime/storyforge-v5/releases/94504372c710372ea121a0b62ad7094e893e026b/`
is immutable evidence only. It is not the PHP-FPM runtime source and must not be
deleted, overwritten, moved, or publicly mirrored.

## Founder-only release configuration

Stage A must install and activate the plugin with:

- `storyforge_enabled=false`;
- an empty allowlist during shared-system health checks;
- no mentor roles enabled;
- exact production paths and origins;
- signing material held only in protected server configuration.

Stage A also installs the feature-off MU gateway only after deterministic bundle
generation, complete logical-release verification, direct-execution denial,
root-autoload exclusion, immutable release-directory creation, and an atomic
runtime pointer switch. It immediately verifies that all browser asset requests
use approved extensionless aliases and that no HTML/API/private response is a
Kinsta or Cloudflare cache hit.

Stage B may then configure exactly:

- founder account handle `B1-502M-FOUNDER-01`;
- one raw WordPress user ID in protected runtime configuration only;
- one deterministic StoryForge UUID binding;
- application role `student`;
- `storyforge_enabled=true`.

All other administrators, students, mentors, advisors, and coaches remain
denied.

## Matrix boundary

The current protected Matrix navigation source is unavailable for modification
in this exact worktree and remains protected by the runtime guard. B1-502M
therefore uses the isolated, eligible-user-only adapter. The current legacy
StoryForge tile and V2 runtime remain available as fallback and are not evidence
that V5 is deployed.

## First gateway attempt and current state

The first feature-off gateway attempt used pushed commit
`94504372c710372ea121a0b62ad7094e893e026b`. It failed closed for two
provider-specific reasons:

- Kinsta PHP-FPM could not read the sibling private release and returned
  `release_unavailable`, even with the required traversal and read modes
  present;
- Kinsta Nginx returned 404 for extension-bearing `/storyforge/assets/*`
  requests before WordPress could dispatch them to the MU gateway.

No founder or other user was enabled. The WordPress feature flag stayed false
and the allowlist and role overrides stayed empty. The active pointer and MU
route file were physically removed, Kinsta caches were purged, and independent
follow-up probes confirmed the restored state: StoryForge routes 404, root 200,
anonymous member dashboard 302 to login, and `wp-json` 200. The protected
`missionmed-hub` and legacy StoryForge assets remained unchanged. The DR-013
bundle/alias mechanism above remains a candidate pending exact-tree review,
commit, push, feature-off deployment, and live verification.
