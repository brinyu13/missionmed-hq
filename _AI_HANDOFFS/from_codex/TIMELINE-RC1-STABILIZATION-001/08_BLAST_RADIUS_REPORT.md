# Timeline RC1 Blast Radius Report

## Modified scope

- Timeline package source, tests, build scripts, and its WordPress route adapter.
- Timeline API service only.
- Timeline WordPress immutable runtime and Timeline route only.
- Dedicated Timeline private R2 bucket and its exact CORS policy.
- Existing Timeline PostgreSQL schema records only; no migration or schema change.
- Approved-administrator persistence routing only: administrators remain device-local; eligible student remote behavior is unchanged.
- Timeline admission setting was temporarily changed off/canary and restored exactly to eligible-360.

## Explicitly unchanged

- D1-409H protected presentation assets.
- Matrix shell and other Matrix applications.
- StoryForge, Arena, USCE, PRIQ, File Vault, and WordPress core.
- Shared Railway services and unrelated staged Railway changes.
- Supabase, DNS, CDN/R2 public delivery, Cloudflare zones, and avatar objects.
- LearnDash course mapping or real student entitlement.

## Storage decision

The existing avatar bucket was verified as Category A: avatar-specific and anonymously/publicly delivered. It was not modified or reused. The dedicated `missionmed-timeline-media-prod` bucket is private and isolates Timeline policy, keys, audit, retention, backup, and rollback from avatars.

## Cost

Provider inspection showed current R2-period cost of approximately $0.03 and an empty new bucket after verification. No expected recurring cost near the $25/month Founder stop threshold was identified.

## Incidents contained

- Wrong-root Railway deployment: actual rollback restored the prior API before the corrected package-root deployment.
- First R2 token UI exposure: replacement token created, original revoked before use, and values excluded from source/evidence.
- WordPress CLI exits `139` after option writes on this Kinsta environment: every write was independently read back before continuing.

Unrelated application impact: **NONE**.

## Recovery 002 blast radius

Recovery touched only the Timeline SSO plugin, Timeline frontend auth/adapter code, Timeline identity directory, one Timeline-only migration, Timeline tests, the immutable Timeline WordPress release pointer, and the Timeline Railway API service. PostgreSQL schema version stayed `d1-timeline-db-500.1`. No live Matrix runtime, shared login policy, WordPress core, DNS, CDN, R2 public access, avatar data, StoryForge, Arena, USCE, File Vault, Supabase, or unrelated Railway service changed. The final query-serialization repair changes only execution order of three reads inside an existing authorization transaction.
