# MMOS MASTER OPERATOR MANUAL (v1.0)

**Prompt ID:** (M)-MMOS_MASTER_MANUAL_GENERATION-080
**Authority:** MR-1367 (Workflow OS) + MR-1377 (Operator Manual pattern) + MR-SYS-001 (Naming Canon)
**Target Render:** MR-1377_Workflow_OS_Operator_Manual_v3.html (via `htmlManualGenerator.js` v2.0)
**Project Letter:** M
**Status:** LOCKED
**Date:** 2026-04-18

This document is the paint-by-numbers operator manual for running MMOS (MissionMed Workflow Operating System) end-to-end. Follow it in order. Pass every gate before moving on. Every step returns `RESULT: COMPLETE` or the operator does not proceed.

---

## SECTION 1 - SYSTEM OVERVIEW

MMOS is a deterministic pipeline that converts one plain-English goal into one fully-generated operator manual. The manual is a single HTML file structured exactly like MR-1377: navy sticky header, left sidebar with phase tabs, per-step navy header plus white card, dark prompt blocks with copy buttons, phase gates with git checkpoint commands, next-action panels.

The pipeline is six engines chained in fixed order. No engine decides which downstream engine runs. No engine skips. No engine re-enters upstream state. The contract between engines is a JSON-shaped object passed by value.

1. **InterpretationEngine** reads the goal and returns `{ taskType, complexity, risk, goal, targets, project }`. TaskType is one of BUILD, AUDIT, FIX, DEPLOY, CONTENT, PLAN, SYSTEM_MIGRATION. Complexity and risk are LOW, MED, HIGH. This engine is keyword-based and deterministic. It never calls an LLM at runtime.
2. **PhaseGenerator** reads the interpreted input and returns an ordered list of phase objects. Phase count is a pure function of complexity (LOW=2, MED=3, HIGH=4) and phase roles are a pure function of task type.
3. **StepGenerator** reads the phase list and returns an ordered list of step objects, each tagged with its owning phase, an intent verb, an action sentence, and a routing triple (AI, model, thread).
4. **PromptGenerator** reads the step list and returns one prompt object per step: promptName (per naming canon), threadName, promptBody.
5. **IntegrationEngine** assembles the four engine outputs into one `workflowOutput` envelope. It also asserts the shape of each engine output and throws before rendering if any contract is violated.
6. **htmlManualGenerator (v2.0)** reads the envelope and returns the final single-file HTML manual.

The operator does not run these engines by hand. The operator runs a single entry point, inspects the rendered manual, and executes the sub-manual from there.

What the operator puts in: one `intake` object matching `INTAKE_SCHEMA.md` (at minimum META + WORKFLOW + OVERVIEW + one or more PHASES). What the operator gets out: one HTML file at `/Users/brianb/MissionMed/_SYSTEM/INTAKE_ENGINE/_BACKUPS/MMOS_Manual_<timestamp>.html` and a matching entry in `MM_ACTIVITY_LOG.md`.

Naming canon applies to every output: `({PROJECT})-MMOS-PH{#}-{AI}-{LEVEL}-{###}` for prompts, `({PROJECT}) - [Short Task Description]` for threads. Project letter is a single uppercase A-Z and is never mixed across a single build.

---

## SECTION 2 - PHASE ARCHITECTURE

The master manual has six phases. Each phase has a fixed role, a small number of steps, and a gate. Operator never advances past a gate without all checks passing.

**Phase 1 - INTAKE.** Gather the goal, targets, and any MR authority references into the `intake` object. Fill every REQUIRED field in `INTAKE_SCHEMA.md` §3. Leave OPTIONAL fields blank if not applicable.

**Phase 2 - INTERPRET.** Run `InterpretationEngine.interpretInput(intake)`. Inspect the returned envelope. Confirm `taskType`, `complexity`, and `risk` match expectation. If `needs_user_confirmation` appears in flags, the input is too ambiguous; return to Phase 1.

**Phase 3 - GENERATE.** Run the three generators in fixed order: phases, steps, prompts. No step runs before phases return. No prompt runs before steps return. Every generator output is validated by `IntegrationEngine.assert*` before moving on.

**Phase 4 - RENDER.** Run `htmlManualGenerator.generateHTMLManual(workflowOutput)`. Write the result to `_BACKUPS/MMOS_Manual_<timestamp>.html`. Do not hand-edit the HTML.

