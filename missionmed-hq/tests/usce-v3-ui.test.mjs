import assert from 'node:assert/strict';
import {test} from 'node:test';
import fs from 'node:fs';
import {createRequire} from 'node:module';
const {JSDOM}=createRequire(import.meta.url)('/Users/brianb/MissionMed/node_modules/jsdom');
const html=fs.readFileSync(new URL('../../LIVE/usce_admin.html',import.meta.url),'utf8');
function harness(){
 const dom=new JSDOM(html,{url:'https://synthetic.invalid',runScripts:'outside-only'}),w=dom.window;
 w.confirm=()=>true;w.fetch=()=>{throw Error('Network forbidden')};w.setInterval=()=>0;
 w.HTMLDialogElement.prototype.showModal=function(){this.open=true};w.HTMLDialogElement.prototype.close=function(){this.open=false};
 let source=w.document.querySelector('script').textContent;
 source=source.replace("renderRequestList(); switchView('hq'); loadLiveQueue();","window.TEST={state,startIqIntro,finishIqIntro,showAdminLogin,clearAdminLogin,ensureSession,adminAuthRelayUrl,renderRequestList,setV3Workspace,openV3Case,selectRequest,mocks(){loadCaseActivity=async()=>{};loadLiveComms=()=>{};}};");
 w.eval(source);w.eval(w.document.querySelector('#usce-foundation-navigation').textContent);const a=w.TEST;a.mocks();
 const statuses=['NEW','IN_PROGRESS','OFFER_SENT','OFFER_ACCEPTED','DECLINED'];
 a.state.requests=statuses.map((status,i)=>({id:'synthetic-'+i,name:'Synthetic '+i,email:'s'+i+'@example.test',status,specialties:['Internal Medicine'],locations:['New York'],months:['Oct 2026'],length:'4 weeks',comms:[],audit:[],offerHistory:[],submittedAt:Date.now()}));a.state.adapter='live';
 return{dom,w,a,$:id=>w.document.getElementById(id)};
}
function check(name,fn){test(name,async()=>{const h=harness();try{await fn(h)}finally{h.dom.window.close()}})}
check('dashboard creates real independent case and next action buttons without nested buttons',async({a,w,$})=>{
 a.renderRequestList();assert.equal(w.document.querySelectorAll('.mm-req-item').length,5);assert.equal(w.document.querySelectorAll('button button').length,0);
 const row=w.document.querySelector('.mm-req-item');assert.equal(row.tagName,'DIV');assert.equal(row.querySelector('.mm-row-action').textContent,'Build Offer →');
 await a.openV3Case('synthetic-0',true);assert.equal(a.state.selectedRequestId,'synthetic-0');assert.equal($('mmJourneyScrim').open,true);
});
check('pipeline reflects same queue in four exact lanes and preserves exceptional records',async({a,w,$})=>{
 a.setV3Workspace('pipeline');assert.equal($('mmCx').dataset.workspace,'pipeline');assert.equal(w.document.querySelectorAll('.mm-pipeline-lane').length,4);
 assert.deepEqual([...w.document.querySelectorAll('.mm-lane-head span')].map(e=>e.textContent),['1','1','1','1']);assert.match($('mmPipelineExceptions').textContent,/1 cases/);
 a.state.query='Synthetic 1';a.renderRequestList();assert.equal(w.document.querySelectorAll('.mm-pipeline-card').length,1);assert.equal(w.document.querySelector('.mm-pipeline-card').dataset.id,'synthetic-1');
});
check('cancelled case switch does not enter Journey or replace existing case',async({a,w,$})=>{
 a.selectRequest('synthetic-0');a.state.dirty=true;w.confirm=()=>false;await a.openV3Case('synthetic-1',true);assert.equal(a.state.selectedRequestId,'synthetic-0');assert.equal($('mmJourneyScrim').open,false);
 await a.openV3Case('synthetic-0',true);assert.equal($('mmJourneyScrim').open,false);
});
check('responded offer card opens the case without entering editable Journey',async({a,$})=>{
 a.state.liveOffersByRequest['synthetic-3']={id:'offer-synthetic',requestId:'synthetic-3',status:'ACCEPTED',detailsLoaded:true,months:['Oct 2026']};
 await a.openV3Case('synthetic-3',true);assert.equal(a.state.selectedRequestId,'synthetic-3');assert.equal($('mmJourneyScrim').open,false);assert.equal($('mmOfProgram').disabled,true);
});
check('Journey retains unique existing controls, top save and six-step rail',async({w,$})=>{
 const ids=[...w.document.querySelectorAll('[id]')].map(e=>e.id);assert.equal(new Set(ids).size,ids.length);
 assert.ok($('mmJourneySaveClose').closest('.mm-journey-head'));assert.ok(w.document.querySelector('.mm-journey-rail .mm-journey-progress'));assert.equal(w.document.querySelectorAll('[data-journey-progress]').length,6);
 assert.match(html,/width:100vw;height:100dvh/);assert.match(html,/max-height:650px/);
});

