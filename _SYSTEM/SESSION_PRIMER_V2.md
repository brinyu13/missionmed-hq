# DEPRECATED
# This file has been replaced by: _SYSTEM/PRIMER_CORE.md + extensions
# Extensions: PRIMER_EXT_HTML_DEPLOY.md, PRIMER_EXT_VISUAL.md, PRIMER_EXT_INTEGRITY.md
# Naming canon: _SYSTEM/NAMING_CANON.md
# Do NOT load this file. Load PRIMER_CORE.md instead.
# If a prompt references this file, redirect to PRIMER_CORE.md.
# Deprecation date: 2026-04-18
# Authority: MR-1367

# SESSION PRIMER V2 — MISSIONMED CONTROL LAYER
# Version: 1.5 | Created: 2026-03-28 | Updated: 2026-04-10 | Prompts: MRP-701, MRP-707, MR-SYS-001, MR-HQ-001, MR-HQ-003, MM-HTML-DEPLOYMENT-SYSTEM-LOCK-001
# =============================================
# PURPOSE: Routing + enforcement layer.
# Prevents drift, duplication, hallucination, and system breakage.
# Enforces learning read before and learning write after every task.
# This file is a CONTROL LAYER — not an execution engine.
# It does NOT replace system logic or duplicate automation.
# =============================================

---

## 1. PRE-FLIGHT SYSTEM CHECK (MANDATORY — RUNS BEFORE EVERY TASK)

Before executing ANY task, validate the following files exist and are accessible:

| File | Expected Location | Required |
|---|---|---|
| `MISSIONMED_MASTER_KNOWLEDGE.md` | `/Users/brianb/MissionMed/MISSIONMED_MASTER_KNOWLEDGE.md` | YES |
| `KNOWLEDGE_INDEX.md` | `/Users/brianb/MissionMed/08_AI_SYSTEM/MissionMed_AI_Brain/KNOWLEDGE_INDEX.md` | YES |
| `LEARNINGS_LOG.jsonl` | `/Users/brianb/MissionMed/_SYSTEM_LOGS/LEARNINGS_LOG.jsonl` | YES |
| `RULES_ENGINE.md` | `/Users/brianb/MissionMed/_SYSTEM/RULES_ENGINE.md` | YES |
| `read_learnings.py` | `/Users/brianb/MissionMed/_SYSTEM_LOGS/read_learnings.py` | YES |
| `append_learning.py` | `/Users/brianb/MissionMed/_SYSTEM_LOGS/append_learning.py` | YES |

**Rules:**

- If ANY required file is missing → **STOP. REPORT. DO NOT PROCEED.**
- If file exists but is empty (0 bytes) → treat as MISSING.
- If a file named `MASTER_INDEX.md` is referenced instead of `KNOWLEDGE_INDEX.md` → **WRONG FILE. HALT.**
- `/Users/brianb/MissionMed/` is the only valid MissionMed root. Any non-canonical MissionMed root reference is invalid and must be corrected before execution.
- Pre-flight results must be stated in the execution report. No silent passes.

---

## 2. SYSTEM INITIALIZATION

After pre-flight passes, load context from trusted sources ONLY:

1. `MISSIONMED_MASTER_KNOWLEDGE.md` — primary knowledge authority
2. `KNOWLEDGE_INDEX.md` — navigation router for all knowledge assets
3. Last 10 entries from `LEARNINGS_LOG.jsonl` — recent task memory
4. `RULES_ENGINE.md` — active cross-task rules
5. Task-specific system files referenced by the above two

**Prohibited sources:**

- Cached or memorized content from prior sessions (unless validated against current files)
- Any file not referenced in `KNOWLEDGE_INDEX.md` or explicitly provided in the prompt
- Assumptions about system state without file-level verification

**Mandatory learning read (BEFORE TASK):**

