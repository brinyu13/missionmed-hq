import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, posix, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root=resolve(dirname(fileURLToPath(import.meta.url)),"..");
const dist=join(root,"dist");
const output=join(root,"dist-wordpress","release.php");
const manifest=JSON.parse(await readFile(join(dist,"release-manifest.json"),"utf8"));
if(manifest.schema_version!=="d1-500-release-manifest.1"||manifest.canonical_path!=="/timeline/")throw new Error("TIMELINE_RELEASE_MANIFEST_INVALID");

const hash=(bytes)=>createHash("sha256").update(bytes).digest("hex");
const phpString=(value)=>`'${String(value).replace(/\\/g,"\\\\").replace(/'/g,"\\'")}'`;
const raw=new Map();
for(const [path,entry] of Object.entries(manifest.files)){
  const bytes=await readFile(join(dist,path));
  if(bytes.byteLength!==entry.bytes||hash(bytes)!==entry.sha256)throw new Error(`TIMELINE_RELEASE_HASH_MISMATCH:${path}`);
  raw.set(path,{path,bytes,contentType:entry.content_type});
}

const assets=new Map();
const byPath=new Map();
const addAsset=(path,bytes,contentType)=>{
  const sha256=hash(bytes);const alias=sha256.slice(0,12);
  const prior=assets.get(alias);
  if(prior&&prior.sha256!==sha256)throw new Error(`TIMELINE_RUNTIME_ALIAS_COLLISION:${alias}`);
  const entry={path,alias,sha256,bytes,contentType};assets.set(alias,entry);byPath.set(path,entry);return entry;
};

for(const entry of raw.values()){
  if(entry.path==="index.html"||/\.(?:css|js|html)$/.test(entry.path))continue;
  addAsset(entry.path,entry.bytes,entry.contentType);
}