**Phase 5 - VERIFY.** Open the rendered manual. Perform the visual QA checklist (header, sidebar, phase tabs, step cards, prompt blocks, gate boxes, em-dash audit). Run the structural test harness if any doubt. Any defect found in this phase blocks Phase 6.

**Phase 6 - DISTRIBUTE.** Append to activity log. Hand the rendered HTML to the downstream operator (or execute it yourself in a fresh session). Commit checkpoint. Done.

Phase 1 is operator work. Phases 2-5 are engine work with operator inspection at each gate. Phase 6 is operator work again.

---

## SECTION 3 - EXECUTION MANUAL

Every step below carries: step number, intent, AI selection, model, thread type, exact prompt (where applicable), expected output, success criteria, and the hard rule `RESULT: COMPLETE → proceed` or `RESULT != COMPLETE → DO NOT PROCEED`.

Steps are numbered `PHASE.STEP` (e.g., `1.1`, `4.2`). Each step is atomic. No step has hidden sub-steps.

### PHASE 1 - INTAKE

#### Step 1.1 - Capture goal
- **AI:** Operator (human)
- **Model:** N/A
- **Thread:** N/A
- **What you do:** Write the single-sentence goal in plain English. Minimum 20 characters. Must contain a verb and a noun. Must name at least one target artifact or subsystem.
- **Expected output:** A string like `"Rebuild the Arena matchmaking flow for STAT v2 using Supabase as the duel store."`
- **Success criteria:** Verb present, noun present, target named, length ≥ 20 chars, no em-dashes, no hedging words like "maybe" or "possibly".
- **Gate:** RESULT: COMPLETE → proceed to 1.2. RESULT != COMPLETE → rewrite the goal.

#### Step 1.2 - Capture targets
- **AI:** Operator
- **What you do:** List every file, module, or subsystem the work will touch. Use the MissionMed naming canon (§1 of `NAMING_CANON.md`): MedMail, Leads, Payments, Students, Member Dashboard, Media Engine, Studio, Admin Engine. Use deprecated names at your peril; the canon auto-corrects but you will thrash.
- **Expected output:** Array of 1 to ~20 strings.
- **Success criteria:** Every entry matches a canonical module or a real file path that exists or will exist. No generic placeholders like "everything" or "the site".
- **Gate:** RESULT: COMPLETE → proceed to 1.3. RESULT != COMPLETE → DO NOT PROCEED.

#### Step 1.3 - Assign project letter
- **AI:** Operator
- **What you do:** Pick one uppercase letter A-Z. Use an existing letter if this is a continuation. Use a fresh letter if this is a new workstream. Never mix letters inside one build.
- **Expected output:** Single character `[A-Z]`.
- **Success criteria:** Letter is a single uppercase ASCII character. Letter is consistent with any in-flight work (check `MM_ACTIVITY_LOG.md` tail for recent letters).
- **Gate:** RESULT: COMPLETE → proceed to 1.4. RESULT != COMPLETE → DO NOT PROCEED.

#### Step 1.4 - Fill INTAKE_SCHEMA object
- **AI:** Operator (or Claude Sonnet for drafting assistance)
- **Model:** Sonnet OK
- **Thread:** New thread
- **What you do:** Populate a JSON object with META + WORKFLOW + OVERVIEW + PHASES[] per `INTAKE_SCHEMA.md`. If assisting with Sonnet, use the prompt below.
- **Prompt (optional drafting assist):**

```
Thread: (M) - MMOS Intake Drafting

You are drafting an MMOS intake object. Do not invent scope.

GOAL: [paste Step 1.1 output]
TARGETS: [paste Step 1.2 output]
PROJECT LETTER: [paste Step 1.3 output]

Required: produce a JSON object with top-level keys META, WORKFLOW, OVERVIEW, PHASES. Fill every REQUIRED field per INTAKE_SCHEMA.md §3. Leave OPTIONAL fields empty. No em-dashes. No hedging. No invented MR numbers.

RESULT: COMPLETE + valid JSON, or RESULT: FAILED + missing-field list.
```

