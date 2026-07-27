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
- serves only 14 hash-pinned files from a private versioned release outside
  the public document root;
- proxies only health and API paths to one pinned Railway HTTPS hostname;
- never forwards WordPress cookies, nonces, referrers, forwarding headers, or
  caller-selected targets;
- blocks protected API proxying immediately while the feature is off or the
  SSO owner is unavailable;
- applies bounded request/response sizes, zero redirects, JSON validation,
  private no-store API/error policy, immutable fingerprinted assets, and the
  approved security headers;
- is removed atomically by moving one file out of `mu-plugins`, restoring the
  recorded WordPress 404 without editing `missionmed-hub`.

## Founder-only release configuration

Stage A must install and activate the plugin with:

- `storyforge_enabled=false`;
- an empty allowlist during shared-system health checks;
- no mentor roles enabled;
- exact production paths and origins;
- signing material held only in protected server configuration.

Stage A also installs the feature-off MU gateway only after a private release
hash check and immediately verifies no HTML/API/private response is a Kinsta or
Cloudflare cache hit.

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
