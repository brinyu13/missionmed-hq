---
PROMPT ID: (M)-MMOS-CLAUDE-AUDIT-003
THREAD: (M) — MMOS Intake System Audit (Claude Self-Review)
TASK TYPE: SYSTEM AUDIT + RE-ARCHITECTURE
RISK LEVEL: HIGH
AUTHORITY: MMOS CORE
DATE: 2026-04-18
AUTHOR: Claude (self-review)
TARGET: _SYSTEM/INTAKE_ENGINE/MMOS_Intake_Engine.html
RELATED: _SYSTEM/INTAKE_ENGINE/INTAKE_SCHEMA.md, _SYSTEM/INTAKE_ENGINE/TEMPLATE_ENGINE.md
---

# MMOS Intake Engine: Audit and Re-architecture v2

RESULT: COMPLETE
SUMMARY: The current intake engine is a form builder dressed as an operating system. It should be replaced in-place with a 5-field minimal intake plus a 6-field optional advanced layer, backed by an interpretation engine that produces the existing state shape. The renderer, validator, operator-upgrade patches, and schema contract all stay.

---

## 1. AUDIT FINDINGS

### 1.1 What the current system actually is

Strip the design-token polish and the operator-upgrade patches and what remains is a structured text editor with validation. The user types a meta block, a workflow block, an overview block, rules, protection, a list of phases, a list of steps per phase, a prompt body per step, success criteria per step, failure recovery per step, a thread-rules block, a failures cheat sheet, a sessions plan, and a tracker. Around sixty fields if the workflow has two phases and one step each. More if not. The generator then renders those fields into a tabbed manual.

The generator is good. The intake layer is the problem.

### 1.2 Assumptions baked into the current design

The current form assumes the user already knows:
- the MissionMed workflow taxonomy (BUILD, AUDIT, FIX, DEPLOY, CONTENT, PLAN, SYSTEM_MIGRATION);
- the naming canon (project letter, manual code, phase number, AI, risk level, ordinal);
- how to decompose a goal into phases and phases into steps;
- how to write a prompt body that begins with RESULT header, tags TASK TYPE, carries AUTHORITY, and ends with a NEXT ACTION block;
- how to classify risk (LOW / MEDIUM / HIGH) against a deterministic rubric;
- how to route steps across AI tools (Claude vs Codex) and model tiers (Opus required, Sonnet OK);
- how to author a gate: which checks to run, what "all pass" means, what "any fail" implies;
- how to seed a failure-recovery protocol that the operator can actually follow.

In other words, the form assumes a user who could already write the manual by hand. For that user, filling the form is slower than just writing the manual in a markdown file. For every other user, the form is a wall.

### 1.3 Where it fails in real-world usage

Failure mode one: a senior operator opens the form, fills a few fields, and realizes the engine does not infer anything. They close it and write the manual in VS Code.

Failure mode two: a non-expert opens the form, sees nine sections and a phase tree, and does not know where to start. They either copy the preset and ship a copy of the example or they give up.

Failure mode three: the form has no cross-validation beyond "this field is required." Nothing checks whether the success criteria you wrote actually proves the prompt body you wrote did what the overview says it does. The user is the integrator. The engine is a typewriter.

Failure mode four: prompts authored by hand routinely drift from the canon. RESULT header missing, TASK TYPE tag wrong, thread name malformed, NEXT ACTION absent. The form does not catch this at intake because the form treats the prompt body as free text.

Failure mode five: the preset loader is the only fast path. The preset exists because intake was too painful without it. The moment the user needs a workflow the preset does not cover, they are back to the full form.

### 1.4 Cognitive load

The user must hold three models in working memory simultaneously: the problem they are trying to solve, the MMOS structural model (phases, steps, gates, threads, models), and the rendering model (how their inputs will look once generated). Each field they fill is a context switch across those three models. The form offers no scaffolding that compresses any of the three into recall, and no affordance that lets the user think only about the problem.

### 1.5 Scalability for non-expert users

None. The form is linear in the size of the manual it produces. A ten-phase workflow requires the user to fill something in the order of two hundred fields. There is no layer where the user describes intent in plain language and the system expands intent into structure. The tool does not teach the model, it demands the model.

