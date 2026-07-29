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
  acknowledgeGifStillExportNotice,
  advancedStudioState,
  applyAdvancedObjectAction,
  applyAdvancedTypography,
  applyModeSwitch,
  buildAdvancedSelectionModel,
  buildColorPickerModel,
  buildInsertStripModel,
  changeMediaZOrder,
  chooseBackgroundScrim,
  createFlatColorBackground,
  createMediaElement,
  createPresetBackground,
  createTextBlock,
  createUploadedBackground,
  deleteMediaElement,
  eyedropperAvailable,
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
  renderBackgroundPanel,
  renderColorPicker,
  renderInsertStrip,
  renderModeDialog,
  resizeMediaElement,
  sampleEyeDropper,
  scrimCss,
  setBackgroundDim,
  setLayoutLock,
  studioVisibility,
  updateTextBlockContent,
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
  assert.equal(entered.document.advanced.enteredBefore,true);
  assert.equal(entered.versionRequest.requiredBeforeMutation,true);
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
  assert.equal(model.at(-1).pressed,true);

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
  assert.deepEqual(logo.contextActions,["bring-forward","send-backward","delete"]);
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
  assert.deepEqual(textModel.actions,["bring-forward","send-backward","delete"]);
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
  assert.equal((textHtml.match(/data-advanced-action=/g)||[]).length,5);
  assert.equal((textHtml.match(/data-advanced-object-action=/g)||[]).length,3);
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
  assert.equal((mediaHtml.match(/data-advanced-object-action=/g)||[]).length,3);
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
  assert.deepEqual(textForward.document.advanced.textBlocks.map(({id,layerIndex})=>({id,layerIndex})),[
    {id:"text-b",layerIndex:0},
    {id:"text-a",layerIndex:1}
  ]);
  assert.deepEqual(textForward.selection,{type:"text",id:"text-a"});
  assert.equal(
    applyAdvancedObjectAction(textForward.document,{type:"text",id:"text-a"},"bring-forward").changed,
    false
  );

  const mediaBackward=applyAdvancedObjectAction(
    advanced,
    {type:"media",id:"media-b"},
    "send-backward"
  );
  assert.deepEqual(mediaBackward.document.advanced.media.map(({id})=>id),["media-b","media-a"]);
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
    /selected media or text/
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

test("Layout lock defaults ON, preserves horizontal month snapping, and re-arranges when restored",()=>{
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

  const advanced=documentFixture({mode:"advanced"});
  const unlocked=setLayoutLock(advanced,false);
  assert.equal(unlocked.changed,true);
  assert.deepEqual(unlocked.effects,{
    mode:"advanced",
    layoutLock:false,
    controlVisible:true,
    autoArrange:false,
    laneSnapping:false,
    freeVerticalPlacement:true,
    horizontalMonthSnapping:true,
    rerunAutoArrange:false,
    undoable:true
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
    onAction:(value)=>calls.push(["action",value]),
    onObjectAction:(action,value)=>calls.push(["object-action",action,value]),
    onTypography:(patch,value)=>calls.push(["typography",patch,value]),
    onTextContent:(text,value)=>calls.push(["text-content",text,value]),
    onBackgroundTab:(value)=>calls.push(["tab",value]),
    onBackgroundPreset:(value)=>calls.push(["preset",value]),
    onColor:(value)=>calls.push(["color",value]),
    onBackgroundUpload:(value)=>calls.push(["upload",value.name]),
    onLayoutLock:(value)=>calls.push(["lock",value]),
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
    ["hex","#123ABC"],
    ["typography",{font:"Georgia"},{type:"text",id:"text-1"}],
    ["typography",{size:42},{type:"headline",id:"headline"}],
    ["typography",{color:"#445566"},{type:"headline",id:"headline"}],
    ["text-content","Edited",{type:"text",id:"text-1"}],
    ["dim",60]
  ]);
  dispose();
  assert.deepEqual(removed.map(({type})=>type),["click","change","input"]);
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
