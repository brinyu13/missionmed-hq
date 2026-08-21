import assert from "node:assert/strict";
import test from "node:test";

import {
  ACCESSIBILITY_BASELINE,
  FOCUS_VISIBLE_CONTRACT,
  MOTION_CONTRACT,
  REFLOW_EVIDENCE_CONTRACT,
  RESPONSIVE_BANNER,
  RESPONSIVE_BREAKPOINTS,
  RESPONSIVE_MEDIA_QUERIES,
  TOUCH_CONTRACT,
  buildResponsiveModel,
  contrastPreferencePolicy,
  focusScreenHeading,
  headingOutlineIssues,
  installFocusTrap,
  installResponsiveRuntime,
  isResponsiveCapabilityAllowed,
  motionPolicy,
  normalizeViewport,
  renderResponsiveFrame,
  renderResponsiveNotice,
  responsiveActionCapability,
  responsiveRenderContract,
  responsiveTier,
  screenCapability
} from "../web/js/uxr-002/responsive.js";
import {contrastRatio} from "../web/js/uxr-002/utils.js";

class FakeEventTarget {
  constructor() {
    this.listeners = new Map();
  }

  addEventListener(type,listener) {
    if (!this.listeners.has(type)) this.listeners.set(type,new Set());
    this.listeners.get(type).add(listener);
  }

  removeEventListener(type,listener) {
    this.listeners.get(type)?.delete(listener);
  }

  fire(type,event = {}) {
    for (const listener of [...(this.listeners.get(type) || [])]) {
      listener({type,target:this,...event});
    }
  }

  listenerCount() {
    return [...this.listeners.values()].reduce((sum,set) => sum + set.size,0);
  }
}

class FakeMediaQuery extends FakeEventTarget {
  constructor(matches = false) {
    super();
    this.matches = matches;
  }

  setMatches(matches) {
    if (this.matches === matches) return;
    this.matches = matches;
    this.fire("change",{matches});
  }
}

class FakeStyle {
  constructor() {
    this.values = new Map();
  }

  setProperty(name,value) {
    this.values.set(name,String(value));
  }

  getPropertyValue(name) {
    return this.values.get(name) || "";
  }
}

class FakeTarget extends FakeEventTarget {
  constructor() {
    super();
    this.dataset = {};
    this.attributes = new Map();
    this.style = new FakeStyle();
  }

  setAttribute(name,value) {
    this.attributes.set(name,String(value));
  }

  getAttribute(name) {
    return this.attributes.get(name) ?? null;
  }
}

class FakeWindow extends FakeEventTarget {
  constructor({width = 1440,height = 900,maxTouchPoints = 0} = {}) {
    super();
    this.innerWidth = width;
    this.innerHeight = height;
    this.navigator = {maxTouchPoints};
    this.queries = new Map(
      Object.values(RESPONSIVE_MEDIA_QUERIES).map((query) => [
        query,
        new FakeMediaQuery(query === RESPONSIVE_MEDIA_QUERIES.hover)
      ])
    );
  }

  matchMedia(query) {
    return this.queries.get(query);
  }
}

class FakeDocument extends FakeEventTarget {
  constructor(root = new FakeTarget()) {
    super();
    this.documentElement = root;
  }
}

class FakeFocusable {
  constructor(id) {
    this.id = id;
    this.hidden = false;
    this.isConnected = true;
    this.focusCount = 0;
    this.lastFocusOptions = null;
    this.attributes = new Map();
  }

  focus(options) {
    this.focusCount += 1;
    this.lastFocusOptions = options;
  }

  getAttribute(name) {
    return this.attributes.get(name) ?? null;
  }

  setAttribute(name,value) {
    this.attributes.set(name,String(value));
  }
}

class FakeFocusContainer extends FakeEventTarget {
  constructor(items) {
    super();
    this.items = items;
  }

  querySelectorAll() {
    return this.items;
  }
}

