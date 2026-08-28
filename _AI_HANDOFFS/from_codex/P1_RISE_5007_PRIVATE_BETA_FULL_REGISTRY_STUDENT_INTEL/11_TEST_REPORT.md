# Test Report

```text
npm run build = PASS
npm test = 126/126 PASS
npm run test:browser = 14/14 PASS
node --test missionmed-hq/tests/rise-auth.test.mjs = 1/1 PASS
php -l missionmed-rise-sso.php = PASS
node --check rise/server.mjs = PASS
node --check rise/adapters/postgres-runtime.mjs = PASS
git diff --check = PASS
physical PostgreSQL 005+006 + hostile RLS = PASS
006 down/data preservation = PASS (1 submission, 1 private identity retained)
```

Browser coverage includes first-use beta notice, persistent badge, Home, Tell Me About, four feature doors, list-first Find Programs, filters, list/grid, Program File overlay, all six tabs, Sources & Freshness, coverage labels, Student Intel submit/moderate/audit seams, My Programs persistence, Compare, profile/CV/RankList fail-closed behavior, admin preview-before-spend, narrow viewport, and critical accessibility scan.

Demo-fact scan confirms known representative medical facts are absent from the generated runtime data/bundle. Dormant presentation branches inherited from the locked shell cannot activate because every runtime program and profile has `demo:false`; unit and browser tests confirm no representative names/facts render.

Screenshots and Playwright report artifacts are under `artifacts/browser/` and `artifacts/playwright-report/`.

