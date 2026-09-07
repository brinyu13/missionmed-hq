import assert from 'node:assert/strict';
import test from 'node:test';
import {mkdtemp,mkdir,writeFile,readFile,symlink,readlink,rm,realpath} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';

const helper=fileURLToPath(new URL('../scripts/wordpress-release-022.php',import.meta.url));
const include='wp-content/plugins/missionmed-timeline-sso/includes/workspace-022.php';
const paths=['wp-content/plugins/missionmed-timeline-sso/missionmed-timeline-sso.php',include,'wp-content/plugins/missionmed-timeline-sso/assets/matrix-launch.js','wp-content/mu-plugins/missionmed-timeline-route.php'];
const oldId='timeline-wp-1111111111111111',newId='timeline-wp-2222222222222222';
const runtime=id=>`wp-content/mu-plugins/missionmed-timeline-runtime/releases/${id}/release.php`;
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const basePlan={schema_version:'d1-022-wordpress-operation.1',authority_ticket_sha256:'e27016edef2f722f1424a16d7246e5e1851d266b7825d832f7bbf62e84ec147c',snapshot_id:'022-20260907T020000Z-aaaaaaaa'};
const settings={timeline_enabled:false,rollout_stage:'off',consent_version:'d1-500-v1'};
async function fixture(t){
  const base=await realpath(await mkdtemp(join(tmpdir(),'timeline022-release-test-')));t.after(()=>rm(base,{recursive:true,force:true}));
  const root=join(base,'public'),privateRoot=join(base,'private');await mkdir(root);await mkdir(privateRoot);
  for(const rel of [...paths.filter(path=>path!==include),runtime(oldId)]){await mkdir(dirname(join(root,rel)),{recursive:true});await writeFile(join(root,rel),rel.endsWith('.php')?'<?php return array();':'old source');}
  await symlink(`releases/${oldId}`,join(root,'wp-content/mu-plugins/missionmed-timeline-runtime/current'));
  await writeFile(join(root,'sibling.txt'),'preserve unrelated bytes');
  const invoke=(mode,plan,options={})=>{
    const php="define('D1_022_LIBRARY_ONLY',true); require $argv[1]; $a=json_decode(stream_get_contents(STDIN),true); try{$r=tl022_operation($a['mode'],$a['plan'],$a['root'],$a['private'],$a['settings'],$a['execute']); echo json_encode(['ok'=>true,'result'=>$r]);}catch(Throwable $e){echo json_encode(['ok'=>false,'code'=>$e->getMessage()]);}";
    return JSON.parse(execFileSync('php',['-r',php,helper],{input:JSON.stringify({mode,plan,root,private:privateRoot,settings:options.settings||settings,execute:options.execute??true}),maxBuffer:1024*1024}).toString());
  };
  const inspection=invoke('inspect',basePlan);assert.equal(inspection.ok,true,inspection.code);const before=inspection.result.inventory;
  const plan={...basePlan,baseline:before};
  const backup=()=>{const result=invoke('backup',plan);assert.equal(result.ok,true,result.code);plan.backup_receipt_sha256=result.result.receipt_sha256;return result.result;};
  function candidate(){
    const files={};
    for(const rel of [...paths,runtime(newId)]){
      const bytes=Buffer.from(rel===runtime(newId)?`<?php return array('release_id' => '${newId}', 'source_commit' => '${'a'.repeat(40)}');`:rel.endsWith('.php')?'<?php return array("new");':'new source');
      files[rel]={sha256:sha(bytes),bytes:bytes.length,data:bytes.toString('base64')};
    }
    plan.candidate={mode:'release',source_commit:'a'.repeat(40),release_id:newId,files};return plan;
  }
  return{root,privateRoot,invoke,before,plan,backup,candidate};
}
test('inspect performs no snapshot write and backup requires an explicit execution flag',async t=>{
  const f=await fixture(t);assert.equal(f.invoke('inspect',f.plan,{execute:false}).result.status,'READ_ONLY');
  assert.equal(f.invoke('backup',f.plan,{execute:false}).code,'EXPLICIT_EXECUTION_REQUIRED');
  await assert.rejects(readFile(join(f.privateRoot,'d1-timeline-022-backups',basePlan.snapshot_id,'receipt.json')),{code:'ENOENT'});
});
test('backup binds four exact files plus private settings and reconstructs each into an isolated directory',async t=>{
  const f=await fixture(t),receipt=f.backup();assert.equal(receipt.files,5);assert.equal(receipt.live_changed,false);assert.equal(receipt.isolated_file_restore,true);
  const snapshot=join(f.privateRoot,'d1-timeline-022-backups',basePlan.snapshot_id);
  assert.deepEqual(JSON.parse(await readFile(join(snapshot,'isolated-restore/settings.json'),'utf8')),settings);
  assert.ok(!JSON.stringify(receipt).includes('settings.json'));
  assert.equal(f.invoke('backup',f.plan).code,'BACKUP_ALREADY_EXISTS');
});
test('credential, unknown, nested and credential-bearing URL options fail before any snapshot write',async t=>{
  const f=await fixture(t);
  for(const extra of [{gateway_secret:'synthetic-private-setting'},{unexpected_setting:'unreviewed'},
    {matrix_menu_locations:[{secret:'synthetic'}]},{api_origin:'https://user:synthetic@example.test'},
    {issuer:'https://example.test/timeline/?token=synthetic'}]){
    const result=f.invoke('backup',f.plan,{settings:{...settings,...extra}});
    assert.equal(result.ok,false);assert.match(result.code,/SETTINGS_(UNKNOWN_OR_SECRET_KEY|VALUE_INVALID|URL_CREDENTIAL_OR_INVALID)/);
    await assert.rejects(readFile(join(f.privateRoot,'d1-timeline-022-backups',basePlan.snapshot_id,'receipt.json')),{code:'ENOENT'});
  }
});
test('changed live bytes and symlinked source parents stop before a backup',async t=>{
  const f=await fixture(t);await writeFile(join(f.root,paths[0]),'changed');assert.equal(f.invoke('backup',f.plan).code,'BASELINE_DRIFT');
  await rm(join(f.root,'wp-content/plugins/missionmed-timeline-sso/assets'),{recursive:true});await mkdir(join(f.root,'other-assets'));await writeFile(join(f.root,'other-assets/matrix-launch.js'),'old source');await symlink(join(f.root,'other-assets'),join(f.root,'wp-content/plugins/missionmed-timeline-sso/assets'));
  assert.equal(f.invoke('inspect',f.plan).code,'PATH_ESCAPE_OR_SYMLINK');
});
test('tampered backup and enabled admission both deny install',async t=>{
  const f=await fixture(t);f.backup();f.candidate();
  assert.equal(f.invoke('install',f.plan,{settings:{...settings,timeline_enabled:true,rollout_stage:'canary'}}).code,'ADMISSION_MUST_BE_OFF');
  const snapshot=join(f.privateRoot,'d1-timeline-022-backups',basePlan.snapshot_id);await writeFile(join(snapshot,'settings.json'),'{}');
  assert.equal(f.invoke('install',f.plan).code,'BACKUP_HASH_MISMATCH');
});
test('candidate cannot add a sibling file or substitute release bytes',async t=>{
  const f=await fixture(t);f.backup();f.candidate();f.plan.candidate.files['wp-content/plugins/sibling/index.php']={};
  assert.equal(f.invoke('install',f.plan).code,'CANDIDATE_FILE_SET_DENIED');delete f.plan.candidate.files['wp-content/plugins/sibling/index.php'];
  f.plan.candidate.files[paths[0]].data=Buffer.from('changed').toString('base64');assert.equal(f.invoke('install',f.plan).code,'CANDIDATE_HASH_MISMATCH');
  assert.equal(await readFile(join(f.root,'sibling.txt'),'utf8'),'preserve unrelated bytes');
});
test('immutable release collision never overwrites the existing release',async t=>{
  const f=await fixture(t);f.backup();f.candidate();await mkdir(dirname(join(f.root,runtime(newId))),{recursive:true});await writeFile(join(f.root,runtime(newId)),'collision');
  assert.equal(f.invoke('install',f.plan).code,'IMMUTABLE_RELEASE_COLLISION');assert.equal(await readFile(join(f.root,runtime(newId)),'utf8'),'collision');
  assert.equal(await readlink(join(f.root,'wp-content/mu-plugins/missionmed-timeline-runtime/current')),`releases/${oldId}`);
});
test('install and scoped rollback retain the old release, settings and unrelated bytes',async t=>{
  const f=await fixture(t);await mkdir(dirname(join(f.root,include)),{recursive:true});await writeFile(join(f.root,dirname(include),'sibling.php'),'keep include sibling');f.backup();f.candidate();const installed=f.invoke('install',f.plan);assert.equal(installed.ok,true,installed.code);assert.equal(installed.result.status,'INSTALLED_ADMISSION_OFF');
  assert.equal(installed.result.inventory.pointer,`releases/${newId}`);f.plan.installed_inventory=installed.result.inventory;
  const restored=f.invoke('rollback',f.plan);assert.equal(restored.ok,true,restored.code);assert.equal(restored.result.status,'ROLLED_BACK_ADMISSION_OFF');
  assert.deepEqual(restored.result.inventory.files,f.before.files);assert.equal(restored.result.inventory.settings_sha256,f.before.settings_sha256);
  assert.equal(f.before.files[include].exists,false);await assert.rejects(readFile(join(f.root,include)),{code:'ENOENT'});
  assert.equal(await readFile(join(f.root,dirname(include),'sibling.php'),'utf8'),'keep include sibling');
  assert.equal(await readFile(join(f.root,'sibling.txt'),'utf8'),'preserve unrelated bytes');assert.ok((await readFile(join(f.root,runtime(newId)))).length>0);
});
test('a pre-existing exact workspace include is backed up and restored rather than removed',async t=>{
  const f=await fixture(t);await mkdir(dirname(join(f.root,include)),{recursive:true});await writeFile(join(f.root,include),'<?php return "prior include";');
  f.plan.baseline=f.invoke('inspect',f.plan).result.inventory;const backup=f.backup();assert.equal(backup.files,6);f.candidate();
  const installed=f.invoke('install',f.plan);assert.equal(installed.ok,true,installed.code);f.plan.installed_inventory=installed.result.inventory;
  assert.equal(f.invoke('rollback',f.plan).ok,true);assert.equal(await readFile(join(f.root,include),'utf8'),'<?php return "prior include";');
});
test('rollback refuses a newer live edit and malformed PHP never changes the active pointer',async t=>{
  const f=await fixture(t);f.backup();f.candidate();const bytes=Buffer.from('<?php this is invalid syntax');f.plan.candidate.files[paths[0]]={sha256:sha(bytes),bytes:bytes.length,data:bytes.toString('base64')};
  assert.equal(f.invoke('install',f.plan).code,'CANDIDATE_PHP_LINT_FAILED');assert.equal(await readlink(join(f.root,'wp-content/mu-plugins/missionmed-timeline-runtime/current')),`releases/${oldId}`);
  f.candidate();const installed=f.invoke('install',f.plan);assert.equal(installed.ok,true,installed.code);f.plan.installed_inventory=installed.result.inventory;
  await writeFile(join(f.root,include),'newer unrelated operator edit');assert.equal(f.invoke('rollback',f.plan).code,'BASELINE_DRIFT');assert.equal(await readFile(join(f.root,include),'utf8'),'newer unrelated operator edit');
});