### 1.6 Honest verdict

The system I built is well-executed for the wrong problem. The right problem is intent-to-manual. The problem I solved is structure-to-manual. A generator of structure-to-manual is a template engine, which is what the downstream half of the tool is and what it should remain. The intake layer in front of the template engine is the piece that was built as if the user wanted a structured editor. The user wants an operating system.

The design is not defensible. It should be replaced.

---

## 2. HYBRID MODEL DECISION

### 2.1 Is hybrid correct

Yes, with one condition. A minimal-plus-advanced split is the right architecture only if the minimal layer, on its own, produces a correct, runnable manual for the common case. If the minimal path depends on the advanced panel, the split is fake and the advanced panel becomes the real form. The test is simple: a first-time user who never opens the advanced panel must still get a usable manual.

### 2.2 Risks of hybrid systems

Creeping minimums. Product pressure will push new required fields into the minimal layer one at a time. Each addition looks reasonable in isolation. After three quarters the minimal layer has fifteen fields and is indistinguishable from the form it replaced.

Leaky abstractions. When the AI interpretation gets something subtly wrong, the user opens the advanced panel to fix it, finds the fix unsatisfying, and loses trust in the minimal layer. Over time they fill advanced out of defense, not necessity.

Override ambiguity. The user overrides one field, AI infers the rest. The result satisfies neither the override nor the coherent AI interpretation because the AI never re-ran the full chain after the override. This is the most common failure in hybrid generators.

Silent nondeterminism. Two runs with the same minimal input produce different manuals because AI temperature or prompt drift introduces variance. The user cannot predict the output. Trust collapses.

The half-full form problem. If the advanced panel is visible on load, the user fills it. A panel that is present is a panel that is used. Minimal layers that share screen real estate with advanced layers always lose.

### 2.3 How to prevent collapse back to a manual form

Five guardrails, all structural, not cultural.

First, a hard ceiling on the minimal layer. Five fields, enforced in code, with a comment at the top of the file stating that any addition requires an MR-level amendment. The ceiling is code, not policy.

Second, advanced is collapsed by default and does not appear in the initial render path. It is reachable through a single affordance ("Show advanced"), and closing the affordance hides the panel completely. The user must take a deliberate action to see it.

Third, every advanced field shows the inferred value first. The user does not fill advanced; they override inferred. An override is an edit of a known starting point, not a blank entry. This changes the psychology of the panel from "another form" to "a diff."

Fourth, determinism. The interpretation engine runs a deterministic keyword and regex classifier first and only falls back to an AI call when the classifier cannot decide. AI calls use temperature zero and a fixed prompt. Same input produces same output. When the AI layer is invoked, the user sees which fields it set and with what confidence.

Fifth, a diff view on every generation. Every field the system chose is shown as "inferred: X" next to any "override: Y." Overrides are auditable. The user can always see what the AI thought and what they changed. Regenerations preserve overrides.

With those five guardrails the hybrid does not collapse. Without them it does.

---

## 3. SYSTEM REDESIGN

### 3.1 Minimal input layer (five required fields)

1. Goal. One free-form paragraph. What do you need done, in plain language. This is the only prose field.
2. Target. File paths, directory names, or system names the work touches. Comma-separated list.
3. Project letter. A single letter for the naming canon (A, M, S, I, custom). Dropdown.
4. AI tools available. Checkboxes: Claude, Codex.
5. Known constraint. One line. Deadline, do-not-touch list, required authority. Empty is allowed but the field is always visible to force the user to consider it.

No phase tree. No step editor. No prompt authoring. No risk classification. No thread rules. No gates. The five fields describe intent and scope, nothing else.

### 3.2 Optional advanced layer (six fields, collapsed by default)

1. Workflow type override (BUILD, AUDIT, FIX, DEPLOY, CONTENT, PLAN, SYSTEM_MIGRATION).
2. Risk override (LOW, MEDIUM, HIGH).
3. Phase count override (integer).
4. Model policy (Opus required everywhere, Sonnet OK where safe, per-step AI routing).
5. Thread policy (NEW per step, NEW per phase, SAME where possible).
6. Custom prompt templates. Paste-to-override for any generated step.

Every field shows the inferred value in ghost text before the user types. The user never fills advanced from scratch.

