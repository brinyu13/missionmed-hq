# B1-501 Validation Evidence

Status: **ALL SEVEN LOCAL GATES PASS.**

All testing used local services. The mounted integration browser suite used `http://127.0.0.1:4179/storyforge/`, never `file://`.

## Gate results

| Gate | Result | Evidence |
|---|---|---|
| 1. WP SSO round-trip | **PASS** | Anonymous mounted deep link redirected to real disposable WP login; login returned to the app; nonce exchange produced a valid JWT; `/api/session` completed a real PostgreSQL-backed authorized query; destroying the live WP session locked the already-open app. |
| 2. Revocation within one TTL | **PASS** | Local TTL was 5 seconds. WP eligibility was revoked, a focus refresh ran, the exchange failed, and the open app rendered `Your 360 access has changed.` with the WP entitlement message. |
| 3. Deep-link preservation | **PASS** | `/storyforge/library?filter=mine&sort=updated` returned after login with the exact path and query. |
| 4. Route precedence | **PASS** | `/storyforge/library` returned StoryForge with `x-storyforge-local-edge: storyforge`; `/member-dashboard/` returned WordPress with `x-storyforge-local-edge: wordpress`; the permalink probe returned HTTP 200. |
| 5. Security and cache controls | **PASS** | Missing nonce returned 403; tampered JWT returned 401; foreign Origin returned 403 `origin_not_allowed`; bundle secret scan returned `{"ok":true,"scanned":"dist"}`; HTML was no-store and hashed asset immutable. |
| 6. Unmodified B1-500 regressions | **PASS** | Unit 7/7; PostgreSQL authorization/lifecycle suite ended `STORYFORGE_POSTGRES_SUITE_PASS`; unchanged browser suite 3/3 including axe and mobile. Existing screenshots were protected by running from an isolated output directory. |
| 7. Assignment reconciliation and handoffs | **PASS locally** | WP export count 3; database count 3; both difference lists empty; `clean: true`. This proves only the disposable fixture and does not assert production source fidelity. Required handoffs are present in this directory. |

## Primary commands

```bash
npm run test:integration --prefix storyforge-v5
npm test --prefix storyforge-v5
npm run test:postgres --prefix storyforge-v5
bash storyforge-v5/scripts/run-e2e.sh
npm audit --prefix storyforge-v5 --audit-level=high
php -l wp-content/plugins/missionmed-storyforge-sso/missionmed-storyforge-sso.php
php -l wp-content/plugins/missionmed-storyforge-sso/uninstall.php
```

Final results:

- Integration browser: `5 passed (8.3s)`
- Existing unit suite: `7 pass, 0 fail`
- PostgreSQL suite: `STORYFORGE_POSTGRES_SUITE_PASS`
- Existing unmodified browser suite: `3 passed (3.3s)`
- npm audit: `found 0 vulnerabilities`
- PHP and JavaScript syntax checks: pass
- Reconciliation: `clean: true`
- Rollback verification: all three stages pass

## Local raw receipts

These local ignored runtime receipts remain alongside this document:

- `evidence/gates-1-through-5-local-integration.log` — SHA-256 `28b6e39b2e2a13fc6800d1dee1ba9204cb22927b26a67feb3a224154384cfd1d`
- `evidence/existing-unit-suite.log` — SHA-256 `49b60d14389c1e0e868da36126c0d66a1f6fa10602a1682808be74265028ef53`
- `evidence/postgres-authorization-suite.log` — SHA-256 `7abebddd5814073938efced3f6e40847ceca52291e29534e347ea94b94f36163`
- `evidence/existing-b1-e2e-suite.log` — SHA-256 `c142729b9061739b012c3cced5ce70bf60e13fbf5375dc12eb5b013cf66a78d4`
- `evidence/gate-7-mentor-assignment-reconciliation.json` — final content reports `clean: true`
- `evidence/rollback-local-verification.txt`
- `evidence/wordpress-permalink-probe.headers`

The raw receipts are local evidence, not production observations.
