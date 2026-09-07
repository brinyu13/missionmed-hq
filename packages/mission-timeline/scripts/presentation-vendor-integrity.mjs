import {createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {join} from 'node:path';

export const PRESENTATION_VENDOR_MANIFEST='vendor/presentation/manifest.json';
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
export function assertPresentationVendorManifest(manifest){
  if(manifest?.schema!=='d1-timeline-presentation-vendor/1'||manifest.delivery!=='bundled_into_application_esm'||manifest.runtime?.path!=='web/vendor/presentation/pptx-runtime.js')throw new Error('PRESENTATION_VENDOR_MANIFEST_INVALID');
  const expected=[['pptxgenjs','4.0.1','PPTXGENJS-LICENSE'],['jszip','3.10.1','JSZIP-LICENSE']];
  if(manifest.components?.length!==expected.length)throw new Error('PRESENTATION_VENDOR_COMPONENTS_INVALID');
  for(const [name,version,file] of expected){
    const component=manifest.components.find(item=>item.name===name);
    if(component?.version!==version||component.license!=='MIT'||component.notice?.path!==`web/vendor/presentation/${file}`||component.releaseNotice!==`vendor/presentation/${file}.txt`)throw new Error(`PRESENTATION_VENDOR_COMPONENT_INVALID:${name}`);
  }
  if(manifest.transitiveNotice?.path!=='web/vendor/presentation/THIRD-PARTY-NOTICES'||manifest.transitiveNotice.releasePath!=='vendor/presentation/THIRD-PARTY-NOTICES.txt')throw new Error('PRESENTATION_TRANSITIVE_LICENSE_INVALID');
  for(const item of [manifest.runtime,manifest.transitiveNotice,...manifest.components.map(item=>item.notice)])if(!/^[a-f0-9]{64}$/.test(item.sha256)||!Number.isSafeInteger(item.bytes)||item.bytes<=0)throw new Error('PRESENTATION_VENDOR_CHECKSUM_INVALID');
}
export async function readVerifiedPresentationVendor(root){
  const bytes=await readFile(join(root,'release/d1-021-presentation-vendor.json'));
  const manifest=JSON.parse(bytes.toString('utf8'));assertPresentationVendorManifest(manifest);
  for(const item of [manifest.runtime,manifest.transitiveNotice,...manifest.components.map(item=>item.notice)]){
    const content=await readFile(join(root,item.path));
    if(content.length!==item.bytes||hash(content)!==item.sha256)throw new Error(`PRESENTATION_VENDOR_INTEGRITY_MISMATCH:${item.path}`);
  }
  return{manifest,bytes,sha256:hash(bytes)};
}
