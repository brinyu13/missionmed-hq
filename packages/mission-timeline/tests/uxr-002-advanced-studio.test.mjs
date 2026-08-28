import assert from "node:assert/strict";
import test from "node:test";

import {
  ADVANCED_BACKGROUND_PRESETS,
  ADVANCED_ENTRY_DIALOG,
  ADVANCED_INSERT_STRIP,
  ADVANCED_STUDIO_CAPABILITY_CONTRACT,
  BACKGROUND_TABS,
  CURATED_COLOR_SWATCHES,
  DEFAULT_BACKGROUND_DIM,
  DEFAULT_FREE_TEXT_TYPOGRAPHY,
  FREE_TEXT_ALIGNMENTS,
  FREE_TEXT_FONTS,
  FREE_TEXT_SIZE,
  FREE_TEXT_WEIGHTS,
  GIF_EXPORT_NOTICE,
  GUIDED_RETURN_DIALOG,
  MAX_BACKGROUND_BYTES,
  MAX_MEDIA_BYTES,
  acknowledgeGifStillExportNotice,
  advancedStudioState,
  applyAdvancedObjectAction,
  applyAdvancedTypography,
  applyModeSwitch,
  advancedGroupBounds,
  advancedObjectByTarget,
  buildAdvancedSelectionModel,
  buildColorPickerModel,
  buildInsertStripModel,
  changeMediaZOrder,
  chooseBackgroundScrim,
  constrainAdvancedObjectToBoard,
  createFlatColorBackground,
  createMediaElement,
  createPresetBackground,
  createTextBlock,
  createAdvancedElement,
  createUploadedBackground,
  deleteMediaElement,
  eyedropperAvailable,
  groupAdvancedObjects,
  installAdvancedStudio,
  layoutPolicy,
  moveMediaElement,
  normalizeAdvancedStudioDocument,
  normalizeHex,
  planGifStillExportNotice,
  planModeSwitch,
  recordRecentColor,
  relativeLuminanceFromRgb,
  renderAdvancedStudio,
  renderAdvancedSelectionControls,
  renderAdvancedAssetRail,
  renderBackgroundPanel,
  renderColorPicker,
  renderInsertStrip,
  renderModeDialog,
  placeAdvancedObjectAt,
  resizeAdvancedGroup,
  resizeMediaElement,
  sampleEyeDropper,
  scrimCss,
  snapAdvancedObjectToBoard,
  setBackgroundDim,
  setAdvancedObjectGeometry,
  setLayoutLock,
  setMediaAspectLock,
  studioVisibility,
  updateTextBlockContent,
  updateMediaPresentation,
  updateTextContainerPresentation,
  validateBackgroundPresetCatalog,
  validateBackgroundUpload,
  validateMediaUpload,
  validateTypography
} from "../web/js/uxr-002/advanced-studio.js";

const fixedClock=()=>new Date("2026-07-29T16:00:00.000Z");

function documentFixture(overrides={}){
  const base={
    mode:"guided",
    layoutLock:true,
    preferences:{advancedDialogSeen:false},
    advanced:{
      enteredBefore:false,
      background:{
        kind:"theme",
        preset:null,
        color:null,
        mediaId:null,
        dim:20,
        scrim:"white"
      },
      media:[],
      textBlocks:[],
      recentColors:[],
      gifStillNoticeSeen:false
    }
  };
  return{
    ...base,
    ...structuredClone(overrides),
    preferences:{...base.preferences,...structuredClone(overrides.preferences||{})},
    advanced:{
      ...base.advanced,
      ...structuredClone(overrides.advanced||{}),
      background:{
        ...base.advanced.background,
        ...structuredClone(overrides.advanced?.background||{})
      }
    }
  };
}

function png(name="image.png",size=1024){
  return{name,size,type:"image/png"};
}

function jpg(name="image.jpg",size=1024){
  return{name,size,type:"image/jpeg"};
}

function gif(name="motion.gif",size=1024){
  return{name,size,type:"image/gif"};
}

test("the frozen entry and return dialogs match §8.4 verbatim",()=>{
  assert.deepEqual(ADVANCED_ENTRY_DIALOG,{
    id:"advanced-studio-entry",
    title:"Advanced Studio",
    body:"Full creative control: backgrounds, images, logos, typography, and free placement. The safety rails come off — Guided Mode keeps a version of your board from just before you switch.",
    primary:"Enter Advanced Studio",
    secondary:"Stay in Guided"
  });
  assert.deepEqual(GUIDED_RETURN_DIALOG,{
    id:"guided-mode-return",
    title:"Return to Guided Mode?",
    body:"Your board will be re-arranged automatically. Backgrounds, images, and typography changes are kept but hidden until you return to Advanced Studio.",
    primary:"Return to Guided",
    secondary:"Cancel"
  });
  assert.ok(Object.isFrozen(ADVANCED_ENTRY_DIALOG));
  assert.ok(Object.isFrozen(GUIDED_RETURN_DIALOG));

  const entryHtml=renderModeDialog(ADVANCED_ENTRY_DIALOG);
  const returnHtml=renderModeDialog(GUIDED_RETURN_DIALOG);
  for(const copy of Object.values(ADVANCED_ENTRY_DIALOG).slice(1))assert.ok(entryHtml.includes(copy));
  for(const copy of Object.values(GUIDED_RETURN_DIALOG).slice(1))assert.ok(returnHtml.includes(copy));
});

test("first Advanced activation is gated once and carries the pre-mutation automatic-version contract",()=>{
  const original=documentFixture();
  const plan=planModeSwitch(original,"advanced",{clock:fixedClock});
  assert.equal(plan.status,"confirmation-required");
  assert.deepEqual(plan.dialog,ADVANCED_ENTRY_DIALOG);
  assert.deepEqual(plan.versionRequest,{
    name:"Before Advanced Studio · Jul 29, 2026",
    kind:"automatic",
    requiredBeforeMutation:true
  });
  assert.deepEqual(plan.mutation,{
    label:"Enter Advanced Studio",
    history:true,
    undoSteps:1
  });
  assert.deepEqual(original,documentFixture(),"planning must be pure");

  const stayed=applyModeSwitch(original,plan,"stay-guided");
  assert.equal(stayed.document.mode,"guided");
  assert.equal(stayed.document.preferences.advancedDialogSeen,true);
  assert.equal(stayed.versionRequest,null);

  const secondPlan=planModeSwitch(stayed.document,"advanced",{clock:fixedClock});
  assert.equal(secondPlan.status,"ready");
  assert.equal(secondPlan.dialog,null);
  const entered=applyModeSwitch(stayed.document,secondPlan);
  assert.equal(entered.document.mode,"advanced");
  assert.equal(entered.document.layoutLock,false,"Advanced Studio must open ready for direct manipulation");
  assert.equal(entered.document.preferences.advancedFreePlacementInitialized,true);
  assert.equal(entered.document.advanced.enteredBefore,true);
  assert.equal(entered.versionRequest.requiredBeforeMutation,true);
});

