"use strict";

/**
 * MMOS Interpretation Engine v2 validation harness.
 *
 * Run: node tests/interpretation_v2_validation.js
 *
 * Verifies:
 *   (1) The two reported failing cases now pass.
 *   (2) Regression suite of ten well-behaved patterns still classifies
 *       sensibly (no catastrophic drift).
 *   (3) Edge cases (empty, gibberish, overloaded text).
 *
 * Exits 0 on full pass, 1 on any failure.
 */

const path = require("path");
const eng = require(path.join(__dirname, "..", "interpretationEngine.js"));

const RESET = "\x1b[0m";
const GREEN = "\x1b[32m";
const RED = "\x1b[31m";
const YELLOW = "\x1b[33m";

let passCount = 0;
let failCount = 0;

function assertOne(label, actual, expected) {
  const ok =
    (expected.taskType === undefined || expected.taskType === actual.taskType) &&
    (expected.complexity === undefined ||
      expected.complexity.includes(actual.complexity)) &&
    (expected.risk === undefined ||
      expected.risk.includes(actual.risk)) &&
    (expected.notFlag === undefined ||
      !actual.metadata.reasoningFlags.includes(expected.notFlag));

  if (ok) {
    passCount++;
    console.log(`${GREEN}PASS${RESET}  ${label}`);
    console.log(
      `      -> taskType=${actual.taskType}, complexity=${actual.complexity}, risk=${actual.risk}, phases=${actual.inferredPhases}, flags=[${actual.metadata.reasoningFlags.join(", ")}]`
    );
  } else {
    failCount++;
    console.log(`${RED}FAIL${RESET}  ${label}`);
    console.log(`      expected: ${JSON.stringify(expected)}`);
    console.log(`      actual:   taskType=${actual.taskType}, complexity=${actual.complexity}, risk=${actual.risk}, phases=${actual.inferredPhases}`);
    console.log(`      flags:    [${actual.metadata.reasoningFlags.join(", ")}]`);
  }
}

function run(label, input, expected) {
  try {
    const out = eng.interpretInput(input);
    assertOne(label, out, expected);
  } catch (e) {
    failCount++;
    console.log(`${RED}FAIL${RESET}  ${label}`);
    console.log(`      threw: ${e.message}`);
  }
}

console.log(`${YELLOW}=== PRIMARY FAILING CASES (v1 defects) ===${RESET}`);

// Case 1: STAT integration.
// v1: classified as PLAN/LOW/LOW with needs_user_confirmation (hard block).
// v2 expected: SYSTEM_MIGRATION or BUILD, complexity >= MED, risk HIGH,
// and crucially NOT flagged as needs_user_confirmation.
run(
  "STAT integration (no targets)",
  {
    goal: "integrate STAT question bank into Arena system with scalable filtering and injection pipeline",
    target: [],
    constraint: "",
  },
  {
    taskType: "SYSTEM_MIGRATION",
    complexity: ["MED", "HIGH"],
    risk: ["HIGH"],
    notFlag: "needs_user_confirmation",
  }
);

run(
  "STAT integration (with targets)",
  {
    goal: "integrate STAT question bank into Arena system with scalable filtering and injection pipeline",
    target: ["STAT question bank", "Arena system"],
    constraint: "",
  },
  {
    taskType: "SYSTEM_MIGRATION",
    complexity: ["MED", "HIGH"],
    risk: ["HIGH"],
    notFlag: "needs_user_confirmation",
  }
);

// Case 2: Arena UX improvement.
// v1: classified as BUILD/LOW/LOW (shallow 2-phase output).
// v2 expected: AUDIT (or BUILD), complexity MED minimum.
run(
  "Arena UX improvement (no targets)",
  {
    goal: "improve arena UI UX flow to reduce friction and make experience more intuitive",
    target: [],
    constraint: "",
  },
  {
    taskType: "AUDIT",
    complexity: ["MED", "HIGH"],
    notFlag: "needs_user_confirmation",
  }
);

