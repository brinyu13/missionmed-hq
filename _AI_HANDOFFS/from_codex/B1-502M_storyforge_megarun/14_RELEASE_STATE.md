# B1-502M Release State

Recorded: 2026-07-27

## State declaration

| Field | Value |
|---|---|
| Terminal outcome | **BLOCKED — ONE HUMAN AUTHENTICATION ACTION REQUIRED** |
| Production disposition | **ROLLED BACK — SAFE PRODUCTION ROUTE ABSENCE RESTORED** |
| StoryForge V5 live inside Matrix | **No** |
| Authorized URL | `https://missionmedinstitute.com/storyforge/` |
| Last verified route behavior | Five sampled StoryForge paths returned the prior WordPress 404 at `2026-07-27T22:32:03Z`; Cloudflare `DYNAMIC`, Kinsta `HIT`, private/no-store |
| Enabled cohort | None |
| Founder bound | No |
| Mentor access | Disabled |
| General population | Disabled |
| Feature flag | False |
| Active Kinsta MU route | Absent |
| Active runtime `current` pointer | Absent |
| Founder production acceptance | Not run |
| Founder readiness | **NO_GO** |

## Revision declaration

- Canonical application branch:
  `b1-502-storyforge-production-deployment`.
- Exact candidate for the next feature-off retry:
  `4bd956b6ea222d20428c41415236a73b93576447`.
- Candidate route SHA-256:
  `23ca6d28268a780c46c27083a726dab18c3e6125a46a6fda600fd9c03eee2d88`.
- Candidate generated release:
  `v-963b8f5eb4d8c727`.
- Candidate bundle SHA-256:
  `845289a4c646b0ea496fa864186a0b9f534425ff8aad8b40e0e3993ebf05a3f1`.
- Terminal handoff checkpoint:
  `e531d565fab9ed1c85b780d578a408112fe8cb41`.
- MissionMed OS authority:
  `d49fffbd1cd92854bd1390fb5f4dbf68be95796d`.

There is no active Kinsta gateway revision because the route and pointer were
physically removed. Dormant exact release directories are evidence and
rollback artifacts, not active deployment.

## Provider state

### Kinsta and WordPress

- `missionmed-storyforge-sso`: installed and active, feature-off.
- Allowed founder IDs: zero.
- Role overrides: zero.
- StoryForge MU route: absent.
- Runtime pointer: absent.
- Exact `62ed421...` and `4bd956...` release directories: dormant.
- Latest read-only route sample: Cloudflare `DYNAMIC`, private/no-store policy,
  and Kinsta `HIT` on the safely absent route's WordPress 404. This is not V5
  traffic, but it independently confirms that the managed-cache exclusion is
  required before retry.
- Required next provider change: Kinsta Support must bypass server/full-page
  and corresponding edge caching for paths beginning exactly with
  `/storyforge`.

### Railway

- Project: `875e7c17-d06f-4301-a4bb-e61016f153cf`.
- API deployment: `fb43a551-04c8-41f7-a6e6-fb16aae3894e`.
- API domain:
  `https://storyforge-v5-api-production.up.railway.app`.
- Database migrations: 3/3.
- RLS: 15/15 StoryForge tables.
- Production application data: zero users and zero content/assignments.
- Access: isolated and inaccessible without valid application identity.

### Cloudflare

- Worker: `missionmed-storyforge-v5`.
- Exact route ID: `37a1ba80b39043a08cc7b482cfa7e3c6`.
- Wildcard route ID: `fcb362908f22443187a5b0541bf61a75`.
- Effective route ownership: none; these records are inert because the apex is
  DNS-only to Kinsta.
- State: narrow authenticated cleanup pending.

## Validation state

Green:

- unit 27/27;
- WordPress integration 7/7;
- browser/E2E 7/7;
- PostgreSQL authorization
  `STORYFORGE_POSTGRES_SUITE_PASS`;
- deterministic build, manifest, syntax, secret scan, and dependency audit;
- local rollback;
- live feature-off route/topology/alias/security checks;
- Cloudflare `DYNAMIC` after the exact source repair;
- physical Kinsta rollback and restored route absence;
- protected Matrix and legacy asset integrity.

Not green:

- repeated Kinsta server/full-page cache policy;
- founder enablement;
- authenticated production Matrix journey;
- production founder acceptance;
- fresh exact founder profile binding;
- same-UID authority gate;
- authenticated Cloudflare cleanup.

## Restore state

Verified restore/prestate identifiers:

- `B1-502M-RP-KINSTA-PRE-20260727T174625Z`;
- `B1-502M-RP-DB-PRE-20260727T173144Z`;
- `B1-502M-RP-DB-SCHEMA-20260727T190219Z`;
- `B1-502M-RP-CF-ABSENT-20260727T174734Z`;
- `B1-502M-RP-RWY-ABSENT-20260727T171118Z`.

Normal rollback has already restored StoryForge route absence. The isolated
Railway API/database and feature-off SSO plugin remain installed but grant no
user access.

## Required continuation

1. Obtain the exact Kinsta cache exclusion recorded in
   `16_UNRESOLVED_EXTERNAL_ACTION.md`.
2. Reinstall exact commit `4bd956...` feature-off and repeat all production
   gates.
3. Close the same-UID authority gate.
4. Bind exactly one founder profile through a fresh authenticated WordPress
   session.
5. Remove only the inert Cloudflare StoryForge Worker and routes.
6. Enable only the founder account.
7. Run the full founder test script and every negative-account, privacy,
   logout/revocation, cache, shared-health, UX, and accessibility check.
8. Immediately roll back on any mandatory trigger.

Until those steps pass, the release must be represented only as safely rolled
back and externally gated—not live, deployed through Matrix, or founder-ready.
The one human action requested at this checkpoint is Google sign-in for the
Cloudflare account controlling `missionmedinstitute.com`, as recorded in
`16_UNRESOLVED_EXTERNAL_ACTION.md`. MyKinsta is authenticated and the scoped
Support request is prepared but remains unsent pending action-time
confirmation.
