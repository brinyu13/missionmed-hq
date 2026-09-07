import assert from 'node:assert/strict';
import test from 'node:test';
import {build} from 'esbuild';
import {fileURLToPath} from 'node:url';
import {readFile} from 'node:fs/promises';
import {readVerifiedPresentationVendor} from '../scripts/presentation-vendor-integrity.mjs';
import {packagedBrowserEntry} from '../scripts/browser-entry-021.mjs';

const root=fileURLToPath(new URL('..',import.meta.url));
test('offline editable writer is included in the real browser application bundle with verified licenses',async()=>{
  const vendor=await readVerifiedPresentationVendor(root);
  assert.deepEqual(vendor.manifest.components.map(c=>[c.name,c.version,c.license]),[['pptxgenjs','4.0.1','MIT'],['jszip','3.10.1','MIT']]);
  const sourceIndex=await readFile(new URL('../web/index.html',import.meta.url),'utf8');
  const entry=packagedBrowserEntry(sourceIndex);
  const result=await build({stdin:{contents:entry.contents,resolveDir:root,loader:'js'},bundle:true,write:false,format:'esm',platform:'browser',target:'es2022',metafile:true,logOverride:{'commonjs-variable-in-esm':'silent'}});
  const output=Object.values(result.metafile.outputs)[0];
  for(const file of ['web/js/family-022.js','web/js/prototype-021.js','web/js/local-synthetic-intelligence-021.js','web/js/persistence/indexeddb-adapter.js','web/js/presentation/editable-pptx.js','web/js/presentation/resolved-founder-presentation.js','web/vendor/presentation/pptx-runtime.js']){
    const included=Object.entries(output.inputs).find(([key])=>key.endsWith(file));
    assert.ok(included?.[1].bytesInOutput>0,`Missing browser runtime: ${file}`);
  }
  assert.deepEqual(output.imports,[],'exporter and vendor require no external JS fetch in the packaged application');
  assert.ok(entry.contents.indexOf('window.D1_PERSISTENCE_ADAPTER')<entry.contents.indexOf('await import("./web/js/407f-engineering-adapter.js")'),'local draft bootstrap executes before application initialization');
  assert.match(entry.contents,/reviewSuffix/);
  assert.ok(!sourceIndex.replace(entry.bootstrapElement,'').includes("from './js/persistence/indexeddb-adapter.js'"));
});
