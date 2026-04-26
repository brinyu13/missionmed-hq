---
PROMPT ID: (M)-MMOS-ENGINE-LOGIC-004
THREAD: (M) — MMOS Interpretation + Generation Logic
TASK TYPE: SYSTEM DESIGN (EXECUTION LEVEL)
RISK LEVEL: HIGH
AUTHORITY: MMOS CORE
DATE: 2026-04-18
TARGET: _SYSTEM/INTAKE_ENGINE/MMOS_Intake_Engine.html (v2 intake layer)
AUTHORITY_DOC: _SYSTEM/INTAKE_ENGINE/MMOS_Intake_Engine_AUDIT_v2.md
---

# MMOS Intake Engine: Execution-Level Logic Specification v2

RESULT: COMPLETE
SUMMARY: Complete implementation logic for the v2 intake engine. Interpretation rules, phase and step generation tables, AI routing, prompt templates, and the delta system are defined to the level Codex needs. Every decision point is a deterministic rule with an explicit table or a pseudocode function. No concepts without rules.

---

## 0. DEFINITIONS AND CONVENTIONS

`minimal_input`: the five required fields captured by the primary intake panel.
`advanced_overrides`: the six optional fields in the advanced panel, each defaults to `null`.
`deltas`: an ordered list of granular edits applied after generation.
`interpretation`: the deterministic output of Stage 1 or the AI output of Stage 2.
`raw_state`: interpretation expanded into the existing schema shape, pre-override, pre-delta.
`resolved_state`: raw_state after advanced overrides and deltas are applied.
`rendered_html`: the manual produced by `genHTML(resolved_state)`.

All task types are upper-case tokens in the set {`BUILD`, `AUDIT`, `FIX`, `DEPLOY`, `CONTENT`, `PLAN`, `SYSTEM_MIGRATION`}.
Risk levels are `LOW`, `MED`, `HIGH`. Complexity uses the same three tokens.
AI identifiers are `Claude`, `Codex`.
Thread values are `NEW` or `SAME`.

---

## 1. INTERPRETATION LOGIC

### 1.1 Minimal input schema

```
minimal_input = {
  goal:           string,   // 1 to 2000 chars, required
  target:         string[], // 1 to 20 entries, each 1 to 200 chars
  project_letter: string,   // single uppercase letter A-Z or "custom:<string>"
  ai_tools:       string[], // subset of ["Claude","Codex"], at least one required
  constraint:     string    // 0 to 500 chars, may be empty
}
```

### 1.2 Task type classifier

#### 1.2.1 Keyword dictionary

| Task type | Trigger words (lowercase, whole-word match) |
|---|---|
| BUILD | build, create, add, generate, scaffold, implement, introduce, new, make, produce, construct, initialize, set up, stand up |
| AUDIT | audit, validate, verify, check, review, inspect, confirm, assess, examine, certify, test (as verb) |
| FIX | fix, repair, debug, patch, resolve, correct, unbreak, recover, mend, restore, hotfix |
| DEPLOY | deploy, push, publish, release, ship, launch, roll out, cutover, go live, promote, rollout |
| CONTENT | copy, rewrite, draft, tone, message, wording, phrasing, caption, headline, blog, post, article, email, page copy, landing copy |
| PLAN | plan, design, architect, spec, roadmap, outline, scope, proposal, blueprint, strategy |
| SYSTEM_MIGRATION | migrate, refactor, split, consolidate, restructure, reorganize, rename, move, extract, merge, transition, decompose |

#### 1.2.2 Scoring

```
function classifyTaskType(goal, target, constraint):
  text = lower(goal + " " + join(target," ") + " " + constraint)
  scores = { BUILD:0, AUDIT:0, FIX:0, DEPLOY:0, CONTENT:0, PLAN:0, SYSTEM_MIGRATION:0 }
  for each (task, keywords) in TASK_KEYWORDS:
    for each kw in keywords:
      if regex_match(text, "\b" + escape(kw) + "\b"):
        scores[task] += 1
  max_score = max(values(scores))
  if max_score == 0:
    return { type: null, confidence: 0, method: "classifier_empty" }
  winners = [t for t in scores if scores[t] == max_score]
  if len(winners) == 1:
    return { type: winners[0], confidence: max_score, method: "classifier_unique" }
  // Tie-break priority (destructive/high-risk first)
  PRIORITY = ["SYSTEM_MIGRATION","DEPLOY","FIX","BUILD","AUDIT","CONTENT","PLAN"]
  for t in PRIORITY:
    if t in winners:
      return { type: t, confidence: max_score, method: "classifier_tiebreak" }
```

#### 1.2.3 Fallback to AI interpretation

```
function classifyTaskTypeAI(minimal_input):
  prompt = AI_INTERPRETER_PROMPT_v1 with minimal_input interpolated
  response = callClaude({
    model: "claude-sonnet-4-6",
    temperature: 0,
    max_tokens: 400,
    response_format: "json_schema",
    schema: INTERPRETATION_JSON_SCHEMA
  })
  return response  // { type, complexity, risk, phase_count_hint, notes }
```

Fallback rule: if `classifyTaskType().type == null`, call `classifyTaskTypeAI`. If Stage 2 also returns null or an invalid token, default `type = "PLAN"` and set `needs_user_confirmation = true`.

### 1.3 Complexity classifier

#### 1.3.1 Signal table

