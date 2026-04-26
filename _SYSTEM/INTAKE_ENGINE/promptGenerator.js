"use strict";

const TASK_TYPE_BY_INTENT = {
  analyze: "ANALYSIS",
  debug: "FIX",
  fix: "FIX",
  generate_code: "BUILD",
  edit_file: "BUILD",
  deploy: "DEPLOY",
  write_copy: "CONTENT",
  plan: "PLAN",
  structure: "PLAN",
  prepare: "PLAN",
  review: "ANALYSIS",
  summarize: "ANALYSIS",
  test: "ANALYSIS",
  verify: "ANALYSIS",
  observe: "ANALYSIS",
  log: "ANALYSIS",
  run_command: "ANALYSIS",
};

const LEVEL_BY_MODEL = {
  low: "LOW",
  medium: "MED",
  high: "HIGH",
  haiku: "LOW",
  sonnet: "MED",
  opus: "HIGH",
};

const REQUIRED_BODY_SECTIONS = [
  "RESULT:",
  "TASK TYPE:",
  "CONTEXT:",
  "OBJECTIVE:",
  "EXECUTION RULES:",
  "SUCCESS CRITERIA:",
  "OUTPUT FORMAT:",
  "NEXT ACTION:",
];

const OBJECTIVE_BY_INTENT = {
  analyze:
    "Analyze the target system to identify structure, risks, and key decision points.",
  debug:
    "Identify the root cause of failure and isolate the exact point of breakdown.",
  fix: "Apply a targeted fix that resolves the issue without introducing regressions.",
  deploy:
    "Execute a safe deployment process and validate system integrity post-release.",
  plan: "Design a clear, deterministic execution plan with defined steps.",
  write_copy: "Produce clear, polished, production-ready written content.",
  generate_code:
    "Generate deterministic implementation code aligned with the requested scope.",
  edit_file:
    "Apply precise file edits that satisfy requirements while preserving existing behavior.",
  test: "Run focused tests to confirm expected behavior and surface regressions.",
  verify: "Verify that completion criteria are fully satisfied before proceeding.",
  review: "Review outputs for correctness, completeness, and scope compliance.",
  summarize: "Summarize completed work, evidence, and remaining risks clearly.",
  run_command: "Execute required commands and capture deterministic outcomes.",
  prepare: "Prepare artifacts and prerequisites for controlled execution.",
  structure: "Define a clear structure for deterministic implementation flow.",
  observe: "Observe runtime signals and record meaningful operational findings.",
  log: "Record key execution evidence and final status checkpoints.",
};

const CONTEXT_EXPANSION_BY_INTENT = {
  analyze:
    "Focus on system shape, risk surfaces, and dependencies. Identify what matters most for safe execution. Expected outcome: prioritized analysis findings.",
  debug:
    "Focus on failure symptoms, reproducibility, and failure boundaries. Isolate the exact breakdown location. Expected outcome: confirmed root cause.",
  fix: "Focus on the smallest viable corrective change and regression prevention. Validate that the issue is resolved. Expected outcome: stable, targeted fix.",
  deploy:
    "Focus on release safety, deployment sequence, and post-release validation. Confirm service integrity after rollout. Expected outcome: safe release with verification evidence.",
  plan: "Focus on deterministic sequencing, constraints, and decision gates. Define exactly what will be done next. Expected outcome: executable plan.",
  write_copy:
    "Focus on clarity, quality, and production readiness. Ensure final content is polished and usable. Expected outcome: finalized copy artifact.",
  generate_code:
    "Focus on implementation correctness, deterministic logic, and required scope only. Expected outcome: compile-ready code changes.",
  edit_file:
    "Focus on precise file-level updates with minimal blast radius. Expected outcome: clean, reviewable file diffs.",
  test: "Focus on verification commands, pass/fail signals, and reproducible evidence. Expected outcome: explicit validation results.",
  verify:
    "Focus on completion criteria and readiness gates. Confirm no unresolved blockers remain. Expected outcome: go/no-go verification.",
  review:
    "Focus on correctness, omissions, and risk. Validate that results match requirements. Expected outcome: review verdict with key findings.",
  summarize:
    "Focus on concise reporting of outcomes, artifacts, and residual risk. Expected outcome: actionable summary.",
  run_command:
    "Focus on controlled command execution and reliable result capture. Expected outcome: command evidence and interpretation.",
  prepare:
    "Focus on prerequisites, environment readiness, and sequencing safeguards. Expected outcome: deployment-ready preparation state.",
  structure:
    "Focus on organizing tasks, dependencies, and output boundaries. Expected outcome: coherent execution structure.",
  observe:
    "Focus on runtime behavior, anomalies, and stability indicators. Expected outcome: monitoring observations.",
  log: "Focus on recording verifiable checkpoints and key events. Expected outcome: complete execution log.",
};

