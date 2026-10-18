import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const text=readFileSync(new URL('../../public/source/actions.js',import.meta.url),'utf8'),code=text.slice(text.indexOf('function calendarMonthRange'),text.indexOf('async function loadCalendarRoster'));
function setup(role='student'){
 const requests=[];
 const c=vm.createContext({Date,URLSearchParams,Promise,Error,Set,JSON,Array,Map,fetch:(path,options)=>new Promise((resolve,reject)=>requests.push({path,options,resolve,reject})),readJSON:async r=>{if(r.error)throw r.error;return r;},apiFetch:()=>{throw Error('duplicate first page');}});
 vm.runInContext(`let session={actor:{id:'own',role:'${role}',tier:'${role==='admin'?'admin':'360'}'},token:'synthetic',apiBase:'/interviewiq/api'},sessionEpoch=1,bootSequence=2,actor=null,capabilities={},calendarEpoch=0,calendarLoadSequence=0,cohortPage=null,cohortFlight=null,S=null,renders=0,locked=false,preview=false;const studentPreview=()=>preview,defaultUI=()=>({cal:{ym:'2026-10'}}),monthModel=()=>({days:[{key:'2026-09-27'},{key:'2026-11-07'}]}),calendarV2=()=>capabilities.calendarV2===true&&!preview&&!!actor,calendarAuthority=()=>({id:actor.id,role:actor.role,epoch:calendarEpoch}),currentCalendar=a=>calendarV2()&&actor.id===a.id&&actor.role===a.role&&calendarEpoch===a.epoch,render=()=>renders++,lockWorkspace=()=>{locked=true;calendarEpoch++;S=null;};${code}`,c);
 const run=s=>vm.runInContext(s,c),confirm=()=>run("actor={...session.actor};capabilities={calendarV2:true};S={ui:{route:'calendar',cal:{ym:'2026-10'},drawer:null}};");
 const response={start:'2026-09-26',end:'2026-11-08',deidentified:true,events:[{event_ref:'00000000-0000-4000-8000-000000000001',program_name:'Synthetic program',local_date:'2026-10-12',private:'must-not-render'}],nextCursor:null,readOnly:true,interviews:[],nextAfter:null};
 return{run,confirm,requests,response};
}
test('first cohort fetch starts before own bootstrap but is invisible until exact capability confirmation',async()=>{
 const f=setup();f.run('held=beginCalendarBootRead(bootSequence)');assert.equal(f.requests.length,1);assert.equal(f.run('cohortPage'),null);assert.equal(f.run('warmCalendar(held)'),undefined);f.confirm();const p=f.run('warmCalendar(held)');f.requests[0].resolve(f.response);await p;assert.equal(f.run('cohortPage.events.length'),1);assert.equal(f.run('cohortPage.complete'),true);assert.ok(!f.run('JSON.stringify(cohortPage)').includes('must-not-render'));assert.equal(f.requests.length,1);assert.equal(f.run('held.used'),true);
});
test('late preload is rejected across actor role tier session month or boot changes',async()=>{
 for(const change of ["actor.id='other'","actor.role='admin'","actor.tier='ivprep_complete'","sessionEpoch++","session={...session}","bootSequence++","held.startedAt-=30001","S.ui.cal.ym='2026-11'"]){
  const f=setup();f.run('held=beginCalendarBootRead(bootSequence)');f.confirm();f.run(change);assert.equal(f.run('takeCalendarBootRead(held,{...calendarMonthRange(),ym:S.ui.cal.ym})'),null);f.requests[0].resolve(f.response);
 }
});
test('disabled capability discards rejection; signed administrator uses overview, Preview sends nothing',async()=>{
 const f=setup();f.run('held=beginCalendarBootRead(bootSequence)');f.requests[0].resolve({error:Object.assign(Error('disabled'),{status:403})});f.confirm();f.run('capabilities.calendarV2=false');assert.equal(f.run('warmCalendar(held)'),undefined);await Promise.resolve();assert.equal(f.run('locked'),false);
 const a=setup('admin');a.run('held=beginCalendarBootRead(bootSequence)');assert.match(a.requests[0].path,/calendar\/overview\?/);a.requests[0].resolve(a.response);
 const p=setup();p.run('preview=true');assert.equal(p.run('beginCalendarBootRead(bootSequence)'),null);assert.equal(p.requests.length,0);
});
test('current confirmed access denial clears workspace; stale success or denial cannot replace a changed scope',async()=>{
 for(const status of [401,403]){const f=setup();f.run('held=beginCalendarBootRead(bootSequence)');f.confirm();const p=f.run('warmCalendar(held)');f.requests[0].resolve({error:Object.assign(Error('denied'),{status})});await p;assert.equal(f.run('locked'),true);}
 for(const fail of [false,true]){const f=setup();f.run('held=beginCalendarBootRead(bootSequence)');f.confirm();const p=f.run('warmCalendar(held)');f.run("actor.id='other'");f.requests[0].resolve(fail?{error:Object.assign(Error('denied'),{status:403})}:f.response);await p;assert.equal(f.run('locked'),false);assert.equal(f.run('cohortPage.events.length'),0);}
});

test('held response that ages while pending is discarded and a fresh current read replaces it',async()=>{
 const f=setup();f.run('held=beginCalendarBootRead(bootSequence)');f.confirm();f.run("let refreshes=0;apiFetch=async()=>{refreshes++;return {start:'2026-09-26',end:'2026-11-08',deidentified:true,events:[],nextCursor:null}};");
 const p=f.run('warmCalendar(held)');f.run('held.startedAt-=30001');f.requests[0].resolve(f.response);await p;assert.equal(f.run('refreshes'),1);assert.equal(f.run('cohortPage.events.length'),0);assert.equal(f.run('cohortPage.complete'),true);
});