- **Expected output:** Valid JSON parseable by `JSON.parse`.
- **Success criteria:** `JSON.parse` succeeds. Every REQUIRED field from §3.1 through §3.8 present. Project letter matches Step 1.3. No em-dashes (U+2014) anywhere.
- **Gate:** RESULT: COMPLETE → proceed to 2.1. RESULT != COMPLETE → fix missing fields and re-run 1.4.

#### Phase 1 Gate
```
[ ] Step 1.1 (capture goal) returned RESULT: COMPLETE
[ ] Step 1.2 (capture targets) returned RESULT: COMPLETE
[ ] Step 1.3 (assign project letter) returned RESULT: COMPLETE
[ ] Step 1.4 (fill intake schema) returned RESULT: COMPLETE

ALL PASS? Run: git add -A && git commit -m "MMOS-CHECKPOINT: Phase 1 INTAKE complete"
ANY FAIL? Fix the failing step. Re-run.
```

---

### PHASE 2 - INTERPRET

#### Step 2.1 - Run interpretation engine
- **AI:** Codex (engine invocation, not a chat)
- **Model:** N/A (local Node.js execution)
- **Thread:** N/A
- **What you do:** From the MissionMed workspace, run:

```bash
cd /Users/brianb/MissionMed/_SYSTEM/INTAKE_ENGINE
node -e "const e = require('./interpretationEngine'); console.log(JSON.stringify(e.interpretInput(require('./_staging/intake.json').goal, require('./_staging/intake.json')), null, 2))"
```

- **Expected output:** JSON envelope with keys `taskType`, `complexity`, `risk`, `goal`, `targets`, `project`, `flags`, `debugTrace`.
- **Success criteria:** `taskType` is one of BUILD/AUDIT/FIX/DEPLOY/CONTENT/PLAN/SYSTEM_MIGRATION. `complexity` and `risk` ∈ {LOW, MED, HIGH}. `flags` does NOT contain `needs_user_confirmation`. `debugTrace.decisionPath` is a non-empty string.
- **Gate:** RESULT: COMPLETE → proceed to 2.2. If `needs_user_confirmation` present → goal is too short/ambiguous → return to 1.1. If `decisionPath=PHRASE_DOMINANT` and `matchedPhrases` looks suspicious (single preposition fragment) → review and either accept or return to 1.1.

#### Step 2.2 - Operator classification review
- **AI:** Claude Opus (reasoning review, not execution)
- **Model:** Opus Required
- **Thread:** New thread
- **What you do:** Paste the interpreter envelope and confirm the classification matches your mental model.
- **Prompt:**

```
Thread: (M) - MMOS Classification Review

CONTEXT:
InterpretationEngine returned the following for my intake:
[paste envelope JSON]

TASK:
Assess whether taskType, complexity, and risk match the intent of the goal. Use only the goal string and the envelope; do not speculate.

ASSESS:
1. Does taskType reflect the primary verb class of the goal? Y/N + one-line reason.
2. Is complexity calibrated (phrase-boosters, scope-breadth, multi-intent)? Y/N + reason.
3. Is risk appropriate? Does the goal touch production surfaces (payment, auth, env, Dockerfile, prod/)? Y/N + reason.
4. decisionPath review: is the winning path evidenced by matchedKeywords, not a single preposition substring?

If all four pass: RESULT: COMPLETE.
If any fails: RESULT: FAILED + which of (1)(2)(3)(4) failed + recommended action (re-classify manually, bump risk, rewrite goal).
```

- **Expected output:** A four-line assessment ending in RESULT.
- **Success criteria:** Exactly one RESULT line. If RESULT: FAILED, a specific numbered defect is cited and an action is named.
- **Gate:** RESULT: COMPLETE → proceed to 3.1. RESULT: FAILED → take the named action and re-run Phase 2.

#### Phase 2 Gate
```
[ ] Step 2.1 (run interpreter) returned RESULT: COMPLETE
[ ] Step 2.2 (classification review) returned RESULT: COMPLETE

ALL PASS? Run: git add -A && git commit -m "MMOS-CHECKPOINT: Phase 2 INTERPRET complete"
ANY FAIL? Return to Phase 1 or manually override and document the override in the intake object.
```

---

### PHASE 3 - GENERATE

#### Step 3.1 - Generate phases
- **AI:** Codex (engine invocation)
- **Thread:** N/A
- **What you do:** Run:

