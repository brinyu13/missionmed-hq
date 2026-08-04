# D1-500 Known Limitations and Follow-ups

Blocking at the 2026-08-04T16:34:00Z checkpoint:

- The approved Critical Systems amendment and Timeline registration are applied
  on `codex/d1-500-critical-registration`. The full protected-systems gate passes
  140 checks with 0 failures, and the controlling Matrix guard passes all 10
  local/source/origin/public checks. This authority blocker is closed.
- Railway authorization, provider-native backup, the logical backup, isolated
  restore proof, and all six accepted production database assets are complete.
- Kinsta backup capacity was reconciled under the explicit Founder deletion
  authorization. The exact oldest manual item was replaced by
  `D1-500-PRE-20260804T161859Z`, which is READY with a restore control.
- Production secret installation remains Founder-only under DR-018. Current
  Railway name-only inspection proves the API service lacks
  `TIMELINE_JWT_SECRET` and `TIMELINE_GATEWAY_SECRET`; the corresponding Kinsta
  runtime bindings are not verifiable. The required
  names are `TIMELINE_JWT_SECRET` and `TIMELINE_GATEWAY_SECRET` on the Railway
  API service, and `MISSIONMED_TIMELINE_JWT_SECRET` and
  `MISSIONMED_TIMELINE_GATEWAY_SECRET` in the Kinsta live WordPress server-side
  runtime. No value is stored in this package.
- Standard Kinsta WP-CLI WordPress bootstrap crashes in the existing MU-plugin
  layer with exit 139. A CLI-only `WPMU_PLUGIN_DIR` isolation bootstrap works;
  web traffic and protected MU-plugin bytes remain unchanged. Timeline-only
  activation/configuration must use that bounded bootstrap or WordPress admin.
- One approved administrator and one active 360 test identity are verified in
  production. Founder-equivalent, second eligible student, non-360, and
  expired/revoked controlled fixtures are authorized but cannot truthfully run
  through the production path until API health passes. No password is stored in
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
