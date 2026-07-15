# P1 RISE 4006 - Bootstrap and Pre-Change State

**Ticket:** P1-RISE-4006

**Captured:** 2026-07-15 07:47 EDT / 2026-07-15T11:47:27Z

**Risk:** High

**State:** Baseline preserved; protected production paths remain untouched.

## Executive Finding

RISE has a complete national staging registry and a strong 4004 UX prototype, but it has no registered production system. There is no live RISE route, production API, durable RISE schema, approved database project, authenticated RISE audience, ACTN production adapter, or CAM production contract. Existing shared production infrastructure also has unresolved source and deployment drift. Production deployment is therefore not authorized at this phase.

The safe implementation branch is isolated from both the old RISE data worktree and the dirty canonical checkout:

| Item | Value |
|---|---|
| Repository | `https://github.com/brinyu13/missionmed-hq.git` |
| Isolated implementation worktree | `/tmp/P1-RISE-4006-production` |
| Branch | `codex/p1-rise-4006-production` |
| Review implementation commit | `78732eb492c0e8d8cfd2a768593b1a10f506ee17` |
| Base upstream | `origin/main` |
| Base commit | `9c1fa72e6b056db8b6fe0e17031fcaa688f78569` |
| Base subject | `Merge MM-SPINE-006A product boot stop rule` |
| Worktree status at creation | Clean |

The prior `/Users/brianb/MissionMed_worktrees/P1-RISE-4000` worktree is preserved as data lineage only. It remains on `p1-rise-4000` at `e8503866bce9cb941dd8f2dc38f39e62bd21e316`, has no upstream, and contains the national registry build under untracked `outputs/`.

## Authority and Repository State

The canonical checkout `/Users/brianb/MissionMed` is not a safe build or deployment source. It is on `hotfix/Y1-ARENA-3026-branded-login` at `4d1a8f5950668eed35a619f9a17aca7553c8308c`, diverges from `origin/main`, and contains extensive concurrent changes. Two protected files are currently dirty there:

- `missionmed-hq/server.mjs`
- `_SYSTEM/KNOWN_GOOD/MATRIX_RUNTIME_LOCK_MANIFEST.json`

Repository history is bifurcated after commit `5cc9144`: remote `main` contains later product-passport and boot-rule work, while the local hotfix lineage contains the critical-system guard, known-good lock, USCE runtime repair, and Arena login repair. A three-way merge preview shows extensive conflicts in shared runtime files. This is an unresolved authority conflict for any shared Railway or WordPress deployment.

No tracked RISE source, RISE branch, RISE commit, or RISE pull request existed before this run. The 4004 artifact and national registry output are also untracked in their source locations.

## MissionMed OS State

`/Users/brianb/MissionMed_OS` exists, but its local `main` is dirty and behind remote. Read-only inspection used `origin/main` at `714443573...` instead of pulling into the dirty checkout.

No RISE mission, RISE product passport, or `P1-RISE-4006` decision record exists in the current MissionMed OS mission or product indexes. MissionMed boot rules require a registered decision before protected runtime changes. The user's production charter provides task authority, but it does not resolve the missing runtime owner, database owner, or protected-path registration.

## Artifact Lineage

The application lineage is nonchronological but explicitly documented:

`4001 -> 4003 -> 4002 Product Evolution -> 4004 Final UX Freeze Candidate`

| Artifact | Location | SHA-256 / status |
|---|---|---|
| 4001 functional shell | `/Users/brianb/MissionMed_AI_Sandbox/CLAUDE_FILES/P1_RISE_4001_Functional_App_Shell_CAM_THEME.html` | `a854d6068c18...` |
| 4003 live registry | `/Users/brianb/MissionMed_AI_Sandbox/CLAUDE_FILES/P1_RISE_4003_LIVE_REGISTRY_EXPERIENCE.html` | `f2b4e679bb67...` |
| 4002 product evolution | `/Users/brianb/MissionMed_AI_Sandbox/CLAUDE_FILES/P1_RISE_4002_PRODUCT_EVOLUTION.html` | `37dacd75129c...` |
| 4004 freeze candidate | `/Users/brianb/MissionMed/_AI_HANDOFFS/from_cowork/P1_RISE_4004_FINAL_UX_FREEZE/P1_RISE_4004_FINAL_UX_FREEZE_CANDIDATE.html` | `6348f34b138f251d523d81d8772d090433c3f8ad825ac186778b843f4a13d185` |

