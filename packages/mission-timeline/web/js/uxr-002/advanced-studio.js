import {dateLabel,escapeHtml} from "./utils.js";

const freezeDeep=(value)=>{
  if(!value||typeof value!=="object"||Object.isFrozen(value))return value;
  for(const child of Object.values(value))freezeDeep(child);
  return Object.freeze(value);
};

const clone=(value)=>structuredClone(value);

export const ADVANCED_MODE="advanced";
export const GUIDED_MODE="guided";
export const MAX_BACKGROUND_BYTES=10*1024*1024;
export const MAX_MEDIA_BYTES=20*1024*1024;
export const DEFAULT_BACKGROUND_DIM=20;
export const MIN_BACKGROUND_DIM=0;
export const MAX_BACKGROUND_DIM=60;

export const ADVANCED_ENTRY_DIALOG=freezeDeep({
  id:"advanced-studio-entry",
  title:"Advanced Studio",
  body:"Full creative control: backgrounds, images, logos, typography, and free placement. The safety rails come off — Guided Mode keeps a version of your board from just before you switch.",
  primary:"Enter Advanced Studio",
  secondary:"Stay in Guided"
});

export const GUIDED_RETURN_DIALOG=freezeDeep({
  id:"guided-mode-return",
  title:"Return to Guided Mode?",
  body:"Your board will be re-arranged automatically. Backgrounds, images, and typography changes are kept but hidden until you return to Advanced Studio.",
  primary:"Return to Guided",
  secondary:"Cancel"
});

export const GIF_EXPORT_NOTICE=freezeDeep({
  id:"gif-still-export",
  message:"GIFs export as a still frame",
  oneTime:true,
  formats:["png","pdf"],
  exportFrame:"first"
});

/*
 * This is the complete second-row inventory from Design Freeze §8.5. The
 * divider is data, rather than an implied rendering detail, so an integrator
 * cannot accidentally insert another control into the frozen row.
 */
export const ADVANCED_INSERT_STRIP=freezeDeep([
  {kind:"action",id:"image",label:"Image"},
  {kind:"action",id:"gif",label:"GIF"},
  {kind:"action",id:"logo",label:"Logo"},
  {kind:"action",id:"text",label:"Text"},
  {kind:"action",id:"background",label:"Background"},
  {kind:"divider",id:"advanced-insert-divider"},
  {kind:"toggle",id:"layout-lock",label:"Layout lock"}
]);

export const BACKGROUND_TABS=freezeDeep(["Presets","Upload","Color"]);

/*
 * The presets are app-owned CSS descriptors. They intentionally contain no
 * remote URLs, third-party artwork, generated bitmap data, or network adapter.
 * Texture and scenic character is produced by layered CSS gradients.
 */
export const ADVANCED_BACKGROUND_PRESETS=freezeDeep([
  {
    id:"gradient-dawn",
    name:"Dawn",
    group:"subtle-gradient",
    source:"app-owned-css",
    css:"linear-gradient(145deg, #F8F1E8 0%, #E9F0F6 100%)"
  },
  {
    id:"gradient-slate",
    name:"Slate",
    group:"subtle-gradient",
    source:"app-owned-css",
    css:"linear-gradient(160deg, #EEF2F5 0%, #DDE5EA 100%)"
  },
  {
    id:"gradient-sage",
    name:"Sage",
    group:"subtle-gradient",
    source:"app-owned-css",
    css:"linear-gradient(150deg, #F4F7F2 0%, #E3ECE5 100%)"
  },
  {
    id:"gradient-lilac",
    name:"Lilac",
    group:"subtle-gradient",
    source:"app-owned-css",
    css:"linear-gradient(155deg, #F8F5FA 0%, #EAE6F2 100%)"
  },
  {
    id:"texture-paper",
    name:"Soft Paper",
    group:"paper-linen-texture",
    source:"app-owned-css",
    css:"repeating-linear-gradient(0deg, rgba(76,67,52,.025) 0 1px, transparent 1px 4px), #F8F4EA"
  },
  {
    id:"texture-linen",
    name:"Natural Linen",
    group:"paper-linen-texture",
    source:"app-owned-css",
    css:"repeating-linear-gradient(0deg, rgba(74,65,49,.035) 0 1px, transparent 1px 5px), repeating-linear-gradient(90deg, rgba(74,65,49,.025) 0 1px, transparent 1px 6px), #F3EFE5"
  },
  {
    id:"texture-cotton",
    name:"Cool Cotton",
    group:"paper-linen-texture",
    source:"app-owned-css",
    css:"repeating-linear-gradient(45deg, rgba(73,89,99,.025) 0 1px, transparent 1px 5px), #F1F5F6"
  },
  {
    id:"texture-parchment",
    name:"Warm Parchment",
    group:"paper-linen-texture",
    source:"app-owned-css",
    css:"repeating-linear-gradient(90deg, rgba(112,83,43,.025) 0 1px, transparent 1px 7px), #F7EFD9"
  },
  {
    id:"wash-coast",
    name:"Quiet Coast",
    group:"soft-scenic-wash",
    source:"app-owned-css",
    css:"radial-gradient(ellipse at 18% 82%, rgba(94,151,177,.18), transparent 42%), radial-gradient(ellipse at 82% 20%, rgba(225,190,133,.17), transparent 40%), #F5F7F7"
  },
  {
    id:"wash-horizon",
    name:"Open Horizon",
    group:"soft-scenic-wash",
    source:"app-owned-css",
    css:"linear-gradient(180deg, rgba(243,207,158,.18) 0%, transparent 38%), radial-gradient(ellipse at 50% 100%, rgba(103,151,170,.16), transparent 48%), #FAF9F5"
  },
  {
    id:"wash-meadow",
    name:"Soft Meadow",
    group:"soft-scenic-wash",
    source:"app-owned-css",
    css:"radial-gradient(ellipse at 15% 92%, rgba(113,157,113,.18), transparent 44%), radial-gradient(ellipse at 88% 12%, rgba(228,200,141,.15), transparent 38%), #F7F9F3"
  },
  {
    id:"wash-sky",
    name:"Morning Sky",
    group:"soft-scenic-wash",
    source:"app-owned-css",
    css:"radial-gradient(ellipse at 75% 12%, rgba(130,168,207,.18), transparent 42%), radial-gradient(ellipse at 8% 88%, rgba(188,165,205,.13), transparent 38%), #F7F8FB"
  }
]);