test("legacy Advanced documents unlock once while an intentional lock still persists",()=>{
  const legacy=normalizeAdvancedStudioDocument(documentFixture({
    mode:"advanced",
    layoutLock:true
  }));
  assert.equal(legacy.layoutLock,false);
  assert.equal(legacy.preferences.advancedFreePlacementInitialized,true);

  const locked=setLayoutLock(legacy,true);
  assert.equal(locked.changed,true);
  assert.equal(locked.document.layoutLock,true);
  assert.equal(locked.document.preferences.advancedFreePlacementInitialized,true);

  const reloaded=normalizeAdvancedStudioDocument(structuredClone(locked.document));
  assert.equal(reloaded.layoutLock,true,"a student-selected lock must survive save and reload");
});

test("enter confirmation, return confirmation, Guided hiding, and exact re-entry restoration preserve Advanced data",()=>{
  const custom=documentFixture({
    advanced:{
      background:{kind:"preset",preset:"wash-coast",dim:20},
      media:[{id:"logo",kind:"logo",x:1736,y:64,width:120}],
      textBlocks:[{id:"text-1",text:"Journey",font:"Georgia"}],
      recentColors:["#123456"]
    }
  });
  const enterPlan=planModeSwitch(custom,"advanced",{clock:fixedClock});
  const entered=applyModeSwitch(custom,enterPlan,"enter-advanced").document;
  const retainedSnapshot=structuredClone(entered.advanced);
  const returnPlan=planModeSwitch(entered,"guided",{clock:fixedClock});
  assert.deepEqual(returnPlan.dialog,GUIDED_RETURN_DIALOG);
  assert.deepEqual(returnPlan.effects,{
    rerunAutoArrange:true,
    hideAdvancedContent:true,
    useThemeTypography:true,
    retainAdvancedData:true,
    horizontalMonthSnapping:true
  });
  const cancelled=applyModeSwitch(entered,returnPlan,"cancel");
  assert.equal(cancelled.document.mode,"advanced");
  assert.equal(cancelled.changed,false);

  const returned=applyModeSwitch(entered,returnPlan,"return-guided").document;
  assert.equal(returned.mode,"guided");
  assert.deepEqual(returned.advanced,retainedSnapshot);
  assert.deepEqual(studioVisibility(returned),{
    mode:"guided",
    advancedVisible:false,
    background:{kind:"theme"},
    media:[],
    textBlocks:[],
    typography:"theme",
    retained:retainedSnapshot
  });

  const reentered=applyModeSwitch(
    returned,
    planModeSwitch(returned,"advanced",{clock:fixedClock})
  ).document;
  const visible=studioVisibility(reentered);
  assert.equal(visible.advancedVisible,true);
  assert.deepEqual(visible.background,retainedSnapshot.background);
  assert.deepEqual(visible.media,retainedSnapshot.media);
  assert.deepEqual(visible.textBlocks,retainedSnapshot.textBlocks);
});

test("normalization fills only implementation state and leaves caller data untouched",()=>{
  const original={mode:"unexpected",advanced:{media:[{id:"one"}]},preferences:{}};
  const normalized=normalizeAdvancedStudioDocument(original);
  assert.equal(normalized.mode,"guided");
  assert.equal(normalized.layoutLock,true);
  assert.equal(normalized.advanced.background.dim,DEFAULT_BACKGROUND_DIM);
  assert.equal(normalized.advanced.gifStillNoticeSeen,false);
  assert.deepEqual(original,{mode:"unexpected",advanced:{media:[{id:"one"}]},preferences:{}});
  assert.deepEqual(advancedStudioState(normalized).media,[{id:"one"}]);
});

test("the second row contains exactly Image, GIF, Logo, Text, Background, divider, and Layout lock",()=>{
  assert.deepEqual(ADVANCED_INSERT_STRIP.map(({kind,id,label})=>({kind,id,label})),[
    {kind:"action",id:"image",label:"Image"},
    {kind:"action",id:"gif",label:"GIF"},
    {kind:"action",id:"logo",label:"Logo"},
    {kind:"action",id:"text",label:"Text"},
    {kind:"action",id:"background",label:"Background"},
    {kind:"divider",id:"advanced-insert-divider",label:undefined},
    {kind:"toggle",id:"layout-lock",label:"Layout lock"}
  ]);
  assert.equal(buildInsertStripModel(documentFixture()),null);
  const model=buildInsertStripModel(documentFixture({mode:"advanced"}));
  assert.equal(model.length,7);
  assert.equal(model.at(-1).pressed,false);

  const guidedHtml=renderInsertStrip(documentFixture());
  assert.equal(guidedHtml,"");
  const advancedHtml=renderInsertStrip(documentFixture({mode:"advanced"}));
  assert.equal((advancedHtml.match(/data-advanced-action=/g)||[]).length,5);
  assert.equal((advancedHtml.match(/data-advanced-divider/g)||[]).length,1);
  assert.equal((advancedHtml.match(/data-layout-lock/g)||[]).length,1);
  for(const label of ["Image","GIF","Logo","Text","Background","Layout lock"]){
    assert.ok(advancedHtml.includes(`>${label}<`)||advancedHtml.includes(`<span>${label}</span>`));
  }
});

test("the app-owned background catalog has exactly 4 gradients, 4 textures, and 4 scenic washes",()=>{
  const validation=validateBackgroundPresetCatalog();
  assert.deepEqual(validation,{
    valid:true,
    errors:[],
    groups:{
      "subtle-gradient":4,
      "paper-linen-texture":4,
      "soft-scenic-wash":4
    }
  });
  assert.equal(ADVANCED_BACKGROUND_PRESETS.length,12);
  assert.ok(ADVANCED_BACKGROUND_PRESETS.every(({source})=>source==="app-owned-css"));
  assert.ok(ADVANCED_BACKGROUND_PRESETS.every(({css})=>!css.includes("url(")));

  const drifted=structuredClone(ADVANCED_BACKGROUND_PRESETS);
  drifted.pop();
  drifted[0].source="remote";
  const rejected=validateBackgroundPresetCatalog(drifted);
  assert.equal(rejected.valid,false);
  assert.ok(rejected.errors.includes("Exactly 12 curated backgrounds must ship."));
});

test("background upload accepts only PNG/JPG up to and including 10MB",()=>{
  assert.deepEqual(validateBackgroundUpload(png()),{
    valid:true,type:"png",maxBytes:MAX_BACKGROUND_BYTES,fit:"cover"
  });
  assert.equal(validateBackgroundUpload(jpg("photo.jpeg",MAX_BACKGROUND_BYTES)).valid,true);
  assert.equal(validateBackgroundUpload(png("large.png",MAX_BACKGROUND_BYTES+1)).valid,false);
  assert.equal(validateBackgroundUpload(gif()).valid,false);
  assert.equal(validateBackgroundUpload({name:"fake.png",type:"image/jpeg",size:10}).valid,false);
  assert.equal(validateBackgroundUpload({name:"script.svg",type:"image/svg+xml",size:10}).valid,false);
});

