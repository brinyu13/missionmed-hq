import assert from 'node:assert/strict';
import test from 'node:test';
import {mkdtemp,readFile,writeFile,mkdir,cp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {assertPdfVendorManifest,readVerifiedPdfVendor} from '../scripts/pdf-vendor-integrity.mjs';
const root=fileURLToPath(new URL('..',import.meta.url));
async function fixture(t){
  const dir=await mkdtemp(join(tmpdir(),'d1-022-pdf-vendor-'));
  t.after(()=>rm(dir,{recursive:true,force:true}));
  await mkdir(join(dir,'release'),{recursive:true});
  await mkdir(join(dir,'web/vendor'),{recursive:true});
  for(const path of ['package.json','package-lock.json','release/d1-022-pdf-vendor.json'])await cp(join(root,path),join(dir,path));
  await cp(join(root,'web/vendor/pdfjs'),join(dir,'web/vendor/pdfjs'),{recursive:true});
  return dir;
}
test('PDF parser, worker, license and installed dependency share the patched identity',async()=>{
  const verified=await readVerifiedPdfVendor(root);
  assert.equal(verified.manifest.version,'6.3.289');
});
test('a vulnerable PDF vendor manifest cannot pass release validation',async()=>{
  const manifest=JSON.parse(await readFile(join(root,'release/d1-022-pdf-vendor.json'),'utf8'));
  manifest.version='5.6.205';
  assert.throws(()=>assertPdfVendorManifest(manifest),/PDF_VENDOR_MANIFEST_INVALID/);
});
test('a stale or substituted PDF worker fails before bundling',async t=>{
  const dir=await fixture(t);
  await writeFile(join(dir,'web/vendor/pdfjs/pdf.worker.min.mjs'),'stale worker');
  await assert.rejects(readVerifiedPdfVendor(dir),/PDF_VENDOR_INTEGRITY_MISMATCH/);
});
test('an npm-only update cannot silently leave a different browser parser',async t=>{
  const dir=await fixture(t),path=join(dir,'package-lock.json');
  const lock=JSON.parse(await readFile(path,'utf8'));
  lock.packages['node_modules/pdfjs-dist'].version='5.6.205';
  await writeFile(path,JSON.stringify(lock));
  await assert.rejects(readVerifiedPdfVendor(dir),/PDF_VENDOR_DEPENDENCY_MISMATCH/);
});
test('PDF license custody is required in the release source',async t=>{
  const dir=await fixture(t);
  await writeFile(join(dir,'web/vendor/pdfjs/LICENSE'),'');
  await assert.rejects(readVerifiedPdfVendor(dir),/PDF_VENDOR_INTEGRITY_MISMATCH/);
});
