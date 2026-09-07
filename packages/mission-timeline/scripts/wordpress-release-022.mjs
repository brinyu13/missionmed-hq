import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {readFile,writeFile,stat} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {resolve,dirname,isAbsolute} from 'node:path';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const repository=resolve(root,'../..');
const evidence=resolve(repository,'_AI_HANDOFFS/from_codex/D1-TIMELINE-STORYFORGE-LIVE-022');
const args=new Map();
for(let i=2;i<process.argv.length;i++){
  const key=process.argv[i];
  if(key==='--execute'){args.set(key,true);continue;}
  if(!['--action','--plan','--receipt'].includes(key)||!process.argv[i+1]||args.has(key))throw Error('ARGUMENT_DENIED');
  args.set(key,process.argv[++i]);
}
const action=args.get('--action')||'inspect';
if(!['inspect','backup','install','rollback'].includes(action))throw Error('ACTION_DENIED');
const planPath=args.get('--plan'),receiptPath=args.get('--receipt');
if(!isAbsolute(planPath||'')||!isAbsolute(receiptPath||'')||!receiptPath.startsWith(evidence+'/'))throw Error('EXACT_PLAN_AND_EVIDENCE_PATHS_REQUIRED');
const plan=JSON.parse(await readFile(planPath,'utf8'));
const execute=args.get('--execute')===true;
if(action!=='inspect'&&!execute)throw Error('EXPLICIT_EXECUTION_REQUIRED');
async function guard(){
  for(const name of action==='inspect'?['evidence']:['timeline','wordpress','evidence']){
    const status=JSON.parse(await readFile(`/private/tmp/d1-022-coordination-20260907/${name}.status.json`,'utf8'));
    if(status.state!=='READY'||Date.now()/1000-status.observed_at>12||Date.parse(status.receipt?.expires_at)<=Date.now())throw Error(`LEASE_NOT_CURRENT:${name}`);
  }
}
if(action==='install'){
  const manifest=JSON.parse(await readFile(resolve(root,'dist/release-manifest.json'),'utf8'));
  const head=execFileSync('git',['rev-parse','HEAD'],{cwd:repository,encoding:'utf8'}).trim();
  const dirty=execFileSync('git',['status','--porcelain=v1','--untracked-files=all','--','packages/mission-timeline','wp-content/plugins/missionmed-timeline-sso'],{cwd:repository,encoding:'utf8'}).trim();
  if(dirty||manifest.mode!=='release'||manifest.source_commit!==head||plan.candidate?.source_commit!==head)throw Error('CLEAN_SEALED_RELEASE_REQUIRED');
  if(!/^[a-f0-9]{64}$/.test(manifest.asset_authority_manifest_sha256||''))throw Error('ASSET_AUTHORITY_REQUIRED');
  execFileSync(process.execPath,['scripts/check-release.mjs'],{cwd:root,stdio:'pipe'});
  const runtime=await readFile(resolve(root,'dist-wordpress/release.php'));
  const runtimeRel=`wp-content/mu-plugins/missionmed-timeline-runtime/releases/${plan.candidate.release_id}/release.php`;
  const sources={
    'wp-content/plugins/missionmed-timeline-sso/missionmed-timeline-sso.php':resolve(repository,'wp-content/plugins/missionmed-timeline-sso/missionmed-timeline-sso.php'),
    'wp-content/plugins/missionmed-timeline-sso/includes/workspace-022.php':resolve(repository,'wp-content/plugins/missionmed-timeline-sso/includes/workspace-022.php'),
    'wp-content/plugins/missionmed-timeline-sso/assets/matrix-launch.js':resolve(repository,'wp-content/plugins/missionmed-timeline-sso/assets/matrix-launch.js'),
    'wp-content/mu-plugins/missionmed-timeline-route.php':resolve(root,'infra/wordpress/missionmed-timeline-route.php'),
    [runtimeRel]:resolve(root,'dist-wordpress/release.php'),
  };
  if(Object.keys(plan.candidate.files||{}).sort().join('\n')!==Object.keys(sources).sort().join('\n'))throw Error('CANDIDATE_SOURCE_SET_MISMATCH');
  for(const [rel,path] of Object.entries(sources)){
    const bytes=path.endsWith('dist-wordpress/release.php')?runtime:await readFile(path);
    const entry=plan.candidate.files[rel];
    if(entry.sha256!==createHash('sha256').update(bytes).digest('hex')||entry.bytes!==bytes.length)throw Error('CANDIDATE_SOURCE_BYTES_MISMATCH');
    entry.data=bytes.toString('base64');
  }
}
await guard();
try{await stat(receiptPath);throw Error('RECEIPT_ALREADY_EXISTS');}catch(error){if(error.code!=='ENOENT')throw error;}
const helper=(await readFile(new URL('./wordpress-release-022.php',import.meta.url),'utf8')).replace(/^<\?php\s*/,'');
const quote=value=>"'"+value.replace(/'/g,"'\\''")+"'";
let result;
try{
  const output=execFileSync('ssh',['-o','BatchMode=yes','missionmed-kinsta',`php -r ${quote(helper)} -- ${action}${execute?' --execute':''}`],{input:JSON.stringify(plan),maxBuffer:1024*1024,timeout:120000,stdio:['pipe','pipe','pipe']});
  result=JSON.parse(output.toString('utf8'));
}catch(error){
  // PHP/WordPress startup diagnostics can contain private configuration; never relay them.
  throw Error('WORDPRESS_OPERATION_FAILED_INSPECT_PRIVATE_STATE');
}
await guard();
await writeFile(receiptPath,JSON.stringify({schema_version:'d1-022-wordpress-operation-receipt.1',action,observed_at:new Date().toISOString(),helper_sha256:createHash('sha256').update(helper).digest('hex'),result},null,2)+'\n',{flag:'wx',mode:0o600});
console.log(JSON.stringify({status:result.status,action,receipt:receiptPath}));