test("uploaded backgrounds use cover fit, 20% default dim, and luminance-selected white/black scrims",()=>{
  const light=createUploadedBackground(png(),{
    id:"background-1",
    sourceUrl:"blob:local-only",
    luminance:.8
  });
  assert.equal(light.fit,"cover");
  assert.equal(light.dim,20);
  assert.equal(light.scrim,"white");
  assert.equal(light.scrimCss,"rgba(255, 255, 255, 0.2)");
  assert.equal(light.source.localOnly,true);

  const dark=createUploadedBackground(jpg(),{
    id:"background-2",
    luminance:.2,
    dim:61
  });
  assert.equal(dark.dim,60);
  assert.equal(dark.scrim,"black");
  assert.equal(dark.scrimCss,"rgba(0, 0, 0, 0.6)");
  assert.equal(chooseBackgroundScrim(.5),"white");
  assert.equal(chooseBackgroundScrim(.4999),"black");
  assert.throws(()=>chooseBackgroundScrim(1.1),RangeError);
  assert.equal(scrimCss("black",0),"rgba(0, 0, 0, 0)");
  assert.equal(setBackgroundDim(light,-1).dim,0);

  const whiteLuminance=relativeLuminanceFromRgb({r:255,g:255,b:255});
  const blackLuminance=relativeLuminanceFromRgb({r:0,g:0,b:0});
  assert.equal(Number(whiteLuminance.toFixed(4)),1);
  assert.equal(blackLuminance,0);
});

test("preset and flat-color backgrounds are validated pure descriptors",()=>{
  const preset=createPresetBackground("gradient-dawn");
  assert.equal(preset.kind,"preset");
  assert.equal(preset.source,"app-owned-css");
  assert.equal(preset.dim,20);
  assert.throws(()=>createPresetBackground("invented"),RangeError);

  assert.deepEqual(createFlatColorBackground("abcdef"),{
    kind:"color",
    preset:null,
    color:"#ABCDEF",
    mediaId:null,
    fit:"cover",
    dim:0,
    scrim:null
  });
  assert.equal(normalizeHex("#a0b1c2"),"#A0B1C2");
  assert.equal(normalizeHex("#fff"),null);
  assert.throws(()=>createFlatColorBackground("not-a-color"),TypeError);
});

test("background panel has exactly the three frozen tabs and is absent in Guided",()=>{
  assert.deepEqual(BACKGROUND_TABS,["Presets","Upload","Color"]);
  assert.equal(renderBackgroundPanel(documentFixture()),"");

  const advanced=documentFixture({mode:"advanced"});
  const presets=renderBackgroundPanel(advanced,{activeTab:"Presets"});
  assert.equal((presets.match(/role="tab"/g)||[]).length,3);
  assert.equal((presets.match(/data-background-preset=/g)||[]).length,12);
  const upload=renderBackgroundPanel(advanced,{activeTab:"Upload"});
  assert.ok(upload.includes('accept=".png,.jpg,.jpeg,image/png,image/jpeg"'));
  assert.ok(upload.includes('min="0" max="60" value="20"'));
  assert.ok(upload.includes("Dim for readability"));
});

test("media validation preserves the frozen Image, GIF, and Logo file boundaries",()=>{
  assert.equal(validateMediaUpload(png(),{kind:"image"}).valid,true);
  assert.equal(validateMediaUpload(jpg(),{kind:"image"}).valid,true);
  assert.equal(validateMediaUpload(gif(),{kind:"image"}).valid,false);
  assert.equal(validateMediaUpload(gif(),{kind:"gif"}).valid,true);
  assert.equal(validateMediaUpload(png(),{kind:"gif"}).valid,false);
  assert.equal(validateMediaUpload(png(),{kind:"logo"}).valid,true);
  assert.equal(validateMediaUpload(jpg(),{kind:"logo"}).valid,true);
  assert.equal(validateMediaUpload(gif(),{kind:"logo"}).valid,true);
  assert.equal(validateMediaUpload({name:"vector.svg",type:"image/svg+xml",size:100},{kind:"logo"}).valid,false);
  assert.equal(
    validateMediaUpload(png("too-large.png",MAX_MEDIA_BYTES+1),{kind:"image"}).valid,
    false
  );
  assert.equal(
    validateMediaUpload(png("maximum.png",MAX_MEDIA_BYTES),{kind:"image"}).valid,
    true
  );
});

test("logos drop top-right at 120px and media exposes no rotation",()=>{
  const logo=createMediaElement({
    id:"logo-1",
    kind:"logo",
    file:png("school.png"),
    sourceUrl:"blob:school",
    naturalWidth:600,
    naturalHeight:300,
    boardWidth:1920,
    boardMargin:64
  });
  assert.equal(logo.width,120);
  assert.equal(logo.height,60);
  assert.equal(logo.x,1736);
  assert.equal(logo.y,64);
  assert.equal(logo.placement,"top-right-board-margin");
  assert.equal(logo.aspectLocked,true);
  assert.equal(logo.resizeHandles,"corners");
  assert.deepEqual(logo.contextActions,["bring-forward","send-backward","duplicate","delete"]);
  assert.equal("rotation" in logo,false);
  assert.equal(JSON.stringify(logo).toLowerCase().includes("rotate"),false);
});

test("media moves freely and corner resizing is aspect-locked unless Shift is held",()=>{
  const media=createMediaElement({
    id:"image-1",
    kind:"image",
    file:jpg(),
    naturalWidth:400,
    naturalHeight:200
  });
  const moved=moveMediaElement(media,{x:72,y:88});
  assert.equal(moved.x,72);
  assert.equal(moved.y,88);
  assert.equal(media.x!==moved.x,true);

  const locked=resizeMediaElement(media,{width:300,height:999});
  assert.equal(locked.width,300);
  assert.equal(locked.height,150);
  assert.equal(locked.aspectLocked,true);
  assert.equal(locked.resizeGesture,"locked-aspect");

  const free=resizeMediaElement(media,{width:300,height:225,shiftKey:true});
  assert.equal(free.width,300);
  assert.equal(free.height,225);
  assert.equal(free.aspectLocked,false);
  assert.equal(free.resizeGesture,"free-aspect");
});

test("movable Advanced objects snap only to board edges and centers within a bounded threshold",()=>{
  const center=snapAdvancedObjectToBoard({x:795,y:449,width:320,height:180});
  assert.equal(center.element.x,800);
  assert.equal(center.element.y,450);
  assert.deepEqual(center.guides,{
    vertical:{position:960,target:"horizontal-center"},
    horizontal:{position:540,target:"vertical-center"}
  });
  const edges=snapAdvancedObjectToBoard({x:7,y:889,width:320,height:180});
  assert.equal(edges.element.x,0);
  assert.equal(edges.element.y,900);
  assert.equal(edges.guides.vertical.target,"left-edge");
  assert.equal(edges.guides.horizontal.target,"bottom-edge");
  const outside=snapAdvancedObjectToBoard({x:50,y:70,width:320,height:180});
  assert.deepEqual(outside.guides,{vertical:null,horizontal:null});
  assert.equal("rotation" in center.element,false);
});

test("media z-order moves one layer at a time and delete compacts layer indexes",()=>{
  const media=[
    {id:"a",layerIndex:0},
    {id:"b",layerIndex:1},
    {id:"c",layerIndex:2}
  ];
  const forward=changeMediaZOrder(media,"a","bring-forward");
  assert.deepEqual(forward.map(({id,layerIndex})=>({id,layerIndex})),[
    {id:"b",layerIndex:0},
    {id:"a",layerIndex:1},
    {id:"c",layerIndex:2}
  ]);
  const backward=changeMediaZOrder(forward,"c","send-backward");
  assert.deepEqual(backward.map(({id})=>id),["b","c","a"]);
  assert.deepEqual(deleteMediaElement(backward,"c"),[
    {id:"b",layerIndex:0},
    {id:"a",layerIndex:1}
  ]);
  assert.deepEqual(media,[
    {id:"a",layerIndex:0},
    {id:"b",layerIndex:1},
    {id:"c",layerIndex:2}
  ]);
});

