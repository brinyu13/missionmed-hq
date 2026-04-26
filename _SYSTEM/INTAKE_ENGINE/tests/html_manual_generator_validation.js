"use strict";

const path = require("path");
const { JSDOM } = require("jsdom");

const engine = require(path.join(__dirname, "..", "integrationEngine.js"));

const workflowCases = [
  {
    name: "STAT INTEGRATION workflow",
    minimalInput: {
      goal: "integrate STAT question bank into Arena system with scalable filtering and injection pipeline",
      targets: ["STAT question bank", "Arena system"],
      constraint: "",
      project: "M",
      aiTools: ["CLAUDE", "CODEX"],
    },
    options: { project: "M" },
  },
  {
    name: "LOW BUILD workflow",
    minimalInput: {
      goal: "create a new landing page",
      targets: ["public/index.html"],
      constraint: "",
      project: "M",
      aiTools: ["CLAUDE", "CODEX"],
    },
    options: { project: "M" },
  },
];

function fail(errors, message) {
  errors.push(message);
}

function assertSectionOrder(html, errors) {
  const order = [
    'data-section="header"',
    'data-section="summary"',
    'data-section="phases"',
    'data-section="step-tables"',
    'data-section="prompts"',
  ];

  const indexes = order.map((token) => html.indexOf(token));
  indexes.forEach((idx, i) => {
    if (idx === -1) {
      fail(errors, "Missing required section marker: " + order[i]);
    }
  });

  for (let i = 1; i < indexes.length; i += 1) {
    if (indexes[i] !== -1 && indexes[i - 1] !== -1 && indexes[i] <= indexes[i - 1]) {
      fail(errors, "Section order is not deterministic for " + order[i]);
    }
  }
}

