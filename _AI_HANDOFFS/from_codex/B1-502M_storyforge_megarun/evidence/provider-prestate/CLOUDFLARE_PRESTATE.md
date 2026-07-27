# Cloudflare premutation receipt

Observed: 2026-07-27T18:00:22Z

Authenticated CLI: Wrangler `4.114.0`

Target:

- account ID: `eeaaf73d1670b47a162d251ca67e7cfa`
- zone ID: `7549e75c42eeef33eafbd071b3142b14`
- zone name: `missionmedinstitute.com`
- Worker: `missionmed-storyforge-v5`
- intended exact route: `missionmedinstitute.com/storyforge`
- intended wildcard route: `missionmedinstitute.com/storyforge/*`

Provider before-state:

- `wrangler deployments list --name missionmed-storyforge-v5 --json`
  exited `1`;
- sanitized error classification: Worker not found;
- `wrangler versions list --name missionmed-storyforge-v5 --json`
  exited `1`;
- sanitized error classification: Worker not found;
- deployed versions: none;
- deployments: none.

The complete eight-route zone inventory contained neither StoryForge route and
no matching exact, prefix, apex catch-all, wildcard-host catch-all, or
no-script route. Full sanitized evidence:
`CLOUDFLARE_ROUTE_CACHE_PRESTATE.md`.

Anonymous no-cookie route before-state:

| URL | Status |
|---|---|
| `https://missionmedinstitute.com/storyforge` | `404` |
| `https://missionmedinstitute.com/storyforge/` | `404` |
| `https://missionmedinstitute.com/storyforge/healthz` | `404` |

Restore/prestate ID:
`B1-502M-RP-CF-ABSENT-20260727T174734Z`

No Worker upload, version, deployment, trigger, route, DNS, Pages, cache purge,
or edge configuration mutation had occurred.

No account token, account ID, zone ID, secret, cookie, or private response is
retained in this receipt.
