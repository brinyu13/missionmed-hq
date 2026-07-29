import { contrastRatio } from "./utils.js";

const freezeDeep = (value) => {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) freezeDeep(child);
  return Object.freeze(value);
};

const cloneValue = (value) => {
  if (Array.isArray(value)) return value.map(cloneValue);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, child]) => [key, cloneValue(child)])
    );
  }
  return value;
};

const CATEGORY_IDS = Object.freeze([
  "education",
  "exams",
  "clinical",
  "work",
  "research",
  "personal"
]);

const WHITE = "#FFFFFF";
const INK_PRIMARY = "#191C21";
const MISSIONMED_GOLD = "#B98A2E";
const TEXT_CONTRAST_THRESHOLD = 4.5;
const INTER = "Inter, sans-serif";
const NUNITO = "Nunito, sans-serif";

const categories = (education, exams, clinical, work, research, personal) => ({
  education,
  exams,
  clinical,
  work,
  research,
  personal
});

export const DEFAULT_THEME_ID = "keynote-classic";
export const ADVISOR_PAPER_THEME_ID = "advisor-paper";
export const THEME_PICKER_CARD_SIZE = freezeDeep({ width: 128, height: 72 });
export const THEME_PICKER_LAYOUT = freezeDeep({ columns: 3, rows: 2 });
export const ADVISOR_PAPER_PDF_SUGGESTION = freezeDeep({
  id: "advisor-paper-pdf-suggestion",
  message: "Advisor Paper prints best — switch?",
  actionLabel: "Switch",
  actionThemeId: ADVISOR_PAPER_THEME_ID
});

/*
 * Theme objects deliberately contain board tokens only. The application shell
 * remains owned by the global D1-UXR-002 design system and is never accepted as
 * an input to, or emitted by, this catalog.
 */
