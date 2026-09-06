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

test("Founder artifact correction freezes the 1920×1080 PowerPoint geometry and exact 407F presentation tokens", () => {
  assert.deepEqual(KEYNOTE_BOARD_GEOMETRY, {
    width: 1920,
    height: 1080,
    margin: 38.4,
    innerWidth: 1843.2,
    axisRatio: 64 / 1080,
    axisY: 64,
    arrow: {
      shaftHeight: 30,
      condensedShaftHeight: 24,
      headLength: 15,
      headHeight: 30,
      leftRadius: 0,
      labelPadding: 10,
      openFadeLength: 0
    },
    flag: {
      standardHeight: 78,
      alternateHeight: 108,
      plateHeight: 24,
      plateRadius: 2,
      poleWidth: 2
    }
  });
  assert.ok(KEYNOTE_BOARD_GEOMETRY.axisY < KEYNOTE_BOARD_GEOMETRY.height * 0.2);
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
    standard: { pitch: 46, axisClearance: 34 },
    condensed: { pitch: 32, axisClearance: 34 }
  });
});

test("Founder artifact correction builds adaptive year segments across the near-full-width 407F axis", () => {
  const rendered = scene();
  assert.equal(rendered.axis.x1, 38.4);
  assert.equal(rendered.axis.x2, 1881.4);
  assert.equal(rendered.axis.y, 64);
  assert.equal(
    rendered.axis.segments.reduce((sum, segment) => sum + segment.width, 0),
    1843
  );
  assert.equal(rendered.axis.segments[0].x, 38.4);
  assert.equal(
    rendered.axis.segments.at(-1).x + rendered.axis.segments.at(-1).width,
    1881.4
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

test("Founder artifact correction renders exact 30px 402A sprite arrows with PowerPoint date composition", () => {
  const rendered = scene();
  const arrow = rendered.arrows.find(({ id }) => id === "medical-school");
  assert.equal(arrow.shaftHeight, 30);
  assert.equal(arrow.headLength, 15);
  assert.equal(arrow.headHeight, 30);
  assert.equal(arrow.leftRadius, 0);
  assert.equal(arrow.fill, "#2C6E8F");
  const svg = serializeKeynoteClassicSvg(rendered);
  assert.match(svg, /\.locked407F-arrow:before[^}]*width:9px/);
  assert.match(svg, /\.locked407F-arrow:after[^}]*width:15px/);
  assert.match(svg, /data-event-id="medical-school"[^>]*--sc:url/);
  assert.match(svg, /<div class="locked407F-ads">Jan 2021<\/div>/);
  assert.match(svg, /<div class="locked407F-ade">Dec 2022<\/div>/);
  assert.match(svg, /<div class="locked407F-al">Medical school<\/div>/);
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

test("Founder artifact correction integrates labels inside the sprite while retaining the contrast decision metadata", () => {
  const rendered = scene();
  const clinical = rendered.arrows.find(({ id }) => id === "clinical");
  assert.equal(clinical.label.placement, "above");
  assert.equal(clinical.label.color, "#232B36");
  assert.equal(clinical.label.fullText, "US clinical rotations");
  const svg = serializeKeynoteClassicSvg(rendered);
  assert.match(
    svg,
    /<div class="locked407F-al">US clinical rotations<\/div>/
  );
});

test("Founder artifact correction renders open-ended spans as solid PowerPoint arrows ending in Present", () => {
  const rendered = scene();
  const open = rendered.arrows.find(({ id }) => id === "open-work");
  assert.equal(open.openEnded, true);
  assert.equal(open.endMonth, "2026-07");
  assert.equal(open.headLength, 15);
  assert.equal(open.headHeight, 30);
  assert.equal(open.fadeLength, 0);
  assert.equal(open.fadeStartX, null);
  assert.equal(open.showPresent, false);
  const svg = serializeKeynoteClassicSvg(rendered);
  assert.doesNotMatch(svg, /id="d1-open-fade-/);
  assert.match(svg, /<div class="locked407F-ade">Present<\/div>/);
});

test("Founder artifact correction labels every open span within its own date composition", () => {
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
  assert.equal(openArrows.filter(({ showPresent }) => showPresent).length, 0);
  assert.equal(
    (serializeKeynoteClassicSvg(rendered).match(/>Present<\/div>/g) || []).length,
    2
  );
});

test("Founder artifact correction keeps study semantics on the exact exam sprite", () => {
  const rendered = scene();
  const study = rendered.arrows.find(({ id }) => id === "study-window");
  assert.equal(study.study, true);
  assert.equal(study.provisional, true);
  assert.equal(study.label.placement, "above");
  assert.equal(study.label.reason, "patterned-fill-requires-bare-above-label");
  const svg = serializeKeynoteClassicSvg(rendered);
  assert.match(svg, /data-event-id="study-window"[^>]*data-study="true"/);
  assert.match(svg, /data-event-id="study-window"[^>]*--ac:#3a78c9/);
  assert.match(svg, /data-event-id="study-window"[^>]*--sc:url/);
});

test("Founder artifact correction renders milestone sprites above the top axis", () => {
  const rendered = scene();
  const first = rendered.flags.find(({ id }) => id === "step-2");
  const second = rendered.flags.find(({ id }) => id === "publication");
  assert.deepEqual([first.height, second.height], [34, 52]);
  for (const flag of [first, second]) {
    assert.equal(flag.pole.y2, 64);
    assert.equal(flag.pole.width, 2);
    assert.equal(flag.plate.height, 24);
    assert.equal(flag.plate.radius, 2);
    assert.equal(flag.plate.fill, "#FFFFFF");
    assert.equal(flag.plate.border, "#C6CFDB");
    assert.equal(flag.plate.borderWidth, 1);
  }
  const svg = serializeKeynoteClassicSvg(rendered);
  assert.equal((svg.match(/data-event-kind="flag"/g) || []).length, 2);
  assert.equal((svg.match(/class="locked407F-fmark"/g) || []).length, 3);
});

test("Founder artifact correction integrates the interview marker into the upper-right logo and ribbon language", () => {
  const rendered = scene();
  assert.equal(rendered.interviewMarker.month, "2025-09");
  assert.equal(rendered.interviewMarker.pole.y1, 64);
  assert.equal(rendered.interviewMarker.label.text, "Interview season");
  assert.equal(
    rendered.accessibility.interviewMarkerLabel,
    "Interview season, Sep 2025"
  );
  const svg = serializeKeynoteClassicSvg(rendered);
  assert.match(svg, /data-event-kind="interview-marker"/);
  assert.match(svg, /data-interview-destination="407f-ribbon"/);
  assert.match(svg, />YOUR BIG INTERVIEW<\/div>/);
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
  assert.match(svg, /role="img" aria-labelledby="d1-locked-407f-title d1-locked-407f-description"/);
  assert.match(svg, /<title id="d1-locked-407f-title">Timeline visualization, 7 events; use Tab to move between events<\/title>/);
  assert.match(svg, /<desc id="d1-locked-407f-description">/);
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

test("D1-405 renders N<4 spans with an exact-sum equal-year fallback", () => {
  const scene = buildKeynoteClassicScene({
    studentProfile: { fullName: "Short span" },
    events: [
      event({
        id: "short-span",
        startDate: "2024-01",
        endDate: "2024-12"
      })
    ]
  }, { currentMonth: "2026-07" });
  assert.equal(scene.axis.segments.length, 3);
  assert.deepEqual(scene.axis.segments.map(({ width }) => width), [615, 614, 614]);
  assert.equal(
    scene.axis.segments.reduce((sum, segment) => sum + segment.width, 0),
    Math.round(KEYNOTE_BOARD_GEOMETRY.innerWidth)
  );
  for (const segment of scene.axis.segments) {
    assert.equal(segment.allocationPolicy, "small-span-exact-sum");
    assert.equal(segment.maximumRelaxed, true);
    assert.equal(segment.frozenMaximum, Math.round(KEYNOTE_BOARD_GEOMETRY.innerWidth) * 0.28);
  }
});

test("Founder artifact correction widens short spans to the canonical 52px sprite minimum without changing dates", () => {
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
  const rendered=buildKeynoteClassicScene(
    { studentProfile: { fullName: "Dense span" }, events },
    { currentMonth: "2026-07" }
  );
  const short=rendered.arrows.find(({id})=>id==="one-month");
  assert.equal(short.startMonth,"2019-01");
  assert.equal(short.endMonth,"2019-01");
  assert.ok(Math.abs(short.width-52)<1e-9);
  assert.match(serializeKeynoteClassicSvg(rendered),/min-width:52px/);
});
