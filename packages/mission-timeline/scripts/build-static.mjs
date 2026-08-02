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
if(mode==="release"){
  const expected=String(process.env.TIMELINE_EXPECTED_COMMIT||"").trim();
  if(!/^[a-f0-9]{40}$/.test(expected)||expected!==head)throw new Error("TIMELINE_EXPECTED_COMMIT_MISMATCH");
  execFileSync("git",["diff","--quiet","--","packages/mission-timeline","wp-content/plugins/missionmed-timeline-sso"],{cwd:resolve(root,"../..")});
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

async function filesBelow(directory){
  const out=[];for(const entry of (await readdir(directory,{withFileTypes:true})).sort((a,b)=>a.name.localeCompare(b.name))){
    const full=join(directory,entry.name);if(entry.isDirectory())out.push(...await filesBelow(full));else if(entry.isFile())out.push(full);else throw new Error("UNSUPPORTED_RELEASE_ENTRY");
  }return out;
}
const types=new Map([[".html","text/html; charset=utf-8"],[".css","text/css; charset=utf-8"],[".js","text/javascript; charset=utf-8"],[".json","application/json"],[".sha256","text/plain; charset=utf-8"],[".woff2","font/woff2"],[".png","image/png"],[".jpg","image/jpeg"],[".jpeg","image/jpeg"],[".webp","image/webp"]]);
const files={};
for(const file of await filesBelow(dist)){
  if(file.endsWith("release-manifest.json"))continue;
  const path=relative(dist,file).split("\\").join("/");const bytes=await readFile(file);const details=await stat(file);const contentType=types.get(extname(file).toLowerCase());
  if(!contentType)throw new Error(`RELEASE_MIME_UNAPPROVED:${path}`);
  files[path]={sha256:createHash("sha256").update(bytes).digest("hex"),bytes:details.size,content_type:contentType};
}
const descriptor=JSON.stringify(files);const releaseId=`timeline-${createHash("sha256").update(descriptor).digest("hex").slice(0,16)}`;
const manifest={schema_version:"d1-411c-release-manifest.1",release_id:releaseId,source_commit:head,mode,canonical_path:"/timeline/",protected_kernel:"D1-409H-A1",files};
await writeFile(join(dist,"release-manifest.json"),`${JSON.stringify(manifest,null,2)}\n`);
console.log(JSON.stringify({ok:true,release_id:releaseId,source_commit:head,files:Object.keys(files).length,mode}));
