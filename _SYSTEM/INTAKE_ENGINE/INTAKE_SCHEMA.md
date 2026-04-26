# MMOS INTAKE SCHEMA

**Version:** 1.0
**Date:** 2026-04-18
**Authority:** MR-1367 (Workflow OS) + MR-1377 (Operator Manual pattern)
**Purpose:** Contract defining every field the MMOS Intake Engine captures to generate a complete execution manual. Domain-agnostic: supports BUILD, AUDIT, FIX, DEPLOY, CONTENT, PLAN, and SYSTEM_MIGRATION workflows.

---

## 1. SCHEMA DESIGN PRINCIPLES

- **One intake → one manual.** Every field maps deterministically to an output block.
- **Required vs optional.** REQUIRED fields gate manual generation. OPTIONAL fields render conditional blocks.
- **No hidden logic.** If a block should appear in the manual, a field must exist in the schema.
- **Workflow-type-aware.** Some blocks (e.g., `protected_systems`, `deployment_warnings`) auto-render only for applicable workflow types.

---

## 2. TOP-LEVEL STRUCTURE

```
META            — identity, authorship, version, authority
WORKFLOW        — type, sub-type, risk posture
OVERVIEW        — summary, what gets built, file manifest
RULES           — global execution rules
PROTECTION      — protected systems + deployment warnings (optional)
PHASES[]        — ordered list of phases (each contains steps[] + gate)
THREAD_RULES    — new/same thread triggers + transitions
FAILURES        — failure cheat sheet
SESSIONS        — chunked session plan
TRACKER         — auto-derived from phases/steps
```

---

## 3. FIELD DEFINITIONS

### 3.1 META (REQUIRED)

| Field | Type | Required | Validation | Notes |
|-------|------|----------|------------|-------|
| `project_letter` | string (A–Z) | YES | Single uppercase letter | Used in `({PROJECT})` prompt tokens |
| `manual_id` | string | YES | Format: `MR-NNNN` or `MR-SYS-NNN` | Authority reference |
| `manual_title` | string | YES | 4–80 chars | Appears in header |
| `short_title` | string | YES | 2–40 chars | Sidebar + badge |
| `version` | string | YES | Semver-ish (`1.0`, `2.1`) | Auto-stamped to header |
| `date` | ISO date | YES | `YYYY-MM-DD` | Auto-defaults to today |
| `authority` | string | YES | MR reference list | e.g., `MR-1367 + MR-1377` |
| `purpose` | string | YES | 1–2 sentences | Header subtitle |

### 3.2 WORKFLOW (REQUIRED)

| Field | Type | Required | Values |
|-------|------|----------|--------|
| `workflow_type` | enum | YES | `BUILD` \| `AUDIT` \| `FIX` \| `DEPLOY` \| `CONTENT` \| `PLAN` \| `SYSTEM_MIGRATION` |
| `sub_type` | string | NO | Free text, shown as badge |
| `baseline_risk` | enum | YES | `LOW` \| `MEDIUM` \| `HIGH` (overridable per step) |
| `naming_format` | string | YES | Default: `({PROJECT})-{MANUAL}-PH{#}-{AI}-{LEVEL}-{###}` |
| `thread_format` | string | YES | Default: `({PROJECT}) — [Short Task Description]` |
| `result_header_required` | boolean | YES | Default: true |

### 3.3 OVERVIEW (REQUIRED)

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `total_phases` | integer | YES (auto-derived from PHASES[]) | |
| `total_prompts` | integer | YES (auto-derived) | |
| `total_sessions` | integer | YES (auto-derived from SESSIONS[]) | |
| `estimated_time` | string | YES | e.g., `2.5–3.5 hours across 3 sessions` |
| `models_used` | string | YES | Free text summary, e.g., `Claude Opus (4), Sonnet (5), Codex (2)` |
| `what_gets_built` | string | YES | 1–3 sentence executive summary |
| `file_manifest` | array of `{file, phase, purpose}` | NO | Rendered as "What Gets Created" table |

### 3.4 RULES (OPTIONAL block, auto-defaults supplied)

| Field | Type | Default |
|-------|------|---------|
| `execution_rules` | array of strings | 5 sensible defaults (never skip phases, run gates, checkpoint after each phase, etc.) |
| `fail_fast_rule` | string (markdown) | Standard FAIL FAST block (5 steps) |
| `deploy_source_of_truth` | string (optional) | Only renders if workflow_type = `DEPLOY` or `SYSTEM_MIGRATION` |
| `result_header_block` | auto | Generated from `result_header_required` |

### 3.5 PROTECTION (OPTIONAL)

| Field | Type | Notes |
|-------|------|-------|
| `protected_systems` | array of `{system, reason}` | Renders "Protected System Lock" card |
| `deployment_warnings` | array of strings | Renders warning highlights |

### 3.6 PHASES[] (REQUIRED, 1–N)

Each phase object:

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `number` | integer | YES | 0-indexed OK |
| `name` | string | YES | |
| `intro` | string | YES | 1-sentence purpose |
| `steps` | array | YES | See §3.7 |
| `gate` | object | YES | See §3.8 |

