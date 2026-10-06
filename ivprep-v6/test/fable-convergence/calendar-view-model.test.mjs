import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {calendarProjection,readOwnCalendar,calendarHomeAction} from '../../public/studio-fable/app/adapters/calendar-view-model.mjs';
const future='2026-10-10T12:00:00Z';
const projection=()=>({schema:'ivoc.calendar-context.v1',eventCount:2,upcomingCount:1,nextEvent:{title:'Interview appointment',startsAt:future,
  provider:'webex',status:'scheduled',joinAvailable:true,joinUrl:'https://private.test/join',ownerEmail:'private@example.test'}});
function fixture(){
  let reads=0,boots=0;const controller={account:{mode:'REAL',subject:'wp:1',role:'admin',api:{bootstrap:async()=>{boots++;return {entitlement:{admitted:true},identity:{subject:'wp:1',admin:true}};}}},durable:{}};
  return {controller,counts:()=>({reads,boots}),options:{createCapability:()=>({studentCalendar:async()=>{reads++;return projection();}})}};
}
test('existing calendar projection is minimized without identities, raw fields or join URLs',()=>{
  const p=calendarProjection(projection());assert.equal(p.upcomingCount,1);assert.equal(p.nextEvent.joinAvailable,true);
  assert.equal(Object.hasOwn(p.nextEvent,'joinUrl'),false);assert.equal(Object.hasOwn(p.nextEvent,'ownerEmail'),false);
  for(const value of [{},null,{...projection(),upcomingCount:3},{...projection(),nextEvent:{title:'A',startsAt:'invalid'}},
    {...projection(),eventCount:25},{...projection(),eventCount:-1}])assert.equal(calendarProjection(value),null);
});
test('calendar reads reuse owner only after fresh admission and recheck the actor afterward',async()=>{
  const f=fixture(),result=await readOwnCalendar(f.controller,f.options);
  assert.equal(result.state,'ready');assert.deepEqual(f.counts(),{reads:1,boots:2});assert.equal(result.projection.nextEvent.joinUrl,undefined);
  const g=fixture();g.controller.account.api.bootstrap=async()=>({entitlement:{admitted:false},identity:{subject:'wp:1',admin:true}});
  assert.equal((await readOwnCalendar(g.controller,g.options)).state,'unavailable');assert.equal(g.counts().reads,0);
});
test('cookie identity changes during owner read cannot expose the intervening projection',async()=>{
  const f=fixture();let count=0;f.controller.account.api.bootstrap=async()=>({entitlement:{admitted:true},identity:{subject:++count===1?'wp:1':'wp:2',admin:true}});
  assert.deepEqual(await readOwnCalendar(f.controller,f.options),{state:'unavailable'});
});
test('route, actor, subject, role and Durable replacement discard a late owner calendar reply',async()=>{
  for(const changed of ['route','account','subject','role','durable']){
    const f=fixture();let resolve,current=true;
    const pending=readOwnCalendar(f.controller,{isCurrent:()=>current,createCapability:()=>({studentCalendar:()=>new Promise(r=>resolve=r)})});
    while(!resolve)await new Promise(r=>setImmediate(r));
    if(changed==='route')current=false;
    if(changed==='account')f.controller.account={subject:'wp:2'};
    if(changed==='subject')f.controller.account.subject='wp:2';
    if(changed==='role')f.controller.account.role='student';
    if(changed==='durable')f.controller.durable={};
    resolve(projection());assert.equal(await pending,null,changed);
  }
});
test('no events and owner denial are truthful states, never a fabricated appointment',async()=>{
  const f=fixture();const empty={schema:'ivoc.calendar-context.v1',eventCount:0,upcomingCount:0,nextEvent:null};
  assert.deepEqual(await readOwnCalendar(f.controller,{createCapability:()=>({studentCalendar:async()=>empty})}),{state:'ready',projection:empty});
  assert.deepEqual(await readOwnCalendar(f.controller,{createCapability:()=>({studentCalendar:async()=>{throw new Error('denied');}})}),{state:'unavailable'});
});
test('Home schedule action routes to verified program selection, never infers a program from appointment text',()=>{
  const p=calendarProjection(projection()),action=calendarHomeAction({state:'ready',projection:p},{now:Date.parse('2026-10-01T00:00:00Z')});
  assert.equal(action.href,'#/prepare');assert.match(action.body,/not a RISE program identity/);assert.equal(Object.hasOwn(action,'programId'),false);
  assert.equal(calendarHomeAction({state:'unavailable'}),null);
  assert.equal(calendarHomeAction({state:'ready',projection:p},{now:Date.parse('2026-10-11T00:00:00Z')}),null);
});
test('actual Home guards the whole render across account/subject/Durable/route changes after question read',async()=>{
  const source=readFileSync(new URL('../../public/studio-fable/app/main.mjs',import.meta.url),'utf8');
  const body=source.slice(source.indexOf('async function renderHome('),source.indexOf('// ---------- PRACTICE:'));
  for(const change of ['stable','account','subject','durable','route']){
    const account={subject:'wp:1',display:'Test'},durable={},controller={account,durable,library:async()=>({source:'account'})};let resolve,route=true,writes=0;
    const main={set innerHTML(value){writes++;},querySelector:()=>null},context={controller,main,guarded:()=>route,hydrateOwnPresentation:async()=>{},readOwnCalendar:async()=>({state:'unavailable'}),commandChips:()=>[],commandSurfaceMarkup:()=>'',mountCommandSurface(){},
      ownQuestions:()=>new Promise(r=>resolve=r),attemptsByRecency:()=>[],calendarHomeAction:()=>null,state:{program:null,mentorPriority:null},streak:()=>0,
      esc:value=>String(value),salutation:()=>'',fmtDate:()=>'',fmtDur:()=>'',masteryState:()=>({segments:0,state:'Unpracticed',reps:0})};
    const promise=vm.runInNewContext(body+';renderHome(guarded)',context);
    while(!resolve)await new Promise(r=>setImmediate(r));
    if(change==='account')controller.account={subject:'wp:2'};
    if(change==='subject')account.subject='wp:2';
    if(change==='durable')controller.durable={};
    if(change==='route')route=false;
    resolve({questions:[]});await promise;assert.equal(writes,change==='stable'?1:0,change);
  }
});
test('an optional Calendar request that never settles cannot hold Home or question loading',async()=>{
  const source=readFileSync(new URL('../../public/studio-fable/app/main.mjs',import.meta.url),'utf8');
  const body=source.slice(source.indexOf('async function renderHome('),source.indexOf('// ---------- PRACTICE:'));
  let writes=0,questionReads=0;
  const context={controller:{account:{subject:'wp:1',display:'Test'},durable:{},library:async()=>({source:'account'})},
    main:{set innerHTML(value){writes++;},querySelector:()=>null},guarded:()=>true,hydrateOwnPresentation:async()=>{},readOwnCalendar:()=>new Promise(()=>{}),commandChips:()=>[],commandSurfaceMarkup:()=>'',mountCommandSurface(){},
    ownQuestions:async()=>{questionReads++;return {questions:[]};},attemptsByRecency:()=>[],state:{program:null,mentorPriority:null},streak:()=>0,
    esc:value=>String(value),salutation:()=>'',fmtDate:()=>'',fmtDur:()=>'',masteryState:()=>({segments:0,state:'Unpracticed',reps:0})};
  await vm.runInNewContext(body+';renderHome(guarded)',context);assert.equal(writes,1);assert.equal(questionReads,1);
});