test("animated GIFs get the exact one-time still-export notice for PNG/PDF only",()=>{
  const withGif=documentFixture({
    mode:"advanced",
    advanced:{media:[createMediaElement({id:"gif-1",kind:"gif",file:gif()})]}
  });
  const pngNotice=planGifStillExportNotice(withGif,"PNG");
  assert.equal(pngNotice.message,"GIFs export as a still frame");
  assert.equal(pngNotice.format,"png");
  assert.equal(pngNotice.exportFrame,"first");
  assert.deepEqual(GIF_EXPORT_NOTICE.formats,["png","pdf"]);
  assert.ok(planGifStillExportNotice(withGif,"pdf"));
  assert.equal(planGifStillExportNotice(withGif,"video"),null);

  const acknowledged=acknowledgeGifStillExportNotice(withGif);
  assert.equal(planGifStillExportNotice(acknowledged,"png"),null);
  assert.equal(withGif.advanced.gifStillNoticeSeen,false);
});

test("free text exposes only the frozen font, size, weight, alignment, and color controls",()=>{
  assert.deepEqual(FREE_TEXT_FONTS,["Inter","Georgia","Nunito"]);
  assert.deepEqual(FREE_TEXT_SIZE,{min:10,max:72});
  assert.deepEqual(FREE_TEXT_WEIGHTS,[400,600,700]);
  assert.deepEqual(FREE_TEXT_ALIGNMENTS,[
    {id:"left",label:"L"},
    {id:"center",label:"C"},
    {id:"right",label:"R"}
  ]);
  const valid=validateTypography({
    font:"Georgia",
    size:72,
    weight:700,
    color:"#b98a2e",
    alignment:"center"
  });
  assert.equal(valid.valid,true);
  assert.equal(valid.value.color,"#B98A2E");
  assert.equal(validateTypography({
    font:"Comic Sans",
    size:73,
    weight:500,
    color:"#fff",
    alignment:"justify"
  }).valid,false);

  const block=createTextBlock({
    id:"text-1",
    text:"My journey",
    font:"Nunito",
    size:32,
    weight:600,
    color:"#191C21",
    alignment:"right"
  });
  assert.equal(block.type,"text");
  assert.equal(block.resizeHandles,8);
  assert.equal("rotation" in block,false);
});

test("Advanced typography applies to text blocks and headline but never in Guided",()=>{
  const block=createTextBlock({id:"text-1"});
  const guided=documentFixture({advanced:{textBlocks:[block]}});
  assert.throws(()=>applyAdvancedTypography(guided,{type:"text",id:"text-1"},{
    font:"Georgia",size:30,weight:600,color:"#123456",alignment:"center"
  }),/only in Advanced Studio/);

  const advanced={...guided,mode:"advanced"};
  const updated=applyAdvancedTypography(advanced,{type:"text",id:"text-1"},{
    font:"Georgia",size:30,weight:600,color:"#123456",alignment:"center"
  });
  assert.equal(updated.advanced.textBlocks[0].font,"Georgia");
  assert.equal(updated.advanced.textBlocks[0].color,"#123456");
  const headline=applyAdvancedTypography(updated,{type:"headline"},{
    font:"Inter",size:24,weight:700,color:"#191C21",alignment:"left"
  });
  assert.deepEqual(headline.advanced.headlineTypography,{
    font:"Inter",size:24,weight:700,color:"#191C21",alignment:"left"
  });
});

test("selected text, headline, and media expose only their frozen runtime controls in Advanced",()=>{
  assert.deepEqual(DEFAULT_FREE_TEXT_TYPOGRAPHY,{
    font:"Inter",
    size:24,
    weight:400,
    color:"#191C21",
    alignment:"left"
  });
  const text=createTextBlock({
    id:"text-1",
    text:"A <careful> journey",
    font:"Georgia",
    size:31,
    weight:600,
    color:"#B98A2E",
    alignment:"center"
  });
  const media=createMediaElement({id:"media-1",kind:"image",file:png()});
  const advanced=documentFixture({
    mode:"advanced",
    advanced:{
      media:[media],
      textBlocks:[text],
      recentColors:["#123456"]
    }
  });

  assert.equal(buildAdvancedSelectionModel(documentFixture(),{type:"text",id:"text-1"}),null);
  const textModel=buildAdvancedSelectionModel(advanced,{type:"text",id:"text-1"});
  assert.deepEqual(textModel.target,{type:"text",id:"text-1"});
  assert.deepEqual(textModel.actions,["bring-forward","send-backward","duplicate","delete"]);
  assert.equal(textModel.editableText,true);
  assert.deepEqual(textModel.typography,{
    font:"Georgia",
    size:31,
    weight:600,
    alignment:"center",
    color:"#B98A2E"
  });

  const textHtml=renderAdvancedStudio(advanced,{
    selection:{type:"text",id:"text-1"},
    themeSwatches:["#191C21","#B98A2E"],
    environment:{}
  });
  assert.ok(textHtml.includes("data-advanced-selection-controls"));
  // Five frozen insert-strip actions remain exact; the persistent Uploads
  // panel contributes the three visual upload tiles required by the editor
  // steer without adding selection-specific mutations.
  assert.equal((textHtml.match(/data-advanced-action=/g)||[]).length,8);
  // The original four layer/duplicate/delete actions plus the RC1-required
  // per-object lock control are all real document mutations.
  assert.equal((textHtml.match(/data-advanced-object-action=/g)||[]).length,5);
  assert.ok(textHtml.includes("data-advanced-asset-rail"));
  assert.ok(textHtml.includes("A &lt;careful&gt; journey"));
  assert.ok(textHtml.includes('data-advanced-typography-field="font"'));
  assert.ok(textHtml.includes('data-advanced-typography-field="size"'));
  assert.ok(textHtml.includes('min="10" max="72"'));
  assert.ok(textHtml.includes('data-advanced-typography-field="weight"'));
  for(const font of ["Inter","Georgia","Nunito"])assert.ok(textHtml.includes(`<option value="${font}"`));
  for(const weight of [400,600,700])assert.ok(textHtml.includes(`<option value="${weight}"`));
  assert.equal((textHtml.match(/data-advanced-alignment=/g)||[]).length,3);
  assert.ok(textHtml.includes('data-advanced-color-scope="typography"'));
  assert.ok(textHtml.includes('value="#B98A2E"'));

  const mediaHtml=renderAdvancedSelectionControls(advanced,{
    selection:{type:"media",id:"media-1"}
  });
  assert.equal((mediaHtml.match(/data-advanced-object-action=/g)||[]).length,5);
  assert.ok(mediaHtml.includes("data-advanced-aspect-lock"));
  assert.equal(mediaHtml.includes("data-advanced-typography-controls"),false);

  const headlineHtml=renderAdvancedSelectionControls(advanced,{
    selection:{
      type:"headline",
      typography:{
        font:"Nunito",
        size:42,
        weight:700,
        color:"#123456",
        alignment:"right"
      }
    },
    environment:{}
  });
  assert.equal(headlineHtml.includes('data-advanced-object-action="lock"'),false);
  assert.equal(headlineHtml.includes("data-advanced-text-content"),false);
  assert.equal(headlineHtml.includes("data-advanced-object-action="),false);
  assert.ok(headlineHtml.includes('value="42"'));
  assert.ok(headlineHtml.includes('data-advanced-alignment="right" aria-pressed="true"'));

  assert.equal(renderAdvancedSelectionControls(documentFixture(),{
    selection:{type:"text",id:"text-1"}
  }),"");
});