Each signal contributes integer points to a total score.

| Signal | Evaluation rule | Points |
|---|---|---|
| Target count 1 | `len(target) == 1` | 0 |
| Target count 2-4 | `2 <= len(target) <= 4` | 1 |
| Target count 5+ | `len(target) >= 5` | 2 |
| Production surface | any path in target matches regex `(^|/)(index\.html|main\.|prod/|deploy/|public/|live/|dist/)` | +1 |
| Reversibility: DEPLOY or SYSTEM_MIGRATION | `task_type in {DEPLOY, SYSTEM_MIGRATION}` | +2 |
| Reversibility: BUILD | `task_type == BUILD` | +1 |
| Reversibility: CONTENT, PLAN, AUDIT | those task types | +0 |
| Reversibility: FIX | `task_type == FIX` | +1 |
| MR authority present | `constraint` matches regex `MR-\d{3,}` | +1 |
| Goal length short | `len(goal) < 100` | 0 |
| Goal length medium | `100 <= len(goal) <= 300` | 1 |
| Goal length long | `len(goal) > 300` | 2 |
| Verb count 1-2 | count of TASK_KEYWORDS words in `goal` is 1 or 2 | 0 |
| Verb count 3-5 | count is 3 to 5 | 1 |
| Verb count 6+ | count is 6 or more | 2 |

#### 1.3.2 Complexity bucketing

```
function classifyComplexity(goal, target, task_type, constraint):
  score = 0
  score += targetCountPts(len(target))
  if matchesProductionSurface(target):      score += 1
  score += reversibilityPts(task_type)
  if regex_match(constraint, "MR-\d{3,}"):  score += 1
  score += goalLengthPts(len(goal))
  score += verbCountPts(goal)
  if score <= 2: return "LOW"
  if score <= 5: return "MED"
  return "HIGH"
```

### 1.4 Risk classifier

Risk is derived from complexity with specific overrides.

```
function classifyRisk(task_type, complexity, target, constraint):
  // Hard rules first
  if task_type == "DEPLOY":                 return "HIGH"
  if task_type == "SYSTEM_MIGRATION":       return "HIGH"
  if matchesProductionSurface(target):      return "HIGH"
  if regex_match(constraint, "MR-\d{3,}"):  return max(complexity, "MED")
  // Otherwise map complexity
  if complexity == "HIGH": return "HIGH"
  if complexity == "MED":  return "MED"
  return "LOW"
```

`max(complexity, "MED")` treats the ordering LOW < MED < HIGH.

User override in `advanced_overrides.risk` supersedes the computed value.

### 1.5 Dependency detection

V2 rule: every phase depends on its predecessor. Phase 0 has no dependency.

```
function buildPhaseDependencies(phase_count):
  deps = {}
  for i in 0..phase_count-1:
    deps[i] = (i == 0) ? [] : [i-1]
  return deps
```

Parallel phases are out of scope for v2. A future extension will allow a phase to declare `parallel_with: [phase_idx]`, but the current interpreter always emits a strict sequential chain.

### 1.6 Interpretation output shape

```
interpretation = {
  task_type:          "BUILD" | "AUDIT" | ...,
  complexity:         "LOW" | "MED" | "HIGH",
  risk:               "LOW" | "MED" | "HIGH",
  phase_count:        integer (1..6),
  manual_code:        string (8 alphanumeric uppercase),
  project_letter:     string,
  naming_prefix:      "(A)-MANUALCD",   // for NAMING_CANON
  thread_short_title: string,
  method:             "classifier_unique" | "classifier_tiebreak" | "ai_fallback",
  classifier_scores:  { BUILD: n, AUDIT: n, ... },
  needs_user_confirmation: boolean
}
```

`manual_code` is derived as `uppercase(regex_replace(goal[:32], "[^A-Z0-9]","")).slice(0,8)`, with fallback `"MM" + YYMMDD` if the result is shorter than 4 chars.

---

## 2. PHASE GENERATION LOGIC

### 2.1 Phase count table

| Task type | LOW | MED | HIGH |
|---|---|---|---|
| AUDIT | 1 | 2 | 3 |
| FIX | 2 | 2 | 3 |
| BUILD | 2 | 3 | 4 |
| DEPLOY | 2 | 3 | 3 |
| CONTENT | 1 | 2 | 3 |
| PLAN | 1 | 1 | 1 |
| SYSTEM_MIGRATION | 3 | 4 | 5 |

Override: `advanced_overrides.phase_count` replaces the table value. Clamped to range 1..6.

### 2.2 Phase role templates

Phases are selected from a fixed ordered list per task type. If the phase count is less than the list length, earlier "Pre-Flight" phases are dropped first.

| Task type | Ordered phase roles |
|---|---|
| BUILD | Pre-Flight Validation, Scaffold, Implement Core, Integrate + Test, Finalize + Checkpoint |
| AUDIT | Pre-Flight Scope Lock, Read + Validate, Report + Recommend |
| FIX | Reproduce + Diagnose, Patch, Verify + Regression Check |
| DEPLOY | Pre-Deploy Validation, Stage + Smoke Test, Deploy + Verify |
| CONTENT | Brief + Constraints, Draft, Review + Revise |
| PLAN | Scope + Architecture |
| SYSTEM_MIGRATION | Audit Current State, Design Target State, Migrate + Backfill, Verify + Cutover, Cleanup + Retire Legacy |