function modelAt(width,options = {}) {
  return buildResponsiveModel({
    width,
    height:options.height ?? 900,
    ...options
  });
}

test("M14 uses every frozen breakpoint inclusively, including the mandatory one-pixel boundary pairs",() => {
  assert.deepEqual(RESPONSIVE_BREAKPOINTS,{
    full:1440,
    compressed:1280,
    desktop:1024,
    tablet:768
  });
  const cases = [
    [1728,"full"],
    [1440,"full"],
    [1439,"compressed"],
    [1280,"compressed"],
    [1279,"desktop-overlay"],
    [1024,"desktop-overlay"],
    [1023,"tablet"],
    [768,"tablet"],
    [767,"phone"],
    [390,"phone"],
    [360,"phone"]
  ];
  for (const [width,tier] of cases) {
    assert.equal(responsiveTier(width).id,tier,`${width}px`);
    assert.equal(modelAt(width).tier.id,tier,`${width}px model`);
  }
  assert.throws(() => responsiveTier(-1),/non-negative/);
});

test("M14 full and compressed desktop retain centered 1440px content and the visible Builder preview contract",() => {
  const full = modelAt(1728,{height:1117});
  assert.deepEqual(full.content,{maximumWidth:1440,centered:true});
  assert.equal(full.navigation.placement,"side-rail");
  assert.equal(full.navigation.itemCount,5);
  assert.deepEqual(full.navigation.labels,["Home","Builder","Edit Timeline","Media","Export"]);
  assert.equal(full.screens.home.layout,"three-region-grid");
  assert.equal(full.screens.builder.preview,"live-pane");
  assert.equal(full.screens.builder.previewMinimumWidth,420);
  assert.equal(full.screens.builder.formColumnWidth,null);
  assert.equal(full.screens.canvas.editing,true);

  const compressed = modelAt(1280,{height:800});
  assert.equal(compressed.screens.builder.preview,"live-pane");
  assert.equal(compressed.screens.builder.previewMinimumWidth,420);
  assert.equal(compressed.screens.builder.formColumnWidth,480);
  assert.equal(compressed.screens.home.layout,"three-region-grid");
});

test("M14 1024–1279 stacks Home and collapses Builder preview while preserving fully editable Canvas",() => {
  for (const width of [1279,1024]) {
    const model = modelAt(width,{height:768});
    assert.equal(model.tier.id,"desktop-overlay");
    assert.equal(model.navigation.placement,"side-rail");
    assert.equal(model.screens.home.layout,"stacked");
    assert.equal(model.screens.home.regionsABStacked,true);
    assert.equal(model.screens.builder.preview,"overlay-sheet");
    assert.equal(model.screens.builder.previewVisibleByDefault,false);
    assert.equal(model.screens.builder.previewTrigger,"Show preview");
    assert.equal(model.screens.canvas.contentMode,"interactive");
    assert.equal(model.screens.canvas.editing,true);
    assert.equal(model.screens.canvas.banner,null);
  }
});

test("M14 tablet navigation preserves view-only Canvas below the 960px desktop-editor floor",() => {
  for (const [width,height] of [[959,768],[768,1024]]) {
    const model = modelAt(width,{height,touch:true});
    assert.equal(model.navigation.placement,"bottom-tab-bar");
    assert.equal(model.navigation.itemCount,5);
    assert.equal(model.screens.home.functional,true);
    assert.equal(model.screens.builder.functional,true);
    assert.equal(model.screens.intake.functional,true);
    assert.equal(model.screens.export.contentMode,"full");
    assert.equal(model.screens.export.editing,true);
    assert.deepEqual(
      {
        mode:model.screens.canvas.contentMode,
        editing:model.screens.canvas.editing,
        pan:model.screens.canvas.pan,
        zoom:model.screens.canvas.zoom,
        theme:model.screens.canvas.themePicker,
        banner:model.screens.canvas.banner
      },
      {
        mode:"view-only",
        editing:false,
        pan:true,
        zoom:true,
        theme:true,
        banner:RESPONSIVE_BANNER
      }
    );
    assert.equal(isResponsiveCapabilityAllowed(model,"canvas","edit"),false);
    assert.equal(isResponsiveCapabilityAllowed(model,"canvas","pan"),true);
    assert.equal(isResponsiveCapabilityAllowed(model,"canvas","zoom"),true);
    assert.equal(isResponsiveCapabilityAllowed(model,"canvas","theme"),true);
  }
});

