# B1-509 Test and Validation Results

## Local exact-HEAD evidence

All evidence below applies to repository HEAD
`77eabb6cf3f62b19f9b86523fd1987b1cab74eca`.

| Gate | Result |
| --- | --- |
| Unit suite | PASS, 219/219 |
| PostgreSQL integration | PASS, 12/12 |
| Acceptance contracts | PASS, 130/130 |
| Browser E2E | PASS, 59/59 |
| Conformance and accessibility | PASS, 72/72 |
| API-only package check | PASS |
| Deterministic product provenance | PASS |
| Bundle secret scan | PASS |
| `npm audit` | PASS, 0 vulnerabilities |

The unit suite, API-only package check, product-provenance check, secret scan,
and audit were rerun after production validation. The PostgreSQL, acceptance,
browser, and conformance/accessibility counts are the already-completed
exact-HEAD B1-508/B1-509 pre-activation runs; production activation changed
configuration and identities, not repository source.

One first product-provenance invocation lacked the mandatory
`STORYFORGE_EXPECTED_COMMIT` input and correctly failed its invocation contract.
The rerun supplied the full current HEAD and passed, proving the release source,
canonical hash, generated bundle, and clean repository all match.

## Synthetic provider and storage probes

### Direct private-storage probe

A generated 30-byte synthetic `audio/webm` object under a dedicated
`storyforge-rec/b1-509-synthetic/` prefix passed PUT, HEAD, GET, byte/type
verification, DELETE, and a zero-object follow-up listing.

### Direct transcription-driver probe

The exact repository `gpt-4o-transcribe` driver transcribed generated macOS
speech audio in 1588 ms. The bounded result contained both expected validation
keywords. No Founder/student audio or personally identifying information was
used.

### Live integrated recording path

The final live probe used a fresh short synthetic WAV and the real Founder
student's short-lived WordPress JWT through the public same-origin route:

| Step | Result |
| --- | --- |
| Create recording | HTTP 201 |
| Upload multipart segment | HTTP 201 |
| Poll near-live transcription | HTTP 200, `transcribed` |
| Validate two expected synthetic keywords | PASS |
| Cancel recording | HTTP 200, `cancelled` |
| Read after cancellation | HTTP 200, zero segments |
| List all R2 `storyforge-rec/` objects | 0 |

No story or permanent audio asset was created. The only retained production
evidence is content-free lifecycle/audit metadata for cancelled synthetic test
sessions.

The first diagnostic upload included an extra `mimeType` form field. The strict
WordPress gateway correctly rejected it as `invalid_multipart`; the diagnostic
session was cancelled. The corrected browser-contract shape contains only
`seq`, `durationMs`, and `segment`, and passed end to end. This was a probe-shape
error, not a production defect.

## Live security and runtime checks

- Public health endpoint: HTTP 200.
- Public config: audio available; development auth false; identity mode
  `missionmed-signed-jwt`; base path `/storyforge/`.
- All AI flags: false.
- Anonymous protected API access: HTTP 401.
- Founder student: eligible and voice-capable.
- Founder administrator: eligible admin but not voice-capable.
- Feature scope: one allowlisted Founder student, zero cohorts.
- Reconciliation: off.
- R2 transient object count after cleanup: zero.
- HTTP 5xx in the 30-minute validation window: zero.
- Content-bearing application error categories in E13: zero.

Railway labeled ten startup-warning lines at error level. They are one npm
production-config warning plus a multi-line AWS SDK notice that Node 22 will be
required for SDK versions published after early January 2027. They are not
request failures; the 5xx count is zero. A Node 22 runtime upgrade should be
scheduled before that future SDK support boundary.

## Human validation boundary

The automated/synthetic production path is validated. A Founder microphone
canary on each supported physical browser/device remains the last prudent human
UX check before any non-Founder exposure. RP-7 human accent/medical corpus and
the final Founder-approved student copy remain gates to broad student rollout,
not to the current exact-Founder activation.