```
function pickPhaseRoles(task_type, phase_count):
  all_roles = PHASE_ROLE_TABLE[task_type]
  if len(all_roles) == phase_count:
    return all_roles
  if len(all_roles) > phase_count:
    // Drop from the front (Pre-Flight phases first) until lengths match
    return all_roles.slice(len(all_roles) - phase_count)
  // If phase_count exceeds default, pad from the back by duplicating "Implement Core" or task-appropriate role
  padding_role = PHASE_PADDING_ROLE[task_type]  // e.g. BUILD => "Implement Core (continued)"
  return all_roles + repeat(padding_role, phase_count - len(all_roles))
```

### 2.3 Phase naming

```
function namePhase(phase_idx, role, target, task_type):
  target_hint = target.length ? baseName(target[0]) : task_type_lower(task_type)
  title = role                                   // role is the canonical short name
  subtitle = role + ": " + target_hint
  return { idx: phase_idx, title: title, subtitle: subtitle, role: role }
```

`baseName` strips path prefixes and file extensions for subtitle readability.

### 2.4 Phase dependencies

Applied via `buildPhaseDependencies` from §1.5. Emitted into state as `phases[i].dependency = [i-1]` for i > 0, empty otherwise.

### 2.5 Output shape per phase

```
phase = {
  idx:          integer,
  title:        string,
  subtitle:     string,
  role:         string,
  dependency:   integer[],
  steps:        step[],
  gate:         gate   // see §3.6
}
```

---

## 3. STEP GENERATION LOGIC

### 3.1 Step count table (by phase role and complexity)

| Phase role | LOW | MED | HIGH |
|---|---|---|---|
| Pre-Flight Validation | 1 | 1 | 1 |
| Pre-Flight Scope Lock | 1 | 1 | 1 |
| Pre-Deploy Validation | 2 | 2 | 2 |
| Scaffold | 1 | 2 | 2 |
| Implement Core | 2 | 3 | 4 |
| Implement Core (continued) | 2 | 2 | 3 |
| Integrate + Test | 2 | 2 | 2 |
| Finalize + Checkpoint | 1 | 1 | 1 |
| Reproduce + Diagnose | 1 | 1 | 1 |
| Patch | 1 | 2 | 2 |
| Verify + Regression Check | 1 | 1 | 2 |
| Stage + Smoke Test | 2 | 2 | 2 |
| Deploy + Verify | 2 | 2 | 2 |
| Read + Validate | 1 | 2 | 3 |
| Report + Recommend | 1 | 1 | 1 |
| Brief + Constraints | 1 | 1 | 1 |
| Draft | 1 | 2 | 3 |
| Review + Revise | 1 | 1 | 1 |
| Scope + Architecture | 2 | 3 | 4 |
| Audit Current State | 2 | 2 | 2 |
| Design Target State | 2 | 2 | 2 |
| Migrate + Backfill | 2 | 3 | 4 |
| Verify + Cutover | 2 | 2 | 2 |
| Cleanup + Retire Legacy | 1 | 1 | 1 |

Override: `advanced_overrides` does not currently expose per-phase step count. Step count is driven by role and complexity only. Additional steps may be added via the delta system (`op: "insert"` on a `phases[].steps` path).

### 3.2 Step intent dispatch

Each generated step is tagged with an `intent` token. Intent drives AI routing and prompt body template selection.

```
function intentForStep(role, step_idx, step_count, task_type):
  table = STEP_INTENT_TABLE[role]      // see §3.3
  if step_idx < len(table):
    return table[step_idx]
  return table[len(table) - 1]        // extra steps inherit last intent
```

### 3.3 Intent table (per role, indexed by step slot)

| Phase role | step 1 intent | step 2 intent | step 3 intent | step 4 intent |
|---|---|---|---|---|
| Pre-Flight Validation | audit | - | - | - |
| Pre-Flight Scope Lock | plan | - | - | - |
| Pre-Deploy Validation | audit | audit | - | - |
| Scaffold | generate_code | generate_code | - | - |
| Implement Core | generate_code | generate_code | edit_file | audit |
| Implement Core (continued) | generate_code | edit_file | audit | - |
| Integrate + Test | edit_file | audit | - | - |
| Finalize + Checkpoint | commit | - | - | - |
| Reproduce + Diagnose | reason | - | - | - |
| Patch | generate_code | audit | - | - |
| Verify + Regression Check | audit | audit | - | - |
| Stage + Smoke Test | run_command | audit | - | - |
| Deploy + Verify | deploy | audit | - | - |
| Read + Validate | audit | audit | audit | - |
| Report + Recommend | summarize | - | - | - |
| Brief + Constraints | plan | - | - | - |
| Draft | write_copy | write_copy | write_copy | - |
| Review + Revise | review | - | - | - |
| Scope + Architecture | plan | plan | write_copy | audit |
| Audit Current State | audit | audit | - | - |
| Design Target State | plan | write_copy | - | - |
| Migrate + Backfill | generate_code | edit_file | audit | edit_file |
| Verify + Cutover | audit | deploy | - | - |
| Cleanup + Retire Legacy | edit_file | - | - | - |

### 3.4 AI routing (Claude vs Codex)

