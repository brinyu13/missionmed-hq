import {
  DEFAULT_THEME_ID,
  THEME_DEFINITIONS
} from "./themes.js";
import {contrastRatio} from "./utils.js";

const clone=(value)=>value==null?value:structuredClone(value);
const freezeDeep=(value)=>{
  if(!value||typeof value!=="object"||Object.isFrozen(value))return value;
  for(const child of Object.values(value))freezeDeep(child);
  return Object.freeze(value);
};

const CATEGORY_IDS=Object.freeze([
  "education","exams","clinical","work","research","personal"
]);
const ALLOWED_ASSET_MIME_TYPES=Object.freeze([
  "image/png","image/jpeg","image/webp"
]);
const COLOR=/^#[0-9A-F]{6}$/i;
const PACKAGE_ID=/^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const VERSION=/^\d+\.\d+\.\d+$/;

export const ADMIN_THEME_PACKAGE_SCHEMA_VERSION="1.0";
export const ADMIN_THEME_RENDERER_VERSION="1.0.0";
export const ADMIN_THEME_PERMISSION="timeline.theme.manage";
export const ADMIN_THEME_PREVIEW_CONTRACT=
  "D1-405-ADMIN-THEME-PREVIEW-REQUEST-V1";

export const ADMIN_THEME_PACKAGE_BOUNDARY=freezeDeep({
  structuredDataOnly:true,
  arbitraryCss:false,
  arbitraryJavaScript:false,
  arbitraryHtml:false,
  executableAssets:false,
  allowedAssetMimeTypes:ALLOWED_ASSET_MIME_TYPES,
  permission:ADMIN_THEME_PERMISSION,
  productionAdminBackend:false
});

function semanticVersion(value){
  if(!VERSION.test(String(value||"")))return null;
  return String(value).split(".").map(Number);
}

function compareVersions(left,right){
  for(let index=0;index<3;index+=1){
    if(left[index]!==right[index])return left[index]-right[index];
  }
  return 0;
}