test("M14 a maximized Retina Chrome viewport keeps tablet navigation while enabling the desktop editor",()=>{
  for(const width of [960,983,1023]){
    const model=modelAt(width,{height:810,touch:false});
    assert.equal(model.tier.id,"tablet");
    assert.equal(model.navigation.placement,"bottom-tab-bar");
    assert.equal(model.screens.canvas.contentMode,"interactive");
    assert.equal(model.screens.canvas.editing,true);
    assert.equal(model.screens.canvas.banner,null);
  }
});

test("M14 phone is capture-first with Home, Builder, and Intake functional and Canvas/Export preview-only",() => {
  for (const [width,height] of [[767,900],[390,844],[360,800]]) {
    const model = modelAt(width,{height,touch:true});
    assert.equal(model.tier.id,"phone");
    assert.equal(model.navigation.placement,"bottom-tab-bar");
    assert.equal(model.screens.home.layout,"stacked");
    assert.equal(model.screens.home.functional,true);
    assert.equal(model.screens.builder.functional,true);
    assert.equal(model.screens.intake.functional,true);
    assert.equal(model.screens.canvas.contentMode,"preview-only");
    assert.equal(model.screens.canvas.editing,false);
    assert.equal(model.screens.canvas.banner,RESPONSIVE_BANNER);
    assert.equal(model.screens.export.contentMode,"preview-only");
    assert.equal(model.screens.export.editing,false);
    assert.equal(model.screens.export.banner,RESPONSIVE_BANNER);
    assert.equal(model.features.emailReminder,false);
    assert.equal(isResponsiveCapabilityAllowed(model,"canvas","zoom"),false);
    assert.equal(isResponsiveCapabilityAllowed(model,"export","export"),false);
  }
});

test("M14 orientation is reported and recomputed, while width remains the sole frozen capability axis",() => {
  const portrait = buildResponsiveModel({width:900,height:1200,touch:true});
  const landscape = buildResponsiveModel({width:900,height:600,touch:true});
  assert.equal(portrait.viewport.orientation,"portrait");
  assert.equal(landscape.viewport.orientation,"landscape");
  assert.equal(portrait.viewport.capabilityAxis,"width");
  assert.equal(landscape.viewport.capabilityAxis,"width");
  assert.equal(portrait.viewport.orientationChangesProductTier,false);
  assert.equal(landscape.viewport.orientationChangesProductTier,false);
  assert.equal(portrait.tier.id,landscape.tier.id);
  assert.deepEqual(portrait.screens,landscape.screens);
  assert.equal(normalizeViewport({width:800,height:800}).orientation,"portrait");
});

test("M14 touch policy freezes 44px targets, 8px slop, and the sub-1024 bottom-sheet toolbar",() => {
  const touchTablet = modelAt(900,{height:1100,touch:true});
  assert.equal(touchTablet.touch.enabled,true);
  assert.equal(touchTablet.touch.minimumTargetCssPx,TOUCH_CONTRACT.minimumTargetCssPx);
  assert.equal(touchTablet.touch.dragSlopCssPx,TOUCH_CONTRACT.dragSlopCssPx);
  assert.equal(touchTablet.touch.contextualToolbar,"bottom-sheet");

  const mouseTablet = modelAt(900,{height:700,touch:false,pointer:"fine"});
  assert.equal(mouseTablet.touch.minimumTargetCssPx,null);
  assert.equal(mouseTablet.touch.dragSlopCssPx,0);
  assert.equal(mouseTablet.touch.contextualToolbar,"floating-pill");

  const touchDesktop = modelAt(1024,{height:768,maxTouchPoints:5});
  assert.equal(touchDesktop.touch.enabled,true);
  assert.equal(touchDesktop.touch.contextualToolbar,"floating-pill");
});

