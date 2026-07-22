# 03 MegaRun 006-A Security Seal

RESULT: `LEGACY_OPERATIONAL_BOUNDARIES_SEALED`

## Sealed surfaces

- `missionmed-hq/routes/mmc-coaching-pipeline.mjs` is now a small compatibility module. It imports no filesystem, provider, Webex, worker, persistence, or analysis adapter. Auth is required; mutation requests cross CSRF first; historical paths return `410 mmc_legacy_pipeline_sealed`; exact `/api/mmc/v2` paths delegate to the gated gateway.
- `/api/mmc/persistence` preserves authenticated v1 read-adapter behavior only. Mutation methods pass auth/CSRF and return `410` rather than performing whole-state writes.
- The shared server's low-level legacy `insertMmcRow` and `updateMmcRow` helpers now unconditionally throw the sealed-writer error. Even an internal caller that bypassed the HTTP compatibility branch cannot reach a legacy Supabase mutation path.
- `/mmc-private/*` no longer serves the inline-handler v1 HTML at runtime. Before any private/API/static route decision, the shared server performs one strict pathname decode and rejects malformed escapes, NUL, backslash, and `.`/`..` segments with `400`; encoded separators or traversal cannot skip the private-route seal and fall through to public static serving. After route-specific authentication the private family returns `410 mmc_historical_surface_sealed` with `default-src 'none'`, no-store, frame denial, no-referrer, no-sniff, same-origin resource policy, restrictive permissions policy, and no-index headers.
- Historical static UI files remain unchanged as product archaeology except for truthful sealed/read-only labels and removal of v1 POST behavior.

## v2 gateway controls

- Default-off gateway flag is evaluated before tenant/environment request parsing.
- Exact approved HTTPS origin and fetch-metadata policy.
- Unconditional mutation CSRF.
- Strict UTF-8 decoding, `application/json`, byte limits, plain-object schemas, and unknown-field rejection.
- One shared strict RFC 3339 parser for state, command, asset-authority, and publication contracts; it rejects JavaScript `Date` rollover/impossible dates and offsets beyond `14:00`.
- One shared RFC 9562 UUID parser across route/command/job: v9 fails closed, while a valid uppercase v7 is accepted and normalized to canonical lowercase before semantic binding.
- Exact typed security/JSON values: principal IDs, worker queues, and CSRF session/header tokens must be strings; numeric IDs, string-encoded lease integers, and string-encoded AI confidence cannot cross validation by coercion.
- Route-specific private authorization and derived principal ceilings.
- Tenant/environment/subject/assignment scope cannot be rebound by request data.
- Strict response security headers and bounded/redacted public errors.
- No LIVE in-memory command or cutover authority.
- No service-role key in browser/runtime code.
- Only local `task.upsert` has a built-in command handler. Session, review, identity, publication, job, and student-response commands fail with `501` until an owning-kernel adapter is explicitly injected; feature flags alone cannot enable synthetic domain writes.

## Credential and path controls

Publication output rejects credential-shaped material, bearer/JWT/key patterns, HTML, URLs, and arbitrary path/pointer fields. The asset broker exposes opaque handles only. Webex errors are reduced to safe public codes and do not include tokens, response bodies, query secrets, local roots, or absolute paths. Secret/path-shaped object fields are redacted by the shared MMC error utility.

## Principal controls

`deriveMmcPrincipal` binds source and configured principal ID, tenant, environment, role, subject, assignment, workload, and signed queue. Conflicts fail closed. Unknown capabilities and above-role-ceiling grants fail closed. Worker analysis-result and asset-processing authorities are exact workload capabilities, distinct from mentor/admin job-enqueue authority. The shared WordPress bridge maps only genuine string administrator roles or `manage_options` to CAM v2 admin; non-string role values are ignored rather than coerced with `toString()`, operator roles remain operator, and arbitrary private-route allowlist roles default to mentor.

## Validation evidence

- Route security: default off, exact origin, CSRF, malformed UTF-8, bounded JSON, private auth, assignment fail-closed, LIVE in-memory denial.
- Legacy boundary seal: no operational legacy dependency calls.
- Persistence integration: authenticated read adapter preserved; HTTP and low-level insert/update mutation paths both sealed.
- Private mount: historical HTML not served; strict JSON CSP enforced; canonical-path unit cases plus an independent 12,288-case encoded-path fuzz found zero private-path bypasses.
- Webex policy/route seal: dedicated configuration and sealed compatibility route.
- Principal derivation: exact scope, role ceilings, queue binding, worker analysis/asset separation, and shared-server operator non-promotion.
- Critical-systems gate: exit 0; expected protected-file warning only.

Independent post-fix verification passed 19/19 scoped validators. No production mutation or deployment occurred.
