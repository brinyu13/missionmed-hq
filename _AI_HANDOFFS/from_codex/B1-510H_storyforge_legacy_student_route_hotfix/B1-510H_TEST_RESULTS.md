# B1-510H Test Results

## Final passing results

- focused identity synchronization and routing: 7/7;
- complete unit suite: 231/231;
- browser E2E: 59/59;
- conformance/accessibility: 72/72;
- PostgreSQL runtime/RLS: 12/12;
- PostgreSQL acceptance: 130/130;
- PostgreSQL authorization matrix: PASS;
- B1-503 PostgreSQL conformance matrix: PASS;
- WordPress export/apply/verify and repeat apply: PASS;
- live 439-account token/mapping verification: PASS;
- PHP and JavaScript syntax: PASS;
- API-only build: PASS;
- deterministic release build from commit
  `d00c58606c30054fec85fb4ea49ae944096fca39`: PASS;
- local release candidate: `v-21d896bc96f9c454` (not deployed);
- secret scan: PASS;
- npm audit: zero vulnerabilities;
- scoped StoryForge Matrix runtime guard: PASS;
- Critical Systems enforced gate: 112 PASS, 2 expected WARN, 0 FAIL;
- `git diff --check`: PASS.

The final unit rerun after operator hardening completed 231/231 with zero skips
and zero failures.

## Resolved issues

1. The first disposable PostgreSQL restore lacked roles referenced by the dump.
   A fresh isolated PostgreSQL 18 cluster with those local roles restored and
   validated successfully; production was never affected.
2. A deliberate second PostgreSQL apply exposed a retry-time duplicate-key
   path. The operator implementation was hardened to conflict-free insertion
   followed by exact identity verification. The repeated run passed with zero
   duplicate or changed mappings.
3. The old versioned adapter remained a Cloudflare hit. The SSO plugin-only
   version moved from `0.1.0` to `0.1.1`; the new exact asset URL served the
   deployed bytes. No broad cache purge was used.

## Truthful unavailable boundary

The Docker-backed WordPress integration runner was not reported as passing;
local container-runtime troubleshooting remained prohibited. Equivalent
non-container focused tests, live WP-CLI verification, live token/API checks,
and authenticated browser routing checks passed.

The all-assets Matrix guard showed unrelated pre-existing drift in a separate
local Matrix export. The scoped protected StoryForge JS/CSS guard passed with
local, approved, origin, and public hashes equal. B1-510H did not edit the
unrelated export.