The 4004 candidate is a 1.05 MB, 3,222-line standalone HTML prototype. It embeds registry rows and synthetic/demo Matrix, ACTN, fellowship, LCS, queue, and CAM behavior. It has no persistence or production network contract.

## Recovered 4005 Independent Audit

The 4005 package was not present in Git, MissionMed folders, or Google Drive. It was recovered from the prior signed-in ChatGPT RISE task through Computer Use and saved locally under `/Users/brianb/Downloads/`.

Recovered evidence:

- `P1_RISE_4005_SOL_ULTRA_COMBINED_AUDIT.md`
- `P1_RISE_4005_SOL_ULTRA_EXECUTIVE_SUMMARY.md`
- `P1_RISE_4005_SOL_ULTRA_INDEPENDENT_PRODUCT_AUDIT.md`
- `P1_RISE_4005_SOL_ULTRA_SCORECARD.md`
- `P1_RISE_4005_SOL_ULTRA_RECOMMENDED_FIXES.md`
- `rise_audit_results.json`
- `P1_RISE_4005_AUDIT_ARTIFACTS.zip`

The ZIP is valid and contains 26 responsive screenshots plus all reports and machine-readable results. The audit ran in GPT-5.6 Pro with Chromium, not an Ultra-labelled runtime.

4005 verdict: `UX_FREEZE_BLOCKED`.

Primary 4005 blockers:

1. Mobile shell and Explorer materially fail at 390 px.
2. CAM modal and command palette do not fully contain focus.
3. Program cards and queue rows contain invalid nested interactive controls.
4. The UI calls 6,346 specialty rows "programs," says "52 states," and overstates source verification and IMG reporting semantics.

Recorded scores include desktop UI 9.1, desktop UX 9.0, mobile UI 5.8, mobile UX 5.9, accessibility 6.8, evidence integrity 7.9, overall UI 8.1, and overall UX 8.0.

## Canonical Registry Baseline

The canonical staging source is the Google Sheet:

`https://docs.google.com/spreadsheets/d/1sHpiFtlQgCZMN9eIR5ZtudyErPP9OkFAeCiXPmQ8uVA`

Google account verification was completed under `info@missionmedinstitute.com`.

Verified staging facts:

| Metric | Value |
|---|---:|
| Tabs | 34 |
| Populated specialty tabs | 31 |
| Columns per specialty tab | 196 |
| Specialty-tab rows | 6,346 |
| Raw distinct ACGME/FREIDA ID strings | 6,140 |
| Raw exact Internal Medicine rows | 696 |
| Raw Internal Medicine tab rows including combined programs | 829 |
| Populated cells | 814,820 |

Combined programs are intentionally repeated in parent specialty tabs. These counts are distinct contracts and must never be conflated.

FREIDA public structured data is the primary populated source. Residency Explorer was unavailable during the national build, and official-site enrichment is materially limited to Brookdale. Unknown fields were left blank as intended.

### Post-baseline identity correction

Identifier inspection exposed one stale duplicate that the raw-string count concealed. `1401900001 ` and `1401900001` are two observations of the same University of Kansas School of Medicine (Olathe) program. The trailing-space row has a malformed URL, no survey date, sparse/zero values, and a 2024 source update; the normalized row has a valid URL, a 2025 survey date, and a 2026 source update. The reviewed resolution preserves the stale row in quarantine and activates the current row. Reconciled structural counts are 6,139 unique programs, 6,345 active specialty memberships, 206 additional combined memberships, 828 Internal Medicine browse memberships, and 695 exact Internal Medicine programs. The raw workbook remains 6,346 rows.

