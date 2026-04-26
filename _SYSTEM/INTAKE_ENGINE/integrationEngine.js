"use strict";

const {
  interpretInput,
} = require("/Users/brianb/MissionMed/_SYSTEM/INTAKE_ENGINE/interpretationEngine.js");
const {
  generatePhases,
} = require("/Users/brianb/MissionMed/_SYSTEM/INTAKE_ENGINE/phaseGenerator.js");
const {
  generateSteps,
} = require("/Users/brianb/MissionMed/_SYSTEM/INTAKE_ENGINE/stepGenerator.js");
const {
  generatePrompts,
} = require("/Users/brianb/MissionMed/_SYSTEM/INTAKE_ENGINE/promptGenerator.js");
const {
  generateHTMLManual,
} = require("/Users/brianb/MissionMed/_SYSTEM/INTAKE_ENGINE/htmlManualGenerator.js");

const VALID_TASK_TYPES = new Set([
  "BUILD",
  "AUDIT",
  "FIX",
  "DEPLOY",
  "CONTENT",
  "PLAN",
  "SYSTEM_MIGRATION",
]);
const VALID_COMPLEXITIES = new Set(["LOW", "MED", "HIGH"]);
const VALID_RISKS = new Set(["LOW", "MED", "HIGH"]);
const VALID_AIS = new Set(["CLAUDE", "CODEX"]);
const VALID_THREADS = new Set(["NEW", "SAME"]);

function toStringOrEmpty(value) {
  if (value === null || value === undefined) {
    return "";
  }
  return String(value);
}

function normalizeArray(value) {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.map(toStringOrEmpty).map((v) => v.trim()).filter(Boolean);
}

function normalizeAIs(value) {
  const source = Array.isArray(value) ? value : [];
  const output = [];
  source.forEach((item) => {
    const ai = toStringOrEmpty(item).trim().toUpperCase();
    if (VALID_AIS.has(ai) && !output.includes(ai)) {
      output.push(ai);
    }
  });
  return output;
}

function asInteger(value) {
  if (Number.isInteger(value)) {
    return value;
  }
  const parsed = parseInt(value, 10);
  return Number.isInteger(parsed) ? parsed : null;
}

function normalizeMinimalInput(minimalInput) {
  const input = minimalInput && typeof minimalInput === "object" ? minimalInput : {};
  return {
    goal: toStringOrEmpty(input.goal).trim(),
    targets: normalizeArray(input.targets || input.target),
    constraint: toStringOrEmpty(
      input.constraints !== undefined ? input.constraints : input.constraint
    ).trim(),
    project: toStringOrEmpty(input.project).trim().toUpperCase() || "M",
    aiTools: normalizeAIs(input.aiTools || input.ai_tools),
  };
}

