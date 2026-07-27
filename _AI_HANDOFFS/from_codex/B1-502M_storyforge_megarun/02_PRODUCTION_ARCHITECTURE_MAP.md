# B1-502M Production Architecture Map

Recorded: 2026-07-27

## Canonical request flow

1. The founder signs into the existing MissionMed WordPress/Matrix session.
2. The protected Matrix page remains owned by the active
   `missionmed-hub` plugin.
3. The isolated `missionmed-storyforge-sso` adapter intercepts only the
   eligible founder's StoryForge control or `#storyforge` deep link.
4. The browser opens the same-origin URL
   `https://missionmedinstitute.com/storyforge/`.
5. An isolated Kinsta must-use plugin owns only the exact `/storyforge` and
   `/storyforge/*` route patterns.
6. The gateway serves the exact hash-pinned static V5 release from a
   versioned directory outside the public document root and proxies
   `/storyforge/api/*` and `/storyforge/healthz` to an isolated Railway
   origin.
7. The browser uses the existing WordPress session only against the
   same-origin WordPress bootstrap and token endpoints.
8. The WordPress seam issues a short-lived signed token only for the exact
   allowlisted founder account.
9. The MU gateway strips WordPress cookies and forwards only the permitted
   API headers to Railway.
10. The Railway Node service validates the signed token and executes all
    database work through the least-privilege `storyforge_app` login and
    transaction-local `authenticated` policy role.

## Ownership

| Boundary | Owner | B1-502M target |
|---|---|---|
| Matrix and legacy StoryForge | Protected Kinsta `missionmed-hub` | Inspected and hash-verified; **DO NOT TOUCH** |
| WordPress SSO/entitlement seam | Isolated Kinsta plugin | `wp-content/plugins/missionmed-storyforge-sso/` |
| Same-origin static/API gateway | Isolated Kinsta MU plugin | `storyforge-v5/infra/wordpress/missionmed-storyforge-route.php` deployed as `public/wp-content/mu-plugins/missionmed-storyforge-route.php` |
| Static release | Private Kinsta runtime | `private/b1-502m/runtime/storyforge-v5/releases/<release>/` through atomic `current` pointer |
| Application origin | Railway | project `875e7c17-d06f-4301-a4bb-e61016f153cf`, service `dab015bf-15ef-4698-9f16-cbf8cf23de7a` |
| PostgreSQL | Railway | service `a4a66362-c3ba-475a-ae21-2aa46624bafe` |
| Release authority | MissionMed OS DR-011 | Founder-only, feature-off first |

The Railway upload root is exactly `storyforge-v5/`, using
`storyforge-v5/railway.json`. A repository-root Railway upload is prohibited
because the repository root contains the unrelated MissionMed HQ runtime.

## Isolation properties

- No protected `missionmed-hub` file is changed.
- The legacy Matrix route
  `https://missionmedinstitute.com/member-dashboard/#storyforge` and its V2
  assets remain the fallback until founder acceptance.
- Static release bytes have no alternate public `wp-content` URL.
- The Railway origin is API-only outside local development.
- The StoryForge database is isolated from all existing MissionMed Supabase
  projects and the existing HQ Railway service.
- The initial database contains one founder student profile only, zero mentor
  assignments, and no demo or fixture data.
- Mentor access remains disabled.
- AI and audio capabilities remain disabled/unconfigured for the founder
  launch.
- The two initially configured Cloudflare Worker routes are not traffic
  authoritative because the apex reaches Kinsta through a DNS-only record.
  They remain decommission-pending until the Kinsta gateway passes live
  feature-off checks, after which the exact bindings and isolated Worker are
  removed to prevent future split-brain ownership.

## Exact public surface

- `GET /storyforge` — permanent canonical redirect to `/storyforge/`;
- `GET /storyforge/` and client deep links — V5 application shell;
- `GET /storyforge/assets/<fingerprinted-file>` — immutable static assets;
- `/storyforge/api/*` — private, noncacheable API proxy;
- `GET /storyforge/healthz` — redacted service health;
- all other paths — existing WordPress/Matrix ownership.