```bash
node -e "const g=require('./phaseGenerator'); const i=require('./_staging/interpreted.json'); console.log(JSON.stringify(g.generatePhases(i),null,2))" > _staging/phases.json
```

- **Expected output:** Array of phase objects, each with `phaseNumber`, `role`, `title`, `description`. Count matches complexity (LOW=2, MED=3, HIGH=4).
- **Success criteria:** Array length correct for complexity. `role` values drawn from the fixed role set (e.g., PLAN, IMPLEMENT, VALIDATE, FINALIZE). No duplicate phase numbers.
- **Gate:** RESULT: COMPLETE → proceed to 3.2. RESULT != COMPLETE → inspect phaseGenerator input; re-run or file bug.

#### Step 3.2 - Generate steps
- **AI:** Codex (engine invocation)
- **Thread:** N/A
- **What you do:**

```bash
node -e "const g=require('./stepGenerator'); const i=require('./_staging/interpreted.json'); const p=require('./_staging/phases.json'); console.log(JSON.stringify(g.generateSteps(i,p),null,2))" > _staging/steps.json
```

- **Expected output:** Array of step objects with `phaseNumber`, `stepNumber`, `intent`, `action`, `ai`, `model`, `thread`.
- **Success criteria:** Every phase has ≥1 step. Every step carries a valid routing triple. `stepNumber` monotonic across the array.
- **Gate:** RESULT: COMPLETE → proceed to 3.3. RESULT != COMPLETE → DO NOT PROCEED.

#### Step 3.3 - Generate prompts
- **AI:** Codex (engine invocation)
- **Thread:** N/A
- **What you do:**

```bash
node -e "const g=require('./promptGenerator'); const i=require('./_staging/interpreted.json'); const s=require('./_staging/steps.json'); console.log(JSON.stringify(g.generatePrompts(i,s),null,2))" > _staging/prompts.json
```

- **Expected output:** Array of prompt objects: `promptName`, `threadName`, `promptBody`. One per step.
- **Success criteria:** Every `promptName` matches `^\([A-Z]\)-MMOS-PH\d+-(CLAUDE|CODEX)-(HIGH|MED|LOW)-\d{3}$`. `promptBody` begins with `RESULT:`. All project letters identical across the array.
- **Gate:** RESULT: COMPLETE → proceed to 3.4. RESULT != COMPLETE → DO NOT PROCEED.

#### Step 3.4 - Assemble and assert envelope
- **AI:** Codex
- **Thread:** N/A
- **What you do:**

```bash
node -e "const ie=require('./integrationEngine'); const env=ie.assemble(require('./_staging/interpreted.json'),require('./_staging/phases.json'),require('./_staging/steps.json'),require('./_staging/prompts.json')); ie.assertAll(env); require('fs').writeFileSync('_staging/workflowOutput.json', JSON.stringify(env,null,2))"
```

- **Expected output:** File `_staging/workflowOutput.json` written, no thrown exception.
- **Success criteria:** `integrationEngine.assertAll` returns without throwing. File size > 0.
- **Gate:** RESULT: COMPLETE → proceed to 4.1. RESULT != COMPLETE → read the thrown message, fix the upstream generator, re-run from Step 3.1.

#### Phase 3 Gate
```
[ ] Step 3.1 (generate phases) returned RESULT: COMPLETE
[ ] Step 3.2 (generate steps) returned RESULT: COMPLETE
[ ] Step 3.3 (generate prompts) returned RESULT: COMPLETE
[ ] Step 3.4 (assemble and assert) returned RESULT: COMPLETE

ALL PASS? Run: git add -A && git commit -m "MMOS-CHECKPOINT: Phase 3 GENERATE complete"
ANY FAIL? Fix the failing generator. Do not proceed to render.
```

---

### PHASE 4 - RENDER

#### Step 4.1 - Render HTML manual
- **AI:** Codex (engine invocation)
- **Thread:** N/A
- **What you do:**

```bash
node -e "const h=require('./htmlManualGenerator'); const env=require('./_staging/workflowOutput.json'); const html=h.generateHTMLManual(env); const ts=new Date().toISOString().replace(/[-:T.Z]/g,'').slice(0,14); require('fs').writeFileSync('_BACKUPS/MMOS_Manual_'+ts+'.html', html); console.log('WROTE _BACKUPS/MMOS_Manual_'+ts+'.html ('+html.length+' bytes)')"
```

