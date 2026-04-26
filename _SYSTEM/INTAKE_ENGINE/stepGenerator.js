"use strict";

const STEP_COUNT_BY_COMPLEXITY = {
  LOW: 2,
  MED: 3,
  HIGH: 4,
};

const ROLE_INTENTS = {
  PLAN: ["analyze", "structure", "plan", "summarize"],
  IMPLEMENT: ["analyze", "generate_code", "edit_file", "verify"],
  VALIDATE: ["analyze", "test", "review", "summarize"],
  FINALIZE: ["plan", "review", "write_copy", "summarize"],
  DISCOVER: ["analyze", "review", "plan", "summarize"],
  ANALYZE: ["analyze", "review", "plan", "summarize"],
  REPORT: ["analyze", "write_copy", "review", "summarize"],
  VERIFY: ["analyze", "test", "review", "verify"],
  REPRODUCE: ["analyze", "run_command", "debug", "summarize"],
  DIAGNOSE: ["analyze", "debug", "run_command", "summarize"],
  PATCH: ["analyze", "debug", "fix", "verify"],
  PREPARE: ["analyze", "plan", "prepare", "verify"],
  RELEASE: ["analyze", "prepare", "deploy", "verify"],
  MONITOR: ["analyze", "observe", "log", "summarize"],
  CREATE: ["plan", "write_copy", "review", "summarize"],
  STRUCTURE: ["analyze", "structure", "plan", "summarize"],
  DEFINE: ["analyze", "plan", "structure", "summarize"],
  AUDIT: ["analyze", "review", "test", "summarize"],
  MIGRATE: ["analyze", "plan", "generate_code", "verify"],
};

const DEFAULT_INTENTS = ["analyze", "plan", "review", "summarize"];

const CODEX_INTENTS = new Set(["generate_code", "edit_file", "run_command"]);
const CLAUDE_INTENTS = new Set([
  "analyze",
  "review",
  "summarize",
  "plan",
  "write_copy",
]);
const CODEX_SEMANTIC_INTENTS = new Set([
  "generate_code",
  "edit_file",
  "run_command",
  "debug",
  "fix",
  "test",
  "deploy",
]);
const CLAUDE_SEMANTIC_INTENTS = new Set([
  "analyze",
  "review",
  "summarize",
  "plan",
  "write_copy",
  "structure",
  "prepare",
  "observe",
  "log",
  "verify",
]);
const START_INTENTS = new Set(["analyze", "plan"]);
const END_INTENTS = new Set(["verify", "summarize"]);
const EXECUTION_INTENTS = new Set([
  "generate_code",
  "edit_file",
  "run_command",
  "debug",
  "fix",
  "deploy",
  "test",
  "write_copy",
]);
const DEPLOY_EXECUTION_HEAVY_INTENTS = new Set([
  "deploy",
  "run_command",
  "test",
  "debug",
  "fix",
  "edit_file",
  "generate_code",
]);
const GUARANTEED_EXECUTION_INTENTS = new Set([
  "generate_code",
  "edit_file",
  "run_command",
  "debug",
  "fix",
  "deploy",
]);
const EXECUTION_CAPABLE_ROLES = new Set([
  "IMPLEMENT",
  "PATCH",
  "MIGRATE",
  "RELEASE",
  "CREATE",
]);
const ROLE_EXECUTION_PRIORITY = {
  IMPLEMENT: ["generate_code", "edit_file", "run_command"],
  PATCH: ["fix", "debug", "run_command"],
  MIGRATE: ["generate_code", "edit_file", "run_command"],
  RELEASE: ["deploy", "run_command"],
  CREATE: ["write_copy"],
};
const SYSTEM_MIGRATION_CODEX_PHASE_ROLES = new Set([
  "IMPLEMENT",
  "MIGRATE",
  "VALIDATE",
  "VERIFY",
]);

function toStringOrEmpty(value) {
  if (value === null || value === undefined) {
    return "";
  }
  return String(value);
}

function normalizeComplexity(value) {
  const normalized = toStringOrEmpty(value).trim().toUpperCase();
  if (normalized === "LOW" || normalized === "MED" || normalized === "HIGH") {
    return normalized;
  }
  return "LOW";
}

function normalizeTaskType(value) {
  const normalized = toStringOrEmpty(value).trim().toUpperCase();
  if (
    normalized === "BUILD" ||
    normalized === "AUDIT" ||
    normalized === "FIX" ||
    normalized === "DEPLOY" ||
    normalized === "CONTENT" ||
    normalized === "PLAN" ||
    normalized === "SYSTEM_MIGRATION"
  ) {
    return normalized;
  }
  return "PLAN";
}