**Post-baseline correction:** the preliminary unsuffixed workbook used during early offline analysis was later proven to shift sparse cells. Its generated release receipt is superseded. The corrected `_GSHEETS.xlsx` artifact is pinned by hash, but no real-data release was generated from it after current AMA/AAMC source-use terms were verified and the importer was changed to fail before source reading without written authorization.

## Data Integrity Risks Preserved for Remediation

Read-only analysis identified the following release blockers in the staging/prototype lineage:

- Current ordinal `RISE_ID` values can change when rows are re-sorted or rebuilt.
- ACGME/FREIDA identity is not carried into the 4004 browser payload.
- Several named ACTN/alumni records are synthetic but are rendered with verified-looking language.
- Provenance is row-level rather than field-level.
- `Hybrid` and `Program Status` staging columns contain semantically mismatched source fields in the national builder.
- "Meets Published Requirements" permits unknown hard criteria; 328 of 543 programs in that category had one or two unknown hard criteria in the audited prototype.
- Demo and MissionMed interpretation fields lack author/model/version lineage.

No production migration or import is authorized until stable identifiers, typed semantics, field evidence, and demo quarantine are defined.

## Live Route Baseline

Public probes were performed without cookies or credentials:

| Route | Status | Finding |
|---|---:|---|
| `https://missionmedinstitute.com/rise` | 404 | No WordPress route |
| `https://missionmedinstitute.com/rise/` | 404 | No WordPress route |
| `https://missionmedinstitute.com/member-dashboard/` | 302 | Redirects logged-out users to WordPress login |
| `https://missionmed-hq-production.up.railway.app/rise` | 404 | No HQ static route |
| `https://missionmed-hq-production.up.railway.app/api/rise/health` | 401 | Global HQ auth executes before unmatched API routing; no RISE API exists |
| `https://cdn.missionmedinstitute.com/html-system/LIVE/rise.html` | 404 | No registered CDN asset |

There is no production RISE screenshot because no live RISE surface exists. The 404 and auth behavior above are the production baseline.

## Railway Baseline

Railway project: `missionmed-hq-fix005` (`29afe885-b9b1-425d-8fd8-8611cd275409`).

MissionMed HQ production:

| Field | Value |
|---|---|
| Environment | `production` (`ed3353f7-bcc7-4e25-a000-3c9fc628a9a7`) |
| Service | `missionmed-hq` (`3d18b017-4fc9-4b22-b097-ba879816d374`) |
| Deployment | `adbc174c-c55d-43b4-863b-ce3e806943d7` |
| Created | `2026-07-14T16:34:48.404Z` |
| Status | `SUCCESS` / running |
| Image digest | `sha256:837435930417ee6918bc779b0c470543d044822299075067003ee65830fec4d7` |
| Deploy message | `D9-MATRIX-PLAN-415S-IR3 credential containment` |
| Builder | Dockerfile |
| Start command | `node missionmed-hq/server.mjs` |

The deployed Dockerfile is absent from both the isolated `origin/main` worktree and the canonical tracked checkout. The current live deployment therefore cannot be reproduced from the selected branch.

The critical-system manifest's prior Railway rollback deployment `27280193-c85b-49de-8b03-58e28ba0c9f3` is removed and cannot serve as a directly redeployable rollback point.

## Critical-System Gate Baseline

The report-only critical gate was executed from `/Users/brianb/MissionMed`.

Results:

- Route checks: 7 passed.
- Syntax/import checks: passed.
- Protected worktree checks: 2 warnings for dirty protected files.
- CDN asset checks: 2 failed because Arena and USCE Admin live hashes differ from manifest pins.
- Authenticated browser journeys: 3 outstanding.

The broad `_SYSTEM/deploy.sh` must not be used. Local `LIVE` assets differ from production and a broad deploy could overwrite newer live systems.

## Matrix Lock Baseline

