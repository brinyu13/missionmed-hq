# B1-500 Test and Browser Evidence

**Evidence date:** 2026-07-26
**Final local test outcome:** `PASS`

## Commands and results

| Command | Result |
|---|---|
| `sha256sum .../storyforge-v5.html` | Pinned hash matched. |
| `python3 _SYSTEM/tools/matrix_runtime_guard.py preflight --assets all --verify-public` | Live hashes matched; protected source absent; guard blocked edits. |
| `npm test` | 7 passed, 0 failed. |
| `bash scripts/run-postgres-tests.sh` | 29 named assertions passed; `STORYFORGE_POSTGRES_SUITE_PASS`. |
| `bash scripts/run-e2e.sh` | 3 passed, 0 failed in headless Google Chrome. |
| `npm audit --audit-level=high` | 0 vulnerabilities. |
| `node --check` on server/client/test modules | PASS. |
| `git diff --check` | PASS. |

The harmless first curl line in the E2E output is the readiness loop polling before the server binds; the subsequent readiness check and suite passed.

## Chrome coverage

- raw API privacy before and after submission;
- assigned vs. unassigned vs. admin direct-ID behavior;
- truthful closed AI and audio API behavior;
- private capture;
- student self score;
- submit;
- mentor open/review/request-revision;
- student notification/deep link/revise/resubmit;
- second mentor open/review/approve;
- immutable original/current comparison;
- two mentor names;
- desktop and mobile rendering;
- no serious/critical axe issues on Student Home.

## Visual inspection

The captured Student Home, mobile Student Home, and approved Mentor Workspace were opened and visually inspected in this session. The rendered system uses the canonical V5 parchment/wine/coral language, serif hierarchy, rail/mobile navigation, status chips, stoplight score dots, original/current separation, and explicit gated states.

The separate in-app browser discovery returned no browsers, so no result is attributed to that surface. The browser claims above come from the successful installed Google Chrome Playwright run and inspected PNG receipts.

## Scope boundary

This evidence uses ephemeral local PostgreSQL and locally signed fixture identities. It is valid evidence for the source behavior tested; it is not evidence of WordPress staging SSO, Supabase production, R2 production, Matrix integration, or production readiness.
