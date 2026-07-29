import {escapeHtml} from "./utils.js";

function freezeDeep(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) freezeDeep(child);
  return Object.freeze(value);
}

export const RESPONSIVE_BREAKPOINTS = freezeDeep({
  full:1440,
  compressed:1280,
  desktop:1024,
  tablet:768
});

export const RESPONSIVE_TIERS = freezeDeep([
  {id:"full",min:1440,max:null},
  {id:"compressed",min:1280,max:1439},
  {id:"desktop-overlay",min:1024,max:1279},
  {id:"tablet",min:768,max:1023},
  {id:"phone",min:0,max:767}
]);

export const RESPONSIVE_MEDIA_QUERIES = freezeDeep({
  reducedMotion:"(prefers-reduced-motion: reduce)",
  higherContrast:"(prefers-contrast: more)",
  forcedColors:"(forced-colors: active)",
  coarsePointer:"(pointer: coarse)",
  hover:"(hover: hover)"
});

export const RESPONSIVE_SCREEN_IDS = freezeDeep([
  "home",
  "builder",
  "intake",
  "canvas",
  "export"
]);

export const RESPONSIVE_BANNER = "Editing needs a larger screen.";

export const ACCESSIBILITY_BASELINE = freezeDeep({
  standard:"WCAG 2.2 AA",
  language:"en",
  keyboardOperable:true,
  imagery:"decorative-or-labeled",
  exactlyOneH1PerScreen:true,
  headingLevelsNeverSkip:true,
  mutationAnnouncements:"polite"
});

export const FOCUS_VISIBLE_CONTRACT = freezeDeep({
  selector:'a:focus-visible, button:focus-visible, input:focus-visible, select:focus-visible, textarea:focus-visible, [tabindex]:not([tabindex="-1"]):focus-visible',
  color:"#2F6FED",
  forcedColorsFallback:"Highlight",
  outlineStyle:"solid",
  outlineWidth:2,
  outlineOffset:2,
  minimumAdjacentContrast:3,
  routeTarget:"one screen h1",
  routeTargetTabIndex:-1,
  boardObjectsIncluded:true,
  alwaysVisibleWhenFocusVisible:true
});

export const TOUCH_CONTRACT = freezeDeep({
  minimumTargetCssPx:44,
  dragSlopCssPx:8,
  contextualToolbarBelowWidth:1024,
  contextualToolbarPresentation:"bottom-sheet"
});

export const MOTION_CONTRACT = freezeDeep({
  hoverPressMs:160,
  layoutMs:240,
  popoverMs:200,
  easing:{
    hoverPress:"ease-out",
    layout:"ease-in-out",
    popover:"ease-out"
  },
  maxFlashHz:3,
  parallax:false,
  reducedDisables:[
    "all-css-animation",
    "all-css-transition",
    "adaptive-width",
    "arrow-settle",
    "popover-rise",
    "pulse-highlight",
    "gif-autoplay",
    "smooth-scroll"
  ],
  reducedGifPresentation:"first-frame-with-play-badge"
});

export const REFLOW_EVIDENCE_CONTRACT = freezeDeep({
  effectiveZoomPercents:[200,400],
  documentHorizontalOverflowAllowed:false,
  boardPanContained:true,
  controlsRemainKeyboardReachable:true,
  contentMustNotClipOrOverlap:true
});

const SCREEN_CAPABILITIES = freezeDeep({
  all:["view","edit"],
  canvasInteractive:["view","edit","pan","zoom","theme"],
  canvasTablet:["view","pan","zoom","theme"],
  canvasPhone:["view"],
  exportInteractive:["view","edit","export"],
  exportPhone:["view"]
});

function finiteDimension(value,name) {
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0) {
    throw new TypeError(`${name} must be a finite non-negative CSS-pixel value.`);
  }
  return number;
}

function orientationFor(width,height) {
  return width > height ? "landscape" : "portrait";
}

export function responsiveTier(width) {
  const normalized = finiteDimension(width,"width");
  return RESPONSIVE_TIERS.find((tier) => normalized >= tier.min && (
    tier.max == null || normalized <= tier.max
  ));
}

