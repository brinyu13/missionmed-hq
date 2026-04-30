# PRIMER CORE — MissionMed Workflow OS

**Version:** 1.0 | **Date:** 2026-04-18 | **Authority:** MR-1367
**Purpose:** Routing + enforcement core for the MissionMed Workflow OS. Prevents drift, enforces the learning cycle, and classifies risk deterministically. Control layer only — not an execution engine.

---

## 1. PRE-FLIGHT CHECK

Validate these 3 files exist before task work begins:

- `/Users/brianb/MissionMed/_SYSTEM/PRIMER_CORE.md`
- `/Users/brianb/MissionMed/08_AI_SYSTEM/MissionMed_AI_Brain/KNOWLEDGE_INDEX.md`
- `/Users/brianb/MissionMed/_SYSTEM_LOGS/LEARNINGS_LOG.jsonl`

If ANY missing → STOP. REPORT. DO NOT PROCEED. `/Users/brianb/MissionMed/` is the canonical MissionMed root for normal branch-based work. Worktrees are optional advanced recovery tools only. Any non-canonical root reference outside this layout is invalid and must be corrected before execution.

---

## 2. INITIALIZATION

- Call `/Users/brianb/MissionMed/_SYSTEM_LOGS/read_learnings.py` and load the last 10 entries from `LEARNINGS_LOG.jsonl`.
- Review `/Users/brianb/MissionMed/_SYSTEM/RULES_ENGINE.md` before executing task work.
- Starting work without a successful learning read = INVALID TASK.

---

## MISSIONMED SIMPLE GIT WORKFLOW + AI LOGGING - MANDATORY FOR EVERY THREAD

This section is mandatory and overrides any older conflicting logging/workspace behavior in this file.

1. `/Users/brianb/MissionMed` is the primary local repo.
2. `main` should stay clean.
3. For implementation work, use a normal Git branch inside `/Users/brianb/MissionMed`.
4. Before editing, run:
   - `git status --short`
   - `git branch --show-current`
5. If on `main`, create or switch to a task branch before editing.
6. If the repo is dirty from unrelated work, stop and report.
7. Do not use `git reset`, `git clean`, destructive cleanup, deploy, push, pull, rebase, or merge unless explicitly authorized.
8. Claude/demo/scratch/report outputs must stay outside the repo in `/Users/brianb/MissionMed_AI_Sandbox/`.
9. Newest AI outputs go to `/Users/brianb/MissionMed_AI_Sandbox/_RECENT_AI_OUTPUTS/`.
10. Routine AI logs go to `/Users/brianb/MissionMed_AI_Sandbox/_ACTIVITY_LOGS/`.
11. The repo `MM_ACTIVITY_LOG.md` is curated only and should not be updated by routine demo/planning tasks.
12. Worktrees are optional advanced recovery tools, not the default workflow.
13. Do not broadly ignore production folders.
14. Do not touch Drill ingestion/runtime unless explicitly scoped.
15. If unsure where to work or save output, stop and ask.

### Future Prompt Requirement Block (Copy/Paste)

```text
Load _SYSTEM/PRIMER_CORE.md and apply all rules.
Use the MissionMed simple Git workflow defaults.
Use /Users/brianb/MissionMed as the primary repo and keep main clean.
For implementation work, create/switch to a normal task branch in /Users/brianb/MissionMed.
Run bash _SYSTEM/scripts/mm-preflight.sh before editing.
If preflight fails, stop and report.
If currently on main and edits are planned, switch to a non-main branch first.
If repo is dirty from unrelated work, stop and report.
For Claude demos, reports, standalone HTML, mockups, screenshots, scratch files, backups, generated outputs, and routine logs, do not save inside /Users/brianb/MissionMed.
Save outputs to /Users/brianb/MissionMed_AI_Sandbox/_RECENT_AI_OUTPUTS/ and save routine logs to /Users/brianb/MissionMed_AI_Sandbox/_ACTIVITY_LOGS/.
Only update /Users/brianb/MissionMed/_SYSTEM_LOGS/MM_ACTIVITY_LOG.md when making intentional repo changes and commit that curated summary with related work.
Worktrees are optional tools, not the default.
Do not run reset, git clean, destructive cleanup, deploy, push, pull, rebase, or merge unless explicitly authorized.
```