### 3.3 Interpretation engine

Three stages, in order. Each stage is capped on latency and fails over to the next.

Stage one. Deterministic classifier. A keyword and regex map on Goal and Target produces a first-pass interpretation: workflow type, candidate phase count, candidate risk level. "Audit, validate, verify, check" maps AUDIT. "Build, create, generate, scaffold" maps BUILD. "Fix, repair, debug, patch" maps FIX. "Deploy, push, publish, release" maps DEPLOY. "Copy, rewrite, draft, tone" maps CONTENT. "Plan, design, architect, spec" maps PLAN. "Migrate, refactor, split, consolidate" maps SYSTEM_MIGRATION. Risk: any word in the Target field matching a production path, a deployment surface, or an external system bumps risk upward. Authority rubric from PRIMER_CORE §6 applies as a deterministic table. If the classifier resolves unambiguously, stage one is the final answer.

Stage two. AI interpretation, conditional. Only runs when the classifier is ambiguous or when the Goal crosses a length threshold. A single Claude call with a fixed prompt that returns a JSON object: workflow_type, risk_level, phase_count, per-phase title, per-step task type, per-step AI, per-step model, naming prefix, thread policy. Temperature zero. The prompt is checked into the repo so the interpretation is reproducible from source.

Stage three. Validation. The interpretation JSON must pass the existing schema validator that today governs the form. A failure surfaces to the user as a "fix and regenerate" affordance with the offending field highlighted. No silent fallbacks.

### 3.4 Generation engine

The interpretation JSON maps one-to-one to the existing state shape. The existing genHTML function runs unchanged. The entire operator-upgrade stack (all seven patches from the previous thread) continues to apply because it operates on the generated manual, not on the intake. The template engine is the preserved asset. It is not rebuilt and it is not modified.

This is the critical insight. The generator does not need to change. Only the source of its input does.

### 3.5 Override logic

Two paths. Path one, the user overrides a field in the advanced panel before first generation. The override is recorded as a delta against the inferred value. Interpretation runs. Generation runs with the delta applied at the correct stage. Path two, the user edits a generated step from the preview pane. The edit is recorded as a delta against the generated state. Regeneration re-runs interpretation on minimal input and re-applies all recorded deltas on top in deterministic order.

Save and load preserve both the minimal input and the delta list as a single JSON artifact. A workflow can be reproduced from its minimal input plus its deltas. Regeneration after a template-engine upgrade is therefore deterministic and safe.

---

## 4. SIDE-BY-SIDE COMPARISON

The following reads left-to-right: original system, then new system.

Fields to fill for a two-phase workflow: approximately sixty, then five (optionally plus six).

Time to first runnable manual: twenty to forty minutes of sustained form-filling, then sixty to one hundred twenty seconds of typing the Goal and Target.

Cognitive load: the user holds the problem, the MMOS model, and the rendering model in working memory simultaneously. In the new system the user holds only the problem.

Failure modes at intake: prompt bodies drift from canon, naming is inconsistent, RESULT headers are omitted, risk is misclassified, gates are underspecified. In the new system all of those fields are generated from templates that enforce the canon at generation time.

Scalability in manual size: linear in fields filled. In the new system, constant regardless of manual size because the user still only fills the minimal layer.

Works for a novice operator: no. In the new system, yes, because the only prose the novice writes is the goal statement.

Reproducibility: the original form produces exactly what the user types, which is reproducible but brittle. The new system produces deterministic interpretations from the same minimal input, which is reproducible AND robust to schema upgrades.

Error risk: high (manual prompt authoring, manual classification, manual routing). Low (templates enforce the canon, interpretation passes the existing validator).

Teaching effect: the original form teaches nothing because it only accepts correct inputs without explaining what correct looks like. The new system teaches by showing interpretations as ghost text, which makes the inferred structure visible and learnable.

The original system was a blank-page editor with validation. The new system is an operating system in front of the same renderer.

---

## 5. IMPLEMENTATION PLAN

### 5.1 Remove