- MUST call `/Users/brianb/MissionMed/_SYSTEM_LOGS/read_learnings.py` before any task work begins.
- Load the last 10 learning entries from `/Users/brianb/MissionMed/_SYSTEM_LOGS/LEARNINGS_LOG.jsonl` using that script.
- If fewer than 10 entries exist, load all available entries and note the count in the execution report.
- The read is valid only if `read_learnings.py` exits successfully and returns parsed learning entries.
- If the script is not called, exits non-zero, the log file is missing, the log file is empty, the JSON is invalid, or the learnings are not actually loaded → **FAIL. STOP. DO NOT PROCEED.**
- Review `/Users/brianb/MissionMed/_SYSTEM/RULES_ENGINE.md` before executing task work.
- Starting work without this successful learning read = primer violation = **INVALID TASK**.

---

## 3. PRE-TASK INTELLIGENCE CHECK

Before starting work, answer these four questions with evidence (file paths, log entries, timestamps):

| Question | Evidence Required |
|---|---|
| Is this task already in progress elsewhere? | Check `MM_ACTIVITY_LOG.md` |
| Was this recently completed? | Check `MM_ACTIVITY_LOG.md` for matching prompt IDs |
| Does a solution already exist? | Search relevant directories + `KNOWLEDGE_INDEX.md` |
| Will this conflict with an existing system? | Cross-reference against active files and recent log entries |

**Decision matrix:**

- All clear → **PROCEED**
- Duplicate detected → **MODIFY APPROACH** (document why)
- Conflict detected → **ABORT** (report conflict details)
- Partial overlap → **PROCEED WITH SCOPE ADJUSTMENT** (document delta)

---

## 4. SCOPE LOCK

- Execute ONLY the defined task as stated in the prompt.
- No scope expansion without explicit justification logged in the execution report.
- If scope expansion is required for task completion, document: (a) what expanded, (b) why it was necessary, (c) what risk it introduces.
- Unrelated improvements discovered during execution → log as recommendations, do NOT implement.

---

## 5. SYSTEM RE-ANCHOR (CONTROLLED)

Re-read trusted source files at these three trigger points:

| Trigger | Action |
|---|---|
| Task start | Re-read `MISSIONMED_MASTER_KNOWLEDGE.md` + relevant sections of `KNOWLEDGE_INDEX.md` |
| Before risky changes (MEDIUM/HIGH risk) | Re-read source files relevant to the change area |
| Before final output | Validate output alignment against trusted sources |

**Rules:**

- Re-anchor is NOT a full system reload. Read only what is relevant to the current task.
- If re-anchor reveals drift from trusted sources → correct before proceeding.
- Re-anchor must be noted in execution report ("Re-anchored at: [trigger point]").

---

## 6. RISK CLASSIFICATION

Before execution, classify the task:

| Level | Definition | Requirements |
|---|---|---|
| **LOW** | No system impact. Read-only, documentation, analysis. | Standard execution. |
| **MEDIUM** | Localized changes. Single file edits, config changes, copy updates. | Re-anchor before execution. Validate after. |
| **HIGH** | Code changes, site changes, system architecture changes, deployment. | Full integrity check (Section 7). Screenshot protocol (Section 8). Re-anchor at all trigger points. |

**Rules:**

- Risk level must be stated in execution report.
- If unsure → classify UP (MEDIUM → HIGH), never down.
- Risk level determines which downstream checks are mandatory.

---

## 7. SYSTEM INTEGRITY CHECK (HIGH RISK ONLY)

Required when risk = HIGH. Execute ALL applicable checks:

**Frontend:**
- Pages load without errors
- Layout renders correctly (no broken elements, missing sections, shifted components)
- Navigation functions correctly

**Backend:**
- `/wp-admin` accessible and functional
- No PHP errors or white screens
- Database connections intact

**Functional:**
- Core user interactions work (forms, buttons, links, payments if applicable)
- No regressions introduced by the change

**Rules:**

- If ANY check fails → **FIX BEFORE REPORTING COMPLETE.**
- Document each check result: PASS / FAIL / NOT APPLICABLE.
- If a fix introduces a new failure → re-run full integrity check.