test("M14 reduced-motion disables every frozen CSS/JS motion path and converts GIFs to first-frame presentation",() => {
  const normal = motionPolicy(false);
  assert.deepEqual(normal.durations,{
    hoverPressMs:160,
    layoutMs:240,
    popoverMs:200
  });
  assert.equal(normal.gifAutoplay,true);
  assert.equal(normal.parallax,false);
  assert.equal(normal.maxFlashHz,3);

  const reduced = motionPolicy(true);
  assert.deepEqual(reduced.durations,{
    hoverPressMs:0,
    layoutMs:0,
    popoverMs:0
  });
  for (const key of [
    "adaptiveWidthAnimation",
    "arrowSettleAnimation",
    "popoverRise",
    "pulseHighlights",
    "cssAnimation",
    "cssTransition",
    "smoothScroll",
    "gifAutoplay"
  ]) {
    assert.equal(reduced[key],false,key);
  }
  assert.equal(reduced.gifPresentation,"first-frame-with-play-badge");
  assert.equal(reduced.cssVariables["--motion-fast"],"0ms");
  assert.equal(reduced.cssVariables["--motion-layout"],"0ms");
  assert.equal(reduced.cssVariables["--motion-popover"],"0ms");
  assert.deepEqual(
    MOTION_CONTRACT.reducedDisables,
    [
      "all-css-animation",
      "all-css-transition",
      "adaptive-width",
      "arrow-settle",
      "popover-rise",
      "pulse-highlight",
      "gif-autoplay",
      "smooth-scroll"
    ]
  );
});

test("M14 higher-contrast and forced-colors policies preserve semantics and the exact visible-focus contract",() => {
  assert.deepEqual(ACCESSIBILITY_BASELINE,{
    standard:"WCAG 2.2 AA",
    language:"en",
    keyboardOperable:true,
    imagery:"decorative-or-labeled",
    exactlyOneH1PerScreen:true,
    headingLevelsNeverSkip:true,
    mutationAnnouncements:"polite"
  });
  const standard = contrastPreferencePolicy();
  assert.equal(standard.mode,"standard");
  assert.equal(standard.focusRing.effectiveColor,"#2F6FED");
  assert.equal(FOCUS_VISIBLE_CONTRACT.outlineWidth,2);
  assert.equal(FOCUS_VISIBLE_CONTRACT.outlineOffset,2);
  assert.equal(FOCUS_VISIBLE_CONTRACT.outlineStyle,"solid");
  assert.equal(FOCUS_VISIBLE_CONTRACT.boardObjectsIncluded,true);
  assert.equal(FOCUS_VISIBLE_CONTRACT.alwaysVisibleWhenFocusVisible,true);
  assert.ok(contrastRatio("#2F6FED","#FFFFFF") >= 3);
  assert.ok(contrastRatio("#2F6FED","#F7F6F3") >= 3);

  const more = contrastPreferencePolicy({higherContrast:true});
  assert.equal(more.mode,"more");
  assert.equal(more.authorPalette,"frozen");
  assert.equal(more.focusRing.effectiveColor,"#2F6FED");

  const forced = contrastPreferencePolicy({higherContrast:true,forcedColors:true});
  assert.equal(forced.mode,"forced-colors");
  assert.equal(forced.authorPalette,"system-controlled");
  assert.equal(forced.focusRing.effectiveColor,"Highlight");
  assert.equal(forced.preserveProductHierarchy,true);
  assert.equal(forced.preserveTextLabels,true);
  assert.equal(forced.categoryNeverColorOnly,true);
  assert.equal(forced.preserveSemanticBorders,true);
});

