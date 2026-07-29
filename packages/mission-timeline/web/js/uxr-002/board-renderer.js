import {
  CATEGORY_DEFINITIONS,
  allocateAdaptiveYearWidths,
  assignStableLanes,
  condensedMetrics,
  deriveTimelineSpan,
  eventDensityForYear,
  monthPositionInSegments,
  placeAlternatingFlags,
  tickModeForYear
} from "./adaptive-layout.js";
import {
  addMonths,
  contrastRatio,
  formatMonth,
  monthIndex,
  parseMonth
} from "./utils.js";

const freeze = (value) => Object.freeze(value);

export const KEYNOTE_BOARD_GEOMETRY = freeze({
  width: 1920,
  height: 1080,
  margin: 96,
  innerWidth: 1728,
  axisRatio: 0.68,
  axisY: 734.4,
  arrow: freeze({
    shaftHeight: 28,
    condensedShaftHeight: 22,
    headLength: 18,
    headHeight: 40,
    leftRadius: 3,
    labelPadding: 8,
    openFadeLength: 48
  }),
  flag: freeze({
    standardHeight: 34,
    alternateHeight: 52,
    plateHeight: 24,
    plateRadius: 6,
    poleWidth: 1.5
  })
});

/*
 * These are implementation-only spacing tokens. The Design Freeze fixes lane
 * assignment and condensed-row metrics, but not the vertical pitch or the
 * clearance between the top event lane and axis-planted flags.
 */
export const KEYNOTE_LANE_SPACING_TOKENS = freeze({
  standard: freeze({
    pitch: 64,
    axisClearance: 52
  }),
  condensed: freeze({
    pitch: 44,
    axisClearance: 52
  })
});

const categoryColors = Object.fromEntries(
  CATEGORY_DEFINITIONS.map(({ id, color }) => [id, color])
);

export const KEYNOTE_CLASSIC_THEME = freeze({
  id: "keynote-classic",
  name: "Keynote Classic",
  descriptor: "The original, perfected.",
  fontFamily: "Inter, sans-serif",
  board: freeze({
    kind: "linear-gradient",
    angle: 165,
    start: "#F5F7FB",
    end: "#E9EEF6"
  }),
  axis: freeze({ color: "#2A3442", width: 2 }),
  ticks: freeze({ color: "#8B98AA" }),
  yearLabel: freeze({ color: "#2A3442", fontSize: 20, fontWeight: 700 }),
  ink: "#232B36",
  primaryInk: "#191C21",
  categories: freeze({ ...categoryColors }),
  flagPlate: freeze({
    fill: "#FFFFFF",
    border: "#C6CFDB",
    borderWidth: 1,
    ink: "#232B36"
  }),
  arrowShadow: "0 1px 2px rgba(0,0,0,.18)",
  headline: freeze({ color: "#232B36", fontSize: 24, fontWeight: 700 })
});

const WHITE = "#FFFFFF";
const MINIMUM_TEXT_CONTRAST = 4.5;
const SVG_BACKGROUND_GRADIENT_ID = "d1-keynote-classic-board";
const SVG_ARROW_SHADOW_ID = "d1-keynote-classic-arrow-shadow";
const SVG_STUDY_PATTERN_ID = "d1-keynote-classic-study-hatch";

function isolationError(code, message, details) {
  const error = new RangeError(message);
  error.name = "BoardRenderIsolationError";
  error.code = code;
  error.isolated = true;
  error.branch = "D1_UXR_002_M4_BOARD_RENDERER";
  error.details = freeze({ ...details });
  return error;
}

function assertCurrentMonth(value) {
  const normalized = parseMonth(value);
  if (!normalized) {
    throw new TypeError(
      "renderKeynoteClassicBoard requires a deterministic currentMonth as YYYY-MM."
    );
  }
  return normalized;
}

function isMilestone(event) {
  const kind = String(event?.eventType ?? event?.kind ?? event?.type ?? "").toLowerCase();
  return kind === "milestone";
}

function isStudyPeriod(event) {
  const kind = String(event?.eventType ?? event?.kind ?? event?.type ?? "").toLowerCase();
  const source = String(event?.sourceType ?? "").toLowerCase();
  return Boolean(
    event?.isStudyPeriod ||
    event?.studyPeriod ||
    event?.fields?.isStudyPeriod ||
    kind === "study" ||
    kind === "study-period" ||
    source === "auto-study-period" ||
    source === "study-period"
  );
}

function isProvisional(event) {
  return Boolean(
    event?.provisional ||
    event?.isProvisional ||
    event?.fields?.provisional ||
    event?.fields?.retakeDatePending
  );
}

function eventStart(event) {
  return parseMonth(event?.startDate ?? event?.date ?? event?.startMonth);
}

function eventEnd(event) {
  return parseMonth(event?.endDate ?? event?.endMonth);
}

function audienceEvents(events, audience) {
  const normalized = String(audience ?? "INTERVIEWER_SAFE").toUpperCase();
  if (normalized !== "INTERVIEWER_SAFE" && normalized !== "EVERYTHING") {
    throw new TypeError("audience must be INTERVIEWER_SAFE or EVERYTHING.");
  }
  const source = Array.isArray(events) ? events : [];
  if (normalized === "EVERYTHING") {
    return { audience: normalized, included: source.slice(), excluded: [] };
  }
  return {
    audience: normalized,
    included: source.filter((event) => event?.visibilityState !== "ADVISOR_ONLY"),
    excluded: source.filter((event) => event?.visibilityState === "ADVISOR_ONLY")
  };
}