function assertManual(caseName, workflowOutput, html) {
  const errors = [];

  if (typeof html !== "string" || html.length === 0) {
    fail(errors, "Manual output is not a non-empty string.");
    return errors;
  }
  if (!html.startsWith("<!DOCTYPE html>")) {
    fail(errors, "Manual output does not start with <!DOCTYPE html>.");
  }

  assertSectionOrder(html, errors);

  const dom = new JSDOM(html);
  const doc = dom.window.document;

  const phases = Array.isArray(workflowOutput.phases) ? workflowOutput.phases : [];
  const steps = Array.isArray(workflowOutput.steps) ? workflowOutput.steps : [];
  const prompts = Array.isArray(workflowOutput.prompts) ? workflowOutput.prompts : [];

  const phaseCards = doc.querySelectorAll('[data-section="phase"]');
  if (phaseCards.length !== phases.length) {
    fail(
      errors,
      "Phase render mismatch: expected " +
        phases.length +
        ", got " +
        phaseCards.length +
        "."
    );
  }

  const stepTables = doc.querySelectorAll('[data-section="step-table"]');
  if (stepTables.length !== phases.length) {
    fail(
      errors,
      "Step table count mismatch: expected " +
        phases.length +
        ", got " +
        stepTables.length +
        "."
    );
  }

  const promptBlocks = doc.querySelectorAll('[data-section="prompt-block"]');
  if (promptBlocks.length !== steps.length) {
    fail(
      errors,
      "Prompt block count mismatch: expected " +
        steps.length +
        ", got " +
        promptBlocks.length +
        "."
    );
  }

  const manualText = toText(doc.body);

  phases.forEach((phase, idx) => {
    const phaseNumber = Number.isFinite(phase.phaseNumber)
      ? phase.phaseNumber
      : parseInt(phase.phaseNumber, 10) || idx + 1;
    const selector =
      '[data-section="phase"][data-phase-number="' + String(phaseNumber) + '"]';
    const phaseNode = doc.querySelector(selector);
    if (!phaseNode) {
      fail(errors, "Missing phase block for phase " + phaseNumber + ".");
      return;
    }

    const phaseText = toText(phaseNode);
    const role = String(phase.role || "");
    const title = String(phase.title || "");
    const description = String(phase.description || "");

    if (role && !phaseText.includes(role)) {
      fail(errors, "Phase role missing in render for phase " + phaseNumber + ".");
    }
    if (title && !phaseText.includes(title)) {
      fail(errors, "Phase title missing in render for phase " + phaseNumber + ".");
    }
    if (description && !phaseText.includes(description)) {
      fail(
        errors,
        "Phase description missing in render for phase " + phaseNumber + "."
      );
    }

    const expectedStepRows = steps.filter(
      (step) =>
        (Number.isFinite(step.phaseNumber)
          ? step.phaseNumber
          : parseInt(step.phaseNumber, 10)) === phaseNumber
    ).length;
    const phaseStepTable = doc.querySelector(
      '[data-section="step-table"][data-phase-number="' + String(phaseNumber) + '"]'
    );
    const actualStepRows = phaseStepTable
      ? phaseStepTable.querySelectorAll("tr[data-step-row]").length
      : 0;
    if (actualStepRows !== expectedStepRows) {
      fail(
        errors,
        "Step row mismatch for phase " +
          phaseNumber +
          ": expected " +
          expectedStepRows +
          ", got " +
          actualStepRows +
          "."
      );
    }
  });

  steps.forEach((step) => {
    ["intent", "action", "ai", "model", "thread"].forEach((field) => {
      const value = String(step[field] || "").trim();
      if (value.length > 0 && !manualText.includes(value)) {
        fail(errors, "Missing step field in output (" + field + "): " + value);
      }
    });
  });

  prompts.forEach((prompt, idx) => {
    const step = steps[idx];
    const stepNumber = step
      ? Number.isFinite(step.stepNumber)
        ? step.stepNumber
        : parseInt(step.stepNumber, 10) || idx + 1
      : idx + 1;
    const selector =
      '[data-section="prompt-block"][data-step-number="' + String(stepNumber) + '"]';
    const block = doc.querySelector(selector);
    if (!block) {
      fail(errors, "Missing prompt block for step " + stepNumber + ".");
      return;
    }
    const blockText = toText(block);
    const promptName = String(prompt.promptName || "").trim();
    const threadName = String(prompt.threadName || "").trim();
    const promptBody = String(prompt.promptBody || "");
    const pre = block.querySelector("pre");

    if (promptName.length > 0 && !blockText.includes(promptName)) {
      fail(errors, "Prompt name missing for step " + stepNumber + ".");
    }
    if (threadName.length > 0 && !blockText.includes(threadName)) {
      fail(errors, "Thread name missing for step " + stepNumber + ".");
    }
    if (!pre) {
      fail(errors, "Prompt body pre block missing for step " + stepNumber + ".");
    } else if (pre.textContent !== promptBody) {
      fail(errors, "Prompt body mismatch for step " + stepNumber + ".");
    }
  });

  if (errors.length === 0) {
    const summary =
      "[PASS] " +
      caseName +
      " | phases=" +
      phases.length +
      " | steps=" +
      steps.length +
      " | prompts=" +
      prompts.length;
    console.log(summary);
  }

  return errors;
}

function toText(node) {
  if (!node) {
    return "";
  }
  return String(node.textContent || "").replace(/\s+/g, " ").trim();
}

function run() {
  const allErrors = [];

  workflowCases.forEach((entry) => {
    try {
      const workflow = engine.generateWorkflow(entry.minimalInput, entry.options);
      const html = engine.generateHTMLManual(workflow);
      const errors = assertManual(entry.name, workflow, html);
      if (errors.length > 0) {
        console.log("[FAIL] " + entry.name);
        errors.forEach((err) => {
          console.log("  - " + err);
          allErrors.push(entry.name + ": " + err);
        });
      }
    } catch (error) {
      const message = "[FAIL] " + entry.name + " threw: " + error.message;
      console.log(message);
      allErrors.push(message);
    }
  });

  console.log("");
  if (allErrors.length === 0) {
    console.log("Validation complete: PASS");
    process.exit(0);
  }

  console.log("Validation complete: FAIL");
  process.exit(1);
}

run();