function normalizeRisk(value) {
  const normalized = toStringOrEmpty(value).trim().toUpperCase();
  if (normalized === "LOW" || normalized === "MED" || normalized === "HIGH") {
    return normalized;
  }
  return "LOW";
}

function normalizeAIs(value) {
  const source = Array.isArray(value) ? value : ["CLAUDE", "CODEX"];
  const normalized = [];

  source.forEach((item) => {
    const ai = toStringOrEmpty(item).trim().toUpperCase();
    if ((ai === "CLAUDE" || ai === "CODEX") && !normalized.includes(ai)) {
      normalized.push(ai);
    }
  });

  if (normalized.length === 0) {
    return ["CLAUDE", "CODEX"];
  }
  return normalized;
}

function getPrimaryTarget(targets) {
  if (!Array.isArray(targets) || targets.length === 0) {
    return "system";
  }
  const first = toStringOrEmpty(targets[0]).trim();
  return first || "system";
}

function startAndExecutionPair(start, execution, uniqueBase) {
  if (start !== execution) {
    return [start, execution];
  }
  const alternateStart =
    uniqueBase.find((intent) => START_INTENTS.has(intent) && intent !== execution) ||
    uniqueBase.find((intent) => intent !== execution) ||
    start;
  return [alternateStart, execution];
}

function normalizedRoleToken(role) {
  return toStringOrEmpty(role).trim().toUpperCase();
}

function isExecutionCapableRole(role) {
  return EXECUTION_CAPABLE_ROLES.has(normalizedRoleToken(role));
}

function isGuaranteedExecutionIntent(role, intent) {
  const safeRole = normalizedRoleToken(role);
  if (safeRole === "CREATE") {
    return intent === "write_copy";
  }
  return GUARANTEED_EXECUTION_INTENTS.has(intent);
}

function getStartIntent(uniqueBase) {
  return uniqueBase.find((intent) => START_INTENTS.has(intent)) || uniqueBase[0];
}

function getEndIntent(uniqueBase) {
  return (
    [...uniqueBase].reverse().find((intent) => END_INTENTS.has(intent)) ||
    uniqueBase[uniqueBase.length - 1]
  );
}

function getRolePreferredExecutionIntent(role, uniqueBase) {
  const safeRole = normalizedRoleToken(role);
  const priorities = ROLE_EXECUTION_PRIORITY[safeRole] || [];

  const direct = priorities.find((intent) => uniqueBase.includes(intent));
  if (direct) {
    return direct;
  }

  const roleExecution = uniqueBase.find((intent) =>
    isGuaranteedExecutionIntent(safeRole, intent)
  );
  if (roleExecution) {
    return roleExecution;
  }

  if (priorities.length > 0) {
    return priorities[0];
  }

  return uniqueBase.find((intent) => EXECUTION_INTENTS.has(intent)) || uniqueBase[0];
}

function getHighDeployRoleIntents(role, stepCount, uniqueBase, context) {
  const safeRole = normalizedRoleToken(role);
  const safeTaskType = normalizeTaskType(context && context.taskType);
  const safeComplexity = normalizeComplexity(context && context.complexity);
  const safeRisk = normalizeRisk(context && context.risk);
  const isHighDeploy =
    safeTaskType === "DEPLOY" &&
    (safeComplexity === "HIGH" || safeRisk === "HIGH");
  if (!isHighDeploy) {
    return null;
  }
  const deployOrientedRole =
    safeRole === "PREPARE" ||
    safeRole === "RELEASE" ||
    safeRole === "MONITOR" ||
    safeRole === "VALIDATE";
  if (!deployOrientedRole) {
    return null;
  }

  const start = getStartIntent(uniqueBase);
  const end = getEndIntent(uniqueBase);
  const primaryByRole = {
    PREPARE: "run_command",
    VALIDATE: "test",
    RELEASE: "deploy",
    MONITOR: "run_command",
  };
  const secondaryByRole = {
    PREPARE: "test",
    VALIDATE: "run_command",
    RELEASE: "run_command",
    MONITOR: "test",
  };
  const primary = primaryByRole[safeRole] || "run_command";
  const secondary = secondaryByRole[safeRole] || "test";

  if (stepCount <= 1) {
    return [primary];
  }
  if (stepCount === 2) {
    return startAndExecutionPair(start, primary, uniqueBase);
  }
  if (stepCount === 3) {
    if (safeRole === "RELEASE" || safeRole === "VALIDATE") {
      return [start, primary, secondary];
    }
    return [start, primary, end];
  }
  return [start, primary, secondary, end].slice(0, stepCount);
}

