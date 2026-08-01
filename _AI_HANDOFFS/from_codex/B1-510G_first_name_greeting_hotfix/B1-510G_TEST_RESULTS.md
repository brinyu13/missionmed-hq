# B1-510G Test Results

## Passing gates

| Gate | Result |
| --- | --- |
| Focused greeting/identity/routes/client auth | 23/23 PASS |
| Complete unit suite | 224/224 PASS |
| PostgreSQL 18 SQL authorization/conformance sentinels | PASS |
| PostgreSQL runtime/RLS Node suite | 12/12 PASS |
| B1-507 acceptance suite | 130/130 PASS |
| Browser E2E | 59/59 PASS |
| Product conformance/accessibility | 72/72 PASS |
| API-only build | PASS |
| Deterministic release provenance | PASS |
| WordPress route manifest check | PASS |
| Bundle secret scan | PASS |
| `npm audit --audit-level=high` | 0 vulnerabilities |
| PHP and JavaScript syntax checks | PASS |
| `git diff --check` | PASS |

Canonical authority passed at SHA-256
`3ac2871ff286552abe89a785ff43967df3315922e3718f67a136b83db1ba8db1`.

## Focused behavioral coverage

- `Brian`, `Afthab`, and `Dr` are preserved exactly from `first_name`.
- A multi-token stored first name is not split or reinterpreted.
- Whitespace-only, absent, and non-string first-name claims fail over safely.
- Display-name first-token fallback works.
- Signed username final fallback works.
- Email is never consulted.
- The existing morning/afternoon/evening branch is unchanged.
- The existing `esc(firstName())` rendering sink is unchanged.
- A stale StoryForge database first name cannot override signed WordPress core
  first name.
- Existing role, eligibility, capability, and administrator routes remain
  unchanged. True StoryForge administrators have no student homepage; the
  administrator smoke therefore validates session transport and the unchanged
  admin surfaces rather than inventing a greeting route.

## External-only integration stop

The committed-candidate integration runner completed deterministic release
generation, canonical validation, provenance, secret scan, and PostgreSQL setup,
then stopped before WordPress tests because the configured OrbStack Docker API
socket does not exist:

`/Users/brianb/.orbstack/run/docker.sock`

Per the standing steer, no Docker Desktop, OrbStack, context, socket, or local
container troubleshooting was performed. This does not invalidate the passing
unit, PostgreSQL, browser, conformance, or deterministic release gates, but the
real local WordPress bridge test remains unexecuted in this environment.