```
CLAUDE_INTENTS = { "reason","plan","classify","review","explain","summarize",
                   "audit","write_copy","commit","deploy" }
CODEX_INTENTS  = { "generate_code","edit_file","refactor","scaffold",
                   "apply_patch","lint","format","run_command" }

function routeAI(intent, available_ais):
  if intent in CLAUDE_INTENTS: preferred = "Claude"
  elif intent in CODEX_INTENTS: preferred = "Codex"
  else: preferred = "Claude"
  if preferred in available_ais: return preferred
  if len(available_ais) >= 1:    return available_ais[0]
  raise Error("No AI tool available")
```

### 3.5 Model tier selection

```
function selectModel(ai, risk, task_type):
  if risk == "HIGH":
    return ai == "Claude" ? "Opus Required" : "GPT-5 Required"
  if risk == "MED":
    return ai == "Claude" ? "Sonnet OK"     : "GPT-5 OK"
  // LOW risk
  if task_type in { "AUDIT","CONTENT" }:
    return ai == "Claude" ? "Haiku OK"      : "GPT-5-mini OK"
  return ai == "Claude" ? "Sonnet OK"       : "GPT-5 OK"
```

Override: `advanced_overrides.model_policy` replaces this function's output.
- `"Opus everywhere"` => always `"Opus Required"` (Claude) or `"GPT-5 Required"` (Codex)
- `"Sonnet OK where safe"` => same as default
- `"per-step"` => compute per step using `selectModel`

### 3.6 Thread policy

```
function threadFor(phase_idx, step_idx, prev_step, current_step, policy):
  if policy == "NEW per step":               return "NEW"
  if policy == "NEW per phase only":
    return step_idx == 0 ? "NEW" : "SAME"
  // Default: "SAME where possible"
  if phase_idx == 0 and step_idx == 0:       return "NEW"
  if step_idx == 0:                          return "NEW"      // first step of new phase
  if prev_step is null:                      return "NEW"
  if prev_step.ai    != current_step.ai:     return "NEW"
  if prev_step.model != current_step.model:  return "NEW"
  return "SAME"
```

### 3.7 Output shape per step

```
step = {
  id:               string (phase_idx + "." + step_idx),
  idx:              integer,
  title:            string,
  role:             string,  // inherited from phase for context
  intent:           string,
  ai:               "Claude" | "Codex",
  model:            string,
  thread:           "NEW" | "SAME",
  risk:             "LOW" | "MED" | "HIGH",
  prompt_name:      string,  // NAMING CANON compliant
  prompt_body:      string,
  success_criteria: string,
  task_type:        string,
  estimated_time:   string,
  estimated_tokens: string,
  confidence:       integer (0..100),
  gap:              string,
  how_to_improve:   string
}
```

### 3.8 Gate generation per phase

```
function buildGate(phase, next_phase, project_letter, manual_code):
  checks = []
  for each step in phase.steps:
    if step.intent in {"audit","review"}: continue   // audit steps already produce checks
    checks.push("[  ] " + step.success_criteria)
  checks.push("[  ] Git checkpoint committed")
  all_pass_cmd = "git add -A && git commit -m \"" + manual_code + "-CHECKPOINT: " + phase.title + " complete\""
  any_fail_text = "Fix failing check and re-verify before proceeding."
  return {
    title: "Gate: " + phase.title + " to next",
    checks: checks,
    all_pass_action: { type: "terminal", label: "If ALL Checks Pass", command: all_pass_cmd },
    any_fail_action: { type: "instruction", text: any_fail_text },
    confidence: 90
  }
```

---

## 4. PROMPT GENERATION SYSTEM

### 4.1 NAMING_CANON builder

```
function buildPromptName(project_letter, manual_code, phase_idx, ai, risk, ordinal):
  level = (risk == "MED") ? "MED" : risk        // MED is the canonical short form
  return "(" + project_letter + ")-" + manual_code
       + "-PH" + phase_idx
       + "-" + upper(ai)
       + "-" + level
       + "-" + zeroPad(ordinal, 3)
```

Example: `(M)-INTAKEV2-PH1-CLAUDE-HIGH-001`

### 4.2 THREAD_FORMAT builder

```
function buildThreadName(project_letter, short_title, phase_role):
  return "(" + project_letter + ") " + "\u2014" + " " + short_title + " " + phase_role
```

`\u2014` is the em-dash. This is the only place em-dashes are allowed: inside NAMING CANON operational identifiers per MR-1367.

### 4.3 Canonical prompt header (all task types)

```
{PROMPT_NAME}
{THREAD_NAME}
---
Load PRIMER_CORE.md
Load KNOWLEDGE_INDEX.md
---
TASK TYPE: {TASK_TYPE}
RISK LEVEL: {RISK_LEVEL}
AUTHORITY: {AUTHORITY}
---
```

### 4.4 Canonical prompt footer (all task types)

```
Begin your response with:
RESULT: COMPLETE / FAILED / PARTIAL
SUMMARY: [1-2 lines]

End with a NEXT ACTION block.
```

### 4.5 Body templates by task type

The body template sits between header and footer. Placeholders in curly braces are replaced with step-specific values.

#### 4.5.1 BUILD body

```
{OBJECTIVE}

TARGET: {TARGET}

WHAT TO DO:
{INSTRUCTION_LIST}

CONSTRAINTS:
{CONSTRAINT_LIST}

SUCCESS CRITERIA:
{SUCCESS_CRITERIA}
```

#### 4.5.2 AUDIT body

