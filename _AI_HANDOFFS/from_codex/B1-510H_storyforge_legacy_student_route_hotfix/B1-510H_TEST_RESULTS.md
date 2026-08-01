# B1-510H Test Results

## Passing results

- focused routing/entitlement: 3/3;
- complete unit suite: 227/227;
- browser E2E: 59/59;
- conformance/accessibility: 72/72;
- PostgreSQL runtime/RLS: 12/12;
- acceptance: 130/130;
- PostgreSQL authorization matrix: PASS;
- B1-503 PostgreSQL conformance matrix: PASS;
- PHP syntax: PASS;
- JavaScript syntax: PASS;
- API-only build: PASS;
- release provenance at commit
  `a8a156e4b6c213bb667cc6b0959be90692e4b8b9`: PASS;
- secret scan: PASS;
- npm audit: zero vulnerabilities;
- Matrix protected guard: PASS;
- Critical Systems enforced gate: 112 PASS, 2 WARN, 0 FAIL;
- `git diff --check`: PASS.

## Corrected harness failures

1. E2E and conformance initially selected PostgreSQL 16 and failed closed
   before tests. Rerunning with `/opt/homebrew/opt/postgresql@18/bin` passed.
2. The aggregate conformance command initially omitted the mandatory explicit
   expected commit. Conformance was run directly and passed; committed-state
   provenance then passed with the exact full HEAD.
3. One provenance invocation used an incorrectly transcribed commit hash and
   failed closed. The exact `git rev-parse HEAD` value passed on the next
   invocation.

## Unavailable test

The Docker-backed WordPress integration runner was not rerun because its known
configured local container socket remains unavailable and prior steering
forbids further container-runtime troubleshooting. Equivalent focused PHP/JS
tests and live read-only WordPress/browser evidence were completed. This is
recorded as unavailable, not passing.