for(const entry of raw.values()){
  if(!entry.path.endsWith(".css"))continue;
  const rewritten=entry.bytes.toString("utf8").replace(/url\(\s*(["']?)([^"')]+)\1\s*\)/g,(match,_quote,value)=>{
    if(/^(?:data:|https?:|#|\/)/i.test(value))return match;
    const clean=value.split(/[?#]/,1)[0];
    const target=posix.normalize(posix.join(posix.dirname(entry.path),clean));
    const source=raw.get(target);
    if(!source)throw new Error(`TIMELINE_RUNTIME_CSS_SOURCE_MISSING:${entry.path}:${target}`);
    const asset=[...assets.values()].find((candidate)=>candidate.path===target);
    if(!asset)throw new Error(`TIMELINE_RUNTIME_CSS_ASSET_MISSING:${entry.path}:${target}`);
    return `url("/timeline/_asset/${asset.alias}")`;
  });
  addAsset(entry.path,Buffer.from(rewritten,"utf8"),entry.contentType);
}

for(const entry of raw.values()){
  if(!entry.path.endsWith(".js"))continue;
  let rewritten=entry.bytes.toString("utf8").replace(/(["'])(assets\/[A-Za-z0-9._\/-]+)\1/g,(match,quote,value)=>{
    const target=posix.normalize(posix.join(posix.dirname(entry.path),value));
    const asset=byPath.get(target);
    return asset?`${quote}/timeline/_asset/${asset.alias}${quote}`:match;
  });
  for(const value of ["D1-409H_VISUAL_MASTER.css"]){
    const singleQuoted=`'${value}'`;const doubleQuoted=`"${value}"`;
    if(!rewritten.includes(singleQuoted)&&!rewritten.includes(doubleQuoted))continue;
    const target=posix.normalize(posix.join(posix.dirname(entry.path),value));
    const asset=byPath.get(target);
    if(!asset)throw new Error(`TIMELINE_RUNTIME_JS_ASSET_MISSING:${entry.path}:${target}`);
    rewritten=rewritten
      .split(singleQuoted).join(`'/timeline/_asset/${asset.alias}'`)
      .split(doubleQuoted).join(`"/timeline/_asset/${asset.alias}"`);
  }
  addAsset(entry.path,Buffer.from(rewritten,"utf8"),entry.contentType);
}

for(const entry of raw.values()){
  if(entry.path==="index.html"||!entry.path.endsWith(".html"))continue;
  const rewritten=entry.bytes.toString("utf8").replace(/(src|href)=(['"])([^'"#]+)\2/g,(match,attribute,quote,value)=>{
    if(/^(?:data:|https?:|\/)/i.test(value))return match;
    const clean=value.split(/[?#]/,1)[0];
    const target=posix.normalize(posix.join(posix.dirname(entry.path),clean));
    const asset=byPath.get(target);
    if(!asset)throw new Error(`TIMELINE_RUNTIME_HTML_ASSET_MISSING:${entry.path}:${target}`);
    return `${attribute}=${quote}/timeline/_asset/${asset.alias}${quote}`;
  });
  addAsset(entry.path,Buffer.from(rewritten,"utf8"),entry.contentType);
}

const indexSource=raw.get("index.html");
if(!indexSource)throw new Error("TIMELINE_RUNTIME_INDEX_MISSING");
let indexText=indexSource.bytes.toString("utf8").replace(/(src|href)=(['"])(\.\/[^'"]+)\2/g,(match,attribute,quote,value)=>{
  const path=posix.normalize(value.slice(2));
  const asset=byPath.get(path);
  if(!asset)throw new Error(`TIMELINE_RUNTIME_INDEX_ASSET_MISSING:${path}`);
  return `${attribute}=${quote}./_asset/${asset.alias}${quote}`;
});
if(/(?:src|href)=(['"])\.\/(?:assets|styles)\//.test(indexText))throw new Error("TIMELINE_RUNTIME_EXTENSION_PATH_REMAINS");
const runtimeKeys=[
  "vendor/pdfjs/pdf.worker.min.mjs",
  "data/medical-schools/us-dapip-2026-07-30.json",
  "presentation/d1-409h-a1/D1-409H_FINAL_VISUAL_MASTER.html",
  ...[...byPath.keys()].filter((path)=>path.startsWith("assets/keynote_classic_402a/"))
];
const runtimeMap=Object.fromEntries([...new Set(runtimeKeys)].sort().map((path)=>{
  const asset=byPath.get(path);if(!asset)throw new Error(`TIMELINE_RUNTIME_MAP_ASSET_MISSING:${path}`);
  return[path,`/timeline/_asset/${asset.alias}`];
}));
const runtimeConfig=`<script>window.D1_TIMELINE_ASSET_URLS=Object.freeze(${JSON.stringify(runtimeMap).replace(/</g,"\\u003c")});</script>`;
const moduleAnchor='<script type="module"';
if(!indexText.includes(moduleAnchor))throw new Error("TIMELINE_RUNTIME_MODULE_ANCHOR_MISSING");
indexText=indexText.replace(moduleAnchor,`${runtimeConfig}\n${moduleAnchor}`);
const indexBytes=Buffer.from(indexText,"utf8");
const index={sha256:hash(indexBytes),bytes:indexBytes.byteLength,contentType:"text/html; charset=utf-8",data:indexBytes.toString("base64")};

const assetList=[...assets.values()].sort((a,b)=>a.alias.localeCompare(b.alias));
const descriptor=JSON.stringify({sourceReleaseId:manifest.release_id,sourceCommit:manifest.source_commit,index:{sha256:index.sha256,bytes:index.bytes},assets:assetList.map(({alias,sha256,bytes,contentType})=>({alias,sha256,bytes:bytes.byteLength,contentType}))});
const releaseId=`timeline-wp-${hash(Buffer.from(descriptor)).slice(0,16)}`;
const lines=["<?php","if (!defined('ABSPATH')) { exit; }","return array(",`  'schema_version' => 'd1-500-wordpress-runtime.1',`,`  'release_id' => ${phpString(releaseId)},`,`  'source_release_id' => ${phpString(manifest.release_id)},`,`  'source_commit' => ${phpString(manifest.source_commit)},`,`  'index' => array('sha256' => ${phpString(index.sha256)}, 'bytes' => ${index.bytes}, 'content_type' => ${phpString(index.contentType)}, 'encoding' => 'base64', 'data' => ${phpString(index.data)}),`,`  'assets' => array(`];
for(const entry of assetList){
  lines.push(`    ${phpString(entry.alias)} => array('path' => ${phpString(entry.path)}, 'sha256' => ${phpString(entry.sha256)}, 'bytes' => ${entry.bytes.byteLength}, 'content_type' => ${phpString(entry.contentType)}, 'encoding' => 'base64', 'data' => ${phpString(entry.bytes.toString("base64"))}),`);
}
lines.push("  ),", ");", "");
await mkdir(dirname(output),{recursive:true});
await writeFile(output,lines.join("\n"));
console.log(JSON.stringify({ok:true,release_id:releaseId,source_release_id:manifest.release_id,assets:assetList.length,index_sha256:index.sha256,output}));