const SUCCESS_CRITERIA_BY_INTENT = {
  analyze: "Key risks, structure, and decisions are clearly identified and prioritized.",
  debug: "Root cause is isolated with reproducible evidence.",
  fix: "Issue is resolved and no new regression is introduced.",
  deploy: "Deployment completes safely and post-release integrity checks pass.",
  plan: "Plan is deterministic, sequenced, and immediately executable.",
  write_copy: "Output copy is production-ready, clear, and aligned to scope.",
  generate_code: "Generated code satisfies required behavior and scope constraints.",
  edit_file: "All required file edits are complete and internally consistent.",
  test: "All required tests executed with clear pass/fail reporting.",
  verify: "Completion criteria are met and readiness is confirmed.",
  review: "Findings are accurate, scoped, and actionable.",
  summarize: "Summary captures outcomes, evidence, and next actions.",
  run_command: "Commands run successfully with captured deterministic output.",
  prepare: "All prerequisites are validated and ready for execution.",
  structure: "Structure is clear, ordered, and supports deterministic execution.",
  observe: "Operational observations are captured with relevant signals.",
  log: "Execution log is complete, concise, and traceable.",
};

function toStringOrEmpty(value) {
  if (value === null || value === undefined) {
    return "";
  }
  return String(value);
}

function toUpperToken(value, fallback) {
  const normalized = toStringOrEmpty(value).trim().toUpperCase();
  return normalized || fallback;
}

function pad3(value) {
  const n = Number.isFinite(value) ? value : parseInt(value, 10);
  if (!Number.isFinite(n) || n < 0) {
    return "000";
  }
  return String(n).padStart(3, "0");
}

function mapTaskType(intent) {
  const key = toStringOrEmpty(intent).trim().toLowerCase();
  return TASK_TYPE_BY_INTENT[key] || "ANALYSIS";
}

function mapLevel(model) {
  const key = toStringOrEmpty(model).trim().toLowerCase();
  return LEVEL_BY_MODEL[key] || "MED";
}

function extractPhaseRole(action) {
  const source = toStringOrEmpty(action);
  const match = source.match(/\bfor\s+([A-Z_]+)\s+scope\./);
  if (match && match[1]) {
    return match[1];
  }
  return "";
}

function buildPhaseRoleMap(steps) {
  const phaseRoleMap = {};
  (Array.isArray(steps) ? steps : []).forEach((step) => {
    const phaseNumber = Number.isFinite(step && step.phaseNumber)
      ? step.phaseNumber
      : parseInt(step && step.phaseNumber, 10);
    if (!Number.isFinite(phaseNumber)) {
      return;
    }
    if (!phaseRoleMap[phaseNumber]) {
      const role = extractPhaseRole(step && step.action);
      if (role) {
        phaseRoleMap[phaseNumber] = role;
      }
    }
  });
  return phaseRoleMap;
}

function buildPromptName(project, step) {
  const projectToken = toUpperToken(project, "M");
  const phaseNumber = Number.isFinite(step.phaseNumber)
    ? step.phaseNumber
    : parseInt(step.phaseNumber, 10) || 0;
  const ai = toUpperToken(step.ai, "CLAUDE");
  const level = mapLevel(step.model);
  const seq = pad3(step.stepNumber);
  return (
    "(" +
    projectToken +
    ")-MMOS-PH" +
    phaseNumber +
    "-" +
    ai +
    "-" +
    level +
    "-" +
    seq
  );
}

function buildThreadName(project, phaseRole, phaseNumber) {
  const projectToken = toUpperToken(project, "M");
  const role = phaseRole || "PHASE " + phaseNumber;
  return "(" + projectToken + ")-MMOS — " + role + " EXECUTION";
}