function validateRenderableEvents(events) {
  const renderable = [];
  const omitted = [];
  for (const event of events) {
    const start = eventStart(event);
    if (!start) {
      omitted.push({
        id: String(event?.id ?? ""),
        title: String(event?.title ?? "Untitled event"),
        reason: "missing-valid-start-month"
      });
      continue;
    }
    if (event?.id == null || String(event.id).length === 0) {
      throw new TypeError("Every renderable event requires a stable id.");
    }
    if (!categoryColors[event.categoryId]) {
      throw new TypeError(`Unsupported event category: ${String(event.categoryId)}`);
    }
    const explicitEnd = eventEnd(event);
    if (!isMilestone(event) && !event?.openEnded && explicitEnd == null) {
      omitted.push({
        id: String(event.id),
        title: String(event?.title ?? "Untitled event"),
        reason: "missing-valid-end-month"
      });
      continue;
    }
    if (explicitEnd && monthIndex(explicitEnd) < monthIndex(start)) {
      omitted.push({
        id: String(event.id),
        title: String(event?.title ?? "Untitled event"),
        reason: "end-before-start"
      });
      continue;
    }
    renderable.push(event);
  }
  return { renderable, omitted };
}

function yearSegmentsWithDensity(span, events) {
  return span.segments.map((segment) => {
    if (segment.kind !== "year") return { ...segment };
    return {
      ...segment,
      density: eventDensityForYear(events, segment.year, {
        spanEndMonth: span.endMonth
      })
    };
  });
}

function allocateSegments(span, events) {
  const weighted = yearSegmentsWithDensity(span, events);
  try {
    return allocateAdaptiveYearWidths(weighted, {
      innerWidth: KEYNOTE_BOARD_GEOMETRY.innerWidth
    });
  } catch (cause) {
    if (cause?.code === "D1_UXR_002_UNRESOLVED_N_LT_4_YEAR_WIDTH_CONTRADICTION") {
      throw isolationError(
        "D1_UXR_002_M4_ISOLATED_N_LT_4_YEAR_WIDTH_CONTRADICTION",
        "M4 board rendering is isolated: the frozen 28% maximum and exact-sum guarantee cannot both be rendered for fewer than four normal year segments.",
        {
          causeCode: cause.code,
          normalYearSegmentCount: cause.yearSegmentCount,
          innerWidth: KEYNOTE_BOARD_GEOMETRY.innerWidth,
          frozenMaximum: KEYNOTE_BOARD_GEOMETRY.innerWidth * 0.28
        }
      );
    }
    throw cause;
  }
}

function buildAxis(segments) {
  const y = KEYNOTE_BOARD_GEOMETRY.axisY;
  let cursor = KEYNOTE_BOARD_GEOMETRY.margin;
  const positioned = [];
  const boundaries = [];
  const ticks = [];

  boundaries.push({ x: cursor, y1: y - 10, y2: y + 10, edge: "start" });
  for (const segment of segments) {
    const x = cursor;
    const width = segment.width;
    const centerX = x + width / 2;
    const positionedSegment = {
      ...segment,
      x,
      centerX,
      tickMode: segment.kind === "year" ? tickModeForYear(width) : "condensed"
    };
    positioned.push(positionedSegment);

    if (segment.kind === "year") {
      const offsets = positionedSegment.tickMode === "months"
        ? Array.from({ length: 11 }, (_, index) => index + 1)
        : [3, 6, 9];
      for (const monthOffset of offsets) {
        ticks.push({
          year: segment.year,
          monthOffset,
          x: x + (monthOffset / 12) * width,
          y1: y - (monthOffset % 3 === 0 ? 7 : 5),
          y2: y + (monthOffset % 3 === 0 ? 7 : 5),
          kind: monthOffset % 3 === 0 ? "quarter" : "month"
        });
      }
    }

    cursor += width;
    boundaries.push({
      x: cursor,
      y1: y - 10,
      y2: y + 10,
      edge: "boundary"
    });
  }

  if (cursor !== KEYNOTE_BOARD_GEOMETRY.margin + KEYNOTE_BOARD_GEOMETRY.innerWidth) {
    throw new RangeError("M4 renderer invariant: positioned segments do not sum to innerWidth.");
  }

  return {
    x1: KEYNOTE_BOARD_GEOMETRY.margin,
    x2: cursor,
    y,
    segments: positioned,
    boundaries,
    ticks
  };
}

