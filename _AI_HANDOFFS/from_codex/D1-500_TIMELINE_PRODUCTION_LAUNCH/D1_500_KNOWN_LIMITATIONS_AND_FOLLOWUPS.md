# D1-500 Known Limitations and Follow-ups

Blocking:

- Critical Systems reconciliation proves stale central USCE/Arena metadata and
  central-source divergence, not unexplained live drift. Founder approval is
  required to apply the exact protected-manifest amendment and register
  Timeline before Kinsta mutation. The accepted Arena runtime separately has an
  open credential-logging P0; the proposed pin is not a safety certification.
- Railway SSH database connection reports unauthorized despite an authenticated
  CLI session. A supported provider connection method or Founder reauthorization
  is required before migration.
- Production secret installation is Founder-only under DR-018.
- One approved administrator and one active 360 test identity are supplied only
  through the private task context. Founder, second eligible student, non-360,
  and expired/revoked identities or controlled fixtures remain required. No
  password is stored in this package.
- Consent version `d1-500-v1` wording awaits Founder approval.
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
