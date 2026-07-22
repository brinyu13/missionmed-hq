# P1-RISE-4006 Test Report

## Verdict

**Local candidate: PASS**
**Production acceptance: NOT RUN / BLOCKED**

The isolated implementation has no known failing automated test. This does not establish staging or production readiness because every test used local code, synthetic data, disposable infrastructure, or contract fixtures.

## Automated Results

| Suite | Result | Scope |
| --- | --- | --- |
| Node core and contract tests | 89 passed, 0 failed | Auth, source rights, imports, matching truth, server, contracts, SQL structure, runtime bootstrap |
| Chromium browser tests | 34 passed, 0 failed | UI journeys, history, focus, errors, stale requests, XSS-shaped input, axe, responsive, zoom, screenshots |
| PostgreSQL behavior checks | 7 passed, 0 failed | Migrations 001-003, activation evidence, rollback, session identity, audit chain, active-only reader |
| Synthetic stress | 200/200 HTTP 200 | 6,500 synthetic programs, complete bodies consumed |
| npm audit | 0 vulnerabilities | Production and development dependency graph in `rise/` |
| JavaScript syntax | PASS | Every `.mjs` file outside generated dependencies and `dist` |
| JSON parsing | PASS | Deployment, route, package, integration, and schema contracts |
| Git whitespace check | PASS | `git diff --check` |

Total checked assertions reported by the primary automated suites: **123 passing tests**, plus seven database behavior checks.

## Browser Coverage

- Chromium via installed Google Chrome channel.
- Desktop: 1440x900 and 1024x768.
- Tablet: 768x1024.
- Mobile: 430x932 and 390x844.
- Effective desktop zoom viewports: 125 percent, 150 percent, and 200 percent.
- Reduced-motion mode enabled.
- Command, signed-out access, Explorer, exact combined designation, Profile, Compare, disabled integration states, loading, stale data, empty recovery, browser back/forward, keyboard focus, dialogs, duplicate names, Unicode, and XSS-shaped input.

The browser suite built first and served `dist`, so it exercised the production asset manifest and selected Lucide bundle rather than the development vendor fallback.

## PostgreSQL Rehearsal

PostgreSQL 16.13 was initialized in a new temporary local cluster. Migrations 001, 002, and 003 created 25 tables and seven active views. The rehearsal proved:

- activation without validation and source evidence is rejected;
- release A can be activated, B promoted, and A restored through the rollback function;
- a session cannot borrow a redemption belonging to another subject;
- the audit chain rejects a non-head predecessor;
- the reader can access active views but not base programs or quarantine;
- no shared or production database was touched.

Evidence: `artifacts/postgres-rehearsal.json` and `rise/tests/fixtures/postgres-rehearsal.sql`.

## Commands

```bash
cd /Users/brianb/MissionMed_worktrees/P1-RISE-4006-production/rise
npm test
npm run test:browser
node tests/stress-synthetic.mjs
npm audit --json
```

## Not Run

- Docker image build: Docker daemon unavailable. Base digest was resolved, but no image-build pass is claimed.
- Authenticated staging student and mentor journeys: no RISE staging service or approved accounts.
- Production user journeys and monitoring: no deployment and no Founder approval.
- Real registry import: source-authorization pins are absent.
- Real Matrix, ACTN, CAM, StoryForge, and operator persistence: owner activations are absent.
- Production database restore: no approved RISE database or backup exists.
- Shared-system mutation or deployment tests: deliberately not attempted without authority.

These are release blockers, not hidden test passes.
