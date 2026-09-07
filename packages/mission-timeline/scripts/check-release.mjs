import { createHash } from "node:crypto";
import { readFile, readdir, stat } from "node:fs/promises";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {assertPdfVendorManifest,PDF_VENDOR_MANIFEST} from './pdf-vendor-integrity.mjs';
import {assertPresentationVendorManifest,PRESENTATION_VENDOR_MANIFEST} from "./presentation-vendor-integrity.mjs";

const root=resolve(dirname(fileURLToPath(import.meta.url)),"..");const dist=join(root,"dist");
const manifest=JSON.parse(await readFile(join(dist,"release-manifest.json"),"utf8"));
if(manifest.schema_version!=="d1-500-release-manifest.1"||manifest.canonical_path!=="/timeline/"||manifest.protected_kernel!=="D1-409H-A1"||manifest.accepted_base_commit!=="49ba56dacd2cddfc2fb2241839d54a03e85bc271")throw new Error("RELEASE_MANIFEST_INVALID");
if(manifest.mode==="release"&&!/^[a-f0-9]{64}$/.test(String(manifest.asset_authority_manifest_sha256||"")))throw new Error("RELEASE_ASSET_AUTHORITY_MISSING");
async function filesBelow(directory){const out=[];for(const entry of await readdir(directory,{withFileTypes:true})){const full=join(directory,entry.name);if(entry.isDirectory())out.push(...await filesBelow(full));else if(entry.isFile())out.push(full);}return out;}
const actual=(await filesBelow(dist)).map((file)=>relative(dist,file).split("\\").join("/")).filter((file)=>file!=="release-manifest.json").sort();
const expected=Object.keys(manifest.files).sort();if(JSON.stringify(actual)!==JSON.stringify(expected))throw new Error("RELEASE_FILE_SET_MISMATCH");
for(const path of expected){const file=join(dist,path);const bytes=await readFile(file);const details=await stat(file);const entry=manifest.files[path];if(details.size!==entry.bytes||createHash("sha256").update(bytes).digest("hex")!==entry.sha256)throw new Error(`RELEASE_HASH_MISMATCH:${path}`);}
for(const forbidden of ["js/uxr-002/locked-407f-artifact.js","js/uxr-002/board-renderer.js","js/uxr-002/app.js","styles/legacy-406a.css"]){if(expected.includes(forbidden))throw new Error(`LEGACY_RELEASE_PATH_PRESENT:${forbidden}`);}
for(const privateFixture of ["karaoke.jpg","newborn.jpg","nicu.jpg","profile_sample.jpg","ski.jpg","wedding.jpg"]){if(expected.some((path)=>path.endsWith(`/assets/photos/${privateFixture}`)))throw new Error(`PRIVATE_FIXTURE_PRESENT:${privateFixture}`);}
/* Runtime-critical assets. The protected kernel probes three of these textures before it
   will render at all and throws ASSET_LOAD_FAILED if any is missing - a failure the host
   cannot recover from on a first load - so a release that omits one blanks every student's
   timeline. They live only in the accepted-asset root, never in web/, which is exactly why
   their absence is easy to ship unnoticed. Fail the release instead. */
