# D1-500 Known Limitations and Follow-ups

Blocking:

- The approved Critical Systems amendment and Timeline registration are applied
  on `codex/d1-500-critical-registration`. The full protected-systems gate passes
  140 checks with 0 failures, and the controlling Matrix guard passes all 10
  local/source/origin/public checks. This authority blocker is closed.
- Railway SSH database connection reports unauthorized despite an authenticated
  CLI session. Founder provider reauthorization is required before the logical
  backup or migration.
- All five Kinsta manual-backup slots are occupied. Creating the mandatory fresh
  D1-500 provider backup requires Founder authorization to remove one existing
  manual restore point, or a provider-side capacity increase.
- Production secret installation is Founder-only under DR-018. The required
  names are `TIMELINE_JWT_SECRET` and `TIMELINE_GATEWAY_SECRET` on the Railway
  API service, and `MISSIONMED_TIMELINE_JWT_SECRET` and
  `MISSIONMED_TIMELINE_GATEWAY_SECRET` in the Kinsta live WordPress server-side
  runtime. No value is stored in this package.
- Standard Kinsta WP-CLI WordPress bootstrap crashes in the existing MU-plugin
  layer with exit 139. A CLI-only `WPMU_PLUGIN_DIR` isolation bootstrap works;
  web traffic and protected MU-plugin bytes remain unchanged. Timeline-only
  activation/configuration must use that bounded bootstrap or WordPress admin.
- One approved administrator and one active 360 test identity are verified in
  production. Founder, second eligible student, non-360, and expired/revoked
  identities or controlled fixtures remain required. No password is stored in
  this package.
- Consent version `d1-500-v1` is Founder-approved.
- Railway database display name remains provider default `Postgres`; stable
  service ID is recorded.
- The central Matrix checkout lacks the protected source files, but immutable
  remote commit `60e7169b...` contains all ten exact bytes and passes the
  official local/origin/public guard. This closes the recovery-byte gap without
  authorizing a source restore or live Matrix mutation.

Intentional release boundaries:

- Remote object storage is unconfigured and fails closed.
- Remote File Vault publication and File Vault v2 are disabled.
- Accepted local import and client-side export remain available.
- Administrator access never implies student-record access; explicit audited
  grants are required.

Unrelated state preserved:

- no Supabase, DNS, Cloudflare, StoryForge, shared Matrix asset, shared Railway
  service, LearnDash course, WooCommerce, user, or production data mutation;
- no unrelated dirty worktree cleanup or overwrite.