export function normalizeViewport({
  width,
  height = width,
  effectiveZoomPercent = 100
} = {}) {
  const normalizedWidth = finiteDimension(width,"width");
  const normalizedHeight = finiteDimension(height,"height");
  const zoom = Number(effectiveZoomPercent);
  if (!Number.isFinite(zoom) || zoom <= 0) {
    throw new TypeError("effectiveZoomPercent must be a positive number.");
  }
  return freezeDeep({
    width:normalizedWidth,
    height:normalizedHeight,
    orientation:orientationFor(normalizedWidth,normalizedHeight),
    capabilityAxis:"width",
    orientationChangesProductTier:false,
    effectiveZoomPercent:zoom
  });
}

export function motionPolicy(reducedMotion = false) {
  const reduced = Boolean(reducedMotion);
  return freezeDeep({
    reduced,
    durations:{
      hoverPressMs:reduced ? 0 : MOTION_CONTRACT.hoverPressMs,
      layoutMs:reduced ? 0 : MOTION_CONTRACT.layoutMs,
      popoverMs:reduced ? 0 : MOTION_CONTRACT.popoverMs
    },
    adaptiveWidthAnimation:!reduced,
    arrowSettleAnimation:!reduced,
    popoverRise:!reduced,
    pulseHighlights:!reduced,
    cssAnimation:!reduced,
    cssTransition:!reduced,
    smoothScroll:!reduced,
    gifAutoplay:!reduced,
    gifPresentation:reduced
      ? MOTION_CONTRACT.reducedGifPresentation
      : "animated",
    parallax:false,
    maxFlashHz:MOTION_CONTRACT.maxFlashHz,
    cssVariables:{
      "--motion-fast":reduced
        ? "0ms"
        : `${MOTION_CONTRACT.hoverPressMs}ms ${MOTION_CONTRACT.easing.hoverPress}`,
      "--motion-layout":reduced
        ? "0ms"
        : `${MOTION_CONTRACT.layoutMs}ms ${MOTION_CONTRACT.easing.layout}`,
      "--motion-popover":reduced
        ? "0ms"
        : `${MOTION_CONTRACT.popoverMs}ms ${MOTION_CONTRACT.easing.popover}`,
      "--adaptive-width-duration":`${reduced ? 0 : MOTION_CONTRACT.layoutMs}ms`,
      "--arrow-settle-duration":`${reduced ? 0 : MOTION_CONTRACT.layoutMs}ms`,
      "--popover-rise-duration":`${reduced ? 0 : MOTION_CONTRACT.popoverMs}ms`
    }
  });
}

export function contrastPreferencePolicy({
  higherContrast = false,
  forcedColors = false
} = {}) {
  const forced = Boolean(forcedColors);
  const more = Boolean(higherContrast);
  const mode = forced ? "forced-colors" : more ? "more" : "standard";
  return freezeDeep({
    mode,
    higherContrast:more || forced,
    forcedColors:forced,
    preserveProductHierarchy:true,
    preserveTextLabels:true,
    categoryNeverColorOnly:true,
    preserveSemanticBorders:true,
    authorPalette:forced ? "system-controlled" : "frozen",
    focusRing:{
      ...FOCUS_VISIBLE_CONTRACT,
      effectiveColor:forced
        ? FOCUS_VISIBLE_CONTRACT.forcedColorsFallback
        : FOCUS_VISIBLE_CONTRACT.color
    }
  });
}

function navigationForTier(tier) {
  const bottom = tier.id === "tablet" || tier.id === "phone";
  return freezeDeep({
    placement:bottom ? "bottom-tab-bar" : "side-rail",
    itemCount:4,
    labels:["Home","Builder","Canvas","Export"],
    footer:false
  });
}

function homeCapability(tier) {
  return freezeDeep({
    functional:true,
    contentMode:"full",
    layout:["desktop-overlay","tablet","phone"].includes(tier.id)
      ? "stacked"
      : "three-region-grid",
    regionsABStacked:["desktop-overlay","tablet","phone"].includes(tier.id)
  });
}

