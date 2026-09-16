import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
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
  const context={ACCOUNT_ACCESS_MODE:false,location,WS,URLSearchParams,document:{documentElement:{dataset:{}}},window:{MissionAccountsRuntime:{state:{user:{role:'student'}}}},history:{replaceState:(_a,_b,u)=>{location.hash=u.slice(u.indexOf('#'));}}};
  const result=vm.runInNewContext(html.match(/function route\(\)\{[^\n]+/)[0]+'\n'+prefix+'return {top,r};};render()',context);
  assert.equal(result.top,'me');assert.equal(WS.lens,'student');assert.equal(WS.ctx,'xp');
 }
});

test('student billing uses persisted manual-charge finality',()=>{
 const status=vm.runInNewContext('('+fn('studentCycleStatus')+')',{
  WS:{manualCharges:{0:{june:{state:'succeeded',amount:1}}}},
  money:value=>'$'+value,
  accountState:()=>({state:'approved',amount:1}),
 });
 assert.deepEqual(JSON.parse(JSON.stringify(status({i:0},'june'))),{chip:'paid',text:'Paid · $1',state:'paid',amount:1});
 assert.match(fn('viewMe'),/Stripe confirmed/);
 assert.match(fn('viewMe'),/nothing is charged automatically/i);
 assert.doesNotMatch(fn('viewMe'),/Pay online once the invoice arrives by email/);
});

