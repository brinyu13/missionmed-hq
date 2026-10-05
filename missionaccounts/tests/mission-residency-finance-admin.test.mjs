import test from 'node:test';
import assert from 'node:assert/strict';
import { createHmac, randomBytes, randomUUID } from 'node:crypto';
import { createMissionAccountsServer } from '../src/server.mjs';
import { financialCommandProjection, financialReadAccess } from '../src/mission-residency-finance/read-model.mjs';
import { commandHome, accountProfile, filteredAccounts } from '../public/mission-residency-finance/view.js';
const principal=randomUUID(), secret=randomBytes(32).toString('hex');
const config={production:true,localAuth:false,jwtSecret:secret,issuer:'test-finance-issuer',audience:'missionaccounts',features:{},basePath:'/missionaccounts/',partnerCostSharing:{enabled:false}};
function token(role='founder',id=principal,wp=1){const enc=x=>Buffer.from(JSON.stringify(x)).toString('base64url');const t=Math.floor(Date.now()/1000);const head=enc({alg:'HS256',typ:'JWT'}),body=enc({sub:id,wp_user_id:wp,jti:randomUUID(),iat:t,exp:t+120,iss:config.issuer,aud:config.audience,app_role:role,missionaccounts_eligible:true});return head+'.'+body+'.'+createHmac('sha256',secret).update(head+'.'+body).digest('base64url');}
const fixture=()=>({observed_at:'2026-10-05T01:00:00Z',accounts:[{subject_key:'match360:fixture',name:'Fixture <student>',program:'Mission Residency',state:'CERTIFIED',binding_state:'UNRESOLVED',student_visible:false,collections_enabled:false,created_at:'2026-10-01T00:00:00Z',agreement:{tuition_cents:10000,fees_cents:100,deposit_cents:null,certified_at:'2026-10-01T00:00:00Z',effective_on:null,evidence:{reason:'Verified agreement',ids:[]},plan:'Accepted plan, exact dates unknown',discount_provenance:{},certification_status:'CERTIFIED_BALANCE_DUE'},balance:{balance_cents:5100,currently_due_cents:null,overdue_cents:null},obligations:[{id:'o',obligation_key:'tuition-principal',component:'TUITION_PRINCIPAL',remaining_cents:5000,original_cents:10000,due_precision:'UNKNOWN',due_on:null},{id:'f',component:'ADMIN_PROCESSING_FEE',obligation_key:'admin-processing-fee',remaining_cents:100,original_cents:100,due_precision:'UNKNOWN',due_on:null}],payments:[{id:'p',date:'2026-09-01T00:00:00Z',verified_at:'2026-10-01T00:00:00Z',amount_cents:5001,unapplied_cents:1,applied_cents:5000,method:'ZELLE',provider:'Chase',payer:'Verified family payer',verification_state:'VERIFIED',evidence:[{type:'BANK_REFERENCE',provider:'Chase',reference:'safe-reference',fingerprint:'a'.repeat(64),verified:true}]}],applications:[{payment_id:'p',obligation:'tuition-principal',amount_cents:5000,recorded_at:'2026-10-01T00:00:00Z'}],adjustments:[],payers:[{payer:'Verified family payer',relationship:'EXPLICIT_FAMILY',provenance:{ids:['fixture-evidence']}}],cases:[],source:{kind:'fixture',sha256:'a'.repeat(64)}}]});
test('signed explicit Founder pair only; generic admin, student, anonymous, cross-account and mutation denied',async()=>{
 const calls=[];const store={rpc:async(name,args)=>{calls.push(name);if(args.p_principal!==principal||args.p_wp_user_id!==1)return false;return name==='api_financial_read_access'?true:fixture();}};
 const server=createMissionAccountsServer({config,store,stripeGateway:{},notificationGateway:{},partnerStore:null});await new Promise(r=>server.listen(0,'127.0.0.1',r));const base=`http://127.0.0.1:${server.address().port}/missionaccounts/api/mission-residency-finance`;
 try{
  const get=(path,t,method='GET')=>fetch(base+path,{method,headers:t?{authorization:'Bearer '+t}:{}});
  assert.equal((await get('/command',null)).status,401);
  for(const t of [token('student'),token('registered'),token('missionaccounts_admin',randomUUID()),token('founder',principal,2)])assert.equal((await get('/command',t)).status,403);
  const good=await get('/command',token());assert.equal(good.status,200);assert.match(good.headers.get('cache-control'),/no-store, private/);assert.equal((await good.json()).summary.balance_cents,5100);
  assert.equal((await get('/command',token(),'POST')).status,405);
  assert.equal((await get('/commands/charge',token(),'POST')).status,405);
  assert.equal((await get('/command?actor=phase1-certified-import',token('missionaccounts_admin',randomUUID()))).status,403);
  assert.equal(calls.some(x=>/stage|settle|record|charge|invoice/.test(x)),false);
 }finally{await new Promise(r=>server.close(r));}
});
test('unavailable authorization and local role-only identity fail closed',async()=>{
 assert.equal(await financialReadAccess({rpc:async()=>{throw Error('unavailable');}},{roles:['founder'],userId:principal,wpUserId:1}),false);
 assert.equal(await financialReadAccess({rpc:async()=>true},{roles:['founder'],userId:principal}),false);
});
test('dynamic server math, unknown due semantics, positive credit, safe payer and evidence rendering',()=>{
 const result=financialCommandProjection(fixture());assert.equal(result.summary.tuition_cents,10000);assert.equal(result.summary.credit_cents,1);assert.equal(result.accounts[0].next_due_date,null);
 const profile=accountProfile(result.accounts[0]);assert.match(profile,/Not certified/);assert.match(profile,/Unknown/);assert.match(profile,/Unapplied credit/);assert.match(profile,/Explicit family relationship/);assert.match(profile,/Chase verified/);assert.match(profile,/safe-reference/);assert.match(profile,/Fixture &lt;student&gt;/);assert.doesNotMatch(profile,/Pay Now|Send Invoice|data-charge|<script/);
 assert.equal(filteredAccounts(result,'family').length,1);assert.equal(filteredAccounts(result,'','balance','ZELLE').length,1);assert.equal(filteredAccounts(result,'','pif').length,0);
 const changed=fixture();changed.accounts[0].agreement.tuition_cents=20000;assert.match(commandHome(financialCommandProjection(changed)),/\$200\.00/);
});
test('held accounts expose no debt; settled Stripe records remain PIF',()=>{
 const held=fixture().accounts[0];Object.assign(held,{state:'HELD',agreement:null,balance:null,obligations:[],payments:[],applications:[],payers:[],cases:[{type:'NEEDS_BANK_EVIDENCE',reason:'Incoming wire proof missing; not unpaid'}]});
 const view=financialCommandProjection({observed_at:'now',accounts:[held]});assert.equal(view.summary.held,1);assert.equal(view.summary.tuition_cents,0);assert.doesNotMatch(accountProfile(view.accounts[0]),/Currently due|Pay Now|AMOUNT DUE/);assert.match(accountProfile(view.accounts[0]),/not unpaid/);
 const card=fixture();Object.assign(card.accounts[0].balance,{balance_cents:0,currently_due_cents:0,overdue_cents:0});card.accounts[0].payments[0].method='CARD';card.accounts[0].payments[0].provider='Stripe';const p=financialCommandProjection(card);assert.equal(p.summary.paid_in_full,1);assert.match(accountProfile(p.accounts[0]),/Card · Stripe verified/);
});
