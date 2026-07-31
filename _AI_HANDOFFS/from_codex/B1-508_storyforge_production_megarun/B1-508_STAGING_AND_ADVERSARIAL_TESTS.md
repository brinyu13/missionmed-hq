# B1-508 Staging and Adversarial Tests

## Validation strategy

No new long-lived staging environment was created. The candidate was tested in
the existing isolated local PostgreSQL 18/browser harnesses, deployed behind
the drained Founder-only gate, and then exercised as a one-account production
canary. This avoided creating an ungoverned production-like environment.

## Complete automated results

| Suite | Result |
|---|---|
| Unit | 219/219 |
| Existing PostgreSQL | 12/12 |
| Binding PostgreSQL/contract | 130/130 |
| Acceptance mapping | 163/163, zero authority skips |
| Browser E2E | 59/59 |
| Product conformance/accessibility | 72/72 |
| Deterministic release | PASS, unchanged `v-a9a076957973d7d4` |
| API-only build | PASS |
| WordPress release-manifest check | PASS |
| Secret scan | clean |
| npm audit | 0 vulnerabilities |
| Critical Systems | 112 PASS, 0 FAIL, 2 expected WARN |
| `git diff --check` | PASS |

The two Critical Systems warnings are report-only limitations: Kinsta has no
process start command, and browser journeys require a browser harness. Both
were separately exercised through provider-console/browser evidence.

The final product-provenance audit initially omitted the required commit pin
from the second npm command in a chained shell expression. The unpinned command
failed closed before verification. It was rerun with the exact HEAD exported
for the command chain and passed; no release artifact changed.

## Security-negative coverage

- Anonymous API access: 401.
- Railway root: 404.
- Bad origin: 403 `origin_not_allowed`.
- Authenticated recording creation while voice disabled: 403
  `voice_disabled`.
- Direct-ID student isolation and role boundaries: PostgreSQL suite PASS.
- No service-role, provider, R2, token, or transcript leakage in built assets.
- No public storage was configured.
- No client role toggle exists.
- No P0/P1 remains.

## Browser/product evidence

- Chrome authenticated live Founder smoke: PASS.
- Canonical desktop/mobile/tablet/narrow product conformance: PASS through
  Playwright.
- Serious/critical accessibility findings: none.
- RP-8 Chrome and Safari playback were already Founder-approved and were not
  rerun.
- Edge and physical mobile production voice remain outside this text slice.
