import assert from "node:assert/strict";
import test from "node:test";

import {
  ADVISOR_PAPER_PDF_SUGGESTION,
  DEFAULT_THEME_ID,
  THEME_DEFINITIONS,
  applyThemeSelection,
  applyThemeToScene,
  applyThemeToTimelineRender,
  buildThemeContrastEvidence,
  buildThemePickerModel,
  createThemeSelectionChange,
  evaluateAdvisorPaperPdfSuggestion,
  replayThemeSelection,
  resolveAdvisorPaperPdfSuggestion,
  resolveArrowLabelContrast,
  validateFrozenThemeCatalog,
  validateThemeDefinition
} from "../web/js/uxr-002/themes.js";
import {
  buildKeynoteClassicScene
} from "../web/js/uxr-002/board-renderer.js";

const expectedNames = [
  "Keynote Classic",
  "Mission Navy",
  "Advisor Paper",
  "Horizon",
  "Little Journeys"
];

const expectedDescriptors = [
  "The original, perfected.",
  "Premium dark, gold accents.",
  "Print-first, calm, zero glare.",
  "Modern editorial.",
  "Warm, rounded, and still professional."
];

const expectedPalettes = {
  "keynote-classic": {
    education: "#2C6E8F",
    exams: "#3A78C9",
    clinical: "#C8641C",
    work: "#3F9B52",
    research: "#C9A227",
    personal: "#8A5BBF"
  },
  "mission-navy": {
    education: "#5FA8CE",
    exams: "#6FA0E8",
    clinical: "#E08B45",
    work: "#5FBF7A",
    research: "#E3C55A",
    personal: "#B08AE0"
  },
  "advisor-paper": {
    education: "#4A7A93",
    exams: "#5578B0",
    clinical: "#B06A35",
    work: "#55884F",
    research: "#A98F3D",
    personal: "#7E6398"
  },
  horizon: {
    education: "#3D6B7D",
    exams: "#3E6FBF",
    clinical: "#D07530",
    work: "#3E8E5A",
    research: "#C7A23A",
    personal: "#8E67C0"
  },
  "little-journeys": {
    education: "#3E7C96",
    exams: "#4C7ECF",
    clinical: "#E0813F",
    work: "#4E9E6B",
    research: "#D3AC3B",
    personal: "#9A6FCB"
  }
};

function timelineFixture() {
  return {
    id: "student-timeline",
    theme: DEFAULT_THEME_ID,
    studentProfile: {
      fullName: "Avery Student",
      interviewSeason: "2026-01"
    },
    events: [
      {
        id: "education-1",
        title: "Medical school",
        categoryId: "education",
        eventType: "duration",
        startDate: "2021-01",
        endDate: "2025-05",
        visibilityState: "INTERVIEW_SAFE"
      },
      {
        id: "exam-1",
        title: "Step 1",
        categoryId: "exams",
        eventType: "milestone",
        startDate: "2022-06",
        visibilityState: "INTERVIEW_SAFE"
      },
      {
        id: "clinical-1",
        title: "US rotation",
        categoryId: "clinical",
        eventType: "duration",
        startDate: "2023-02",
        endDate: "2023-09",
        visibilityState: "INTERVIEW_SAFE"
      },
      {
        id: "research-1",
        title: "Research",
        categoryId: "research",
        eventType: "duration",
        startDate: "2024-01",
        endDate: "2025-04",
        visibilityState: "INTERVIEW_SAFE"
      }
    ]
  };
}

function canonicalScene() {
  return buildKeynoteClassicScene(timelineFixture(), {
    currentMonth: "2026-02"
  });
}

test("catalog ships exactly the five frozen names, order, descriptors, and default", () => {
  assert.equal(THEME_DEFINITIONS.length, 5);
  assert.deepEqual(THEME_DEFINITIONS.map(({ name }) => name), expectedNames);
  assert.deepEqual(
    THEME_DEFINITIONS.map(({ descriptor }) => descriptor),
    expectedDescriptors
  );
  assert.equal(THEME_DEFINITIONS[0].id, DEFAULT_THEME_ID);
  assert.ok(Object.isFrozen(THEME_DEFINITIONS));
  assert.ok(Object.isFrozen(THEME_DEFINITIONS[0].categories));
});