- **Expected output:** A single line `WROTE _BACKUPS/MMOS_Manual_<ts>.html (<bytes> bytes)` with bytes > 20,000.
- **Success criteria:** File exists. `bytes > 20000`. `grep -c 'class="step-header"' <file>` equals the number of steps in `_staging/steps.json`.
- **Gate:** RESULT: COMPLETE → proceed to 5.1. RESULT != COMPLETE → DO NOT PROCEED.

#### Phase 4 Gate
```
[ ] Step 4.1 (render HTML) returned RESULT: COMPLETE

ALL PASS? Run: git add -A && git commit -m "MMOS-CHECKPOINT: Phase 4 RENDER complete"
ANY FAIL? Re-read the thrown message. Fix the generator or the envelope. Re-run.
```

---

### PHASE 5 - VERIFY

#### Step 5.1 - Structural test
- **AI:** Codex
- **Thread:** N/A
- **What you do:**

```bash
node /Users/brianb/MissionMed/_SYSTEM/INTAKE_ENGINE/tests/test_html_manual_generator.js
```

- **Expected output:** Final line `PASS`. JSON stats block shows `missing_needles: []`, `emdashes: 0`, and step/prompt counts matching the envelope.
- **Success criteria:** Exit code 0. `PASS` printed. Zero em-dashes. All 25 structural markers present.
- **Gate:** RESULT: COMPLETE → proceed to 5.2. RESULT != COMPLETE → DO NOT PROCEED.

#### Step 5.2 - Visual QA
- **AI:** Operator (human eyes)
- **Thread:** N/A
- **What you do:** Open the rendered HTML in a browser. Walk the checklist:

```
[ ] Sticky navy header visible (color #0F2A44)
[ ] Left sidebar 260px wide with three groups (Start / Execute / Reference)
[ ] Overview tab shows verdict-box + status-panel + objective + phase map + format + next-box
[ ] Each phase tab opens cleanly on click
[ ] Every step has a navy step-header + white step-body joined seamlessly
[ ] Every step-header shows AI badge + model badge + thread badge
[ ] Every step-body contains a dark prompt-block with accent label + copy button
[ ] Copy button flashes "Copied!" for 1.5s when clicked
[ ] Every phase tab ends with a gate-box (dark, monospace, with git commit command)
[ ] Every phase tab ends with a green next-box
[ ] Zero em-dashes visible anywhere
```

- **Expected output:** All 11 checks ticked.
- **Success criteria:** Every check box ticked. If any check fails, note which and fix upstream before proceeding.
- **Gate:** RESULT: COMPLETE → proceed to 5.3. RESULT != COMPLETE → DO NOT PROCEED.

#### Step 5.3 - Classifier sanity (Claude Opus review)
- **AI:** Claude Opus
- **Model:** Opus Required
- **Thread:** Same thread as 2.2
- **What you do:** Paste the final rendered HTML head + first phase tab. Ask for a drift audit.
- **Prompt:**

```
CONTEXT:
The operator manual attached was generated by MMOS for goal "[paste goal]". Classified as taskType=[x] complexity=[y] risk=[z].

TASK:
Compare the first phase tab against the claimed classification. Does the step count, intent distribution, and routing (Claude vs Codex mix) align with a [taskType]/[complexity] workflow?

ASSESS:
1. Step count matches complexity band (LOW=4 / MED=8-9 / HIGH=12-16)? Y/N
2. Intent distribution reflects taskType (e.g., BUILD has generate_code + edit_file + test; AUDIT has analyze + review)? Y/N
3. Routing has Codex on implementation steps, Claude on reasoning/review steps? Y/N

RESULT: COMPLETE if all three pass, RESULT: FAILED + numbered defect otherwise.
```

- **Expected output:** Three-line assessment plus RESULT.
- **Success criteria:** All three pass.
- **Gate:** RESULT: COMPLETE → proceed to 6.1. RESULT: FAILED → return to Phase 2 with the manually-noted override, or file a bug against the generator.

#### Phase 5 Gate
```
[ ] Step 5.1 (structural test) returned RESULT: COMPLETE
[ ] Step 5.2 (visual QA) returned RESULT: COMPLETE
[ ] Step 5.3 (classifier sanity) returned RESULT: COMPLETE

ALL PASS? Run: git add -A && git commit -m "MMOS-CHECKPOINT: Phase 5 VERIFY complete"
ANY FAIL? Do not distribute. Fix upstream.
```