test("M14 render hooks select full, view-only, or preview content and emit only the exact required banner",() => {
  const desktop = modelAt(1024,{height:768});
  const desktopHtml = renderResponsiveFrame({
    model:desktop,
    screen:"canvas",
    fullContent:"<main>interactive</main>"
  });
  assert.match(desktopHtml,/data-responsive-mode="interactive"/);
  assert.match(desktopHtml,/<main>interactive<\/main>/);
  assert.doesNotMatch(desktopHtml,/data-responsive-banner/);

  const tablet = modelAt(900,{height:768,touch:true});
  const tabletHtml = renderResponsiveFrame({
    model:tablet,
    screen:"canvas",
    fullContent:"<main>must not render</main>",
    viewOnlyContent:"<main>view only</main>"
  });
  assert.match(tabletHtml,/data-responsive-mode="view-only"/);
  assert.match(tabletHtml,/>Editing needs a larger screen\.<\/div>/);
  assert.match(tabletHtml,/<main>view only<\/main>/);
  assert.doesNotMatch(tabletHtml,/must not render/);
  assert.doesNotMatch(tabletHtml,/Email me a reminder/);
  assert.equal(renderResponsiveNotice(tablet,"export"),"");

  const phone = modelAt(767,{height:900,touch:true});
  const phoneHtml = renderResponsiveFrame({
    model:phone,
    screen:"export",
    fullContent:"<main>controls</main>",
    previewContent:"<main>preview</main>"
  });
  assert.match(phoneHtml,/data-responsive-mode="preview-only"/);
  assert.match(phoneHtml,/>Editing needs a larger screen\.<\/div>/);
  assert.match(phoneHtml,/<main>preview<\/main>/);
  assert.doesNotMatch(phoneHtml,/>controls</);
  assert.doesNotMatch(phoneHtml,/Email me a reminder/);

  assert.throws(
    () => renderResponsiveFrame({model:tablet,screen:"canvas",fullContent:"unsafe"}),
    {code:"D1_UXR_002_RESPONSIVE_VIEW_ONLY_CONTENT_REQUIRED"}
  );
  assert.throws(
    () => renderResponsiveFrame({model:phone,screen:"export",fullContent:"unsafe"}),
    {code:"D1_UXR_002_RESPONSIVE_PREVIEW_CONTENT_REQUIRED"}
  );
});

test("M14 capability routing distinguishes tablet-safe Canvas controls and freezes reflow evidence obligations",() => {
  const tablet = modelAt(900,{height:1100,touch:true});
  assert.equal(responsiveActionCapability("Theme"),"theme");
  assert.equal(responsiveActionCapability("Fit"),"zoom");
  assert.equal(responsiveActionCapability("board-pan"),"pan");
  assert.equal(responsiveActionCapability("add-event"),"edit");
  assert.equal(responsiveActionCapability("download"),"export");
  assert.equal(isResponsiveCapabilityAllowed(tablet,"canvas","theme"),true);
  assert.equal(isResponsiveCapabilityAllowed(tablet,"canvas","zoom"),true);
  assert.equal(isResponsiveCapabilityAllowed(tablet,"canvas","pan"),true);
  assert.equal(isResponsiveCapabilityAllowed(tablet,"canvas","edit"),false);
  assert.deepEqual(tablet.reflow,REFLOW_EVIDENCE_CONTRACT);
  assert.deepEqual(tablet.reflow.effectiveZoomPercents,[200,400]);
  assert.equal(tablet.reflow.documentHorizontalOverflowAllowed,false);
  assert.equal(tablet.reflow.boardPanContained,true);
  assert.throws(() => screenCapability(tablet,"advisor"),/Unknown responsive screen/);
});

