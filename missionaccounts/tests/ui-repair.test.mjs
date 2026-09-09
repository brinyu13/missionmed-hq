import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
const html=await readFile(new URL('../public/index.production.html', import.meta.url),'utf8');
const runtime=await readFile(new URL('../public/missionaccounts-runtime.js', import.meta.url),'utf8');
function fn(name, source=html){ const start=source.indexOf(`function ${name}(`); assert.ok(start>=0); const end=source.indexOf('\nfunction ',start+10); return source.slice(start,end<0?undefined:end).split('\nwindow.')[0].split('\n/*')[0]; }

test('the four original navigation controls keep exact working deep links and render destinations',()=>{
 const r=html.match(/function route\(\)\{[^\n]+/)[0];
 for(const [hash,parts,q] of [
  ['#/cycle/june#attention',['cycle','june'],{}],
  ['#/billing?cycle=all#rule',['billing'],{cycle:'all'}],
  ['#/advanced/controls',['advanced','controls'],{}],
  ['#/advanced/sessions',['advanced','sessions'],{}],
 ]){
  assert.ok(html.includes(hash) || (hash==='#/cycle/june#attention' && html.includes('data-go="#/cycle/${k}${focus.questions>0?') && html.includes('Start with the questions')),hash+' original visible control must remain');
  const got=vm.runInNewContext(r+';route()', {location:{hash},URLSearchParams});
  assert.deepEqual(JSON.parse(JSON.stringify(got.parts)),parts);
  assert.deepEqual(JSON.parse(JSON.stringify(got.q)),q);
 }
 const context={D:{meta:{controls:{sessions:2,humans:1,events:2,clusters:0}},sessions:[]},CY:[],esc:String};
 const result=vm.runInNewContext(fn('missionAccountsEvidenceTabs')+'\n'+fn('missionAccountsDataControls')+'\n'+fn('missionAccountsSourceReview')+'\n'+fn('missionAccountsClasses')+';[missionAccountsDataControls(),missionAccountsClasses()]',context);
 assert.match(result[0],/Data controls\./);assert.match(result[0],/Canonical classes/);
 assert.match(result[1],/Classes\./);assert.match(result[1],/No canonical classes/);
 assert.doesNotMatch(result.join(''),/review_meeting|undefined|NaN/);
});

test('student deep links and back navigation cannot select an administrative renderer',()=>{
 const prefix=html.slice(html.indexOf('function render(){'),html.indexOf("  if(top==='mr') WS.ctx"));
 for(const hash of ['#/student/8','#/advanced/controls','#/cycle/june#attention','#/billing?cycle=all#rule']){
  const location={hash,pathname:'/missionaccounts/',search:''};const WS={lens:'admin',ctx:'mr'};
  const context={location,WS,URLSearchParams,document:{documentElement:{dataset:{}}},window:{MissionAccountsRuntime:{state:{user:{role:'student'}}}},history:{replaceState:(_a,_b,u)=>{location.hash=u.slice(u.indexOf('#'));}}};
  const result=vm.runInNewContext(html.match(/function route\(\)\{[^\n]+/)[0]+'\n'+prefix+'return {top,r};};render()',context);
  assert.equal(result.top,'me');assert.equal(WS.lens,'student');assert.equal(WS.ctx,'xp');
 }
});

function handler(start, end){const a=html.indexOf(start);assert.ok(a>=0,start);const b=html.indexOf(end,a+start.length);assert.ok(b>a,end);return html.slice(a+start.length,b);}
for(const item of [
 {name:'comp',code:()=>handler("$('#cGo').onclick=", "; $('#cNo')"), action:'setComp'},
 {name:'exam submit',code:()=>handler("$('#exGo').onclick=", "; $('#exNo')"),action:'submitExam'},
 {name:'passed',code:()=>handler("$('#psYes').onclick=", "; $('#psNo')"),action:'markPassed'},
 {name:'custom billing',code:()=>handler("$('#oSave').onclick=", "; $('#oCancel')"),action:'decide'},
 ]){
 test(`${item.name} dialog waits for acceptance and stays open after rejection`,async()=>{
  for(const accepted of [false,true]){
   const called=[];let resolveSave;
   const context={e:{i:0},si:0,k:'june',step:'s1',student:true,chosen:'other',
    $:()=>({value:'2026-10-10',checked:false,focus(){}}),
    closeSheet:()=>called.push('close'),render:()=>called.push('render'),toast:()=>called.push('toast'),
    [item.action]:()=>new Promise(resolve=>{called.push('request');resolveSave=resolve;})};
   const save=vm.runInNewContext('('+item.code()+')',context)();
   assert.deepEqual(called,['request']);resolveSave(accepted);await save;
   assert.equal(called.includes('close'),accepted);assert.equal(called.includes('render'),accepted);
   if(!accepted) assert.equal(called.includes('toast'),false);
  }
 });
}

test('current exam target excludes superseded and withdrawn plans after replacement',()=>{
 const current=vm.runInNewContext('('+fn('currentExamPlan',runtime)+')');
 const plans=[{id:'old',student_id:'a',submitted_at:'2026-01-01',superseded_by_id:'new'}, {id:'new',student_id:'a',submitted_at:'2026-02-01'}, {id:'withdrawn',student_id:'a',submitted_at:'2026-03-01',withdrawn_at:'2026-03-02'}, {id:'other',student_id:'b',submitted_at:'2026-04-01'}];
 assert.equal(current(plans,'a').id,'new');
});

test('refresh keeps a student UUID selected across roster reorder and removes unavailable deep links',()=>{
 const remap=vm.runInNewContext('('+fn('remapStudentRoute',runtime).split('\nasync function ')[0]+')');
 assert.equal(remap('#/student/0?cycle=june#notes',{0:'a',1:'b'},{0:'b',1:'a'}),'#/student/1?cycle=june#notes');
 assert.equal(remap('#/student/1/billing',{0:'a',1:'b'},{0:'a'}),'#/roster');
 assert.equal(remap('#/student/900',{0:'a'},{0:'b'}),'#/roster');
 assert.equal(remap('#/cycle/june',{0:'a'},{0:'b'}),'#/cycle/june');
});

test('combined rename/contact follows immutable student identity after alphabetical reorder',async()=>{
 const marker="const nm=$('#eName').value.trim();";
 const from=html.indexOf(marker);assert.ok(from>0);
 const to=html.indexOf('closeSheet();',from);assert.ok(to>from);
 const code=html.slice(from,to);const calls=[];
 let ids={0:'original',1:'other'};
 const values={'#eName':'Zed','#eWhy':'Correct name','#eEmail':'new@example.invalid','#ePhone':'5551234567'};
 const ctx={e:{i:0,n:'Alpha'},$:(selector)=>({value:values[selector]}),
  window:{MissionAccountsRuntime:{getCanonicalModel:()=>({ids:{students:ids}})}},
  toast:msg=>calls.push(['toast',msg]),validEmail:()=>true,
  addCorr:async(si)=>{calls.push(['name',ids[si]]);ids={0:'other',1:'original'};return true;},
  setContact:async(si,email,phone)=>{calls.push(['contact',ids[si],email,phone]);return true;}};
 await vm.runInNewContext('(async()=>{'+code+'})()',ctx);
 assert.deepEqual(calls,[['name','original'],['contact','original','new@example.invalid','5551234567']]);
});

test('identity canonical selection waits and preserves selection sheet on rejected merge',async()=>{
 const start="button.onclick=async()=>{ if(await decideIdent(cl,'same',Number(button.dataset.identityCanonical))===false)return; closeSheet(); render(); }";
 assert.ok(html.includes(start));
 const called=[];let resolve;
 const save=vm.runInNewContext('('+start.slice(start.indexOf('async'))+')',{
  cl:{id:'cluster'},button:{dataset:{identityCanonical:'1'}},
  decideIdent:()=>new Promise(r=>{resolve=r;}),closeSheet:()=>called.push('close'),render:()=>called.push('render')
 })();
 assert.deepEqual(called,[]);resolve(false);await save;assert.deepEqual(called,[]);
});

test('manual charge confirmation names the student, cycle, exact amount, masked card, real charge, and both choices',()=>{
 assert.match(html,/function missionAccountsManualChargeSheet\(si,k\)/);
 assert.match(html,/Confirm real charge/);
 assert.match(html,/This action creates a real LIVE Stripe charge/);
 assert.match(html,/Student<\/span><span class="v">/);
 assert.match(html,/Cycle<\/span><span class="v">/);
 assert.match(html,/Amount<\/span><span class="v money">/);
 assert.match(html,/Payment method<\/span><span class="v">/);
 assert.match(html,/Confirm charge/);
 assert.match(html,/>Cancel<\/button>/);
 assert.match(html,/dispatch\('manual-cycle-charge'/);
 assert.match(html,/data-manual-charge/);
});

test('batch partial receipt never navigates a missing record to a different student',()=>{
 let sheet='';
 vm.runInNewContext(fn('missionAccountsBatchOutcome')+`;missionAccountsBatchOutcome({approved_count:0,rejected_count:1,results:[{student_id:'gone',accepted:false,reason:'student_not_found'}]},'june')`,{
  D:{students:[{n:'Someone else'}]},window:{MissionAccountsRuntime:{getCanonicalModel:()=>({ids:{students:{0:'other'}}})}},esc:String,
  openSheet:value=>{sheet=value;}
 });
 assert.match(sheet,/Record unavailable/);assert.match(sheet,/student not found/);
 assert.doesNotMatch(sheet,/#\/student\/(?:NaN|0)|Someone else/);
});