test("free-text edits and selected object actions are pure, Advanced-only, and reuse compact z-order",()=>{
  const firstText=createTextBlock({id:"text-a",text:"First",layerIndex:0});
  const secondText=createTextBlock({id:"text-b",text:"Second",layerIndex:1});
  const firstMedia=createMediaElement({id:"media-a",kind:"image",file:png(),layerIndex:0});
  const secondMedia=createMediaElement({id:"media-b",kind:"image",file:png(),layerIndex:1});
  const advanced=documentFixture({
    mode:"advanced",
    advanced:{
      media:[firstMedia,secondMedia],
      textBlocks:[firstText,secondText]
    }
  });

  const edited=updateTextBlockContent(advanced,{type:"text",id:"text-a"},"Edited freely");
  assert.equal(edited.advanced.textBlocks[0].text,"Edited freely");
  assert.equal(advanced.advanced.textBlocks[0].text,"First");
  assert.throws(
    ()=>updateTextBlockContent(documentFixture({advanced:{textBlocks:[firstText]}}),"text-a","No"),
    /only in Advanced Studio/
  );

  const textForward=applyAdvancedObjectAction(advanced,{type:"text",id:"text-a"},"bring-forward");
  assert.equal(textForward.changed,true);
  assert.ok(textForward.document.advanced.textBlocks.find(({id})=>id==="text-a").zIndex>
    textForward.document.advanced.media.find(({id})=>id==="media-b").zIndex);
  assert.deepEqual(textForward.selection,{type:"text",id:"text-a"});
  assert.equal(applyAdvancedObjectAction(textForward.document,{type:"text",id:"text-a"},"bring-forward").changed,true);

  const mediaBackward=applyAdvancedObjectAction(
    advanced,
    {type:"media",id:"media-b"},
    "send-backward"
  );
  assert.ok(mediaBackward.document.advanced.media.find(({id})=>id==="media-b").zIndex<
    mediaBackward.document.advanced.textBlocks.find(({id})=>id==="text-a").zIndex);
  const duplicated=applyAdvancedObjectAction(
    advanced,
    {type:"media",id:"media-a"},
    "duplicate",
    {duplicateId:"media-copy",duplicateOffset:24}
  );
  assert.equal(duplicated.changed,true);
  assert.deepEqual(duplicated.selection,{type:"media",id:"media-copy"});
  assert.equal(duplicated.document.advanced.media.length,3);
  assert.equal(duplicated.document.advanced.media[2].source.name,firstMedia.source.name);
  assert.equal(duplicated.document.advanced.media[2].x,firstMedia.x+24);
  assert.throws(
    ()=>applyAdvancedObjectAction(
      advanced,
      {type:"media",id:"media-a"},
      "duplicate"
    ),
    /unique duplicate object ID/
  );
  const deleted=applyAdvancedObjectAction(
    mediaBackward.document,
    {type:"media",id:"media-b"},
    "delete"
  );
  assert.deepEqual(deleted.document.advanced.media.map(({id,layerIndex})=>({id,layerIndex})),[
    {id:"media-a",layerIndex:0}
  ]);
  assert.equal(deleted.selection,null);
  assert.deepEqual(advanced.advanced.media.map(({id})=>id),["media-a","media-b"]);
  assert.throws(
    ()=>applyAdvancedObjectAction(documentFixture(),{type:"text",id:"text-a"},"delete"),
    /only in Advanced Studio/
  );
  assert.throws(
    ()=>applyAdvancedObjectAction(advanced,{type:"headline",id:"headline"},"delete"),
    /selected media, text, or Timeline asset/
  );
});

test("Advanced asset rail, explicit proportion lock, and board collision guard are durable pure controls",()=>{
  const media=createMediaElement({
    id:"media-rail",
    kind:"image",
    file:png("rail.png"),
    naturalWidth:800,
    naturalHeight:400
  });
  const text=createTextBlock({id:"text-rail",text:"Interview arc"});
  const advanced=documentFixture({
    mode:"advanced",
    advanced:{media:[media],textBlocks:[text]}
  });
  const rail=renderAdvancedAssetRail(advanced,{type:"text",id:"text-rail"});
  assert.match(rail,/data-advanced-asset-rail/);
  assert.equal((rail.match(/data-advanced-select-object/g)||[]).length,2);
  assert.match(rail,/data-advanced-target-id="text-rail" aria-pressed="true"/);
  assert.match(rail,/data-media-asset="media-rail"/);
  assert.match(rail,/draggable="true" class="advanced-visual-asset" data-advanced-insert-asset/);
  assert.match(rail,/data-advanced-drag-object/);
  const unplaced=structuredClone(advanced);
  unplaced.advanced.media[0].placed=false;
  const uploads=renderAdvancedAssetRail(unplaced,null,{activePanel:"uploads"});
  assert.match(uploads,/Upload image/);
  assert.match(uploads,/Upload GIF/);
  assert.match(uploads,/Upload logo/);
  assert.match(uploads,/data-media-place="media-rail"/);

  const unlocked=setMediaAspectLock(advanced,{type:"media",id:"media-rail"},false);
  assert.equal(unlocked.advanced.media[0].aspectLocked,false);
  assert.equal(unlocked.advanced.media[0].resizeGesture,"free-aspect");
  assert.equal(advanced.advanced.media[0].aspectLocked,true);
  const relocked=setMediaAspectLock(unlocked,"media-rail",true);
  assert.equal(relocked.advanced.media[0].aspectLocked,true);

  assert.deepEqual(
    constrainAdvancedObjectToBoard({x:1900,y:-20,width:400,height:20}),
    {x:1520,y:0,width:400,height:48}
  );
});

test("color picker has theme swatches, exactly 20 curated swatches, hex, conditional EyeDropper, and 8 recents",()=>{
  assert.equal(CURATED_COLOR_SWATCHES.length,20);
  assert.equal(new Set(CURATED_COLOR_SWATCHES).size,20);
  let recents=[];
  for(let index=0;index<10;index+=1){
    recents=recordRecentColor(recents,`#0000${index.toString(16).padStart(2,"0")}`);
  }
  assert.equal(recents.length,8);
  assert.equal(recents[0],"#000009");
  assert.equal(recents.at(-1),"#000002");
  assert.deepEqual(recordRecentColor(recents,"#000005").slice(0,2),["#000005","#000009"]);

  class EyeDropper{}
  const model=buildColorPickerModel({
    themeSwatches:["#191c21","#b98a2e","#191C21","invalid"],
    recentColors:recents,
    environment:{EyeDropper}
  });
  assert.deepEqual(model.themeSwatches,["#191C21","#B98A2E"]);
  assert.equal(model.curatedSwatches.length,20);
  assert.equal(model.hexInput,true);
  assert.equal(model.eyedropperVisible,true);
  assert.equal(model.recentColors.length,8);
  assert.equal(eyedropperAvailable({}),false);

  const withEyeDropper=renderColorPicker({environment:{EyeDropper}});
  const withoutEyeDropper=renderColorPicker({environment:{}});
  assert.equal((withEyeDropper.match(/data-color-group="curated"/g)||[]).length,20);
  assert.ok(withEyeDropper.includes("data-advanced-hex"));
  assert.ok(withEyeDropper.includes("data-advanced-eyedropper"));
  assert.equal(withoutEyeDropper.includes("data-advanced-eyedropper"),false);
});