test("M14 runtime reacts at 1024/1023, orientation, motion, contrast, touch, and input-modality boundaries",() => {
  const root = new FakeTarget();
  const windowObject = new FakeWindow({width:1024,height:768,maxTouchPoints:0});
  const documentObject = new FakeDocument(root);
  const changes = [];
  const motionChanges = [];
  const contrastChanges = [];
  const runtime = installResponsiveRuntime({
    windowObject,
    documentObject,
    target:root,
    onChange:(state) => changes.push(state),
    onMotionChange:(motion) => motionChanges.push(motion.reduced),
    onContrastChange:(contrast) => contrastChanges.push(contrast.mode)
  });

  assert.equal(runtime.state.tier.id,"desktop-overlay");
  assert.equal(root.getAttribute("lang"),"en");
  assert.equal(root.dataset.responsiveTier,"desktop-overlay");
  assert.equal(root.dataset.navigationPlacement,"side-rail");
  assert.equal(root.dataset.inputModality,"pointer");
  assert.equal(root.style.getPropertyValue("--content-max-width"),"1440px");
  assert.equal(root.style.getPropertyValue("--motion-layout"),"240ms ease-in-out");
  assert.deepEqual(motionChanges,[false]);
  assert.deepEqual(contrastChanges,["standard"]);

  windowObject.innerWidth = 1023;
  windowObject.innerHeight = 768;
  windowObject.fire("resize");
  assert.equal(runtime.state.tier.id,"tablet");
  assert.equal(root.dataset.navigationPlacement,"bottom-tab-bar");

  windowObject.innerWidth = 900;
  windowObject.innerHeight = 1200;
  windowObject.fire("orientationchange");
  assert.equal(runtime.state.viewport.orientation,"portrait");
  windowObject.innerHeight = 600;
  windowObject.fire("orientationchange");
  assert.equal(runtime.state.viewport.orientation,"landscape");
  assert.equal(runtime.state.tier.id,"tablet","orientation must not replace width gates");

  windowObject.queries.get(RESPONSIVE_MEDIA_QUERIES.coarsePointer).setMatches(true);
  assert.equal(runtime.state.touch.enabled,true);
  assert.equal(root.dataset.contextToolbar,"bottom-sheet");
  assert.equal(root.style.getPropertyValue("--touch-target-min"),"44px");
  assert.equal(root.style.getPropertyValue("--touch-drag-slop"),"8px");

  windowObject.queries.get(RESPONSIVE_MEDIA_QUERIES.reducedMotion).setMatches(true);
  assert.equal(runtime.state.motion.reduced,true);
  assert.equal(root.dataset.reducedMotion,"true");
  assert.equal(root.dataset.gifAutoplay,"suppressed");
  assert.equal(root.style.getPropertyValue("--motion-fast"),"0ms");
  assert.equal(root.style.getPropertyValue("--motion-layout"),"0ms");
  assert.deepEqual(motionChanges,[false,true]);

  windowObject.queries.get(RESPONSIVE_MEDIA_QUERIES.higherContrast).setMatches(true);
  assert.equal(root.dataset.contrastMode,"more");
  windowObject.queries.get(RESPONSIVE_MEDIA_QUERIES.forcedColors).setMatches(true);
  assert.equal(runtime.state.contrast.mode,"forced-colors");
  assert.equal(root.dataset.forcedColors,"true");
  assert.equal(root.style.getPropertyValue("--focus-ring"),"Highlight");
  assert.deepEqual(contrastChanges,["standard","more","forced-colors"]);

  documentObject.fire("keydown",{key:"Tab",metaKey:false,ctrlKey:false,altKey:false});
  assert.equal(root.dataset.inputModality,"keyboard");
  documentObject.fire("pointerdown");
  assert.equal(root.dataset.inputModality,"pointer");

  const changeCount = changes.length;
  runtime.destroy();
  assert.equal(windowObject.listenerCount(),0);
  assert.equal(documentObject.listenerCount(),0);
  for (const query of windowObject.queries.values()) assert.equal(query.listenerCount(),0);
  windowObject.innerWidth = 1440;
  windowObject.fire("resize");
  assert.equal(changes.length,changeCount);
});

