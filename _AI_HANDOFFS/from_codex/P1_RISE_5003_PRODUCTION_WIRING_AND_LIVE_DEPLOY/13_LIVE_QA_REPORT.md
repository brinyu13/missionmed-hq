# 13 — QA Report

## Local Candidate

```text
DETERMINISTIC_SERVER_SECURITY_TESTS = 102/102 PASS
BROWSER_ACCEPTANCE_TESTS = 12/12 PASS
NPM_AUDIT = 0 known vulnerabilities
GIT_DIFF_CHECK = PASS
LIVE_QA_PASS = NO
```

Browser coverage includes Home, locked navigation/order, Tell Me About, four doors, list-first Find Programs, search/state filter, list/grid, routed immersive Program File, exactly six tabs, Sources/Freshness, persistent My Programs contract across reload, four-program compare cap, profile/CV/premium/RankList fail-closed states, admin preview-before-spend, Queue/Review disabled states, 390px viewport, and critical axe violations on core routes.

Screenshots:

- `artifacts/browser/home-desktop.png`
- `artifacts/browser/program-file-desktop.png`
- `artifacts/browser/find-mobile.png`

The browser fixture contains four synthetic identities under a test-only path. It is rejected by production configuration.

## Live Provider QA

Anonymous live-route inspection returns WordPress 404. Eligible student, ineligible student, admin, and authenticated Matrix smoke tests could not be performed because no live RISE route/auth contract exists. Therefore `LIVE_QA_PASS = NO`, regardless of the local passes.