function buildOutputFormat() {
  return (
    "{\n" +
    '  result: "COMPLETE | PARTIAL | FAILED",\n' +
    '  taskType: string,\n' +
    '  completedAction: string,\n' +
    "  artifacts: string[],\n" +
    "  checks: string[],\n" +
    "  nextAction: string\n" +
    "}"
  );
}

function buildObjective(intent) {
  const key = toStringOrEmpty(intent).trim().toLowerCase();
  return (
    OBJECTIVE_BY_INTENT[key] ||
    "Execute the assigned intent with deterministic, scoped behavior."
  );
}

function buildContext(intent, action) {
  const key = toStringOrEmpty(intent).trim().toLowerCase();
  const base = toStringOrEmpty(action).trim();
  const expansion =
    CONTEXT_EXPANSION_BY_INTENT[key] ||
    "Focus on scoped execution, correctness, and deterministic outcomes.";
  return base + "\n\nFocus:\n" + expansion;
}

function buildSuccessCriteria(intent) {
  const key = toStringOrEmpty(intent).trim().toLowerCase();
  return (
    SUCCESS_CRITERIA_BY_INTENT[key] ||
    "Output is complete, deterministic, and within defined scope."
  );
}

function buildPromptBody(step, taskType, isStarter) {
  const intent = toStringOrEmpty(step.intent).trim();
  const action = toStringOrEmpty(step.action).trim();
  const ai = toUpperToken(step.ai, "CLAUDE");
  const model = toStringOrEmpty(step.model).trim() || "unknown";
  const threadMode = isStarter ? "THREAD STARTER" : "THREAD CONTINUATION";

  const constraints =
    "- ai: " +
    ai +
    "\n" +
    "- model: " +
    model +
    "\n" +
    "- thread mode: " +
    threadMode +
    "\n" +
    "- preserve deterministic behavior";

  const lines = [
    "RESULT:",
    "Return COMPLETE, PARTIAL, or FAILED.",
    "",
    "TASK TYPE:",
    taskType,
    "",
    "CONTEXT:",
    buildContext(intent, action),
    "",
    "OBJECTIVE:",
    buildObjective(intent),
    "",
    "EXECUTION RULES:",
    "- deterministic",
    "- no hallucination",
    "- no scope drift",
    "",
    "SUCCESS CRITERIA:",
    buildSuccessCriteria(intent),
    "",
    "CONSTRAINTS:",
    constraints,
    "",
    "OUTPUT FORMAT:",
    buildOutputFormat(),
    "",
    "NEXT ACTION:",
    isStarter
      ? "Begin this phase thread, execute the objective, and return structured output."
      : "Continue this thread with the next step and return structured output.",
  ];

  return lines.join("\n");
}

function buildPromptObject(step, project, phaseRoleMap) {
  const safeStep = step && typeof step === "object" ? step : {};
  const taskType = mapTaskType(safeStep.intent);
  const phaseNumber = Number.isFinite(safeStep.phaseNumber)
    ? safeStep.phaseNumber
    : parseInt(safeStep.phaseNumber, 10) || 0;
  const isStarter = toUpperToken(safeStep.thread, "NEW") === "NEW";
  const inferredRole =
    phaseRoleMap[phaseNumber] || extractPhaseRole(safeStep.action) || "";

  const promptName = buildPromptName(project, safeStep);
  const threadName = buildThreadName(project, inferredRole, phaseNumber);
  const promptBody = buildPromptBody(safeStep, taskType, isStarter);

  return {
    promptName,
    threadName,
    promptBody,
  };
}

function validatePromptBody(promptBody) {
  return REQUIRED_BODY_SECTIONS.every((section) => promptBody.includes(section));
}

function generatePrompts(steps, options) {
  const list = Array.isArray(steps) ? steps : [];
  const opts = options && typeof options === "object" ? options : {};
  const project = toUpperToken(opts.project || opts.projectLetter, "M");
  const phaseRoleMap = buildPhaseRoleMap(list);

  return list.map((step) => {
    const prompt = buildPromptObject(step, project, phaseRoleMap);
    if (!validatePromptBody(prompt.promptBody)) {
      throw new Error("Prompt body validation failed for step");
    }
    return prompt;
  });
}

module.exports = {
  generatePrompts,
};