export const THEME_DEFINITIONS = freezeDeep([
  {
    ordinal: "T1",
    id: DEFAULT_THEME_ID,
    name: "Keynote Classic",
    descriptor: "The original, perfected.",
    board: {
      kind: "linear-gradient",
      angle: 165,
      start: "#F5F7FB",
      end: "#E9EEF6",
      css: "linear-gradient(165deg, #F5F7FB 0%, #E9EEF6 100%)",
      contrastSurfaces: ["#F5F7FB", "#E9EEF6"]
    },
    axis: {
      color: "#2A3442",
      width: 2,
      lineCap: "butt",
      endSerifHeight: 0
    },
    ticks: { color: "#8B98AA" },
    yearLabel: {
      color: "#2A3442",
      fontSize: 20,
      fontWeight: 700,
      fontFamily: INTER,
      letterSpacing: "0"
    },
    ink: "#232B36",
    categories: categories(
      "#2C6E8F",
      "#3A78C9",
      "#C8641C",
      "#3F9B52",
      "#C9A227",
      "#8A5BBF"
    ),
    flagPlate: {
      shape: "plate",
      fill: "#FFFFFF",
      border: "#C6CFDB",
      borderWidth: 1,
      ink: "#232B36",
      radius: 6
    },
    arrowShadow: {
      enabled: true,
      value: "0 1px 2px rgba(0,0,0,.18)"
    },
    headline: {
      color: "#232B36",
      fontSize: 24,
      fontWeight: 700,
      fontFamily: INTER,
      rule: null
    },
    geometry: {
      arrowCornerRadius: 3,
      flagCornerRadius: 6
    }
  },
  {
    ordinal: "T2",
    id: "mission-navy",
    name: "Mission Navy",
    descriptor: "Premium dark, gold accents.",
    board: {
      kind: "radial-gradient",
      position: "50% 30%",
      start: "#1B2A4A",
      end: "#0E1730",
      css: "radial-gradient(at 50% 30%, #1B2A4A 0%, #0E1730 100%)",
      contrastSurfaces: ["#1B2A4A", "#0E1730"]
    },
    axis: {
      color: "#D9C489",
      width: 2,
      lineCap: "butt",
      endSerifHeight: 0
    },
    ticks: { color: "#66738F" },
    yearLabel: {
      color: "#D9C489",
      fontSize: 20,
      fontWeight: 700,
      fontFamily: INTER,
      letterSpacing: "0"
    },
    ink: "#F2F4F8",
    categories: categories(
      "#5FA8CE",
      "#6FA0E8",
      "#E08B45",
      "#5FBF7A",
      "#E3C55A",
      "#B08AE0"
    ),
    flagPlate: {
      shape: "plate",
      fill: "#22304F",
      border: "#3A4A6E",
      borderWidth: 1,
      ink: "#F2F4F8",
      radius: 6
    },
    arrowShadow: {
      enabled: true,
      value: "0 1px 2px rgba(0,0,0,.18)"
    },
    headline: {
      color: "#FFFFFF",
      fontSize: 24,
      fontWeight: 700,
      fontFamily: INTER,
      rule: null
    },
    geometry: {
      arrowCornerRadius: 3,
      flagCornerRadius: 6
    }
  },
  {
    ordinal: "T3",
    id: ADVISOR_PAPER_THEME_ID,
    name: "Advisor Paper",
    descriptor: "Print-first, calm, zero glare.",
    board: {
      kind: "flat",
      color: "#FAF6EC",
      css: "#FAF6EC",
      contrastSurfaces: ["#FAF6EC"]
    },
    axis: {
      color: "#4A443A",
      width: 1.5,
      lineCap: "butt",
      endSerifHeight: 0
    },
    ticks: { color: "#A79E8C" },
    yearLabel: {
      color: "#4A443A",
      fontSize: 18,
      fontWeight: 650,
      fontFamily: INTER,
      letterSpacing: "0"
    },
    ink: "#33302A",
    categories: categories(
      "#4A7A93",
      "#5578B0",
      "#B06A35",
      "#55884F",
      "#A98F3D",
      "#7E6398"
    ),
    flagPlate: {
      shape: "plate",
      fill: "#FFFFFF",
      border: "#CFC7B4",
      borderWidth: 1,
      ink: "#33302A",
      radius: 6
    },
    arrowShadow: {
      enabled: false,
      value: null
    },
    headline: {
      color: "#33302A",
      fontSize: 24,
      fontWeight: 700,
      fontFamily: INTER,
      rule: null
    },
    geometry: {
      arrowCornerRadius: 3,
      flagCornerRadius: 6
    }
  },
  {
    ordinal: "T4",
    id: "horizon",
    name: "Horizon",
    descriptor: "Modern editorial.",
    board: {
      kind: "horizon-band",
      color: "#FDFCF9",
      band: {
        angle: 180,
        start: "#FFF7EA",
        end: "transparent",
        endPercent: 26,
        heightPercent: 26
      },
      css: "linear-gradient(180deg, #FFF7EA 0%, transparent 26%), #FDFCF9",
      contrastSurfaces: ["#FDFCF9", "#FFF7EA"]
    },
    axis: {
      color: "#1F232A",
      width: 1,
      lineCap: "butt",
      endSerifHeight: 8
    },
    ticks: { color: "#B9BDC6" },
    yearLabel: {
      color: "#1F232A",
      fontSize: 16,
      fontWeight: 650,
      fontFamily: INTER,
      letterSpacing: "0.04em"
    },
    ink: "#1F232A",
    categories: categories(
      "#3D6B7D",
      "#3E6FBF",
      "#D07530",
      "#3E8E5A",
      "#C7A23A",
      "#8E67C0"
    ),
    flagPlate: {
      shape: "inverted-plate",
      fill: "#1F232A",
      border: "#1F232A",
      borderWidth: 1,
      ink: "#FFFFFF",
      radius: 6
    },
    arrowShadow: {
      enabled: true,
      value: "0 1px 2px rgba(0,0,0,.18)"
    },
    headline: {
      color: "#1F232A",
      fontSize: 24,
      fontWeight: 700,
      fontFamily: INTER,
      rule: {
        color: MISSIONMED_GOLD,
        width: 24,
        position: "beneath"
      }
    },
    geometry: {
      arrowCornerRadius: 3,
      flagCornerRadius: 6
    }
  },
  {
    ordinal: "T5",
    id: "little-journeys",
    name: "Little Journeys",
    descriptor: "Warm, rounded, and still professional.",
    audience: "Pediatric",
    board: {
      kind: "linear-gradient",
      angle: 170,
      start: "#F4FAFD",
      end: "#EAF4F0",
      css: "linear-gradient(170deg, #F4FAFD 0%, #EAF4F0 100%)",
      contrastSurfaces: ["#F4FAFD", "#EAF4F0"]
    },
    axis: {
      color: "#3E5A6B",
      width: 2.5,
      lineCap: "round",
      endSerifHeight: 0
    },
    ticks: { color: "#9FB8C4" },
    yearLabel: {
      color: "#3E5A6B",
      fontSize: 19,
      fontWeight: 700,
      fontFamily: NUNITO,
      letterSpacing: "0"
    },
    ink: "#2E4552",
    categories: categories(
      "#3E7C96",
      "#4C7ECF",
      "#E0813F",
      "#4E9E6B",
      "#D3AC3B",
      "#9A6FCB"
    ),
    flagPlate: {
      shape: "rounded-pennant",
      /*
       * §8.2 freezes the rounded-pennant/radius change but does not replace the
       * canonical white plate paint. Keep the T1 paint and apply T5's own ink.
       */
      fill: "#FFFFFF",
      border: "#C6CFDB",
      borderWidth: 1,
      ink: "#2E4552",
      radius: 8
    },
    arrowShadow: {
      enabled: true,
      value: "0 1px 3px rgba(40,70,90,.15)"
    },
    headline: {
      color: "#2E4552",
      fontSize: 24,
      fontWeight: 800,
      fontFamily: NUNITO,
      rule: null
    },
    geometry: {
      arrowCornerRadius: 8,
      flagCornerRadius: 8
    }
  }
]);