```
{OBJECTIVE}

TARGETS TO AUDIT: {TARGET}

CHECKS:
{CHECK_LIST}

REPORT FORMAT:
- RESULT line
- Per-check PASS or FAIL with one-line evidence
- Summary of findings
- Remediation recommendations if any FAIL

SUCCESS CRITERIA:
{SUCCESS_CRITERIA}
```

#### 4.5.3 FIX body

```
{OBJECTIVE}

BUG SYMPTOM: {SYMPTOM_FROM_GOAL}
TARGET: {TARGET}

WHAT TO DO:
1. Reproduce the issue and confirm the symptom.
2. Diagnose the root cause.
3. Apply the minimal fix.
4. Re-run the reproduction and confirm it now passes.

SUCCESS CRITERIA:
{SUCCESS_CRITERIA}
```

#### 4.5.4 DEPLOY body

```
{OBJECTIVE}

ARTIFACT: {TARGET}

PRE-DEPLOY CHECKS:
{PRE_DEPLOY_CHECKS}

DEPLOY COMMAND:
{DEPLOY_COMMAND}

POST-DEPLOY VERIFICATION:
{POST_DEPLOY_CHECKS}

SUCCESS CRITERIA:
{SUCCESS_CRITERIA}
```

#### 4.5.5 CONTENT body

```
{OBJECTIVE}

TARGET: {TARGET}

BRIEF:
{BRIEF_FROM_GOAL}

CONSTRAINTS:
- Voice: {VOICE_HINT}
- Length: {LENGTH_HINT}
- Forbidden patterns: no em-dashes in prose, no AI cliches (per MissionMed memory rule).

SUCCESS CRITERIA:
{SUCCESS_CRITERIA}
```

#### 4.5.6 PLAN body

```
{OBJECTIVE}

SCOPE: {TARGET}

DELIVERABLES:
1. Scope statement
2. Architecture sketch (components, data flow, interfaces)
3. Sequenced implementation plan with per-phase gates
4. Risk register

SUCCESS CRITERIA:
{SUCCESS_CRITERIA}
```

#### 4.5.7 SYSTEM_MIGRATION body

```
{OBJECTIVE}

CURRENT STATE SURFACE: {TARGET}

WHAT TO DO:
1. Audit the current state.
2. Design the target state.
3. Produce a migration path with reversible checkpoints.
4. Execute the migration for this phase only.

INVARIANTS TO PRESERVE:
{INVARIANTS_FROM_CONSTRAINT}

SUCCESS CRITERIA:
{SUCCESS_CRITERIA}
```

### 4.6 Objective line generation

The `{OBJECTIVE}` slot is a single-sentence re-statement of the goal scoped to this step.

```
function buildObjective(goal, phase_role, step_intent):
  verb = VERB_FOR_INTENT[step_intent]        // e.g. audit => "Audit", generate_code => "Implement"
  return verb + " " + firstSentence(goal) + " (" + phase_role + ")"
```

If the computed sentence exceeds 200 chars, truncate at the last word boundary and append " (continued in success criteria)".

### 4.7 Instruction, check, success-criteria list generation

For step intents that need enumerated instructions, the generator fills a task-type-specific list from a seed pool plus the goal.

```
INSTRUCTION_SEED[task_type][role] => array of canonical instructions

function buildInstructionList(task_type, role, goal, target):
  seeds = INSTRUCTION_SEED[task_type][role] or []
  rendered = seeds.map(s => interpolate(s, { goal, target }))
  return enumerate(rendered)    // "1. ...\n2. ..."
```

Example seeds for BUILD + Scaffold:
1. "Create {target} with the structure described in {goal}."
2. "Write only the skeleton and required headers. Leave bodies empty or stubbed."

Example seeds for AUDIT + Read + Validate:
1. "Open {target} and confirm every invariant stated in {goal}."
2. "Report line counts, section counts, and any divergence from the stated structure."

The full seed table is defined in `INSTRUCTION_SEED.json` (v2 artifact, separately versioned).

### 4.8 Success criteria generation

Per-step success criterion is a single line, imperative or declarative.

```
function buildSuccessCriteria(role, target, goal):
  template = SUCCESS_TEMPLATE[role]            // e.g. for Scaffold: "{target} exists with required headers."
  return interpolate(template, { goal, target })
```

### 4.9 Prompt assembly function

```
function buildPrompt(step, workflow_meta):
  header = interpolate(CANONICAL_HEADER, {
    PROMPT_NAME: step.prompt_name,
    THREAD_NAME: buildThreadName(workflow_meta.project_letter, workflow_meta.short_title, step.role),
    TASK_TYPE:   step.task_type,
    RISK_LEVEL:  step.risk,
    AUTHORITY:   workflow_meta.authority
  })
  body = interpolate(BODY_TEMPLATE[step.task_type], {
    OBJECTIVE:        buildObjective(workflow_meta.goal, step.role, step.intent),
    TARGET:           workflow_meta.target,
    INSTRUCTION_LIST: buildInstructionList(step.task_type, step.role, workflow_meta.goal, workflow_meta.target),
    CHECK_LIST:       buildCheckList(step.role, workflow_meta.goal, workflow_meta.target),
    SUCCESS_CRITERIA: step.success_criteria,
    CONSTRAINT_LIST:  workflow_meta.constraint or "(none specified)"
  })
  footer = CANONICAL_FOOTER
  full   = header + "\n" + body + "\n\n" + footer
  validatePrompt(full)       // see §4.10
  return full
```