---

## 8. SCREENSHOT PROTOCOL (CONDITIONAL)

**Triggers — capture screenshots ONLY IF:**
- Task involves visual/frontend changes, OR
- Risk level = HIGH

**When triggered:**
- Capture before state (if modifying existing UI)
- Capture after state
- Store in `_SYSTEM_LOGS/` or task-specific output directory
- Report filenames in execution report

**When NOT triggered:**
- Backend-only changes at LOW/MEDIUM risk
- Documentation-only tasks
- Analysis/audit tasks with no visual output

---

## 9. LEARNING ENGINE (MANDATORY — RUNS AFTER EVERY TASK)

At the end of EVERY task, regardless of risk level or outcome, record:

```
LEARNING UPDATE:
1. WHAT WORKED: [specific techniques, approaches, or tools that succeeded]
2. WHAT FAILED: [specific failures, errors, or dead ends — "none" is acceptable]
3. WHAT TO CHANGE: [process improvements for next time — "none" is acceptable]
4. NEW RULE: [if a new enforcement rule is needed, state it — otherwise "none"]
5. KB UPDATE: [if KNOWLEDGE_INDEX.md or MASTER_KNOWLEDGE needs updating, specify what]
```

**Rules:**

- Learning update must appear in the execution report AND be appended to `/Users/brianb/MissionMed/_SYSTEM_LOGS/LEARNINGS_LOG.jsonl`.
- "None" is a valid entry for items 2–5. Item 1 must always have content.
- MUST call `/Users/brianb/MissionMed/_SYSTEM_LOGS/append_learning.py` after final verification and before task completion.
- Append the structured learning entry with `/Users/brianb/MissionMed/_SYSTEM_LOGS/append_learning.py`.
- Required JSONL fields: `timestamp`, `task_id`, `summary`, `what_worked`, `what_failed`, `change`, `rule`, `source`.
- `source` must be `task`.
- If a new rule is identified (item 4), flag it for update in `/Users/brianb/MissionMed/_SYSTEM/RULES_ENGINE.md`.

**Persistence step (AFTER TASK):**

- Final verification must complete before the learning append.
- Append exactly one structured learning update for the task.
- If `append_learning.py` is not called, exits non-zero, the log file is missing, a duplicate/non-write result occurs, or no new learning entry is written → **FAIL. STOP. TASK CANNOT BE `COMPLETE`.**
- A response other than `status=appended` does not satisfy completion.

---

## 10. DUPLICATION RULE

Before creating any new file or system component, run deterministic checks:

| Check | Method |
|---|---|
| File already exists? | Check target path directly |
| Similar output exists? | Search `MM_ACTIVITY_LOG.md` for matching task descriptions |
| Component already built? | Search `KNOWLEDGE_INDEX.md` for matching entries |

**If duplicate detected:**

- Do NOT create a second version.
- MODIFY APPROACH: extend, update, or reference the existing asset.
- Document in execution report: "Duplicate detected at [path]. Modified approach to [action]."

---

## 11. COMPLETION STANDARD

A task is COMPLETE only when ALL of the following are true:

- [ ] Pre-flight check executed and passed (Section 1)
- [ ] `read_learnings.py` was called before task work and the required learnings were successfully loaded (Section 2)
- [ ] Active rules reviewed (Section 2)
- [ ] Pre-task intelligence check completed (Section 3)
- [ ] Scope lock maintained or expansion justified (Section 4)
- [ ] Risk classification stated (Section 6)
- [ ] All risk-appropriate checks passed (Sections 7–8)
- [ ] No system breakage detected
- [ ] `append_learning.py` was called after task work and successfully appended a learning update to `LEARNINGS_LOG.jsonl` (Section 9)
- [ ] Execution report written (Section 13)
- [ ] Activity log entry appended to `MM_ACTIVITY_LOG.md`

