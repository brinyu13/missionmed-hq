# MMOS TEMPLATE ENGINE

**Version:** 1.0
**Date:** 2026-04-18
**Authority:** MR-1367 (Workflow OS) + MR-1377 (Operator Manual pattern)
**Purpose:** Specify how the MMOS Intake Engine converts a filled intake payload into a complete, tabbed HTML execution manual. This is the generation layer. Input contract is defined in `INTAKE_SCHEMA.md`.

---

## 1. OUTPUT ARTIFACT

A single self-contained HTML file: `({PROJECT})-{MANUAL_ID}_{short_title_slug}_v{version}.html`

Properties:

- Zero external dependencies at runtime (no CDN, no fonts, no scripts). All CSS inline, all JS inline.
- Tabbed sidebar navigation (Overview + Start Here + Phases + Reference).
- Prints cleanly (screen + print CSS).
- Opens offline in any modern browser.
- Copy-to-clipboard on every prompt block.

---

## 2. GENERATION PIPELINE

```
INTAKE PAYLOAD (JSON)
    ↓
[1] VALIDATE (schema rules §4 of INTAKE_SCHEMA.md)
    ↓ fail → surface errors, halt
    ↓ pass
[2] NORMALIZE
    - Auto-inject ({PROJECT}) from project_letter
    - Slugify manual_id + short_title
    - Compute totals (phases, prompts, sessions)
    - Fill workflow-type defaults if missing
    ↓
[3] BLOCK ASSEMBLY
    - Header block
    - Sidebar nav (built from phases + reference tabs)
    - Overview tab
    - Start Here tab (synthesized from Phase 0 step 1)
    - One tab per phase (phase intro → steps → gate)
    - Reference tabs (rules, thread rules, failures, tracker, sessions)
    ↓
[4] RENDER HTML
    - Style tokens → <style>
    - Content blocks → <main>
    - Tab controller + copy-button JS → <script>
    ↓
[5] DELIVER
    - In-browser preview pane
    - Download as standalone .html
    - Copy full source to clipboard
```

---

## 3. BLOCK TYPES + RENDERERS

Every output block is produced by a pure function `render_*(data) → html_string`. This keeps the engine deterministic and testable.

### 3.1 `render_header(meta)`
Renders top bar: MissionMed logo (graceful fallback), `manual_title`, `manual_id` badge. Sticky.

### 3.2 `render_sidebar(phases, hasReference)`
Start group: Overview, Start Here.
Execute group: one entry per phase (label = `{number} {name}`).
Reference group: Rules, Thread Rules, Failure Cheat Sheet, Progress Tracker, Session Plan.

### 3.3 `render_overview(overview, meta, workflow)`
- `verdict-box`: "STEP 0 — ASSIGN PROJECT BUCKET" block (generalized from MR-1377). Pulls `project_letter`.
- `status-panel`: Build Summary (total phases, prompts, sessions, estimated time, models, naming format, thread format).
- `card`: What Gets Built — from `what_gets_built`.
- `card`: Required AI Response Format — if `result_header_required`, render the RESULT/SUMMARY gate-box.
- `card`: What Gets Created — render `file_manifest` as a table if present.
- `next-box`: pointer to Start Here.

### 3.4 `render_start_here(phases[0])`
- `verdict-box`: Step 1 — Open a NEW thread.
- `card`: Step 2 — Copy/paste the first prompt (pulls `phases[0].steps[0].prompt_body`).
- `card`: Step 3 — What to Expect (from `success_criteria` + `failure_recovery`).
- `card`: Step 4 — After This Prompt Completes (terminal command block).
- `next-box`: pointer to Phase `phases[0+1]` or first real phase.

### 3.5 `render_phase(phase, isFirst, isLast, nextPhase)`
- `phase-loc`: "YOU ARE HERE: Phase N — {name}".
- Optional `hl-w` warning (if workflow has `deployment_warnings`, render on applicable phases).
- `section-header`: name + intro.
- Foreach step: `render_step(step)`.
- `gate-box`: render phase gate (see §3.7).
- Optional `conf-box`: transition confidence.
- `next-box`: pointer to next phase or Reference.

### 3.6 `render_step(step)`
- `step-header`: step number + name, AI badge (Claude/Codex), model badge, time meta, tokens meta.
- `step-body`:
  - `step-control` grid: AI Fit card, Dependency card.
  - `What you do:` paragraph from `what_you_do`.
  - If `pre_action`: highlight block with command.
  - `prompt-block` with `copy-btn` + `prompt-label`. Body = `prompt_body`.
  - `Success:` from `success_criteria`.
  - `If fail:` from `failure_recovery` (if present).
  - If `post_action`: highlight block.
  - If `confidence_pct`: `conf-box` with confidence text.
