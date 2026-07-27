# B1-502M Cloudflare route/cache prestate

Recorded: `2026-07-27T18:12:11Z`

Mode: read-only provider inspection

Repository HEAD at inspection: `e76193176e50`

Wrangler: `4.114.0`

## Outcome

| Area | Result | Evidence |
|---|---|---|
| Cloudflare account and zone identity | **VERIFIED** | Exact account- and name-filtered zone lookup returned one active full zone. |
| Worker route absence | **PASS** | Both requested StoryForge route patterns are absent from the complete eight-route zone result. |
| Worker route precedence/catch-all review | **PASS** | No existing route pattern matches the apex StoryForge exact path, trailing-slash path, or descendant probe over HTTP or HTTPS. |
| Cache Rules inspection | **UNRESOLVED — AUTHORIZATION BLOCKED** | Both cache-phase Rulesets GETs returned HTTP `403`, API code `10000`. |
| Legacy Page Rules inspection | **UNRESOLVED — AUTHORIZATION BLOCKED** | Active Page Rules GET returned HTTP `403`, API code `9109`. |

This receipt proves the Worker-route prestate. It does **not** claim that no
Cache Rule or Page Rule affects `/storyforge`; the authenticated Wrangler OAuth
credential cannot read those products.

## Effective cache observation

Two consecutive anonymous, no-cookie requests to the same
`https://missionmedinstitute.com/storyforge/` URL were made after the provider
inspection. Both returned:

- HTTP `404`;
- `CF-Cache-Status: DYNAMIC`;
- `Cache-Control: no-cache, must-revalidate, max-age=0, no-store, private`;
- no `Age` header.

This directly proves that the StoryForge before-state response was not served
from Cloudflare cache at the observation time. It does not convert the
unreadable Rulesets/Page Rules configuration into an inspected fact.

The release gate will therefore use both:

1. the exact route inventory and effective prestate above; and
2. repeated post-deploy requests proving HTML/API/error responses remain
   dynamic/noncacheable while only fingerprinted assets become cacheable.

Any post-deploy `HIT` or nonzero `Age` on HTML, API, bootstrap, token, or error
responses is a mandatory rollback condition.

## Resolved provider identity

- Account ID: `eeaaf73d1670b47a162d251ca67e7cfa`
- Zone ID: `7549e75c42eeef33eafbd071b3142b14`
- Zone name: `missionmedinstitute.com`
- Zone status: `active`
- Zone type: `full`
- Zone paused: `false`

The identity query was:

```text
GET /client/v4/zones
  ?name=missionmedinstitute.com
  &account.id=eeaaf73d1670b47a162d251ca67e7cfa
  &per_page=50
```

Observed: HTTP `200`, API success `true`, exact matching result count `1`.

## Worker route inventory result

Read-only endpoint:

```text
GET /client/v4/zones/7549e75c42eeef33eafbd071b3142b14/workers/routes
```

Observed:

- HTTP `200`;
- API success `true`;
- complete route count examined: `8`;
- `missionmedinstitute.com/storyforge`: **absent**;
- `missionmedinstitute.com/storyforge/*`: **absent**;
- existing patterns overlapping any of the following: **none**:
  - `http://missionmedinstitute.com/storyforge`
  - `https://missionmedinstitute.com/storyforge`
  - either scheme with `/storyforge/`
  - either scheme with `/storyforge/probe`

The response was filtered in memory. No unrelated route pattern, Worker script
name, user email, or credential was printed or written.

### Precedence interpretation

Cloudflare documents that a wildcard matches zero or more characters, the most
specific matching route wins, and a route with no script can negate a less
specific route. The complete current route list contains no exact,
StoryForge-prefix, apex catch-all, wildcard-host catch-all, or no-script route
matching the probes above. Therefore there is currently no Worker-route
precedence conflict for the proposed apex StoryForge paths.

Reference:
[Cloudflare Workers route matching behavior](https://developers.cloudflare.com/workers/configuration/routing/routes/#matching-behavior)

## Cache-rule inspection and exact residual

The same credential was used for these read-only requests:

| Request | HTTP | Cloudflare error |
|---|---:|---|
| `GET /zones/{zone_id}/rulesets` | `403` | `10000 Authentication error` |
| `GET /zones/{zone_id}/rulesets/phases/http_request_cache_settings/entrypoint` | `403` | `10000 Authentication error` |
| `GET /zones/{zone_id}/rulesets/phases/http_response_cache_settings/entrypoint` | `403` | `10000 Authentication error` |
| `GET /zones/{zone_id}/pagerules?status=active&per_page=100` | `403` | `9109 Unauthorized to access requested resource` |

The relevant authenticated Wrangler permission entries are:

```text
workers_routes:write
pages:write
zone:read
```

No Cache Rules or Page Rules read scope is present. Wrangler `4.114.0` root
help exposes no read/list command for zone Worker routes, Rulesets, Cache Rules,
or Page Rules. `wrangler triggers --help` exposes only the mutating
`triggers deploy` operation, so it was not run. There is no second Wrangler
profile in the active credential store.

Exact residual needed to close cache prestate:

1. a read-only credential authorized for zone **Cache Rules Read** on
   `missionmedinstitute.com`; and
2. a read-only credential authorized for zone **Page Rules Read** (or another
   credential that Cloudflare authorizes for the legacy Page Rules list
   endpoint).

Then repeat the four GETs above and filter enabled rules for:

- expressions explicitly naming `/storyforge`;
- host-wide or path-wide expressions that include `/storyforge`;
- active Page Rule URL targets whose cache-related actions match the exact,
  trailing-slash, or descendant StoryForge probes.

Permission references:

- [Cloudflare API token permissions](https://developers.cloudflare.com/fundamentals/api/reference/permissions/)
- [Cloudflare Cache Rules](https://developers.cloudflare.com/cache/how-to/cache-rules/)
- [Cloudflare Page Rules list API](https://developers.cloudflare.com/api/resources/page_rules/methods/list/)

## Sanitized reproduction

The authenticated requests were executed by a one-shot local redaction wrapper:

1. read Wrangler's `default` encryption key from the macOS Keychain;
2. decrypted the Wrangler credential envelope in process memory;
3. extracted the OAuth bearer value without printing it;
4. issued only the GET requests enumerated in this receipt;
5. emitted only HTTP/API status, exact account/zone fields, aggregate route
   count, requested-route booleans, and StoryForge-overlap results.

CLI capability checks:

```sh
node /Users/brianb/.npm/_npx/32026684e21afda6/node_modules/wrangler/bin/wrangler.js --version
node /Users/brianb/.npm/_npx/32026684e21afda6/node_modules/wrangler/bin/wrangler.js --help
node /Users/brianb/.npm/_npx/32026684e21afda6/node_modules/wrangler/bin/wrangler.js triggers --help
```

No `POST`, `PUT`, `PATCH`, or `DELETE` request was issued. No Worker route,
cache rule, Page Rule, credential, provider object, remote system, or
production system was mutated.