test("M14 heading and route-focus helpers enforce one h1, no skipped levels, and focus only on view changes",() => {
  assert.deepEqual(headingOutlineIssues([1,2,3,2]),[]);
  assert.deepEqual(headingOutlineIssues([1,3]),["Heading level skips from h1 to h3."]);
  assert.deepEqual(headingOutlineIssues([2,3]),["Every screen requires exactly one h1."]);
  assert.deepEqual(headingOutlineIssues([1,1]),["Every screen requires exactly one h1."]);

  const heading = new FakeFocusable("builder-title");
  const root = {querySelectorAll:() => [heading]};
  const unchanged = focusScreenHeading(root,{
    previousViewKey:"builder|2",
    nextViewKey:"builder|2"
  });
  assert.deepEqual(unchanged,{focused:false,reason:"view-unchanged"});
  assert.equal(heading.focusCount,0);

  const changed = focusScreenHeading(root,{
    previousViewKey:"builder|2",
    nextViewKey:"builder|3"
  });
  assert.deepEqual(changed,{
    focused:true,
    reason:"view-changed",
    id:"builder-title",
    preventScroll:true
  });
  assert.equal(heading.tabIndex,-1);
  assert.equal(heading.focusCount,1);
  assert.deepEqual(heading.lastFocusOptions,{preventScroll:true});

  const invalid = focusScreenHeading({querySelectorAll:() => [heading,new FakeFocusable("other")]},{
    previousViewKey:"home",
    nextViewKey:"canvas"
  });
  assert.deepEqual(invalid,{focused:false,reason:"invalid-h1-count",count:2});
});

test("M14 focus-trap hook cycles, handles Escape, restores the opener, and removes itself cleanly",async() => {
  const opener = new FakeFocusable("opener");
  const first = new FakeFocusable("first");
  const middle = new FakeFocusable("middle");
  const last = new FakeFocusable("last");
  const container = new FakeFocusContainer([first,middle,last]);
  let escapeCount = 0;
  const trap = installFocusTrap(container,{
    opener,
    onEscape:() => {escapeCount += 1;}
  });
  await Promise.resolve();
  assert.equal(first.focusCount,1,"first control receives initial focus");

  let prevented = false;
  container.fire("keydown",{
    key:"Tab",
    target:last,
    shiftKey:false,
    preventDefault(){prevented = true;}
  });
  assert.equal(prevented,true);
  assert.equal(first.focusCount,2);

  prevented = false;
  container.fire("keydown",{
    key:"Tab",
    target:first,
    shiftKey:true,
    preventDefault(){prevented = true;}
  });
  assert.equal(prevented,true);
  assert.equal(last.focusCount,1);

  container.fire("keydown",{
    key:"Escape",
    target:middle,
    preventDefault(){}
  });
  assert.equal(escapeCount,1);
  assert.equal(opener.focusCount,1);
  trap.destroy();
  assert.equal(container.listenerCount(),0);
});

test("M14 render metadata remains deterministic and carries no orientation-specific product reinterpretation",() => {
  const first = modelAt(900,{height:1200,touch:true,reducedMotion:true,higherContrast:true});
  const second = modelAt(900,{height:1200,touch:true,reducedMotion:true,higherContrast:true});
  assert.deepEqual(first,second);
  assert.deepEqual(
    responsiveRenderContract(first,"canvas"),
    {
      screen:"canvas",
      tier:"tablet",
      orientation:"portrait",
      contentMode:"view-only",
      banner:RESPONSIVE_BANNER,
      emailReminder:false,
      attributes:{
        "data-responsive-screen":"canvas",
        "data-responsive-tier":"tablet",
        "data-responsive-mode":"view-only",
        "data-viewport-orientation":"portrait"
      }
    }
  );
  assert.equal(first.viewport.orientationChangesProductTier,false);
});