- `next-box`: pointer to next step (or next phase if last in phase).

### 3.7 `render_gate(gate, phaseNum)`
```
Gate: Phase N to Phase N+1
CHECKS:
  [ ] {check 1}
  [ ] {check 2}
  ...
ALL PASS? Run: {all_pass_action}
ANY FAIL? {any_fail_action}
```

### 3.8 `render_rules(rules, protection)`
Reference tab: Execution Rules (ol), FAIL FAST card, Deployment Source of Truth (if DEPLOY/SYSTEM_MIGRATION), Result Header card, Protected System Lock (if `protected_systems` present).

### 3.9 `render_thread_rules(thread_rules)`
Reference tab: New Thread, Same Thread, Continuation, Quick Reference table.

### 3.10 `render_failures(failures)`
Reference tab: single table of top failure symptoms + actions.

### 3.11 `render_tracker(phases)`
Reference tab: auto-derived progress tracker. Each step → one row with status badge (PENDING by default; operator can edit and re-save).

### 3.12 `render_sessions(sessions)`
Reference tab: one card per session + total panel.

### 3.13 `render_footer(meta)`
Compact footer: `({PROJECT})-{MANUAL_ID}_{short_title_slug} / Version {version} / {date}`

---

## 4. TOKEN SUBSTITUTION

All fields are passed through a `substitute(text, meta, workflow)` helper that expands:

| Token | Replaced with |
|-------|---------------|
| `({PROJECT})` | Uppercase `project_letter` in parens |
| `{MANUAL_ID}` | `meta.manual_id` |
| `{SHORT}` | Slugified `meta.short_title` |
| `{DATE}` | `meta.date` |
| `{VERSION}` | `meta.version` |
| `{AUTHORITY}` | `meta.authority` |

Unknown tokens are preserved verbatim (no silent substitution).

---

## 5. STYLE SYSTEM

Design tokens (must be distinct from MR-1377's exact palette to avoid copy-paste; uses MissionMed brand with its own composition):

```
--mm-navy: #0D2642;        // primary
--mm-navy-2: #172F4C;      // secondary
--mm-ink: #1E1E1E;         // body text
--mm-slate: #5F6A7A;       // muted text
--mm-mist: #EEF0F3;        // surface alt
--mm-line: #D9DDE3;        // borders
--mm-surface: #FFFFFF;     // card bg
--mm-accent: #A83232;      // brand accent (warm red)
--mm-success: #1F6B33;     // gate pass
--mm-warn: #B56B00;        // warning
--mm-teal: #1F8A7A;        // "hi" code highlight
--mm-code-bg: #0F1A2A;     // prompt block bg (deeper than MR-1377)
--mm-code-fg: #E8ECF2;
--radius: 10px;
--radius-s: 6px;
--shadow-1: 0 1px 2px rgba(10,20,35,0.06), 0 6px 18px rgba(10,20,35,0.05);
--shadow-2: 0 2px 6px rgba(10,20,35,0.10), 0 10px 28px rgba(10,20,35,0.07);
```

This is a distinct visual identity — not a clone of MR-1377.

---

## 6. INTERACTIVITY

- **Tab controller.** Click/keyboard (arrow keys + Enter) switches tabs.
- **Copy buttons.** Writes the prompt body to clipboard; confirmation microstate `Copied!` for 1.5s.
- **Tracker persistence (optional).** Status badges are editable; state stored in `localStorage` if available, otherwise ephemeral.
- **Print mode.** Hides sidebar, expands all tabs sequentially.

---

## 7. QUALITY CONTRACT

A generated manual MUST satisfy:

1. Every prompt block begins with `PROMPT NAME:` and `THREAD NAME:` lines.
2. Every prompt block contains load directives for `PRIMER_CORE.md` and `KNOWLEDGE_INDEX.md` unless explicitly opted out.
3. Every step shows AI + model + time + token budget at a glance.
4. Every phase ends with a gate.
5. The operator can complete the workflow without leaving the HTML file (copy prompts, track progress, resolve failures from the cheat sheet).

---

## 8. EXTENSION POINTS

Future-compatible hooks (NOT built in v1, but reserved):

- `render_plugins[]` — inject custom tabs (e.g., "HTML Deploy Extension" for HTML workflows).
- Workflow-type-specific validators (e.g., DEPLOY requires `pre_deploy_checklist`).
- JSON import/export — round-trip intake payloads across sessions.

---

END OF TEMPLATE ENGINE SPEC
