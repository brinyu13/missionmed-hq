import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {JSDOM} from 'jsdom';
const root=new URL('../../public/',import.meta.url);
const html=fs.readFileSync(new URL('index.html',root),'utf8').replace(/<script[^>]*>[\s\S]*?<\/script>/g,'');
const source=fs.readFileSync(new URL('app.js',root),'utf8').replace('void boot();','');
async function fixture(role='student'){
 const dom=new JSDOM(html,{url:'https://fixture.test/',runScripts:'outside-only',pretendToBeVisual:true}),w=dom.window;
 w.matchMedia=()=>({matches:false});w.HTMLElement.prototype.scrollTo=()=>{};w.Headers=Headers;w.fetch=()=>assert.fail('Modal presentation must not fetch');
 vm.runInContext(source,dom.getInternalVMContext());const run=s=>w.eval(s);
 run(`applyBootstrap({actor:{id:'me',role:${JSON.stringify(role)},tier:${JSON.stringify(role==='admin'?'admin':'360')},zone:'UTC'},capabilities:{coreOnly:true,intakeV2:true,calendarV2:true,adminLogistics:${role==='admin'}},catalog:{},version:1,state:{interviews:[],policy:{audit:[]},contrib:{}}});session={actor:{...actor},expiresAt:Date.now()+60000};S.ui.route='calendar';S.ui.cal.ym='2026-11';S.ui.calendarScope='all';const range=calendarMonthRange();cohortPage={events:[],complete:true,...range,binding:cohortBinding(range),completedAt:Date.now()};`);
 const settle=()=>new Promise(resolve=>w.setTimeout(resolve,0));
 return {w,run,settle,close(){run('clearCalendarMemory();clearIntakeMemory();');dom.window.close();}};
}
test('own details retain exact supplied fields and expose only the existing private-file list action',async()=>{
 const h=await fixture();try{
  h.run(`S.interviews=[{id:'own',owner:'me',programName:'Synthetic exact program',unresolved_input:'Synthetic exact program',track:'Categorical',date:'2026-11-09',zone:'UTC',format:'unknown',state:'offered',saved:true,related:[],history:[]}];render();openDrawer({kind:'item',item:calendarVisibleItems()[0].id});`);await h.settle();
  const dialog=h.w.document.querySelector('[role="dialog"]');assert.ok(dialog.classList.contains('calendarDetailsModal'));assert.equal(dialog.getAttribute('aria-modal'),'true');assert.match(dialog.textContent,/Synthetic exact program/);assert.match(dialog.textContent,/time not set/);assert.match(dialog.textContent,/Duration unknown/);
  const link=dialog.querySelector('[data-act="itinerary-open"]');assert.equal(link.dataset.id,'own');assert.match(link.textContent,/private itinerary files/i);assert.equal(dialog.querySelector('[data-act="itinerary-download"]'),null);assert.doesNotMatch(dialog.textContent,/View Full Itinerary|Print/);
 }finally{h.close();}
});
test('cohort details stay deidentified and never expose owner joining text or private-file actions',async()=>{
 const h=await fixture();try{
  h.run(`S.interviews=[{id:'private',owner:'me',joining:'PRIVATE_JOIN_SENTINEL',notes:'PRIVATE_NOTE_SENTINEL',related:[]}];cohortPage.events=[{event_ref:'peer',program_name:'Synthetic peer program',specialty:'Medicine',track:'Categorical',local_date:'2026-11-10',event_type:'INTERVIEW',lifecycle:'scheduled'}];openDrawer({kind:'cohort-event',ref:'peer'});`);await h.settle();
  const dialog=h.w.document.querySelector('.calendarDetailsModal');assert.ok(dialog);assert.match(dialog.textContent,/Synthetic peer program/);assert.doesNotMatch(dialog.textContent,/PRIVATE_JOIN_SENTINEL|PRIVATE_NOTE_SENTINEL/);assert.equal(dialog.querySelector('[data-act="itinerary-open"]'),null);
 }finally{h.close();}
});
test('administrator calendar summary preserves logistics-only boundary and existing read-only action',async()=>{
 const h=await fixture('admin');try{
  h.run(`calendarVisibleItems=()=>[{id:'admin-known',title:'Synthetic mapped program',student:'Synthetic student',key:'2026-11-09',time:'09:00',specialty:'Medicine',sub:'Scheduled'}];openDrawer({kind:'calendar-logistics',item:'admin-known'});`);await h.settle();
  const dialog=h.w.document.querySelector('.calendarDetailsModal');assert.ok(dialog);assert.match(dialog.textContent,/read-only student schedule/i);assert.equal(dialog.querySelector('[data-act="itinerary-open"]'),null);assert.equal(dialog.querySelector('[data-act="cancel"]'),null);
 }finally{h.close();}
});
test('keyboard focus stays in details; Escape returns to the invoking control without changing records',async()=>{
 const h=await fixture();try{
  h.run(`S.interviews=[{id:'own',owner:'me',programName:'Synthetic program',date:'2026-11-09',zone:'UTC',state:'scheduled',saved:true,related:[],history:[]}];render();`);
  const trigger=h.w.document.createElement('button');trigger.textContent='Synthetic opener';h.w.document.body.append(trigger);trigger.focus();const original=h.run('JSON.stringify(S.interviews)');h.run(`openDrawer({kind:'item',item:calendarVisibleItems()[0].id});`);await h.settle();
  const dialog=h.w.document.querySelector('.calendarDetailsModal'),buttons=[...dialog.querySelectorAll('button:not(:disabled),a[href],input:not(:disabled),textarea:not(:disabled),select:not(:disabled),[tabindex="0"]')];buttons.at(-1).focus();h.w.document.dispatchEvent(new h.w.KeyboardEvent('keydown',{key:'Tab',bubbles:true,cancelable:true}));assert.equal(h.w.document.activeElement,buttons[0]);
  h.w.document.dispatchEvent(new h.w.KeyboardEvent('keydown',{key:'Tab',shiftKey:true,bubbles:true,cancelable:true}));assert.equal(h.w.document.activeElement,buttons.at(-1));h.w.document.dispatchEvent(new h.w.KeyboardEvent('keydown',{key:'Escape',bubbles:true,cancelable:true}));assert.equal(h.w.document.querySelector('[role="dialog"]'),null);assert.equal(h.w.document.activeElement,trigger);assert.equal(h.run('JSON.stringify(S.interviews)'),original);
 }finally{h.close();}
});
test('day and Add Interview drawers retain their existing presentation and entered draft',async()=>{
 const h=await fixture();try{
  h.run(`openDrawer({kind:'day',day:'2026-11-09'});`);await h.settle();assert.equal(h.w.document.querySelector('.calendarDetailsModal'),null);
  h.run(`openIntake();intakeFlow.identity.invitationLabel='Retained synthetic invitation';renderDrawer();`);await h.settle();assert.ok(h.w.document.querySelector('.intakeModal'));assert.equal(h.w.document.querySelector('.calendarDetailsModal'),null);assert.equal(h.run('intakeFlow.identity.invitationLabel'),'Retained synthetic invitation');
 }finally{h.close();}
});
