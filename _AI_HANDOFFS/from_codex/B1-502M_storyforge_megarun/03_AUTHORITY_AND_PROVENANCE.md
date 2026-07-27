# B1-502M Authority and Provenance

Recorded: 2026-07-27

## Product authority

The only V5 product, UI, UX, interaction, navigation, and workflow authority is:

`_AI_HANDOFFS/from_cowork/B1-500_storyforge_v5_production_authority/storyforge-v5.html`

Required and observed SHA-256:
`3ac2871ff286552abe89a785ff43967df3315922e3718f67a136b83db1ba8db1`

The canonical artifact is the approved dark StoryForge V5 experience. Earlier
StoryForge implementations may establish infrastructure ownership and fallback
behavior only; they may not determine V5 presentation or workflow.

## Source provenance

- canonical worktree:
  `/Users/brianb/MissionMed_worktrees/B1-StoryForge-502`;
- branch: `b1-502-storyforge-production-deployment`;
- B1-501 verified baseline:
  `5ba56c7e3dd4f251ef4fc66c9de5fc4300c8acbc`;
- B1-502 premutation discovery commit:
  `e76193176e50fa0f0c329b40017c3e48b94510ef`;
- pushed first Kinsta MU gateway commit:
  `94504372c710372ea121a0b62ad7094e893e026b`;
- DR-013 execution-private bundle repair commit:
  `62ed421309c236d4b6ac05faca606108c0143592`, pushed normally at
  `2026-07-27T21:16:20Z`; its feature-off Kinsta attempt was physically
  rolled back after the live cache gate failed;
- Kinsta edge-storage response-header repair:
  `4bd956b6ea222d20428c41415236a73b93576447`, pushed normally at
  `2026-07-27T21:43:09Z`; its feature-off retry kept Cloudflare dynamic but
  was physically rolled back after Kinsta's server cache returned hits;
- safe-rollback and provider-gate evidence checkpoint:
  `07d620f8b788c2f2c01180a464b93b0c0dddf143`, pushed normally at
  `2026-07-27T21:57:39Z`; this documentation-only checkpoint made no provider
  or production mutation;
- repository remote:
  `https://github.com/brinyu13/missionmed-hq.git`.

The B1-501 baseline supplied locally verified Matrix SSO, same-origin routing,
authorization, caching, rollback, and browser seams. B1-502M adds only
production-target pinning and the smallest corrections proven necessary by
production evidence and adversarial review.

## MissionMed OS authority

The protected MissionMed OS authority was refreshed through its normal writer
in an isolated worktree. The active authority head is:

`d49fffbd1cd92854bd1390fb5f4dbf68be95796d`

That forward DR-013 amendment and its predecessors
`d7c5f3b26dd4f51928d0145e12b3e84bfa99dfb6`,
`4f3c7e89efbb55956a39066bce7e42598f55a244` and
`18df24dc4f1360551c7bf217f08d257a6e0cfee3` were pushed normally to the
canonical MissionMed OS `main`; local `origin/main` was verified at
`d49fffbd1cd92854bd1390fb5f4dbf68be95796d`.

The filed authority includes:

- DR-011 founder authorization;
- DR-012 forward amendment for the isolated Kinsta MU routing mechanism;
- DR-013 forward amendment for the execution-private runtime bundle and exact
  extensionless non-index aliases;
- B1-502M active mission registration;
- StoryForge production passport;
- product and authority index entries;
- generated `CURRENT.md`;
- activity log and registration receipt;
- local-track correction and filed-state correction;
- opaque founder evidence handle `B1-502M-FOUNDER-01`.

No raw founder user identifier or credential is stored in Git.

## Direct production provenance

Verified production facts:

- canonical Kinsta root:
  `/www/theresidencyacademy_209`;
- WordPress 7.0.2;
- PHP 8.2.29;
- `missionmed-hub` active at 1.5.1;
- seven WordPress administrators, which proves administrator-role admission
  would be overbroad;
- one opaque founder authorization handle exists, but exact WordPress profile
  binding remains pending a fresh founder-authenticated session;
- isolated StoryForge plugin and option absent before deployment;
- StoryForge V5 Worker absent before deployment;
- `/storyforge`, `/storyforge/`, and `/storyforge/healthz` returned 404 before
  deployment;
- no existing Supabase project is StoryForge authority;
- isolated Railway project/application/PostgreSQL targets were created under
  B1-502M authority.

Direct production evidence first proved that the initially created Cloudflare
route records were inert because the apex reaches Kinsta through a DNS-only
record. DR-012 changed route ownership to one isolated Kinsta MU gateway.