### 4.10 Prompt validator

Every assembled prompt must pass these checks before commit. A failure aborts generation for that step and surfaces a specific error to the user.

| Check | Rule |
|---|---|
| Header present | first line starts with `(` and matches NAMING CANON regex |
| Thread line present | second line starts with `(` and contains `\u2014` |
| Load lines present | lines 4-5 match `Load PRIMER_CORE.md` and `Load KNOWLEDGE_INDEX.md` |
| Task type tag | body contains exactly one `TASK TYPE: <TOKEN>` line |
| Risk level tag | body contains exactly one `RISK LEVEL: <LOW|MED|HIGH>` line |
| Authority tag | body contains exactly one `AUTHORITY:` line with non-empty value |
| RESULT instruction | body contains the exact `Begin your response with:\nRESULT: COMPLETE / FAILED / PARTIAL` sequence |
| NEXT ACTION instruction | body ends with `End with a NEXT ACTION block.` |
| Target slot filled | `TARGET:` or `ARTIFACT:` or `SCOPE:` line has non-empty value |
| Em-dash prose audit | prose regions (excluding NAMING CANON headers) contain zero `\u2014` characters |

### 4.11 NAMING CANON regex

```
NAMING_REGEX = /^\(([A-Z]|custom:[A-Za-z0-9]+)\)-[A-Z0-9]{2,16}-PH\d-(CLAUDE|CODEX)-(LOW|MED|HIGH)-\d{3}$/
```

---

## 5. DELTA SYSTEM

### 5.1 Workflow artifact schema (full)

```
workflow_artifact = {
  schema_version:        "2",
  created_at:            ISO8601,
  updated_at:            ISO8601,
  minimal_input:         MinimalInput,        // §1.1
  advanced_overrides:    AdvancedOverrides,
  deltas:                Delta[],
  cached_interpretation: Interpretation | null,
  cached_resolved_state: State | null
}
```

### 5.2 AdvancedOverrides schema

```
AdvancedOverrides = {
  workflow_type:    null | "BUILD" | "AUDIT" | "FIX" | "DEPLOY" | "CONTENT" | "PLAN" | "SYSTEM_MIGRATION",
  risk:             null | "LOW" | "MED" | "HIGH",
  phase_count:      null | integer (1..6),
  model_policy:     null | "Opus everywhere" | "Sonnet OK where safe" | "per-step",
  thread_policy:    null | "NEW per step" | "NEW per phase only" | "SAME where possible",
  custom_templates: { [step_id]: string }    // step_id is "P.S" e.g. "1.2"
}
```

### 5.3 Delta schema

```
Delta = {
  id:        UUID,
  timestamp: ISO8601,
  path:      string,               // JSONPointer-style: "/phases/1/steps/0/prompt_body"
  op:        "set" | "insert" | "delete",
  before:    any,                  // value prior to this delta (for audit/undo)
  after:     any,                  // new value (omitted for delete)
  source:    "advanced_panel" | "step_editor" | "bulk_import" | "regeneration",
  orphaned:  boolean (default false)
}
```

### 5.4 Delta application pipeline

```
function resolveState(artifact):
  // 1. Interpret
  interpretation = runInterpretation(artifact.minimal_input)

  // 2. Apply workflow-level advanced overrides
  interpretation = applyWorkflowOverrides(interpretation, artifact.advanced_overrides)

  // 3. Expand interpretation into raw state
  raw_state = generateState(interpretation, artifact.minimal_input)

  // 4. Apply custom prompt templates (workflow-level, but step-scoped)
  for each (step_id, template) in artifact.advanced_overrides.custom_templates:
    setStepPromptBody(raw_state, step_id, template)

  // 5. Apply deltas in timestamp order
  state = raw_state
  for each delta in sortByTimestamp(artifact.deltas):
    try:
      state = applyDelta(state, delta)
      delta.orphaned = false
    catch PathNotFoundError:
      delta.orphaned = true
      continue    // do not abort; orphans are reported to the user

  return state
```

### 5.5 Delta op semantics

| Op | Semantics |
|---|---|
| `set` | Resolve `path`. If parent exists and key is valid, set value to `after`. If path does not resolve, mark delta orphaned. |
| `insert` | Resolve `path` to an array. Insert `after` at index parsed from final path segment. If index is `-`, append. If parent is not an array, mark delta orphaned. |
| `delete` | Resolve `path`. If it exists, delete. If not, mark delta orphaned. |

### 5.6 Conflict rules