---

### PHASE 6 - DISTRIBUTE

#### Step 6.1 - Activity log entry
- **AI:** Operator (with Sonnet drafting)
- **Model:** Sonnet OK
- **Thread:** New thread
- **What you do:** Append one structured entry to `/Users/brianb/MissionMed/_SYSTEM_LOGS/MM_ACTIVITY_LOG.md`. Follow the format used by prior entries: `###` heading with date + prompt ID, then Prompt ID, Task, Files Modified, Result, Risk Level, Verification, Learning Update, Status. Append only. Never overwrite.
- **Success criteria:** Entry length ≥ 25 lines. Contains all eight required sections. Zero em-dashes.
- **Gate:** RESULT: COMPLETE → proceed to 6.2. RESULT != COMPLETE → DO NOT PROCEED.

#### Step 6.2 - Hand off the rendered manual
- **AI:** Operator
- **Thread:** N/A
- **What you do:** Open the rendered HTML (or send it to the downstream operator). Execute the sub-manual end-to-end. Each step in the sub-manual is itself gated by RESULT: COMPLETE.
- **Success criteria:** Every phase of the sub-manual reaches its gate. Every gate passes. Final gate emits the `MMOS-COMPLETE: System operational` commit.
- **Gate:** RESULT: COMPLETE → proceed to 6.3. RESULT != COMPLETE → fix the failing sub-manual step, do not re-generate the sub-manual without documenting why.

#### Step 6.3 - Final checkpoint
- **AI:** Operator
- **Thread:** N/A
- **What you do:**

```bash
git add -A && git commit -m "MMOS-COMPLETE: [project letter] [short title] operational"
```

- **Success criteria:** Commit succeeds. Activity log entry Status field reads COMPLETE.
- **Gate:** RESULT: COMPLETE → done. RESULT != COMPLETE → commit failure is a blocking defect; resolve before walking away.

#### Phase 6 Gate
```
[ ] Step 6.1 (activity log entry) returned RESULT: COMPLETE
[ ] Step 6.2 (hand off rendered manual) returned RESULT: COMPLETE
[ ] Step 6.3 (final checkpoint) returned RESULT: COMPLETE

ALL PASS? Build complete. Final commit already issued in 6.3.
ANY FAIL? Fix and re-run the failing step. Do not call the workstream done.
```

---

## SECTION 4 - GATING SYSTEM

Gates are what keep MMOS deterministic. Every phase has one. Every gate is a checkbox list of its own steps, each tagged `RESULT: COMPLETE`. The gate passes only when every checkbox is ticked. Pass emits an exact git commit command with the format `MMOS-CHECKPOINT: Phase N <ROLE> complete`. Fail returns to the failing step.

Three rules govern all gates.

Gates never skip. If you find yourself ticking a box without having actually run the step, you have broken the manual. Re-run the step.

Gates never re-open. Once a phase gate has been committed, its steps are frozen. To change a completed step, start a new workstream under a new project letter.

Gates are the only legitimate hand-off points. Handing off work to another operator, another session, or another AI mid-phase is a protocol violation. Wait for the next gate. If you cannot wait, document an emergency hand-off in the activity log with reason, current step number, and expected re-entry point.

The final gate (Phase 6) emits `MMOS-COMPLETE: [project letter] [short title] operational`. This commit is the only signal that the entire workstream is done. Absence of this commit means the workstream is not done regardless of how the HTML looks.

---

## SECTION 5 - FAILURE PATHS

Failures are expected and named. Each has a detection signal, a diagnosis, a remediation, and a re-entry point. Any failure not listed here is a novel defect and requires a new audit cycle before proceeding.

**F1 - Goal too short.** Detection: InterpretationEngine returns `flags` containing `needs_user_confirmation`. Diagnosis: goal is under 5 characters or contains no verb. Remediation: rewrite the goal with an explicit verb, target, and outcome. Re-entry: Step 1.1.