export const CURATED_COLOR_SWATCHES=freezeDeep([
  "#191C21","#FFFFFF","#2A3442","#565D66","#B98A2E",
  "#2C6E8F","#3A78C9","#C8641C","#3F9B52","#C9A227",
  "#8A5BBF","#1B2A4A","#D9C489","#4A7A93","#5578B0",
  "#B06A35","#55884F","#A98F3D","#7E6398","#E0813F"
]);

export const FREE_TEXT_FONTS=freezeDeep(["Inter","Georgia","Nunito"]);
export const FREE_TEXT_SIZE=freezeDeep({min:10,max:72});
export const FREE_TEXT_WEIGHTS=freezeDeep([400,600,700]);
export const FREE_TEXT_ALIGNMENTS=freezeDeep([
  {id:"left",label:"L"},
  {id:"center",label:"C"},
  {id:"right",label:"R"}
]);
export const DEFAULT_FREE_TEXT_TYPOGRAPHY=freezeDeep({
  font:"Inter",
  size:24,
  weight:400,
  color:"#191C21",
  alignment:"left"
});

export const ADVANCED_STUDIO_CAPABILITY_CONTRACT=freezeDeep({
  uploads:{
    scope:"local-file",
    network:false,
    background:["image/png","image/jpeg"],
    media:["image/png","image/jpeg","image/gif"],
    persistence:"consumer-supplied media adapter"
  },
  backgrounds:{
    presetAssets:"app-owned CSS descriptors",
    fit:"cover",
    generatedBitmapAssets:false,
    proprietaryBitmapAssets:false
  },
  eyedropper:"native EyeDropper API when available",
  gif:{
    canvas:"animated",
    png:"first-frame",
    pdf:"first-frame"
  }
});

const DEFAULT_ADVANCED_STATE=freezeDeep({
  enteredBefore:false,
  background:{
    kind:"theme",
    preset:null,
    color:null,
    mediaId:null,
    dim:DEFAULT_BACKGROUND_DIM,
    scrim:"white",
    fit:"cover"
  },
  media:[],
  textBlocks:[],
  recentColors:[],
  gifStillNoticeSeen:false
});

function normalizeMode(value){
  return value===ADVANCED_MODE?ADVANCED_MODE:GUIDED_MODE;
}

function safeArray(value){
  return Array.isArray(value)?value:[];
}

function normalizeDim(value){
  const numeric=Number(value);
  if(!Number.isFinite(numeric))return DEFAULT_BACKGROUND_DIM;
  return Math.min(MAX_BACKGROUND_DIM,Math.max(MIN_BACKGROUND_DIM,Math.round(numeric)));
}

export function advancedStudioState(document={}){
  const source=document?.advanced&&typeof document.advanced==="object"?document.advanced:{};
  const background=source.background&&typeof source.background==="object"?source.background:{};
  return{
    enteredBefore:!!source.enteredBefore,
    background:{
      ...clone(DEFAULT_ADVANCED_STATE.background),
      ...clone(background),
      dim:normalizeDim(background.dim)
    },
    media:clone(safeArray(source.media)),
    textBlocks:clone(safeArray(source.textBlocks)),
    headlineTypography:source.headlineTypography&&typeof source.headlineTypography==="object"
      ?clone(source.headlineTypography)
      :null,
    recentColors:normalizeRecentColors(source.recentColors),
    gifStillNoticeSeen:!!source.gifStillNoticeSeen
  };
}

export function normalizeAdvancedStudioDocument(document={}){
  const next=clone(document&&typeof document==="object"?document:{});
  next.mode=normalizeMode(next.mode);
  next.layoutLock=next.layoutLock!==false;
  next.advanced=advancedStudioState(next);
  next.preferences={
    ...(next.preferences&&typeof next.preferences==="object"?next.preferences:{}),
    advancedDialogSeen:!!next.preferences?.advancedDialogSeen
  };
  return next;
}

export function planModeSwitch(document,targetMode,{clock=()=>new Date()}={}){
  const state=normalizeAdvancedStudioDocument(document);
  const target=normalizeMode(targetMode);
  if(target===state.mode)return freezeDeep({
    type:"mode-switch",
    status:"noop",
    from:state.mode,
    to:target,
    dialog:null,
    versionRequest:null,
    mutation:null,
    effects:null
  });
  if(target===ADVANCED_MODE){
    return freezeDeep({
      type:"mode-switch",
      status:state.preferences.advancedDialogSeen?"ready":"confirmation-required",
      from:GUIDED_MODE,
      to:ADVANCED_MODE,
      dialog:state.preferences.advancedDialogSeen?null:ADVANCED_ENTRY_DIALOG,
      versionRequest:{
        name:`Before Advanced Studio · ${dateLabel(clock())}`,
        kind:"automatic",
        requiredBeforeMutation:true
      },
      mutation:{label:"Enter Advanced Studio",history:true,undoSteps:1},
      effects:{
        showRetainedAdvancedContent:true,
        restoreAdvancedTypography:true,
        horizontalMonthSnapping:true
      }
    });
  }
  return freezeDeep({
    type:"mode-switch",
    status:"confirmation-required",
    from:ADVANCED_MODE,
    to:GUIDED_MODE,
    dialog:GUIDED_RETURN_DIALOG,
    versionRequest:null,
    mutation:{label:"Return to Guided Mode",history:true,undoSteps:1},
    effects:{
      rerunAutoArrange:true,
      hideAdvancedContent:true,
      useThemeTypography:true,
      retainAdvancedData:true,
      horizontalMonthSnapping:true
    }
  });
}

/*
 * Applies only the local document transition. The returned version request is
 * an ordering contract: a consumer must persist it before committing document.
 */
export function applyModeSwitch(document,plan,decision){
  if(plan?.type!=="mode-switch")throw new Error("A mode-switch plan is required.");
  const next=normalizeAdvancedStudioDocument(document);
  if(plan.status==="noop")return{document:next,changed:false,versionRequest:null,effects:null};

  if(plan.to===ADVANCED_MODE){
    const stayed=decision==="stay-guided"||decision==="cancel";
    if(plan.dialog)next.preferences.advancedDialogSeen=true;
    if(stayed){
      next.mode=GUIDED_MODE;
      return{document:next,changed:!!plan.dialog,versionRequest:null,effects:null};
    }
    if(plan.dialog&&decision!=="enter-advanced"&&decision!=="confirm"){
      throw new Error("Advanced Studio entry requires an explicit decision.");
    }
    next.mode=ADVANCED_MODE;
    next.advanced.enteredBefore=true;
    return{
      document:next,
      changed:true,
      versionRequest:clone(plan.versionRequest),
      effects:clone(plan.effects)
    };
  }

  if(decision==="cancel"){
    return{document:next,changed:false,versionRequest:null,effects:null};
  }
  if(decision!=="return-guided"&&decision!=="confirm"){
    throw new Error("Returning to Guided Mode requires an explicit decision.");
  }
  next.mode=GUIDED_MODE;
  return{
    document:next,
    changed:true,
    versionRequest:null,
    effects:clone(plan.effects)
  };
}

