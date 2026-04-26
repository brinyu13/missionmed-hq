"use strict";

const VALID_COMPLEXITIES = new Set(["LOW", "MED", "HIGH"]);

const PHASE_COUNT_BY_COMPLEXITY = {
  LOW: 2,
  MED: 3,
  HIGH: 4,
};

const ROLE_SETS = {
  BUILD: ["PLAN", "IMPLEMENT", "VALIDATE", "FINALIZE"],
  AUDIT: ["DISCOVER", "ANALYZE", "REPORT", "VERIFY"],
  FIX: ["REPRODUCE", "DIAGNOSE", "PATCH", "VERIFY"],
  DEPLOY: ["PREPARE", "VALIDATE", "RELEASE", "MONITOR"],
  CONTENT: ["PLAN", "CREATE", "REVIEW", "FINALIZE"],
  PLAN: ["DISCOVER", "STRUCTURE", "DEFINE"],
  SYSTEM_MIGRATION: ["AUDIT", "PLAN", "MIGRATE", "VERIFY"],
};

function toStringOrEmpty(value) {
  if (value === null || value === undefined) {
    return "";
  }
  return String(value);
}

function normalizeTaskType(taskType) {
  const normalized = toStringOrEmpty(taskType).trim().toUpperCase();
  return ROLE_SETS[normalized] ? normalized : "PLAN";
}

function normalizeComplexity(complexity) {
  const normalized = toStringOrEmpty(complexity).trim().toUpperCase();
  return VALID_COMPLEXITIES.has(normalized) ? normalized : "LOW";
}

function getPrimaryTarget(targets) {
  if (!Array.isArray(targets) || targets.length === 0) {
    return "system";
  }
  const first = toStringOrEmpty(targets[0]).trim();
  return first || "system";
}

function reduceRoles(baseRoles, desiredCount) {
  if (desiredCount >= baseRoles.length) {
    return baseRoles.slice();
  }

  const roles = baseRoles.slice();
  const executionRoles = new Set(["IMPLEMENT", "PATCH", "MIGRATE", "RELEASE"]);
  const setupRoles = new Set(["PLAN", "DISCOVER", "PREPARE", "STRUCTURE"]);
  const executionRole = roles.find((role) => executionRoles.has(role)) || null;
  const minimumKeptCount = executionRole ? 2 : 1;

  while (roles.length > desiredCount && roles.length > minimumKeptCount) {
    const finalIndex = roles.length - 1;
    const executionIndex = executionRole ? roles.indexOf(executionRole) : -1;

    let removeIndex = roles.findIndex((role, index) => {
      if (index === finalIndex || index === executionIndex) {
        return false;
      }
      return setupRoles.has(role);
    });

    if (removeIndex === -1) {
      removeIndex = roles.findIndex((_, index) => {
        return index !== finalIndex && index !== executionIndex;
      });
    }

    if (removeIndex === -1) {
      break;
    }

    roles.splice(removeIndex, 1);
  }
  return roles;
}

function expandRoles(baseRoles, desiredCount) {
  const roles = baseRoles.slice();
  if (roles.length === 0) {
    return [];
  }
  while (roles.length < desiredCount) {
    roles.splice(roles.length - 1, 0, roles[roles.length - 1]);
  }
  return roles;
}

function selectRoles(taskType, desiredCount) {
  const baseRoles = ROLE_SETS[taskType] || ROLE_SETS.PLAN;
  if (desiredCount < baseRoles.length) {
    return reduceRoles(baseRoles, desiredCount);
  }
  if (desiredCount > baseRoles.length) {
    return expandRoles(baseRoles, desiredCount);
  }
  return baseRoles.slice();
}

function buildDescription(role, taskType, target) {
  return role + " phase for " + taskType + " workflow on " + target + ".";
}

function generatePhases(interpretedInput) {
  const input =
    interpretedInput && typeof interpretedInput === "object" ? interpretedInput : {};

  const taskType = normalizeTaskType(input.taskType);
  const complexity = normalizeComplexity(input.complexity);
  const desiredCount = PHASE_COUNT_BY_COMPLEXITY[complexity];
  const primaryTarget = getPrimaryTarget(input.targets);
  const roles = selectRoles(taskType, desiredCount);

  return roles.map((role, index) => {
    const phaseNumber = index + 1;
    return {
      phaseNumber,
      role,
      title: "PH" + phaseNumber + ": " + role + " — " + primaryTarget,
      description: buildDescription(role, taskType, primaryTarget),
    };
  });
}

module.exports = {
  generatePhases,
};