test("native EyeDropper sampling is capability-bound and normalized",async()=>{
  class EyeDropper{
    async open(){return{sRGBHex:"#a1b2c3"};}
  }
  assert.deepEqual(await sampleEyeDropper({}),{available:false,color:null});
  assert.deepEqual(await sampleEyeDropper({EyeDropper}),{
    available:true,color:"#A1B2C3"
  });
});

test("Advanced defaults to free placement, preserves horizontal month snapping, and re-arranges when locked",()=>{
  const guided=documentFixture({layoutLock:false});
  assert.deepEqual(layoutPolicy(guided),{
    mode:"guided",
    layoutLock:true,
    controlVisible:false,
    autoArrange:true,
    laneSnapping:true,
    freeVerticalPlacement:false,
    horizontalMonthSnapping:true
  });
  assert.equal(setLayoutLock(guided,false).changed,false);

  const advanced=normalizeAdvancedStudioDocument(documentFixture({mode:"advanced"}));
  const unlocked=setLayoutLock(advanced,false);
  assert.equal(unlocked.changed,false);
  assert.deepEqual(layoutPolicy(unlocked.document),{
    mode:"advanced",
    layoutLock:false,
    controlVisible:true,
    autoArrange:false,
    laneSnapping:false,
    freeVerticalPlacement:true,
    horizontalMonthSnapping:true
  });
  const relocked=setLayoutLock(unlocked.document,true);
  assert.equal(relocked.effects.rerunAutoArrange,true);
  assert.equal(relocked.effects.autoArrange,true);
  assert.deepEqual(relocked.mutation,{
    label:"Change Layout lock",history:true,undoSteps:1
  });
});

test("Guided render contains no Advanced controls; Advanced render contains only the frozen insert row plus requested panel",()=>{
  assert.equal(renderAdvancedStudio(documentFixture(),{backgroundOpen:true}),"");
  const advanced=documentFixture({mode:"advanced"});
  const closed=renderAdvancedStudio(advanced);
  assert.ok(closed.includes("data-advanced-insert-strip"));
  assert.equal((closed.match(/data-layout-lock/g)||[]).length,1,"only the visible editor control owns the layout lock");
  assert.ok(closed.includes("data-advanced-layout-lock-control"));
  const hiddenContract=closed.slice(closed.indexOf("advanced-legacy-insert-contract"));
  assert.equal(hiddenContract.includes("data-layout-lock"),false);
  assert.ok(closed.indexOf("data-advanced-layout-lock-control")<closed.indexOf("advanced-legacy-insert-contract"));
  assert.equal(closed.includes("data-background-panel"),false);
  const open=renderAdvancedStudio(advanced,{backgroundOpen:true,activeTab:"Presets"});
  assert.ok(open.includes("data-advanced-insert-strip"));
  assert.ok(open.includes("data-background-panel"));
  assert.equal((open.match(/data-advanced-action=/g)||[]).length,5);
  assert.equal((open.match(/data-background-preset=/g)||[]).length,12);
});

test("install hook delegates actions without owning store, persistence, or network behavior",()=>{
  const listeners=new Map();
  const removed=[];
  const root={
    addEventListener(type,listener){listeners.set(type,listener);},
    removeEventListener(type,listener){removed.push({type,listener});}
  };
  const calls=[];
  const dispose=installAdvancedStudio(root,{
    onSelectObject:(value)=>calls.push(["select-object",value]),
    onAction:(value)=>calls.push(["action",value]),
    onObjectAction:(action,value)=>calls.push(["object-action",action,value]),
    onTypography:(patch,value)=>calls.push(["typography",patch,value]),
    onTextContent:(text,value)=>calls.push(["text-content",text,value]),
    onBackgroundTab:(value)=>calls.push(["tab",value]),
    onBackgroundPreset:(value)=>calls.push(["preset",value]),
    onColor:(value)=>calls.push(["color",value]),
    onBackgroundUpload:(value)=>calls.push(["upload",value.name]),
    onLayoutLock:(value)=>calls.push(["lock",value]),
    onAspectLock:(value,target)=>calls.push(["aspect-lock",value,target]),
    onHex:(value)=>calls.push(["hex",value]),
    onBackgroundDim:(value)=>calls.push(["dim",value]),
    onEyeDropper:()=>calls.push(["eyedropper"]),
    onDialogPrimary:()=>calls.push(["primary"]),
    onDialogSecondary:()=>calls.push(["secondary"])
  });
  const target=(selector,dataset={},properties={})=>({
    dataset,
    ...properties,
    closest(query){return query===selector?this:null;}
  });
  listeners.get("click")({target:target("[data-advanced-select-object]",{
    advancedTargetType:"text",
    advancedTargetId:"text-1"
  })});
  listeners.get("click")({target:target("[data-advanced-action]",{advancedAction:"image"})});
  listeners.get("click")({target:target("[data-advanced-object-action]",{
    advancedObjectAction:"bring-forward",
    advancedTargetType:"media",
    advancedTargetId:"media-1"
  })});
  listeners.get("click")({target:target("[data-advanced-alignment]",{
    advancedAlignment:"right",
    advancedTargetType:"text",
    advancedTargetId:"text-1"
  })});
  listeners.get("click")({target:target("[data-background-tab]",{backgroundTab:"Upload"})});
  listeners.get("click")({target:target("[data-background-preset]",{backgroundPreset:"wash-sky"})});
  listeners.get("click")({target:target("[data-advanced-color]",{advancedColor:"#aabbcc"})});
  listeners.get("click")({target:target("[data-advanced-color]",{
    advancedColor:"#334455",
    advancedColorScope:"typography",
    advancedTargetType:"text",
    advancedTargetId:"text-1"
  })});
  listeners.get("click")({target:target("[data-advanced-eyedropper]")});
  listeners.get("click")({target:target("[data-mode-dialog-primary]")});
  listeners.get("click")({target:target("[data-mode-dialog-secondary]")});
  listeners.get("change")({target:target("[data-background-upload]",{},{
    files:[png("background.png")]
  })});
  listeners.get("change")({target:target("[data-layout-lock]",{},{checked:false})});
  listeners.get("change")({target:target("[data-advanced-aspect-lock]",{
    advancedTargetType:"media",
    advancedTargetId:"media-1"
  },{checked:false})});
  listeners.get("change")({target:target("[data-advanced-hex]",{},{value:"#123abc"})});
  listeners.get("change")({target:target("[data-advanced-typography-field]",{
    advancedTypographyField:"font",
    advancedTargetType:"text",
    advancedTargetId:"text-1"
  },{value:"Georgia"})});
  listeners.get("change")({target:target("[data-advanced-typography-field]",{
    advancedTypographyField:"size",
    advancedTargetType:"headline",
    advancedTargetId:"headline"
  },{value:"42"})});
  listeners.get("change")({target:target("[data-advanced-hex]",{
    advancedColorScope:"typography",
    advancedTargetType:"headline",
    advancedTargetId:"headline"
  },{value:"#445566"})});
  listeners.get("input")({target:target("[data-advanced-text-content]",{
    advancedTargetType:"text",
    advancedTargetId:"text-1"
  },{value:"Edited"})});
  listeners.get("input")({target:target("[data-background-dim]",{},{value:"75"})});
  assert.deepEqual(calls,[
    ["select-object",{type:"text",id:"text-1"}],
    ["action","image"],
    ["object-action","bring-forward",{type:"media",id:"media-1"}],
    ["typography",{alignment:"right"},{type:"text",id:"text-1"}],
    ["tab","Upload"],
    ["preset","wash-sky"],
    ["color","#AABBCC"],
    ["typography",{color:"#334455"},{type:"text",id:"text-1"}],
    ["eyedropper"],
    ["primary"],
    ["secondary"],
    ["upload","background.png"],
    ["lock",false],
    ["aspect-lock",false,{type:"media",id:"media-1"}],
    ["hex","#123ABC"],
    ["typography",{font:"Georgia"},{type:"text",id:"text-1"}],
    ["typography",{size:42},{type:"headline",id:"headline"}],
    ["typography",{color:"#445566"},{type:"headline",id:"headline"}],
    ["text-content","Edited",{type:"text",id:"text-1"}],
    ["dim",60]
  ]);
  dispose();
  assert.deepEqual(removed.map(({type})=>type),["click","change","input","dragstart"]);
});