function getHighSystemMigrationRoleIntents(role, stepCount, uniqueBase, context) {
  const safeRole = normalizedRoleToken(role);
  const safeTaskType = normalizeTaskType(context && context.taskType);
  const safeComplexity = normalizeComplexity(context && context.complexity);
  if (!(safeTaskType === "SYSTEM_MIGRATION" && safeComplexity === "HIGH")) {
    return null;
  }

  const start = getStartIntent(uniqueBase);
  if (safeRole === "MIGRATE" || safeRole === "IMPLEMENT") {
    if (stepCount <= 1) {
      return ["generate_code"];
    }
    if (stepCount === 2) {
      return startAndExecutionPair(start, "generate_code", uniqueBase);
    }
    if (stepCount === 3) {
      return [start, "generate_code", "verify"];
    }
    return [start, "generate_code", "edit_file", "verify"].slice(0, stepCount);
  }

  if (safeRole === "VERIFY" || safeRole === "VALIDATE") {
    if (stepCount <= 1) {
      return ["test"];
    }
    if (stepCount === 2) {
      return startAndExecutionPair(start, "test", uniqueBase);
    }
    if (stepCount === 3) {
      return [start, "test", "run_command"];
    }
    return [start, "test", "run_command", "verify"].slice(0, stepCount);
  }

  return null;
}

function chooseIntentsForCount(role, stepCount, context) {
  const base = (ROLE_INTENTS[role] || DEFAULT_INTENTS).slice();
  const uniqueBase = Array.from(new Set(base));
  const safeRole = normalizedRoleToken(role);
  const executionCapable = isExecutionCapableRole(safeRole);
  const highDeployOverride = getHighDeployRoleIntents(
    safeRole,
    stepCount,
    uniqueBase,
    context
  );
  if (Array.isArray(highDeployOverride)) {
    return highDeployOverride;
  }
  const highSystemMigrationOverride = getHighSystemMigrationRoleIntents(
    safeRole,
    stepCount,
    uniqueBase,
    context
  );
  if (Array.isArray(highSystemMigrationOverride)) {
    return highSystemMigrationOverride;
  }

  if (stepCount >= uniqueBase.length) {
    return uniqueBase.slice(0, stepCount);
  }
  if (stepCount === 1) {
    if (executionCapable) {
      return [getRolePreferredExecutionIntent(safeRole, uniqueBase)];
    }
    const start = uniqueBase.find((intent) => START_INTENTS.has(intent));
    return [start || uniqueBase[0]];
  }

  const first = getStartIntent(uniqueBase);
  const last = getEndIntent(uniqueBase);

  if (stepCount === 2) {
    if (executionCapable) {
      // E2 priority for compact flows: START + EXECUTION (not START + END).
      const execution = getRolePreferredExecutionIntent(safeRole, uniqueBase);
      return startAndExecutionPair(first, execution, uniqueBase);
    }
    if (first === last) {
      const alternate =
        uniqueBase.find((intent) => intent !== first) || first;
      return [first, alternate];
    }
    return [first, last];
  }

  if (stepCount === 3) {
    if (executionCapable) {
      const execution = getRolePreferredExecutionIntent(safeRole, uniqueBase);
      return [first, execution, last];
    }
    const middlePool = uniqueBase.filter(
      (intent) => intent !== first && intent !== last
    );
    const middle =
      middlePool.find((intent) => EXECUTION_INTENTS.has(intent)) ||
      middlePool[0] ||
      first;
    if (middle === last) {
      return [first, middle, first];
    }
    return [first, middle, last];
  }

  const ordered = [first];
  uniqueBase.forEach((intent) => {
    if (intent !== first && intent !== last) {
      ordered.push(intent);
    }
  });
  ordered.push(last);

  const deduped = Array.from(new Set(ordered));
  while (deduped.length < stepCount) {
    const fallback = uniqueBase.find((intent) => !deduped.includes(intent));
    if (!fallback) {
      break;
    }
    deduped.splice(Math.max(1, deduped.length - 1), 0, fallback);
  }

  if (deduped.length >= stepCount) {
    return deduped.slice(0, stepCount);
  }
  while (deduped.length < stepCount) {
    deduped.push(deduped[deduped.length - 1]);
  }
  return deduped.slice(0, stepCount);
}