**F2 - Classification phrase-dominant on weak evidence.** Detection: `debugTrace.decisionPath=PHRASE_DOMINANT` with `matchedKeywords=[]` and `matchedPhrases` containing only a preposition fragment (e.g., `"into the "`, `"via the "`). Diagnosis: the goal triggered a phrase booster via substring match without any keyword evidence. Remediation: manually override taskType in the intake object and add a note. File a bug against `interpretationEngine.PHRASE_BOOSTERS`. Re-entry: Step 2.2 with manual override.

**F3 - Production surface not detected.** Detection: envelope shows `risk=LOW` but targets include a known production path (`payment/`, `auth/`, `production/`, `.env`, `Dockerfile`). Diagnosis: `PRODUCTION_SURFACE_RE` coverage gap. Remediation: manually set `risk=HIGH` in the intake object and add a protection block. Re-entry: Step 2.1 with override, then Step 2.2.

**F4 - Generator contract violation.** Detection: `integrationEngine.assertAll` throws with a specific message (`assertPhases`, `assertSteps`, or `assertPrompts`). Diagnosis: one generator produced output that does not match the fixed schema. Remediation: read the thrown message. If it names a field, fix that field in the upstream generator. Do not hand-edit the JSON to make the assert pass. Re-entry: the specific failing generator step (3.1, 3.2, or 3.3).

**F5 - Naming canon violation.** Detection: `promptName` fails the regex `^\([A-Z]\)-MMOS-PH\d+-(CLAUDE|CODEX)-(HIGH|MED|LOW)-\d{3}$`. Diagnosis: `promptGenerator.js` used a non-canonical format, or the project letter is inconsistent across the array. Remediation: fix `promptGenerator.js`. Re-entry: Step 3.3.

**F6 - Structural test failure.** Detection: `tests/test_html_manual_generator.js` exits non-zero. Diagnosis: the rendered HTML is missing one or more of the 25 structural markers, or em-dash count > 0. Remediation: read the `FAIL: missing structural markers` or `FAIL: em-dash detected` line, open the rendered HTML, find the defect, fix `htmlManualGenerator.js`. Re-entry: Step 4.1.

**F7 - Visual QA defect.** Detection: any check in Step 5.2 unticked. Diagnosis: the rendered manual drifts from MR-1377 in a way the structural test did not catch (colors wrong, spacing off, copy button not flashing). Remediation: compare side-by-side with MR-1377. Fix the CSS or JS in `htmlManualGenerator.js`. Re-entry: Step 4.1.

**F8 - Classifier sanity failure.** Detection: Step 5.3 returns RESULT: FAILED with a numbered defect. Diagnosis: the step count or routing mix does not match the claimed classification. This is usually caused by an interpreter misclassification the operator did not catch at Step 2.2. Remediation: manually set the correct classification in the intake object, document the override, re-enter at Step 3.1. If this happens more than twice per month, file a bug against the interpretation engine.

**F9 - Activity log write failure.** Detection: Step 6.1 returns RESULT: FAILED. Diagnosis: file permissions, disk full, or the log file does not exist at the canonical path. Remediation: verify `/Users/brianb/MissionMed/_SYSTEM_LOGS/MM_ACTIVITY_LOG.md` is writable. Do not create the file in a different location; the canonical path is load-bearing. Re-entry: Step 6.1.

**F10 - Final commit refused.** Detection: `git commit` in Step 6.3 returns non-zero. Diagnosis: pre-commit hook failure, no changes staged, or unsigned commit rejected. Remediation: read the git output. Fix the underlying issue (stage files, satisfy the hook, sign the commit). Do not use `--no-verify`. Re-entry: Step 6.3.

When in doubt, stop and ask. Never push through a failure to finish the manual.

---

## SECTION 6 - FINALIZATION

The workstream is complete when three conditions hold:

One, the final commit `MMOS-COMPLETE: [project letter] [short title] operational` is present in the git log.

Two, the activity log entry for this workstream is appended to `MM_ACTIVITY_LOG.md` with Status: COMPLETE, and its Verification section enumerates every gate that passed.

Three, the rendered HTML manual is saved to `_BACKUPS/MMOS_Manual_<timestamp>.html` and is linkable via a `computer://` URL.

If any of the three conditions is missing, the workstream is not complete regardless of how it looks. Do not hand-wave past this. Do not declare victory early. The MissionMed project instructions are explicit: "Task is NOT complete until ALL are satisfied."