**If any item is not satisfied, or if learning read/write enforcement failed at any point → task status = PARTIAL, not COMPLETE.**

---

## 12. FAILURE CONDITIONS

A task is INVALID (not just incomplete — structurally invalid) if:

- Pre-flight was skipped entirely
- `read_learnings.py` was not called before task execution
- Last 10 learnings were not successfully loaded before task execution
- Drift from trusted sources was detected and ignored
- System breakage was introduced and not resolved
- `append_learning.py` was not called after task execution
- Learning update is missing or was not appended to `LEARNINGS_LOG.jsonl`
- Task was marked `COMPLETE` without a successful learning read and learning write
- Activity log entry was not written
- A HIGH-risk task was executed without integrity checks

**Recovery from INVALID state:**

1. Stop current execution
2. Re-run pre-flight (Section 1)
3. Re-anchor (Section 5)
4. Re-execute from the point of failure
5. Document the failure and recovery in the execution report

---

## 13. EXECUTION REPORT FORMAT (REQUIRED)

Every task must end with this report structure:

```
REPORT:

WHAT WAS DONE:
- [Actions taken]

RESULT:
- [Outcome]

RISK LEVEL: [LOW / MEDIUM / HIGH]

ISSUES:
- [Problems encountered — "none" if clean]

FIXES:
- [How issues were resolved — "none" if clean]

VERIFICATION:
- [What was tested and results]

LEARNING UPDATE:
1. WHAT WORKED: [...]
2. WHAT FAILED: [...]
3. WHAT TO CHANGE: [...]
4. NEW RULE: [...]
5. KB UPDATE: [...]

STATUS: [COMPLETE / PARTIAL / INVALID]
```

---

## 14. QUICK REFERENCE — DECISION FLOW

```
START
  │
  ├─ PRE-FLIGHT (Section 1)
  │    ├─ PASS → continue
  │    └─ FAIL → STOP + REPORT
  │
  ├─ INITIALIZE (Section 2) — MUST call read_learnings.py + load trusted sources + active rules
  │    ├─ PASS → continue
  │    └─ FAIL → STOP + REPORT
  │
  ├─ INTELLIGENCE CHECK (Section 3)
  │    ├─ Clear → PROCEED
  │    ├─ Duplicate → MODIFY
  │    └─ Conflict → ABORT
  │
  ├─ SCOPE LOCK (Section 4)
  │
  ├─ RISK CLASSIFY (Section 6)
  │    ├─ LOW → execute
  │    ├─ MEDIUM → re-anchor + execute
  │    └─ HIGH → re-anchor + execute + integrity check + screenshots
  │
  ├─ EXECUTE TASK
  │
  ├─ RE-ANCHOR before output (Section 5)
  │
  ├─ VERIFY (Sections 7–8 if applicable)
  │
  ├─ LEARNING ENGINE (Section 9) — MUST call append_learning.py and append to LEARNINGS_LOG.jsonl
  │    ├─ PASS → continue
  │    └─ FAIL → STOP + REPORT + STATUS PARTIAL/INVALID
  │
  ├─ EXECUTION REPORT (Section 13)
  │
  └─ ACTIVITY LOG WRITE → DONE
```

---

## 15. SYSTEM NAMING CANON (MANDATORY — ENFORCED IN ALL PROMPTS)

**Effective:** 2026-03-29 | **Authority:** MR-SYS-001, MR-HQ-003 | **Status:** LOCKED — PERMANENT

All AI-generated output, internal references, logs, architecture documents, and user-facing copy MUST use the canonical names below. No exceptions.

### Platform Name

**MissionMed HQ**

### Module Names (Canonical)

| Module | Scope |
|--------|-------|
| **MedMail** | Email + communication engine |
| **Leads** | Lead tracking + conversion |
| **Payments** | Stripe + billing + enrollment |
| **Students** | Admin student management |
| **MissionMed Member Dashboard** | Student-facing portal |
| **Media Engine** | Video storage + tagging + scoring |
| **Studio** | Video editing |

