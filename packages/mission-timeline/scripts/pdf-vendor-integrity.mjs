import {createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {join} from 'node:path';

export const PDF_VENDOR_MANIFEST='vendor/pdfjs/manifest.json';
export const PDF_VENDOR_VERSION='6.3.289';
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const expectedFiles=[
  ['main','web/vendor/pdfjs/pdf.min.mjs',null],
  ['worker','web/vendor/pdfjs/pdf.worker.min.mjs','vendor/pdfjs/pdf.worker.min.mjs'],
  ['license','web/vendor/pdfjs/LICENSE','vendor/pdfjs/LICENSE.txt'],
];
export function assertPdfVendorManifest(manifest){
  if(manifest?.schema!=='d1-timeline-pdf-vendor/1'||manifest.name!=='pdfjs-dist'||manifest.version!==PDF_VENDOR_VERSION||manifest.license!=='Apache-2.0'||manifest.delivery!=='main_bundled_worker_same_origin')throw new Error('PDF_VENDOR_MANIFEST_INVALID');
  if(manifest.source?.tarball!==`https://registry.npmjs.org/pdfjs-dist/-/pdfjs-dist-${PDF_VENDOR_VERSION}.tgz`||!/^sha512-[A-Za-z0-9+/]+=*$/.test(manifest.source.integrity||'')||!/^[a-f0-9]{64}$/.test(manifest.source.sha256||''))throw new Error('PDF_VENDOR_SOURCE_INVALID');
  if(manifest.files?.length!==expectedFiles.length)throw new Error('PDF_VENDOR_FILE_SET_INVALID');
  for(const [role,path,releasePath] of expectedFiles){
    const item=manifest.files.find(file=>file.role===role);
    if(item?.path!==path||item.releasePath!==releasePath||!/^[a-f0-9]{64}$/.test(item.sha256)||!Number.isSafeInteger(item.bytes)||item.bytes<=0)throw new Error(`PDF_VENDOR_FILE_INVALID:${role}`);
  }
}
export async function readVerifiedPdfVendor(root){
  const bytes=await readFile(join(root,'release/d1-022-pdf-vendor.json'));
  const manifest=JSON.parse(bytes.toString('utf8'));assertPdfVendorManifest(manifest);
  const pkg=JSON.parse(await readFile(join(root,'package.json'),'utf8'));
  const lock=JSON.parse(await readFile(join(root,'package-lock.json'),'utf8'));
  const dependency=lock.packages?.['node_modules/pdfjs-dist'];
  if(pkg.dependencies?.['pdfjs-dist']!==manifest.version||lock.packages?.['']?.dependencies?.['pdfjs-dist']!==manifest.version||dependency?.version!==manifest.version||dependency.integrity!==manifest.source.integrity||dependency.resolved!==manifest.source.tarball)throw new Error('PDF_VENDOR_DEPENDENCY_MISMATCH');
  for(const item of manifest.files){
    const content=await readFile(join(root,item.path));
    if(content.length!==item.bytes||hash(content)!==item.sha256)throw new Error(`PDF_VENDOR_INTEGRITY_MISMATCH:${item.path}`);
    if(item.role!=='license'&&!content.toString('utf8').includes(`pdfjsVersion = ${manifest.version}`))throw new Error(`PDF_VENDOR_VERSION_MISMATCH:${item.path}`);
  }
  return{manifest,bytes,sha256:hash(bytes)};
}