test("all six category palettes and complete board token families match §8.2", () => {
  for (const theme of THEME_DEFINITIONS) {
    assert.deepEqual(theme.categories, expectedPalettes[theme.id]);
    assert.ok(theme.board.kind);
    assert.ok(theme.board.css);
    assert.ok(theme.axis.color);
    assert.ok(theme.axis.width > 0);
    assert.ok(theme.ticks.color);
    assert.ok(theme.yearLabel.color);
    assert.ok(theme.yearLabel.fontSize);
    assert.ok(theme.yearLabel.fontWeight);
    assert.ok(theme.ink);
    assert.ok(theme.flagPlate.shape);
    assert.ok(theme.flagPlate.fill);
    assert.equal(typeof theme.arrowShadow.enabled, "boolean");
    assert.ok(theme.headline.color);
    assert.ok(theme.headline.fontSize);
    assert.ok(theme.headline.fontWeight);
  }
});

test("catalog and per-theme validators reject drift and a sixth theme", () => {
  const validation = validateFrozenThemeCatalog();
  assert.equal(validation.valid, true, validation.errors.join("\n"));
  assert.ok(validation.validations.every(({ valid }) => valid));
  assert.equal(validateThemeDefinition(THEME_DEFINITIONS[2]).valid, true);

  const altered = structuredClone(THEME_DEFINITIONS);
  altered[0].axis.width = 3;
  assert.equal(validateFrozenThemeCatalog(altered).valid, false);

  const sixth = structuredClone(THEME_DEFINITIONS);
  sixth.push({
    ...structuredClone(THEME_DEFINITIONS[0]),
    id: "invented-sixth-theme",
    name: "Invented"
  });
  const sixthValidation = validateFrozenThemeCatalog(sixth);
  assert.equal(sixthValidation.valid, false);
  assert.ok(sixthValidation.errors.includes("Exactly five themes must ship."));
});

test("candidate-bound label evidence passes 4.5:1 across every theme", () => {
  for (const theme of THEME_DEFINITIONS) {
    const evidence = buildThemeContrastEvidence(theme.id);
    assert.equal(evidence.candidateBound, true);
    assert.equal(evidence.passes, true, theme.name);
    assert.ok(evidence.roles.every(({ calculatedContrast }) =>
      calculatedContrast >= 4.5
    ));
    assert.ok(Object.values(evidence.arrowLabels).every(({ passes }) => passes));
    for (const label of Object.values(evidence.arrowLabels)) {
      assert.ok(label.originalToken);
      assert.ok(label.passingToken);
      assert.ok(label.calculatedContrast >= 4.5);
    }
  }
});

test("white is preferred, #191C21 substitutes when it passes, otherwise labels move above", () => {
  const keynoteEducation = resolveArrowLabelContrast(
    "keynote-classic",
    "education"
  );
  assert.equal(keynoteEducation.placement, "inside");
  assert.equal(keynoteEducation.passingToken, "#FFFFFF");
  assert.equal(keynoteEducation.calculatedContrast, 5.6238);

  const navyEducation = resolveArrowLabelContrast(
    "mission-navy",
    "education"
  );
  assert.equal(navyEducation.originalToken, "#FFFFFF");
  assert.equal(navyEducation.originalPasses, false);
  assert.equal(navyEducation.passingToken, "#191C21");
  assert.equal(navyEducation.calculatedContrast, 6.4901);

  const keynoteExam = resolveArrowLabelContrast("keynote-classic", "exams");
  assert.equal(keynoteExam.originalContrast, 4.4587);
  assert.equal(keynoteExam.placement, "above");
  assert.equal(keynoteExam.passingToken, "#232B36");
  assert.ok(keynoteExam.calculatedContrast >= 4.5);
});