---

## 3. TASK ROUTER

Consult `KNOWLEDGE_INDEX.md` for task-specific file loading. Do not begin work until the required knowledge sources have been consulted. Files marked P0 are always required.

---

## 4. NAMING CANON

Load and enforce `/Users/brianb/MissionMed/_SYSTEM/NAMING_CANON.md`. Auto-correct deprecated names on sight. Violation = drift = must be corrected before task completion.

---

## 5. SCOPE LOCK

- Execute ONLY the defined task as stated in the prompt.
- No scope expansion without explicit justification logged in the execution report.
- Unrelated improvements → log as recommendations; do NOT implement.

---

## 6. RISK CLASSIFICATION

Deterministic table. No judgment calls. The table is authoritative.

| Task Type | Risk |
|-----------|------|
| CONTENT / AUDIT / STRATEGY | LOW |
| PLAN | MEDIUM |
| FIX (non-prod) / BUILD (new files) | MEDIUM |
| BUILD (modify existing) / FIX (production) / DEPLOY | HIGH |

Risk level must be stated in the execution report.

---

## 7. COMPLETION STANDARD

A task is COMPLETE only when ALL of the following are true:

- [ ] Output file(s) exist
- [ ] Execution report written (§8)
- [ ] Learning appended via `append_learning.py` (§9)
- [ ] Activity logging handled via policy:
  - routine logs written to external `/Users/brianb/MissionMed_AI_Sandbox/_ACTIVITY_LOGS/`
  - repo `MM_ACTIVITY_LOG.md` updated only for intentional implementation summaries committed with related code/doc changes
- [ ] NEXT ACTION block produced

Any unchecked item → status = PARTIAL, not COMPLETE.

---

## 8. EXECUTION REPORT FORMAT (3 TIERS)

**LOW:** WHAT WAS DONE · RESULT · STATUS
**MEDIUM:** adds ISSUES · FIXES
**HIGH:** adds RISK LEVEL · VERIFICATION · LEARNING UPDATE (5 fields)

LEARNING UPDATE fields (HIGH only): WHAT WORKED, WHAT FAILED, WHAT TO CHANGE, NEW RULE, KB UPDATE.

---

## 9. LEARNING ENGINE

After every task, regardless of risk or outcome:

- Call `/Users/brianb/MissionMed/_SYSTEM_LOGS/append_learning.py`.
- Include `priority`: CRITICAL / STANDARD / LOW.
- Required JSONL fields: `timestamp`, `task_id`, `summary`, `what_worked`, `what_failed`, `change`, `rule`, `source`, `priority`.
- A response other than `status=appended` does not satisfy completion. If the script is not called, exits non-zero, or writes no new entry → FAIL. STATUS = PARTIAL or INVALID.

---

## 10. EXTENSION LOADER

Load the relevant extension when its trigger condition is met:

| Extension | Load When |
|-----------|-----------|
| `PRIMER_EXT_HTML_DEPLOY.md` | Task modifies `arena.html`, `drills.html`, or `ranklistiq.html` |
| `PRIMER_EXT_VISUAL.md` | Task involves frontend/UI changes at MEDIUM or HIGH risk |
| `PRIMER_EXT_INTEGRITY.md` | Risk = HIGH |
| `MM-AUTH-ARCH-001.md` | Task touches auth flow, session management, CORS, Arena auth, HQ auth, Supabase bootstrap, or `/api/auth/*` endpoints |

Extensions live in `/Users/brianb/MissionMed/_SYSTEM/`.

---

## DECISION FLOW

