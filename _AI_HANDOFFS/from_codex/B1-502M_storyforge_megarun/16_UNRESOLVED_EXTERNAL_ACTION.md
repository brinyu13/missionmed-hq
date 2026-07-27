# B1-502M Unresolved External Action

Recorded: 2026-07-27

## Current safe production state

- The active StoryForge MU route and runtime `current` pointer are absent.
- `/storyforge`, `/storyforge/`, and `/storyforge/healthz` return the prior
  WordPress 404 after provider propagation.
- The feature flag is false; founder allowlist and role overrides are empty;
  mentor access is disabled.
- No founder, administrator, student, mentor, or other user is enabled.
- Exact committed release directories remain dormant and byte-identical.
- Protected Matrix and legacy StoryForge assets remain exact.
- Railway API and PostgreSQL remain isolated and inaccessible without valid
  application identity.

The live StoryForge founder release is not active and must not be represented
as founder-ready.

## MyKinsta Support action

Authenticated MyKinsta access and explicit authorization to send an external
support message are required. Send exactly:

> On the production MissionMed Institute WordPress environment, add a
> server/full-page cache bypass and corresponding edge-cache bypass for URL
> paths beginning exactly with `/storyforge`. Do not disable global caching,
> change DNS, alter unrelated routes, or change any other cache rule. Please
> confirm the effective pattern and completion.

After Kinsta confirms completion, reinstall only exact pushed commit
`4bd956b6ea222d20428c41415236a73b93576447` feature-off and repeat the complete
three-pass route, cache, authorization, protected-hash, shared-health, and
rollback gates. Any Kinsta or Cloudflare cache hit remains a hard stop.

## Founder same-UID decision

Kinsta PHP-FPM and the authorized deployment session share the same Unix owner.
Modes `0444`/`0555` are useful read-only drift barriers, but they are not a
host-enforced privilege boundary against that same owner. A provider-enforced
different-principal boundary would be stronger.

If the Founder accepts the residual for this exact pilot, the required
forward decision is:

> I explicitly accept, for B1-502M's exact one-founder pilot only, that Kinsta
> PHP-FPM and the deployment session share the Unix owner; `0444`/`0555` and
> integrity checks are defense in depth, not host-enforced immutability. This
> acceptance expires before any non-founder enablement or hosting-principal
> change.

Without that explicit decision or provider-enforced different-principal
isolation, founder enablement remains unauthorized.

## Remaining authenticated actions

1. MyKinsta: sign in and authorize the exact Support request above.
2. WordPress: establish a fresh founder-authenticated session so exactly one
   profile can be bound without inferring identity from stale evidence.
3. Cloudflare: establish fresh authentication and remove only:
   - route ID `37a1ba80b39043a08cc7b482cfa7e3c6`;
   - route ID `fcb362908f22443187a5b0541bf61a75`;
   - Worker `missionmed-storyforge-v5`.

No other Kinsta, WordPress, DNS, Cloudflare, Matrix, database, Railway, or
production mutation is authorized by this unresolved-action record.