function builderCapability(tier) {
  const pane = tier.id === "full" || tier.id === "compressed";
  return freezeDeep({
    functional:true,
    contentMode:"full",
    preview:pane ? "live-pane" : "overlay-sheet",
    previewVisibleByDefault:pane,
    previewTrigger:pane ? null : "Show preview",
    previewMinimumWidth:pane ? 420 : null,
    formColumnWidth:tier.id === "compressed" ? 480 : null
  });
}

function intakeCapability() {
  return freezeDeep({
    functional:true,
    contentMode:"full"
  });
}

function canvasCapability(tier) {
  if (tier.id === "tablet") {
    return freezeDeep({
      functional:true,
      contentMode:"view-only",
      editing:false,
      pan:true,
      zoom:true,
      themePicker:true,
      banner:RESPONSIVE_BANNER,
      capabilities:SCREEN_CAPABILITIES.canvasTablet
    });
  }
  if (tier.id === "phone") {
    return freezeDeep({
      functional:true,
      contentMode:"preview-only",
      editing:false,
      pan:false,
      zoom:false,
      themePicker:false,
      banner:RESPONSIVE_BANNER,
      capabilities:SCREEN_CAPABILITIES.canvasPhone
    });
  }
  return freezeDeep({
    functional:true,
    contentMode:"interactive",
    editing:true,
    pan:true,
    zoom:true,
    themePicker:true,
    banner:null,
    capabilities:SCREEN_CAPABILITIES.canvasInteractive
  });
}

function exportCapability(tier) {
  if (tier.id === "phone") {
    return freezeDeep({
      functional:true,
      contentMode:"preview-only",
      editing:false,
      banner:RESPONSIVE_BANNER,
      capabilities:SCREEN_CAPABILITIES.exportPhone
    });
  }
  return freezeDeep({
    functional:true,
    contentMode:"full",
    editing:true,
    banner:null,
    capabilities:SCREEN_CAPABILITIES.exportInteractive
  });
}

export function buildResponsiveModel({
  width,
  height = width,
  effectiveZoomPercent = 100,
  touch = false,
  maxTouchPoints = 0,
  pointer = "fine",
  hover = true,
  reducedMotion = false,
  higherContrast = false,
  forcedColors = false
} = {}) {
  const viewport = normalizeViewport({width,height,effectiveZoomPercent});
  const tier = responsiveTier(viewport.width);
  const touchEnabled = Boolean(touch) || Number(maxTouchPoints) > 0 || pointer === "coarse";
  const motion = motionPolicy(reducedMotion);
  const contrast = contrastPreferencePolicy({higherContrast,forcedColors});
  const contextToolbar = touchEnabled && viewport.width < TOUCH_CONTRACT.contextualToolbarBelowWidth
    ? TOUCH_CONTRACT.contextualToolbarPresentation
    : "floating-pill";

  return freezeDeep({
    accessibility:ACCESSIBILITY_BASELINE,
    viewport,
    tier,
    content:{
      maximumWidth:1440,
      centered:true
    },
    navigation:navigationForTier(tier),
    touch:{
      enabled:touchEnabled,
      pointer:touchEnabled ? "coarse" : String(pointer || "fine"),
      hover:Boolean(hover),
      minimumTargetCssPx:touchEnabled ? TOUCH_CONTRACT.minimumTargetCssPx : null,
      dragSlopCssPx:touchEnabled ? TOUCH_CONTRACT.dragSlopCssPx : 0,
      contextualToolbar:contextToolbar
    },
    motion,
    contrast,
    focus:contrast.focusRing,
    screens:freezeDeep({
      home:homeCapability(tier),
      builder:builderCapability(tier),
      intake:intakeCapability(),
      canvas:canvasCapability(tier),
      export:exportCapability(tier)
    }),
    reflow:REFLOW_EVIDENCE_CONTRACT,
    features:{
      emailReminder:false
    }
  });
}

export function screenCapability(model,screen) {
  const id = String(screen || "").toLowerCase();
  if (!RESPONSIVE_SCREEN_IDS.includes(id)) {
    throw new TypeError(`Unknown responsive screen: ${String(screen)}`);
  }
  if (!model?.screens?.[id]) {
    throw new TypeError("A responsive model is required.");
  }
  return model.screens[id];
}

