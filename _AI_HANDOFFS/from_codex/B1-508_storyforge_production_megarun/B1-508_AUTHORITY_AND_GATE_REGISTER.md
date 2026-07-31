# B1-508 Authority and Gate Register

## Authority chain used

1. Founder decisions, including RP-8 Option A and later activation value
   `concat`.
2. B1-507C amendment.
3. B1-507B binding authority and executable contracts.
4. B1-507D conformance receipt.
5. B1-507E RP-8 final receipt.
6. Current repository and observed production evidence.

No older handoff was allowed to override a later binding decision.

## Gate register

| Gate | Final status | Evidence | Release-slice impact |
|---|---|---|---|
| G-01 exact source | RESOLVED | Required start `5c45ead...`; deployed source `97ebf243...`; deterministic `v-a9a...` | none |
| G-02 production target | RESOLVED | Railway service `dab015...`; Kinsta `/storyforge/` route | none |
| G-03 backup | RESOLVED | locked Railway backup, PG dump, MyKinsta backup, private Kinsta archive | none |
| G-04 restore rehearsal | RESOLVED | isolated PostgreSQL 18.4 restore exact | none |
| G-05 M4 migration | RESOLVED | production ledger row 9; all M4 objects and privileges verified | none |
| G-06 least privilege/RLS | RESOLVED | effective-authority gate PASS; app role has no elevated attributes | none |
| G-07 WordPress gateway | RESOLVED | exact immutable route/release hashes; cache cleared | none |
| G-08 Founder access | RESOLVED | exactly one allowed Founder; zero cohorts | none |
| G-09 live text canary | RESOLVED | create/save/reload/detail/archive all passed | none |
| G-10 disabled voice | RESOLVED | UI absent; authenticated recording POST is 403 `voice_disabled` | none |
| G-11 RP-8 executor | RESOLVED FOR LATER | Founder approved Option A; `concat` remains absent now | voice only |
| G-12 R2 | EXTERNAL CREDENTIAL REQUIRED | zero `STORYFORGE_R2_*` variables; no bucket was provisioned | voice only |
| G-13 provider | EXTERNAL CREDENTIAL REQUIRED | provider `none`; StoryForge OpenAI key absent | voice only |
| G-14 FG-1 wording | FOUNDER ACTION REQUIRED | unresolved binding voice-language gate | voice only |
| G-15 RP-7 corpus | HUMAN CORPUS REQUIRED | no governed human corpus acceptance | voice only |
| G-16 device voice acceptance | PHYSICAL DEVICE REQUIRED | no authorized live voice/device run | voice only |
| G-17 reconciliation | BLOCKING VOICE ONLY | `off`; requires R2, E13, dry runs, and later review | no text impact |
| G-18 limited cohort | POLICY AUTHORITY REQUIRED | zero cohorts; no explicit cohort grant | student expansion |
| G-19 broad 360 | POLICY AUTHORITY REQUIRED | no broad access authority | broad expansion |
| G-20 monitoring | RESOLVED FOR SLICE | health/config 200; zero Railway HTTP 5xx in stabilization window | none |

## Retry and resolution record

- PostgreSQL restore attempt 1: Unix socket path too long before startup.
  Resolved with loopback TCP; production untouched.
- M4 wrapper: transaction committed, then a stale post-commit verifier omitted
  M4 closure grants. The verifier and its regression test were corrected; the
  complete live closure query passed.
- Kinsta PHP preflight attempt 1: wrong PHP binary path. Correct 8.2 binary
  passed.
- Kinsta cache helper: host PHP exited after publication. Exact bytes were
  independently verified, and cache was cleared through MyKinsta.
- Local final PostgreSQL command initially selected PG16. PATH was pinned to
  installed PostgreSQL 18.4 and the full suite passed.
- Browser/conformance suites regenerated historical screenshot artifacts.
  Their exact committed bytes were restored; no unrelated diff remained.

Every retry was bounded. No unresolved P0 or P1 remains.
