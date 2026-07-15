# V1 Study Schedule — Command Log

This is a curated reproducibility log. Commands were read-only except for four
explicitly disclosed categories: removal of the proven-stale MissionMed_OS index
lock authorized by the startup directive; deletion by `apply_patch` of the two
provisional untracked PHP drafts created during the earlier overrun; report and
deterministic-helper writes inside this V1 handoff directory; and the authorized
handoff-only Git publication. No application-source change survives.

## Startup and authority

```text
pwd
git rev-parse --show-toplevel
git status --porcelain=v2 --branch
git remote -v
git rev-parse HEAD origin/main origin/d9-matrix-plan-415-source-recovery
git merge-base HEAD origin/main
git rev-list --left-right --count origin/main...HEAD
git worktree list --porcelain
git -C /Users/brianb/MissionMed_OS fetch origin --prune
git -C /Users/brianb/MissionMed_OS show origin/main:BOOT.md
git -C /Users/brianb/MissionMed_OS show origin/main:CURRENT.md
git -C /Users/brianb/MissionMed_OS show origin/main:missions.json
bash _SYSTEM/scripts/mm-preflight.sh --edit-scope '_AI_HANDOFFS/from_codex/V1_STUDY_SCHEDULE_8000_RECON/'
```

At the earlier startup preflight, MissionMed_OS `.git/index.lock` was a zero-byte
stale file owned by `brianb:staff`, born/modified
`2026-07-13T06:42:35-0400`, mode `-rw-r--r--`, inode `216471973`.
`lsof` reported no Git owner; the only reader was a non-Git macOS virtualization
process whose cwd was `/`. Git-process inspection also found no live owner. The
supervisor removed only that stale lock at `2026-07-14T22:15:47Z` and then
fetched successfully. On this resume it was not present. All dirty
MissionMed_OS files were preserved untouched.

The repository preflight confirmed the non-main branch and zero tracked dirty
files, then exited because its empty array path uses an unbound variable; the
script was not modified.

## Census and source

```text
git ls-files
git diff --name-only origin/main...HEAD
rg --files
rg -n 'study|study_block|render\.study|study-blocks'
find /Users/brianb/MissionMed/_AI_HANDOFFS/from_cowork -type f
shasum -a 256 <prototype, suite, plugin, controller, engine, REST, and asset paths>
git log --oneline origin/main..HEAD
git branch -a --contains d4455bf
git for-each-ref --format='%(refname)' <all refs; resolve Study path blob per ref>
git log --all -S'renderJourney' -- wp-content/plugins/missionmed-hub
git log --all -S'GhostSuggestion' -- wp-content/plugins/missionmed-hub
git log --all -S'ReserveItem' -- wp-content/plugins/missionmed-hub
git log --all -S'Quick Build' -- wp-content/plugins/missionmed-hub
git branch -a | rg 'D9[-_]?4(16|20)'
```

Source-base census at `d4455bf`: 510 tracked files, 125 plugin files, 21
top-level MU files, 142 registered worktrees, 220 changed paths from main, and 75
historical D9 package files. Thirty-two refs resolved the Study file and all used
blob `84fa3f4d...`; the target-symbol history searches and D9-416/420 ref search
found no implementation candidate.

The earlier activation-only overrun created two provisional untracked PHP drafts.
Resume disposition recorded their hashes and line counts, then used
`apply_patch` to remove exactly those drafts. No application source remains
modified, tracked, staged, committed, pushed, executed, or deployed.

## Runtime and guard

```text
python3 /Users/brianb/MissionMed/_SYSTEM/tools/matrix_runtime_guard.py list-assets
python3 /Users/brianb/MissionMed/_SYSTEM/tools/matrix_runtime_guard.py preflight --worktree /Users/brianb/MissionMed_worktrees/V1-StudyScheduler-8000 --assets all
curl -fsSL https://missionmedinstitute.com/wp-content/plugins/missionmed-hub/assets/student-os.646e3598d284fff3.js
curl -fsSL https://missionmedinstitute.com/wp-content/plugins/missionmed-hub/assets/student-os.js
curl -sS https://missionmedinstitute.com/member-dashboard/
curl -sS https://missionmedinstitute.com/wp-json/mmed/v1/study-blocks
```

Downloads were held in temporary files only for hashing and deleted. Browser and
Computer Use inspections were read-only; no credential was submitted.

The present public observations in the final reports were captured from
`2026-07-15T00:23:41Z` through `2026-07-15T00:23:42Z`. The lock manifest was also
inspected path-by-path: it inventories unversioned `assets/student-os.js`, not
the active public/recovered `assets/student-os.646e3598d284fff3.js`.

## Syntax, prototype, and rendered QA

```text
php -l <relevant PHP files>
node --check wp-content/plugins/missionmed-hub/assets/student-os.646e3598d284fff3.js
python3 -m http.server 8765 --bind 127.0.0.1
cp <D9-350 prototype> <temporary>/app350.html
cp <D9-360 prototype> <temporary>/app360.html
node <temporary D9-350 suite>
node <temporary D9-360 suite>
```

The suites returned 188/0 and 209/0. Local browser views covered desktop, 768x1024,
and 390x844. Temporary test/render files did not alter historical artifacts.

## Connector evidence

- GitHub connected-app reads confirmed repository/default branch/branch
  availability and existing D9 draft PR context.
- Google Drive searches used historical aliases; no direct product authority was
  found or modified.
- In-app Browser inspected local prototypes and anonymous public routes.
- Computer Use inspected the local prototype UI/accessibility state without
  input or mutation.

## Closeout commands

The deterministic closeout sequence is:

```text
python3 -m json.tool V1_8000_RUN_STATE.json
python3 -B V1_8000_BUILD_COMBINED.py
shasum -a 256 <all handoff files>
git diff --check
git status --short
git diff --name-only <base>...HEAD
<secret/private-data scans>
<clean-checkout deterministic regeneration and byte comparison>
git add <exact Markdown deliverables>
git add -f V1_8000_RUN_STATE.json V1_8000_BUILD_COMBINED.py
git commit -m 'V1-8000: reconcile V1 Study Schedule current state'
git push -u origin codex/v1-study-schedule-8000
gh pr create --draft --base d9-matrix-plan-415-source-recovery
```

A final `git fetch origin --prune` reconfirmed
`origin/d9-matrix-plan-415-source-recovery` at `d4455bf4ee40` and `origin/main`
at `9c1fa72e6b05`; the working branch was still exactly `0 0` from its source base
before the handoff commit, and the remote handoff branch was absent. The local
prototype HTTP server was terminated before closeout.

The commit hash, remote-branch result, draft-PR URL, and combined-handoff hash
are reported externally because a commit cannot embed its own identity and the
combined file cannot recursively embed its own hash. Exact index contents and
clean-checkout byte reproduction are final publication gates.