```
START
  │
  ├─ PRE-FLIGHT (§1) ── FAIL → STOP + REPORT
  ├─ INITIALIZE (§2) ── read_learnings.py + RULES_ENGINE.md
  ├─ TASK ROUTER (§3) ── load files per KNOWLEDGE_INDEX.md
  ├─ NAMING CANON (§4) ── auto-correct deprecated names
  ├─ SCOPE LOCK (§5)
  ├─ RISK CLASSIFY (§6) ── deterministic table
  │    ├─ LOW → execute
  │    ├─ MEDIUM → execute (+ EXT_VISUAL if UI)
  │    └─ HIGH → EXT_INTEGRITY (+ EXT_VISUAL if UI) → execute
  ├─ EXT LOADER (§10) ── HTML deploy / visual / integrity
  ├─ EXECUTE TASK
  ├─ VERIFY
  ├─ LEARNING ENGINE (§9) ── append_learning.py
  │    └─ FAIL → STATUS = PARTIAL
  ├─ EXECUTION REPORT (§8) ── 3-tier
  └─ EXTERNAL LOG (ROUTINE) OR CURATED REPO LOG (IMPLEMENTATION) + NEXT ACTION → DONE (§7)
```

---

END OF PRIMER CORE

## 🔒 MISSIONMED DEPLOYMENT VALIDATION PROTOCOL (MANDATORY)

This protocol overrides all prior deployment behavior and is NON-NEGOTIABLE.

=== MISSIONMED DEPLOYMENT VALIDATION PROTOCOL (MANDATORY) ===

ALL production HTML updates MUST follow:

1. BACKUP
2. MODIFY
3. VALIDATE
4. DEPLOY (ONLY IF VALIDATION PASSES)

DEPLOYMENT WITHOUT VALIDATION IS FORBIDDEN.

---

VALIDATION REQUIREMENTS:

A. MMOS:
- arena.html MUST have window.MMOS + MMOS.registerMode + Topbar
- stat.html MUST have window.MMOS + MMOS.registerMode + Topbar
- drills.html MUST have window.MMOS + MMOS.registerMode + Topbar
- daily.html is NOT required to include MMOS
- daily.html without MMOS = PASS (expected)

B. ROUTING:
- Arena → STAT works
- Arena → Daily Rounds opens menu (NOT drills directly)
- Daily → drills only via valid contract

C. DRILL CONTRACT:
- Validate drills engine ONLY when launched via Daily Rounds flow using a valid contract
- Valid contract MUST include mm_selected_drill OR query.video_id
- Direct /drills load without contract is NOT a failure
- “No valid drill contract” is a failure ONLY during contract-bearing launch validation

D. AUTH:
- Uses Railway exchange/bootstrap
- supabase.auth.setSession + getUser present
- No wp-json identity logic
- In STAGING or no-session environments, 401 responses are expected and are NOT failures
- Auth fails ONLY when authenticated flow is explicitly broken

E. NETWORK:
- No 404 JS
- No MIME errors
- No blocking runtime errors

F. UI:
- STAT clickable
- Daily Rounds clickable
- No dead zones
- UI clickable checks apply only when no auth redirect and no blocking overlay is present
- If auth redirect is present, UI clickable validation = SKIP (not fail)

## ROLE-BASED VALIDATION

- Validate each file according to its runtime role.
- Do NOT apply MMOS requirements to daily.html.
- Do NOT evaluate drills contract behavior using direct /drills without contract.
- Do NOT treat expected staging/no-session auth outcomes as deployment blockers.
- Deployment is blocked only by role-relevant failures.

---

IF ANY CHECK FAILS:
→ STOP
→ DO NOT DEPLOY

---

DEPLOYMENT RULE:

ONLY deploy to:

html-system/LIVE/
- arena.html
- stat.html
- drills.html
- daily.html

---

CHANGELOG REQUIRED:

Append to:

/CHANGELOG/CHANGELOG_MASTER.md

Entry must include:
- timestamp
- prompt ID
- files changed
- result (PASS/FAIL)
- deployed (YES/NO)

---

THIS PROTOCOL APPLIES TO ALL FUTURE CODEX OPERATIONS.

=== END PROTOCOL ===