export function studioVisibility(document={}){
  const state=normalizeAdvancedStudioDocument(document);
  const retained=advancedStudioState(state);
  if(state.mode===ADVANCED_MODE){
    return{
      mode:ADVANCED_MODE,
      advancedVisible:true,
      background:clone(retained.background),
      media:clone(retained.media),
      textBlocks:clone(retained.textBlocks),
      typography:"advanced",
      retained
    };
  }
  return{
    mode:GUIDED_MODE,
    advancedVisible:false,
    background:{kind:"theme"},
    media:[],
    textBlocks:[],
    typography:"theme",
    retained
  };
}

export function buildInsertStripModel(document={}){
  const state=normalizeAdvancedStudioDocument(document);
  if(state.mode!==ADVANCED_MODE)return null;
  return ADVANCED_INSERT_STRIP.map((item)=>item.id==="layout-lock"?
    {...item,pressed:state.layoutLock}:clone(item));
}

export function layoutPolicy(document={}){
  const state=normalizeAdvancedStudioDocument(document);
  const locked=state.mode===GUIDED_MODE||state.layoutLock;
  return{
    mode:state.mode,
    layoutLock:locked,
    controlVisible:state.mode===ADVANCED_MODE,
    autoArrange:locked,
    laneSnapping:locked,
    freeVerticalPlacement:state.mode===ADVANCED_MODE&&!locked,
    horizontalMonthSnapping:true
  };
}

export function setLayoutLock(document,locked){
  const state=normalizeAdvancedStudioDocument(document);
  if(state.mode!==ADVANCED_MODE){
    return{
      document:state,
      changed:false,
      mutation:null,
      effects:layoutPolicy(state)
    };
  }
  const nextLocked=!!locked;
  if(nextLocked===state.layoutLock){
    return{document:state,changed:false,mutation:null,effects:layoutPolicy(state)};
  }
  state.layoutLock=nextLocked;
  return{
    document:state,
    changed:true,
    mutation:{label:"Change Layout lock",history:true,undoSteps:1},
    effects:{
      ...layoutPolicy(state),
      rerunAutoArrange:nextLocked,
      undoable:true
    }
  };
}

function extensionOf(file){
  return String(file?.name||"").toLowerCase().match(/\.([a-z0-9]+)$/)?.[1]||"";
}

function fileType(file){
  return String(file?.type||"").trim().toLowerCase();
}

function recognizedImageType(file){
  const extension=extensionOf(file);
  const mime=fileType(file);
  const fromMime={
    "image/png":"png",
    "image/jpeg":"jpg",
    "image/jpg":"jpg",
    "image/gif":"gif",
    "image/webp":"webp"
  }[mime]||null;
  const fromExtension={
    png:"png",
    jpg:"jpg",
    jpeg:"jpg",
    gif:"gif",
    webp:"webp"
  }[extension]||null;
  if(fromMime&&fromExtension&&fromMime!==fromExtension)return null;
  return fromMime||fromExtension;
}

function validFileSize(file,maxBytes=Infinity){
  const size=Number(file?.size);
  return Number.isFinite(size)&&size>=0&&size<=maxBytes;
}

export function validateBackgroundUpload(file){
  const type=recognizedImageType(file);
  const valid=!!file&&["png","jpg"].includes(type)&&validFileSize(file,MAX_BACKGROUND_BYTES);
  return valid?{
    valid:true,
    type,
    maxBytes:MAX_BACKGROUND_BYTES,
    fit:"cover"
  }:{
    valid:false,
    error:"PNG or JPG, up to 10MB.",
    maxBytes:MAX_BACKGROUND_BYTES
  };
}

export function relativeLuminanceFromRgb({r,g,b}={}){
  const channel=(value)=>{
    const normalized=Math.min(255,Math.max(0,Number(value)||0))/255;
    return normalized<=.04045?normalized/12.92:((normalized+.055)/1.055)**2.4;
  };
  return .2126*channel(r)+.7152*channel(g)+.0722*channel(b);
}

export function chooseBackgroundScrim(luminance){
  const value=Number(luminance);
  if(!Number.isFinite(value)||value<0||value>1){
    throw new RangeError("Background luminance must be between 0 and 1.");
  }
  return value>=.5?"white":"black";
}

export function scrimCss(scrim,dim=DEFAULT_BACKGROUND_DIM){
  const alpha=normalizeDim(dim)/100;
  return scrim==="black"?`rgba(0, 0, 0, ${alpha})`:`rgba(255, 255, 255, ${alpha})`;
}

export function createUploadedBackground(file,{
  id,
  sourceUrl=null,
  luminance,
  dim=DEFAULT_BACKGROUND_DIM
}={}){
  const validation=validateBackgroundUpload(file);
  if(!validation.valid)throw new TypeError(validation.error);
  const normalizedDim=normalizeDim(dim);
  const scrim=chooseBackgroundScrim(luminance);
  return{
    kind:"upload",
    mediaId:String(id||""),
    preset:null,
    color:null,
    source:{
      name:String(file.name||""),
      type:fileType(file)||`image/${validation.type==="jpg"?"jpeg":validation.type}`,
      size:Number(file.size),
      url:sourceUrl,
      localOnly:true
    },
    fit:"cover",
    dim:normalizedDim,
    scrim,
    scrimCss:scrimCss(scrim,normalizedDim),
    luminance:Number(luminance)
  };
}

export function setBackgroundDim(background,dim){
  const next={...clone(background||{}),dim:normalizeDim(dim)};
  next.scrim=next.scrim==="black"?"black":"white";
  next.scrimCss=scrimCss(next.scrim,next.dim);
  return next;
}

export function createPresetBackground(presetId){
  const preset=ADVANCED_BACKGROUND_PRESETS.find(({id})=>id===presetId);
  if(!preset)throw new RangeError("Unknown Advanced Studio background preset.");
  return{
    kind:"preset",
    preset:preset.id,
    color:null,
    mediaId:null,
    css:preset.css,
    source:preset.source,
    fit:"cover",
    dim:DEFAULT_BACKGROUND_DIM
  };
}