export function estimateInterTextWidth(text, fontSize = 12.5, fontWeight = 600) {
  const source = String(text ?? "");
  let units = 0;
  for (const character of source) {
    if (/\s/.test(character)) units += 0.28;
    else if (/[ilI1|.,:;'!]/.test(character)) units += 0.28;
    else if (/[mwMW@%&]/.test(character)) units += 0.9;
    else if (/[A-Z0-9]/.test(character)) units += 0.62;
    else units += 0.54;
  }
  const weightFactor = Number(fontWeight) >= 650 ? 1.025 : 1;
  return Number((units * Number(fontSize) * weightFactor).toFixed(3));
}

function ellipsize(text, maxWidth, fontSize, fontWeight, measureText) {
  const source = String(text ?? "");
  if (measureText(source, fontSize, fontWeight) <= maxWidth) return source;
  const ellipsis = "…";
  if (measureText(ellipsis, fontSize, fontWeight) > maxWidth) return "";
  let low = 0;
  let high = source.length;
  while (low < high) {
    const middle = Math.ceil((low + high) / 2);
    const candidate = `${source.slice(0, middle).trimEnd()}${ellipsis}`;
    if (measureText(candidate, fontSize, fontWeight) <= maxWidth) low = middle;
    else high = middle - 1;
  }
  return `${source.slice(0, low).trimEnd()}${ellipsis}`;
}

export function chooseArrowLabelTreatment({
  title,
  fill,
  shaftWidth,
  patterned = false,
  condensed = false,
  measureText = estimateInterTextWidth
}) {
  const insideFontSize = condensed ? 11 : 12.5;
  const outsideFontSize = condensed ? 11 : 11.5;
  const fontWeight = 600;
  const textWidth = measureText(String(title ?? ""), insideFontSize, fontWeight);
  const availableInside = Math.max(
    0,
    Number(shaftWidth) - KEYNOTE_BOARD_GEOMETRY.arrow.labelPadding * 2
  );
  const whiteContrast = contrastRatio(WHITE, fill);
  const primaryInkContrast = contrastRatio(KEYNOTE_CLASSIC_THEME.primaryInk, fill);
  const contrastColor = whiteContrast >= MINIMUM_TEXT_CONTRAST
    ? WHITE
    : primaryInkContrast >= MINIMUM_TEXT_CONTRAST
      ? KEYNOTE_CLASSIC_THEME.primaryInk
      : null;
  const fits = textWidth <= availableInside;
  const inside = fits && !patterned && contrastColor !== null;

  return {
    placement: inside ? "inside" : "above",
    color: inside ? contrastColor : KEYNOTE_CLASSIC_THEME.ink,
    fontSize: inside ? insideFontSize : outsideFontSize,
    fontWeight,
    textWidth,
    availableInside,
    contrast: {
      threshold: MINIMUM_TEXT_CONTRAST,
      white: whiteContrast,
      primaryInk: primaryInkContrast,
      chosen: inside ? (contrastColor === WHITE ? whiteContrast : primaryInkContrast) : null
    },
    reason: inside
      ? "fits-and-passes-contrast"
      : patterned
        ? "patterned-fill-requires-bare-above-label"
        : !fits
          ? "does-not-fit-shaft-padding"
          : "no-inside-candidate-passes-aa"
  };
}

function durationGeometry(event, segments, currentMonth) {
  const startMonth = eventStart(event);
  const endMonth = event?.openEnded ? currentMonth : eventEnd(event);
  const x = monthPositionInSegments(startMonth, segments, {
    margin: KEYNOTE_BOARD_GEOMETRY.margin
  });
  const endBoundary = addMonths(endMonth, 1);
  const x2 = monthPositionInSegments(endBoundary, segments, {
    margin: KEYNOTE_BOARD_GEOMETRY.margin
  });
  const width = x2 - x;

  if (width < KEYNOTE_BOARD_GEOMETRY.arrow.headLength) {
    throw isolationError(
      "D1_UXR_002_M4_ISOLATED_DURATION_WIDTH_LT_ARROW_HEAD",
      `M4 arrow rendering is isolated for event "${String(event.title ?? event.id)}": its ${width.toFixed(3)}px visual span is smaller than the frozen 18px arrowhead.`,
      {
        eventId: String(event.id),
        startMonth,
        endMonth,
        visualWidth: width,
        frozenHeadLength: KEYNOTE_BOARD_GEOMETRY.arrow.headLength
      }
    );
  }
  return { x, x2, width, startMonth, endMonth };
}

function roundedArrowPath({ x, x2, centerY, shaftHeight }) {
  const radius = KEYNOTE_BOARD_GEOMETRY.arrow.leftRadius;
  const headLength = KEYNOTE_BOARD_GEOMETRY.arrow.headLength;
  const headHeight = KEYNOTE_BOARD_GEOMETRY.arrow.headHeight;
  const shaftTop = centerY - shaftHeight / 2;
  const shaftBottom = centerY + shaftHeight / 2;
  const headTop = centerY - headHeight / 2;
  const headBottom = centerY + headHeight / 2;
  const headBase = x2 - headLength;
  return [
    `M ${x + radius} ${shaftTop}`,
    `H ${headBase}`,
    `V ${headTop}`,
    `L ${x2} ${centerY}`,
    `L ${headBase} ${headBottom}`,
    `V ${shaftBottom}`,
    `H ${x + radius}`,
    `Q ${x} ${shaftBottom} ${x} ${shaftBottom - radius}`,
    `V ${shaftTop + radius}`,
    `Q ${x} ${shaftTop} ${x + radius} ${shaftTop}`,
    "Z"
  ].join(" ");
}

function openArrowPath({ x, x2, centerY, shaftHeight }) {
  const radius = KEYNOTE_BOARD_GEOMETRY.arrow.leftRadius;
  const top = centerY - shaftHeight / 2;
  const bottom = centerY + shaftHeight / 2;
  return [
    `M ${x + radius} ${top}`,
    `H ${x2}`,
    `V ${bottom}`,
    `H ${x + radius}`,
    `Q ${x} ${bottom} ${x} ${bottom - radius}`,
    `V ${top + radius}`,
    `Q ${x} ${top} ${x + radius} ${top}`,
    "Z"
  ].join(" ");
}

function laneCenter(lane, condensed) {
  const tokens = condensed
    ? KEYNOTE_LANE_SPACING_TOKENS.condensed
    : KEYNOTE_LANE_SPACING_TOKENS.standard;
  return KEYNOTE_BOARD_GEOMETRY.axisY
    - tokens.axisClearance
    - KEYNOTE_BOARD_GEOMETRY.arrow.headHeight / 2
    - lane * tokens.pitch;
}

function safeSvgId(value) {
  const normalized = String(value ?? "event")
    .normalize("NFKD")
    .replace(/[^A-Za-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return normalized || "event";
}

function eventAriaLabel(event, startMonth, endMonth) {
  const category = CATEGORY_DEFINITIONS.find(({ id }) => id === event.categoryId)?.label;
  const title = String(event.title ?? "Untitled event");
  if (isMilestone(event)) {
    return `${title}, ${category}, ${formatMonth(startMonth)}`;
  }
  return `${title}, ${category}, ${formatMonth(startMonth)} to ${
    event?.openEnded ? "Present" : formatMonth(endMonth)
  }`;
}

function buildArrows(events, segments, laneResult, currentMonth, measureText) {
  const metrics = condensedMetrics(laneResult.laneCount);
  const condensed = metrics.condensed;
  const shaftHeight = condensed
    ? metrics.arrowShaftHeight
    : KEYNOTE_BOARD_GEOMETRY.arrow.shaftHeight;
  const arrows = [];

  for (const event of events.filter((candidate) => !isMilestone(candidate))) {
    const geometry = durationGeometry(event, segments, currentMonth);
    const lane = laneResult.laneById[event.id];
    const centerY = laneCenter(lane, condensed);
    const fill = categoryColors[event.categoryId];
    const study = isStudyPeriod(event);
    const openEnded = Boolean(event.openEnded);
    const shaftWidth = openEnded
      ? geometry.width
      : geometry.width - KEYNOTE_BOARD_GEOMETRY.arrow.headLength;
    const label = chooseArrowLabelTreatment({
      title: event.title,
      fill,
      shaftWidth,
      patterned: study,
      condensed,
      measureText
    });
    const availableAbove = Math.max(
      0,
      KEYNOTE_BOARD_GEOMETRY.margin + KEYNOTE_BOARD_GEOMETRY.innerWidth - geometry.x
    );
    const renderedLabel = ellipsize(
      event.title,
      label.placement === "inside" ? label.availableInside : availableAbove,
      label.fontSize,
      label.fontWeight,
      measureText
    );

    arrows.push({
      kind: "arrow",
      id: String(event.id),
      title: String(event.title),
      categoryId: event.categoryId,
      fill,
      lane,
      condensed,
      study,
      provisional: study && isProvisional(event),
      actionChip:event?.actionChip?{...event.actionChip}:null,
      openEnded,
      startMonth: geometry.startMonth,
      endMonth: geometry.endMonth,
      x: geometry.x,
      x2: geometry.x2,
      width: geometry.width,
      centerY,
      shaftHeight,
      headLength: openEnded ? 0 : KEYNOTE_BOARD_GEOMETRY.arrow.headLength,
      headHeight: openEnded ? shaftHeight : KEYNOTE_BOARD_GEOMETRY.arrow.headHeight,
      leftRadius: KEYNOTE_BOARD_GEOMETRY.arrow.leftRadius,
      path: openEnded
        ? openArrowPath({ ...geometry, centerY, shaftHeight })
        : roundedArrowPath({ ...geometry, centerY, shaftHeight }),
      fadeLength: openEnded ? KEYNOTE_BOARD_GEOMETRY.arrow.openFadeLength : 0,
      fadeStartX: openEnded
        ? geometry.x2 - KEYNOTE_BOARD_GEOMETRY.arrow.openFadeLength
        : null,
      showPresent: false,
      label: {
        ...label,
        fullText: String(event.title),
        text: renderedLabel,
        x: label.placement === "inside"
          ? geometry.x + shaftWidth / 2
          : geometry.x,
        y: label.placement === "inside"
          ? centerY + label.fontSize * 0.34
          : centerY - (
            openEnded
              ? shaftHeight
              : KEYNOTE_BOARD_GEOMETRY.arrow.headHeight
          ) / 2 - 4,
        textAnchor: label.placement === "inside" ? "middle" : "start"
      },
      ariaLabel: eventAriaLabel(event, geometry.startMonth, geometry.endMonth)
    });
  }
  const topmostOpenArrow = arrows
    .filter((arrow) => arrow.openEnded)
    .sort((left, right) => right.lane - left.lane || left.x - right.x)[0];
  if (topmostOpenArrow) topmostOpenArrow.showPresent = true;
  return { arrows, condensed, laneCount: laneResult.laneCount };
}

function flagPlateWidth(title, measureText) {
  return Math.min(260, Math.max(64, measureText(title, 12.5, 600) + 20));
}

function buildFlags(events, segments, measureText) {
  const milestones = events.filter(isMilestone);
  const heights = new Map(
    placeAlternatingFlags(milestones).map(({ id, height }) => [id, height])
  );
  const minX = KEYNOTE_BOARD_GEOMETRY.margin;
  const maxX = KEYNOTE_BOARD_GEOMETRY.margin + KEYNOTE_BOARD_GEOMETRY.innerWidth;
  return milestones.map((event) => {
    const month = eventStart(event);
    const anchorX = monthPositionInSegments(month, segments, {
      margin: KEYNOTE_BOARD_GEOMETRY.margin
    });
    const height = heights.get(event.id) ?? KEYNOTE_BOARD_GEOMETRY.flag.standardHeight;
    const plateHeight = KEYNOTE_BOARD_GEOMETRY.flag.plateHeight;
    const plateWidth = flagPlateWidth(String(event.title), measureText);
    const plateX = Math.min(
      maxX - plateWidth,
      Math.max(minX, anchorX - plateWidth / 2)
    );
    const plateY = KEYNOTE_BOARD_GEOMETRY.axisY - height;
    const text = ellipsize(String(event.title), plateWidth - 16, 12.5, 600, measureText);
    return {
      kind: "flag",
      id: String(event.id),
      title: String(event.title),
      categoryId: event.categoryId,
      anchorX,
      height,
      pole: {
        x: anchorX,
        y1: plateY + plateHeight,
        y2: KEYNOTE_BOARD_GEOMETRY.axisY,
        width: KEYNOTE_BOARD_GEOMETRY.flag.poleWidth,
        color: categoryColors[event.categoryId]
      },
      plate: {
        x: plateX,
        y: plateY,
        width: plateWidth,
        height: plateHeight,
        radius: KEYNOTE_BOARD_GEOMETRY.flag.plateRadius,
        fill: KEYNOTE_CLASSIC_THEME.flagPlate.fill,
        border: KEYNOTE_CLASSIC_THEME.flagPlate.border,
        borderWidth: KEYNOTE_CLASSIC_THEME.flagPlate.borderWidth
      },
      label: {
        fullText: String(event.title),
        text,
        x: plateX + plateWidth / 2,
        y: plateY + plateHeight / 2 + 4.25,
        color: KEYNOTE_CLASSIC_THEME.flagPlate.ink,
        fontSize: 12.5,
        fontWeight: 600
      },
      month,
      dangerDot:!!event.dangerDot,
      ariaLabel: eventAriaLabel(event, month, month)
    };
  });
}

function buildInterviewMarker(interviewMonth, segments) {
  const normalized = parseMonth(interviewMonth);
  if (!normalized) return null;
  const anchorX = monthPositionInSegments(normalized, segments, {
    margin: KEYNOTE_BOARD_GEOMETRY.margin
  });
  const width = 132;
  const height = 28;
  const plateY = KEYNOTE_BOARD_GEOMETRY.axisY + 68;
  const minX = KEYNOTE_BOARD_GEOMETRY.margin;
  const maxX = KEYNOTE_BOARD_GEOMETRY.margin + KEYNOTE_BOARD_GEOMETRY.innerWidth;
  const plateX = Math.min(maxX - width, Math.max(minX, anchorX - width / 2));
  return {
    kind: "interview-marker",
    month: normalized,
    anchorX,
    pole: {
      x: anchorX,
      y1: KEYNOTE_BOARD_GEOMETRY.axisY,
      y2: plateY,
      width: KEYNOTE_BOARD_GEOMETRY.flag.poleWidth,
      color: KEYNOTE_CLASSIC_THEME.axis.color
    },
    plate: {
      x: plateX,
      y: plateY,
      width,
      height,
      radius: KEYNOTE_BOARD_GEOMETRY.flag.plateRadius,
      fill: KEYNOTE_CLASSIC_THEME.flagPlate.fill,
      border: KEYNOTE_CLASSIC_THEME.flagPlate.border,
      borderWidth: KEYNOTE_CLASSIC_THEME.flagPlate.borderWidth
    },
    label: {
      text: "Interview season",
      x: plateX + width / 2,
      y: plateY + height / 2 + 4.25,
      color: KEYNOTE_CLASSIC_THEME.ink,
      fontSize: 12.5,
      fontWeight: 600
    },
    ariaLabel: `Interview season, ${formatMonth(normalized)}`
  };
}

function chronologicalIds(events) {
  return events
    .map((event, index) => ({
      id: String(event.id),
      index,
      month: monthIndex(eventStart(event))
    }))
    .sort((left, right) => left.month - right.month || left.index - right.index)
    .map(({ id }) => id);
}

export function buildKeynoteClassicScene(
  timeline,
  {
    currentMonth,
    interviewMonth = timeline?.studentProfile?.interviewSeason ?? null,
    audience = "INTERVIEWER_SAFE",
    previousLaneById = {},
    measureText = estimateInterTextWidth
  } = {}
) {
  const normalizedCurrent = assertCurrentMonth(currentMonth);
  if (typeof measureText !== "function") {
    throw new TypeError("measureText must be a deterministic function.");
  }
  const filtered = audienceEvents(timeline?.events, audience);
  const validated = validateRenderableEvents(filtered.included);
  const span = deriveTimelineSpan(validated.renderable, {
    currentMonth: normalizedCurrent,
    interviewMonth
  });
  const segments = allocateSegments(span, validated.renderable);
  const axis = buildAxis(segments);
  const laneResult = assignStableLanes(validated.renderable, { previousLaneById });
  const arrowResult = buildArrows(
    validated.renderable,
    segments,
    laneResult,
    normalizedCurrent,
    measureText
  );
  const flags = buildFlags(validated.renderable, segments, measureText);
  const events = [...arrowResult.arrows, ...flags];
  const interviewMarker = buildInterviewMarker(interviewMonth, segments);
  const fullName = String(timeline?.studentProfile?.fullName || "Your journey");
  const firstYear = segments[0]?.startYear ?? segments[0]?.year;
  const lastYear = segments.at(-1)?.year ?? segments.at(-1)?.endYear;
  const ariaLabel = `Timeline canvas, ${events.length} events; use Tab to move between events`;

  return {
    renderer: "D1-UXR-002-Keynote-Classic",
    theme: KEYNOTE_CLASSIC_THEME,
    board: {
      width: KEYNOTE_BOARD_GEOMETRY.width,
      height: KEYNOTE_BOARD_GEOMETRY.height,
      margin: KEYNOTE_BOARD_GEOMETRY.margin,
      innerWidth: KEYNOTE_BOARD_GEOMETRY.innerWidth,
      background: KEYNOTE_CLASSIC_THEME.board
    },
    headline: {
      text: fullName,
      x: KEYNOTE_BOARD_GEOMETRY.margin,
      y: 88,
      ...KEYNOTE_CLASSIC_THEME.headline
    },
    span: {
      startMonth: span.startMonth,
      endMonth: span.endMonth,
      firstYear,
      lastYear
    },
    axis,
    laneLayout: {
      laneCount: arrowResult.laneCount,
      condensed: arrowResult.condensed,
      spacingTokens: arrowResult.condensed
        ? KEYNOTE_LANE_SPACING_TOKENS.condensed
        : KEYNOTE_LANE_SPACING_TOKENS.standard
    },
    arrows: arrowResult.arrows,
    flags,
    events,
    interviewMarker,
    omissions: validated.omitted,
    audience: {
      mode: filtered.audience,
      excludedAdvisorOnlyIds: filtered.excluded.map((event) => String(event?.id ?? ""))
    },
    accessibility: {
      role: "application",
      ariaLabel,
      description: `${fullName}'s ${firstYear}–${lastYear} timeline in Keynote Classic.`,
      tabOrder: chronologicalIds(validated.renderable),
      eventLabels: Object.fromEntries(events.map((event) => [event.id, event.ariaLabel])),
      interviewMarkerLabel: interviewMarker?.ariaLabel ?? null
    }
  };
}

function xmlEscape(value) {
  return String(value ?? "").replace(
    /[&<>"']/g,
    (character) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&apos;"
    })[character]
  );
}

function number(value) {
  const rounded = Math.round(Number(value) * 1000) / 1000;
  return Number.isInteger(rounded) ? String(rounded) : String(rounded);
}

function serializeAxis(axis) {
  const axisStyle=axis.style||KEYNOTE_CLASSIC_THEME.axis;
  const tickStyle=axis.tickStyle||KEYNOTE_CLASSIC_THEME.ticks;
  const yearLabelStyle=axis.yearLabelStyle||KEYNOTE_CLASSIC_THEME.yearLabel;
  const segmentLabels = axis.segments.map((segment) => {
    const label = segment.kind === "condensed" ? segment.label : String(segment.year);
    const title = segment.kind === "condensed"
      ? `<title>${xmlEscape(segment.tooltip)}</title>`
      : "";
    const style=segment.yearLabelStyle||yearLabelStyle;
    return `<g data-segment-kind="${segment.kind}" data-segment-width="${number(segment.width)}">${title}<text x="${number(segment.centerX)}" y="${number(axis.y + 42)}" text-anchor="middle" fill="${style.color}" font-family="${style.fontFamily||KEYNOTE_CLASSIC_THEME.fontFamily}" font-size="${style.fontSize}" font-weight="${style.fontWeight}" letter-spacing="${style.letterSpacing||"0"}" font-variant-numeric="tabular-nums">${xmlEscape(label)}</text></g>`;
  }).join("");
  const ticks = axis.ticks.map((tick) =>
    `<line data-tick-kind="${tick.kind}" x1="${number(tick.x)}" y1="${number(tick.y1)}" x2="${number(tick.x)}" y2="${number(tick.y2)}" stroke="${tick.color||tickStyle.color}" stroke-width="1"/>`
  ).join("");
  const boundaries = axis.boundaries.map((boundary) =>
    `<line data-tick-kind="year-boundary" x1="${number(boundary.x)}" y1="${number(boundary.y1)}" x2="${number(boundary.x)}" y2="${number(boundary.y2)}" stroke="${boundary.color||axisStyle.color}" stroke-width="${axisStyle.width}" stroke-linecap="${boundary.lineCap||axisStyle.lineCap||"butt"}"/>`
  ).join("");
  const serifHeight=Number(axisStyle.endSerifHeight)||0;
  const serifs=serifHeight?`<line data-axis-serif="start" x1="${number(axis.x1)}" y1="${number(axis.y-serifHeight/2)}" x2="${number(axis.x1)}" y2="${number(axis.y+serifHeight/2)}" stroke="${axisStyle.color}" stroke-width="${axisStyle.width}"/><line data-axis-serif="end" x1="${number(axis.x2)}" y1="${number(axis.y-serifHeight/2)}" x2="${number(axis.x2)}" y2="${number(axis.y+serifHeight/2)}" stroke="${axisStyle.color}" stroke-width="${axisStyle.width}"/>`:"";
  return `<g data-layer="axis"><line x1="${number(axis.x1)}" y1="${number(axis.y)}" x2="${number(axis.x2)}" y2="${number(axis.y)}" stroke="${axisStyle.color}" stroke-width="${axisStyle.width}" stroke-linecap="${axisStyle.lineCap||"butt"}"/>${ticks}${boundaries}${serifs}${segmentLabels}</g>`;
}

function serializeArrow(arrow, index,theme) {
  const renderId = `${index}-${safeSvgId(arrow.id)}`;
  const fill = arrow.study
    ? `url(#${SVG_STUDY_PATTERN_ID})`
    : arrow.openEnded
      ? `url(#d1-open-fade-${renderId})`
      : arrow.fill;
  const stroke = arrow.provisional ? KEYNOTE_CLASSIC_THEME.categories.exams : "none";
  const strokeWidth = arrow.provisional ? "1.5" : "0";
  const strokeDash = arrow.provisional ? ' stroke-dasharray="8 6"' : "";
  const label = `<text data-arrow-label="${arrow.label.placement}" x="${number(arrow.label.x)}" y="${number(arrow.label.y)}" text-anchor="${arrow.label.textAnchor}" fill="${arrow.label.color}" font-family="${arrow.label.fontFamily||KEYNOTE_CLASSIC_THEME.fontFamily}" font-size="${arrow.label.fontSize}" font-weight="${arrow.label.fontWeight}"><title>${xmlEscape(arrow.label.fullText)}</title>${xmlEscape(arrow.label.text)}</text>`;
  const present = arrow.showPresent
    ? `<text data-present-label="true" x="${number(arrow.x2)}" y="${number(arrow.centerY + arrow.shaftHeight / 2 + 16)}" text-anchor="end" fill="${theme?.ink||KEYNOTE_CLASSIC_THEME.ink}" fill-opacity=".6" font-family="${KEYNOTE_CLASSIC_THEME.fontFamily}" font-size="10.5" font-weight="600">Present</text>`
    : "";
  const chip=arrow.actionChip?`<g data-study-action-chip="${xmlEscape(arrow.actionChip.targetAttemptId||"")}" transform="translate(${number(Math.max(arrow.x,arrow.x2-122))} ${number(arrow.centerY+arrow.shaftHeight/2+8)})"><rect width="122" height="26" rx="13" fill="#B98A2E" stroke="#A67A26"/><text x="61" y="17" text-anchor="middle" fill="#191C21" font-family="${KEYNOTE_CLASSIC_THEME.fontFamily}" font-size="10.5" font-weight="600">${xmlEscape(arrow.actionChip.label||"Set retake date")}</text></g>`:"";
  const shadowEnabled=arrow.arrowShadow?.enabled??theme?.arrowShadow?.enabled??true;
  const filter=shadowEnabled?` filter="url(#${SVG_ARROW_SHADOW_ID})"`:"";
  return `<g data-event-kind="arrow" data-event-id="${xmlEscape(arrow.id)}" data-category="${arrow.categoryId}" data-open-ended="${arrow.openEnded}" data-study="${arrow.study}" aria-label="${xmlEscape(arrow.ariaLabel)}"><path d="${arrow.path}" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}"${strokeDash}${filter}/>${label}${present}${chip}</g>`;
}

function serializeFlag(flag) {
  const dot=flag.dangerDot?`<circle data-failed-attempt-dot="true" cx="${number(flag.plate.x+flag.plate.width-6)}" cy="${number(flag.plate.y+6)}" r="3" fill="#C4453B"/>`:"";
  return `<g data-event-kind="flag" data-event-id="${xmlEscape(flag.id)}" data-category="${flag.categoryId}" aria-label="${xmlEscape(flag.ariaLabel)}"><line x1="${number(flag.pole.x)}" y1="${number(flag.pole.y1)}" x2="${number(flag.pole.x)}" y2="${number(flag.pole.y2)}" stroke="${flag.pole.color}" stroke-width="${flag.pole.width}"/><rect data-flag-plate="true" data-flag-shape="${flag.plate.shape||"plate"}" x="${number(flag.plate.x)}" y="${number(flag.plate.y)}" width="${number(flag.plate.width)}" height="${number(flag.plate.height)}" rx="${flag.plate.radius}" fill="${flag.plate.fill}" stroke="${flag.plate.border}" stroke-width="${flag.plate.borderWidth}"/>${dot}<text x="${number(flag.label.x)}" y="${number(flag.label.y)}" text-anchor="middle" fill="${flag.label.color}" font-family="${KEYNOTE_CLASSIC_THEME.fontFamily}" font-size="${flag.label.fontSize}" font-weight="${flag.label.fontWeight}"><title>${xmlEscape(flag.label.fullText)}</title>${xmlEscape(flag.label.text)}</text></g>`;
}

function serializeInterviewMarker(marker) {
  if (!marker) return "";
  return `<g data-event-kind="interview-marker" aria-label="${xmlEscape(marker.ariaLabel)}"><line x1="${number(marker.pole.x)}" y1="${number(marker.pole.y1)}" x2="${number(marker.pole.x)}" y2="${number(marker.pole.y2)}" stroke="${marker.pole.color}" stroke-width="${marker.pole.width}"/><rect data-flag-plate="true" x="${number(marker.plate.x)}" y="${number(marker.plate.y)}" width="${number(marker.plate.width)}" height="${number(marker.plate.height)}" rx="${marker.plate.radius}" fill="${marker.plate.fill}" stroke="${marker.plate.border}" stroke-width="${marker.plate.borderWidth}"/><text x="${number(marker.label.x)}" y="${number(marker.label.y)}" text-anchor="middle" fill="${marker.label.color}" font-family="${KEYNOTE_CLASSIC_THEME.fontFamily}" font-size="${marker.label.fontSize}" font-weight="${marker.label.fontWeight}">${xmlEscape(marker.label.text)}</text></g>`;
}

function serializeOpenFadeDefinitions(arrows) {
  return arrows
    .map((arrow, index) => ({ arrow, index }))
    .filter(({ arrow }) => arrow.openEnded)
    .map(({ arrow, index }) => {
      const renderId = `${index}-${safeSvgId(arrow.id)}`;
      return `<linearGradient id="d1-open-fade-${renderId}" gradientUnits="userSpaceOnUse" x1="${number(arrow.fadeStartX)}" y1="0" x2="${number(arrow.x2)}" y2="0"><stop offset="0" stop-color="${arrow.fill}" stop-opacity="1"/><stop offset="1" stop-color="${arrow.fill}" stop-opacity="0"/></linearGradient>`;
    }).join("");
}

function svgBackground(theme){
  const board=theme?.board||KEYNOTE_CLASSIC_THEME.board;
  if(board.kind==="flat"){
    return{definition:"",fill:board.color};
  }
  if(board.kind==="radial-gradient"){
    return{
      definition:`<radialGradient id="${SVG_BACKGROUND_GRADIENT_ID}" cx="50%" cy="30%" r="70%"><stop offset="0" stop-color="${board.start}"/><stop offset="1" stop-color="${board.end}"/></radialGradient>`,
      fill:`url(#${SVG_BACKGROUND_GRADIENT_ID})`
    };
  }
  if(board.kind==="horizon-band"){
    return{
      definition:`<linearGradient id="${SVG_BACKGROUND_GRADIENT_ID}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${board.band.start}"/><stop offset=".26" stop-color="${board.color}"/><stop offset="1" stop-color="${board.color}"/></linearGradient>`,
      fill:`url(#${SVG_BACKGROUND_GRADIENT_ID})`
    };
  }
  return{
    definition:`<linearGradient id="${SVG_BACKGROUND_GRADIENT_ID}" gradientUnits="objectBoundingBox" x1="24.118%" y1="1.704%" x2="75.882%" y2="98.296%"><stop offset="0" stop-color="${board.start}"/><stop offset="1" stop-color="${board.end}"/></linearGradient>`,
    fill:`url(#${SVG_BACKGROUND_GRADIENT_ID})`
  };
}

function svgShadow(theme){
  const value=theme?.arrowShadow;
  if(value&&typeof value==="object"&&!value.enabled)return"";
  const soft=value&&typeof value==="object"&&String(value.value||"").includes("rgba(40,70,90,.15)");
  return soft
    ?`<filter id="${SVG_ARROW_SHADOW_ID}" x="-10%" y="-20%" width="120%" height="150%"><feDropShadow dx="0" dy="1" stdDeviation="1.5" flood-color="#28465A" flood-opacity=".15"/></filter>`
    :`<filter id="${SVG_ARROW_SHADOW_ID}" x="-10%" y="-20%" width="120%" height="150%"><feDropShadow dx="0" dy="1" stdDeviation="1" flood-color="#000000" flood-opacity=".18"/></filter>`;
}

export function serializeKeynoteClassicSvg(scene) {
  if (
    scene?.board?.width !== KEYNOTE_BOARD_GEOMETRY.width ||
    scene?.board?.height !== KEYNOTE_BOARD_GEOMETRY.height
  ) {
    throw new TypeError("serializeKeynoteClassicSvg requires a Keynote Classic scene.");
  }
  const titleId = "d1-keynote-classic-title";
  const descriptionId = "d1-keynote-classic-description";
  const theme=scene.theme||KEYNOTE_CLASSIC_THEME;
  const background=svgBackground(theme);
  const openFades = serializeOpenFadeDefinitions(scene.arrows);
  const arrows = scene.arrows.map((arrow,index)=>serializeArrow(arrow,index,theme)).join("");
  const flags = scene.flags.map(serializeFlag).join("");
  const headlineRule=scene.headline.rule?`<line data-headline-rule="true" x1="${number(scene.headline.x)}" y1="${number(scene.headline.y+10)}" x2="${number(scene.headline.x+scene.headline.rule.width)}" y2="${number(scene.headline.y+10)}" stroke="${scene.headline.rule.color}" stroke-width="3"/>`:"";
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1920 1080" width="1920" height="1080" role="img" aria-labelledby="${titleId} ${descriptionId}" data-renderer="${scene.renderer}" data-theme="${theme.id}"><title id="${titleId}">${xmlEscape(scene.accessibility.ariaLabel)}</title><desc id="${descriptionId}">${xmlEscape(scene.accessibility.description)}</desc><defs>${background.definition}${svgShadow(theme)}<pattern id="${SVG_STUDY_PATTERN_ID}" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="8" stroke="${theme.categories?.exams||KEYNOTE_CLASSIC_THEME.categories.exams}" stroke-width="3" stroke-opacity=".6"/></pattern>${openFades}</defs><rect data-board-background="true" width="1920" height="1080" fill="${background.fill}"/><text data-board-headline="true" x="${number(scene.headline.x)}" y="${number(scene.headline.y)}" fill="${scene.headline.color}" font-family="${scene.headline.fontFamily||KEYNOTE_CLASSIC_THEME.fontFamily}" font-size="${scene.headline.fontSize}" font-weight="${scene.headline.fontWeight}">${xmlEscape(scene.headline.text)}</text>${headlineRule}${serializeAxis(scene.axis)}<g data-layer="events">${arrows}${flags}</g>${serializeInterviewMarker(scene.interviewMarker)}</svg>`;
}

export function renderKeynoteClassicBoard(timeline, options = {}) {
  const scene = buildKeynoteClassicScene(timeline, options);
  return {
    scene,
    svg: serializeKeynoteClassicSvg(scene)
  };
}