function forbiddenExecutableKey(value,path="package"){
  if(!value||typeof value!=="object")return null;
  for(const [key,child] of Object.entries(value)){
    const next=`${path}.${key}`;
    if(["css","javascript","script","html","code","url"].includes(key.toLowerCase())){
      return next;
    }
    if(typeof child==="string"&&/(?:javascript:|<script|url\s*\()/i.test(child)){
      return next;
    }
    const nested=forbiddenExecutableKey(child,next);
    if(nested)return nested;
  }
  return null;
}

function compileBoard(board={}){
  if(board.kind==="flat"){
    return{
      kind:"flat",
      color:board.color,
      css:board.color,
      contrastSurfaces:[board.color]
    };
  }
  if(board.kind==="linear-gradient"){
    const angle=Number(board.angle);
    return{
      kind:"linear-gradient",
      angle,
      start:board.start,
      end:board.end,
      css:`linear-gradient(${angle}deg, ${board.start} 0%, ${board.end} 100%)`,
      contrastSurfaces:[board.start,board.end]
    };
  }
  if(board.kind==="radial-gradient"){
    const position=String(board.position||"50% 30%");
    return{
      kind:"radial-gradient",
      position,
      start:board.start,
      end:board.end,
      css:`radial-gradient(at ${position}, ${board.start} 0%, ${board.end} 100%)`,
      contrastSurfaces:[board.start,board.end]
    };
  }
  return null;
}

function validateColor(value,label,errors){
  if(!COLOR.test(String(value||"")))errors.push(`${label} must be a six-digit hex color.`);
}

export function validateAdminThemePackage(themePackage,{
  rendererVersion=ADMIN_THEME_RENDERER_VERSION
}={}){
  const errors=[];
  const forbidden=forbiddenExecutableKey(themePackage);
  if(forbidden)errors.push(`${forbidden} is not allowed; theme packages are structured data only.`);
  if(themePackage?.schemaVersion!==ADMIN_THEME_PACKAGE_SCHEMA_VERSION){
    errors.push(`schemaVersion must be ${ADMIN_THEME_PACKAGE_SCHEMA_VERSION}.`);
  }
  if(!PACKAGE_ID.test(String(themePackage?.id||""))){
    errors.push("Package id must be a lowercase, hyphenated identifier.");
  }
  if(!VERSION.test(String(themePackage?.version||""))){
    errors.push("Package version must use semantic versioning.");
  }
  const minimum=semanticVersion(themePackage?.compatibility?.minimumRendererVersion);
  const maximum=semanticVersion(themePackage?.compatibility?.maximumRendererVersion);
  const current=semanticVersion(rendererVersion);
  if(!minimum||!maximum||!current){
    errors.push("Compatibility must contain valid minimum and maximum renderer versions.");
  }else if(compareVersions(minimum,current)>0||compareVersions(current,maximum)>0){
    errors.push(`Package is not compatible with renderer ${rendererVersion}.`);
  }

  const definition=themePackage?.definition||{};
  if(!PACKAGE_ID.test(String(definition.id||""))){
    errors.push("Theme definition id must be a lowercase, hyphenated identifier.");
  }
  if(!definition.name||!definition.descriptor){
    errors.push("Theme name and descriptor are required.");
  }
  if(!["flat","linear-gradient","radial-gradient"].includes(definition?.board?.kind)){
    errors.push("Board kind must be flat, linear-gradient, or radial-gradient.");
  }
  const compiledBoard=compileBoard(definition.board);
  if(!compiledBoard){
    errors.push("Board tokens could not be compiled.");
  }else{
    for(const [index,color] of compiledBoard.contrastSurfaces.entries()){
      validateColor(color,`Board surface ${index+1}`,errors);
    }
  }
  for(const [label,value] of [
    ["Axis color",definition?.axis?.color],
    ["Tick color",definition?.ticks?.color],
    ["Year-label color",definition?.yearLabel?.color],
    ["Ink",definition?.ink],
    ["Flag fill",definition?.flagPlate?.fill],
    ["Flag ink",definition?.flagPlate?.ink],
    ["Headline color",definition?.headline?.color]
  ])validateColor(value,label,errors);
  const categoryKeys=Object.keys(definition.categories||{}).sort();
  if(
    categoryKeys.length!==CATEGORY_IDS.length||
    !CATEGORY_IDS.every((id)=>categoryKeys.includes(id))
  ){
    errors.push("Theme definition must provide all six category colors.");
  }
  for(const id of CATEGORY_IDS){
    validateColor(definition.categories?.[id],`${id} category color`,errors);
  }
  if(compiledBoard&&COLOR.test(String(definition.ink||""))){
    const ratios=compiledBoard.contrastSurfaces.map((surface)=>
      contrastRatio(definition.ink,surface)
    );
    if(ratios.some((ratio)=>ratio<4.5)){
      errors.push("Theme ink must maintain at least 4.5:1 across every board surface.");
    }
  }

  const assetIds=new Set();
  for(const asset of Array.isArray(themePackage?.assets)?themePackage.assets:[]){
    if(!PACKAGE_ID.test(String(asset?.id||"")))errors.push("Asset ids must be lowercase and hyphenated.");
    if(assetIds.has(asset?.id))errors.push(`Duplicate asset id "${asset?.id}".`);
    assetIds.add(asset?.id);
    if(!ALLOWED_ASSET_MIME_TYPES.includes(asset?.mimeType)){
      errors.push(`Asset "${asset?.id}" has an unsupported MIME type.`);
    }
    if(!/^[a-f0-9]{64}$/i.test(String(asset?.sha256||""))){
      errors.push(`Asset "${asset?.id}" must declare a SHA-256 digest.`);
    }
    if(!Number.isInteger(asset?.bytes)||asset.bytes<=0){
      errors.push(`Asset "${asset?.id}" must declare a positive byte count.`);
    }
  }
  return freezeDeep({
    valid:errors.length===0,
    errors,
    rendererVersion,
    safeFallbackThemeId:DEFAULT_THEME_ID,
    executableContentAccepted:false
  });
}

function compileDefinition(themePackage){
  const source=clone(themePackage.definition);
  source.board=compileBoard(source.board);
  source.package=Object.freeze({
    id:themePackage.id,
    version:themePackage.version,
    schemaVersion:themePackage.schemaVersion
  });
  return freezeDeep(source);
}

export function createAdminThemeRegistry({
  frozenThemes=THEME_DEFINITIONS,
  importedPackages=[],
  fallbackThemeId=DEFAULT_THEME_ID
}={}){
  const frozen=new Map(frozenThemes.map((theme)=>[theme.id,theme]));
  const imported=new Map(
    importedPackages.map((themePackage)=>[
      themePackage.definition.id,
      freezeDeep(clone(themePackage))
    ])
  );
  const resolve=(themeId)=>{
    const id=String(themeId||"");
    const theme=frozen.get(id)||
      (imported.has(id)?compileDefinition(imported.get(id)):null);
    return freezeDeep({
      requestedThemeId:id,
      resolvedThemeId:theme?.id||fallbackThemeId,
      theme:theme||frozen.get(fallbackThemeId),
      fallbackUsed:!theme
    });
  };
  return freezeDeep({
    schemaVersion:ADMIN_THEME_PACKAGE_SCHEMA_VERSION,
    frozenThemeIds:[...frozen.keys()],
    importedThemeIds:[...imported.keys()],
    fallbackThemeId,
    resolve,
    packages:[...imported.values()]
  });
}

function hasManagePermission(permissionBoundary,actor){
  if(typeof permissionBoundary==="function"){
    return permissionBoundary({
      permission:ADMIN_THEME_PERMISSION,
      actor
    })===true;
  }
  return permissionBoundary?.can?.(ADMIN_THEME_PERMISSION,actor)===true;
}

export async function importAdminThemePackage(themePackage,{
  actor=null,
  permissionBoundary=null,
  assetResolver=null,
  registry=createAdminThemeRegistry()
}={}){
  if(!hasManagePermission(permissionBoundary,actor)){
    throw new Error(`Permission ${ADMIN_THEME_PERMISSION} is required.`);
  }
  const validation=validateAdminThemePackage(themePackage);
  if(!validation.valid){
    throw new TypeError(validation.errors.join(" "));
  }
  if(typeof assetResolver!=="function"&&(themePackage.assets||[]).length){
    throw new Error("An approved asset resolver is required for package assets.");
  }
  for(const asset of themePackage.assets||[]){
    const resolved=await assetResolver(asset);
    if(resolved?.approved!==true||resolved?.sha256!==asset.sha256){
      throw new Error(`Asset "${asset.id}" failed approval or integrity verification.`);
    }
  }
  const previous=registry.packages.find(({definition})=>
    definition.id===themePackage.definition.id
  );
  if(previous){
    const incoming=semanticVersion(themePackage.version);
    const existing=semanticVersion(previous.version);
    if(compareVersions(incoming,existing)<=0){
      throw new RangeError("Imported theme version must advance the existing package version.");
    }
  }
  const retained=registry.packages.filter(({definition})=>
    definition.id!==themePackage.definition.id
  );
  return createAdminThemeRegistry({
    importedPackages:[...retained,themePackage],
    fallbackThemeId:registry.fallbackThemeId
  });
}

export function buildAdminThemePreviewRequest(themePackage,timeline){
  const validation=validateAdminThemePackage(themePackage);
  if(!validation.valid)throw new TypeError(validation.errors.join(" "));
  return freezeDeep({
    contract:ADMIN_THEME_PREVIEW_CONTRACT,
    renderer:"D1-UXR-002-Keynote-Classic",
    contentSource:Array.isArray(timeline?.events)&&timeline.events.length
      ?"student"
      :"example",
    timeline:clone(timeline),
    theme:compileDefinition(themePackage),
    label:"Admin theme package preview",
    executableContent:false,
    externalApiCalls:false,
    productionWrites:false,
    fallbackThemeId:DEFAULT_THEME_ID
  });
}