test("capability contract is truthful: local descriptors and adapters, no generated/proprietary assets or network",()=>{
  assert.deepEqual(ADVANCED_STUDIO_CAPABILITY_CONTRACT.uploads.background,[
    "image/png","image/jpeg"
  ]);
  assert.deepEqual(ADVANCED_STUDIO_CAPABILITY_CONTRACT.uploads.media,[
    "image/png","image/jpeg","image/gif"
  ]);
  assert.equal(ADVANCED_STUDIO_CAPABILITY_CONTRACT.uploads.scope,"local-file");
  assert.equal(ADVANCED_STUDIO_CAPABILITY_CONTRACT.uploads.network,false);
  assert.equal(ADVANCED_STUDIO_CAPABILITY_CONTRACT.backgrounds.generatedBitmapAssets,false);
  assert.equal(ADVANCED_STUDIO_CAPABILITY_CONTRACT.backgrounds.proprietaryBitmapAssets,false);
  assert.deepEqual(ADVANCED_STUDIO_CAPABILITY_CONTRACT.gif,{
    canvas:"animated",
    png:"first-frame",
    pdf:"first-frame"
  });
});

test("007 media presentation stores bounded crop geometry without object URLs",()=>{
  const file={name:"portrait.png",type:"image/png",size:1024};
  const media=createMediaElement({id:"media-1",file,naturalWidth:800,naturalHeight:600});
  const source=documentFixture({mode:"advanced",advanced:{media:[media]}});
  const updated=updateMediaPresentation(source,{type:"media",id:"media-1"},{fit:"contain",crop:{x:-20,y:140,zoom:9}});
  assert.deepEqual(updated.advanced.media[0].crop,{x:0,y:100,zoom:4});
  assert.equal(updated.advanced.media[0].fit,"contain");
  assert.equal(updated.advanced.media[0].source.url,null);
});

test("007 text containers preserve explicit auto-fit and readable layout fields",()=>{
  const text=createTextBlock({id:"text-1",text:"A long interview-ready label"});
  const source=documentFixture({mode:"advanced",advanced:{textBlocks:[text]}});
  const updated=updateTextContainerPresentation(source,{type:"text",id:"text-1"},{fitMode:"fixed",minFontSize:4,lineHeight:3,verticalAlign:"bottom"});
  assert.equal(updated.advanced.textBlocks[0].fitMode,"fixed");
  assert.equal(updated.advanced.textBlocks[0].minFontSize,8);
  assert.equal(updated.advanced.textBlocks[0].lineHeight,2);
  assert.equal(updated.advanced.textBlocks[0].verticalAlign,"bottom");
});

test("007 group duplicate and delete are real document operations",()=>{
  const source=documentFixture({mode:"advanced",advanced:{
    textBlocks:[createTextBlock({id:"text-1",text:"Research",x:100,y:100})],
    elements:[{id:"shape-1",type:"element",kind:"rectangle",x:80,y:80,width:260,height:120,fill:"#2C6E8F",stroke:"#17324A",groupId:"group-1",layerIndex:0}],
    groups:[{id:"group-1",type:"group",children:[{type:"element",id:"shape-1"},{type:"text",id:"text-1"}],aspectLocked:true,locked:false}]
  }});
  source.advanced.textBlocks[0].groupId="group-1";
  const duplicated=applyAdvancedObjectAction(source,{type:"group",id:"group-1"},"duplicate",{duplicateId:"group-copy"});
  assert.equal(duplicated.changed,true);
  assert.equal(duplicated.document.advanced.groups.length,2);
  assert.equal(duplicated.document.advanced.groups[1].children.length,2);
  assert.equal(duplicated.document.advanced.textBlocks.length,2);
  assert.equal(duplicated.document.advanced.elements.length,2);
  const removed=applyAdvancedObjectAction(duplicated.document,{type:"group",id:"group-copy"},"delete");
  assert.equal(removed.document.advanced.groups.length,1);
  assert.equal(removed.document.advanced.textBlocks.length,1);
  assert.equal(removed.document.advanced.elements.length,1);
});

test("007 heterogeneous layer actions share one z-order",()=>{
  const source=documentFixture({mode:"advanced",advanced:{
    textBlocks:[createTextBlock({id:"text-1",text:"Above",layerIndex:1})],
    elements:[{id:"shape-1",type:"element",kind:"rectangle",x:80,y:80,width:260,height:120,fill:"#2C6E8F",stroke:"#17324A",layerIndex:0}]
  }});
  const result=applyAdvancedObjectAction(source,{type:"element",id:"shape-1"},"bring-forward");
  assert.equal(result.changed,true);
  assert.ok(result.document.advanced.elements[0].zIndex>result.document.advanced.textBlocks[0].zIndex);
});

