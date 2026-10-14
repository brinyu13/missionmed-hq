# MX-GX-20261013-001 RankListIQ Return verification report

## Verdict

**PARTIAL — corrected package approved and rollback verified; production is on
the accepted preimage; genuine-student acceptance remains open.**

## Acceptance matrix

| Gate | Result | Evidence |
|---|---|---|
| Canonical authority | PASS | DR-435, OS commit `c7caa9a22d4016bd3638ea69cf56f4d18593e538`; OS lint, BOOT, independent review and six-hash remote readback passed before work |
| Source custody | PASS | pushed branch head `b11d7f7bcf0a3016ec990a0682cade1cc86f1797` |
| Focused tests | PASS | `30/30` |
| Deterministic package | PASS | clean reconstruction matched HTML `af13d903...` and runtime `58c9f3fc...` byte-for-byte |
| Native navigation semantics | PASS | one exact native anchor, exact Matrix URL, `target="_top"`, no click handler, idempotent lifecycle insertion |
| Protected wrapper | PASS | PHP fail-closed without WordPress; decoded HTML exactly matches `af13d903...` |
| Script/security checks | PASS | 17 executable inline scripts parse; nine seams balanced; developer-unlock values remain `null`; known plaintext absent |
| Admin functional probe | PASS, non-accepting | desktop click and Enter each replaced the outer page with exact Matrix Dashboard URL; RankListIQ reload preserved observed state |
| Exact mobile layout | PASS, static | at outer viewport `390x844`, link was visible at `(12,25)`, `119.421875 x 34`, no iframe horizontal overflow, center hit visible label |
| Genuine entitled student | UNVERIFIED | previously verified student tab was no longer available; only an administrator profile remained and was not treated as student evidence |
| Production promotion | WITHDRAWN | candidate was rolled back to accepted live SHA `c7690c76...` |
| Canary withdrawal | PASS | all four forbidden routes return `404` |
| Student data preservation | PASS within QA actions | no Save Progress click, program/factor edit, list mutation, impersonation, cookie transfer, or other-user access |

## Corrected-package evidence

The independent reviewer returned `APPROVE` for sealed-package scope. A clean
`git archive` reconstruction reproduced the HTML and protected runtime exactly.
The manifest source commit, build id, build timestamp, base/config hashes, four
sidecars, PHP behavior, decoded payload, inline JavaScript, lifecycle hooks,
responsive CSS, and null developer credentials all matched. The earlier
`3820389...` and `1d69f632...` candidates were explicitly excluded as rejected
evidence.

## Functional evidence and role boundary

An authenticated administrator profile was used only for non-data-changing
functional diagnosis. On desktop, pointer activation and keyboard Enter each
made the tab's top-level URL exactly
`https://missionmedinstitute.com/member-dashboard/#dashboard`. Re-entry and
reload preserved the observed 15-factor order/hash and seven displayed rank
programs. The profile exposed a WordPress admin toolbar, so this evidence is
not learner-persona acceptance.

At exact outer viewport `390x844`, the sitewide MissionMed desktop notice was
correctly classified as wrapper-owned, outside the RankListIQ iframe. Its close
control was session-only. After dismissal, the iframe width and scroll width
were both `390`, the Return link was visible with the measurements above, and
its hit-test center resolved to the visible `Return to Matrix` label. No global
notice/theme change was made.

The exact earlier student tab was owned by another active browser session and
later disappeared from the supported browser inventory. Native capture also
failed. No debugger bypass, cookie copying, login request, impersonation, or
admin substitution was attempted. Founder/Foreman authority permits independent
implementation verification with student acceptance explicitly left open when
that browser is unavailable.

## Rollback and current readback

The corrected candidate was atomically installed from private reviewed custody,
with exact accepted preimage preserved first. Because student acceptance could
not run, the candidate was atomically withdrawn using that preimage. Current
provider and cache-busted public hashes both equal
`c7690c76cf89fa717ac19b82d0db409c60ab20e84b00fd906a752b1cebc05a1a`;
owner/mode remain `theresidencyacademy:www-data 0644`; the temporary path is
absent; and every forbidden canary returns `404`.

At resume, no keeper process survived. Lease epochs `5941` and `5951` had
expired inactive with `released_at = null` after the interrupted closeout and
were not reused. Provider readback showed zero active RankListIQ claims and zero
active waiters before fresh evidence lease epoch `5957` was acquired.

## Data and security boundaries

No QA `Save Progress` action, program/factor edit, RankListIQ row mutation,
schema/RLS/Edge Function/BFF/entitlement/RISE/Matrix/theme/search change, or
other-user access was performed. The previously authorized Save Progress
round-trip remains the historical dual-mode acceptance and was not repeated.

The live-production plaintext developer-unlock credential issue remains a
separate security remediation. No credential appears in this report or the
Git-safe candidate, and no production credential was changed.
