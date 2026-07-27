# B1-502M Deployment Log

Recorded: 2026-07-27

Production target:
`https://missionmedinstitute.com/storyforge/`

## Release state summary

| System | Mutation performed | Last verified production state |
|---|---|---|
| MissionMed OS | DR-011, DR-012, and DR-013 authority filed and pushed | Authority active at `d49fffbd1cd92854bd1390fb5f4dbf68be95796d` |
| Application Git | Six implementation/evidence checkpoints pushed through `e531d565fab9ed1c85b780d578a408112fe8cb41` | Local and remote branch heads match `e531d56...`; exact retry candidate remains `4bd956...` |
| Railway PostgreSQL | Isolated service created; three migrations applied | 3/3 ledger, 15/15 RLS, zero users/content/assignments |
| Railway API | Isolated API-only service deployed | Deployment `fb43a551-04c8-41f7-a6e6-fb16aae3894e` healthy and access-controlled |
| WordPress SSO | Isolated plugin installed and activated | Installed; feature false; allowlist/overrides empty; mentor disabled |
| Kinsta gateway | Three feature-off attempts installed and rolled back | Active MU route absent; active `current` pointer absent |
| Cloudflare | Isolated Worker and two route records created for diagnosis | Inert because apex is DNS-only to Kinsta; authenticated cleanup pending |
| Founder cohort | No binding or enablement performed | Enabled cohort: none |

## Git release checkpoints

1. `f23d7daeb289c7340ec4ab1903956cc4cfec282a` —
   guarded founder-release foundation.
2. `94504372c710372ea121a0b62ad7094e893e026b` —
   isolated WordPress gateway.
3. `62ed421309c236d4b6ac05faca606108c0143592` —
   execution-private Kinsta runtime delivery.
4. `4bd956b6ea222d20428c41415236a73b93576447` —
   edge-cache storage prevention and exact feature-off retry candidate.
5. `07d620f8b788c2f2c01180a464b93b0c0dddf143` —
   safe rollback and provider-cache evidence checkpoint.
6. `e531d565fab9ed1c85b780d578a408112fe8cb41` —
   15-file safe-rollback terminal handoff checkpoint.

All application pushes were normal; no force push, history rewrite, pull
request, merge, or general release occurred.

## Railway deployment

- Project: `875e7c17-d06f-4301-a4bb-e61016f153cf`.
- Environment: `bcef8734-e42b-44df-8488-c2a3de68213f`.
- Application service: `dab015bf-15ef-4698-9f16-cbf8cf23de7a`.
- PostgreSQL service: `a4a66362-c3ba-475a-ae21-2aa46624bafe`.
- PostgreSQL provider deployment:
  `f5c7179e-b805-4e82-b080-d2349a0a47cf`.
- API deployment: `fb43a551-04c8-41f7-a6e6-fb16aae3894e`.
- Public API domain:
  `https://storyforge-v5-api-production.up.railway.app`.
- Domain identifier: `167947f8-ab20-4ecd-a971-b00c1c8441f9`.
- Runtime mode: API-only; direct UI root returns 404.
- Migration state: 3/3 exact; 15 tables with RLS; zero application records.

The Railway resources are isolated infrastructure, not proof that the
same-origin Matrix product is live.

## WordPress deployment

The four-file `missionmed-storyforge-sso` plugin from the guarded foundation
was uploaded and activated on the pinned Kinsta site. Its protected signer is
referenced server-side and is absent from Git/evidence.

Last verified configuration:

- `storyforge_enabled=false`;
- exact founder allowlist empty;
- role overrides empty;
- application role `student` only;
- mentor access disabled;
- all seven administrator accounts denied while feature-off.

No founder profile or `sf_users` row was created.

## Kinsta gateway attempts

### Attempt 1 — sibling private release

Candidate: `94504372c710372ea121a0b62ad7094e893e026b`.

Result: failed closed with `release_unavailable`; Kinsta Nginx also intercepted
extension-bearing asset paths. The active pointer and route were removed.