test("A10 every rail tile drags a payload a board drop handler accepts, with the drop point respected",()=>{
  const media=createMediaElement({id:"media-1",kind:"image",file:png("rail.png"),naturalWidth:800,naturalHeight:400});
  const advanced=documentFixture({mode:"advanced",advanced:{
    media:[{...media,placed:false}],
    textBlocks:[createTextBlock({id:"text-1",text:"Interview arc"})],
    elements:[createAdvancedElement({id:"shape-1",kind:"circle"})]
  }});
  const rail=renderAdvancedAssetRail(advanced,null,{activePanel:"uploads"});
  assert.equal((rail.match(/data-advanced-drag-object/g)||[]).length,3);

  const listeners=new Map();
  const payloads=[];
  installAdvancedStudio({
    addEventListener(type,listener){listeners.set(type,listener);},
    removeEventListener(){}
  },{onDragStart:(payload)=>payloads.push(payload)});
  const transfer={data:{},setData(key,value){this.data[key]=value;},effectAllowed:""};
  listeners.get("dragstart")({
    dataTransfer:transfer,
    target:{
      dataset:{advancedTargetType:"media",advancedTargetId:"media-1"},
      closest(selector){return selector==="[data-advanced-drag-object]"?this:null;}
    }
  });
  const payload=JSON.parse(transfer.data["application/x-missionmed-timeline-asset"]);
  // The board drop handlers accept kind:"insert" only; "object" was silently dropped.
  assert.equal(payload.kind,"insert");
  assert.equal(payload.action,"place");
  assert.deepEqual(payload.target,{type:"media",id:"media-1"});
  // dropEffect "copy" against a move-only effectAllowed makes the browser veto the drop.
  assert.equal(transfer.effectAllowed,"copyMove");
  assert.deepEqual(payloads,[payload]);

  for(const target of [{type:"media",id:"media-1"},{type:"text",id:"text-1"},{type:"element",id:"shape-1"}]){
    const dropped=placeAdvancedObjectAt(advanced,target,{x:1200,y:700});
    assert.equal(dropped.changed,true);
    assert.deepEqual(dropped.selection,target);
    const item=advancedObjectByTarget(dropped.document,target);
    assert.equal(Math.round(item.x+item.width/2),1200);
    assert.equal(Math.round(item.y+item.height/2),700);
  }
  assert.equal(
    placeAdvancedObjectAt(advanced,{type:"media",id:"media-1"},{x:10,y:10}).document.advanced.media[0].placed,
    true
  );
  const clamped=placeAdvancedObjectAt(advanced,{type:"element",id:"shape-1"},{x:1919,y:1079});
  const shape=clamped.document.advanced.elements[0];
  assert.equal(shape.x+shape.width,1920);
  assert.equal(shape.y+shape.height,1080);
  assert.equal(placeAdvancedObjectAt(advanced,{type:"media",id:"missing"},{x:1,y:1}).changed,false);
  assert.throws(()=>placeAdvancedObjectAt(documentFixture(),{type:"text",id:"text-1"},{x:1,y:1}),/only in Advanced Studio/);
});

test("grouped text is centred in its container and reflows when the container is resized",()=>{
  const source=documentFixture({mode:"advanced",advanced:{
    elements:[createAdvancedElement({id:"key-box",kind:"rounded-rectangle",x:18,y:300,width:416,height:322})],
    textBlocks:[createTextBlock({id:"key-label",text:"US Clinical Experience",x:40,y:330,width:360,height:40,size:24})]
  }});
  const grouped=groupAdvancedObjects(source,[
    {type:"element",id:"key-box"},
    {type:"text",id:"key-label"}
  ],{id:"color-key"});
  assert.equal(grouped.document.advanced.textBlocks[0].alignment,"center");
  assert.deepEqual(advancedGroupBounds(grouped.document,"color-key"),{x:18,y:300,width:416,height:322});

  const halved=resizeAdvancedGroup(grouped.document,"color-key",{x:18,y:300,width:208,height:161});
  assert.equal(halved.changed,true);
  assert.equal(halved.mutation.label,"Resize Timeline group");
  assert.deepEqual(halved.selection,{type:"group",id:"color-key"});
  const label=halved.document.advanced.textBlocks[0];
  const box=halved.document.advanced.elements[0];
  assert.equal(label.size,12);
  assert.ok(label.x>=box.x&&label.y>=box.y);
  assert.ok(label.x+label.width<=box.x+box.width);
  assert.ok(label.y+label.height<=box.y+box.height);
  assert.equal(resizeAdvancedGroup(grouped.document,"missing",{width:10,height:10}).changed,false);
  assert.equal(
    resizeAdvancedGroup(grouped.document,"color-key",{x:200,y:200,width:416,height:322},{kind:"move"}).mutation.label,
    "Move Timeline group"
  );

  // Text a student has already aligned survives grouping untouched.
  const explicit=documentFixture({mode:"advanced",advanced:{
    elements:[createAdvancedElement({id:"key-box",kind:"rounded-rectangle",x:18,y:300,width:416,height:322})],
    textBlocks:[createTextBlock({id:"key-label",text:"Right",x:40,y:330,width:360,height:40,alignment:"right"})]
  }});
  assert.equal(
    groupAdvancedObjects(explicit,[{type:"element",id:"key-box"},{type:"text",id:"key-label"}],{id:"g"})
      .document.advanced.textBlocks[0].alignment,
    "right"
  );
});

test("ungrouped text keeps independent font, alignment, spacing, wrapping, width, and position controls",()=>{
  const advanced=documentFixture({mode:"advanced",advanced:{
    textBlocks:[createTextBlock({id:"text-1",text:"Label",x:100,y:120,width:280,height:64})]
  }});
  const html=renderAdvancedSelectionControls(advanced,{
    selection:{type:"text",id:"text-1"},
    environment:{}
  });
  for(const probe of [
    'data-advanced-typography-field="font"',
    'data-advanced-typography-field="size"',
    'data-advanced-typography-field="weight"',
    'data-advanced-alignment="left"',
    'data-advanced-alignment="center"',
    'data-advanced-alignment="right"',
    'data-advanced-text-layout="lineHeight"',
    'data-advanced-text-layout="wrap"',
    'data-advanced-geometry="x"',
    'data-advanced-geometry="y"',
    'data-advanced-geometry="width"',
    'data-advanced-geometry="height"'
  ])assert.ok(html.includes(probe),`missing text control: ${probe}`);
  // The headline has no box of its own, so it must not offer position and size.
  assert.equal(
    renderAdvancedSelectionControls(advanced,{selection:{type:"headline"},environment:{}})
      .includes("data-advanced-geometry"),
    false
  );

  const spaced=updateTextContainerPresentation(advanced,{type:"text",id:"text-1"},{
    lineHeight:1.45,
    wrap:"nowrap"
  });
  assert.equal(spaced.advanced.textBlocks[0].lineHeight,1.45);
  assert.equal(spaced.advanced.textBlocks[0].wrap,"nowrap");
  assert.throws(()=>updateTextContainerPresentation(advanced,{type:"text",id:"text-1"},{wrap:"sideways"}),/wrap or nowrap/);

  const resized=setAdvancedObjectGeometry(spaced,{type:"text",id:"text-1"},{width:420,x:1700});
  assert.equal(resized.advanced.textBlocks[0].width,420);
  assert.equal(resized.advanced.textBlocks[0].x,1500);
  assert.equal(resized.advanced.textBlocks[0].y,120);

  const listeners=new Map();
  const calls=[];
  installAdvancedStudio({
    addEventListener(type,listener){listeners.set(type,listener);},
    removeEventListener(){}
  },{
    onTextLayout:(patch,target)=>calls.push(["layout",patch,target]),
    onGeometry:(patch,target)=>calls.push(["geometry",patch,target])
  });
  const control=(selector,dataset,properties)=>({
    dataset,
    ...properties,
    closest(query){return query===selector?this:null;}
  });
  listeners.get("change")({target:control("[data-advanced-text-layout]",{
    advancedTextLayout:"lineHeight",
    advancedTargetType:"text",
    advancedTargetId:"text-1"
  },{value:"1.45"})});
  listeners.get("change")({target:control("[data-advanced-geometry]",{
    advancedGeometry:"width",
    advancedTargetType:"text",
    advancedTargetId:"text-1"
  },{value:"420"})});
  assert.deepEqual(calls,[
    ["layout",{lineHeight:1.45},{type:"text",id:"text-1"}],
    ["geometry",{width:420},{type:"text",id:"text-1"}]
  ]);
});
