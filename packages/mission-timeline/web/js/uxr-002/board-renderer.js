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
import {
  LOCKED_407F_GEOMETRY,
  locked407FComposition,
  serializeLocked407FArtifact
} from "./locked-407f-artifact.js";

const freeze = (value) => Object.freeze(value);
const ENGINEERING_AXIS_WIDTH=Math.round(
  LOCKED_407F_GEOMETRY.width*
  (1-LOCKED_407F_GEOMETRY.horizontalInsetPercent*2/100)
);

export const KEYNOTE_BOARD_GEOMETRY = freeze({
  width: 1920,
  height: 1080,
  margin: 38.4,
  innerWidth: 1843.2,
  axisRatio: LOCKED_407F_GEOMETRY.axisTop/LOCKED_407F_GEOMETRY.height,
  axisY: LOCKED_407F_GEOMETRY.axisTop,
  arrow: freeze({
    shaftHeight: LOCKED_407F_GEOMETRY.arrowHeight,
    condensedShaftHeight: 24,
    headLength: LOCKED_407F_GEOMETRY.headWidth,
    headHeight: LOCKED_407F_GEOMETRY.arrowHeight,
    leftRadius: 0,
    labelPadding: 10,
    openFadeLength: 0
  }),
  flag: freeze({
    standardHeight: 78,
    alternateHeight: 108,
    plateHeight: 24,
    plateRadius: 2,
    poleWidth: 2
  })
});

/*
 * These are implementation-only spacing tokens. The Design Freeze fixes lane
 * assignment and condensed-row metrics, but not the vertical pitch or the
 * clearance between the top event lane and axis-planted flags.
 */