const REQUIRED_RUNTIME_ASSETS=[
  "styles/prototype-021.css","styles/family-022.css","styles/admin-workspace-022.css","styles/ai-settings-022.css",
  ...["board_denim.jpg","leather_pebble.png","paper_bond.png","paper_hotpress.png","paper_rc.png","print_grain.png","satin.png","sticky_pulp.jpg"].map((name)=>`presentation/d1-409h-a1/assets/tex/${name}`),
  "presentation/d1-409h-a1/assets/photos/us_flag.png",
  ...["ptserif-400","ptserif-700","ptserif-700i","archivo-600","archivo-800","quicksand-500","quicksand-700","cutive-400","caveat-700"].map((name)=>`presentation/d1-409h-a1/assets/fonts/${name}.woff2`),
  ...["axis_left_end_cap_exact_crop_402a.png","axis_chevron_body_segment_exact_crop_402a.png","axis_right_end_cap_exact_crop_402a.png"].map((name)=>`assets/keynote_classic_402a/axis/${name}`),
  ...["title_plaque_exact_layer_402a.png","color_key_panel_exact_layer_402a.png","profile_card_exact_layer_402a.png"].map((name)=>`assets/keynote_classic_402a/chrome/${name}`)
];
const missingRuntimeAssets=REQUIRED_RUNTIME_ASSETS.filter((path)=>!manifest.files[path]||!(manifest.files[path].bytes>0));
if(missingRuntimeAssets.length)throw new Error(`RELEASE_RUNTIME_ASSET_MISSING:${missingRuntimeAssets.join(",")}`);
const pdfRuntime=manifest.pdf_runtime;
if(pdfRuntime?.manifest!==PDF_VENDOR_MANIFEST||manifest.files[PDF_VENDOR_MANIFEST]?.sha256!==pdfRuntime.sha256||!manifest.files[pdfRuntime.bundled_application])throw new Error('RELEASE_PDF_RUNTIME_MISSING');
const pdfVendor=JSON.parse(await readFile(join(dist,PDF_VENDOR_MANIFEST),'utf8'));
assertPdfVendorManifest(pdfVendor);
if(pdfRuntime.version!==pdfVendor.version||pdfRuntime.main_source_sha256!==pdfVendor.files.find(item=>item.role==='main').sha256)throw new Error('RELEASE_PDF_RUNTIME_IDENTITY_MISMATCH');
for(const item of pdfVendor.files){
  if(!item.releasePath)continue;
  const actualFile=manifest.files[item.releasePath];
  if(actualFile?.sha256!==item.sha256||actualFile.bytes!==item.bytes)throw new Error(`RELEASE_PDF_FILE_MISMATCH:${item.role}`);
}
const presentationRuntime=manifest.presentation_runtime;
if(presentationRuntime?.manifest!==PRESENTATION_VENDOR_MANIFEST||manifest.files[PRESENTATION_VENDOR_MANIFEST]?.sha256!==presentationRuntime.sha256||!manifest.files[presentationRuntime.bundled_application])throw new Error('RELEASE_PRESENTATION_RUNTIME_MISSING');
const presentationVendor=JSON.parse(await readFile(join(dist,PRESENTATION_VENDOR_MANIFEST),'utf8'));
assertPresentationVendorManifest(presentationVendor);
if(presentationRuntime.runtime_source_sha256!==presentationVendor.runtime.sha256)throw new Error('RELEASE_PRESENTATION_RUNTIME_IDENTITY_MISMATCH');
for(const component of presentationVendor.components){
  const notice=manifest.files[component.releaseNotice];
  if(notice?.sha256!==component.notice.sha256||notice.bytes!==component.notice.bytes)throw new Error(`RELEASE_PRESENTATION_LICENSE_MISSING:${component.name}`);
}
const transitiveNotice=manifest.files[presentationVendor.transitiveNotice.releasePath];
if(transitiveNotice?.sha256!==presentationVendor.transitiveNotice.sha256||transitiveNotice.bytes!==presentationVendor.transitiveNotice.bytes)throw new Error('RELEASE_PRESENTATION_TRANSITIVE_LICENSE_MISSING');
const CORE_PROTECTED_TEXTURES=["board_denim.jpg","paper_bond.png","leather_pebble.png"].map((name)=>`presentation/d1-409h-a1/assets/tex/${name}`);
const missingCoreTextures=CORE_PROTECTED_TEXTURES.filter((path)=>!manifest.files[path]);
if(missingCoreTextures.length)throw new Error(`RELEASE_CORE_TEXTURE_MISSING:${missingCoreTextures.join(",")}`);
const index=await readFile(join(dist,"index.html"),"utf8");if(!index.includes('<base href="/timeline/">')||!index.includes('D1_TIMELINE_RUNTIME_MODE="production"'))throw new Error("CANONICAL_PRODUCTION_BOOT_MISSING");
if(/(?:\bfrom\s*|\bimport\s*)['"]\.\/?js\//.test(index))throw new Error('RELEASE_UNBUNDLED_INLINE_MODULE_IMPORT');
if(/<script\b[^>]*\bsrc=['"]\.\/js\//.test(index))throw new Error('RELEASE_UNBUNDLED_SCRIPT_ENTRY');
for(const style of ["prototype-021","family-022","admin-workspace-022","ai-settings-022"]){
  if(!index.includes(`<link rel="stylesheet" href="./styles/${style}.css" data-${style}>`))throw new Error(`RELEASE_PRELINKED_STYLE_MISSING:${style}`);
}
if(!index.includes('timelineLegacyStateScrubbed="true"'))throw new Error("PRODUCTION_LEGACY_STATE_SCRUB_MISSING");
console.log(JSON.stringify({ok:true,release_id:manifest.release_id,files:expected.length,hashes_verified:expected.length,runtime_assets_verified:REQUIRED_RUNTIME_ASSETS.length}));
