import { createHash } from "node:crypto";
import { cp, mkdir, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { dirname, extname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { build } from "esbuild";

const root=resolve(dirname(fileURLToPath(import.meta.url)),"..");
const web=join(root,"web");
const dist=join(root,"dist");
const mode=process.argv.includes("--mode=release")?"release":"local";
const head=execFileSync("git",["rev-parse","HEAD"],{cwd:root,encoding:"utf8"}).trim();
const acceptedBase="49ba56dacd2cddfc2fb2241839d54a03e85bc271";
const externalWebRoot=String(process.env.TIMELINE_ACCEPTED_WEB_ASSET_ROOT||"").trim();
const externalManifestPath=String(process.env.TIMELINE_ACCEPTED_ASSET_MANIFEST||"").trim();
if(externalWebRoot&&resolve(externalWebRoot)!==externalWebRoot)throw new Error("TIMELINE_ACCEPTED_WEB_ASSET_ROOT_MUST_BE_ABSOLUTE");
if(externalManifestPath&&resolve(externalManifestPath)!==externalManifestPath)throw new Error("TIMELINE_ACCEPTED_ASSET_MANIFEST_MUST_BE_ABSOLUTE");
if(mode==="release"&&(!externalWebRoot||!externalManifestPath))throw new Error("TIMELINE_ACCEPTED_ASSET_AUTHORITY_REQUIRED");
const acceptedManifest=JSON.parse(execFileSync("git",["show",`${acceptedBase}:packages/mission-timeline/release/manifest.json`],{cwd:resolve(root,"../.."),encoding:"utf8"}));
const acceptedFiles=new Map(acceptedManifest.files.map((entry)=>[entry.path,entry]));
const sha256=(bytes)=>createHash("sha256").update(bytes).digest("hex");
const protectedManifest=await readFile(join(web,"presentation","d1-409h-a1","PROTECTED_HASHES.sha256"),"utf8");
for(const line of protectedManifest.split(/\r?\n/)){
  const match=line.match(/^([a-f0-9]{64})\s+(.+)$/);if(!match)continue;
  acceptedFiles.set(`web/presentation/d1-409h-a1/${match[2]}`,{sha256:match[1]});
}
let externalManifestBytes=null;
if(externalManifestPath){
  externalManifestBytes=await readFile(externalManifestPath);
  const parsed=JSON.parse(externalManifestBytes.toString("utf8"));
  for(const entry of parsed.files||[]){if(!acceptedFiles.has(entry.path))acceptedFiles.set(entry.path,entry);}
}
if(mode==="release"){
  const expected=String(process.env.TIMELINE_EXPECTED_COMMIT||"").trim();
  if(!/^[a-f0-9]{40}$/.test(expected)||expected!==head)throw new Error("TIMELINE_EXPECTED_COMMIT_MISMATCH");
  const status=execFileSync("git",["status","--porcelain=v1","--untracked-files=all","--","packages/mission-timeline","wp-content/plugins/missionmed-timeline-sso"],{cwd:resolve(root,"../.."),encoding:"utf8"}).trim();
  if(status)throw new Error("TIMELINE_RELEASE_SOURCE_NOT_CLEAN");
}

await rm(dist,{recursive:true,force:true});await mkdir(join(dist,"assets"),{recursive:true});
const bundleTemp=join(dist,"assets","app.js");
await build({
  entryPoints:[join(web,"js","407f-engineering-adapter.js")],
  outfile:bundleTemp,
  bundle:true,
  format:"esm",
  platform:"browser",
  target:"es2022",
  minify:false,
  sourcemap:false,
  // The protected Fable adapter includes a guarded CommonJS export for its
  // standalone test harness. In a browser ESM bundle `module` is intentionally
  // absent, so suppress only esbuild's advisory without altering protected bytes.
  logOverride:{"commonjs-variable-in-esm":"silent"},
});
const bundle=await readFile(bundleTemp);const bundleHash=createHash("sha256").update(bundle).digest("hex");
const bundleName=`assets/app.${bundleHash.slice(0,12)}.js`;await writeFile(join(dist,bundleName),bundle);await rm(bundleTemp);

let index=await readFile(join(web,"index.html"),"utf8");
index=index.replace("<head>",'<head>\n<base href="/timeline/">\n<script>window.D1_TIMELINE_RUNTIME_MODE="production";</script>');
const legacyBridgeAnchor="window.D1_407F_TEST={";
const legacyStateScrub=`if(window.D1_TIMELINE_RUNTIME_MODE==="production"){
  state.mode="blank";state.safe=false;state.sel=null;state.draft=0;state.saved=true;
  state.user={events:[],interview:{prog:"",date:"",label:""}};
  state.demo={events:[],interview:{prog:"",date:"",label:""}};
  state.profile={name:"",country:"",visa:"",s1:"",s2:"",goal:""};
  state.sticky="";state.photoN=0;state.media={photos:{},logo:false,avatar:false};
  state.candidates=[];state.practice=[];state.comments=[];state.flags=[];state.versions=[];
  state.approvals={personal:false,safeView:false,export:false};
  state.builder={step:1,skipped:{},touched:{},examSystems:[],exams:[]};
  state.wiz=Object.fromEntries(Object.entries(state.wiz||{}).map(([key,value])=>[
    key,Array.isArray(value)?[]:typeof value==="boolean"?false:typeof value==="number"?0:""
  ]));
  document.documentElement.dataset.timelineLegacyStateScrubbed="true";
}
`;
if(!index.includes(legacyBridgeAnchor))throw new Error("LEGACY_BRIDGE_ANCHOR_MISSING");
index=index.replace(legacyBridgeAnchor,`${legacyStateScrub}${legacyBridgeAnchor}`);
index=index.replace('<script type="module" src="./js/407f-engineering-adapter.js"></script>',`<script type="module" src="./${bundleName}"></script>`);
if(index.includes("./js/407f-engineering-adapter.js"))throw new Error("PRODUCTION_ENTRYPOINT_REWRITE_FAILED");
index=index.replace(' src="assets/renderer_400g_best.png"','');
if(index.includes('src="assets/renderer_400g_best.png"'))throw new Error("PRIVATE_REVIEW_REFERENCE_PRESENT");
await writeFile(join(dist,"index.html"),index);

await mkdir(join(dist,"styles"),{recursive:true});
await cp(join(web,"styles","407f-upgrade.css"),join(dist,"styles","407f-upgrade.css"));
const assetRefs=new Set();
for(const text of [index,await readFile(join(web,"styles","407f-upgrade.css"),"utf8")]){
  for(const match of text.matchAll(/(?:src=|href=|url\()["']?([^"')\s]+)["']?/g)){
    const value=match[1].replace(/^\.\//,"");
    if(value.startsWith("assets/")&&!value.startsWith("assets/app."))assetRefs.add(value);
  }
}
for(const asset of [...assetRefs].sort()){
  const source=join(web,asset);const target=join(dist,asset);
  await mkdir(dirname(target),{recursive:true});await cp(source,target);
}
await cp(join(web,"presentation","d1-409h-a1"),join(dist,"presentation","d1-409h-a1"),{recursive:true});

async function acceptedAsset(path){
  const candidates=[join(web,path),...(externalWebRoot?[join(externalWebRoot,path)]:[])];
  let bytes=null;
  for(const candidate of candidates){
    try{bytes=await readFile(candidate);break;}catch(error){if(error?.code!=="ENOENT")throw error;}
  }
  if(!bytes)throw new Error(`TIMELINE_ACCEPTED_ASSET_MISSING:${path}`);
  const authority=acceptedFiles.get(`web/${path}`);
  if(!authority||(Number.isFinite(authority.bytes)&&authority.bytes!==bytes.byteLength)||authority.sha256!==sha256(bytes))throw new Error(`TIMELINE_ACCEPTED_ASSET_AUTHORITY_MISMATCH:${path}`);
  const target=join(dist,path);await mkdir(dirname(target),{recursive:true});await writeFile(target,bytes);
}

const acceptedRuntimeAssets=[
  "vendor/pdfjs/pdf.worker.min.mjs",
  "data/medical-schools/us-dapip-2026-07-30.json",
  ...["axis_left_end_cap_exact_crop_402a.png","axis_chevron_body_segment_exact_crop_402a.png","axis_right_end_cap_exact_crop_402a.png"].map((name)=>`assets/keynote_classic_402a/axis/${name}`),
  ...["work","usmle","teaching_hospital","personal","research","clinics"].flatMap((slug)=>["left_cap","body_segment","right_head"].map((part)=>`assets/keynote_classic_402a/arrows/${slug}_arrow_${part}_402a.png`)),
  ...["milestone_flag_marker_rebuild_gray_402a.png","milestone_flag_marker_rebuild_personal_402a.png","usa_flag_marker_scaled_34x28_402a.png"].map((name)=>`assets/keynote_classic_402a/flags/${name}`),
  ...["title_plaque_exact_layer_402a.png","color_key_panel_exact_layer_402a.png","profile_card_exact_layer_402a.png","sticky_note_red_arrow_exact_layer_402a.png","pushpin_exact_keynote_asset_402a.png"].map((name)=>`assets/keynote_classic_402a/chrome/${name}`),
  ...["board_denim.jpg","leather_pebble.png","paper_bond.png","paper_hotpress.png","paper_rc.png","print_grain.png","satin.png","sticky_pulp.jpg"].map((name)=>`presentation/d1-409h-a1/assets/tex/${name}`),
  "presentation/d1-409h-a1/assets/photos/us_flag.png"
];
for(const asset of acceptedRuntimeAssets)await acceptedAsset(asset);

async function filesBelow(directory){
  const out=[];for(const entry of (await readdir(directory,{withFileTypes:true})).sort((a,b)=>a.name.localeCompare(b.name))){
    const full=join(directory,entry.name);if(entry.isDirectory())out.push(...await filesBelow(full));else if(entry.isFile())out.push(full);else throw new Error("UNSUPPORTED_RELEASE_ENTRY");
  }return out;
}
const types=new Map([[".html","text/html; charset=utf-8"],[".css","text/css; charset=utf-8"],[".js","text/javascript; charset=utf-8"],[".mjs","text/javascript; charset=utf-8"],[".json","application/json"],[".sha256","text/plain; charset=utf-8"],[".woff2","font/woff2"],[".png","image/png"],[".jpg","image/jpeg"],[".jpeg","image/jpeg"],[".webp","image/webp"],[".svg","image/svg+xml"]]);
const files={};
for(const file of await filesBelow(dist)){
  if(file.endsWith("release-manifest.json"))continue;
  const path=relative(dist,file).split("\\").join("/");const bytes=await readFile(file);const details=await stat(file);const contentType=types.get(extname(file).toLowerCase());
  if(!contentType)throw new Error(`RELEASE_MIME_UNAPPROVED:${path}`);
  files[path]={sha256:createHash("sha256").update(bytes).digest("hex"),bytes:details.size,content_type:contentType};
}
const descriptor=JSON.stringify(files);const releaseId=`timeline-${createHash("sha256").update(descriptor).digest("hex").slice(0,16)}`;
const manifest={schema_version:"d1-500-release-manifest.1",release_id:releaseId,source_commit:head,accepted_base_commit:acceptedBase,asset_authority_manifest_sha256:externalManifestBytes?sha256(externalManifestBytes):null,mode,canonical_path:"/timeline/",protected_kernel:"D1-409H-A1",files};
await writeFile(join(dist,"release-manifest.json"),`${JSON.stringify(manifest,null,2)}\n`);
console.log(JSON.stringify({ok:true,release_id:releaseId,source_commit:head,files:Object.keys(files).length,mode}));