check('workspace navigation asks once and preserves cancelled dirty case',async({a,w,$})=>{
 a.selectRequest('synthetic-0');a.state.dirty=true;let prompts=0;w.confirm=()=>{prompts++;return false};a.setV3Workspace('pipeline');assert.equal(prompts,1);assert.equal(a.state.selectedRequestId,'synthetic-0');
 prompts=0;w.confirm=()=>{prompts++;return true};a.setV3Workspace('pipeline');assert.equal(prompts,1);assert.equal(a.state.selectedRequestId,null);assert.equal($('mmCx').dataset.workspace,'pipeline');
});

check('foundation sidebar Pipeline survives Journey exit and Dashboard return',async({a,w,$})=>{
 a.renderRequestList();await a.openV3Case('synthetic-0',true);$('mmJourneyClose').click();
 w.document.querySelector('[data-sf-nav="pipeline"]').click();
 assert.equal($('mmCx').dataset.workspace,'pipeline');assert.equal(w.document.querySelector('#mmWorkspace > .mm-hero h1').textContent,'USCE Pipeline');
 assert.equal(w.document.querySelectorAll('.mm-pipeline-lane').length,4);assert.equal($('mmCx').classList.contains('mm-v3'),true);
 assert.match(html,/\.mm-hq-grid\{align-items:stretch\}/);assert.match(html,/\.mm-v2-queue\{height:100%;align-self:stretch\}/);assert.match(html,/#mmReqList\{grid-row:4;min-height:0\}/);
 w.document.querySelector('[data-sf-nav="cases"]').click();assert.equal(w.document.querySelector('#mmWorkspace > .mm-hero h1').textContent,'USCE Clinical Requests');
 assert.equal(w.document.querySelectorAll('.mm-req-item').length,5);
});

check('IQ intro is bounded, skippable, once per browser, and omitted for reduced motion',async({a,w,$})=>{
 a.finishIqIntro();w.localStorage.removeItem('mm-usce-iq-intro-v1');
 let timeout;const original=w.setTimeout;w.setTimeout=(fn,ms)=>{timeout={fn,ms};return 99;};
 a.startIqIntro();assert.equal($('mmIqIntro').hidden,false);assert.equal(timeout.ms,6000);
 $('mmIqSkip').click();assert.equal($('mmIqIntro').hidden,true);
 a.startIqIntro();assert.equal($('mmIqIntro').hidden,true);
 w.localStorage.removeItem('mm-usce-iq-intro-v1');w.matchMedia=()=>({matches:true});
 a.startIqIntro();assert.equal($('mmIqIntro').hidden,true);w.setTimeout=original;
});
check('missing/expired session opens login without navigating, hides intro, and traps keyboard focus',async({a,w,$})=>{
 w.fetch=async()=>({ok:false,status:401,json:async()=>({authenticated:false})});
 a.state.accessToken='synthetic-expired';
 await assert.rejects(a.ensureSession(),error=>error.status===401&&!error.recovering);
 assert.equal($('mmAdminLogin').open,true);assert.equal($('mmIqIntro').hidden,true);
 assert.equal($('mmCx').dataset.authBlocked,'true');assert.equal(a.state.accessToken,'');
 assert.match($('mmAdminLoginDescription').textContent,/expired/);
 assert.equal(w.location.href,'https://synthetic.invalid/');
 assert.equal($('mmAdminLogin').querySelectorAll('input').length,0);
 $('mmAdminLoginClose').focus();$('mmAdminLogin').dispatchEvent(new w.KeyboardEvent('keydown',{key:'Tab',bubbles:true,cancelable:true}));
 assert.equal(w.document.activeElement,$('mmAdminContinue'));
 $('mmAdminLogin').dispatchEvent(new w.KeyboardEvent('keydown',{key:'Tab',shiftKey:true,bubbles:true,cancelable:true}));
 assert.equal(w.document.activeElement,$('mmAdminLoginClose'));
 assert.equal(new URL($('mmAdminRecovery').href).pathname,'/wp-login.php');
 assert.equal(new URL($('mmAdminRecovery').href).searchParams.get('action'),'lostpassword');
});
check('authenticated bootstrap preserves bearer/CSRF and does not show login; explicit 403 remains visible',async({a,w,$})=>{
 a.finishIqIntro();w.fetch=async()=>({ok:true,status:200,json:async()=>({authenticated:true,accessToken:'synthetic-valid',csrfToken:'synthetic-csrf'})});
 const session=await a.ensureSession();assert.equal(session.authenticated,true);
 assert.equal($('mmAdminLogin').open,false);assert.equal($('mmCx').dataset.authBlocked,undefined);
 assert.equal(a.state.csrfToken,'synthetic-csrf');
 a.showAdminLogin(403);assert.match($('mmAdminLoginDescription').textContent,/does not have Clinicals administrator access/);
 assert.equal($('mmIqIntro').hidden,true);assert.match($('mmRuntimeText').textContent,/Administrator access/);
 assert.equal(new URL(a.adminAuthRelayUrl()).searchParams.get('action'),'mmhq_usce_admin_auth_relay');
 assert.equal(new URL(a.adminAuthRelayUrl()).origin,'https://missionmedinstitute.com');
 a.clearAdminLogin();assert.equal($('mmAdminLogin').open,false);
});
