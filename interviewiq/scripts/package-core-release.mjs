#!/usr/bin/env node
// Creates an upload artifact only. Activation/current switching belongs to the guarded deploy.
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import crypto from 'node:crypto';
import {execFileSync} from 'node:child_process';
const repository=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const hash=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
const assets=['index.html','styles.css','app.js'];
const plugins=['missionmed-interviewiq-sso.php','missionmed-interviewiq-route.php','missionmed-matrix-interviewiq-entry.php'];
const fail=message=>{throw Error(message);};
const phpString=value=>"'"+String(value).replaceAll('\\','\\\\').replaceAll("'","\\'")+"'";
const run=(command,args,options={})=>execFileSync(command,args,{encoding:'utf8',maxBuffer:4*1024*1024,...options});
async function sourceFile(root,relative,commit){
  const absolute=path.join(root,relative),stat=await fs.lstat(absolute);
  if(!stat.isFile()||stat.isSymbolicLink())fail('Source must be a regular file: '+relative);
  const bytes=await fs.readFile(absolute);
  const frozen=execFileSync('git',['show',commit+':'+relative],{cwd:root,maxBuffer:20*1024*1024});
  if(!bytes.equals(frozen))fail('Source differs from supplied commit: '+relative);
  return bytes;
}
function verifyReferences(html,css){
  const refs=[...html.matchAll(/\b(?:src|href)\s*=\s*["']([^"']+)["']/g)].map(m=>m[1]);
  for(const ref of refs)if(!ref.startsWith('data:')&&!ref.startsWith('#')&&!['./styles.css','./app.js'].includes(ref))fail('Unpackaged HTML reference: '+ref.slice(0,160));
  if(refs.filter(x=>x==='./styles.css').length!==1||refs.filter(x=>x==='./app.js').length!==1)fail('Expected exactly one stylesheet and app reference.');
  if(/@import\b/i.test(css))fail('CSS imports require explicit packaging review.');
  for(const match of css.matchAll(/url\(\s*(["']?)(.*?)\1\s*\)/gi))if(!match[2].startsWith('data:')&&!match[2].startsWith('#'))fail('Unpackaged CSS reference: '+match[2].slice(0,160));
}
export async function packageCoreRelease({root=repository,sourceCommit,output}={}){
  if(!/^[a-f0-9]{40}$/.test(sourceCommit||''))fail('--source-commit must be the exact 40-character Git commit SHA.');
  const resolved=run('git',['rev-parse',sourceCommit+'^{commit}'],{cwd:root}).trim();
  if(resolved!==sourceCommit)fail('Commit did not resolve exactly.');
  const input={};for(const name of assets)input['interviewiq/public/'+name]=await sourceFile(root,'interviewiq/public/'+name,sourceCommit);
  for(const name of plugins)input['interviewiq/infra/wordpress/'+name]=await sourceFile(root,'interviewiq/infra/wordpress/'+name,sourceCommit);
  verifyReferences(input['interviewiq/public/index.html'].toString(),input['interviewiq/public/styles.css'].toString());
  const inputHashes=Object.fromEntries(Object.entries(input).map(([name,bytes])=>[name,hash(bytes)]));
  // The ID uses frozen pre-rewrite hashes plus commit; rewriting the index cannot be circular.
  const releaseId=hash(JSON.stringify({schema:'missionmed.interviewiq.release-input.v1',sourceCommit,inputHashes}));
  const base=output||path.join(root,'_AI_HANDOFFS/from_codex/IIQ-1200/core-launch/release');
  await fs.mkdir(base,{recursive:true});const target=path.join(base,releaseId);await fs.mkdir(target); // Never clobber an existing immutable candidate.
  const stage=path.join(target,'stage'),mu=path.join(stage,'mu-plugins'),runtime=path.join(mu,'missionmed-interviewiq-runtime'),release=path.join(runtime,'releases',releaseId);
  await fs.mkdir(release,{recursive:true});
  const entries={};
  for(const name of assets){let bytes=input['interviewiq/public/'+name];if(name==='index.html')bytes=Buffer.from(bytes.toString().replace('href="./styles.css"',`href="/interviewiq/releases/${releaseId}/styles.css"`).replace('src="./app.js"',`src="/interviewiq/releases/${releaseId}/app.js"`));await fs.writeFile(path.join(release,name),bytes,{flag:'wx',mode:0o644});entries[name]={sha256:hash(bytes),bytes:bytes.length};}
  const manifest={schema:'missionmed.interviewiq.release.v1',release_id:releaseId,source_commit:sourceCommit,assets:entries};
  const php="<?php\nreturn array(\n  'schema' => "+phpString(manifest.schema)+",\n  'release_id' => "+phpString(releaseId)+",\n  'source_commit' => "+phpString(sourceCommit)+",\n  'assets' => array(\n"+Object.entries(entries).map(([name,entry])=>"    "+phpString(name)+" => array('sha256' => "+phpString(entry.sha256)+", 'bytes' => "+entry.bytes+"),").join('\n')+"\n  ),\n);\n";
  await fs.writeFile(path.join(release,'release.php'),php,{flag:'wx',mode:0o644});
  for(const name of plugins)await fs.writeFile(path.join(mu,name),input['interviewiq/infra/wordpress/'+name],{flag:'wx',mode:0o644});
  for(const filename of [...plugins.map(n=>path.join(mu,n)),path.join(release,'release.php')])run('php',['-l',filename]);
  // Exercise the deployed strict reader, including actual size/hash verification of every asset.
  const verify="define('ABSPATH', '/'); function mmiiq_enabled(){return false;} function add_action(...$args){} require $argv[1]; $r=mmiiqg_read_release($argv[2],$argv[3]); if(!$r)exit(21); foreach(array('index.html','styles.css','app.js') as $f){if(!mmiiqg_asset($r,$f))exit(22);} echo json_encode($r['manifest']);";
  const verified=JSON.parse(run('php',['-r',verify,path.join(mu,'missionmed-interviewiq-route.php'),runtime,releaseId]));
  if(JSON.stringify(verified)!==JSON.stringify(manifest))fail('Generated PHP manifest differs from expected manifest.');
  const relativeFiles=[...assets,'release.php'].map(n=>'mu-plugins/missionmed-interviewiq-runtime/releases/'+releaseId+'/'+n).concat(plugins.map(n=>'mu-plugins/'+n)).sort();
  const files={};for(const name of relativeFiles){const bytes=await fs.readFile(path.join(stage,name));files[name]={sha256:hash(bytes),bytes:bytes.length};}
  const tar=path.join(target,'interviewiq-core-'+releaseId+'.tar');
  run('/usr/bin/tar',['--format','ustar','-cf',tar,'-C',stage,...relativeFiles],{env:{...process.env,COPYFILE_DISABLE:'1'}});
  const members=run('/usr/bin/tar',['-tf',tar]).trim().split('\n');
  if(JSON.stringify(members)!==JSON.stringify(relativeFiles))fail('Tar contains unexpected or missing members.');
  const extracted=path.join(target,'verified-extraction');await fs.mkdir(extracted);run('/usr/bin/tar',['-xf',tar,'-C',extracted]);
  for(const name of relativeFiles){const filename=path.join(extracted,name),stat=await fs.lstat(filename),bytes=await fs.readFile(filename);if(!stat.isFile()||stat.isSymbolicLink()||hash(bytes)!==files[name].sha256)fail('Tar readback mismatch: '+name);}
  await fs.rm(extracted,{recursive:true});
  const tarBytes=await fs.readFile(tar),receipt={schema:'missionmed.interviewiq.upload-package.v1',sourceCommit,releaseId,sourceFiles:inputHashes,assets:entries,files,tar:path.basename(tar),tarSha256:hash(tarBytes),tarBytes:tarBytes.length,validation:{phpSyntax:'passed',strictPhpReleaseReader:'passed',tarExtractedReadback:'passed',externalAssets:'none; images and fonts are inline data URLs'},activation:'Not activated. No current symlink included. Upload and guarded activation are separate.'};
  await fs.writeFile(path.join(target,'PACKAGE_MANIFEST.json'),JSON.stringify(receipt,null,2)+'\n',{flag:'wx'});
  return {releaseId,sourceCommit,directory:target,tar,tarSha256:receipt.tarSha256,manifest:path.join(target,'PACKAGE_MANIFEST.json'),files:relativeFiles.length};
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const args=process.argv.slice(2);
  if(args.length!==2||args[0]!=='--source-commit'){console.error('Usage: node interviewiq/scripts/package-core-release.mjs --source-commit <exact-40-char-sha>');process.exitCode=2;}
  else try{console.log(JSON.stringify(await packageCoreRelease({sourceCommit:args[1]}),null,2));}catch(error){console.error(error.message);process.exitCode=1;}
}
