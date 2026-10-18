import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const runtime=readFileSync(new URL('../../public/source/runtime.js',import.meta.url),'utf8');
const code=runtime.slice(runtime.indexOf('async function boot(){'),runtime.indexOf('const MRX_COMMANDS'));
test('fresh admitted bootstrap precedes cohort; optional details and adjacent prefetch wait for visible cohort',async()=>{
 for(const change of ['',"actor.id='other'",'sessionEpoch++','bootSequence++']){
 const calls=[];let finish;const pending=new Promise(resolve=>finish=resolve);
 const c=vm.createContext({Promise,S:null,dateKeyInZone:()=> '2026-10-18',now:()=>new Date(),session:{expiresAt:Date.now()+60000},document:{getElementById:()=>({innerHTML:''}),querySelector:()=>null},location:{search:''},actor:{id:'own'},sessionEpoch:0,bootSequence:0,parseInterviewIQEntry:()=>null,renderPublicCalendarShell:()=>'<div>Public dates</div>',calendarRangeForMonth:()=>({start:'2026-09-26',end:'2026-11-08'}),calendarBootstrapSeed:()=>null,fitCalendarViewport:()=>{},apiFetch:async path=>{calls.push(path);return{};},applyBootstrap:()=>calls.push('admitted'),applyInterviewIQEntry:()=>calls.push('entry'),render:()=>{},completeWorkspace:async()=>calls.push('details'),scheduleCalendarPrefetch:()=>calls.push('adjacent'),warmCalendar:()=>{calls.push('cohort');return pending;},lockWorkspace:message=>{throw Error(message);}});
 vm.runInContext(code,c);await vm.runInContext('boot()',c);assert.deepEqual(calls,['/bootstrap?view=calendar&start=2026-09-26&end=2026-11-08','admitted','cohort','entry']);if(change)vm.runInContext(change,c);finish();await Promise.resolve();await Promise.resolve();assert.equal(calls.includes('details'),!change);assert.equal(calls.includes('adjacent'),!change);
 }
});

test('retained month and signed zone determine bundle range, and only typed compatibility failures use legacy bootstrap',async()=>{
 for(const failure of [{status:503,code:'calendar_unavailable'},{status:400,code:'invalid_query'},{status:403,code:'access_denied'}]){
  const calls=[],months=[];let locked=false;
  const c=vm.createContext({Promise,S:{ui:{cal:{ym:'2026-11'}}},dateKeyInZone:()=> '2026-09-30',now:()=>new Date(),session:{expiresAt:Date.now()+60000,actor:{zone:'America/New_York'}},document:{getElementById:()=>({innerHTML:''}),querySelector:()=>null},location:{search:''},actor:{id:'own'},sessionEpoch:0,bootSequence:0,parseInterviewIQEntry:()=>null,renderPublicCalendarShell:()=>'',calendarRangeForMonth:ym=>{months.push(ym);return{start:'2026-11-01',end:'2026-11-30'};},calendarBootstrapSeed:()=>null,fitCalendarViewport:()=>{},apiFetch:async path=>{calls.push(path);if(calls.length===1)throw Object.assign(Error('Synthetic'),failure);return{};},applyBootstrap:()=>{},applyInterviewIQEntry:()=>{},render:()=>{},completeWorkspace:async()=>{},scheduleCalendarPrefetch:()=>{},warmCalendar:async()=>{},lockWorkspace:()=>{locked=true;}});
  vm.runInContext(code,c);await vm.runInContext('boot()',c);assert.equal(months[0],'2026-11');assert.equal(locked,failure.status===403);assert.deepEqual(calls.slice(1),failure.status===403?[]:[failure.status===503?'/bootstrap':'/bootstrap?view=calendar']);
  calls.length=months.length=0;vm.runInContext('S=null',c);await vm.runInContext('boot()',c);assert.equal(months[0],'2026-09');
 }
});
test('actual coreOnly apiFetch admits exact bounded bootstrap only and retains authorization headers',async()=>{
 const code=runtime.slice(runtime.indexOf('function calendarBootstrapPath('),runtime.indexOf('let loiAuthorityEpoch'));
 let calls=0,blocked=0;
 const c=vm.createContext({Date,Number,Headers,Error,JSON,sessionEpoch:1,session:{expiresAt:Date.now()+60000,token:'synthetic',nonce:'synthetic',apiBase:'/interviewiq/api'},studentPreview:()=>false,coreOnly:()=>true,calendarV2:()=>true,deepResearch:()=>false,loiCanonicalLookup:()=>false,intakeEnabled:()=>false,mrxUI:()=>false,coreCommand:()=>false,openComingSoon:()=>blocked++,fetch:async(url,options)=>{calls++;assert.equal(options.cache,'no-store');assert.equal(options.headers.get('authorization'),'Bearer synthetic');return{status:200};},readJSON:async()=>({ok:true})});vm.runInContext(code,c);
 assert.equal((await vm.runInContext("apiFetch('/bootstrap?view=calendar&start=2026-10-01&end=2026-10-31')",c)).ok,true);
 for(const q of ['view=calendar&start=2026-02-30&end=2026-03-31','view=calendar&start=2026-10-01&end=2027-10-31','view=calendar&start=2026-10-01&end=2026-10-31&owner=other'])await assert.rejects(vm.runInContext('apiFetch('+JSON.stringify('/bootstrap?'+q)+')',c),/COMING SOON/);
 assert.equal(calls,1);assert.equal(blocked,3);
});