export function isResponsiveCapabilityAllowed(model,screen,capability) {
  const contract = screenCapability(model,screen);
  const requested = String(capability || "");
  const capabilities = contract.capabilities || SCREEN_CAPABILITIES.all;
  return capabilities.includes(requested);
}

export function responsiveActionCapability(action) {
  const normalized = String(action || "").toLowerCase();
  if (["theme","theme-picker"].includes(normalized)) return "theme";
  if (["zoom","zoom-in","zoom-out","fit"].includes(normalized)) return "zoom";
  if (["pan","board-pan"].includes(normalized)) return "pan";
  if (["view","preview","open-builder"].includes(normalized)) return "view";
  if (["export","download","print"].includes(normalized)) return "export";
  return "edit";
}

export function responsiveRenderContract(model,screen) {
  const capability = screenCapability(model,screen);
  return freezeDeep({
    screen:String(screen).toLowerCase(),
    tier:model.tier.id,
    orientation:model.viewport.orientation,
    contentMode:capability.contentMode,
    banner:capability.banner || null,
    emailReminder:false,
    attributes:{
      "data-responsive-screen":String(screen).toLowerCase(),
      "data-responsive-tier":model.tier.id,
      "data-responsive-mode":capability.contentMode,
      "data-viewport-orientation":model.viewport.orientation
    }
  });
}

export function renderResponsiveNotice(model,screen) {
  const contract = responsiveRenderContract(model,screen);
  if (!contract.banner) return "";
  return `<div class="responsive-accessibility-banner" role="status" data-responsive-banner>${escapeHtml(contract.banner)}</div>`;
}

function attributeMarkup(attributes) {
  return Object.entries(attributes)
    .map(([name,value]) => `${name}="${escapeHtml(value)}"`)
    .join(" ");
}

export function renderResponsiveFrame({
  model,
  screen,
  fullContent = "",
  viewOnlyContent = null,
  previewContent = null
} = {}) {
  const contract = responsiveRenderContract(model,screen);
  let content = fullContent;
  if (contract.contentMode === "view-only") {
    if (viewOnlyContent == null) {
      const error = new Error("View-only responsive content is required.");
      error.code = "D1_UXR_002_RESPONSIVE_VIEW_ONLY_CONTENT_REQUIRED";
      throw error;
    }
    content = viewOnlyContent;
  } else if (contract.contentMode === "preview-only") {
    if (previewContent == null) {
      const error = new Error("Preview-only responsive content is required.");
      error.code = "D1_UXR_002_RESPONSIVE_PREVIEW_CONTENT_REQUIRED";
      throw error;
    }
    content = previewContent;
  }
  return `<div class="responsive-screen-frame" ${attributeMarkup(contract.attributes)}>
    ${renderResponsiveNotice(model,screen)}
    <div class="responsive-screen-content" data-content-mode="${contract.contentMode}">${String(content)}</div>
  </div>`;
}

function setDataset(target,key,value) {
  if (target?.dataset) target.dataset[key] = String(value);
  else target?.setAttribute?.(
    `data-${key.replace(/[A-Z]/g,(letter) => `-${letter.toLowerCase()}`)}`,
    String(value)
  );
}

function setStyleProperty(target,name,value) {
  target?.style?.setProperty?.(name,String(value));
}

