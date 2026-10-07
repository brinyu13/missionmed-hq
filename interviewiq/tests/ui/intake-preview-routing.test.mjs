import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {JSDOM} from 'jsdom';
const root=new URL('../../public/',import.meta.url);
const html=fs.readFileSync(new URL('index.html',root),'utf8').replace(/<script[^>]*>[\s\S]*?<\/script>/g,'');
const source=fs.readFileSync(new URL('app.js',root),'utf8').replace('void boot();','');
function app(role,tier,preview){
 const dom=new JSDOM(html,{url:'https://missionmedinstitute.com/interviewiq/',runScripts:'outside-only',pretendToBeVisual:true});
 const w=dom.window;w.matchMedia=()=>({matches:false});w.HTMLElement.prototype.scrollTo=()=>{};w.Headers=Headers;
 let requests=0;w.fetch=()=>{requests++;throw Error('Unexpected request');};
 vm.runInContext(source,dom.getInternalVMContext());
 w.eval(`applyBootstrap({actor:{id:'owner',role:${JSON.stringify(role)},tier:${JSON.stringify(tier)},zone:'UTC'},capabilities:{coreOnly:true,intakeV2:true},catalog:{},state:{interviews:[],reviewQueue:[],changes:[],policy:{audit:[]},contrib:{submissions:[],ledger:[]}}});render();`);
 return {dom,w,requests:()=>requests};
}
for(const tier of ['360','ivprep_complete'])test(tier+' all Add Interview surfaces open centered V2',()=>{
 const a=app('student',tier);
 for(const route of ['home','calendar','interviews']){
  a.w.eval(`go('${route}')`);
  const buttons=[...a.w.document.querySelectorAll('[data-act="add-interview"],[data-act="new-offer"]')];assert.ok(buttons.length);
  for(const b of buttons){a.w.eval(`A['${b.dataset.act}']({dataset:{}})`);assert.ok(a.w.document.querySelector('.intakeModal'));a.w.eval('closeDrawer()');}
 }
 a.w.eval("clearIntakeMemory();A['cal-day']({dataset:{day:'2026-11-03'}})");
 assert.ok(a.w.document.querySelector('[data-act="add-interview"]'));
 a.w.eval("A['add-interview']({dataset:{day:'2026-11-03'}})");assert.equal(a.w.eval('intakeFlow.schedule.date'),'2026-11-03');assert.ok(a.w.document.querySelector('.intakeModal'));
 assert.equal(a.requests(),0);a.dom.window.close();
});
test('admin preview navigates wizard but cannot search, save or call any API',async()=>{
 const a=app('admin','admin');await a.w.eval("switchAdministratorView('student')");a.w.eval("A['add-interview']({dataset:{}})");
 assert.ok(a.w.document.querySelector('.intakeModal'));assert.match(a.w.document.querySelector('.intakeWizard').textContent,/STUDENT PREVIEW/);
 a.w.eval("intakeSet('identity.invitationLabel','Preview only');A['intake-next']();A['intake-cal-pick']({dataset:{field:'schedule.date',date:'2026-11-03'}})");
 assert.equal(a.w.eval('intakeFlow.schedule.date'),'2026-11-03');
 await assert.rejects(a.w.eval('saveIntake()'),/does not save/);
 await assert.rejects(a.w.eval("apiFetch('/programs?q=test')"),/does not save/);
 await assert.rejects(a.w.eval("command('intake.create',null,{})"),/does not save/);
 assert.equal(a.requests(),0);assert.equal(a.w.eval('S.interviews.length'),0);
 await a.w.eval("switchAdministratorView('admin')");assert.equal(a.w.eval('intakeFlow'),null);assert.equal(a.w.eval('actor.role'),'admin');a.dom.window.close();
});