test("scene theming is pure, board-only, and retokens canonical arrows, flags, and axis", () => {
  const source = canonicalScene();
  source.shell = { background: "#F7F6F3", sentinel: "unchanged" };
  const sourceSnapshot = structuredClone(source);
  const themed = applyThemeToScene(source, "mission-navy");

  assert.deepEqual(source, sourceSnapshot);
  assert.deepEqual(themed.shell, source.shell);
  assert.notEqual(themed.shell, source.shell);
  assert.equal(themed.theme.id, "mission-navy");
  assert.equal(themed.board.background.kind, "radial-gradient");
  assert.equal(themed.axis.style.color, "#D9C489");
  assert.equal(themed.axis.tickStyle.color, "#66738F");
  assert.equal(themed.arrows[0].fill, "#5FA8CE");
  assert.equal(themed.arrows[0].label.color, "#191C21");
  assert.equal(themed.flags[0].plate.fill, "#22304F");
  assert.equal(themed.flags[0].label.color, "#F2F4F8");
  assert.equal(themed.interviewMarker.plate.fill, "#22304F");
  assert.equal(themed.themeApplication.scope, "board-only");
  assert.equal(themed.themeApplication.shellChanged, false);
});

test("all themes preserve the corrected 407F artifact geometry while changing surface tokens only", () => {
  const source = canonicalScene();
  const classic = applyThemeToScene(source, "keynote-classic");
  const navy = applyThemeToScene(source, "mission-navy");
  const little = applyThemeToScene(source, "little-journeys");

  assert.equal(classic.arrows[0].leftRadius, 0);
  assert.equal(navy.arrows[0].leftRadius, 0);
  assert.equal(little.arrows[0].leftRadius, 0);
  assert.equal(little.arrows[0].path, classic.arrows[0].path);
  assert.equal(little.flags[0].plate.shape, classic.flags[0].plate.shape);
  assert.equal(little.flags[0].plate.radius, classic.flags[0].plate.radius);
  assert.equal(little.theme.yearLabel.fontFamily, "Nunito, sans-serif");
  assert.equal(little.theme.headline.fontWeight, 800);
  for (const property of ["x", "x2", "width", "centerY", "headLength", "headHeight"]) {
    assert.equal(little.arrows[0][property], classic.arrows[0][property], property);
  }
});

test("Advisor Paper and Horizon retain their frozen print and editorial signatures", () => {
  const source = canonicalScene();
  const paper = applyThemeToScene(source, "advisor-paper");
  const horizon = applyThemeToScene(source, "horizon");

  assert.equal(paper.theme.board.color, "#FAF6EC");
  assert.equal(paper.theme.arrowShadow.enabled, false);
  assert.equal(paper.arrows[0].arrowShadow.enabled, false);
  assert.equal(paper.theme.axis.width, 1.5);

  assert.equal(horizon.theme.board.band.endPercent, 26);
  assert.equal(horizon.axis.style.endSerifHeight, 8);
  assert.equal(horizon.theme.flagPlate.shape, "inverted-plate");
  assert.equal(horizon.flags[0].plate.shape, source.flags[0].plate.shape);
  assert.equal(horizon.flags[0].plate.fill, "#1F232A");
  assert.equal(horizon.flags[0].label.color, "#FFFFFF");
  assert.deepEqual(horizon.headline.rule, {
    color: "#B98A2E",
    width: 24,
    position: "beneath"
  });
});

test("Guided picker is a 2x3 model with five own-board live miniatures and a locked teaser", () => {
  const source = canonicalScene();
  const miniatureCalls = [];
  const picker = buildThemePickerModel({
    scene: source,
    activeThemeId: "horizon",
    mode: "guided",
    createMiniature(input) {
      miniatureCalls.push(input);
      return `${input.scene.theme.id}:${input.eventIds.join(",")}`;
    }
  });

  assert.equal(picker.columns, 3);
  assert.equal(picker.rows, 2);
  assert.equal(picker.cells.length, 6);
  assert.equal(picker.themeCount, 5);
  assert.equal(miniatureCalls.length, 5);
  assert.deepEqual(
    miniatureCalls[0].eventIds,
    source.events.map(({ id }) => id)
  );
  assert.ok(miniatureCalls.every(({ source: kind }) => kind === "student-board"));
  assert.ok(miniatureCalls.every(({ studentName }) => studentName === "Avery Student"));
  assert.equal(picker.cells.filter(({ kind }) => kind === "theme").length, 5);
  assert.equal(picker.cells.find(({ themeId }) => themeId === "horizon").border, "gold");
  assert.deepEqual(picker.cells[5], {
    kind: "advanced-teaser",
    title: "Your background — Advanced Studio",
    name: "Your background",
    descriptor: "Advanced Studio",
    interactive: false,
    locked: true,
    lockGlyph: "lock",
    action: null
  });
});