### Internal System

| System | Note |
|--------|------|
| **Admin Engine** | Internal admin runtime — DO NOT expose publicly |

### Instructor Panel

The Instructor Panel has been fully absorbed into:
- **Payments** (instructor payment flows)
- **Students** (instructor-student management)
- **Settings** (instructor configuration)

It no longer exists as a standalone module.

### Deprecated Names — Auto-Correct Rules

If ANY of the following deprecated names appear in a prompt, internal reference, or output, they MUST be auto-corrected to the canonical name before execution:

| Deprecated Name | Correct Canonical Name |
|-----------------|----------------------|
| Admin HQ | MissionMed HQ |
| MissionMed ADMIN HQ | MissionMed HQ |
| MCC | Admin Engine (internal) / MissionMed HQ (platform) |
| MCC UI | MissionMed HQ |
| Pipeline | Leads |
| AI Dashboard | MissionMed HQ |
| MMVS | Media Engine |
| Instructor Panel | (absorbed — route to Payments / Students / Settings) |
| Command Center | Admin Engine |

### Enforcement

- This naming canon applies to ALL threads, ALL tasks, ALL outputs.
- Violation of naming canon = drift = must be corrected before task completion.
- If a prompt references a deprecated name, the AI must silently resolve to the canonical name and proceed.

---

## 16. NAVIGATION STRUCTURE (MANDATORY — ENFORCED IN ALL PROMPTS)

**Effective:** 2026-03-29 | **Authority:** MR-HQ-001 | **Status:** LOCKED — PERMANENT

The MissionMed HQ top navigation uses the following tab order. All implementations, wireframes, and architecture references MUST use this structure.

| Position | Tab | Module |
|----------|-----|--------|
| 1 | Home | HQ Dashboard |
| 2 | Payments | Payments |
| 3 | Students | Students |
| 4 | MedMail | MedMail |
| 5 | Leads | Leads |
| 6 | Media Engine | Media Engine |
| 7 | Studio | Studio |
| 8 | Settings | Settings |

### Enforcement

- This navigation order is LOCKED. No tabs may be added, removed, or reordered without a new MR-HQ-series prompt.
- The MissionMed Member Dashboard is a separate student-facing portal — it does NOT appear in the HQ navigation.
- The Admin Engine is internal runtime infrastructure — it does NOT appear as a visible tab.

---

## 17. THEME SYSTEM (MANDATORY — ENFORCED IN ALL PROMPTS)

**Effective:** 2026-03-29 | **Authority:** MR-HQ-001 | **Status:** LOCKED — PERMANENT

MissionMed HQ supports three visual themes. All themes share the SAME layout and navigation structure — only the visual layer (colors, typography, spacing, surface treatments) changes.

| # | Theme Name | Visual Reference | Default |
|---|-----------|-----------------|---------|
| 1 | **Classic** | RankListIQ style | YES (default) |
| 2 | **Operations** | Current Admin Engine (formerly MCC) style | No |
| 3 | **Media** | Media Engine (formerly MMVS) style | No |

### Rules

- Layout is IDENTICAL across all three themes. No theme may alter navigation structure, tab order, or module placement.
- Theme switching affects CSS/visual layer ONLY.
- Classic is always the default theme for new users.
- Theme preference is stored per-user.

---

## 18. SYSTEM MAPPING (MANDATORY REFERENCE)

**Effective:** 2026-03-29 | **Authority:** MR-HQ-001 | **Status:** LOCKED — PERMANENT

Each HQ tab maps to one or more existing backend systems. This mapping defines the data source and integration layer for each module.