export const THEMES_BY_ID = freezeDeep(
  Object.fromEntries(THEME_DEFINITIONS.map((theme) => [theme.id, theme]))
);

function themeFromReference(themeReference) {
  const id = typeof themeReference === "string"
    ? themeReference
    : themeReference?.id;
  const theme = THEMES_BY_ID[id];
  if (!theme) {
    throw new RangeError(
      `Unknown Timeline Builder theme "${String(id)}"; exactly five frozen themes ship.`
    );
  }
  return theme;
}

function ratiosForSurfaces(foreground, surfaces) {
  return surfaces.map((background) => ({
    foreground,
    background,
    ratio: contrastRatio(foreground, background),
    threshold: TEXT_CONTRAST_THRESHOLD,
    passes: contrastRatio(foreground, background) >= TEXT_CONTRAST_THRESHOLD
  }));
}

function roleEvidence(role, foreground, backgrounds) {
  const candidates = ratiosForSurfaces(foreground, backgrounds);
  const minimumRatio = Math.min(...candidates.map(({ ratio }) => ratio));
  return {
    role,
    originalToken: foreground,
    passingToken: foreground,
    candidates,
    calculatedContrast: minimumRatio,
    threshold: TEXT_CONTRAST_THRESHOLD,
    passes: minimumRatio >= TEXT_CONTRAST_THRESHOLD
  };
}

