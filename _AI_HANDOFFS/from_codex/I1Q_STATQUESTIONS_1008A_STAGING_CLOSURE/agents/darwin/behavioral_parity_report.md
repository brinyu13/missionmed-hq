# I1Q-1008A Darwin Behavioral Parity Report

## Verdict

`PASS_LOCAL_NO_REFACTOR`

Evidence class: `VERIFIED_LOCAL`

Darwin applied no product refactor. The final candidate-code fingerprint is:

`cd41853a8dfd5d4dd034cbfeb45098e83d4aee63f6697d1d8a72d6b57270fc26`

Behavioral parity is preserved for Darwin's zero-change scope and the latest executable suite. Another authorized worker changed preview integration artifacts concurrently, so byte identity is not claimed for the full worktree timeline. Root regenerated the evidence estate afterward, and final validation passes 20 of 20 with zero errors and claimed state `BLOCKED`. This is not staging certification and not a production claim.

## Candidate Boundary

- Worktree: `/Users/brianb/MissionMed_worktrees/I1Q-STATQuestions-1008A`
- Branch: `i1q-statquestions-1008a`
- HEAD: `81273add2c0fe350d330902d229683662896a1b1`
- Product code changed by Darwin: none
- Migration or workflow changed by Darwin: none
- Evidence estate changed by Darwin: none
- Protected system changed by Darwin: none

## Verification Matrix

| Check | Result | Evidence class |
| --- | --- | --- |
| Full Node suite | 277 total, 275 pass, 0 fail, 2 intentional database skips | `VERIFIED_LOCAL_THIS_LANE` |
| Evidence validator at lane start | 20 of 20 pass, zero errors, claimed state `BLOCKED` | `VERIFIED_LOCAL_THIS_LANE` |
| Evidence validator after root regeneration | 20 of 20 pass, zero errors, claimed state `BLOCKED` | `VERIFIED_LOCAL_THIS_LANE` |
| Base disposable PostgreSQL | 13 of 13 pass | `VERIFIED_LOCAL_PRIOR_INTEGRATED_EVIDENCE` |
| 1008A runtime PostgreSQL | 1 of 1 pass | `VERIFIED_LOCAL_PRIOR_INTEGRATED_EVIDENCE` |
| Darwin product write scope | Zero product files changed | `VERIFIED_LOCAL_THIS_LANE` |
| Final candidate-code fingerprint | `cd41853a8dfd5d4dd034cbfeb45098e83d4aee63f6697d1d8a72d6b57270fc26` | `VERIFIED_LOCAL_THIS_LANE` |
| Preview query plans | Not run | `NOT_RUN_EXTERNAL_BLOCKER` |
| Authenticated staging browser | Not run | `NOT_RUN_EXTERNAL_BLOCKER` |
| Staging load and ingress behavior | Not run | `NOT_RUN_EXTERNAL_BLOCKER` |
| Production behavior | Not run | `PROHIBITED_NO_CLAIM` |

Darwin did not repeat the disposable PostgreSQL runs because they were already established on the integrated candidate and this lane made no executable change. The concurrent edits were limited to preview integration artifacts; the full Node suite was rerun after them and remained green.

## Verified Static Findings

### Pagination Completeness

Evidence class: `VERIFIED_LOCAL_STATIC`

The server bounds generic resource pages to 200 rows and returns `next_cursor`. The browser helper always requests a maximum of 200 and never consumes that cursor. Screens that join multiple collections can therefore become incomplete beyond the first page. This is both a scale concern and a behavioral completeness concern.

### Query And Index Shape

Evidence class: `VERIFIED_LOCAL_STATIC`, runtime impact `UNKNOWN`

The reviewer queue query is caller-bound and ordered, but it is unbounded. Its filter starts with `reviewer_actor_id` while the available queue index starts with `state`. The query must be measured in preview before an index or contract change is justified.

Release membership is correctly keyed by `release_id` and ordered by `position`; its primary and unique constraints support that access pattern. No issue is claimed for that query.

### Browser Request Fanout

Evidence class: `VERIFIED_LOCAL_STATIC`

Eighteen template functions were inspected. The maximum generic collection fanout for one render is five parallel requests. Source, transcript, editorial, physician, and release views perform client-side joins over those pages. Requests are parallel rather than serial, which avoids a simple waterfall, but repeated full-page reads increase with corpus size.

### Assets

Evidence class: `VERIFIED_LOCAL_SYNTHETIC`

The interface uses three same-origin static files and no third-party font, image, framework, or runtime dependency. Total raw transfer is 139,559 bytes. Offline gzip level 9 is 30,711 bytes. The local server applies `no-store` to both API and static responses and does not compress or emit validators. Actual ingress behavior remains unknown.

### Maintainability And Duplication

Evidence class: `VERIFIED_LOCAL_STATIC_HEURISTIC`

The largest modules are the browser application, evidence validator, and platform service. A normalized seven-line scan reported 21 overlapping repeated windows across 18 files. Manual collapse identified four meaningful clusters, not 21 independent defects. No debug statements, TODO markers, external dependencies, or non-ASCII source text were found in the inspected source, public, and test paths.

## Reproducible Commands

Run from the application directory:

```bash
/usr/bin/time -lp node --test --test-reporter=dot tests/*.test.mjs
node --test --test-reporter=tap tests/*.test.mjs | tail -24
/usr/bin/time -lp npm run validate
```

Run from the worktree root:

```bash
{ find i1q-question-platform/src i1q-question-platform/public i1q-question-platform/tests i1q-question-platform/db -type f -print; printf '%s\n' i1q-question-platform/openapi.json .github/workflows/i1q-1008a-preview.yml; } | LC_ALL=C sort | while IFS= read -r f; do shasum -a 256 "$f"; done | shasum -a 256
rg -n 'listResource\(|next_cursor|cursor|limit' i1q-question-platform/public/app.js i1q-question-platform/src/server.mjs i1q-question-platform/src/store.mjs
rg -n -i 'reviewer_actor_id|review_assignments_queue|ORDER BY priority|LIMIT' i1q-question-platform/src/postgres-repository.mjs i1q-question-platform/db/migrations/*.sql
```

The loopback and repository benchmark method, samples, percentiles, and environment are recorded in `performance_before_after.json` so results are not confused with staging evidence.

## Blockers And Residual Risk

Evidence class: `EXTERNAL_BLOCKER`

- Preview datastore authority and connection are absent.
- Canonical authenticated runtime integration is not deployed.
- Staging URL, ingress, monitoring, and representative data are absent.
- The security verifier retains a veto for all I1Q-1008A release states.

The local executable candidate remains suitable for continued integration work. It is not certified for staging or production, and no performance SLO has been proven.