Feature-off deployment of gateway commit
`94504372c710372ea121a0b62ad7094e893e026b` then proved two narrower Kinsta
constraints: PHP-FPM could not read the sibling private 14-file release and
returned `release_unavailable`, and Nginx intercepted extension-bearing
`/storyforge/assets/*` requests before WordPress. The feature flag remained
false and the founder allowlist remained empty. The MU route file and active
pointer were physically removed, caches were purged, StoryForge routes returned
the prior 404 again, and root, Matrix login handoff, WordPress REST, legacy
StoryForge, and protected hashes remained healthy.

DR-013 changes only the runtime asset mechanism: the sibling private release is
immutable evidence, while runtime bytes are generated into one guarded
commit-versioned `release.php` below the MU-plugin autoload root and non-index
browser assets use exact `/storyforge/_asset/<sha12>` aliases. It does not change
product authority, founder scope, feature gating, protected Matrix boundaries,
Railway origin ownership, or database authorization.

Exact cache-repair commit
`4bd956b6ea222d20428c41415236a73b93576447` then proved a narrower provider
boundary. `DONOTCDN`, surrogate/CDN no-store headers, and `X-Accel-Expires: 0`
kept Cloudflare at `DYNAMIC`, but Kinsta's managed server/full-page cache
changed to `HIT` on the second and third passes and replaced the application
policy with `public, max-age=0, s-maxage=86400`. The route and active pointer
were immediately removed, scoped site/CDN purges succeeded, and the prior
WordPress 404 route state was restored.

Read-only verification at `2026-07-27T22:04:58Z` reconfirmed that safe state:
the active MU route and runtime `current` pointer were absent; the isolated SSO
plugin remained active with its settings present, but
`storyforge_enabled=false`, founder allowlist and role overrides both had zero
entries, mentor configuration and access were false, and mentor overrides and
assignments both had zero entries. Anonymous no-cookie/no-follow checks of
`/storyforge`, `/storyforge/`, `/storyforge/healthz`, `/storyforge/config`, and
`/storyforge/library` all returned 404 with Cloudflare `DYNAMIC`,
private/no-store policy, and Kinsta `EXPIRED` or `MISS`. No mutation occurred
during this verification.

Founder enablement therefore remains unauthorized pending all of:

- Kinsta Support applying a server/full-page cache bypass and corresponding
  edge-cache bypass for URL paths beginning exactly with `/storyforge`;
- a fresh founder-authenticated WordPress session for exact one-profile
  binding;
- explicit Founder acceptance of the same-UID managed-hosting residual for
  this one-founder pilot, or provider-enforced different-principal isolation;
- authenticated Cloudflare cleanup of the inert StoryForge Worker and routes.

## Protected runtime provenance

The canonical delegated Matrix lock is:

`/Users/brianb/MissionMed/_SYSTEM/KNOWN_GOOD/MATRIX_RUNTIME_LOCK_MANIFEST.json`

It was last updated at `2026-07-15T11:43:51.670Z`. The similarly named lock
copy inside this B1-502 worktree is older infrastructure metadata dated
`2026-06-23T18:30:57Z`; it is not the canonical live-lock source.

Live filesystem, public cache-busted response where applicable, private backup
extraction, and the canonical lock were first triangulated at
`2026-07-27T18:06:40Z`. The live protected hashes were reverified read-only at
`2026-07-27T22:04:58Z`:

| Asset | SHA-256 |
|---|---|
| Legacy StoryForge JS | `a4aa9665012206771fc8549c897cb5d22801899347c706626062dbafb29c81fa` |
| Legacy StoryForge CSS | `5b0426a7af9dbc36a1401c5d2829ca8cf7827e8070b783fbfe64875c847af7d8` |
| Matrix PHP | `5ed6e92eb9bf748a01f475bc5a6a72e249e21a2b7560d07d2acf66f8058e8d95` |
| Matrix shell | `c1d97237eab4936d014ec00549deb2358a056d5b8f430fe7713f5dd2ac39e76a` |

All four values match the current canonical delegated lock. B1-502M does not
edit those assets.

## Reconciled shared-system pins

Two manifest pins were stale metadata, not live-system failures:

- USCE Admin live/R2:
  `9b6eade1c5e5d60044a418d6ec334958f037ba8ae948472673ad064a0862c29c`;
- Arena live/R2:
  `7bb0ad1cf1cf9e3d1fbaa021606d98fbd0000b2b0cac3898bce6c73225a37705`.

The updated values were corroborated by retained deployment reconciliation
evidence. B1-502M changed only the authority metadata; it did not mutate either
shared production system.
