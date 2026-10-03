import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {JSDOM} from 'jsdom';
const publicRoot=new URL('../../public/',import.meta.url);
const html=fs.readFileSync(new URL('index.html',publicRoot),'utf8').replace(/<script[^>]*>[\s\S]*?<\/script>/g,'');
const source=fs.readFileSync(new URL('app.js',publicRoot),'utf8').replace('void boot();','');
function app(role='admin'){
 const dom=new JSDOM(html,{url:'https://missionmedinstitute.com/interviewiq/',runScripts:'outside-only',pretendToBeVisual:true});
 const w=dom.window;w.matchMedia=()=>({matches:false});w.HTMLElement.prototype.scrollTo=()=>{};
 let requests=0;w.fetch=()=>{requests++;throw Error('Unexpected remote request');};w.Headers=Headers;
 vm.runInContext(source,dom.getInternalVMContext());w.eval(`applyBootstrap({actor:{id:'owner-identity',role:'${role}',displayName:'Test account',tier:'${role==='student'?'360':'admin'}',zone:'America/New_York'},capabilities:{coreOnly:true},catalog:{profiles:[{id:'private-person',displayName:'Do not expose'}]},state:{interviews:[{id:'private-interview',owner:'private-person',saved:true,zone:'UTC'}],reviewQueue:[{id:'private-review',excerpt:'PRIVATE CONTENT'}],changes:[],policy:{audit:[]},contrib:{submissions:[],ledger:[]}}});render();`);
 return {w,dom,requests:()=>requests};
}
test('administrator preview retains signed identity, isolates every state collection and restores admin workspace',async()=>{
 const a=app();const before=a.w.eval('S');a.w.eval("draftValues.set('admin-draft','my unsaved admin work')");assert.match(a.w.document.getElementById('hdr').textContent,/ADMIN VIEW/);
 await a.w.eval("switchAdministratorView('student')");
 assert.equal(a.w.eval('actor.role'),'admin');assert.equal(a.w.eval('actor.id'),'owner-identity');
 assert.equal(a.w.eval('roleName()'),'student');assert.equal(a.w.eval('S.interviews.length'),0);
 assert.equal(a.w.eval('draftValues.size'),0);
 assert.equal(a.w.eval('S.reviewQueue.length'),0);assert.equal(a.w.eval('F.personas.length'),1);
 for(const name of ['Home','Calendar','Interviews','Prepare','Program Intelligence','Debriefs','Growth','Settings'])assert.ok([...a.w.document.querySelectorAll('#rail button')].some(b=>b.getAttribute('aria-label')===name),name);
 assert.match(a.w.document.getElementById('advBanner').textContent,/No student data loaded/);
 a.w.eval("go('calendar')");assert.match(a.w.document.getElementById('main').textContent,/Interview Calendar/i);
 a.w.eval("A['add-interview']({dataset:{day:'2026-10-07'}})");assert.equal(a.w.document.getElementById('ad-date').value,'2026-10-07');
 await a.w.eval("dispatchAction(document.querySelector('[data-act=add-interview-save]'))");
 assert.match(a.w.document.getElementById('toast').textContent,/does not save/);assert.equal(a.requests(),0);
 await assert.rejects(a.w.eval("command('interview.create',null,{})"),/does not save/);
 await assert.rejects(a.w.eval("apiFetch('/bootstrap')"),/does not save/);
 await a.w.eval("switchAdministratorView('admin')");assert.equal(a.w.eval('S'),before);assert.equal(a.w.eval('actor.role'),'admin');
 assert.equal(a.w.eval('studentPreview()'),false);assert.equal(a.w.eval('S.reviewQueue.length'),1);assert.equal(a.w.eval("draftValues.get('admin-draft')"),'my unsaved admin work');a.dom.window.close();
});
test('students never receive administrator view controls or permission to switch',async()=>{
 const a=app('student');assert.equal(a.w.document.querySelector('.administratorViewSwitch'),null);
 await assert.rejects(a.w.eval("switchAdministratorView('student')"),/Only administrators/);
 assert.equal(a.w.eval('actor.role'),'student');a.dom.window.close();
});
function opening({reduced=false,storageFails=false}={}){
 const a=app('student');const timers=new Map();let clock=0,next=0;
 a.w.matchMedia=()=>({matches:reduced});a.w.setTimeout=(fn,ms)=>{timers.set(++next,{fn,at:clock+ms});return next;};a.w.clearTimeout=id=>timers.delete(id);
 if(storageFails)Object.defineProperty(a.w,'sessionStorage',{get(){throw Error('No storage');}});
 const tick=target=>{while(true){const due=[...timers].filter(([,t])=>t.at<=target).sort((a,b)=>a[1].at-b[1].at)[0];if(!due)break;clock=due[1].at;timers.delete(due[0]);due[1].fn();}clock=target;};
 a.w.eval('showOpening()');return {...a,tick,timers,node:a.w.document.getElementById('interviewiqOpening')};
}
test('animated entrance lasts 5000ms with final650ms fade and bounded inert cleanup',()=>{
 const a=opening();assert.equal(a.node.hidden,false);assert.equal(a.node.dataset.motion,'full');assert.equal(a.w.document.getElementById('main').inert,true);
 a.tick(4349);assert.equal(a.node.dataset.phase,'forming');a.tick(4350);assert.equal(a.node.dataset.phase,'leaving');a.tick(4999);assert.equal(a.node.hidden,false);a.tick(5000);assert.equal(a.node.hidden,true);assert.notEqual(a.w.document.getElementById('main').inert,true);assert.equal(a.timers.size,0);a.dom.window.close();
});
test('Skip immediately exits and cancels timers; internal routes never replay',()=>{
 const a=opening();a.node.querySelector('[data-skip-opening]').click();assert.equal(a.node.hidden,true);assert.equal(a.timers.size,0);
 for(const route of ['home','calendar','interviews']){a.w.eval(`go('${route}');showOpening()`);assert.equal(a.node.hidden,true);}
 assert.equal(a.requests(),0);a.dom.window.close();
});
test('reduced motion uses short fade, never staged movement',()=>{
 const a=opening({reduced:true});assert.equal(a.node.dataset.motion,'reduced');a.tick(750);assert.equal(a.node.dataset.phase,'leaving');a.tick(1000);assert.equal(a.node.hidden,true);a.dom.window.close();
});
test('Skip during the final fade still immediately restores shell interaction',()=>{
 const a=opening();a.tick(4500);a.node.querySelector('[data-skip-opening]').click();assert.equal(a.node.hidden,true);assert.notEqual(a.w.document.getElementById('main').inert,true);assert.equal(a.timers.size,0);a.dom.window.close();
});
test('blocked session storage still does not replay within entry',()=>{
 const a=opening({storageFails:true});a.tick(5000);a.w.eval('showOpening()');assert.equal(a.node.hidden,true);assert.equal(a.timers.size,0);a.dom.window.close();
});