test('automatic-billing consent is independent from dispatch and requires exact approved terms',()=>{
 assert.match(runtime,/['"]billing-authorization['"]:\s*['"]auto_billing_consent['"]/);
 assert.match(runtime,/['"]billing-authorization-revoke['"]:\s*['"]auto_billing_consent['"]/);
 assert.match(runtime,/terms\.status !== 'approved' \|\| !String\(terms\.body_text \|\| ''\)\.trim\(\)/);
 assert.match(runtime,/intro: terms\.body_text/);
 assert.match(html,/Automatic billing remains disabled while the exact billing terms await Founder approval/);
 assert.match(html,/data-auth-off/);
 assert.match(html,/fresh ExamPrep enrollment/);
 assert.match(html,/Eligible attendance is generally processed within 24–48 hours/);
 assert.match(html,/No individual approval is required for each charge after advance authorization is enabled/);
 assert.match(html,/one automatic retry/);
 assert.match(html,/no late-fee amount is encoded by this release/);
 assert.doesNotMatch(html,/held for at least 24 hours/);
 assert.match(html,/live dispatch off/);
 assert.match(html,/Sponsored exclusions[\s\S]+students · [^<]+rows/);
});

test('registered account landing provides enrollment-aware program states and responsive CTAs',()=>{
 assert.match(html,/MyMissionMed Account/);
 assert.match(html,/Mission Residency<\/button>/);
 assert.match(html,/ExamPrep<\/button>/);
 assert.match(html,/Looks like you're not enrolled yet\. Choose the program you want to explore\./);
 assert.match(html,/Explore Mission Residency/);
 assert.match(html,/Explore ExamPrep/);
 assert.match(html,/Explore Clinicals/);
 assert.match(html,/['"]\/mission-clinicals\/['"]/);
 assert.doesNotMatch(html,/['"]\/clinicals\/['"]/);
 assert.match(html,/Your Mission Residency account workspace is being prepared/);
 assert.match(html,/function hydrateAccountAccess\(access,user\)/);
 assert.match(html,/programDiscovery\(selected\)/);
 assert.match(html,/@media\(max-width:820px\)\{\.programCards\{grid-template-columns:1fr\}/);
 assert.match(html,/@media\(max-width:430px\)\{\.programTabs\{width:100%/);
 assert.match(html,/@media\(max-width:1100px\)\{\.programCards\{grid-template-columns:repeat\(2,minmax\(0,1fr\)\)\}/);
 assert.match(html,/\.programCard \.btn\{margin-top:auto;align-self:stretch;padding:12px 16px;font-size:13px;letter-spacing:\.08em;white-space:normal;text-align:center\}/);
 assert.match(html,/@media\(max-width:640px\)\{#hdr>\.programTabs\{order:3;width:100%/);
 assert.match(html,/@media\(max-width:1100px\) and \(min-width:641px\)\{:root\{--hdr:112px\}/);
 assert.match(html,/@media\(max-width:640px\)\{:root\{--hdr:176px\}#hdr>\.brand\{flex:1 0 100%\}/);
 assert.match(html,/#hdr>\.hActions\{order:2;width:100%;margin-left:0;justify-content:space-between/);
 assert.match(html,/@media\(max-width:430px\)\{#hdr>\.hActions\{display:grid;grid-template-columns:auto minmax\(0,1fr\)\}/);
 assert.match(html,/#hdr>\.hActions \.lens button\[data-lens="student"\]\{min-width:0;max-width:104px;overflow:hidden;text-overflow:ellipsis\}/);
 assert.match(html,/\.demo\[hidden\]\{display:none!important\}/);
 assert.match(html,/body\.opening-active #hdr,body\.opening-active #rail,body\.opening-active #main\{visibility:hidden\}/);
});

test('production opening is branded, animated, accessible, and bootstrap-bound',()=>{
 const embeddedLogo=html.match(/src="data:image\/png;base64,([^"]+)" alt="MissionMed Institute"/);
 assert.ok(embeddedLogo,'verified MissionMed logo must be embedded so the production package cannot omit it');
 const embeddedLogoBytes=Buffer.from(embeddedLogo[1],'base64');
 assert.equal(createHash('sha256').update(embeddedLogoBytes).digest('hex'),'f091d62ac5842cde0e9e455321839fd98b291598478aae6ce13b09ea3896ff56');
 assert.match(html,/class="introMissionMed">MissionMed<\/span><span class="introAccounts">Accounts<\/span>/);
 assert.match(html,/EVERY CLASS\. EVERY BALANCE\. YOUR MISSION, CLEARLY ACCOUNTED FOR\./);
 assert.match(html,/@keyframes introWordLeft/);
 assert.match(html,/@keyframes introWordRight/);
 assert.match(html,/@keyframes openingFieldDrift/);
 assert.match(html,/openingFieldDrift 18s ease-in-out infinite alternate/);
 assert.match(html,/@media\(max-width:520px\)\{\.storyforgeIntro[\s\S]+\.introProduct\{font-size:clamp\(30px,8\.7vw,43px\);gap:\.03em\}/);
 assert.match(html,/@media\(prefers-reduced-motion:reduce\)/);
 assert.match(html,/function revealAuthoritative\(\)\{ if\(!canRevealMissionAccountsShell\(\)\) return false; completeOpeningExperience\(\); return true; \}/);
 assert.match(html,/if\(!canRevealMissionAccountsShell\(\)\)\{ openingDone=false; return; \}/);
 assert.doesNotMatch(fn('showOpeningExperience'),/completeOpeningExperience\(\)/);
 assert.doesNotMatch(fn('showOpeningExperience'),/dismissOpeningExperience/);
 assert.match(fn('showOpeningExperience'),/openingSeenThisTab = sessionStorage\.getItem/);
 assert.match(fn('missionAccountsApplyCapabilityState'),/mutationsAvailable===false/);
 assert.match(fn('missionAccountsApplyCapabilityState'),/data-credential-disabled/);
 assert.match(html,/data-missionaccounts-runtime="unavailable"\] #missionaccountsRuntimeGate/);
});

test('stale credentials visibly disable every rendered mutation control and ready credentials restore them',()=>{
 const credentialReason='Connection is being restored. Editing will resume automatically when the secure session refreshes.';
 const makeControl=(disabled=false,dataset={})=>({disabled,title:'',dataset:{...dataset},removeAttribute(name){if(name==='title')this.title='';},setAttribute(){}});
 const records=[
  ['[data-onboarding-form] button[type="submit"]',makeControl()],
  ['[data-legacy-liability] button[type="submit"]',makeControl()],
  ['[data-legacy-manual] button[type="submit"]',makeControl()],
  ['[data-legacy-approve]',makeControl()],
  ['[data-ident]',makeControl()],
  ['#mcGo',makeControl()],
  ['#mConfirm',makeControl(true)],
  ['#exGo',makeControl(true)],
 ];
 const capabilityDisabled=makeControl(true,{capabilityDisabled:'true'});
 records.push(['[data-save-contact]',capabilityDisabled]);
 const controls=records.map(([,control])=>control);
 const root={querySelectorAll(selector){
  if(selector==='[data-credential-disabled="true"]') return controls.filter(control=>control.dataset.credentialDisabled==='true');
  return records.filter(([token])=>selector.includes(token)).map(([,control])=>control);
 }};
 const state={user:{role:'missionaccounts_admin'},authenticated:true,mutationsAvailable:false};
 const context={
  window:{MissionAccountsRuntime:{state}},document:{documentElement:{dataset:{missionaccountsBuild:'production'}},body:{}},
  missionAccountsCapability:()=>true,
  missionAccountsDisable(control,reason){control.disabled=true;control.title=reason;control.dataset.capabilityDisabled='true';},
  MISSION_ACCOUNTS_CREDENTIAL_REASON:credentialReason,
 };
 vm.runInNewContext('('+fn('missionAccountsApplyCapabilityState')+')(root)',{...context,root});
 for(const control of controls.filter(control=>control!==capabilityDisabled)){assert.equal(control.disabled,true);assert.equal(control.dataset.credentialDisabled,'true');assert.equal(control.title,credentialReason);}
 assert.equal(capabilityDisabled.disabled,true);assert.equal(capabilityDisabled.dataset.credentialDisabled,undefined);
 vm.runInNewContext('('+fn('missionAccountsSetMutationControlEnabled')+')(control,true)',{...context,control:capabilityDisabled,missionAccountsMutationsAvailable:()=>true});
 assert.equal(capabilityDisabled.disabled,true,'a dialog finally path cannot enable a capability-disabled mutation');
 const initiallyDisabled=records.find(([token])=>token==='#mConfirm')[1];
 vm.runInNewContext('('+fn('missionAccountsSetMutationControlEnabled')+')(control,true)',{...context,control:initiallyDisabled,missionAccountsMutationsAvailable:()=>false});
 assert.equal(initiallyDisabled.disabled,true);assert.equal(initiallyDisabled.dataset.credentialDesiredDisabled,'false');
 state.mutationsAvailable=true;
 vm.runInNewContext('('+fn('missionAccountsApplyCapabilityState')+')(root)',{...context,root});
 for(const [token,control] of records.filter(([,control])=>control!==capabilityDisabled)){assert.equal(control.disabled,token==='#exGo');assert.equal(control.dataset.credentialDisabled,undefined);assert.equal(control.title,'');}
 assert.equal(capabilityDisabled.disabled,true);assert.equal(capabilityDisabled.dataset.capabilityDisabled,'true');
});

test('onboarding UI recovers saves, keeps student role guards, and uses truthful copy',()=>{
 const theme=fn('setTheme');
 assert.match(theme,/missionAccountsApplyCapabilityState\(document\)/);
 assert.match(html,/html\[data-missionaccounts-role="student"\] \.demo\{display:none!important\}/);
 const bind=fn('bind');
 const noChange=bind.indexOf("if(!Object.keys(profile).length)");
 const disable=bind.indexOf("button.disabled=true");
 assert.ok(noChange>0&&disable>noChange);
 assert.match(bind,/finally\{[\s\S]*missionAccountsSetMutationControlEnabled\(button,true\); button\.textContent=prior/);
 assert.match(bind,/error\?\.status===400&&error\.field/);
 assert.match(bind,/setAttribute\('aria-invalid','true'\)/);
 assert.match(bind,/error\?\.status===409/);
 assert.match(bind,/label:'Reload'/);
 assert.match(fn('missionAccountsStatusBanner'),/state\?\.user\?\.role==='student'/);
 assert.match(fn('viewMeOnboarding'),/const actionable=\['profile','contact','exam_plan'/);
 assert.match(fn('viewMeOnboarding'),/Save changes/);
});

test('default US country persists with the first real onboarding edit but not an untouched form',()=>{
 const changes=vm.runInNewContext('('+fn('onboardingProfileChanges')+')');
 assert.deepEqual(JSON.parse(JSON.stringify(changes({mailing_country_code:'US'},{}))),{});
 assert.deepEqual(JSON.parse(JSON.stringify(changes({school_name:'Mission Medical School',mailing_country_code:'US'},{}))),{
  school_name:'Mission Medical School',mailing_country_code:'US'
 });
 assert.deepEqual(JSON.parse(JSON.stringify(changes({mailing_country_code:'NG'},{}))),{mailing_country_code:'NG'});
 assert.deepEqual(JSON.parse(JSON.stringify(changes({school_name:'Updated School',mailing_country_code:'US'},{school_name:'Original School',mailing_country_code:'US'}))),{school_name:'Updated School'});
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

function identityFixture(){ const D={students:[{id:'record-aaa',n:'Same Student'},{id:'record-bbb',n:'Same Student'}]}; const contactOf=si=>({0:{email:'one@example.invalid'},1:{email:'two@example.invalid'}})[si]; const identityAccountEvidence=vm.runInNewContext('('+fn('identityAccountEvidence')+')',{D,contactOf,esc:String}); return {D,contactOf,identityAccountEvidence}; }

function identityChoiceHarness(accepted){
 const calls=[];
 const options=[0,1].map(si=>({dataset:{identityCanonical:String(si)},pressed:false,setAttribute(name,value){if(name==='aria-pressed')this.pressed=value==='true';}}));
 const confirm={disabled:true,textContent:'Confirm same student'},cancel={disabled:false};
 const w={querySelectorAll:selector=>selector==='[data-identity-canonical]'?options:[],querySelector:selector=>({'#identityCanonicalConfirm':confirm,'#identityCanonicalCancel':cancel})[selector]};
 let markup='';
 const cl={id:'case-1',members:[{si:0,alias:'Same Zoom Name',att:1},{si:1,alias:'Same Zoom Name',att:1}]};
 vm.runInNewContext(fn('identityCanonicalSheet')+';identityCanonicalSheet(cl)',{
  cl,...identityFixture(),esc:String,
  openSheet:(html,bind)=>{markup=html;bind(w);},
  missionAccountsSetMutationControlEnabled:(control,enabled)=>{control.disabled=!enabled;},
  decideIdent:async(_cl,decision,si)=>{calls.push(['decision',decision,si]);return accepted;},
  closeSheet:()=>calls.push(['close']),render:()=>calls.push(['render']),
 });
 return {calls,options,confirm,cancel,markup};
}

test('same-student review selects a named canonical record before a separate confirmation',async()=>{
 const denied=identityChoiceHarness(false);
 assert.match(denied.markup,/Confirm these are the same student/);
 assert.match(denied.markup,/one@example\.invalid.*record-aaa/s);
 assert.match(denied.markup,/two@example\.invalid.*record-bbb/s);
 assert.match(denied.markup,/Same Student.*Same Zoom Name.*1 class.*Account email/s,'duplicate display names still expose distinguishing account evidence');
 assert.match(denied.markup,/aria-pressed="false"/);
 assert.match(denied.markup,/id="identityCanonicalConfirm" disabled/);
 await denied.confirm.onclick();
 assert.deepEqual(denied.calls,[],'a disabled or unselected confirmation cannot adjudicate');
 denied.options[1].onclick();
 assert.deepEqual(denied.calls,[],'selecting a row cannot adjudicate');
 assert.equal(denied.options[1].pressed,true);
 assert.equal(denied.options[0].pressed,false);
 assert.match(denied.confirm.textContent,/cord-bbb/);
 await denied.confirm.onclick();
 assert.deepEqual(denied.calls,[['decision','same',1]],'a rejected save keeps the sheet open');
 assert.equal(denied.confirm.disabled,false);
 denied.cancel.onclick();
 assert.deepEqual(denied.calls,[['decision','same',1],['close']]);

 const saved=identityChoiceHarness(true);
 saved.options[0].onclick();
 assert.deepEqual(saved.calls,[]);
 await saved.confirm.onclick();
 assert.deepEqual(saved.calls,[['decision','same',0],['close'],['render']]);

 const canceled=identityChoiceHarness(true);
 canceled.options[0].onclick();canceled.cancel.onclick();
 assert.deepEqual(canceled.calls,[['close']],'cancel leaves the case unchanged');
});

test('unidentified attendee match stays on hold until a separate named confirmation',async()=>{
 const calls=[],confirm={disabled:true,textContent:'Confirm attendee match'},cancel={disabled:false},search={focus(){}};
 const list={options:[],markup:'',querySelectorAll(selector){return selector==='[data-pick]'?this.options:[]}};
 Object.defineProperty(list,'innerHTML',{set(value){this.markup=value;this.options=[...value.matchAll(/data-pick="([0-9]+)"/g)].map(match=>({dataset:{pick:match[1]},pressed:false,setAttribute(name,v){if(name==='aria-pressed')this.pressed=v==='true';}}));}});
 const w={querySelector:selector=>({'#mSearch':search,'#mList':list,'#mConfirm':confirm,'#mNo':cancel})[selector]};
 let markup='',accepted=false;
 const dv={id:'alias-1',name:'iPhone',att:1,cycles:['june']};
 vm.runInNewContext(fn('matchSheet')+';matchSheet(dv)',{
  dv,...identityFixture(),model:()=>({eff:[0,1].map(i=>({i,n:'Same Student',absorbed:false,notStudent:false,k:'student',c:{}}))}),
  CYK:[],cyc:()=>({label:'June Cycle'}),devicePreview:()=>[],money:value=>'$'+value,esc:String,
  openSheet:(html,bind)=>{markup=html;bind(w);},
  missionAccountsSetMutationControlEnabled:(control,enabled)=>{control.disabled=!enabled;},
  decideDevice:async(_dv,decision,si)=>{calls.push(['decision',decision,si]);return accepted;},
  closeSheet:()=>calls.push(['close']),render:()=>calls.push(['render']),
 });
 assert.match(markup,/keep the attendee on hold/);
 assert.match(list.markup,/one@example\.invalid.*record-aaa/s);
 assert.match(list.markup,/two@example\.invalid.*record-bbb/s);
 assert.equal(list.options.length,2,'same-name students each remain visible with distinct account evidence');
 assert.match(markup,/Student not listed\? Cancel/);
 assert.equal(confirm.disabled,true);
 await confirm.onclick();assert.deepEqual(calls,[]);
 list.options[0].onclick();
 assert.deepEqual(calls,[],'selecting a student is read-only');
 assert.equal(list.options[0].pressed,true);
 assert.match(confirm.textContent,/cord-aaa/);
 await confirm.onclick();
 assert.deepEqual(calls,[['decision','match',0]],'rejected match keeps the held sheet open');
 assert.equal(confirm.disabled,false);
 search.oninput({target:{value:'No matching student'}});
 assert.equal(confirm.disabled,true,'search changes clear the previous choice');
 assert.equal(list.options.length,0);
 search.oninput({target:{value:'two@example.invalid'}});
 assert.equal(list.options.length,1,'search can find the verified account email instead of an ambiguous name');
 assert.equal(list.options[0].dataset.pick,'1');
 list.options[0].onclick();accepted=true;
 await confirm.onclick();
 assert.deepEqual(calls,[['decision','match',0],['decision','match',1],['close'],['render']]);
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

test('Dr J automation view explains the zero-money shadow and renders every billing gate',()=>{
 assert.match(html,/function missionAccountsAutomaticBillingShadow\(\)/);
 assert.match(html,/Run \$0 billing preview/);
 assert.match(html,/This preview cannot contact Stripe or move money\./);
 assert.match(html,/Live automatic charging remains off\./);
 assert.match(html,/Would charge/);
 assert.match(html,/Sponsored exclusions/);
 assert.match(html,/Missing payment method/);
 assert.match(html,/Missing consent/);
 assert.match(html,/Held or review/);
 assert.match(html,/data-auto-shadow/);
 assert.match(html,/request\('\/admin\/automation\/shadow'\)/);
 assert.doesNotMatch(fn('missionAccountsAutomaticBillingShadow'),/manual-cycle-charge|auto\/dispatch|PaymentIntent/);
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