| Situation | Resolution |
|---|---|
| Two deltas target same path | Later timestamp wins (last-write-wins). Earlier delta is preserved in the log for audit but superseded. |
| Advanced override sets a default (e.g. `risk = HIGH`) and a delta sets the same path on a specific node | Delta wins for its specific node. Advanced applies everywhere else. |
| Delta targets a path removed by advanced override (e.g. phase count reduced below delta's phase index) | Delta is marked `orphaned: true`. User is notified in the preview pane. User may remove, retain for re-use, or update the path. |
| Delta's `before` value does not match current value at resolution time | Apply `after` anyway (forward-only), but log a warning in the preview's diff view. |

### 5.7 Save and load

Persistence key format: `mmos_workflow_{project_letter}_{manual_code}` in localStorage.

Export format: `.mmos.json` containing the full `workflow_artifact`.

Import: read file, validate `schema_version == "2"`, re-resolve on load. Reject on version mismatch with a migration prompt.

Size budget: if serialized artifact exceeds 80 KB, display a warning; if it exceeds 100 KB, block save until deltas are compacted (bulk re-regeneration replaces deltas with their resulting state values).

### 5.8 Delta compaction

```
function compactDeltas(artifact):
  // Replace deltas with their cumulative effect captured as custom_templates
  // plus a "baseline" state snapshot.
  resolved = resolveState(artifact)
  artifact.cached_resolved_state = resolved
  artifact.deltas = []
  artifact.advanced_overrides.custom_templates = extractTemplates(resolved)
  return artifact
```

Compaction is a lossy operation: the per-delta audit trail is dropped. It should be offered to the user with a confirmation dialog.

---

## 6. END-TO-END FLOW (INPUT → OUTPUT)

### 6.1 Happy path

```
USER:
  fills minimal panel with:
    goal           = "Audit the new intake engine for operator gaps"
    target         = ["_SYSTEM/INTAKE_ENGINE/MMOS_Intake_Engine.html"]
    project_letter = "M"
    ai_tools       = ["Claude","Codex"]
    constraint     = "AUTHORITY: MMOS CORE. No schema change."
  clicks "Generate"

ENGINE:
  1. classifyTaskType  => { type: "AUDIT", method: "classifier_unique" }
  2. classifyComplexity => "MED"      (1 target, not prod surface, AUDIT reversibility, 0 MR, length 54 chars => score 2)
     [recompute with MR authority absent: 0+0+0+0+0+1(verb) = 1 => LOW]
     In this specific example complexity resolves to LOW.
  3. classifyRisk       => "LOW"      (no DEPLOY, no SYSTEM_MIGRATION, no prod surface, no MR)
  4. phase_count        => 1          (AUDIT/LOW table row)
  5. pickPhaseRoles     => ["Report + Recommend"]  (len 3 > 1 => drop front, final role wins)
  6. step_count table   => 1          (Report + Recommend/LOW)
  7. intent             => "summarize"
  8. routeAI            => "Claude"
  9. selectModel        => "Haiku OK"   (LOW + AUDIT)
 10. threadFor          => "NEW"       (phase 0 step 0)
 11. buildPromptName    => "(M)-AUDITTHE-PH0-CLAUDE-LOW-001"
     manual_code        = uppercase(goal[:32] stripped) = "AUDITTHE"
 12. buildThreadName    => "(M) \u2014 Audit Engine Report + Recommend"
 13. buildPrompt        => assembled, validates under §4.10
 14. buildGate          => 1 check, git checkpoint line
 15. Assemble state, validate schema, render via genHTML
 16. Preview panel displays manual; user sees inferred values in diff view

USER:
  (optional) opens advanced, sees ghost text, overrides nothing; saves.
```

### 6.2 Advanced override path

```
USER:
  fills minimal panel
  opens advanced panel
  sets risk = "HIGH"
  sets phase_count = 3
  clicks "Generate"

ENGINE:
  1..3. interpretation produces LOW, but:
  4. applyWorkflowOverrides => risk = HIGH, phase_count = 3
  5. pickPhaseRoles         => ["Pre-Flight Scope Lock","Read + Validate","Report + Recommend"]
  6. step counts and intents derive from the new roles
  7. models upgrade due to HIGH risk (selectModel => Opus Required / GPT-5 Required)
  8. Generation proceeds as in §6.1 with new parameters
```

### 6.3 Edit + regenerate path

```
USER:
  generates manual
  clicks "Edit" on Step 1.1
  changes prompt_body
  clicks "Save edit"

ENGINE:
  captures delta:
    { path: "/phases/1/steps/0/prompt_body", op: "set",
      before: "<old>", after: "<new>",
      source: "step_editor", timestamp: now(), id: uuid() }
  artifact.deltas.push(delta)
  re-resolves state via resolveState()
  re-renders preview

USER:
  changes goal slightly, clicks "Regenerate"

ENGINE:
  runs full resolveState pipeline:
    1. interpretation (may change task_type/risk/phase_count)
    2. apply workflow overrides
    3. expand state
    4. apply delta for phases/1/steps/0/prompt_body
    5. if path still exists: apply
    6. if structure changed (e.g. phase 1 no longer has step 0): orphan delta
  re-renders
```

### 6.4 Failure paths

| Failure | Engine response |
|---|---|
| Classifier returns null AND AI fallback returns null | Default task_type = "PLAN", set `needs_user_confirmation = true`. Preview pane shows a banner: "I could not confidently classify this goal. Please confirm PLAN or pick another type." |
| Prompt validator fails on any step | Generation aborts. Preview shows the specific validator failure and the step ID. "Fix and regenerate" button available. |
| Schema validator fails on resolved state | Same as above at state level. |
| AI call timeout in Stage 2 | Fall back to Stage 1 result with `needs_user_confirmation = true`. Never silently proceed. |
| Delta references a path that no longer exists | Mark orphaned, continue generation, surface in preview's "Orphaned deltas" panel. |

---

## 7. TEST FIXTURES (MINIMUM SET FOR CODEX IMPLEMENTATION)

Codex must not declare the interpretation engine complete until all twelve fixtures pass. Each fixture is `{minimal_input, expected_interpretation, expected_state_shape_sketch}`. Expected values below were derived by running the deterministic rules in §1 against each minimal input; they are the ground truth the implementation must reproduce.

| ID | goal | target | constraint | task_type | complexity | risk | phase_count | notes |
|---|---|---|---|---|---|---|---|---|
| F1 | "Add a tracker column to the intake form" | ["form.html"] | "" | BUILD | LOW | LOW | 2 | clean BUILD |
| F2 | "Audit all published pages for broken links" | ["public/","live/"] | "" | AUDIT | LOW | HIGH | 1 | risk promoted by prod-surface match (§1.4) |
| F3 | "Fix the save button crash" | ["app.js"] | "" | FIX | LOW | LOW | 2 | clean FIX |
| F4 | "Deploy v2 of the landing page" | ["public/landing.html"] | "" | DEPLOY | MED | HIGH | 3 | DEPLOY reversibility + prod surface bumps complexity |
| F5 | "Rewrite homepage hero copy" | ["homepage.md"] | "" | CONTENT | LOW | LOW | 1 | "rewrite" and "copy" both hit CONTENT |
| F6 | "Plan the authentication architecture" | ["auth/"] | "" | PLAN | LOW | LOW | 1 | clean PLAN |
| F7 | "Migrate the knowledge base into scoped files" | ["_KNOWLEDGE/MASTER.md"] | "" | SYSTEM_MIGRATION | LOW | HIGH | 3 | SYSTEM_MIGRATION auto-promotes risk |
| F8 | "Ship v2 of the admissions email to Mailchimp" | ["emails/admissions.mjml"] | "" | DEPLOY | LOW | HIGH | 2 | tie-break fixture: DEPLOY beats CONTENT via priority |
| F9 | "Audit and then fix the pricing table" | ["pricing.html"] | "" | FIX | LOW | LOW | 2 | tie-break fixture: FIX beats AUDIT via priority |
| F10 | "Create a new checklist template" | ["templates/checklist.md"] | "" | BUILD | LOW | LOW | 2 | clean BUILD, two BUILD keywords |
| F11 | "Refactor the auth middleware and ship it, per MR-1412" | ["middleware/auth.ts"] | "MR-1412" | SYSTEM_MIGRATION | MED | HIGH | 4 | tie-break (SYSTEM_MIGRATION beats DEPLOY) + MR bumps complexity |
| F12 | "" (empty goal) | ["x.md"] | "" | PLAN (needs_user_confirmation=true) | LOW | LOW | 1 | empty-goal AI-fallback fixture |

Three fixtures exercise tie-break behavior explicitly: F8 (DEPLOY > CONTENT), F9 (FIX > AUDIT), F11 (SYSTEM_MIGRATION > DEPLOY, plus MR authority bumping complexity from LOW to MED).

F12 is the empty-goal fallback fixture. The classifier returns `null` on empty input, and §1.2.3 routes to Stage 2 AI fallback. If Stage 2 also returns null or the network call fails, the default is `task_type = "PLAN"` with `needs_user_confirmation = true`. The fixture asserts both the default and the confirmation flag.

F2 and F7 exercise the risk-promotion rules in §1.4 that override complexity-derived risk (prod-surface match and SYSTEM_MIGRATION task type respectively).

The simulation script used to derive these values is reproducible: the classifier is deterministic, so running §1.2 through §1.4 on each row above must produce the table's outputs exactly. Any divergence between the implementation and the fixtures is an implementation bug, not a fixture error.

---

## 8. IMPLEMENTATION ORDER (SUGGESTED)

1. `interpretation.ts`: Stage 1 classifier only. Pass F1 through F11 (F12 requires AI fallback).
2. `interpretationAI.ts`: Stage 2 AI fallback. Pass F12. Keep the fixed prompt in `interpretationAI.prompt.txt`.
3. `phaseGen.ts`: phase count, role picker, dependency builder.
4. `stepGen.ts`: step count, intent dispatch, AI routing, model selection, thread policy.
5. `promptGen.ts`: NAMING CANON, body templates, prompt assembly, prompt validator.
6. `stateAssembly.ts`: turn interpretation plus phases plus steps into the existing state shape.
7. `deltaApply.ts`: delta pipeline and orphan handling.
8. `artifactPersistence.ts`: save/load/compact.
9. `integration`: wire everything behind an `onGenerate()` handler that replaces the current form's submit path. Keep the existing `genHTML` call unchanged.
10. Remove the old form DOM and its wiring only after integration passes all twelve fixtures and the seven operator-upgrade markers remain on generated output.

---

## 9. NON-GOALS

Not in scope for v2:
- Parallel phases (every phase is sequential).
- Multi-AI concurrency within a single step.
- Live preview of AI interpretation while the user types (deferred for UX polish).
- Automatic merging of multiple workflows.
- Time estimation beyond the existing fixed table.

---

## 10. NEXT ACTION

Context: execution-level logic specified. Implementation is the next thread.
Prompt: (M)-MMOS-IntakeEngine-Rebuild-PH1-CLAUDE-HIGH-001 (to be authored).
AI: Claude.
Model: Opus Required.
Thread: NEW.
Instruction: the follow-up prompt must reference this document and the v2 AUDIT document as authority, execute sections §1 through §5 as the interpretation and generation layer, and verify all twelve fixtures in §7 before any UI work.

---

END OF DOCUMENT