export const KEYNOTE_LANE_SPACING_TOKENS = freeze({
  standard: freeze({
    pitch: LOCKED_407F_GEOMETRY.lanePitch,
    axisClearance: 34
  }),
  condensed: freeze({
    pitch: LOCKED_407F_GEOMETRY.condensedLanePitch,
    axisClearance: 34
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

const CANONICAL_407F_ARTIFACT=freeze({
  axisY:LOCKED_407F_GEOMETRY.axisTop,
  axisHeight:LOCKED_407F_GEOMETRY.axisHeight,
  laneStartY:LOCKED_407F_GEOMETRY.laneTop+
    LOCKED_407F_GEOMETRY.arrowHeight/2,
  lanePitch:LOCKED_407F_GEOMETRY.lanePitch,
  condensedLanePitch:LOCKED_407F_GEOMETRY.condensedLanePitch,
  title:freeze({x:648,y:0,width:596,height:83}),
  colorKey:freeze({x:20,y:334,width:280,height:335}),
  profileCard:freeze({x:18,y:661,width:540,height:400}),
  photoFrames:freeze([
    {x:610,y:792,width:205,height:240,rotation:-7},
    {x:805,y:824,width:205,height:220,rotation:5},
    {x:994,y:835,width:220,height:205,rotation:-1}
  ]),
  interview:freeze({x:1666,y:238,width:220,height:136}),
  sticky:freeze({x:1470,y:574,width:300,height:190,rotation:5})
});

const WHITE = "#FFFFFF";
const MINIMUM_TEXT_CONTRAST = 4.5;
const SVG_BACKGROUND_GRADIENT_ID = "d1-keynote-classic-board";
const SVG_ARROW_SHADOW_ID = "d1-keynote-classic-arrow-shadow";
const SVG_STUDY_PATTERN_ID = "d1-keynote-classic-study-hatch";
const SVG_LINEN_FILTER_ID = "d1-keynote-classic-linen";
const KEYNOTE_ASSET_BASE_URL = new URL(
  "../../assets/keynote_classic_402a/",
  import.meta.url
).href;
const KEYNOTE_ASSETS=freeze({
  axis:freeze({
    left:"axis/axis_left_end_cap_exact_crop_402a.png",
    segment:"axis/axis_chevron_body_segment_exact_crop_402a.png",
    right:"axis/axis_right_end_cap_exact_crop_402a.png"
  }),
  arrows:freeze({
    work:"work",
    education:"work",
    exams:"usmle",
    clinical:"teaching_hospital",
    personal:"personal",
    research:"research"
  }),
  flags:freeze({
    standard:"flags/milestone_flag_marker_rebuild_gray_402a.png",
    personal:"flags/milestone_flag_marker_rebuild_personal_402a.png",
    usa:"flags/usa_flag_marker_scaled_34x28_402a.png"
  }),
  chrome:freeze({
    plaque:"chrome/title_plaque_exact_layer_402a.png",
    key:"chrome/color_key_panel_exact_layer_402a.png",
    profile:"chrome/profile_card_exact_layer_402a.png",
    sticky:"chrome/sticky_note_red_arrow_exact_layer_402a.png",
    pin:"chrome/pushpin_exact_keynote_asset_402a.png"
  })
});

function keynoteAsset(path){
  return globalThis.D1_TIMELINE_ASSET_URLS?.[`assets/keynote_classic_402a/${path}`]
    ||new URL(path,KEYNOTE_ASSET_BASE_URL).href;
}

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

/*
 * D1-405 launch-candidate compatibility resolution.
 *
 * The frozen 28% normal-year maximum is mathematically incompatible with the
 * exact-sum invariant when fewer than four normal years are visible. Keep the
 * shared adaptive allocator strict so its original contract remains testable,
 * but let the presentation layer resolve this implementation-only conflict for
 * ordinary one-, two-, and three-year student timelines. Equal year widths
 * preserve a stable time scale, consume the exact board width, and relax only
 * the impossible maximum.
 */
function allocateSmallSpanSegments(segments, { innerWidth }) {
  const cloned = segments.map((segment) => ({ ...segment }));
  const yearIndexes = [];
  let fixedWidth = 0;

  cloned.forEach((segment, index) => {
    if (segment.kind === "condensed") {
      segment.width = 64;
      fixedWidth += segment.width;
      return;
    }
    if (segment.kind === "year") {
      yearIndexes.push(index);
      return;
    }
    throw new TypeError(`Unsupported timeline segment kind: ${String(segment.kind)}`);
  });

  if (yearIndexes.length < 1 || yearIndexes.length > 3) {
    throw new RangeError(
      "D1-405 small-span allocation requires one to three normal year segments."
    );
  }

  const budget = innerWidth - fixedWidth;
  if (budget <= 0) {
    throw new RangeError("D1-405 small-span allocation has no normal-year width.");
  }

  const baseWidth = Math.floor(budget / yearIndexes.length);
  let remainder = budget - baseWidth * yearIndexes.length;
  const frozenMaximum = innerWidth * 0.28;

  yearIndexes.forEach((segmentIndex) => {
    const width = baseWidth + (remainder > 0 ? 1 : 0);
    if (remainder > 0) remainder -= 1;
    Object.assign(cloned[segmentIndex], {
      width,
      allocationPolicy: "small-span-exact-sum",
      maximumRelaxed: width > frozenMaximum,
      frozenMaximum
    });
  });

  if (cloned.reduce((sum, segment) => sum + segment.width, 0) !== innerWidth) {
    throw new RangeError(
      "D1-405 small-span allocation did not preserve the exact-sum invariant."
    );
  }
  return cloned;
}

function allocateSegments(span, events) {
  const weighted = yearSegmentsWithDensity(span, events);
  try {
    return allocateAdaptiveYearWidths(weighted, {
      innerWidth: ENGINEERING_AXIS_WIDTH
    });
  } catch (cause) {
    if (cause?.code === "D1_UXR_002_UNRESOLVED_N_LT_4_YEAR_WIDTH_CONTRADICTION") {
      return allocateSmallSpanSegments(weighted, {
        innerWidth: ENGINEERING_AXIS_WIDTH
      });
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

  if (cursor !== KEYNOTE_BOARD_GEOMETRY.margin + ENGINEERING_AXIS_WIDTH) {
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
  const mappedX2 = monthPositionInSegments(endBoundary, segments, {
    margin: KEYNOTE_BOARD_GEOMETRY.margin
  });
  const x2 = Math.min(
    KEYNOTE_BOARD_GEOMETRY.margin+KEYNOTE_BOARD_GEOMETRY.innerWidth,
    Math.max(mappedX2,x+LOCKED_407F_GEOMETRY.minimumArrowWidth)
  );
  const width = x2 - x;
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

function laneCenter(lane, condensed, manualOffset={}) {
  const pitch=condensed
    ?CANONICAL_407F_ARTIFACT.condensedLanePitch
    :CANONICAL_407F_ARTIFACT.lanePitch;
  return CANONICAL_407F_ARTIFACT.laneStartY+
    lane*pitch+
    (Number(manualOffset?.y)||0);
}

function canonicalPresentationLanes(events){
  const ranges=events
    .filter((event)=>!isMilestone(event))
    .map((event,index)=>({event,index}))
    .sort((left,right)=>
      monthIndex(eventStart(left.event))-monthIndex(eventStart(right.event))||
      monthIndex(eventEnd(left.event))-monthIndex(eventEnd(right.event))||
      left.index-right.index
    );
  const laneById={};
  let maximum=-1;
  ranges.forEach(({event},index)=>{
    const lane=event?.manualOffset?.laneLocked&&Number.isInteger(event.lane)
      ?Math.max(0,event.lane)
      :index;
    laneById[event.id]=lane;
    maximum=Math.max(maximum,lane);
  });
  return{
    laneById,
    laneCount:maximum+1,
    presentationPolicy:"407f-chronological-stair-step"
  };
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
    return `${title}, ${category}, ${formatMonth(startMonth)}${
      event?.fields?.lorSubmitted?", LOR submitted":""
    }`;
  }
  return `${title}, ${category}, ${formatMonth(startMonth)} to ${
    event?.openEnded ? "Present" : formatMonth(endMonth)
  }${event?.fields?.lorSubmitted?", LOR submitted":""}`;
}

function buildArrows(events, segments, laneResult, currentMonth, measureText) {
  const metrics = condensedMetrics(laneResult.laneCount);
  const condensed = metrics.condensed;
  const shaftHeight = KEYNOTE_BOARD_GEOMETRY.arrow.shaftHeight;
  const arrows = [];

  const rangedEvents=events
    .filter((candidate) => !isMilestone(candidate))
    .map((event,index)=>({event,index}))
    .sort((left,right)=>
      monthIndex(eventStart(left.event))-monthIndex(eventStart(right.event))||
      monthIndex(eventEnd(left.event))-monthIndex(eventEnd(right.event))||
      left.index-right.index
    )
    .map(({event})=>event);
  for (const event of rangedEvents) {
    const geometry = durationGeometry(event, segments, currentMonth);
    const lane = laneResult.laneById[event.id];
    const centerY = laneCenter(lane, condensed,event.manualOffset);
    const fill = categoryColors[event.categoryId];
    const study = isStudyPeriod(event);
    const openEnded = Boolean(event.openEnded);
    const shaftWidth = geometry.width - KEYNOTE_BOARD_GEOMETRY.arrow.headLength;
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
      lorSubmitted:!!event?.fields?.lorSubmitted,
      openEnded,
      startMonth: geometry.startMonth,
      endMonth: geometry.endMonth,
      siteName:String(event.siteName||event.location||""),
      dateLabel:event.openEnded
        ?`${formatMonth(geometry.startMonth)} – Present`
        :`${formatMonth(geometry.startMonth)} – ${formatMonth(geometry.endMonth)}`,
      x: geometry.x,
      x2: geometry.x2,
      width: geometry.width,
      centerY,
      shaftHeight,
      headLength: KEYNOTE_BOARD_GEOMETRY.arrow.headLength,
      headHeight: KEYNOTE_BOARD_GEOMETRY.arrow.headHeight,
      leftRadius: KEYNOTE_BOARD_GEOMETRY.arrow.leftRadius,
      path: roundedArrowPath({ ...geometry, centerY, shaftHeight }),
      fadeLength:0,
      fadeStartX:null,
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

function buildInterviewMarker(interviewMonth, segments,interviewTarget={}) {
  const normalized = parseMonth(String(interviewMonth||"").slice(0,7));
  if (!normalized) return null;
  const anchorX = monthPositionInSegments(normalized, segments, {
    margin: KEYNOTE_BOARD_GEOMETRY.margin
  });
  const markerLabel=String(
    interviewTarget?.label||
    interviewTarget?.prog||
    interviewTarget?.programName||
    "Interview season"
  ).trim().slice(0,34);
  const width = Math.min(260,Math.max(132,markerLabel.length*7.1+28));
  const height = 28;
  const plateY = KEYNOTE_BOARD_GEOMETRY.axisY + 68;
  const minX = KEYNOTE_BOARD_GEOMETRY.margin;
  const maxX = KEYNOTE_BOARD_GEOMETRY.margin + KEYNOTE_BOARD_GEOMETRY.innerWidth;
  const plateX = Math.min(maxX - width, Math.max(minX, anchorX - width / 2));
  return {
    kind: "interview-marker",
    month: normalized,
    anchorX:Math.min(1840,Math.max(80,anchorX)),
    pole: {
      x: Math.min(1840,Math.max(80,anchorX)),
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
      text: markerLabel,
      x: plateX + width / 2,
      y: plateY + height / 2 + 4.25,
      color: KEYNOTE_CLASSIC_THEME.ink,
      fontSize: 12.5,
      fontWeight: 600
    },
    ariaLabel: [
      markerLabel,
      interviewTarget?.specialty,
      interviewTarget?.location,
      formatMonth(normalized)
    ].filter(Boolean).join(", ")
  };
}

function buildExplanations(explanationEvents,segments,arrows,flags){
  const eventTargets=new Map([
    ...arrows.map((arrow)=>[
      arrow.id,
      {
        kind:"event",
        eventId:String(arrow.id),
        x:(arrow.x+arrow.x2)/2,
        y:arrow.centerY
      }
    ]),
    ...flags.map((flag)=>[
      flag.id,
      {
        kind:"event",
        eventId:String(flag.id),
        x:flag.anchorX,
        y:flag.plate.y+flag.plate.height/2
      }
    ])
  ]);
  return explanationEvents.map((event)=>{
    const fields=event.fields||{};
    const target=fields.target||{};
    let anchor={
      x:Number(target.x)||960,
      y:Number(target.y)||KEYNOTE_BOARD_GEOMETRY.axisY
    };
    if(target.kind==="event"&&eventTargets.has(String(target.eventId))){
      anchor=eventTargets.get(String(target.eventId));
    }else if(target.kind==="date"&&parseMonth(target.date)){
      anchor={
        kind:"date",
        x:monthPositionInSegments(target.date,segments,{
          margin:KEYNOTE_BOARD_GEOMETRY.margin
        }),
        y:KEYNOTE_BOARD_GEOMETRY.axisY
      };
    }else if(target.kind==="region"){
      const region=String(target.region||"").toLowerCase();
      anchor={
        kind:"region",
        x:region.includes("left")
          ?360
          :region.includes("right")
            ?1560
            :960,
        y:region.includes("top")
          ?250
          :region.includes("bottom")
            ?830
            :KEYNOTE_BOARD_GEOMETRY.axisY
      };
    }
    return{
      kind:"explanation",
      id:String(event.id),
      text:String(fields.explanationText||event.title||"Explanation").slice(0,180),
      x:Number(fields.x)||CANONICAL_407F_ARTIFACT.sticky.x,
      y:Number(fields.y)||CANONICAL_407F_ARTIFACT.sticky.y,
      width:Number(fields.width)||CANONICAL_407F_ARTIFACT.sticky.width,
      height:Number(fields.height)||CANONICAL_407F_ARTIFACT.sticky.height,
      leaderEnabled:fields.leaderEnabled!==false,
      target:anchor,
      ariaLabel:`Explanation: ${String(fields.explanationText||event.title||"").slice(0,180)}`
    };
  });
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

function applyLocked407FGeometry({
  arrows,
  flags,
  interviewMarker,
  firstYear,
  lastYear
}){
  const composition=locked407FComposition({arrows});
  const yearCount=Math.max(1,lastYear-firstYear+1);
  const totalMonths=yearCount*12;
  const monthX=(month)=>KEYNOTE_BOARD_GEOMETRY.margin+
    (
      (monthIndex(month)-firstYear*12)/totalMonths
    )*KEYNOTE_BOARD_GEOMETRY.innerWidth;
  for(const arrow of arrows){
    const x=monthX(arrow.startMonth);
    const mappedX2=monthX(addMonths(arrow.endMonth,1));
    const x2=Math.min(
      KEYNOTE_BOARD_GEOMETRY.margin+KEYNOTE_BOARD_GEOMETRY.innerWidth,
      Math.max(mappedX2,x+LOCKED_407F_GEOMETRY.minimumArrowWidth)
    );
    const centerY=composition.laneTop+
      arrow.lane*composition.lanePitch+
      LOCKED_407F_GEOMETRY.arrowHeight/2;
    Object.assign(arrow,{
      x,
      x2,
      width:x2-x,
      centerY,
      shaftHeight:KEYNOTE_BOARD_GEOMETRY.arrow.shaftHeight,
      headLength:LOCKED_407F_GEOMETRY.headWidth,
      headHeight:LOCKED_407F_GEOMETRY.arrowHeight
    });
    arrow.path=roundedArrowPath(arrow);
  }
  flags.forEach((flag)=>Object.assign(flag,{anchorX:monthX(flag.month)}));
  if(interviewMarker){
    Object.assign(interviewMarker,{anchorX:monthX(interviewMarker.month)});
  }
  return composition;
}

function locked407FSpanYears({arrows,flags,interviewMarker,fallbackFirst,fallbackLast}){
  const months=[
    ...arrows.flatMap((arrow)=>[arrow.startMonth,arrow.endMonth]),
    ...flags.map((flag)=>flag.month),
    interviewMarker?.month
  ].filter(Boolean).map(monthIndex);
  if(!months.length){
    return{
      firstYear:Number(fallbackFirst),
      lastYear:Number(fallbackLast)
    };
  }
  const firstYear=Math.floor(Math.min(...months)/12);
  return{
    firstYear,
    lastYear:Math.max(firstYear+1,Math.floor(Math.max(...months)/12))
  };
}

export function buildKeynoteClassicScene(
  timeline,
  {
    currentMonth,
    interviewMonth = (
      timeline?.metadata?.interview?.date||
      timeline?.studentProfile?.interviewSeason||
      null
    ),
    interviewTarget = timeline?.metadata?.interview||{},
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
  const explanationEvents=validated.renderable.filter(
    (event)=>event?.fields?.builderDomain==="explanation"
  );
  const timelineEvents=validated.renderable.filter(
    (event)=>event?.fields?.builderDomain!=="explanation"
  );
  const span = deriveTimelineSpan(validated.renderable, {
    currentMonth: normalizedCurrent,
    interviewMonth
  });
  const segments = allocateSegments(span, validated.renderable);
  const axis = buildAxis(segments);
  const engineeringLaneResult=assignStableLanes(timelineEvents,{previousLaneById});
  const laneResult = canonicalPresentationLanes(timelineEvents);
  const arrowResult = buildArrows(
    timelineEvents,
    segments,
    laneResult,
    normalizedCurrent,
    measureText
  );
  const flags = buildFlags(timelineEvents, segments, measureText);
  const explanations=buildExplanations(
    explanationEvents,
    segments,
    arrowResult.arrows,
    flags
  );
  const events = [...arrowResult.arrows, ...flags,...explanations];
  const interviewMarker = buildInterviewMarker(
    interviewMonth,
    segments,
    interviewTarget
  );
  const fullName = String(timeline?.studentProfile?.fullName || "Your journey");
  const segmentFirstYear = segments[0]?.startYear ?? segments[0]?.year;
  const segmentLastYear = segments.at(-1)?.year ?? segments.at(-1)?.endYear;
  const {firstYear,lastYear}=locked407FSpanYears({
    arrows:arrowResult.arrows,
    flags,
    interviewMarker,
    fallbackFirst:segmentFirstYear,
    fallbackLast:segmentLastYear
  });
  const composition=applyLocked407FGeometry({
    arrows:arrowResult.arrows,
    flags,
    interviewMarker,
    firstYear,
    lastYear
  });
  const ariaLabel = `Timeline visualization, ${events.length} events; use Tab to move between events`;
  const profile=timeline?.studentProfile||{};
  const exams=Array.isArray(timeline?.exams)?timeline.exams:[];
  const examValue=(system,examId)=>{
    const match=exams.find((exam)=>
      String(exam?.system||"").toUpperCase()===system&&
      String(exam?.examId||"").toLowerCase()===examId
    );
    return String(match?.score||match?.result||"").trim();
  };

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
      presentationPolicy:laneResult.presentationPolicy,
      engineeringLaneById:{...engineeringLaneResult.laneById},
      spacingTokens: arrowResult.condensed
        ? KEYNOTE_LANE_SPACING_TOKENS.condensed
        : KEYNOTE_LANE_SPACING_TOKENS.standard,
      composition
    },
    arrows: arrowResult.arrows,
    flags,
    explanations,
    events,
    interviewMarker,
    interviewTarget:{...interviewTarget},
    profile:{
      fullName,
      medicalSchool:String(profile.medicalSchool||""),
      degree:String(profile.degree||""),
      status:String(
        profile.currentUsWorkAuthorization||
        profile.visaStatus||
        ""
      ),
      specialty:String(
        interviewTarget?.specialtyLabel||
        profile.specialtyGoal||
        ""
      ),
      step1:examValue("USMLE","step-1"),
      step2:examValue("USMLE","step-2-ck")
    },
    artifact:{
      schemaVersion:"d1-405.canonical-407f-artifact.1",
      visualAuthority:"407F_POWERPOINT_KEYNOTE",
      stickyNote:String(timeline?.metadata?.stickyNote||""),
      photoSlotCount:3
    },
    lorLegend:{
      visible:arrowResult.arrows.some((arrow)=>arrow.lorSubmitted),
      label:"LOR submitted",
      symbol:"★"
    },
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
  const tickStyle=axis.tickStyle||KEYNOTE_CLASSIC_THEME.ticks;
  const yearLabelStyle=axis.yearLabelStyle||KEYNOTE_CLASSIC_THEME.yearLabel;
  const y=CANONICAL_407F_ARTIFACT.axisY;
  const height=CANONICAL_407F_ARTIFACT.axisHeight;
  const segmentLabels=axis.segments.map((segment,index)=>{
    const label=segment.kind==="condensed"?segment.label:String(segment.year);
    const title=segment.kind==="condensed"
      ?`<title>${xmlEscape(segment.tooltip)}</title>`
      :"";
    const style=segment.yearLabelStyle||yearLabelStyle;
    const asset=index===0
      ?KEYNOTE_ASSETS.axis.left
      :index===axis.segments.length-1
        ?KEYNOTE_ASSETS.axis.right
        :KEYNOTE_ASSETS.axis.segment;
    return`<g data-segment-kind="${segment.kind}" data-segment-width="${number(segment.width)}">${title}<image data-axis-sprite="true" href="${xmlEscape(keynoteAsset(asset))}" x="${number(segment.x)}" y="${y}" width="${number(segment.width+1)}" height="${height}" preserveAspectRatio="none"/><text x="${number(segment.centerX-4)}" y="${number(y+34)}" text-anchor="middle" fill="#FFFFFF" font-family="'Archivo',Arial,sans-serif" font-size="${Math.max(22,Number(style.fontSize)||20)}" font-weight="800" letter-spacing=".2" font-variant-numeric="tabular-nums">${xmlEscape(label)}</text></g>`;
  }).join("");
  const ticks=axis.ticks.map((tick)=>
    `<line data-tick-kind="${tick.kind}" x1="${number(tick.x)}" y1="${number(y+height)}" x2="${number(tick.x)}" y2="${number(y+height+(tick.kind==="quarter"?8:5))}" stroke="${tick.color||tickStyle.color}" stroke-width="1"/>`
  ).join("");
  return`<g data-layer="axis" data-axis-language="407f-powerpoint">${segmentLabels}${ticks}</g>`;
}

function arrowSpriteSlug(arrow){
  if(
    arrow.categoryId==="clinical"&&
    /clinic|ambulatory|outpatient/i.test(arrow.siteName)
  )return"clinics";
  return KEYNOTE_ASSETS.arrows[arrow.categoryId]||"work";
}

function arrowSprite(slug,part){
  return keynoteAsset(`arrows/${slug}_arrow_${part}_402a.png`);
}

function serializeArrowDateAndSite(arrow){
  const top=arrow.centerY-arrow.shaftHeight/2;
  const start=xmlEscape(formatMonth(arrow.startMonth));
  const end=xmlEscape(arrow.openEnded?"Present":formatMonth(arrow.endMonth));
  const dates=arrow.width>=150
    ?`<text x="${number(arrow.x+2)}" y="${number(top-8)}" fill="#111827" font-family="Georgia,serif" font-size="15">${start}</text><text x="${number(arrow.x2-18)}" y="${number(top-8)}" text-anchor="end" fill="#111827" font-family="Georgia,serif" font-size="15">${end}</text>`
    :`<text x="${number(arrow.x+arrow.width/2)}" y="${number(top-8)}" text-anchor="middle" fill="#111827" font-family="Georgia,serif" font-size="14">${start} – ${end}</text>`;
  const site=arrow.siteName
    ?`<text data-arrow-site="true" x="${number(arrow.x-10)}" y="${number(arrow.centerY+5)}" text-anchor="end" fill="#111827" font-family="Georgia,serif" font-size="15">${xmlEscape(arrow.siteName)}</text>`
    :"";
  return`${dates}${site}`;
}

function serializeArrow(arrow,_index,theme){
  const slug=arrowSpriteSlug(arrow);
  const top=arrow.centerY-arrow.shaftHeight/2;
  const bodyWidth=Math.max(1,arrow.width-45);
  const exactSprite=theme?.id==="keynote-classic";
  const arrowShape=exactSprite
    ?`<image href="${xmlEscape(arrowSprite(slug,"left_cap"))}" x="${number(arrow.x)}" y="${number(top)}" width="16" height="36"/><image href="${xmlEscape(arrowSprite(slug,"body_segment"))}" x="${number(arrow.x+14)}" y="${number(top)}" width="${number(bodyWidth)}" height="36" preserveAspectRatio="none"/><image href="${xmlEscape(arrowSprite(slug,"right_head"))}" x="${number(arrow.x2-34)}" y="${number(top)}" width="34" height="36"/>`
    :`<path d="${arrow.path}" fill="${arrow.fill}" filter="url(#${SVG_ARROW_SHADOW_ID})"/><path d="M ${number(arrow.x+3)} ${number(top+3)} H ${number(arrow.x2-35)}" stroke="#FFFFFF" stroke-opacity=".42" stroke-width="2"/><path d="M ${number(arrow.x+3)} ${number(top+33)} H ${number(arrow.x2-35)}" stroke="#000000" stroke-opacity=".28" stroke-width="2"/>`;
  const provisional=arrow.provisional
    ?`<rect x="${number(arrow.x)}" y="${number(top)}" width="${number(arrow.width)}" height="36" fill="none" stroke="#8B1E1E" stroke-width="2" stroke-dasharray="8 6"/>`
    :"";
  const labelX=arrow.x+Math.max(16,arrow.width-34)/2;
  const labelColor=exactSprite
    ?(arrow.categoryId==="clinical"||arrow.categoryId==="research"?"#191C21":"#FFFFFF")
    :arrow.label.color;
  const label=`<text data-arrow-label="inside" x="${number(labelX)}" y="${number(arrow.centerY+5)}" text-anchor="middle" fill="${labelColor}" font-family="'Archivo',Arial,sans-serif" font-size="${arrow.condensed?13:15}" font-weight="700"><title>${xmlEscape(arrow.label.fullText)}</title>${xmlEscape(arrow.label.text)}</text>`;
  const chip=arrow.actionChip?`<g data-study-action-chip="${xmlEscape(arrow.actionChip.targetAttemptId||"")}" transform="translate(${number(Math.max(arrow.x,arrow.x2-122))} ${number(arrow.centerY+arrow.shaftHeight/2+8)})"><rect width="122" height="26" rx="13" fill="#B98A2E" stroke="#A67A26"/><text x="61" y="17" text-anchor="middle" fill="#191C21" font-family="${KEYNOTE_CLASSIC_THEME.fontFamily}" font-size="10.5" font-weight="600">${xmlEscape(arrow.actionChip.label||"Set retake date")}</text></g>`:"";
  const lor=arrow.lorSubmitted
    ?`<g data-lor-submitted="true" role="img" aria-label="LOR submitted" transform="translate(${number(Math.max(arrow.x+26,arrow.x2-44))} ${number(top-3)})"><path d="M -11 -13 H 11 V 11 L 0 5 L -11 11 Z" fill="#F3E7B3" stroke="#8C6B20" stroke-width="1.5" filter="url(#${SVG_ARROW_SHADOW_ID})"/><text aria-hidden="true" x="0" y="4" text-anchor="middle" fill="#6C5018" font-family="${KEYNOTE_CLASSIC_THEME.fontFamily}" font-size="15" font-weight="800">★</text></g>`
    :"";
  return`<g data-event-kind="arrow" data-event-id="${xmlEscape(arrow.id)}" data-category="${arrow.categoryId}" data-open-ended="${arrow.openEnded}" data-study="${arrow.study}" aria-label="${xmlEscape(arrow.ariaLabel)}">${arrowShape}${provisional}${serializeArrowDateAndSite(arrow)}${label}${chip}${lor}</g>`;
}

function serializeLorLegend(legend){
  if(!legend?.visible)return"";
  return`<g data-lor-legend="true" role="img" aria-label="LOR submitted" transform="translate(45 645)"><path d="M 0 0 H 22 V 24 L 11 18 L 0 24 Z" fill="#F3E7B3" stroke="#8C6B20"/><text aria-hidden="true" x="11" y="16" text-anchor="middle" fill="#6C5018" font-family="${KEYNOTE_CLASSIC_THEME.fontFamily}" font-size="14" font-weight="800">★</text><text x="32" y="16" fill="#323846" font-family="'Archivo',Arial,sans-serif" font-size="13" font-weight="700">${xmlEscape(legend.label||"LOR submitted")}</text></g>`;
}

function serializeFlag(flag){
  const usa=/usa|green ?card/i.test(flag.title);
  const asset=usa
    ?KEYNOTE_ASSETS.flags.usa
    :flag.categoryId==="personal"
      ?KEYNOTE_ASSETS.flags.personal
      :KEYNOTE_ASSETS.flags.standard;
  const width=usa?38:54;
  const height=usa?32:69;
  const x=flag.anchorX-width/2;
  const y=flag.plate.y;
  const dateY=usa?y+height+16:y+13;
  const titleX=flag.anchorX+width/2+7;
  const dot=flag.dangerDot
    ?`<circle data-failed-attempt-dot="true" cx="${number(flag.anchorX+17)}" cy="${number(y+5)}" r="4" fill="#C4453B"/>`
    :"";
  return`<g data-event-kind="flag" data-event-id="${xmlEscape(flag.id)}" data-category="${flag.categoryId}" aria-label="${xmlEscape(flag.ariaLabel)}"><image data-flag-sprite="true" href="${xmlEscape(keynoteAsset(asset))}" x="${number(x)}" y="${number(y)}" width="${width}" height="${height}" preserveAspectRatio="xMidYMid meet"/>${dot}<text data-flag-date="true" x="${number(flag.anchorX)}" y="${number(dateY)}" text-anchor="middle" fill="#FFFFFF" font-family="'Rajdhani',Arial,sans-serif" font-size="10" font-weight="800">${xmlEscape(flag.month.slice(5))}/${xmlEscape(flag.month.slice(2,4))}</text><text x="${number(titleX)}" y="${number(y+18)}" fill="#111827" font-family="Georgia,serif" font-size="16"><title>${xmlEscape(flag.label.fullText)}</title>${xmlEscape(flag.label.text)}</text></g>`;
}

function serializeInterviewMarker(marker,target={}){
  if(!marker)return"";
  const box=CANONICAL_407F_ARTIFACT.interview;
  const program=String(
    target.programName||target.prog||marker.label?.text||"PROGRAM INTERVIEW"
  ).trim();
  const ribbon=String(target.label||"YOUR BIG INTERVIEW").trim();
  return`<g data-event-kind="interview-marker" aria-label="${xmlEscape(marker.ariaLabel)}"><g data-interview-axis-marker="true"><image href="${xmlEscape(keynoteAsset(KEYNOTE_ASSETS.flags.standard))}" x="${number(marker.anchorX-20)}" y="57" width="40" height="51"/><text x="${number(marker.anchorX+23)}" y="75" fill="#111827" font-family="Georgia,serif" font-size="14">Interview</text></g><g data-interview-destination="407f-ribbon"><rect x="${box.x}" y="${box.y}" width="${box.width}" height="62" rx="4" fill="rgba(255,255,255,.72)" stroke="#59657B" stroke-dasharray="5 4"/><text x="${box.x+box.width/2}" y="${box.y+27}" text-anchor="middle" fill="#49206D" font-family="'Archivo',Arial,sans-serif" font-size="14" font-weight="800">${xmlEscape(program.toUpperCase())}</text><text x="${box.x+box.width/2}" y="${box.y+47}" text-anchor="middle" fill="#4F5B70" font-family="'Rajdhani',Arial,sans-serif" font-size="11" font-weight="700" letter-spacing="1.4">PROGRAM LOGO</text><path d="M ${box.x-16} ${box.y+72} H ${box.x+box.width+16} L ${box.x+box.width+4} ${box.y+92} L ${box.x+box.width+16} ${box.y+112} H ${box.x-16} L ${box.x-4} ${box.y+92} Z" fill="#6E3197" stroke="#45205F" stroke-width="2" filter="url(#${SVG_ARROW_SHADOW_ID})"/><text x="${box.x+box.width/2}" y="${box.y+98}" text-anchor="middle" fill="#FFFFFF" font-family="Georgia,serif" font-size="17" font-weight="700">${xmlEscape(ribbon)}</text><text x="${box.x+box.width/2}" y="${box.y+132}" text-anchor="middle" fill="#111827" font-family="Georgia,serif" font-size="14">${xmlEscape(formatMonth(marker.month))}</text></g></g>`;
}

function explanationLines(text,max=44){
  const words=String(text||"").split(/\s+/).filter(Boolean);
  const lines=[];
  let line="";
  for(const word of words){
    const next=line?`${line} ${word}`:word;
    if(next.length>max&&line){
      lines.push(line);
      line=word;
    }else line=next;
    if(lines.length===3)break;
  }
  if(line&&lines.length<4)lines.push(line);
  if(words.join(" ").length>lines.join(" ").length&&lines.length){
    lines[lines.length-1]=`${lines[lines.length-1].replace(/[.…]+$/,"")}…`;
  }
  return lines.slice(0,4);
}

function serializeExplanation(explanation,theme){
  const width=Math.min(300,Math.max(210,Number(explanation.width)||260));
  const height=Math.min(190,Math.max(130,Number(explanation.height)||150));
  const x=Math.min(1920-width-22,Math.max(22,Number(explanation.x)||1470));
  const y=Math.min(1080-height-22,Math.max(190,Number(explanation.y)||574));
  const lines=explanationLines(
    explanation.text,
    Math.max(20,Math.floor((width-32)/8.6))
  );
  const leader=explanation.leaderEnabled
    ?`<path data-explanation-leader="true" d="M ${number(x+18)} ${number(y+height*.54)} C ${number(x-55)} ${number(y+height*.45)}, ${number(explanation.target.x+72)} ${number(explanation.target.y+28)}, ${number(explanation.target.x)} ${number(explanation.target.y)}" fill="none" stroke="#C73A25" stroke-width="5" stroke-linecap="round" stroke-linejoin="round" marker-end="url(#d1-407f-red-arrowhead)"/>`
    :"";
  const text=lines.map((line,index)=>
    `<tspan x="${number(x+20)}" dy="${index===0?"0":"25"}">${xmlEscape(line)}</tspan>`
  ).join("");
  return`<g data-event-kind="explanation" data-event-id="${xmlEscape(explanation.id)}" role="group" aria-label="${xmlEscape(explanation.ariaLabel)}">${leader}<g transform="rotate(4 ${number(x+width/2)} ${number(y+height/2)})"><rect data-explanation-card="true" x="${number(x)}" y="${number(y)}" width="${number(width)}" height="${number(height)}" rx="1" fill="#F5E47B" stroke="#D1B84E" stroke-width="1.5" filter="url(#${SVG_ARROW_SHADOW_ID})"/><path d="M ${number(x+8)} ${number(y+9)} H ${number(x+width-8)}" stroke="#FFF8BE" stroke-width="4" stroke-opacity=".75"/><rect x="${number(x+width/2-34)}" y="${number(y-7)}" width="68" height="15" fill="#FFFFFF" fill-opacity=".42" transform="rotate(-3 ${number(x+width/2)} ${number(y)})"/><text x="${number(x+20)}" y="${number(y+35)}" fill="#40370F" font-family="Georgia,serif" font-size="19" font-style="italic" font-weight="600">${text}</text></g></g>`;
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
  if(theme?.id==="keynote-classic"){
    return{
      definition:`<linearGradient id="${SVG_BACKGROUND_GRADIENT_ID}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#B8CAD6"/><stop offset=".48" stop-color="#A6BBC8"/><stop offset="1" stop-color="#8FA7B7"/></linearGradient>`,
      fill:`url(#${SVG_BACKGROUND_GRADIENT_ID})`,
      textured:true
    };
  }
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

function canonicalTextureDefinition(){
  return`<filter id="${SVG_LINEN_FILTER_ID}" x="-5%" y="-5%" width="110%" height="110%" color-interpolation-filters="sRGB"><feTurbulence type="fractalNoise" baseFrequency=".74 .028" numOctaves="2" seed="407" result="noise"/><feColorMatrix in="noise" type="matrix" values=".20 0 0 0 .42 0 .26 0 0 .48 0 0 .32 0 .52 0 0 0 .34 0" result="linen"/><feBlend in="SourceGraphic" in2="linen" mode="multiply"/></filter><marker id="d1-407f-red-arrowhead" viewBox="0 0 12 12" refX="10" refY="6" markerWidth="10" markerHeight="10" orient="auto-start-reverse"><path d="M 1 1 L 11 6 L 1 11 L 4 6 Z" fill="#C73A25"/></marker>`;
}

function artifactHeadline(scene){
  const box=CANONICAL_407F_ARTIFACT.title;
  const raw=String(scene.headline?.text||"Your journey").trim();
  const text=/^timeline\s*:/i.test(raw)?raw:`Timeline: ${raw}`;
  return`<g data-artifact-chrome="title"><image href="${xmlEscape(keynoteAsset(KEYNOTE_ASSETS.chrome.plaque))}" x="${box.x}" y="${box.y}" width="${box.width}" height="${box.height}"/><text data-board-headline="true" x="${box.x+box.width/2}" y="${box.y+53}" text-anchor="middle" fill="#0E325E" font-family="Georgia,serif" font-size="34" font-weight="700">${xmlEscape(text)}</text></g>`;
}

function profileValue(value,fallback="Not set"){
  const normalized=String(value||"").trim();
  return normalized||fallback;
}

function artifactProfile(scene){
  const box=CANONICAL_407F_ARTIFACT.profileCard;
  const profile=scene.profile||{};
  const source=keynoteAsset(KEYNOTE_ASSETS.chrome.profile);
  return`<g data-artifact-chrome="profile"><svg x="${box.x}" y="${box.y}" width="${box.width}" height="${box.height}" viewBox="0 362 547 408" preserveAspectRatio="none"><image href="${xmlEscape(source)}" x="0" y="0" width="547" height="770"/></svg><g font-family="'Archivo',Arial,sans-serif" fill="#111827"><text x="38" y="713" font-size="18" font-weight="800">Name: <tspan font-weight="600">${xmlEscape(profileValue(profile.fullName,"Profile not set").slice(0,30))}</tspan></text><text x="38" y="741" font-size="16" font-weight="700">Medical school: <tspan font-weight="500">${xmlEscape(profileValue(profile.medicalSchool).slice(0,24))}</tspan></text><text x="38" y="767" font-size="16" font-weight="700">Degree: <tspan font-weight="500">${xmlEscape(profileValue(profile.degree).slice(0,22))}</tspan></text><text x="38" y="793" font-size="16" font-weight="700">Status: <tspan font-weight="500">${xmlEscape(profileValue(profile.status).slice(0,24))}</tspan></text><text x="38" y="837" font-size="17" font-weight="800">Step 1: <tspan font-weight="600">${xmlEscape(profileValue(profile.step1))}</tspan></text><text x="38" y="866" font-size="17" font-weight="800">Step 2 CK: <tspan font-weight="600">${xmlEscape(profileValue(profile.step2))}</tspan></text><text x="38" y="910" font-size="17" font-weight="800">Specialty: <tspan font-weight="600">${xmlEscape(profileValue(profile.specialty).slice(0,24))}</tspan></text></g><g data-profile-photo-slot="true"><rect x="360" y="690" width="172" height="174" fill="#FFFFFF" stroke="#E6E1D6" stroke-width="8" filter="url(#${SVG_ARROW_SHADOW_ID})"/><rect x="372" y="702" width="148" height="142" fill="#31445D"/><text x="446" y="774" text-anchor="middle" fill="#E8EEF8" font-family="'Rajdhani',Arial,sans-serif" font-size="14" font-weight="800" letter-spacing="2">PROFILE</text><text x="446" y="795" text-anchor="middle" fill="#E8EEF8" font-family="'Rajdhani',Arial,sans-serif" font-size="14" font-weight="800" letter-spacing="2">PHOTO</text></g></g>`;
}

function artifactPhotoFrames(){
  return CANONICAL_407F_ARTIFACT.photoFrames.map((frame,index)=>{
    const cx=frame.x+frame.width/2;
    const cy=frame.y+frame.height/2;
    return`<g data-artifact-photo-frame="${index+1}" transform="rotate(${frame.rotation} ${cx} ${cy})"><rect x="${frame.x}" y="${frame.y}" width="${frame.width}" height="${frame.height}" fill="#FFFDF7" stroke="#E9E3D7" stroke-width="4" filter="url(#${SVG_ARROW_SHADOW_ID})"/><rect x="${frame.x+13}" y="${frame.y+13}" width="${frame.width-26}" height="${frame.height-52}" fill="#34465E"/><text x="${cx}" y="${frame.y+frame.height/2}" text-anchor="middle" fill="#D8E1EC" font-family="'Rajdhani',Arial,sans-serif" font-size="14" font-weight="800" letter-spacing="2">PHOTO ${index+1}</text></g>`;
  }).join("");
}

function artifactChrome(scene){
  const key=CANONICAL_407F_ARTIFACT.colorKey;
  return`${artifactHeadline(scene)}<g data-artifact-chrome="color-key"><image href="${xmlEscape(keynoteAsset(KEYNOTE_ASSETS.chrome.key))}" x="${key.x}" y="${key.y}" width="${key.width}" height="${key.height}" preserveAspectRatio="none"/></g>${artifactProfile(scene)}<g data-artifact-chrome="photo-frames">${artifactPhotoFrames()}</g>`;
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
  // Every board surface and theme is a skin over the protected 407F artifact.
  // Theme application may change presentation tokens in the scene, but it must
  // never route serialization through a parallel geometry implementation.
  return serializeLocked407FArtifact(scene).replace(
    'data-theme="keynote-classic"',
    `data-theme="${xmlEscape(theme.id)}"`
  );
  /* c8 ignore start -- retained only as unreachable migration reference
  const background=svgBackground(theme);
  const arrows = scene.arrows.map((arrow,index)=>serializeArrow(arrow,index,theme)).join("");
  const flags = scene.flags.map(serializeFlag).join("");
  const explanations=(scene.explanations||[])
    .map((explanation)=>serializeExplanation(explanation,theme))
    .join("");
  const texture=background.textured
    ?`<rect data-board-texture="407f-linen" width="1920" height="1080" fill="#AEC0CC" filter="url(#${SVG_LINEN_FILTER_ID})" opacity=".72"/>`
    :"";
  return`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1920 1080" width="1920" height="1080" role="img" aria-labelledby="${titleId} ${descriptionId}" data-renderer="${scene.renderer}" data-theme="${theme.id}" data-artifact-language="407f-powerpoint-keynote"><title id="${titleId}">${xmlEscape(scene.accessibility.ariaLabel)}</title><desc id="${descriptionId}">${xmlEscape(scene.accessibility.description)}</desc><defs>${background.definition}${svgShadow(theme)}${canonicalTextureDefinition()}<pattern id="${SVG_STUDY_PATTERN_ID}" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="8" stroke="${theme.categories?.exams||KEYNOTE_CLASSIC_THEME.categories.exams}" stroke-width="3" stroke-opacity=".6"/></pattern></defs><rect data-board-background="true" width="1920" height="1080" fill="${background.fill}"/>${texture}${serializeAxis(scene.axis)}<g data-layer="events">${arrows}${flags}</g>${artifactChrome(scene)}${serializeInterviewMarker(scene.interviewMarker,scene.interviewTarget)}${serializeLorLegend(scene.lorLegend)}<g data-layer="explanations">${explanations}</g></svg>`;
  c8 ignore stop */
}

export function renderKeynoteClassicBoard(timeline, options = {}) {
  const scene = buildKeynoteClassicScene(timeline, options);
  return {
    scene,
    svg: serializeKeynoteClassicSvg(scene)
  };
}
