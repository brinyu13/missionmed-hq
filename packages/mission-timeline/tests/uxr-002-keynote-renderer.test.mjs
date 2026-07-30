import assert from "node:assert/strict";
import test from "node:test";

import {
  KEYNOTE_BOARD_GEOMETRY,
  KEYNOTE_CLASSIC_THEME,
  KEYNOTE_LANE_SPACING_TOKENS,
  buildKeynoteClassicScene,
  chooseArrowLabelTreatment,
  renderKeynoteClassicBoard,
  serializeKeynoteClassicSvg
} from "../web/js/uxr-002/board-renderer.js";

function event(overrides = {}) {
  return {
    id: "event",
    title: "Event",
    categoryId: "education",
    eventType: "duration",
    startDate: "2021-01",
    endDate: "2021-12",
    openEnded: false,
    visibilityState: "INTERVIEWER_SAFE",
    ...overrides
  };
}

function representativeTimeline() {
  return {
    studentProfile: {
      fullName: "Amara Osei",
      interviewSeason: "2025-09"
    },
    events: [
      event({
        id: "medical-school",
        title: "Medical school",
        categoryId: "education",
        startDate: "2021-01",
        endDate: "2022-12"
      }),
      event({
        id: "study-window",
        title: "Step 2 CK study",
        categoryId: "exams",
        eventType: "study-period",
        startDate: "2022-01",
        endDate: "2022-10",
        provisional: true
      }),
      event({
        id: "clinical",
        title: "US clinical rotations",
        categoryId: "clinical",
        startDate: "2023-01",
        endDate: "2024-12"
      }),
      event({
        id: "research",
        title: "Research",
        categoryId: "research",
        startDate: "2023-01",
        endDate: "2025-04"
      }),
      event({
        id: "open-work",
        title: "Clinical work",
        categoryId: "work",
        startDate: "2024-01",
        endDate: null,
        openEnded: true
      }),
      event({
        id: "step-2",
        title: "Step 2 CK · 254",
        categoryId: "exams",
        eventType: "milestone",
        startDate: "2024-06",
        endDate: null
      }),
      event({
        id: "publication",
        title: "JAMA · 1st",
        categoryId: "research",
        eventType: "milestone",
        startDate: "2024-06",
        endDate: null
      }),
      event({
        id: "advisor-only",
        title: "Private advisor context",
        categoryId: "personal",
        startDate: "2021-03",
        endDate: "2025-03",
        visibilityState: "ADVISOR_ONLY"
      })
    ]
  };
}

function scene(options = {}) {
  return buildKeynoteClassicScene(representativeTimeline(), {
    currentMonth: "2026-07",
    ...options
  });
}

test("M4 freezes the 1920×1080 T1 board, 68% axis, exact palette, type, geometry, shadow, and explicit lane spacing tokens", () => {
  assert.deepEqual(KEYNOTE_BOARD_GEOMETRY, {
    width: 1920,
    height: 1080,
    margin: 96,
    innerWidth: 1728,
    axisRatio: 0.68,
    axisY: 734.4,
    arrow: {
      shaftHeight: 28,
      condensedShaftHeight: 22,
      headLength: 18,
      headHeight: 40,
      leftRadius: 3,
      labelPadding: 8,
      openFadeLength: 48
    },
    flag: {
      standardHeight: 34,
      alternateHeight: 52,
      plateHeight: 24,
      plateRadius: 6,
      poleWidth: 1.5
    }
  });
  assert.ok(
    Math.abs(KEYNOTE_BOARD_GEOMETRY.axisY - KEYNOTE_BOARD_GEOMETRY.height * 0.68) < 1e-9
  );
  assert.equal(KEYNOTE_CLASSIC_THEME.board.start, "#F5F7FB");
  assert.equal(KEYNOTE_CLASSIC_THEME.board.end, "#E9EEF6");
  assert.equal(KEYNOTE_CLASSIC_THEME.board.angle, 165);
  assert.deepEqual(KEYNOTE_CLASSIC_THEME.axis, { color: "#2A3442", width: 2 });
  assert.equal(KEYNOTE_CLASSIC_THEME.ticks.color, "#8B98AA");
  assert.deepEqual(KEYNOTE_CLASSIC_THEME.yearLabel, {
    color: "#2A3442",
    fontSize: 20,
    fontWeight: 700
  });
  assert.equal(KEYNOTE_CLASSIC_THEME.ink, "#232B36");
  assert.equal(KEYNOTE_CLASSIC_THEME.flagPlate.fill, "#FFFFFF");
  assert.equal(KEYNOTE_CLASSIC_THEME.flagPlate.border, "#C6CFDB");
  assert.equal(KEYNOTE_CLASSIC_THEME.arrowShadow, "0 1px 2px rgba(0,0,0,.18)");
  assert.deepEqual(KEYNOTE_CLASSIC_THEME.headline, {
    color: "#232B36",
    fontSize: 24,
    fontWeight: 700
  });
  assert.deepEqual(KEYNOTE_CLASSIC_THEME.categories, {
    education: "#2C6E8F",
    exams: "#3A78C9",
    clinical: "#C8641C",
    work: "#3F9B52",
    research: "#C9A227",
    personal: "#8A5BBF"
  });
  assert.deepEqual(KEYNOTE_LANE_SPACING_TOKENS, {
    standard: { pitch: 64, axisClearance: 52 },
    condensed: { pitch: 44, axisClearance: 52 }
  });
});

