// Rebuild the checked-in, offline browser runtime from exact upstream versions.
import {readFile,writeFile,copyFile,readdir} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {build} from 'esbuild';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const modules=resolve(process.argv[2]||resolve(root,'node_modules'));
for(const [name,version] of [['pptxgenjs','4.0.1'],['jszip','3.10.1']]){
  const actual=JSON.parse(await readFile(resolve(modules,name,'package.json'),'utf8')).version;
  if(actual!==version)throw new Error(`PRESENTATION_VENDOR_VERSION:${name}:${actual}`);
}
await build({
  stdin:{contents:`export {default as PptxGenJS} from ${JSON.stringify(resolve(modules,'pptxgenjs/dist/pptxgen.es.js'))}; export {default as JSZip} from ${JSON.stringify(resolve(modules,'jszip/dist/jszip.js'))};`,resolveDir:root,loader:'js'},
  outfile:resolve(root,'web/vendor/presentation/pptx-runtime.js'),
  bundle:true,platform:'browser',format:'esm',target:'es2022',minify:true,
  legalComments:'eof',
  plugins:[{name:'no-node-io-in-browser',setup(builder){
    builder.onResolve({filter:/^jszip$/},()=>({path:resolve(modules,'jszip/dist/jszip.js')}));
    builder.onResolve({filter:/^node:(fs|https)$/},args=>({path:args.path,namespace:'no-node-io'}));
    builder.onLoad({filter:/.*/,namespace:'no-node-io'},()=>({contents:'const unavailable=()=>{throw new Error("Browser presentation export has no filesystem or external network access")}; export const promises={writeFile:unavailable}; export default {readFile:unavailable,get:unavailable,promises};',loader:'js'}));
  }}]
});
await copyFile(resolve(modules,'pptxgenjs/LICENSE'),resolve(root,'web/vendor/presentation/PPTXGENJS-LICENSE'));
await copyFile(resolve(modules,'jszip/LICENSE.markdown'),resolve(root,'web/vendor/presentation/JSZIP-LICENSE'));
// JSZip's distributed browser file contains third-party stream/compression code.
// Preserve its dependency notices too; the brief header in dist/jszip.js is not
// a substitute for the upstream permission/copyright text.
const transitiveNotices=[],visited=new Set();
async function collectNotices(packageFile){
  if(visited.has(packageFile))return;visited.add(packageFile);
  const directory=dirname(packageFile),pkg=JSON.parse(await readFile(packageFile,'utf8'));
  const files=await readdir(directory),license=files.find(file=>/^(?:LICENSE|LICENCE|COPYING)(?:\.[a-z]+)?$/i.test(file));
  let licenseText=license?await readFile(resolve(directory,license),'utf8'):null;
  if(!licenseText){const readme=files.find(file=>/^readme\.md$/i.test(file));if(readme)licenseText=(await readFile(resolve(directory,readme),'utf8')).match(/## License\s+([\s\S]+)/i)?.[1];}
  if(!licenseText)throw new Error(`PRESENTATION_TRANSITIVE_LICENSE_MISSING:${pkg.name}`);
  transitiveNotices.push(`${pkg.name}\n${'='.repeat(pkg.name.length)}\n${licenseText}`);
  if(pkg.name==='pako'){
    const source=await readFile(resolve(directory,'lib/zlib/deflate.js'),'utf8');
    const notice=source.match(/\/\/ \(C\)[\s\S]*?\/\/ 3\.[^\n]*\n/);
    if(!notice)throw new Error('PRESENTATION_ZLIB_NOTICE_MISSING');
    transitiveNotices.push(`pako zlib-derived source notice\n${notice[0]}`);
  }
  const dependencyRequire=createRequire(packageFile);
  for(const name of Object.keys(pkg.dependencies||{}).sort())await collectNotices(dependencyRequire.resolve(`${name}/package.json`));
}
const zipPackage=resolve(modules,'jszip/package.json'),zipRequire=createRequire(zipPackage);
for(const name of Object.keys(JSON.parse(await readFile(zipPackage,'utf8')).dependencies).sort())await collectNotices(zipRequire.resolve(`${name}/package.json`));
await writeFile(resolve(root,'web/vendor/presentation/THIRD-PARTY-NOTICES'),transitiveNotices.join('\n\n')+'\n');
await writeFile(resolve(root,'web/vendor/presentation/README.md'),'PptxGenJS 4.0.1 and JSZip 3.10.1, bundled locally for editable Timeline export. No CDN or runtime dependency downloads. Rebuild with node scripts/build-pptx-browser-vendor.mjs /absolute/path/to/node_modules. Upstream licenses are retained alongside the runtime.\n');
const fingerprint=async file=>{const bytes=await readFile(resolve(root,file));return{path:file,bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')};};
const manifest={schema:'d1-timeline-presentation-vendor/1',delivery:'bundled_into_application_esm',runtime:await fingerprint('web/vendor/presentation/pptx-runtime.js'),components:[
  {name:'pptxgenjs',version:'4.0.1',license:'MIT',upstream:'https://github.com/gitbrent/PptxGenJS',notice:await fingerprint('web/vendor/presentation/PPTXGENJS-LICENSE'),releaseNotice:'vendor/presentation/PPTXGENJS-LICENSE.txt'},
  {name:'jszip',version:'3.10.1',license:'MIT',upstream:'https://github.com/Stuk/jszip',notice:await fingerprint('web/vendor/presentation/JSZIP-LICENSE'),releaseNotice:'vendor/presentation/JSZIP-LICENSE.txt'}
],transitiveNotice:{...await fingerprint('web/vendor/presentation/THIRD-PARTY-NOTICES'),releasePath:'vendor/presentation/THIRD-PARTY-NOTICES.txt'}};
await writeFile(resolve(root,'release/d1-021-presentation-vendor.json'),`${JSON.stringify(manifest,null,2)}\n`);