test("Advanced picker changes only the sixth cell into the Backgrounds entry", () => {
  const source = canonicalScene();
  const guided = buildThemePickerModel({ scene: source, mode: "guided" });
  const advanced = buildThemePickerModel({ scene: source, mode: "advanced" });

  assert.deepEqual(advanced.cells.slice(0, 5), guided.cells.slice(0, 5));
  assert.deepEqual(advanced.cells[5], {
    kind: "backgrounds-entry",
    title: "Backgrounds",
    name: "Backgrounds",
    descriptor: "Advanced Studio",
    interactive: true,
    locked: false,
    lockGlyph: null,
    action: { type: "open-backgrounds" }
  });
});

test("theme selection produces one immutable undo/redo-friendly change", () => {
  const timeline = timelineFixture();
  const snapshot = structuredClone(timeline);
  const selection = applyThemeSelection(timeline, "horizon");

  assert.deepEqual(timeline, snapshot);
  assert.equal(selection.changed, true);
  assert.equal(selection.timeline.theme, "horizon");
  assert.deepEqual(selection.historyEntry, createThemeSelectionChange(
    "keynote-classic",
    "horizon"
  ));
  assert.equal(
    replayThemeSelection(selection.timeline, selection.historyEntry, "undo").theme,
    "keynote-classic"
  );
  assert.equal(
    replayThemeSelection(timeline, selection.historyEntry, "redo").theme,
    "horizon"
  );
  const noOp = applyThemeSelection(selection.timeline, "horizon");
  assert.equal(noOp.changed, false);
  assert.equal(noOp.historyEntry, null);
});

test("PDF selection offers Advisor Paper once; apply is undoable and dismissal never repeats", () => {
  const initial = evaluateAdvisorPaperPdfSuggestion({
    format: "PDF",
    activeThemeId: "horizon",
    suggestionState: {}
  });
  assert.equal(initial.offered, true);
  assert.equal(initial.suggestion, ADVISOR_PAPER_PDF_SUGGESTION);
  assert.equal(initial.suggestion.message, "Advisor Paper prints best — switch?");
  assert.equal(initial.suggestionState.advisorPaperPdfSuggestionShown, true);

  const dismissed = resolveAdvisorPaperPdfSuggestion(
    timelineFixture(),
    initial,
    "dismiss"
  );
  assert.equal(dismissed.timeline.theme, "keynote-classic");
  assert.equal(dismissed.changed, false);
  assert.equal(evaluateAdvisorPaperPdfSuggestion({
    format: "pdf",
    activeThemeId: "horizon",
    suggestionState: dismissed.suggestionState
  }).offered, false);

  const applied = resolveAdvisorPaperPdfSuggestion(
    timelineFixture(),
    initial,
    "apply"
  );
  assert.equal(applied.timeline.theme, "advisor-paper");
  assert.equal(applied.historyEntry.type, "theme-change");
  assert.equal(
    replayThemeSelection(applied.timeline, applied.historyEntry, "undo").theme,
    "keynote-classic"
  );
  assert.equal(evaluateAdvisorPaperPdfSuggestion({
    format: "pdf",
    activeThemeId: "advisor-paper",
    suggestionState: {}
  }).offered, false);
});

test("render theming never leaves stale Keynote SVG and accepts an injected theme serializer", () => {
  const render = {
    scene: canonicalScene(),
    svg: "<svg data-theme=\"keynote-classic\"></svg>",
    metadata: { shell: "external" }
  };
  const pending = applyThemeToTimelineRender(render, "horizon");
  assert.equal(render.svg, "<svg data-theme=\"keynote-classic\"></svg>");
  assert.equal(pending.svg, null);
  assert.equal(pending.serializationRequired, true);
  assert.equal(pending.scene.theme.id, "horizon");

  const serialized = applyThemeToTimelineRender(render, "advisor-paper", {
    serializeScene(scene) {
      return `<svg data-theme="${scene.theme.id}"></svg>`;
    }
  });
  assert.equal(serialized.svg, '<svg data-theme="advisor-paper"></svg>');
  assert.equal(serialized.serializationRequired, false);
  assert.deepEqual(serialized.metadata, render.metadata);
});