| Tab | Backend System(s) | Notes |
|-----|-------------------|-------|
| **Home** | HQ Dashboard | Aggregated view — pulls summary data from all modules |
| **MedMail** | `AI_EMAIL_ENGINE/` | Email response engine + intelligence module |
| **Leads** | `LEAD_PIPELINE_UI/` | Lead pipeline management + scoring |
| **Payments** | Stripe Connect + MMI Instructor API + Admin Engine REST | Direct charges, enrollment, billing |
| **Students** | Admin Engine + Supabase student views | Student management, enrollment status, progress |
| **Media Engine** | MMVS / CIE unified endpoint | Video storage, tagging, scoring, MMVC bridge |
| **Studio** | Studio | Video editing workspace |
| **Member Dashboard** | LearnDash | Student-facing portal (separate from MissionMed HQ) |
| **Settings** | WordPress options + Supabase config | Platform settings, instructor config, theme selection |

### Integration Architecture

- **Admin Engine** is the internal runtime that powers the Admin HQ shell (formerly MCC / Command Center). It handles authentication, routing, REST proxy, and WordPress admin integration.
- **Supabase** is the operational data layer for Students, Leads, and system state.
- **Stripe Connect** uses direct charges with per-instructor application fees (MR-ARCH-003/004).
- **CIE** (Content Intelligence Engine) provides the unified read model for Media Engine (MR-1415/1416).
- **LearnDash** powers the Member Dashboard and course delivery — Admin HQ reads but does not directly modify LearnDash data.

---

## 19. ARCHITECTURE MODEL (MANDATORY — ENFORCED IN ALL PROMPTS)

**Effective:** 2026-03-29 | **Authority:** MR-HQ-003 | **Status:** LOCKED — PERMANENT

### Corrected Architecture

The previous architecture (MR-ARCH-001, MR-HQ-002) incorrectly implemented the MCC WordPress plugin as the PRIMARY UI shell with MASTER_STABLE_SYSTEM modules embedded inside it. **This is wrong and is hereby corrected.**

### PRIMARY SYSTEM

**MASTER_STABLE_SYSTEM = MissionMed HQ (MAIN APPLICATION)**

The MASTER_STABLE_SYSTEM is the primary UI shell and main application. It contains the full intelligence suite: the HQ Dashboard, Email Engine (MedMail), Lead Pipeline (Leads), Kanban task board, conversion analytics, student archetypes, and the shared state engine. This is the product.

### SECONDARY SYSTEM

**WordPress = Backend / API / Auth / Payments ONLY**

WordPress serves as the backend infrastructure layer. Its responsibilities are limited to:

| Responsibility | Details |
|---------------|---------|
| **Authentication** | WordPress admin roles and user session management |
| **REST API** | `missionmed-command-center/v1` namespace for data endpoints |
| **Payments** | Stripe Connect, WooCommerce, enrollment processing |
| **Data Proxy** | Supabase connectivity, CIE proxy bridge |
| **Course Delivery** | LearnDash integration for MissionMed Member Dashboard |

WordPress does NOT own the UI shell. It does NOT define the navigation structure. It does NOT render the primary admin interface.

### Implementation Implication

All future implementation threads must treat MASTER_STABLE_SYSTEM as the source of truth for:

- Navigation structure and tab order
- Module layout and visual hierarchy
- State management and cross-module coordination
- Admin UI rendering and interaction patterns

WordPress plugin code serves these modules by providing authenticated data endpoints and backend services — it does not wrap or contain them.

### Deprecated Architecture Pattern

The following pattern is DEPRECATED and must not be used:

```
WRONG: WordPress plugin (MCC) → embeds MASTER_STABLE modules as iframes/sub-views
```

The correct pattern is:

```
CORRECT: MissionMed HQ (MASTER_STABLE) → consumes WordPress REST API / Auth / Payments as backend services
```

---

## 20. HTML DEPLOYMENT SYSTEM LOCK (MANDATORY — ENFORCED IN ALL PROMPTS)

**Effective:** 2026-04-10 | **Authority:** MM-HTML-DEPLOYMENT-SYSTEM-LOCK-001 | **Status:** LOCKED — PERMANENT

This rule governs ALL modifications to the three MissionMed single-file HTML applications that are hosted via WordPress Media Library and loaded into Elementor through an HTML widget.