export function applyResponsiveAttributes(target,model) {
  if (!target) throw new TypeError("A responsive attribute target is required.");
  target.setAttribute?.("lang","en");
  setDataset(target,"responsiveTier",model.tier.id);
  setDataset(target,"viewportOrientation",model.viewport.orientation);
  setDataset(target,"responsiveAxis","width");
  setDataset(target,"navigationPlacement",model.navigation.placement);
  setDataset(target,"touch",model.touch.enabled);
  setDataset(target,"contextToolbar",model.touch.contextualToolbar);
  setDataset(target,"reducedMotion",model.motion.reduced);
  setDataset(target,"gifAutoplay",model.motion.gifAutoplay ? "allowed" : "suppressed");
  setDataset(target,"contrastMode",model.contrast.mode);
  setDataset(target,"forcedColors",model.contrast.forcedColors);

  setStyleProperty(target,"--content-max-width","1440px");
  setStyleProperty(
    target,
    "--touch-target-min",
    model.touch.enabled ? `${TOUCH_CONTRACT.minimumTargetCssPx}px` : "0px"
  );
  setStyleProperty(target,"--touch-drag-slop",`${model.touch.dragSlopCssPx}px`);
  setStyleProperty(target,"--focus-ring",model.focus.effectiveColor);
  setStyleProperty(target,"--focus-ring-width",`${FOCUS_VISIBLE_CONTRACT.outlineWidth}px`);
  setStyleProperty(target,"--focus-ring-offset",`${FOCUS_VISIBLE_CONTRACT.outlineOffset}px`);
  for (const [name,value] of Object.entries(model.motion.cssVariables)) {
    setStyleProperty(target,name,value);
  }
  return model;
}

function mediaQuery(windowObject,query) {
  if (typeof windowObject?.matchMedia === "function") return windowObject.matchMedia(query);
  return {
    matches:false,
    addEventListener(){},
    removeEventListener(){}
  };
}

function addListener(target,type,listener,options) {
  target?.addEventListener?.(type,listener,options);
  return () => target?.removeEventListener?.(type,listener,options);
}

function addMediaListener(query,listener) {
  if (typeof query?.addEventListener === "function") {
    query.addEventListener("change",listener);
    return () => query.removeEventListener?.("change",listener);
  }
  query?.addListener?.(listener);
  return () => query?.removeListener?.(listener);
}

function modelSignature(model) {
  return JSON.stringify(model);
}

export function installResponsiveRuntime({
  windowObject = globalThis.window,
  documentObject = globalThis.document,
  target = documentObject?.documentElement,
  onChange = () => {},
  onMotionChange = () => {},
  onContrastChange = () => {}
} = {}) {
  if (!windowObject || !target) {
    throw new TypeError("installResponsiveRuntime requires window and document-element targets.");
  }

  const queries = {
    reducedMotion:mediaQuery(windowObject,RESPONSIVE_MEDIA_QUERIES.reducedMotion),
    higherContrast:mediaQuery(windowObject,RESPONSIVE_MEDIA_QUERIES.higherContrast),
    forcedColors:mediaQuery(windowObject,RESPONSIVE_MEDIA_QUERIES.forcedColors),
    coarsePointer:mediaQuery(windowObject,RESPONSIVE_MEDIA_QUERIES.coarsePointer),
    hover:mediaQuery(windowObject,RESPONSIVE_MEDIA_QUERIES.hover)
  };
  const cleanups = [];
  let state = null;
  let signature = "";
  let priorReduced;
  let priorContrast;
  let destroyed = false;

  const read = () => buildResponsiveModel({
    width:Number(windowObject.innerWidth || 0),
    height:Number(windowObject.innerHeight || windowObject.innerWidth || 0),
    maxTouchPoints:Number(windowObject.navigator?.maxTouchPoints || 0),
    pointer:queries.coarsePointer.matches ? "coarse" : "fine",
    hover:queries.hover.matches,
    reducedMotion:queries.reducedMotion.matches,
    higherContrast:queries.higherContrast.matches,
    forcedColors:queries.forcedColors.matches
  });

  const refresh = () => {
    if (destroyed) return state;
    const next = read();
    const nextSignature = modelSignature(next);
    if (nextSignature === signature) return state;
    state = next;
    signature = nextSignature;
    applyResponsiveAttributes(target,state);
    if (priorReduced !== state.motion.reduced) {
      priorReduced = state.motion.reduced;
      onMotionChange(state.motion,state);
    }
    if (priorContrast !== state.contrast.mode) {
      priorContrast = state.contrast.mode;
      onContrastChange(state.contrast,state);
    }
    onChange(state);
    return state;
  };

  const preferenceChanged = () => refresh();
  cleanups.push(addListener(windowObject,"resize",refresh));
  cleanups.push(addListener(windowObject,"orientationchange",refresh));
  for (const query of Object.values(queries)) {
    cleanups.push(addMediaListener(query,preferenceChanged));
  }

  const keyboardInput = (event) => {
    if (event.metaKey || event.ctrlKey || event.altKey) return;
    setDataset(target,"inputModality","keyboard");
  };
  const pointerInput = () => setDataset(target,"inputModality","pointer");
  cleanups.push(addListener(documentObject,"keydown",keyboardInput,true));
  cleanups.push(addListener(documentObject,"pointerdown",pointerInput,true));
  setDataset(target,"inputModality","pointer");
  refresh();

  return {
    get state(){return state;},
    get queries(){return {...queries};},
    refresh,
    destroy(){
      if (destroyed) return;
      destroyed = true;
      for (const cleanup of cleanups.splice(0)) cleanup();
    }
  };
}