test("M4 builds adaptive year segments and ticks whose integer widths sum to the exact 1728px inner board", () => {
  const rendered = scene();
  assert.equal(rendered.axis.x1, 96);
  assert.equal(rendered.axis.x2, 1824);
  assert.equal(rendered.axis.y, 734.4);
  assert.equal(
    rendered.axis.segments.reduce((sum, segment) => sum + segment.width, 0),
    1728
  );
  assert.equal(rendered.axis.segments[0].x, 96);
  assert.equal(
    rendered.axis.segments.at(-1).x + rendered.axis.segments.at(-1).width,
    1824
  );
  assert.equal(rendered.axis.boundaries.length, rendered.axis.segments.length + 1);
  for (const segment of rendered.axis.segments) {
    assert.ok(Number.isInteger(segment.width), "adaptive widths must be integer pixels");
    const ticks = rendered.axis.ticks.filter((tick) => tick.year === segment.year);
    assert.equal(
      ticks.length,
      segment.tickMode === "months" ? 11 : 3,
      "month-pitch mode must determine the minor-tick set"
    );
  }
});

test("M4 renders flat tapered arrows with the frozen normal geometry, one fill, 3px left radius, shadow, and no label plates", () => {
  const rendered = scene();
  const arrow = rendered.arrows.find(({ id }) => id === "medical-school");
  assert.equal(arrow.shaftHeight, 28);
  assert.equal(arrow.headLength, 18);
  assert.equal(arrow.headHeight, 40);
  assert.equal(arrow.leftRadius, 3);
  assert.equal(arrow.fill, "#2C6E8F");
  assert.match(arrow.path, /^M /);
  assert.match(arrow.path, / Q /);
  assert.match(arrow.path, / L [\d.]+ [\d.]+ L /);
  const svg = serializeKeynoteClassicSvg(rendered);
  assert.match(svg, /<feDropShadow dx="0" dy="1" stdDeviation="1" flood-color="#000000" flood-opacity="\.18"\/>/);
  assert.doesNotMatch(svg, /data-label-plate/);
  assert.doesNotMatch(svg, /class="[^"]*label[^"]*plate/);
  assert.match(svg, /data-arrow-label="inside"/);
});

test("M4 contrast-tests both candidates, prefers passing white, uses passing primary ink, and falls back to bare above text when neither candidate passes", () => {
  const white = chooseArrowLabelTreatment({
    title: "School",
    fill: "#2C6E8F",
    shaftWidth: 300
  });
  assert.equal(white.placement, "inside");
  assert.equal(white.color, "#FFFFFF");
  assert.ok(white.contrast.white >= 4.5);

  const ink = chooseArrowLabelTreatment({
    title: "Research",
    fill: "#C9A227",
    shaftWidth: 300
  });
  assert.equal(ink.placement, "inside");
  assert.equal(ink.color, "#191C21");
  assert.ok(ink.contrast.primaryInk >= 4.5);

  const noCandidate = chooseArrowLabelTreatment({
    title: "USCE",
    fill: "#C8641C",
    shaftWidth: 300
  });
  assert.equal(noCandidate.placement, "above");
  assert.equal(noCandidate.color, "#232B36");
  assert.equal(noCandidate.reason, "no-inside-candidate-passes-aa");
  assert.ok(noCandidate.contrast.white < 4.5);
  assert.ok(noCandidate.contrast.primaryInk < 4.5);

  const tooLong = chooseArrowLabelTreatment({
    title: "A deliberately very long event label that cannot fit",
    fill: "#2C6E8F",
    shaftWidth: 90
  });
  assert.equal(tooLong.placement, "above");
  assert.equal(tooLong.reason, "does-not-fit-shaft-padding");
});

test("M4 uses bare above labels at the exact 4px arrow offset and emits single-line ellipsis metadata without a background", () => {
  const rendered = scene();
  const clinical = rendered.arrows.find(({ id }) => id === "clinical");
  assert.equal(clinical.label.placement, "above");
  assert.equal(clinical.label.y, clinical.centerY - 20 - 4);
  assert.equal(clinical.label.textAnchor, "start");
  assert.equal(clinical.label.color, "#232B36");
  assert.equal(clinical.label.fullText, "US clinical rotations");
  const svg = serializeKeynoteClassicSvg(rendered);
  assert.match(
    svg,
    /<text data-arrow-label="above"[^>]*><title>US clinical rotations<\/title>/
  );
});

test("M4 renders open-ended arrows to the deterministic current month with a 48px fade, no head, and one topmost Present label", () => {
  const rendered = scene();
  const open = rendered.arrows.find(({ id }) => id === "open-work");
  assert.equal(open.openEnded, true);
  assert.equal(open.endMonth, "2026-07");
  assert.equal(open.headLength, 0);
  assert.equal(open.headHeight, open.shaftHeight);
  assert.equal(open.fadeLength, 48);
  assert.equal(open.x2 - open.fadeStartX, 48);
  assert.equal(open.showPresent, true);
  assert.doesNotMatch(open.path, / L [\d.]+ [\d.]+ L /);
  const svg = serializeKeynoteClassicSvg(rendered);
  assert.match(svg, /id="d1-open-fade-[^"]+"/);
  assert.match(svg, /stop-opacity="0"/);
  assert.equal((svg.match(/data-present-label="true"/g) || []).length, 1);
});

test("M4 puts Present on only the visually topmost open arrow", () => {
  const rendered = buildKeynoteClassicScene({
    studentProfile: { fullName: "Open spans" },
    events: [
      event({
        id: "open-near-axis",
        title: "First open role",
        startDate: "2021-01",
        endDate: null,
        openEnded: true
      }),
      event({
        id: "open-topmost",
        title: "Second open role",
        categoryId: "work",
        startDate: "2023-01",
        endDate: null,
        openEnded: true
      })
    ]
  }, { currentMonth: "2026-07" });
  const openArrows = rendered.arrows.filter(({ openEnded }) => openEnded);
  assert.equal(openArrows.filter(({ showPresent }) => showPresent).length, 1);
  const topmost = openArrows.reduce((highest, arrow) =>
    arrow.lane > highest.lane ? arrow : highest
  );
  assert.equal(topmost.id, "open-topmost");
  assert.equal(topmost.showPresent, true);
  assert.equal(
    (serializeKeynoteClassicSvg(rendered).match(/data-present-label="true"/g) || []).length,
    1
  );
});

test("M4 renders study periods with the Exams 45° hatch at 60% and a provisional 1.5px dashed outline", () => {
  const rendered = scene();
  const study = rendered.arrows.find(({ id }) => id === "study-window");
  assert.equal(study.study, true);
  assert.equal(study.provisional, true);
  assert.equal(study.label.placement, "above");
  assert.equal(study.label.reason, "patterned-fill-requires-bare-above-label");
  const svg = serializeKeynoteClassicSvg(rendered);
  assert.match(svg, /patternTransform="rotate\(45\)"/);
  assert.match(svg, /stroke="#3A78C9" stroke-width="3" stroke-opacity="\.6"/);
  assert.match(
    svg,
    /data-event-id="study-window"[\s\S]*?stroke="#3A78C9" stroke-width="1\.5" stroke-dasharray="8 6"/
  );
});

test("M4 renders canonical white T1 flag plates on 1.5px axis-planted poles and alternates overlapping flag heights 34/52", () => {
  const rendered = scene();
  const first = rendered.flags.find(({ id }) => id === "step-2");
  const second = rendered.flags.find(({ id }) => id === "publication");
  assert.deepEqual([first.height, second.height], [34, 52]);
  for (const flag of [first, second]) {
    assert.equal(flag.pole.y2, 734.4);
    assert.equal(flag.pole.width, 1.5);
    assert.equal(flag.plate.height, 24);
    assert.equal(flag.plate.radius, 6);
    assert.equal(flag.plate.fill, "#FFFFFF");
    assert.equal(flag.plate.border, "#C6CFDB");
    assert.equal(flag.plate.borderWidth, 1);
  }
  const svg = serializeKeynoteClassicSvg(rendered);
  assert.equal((svg.match(/data-flag-plate="true"/g) || []).length, 3);
});

test("M4 renders the interview marker below the axis and includes it in accessible scene metadata", () => {
  const rendered = scene();
  assert.equal(rendered.interviewMarker.month, "2025-09");
  assert.equal(rendered.interviewMarker.pole.y1, 734.4);
  assert.ok(rendered.interviewMarker.plate.y > 734.4);
  assert.equal(rendered.interviewMarker.label.text, "Interview season");
  assert.equal(
    rendered.accessibility.interviewMarkerLabel,
    "Interview season, Sep 2025"
  );
  const svg = serializeKeynoteClassicSvg(rendered);
  assert.match(svg, /data-event-kind="interview-marker"/);
  assert.match(svg, />Interview season<\/text>/);
});

test("M4 defaults to Interview-safe, excludes advisor-only items before layout, and Everything includes them", () => {
  const safe = scene();
  assert.equal(safe.audience.mode, "INTERVIEWER_SAFE");
  assert.deepEqual(safe.audience.excludedAdvisorOnlyIds, ["advisor-only"]);
  assert.equal(safe.events.some(({ id }) => id === "advisor-only"), false);
  assert.equal(safe.accessibility.eventLabels["advisor-only"], undefined);

  const everything = scene({ audience: "EVERYTHING" });
  assert.equal(everything.audience.mode, "EVERYTHING");
  assert.deepEqual(everything.audience.excludedAdvisorOnlyIds, []);
  assert.equal(everything.events.some(({ id }) => id === "advisor-only"), true);
});

test("M4 exposes application/event accessibility metadata, chronological tab order, category/date labels, and SVG title/description", () => {
  const rendered = scene();
  assert.equal(rendered.accessibility.role, "application");
  assert.equal(
    rendered.accessibility.ariaLabel,
    "Timeline visualization, 7 events; use Tab to move between events"
  );
  assert.equal(rendered.accessibility.tabOrder[0], "medical-school");
  assert.match(
    rendered.accessibility.eventLabels["medical-school"],
    /Medical school, Education, Jan 2021 to Dec 2022/
  );
  assert.match(
    rendered.accessibility.eventLabels["step-2"],
    /Step 2 CK · 254, Exams, Jun 2024/
  );
  const svg = serializeKeynoteClassicSvg(rendered);
  assert.match(svg, /role="img" aria-labelledby="d1-keynote-classic-title d1-keynote-classic-description"/);
  assert.match(svg, /<title id="d1-keynote-classic-title">Timeline visualization, 7 events; use Tab to move between events<\/title>/);
  assert.match(svg, /<desc id="d1-keynote-classic-description">/);
  assert.match(svg, /viewBox="0 0 1920 1080" width="1920" height="1080"/);
});

test("M4 scene/SVG rendering is pure and byte-deterministic for the same document and options", () => {
  const timeline = representativeTimeline();
  const before = structuredClone(timeline);
  const first = renderKeynoteClassicBoard(timeline, { currentMonth: "2026-07" });
  const second = renderKeynoteClassicBoard(timeline, { currentMonth: "2026-07" });
  assert.deepEqual(timeline, before, "renderer must not mutate the source timeline");
  assert.deepEqual(second.scene, first.scene);
  assert.equal(second.svg, first.svg);
});

test("M4 explicitly isolates the founder-visible N<4 adaptive allocation contradiction without inventing widths", () => {
  assert.throws(
    () => buildKeynoteClassicScene({
      studentProfile: { fullName: "Short span" },
      events: [
        event({
          id: "short-span",
          startDate: "2024-01",
          endDate: "2024-12"
        })
      ]
    }, { currentMonth: "2026-07" }),
    (error) => {
      assert.equal(error.name, "BoardRenderIsolationError");
      assert.equal(
        error.code,
        "D1_UXR_002_M4_ISOLATED_N_LT_4_YEAR_WIDTH_CONTRADICTION"
      );
      assert.equal(error.isolated, true);
      assert.equal(error.details.normalYearSegmentCount, 3);
      return true;
    }
  );
});

test("M4 explicitly isolates a computed duration width smaller than the frozen 18px head without widening or changing dates", () => {
  const events = [
    event({
      id: "one-month",
      title: "One month",
      startDate: "2019-01",
      endDate: "2019-01"
    }),
    ...Array.from({ length: 12 }, (_, index) => event({
      id: `dense-${index}`,
      title: `Dense ${index}`,
      categoryId: index % 2 ? "research" : "work",
      startDate: "2026-01",
      endDate: "2026-12"
    }))
  ];
  assert.throws(
    () => buildKeynoteClassicScene(
      { studentProfile: { fullName: "Dense span" }, events },
      { currentMonth: "2026-07" }
    ),
    (error) => {
      assert.equal(error.name, "BoardRenderIsolationError");
      assert.equal(error.code, "D1_UXR_002_M4_ISOLATED_DURATION_WIDTH_LT_ARROW_HEAD");
      assert.equal(error.isolated, true);
      assert.equal(error.details.eventId, "one-month");
      assert.ok(error.details.visualWidth < 18);
      assert.equal(error.details.frozenHeadLength, 18);
      return true;
    }
  );
});
