# B1-502M Production Test Results

Recorded: 2026-07-27

## Overall result

**NO_GO — FOUNDER ENABLEMENT AND PRODUCTION ACCEPTANCE NOT RUN**

The local release candidate is green. Feature-off production tests proved the
deployment and rollback mechanisms, but repeated production cache validation
failed at Kinsta's managed server/full-page cache. The exact route was removed
and no account was enabled.

## Local release-candidate evidence

| Gate | Result |
|---|---|
| JavaScript unit suite | **PASS — 27/27** |
| WordPress integration suite | **PASS — 7/7** |
| Browser/E2E suite | **PASS — 7/7** |
| Real PostgreSQL authorization suite | **PASS — `STORYFORGE_POSTGRES_SUITE_PASS`** |
| Runtime symlink adversarial regression | **PASS** |
| Deterministic build and exact release inventory | **PASS** |
| Exact 14-file WordPress route manifest | **PASS** |
| PHP, JavaScript, Bash, and JSON syntax | **PASS** |
| Bundle secret scan | **PASS** |
| Dependency audit | **PASS — 0 vulnerabilities** |
| `git diff --check` at candidate gate | **PASS** |
| Critical-systems gate (`--skip-network --enforce`) at handoff closeout | **PASS** |
| Canonical V5 authority hash | **PASS** |
| Local rollback behavior | **PASS** |
| Local UX/accessibility/domain reviews | **PASS after bounded repairs** |

These results establish candidate quality only. They do not prove an
authenticated production Matrix journey.

The closeout critical-systems run reported only its expected informational
warnings: network checks were intentionally skipped, browser journeys remain
external to that report-only script, and the Kinsta gateway has no process
start command. All protected-path, runtime, import, syntax, and local
asset/hash checks passed.

## Isolated Railway production checks

| Check | Result |
|---|---|
| PostgreSQL migrations | **PASS — 3/3 exact checksums** |
| RLS inventory | **PASS — 15/15 StoryForge tables enabled** |
| Least-privilege application login | **PASS** |
| Initial data counts | **PASS — all zero** |
| API provider deployment | **PASS — `fb43a551-04c8-41f7-a6e6-fb16aae3894e`** |
| Sanitized health | **PASS** |
| Direct Railway UI root | **PASS — 404 fail-closed** |
| Unapproved origin | **PASS — 403** |
| Unauthenticated application session | **PASS — 401** |
| Development, fake AI, and fake audio paths | **PASS — disabled** |

## WordPress feature-off checks

| Check | Result |
|---|---|
| Isolated SSO plugin installed and source exact | **PASS** |
| Feature flag false | **PASS** |
| Founder allowlist empty | **PASS** |
| Role overrides empty | **PASS** |
| Seven administrators denied | **PASS** |
| Mentor access disabled | **PASS** |
| Token signer remains protected | **PASS** |
| Protected Matrix and legacy StoryForge hashes unchanged | **PASS** |

## Kinsta feature-off retry results

Exact candidate:
`4bd956b6ea222d20428c41415236a73b93576447`.

| Check | Pass one | Passes two and three | Disposition |
|---|---|---|---|
| Exact route/bundle/topology | PASS | PASS | PASS |
| Extensionless asset aliases | PASS | PASS | PASS |
| Raw asset path denial | PASS | PASS | PASS |
| Nested bundle direct-execution denial | PASS | PASS | PASS |
| Feature-off protected API denial | PASS | PASS | PASS |
| Protected hashes and shared-site health | PASS | PASS | PASS |
| Cloudflare cache state | `DYNAMIC` | `DYNAMIC` | PASS |
| Kinsta cache state | `MISS` | `HIT` | **FAIL** |
| Effective response policy | Exact application policy | Rewritten to `public, max-age=0, s-maxage=86400` | **FAIL** |

The repeated cache result is a hard release blocker. It proves that the source
repair prevents Cloudflare storage but cannot itself bypass Kinsta's managed
server/full-page cache.

## Rollback verification

At `2026-07-27T21:45:23Z`, the Supervisor physically removed the exact route
and runtime `current` pointer. Only separate Kinsta site-cache and CDN-cache
purges were used; both returned HTTP 200.

After provider propagation:

| Check | Result |
|---|---|
| `/storyforge` | **PASS — prior WordPress 404 restored** |
| `/storyforge/` | **PASS — prior WordPress 404 restored** |
| `/storyforge/healthz` | **PASS — prior WordPress 404 restored** |
| Active StoryForge MU route | **PASS — absent** |
| Active runtime pointer | **PASS — absent** |
| Feature flag | **PASS — false** |
| Founder allowlist and overrides | **PASS — empty** |
| Founder/general/mentor access | **PASS — none enabled** |
| Exact release directories | **PASS — dormant and byte-identical** |
| Protected Matrix/legacy hashes | **PASS — exact** |

Sanitized read-only verification at `2026-07-27T22:04:58Z` reconfirmed the
same route/pointer/feature-off state. It expanded the anonymous route sample to
`/storyforge/config` and `/storyforge/library`; all five sampled paths returned
404 with Cloudflare `DYNAMIC`, private/no-store policy, and Kinsta `EXPIRED` or
`MISS`. It also reconfirmed both isolated Railway deployments as `SUCCESS`,
the API health/404/401 boundary, three database migration rows, RLS on all 15
application tables, and zero users, assignments, stories, or audit events.
The verification made no mutation.

An additional anonymous no-cookie/no-follow GET sample at
`2026-07-27T22:21:37Z` reconfirmed all five paths as 404 with Cloudflare
`DYNAMIC`, Kinsta `EXPIRED`, and the private/no-store policy. This was read-only
and made no remote mutation.

Earlier rollback after the first Kinsta attempt used the broader
`purge_complete_caches(true)` helper. That scope defect is retained in the
deployment and rollback evidence; subsequent attempts used only the approved
site-cache and CDN-cache methods.

## Production acceptance coverage still missing

The following required tests have not been performed because the gateway is
inactive and the exact founder profile has not been bound:

- real Matrix launch into StoryForge with no second login;
- exact founder-only visibility and entitlement;
- dark V5 production UI and bounded startup resolution;
- production deep-link refresh;
- Back to Matrix session continuity;
- private story creation and direct-ID privacy;
- zero-mentor submission denial through the real founder session;
- second-administrator and other-cohort denial after feature enablement;
- logout and revocation behavior against the enabled production route;
- authenticated production accessibility and responsive journey;
- founder acceptance script.

Therefore no evidence supports `DEPLOYED — FOUNDER TEST READY` or
`DEPLOYED — CONTROLLED FOUNDER RELEASE COMPLETE`.

The current terminal outcome is
`BLOCKED — ONE HUMAN AUTHENTICATION ACTION REQUIRED`; the production system
itself remains in the safely rolled-back route-absent state.

## Retest entry condition

After Kinsta confirms the exact `/storyforge` server/full-page and
corresponding edge-cache exclusion, reinstall only exact pushed commit
`4bd956b6ea222d20428c41415236a73b93576447` feature-off and rerun the complete
three-pass cache, route, authorization, protected-hash, shared-health, and
rollback suite before any founder binding or enablement.