Recorded defect: the first install and rollback used
`purge_complete_caches(true)`, invalidating object, site, and CDN caches. Shared
health passed, and every later attempt used only separate site-cache and
CDN-cache purges.

### Attempt 2 — DR-013 nested bundle

Candidate: `62ed421309c236d4b6ac05faca606108c0143592`.

- Installed feature-off: `2026-07-27T21:23:59Z`.
- Bundle: 409,055 bytes; SHA-256
  `845289a4c646b0ea496fa864186a0b9f534425ff8aad8b40e0e3993ebf05a3f1`.
- Route: 29,548 bytes; SHA-256
  `78cecf86bbcffe6c30a7eefd43fbe15f5c7e01247f550397ccf14cae3084c432`.
- Result: route/topology/alias/security gates passed; repeated cache gate
  failed.
- Physically rolled back: `2026-07-27T21:37:13Z`.

### Attempt 3 — exact cache repair

Candidate: `4bd956b6ea222d20428c41415236a73b93576447`.

- Installed feature-off: `2026-07-27T21:44:33Z`.
- Bundle: unchanged exact 409,055-byte artifact, release ID
  `v-963b8f5eb4d8c727`.
- Route: 30,528 bytes; SHA-256
  `23ca6d28268a780c46c27083a726dab18c3e6125a46a6fda600fd9c03eee2d88`.
- Pass one: Cloudflare `DYNAMIC`; Kinsta `MISS`; exact application policies.
- Passes two and three: Cloudflare stayed `DYNAMIC`; Kinsta changed to `HIT`
  and returned `public, max-age=0, s-maxage=86400`.
- Physically rolled back: `2026-07-27T21:45:23Z`.
- Scoped site-cache and CDN-cache purge calls: HTTP 200 each.

Last verified after propagation:

- active route absent;
- active `current` pointer absent;
- exact release directories dormant and byte-identical;
- read-only verification at `2026-07-27T22:04:58Z` found `/storyforge`,
  `/storyforge/`, `/storyforge/healthz`, `/storyforge/config`, and
  `/storyforge/library` returning the prior WordPress 404 with Cloudflare
  `DYNAMIC`, private/no-store policy, and Kinsta `EXPIRED` or `MISS`;
- continuation verification at `2026-07-27T22:32:03Z` reconfirmed the absent
  route/pointer and all five paths as 404 with Cloudflare `DYNAMIC` and
  private/no-store policy; Kinsta reported `HIT` on the inactive WordPress 404
  responses, reinforcing the provider exclusion gate without exposing V5;
- no user enabled.

## Cloudflare deployment and containment

Created:

- Worker `missionmed-storyforge-v5`;
- exact route `37a1ba80b39043a08cc7b482cfa7e3c6`;
- wildcard route `fcb362908f22443187a5b0541bf61a75`.

These records never became traffic authority. No DNS record, shared Worker,
unrelated route, Pages project, or unrelated cache rule was changed.
Authenticated removal of only these three isolated records remains pending.

## Rollback references

- WordPress/Matrix:
  `B1-502M-RP-KINSTA-PRE-20260727T174625Z`.
- PostgreSQL pre-migration:
  `B1-502M-RP-DB-PRE-20260727T173144Z`.
- PostgreSQL post-schema:
  `B1-502M-RP-DB-SCHEMA-20260727T190219Z`.
- Cloudflare absent prestate:
  `B1-502M-RP-CF-ABSENT-20260727T174734Z`.
- Railway application absent prestate:
  `B1-502M-RP-RWY-ABSENT-20260727T171118Z`.

## Deployment conclusion

The isolated database, API, and feature-off SSO foundation are deployed. The
same-origin Kinsta gateway is not active, the founder cohort is empty, and
StoryForge V5 is not live through Matrix. The current production disposition
is a safe rollback, not a founder-ready release. The current terminal outcome
is `BLOCKED — ONE HUMAN AUTHENTICATION ACTION REQUIRED` for Google sign-in to
the Cloudflare account controlling `missionmedinstitute.com`. MyKinsta is
authenticated; the exact scoped Support request is prepared but unsent pending
action-time confirmation.
