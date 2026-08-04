# D1-500 Known Limitations and Follow-ups

Blocking:

- Critical Systems gate fails on pre-existing, unrelated USCE Admin and Arena
  CDN hash drift. Founder override or separate manifest reconciliation is
  required before Kinsta mutation.
- Railway SSH database connection reports unauthorized despite an authenticated
  CLI session. A supported provider connection method or Founder reauthorization
  is required before migration.
- Production secret installation is Founder-only under DR-018.
- Production canary and negative-test identities are not identified.
- Consent version `d1-500-v1` wording awaits Founder approval.
- Railway database display name remains provider default `Postgres`; stable
  service ID is recorded.

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