### Covered Systems (Identical Deployment Architecture)

| # | System | File | Source of Truth |
|---|--------|------|-----------------|
| 1 | Arena | `arena.html` | `/Users/brianb/MissionMed/arena.html` |
| 2 | Drills | `drills.html` | `/Users/brianb/MissionMed/drills.html` |
| 3 | RankListIQ | `ranklistiq.html` | `/Users/brianb/MissionMed/ranklistiq.html` |

All three are single-file HTML applications. The HTML file IS the production system. Elementor, the WordPress editor, inline page edits, and partial script injections are NOT sources of truth.

### Mandatory Workflow (Auto-Enforced For Every Modification)

1. **LOAD CURRENT PRODUCTION FILE**
   - Locate and use the latest version of `arena.html`, `drills.html`, or `ranklistiq.html`.
   - NEVER recreate from scratch.

2. **AUTO BACKUP (REQUIRED BEFORE ANY EDIT)**
   - Create a timestamped backup in the same directory as the source file:
     `{system}_BACKUP_YYYY-MM-DD_HHMM.html`
   - Examples:
     `arena_BACKUP_2026-04-10_2052.html`
     `drills_BACKUP_2026-04-10_2052.html`

3. **VERSION HEADER (REQUIRED AT TOP OF FILE)**
   ```
   <!--
   SYSTEM: ARENA | DRILLS | RANKLISTIQ
   VERSION: YYYY-MM-DD HH:MM
   CHANGE: short description
   AUTHORITY: MM-HTML-DEPLOYMENT-SYSTEM-LOCK-001
   SOURCE OF TRUTH: This file. Do NOT edit in Elementor or WordPress.
   -->
   ```

4. **SAFE MODIFICATION RULES**
   - Modify ONLY the required sections.
   - DO NOT remove working logic unless explicitly required by the task.
   - DO NOT break any of: avatar rendering, drill engine, API calls, localStorage state, UI state, auth flow.

5. **FULL FILE OUTPUT ONLY**
   - Any AI that modifies an HTML file MUST return / write the FULL file.
   - NO truncation. NO `"rest unchanged"`. NO partial diffs that drop content.

6. **DEPLOYMENT INSTRUCTION (MUST BE INCLUDED IN EXECUTION REPORT)**
   - Upload updated HTML to WordPress Media Library.
   - Replace existing file (same filename).
   - Clear cache if needed.

### Strict Prohibitions

- DO NOT edit the system directly in Elementor.
- DO NOT inject partial JavaScript snippets via WordPress.
- DO NOT split logic across multiple files.
- DO NOT create alternate HTML versions (e.g. `arena_v2.html`).
- DO NOT bypass the backup step.
- DO NOT skip the version header update.

### Versioning Tool (CANONICAL)

The canonical versioning tool is:

```
/Users/brianb/MissionMed/_SYSTEM/mm_html_versioner.py
```

Usage:

```
python3 _SYSTEM/mm_html_versioner.py arena.html "short change description"
python3 _SYSTEM/mm_html_versioner.py drills.html "short change description"
python3 _SYSTEM/mm_html_versioner.py ranklistiq.html "short change description"
```

Responsibilities of the tool:
- Validates the file is a canonical system (arena / drills / ranklistiq).
- Creates a timestamped backup before any modification.
- Inserts or replaces the version header at the top of the file.
- Preserves DOCTYPE when present.
- Aborts and restores from backup on any unexpected content loss.
- Prints the required deployment instructions.

### Enforcement

- This rule applies to ALL threads, ALL tasks, ALL AIs working on MissionMed HTML deployments.
- Any modification to `arena.html`, `drills.html`, or `ranklistiq.html` that does NOT follow this workflow is a deployment-protocol violation and must be corrected before the task can be marked COMPLETE.
- No reminder is required. No deviation is allowed.

---

## END OF SESSION PRIMER V2