function actionFor(intent, role, target) {
  const templates = {
    analyze: "Analyze " + target + " for " + role + " scope.",
    structure: "Structure the execution approach for " + target + ".",
    plan: "Plan deterministic actions for " + target + ".",
    generate_code: "Generate code changes for " + target + ".",
    edit_file: "Edit files required for " + target + ".",
    run_command: "Run verification commands for " + target + ".",
    review: "Review outputs for " + target + ".",
    test: "Test behavior for " + target + ".",
    debug: "Debug failures in " + target + ".",
    fix: "Apply targeted fixes in " + target + ".",
    verify: "Verify completion criteria for " + target + ".",
    summarize: "Summarize results for " + target + ".",
    write_copy: "Write final copy/update text for " + target + ".",
    prepare: "Prepare release artifacts for " + target + ".",
    deploy: "Deploy release for " + target + ".",
    observe: "Observe runtime state for " + target + ".",
    log: "Log monitoring results for " + target + ".",
  };
  return templates[intent] || ("Execute " + intent + " for " + target + ".");
}

function routeAI(intent, availableAIs, routeContext) {
  const safeTaskType = normalizeTaskType(routeContext && routeContext.taskType);
  const safeComplexity = normalizeComplexity(routeContext && routeContext.complexity);
  const safeRole = normalizedRoleToken(routeContext && routeContext.role);
  const isHighSystemMigrationExecutionPhase =
    safeTaskType === "SYSTEM_MIGRATION" &&
    safeComplexity === "HIGH" &&
    SYSTEM_MIGRATION_CODEX_PHASE_ROLES.has(safeRole) &&
    DEPLOY_EXECUTION_HEAVY_INTENTS.has(intent);
  if (isHighSystemMigrationExecutionPhase && availableAIs.includes("CODEX")) {
    return "CODEX";
  }
  if (
    (CODEX_INTENTS.has(intent) || CODEX_SEMANTIC_INTENTS.has(intent)) &&
    availableAIs.includes("CODEX")
  ) {
    return "CODEX";
  }
  if (
    (CLAUDE_INTENTS.has(intent) || CLAUDE_SEMANTIC_INTENTS.has(intent)) &&
    availableAIs.includes("CLAUDE")
  ) {
    return "CLAUDE";
  }
  return availableAIs[0];
}

function selectModel(ai, risk) {
  const safeRisk = normalizeRisk(risk);
  if (ai === "CLAUDE") {
    if (safeRisk === "HIGH") {
      return "opus";
    }
    if (safeRisk === "MED") {
      return "sonnet";
    }
    return "haiku";
  }
  if (safeRisk === "HIGH") {
    return "high";
  }
  if (safeRisk === "MED") {
    return "medium";
  }
  return "low";
}

function computeThread(phaseNumber, prevStep, currentAI, currentModel) {
  if (!prevStep) {
    return "NEW";
  }
  if (prevStep.phaseNumber !== phaseNumber) {
    return "NEW";
  }
  if (prevStep.ai !== currentAI) {
    return "NEW";
  }
  if (prevStep.model !== currentModel) {
    return "NEW";
  }
  return "SAME";
}

function generateSteps(interpretedInput, phases) {
  const input =
    interpretedInput && typeof interpretedInput === "object" ? interpretedInput : {};
  const phaseList = Array.isArray(phases) ? phases : [];

  const complexity = normalizeComplexity(input.complexity);
  const risk = normalizeRisk(input.risk);
  const taskType = normalizeTaskType(input.taskType);
  const availableAIs = normalizeAIs(input.aiTools || input.ai_tools);
  const primaryTarget = getPrimaryTarget(input.targets);
  const stepCount = STEP_COUNT_BY_COMPLEXITY[complexity];

  const steps = [];
  let stepNumber = 1;

  phaseList.forEach((phase) => {
    const phaseNumber =
      phase && Number.isFinite(phase.phaseNumber) ? phase.phaseNumber : 0;
    const role = toStringOrEmpty(phase && phase.role).trim().toUpperCase();
    const intents = chooseIntentsForCount(role, stepCount, {
      taskType,
      complexity,
      risk,
      role,
      phaseNumber,
    });

    intents.forEach((intent) => {
      const ai = routeAI(intent, availableAIs, {
        taskType,
        complexity,
        risk,
        role,
        phaseNumber,
      });
      const model = selectModel(ai, risk);
      const prevStep = steps.length ? steps[steps.length - 1] : null;
      const thread = computeThread(phaseNumber, prevStep, ai, model);

      steps.push({
        stepNumber,
        phaseNumber,
        intent,
        action: actionFor(intent, role || "PHASE", primaryTarget),
        ai,
        model,
        thread,
      });
      stepNumber += 1;
    });
  });

  return steps;
}

module.exports = {
  generateSteps,
};