export const FOCUSABLE_SELECTOR = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  '[tabindex]:not([tabindex="-1"])'
].join(",");

export function headingOutlineIssues(levels) {
  const normalized = (levels || []).map(Number).filter((level) => (
    Number.isInteger(level) && level >= 1 && level <= 6
  ));
  const issues = [];
  if (normalized.filter((level) => level === 1).length !== 1) {
    issues.push("Every screen requires exactly one h1.");
  }
  for (let index = 1; index < normalized.length; index += 1) {
    if (normalized[index] > normalized[index - 1] + 1) {
      issues.push(
        `Heading level skips from h${normalized[index - 1]} to h${normalized[index]}.`
      );
    }
  }
  return issues;
}

export function focusScreenHeading(
  screenRoot,
  {
    previousViewKey = null,
    nextViewKey,
    preventScroll = true
  } = {}
) {
  if (previousViewKey != null && previousViewKey === nextViewKey) {
    return freezeDeep({focused:false,reason:"view-unchanged"});
  }
  const headings = [...(screenRoot?.querySelectorAll?.("h1") || [])]
    .filter((heading) => !heading.hidden && heading.getAttribute?.("aria-hidden") !== "true");
  if (headings.length !== 1) {
    return freezeDeep({
      focused:false,
      reason:"invalid-h1-count",
      count:headings.length
    });
  }
  const heading = headings[0];
  heading.tabIndex = FOCUS_VISIBLE_CONTRACT.routeTargetTabIndex;
  heading.focus?.({preventScroll});
  return freezeDeep({
    focused:true,
    reason:"view-changed",
    id:heading.id || null,
    preventScroll
  });
}

export function installFocusTrap(
  container,
  {
    opener = globalThis.document?.activeElement || null,
    onEscape = () => {},
    restoreFocus = true,
    initialFocus = true
  } = {}
) {
  if (!container?.addEventListener || !container?.querySelectorAll) {
    throw new TypeError("installFocusTrap requires a focusable container.");
  }
  let active = true;
  const focusable = () => [...container.querySelectorAll(FOCUSABLE_SELECTOR)]
    .filter((element) => !element.hidden && element.getAttribute?.("aria-hidden") !== "true");
  const restore = () => {
    if (restoreFocus && opener?.isConnected !== false) opener?.focus?.();
  };
  const keydown = (event) => {
    if (!active) return;
    if (event.key === "Escape") {
      event.preventDefault();
      onEscape();
      restore();
      return;
    }
    if (event.key !== "Tab") return;
    const items = focusable();
    if (!items.length) {
      event.preventDefault();
      return;
    }
    const first = items[0];
    const last = items.at(-1);
    if (event.shiftKey && event.target === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && event.target === last) {
      event.preventDefault();
      first.focus();
    }
  };
  container.addEventListener("keydown",keydown);
  if (initialFocus) queueMicrotask(() => {
    if (active) focusable()[0]?.focus?.();
  });
  return {
    focusFirst(){focusable()[0]?.focus?.();},
    restore,
    destroy(){
      if (!active) return;
      active = false;
      container.removeEventListener("keydown",keydown);
    }
  };
}