The current intake form DOM and its wiring. Specifically the phase tree editor, the per-step manual field blocks (success criteria, AI fit, dependency note, risk override, confidence, gap, prompt body textarea, pre/post action, results note), the rules / protection / thread-rules / failures / sessions / tracker input groups, and the manual naming-canon composer. Remove the preset loader from the primary UX surface. Remove all intake-side validation that assumed the user authored prompts; that responsibility moves to interpretation.

### 5.2 Keep

The state shape. The phases[] with steps[] structure is the contract between intake and rendering and should not move. The entire genHTML function and every block renderer (genHeader, genSidebar, genStartHereTab, genPhaseTab, genStep, genGate, genRulesTab, genThreadRulesTab, genFailuresTab, genSessionsTab, genTrackerTab, genCSS, genJS). The validator. The operator-upgrade stack, unchanged: START HERE block, hard NEXT ACTION, FAILURE PROTOCOL with report-back prompt, explicit AI / Model / Thread control, verify block with task-type dispatch, SAFE TO PROCEED signal, terminal copy blocks. Design tokens and the mmx- namespace. Save / Load / Copy-HTML / JSON export-import.

### 5.3 Add

A five-field minimal intake panel as the new primary UX. A collapsed six-field advanced panel with inferred values shown as ghost text. An interpretation module containing the deterministic classifier, the AI-call adapter (with a fixed prompt checked into the repo), and the JSON validator. A preview pane that renders the interpreted phases and steps before the user commits. An edit overlay that captures deltas on any generated step. A regenerate-with-deltas button. A "how this was interpreted" diff view that shows every inferred field, its source (classifier vs AI), and any user override. A confidence indicator per generated step based on classifier certainty.

### 5.4 Modify in-place or rebuild

Modify in-place. Three reasons.

First, the state shape and the renderer are sound. Rebuilding them risks regression on the seven operator-upgrade patches, the naming canon enforcement, the RESULT header contract, and the self-contained single-file property. None of those gain anything from a rebuild.

Second, the delta between the current file and the target is well-scoped. The intake form is approximately 400 to 600 lines of HTML plus wiring JS. Replacing it with a minimal panel, an advanced panel, an interpretation module, and a preview pane is approximately 300 to 500 lines net. This is a surgical refactor, not a reconstruction.

Third, the intake layer is not coupled to the renderer through anything except the state shape. The coupling is already minimal. A clean replacement at the intake layer does not cascade downstream.

Scope of modification: replace the intake DOM block and its JS handler functions; insert the interpretation module as a new self-contained script region; extend the existing state machine to track minimal-input plus deltas separately from resolved state; leave the renderer call site unchanged.

### 5.5 Suggested sequencing

Sequence one. Implement the interpretation engine as a pure module with no UI coupling. Validate it against twelve hand-written fixture goals (two per workflow type, five variations of risk input). Gate: every fixture produces valid state that passes the current validator.

Sequence two. Implement the minimal panel and wire it to the interpretation engine. Emit state to the existing genHTML and confirm a complete manual renders. Gate: end-to-end minimal path produces a runnable manual with all seven operator-upgrade blocks present.

Sequence three. Implement the advanced panel with ghost-text inferred values and override capture. Gate: overriding any field produces a delta that survives save/load.

Sequence four. Implement the preview pane and the edit overlay with delta capture on generated steps. Gate: editing a step, saving, reloading, and regenerating preserves the edit.

Sequence five. Remove the old form DOM and wiring. Gate: file parses under new Function, validator returns zero errors on a blank state, minimal path still produces a manual, generated manual still passes the seven-patch marker check.

Each sequence is a separately committable checkpoint.

### 5.6 Out of scope for this prompt

Actual code changes. This document is the audit and redesign spec. Implementation is the next prompt.

---

## 6. NEXT ACTION

Context: audit and redesign delivered. Implementation deferred to a follow-up prompt.
Prompt: (M)-MMOS-IntakeEngine-Rebuild-PH1-CLAUDE-HIGH-001 (to be authored).
AI: Claude.
Model: Opus Required.
Thread: NEW (implementation is a new high-risk phase).
Instruction: the follow-up prompt should reference this document as the authority, load PRIMER_CORE and MASTER_KNOWLEDGE, and execute Sequence 1 of §5.5 (interpretation engine as a pure module with twelve fixture goals) before any UI work.

---

END OF DOCUMENT
