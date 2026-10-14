# MX-GX-20261013-001 RankListIQ Return state delta

- Updated UTC: `2026-10-14T20:30:35Z`
- Authority: `DR-435` at canonical OS commit `c7caa9a22d4016bd3638ea69cf56f4d18593e538`
- Outcome: `CORRECTED_CANDIDATE_READY; PRODUCTION_WITHDRAWN; STUDENT_ACCEPTANCE_OPEN`
- Current production SHA-256: `c7690c76cf89fa717ac19b82d0db409c60ab20e84b00fd906a752b1cebc05a1a`
- Current production owner/mode: `theresidencyacademy:www-data`, `0644`
- Corrected source commit: `b11d7f7bcf0a3016ec990a0682cade1cc86f1797`
- Corrected private candidate SHA-256: `af13d903134babe7246f0e0ac41edf7820ef7698611dd9690e54fb5371a45df3`

## Delta

RankListIQ now has a narrowly scoped source correction for a native left-arrow
`Return to Matrix` anchor at the existing application-chrome seam. The link
targets exactly
`https://missionmedinstitute.com/member-dashboard/#dashboard` and declares
`target="_top"`, so native pointer and keyboard activation replace the wrapper
page rather than navigating inside its iframe. The final source delta relative
to the accepted dual-mode release is limited to:

- `ranklistiq/src/dual-mode/app-mode-ui.js`
- `ranklistiq/src/dual-mode/app-mode.css`
- `ranklistiq/tests/return-to-matrix.test.mjs`

The corrected source is committed and pushed. The sealed build is retained
privately and is not live because the mandatory genuine-student acceptance
could not be completed after the previously verified student browser session
became unavailable.

## Candidate custody

- Build id: `20261014T142400Z-gb11d7f7b`
- HTML SHA-256: `af13d903134babe7246f0e0ac41edf7820ef7698611dd9690e54fb5371a45df3`
- Runtime SHA-256: `58c9f3fc9e7c90b5444ba496b9ca1e259462be261f981714d209c7c2b643c357`
- Base SHA-256: `1766f21de2bfbffe2d5e70e999757fad6be38dd572ff5081a21550b6224756ec`
- Config SHA-256: `1e7005447672cbd60728dd45e796e89bc6267bf903b19665da44d05087593ea9`
- Private reviewed artifact: `/www/theresidencyacademy_209/private/20261014T142400Z-dr435-gb11d7f7b/rank_list_engine_WORKING.reviewed.html`
- Private reviewed mode: `0600`; parent directory mode: `0700`
- Exact rollback in the same custody directory: `rank_list_engine_WORKING.pre-return.html`, SHA-256 `c7690c76cf89fa717ac19b82d0db409c60ab20e84b00fd906a752b1cebc05a1a`, mode `0600`

## Production state

The corrected candidate was atomically installed only for bounded acceptance,
then atomically withdrawn when the required student identity was unavailable.
Cache-busted public readback at closeout returned HTTP `200` and exact accepted
SHA-256 `c7690c76cf89fa717ac19b82d0db409c60ab20e84b00fd906a752b1cebc05a1a`.
The authorized temporary path is absent. Each forbidden canary remains `404`:

- `/qa-0921a/`
- `/rank-list-engine/next/`
- `/rlq-preview-0921a.php`
- `/rlq-dualmode-0921a-canary.php`

No WordPress post/template, BFF, entitlement, Supabase RankListIQ data/schema,
RLS, Edge Function, RISE, Matrix, theme, search, or sibling application was
changed. No QA `Save Progress` click or list edit occurred.

## Remaining gate

Production promotion remains open, not failed. A genuine existing entitled
student, separate from Founder/admin, must complete click and keyboard Return
activation on desktop and exact `390x844`, reach the ordinary Matrix Dashboard
with session/access intact, re-enter RankListIQ, and demonstrate unchanged
Application and Rank state without Save Progress or list mutation. Admin-only
and package-only evidence is not substituted for this gate.

The live plaintext developer-unlock credential issue remains separately scoped.
No credential was copied into the Git-safe candidate and no production
credential remediation was performed.