export function resolveArrowLabelContrast(themeReference, categoryId) {
  const theme = themeFromReference(themeReference);
  if (!CATEGORY_IDS.includes(categoryId)) {
    throw new RangeError(`Unknown Timeline Builder category "${String(categoryId)}".`);
  }
  const fill = theme.categories[categoryId];
  const whiteRatio = contrastRatio(WHITE, fill);
  const primaryInkRatio = contrastRatio(INK_PRIMARY, fill);
  let passingToken = null;
  let calculatedContrast = null;
  let placement = "above";
  let background = "board";
  let reason = "inside-candidates-fail-aa-render-bare-above";

  if (whiteRatio >= TEXT_CONTRAST_THRESHOLD) {
    passingToken = WHITE;
    calculatedContrast = whiteRatio;
    placement = "inside";
    background = fill;
    reason = "preferred-white-passes-aa";
  } else if (primaryInkRatio >= TEXT_CONTRAST_THRESHOLD) {
    passingToken = INK_PRIMARY;
    calculatedContrast = primaryInkRatio;
    placement = "inside";
    background = fill;
    reason = "white-fails-primary-ink-passes-aa";
  } else {
    const boardRatios = ratiosForSurfaces(
      theme.ink,
      theme.board.contrastSurfaces
    );
    passingToken = theme.ink;
    calculatedContrast = Math.min(...boardRatios.map(({ ratio }) => ratio));
  }

  return freezeDeep({
    themeId: theme.id,
    categoryId,
    fill,
    threshold: TEXT_CONTRAST_THRESHOLD,
    originalToken: WHITE,
    originalContrast: whiteRatio,
    originalPasses: whiteRatio >= TEXT_CONTRAST_THRESHOLD,
    passingToken,
    passingBackground: background,
    calculatedContrast,
    passes: calculatedContrast >= TEXT_CONTRAST_THRESHOLD,
    placement,
    reason,
    candidates: [
      {
        token: WHITE,
        background: fill,
        ratio: whiteRatio,
        passes: whiteRatio >= TEXT_CONTRAST_THRESHOLD
      },
      {
        token: INK_PRIMARY,
        background: fill,
        ratio: primaryInkRatio,
        passes: primaryInkRatio >= TEXT_CONTRAST_THRESHOLD
      }
    ]
  });
}

export function buildThemeContrastEvidence(themeReference) {
  const theme = themeFromReference(themeReference);
  const roles = [
    roleEvidence("outside-arrow-label", theme.ink, theme.board.contrastSurfaces),
    roleEvidence("year-label", theme.yearLabel.color, theme.board.contrastSurfaces),
    roleEvidence("headline", theme.headline.color, theme.board.contrastSurfaces),
    roleEvidence("flag-label", theme.flagPlate.ink, [theme.flagPlate.fill])
  ];
  const arrowLabels = Object.fromEntries(
    CATEGORY_IDS.map((categoryId) => [
      categoryId,
      resolveArrowLabelContrast(theme, categoryId)
    ])
  );
  return freezeDeep({
    candidateBound: true,
    themeId: theme.id,
    threshold: TEXT_CONTRAST_THRESHOLD,
    roles,
    arrowLabels,
    passes: roles.every(({ passes }) => passes) &&
      Object.values(arrowLabels).every(({ passes }) => passes)
  });
}

function sameFrozenValue(left, right) {
  if (Object.is(left, right)) return true;
  if (
    !left ||
    !right ||
    typeof left !== "object" ||
    typeof right !== "object" ||
    Array.isArray(left) !== Array.isArray(right)
  ) {
    return false;
  }
  if (Array.isArray(left)) {
    return left.length === right.length &&
      left.every((value, index) => sameFrozenValue(value, right[index]));
  }
  const leftKeys = Object.keys(left).sort();
  const rightKeys = Object.keys(right).sort();
  return leftKeys.length === rightKeys.length &&
    leftKeys.every((key, index) =>
      key === rightKeys[index] && sameFrozenValue(left[key], right[key])
    );
}