export function normalizeHex(value){
  const match=String(value||"").trim().match(/^#?([0-9a-f]{6})$/i);
  return match?`#${match[1].toUpperCase()}`:null;
}

export function createFlatColorBackground(value){
  const color=normalizeHex(value);
  if(!color)throw new TypeError("Enter a six-digit hex color.");
  return{
    kind:"color",
    preset:null,
    color,
    mediaId:null,
    fit:"cover",
    dim:0,
    scrim:null
  };
}

export function validateBackgroundPresetCatalog(catalog=ADVANCED_BACKGROUND_PRESETS){
  const groups={
    "subtle-gradient":0,
    "paper-linen-texture":0,
    "soft-scenic-wash":0
  };
  const errors=[];
  if(catalog.length!==12)errors.push("Exactly 12 curated backgrounds must ship.");
  const ids=new Set();
  for(const preset of catalog){
    if(ids.has(preset.id))errors.push(`Duplicate background id: ${preset.id}`);
    ids.add(preset.id);
    if(!(preset.group in groups))errors.push(`Unknown background group: ${preset.group}`);
    else groups[preset.group]+=1;
    if(preset.source!=="app-owned-css")errors.push(`${preset.id} is not app-owned CSS.`);
    if(/url\s*\(/i.test(preset.css||""))errors.push(`${preset.id} references a URL.`);
  }
  for(const [group,count] of Object.entries(groups)){
    if(count!==4)errors.push(`${group} must contain exactly 4 presets.`);
  }
  return{valid:errors.length===0,errors,groups};
}

export const MEDIA_KINDS=freezeDeep(["image","gif","logo"]);
export const MEDIA_CONTEXT_ACTIONS=freezeDeep([
  "bring-forward",
  "send-backward",
  "duplicate",
  "delete"
]);

export function validateMediaUpload(file,{kind="image"}={}){
  const normalizedKind=String(kind).toLowerCase();
  const type=recognizedImageType(file);
  const allowed=normalizedKind==="gif"?["gif"]:
    normalizedKind==="image"?["png","jpg","webp"]:
    normalizedKind==="logo"?["png","jpg","gif","webp"]:[];
  const valid=!!file&&allowed.includes(type)&&validFileSize(file,MAX_MEDIA_BYTES);
  return valid?{
    valid:true,
    type,
    kind:normalizedKind,
    animated:type==="gif",
    maxBytes:MAX_MEDIA_BYTES
  }:{
    valid:false,
    error:normalizedKind==="gif"?"GIF files only, up to 20MB.":normalizedKind==="image"?
      "PNG, JPG, or WEBP files only, up to 20MB.":"PNG, JPG, WEBP, or GIF files only, up to 20MB.",
    maxBytes:MAX_MEDIA_BYTES
  };
}

function finite(value,fallback){
  const numeric=Number(value);
  return Number.isFinite(numeric)?numeric:fallback;
}

function positive(value,fallback){
  return Math.max(1,finite(value,fallback));
}

export function createMediaElement({
  id,
  kind="image",
  file,
  sourceUrl=null,
  naturalWidth=320,
  naturalHeight=180,
  boardWidth=1920,
  boardHeight=1080,
  boardMargin=64,
  layerIndex=0
}={}){
  const validation=validateMediaUpload(file,{kind});
  if(!validation.valid)throw new TypeError(validation.error);
  const naturalAspect=positive(naturalWidth,320)/positive(naturalHeight,180);
  const isLogo=kind==="logo";
  const width=isLogo?120:Math.min(480,positive(naturalWidth,320));
  const height=width/naturalAspect;
  const x=isLogo?finite(boardWidth,1920)-finite(boardMargin,64)-width:
    (finite(boardWidth,1920)-width)/2;
  const y=isLogo?finite(boardMargin,64):
    (finite(boardHeight,1080)-height)/2;
  return{
    id:String(id||""),
    type:"media",
    kind,
    fileType:validation.type,
    animated:validation.animated,
    source:{
      name:String(file.name||""),
      type:fileType(file),
      size:Number(file.size),
      url:sourceUrl,
      localOnly:true
    },
    x,
    y,
    width,
    height,
    naturalAspect,
    aspectLocked:true,
    layerIndex:Math.trunc(finite(layerIndex,0)),
    placement:isLogo?"top-right-board-margin":"board-center",
    resizeHandles:"corners",
    horizontalMonthSnapping:false,
    contextActions:clone(MEDIA_CONTEXT_ACTIONS)
  };
}

export function moveMediaElement(element,{x,y}={}){
  return{...clone(element),x:finite(x,element?.x||0),y:finite(y,element?.y||0)};
}

export function resizeMediaElement(element,{width,height,shiftKey=false}={}){
  const next=clone(element);
  const nextWidth=positive(width,next.width||1);
  const aspect=positive(next.naturalAspect,next.width/next.height||1);
  next.width=nextWidth;
  next.height=shiftKey?positive(height,next.height||nextWidth/aspect):nextWidth/aspect;
  next.aspectLocked=!shiftKey;
  next.resizeGesture=shiftKey?"free-aspect":"locked-aspect";
  return next;
}

export function constrainAdvancedObjectToBoard(element,{
  boardWidth=1920,
  boardHeight=1080,
  minimumSize=48
}={}){
  const next=clone(element||{});
  const maxWidth=Math.max(minimumSize,finite(boardWidth,1920));
  const maxHeight=Math.max(minimumSize,finite(boardHeight,1080));
  next.width=Math.min(maxWidth,Math.max(minimumSize,positive(next.width,minimumSize)));
  next.height=Math.min(maxHeight,Math.max(minimumSize,positive(next.height,minimumSize)));
  next.x=Math.max(0,Math.min(
    maxWidth-next.width,
    finite(next.x,0)
  ));
  next.y=Math.max(0,Math.min(
    maxHeight-next.height,
    finite(next.y,0)
  ));
  return next;
}

export function setMediaAspectLock(document,target,locked){
  const state=normalizeAdvancedStudioDocument(document);
  if(state.mode!==ADVANCED_MODE){
    throw new Error("Media ratio controls are available only in Advanced Studio.");
  }
  const id=typeof target==="string"?target:target?.id;
  const item=state.advanced.media.find(
    (candidate)=>String(candidate.id)===String(id)
  );
  if(!item)throw new Error("Media element not found.");
  item.aspectLocked=!!locked;
  item.resizeGesture=item.aspectLocked?"locked-aspect":"free-aspect";
  return state;
}

export function changeMediaZOrder(media,id,direction){
  const items=clone(safeArray(media));
  const index=items.findIndex((item)=>item.id===id);
  if(index<0)return items;
  const target=direction==="bring-forward"?Math.min(items.length-1,index+1):
    direction==="send-backward"?Math.max(0,index-1):index;
  if(target===index)return items;
  [items[index],items[target]]=[items[target],items[index]];
  return items.map((item,layerIndex)=>({...item,layerIndex}));
}

export function deleteMediaElement(media,id){
  return clone(safeArray(media)).filter((item)=>item.id!==id)
    .map((item,layerIndex)=>({...item,layerIndex}));
}

export function planGifStillExportNotice(document,format){
  const state=normalizeAdvancedStudioDocument(document);
  const normalizedFormat=String(format||"").toLowerCase();
  const hasGif=state.advanced.media.some((item)=>
    item?.kind==="gif"||item?.fileType==="gif"||item?.animated===true);
  if(!GIF_EXPORT_NOTICE.formats.includes(normalizedFormat)||
    !hasGif||
    state.advanced.gifStillNoticeSeen){
    return null;
  }
  return{
    ...clone(GIF_EXPORT_NOTICE),
    format:normalizedFormat,
    mutation:{label:"Acknowledge GIF export notice",history:false,material:false}
  };
}

export function acknowledgeGifStillExportNotice(document){
  const next=normalizeAdvancedStudioDocument(document);
  next.advanced.gifStillNoticeSeen=true;
  return next;
}

export function validateTypography(input={}){
  const font=String(input.font||"");
  const size=Number(input.size);
  const weight=Number(input.weight);
  const alignment=String(input.alignment||"");
  const color=normalizeHex(input.color);
  const errors=[];
  if(!FREE_TEXT_FONTS.includes(font))errors.push("Unsupported font.");
  if(!Number.isFinite(size)||size<FREE_TEXT_SIZE.min||size>FREE_TEXT_SIZE.max){
    errors.push("Text size must be from 10 to 72.");
  }
  if(!FREE_TEXT_WEIGHTS.includes(weight))errors.push("Unsupported font weight.");
  if(!FREE_TEXT_ALIGNMENTS.some(({id})=>id===alignment))errors.push("Unsupported alignment.");
  if(!color)errors.push("Enter a six-digit hex color.");
  return{
    valid:errors.length===0,
    errors,
    value:errors.length?null:{font,size,weight,alignment,color}
  };
}

export function createTextBlock({
  id,
  text="",
  x=960,
  y=540,
  font="Inter",
  size=24,
  weight=400,
  color="#191C21",
  alignment="left",
  width=320,
  height=72,
  layerIndex=0
}={}){
  const typography=validateTypography({font,size,weight,color,alignment});
  if(!typography.valid)throw new TypeError(typography.errors.join(" "));
  return{
    id:String(id||""),
    type:"text",
    text:String(text),
    x:finite(x,960),
    y:finite(y,540),
    width:positive(width,320),
    height:positive(height,72),
    ...typography.value,
    resizeHandles:8,
    layerIndex:Math.trunc(finite(layerIndex,0)),
    contextActions:clone(MEDIA_CONTEXT_ACTIONS)
  };
}

export function applyAdvancedTypography(document,target,typography){
  const state=normalizeAdvancedStudioDocument(document);
  if(state.mode!==ADVANCED_MODE)throw new Error("Typography controls are available only in Advanced Studio.");
  const validated=validateTypography(typography);
  if(!validated.valid)throw new TypeError(validated.errors.join(" "));
  const next=clone(state);
  if(target?.type==="headline"){
    next.advanced.headlineTypography=validated.value;
    return next;
  }
  const block=next.advanced.textBlocks.find((item)=>item.id===target?.id);
  if(!block)throw new Error("Text block not found.");
  Object.assign(block,validated.value);
  return next;
}

export function updateTextBlockContent(document,target,text){
  const state=normalizeAdvancedStudioDocument(document);
  if(state.mode!==ADVANCED_MODE)throw new Error("Text controls are available only in Advanced Studio.");
  const id=typeof target==="string"?target:target?.id;
  const block=state.advanced.textBlocks.find((item)=>String(item.id)===String(id));
  if(!block)throw new Error("Text block not found.");
  block.text=String(text??"");
  return state;
}

export function applyAdvancedObjectAction(document,target,action,{
  duplicateId="",
  duplicateOffset=24
}={}){
  const state=normalizeAdvancedStudioDocument(document);
  if(state.mode!==ADVANCED_MODE)throw new Error("Advanced object actions are available only in Advanced Studio.");
  const type=target?.type;
  if(type!=="media"&&type!=="text")throw new TypeError("A selected media or text target is required.");
  if(!MEDIA_CONTEXT_ACTIONS.includes(action))throw new RangeError("Unsupported Advanced object action.");
  const key=type==="media"?"media":"textBlocks";
  const items=state.advanced[key];
  const id=String(target?.id||"");
  const index=items.findIndex((item)=>String(item.id)===id);
  if(index<0)throw new Error(type==="media"?"Media element not found.":"Text block not found.");
  const changed=action==="delete"||action==="duplicate"||
    action==="bring-forward"&&index<items.length-1||
    action==="send-backward"&&index>0;
  if(!changed){
    return{document:state,changed:false,mutation:null,selection:clone(target)};
  }
  let nextSelection=clone(target);
  if(action==="duplicate"){
    const nextId=String(duplicateId||"").trim();
    if(!nextId)throw new TypeError("A unique duplicate object ID is required.");
    if(items.some((item)=>String(item.id)===nextId)){
      throw new Error("The duplicate object ID already exists.");
    }
    const source=items[index];
    const duplicate=constrainAdvancedObjectToBoard({
      ...clone(source),
      id:nextId,
      x:finite(source.x,0)+finite(duplicateOffset,24),
      y:finite(source.y,0)+finite(duplicateOffset,24),
      layerIndex:items.length
    });
    state.advanced[key]=[...items,duplicate];
    nextSelection={type,id:nextId};
  }else{
    state.advanced[key]=action==="delete"
      ?deleteMediaElement(items,id)
      :changeMediaZOrder(items,id,action);
  }
  const actionLabel={
    "bring-forward":"Bring",
    "send-backward":"Send",
    duplicate:"Duplicate",
    delete:"Delete"
  }[action];
  return{
    document:state,
    changed:true,
    mutation:{
      label:`${actionLabel} ${type}${action==="bring-forward"?" forward":action==="send-backward"?" backward":""}`,
      history:true,
      undoSteps:1
    },
    selection:action==="delete"?null:nextSelection
  };
}

export function normalizeRecentColors(colors=[]){
  const normalized=[];
  for(const value of safeArray(colors)){
    const color=normalizeHex(value);
    if(color&&!normalized.includes(color))normalized.push(color);
    if(normalized.length===8)break;
  }
  return normalized;
}

export function recordRecentColor(colors,value){
  const color=normalizeHex(value);
  if(!color)throw new TypeError("Enter a six-digit hex color.");
  return[color,...normalizeRecentColors(colors).filter((item)=>item!==color)].slice(0,8);
}

function normalizedThemeSwatches(themeSwatches){
  const source=Array.isArray(themeSwatches)?themeSwatches:
    themeSwatches?.categories?[
      ...Object.values(themeSwatches.categories),
      themeSwatches.ink,
      themeSwatches.headline?.color,
      themeSwatches.board?.color
    ]:[];
  return[...new Set(source.map(normalizeHex).filter(Boolean))];
}

export function eyedropperAvailable(environment=globalThis){
  return typeof environment?.EyeDropper==="function";
}

export function buildColorPickerModel({
  themeSwatches=[],
  recentColors=[],
  environment=globalThis
}={}){
  return{
    themeSwatches:normalizedThemeSwatches(themeSwatches),
    curatedSwatches:clone(CURATED_COLOR_SWATCHES),
    hexInput:true,
    eyedropperVisible:eyedropperAvailable(environment),
    recentColors:normalizeRecentColors(recentColors)
  };
}

export async function sampleEyeDropper(environment=globalThis){
  if(!eyedropperAvailable(environment))return{available:false,color:null};
  const result=await new environment.EyeDropper().open();
  const color=normalizeHex(result?.sRGBHex);
  if(!color)throw new Error("The eyedropper did not return a valid color.");
  return{available:true,color};
}

export function renderModeDialog(model){
  if(!model)return"";
  return`<section class="dialog-card advanced-mode-dialog" role="dialog" aria-modal="true" aria-labelledby="${escapeHtml(model.id)}-title" data-advanced-dialog="${escapeHtml(model.id)}">
    <h2 id="${escapeHtml(model.id)}-title">${escapeHtml(model.title)}</h2>
    <p>${escapeHtml(model.body)}</p>
    <div class="dialog-actions">
      <button type="button" class="button secondary" data-mode-dialog-secondary>${escapeHtml(model.secondary)}</button>
      <button type="button" class="button primary" data-mode-dialog-primary>${escapeHtml(model.primary)}</button>
    </div>
  </section>`;
}

export function renderInsertStrip(document={}){
  const items=buildInsertStripModel(document);
  if(!items)return"";
  return`<div class="advanced-insert-strip" role="toolbar" aria-label="Advanced Studio insert tools" data-advanced-insert-strip>${items.map((item)=>{
    if(item.kind==="divider")return'<span class="toolbar-divider" role="separator" data-advanced-divider></span>';
    if(item.kind==="toggle"){
      return`<label class="layout-lock-toggle"><input type="checkbox" data-layout-lock ${item.pressed?"checked":""}><span>${escapeHtml(item.label)}</span></label>`;
    }
    return`<button type="button" class="button secondary compact" data-advanced-action="${escapeHtml(item.id)}">${escapeHtml(item.label)}</button>`;
  }).join("")}</div>`;
}

function targetAttributes(target){
  if(!target?.type)return"";
  const id=target.id==null?"":String(target.id);
  return` data-advanced-target-type="${escapeHtml(target.type)}" data-advanced-target-id="${escapeHtml(id)}"`;
}

function colorContextAttributes(scope,target){
  return` data-advanced-color-scope="${escapeHtml(scope)}"${targetAttributes(target)}`;
}

function swatchButtons(colors,group,{scope="background",target=null}={}){
  const context=colorContextAttributes(scope,target);
  return colors.map((color)=>`<button type="button" class="color-swatch" data-advanced-color="${color}" style="--swatch:${color}" aria-label="${color}" data-color-group="${group}"${context}></button>`).join("");
}

export function renderColorPicker({
  themeSwatches=[],
  recentColors=[],
  environment=globalThis,
  scope="background",
  target=null,
  value=""
}={}){
  const model=buildColorPickerModel({themeSwatches,recentColors,environment});
  const normalizedScope=scope==="typography"?"typography":"background";
  const context=colorContextAttributes(normalizedScope,target);
  const normalizedValue=normalizeHex(value)||"";
  const swatchOptions={scope:normalizedScope,target};
  return`<section class="advanced-color-picker" data-advanced-color-picker${context}>
    <div class="theme-swatches" data-color-row="theme">${swatchButtons(model.themeSwatches,"theme",swatchOptions)}</div>
    <div class="curated-swatches" data-color-row="curated">${swatchButtons(model.curatedSwatches,"curated",swatchOptions)}</div>
    <label class="hex-color-field"><span>Hex</span><input type="text" inputmode="text" data-advanced-hex maxlength="7" placeholder="#191C21" value="${escapeHtml(normalizedValue)}"${context}></label>
    ${model.eyedropperVisible?`<button type="button" class="button secondary compact" data-advanced-eyedropper${context}>Eyedropper</button>`:""}
    <div class="recent-swatches" data-color-row="recent">${swatchButtons(model.recentColors,"recent",swatchOptions)}</div>
  </section>`;
}

function normalizedTypographyValue(value={}){
  const candidate={
    font:FREE_TEXT_FONTS.includes(value.font)?value.font:DEFAULT_FREE_TEXT_TYPOGRAPHY.font,
    size:Number.isFinite(Number(value.size))&&Number(value.size)>=FREE_TEXT_SIZE.min&&Number(value.size)<=FREE_TEXT_SIZE.max
      ?Number(value.size)
      :DEFAULT_FREE_TEXT_TYPOGRAPHY.size,
    weight:FREE_TEXT_WEIGHTS.includes(Number(value.weight))
      ?Number(value.weight)
      :DEFAULT_FREE_TEXT_TYPOGRAPHY.weight,
    color:normalizeHex(value.color)||DEFAULT_FREE_TEXT_TYPOGRAPHY.color,
    alignment:FREE_TEXT_ALIGNMENTS.some(({id})=>id===value.alignment)
      ?value.alignment
      :DEFAULT_FREE_TEXT_TYPOGRAPHY.alignment
  };
  return validateTypography(candidate).value;
}

export function buildAdvancedSelectionModel(document={},selection={}){
  const state=normalizeAdvancedStudioDocument(document);
  if(state.mode!==ADVANCED_MODE)return null;
  const type=String(selection?.type||"");
  const id=selection?.id==null?"":String(selection.id);
  if(type==="media"){
    const element=state.advanced.media.find((item)=>String(item.id)===id);
    return element?{
      target:{type,id},
      element:clone(element),
      actions:clone(MEDIA_CONTEXT_ACTIONS),
      editableText:false,
      typography:null
    }:null;
  }
  if(type==="text"){
    const element=state.advanced.textBlocks.find((item)=>String(item.id)===id);
    return element?{
      target:{type,id},
      element:clone(element),
      actions:clone(MEDIA_CONTEXT_ACTIONS),
      editableText:true,
      typography:normalizedTypographyValue(element)
    }:null;
  }
  if(type==="headline"){
    const typography=state.advanced.headlineTypography||
      selection.typography||
      DEFAULT_FREE_TEXT_TYPOGRAPHY;
    return{
      target:{type:"headline",id:id||"headline"},
      element:null,
      actions:[],
      editableText:false,
      typography:normalizedTypographyValue(typography)
    };
  }
  return null;
}

function objectActionLabel(action){
  return{
    "bring-forward":"Bring forward",
    "send-backward":"Send backward",
    duplicate:"Duplicate",
    delete:"Delete"
  }[action]||action;
}

export function renderAdvancedAssetRail(document={},selection=null){
  const state=normalizeAdvancedStudioDocument(document);
  if(state.mode!==ADVANCED_MODE)return"";
  const items=[
    ...state.advanced.media.map((item)=>({
      type:"media",
      id:String(item.id),
      label:String(item.source?.name||item.kind||"Media asset"),
      detail:String(item.kind||"media").toUpperCase()
    })),
    ...state.advanced.textBlocks.map((item,index)=>({
      type:"text",
      id:String(item.id),
      label:String(item.text||`Text ${index+1}`),
      detail:"TEXT"
    }))
  ];
  return`<aside class="advanced-asset-rail" aria-label="Timeline assets" data-advanced-asset-rail>
    <div class="advanced-asset-rail-heading"><strong>Assets</strong><span>${items.length}</span></div>
    ${items.length
      ?`<div class="advanced-asset-rail-list">${items.map((item)=>{
        const selected=selection?.type===item.type&&String(selection?.id)===item.id;
        return`<button type="button" data-advanced-select-object data-advanced-target-type="${item.type}" data-advanced-target-id="${escapeHtml(item.id)}" aria-pressed="${String(selected)}"><span>${escapeHtml(item.label)}</span><small>${item.detail}</small></button>`;
      }).join("")}</div>`
      :'<p class="advanced-asset-rail-empty">Add an image or text block to begin.</p>'}
  </aside>`;
}

export function renderAdvancedSelectionControls(document={},{
  selection=null,
  themeSwatches=[],
  environment=globalThis
}={}){
  const state=normalizeAdvancedStudioDocument(document);
  const model=buildAdvancedSelectionModel(state,selection);
  if(!model)return"";
  const target=targetAttributes(model.target);
  const actions=model.actions.length
    ?`<div class="advanced-object-actions" role="toolbar" aria-label="Selected ${escapeHtml(model.target.type)} actions" data-advanced-object-actions${target}>${model.actions.map((action)=>`<button type="button" class="button secondary compact" data-advanced-object-action="${escapeHtml(action)}"${target}>${escapeHtml(objectActionLabel(action))}</button>`).join("")}</div>`
    :"";
  const aspectLock=model.target.type==="media"
    ?`<label class="advanced-aspect-lock"><input type="checkbox" data-advanced-aspect-lock${target} ${model.element.aspectLocked!==false?"checked":""}><span>Lock proportions</span></label>`
    :"";
  if(!model.typography){
    return`<section class="advanced-selection-controls" data-advanced-selection-controls${target}>${actions}${aspectLock}</section>`;
  }
  const typography=model.typography;
  const textContent=model.editableText
    ?`<label class="advanced-text-content"><span>Text</span><textarea data-advanced-text-content${target}>${escapeHtml(model.element.text)}</textarea></label>`
    :"";
  const fontOptions=FREE_TEXT_FONTS.map((font)=>`<option value="${font}"${font===typography.font?" selected":""}>${font}</option>`).join("");
  const weightOptions=FREE_TEXT_WEIGHTS.map((weight)=>`<option value="${weight}"${weight===typography.weight?" selected":""}>${weight}</option>`).join("");
  const alignments=FREE_TEXT_ALIGNMENTS.map(({id,label})=>`<button type="button" class="button secondary compact" data-advanced-alignment="${id}" aria-pressed="${String(id===typography.alignment)}"${target}>${label}</button>`).join("");
  const colorPicker=renderColorPicker({
    themeSwatches,
    recentColors:state.advanced.recentColors,
    environment,
    scope:"typography",
    target:model.target,
    value:typography.color
  });
  return`<section class="advanced-selection-controls" data-advanced-selection-controls${target}>
    ${actions}
    <fieldset class="advanced-typography-controls" data-advanced-typography-controls${target}>
      <legend>Typography</legend>
      ${textContent}
      <label><span>Font</span><select data-advanced-typography-field="font"${target}>${fontOptions}</select></label>
      <label><span>Size</span><input type="number" min="${FREE_TEXT_SIZE.min}" max="${FREE_TEXT_SIZE.max}" step="1" value="${typography.size}" data-advanced-typography-field="size"${target}></label>
      <label><span>Weight</span><select data-advanced-typography-field="weight"${target}>${weightOptions}</select></label>
      <div role="group" aria-label="Text alignment" data-advanced-alignments>${alignments}</div>
      ${colorPicker}
    </fieldset>
  </section>`;
}

export function renderBackgroundPanel(document={},{
  activeTab="Presets",
  themeSwatches=[],
  environment=globalThis
}={}){
  const state=normalizeAdvancedStudioDocument(document);
  if(state.mode!==ADVANCED_MODE)return"";
  const tab=BACKGROUND_TABS.includes(activeTab)?activeTab:"Presets";
  let body="";
  if(tab==="Presets"){
    body=`<div class="background-presets" data-background-presets>${ADVANCED_BACKGROUND_PRESETS.map((preset)=>`<button type="button" class="background-preset" data-background-preset="${preset.id}" aria-label="${escapeHtml(preset.name)}" style="--preset-background:${preset.css}"><span>${escapeHtml(preset.name)}</span></button>`).join("")}</div>`;
  }else if(tab==="Upload"){
    const background=state.advanced.background;
    body=`<div class="background-upload" data-background-upload-panel>
      <label><span>Upload</span><input type="file" accept=".png,.jpg,.jpeg,image/png,image/jpeg" data-background-upload></label>
      <label><span>Dim for readability</span><input type="range" min="${MIN_BACKGROUND_DIM}" max="${MAX_BACKGROUND_DIM}" value="${normalizeDim(background.dim)}" data-background-dim></label>
    </div>`;
  }else{
    body=renderColorPicker({
      themeSwatches,
      recentColors:state.advanced.recentColors,
      environment
    });
  }
  return`<section class="advanced-background-panel" aria-label="Background" data-background-panel>
    <div class="background-tabs" role="tablist">${BACKGROUND_TABS.map((label)=>`<button type="button" role="tab" aria-selected="${String(label===tab)}" data-background-tab="${label}">${label}</button>`).join("")}</div>
    ${body}
  </section>`;
}

export function renderAdvancedStudio(document={},options={}){
  const state=normalizeAdvancedStudioDocument(document);
  if(state.mode!==ADVANCED_MODE)return"";
  return`${renderInsertStrip(state)}<div class="advanced-editor-workspace">${renderAdvancedAssetRail(state,options.selection)}<div class="advanced-editor-panels">${options.backgroundOpen?renderBackgroundPanel(state,options):""}${renderAdvancedSelectionControls(state,options)}</div></div>`;
}

/*
 * Installs event delegation only. All mutations, file persistence, object-URL
 * creation/revocation, luminance sampling, history, and autosave remain owned by
 * the caller through explicit hooks.
 */
export function installAdvancedStudio(root,hooks={}){
  if(!root?.addEventListener)return()=>{};
  const closest=(target,selector)=>target?.closest?.(selector)||null;
  const delegatedTarget=(control)=>{
    const type=String(control?.dataset?.advancedTargetType||"");
    if(!["media","text","headline"].includes(type))return null;
    return{type,id:String(control?.dataset?.advancedTargetId||type)};
  };
  const colorContext=(control)=>({
    scope:control?.dataset?.advancedColorScope==="typography"?"typography":"background",
    target:delegatedTarget(control)
  });
  const click=(event)=>{
    const selectObject=closest(event.target,"[data-advanced-select-object]");
    if(selectObject){
      hooks.onSelectObject?.(delegatedTarget(selectObject),event);
      return;
    }
    const action=closest(event.target,"[data-advanced-action]");
    if(action){
      hooks.onAction?.(action.dataset.advancedAction,event);
      return;
    }
    const objectAction=closest(event.target,"[data-advanced-object-action]");
    if(objectAction){
      hooks.onObjectAction?.(
        objectAction.dataset.advancedObjectAction,
        delegatedTarget(objectAction),
        event
      );
      return;
    }
    const alignment=closest(event.target,"[data-advanced-alignment]");
    if(alignment){
      hooks.onTypography?.(
        {alignment:String(alignment.dataset.advancedAlignment||"")},
        delegatedTarget(alignment),
        event
      );
      return;
    }
    const tab=closest(event.target,"[data-background-tab]");
    if(tab){
      hooks.onBackgroundTab?.(tab.dataset.backgroundTab,event);
      return;
    }
    const preset=closest(event.target,"[data-background-preset]");
    if(preset){
      hooks.onBackgroundPreset?.(preset.dataset.backgroundPreset,event);
      return;
    }
    const color=closest(event.target,"[data-advanced-color]");
    if(color){
      const value=normalizeHex(color.dataset.advancedColor);
      const context=colorContext(color);
      if(context.scope==="typography"){
        hooks.onTypography?.({color:value},context.target,event);
      }else{
        hooks.onColor?.(value,event,context);
      }
      return;
    }
    const eyedropper=closest(event.target,"[data-advanced-eyedropper]");
    if(eyedropper){
      hooks.onEyeDropper?.(event,colorContext(eyedropper));
      return;
    }
    if(closest(event.target,"[data-mode-dialog-primary]")){
      hooks.onDialogPrimary?.(event);
      return;
    }
    if(closest(event.target,"[data-mode-dialog-secondary]")){
      hooks.onDialogSecondary?.(event);
    }
  };
  const change=(event)=>{
    const upload=closest(event.target,"[data-background-upload]");
    if(upload){
      hooks.onBackgroundUpload?.(upload.files?.[0]||null,event);
      return;
    }
    const lock=closest(event.target,"[data-layout-lock]");
    if(lock){
      hooks.onLayoutLock?.(!!lock.checked,event);
      return;
    }
    const aspectLock=closest(event.target,"[data-advanced-aspect-lock]");
    if(aspectLock){
      hooks.onAspectLock?.(
        !!aspectLock.checked,
        delegatedTarget(aspectLock),
        event
      );
      return;
    }
    const typography=closest(event.target,"[data-advanced-typography-field]");
    if(typography){
      const field=String(typography.dataset.advancedTypographyField||"");
      const value=field==="size"||field==="weight"?Number(typography.value):String(typography.value||"");
      hooks.onTypography?.({[field]:value},delegatedTarget(typography),event);
      return;
    }
    const hex=closest(event.target,"[data-advanced-hex]");
    if(hex){
      const value=normalizeHex(hex.value);
      const context=colorContext(hex);
      if(context.scope==="typography"){
        hooks.onTypography?.({color:value},context.target,event);
      }else{
        hooks.onHex?.(value,event,context);
      }
    }
  };
  const input=(event)=>{
    const text=closest(event.target,"[data-advanced-text-content]");
    if(text){
      hooks.onTextContent?.(String(text.value??""),delegatedTarget(text),event);
      return;
    }
    const dim=closest(event.target,"[data-background-dim]");
    if(dim)hooks.onBackgroundDim?.(normalizeDim(dim.value),event);
  };
  root.addEventListener("click",click);
  root.addEventListener("change",change);
  root.addEventListener("input",input);
  return()=>{
    root.removeEventListener("click",click);
    root.removeEventListener("change",change);
    root.removeEventListener("input",input);
  };
}