run(
  "Arena UX improvement (with targets)",
  {
    goal: "improve arena UI UX flow to reduce friction and make experience more intuitive",
    target: ["arena lobby", "arena gauntlet", "arena results"],
    constraint: "",
  },
  {
    taskType: "AUDIT",
    complexity: ["MED", "HIGH"],
    notFlag: "needs_user_confirmation",
  }
);

console.log(`\n${YELLOW}=== REGRESSION: WELL-BEHAVED PATTERNS ===${RESET}`);

run(
  "Simple BUILD task",
  { goal: "create a new landing page", target: ["public/index.html"], constraint: "" },
  { taskType: "BUILD", complexity: ["LOW", "MED"], risk: ["HIGH"] } // prod surface -> HIGH risk
);

run(
  "Simple FIX task",
  { goal: "fix a typo in the header", target: ["header.js"], constraint: "" },
  { taskType: "FIX", complexity: ["LOW"], risk: ["LOW"] }
);

run(
  "Simple AUDIT task",
  { goal: "audit the login flow", target: ["login.js"], constraint: "" },
  { taskType: "AUDIT", complexity: ["LOW"], risk: ["LOW"] }
);

run(
  "DEPLOY to production",
  {
    goal: "deploy the new auth system to production",
    target: ["auth"],
    constraint: "",
  },
  { taskType: "DEPLOY", risk: ["HIGH"] }
);

run(
  "Refactor auth module",
  {
    goal: "refactor the auth module to use JWT instead of sessions",
    target: ["auth/middleware.js"],
    constraint: "",
  },
  { taskType: "SYSTEM_MIGRATION", risk: ["HIGH"] }
);

run(
  "CONTENT task",
  { goal: "rewrite the landing page headline and subheadline copy", target: ["landing.html"], constraint: "" },
  { taskType: "CONTENT" }
);

run(
  "PLAN task",
  { goal: "plan the architecture for the new billing service", target: ["billing"], constraint: "" },
  { taskType: "PLAN" }
);

run(
  "MR authority raises risk",
  {
    goal: "audit admissions form fields",
    target: ["admissions-form.html"],
    constraint: "MR-1316 governs all visual outputs",
  },
  { taskType: "AUDIT", risk: ["MED", "HIGH"] }
);

run(
  "Broken integration (FIX via scope-heuristic)",
  { goal: "login is broken after yesterday deploy", target: ["login.js"], constraint: "" },
  { taskType: "FIX" }
);

run(
  "Multi-intent compound goal",
  {
    goal: "build a new pipeline that migrates legacy data and publishes events to the event bus",
    target: ["pipeline/", "events/"],
    constraint: "",
  },
  { taskType: "SYSTEM_MIGRATION", complexity: ["MED", "HIGH"] }
);

console.log(`\n${YELLOW}=== EDGE CASES ===${RESET}`);

run(
  "Truly empty goal",
  { goal: "", target: ["foo"], constraint: "" },
  { taskType: "PLAN" } // defaulted + needs_user_confirmation allowed here
);

run(
  "Sub-5-char goal",
  { goal: "hi", target: ["foo"], constraint: "" },
  { taskType: "PLAN" }
);

// Substantive but keyword-poor (should NOT throw needs_user_confirmation)
run(
  "Substantive no-verb goal (scope heuristic catches it)",
  {
    goal: "registration system with payment pipeline and email engine",
    target: ["registration.js"],
    constraint: "",
  },
  { taskType: "SYSTEM_MIGRATION", notFlag: "needs_user_confirmation" }
);

console.log(`\n${YELLOW}=== SUMMARY ===${RESET}`);
console.log(`Passed: ${GREEN}${passCount}${RESET}`);
console.log(`Failed: ${failCount === 0 ? GREEN : RED}${failCount}${RESET}`);

process.exit(failCount === 0 ? 0 : 1);
