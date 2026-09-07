import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawn,execFileSync} from 'node:child_process';
import {once} from 'node:events';
import {createInterface} from 'node:readline';
import 'fake-indexeddb/auto';
import {HybridIndexedDbAdapter} from '../matrix/hybrid-indexeddb-adapter.js';
const php='/opt/homebrew/bin/php';
const source=fs.readFileSync(new URL('../../../wp-content/plugins/missionmed-timeline-sso/missionmed-timeline-sso.php',import.meta.url),'utf8');
const release=source.match(/function mmtl_release_ai_proxy_session_lock\(\$is_ai_route\) \{[\s\S]*?\n\}/)?.[0];
assert.ok(release,'actual owned PHP helper must be present');
const phpQuote=value=>"'"+value.replaceAll('\\','\\\\').replaceAll("'","\\'")+"'";
async function fixture(ai){
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'timeline-session-concurrency-'));
 const sid='controlled'+crypto.randomUUID().replaceAll('-','');
 const setup=`session_save_path(${phpQuote(dir)});session_id(${phpQuote(sid)});session_start();`;
 const child=spawn(php,['-r',release+`function mmtl_gateway_error($code,$message,$status){throw new RuntimeException($code);} ${setup} $_SESSION['original']='unchanged-tracker-data';$before=session_id();mmtl_release_ai_proxy_session_lock(${ai?'true':'false'});echo json_encode(['boundary'=>true,'id_unchanged'=>session_id()===$before,'session_active'=>session_status()===PHP_SESSION_ACTIVE])."\n";flush();fgets(STDIN);if(session_status()===PHP_SESSION_ACTIVE)session_write_close();`],{stdio:['pipe','pipe','pipe']});
 const exited=once(child,'exit');const reader=createInterface({input:child.stdout});const [line]=await once(reader,'line');const boundary=JSON.parse(line);
 const contenders=new Set();
 const request=()=>new Promise((resolve,reject)=>{
  const worker=spawn(php,['-r',setup+`$same=($_SESSION['original']??'')==='unchanged-tracker-data';session_write_close();echo json_encode(['original_preserved'=>$same]);`],{stdio:['ignore','pipe','pipe']});contenders.add(worker);let output='';worker.stdout.on('data',v=>output+=v);worker.on('error',reject);worker.on('exit',code=>{contenders.delete(worker);if(code!==0)reject(Error('LOCAL_PHP_REQUEST_FAILED'));else resolve(JSON.parse(output));});
 });
 let released=false;const finish=async()=>{if(!released){released=true;child.stdin.end('finish\n');await exited;}};
 const cleanup=async()=>{await finish();for(const c of contenders)c.kill();reader.close();fs.rmSync(dir,{recursive:true,force:true});};
 return{boundary,request,finish,cleanup,child};
}
async function runAutosave({releaseAiLock}){
 const f=await fixture(releaseAiLock);let adapter;
 try{
  assert.equal(f.boundary.id_unchanged,true);assert.equal(f.boundary.session_active,!releaseAiLock);
  let revision=13,remoteStage='upload',calls=0,late;
  const api={configured:true,async createVersion(id,base,snapshot){calls++;if(base!==revision)throw Object.assign(Error('A newer revision exists'),{status:409,code:'REVISION_CONFLICT'});
   const processing=f.request().then(result=>{assert.equal(result.original_preserved,true);assert.equal(base,revision);revision++;remoteStage=snapshot.intake.stage;return{revision};});late=processing;
   let timer;try{return await Promise.race([processing,new Promise((_,reject)=>{timer=setTimeout(()=>reject(new DOMException('Controlled browser request deadline','TimeoutError')),1000);})]);}finally{clearTimeout(timer);}
  }};
  adapter=new HybridIndexedDbAdapter({name:'session-save-'+crypto.randomUUID(),apiClient:api,programId:'controlled',remoteSyncConsent:true});await adapter.open();clearTimeout(adapter.flushTimer);
  const id='timeline_controlled';await adapter.put('settings',{id:'remote-revision:'+id,documentId:id,revision:13,updatedAt:new Date().toISOString()});
  const doc={id,schemaVersion:'d1-uxr-002.1',programId:'controlled',studentOwnerId:'controlled',title:'Controlled fixture',revision:3,events:[],intake:{stage:'extraction',candidates:[]}};
  await adapter.atomicPut([{store:'documents',key:id,value:{id,sequence:1,document:doc}}]);clearTimeout(adapter.flushTimer);await adapter.flush();
  if(releaseAiLock){assert.equal(adapter.getSyncStatus().state,'SYNCED');assert.equal(await adapter.getRemoteRevision(id),14);assert.equal(f.child.exitCode,null,'AI holder still running while autosave acknowledgement arrives');}
  else{assert.equal(adapter.getSyncStatus().state,'ERROR');assert.equal(await adapter.getRemoteRevision(id),13);await f.finish();await late;assert.equal(revision,14);}
  await adapter.atomicPut([{store:'documents',key:id,value:{id,sequence:2,document:{...doc,intake:{stage:'review',candidates:[{id:'controlled-candidate'}]}}}}]);clearTimeout(adapter.flushTimer);await adapter.flush();
  assert.equal(calls,2);
  if(releaseAiLock){assert.equal(adapter.getSyncStatus().state,'SYNCED');assert.equal(await adapter.getRemoteRevision(id),15);assert.equal(remoteStage,'review');assert.equal((await adapter.pending()).length,0);}
  else{assert.equal(adapter.getSyncStatus().state,'CONFLICT');assert.equal(await adapter.getRemoteRevision(id),13);assert.equal(remoteStage,'extraction');assert.equal((await adapter.pending())[0].document.intake.stage,'review');}
 }finally{adapter?.close();await f.cleanup();}
}
test('Native unreleased PHP session reproduces a lost-ACK conflict with one save adapter',()=>runAutosave({releaseAiLock:false}));
test('Timeline AI boundary releases native session: autosave ACKs during provider wait and next review saves',()=>runAutosave({releaseAiLock:true}));
test('AI-only release runs after authorization/body input and before the upstream request',()=>{
 const at=source.indexOf('    mmtl_release_ai_proxy_session_lock($is_ai_route);');
 assert.ok(at>source.indexOf("$args['body'] = file_get_contents('php://input');",source.indexOf('function mmtl_proxy_api_request()')));
 assert.ok(at>source.indexOf("$outbound_headers = array(",source.indexOf('function mmtl_proxy_api_request()')));
 assert.ok(at<source.indexOf('$response = wp_remote_request($target, $args);',at));
 assert.match(release,/\$is_ai_route && session_status\(\) === PHP_SESSION_ACTIVE/);
 assert.doesNotMatch(release,/session_destroy|session_unset|setcookie|wp_destroy|\$_SESSION\s*=/);
});
test('No-session AI boundary is harmless; failure code is explicit and no auth state is changed',()=>{
 const output=execFileSync(php,['-r',release+`function mmtl_gateway_error($code,$message,$status){throw new RuntimeException($code);} mmtl_release_ai_proxy_session_lock(true);echo session_status()===PHP_SESSION_NONE?'UNCHANGED':'FAILED';`],{encoding:'utf8'});assert.equal(output,'UNCHANGED');
 assert.match(release,/'timeline_session_release_failed'/);
});
test('Conflict explanation describes server state without inventing another device',()=>{
 const app=fs.readFileSync(new URL('../web/js/407f-engineering-adapter.js',import.meta.url),'utf8');
 assert.match(app,/A newer version is saved on the server, and this copy has unsynced changes/);
 assert.doesNotMatch(app,/Another tab or device saved a newer version/);
});