export function validateThemeDefinition(theme) {
  const errors = [];
  const themeId = String(theme?.id ?? "");
  const expected = THEMES_BY_ID[themeId];
  if (!expected) {
    errors.push(`Theme id "${themeId}" is not one of the five frozen themes.`);
  }
  if (!theme?.name || !theme?.descriptor) {
    errors.push("Theme name and descriptor are required.");
  }
  if (
    !Array.isArray(theme?.board?.contrastSurfaces) ||
    theme.board.contrastSurfaces.length === 0
  ) {
    errors.push("Theme board must expose at least one contrast surface.");
  }
  const categoryKeys = Object.keys(theme?.categories ?? {}).sort();
  if (
    categoryKeys.length !== CATEGORY_IDS.length ||
    !CATEGORY_IDS.every((categoryId) => categoryKeys.includes(categoryId))
  ) {
    errors.push("Theme must define all six frozen category colors exactly once.");
  }
  for (const token of [
    theme?.axis?.color,
    theme?.ticks?.color,
    theme?.yearLabel?.color,
    theme?.ink,
    theme?.flagPlate?.fill,
    theme?.flagPlate?.ink,
    theme?.headline?.color
  ]) {
    if (!/^#[0-9A-F]{6}$/i.test(String(token ?? ""))) {
      errors.push(`Invalid color token "${String(token)}".`);
    }
  }
  if (expected && !sameFrozenValue(theme, expected)) {
    errors.push(`Theme "${themeId}" differs from the frozen §8.2 definition.`);
  }
  let contrast = null;
  if (expected) {
    contrast = buildThemeContrastEvidence(expected);
    if (!contrast.passes) {
      errors.push(`Theme "${themeId}" has board-label contrast below 4.5:1.`);
    }
  }
  return {
    valid: errors.length === 0,
    errors,
    contrast
  };
}

export function validateFrozenThemeCatalog(catalog = THEME_DEFINITIONS) {
  const errors = [];
  if (!Array.isArray(catalog) || catalog.length !== 5) {
    errors.push("Exactly five themes must ship.");
  }
  const list = Array.isArray(catalog) ? catalog : [];
  const ids = list.map(({ id } = {}) => id);
  if (new Set(ids).size !== ids.length) {
    errors.push("Theme ids must be unique.");
  }
  const validations = list.map((theme) => ({
    id: theme?.id ?? null,
    ...validateThemeDefinition(theme)
  }));
  for (const validation of validations) {
    errors.push(...validation.errors);
  }
  for (const expected of THEME_DEFINITIONS) {
    if (!ids.includes(expected.id)) {
      errors.push(`Frozen theme "${expected.id}" is missing.`);
    }
  }
  return {
    valid: errors.length === 0,
    errors,
    validations
  };
}