function normalizeOptions(options, normalizedInput) {
  const opts = options && typeof options === "object" ? options : {};
  const project = toStringOrEmpty(opts.project || normalizedInput.project)
    .trim()
    .toUpperCase();
  return {
    project: project || "M",
  };
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function assertInputState(rawInput, normalizedInput) {
  assert(
    rawInput && typeof rawInput === "object" && !Array.isArray(rawInput),
    "INVALID_INPUT: minimalInput must be an object"
  );
  assert(normalizedInput.goal.length > 0, "INVALID_INPUT: goal is required");
  assert(
    Array.isArray(normalizedInput.targets) && normalizedInput.targets.length > 0,
    "INVALID_INPUT: targets must contain at least one entry"
  );
  if (rawInput.aiTools !== undefined || rawInput.ai_tools !== undefined) {
    assert(
      normalizedInput.aiTools.length > 0,
      "INVALID_INPUT: aiTools contains no valid AI identifiers"
    );
  }
}

function assertInterpretedInput(interpretedInput) {
  assert(
    interpretedInput && typeof interpretedInput === "object",
    "INVALID_INTERPRETATION: interpretedInput must be an object"
  );
  assert(
    VALID_TASK_TYPES.has(toStringOrEmpty(interpretedInput.taskType).toUpperCase()),
    "INVALID_INTERPRETATION: taskType missing or invalid"
  );
  assert(
    VALID_COMPLEXITIES.has(
      toStringOrEmpty(interpretedInput.complexity).toUpperCase()
    ),
    "INVALID_INTERPRETATION: complexity missing or invalid"
  );
  assert(
    VALID_RISKS.has(toStringOrEmpty(interpretedInput.risk).toUpperCase()),
    "INVALID_INTERPRETATION: risk missing or invalid"
  );
  const flags =
    interpretedInput.metadata &&
    Array.isArray(interpretedInput.metadata.reasoningFlags)
      ? interpretedInput.metadata.reasoningFlags
      : [];
  const ambiguityFlag = Boolean(
    interpretedInput.debugTrace && interpretedInput.debugTrace.ambiguityFlag === true
  );
  const requiresClarification = flags.includes("needs_user_confirmation");
  if (requiresClarification) {
    throw new Error(
      "INPUT_TOO_AMBIGUOUS: clarification required before execution"
    );
  }
  if (ambiguityFlag) {
    throw new Error(
      "INPUT_TOO_AMBIGUOUS: non-executable input requires clarification"
    );
  }
}

function assertPhases(phases) {
  assert(Array.isArray(phases), "INVALID_PHASES: phases must be an array");
  assert(phases.length > 0, "INVALID_PHASES: phases must not be empty");

  phases.forEach((phase, index) => {
    assert(phase && typeof phase === "object", "INVALID_PHASES: phase must be object");
    const phaseNumber = asInteger(phase.phaseNumber);
    assert(phaseNumber !== null, "INVALID_PHASES: phaseNumber missing or invalid");
    assert(
      toStringOrEmpty(phase.role).trim().length > 0,
      "INVALID_PHASES: role missing"
    );
    assert(
      toStringOrEmpty(phase.title).trim().length > 0,
      "INVALID_PHASES: title missing"
    );
    assert(
      phaseNumber === index + 1,
      "INVALID_PHASES: phaseNumber must be sequential starting at 1"
    );
  });
}

function assertSteps(steps) {
  assert(Array.isArray(steps), "INVALID_STEPS: steps must be an array");
  assert(steps.length > 0, "INVALID_STEPS: steps must not be empty");

  steps.forEach((step, index) => {
    assert(step && typeof step === "object", "INVALID_STEPS: step must be object");
    const stepNumber = asInteger(step.stepNumber);
    const phaseNumber = asInteger(step.phaseNumber);
    assert(stepNumber !== null, "INVALID_STEPS: stepNumber missing or invalid");
    assert(phaseNumber !== null, "INVALID_STEPS: phaseNumber missing or invalid");
    assert(
      stepNumber === index + 1,
      "INVALID_STEPS: stepNumber must be sequential starting at 1"
    );
    assert(
      toStringOrEmpty(step.intent).trim().length > 0,
      "INVALID_STEPS: intent missing"
    );
    assert(
      toStringOrEmpty(step.action).trim().length > 0,
      "INVALID_STEPS: action missing"
    );
    assert(
      VALID_AIS.has(toStringOrEmpty(step.ai).trim().toUpperCase()),
      "INVALID_STEPS: ai missing or invalid"
    );
    assert(
      toStringOrEmpty(step.model).trim().length > 0,
      "INVALID_STEPS: model missing"
    );
    assert(
      VALID_THREADS.has(toStringOrEmpty(step.thread).trim().toUpperCase()),
      "INVALID_STEPS: thread missing or invalid"
    );
  });
}

function assertPrompts(prompts, steps) {
  assert(Array.isArray(prompts), "INVALID_PROMPTS: prompts must be an array");
  assert(
    prompts.length === steps.length,
    "INVALID_PROMPTS: prompt count must match step count"
  );

  const namingCanonRe = /^\([A-Z]\)-MMOS-PH\d+-(CLAUDE|CODEX)-(LOW|MED|HIGH)-\d{3}$/;

  prompts.forEach((prompt) => {
    assert(
      prompt && typeof prompt === "object",
      "INVALID_PROMPTS: prompt entry must be object"
    );
    assert(
      toStringOrEmpty(prompt.promptName).trim().length > 0,
      "INVALID_PROMPTS: promptName missing"
    );
    assert(
      toStringOrEmpty(prompt.threadName).trim().length > 0,
      "INVALID_PROMPTS: threadName missing"
    );
    assert(
      toStringOrEmpty(prompt.promptBody).trim().length > 0,
      "INVALID_PROMPTS: promptBody missing"
    );
    assert(
      namingCanonRe.test(prompt.promptName),
      "INVALID_PROMPTS: promptName fails naming canon"
    );
    assert(
      prompt.promptBody.includes("RESULT:") &&
        prompt.promptBody.includes("TASK TYPE:") &&
        prompt.promptBody.includes("NEXT ACTION:"),
      "INVALID_PROMPTS: promptBody missing mandatory sections"
    );
  });
}

function generateWorkflow(minimalInput, options) {
  const normalizedInput = normalizeMinimalInput(minimalInput);
  assertInputState(minimalInput, normalizedInput);
  const normalizedOptions = normalizeOptions(options, normalizedInput);

  const interpretedInput = interpretInput({
    goal: normalizedInput.goal,
    targets: normalizedInput.targets,
    target: normalizedInput.targets,
    constraint: normalizedInput.constraint,
  });
  assertInterpretedInput(interpretedInput);

  const interpretedForDownstream = {
    taskType: interpretedInput.taskType,
    complexity: interpretedInput.complexity,
    risk: interpretedInput.risk,
    targets: interpretedInput.targets,
    aiTools:
      normalizedInput.aiTools.length > 0 ? normalizedInput.aiTools : ["CLAUDE", "CODEX"],
  };

  const phases = generatePhases(interpretedForDownstream);
  assertPhases(phases);

  const steps = generateSteps(interpretedForDownstream, phases);
  assertSteps(steps);

  const prompts = generatePrompts(steps, normalizedOptions);
  assertPrompts(prompts, steps);

  return {
    interpretedInput: interpretedForDownstream,
    phases,
    steps,
    prompts,
  };
}

module.exports = {
  generateWorkflow,
  generateHTMLManual,
};
