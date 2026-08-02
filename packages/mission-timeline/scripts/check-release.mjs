import { createHash } from "node:crypto";
import { readFile, readdir, stat } from "node:fs/promises";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root=resolve(dirname(fileURLToPath(import.meta.url)),"..");const dist=join(root,"dist");
const manifest=JSON.parse(await readFile(join(dist,"release-manifest.json"),"utf8"));
if(manifest.schema_version!=="d1-411c-release-manifest.1"||manifest.canonical_path!=="/timeline/"||manifest.protected_kernel!=="D1-409H-A1")throw new Error("RELEASE_MANIFEST_INVALID");
async function filesBelow(directory){const out=[];for(const entry of await readdir(directory,{withFileTypes:true})){const full=join(directory,entry.name);if(entry.isDirectory())out.push(...await filesBelow(full));else if(entry.isFile())out.push(full);}return out;}
const actual=(await filesBelow(dist)).map((file)=>relative(dist,file).split("\\").join("/")).filter((file)=>file!=="release-manifest.json").sort();
const expected=Object.keys(manifest.files).sort();if(JSON.stringify(actual)!==JSON.stringify(expected))throw new Error("RELEASE_FILE_SET_MISMATCH");
for(const path of expected){const file=join(dist,path);const bytes=await readFile(file);const details=await stat(file);const entry=manifest.files[path];if(details.size!==entry.bytes||createHash("sha256").update(bytes).digest("hex")!==entry.sha256)throw new Error(`RELEASE_HASH_MISMATCH:${path}`);}
for(const forbidden of ["js/uxr-002/locked-407f-artifact.js","js/uxr-002/board-renderer.js","js/uxr-002/app.js","styles/legacy-406a.css"]){if(expected.includes(forbidden))throw new Error(`LEGACY_RELEASE_PATH_PRESENT:${forbidden}`);}
const index=await readFile(join(dist,"index.html"),"utf8");if(!index.includes('<base href="/timeline/">')||!index.includes('D1_TIMELINE_RUNTIME_MODE="production"'))throw new Error("CANONICAL_PRODUCTION_BOOT_MISSING");
if(!index.includes('timelineLegacyStateScrubbed="true"'))throw new Error("PRODUCTION_LEGACY_STATE_SCRUB_MISSING");
console.log(JSON.stringify({ok:true,release_id:manifest.release_id,files:expected.length,hashes_verified:expected.length}));