### 3.7 STEPS[] inside a phase

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `number` | string | YES | e.g., `1.1`, `2.3` |
| `name` | string | YES | |
| `ai` | enum | YES | `Claude` \| `Codex` \| `Other` |
| `model` | string | YES | e.g., `Opus Required`, `Sonnet OK` |
| `time_min` | integer | YES | minutes |
| `time_max` | integer | YES | minutes |
| `token_estimate` | string | NO | e.g., `~10K tokens` |
| `ai_fit_claude` | integer 0–10 | NO | |
| `ai_fit_codex` | integer 0–10 | NO | |
| `ai_fit_note` | string | NO | Short rationale |
| `dependency` | string | NO | e.g., `Requires: Phase 0 gate PASSED` |
| `safe_to_run` | string | NO | e.g., `YES` or `Only if Phase 0 passed` |
| `what_you_do` | string | YES | Operator-facing instruction |
| `prompt_body` | string (multiline) | YES | The embedded copy-paste prompt |
| `prompt_label` | string | NO | e.g., `Copy This Prompt`, `Copy to Codex` |
| `success_criteria` | string | YES | What `RESULT: COMPLETE` looks like |
| `failure_recovery` | string | NO | What to do if it fails |
| `confidence_pct` | integer 0–100 | NO | Renders confidence box |
| `confidence_gap` | string | NO | |
| `confidence_improvement` | string | NO | |
| `pre_action` | string | NO | e.g., `Run git checkpoint first` |
| `post_action` | string | NO | e.g., `Run git diff to verify` |

### 3.8 GATE (per phase)

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `checks` | array of strings | YES | Rendered as `[ ]` checklist |
| `all_pass_action` | string | YES | e.g., `git add -A && git commit -m "CHECKPOINT: Phase 1 complete"` |
| `any_fail_action` | string | YES | Default: `Fix the failing check. Re-verify.` |
| `transition_confidence_pct` | integer | NO | |
| `transition_confidence_gap` | string | NO | |
| `transition_confidence_improvement` | string | NO | |

### 3.9 THREAD_RULES (OPTIONAL, auto-defaults supplied)

| Field | Type | Notes |
|-------|------|-------|
| `new_thread_triggers` | array of strings | Bulleted list |
| `same_thread_triggers` | array of strings | Bulleted list |
| `continuation_steps` | array of strings | Bulleted list |
| `transitions` | array of `{transition, action}` | Quick reference table |

### 3.10 FAILURES (OPTIONAL)

Array of `{number, symptom, action}`. Renders as "Failure Cheat Sheet" table. Top 5 typical.

### 3.11 SESSIONS[] (OPTIONAL but recommended)

Each session:

| Field | Type | Notes |
|-------|------|-------|
| `name` | string | e.g., `Session 1: Foundation` |
| `covers` | string | e.g., `Phase 0 + Phase 1 (4 prompts total)` |
| `time` | string | e.g., `45–65 minutes` |
| `thread_behavior` | string | e.g., `Start new. Stay in same thread for all 4 prompts.` |
| `what_happens` | string | Plain-language narrative |
| `done_criteria` | string | Bullet list of done-when conditions |

### 3.12 TRACKER (AUTO-DERIVED)

Generated from PHASES[].steps[]. No operator input required.

---

## 4. VALIDATION RULES

Before rendering:

1. **Integrity.** All REQUIRED fields populated.
2. **Uniqueness.** Step numbers unique within a phase; prompt names unique across manual.
3. **Token validation.** `({PROJECT})` placeholders present in every prompt_body (auto-corrected from `project_letter`).
4. **Risk calibration.** Step-level risk must be one of LOW/MEDIUM/HIGH.
5. **Phase continuity.** Phase numbers contiguous (0→1→2…).
6. **Gate completeness.** Every phase has a gate with ≥1 check.
7. **Naming canon compliance.** Prompt names follow `naming_format`.

Any failure → halt generation, surface validation panel listing all errors.

---

## 5. DEFAULTS + PRESETS

The intake form ships with these prefilled defaults for fast operation:

- `date` = today
- `baseline_risk` = `MEDIUM`
- `result_header_required` = `true`
- `naming_format` = `({PROJECT})-{MANUAL}-PH{#}-{AI}-{LEVEL}-{###}`
- `thread_format` = `({PROJECT}) — [Short Task Description]`
- Standard 5 execution rules
- Standard FAIL FAST block
- Standard thread rule defaults
- Standard failure cheat sheet (5 rows, editable)

Workflow-type presets inject a phase skeleton:

| Workflow Type | Default Phase Skeleton |
|---------------|-----------------------|
| BUILD | Init → Plan → Build → Validate |
| AUDIT | Scope → Collect → Analyze → Report |
| FIX | Reproduce → Diagnose → Patch → Verify |
| DEPLOY | Prep → Checkpoint → Deploy → Verify |
| CONTENT | Brief → Draft → QA → Ship |
| PLAN | Context → Options → Decision → Brief |
| SYSTEM_MIGRATION | Init → Core → Knowledge → Install → Lock → Validate (MR-1377 archetype) |

Presets are fully editable after load.

---

END OF INTAKE SCHEMA
