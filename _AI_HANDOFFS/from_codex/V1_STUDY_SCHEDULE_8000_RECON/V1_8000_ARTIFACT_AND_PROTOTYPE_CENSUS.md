# V1 Study Schedule — Artifact and Prototype Census

## Historical product corpus

| Package | Files | Bytes | Primary classification |
|---|---:|---:|---|
| D9-100 | 9 | 316,245 | Product/domain definition and functional prototype |
| D9-200 | 15 | 384,100 | Experience architecture, Mission/Focus/recovery/mentor specifications |
| D9-300 | 7 | 330,195 | **Canonical visual and interaction foundation** |
| D9-350 | 22 | 504,445 | **Behavioral constitution and temporal law** |
| D9-360 | 22 | 471,515 | Later refinement, screenshots, prototype tests, and quality claims |
| **Total** | **75** | **2,006,500** | Historical authority/evidence, not production source |

Operational evidence packages are under
`/Users/brianb/MissionMed/_AI_HANDOFFS/from_cowork/`. This run found
byte-identical paired copies under
`/Users/brianb/MissionMed_AI_Sandbox/CLAUDE_FILES/` for all five generations.
Only D9-360 has an official D9-410 package seal: that seal selects the operational
handoff as preferred artifact-level canonical and the corrected sandbox copy as
its byte-identical mirror. This run does not invent aggregate package seals for
D9-100 through D9-350. Historical filenames remain unchanged.

## Prototype identity

| Generation | Prototype HTML and SHA-256 | Authority classification |
|---|---|---|
| D9-100 | `D9_100_MATRIX_PLAN_FUNCTIONAL_PROTOTYPE.html` — `b7998ccec1062ce434bc7c2f1167f84de0910fa758a0bee7ac147e32bd58743f` | Domain/interaction evidence |
| D9-200 | `D9_200_MATRIX_PLAN_NEXT_LEVEL_FUNCTIONAL_APP.html` — `f48baab157eca07527fb50b77c8c389b9eeb0f9abf90da911cd045b345938e7d` | Product-elevation evidence |
| D9-300 | `D9_300_MATRIX_PLAN_EXECUTION_CANVAS.html` — `cd7737649afeb581fa3a18abb774cfa8ade1860372e0215cc8bd3fa375d0dc67` | Canonical visual/interaction foundation |
| D9-350 | `D9_350_MATRIX_PLAN_BEHAVIORAL_AND_JOURNEY_PROTOTYPE.html` — `e7f0f5cbedf12edf4c88cbd42d2f466681860e456f12bcbbfa320406d701553c` | Behavioral-law reference implementation |
| D9-360 | `D9_360_MATRIX_PLAN_FINAL_PERFECTION_PROTOTYPE.html` — `3932492723fb031942603724cda1d1d80418d1e0f230f6916824e2257fbe8dd5` | Refinement candidate and QA evidence |

The official D9-360 seal records aggregate package SHA-256
`f56ccabe32e8bef2f504def9c118c9bc0aa8e2a8a4bf76fa76c7a09be29c3e00`
and implementation-authority document SHA-256
`3e399ecf22ae6bb73dcd187f91390bdb1aabdcbf4ae19f455e46ebd0054f2286`.
Its own precedence claim is evidence, but Brian's later D9-300 correction
controls this run.

## Filing caveat

D9-410 proves the preferred D9-360 handoff was not durably committed/pushed and
its sandbox mirror is outside a detected Git worktree. The same V1-8000 census
does not establish durable Git provenance for the D9-100–350 package corpus.
Hashes prove the observed bytes, not recoverability or repository authority.
V1-8010A must verify and, through an authorized non-destructive filing decision,
pin the accepted product inputs before implementation relies on them.

## Classification by authority

| Authority type | Selected evidence | Exclusions |
|---|---|---|
| Product | Founder correction plus D9-100/200/350 requirements | Appointment/Webex/Calendar product artifacts |
| Visual | D9-300 HTML, design system, interaction system | D9-360 self-score as a substitute |
| Behavioral | D9-350 constitution and decision tables | Prototype localStorage as persistence |
| Implementation | D9-415 recovered source at `d4455bf` | Standalone HTML and unintegrated drafts |
| Runtime | D9-415 production map plus current served hash/HTTP checks | Filename recency |
| Data | None selected | Calendar events, diagnostic tables, unknown Supabase projects |
| Deployment | D9-415 source package/rollback evidence only | No V1 deployment authority |

## Recovered-source and runtime evidence

The D9-410 source-authority package contains 60 files: 28 top-level reports, 23
rendered PNG evidence files, and nine extensionless `evidence/live_assets/`
runtime snapshots for Student OS, Calendar, Scheduler, File Vault, and StoryForge
assets. Those nine are historical point-in-time bytes and are superseded where
D9-415 or the dated current HTTP evidence differs. The D9-415 recovery package
contains 74 tracked artifacts. D9-415's 135/135 point-in-time
production-source map is the basis for the source decision.

The active hashed Student OS asset is exact across source and public runtime.
The legacy Study implementation consists principally of the Study class, shared
REST controller, Student OS controller, active shell JS/CSS, Calendar engine,
and shared writers in Calendar/Admin/Session assets.

## Test and rendering evidence

- D9-350 test suite SHA-256:
  `f95307de45962d4badef06276b4bbbf246b52ef2436bc6834d904277fc16ccb9`;
  reproduced 188 passed, 0 failed.
- D9-360 test suite SHA-256:
  `e2c3eaaf482edf541b80b34b0b6584871bab5abc456a19d64c032fbfece85cdc`;
  reproduced 209 passed, 0 failed.
- Both suites hard-code their expected HTML filename, so validation used temporary
  copies named `app350.html`/`app360.html`. Original artifacts were untouched.
- D9-100/200/300 reports refer to tests, but corresponding executable suites were
  not present in their recovered package and could not be reproduced.
- D9-300 and D9-360 were rendered locally. D9-360 exposed visible desktop and
  narrow-width defects, so its self-authored quality score is not accepted.

## Google Drive census

Connected Drive searches used historical aliases and distinctive product terms.
They found no direct D9/V1 Study Schedule authority. Results were unrelated false
positives and were not opened further. No Drive file was modified or used as
authority.

## Excluded drift

`scheduler_v1.html`, appointment booking, Webex broker, office hours, interview
booking, Daily Rounds scheduling, and unrelated Matrix Calendar work are not
product artifacts. `scheduler-mount.js` is excluded because no evidence shows it
mounts V1 Study Schedule. Shared Calendar/Student OS assets are retained only as
dependency and collision evidence.