The current Matrix lock is active and was updated `2026-07-15T11:43:51.670Z`. A read-only preflight was run for `student_os_js` and `class_mmed_student_os_php`.

Origin and public hashes match the approved lock, but the selected canonical source worktree hashes differ. The guard returned:

`WARNING: You are about to work from an old Matrix runtime version. Do not edit or deploy without Brian approval.`

No Matrix runtime files will be modified. RISE must consume a least-privilege Matrix profile projection through an approved external contract.

## Supabase Baseline

Accessible projects:

| Project | Ref | Status | Current authority |
|---|---|---|---|
| `missionmed-ranklistiq` | `fglyvdykwgbuivikqoah` | Active healthy; CLI linked | Arena, STAT, USCE tables |
| MissionMed Growth Engine | `plgndqcplokwiuimwhzh` | Active healthy | HQ CRM domains |
| MissionMed Scheduler Staging | `avpdetdkpwmqqxtvomix` | Active healthy | Scheduler staging |
| `missionmed-cam-dev` | `tufzqxeucfugdovtjyqk` | Active healthy | CAM development |

No project is registered as RISE owner. The checked-in migration directory and linked remote migration history diverge: multiple remote migrations are absent locally, and one local migration is absent remotely. The migration protocol prohibits push, repair, reset, or history manipulation under this state.

No RISE tables, views, RPCs, policies, migrations, or storage buckets were found.

## Cross-Product Contract Baseline

- **Matrix:** real profile fields exist behind `mmed/v1/profile/me`; RISE has no least-privilege projection or approved audience.
- **ACTN:** latest foundation is local pre-production only and has no durable RISE program mapping. ACTN must remain canonical and read-only.
- **CAM:** production explicitly reports RISE sync as outside production scope. Re-entry requires a separately reviewed durable contract, retry behavior, security tests, and truthful health reporting.
- **StoryForge:** Matrix-owned runtime is locked; no RISE production adapter exists.
- **WordPress:** no `/rise/` page or registered handoff audience exists.
- **Cloudflare/R2:** no RISE CDN key, hash pin, cache contract, or rollback artifact exists.

## Baseline Tests

| Check | Result |
|---|---|
| `npm ci` | 70 packages installed |
| Root `npm test` | 0 tests discovered; command exits 0 |
| Root `npm run typecheck` | No `tsconfig.json`; compiler prints help and exits 0 |
| `node --check missionmed-hq/server.mjs` | Pass |
| `node --test missionmed-hq/tests/mmc-private-mount-validation.mjs` | 1 pass |
| `npm audit --json` | 3 findings: 2 high, 1 low |

High dependency findings exist in direct `form-data` and `ws` dependencies. They are pre-existing and must be resolved or proven unreachable before a shared production release.

The repository has no CI workflow and no reproducible RISE test harness. The 4004 `85/85` claim is documentary only. The recovered 4005 JSON records 48 successful checks but is not a reusable test source.

## Rollback Baseline

The only immutable RISE rollback input at this phase is the absence of a deployed RISE system:

- WordPress `/rise/`: 404
- HQ `/rise`: 404
- CDN `rise.html`: 404
- RISE schema: absent

The 4004 source SHA-256 is preserved above. Existing MissionMed production must remain unchanged. Any future RISE release requires its own scoped asset backup, database backup, deployment ID, approved hashes, and tested removal path.

## Secret Hygiene

No secret values were read, copied, logged, or written to this report. Existing secret-bearing files remain untouched. Four known environment files have overly broad mode `0644`; paths are documented in the security phase without exposing values.

## Bootstrap Verdict

`PHASE_0_COMPLETE_WITH_RELEASE_BLOCKERS`

Safe next work is limited to requirements reconciliation, architecture and contract definition, field-evidence design, stable-ID remediation, UX correction, isolated implementation, and reproducible tests. Shared Railway, WordPress, Matrix, Supabase, CAM, ACTN, or CDN production changes remain blocked until ownership and gate conflicts are resolved.
