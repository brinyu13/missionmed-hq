import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {readCoreModel} from '../../server/core-read-model.mjs';
import {createHandler} from '../../server/http.mjs';
import {createServer} from 'node:http';
import {AppError} from '../../server/errors.mjs';
const runtime=readFileSync(new URL('../../public/source/runtime.js',import.meta.url),'utf8');
const complete=runtime.slice(runtime.indexOf('function completeWorkspace('),runtime.indexOf('async function boot(){'));
function workspace(){
 const pending=[];const context=vm.createContext({Promise,Error,Number,normalizeRole:r=>({administrator:'admin',admin:'admin',student:'student'})[r],apiFetch:path=>new Promise((resolve,reject)=>pending.push({path,resolve,reject}))});
 vm.runInContext("let S={ui:{route:'calendar',drawer:null}},actor={id:'own',role:'student',tier:'360'},sessionEpoch=1,workspacePhase='calendar',workspaceLoadSequence=1,workspaceReadFlight=null,workspaceLoadError=null,version=4,applied=0,renders=0,locked=false,draft='retained';const applyBootstrap=b=>{applied++;workspacePhase='full';workspaceLoadSequence++;version=b.version;};const render=()=>renders++;const lockWorkspace=()=>{locked=true;S=null;};"+complete,context);
 return{run:s=>vm.runInContext(s,context),pending,body:{actor:{id:'own',role:'student',tier:'360'},version:4}};
}
test('quiet full read joins one flight, retains drafts, and redraws Calendar only after current data',async()=>{
 const f=workspace(),p=f.run('completeWorkspace()'),again=f.run('completeWorkspace()');assert.equal(p,again);assert.equal(f.pending.length,1);
 f.pending[0].resolve(f.body);await p;assert.equal(f.run('applied'),1);assert.equal(f.run('renders'),1);assert.equal(f.run('draft'),'retained');
});
test('late full data and errors are discarded after account, role, tier, session, mutation, version or phase changes',async()=>{
 for(const mutation of ["actor.id='other'","actor.role='admin'","actor.tier='ivprep_complete'","sessionEpoch++","workspaceLoadSequence++","version++","workspacePhase='full'"])for(const failed of [false,true]){
  const f=workspace(),p=f.run('completeWorkspace()');f.run(mutation);
  if(failed)f.pending[0].reject(Error('Synthetic outage'));else f.pending[0].resolve(f.body);
  await p;assert.equal(f.run('applied'),0);assert.equal(f.run('renders'),['workspaceLoadSequence++','version++'].includes(mutation)?1:0);assert.equal(f.run('draft'),'retained');if(['workspaceLoadSequence++','version++'].includes(mutation)){assert.ok(f.run('workspaceLoadError'));}else assert.equal(f.run('workspaceLoadError'),null);
 }
});
test('remote revision changes never silently update a version under an open editing form',async()=>{
 const f=workspace(),p=f.run('completeWorkspace()');f.run("S.ui.drawer={kind:'intake'}");f.pending[0].resolve({...f.body,version:5});await p;
 assert.equal(f.run('applied'),0);assert.equal(f.run('version'),4);assert.equal(f.run('renders'),0);assert.ok(f.run('workspaceLoadError'));
});
test('full metadata can finish without repainting a private drawer',async()=>{
 const f=workspace(),p=f.run('completeWorkspace()');f.run("S.ui.drawer={kind:'day'}");f.pending[0].resolve(f.body);await p;assert.equal(f.run('applied'),1);assert.equal(f.run('renders'),0);
});
test('current full-read access denial locks private memory; transient outage has one explicit retry',async()=>{
 for(const status of [401,403,503]){
  const f=workspace(),p=f.run('completeWorkspace()');f.pending[0].reject(Object.assign(Error('Synthetic failure'),{status}));await p;
  assert.equal(f.run('locked'),status!==503);assert.equal(f.pending.length,1);
  if(status===503){assert.ok(f.run('workspaceLoadError'));const retry=f.run('completeWorkspace()');assert.equal(f.pending.length,2);f.pending[1].resolve(f.body);await retry;assert.equal(f.run('applied'),1);}
 }
});
test('actual HTTP bootstrap accepts only the bounded variant, keeps old clients, private cache and fresh authorization',async()=>{
 let authorized=0,calls=0,allowed=true;const actor={id:'own',role:'student',tier:'360',eligible:true};
 const config={enabled:true,coreOnly:true,calendar:{enabled:true},publicOrigin:'https://example.test',gatewaySecret:'synthetic-local-gateway-fixture-not-production'};
 const commands={bootstrap:async(a,opts)=>{calls++;return{actor:a,calendarOnly:opts.calendarOnly};}};
 const authorize=async()=>{authorized++;if(!allowed)throw new AppError(403,'access_denied','Synthetic denial');return actor;};
 const server=createServer(createHandler({config,database:{},owners:{},commands,authorize}));await new Promise(r=>server.listen(0,'127.0.0.1',r));
 try{
  const call=q=>fetch('http://127.0.0.1:'+server.address().port+'/api/bootstrap'+q,{headers:{Origin:config.publicOrigin,'X-MMED-IIQ-Gateway':config.gatewaySecret}});
  for(const q of ['', '?view=calendar']){const r=await call(q);assert.equal(r.status,200);assert.equal(r.headers.get('cache-control'),'private, no-store');assert.equal((await r.json()).calendarOnly,q!=='');}
  assert.equal(authorized,2);assert.equal(calls,2);
  for(const q of ['?view=calendar&view=calendar','?view[]=calendar','?view=calendar&owner=other','?view=full','?%76iew=calendar','?view=calendar&'])assert.equal((await call(q)).status,400);
  assert.equal(authorized,2);allowed=false;assert.equal((await call('?view=calendar')).status,403);assert.equal(authorized,3);assert.equal(calls,2);
 }finally{await new Promise(r=>server.close(r));}
});
test('Calendar own-record read retains dated, undated, canceled and related records without awaiting the optional owner',async()=>{
 const id='00000000-0000-4000-8000-000000000001',queries=[];let ownerReads=0;
 const actor={id,role:'student',tier:'360',eligible:true,zone:'UTC'};
 const records=[{id:'dated',owner_id:id,version:1,status:'scheduled',local_date:'2026-10-20',local_time:'10:00',timezone:'UTC',start_at:'2026-10-20T10:00:00Z'},{id:'undated',owner_id:id,version:2,status:'cancelled'}];
 const event={id:'social',interview_id:'dated',title:'Meet and greet',local_date:'2026-10-19',status:'scheduled'};
 const db={async query(sql,args){queries.push({sql,args});return{rows:sql.includes('max(revision)')?[{revision:'4'}]:sql.startsWith('SELECT * FROM iiq.interviews')?records:sql.startsWith('SELECT * FROM iiq.related_events')?[event]:[]};}};
 const config={coreOnly:true,calendar:{enabled:true},loi:{enabled:true,mode:'ELIGIBLE',targetsEnabled:true}};
 const owners={rise:{savedPrograms:()=>{ownerReads++;return new Promise(()=>{});}}};
 const fast=await readCoreModel(db,actor,{config,owners,calendarOnly:true,clock:()=>new Date('2026-10-14T00:00:00Z')});
 assert.equal(ownerReads,0);assert.equal(fast.workspacePhase,'calendar');assert.equal(fast.version,4);assert.equal(fast.state.interviews.length,2);
 assert.equal(fast.state.interviews[1].disposition,'cancelled');assert.equal(fast.state.interviews[1].date,null);assert.equal(fast.state.interviews[0].related[0].id,'social');
 assert.ok(queries.filter(q=>q.sql.includes('iiq.interviews')||q.sql.includes('iiq.related_events')||q.sql.includes('iiq.interview_history')).every(q=>q.sql.includes('owner_id=$1')&&q.args[0]===id));
 const full=readCoreModel(db,actor,{config,owners});await new Promise(r=>setImmediate(r));assert.equal(ownerReads,1);
 void full; // Synthetic unresolved optional owner proves Calendar is independent.
});

test('signed full-response role or tier changes clear private access rather than applying another scope',async()=>{
 for(const patch of [{role:'admin',tier:'admin'},{role:'student',tier:'ivprep_complete'},{id:'other'}]){
  const f=workspace(),p=f.run('completeWorkspace()');f.pending[0].resolve({...f.body,actor:{...f.body.actor,...patch}});await p;assert.equal(f.run('locked'),true);assert.equal(f.run('applied'),0);
 }
});
test('full completion never redraws an independently opened preparation route',async()=>{
 const f=workspace(),p=f.run('completeWorkspace()');f.run("S.ui.route='interviews'");f.pending[0].resolve(f.body);await p;assert.equal(f.run('applied'),1);assert.equal(f.run('renders'),0);
});