After completion, the rendered HTML is the source of truth for the operator executing the sub-manual. The intake object and intermediate JSON files in `_staging/` are retained for one workstream cycle, then swept to `_BACKUPS/` or deleted. The test harness output is retained permanently as `_BACKUPS/MMOS_Manual_TEST_OUTPUT_<version>.html` for regression comparisons.

Every completed workstream feeds a learning entry to `/Users/brianb/MissionMed/_SYSTEM_LOGS/LEARNINGS_LOG.jsonl` per RULE-002. The learning entry captures WHAT WORKED, WHAT FAILED, WHAT TO CHANGE, NEW RULE (if any), KB UPDATE (if any). This is the mechanism by which MMOS improves between cycles.

Done is done. Close the session.

---

## APPENDIX A - INTAKE OBJECT MINIMUM EXAMPLE

```json
{
  "META": {
    "project_letter": "M",
    "manual_id": "MR-1400",
    "manual_title": "Example MMOS workstream",
    "short_title": "Example",
    "version": "1.0",
    "date": "2026-04-18",
    "authority": "MR-1367 + MR-1377",
    "purpose": "Demonstrate the minimum viable intake object."
  },
  "WORKFLOW": {
    "workflow_type": "BUILD",
    "baseline_risk": "MEDIUM",
    "naming_format": "({PROJECT})-MMOS-PH{#}-{AI}-{LEVEL}-{###}",
    "thread_format": "({PROJECT}) - [Short Task Description]",
    "result_header_required": true
  },
  "OVERVIEW": {
    "total_phases": 4,
    "total_prompts": 16,
    "total_sessions": 2,
    "estimated_time": "2.5 hours across 2 sessions",
    "models_used": "Claude Opus (12), Codex (4)",
    "what_gets_built": "One operational sub-manual demonstrating the MMOS pipeline."
  },
  "PHASES": [
    { "number": 1, "name": "PLAN", "intro": "Plan scope.", "steps": [], "gate": {} },
    { "number": 2, "name": "IMPLEMENT", "intro": "Write code.", "steps": [], "gate": {} },
    { "number": 3, "name": "VALIDATE", "intro": "Test.", "steps": [], "gate": {} },
    { "number": 4, "name": "FINALIZE", "intro": "Ship.", "steps": [], "gate": {} }
  ]
}
```

This is a template. Real intakes fill the `steps` and `gate` arrays per `INTAKE_SCHEMA.md` §3.7 and §3.8.

---

## APPENDIX B - ENGINE INVOCATION CHEAT SHEET

| Phase | Command |
|-------|---------|
| 2.1 | `node -e "const e=require('./interpretationEngine'); ..."` |
| 3.1 | `node -e "const g=require('./phaseGenerator'); ..."` |
| 3.2 | `node -e "const g=require('./stepGenerator'); ..."` |
| 3.3 | `node -e "const g=require('./promptGenerator'); ..."` |
| 3.4 | `node -e "const ie=require('./integrationEngine'); ie.assertAll(...)"` |
| 4.1 | `node -e "const h=require('./htmlManualGenerator'); ..."` |
| 5.1 | `node tests/test_html_manual_generator.js` |

All commands run from `/Users/brianb/MissionMed/_SYSTEM/INTAKE_ENGINE/`.

---

## APPENDIX C - STRUCTURAL MARKERS (Phase 5.1 contract)

The structural test asserts these markers in the rendered HTML. Any missing marker is an F6 failure.

`<!DOCTYPE html>` `<div class="header">` `class="header-badge"` `class="sidebar"` `data-tab="overview"` `data-tab="ph1"` `data-tab="ph2"` `data-tab="ph3"` `data-tab="ph4"` `data-tab="tracker"` `data-tab="rules"` `class="verdict-box"` `class="status-panel"` `class="phase-loc"` `class="step-header"` `class="step-ai step-ai-claude"` `class="step-ai step-ai-codex"` `class="step-body"` `class="prompt-block"` `class="copy-btn"` `class="gate-box"` `class="next-box"` `class="step-control"` `class="footer"` `function copyPrompt` `--navy:#0F2A44`

Plus: step-header count = steps.length, prompt-block count = prompts.length, phase-loc count = phases.length, gate-box count ≥ phases.length, em-dash count = 0.

---

End of master operator manual.
