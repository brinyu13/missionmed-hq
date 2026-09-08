# D9-415 Command Log

Every row is one shell execution batch. All actions through Phase 0 were read-only except `mkdir -p` for the authorized handoff structure and `apply_patch` for these ledgers/evidence files. Commands executed before ledger creation are reconstructed from the authoritative tool transcript and marked `bootstrap`.

| ID | Phase | Category | Command / target | Expected side effects | Exit | Evidence |
|---|---:|---|---|---|---:|---|
| C0001 | 0 | bootstrap preflight | Inspect D9-415 `pwd`, repo root, branch, HEAD, `origin/main`, merge-base, origin, upstream, status, and remote main. | None | 0 | `evidence/PHASE_0_PREFLIGHT.txt` |
| C0002 | 0 | instruction discovery | Find and read applicable `AGENTS.md` and `CLAUDE.md`; verify no applicable override. | None | 0 | `evidence/PHASE_0_INSTRUCTION_SOURCES.txt` |
| C0003 | 0 | OS sync | `git -C /Users/brianb/MissionMed_OS fetch origin main` after local OS was found pre-existing dirty/behind. | Update remote-tracking ref only; no worktree write | 0 | Fetched `origin/main`; local dirty files preserved. |
| C0004 | 0 | OS authority read | `git show origin/main:BOOT.md`, `CURRENT.md`, registry and index reads. | None | 0 | `evidence/PHASE_0_INSTRUCTION_SOURCES.txt` |
| C0005 | 0 | prompt read | Read `/Users/brianb/.codex/attachments/0789f3ea-bb58-4911-826b-d372d0a6a6e1/pasted-text.txt` in full and extract exact phase/deliverable requirements. | None | 0 | Original attachment path. |
| C0006 | 0 | file discovery | `rg --files` filter for mandatory D9/Matrix authority inputs. | None | 0 | Mandatory source paths listed in prompt. |
| C0007 | 0 | prompt extraction | `rg -n` mandatory input/deliverable markers in the prompt attachment. | None | 0 | Original attachment path. |
| C0008 | 0 | prompt extraction | `sed -n '160,225p'` prompt attachment. | None | 0 | Original attachment path. |
| C0009 | 0 | mandatory read | Read D9-410 combined handoff lines 1-350. | None | 0 | D9-410 combined handoff. |
| C0010 | 0 | mandatory read | Read D9-410 combined handoff lines 351-700. | None | 0 | D9-410 combined handoff. |
| C0011 | 0 | mandatory read | Read D9-410 combined handoff lines 701-1050. | None | 0 | D9-410 combined handoff. |
| C0012 | 0 | mandatory read | Read D9-410 combined handoff lines 1051-1400. | None | 0 | D9-410 combined handoff. |
| C0013 | 0 | mandatory read | Read D9-410 combined handoff lines 1401-1750. | None | 0 | D9-410 combined handoff. |
| C0014 | 0 | mandatory read | Read D9-410 combined handoff lines 1751-2100. | None | 0 | D9-410 combined handoff. |
| C0015 | 0 | mandatory read | Read D9-410 combined handoff lines 2101-2450. | None | 0 | D9-410 combined handoff. |
| C0016 | 0 | mandatory read | Read D9-410 combined handoff lines 2451-2800. | None | 0 | D9-410 combined handoff. |
| C0017 | 0 | mandatory read | Read D9-410 baseline JSON, implementation-home lock JSON, and repository census. | None | 0 | Named mandatory files. |
| C0018 | 0 | mandatory read | Read D9-410 worktree census, WordPress ownership census, conflict register, and next-run inputs. | None | 0 | Named mandatory files. |
| C0019 | 0 | mandatory read | Read D9-360 implementation authority and combined handoff; combined output was tool-truncated, so it was re-read in bounded chunks. | None | 0 | Named mandatory files. |
| C0020 | 0 | mandatory read | Read D9-360 combined handoff lines 1-140. | None | 0 | D9-360 combined handoff. |
| C0021 | 0 | mandatory read | Read D9-360 combined handoff lines 141-280. | None | 0 | D9-360 combined handoff. |
| C0022 | 0 | mandatory read | Read D9-360 combined handoff lines 281-500. | None | 0 | D9-360 combined handoff. |
| C0023 | 0 | authority read | Read Matrix runtime lock protocol. | None | 0 | Authority file. |
| C0024 | 0 | authority read | Read active Matrix runtime lock manifest. | None | 0 | Authority file; SHA in `evidence/PHASE_0_INPUT_HASHES.txt`. |
| C0025 | 0 | authority read | Read `matrix_runtime_guard.py` lines 1-220. | None | 0 | Guard source. |
| C0026 | 0 | authority read | Read `matrix_runtime_guard.py` lines 221-440. | None | 0 | Guard source. |
| C0027 | 0 | authority read | Read Critical Systems Contract. | None | 0 | Authority file. |
| C0028 | 0 | authority read | Read Codex guardrails lines 1-210. | None | 0 | Authority file. |
| C0029 | 0 | authority read | Read Codex guardrails lines 211-420. | None | 0 | Authority file. |
| C0030 | 0 | authority read | Read Codex guardrails lines 421-700. | None | 0 | Authority file. |
| C0031 | 0 | passport read | Read Matrix product passport. | None | 0 | Product passport. |
| C0032 | 0 | OS authority read | Read fetched `origin/main:BOOT.md` and `CURRENT.md` verbatim. | None | 0 | `evidence/PHASE_0_INSTRUCTION_SOURCES.txt` |
| C0033 | 0 | OS routing read | Query fetched product index Matrix entry, full authority index, and D9-415 mission lookup. | None | 0 | `evidence/PHASE_0_INSTRUCTION_SOURCES.txt` |
| C0034 | 0 | prompt extraction | Read founder decision and primary-goal section. | None | 0 | Original attachment path. |
| C0035 | 0 | environment/preflight | Re-run exact Git preflight, remote main, D9-410/manifest hashes, tool versions, host/OS/date. | None | 0 | `evidence/PHASE_0_PREFLIGHT.txt`, `PHASE_0_INPUT_HASHES.txt`, `PHASE_0_ENVIRONMENT.txt` |
| C0036 | 0 | directory creation | Create authorized primary handoff `evidence`, `manifests`, and `packages` directories. | Local handoff directories only | 0 | Directory structure. |
| C0037 | 0 | ledger write | Apply patch creating Phase 0 decision/run/command/evidence ledgers, founder decision, plan, and raw evidence summaries. | Authorized handoff files only | 0 | Files in this handoff. |
| C0038 | 0 | verification | List new handoff files and check Git status. | None | 0 | Primary handoff tree; task-generated files only. |
| C0039 | 1 | prompt read | Read Phase 2-8 requirements from prompt attachment. | None | 0 | Original attachment path. |
| C0040 | 1 | repo/tooling read | Inspect ignore rules, package/deploy/validation file inventory, and `.gitignore`. | None | 0 | Agent D evidence and repository paths. |
| C0041 | 1 | orchestration | Spawn/read-only Wave 1 agents A, B, C; start D after A stopped. | No filesystem or external mutation | 0 | `evidence/WAVE_1_SUBAGENT_*.md` |
| C0042 | 1 | local provenance | Search local evidence for controller hashes `23da5c...` and `c0a538...`. | None | 0 | Y1-CAM-4004/4005 paths in Wave 1 synthesis. |
| C0043 | 1 | local hash census | Hash all local `class-mmed-student-os.php` candidates and match the disputed values. | None | 0 | Wave 1 synthesis. |
| C0044 | 1 | local source discovery | List Y1-CAM-4005 candidate/backup files and any corresponding handoff paths. | None | 0 | Agent D evidence paths. |
| C0045 | 1 | authority monitor | Re-read active manifest mtime/SHA/controller pin/validation ticket and look for newer Y1-CAM-4005 files. | None | 0 | Manifest remained `efb1d...`, pin `c0a538...`. |
| C0046 | 1 | ledger write | Apply patch filing four Wave 1 reports, synthesis, risk/conflict registers, and blocked run state. | Authorized handoff files only | 0 | This handoff. |
| C0047 | 1 | verdict write | Apply patch filing interim blocked executive verdict, execution report, and no-production-mutation attestation. | Authorized handoff files only | 0 | This handoff. |
| C0048 | 1 | stop-boundary validation | Parse JSON, scan handoff for high-confidence secret signatures, prove no product/system diff, inspect status, hash interim evidence set, count files. | None | 0 | 20 files; interim aggregate `04ef4bd310733e780969ecd2aa9aa3aa9765f90cd44647ea529281e46ec96a65`. |
| C0049 | 1 | report update | Record stop-boundary validation and interim aggregate hash. | Authorized handoff Markdown only | 0 | `D9_415_EXECUTION_REPORT.md`, this log. |
| C0050 | closeout | combined-source census | List every current Markdown source excluding prior combined files and record byte counts. | None | 0 | Fourteen Markdown source files identified. |
| C0051 | closeout | mechanical combined assembly | Assemble the fourteen Markdown sources verbatim in explicit logical order with begin/end markers; verify exact generated bytes, marker count, file count, and SHA-256. | One authorized combined Markdown file | 0 | `D9_415_BLOCKED_PHASE_1_COMBINED_HANDOFF.md` |
| C0052 | 1R | resume prompt read | Read the 495-line hash-scoped founder-authorization ticket in bounded chunks. | None | 0 | Resume attachment. |
| C0053 | 1R | plugin instruction read | Load the explicitly requested GitHub, Computer Use, and Browser skill instructions; resolve the Browser skill to its installed cache version. | None | 0 | Installed plugin skill files. |
| C0054 | 1R | resume gate | Recheck exact D9 worktree, branch, origin, HEAD/base relationship, and status. | None | 0 | Expected worktree/branch/origin; handoff-only untracked state. |
| C0055 | 1R | OS state read | Inspect local MissionMed OS status/remote relationship and compare local versus fetched/current authority state without mutating the dirty OS worktree. | None | 0 | Local OS behind seven; substantive CURRENT state unchanged. |
| C0056 | 1R | BOOT/passport read | Reload BOOT routing and the Matrix product passport. | None | 0 | Canonical OS and worktree passport. |
| C0057 | 1R | guardrail read | Read all Codex execution guardrails including MR-G8. | None | 0 | `_SYSTEM/CODEX_EXECUTION_GUARDRAILS.md`. |
| C0058 | 1R | persisted-state read | Reload required D9-415 run state, decision ledger, plan, evidence index, synthesis, risk/conflict registers, and execution report. | None | 0 | Existing handoff. |
| C0059 | 1R | command-log read | Re-read the command log separately after a combined tool result truncated. | None | 0 | Existing command log. |
| C0060 | 1R | Wave 1 evidence read | Read all four existing Wave 1 reports; do not rerun the investigations. | None | 0 | `evidence/WAVE_1_SUBAGENT_*.md`. |
| C0061 | 1R | GitHub remote verification | Use the GitHub connector to confirm remote main remains `9c1fa72...` and the recovery branch is not yet remote. | None | 0 | Connected GitHub read results. |
| C0062 | 1R | original prompt read | Locate and reread all 1,443 lines of the original D9-415 mission prompt. | None | 0 | Original attachment. |
| C0063 | 1R | protected authority read | Reload the active Matrix lock protocol/manifest and Critical Systems Contract. | None | 0 | Controller lock remains `c0a538...`. |
| C0064 | 1R | authorized production check | Run one read-only SSH metadata/hash check for the protected production controller. | None | 0 | Controller remains `23da5c...`, size 32786, mode 0644, original mtime preserved. |
| C0065 | 1R | primer/hygiene read | Read worktree primer, Git workspace hygiene protocol, and local boot pointer. | None | 0 | Worktree authority inputs. |
| C0066 | 1R | canonical initialization | Resolve canonical knowledge paths; read the last ten learnings, rules engine, naming canon, and integrity extension. | None | 0 | Canonical MissionMed root. |
| C0067 | 1R | canonical drift check | Count required knowledge files and compare canonical/worktree primer hashes. | None | 0 | Canonical primer differs from older worktree copy. |
| C0068 | 1R | canonical authority read | Read canonical primer and deprecated master-knowledge compatibility marker in full. | None | 0 | Canonical MissionMed root. |
| C0069 | 1R | knowledge router read | Read Knowledge Index lines 1-400. | None | 0 | Canonical Knowledge Index. |
| C0070 | 1R | knowledge router read | Read Knowledge Index lines 401-800; tool output truncation required bounded rereads. | None | 0 | Canonical Knowledge Index. |
| C0071 | 1R | knowledge router reread | Reread lines 401-600 and 601-800 in bounded outputs. | None | 0 | Canonical Knowledge Index. |
| C0072 | 1R | knowledge router read | Read lines 601-700 and 801-1175 in bounded parallel outputs. | None | 0 | Canonical Knowledge Index. |
| C0073 | 1R | knowledge router reread | Read previously truncated lines 701-800. | None | 0 | Full canonical Knowledge Index now consulted. |
| C0074 | 1R | pre-edit preamble | Print pwd/branch/status, run read-only preflight, and extract exact founder/cutoff ticket text. | None | 0 | Preflight PASS in read-only mode. |
| C0075 | 1R | scoped preflight | Run edit-mode preflight with the six handoff targets and reread ledger/state/log. | None | 1 | Script defect: empty tracked-files array dereferenced under nounset at line 227; no tracked dirt. |
| C0076 | 1R | manual dirty triage | Inspect preflight source around the defect; independently prove zero tracked diff and only the authorized handoff tree untracked. | None | 0 | Scope is task-related and non-overlapping. |
| C0077 | 1R | decision source read | Read Decision 001 and the exact Decision 002/cutoff source text. | None | 0 | Founder attachments. |
| C0078 | 1R | resume requirement read | Read resume requirements through baseline requirements. | None | 0 | Resume attachment. |
| C0079 | 1R | entitlement evidence read | Locate exact deferral deliverable requirements and existing Wave 1 entitlement findings. | None | 0 | Resume ticket and Wave 1 evidence. |
| C0080 | 1R | timestamp read | Record current UTC and America/New_York timestamps for the resumed state. | None | 0 | `2026-07-14T00:25:32Z`. |
| C0081 | 1R | authorization ledger write | Record Founder Decision 002 verbatim, the T0/T1 cutoff, D9-416 deferral, ledger resolution, and resumed run state. | Authorized handoff files only | 0 | This handoff. |
| C0082 | 1R | authorization verification | Diff the Decision 002 artifact against the exact ticket text, parse resumed JSON, check status, and advance the plan. | None | 0 | Verbatim decision match; valid run state. |
| C0083 | 2 | phase requirement read | Reload exact original Phase 2 snapshot requirements and exclusions. | None | 0 | Original D9-415 attachment. |
| C0084 | 2 | ignore-boundary read | Inspect `.gitignore` behavior for raw forensic material and handoff JSON. | None | 0 | Raw non-Markdown handoff evidence is ignored by default. |
| C0085 | 2 | snapshot tooling write | Create a read-only remote manifest emitter and local snapshot verifier in the ignored evidence area. | Authorized evidence files only | 0 | Snapshot helper scripts. |
| C0086 | 2 | readiness validation | Add missing `awk` prerequisite, syntax-check both helpers, prove snapshot path absent, and verify remote read-only tools/roots. | Snapshot helper only; no production write | 0 | `REMOTE_SNAPSHOT_READINESS=PASS`. |
| C0087 | 2 | T0/copy/T1 snapshot | Capture T0, stream one inbound tar copy, capture T1, compare normalized manifests, and run local verifier. | Local forensic snapshot/manifests only | 1 | T0/T1 identical; local verifier stopped on mode-only mismatch caused by macOS tar plus `umask 077`. |
| C0088 | 2 | stopped-state diagnosis | Inspect only generated manifest metadata, file counts, completion markers, and local root presence. | None | 0 | Both manifests complete; local copy present. |
| C0089 | 2 | mismatch classification | Prove all 287 local mismatches are mode-only and T0/T1 compare identical; record T1 completion. | None | 0 | No path/type/content mismatch. |
| C0090 | 2 | local mode normalization | Restore copied file/directory modes mechanically from T0 without a production read; rerun full local verification. | Local snapshot metadata only | 0 | 287/287 entries, zero mismatches. |
| C0091 | 2 | inventory discrepancy triage | Cross-check the 125-file plugin count, preserved mtimes, prior D9-410 evidence locations, and local source candidates. | None | 0 | T0/T1 and independent count agree at 125. |
| C0092 | 2 | local provenance comparison | Compare sealed plugin hashes/path sets against current local and F1 Drill candidate trees without printing content. | None | 0 | No candidate is a complete match; direct sealed snapshot remains authority. |
| C0093 | 2 | cutoff ledger write | Mark T0/T1 quiescent, document the local mode correction and Wave 1 count supersession, and advance run state to local safety scans. | Authorized handoff files only | 0 | This handoff. |
| C0094 | 2 | scanner availability/status | Parse run state, check dedicated scanner availability, and prove raw snapshot/manifests are ignored. | None | 0 | No dedicated scanner installed; raw source isolated. |
| C0095 | 2-3 | path-only safety scan | Scan full snapshot for forbidden filenames, high-confidence secrets, credential literals, emails, and binary types without printing matches. | None | 0 | One Webex library marker candidate; no forbidden data file. |
| C0096 | 2-3 | redacted candidate fingerprinting | Record rule, path, line, length, and digest for high-confidence/credential candidates only. | None | 0 | PKCS#8 validation marker and schema labels only. |
| C0097 | 3 | redacted context review | Render value-redacted contexts for flagged Webex library candidates. | None | 0 | False positives; no secret body/value. |
| C0098 | 3 | MU candidate census | Hash seven Wave 1 candidates and discover filename/content-related top-level MU candidates. | None | 0 | Exact candidate hashes confirmed; additional related controls identified. |
| C0099 | 3 | MU filename list | List the eight filename-discovered candidates. | None | 0 | `missionmed-hq-route-proxy.php` analyzed but not automatically included. |
| C0100 | 3 | static extractor attempt | Extract MU definitions/includes/hooks. | None | 1 | One-off regex used a misplaced inline flag; no file write. |
| C0101 | 3 | corrected static extraction | Extract definitions, includes, hooks, filters, and REST registration from ten candidate files. | None | 0 | Runtime roles mapped. |
| C0102 | 3 | full top-level keyword map | Map Matrix/Student OS/hub/Scheduler/auth/session/app references across every top-level MU PHP file. | None | 0 | Candidate boundary narrowed by source evidence. |
| C0103 | 3 | prior authority reconciliation | Re-read D9-410 MU ownership/census evidence. | None | 0 | Named protected components and backup risk confirmed. |
| C0104 | 3 | persisted plan reconciliation | Re-read D9-415 plan and Wave 1 MU candidate/closure rules. | None | 0 | Seven candidates were explicitly pending full closure. |
| C0105 | 3 | route/asset literal analysis | Extract only route/asset/Matrix-related literals from additional candidates. | None | 0 | DrJ access directly locks Matrix routes; performance file preserves exact Matrix assets. |
| C0106 | 3 | direct dependency analysis | Extract include/class/function-existence relationships. | None | 0 | Matrix account loads hub reskin; DrJ access consumes Arena proxy functions. |
| C0107 | 3 | external-function closure | Distinguish self-defined versus external optional function references. | None | 0 | `arena-route-proxy.php` is the required custom provider. |
| C0108 | 3 | redacted scanner write | Add deterministic metadata-only source scanner. | Authorized ignored evidence helper only | 0 | No matched value emission. |
| C0109 | 3 | selected-source scan | Scan complete plugin plus ten-file candidate closure. | Generated safe JSON only | 0 | 135 files; candidates require redacted review. |
| C0110 | 3 | candidate disposition review | Produce redacted structural contexts for entropy/email/private-data/credential candidates. | None | 0 | Static paths/URLs/selectors/examples/support addresses only. |
| C0111 | 3 | email classification | Classify hard-coded emails as owned/reserved/external and role/non-role without printing addresses. | None | 0 | Institutional, reserved examples, or static placeholder. |
| C0112 | 3 | placeholder verification | Verify the one external email is inside a form placeholder. | None | 0 | Not live user/student content. |
| C0113 | 3 | binary safety extension | Extend scanner to ASCII-preserving checks on binary assets; rerun. | Scanner helper and safe JSON only | 0 | Zero binary secret/email candidates. |
| C0114 | 2-3 | report generator write | Add mechanical generator for full plugin/MU manifests, graph, exclusion register, and scan report. | Authorized evidence helper only | 0 | Source values not emitted. |
| C0115 | 2-3 | snapshot report generation | Generate/parse manifests and verify counts, controller, backup equality, and selected names. | Authorized handoff reports only | 0 | 125 plugin files; ten MU files; 116 unrelated MU files excluded. |
| C0116 | 4 | destination census | Inspect tracked WordPress paths and selected destination preimages. | None | 0 | Plugin absent; four selected MU paths tracked with older bytes. |
| C0117 | 4 | Matrix guard interface read | Read guard help and preflight options. | None | 0 | Non-deploying `--skip-production` path identified. |
| C0118 | 4 | protected asset list | List ten active protected asset keys/hashes. | None | 0 | Active controller lock remains `c0a538...`. |
| C0119 | 4 | guard behavior read | Read preflight return/warning behavior and confirm no CI use of broad override. | None | 0 | Split validation chosen. |
| C0120 | 4 | split guard validation | Run nine unchanged assets and isolated controller against sealed snapshot. | Generated safe reports only | 1 | Reports correct; summary assertion expected a different warning phrase. |
| C0121 | 4 | guard report diagnosis | Read the two local guard reports. | None | 0 | Nine assets PASS; controller-only warning is exact Decision 002 drift. |
| C0122 | 4 | guard exception verification | Validate exact report phrases/hash and prove broad override was not used. | None | 0 | Decision 002 exception applied only to controller. |
| C0123 | 4 | product edit preflight | Run scoped preflight for plugin and ten MU paths using an empty-array workaround attempt. | None | 1 | Bash 3.2 empty-array defect persists after correct zero-tracked-dirt report; manual triage clean. |
| C0124 | 4 | exact baseline import | Copy sealed plugin and ten selected MU files into product paths; verify every hash/mode/path and rerun identical tracked-tree scan. | Authorized product-tree source only | 0 | 133 plugin entries and ten MU files exact; no symlinks. |
| C0125 | 4 | baseline syntax validation | Run PHP syntax on 62 files, JS syntax on 30 files, and JSON validation. | Safe reports only | 0 | All PASS. |
| C0126 | 4 | baseline ledger update attempt | Update resolution ledgers/evidence/run state. | None | 1 | Atomic patch rejected on a historical synthesis anchor; no partial write. |
| C0127 | 4 | patch anchor diagnosis | Read actual synthesis tail and verify no partial changes. | None | 0 | Correct anchor identified. |
| C0128 | 4 | baseline ledger update | Resolve snapshot/scan risks, record ten-file closure, refresh evidence index/run state, and prepare D9-415A. | Authorized handoff files only | 0 | This handoff. |
| C0129 | 5 | baseline commit/tag | Create D9-415A and annotated non-deployable baseline tag after staged-tree verification. | Local Git objects/ref only | 0 | Commit `c340a3a...`; tag object `6e2f5e3...`. |
| C0130 | 6 | source quarantine | Move the executable backup byte-identically to forensic storage; add intended-active manifest/validator/report; create D9-415B. | Authorized source/forensic/docs only | 0 | Commit `9469437...`. |
| C0131 | 7 | provenance reconciliation | Generate hash map, source lock, implementation-home records, CSS/controller rollback evidence, and D9-415C. | Authorized branch-local provenance only | 0 | Commit `e12cd99...`. |
| C0132 | 8 | deterministic pipeline | Add package policy, builder, validator, workflow, reports; validate two identical builds; create D9-415D. | Authorized validation/CI/docs only | 0 | Commit `a81a3af...`. |
| C0133 | resume | canonical worktree recovery | Locate the existing D9-415 worktree after the app opened D9-410; verify branch/origin/history/status. | None | 0 | Existing A-D sequence found clean; no duplicate work. |
| C0134 | resume | mandatory state reload | Re-read decision ledger, plan, command log, evidence index, Wave 1 synthesis, risk/conflict registers, and execution report. | None | 0 | Persisted evidence accepted. |
| C0135 | 8 | independent A-D verification | Verify tag annotation/target, controller/backup/rollback hashes, commit separation, and rerun full validator. | Temporary local validation output only | 0 | Package SHA `afd9a1...`; all checks PASS. |
| C0136 | 9 | Wave 2 orchestration | Run exactly four new read-only reviewers: provenance; security/data; reproducibility/CI; release/rollback. | No filesystem/external mutation by reviewers | 0 | 4/4 complete. |
| C0137 | 9 | finding verification | Inspect builder, validator, policy, workflow, and trusted input hashes; reproduce three fail-closed P1 findings. | None | 0 | Main-agent adjudication accepted P1s. |
| C0138 | 9 | D9-415E edit | Seal trust anchors, require PHP/Node/counts, cover scanner/hash-map paths, pin checkout, and disable persisted credentials. | Three authorized validation files | 0 | Diff limited to workflow/builder/validator. |
| C0139 | 9 | E precommit validation attempt | Create detached temporary candidate worktree and run validator. | Temporary worktree only | 1 | Stopped before validation because zsh `status` is read-only; temp worktree removed exactly. |
| C0140 | 9 | E precommit validation | Recreate detached candidate with neutral return-code variable; run full matrix. | Temporary worktree/package outputs only | 0 | PASS; identical package builds. |
| C0141 | 9 | missing-tool fail-closed test | Run syntax validator with PHP/Node excluded from PATH. | Temporary output only | 0 | `MISSING_TOOL_FAIL_CLOSED=True`. |
| C0142 | 9 | review-fix commit | Create non-empty D9-415E. | Local Git commit only | 0 | Commit `030fe107...`; three files. |
| C0143 | 9 | E postcommit validation | Run full validator at clean real E commit. | Temporary package/report output only | 0 | PASS; trust anchors sealed. |
| C0144 | 9 | dedicated branch review | Compare origin/main...E, verify ancestry/runtime drift/protected scope/tag/rollback and classify immutable whitespace exception. | None | 0 | Zero unresolved P0/P1. |
| C0145 | 9 | branch-wide redacted scan | Scan 211 changed files without emitting matched values. | Temporary safe JSON only | 0 | Only previously reviewed candidate groups. |
| C0146 | 9 | fresh clone validation | Clone local canonical repository with `--no-local`, checkout branch, run full validator, check clean state. | Temporary clone/output only | 0 | PASS at E. |
| C0147 | 10 | GitHub prerequisites | Verify `gh` version/auth, repo/default branch, and absence of an existing PR. | None | 0 | Authenticated as repository owner. |
| C0148 | 10 | branch/tag publication | Push recovery branch and immutable tag. | Authorized GitHub refs only | 0 | Remote E branch and tag created. |
| C0149 | 10 | remote verification | Compare remote branch SHA, tag object, and dereferenced tag commit to local refs. | None | 0 | Exact equality. |
| C0150 | 10 | draft PR creation | Use connected GitHub app to open draft DO NOT MERGE PR #9. | Authorized draft PR only | 0 | `https://github.com/brinyu13/missionmed-hq/pull/9`. |
| C0151 | 10 | hosted CI verification | Inspect PR checks and workflow run. | None | 0 | Run `29301277578`; `validate-source-only` SUCCESS. |
| C0152 | 11 | final report authoring | Create Wave 2, dedicated review, test, D9-416 input, final state/verdict/attestation/risk/conflict/execution artifacts. | Authorized handoff only | 0 | D9-415F candidate. |
| C0153 | 11 | final combined assembly | Generate source manifest and one combined Markdown with required deliverables verbatim plus evidence appendices. | Authorized handoff only | 0 | 34 required + 5 supplemental Markdown sources; byte verification PASS. |
| C0154 | 11 | final closeout | Detached candidate validation, D9-415F commit/push, final remote/CI/mirror/activity-log checks. | Authorized Git/GitHub/mirror/log only | SELF-REFERENTIAL EXTERNAL VERIFICATION | Exact final hashes are recorded after the commit in the canonical activity log and final response. |
| C0155 | 11 | detached F candidate attempt | Regenerate the manifest/combined handoff in a clean temporary commit worktree before committing F. | Temporary worktree only | 1 | Fail-closed: the clean checkout omitted an ignored Python bytecode cache that the first manifest had accidentally inventoried; no commit or external mutation occurred. |
| C0156 | 11 | generator inventory hardening | Restrict final inventory and Markdown accounting to Git-tracked handoff files; reject missing, non-file, or symlink entries. | Handoff generator only | 0 | Ignored caches and raw forensic material cannot influence deterministic output. |
| C0157 | 11 | corrected final assembly | Regenerate the file manifest and combined handoff from the tracked-only inventory. | Authorized handoff only | 0 | 72 non-recursive source files; 34 required + 5 supplemental Markdown sources; verbatim verification PASS. |
| C0158 | 11 | detached F candidate validation | Recreate the temporary commit/worktree; parse all JSON, rerun the generator, require zero diff, run the full sealed validator, and require a clean checkout. | Temporary worktree/package outputs only | 0 | PASS; combined output reproduced byte-for-byte; package unchanged at `afd9a1e6...`; final combined hash is recorded externally to avoid self-reference. |