function arrowPath(arrow, radius) {
  const x = Number(arrow.x);
  const x2 = Number(arrow.x2);
  const centerY = Number(arrow.centerY);
  const shaftHeight = Number(arrow.shaftHeight);
  if (![x, x2, centerY, shaftHeight].every(Number.isFinite)) {
    return arrow.path;
  }
  const top = centerY - shaftHeight / 2;
  const bottom = centerY + shaftHeight / 2;
  if (arrow.openEnded) {
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
  const headLength = Number(arrow.headLength);
  const headHeight = Number(arrow.headHeight);
  if (![headLength, headHeight].every(Number.isFinite)) return arrow.path;
  const headTop = centerY - headHeight / 2;
  const headBottom = centerY + headHeight / 2;
  const headBase = x2 - headLength;
  return [
    `M ${x + radius} ${top}`,
    `H ${headBase}`,
    `V ${headTop}`,
    `L ${x2} ${centerY}`,
    `L ${headBase} ${headBottom}`,
    `V ${bottom}`,
    `H ${x + radius}`,
    `Q ${x} ${bottom} ${x} ${bottom - radius}`,
    `V ${top + radius}`,
    `Q ${x} ${top} ${x + radius} ${top}`,
    "Z"
  ].join(" ");
}

function applyThemeToArrow(arrow, theme) {
  const evidence = resolveArrowLabelContrast(theme, arrow.categoryId);
  const next = cloneValue(arrow);
  const fits = Number(next.label?.textWidth) <= Number(next.label?.availableInside);
  const inside = Boolean(
    !next.study &&
    fits &&
    evidence.placement === "inside"
  );
  const fontSize = next.condensed ? 11 : inside ? 12.5 : 11.5;
  const shaftWidth = Number(next.width) - Number(next.headLength || 0);
  next.fill = theme.categories[next.categoryId];
  next.leftRadius = theme.geometry.arrowCornerRadius;
  next.path = arrowPath(next, next.leftRadius);
  next.arrowShadow = cloneValue(theme.arrowShadow);
  next.label = {
    ...next.label,
    text: String(next.label?.fullText ?? next.label?.text ?? ""),
    placement: inside ? "inside" : "above",
    color: inside ? evidence.passingToken : theme.ink,
    fontSize,
    fontWeight: 600,
    x: inside ? Number(next.x) + shaftWidth / 2 : Number(next.x),
    y: inside
      ? Number(next.centerY) + fontSize * 0.34
      : Number(next.centerY) -
        Number(next.openEnded ? next.shaftHeight : next.headHeight) / 2 -
        4,
    textAnchor: inside ? "middle" : "start",
    contrast: {
      threshold: TEXT_CONTRAST_THRESHOLD,
      white: evidence.candidates[0].ratio,
      primaryInk: evidence.candidates[1].ratio,
      chosen: inside ? evidence.calculatedContrast : null,
      boardMinimum: inside ? null : evidence.calculatedContrast
    },
    reason: inside
      ? evidence.reason
      : next.study
        ? "patterned-fill-requires-bare-above-label"
        : !fits
          ? "does-not-fit-shaft-padding"
          : evidence.reason
  };
  return next;
}

function applyThemeToFlag(flag, theme) {
  const next = cloneValue(flag);
  const categoryColor = theme.categories[next.categoryId];
  if (!categoryColor) {
    throw new RangeError(`Unknown Timeline Builder category "${String(next.categoryId)}".`);
  }
  next.pole = {
    ...next.pole,
    color: categoryColor
  };
  next.plate = {
    ...next.plate,
    shape: theme.flagPlate.shape,
    fill: theme.flagPlate.fill,
    border: theme.flagPlate.border,
    borderWidth: theme.flagPlate.borderWidth,
    radius: theme.geometry.flagCornerRadius
  };
  next.label = {
    ...next.label,
    color: theme.flagPlate.ink
  };
  return next;
}

export function applyThemeToScene(scene, themeReference) {
  if (!scene?.board || !scene?.axis || !Array.isArray(scene?.arrows)) {
    throw new TypeError("applyThemeToScene requires a canonical M4 board scene.");
  }
  const theme = themeFromReference(themeReference);
  const next = cloneValue(scene);
  next.theme = theme;
  next.board = {
    ...next.board,
    background: theme.board
  };
  next.headline = {
    ...next.headline,
    ...theme.headline
  };
  next.axis = {
    ...next.axis,
    style: {
      color: theme.axis.color,
      width: theme.axis.width,
      lineCap: theme.axis.lineCap,
      endSerifHeight: theme.axis.endSerifHeight
    },
    tickStyle: cloneValue(theme.ticks),
    yearLabelStyle: cloneValue(theme.yearLabel),
    boundaries: (next.axis.boundaries ?? []).map((boundary) => ({
      ...boundary,
      color: theme.axis.color,
      lineCap: theme.axis.lineCap,
      serifHeight: theme.axis.endSerifHeight
    })),
    ticks: (next.axis.ticks ?? []).map((tick) => ({
      ...tick,
      color: theme.ticks.color
    })),
    segments: (next.axis.segments ?? []).map((segment) => ({
      ...segment,
      yearLabelStyle: cloneValue(theme.yearLabel)
    }))
  };
  next.arrows = next.arrows.map((arrow) => applyThemeToArrow(arrow, theme));
  next.flags = (next.flags ?? []).map((flag) => applyThemeToFlag(flag, theme));
  next.events = [...next.arrows, ...next.flags];
  if (next.interviewMarker) {
    next.interviewMarker = {
      ...next.interviewMarker,
      pole: {
        ...next.interviewMarker.pole,
        color: theme.axis.color
      },
      plate: {
        ...next.interviewMarker.plate,
        shape: theme.flagPlate.shape,
        fill: theme.flagPlate.fill,
        border: theme.flagPlate.border,
        borderWidth: theme.flagPlate.borderWidth,
        radius: theme.geometry.flagCornerRadius
      },
      label: {
        ...next.interviewMarker.label,
        color: theme.flagPlate.ink
      }
    };
  }
  if (typeof next.accessibility?.description === "string") {
    next.accessibility.description = next.accessibility.description.replace(
      / in Keynote Classic\.$/,
      ` in ${theme.name}.`
    );
  }
  next.themeApplication = {
    scope: "board-only",
    themeId: theme.id,
    shellChanged: false,
    contrast: buildThemeContrastEvidence(theme)
  };
  return next;
}

export function applyThemeToTimelineRender(
  render,
  themeReference,
  { serializeScene = null } = {}
) {
  if (!render?.scene) {
    throw new TypeError("applyThemeToTimelineRender requires a render with a scene.");
  }
  const next = cloneValue(render);
  next.scene = applyThemeToScene(render.scene, themeReference);
  if (serializeScene != null && typeof serializeScene !== "function") {
    throw new TypeError("serializeScene must be a function when provided.");
  }
  next.svg = serializeScene ? serializeScene(next.scene) : null;
  next.serializationRequired = !serializeScene;
  return next;
}

function sceneEventIds(scene) {
  return (scene?.events ?? [])
    .map((event) => String(event?.id ?? ""))
    .filter(Boolean);
}

export function buildThemePickerModel({
  scene,
  activeThemeId = DEFAULT_THEME_ID,
  mode = "guided",
  createMiniature = null
} = {}) {
  if (!scene?.board || !Array.isArray(scene?.events)) {
    throw new TypeError(
      "buildThemePickerModel requires the student's canonical board scene."
    );
  }
  const activeTheme = themeFromReference(activeThemeId);
  const normalizedMode = String(mode).toLowerCase();
  if (normalizedMode !== "guided" && normalizedMode !== "advanced") {
    throw new RangeError('Theme picker mode must be "guided" or "advanced".');
  }
  if (createMiniature != null && typeof createMiniature !== "function") {
    throw new TypeError("createMiniature must be a function when provided.");
  }
  const eventIds = sceneEventIds(scene);
  const themeCards = THEME_DEFINITIONS.map((theme) => {
    const themedScene = applyThemeToScene(scene, theme);
    const miniatureInput = {
      source: "student-board",
      renderer: scene.renderer,
      eventIds: eventIds.slice(),
      eventCount: eventIds.length,
      studentName: String(scene.headline?.text ?? ""),
      width: THEME_PICKER_CARD_SIZE.width,
      height: THEME_PICKER_CARD_SIZE.height,
      scene: themedScene
    };
    return {
      kind: "theme",
      themeId: theme.id,
      name: theme.name,
      descriptor: theme.descriptor,
      interactive: true,
      action: { type: "select-theme", themeId: theme.id },
      active: theme.id === activeTheme.id,
      border: theme.id === activeTheme.id ? "gold" : "default",
      check: theme.id === activeTheme.id,
      dimensions: THEME_PICKER_CARD_SIZE,
      miniatureInput,
      miniature: createMiniature
        ? createMiniature(miniatureInput)
        : miniatureInput
    };
  });
  const finalCell = normalizedMode === "guided"
    ? {
      kind: "advanced-teaser",
      title: "Your background — Advanced Studio",
      name: "Your background",
      descriptor: "Advanced Studio",
      interactive: false,
      locked: true,
      lockGlyph: "lock",
      action: null
    }
    : {
      kind: "backgrounds-entry",
      title: "Backgrounds",
      name: "Backgrounds",
      descriptor: "Advanced Studio",
      interactive: true,
      locked: false,
      lockGlyph: null,
      action: { type: "open-backgrounds" }
    };
  return {
    mode: normalizedMode,
    columns: THEME_PICKER_LAYOUT.columns,
    rows: THEME_PICKER_LAYOUT.rows,
    themeCount: themeCards.length,
    cells: [...themeCards, finalCell]
  };
}

export function createThemeSelectionChange(previousThemeId, nextThemeId) {
  const previous = themeFromReference(previousThemeId);
  const next = themeFromReference(nextThemeId);
  if (previous.id === next.id) return null;
  return freezeDeep({
    type: "theme-change",
    label: `Theme changed to ${next.name}`,
    previousThemeId: previous.id,
    nextThemeId: next.id,
    undo: { theme: previous.id },
    redo: { theme: next.id }
  });
}

export function applyThemeSelection(timeline, nextThemeId) {
  if (!timeline || typeof timeline !== "object" || Array.isArray(timeline)) {
    throw new TypeError("applyThemeSelection requires a timeline object.");
  }
  const previousThemeId = themeFromReference(
    timeline.theme ?? DEFAULT_THEME_ID
  ).id;
  const next = themeFromReference(nextThemeId);
  const historyEntry = createThemeSelectionChange(previousThemeId, next.id);
  return {
    timeline: {
      ...cloneValue(timeline),
      theme: next.id
    },
    historyEntry,
    changed: Boolean(historyEntry)
  };
}

export function replayThemeSelection(timeline, historyEntry, direction = "undo") {
  if (historyEntry?.type !== "theme-change") {
    throw new TypeError("replayThemeSelection requires a theme-change history entry.");
  }
  if (direction !== "undo" && direction !== "redo") {
    throw new RangeError('Theme replay direction must be "undo" or "redo".');
  }
  const targetThemeId = direction === "undo"
    ? historyEntry.previousThemeId
    : historyEntry.nextThemeId;
  return {
    ...cloneValue(timeline),
    theme: themeFromReference(targetThemeId).id
  };
}

export function evaluateAdvisorPaperPdfSuggestion({
  format,
  activeThemeId,
  suggestionState = {}
} = {}) {
  const state = {
    ...cloneValue(suggestionState),
    advisorPaperPdfSuggestionShown: Boolean(
      suggestionState?.advisorPaperPdfSuggestionShown
    )
  };
  const isPdf = String(format ?? "").trim().toLowerCase() === "pdf";
  const active = themeFromReference(activeThemeId ?? DEFAULT_THEME_ID);
  const shouldOffer = Boolean(
    isPdf &&
    active.id !== ADVISOR_PAPER_THEME_ID &&
    !state.advisorPaperPdfSuggestionShown
  );
  if (!shouldOffer) {
    return {
      offered: false,
      suggestion: null,
      suggestionState: state
    };
  }
  return {
    offered: true,
    suggestion: ADVISOR_PAPER_PDF_SUGGESTION,
    suggestionState: {
      ...state,
      advisorPaperPdfSuggestionShown: true
    }
  };
}

export function resolveAdvisorPaperPdfSuggestion(
  timeline,
  evaluatedSuggestion,
  resolution
) {
  if (!evaluatedSuggestion?.offered) {
    throw new TypeError("No Advisor Paper PDF suggestion is awaiting resolution.");
  }
  if (resolution !== "apply" && resolution !== "dismiss") {
    throw new RangeError('Suggestion resolution must be "apply" or "dismiss".');
  }
  const selection = resolution === "apply"
    ? applyThemeSelection(timeline, ADVISOR_PAPER_THEME_ID)
    : {
      timeline: cloneValue(timeline),
      historyEntry: null,
      changed: false
    };
  return {
    ...selection,
    suggestionState: cloneValue(evaluatedSuggestion.suggestionState),
    resolution
  };
}
