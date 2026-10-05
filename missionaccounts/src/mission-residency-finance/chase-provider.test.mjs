import assert from 'node:assert/strict';
import test from 'node:test';
import crypto from 'node:crypto';
import {canonicalSignatureInput,findExactZelleMatch,normalizeMatchInput,normalizeAmount,normalizePayer,parseChaseZelleMessage} from './chase-donor-v2.mjs';

// Synthetic/redacted observed schema; never evidence of real payment acceptance.
const mailbox='info@missionmedinstitute.com', now=Math.floor(Date.now()/1000);
const day=epoch=>new Intl.DateTimeFormat('en-US',{timeZone:'America/New_York',month:'short',day:'numeric',year:'numeric'}).format(new Date(epoch*1000));
function fixture({payer='Test Student',amount='1.00',id='msg_fixture_01',epoch=now-30,reference='TEST-1234',html=false}={}){
 const lines=[payer+' sent you money','Here are the details:','Amount: $'+amount,'Sent on '+day(epoch),'Transaction number: '+reference];
 const text=html?lines.map(v=>'<div>'+v+'</div>').join(''):lines.join('\n');
 return {id,internalDate:String(epoch*1000),payload:{headers:[
  {name:'Delivered-To',value:mailbox},
  {name:'Authentication-Results',value:'mx.google.com; dkim=pass header.i=@chase.com header.s=d4815; dmarc=pass (p=REJECT) header.from=chase.com; spf=pass smtp.mailfrom=no.reply.alerts.03@chase.com'},
  {name:'From',value:'Chase <no.reply.alerts@chase.com>'},{name:'To',value:mailbox},{name:'Subject',value:'You received money with Zelle®'}
 ],mimeType:html?'text/html':'text/plain',body:{data:Buffer.from(text).toString('base64url')}}};
}
function header(m,name,value){m.payload.headers.find(h=>h.name.toLowerCase()===name.toLowerCase()).value=value;return m;}
function body(m,change){m.payload.body.data=Buffer.from(change(Buffer.from(m.payload.body.data,'base64url').toString())).toString('base64url');return m;}
const payload=()=>({protocol_version:2,currency:'USD',eligible_order_ids:[42],order_id:42,expected_amount:'1.00',payer_name:'Test Student',order_created_epoch:now-60,consumed_fingerprints:[]});
const input=()=>normalizeMatchInput(payload());
async function match(messages,overrides={},extra={}){
 return findExactZelleMatch({input:{...input(),...overrides},credentials:{},scopes:[],mintToken:async()=>({ok:true,accessToken:'synthetic'}),gmailGetJson:async url=>url.includes('/messages?')?{ok:true,data:{messages:messages.map(m=>({id:m.id})),...extra}}:{ok:true,data:messages.find(m=>url.includes('/'+m.id+'?'))}});
}
for(const html of [false,true])test('observed schema '+(html?'HTML':'text'),()=>{
 const c=parseChaseZelleMessage(fixture({html}));assert.equal(c.amount,'1.00');assert.equal(c.payerName,'test student');assert.match(c.fingerprint,/^[a-f0-9]{64}$/);assert.equal(c.referenceMasked,'...1234');assert.equal('body' in c,false);
});
for(const amount of ['1000.00','1,000.00','3099.00','3,099.00','499.00'])test('exact amount '+amount,()=>assert.equal(parseChaseZelleMessage(fixture({amount})).amount,amount.replace(',','')));
for(const amount of ['1.001','1e3','NaN','-1','1,00.00','1 000.00',''])test('reject lossy amount '+amount,()=>assert.equal(normalizeAmount(amount),''));
for(const [name,mutate] of [
 ['lookalike sender',m=>header(m,'From','Chase <no.reply.alerts@chase.com.evil.test>')],
 ['wrong subject',m=>header(m,'Subject','You received money with Zelle - action required')],
 ['no auth',m=>header(m,'Authentication-Results','')],
 ['attacker auth server',m=>header(m,'Authentication-Results','evil.test; dkim=pass header.i=@chase.com; dmarc=pass header.from=chase.com')],
 ['failed dkim',m=>header(m,'Authentication-Results','mx.google.com; dkim=fail header.i=@chase.com; dmarc=pass header.from=chase.com')],
 ['failed dmarc',m=>header(m,'Authentication-Results','mx.google.com; dkim=pass header.i=@chase.com; dmarc=fail header.from=chase.com')],
 ['lookalike dkim',m=>header(m,'Authentication-Results','mx.google.com; dkim=pass header.i=@chase.com.evil.test; dmarc=pass header.from=chase.com')],
 ['forwarder-only dkim',m=>header(m,'Authentication-Results','mx.google.com; dkim=pass header.i=@cloudflare-email.net; dmarc=pass header.from=chase.com')],
 ['wrong recipient',m=>header(m,'To','other@example.com')],
 ['historical alias',m=>header(m,'To','info@missionresidency.com')],
 ['wrong delivery',m=>header(m,'Delivered-To','other@example.com')],
 ['no reference',m=>body(m,s=>s.replace('Transaction number: TEST-1234',''))],
 ['no sent date',m=>body(m,s=>s.replace(/Sent on[^\n]+/,''))],
 ['invalid sent date',m=>body(m,s=>s.replace(/Sent on[^\n]+/,'Sent on Feb 31, 2026'))],
 ['duplicate amounts',m=>body(m,s=>s+'\nAmount: $1.00')],
 ['duplicate references',m=>body(m,s=>s+'\nTransaction number: TEST-1234')],
 ['overprecision',m=>body(m,s=>s.replace('$1.00','$1.001'))],
 ['duplicate From',m=>{m.payload.headers.push({name:'From',value:'Chase <no.reply.alerts@chase.com>'});return m;}],
 ['forged later auth',m=>{header(m,'Authentication-Results','mx.google.com; dkim=fail header.i=@chase.com; dmarc=fail header.from=chase.com');m.payload.headers.push({name:'Authentication-Results',value:'mx.google.com; dkim=pass header.i=@chase.com; dmarc=pass header.from=chase.com'});return m;}],
])test('fail closed: '+name,()=>assert.equal(parseChaseZelleMessage(mutate(fixture())),null));
test('signature binds all matching fields',()=>{
 const p=payload(),base=canonicalSignatureInput('1791120000','a'.repeat(32),p);
 for(const delta of [{order_id:43},{expected_amount:'2.00'},{payer_name:'Other Person'},{order_created_epoch:now-80},{protocol_version:1},{currency:'CAD'},{eligible_order_ids:[42,43]},{consumed_fingerprints:['b'.repeat(64)]}])assert.notEqual(canonicalSignatureInput('1791120000','a'.repeat(32),{...p,...delta}),base);
});
test('protocol currency and unique eligible order mandatory',()=>{
 assert.equal(input().ok,true);
 for(const delta of [{protocol_version:1},{currency:'CAD'},{eligible_order_ids:[]},{eligible_order_ids:[42,43]},{eligible_order_ids:[43]},{eligible_order_ids:[42,42]},{consumed_fingerprints:['bad']}])assert.equal(normalizeMatchInput({...payload(),...delta}).ok,false);
});
test('exact case/whitespace normalization not fuzzy',()=>{
 assert.equal(normalizePayer(' TEST  Student '),'test student');assert.notEqual(normalizePayer('Test-Student'),'test student');assert.notEqual(normalizePayer('Tést Student'),'test student');
});
test('one receipt verifies',async()=>assert.equal((await match([fixture()])).state,'verified'));
test('two transactions are ambiguous',async()=>assert.equal((await match([fixture(),fixture({id:'msg_fixture_02',reference:'TEST-5678'})])).state,'needs_review'));
test('stable transaction fingerprint across duplicate emails',async()=>{
 const a=fixture(),b=fixture({id:'msg_fixture_02',epoch:now-20});assert.equal(parseChaseZelleMessage(a).fingerprint,parseChaseZelleMessage(b).fingerprint);assert.equal((await match([a,b])).state,'verified');assert.equal((await match([b],{consumedFingerprints:[parseChaseZelleMessage(a).fingerprint]})).state,'already_consumed');
});
for(const [name,change] of [['wrong payer',{payerName:'test students'}],['wrong amount',{expectedAmount:'2.00'}]])test(name,async()=>assert.equal((await match([fixture()],change)).state,'not_found'));
test('old receipt excluded',async()=>assert.equal((await match([fixture({epoch:now-3600})])).state,'not_found'));
test('stale order review',async()=>assert.equal((await match([fixture()],{orderCreatedEpoch:now-8*86400})).state,'needs_review'));
test('future order review',async()=>assert.equal((await match([fixture()],{orderCreatedEpoch:now+3600})).state,'needs_review'));
test('truncated search review',async()=>assert.equal((await match([fixture()],{}, {nextPageToken:'more'})).state,'needs_review'));
test('no receipt locked',async()=>assert.equal((await match([])).state,'not_found'));
test('Gmail outage locked',async()=>{
 const p={input:input(),credentials:{},scopes:[],mintToken:async()=>({ok:true,accessToken:'synthetic'}),gmailGetJson:async()=>({ok:false,error:'provider_error'})};assert.equal((await findExactZelleMatch(p)).state,'provider_unavailable');assert.equal((await findExactZelleMatch({...p,mintToken:async()=>({ok:false,error:'unavailable'})})).state,'provider_unavailable');
});
test('same bank reference with conflicting authenticated amount is held',async()=>{
 const result=await match([fixture(),fixture({id:'msg_fixture_02',amount:'2.00'})]);
 assert.equal(result.state,'needs_review');assert.equal(result.error,'conflicting_transaction_evidence');
});

import { ChaseReceiptProvider, CHASE_CLAIM_URL, bridgeSignatureInput, chaseMatchBinding, createChaseReceiptProvider } from './chase-provider.mjs';
const context = () => ({ request_id: '11111111-1111-4111-8111-111111111111',
  account_id: '22222222-2222-4222-8222-222222222222', amount_cents: 100,
  payer_name: 'test student', created_epoch: now-60, match_slot: 42, eligible_match_count: 1 });
const syntheticKey = () => Buffer.from('fixture signing material').toString('hex');
function provider({ messages = [fixture()], responseMode = 'valid', extra = {} } = {}) {
  let fetchCalls = 0;
  const instance = new ChaseReceiptProvider({ secret: async()=>syntheticKey(),
    dwd: { getConfiguredAllowedMailboxes: ()=>new Set([mailbox]),
      readGmailDwdConfig: ()=>({ok:true, credentials:{}, scopes:['https://www.googleapis.com/auth/gmail.readonly']}),
      mintDelegatedAccessToken: async({mailbox:recipient})=>{assert.equal(recipient,mailbox); return {ok:true,accessToken:'fixture'};},
      googleGetJson: async url=>url.includes('/messages?')?{ok:true,data:{messages:messages.map(m=>({id:m.id})),...extra}}:{ok:true,data:messages.find(m=>url.includes('/'+m.id+'?'))} },
    fetchImpl: async(url,options)=>{
      fetchCalls++;assert.equal(url,CHASE_CLAIM_URL);assert.equal(options.redirect,'error');
      const p=JSON.parse(options.body);const stamp=options.headers['x-mmed-finance-timestamp'];const nonce=options.headers['x-mmed-finance-nonce'];
      assert.equal(options.headers['x-mmed-finance-signature'],crypto.createHmac('sha256',syntheticKey()).update(bridgeSignatureInput(stamp,nonce,options.body)).digest('hex'));
      const body=JSON.stringify({reserved:true,fingerprint:p.fingerprint,match_binding:responseMode==='wrong-binding'?'a'.repeat(64):p.match_binding});
      const signature=crypto.createHmac('sha256',syntheticKey()).update(bridgeSignatureInput(stamp,nonce,body)).digest('hex');
      return {ok:responseMode!=='consumed',url,text:async()=>body,headers:{get:()=>responseMode==='unsigned'?'':signature}};
    } });
  return {instance, calls:()=>fetchCalls};
}
test('private provider returns only authenticated globally reserved proof',async()=>{
  const p=provider();const proof=await p.instance.reserve(context());assert.equal(p.calls(),1);
  assert.equal(proof.reservation_verified,true);assert.equal(proof.authenticity_verified,true);assert.equal(proof.amount_cents,100);
  assert.match(proof.provider_identity,/^[a-f0-9]{64}$/);assert.equal(proof.money_moved,false);
  assert.equal('payer_name' in proof,false);assert.equal('body' in proof,false);
});
for(const responseMode of ['consumed','unsigned','wrong-binding'])test('bridge fails closed '+responseMode,async()=>{
  await assert.rejects(provider({responseMode}).instance.reserve(context()));
});
for(const options of [{messages:[]},{messages:[fixture(),fixture({id:'msg_fixture_02',reference:'OTHER-1234'})]},{extra:{nextPageToken:'more'}}])test('never reserves unverified or incomplete match '+JSON.stringify(options.extra||{}),async()=>{
  const p=provider(options);await assert.rejects(p.instance.reserve(context()));assert.equal(p.calls(),0);
});
test('canonical context uniqueness gate precedes Gmail/claim',async()=>{
  const p=provider();await assert.rejects(p.instance.reserve({...context(),eligible_match_count:2}));assert.equal(p.calls(),0);
});
test('HMAC binds namespace timestamp nonce and exact body bytes',()=>{
 const body='{}',stamp='1791220000',nonce='a'.repeat(32),base=bridgeSignatureInput(stamp,nonce,body);
 assert.notEqual(base,bridgeSignatureInput(stamp,nonce,'{ }'));
 assert.notEqual(base,bridgeSignatureInput('1791220001',nonce,body));
 assert.notEqual(base,bridgeSignatureInput(stamp,'b'.repeat(32),body));
 assert.ok(base.startsWith('missionmed-finance/chase-reserve/v1\n'));
});

import fs from 'node:fs';
test('critical donor extraction retains exact reviewed bytes',()=>{
 const source=fs.readFileSync(new URL('./chase-donor-v2.mjs',import.meta.url),'utf8');
 const extract=source.slice(source.indexOf('function authenticateRequest'));
 assert.equal(crypto.createHash('sha256').update(extract).digest('hex'),'441e8d0e6896d15c8ea7ee0a33f80ce5a103d971f5172ebbc43b73a9dbf0c086');
});

import { FinancialOperationsService } from './operations-service.mjs';
const founder = {userId:'00000000-0000-4000-8000-000000000001',wpUserId:1,roles:['founder']};
test('service reconciles only server canonical request context and final RPC',async()=>{
 const ctx={...context(),match_binding:chaseMatchBinding(context())};const calls=[];
 const p=provider();const operations=new FinancialOperationsService({config:{zelleMatcher:true,settlementActor:'fixture-settle'},chaseEvidence:p.instance,
 store:{rpc:async(name,args)=>{calls.push({name,args});if(name==='api_financial_read_access')return true;if(name==='api_financial_chase_context')return ctx;return {state:'SETTLED'};}}});
 assert.equal((await operations.reconcileZelle(founder,ctx.request_id)).state,'SETTLED');
 assert.deepEqual(calls.map(x=>x.name),['api_financial_read_access','api_financial_chase_context','api_financial_settle_chase_request']);
 assert.equal(calls.at(-1).args.p_receipt.match_binding,ctx.match_binding);
 assert.equal(calls.at(-1).args.p_request,ctx.request_id);
});
test('legacy numeric input and all default gates refuse provider access',async()=>{
 let reserved=0;const operations=new FinancialOperationsService({config:{},chaseEvidence:{reserve:async()=>{reserved++;}},store:{rpc:async()=>true}});
 await assert.rejects(operations.reconcileZelle(founder,context().request_id));
 operations.config={zelleMatcher:true,settlementActor:'fixture-settle'};
 await assert.rejects(operations.reconcileZelle(founder,'9211'));assert.equal(reserved,0);
});
test('student identity cannot invoke request reconciliation',async()=>{
 const operations=new FinancialOperationsService({config:{zelleMatcher:true},store:{rpc:async()=>true}});
 await assert.rejects(operations.reconcileZelle({...founder,wpUserId:2,roles:['student']},context().request_id));
});
test('provider verifies exact DB context binding before Gmail or reservation',async()=>{
 const p=provider();await assert.rejects(p.instance.reserve({...context(),match_binding:'a'.repeat(64)}));assert.equal(p.calls(),0);
});
test('settled request retries return canonical result without a second reservation',async()=>{
 let reserved=0;const operations=new FinancialOperationsService({config:{zelleMatcher:true,settlementActor:'fixture-settle'},chaseEvidence:{reserve:async()=>{reserved++;}},
 store:{rpc:async(name)=>name==='api_financial_read_access'?true:{state:'SETTLED',payment_id:'fixture-payment'}}});
 assert.deepEqual(await operations.reconcileZelle(founder,context().request_id),{state:'SETTLED',payment_id:'fixture-payment',duplicate:true});assert.equal(reserved,0);
});
test('mismatched reserved proof never enters final canonical RPC',async()=>{
 const calls=[];const ctx={...context(),match_binding:chaseMatchBinding(context())};
 const operations=new FinancialOperationsService({config:{zelleMatcher:true,settlementActor:'fixture-settle'},chaseEvidence:{reserve:async()=>({authenticity_verified:true,global_claim_verified:true,reservation_verified:true,match_binding:'a'.repeat(64)})},
 store:{rpc:async(name)=>{calls.push(name);return name==='api_financial_read_access'?true:ctx;}}});
 await assert.rejects(operations.reconcileZelle(founder,ctx.request_id));assert.equal(calls.includes('api_financial_settle_chase_request'),false);
});
test('JS newline binding has exact canonical contract',()=>{
 const ctx={...context(),created_epoch:1791220000};
 assert.equal(chaseMatchBinding(ctx),crypto.createHash('sha256').update(['financial-chase-match/v1',ctx.request_id,ctx.account_id,'100','test student','1791220000','42'].join('\n')).digest('hex'));
});

test('unconfigured production adapter remains explicitly fail closed',async()=>{
 const adapter=createChaseReceiptProvider();assert.equal(adapter.configurationState().interface_configured,false);
 assert.equal(adapter.configurationState().release_verified,false);await assert.rejects(adapter.reserve(context()));
});

test('JS binding matches the executed local PostgreSQL vector exactly',()=>{
 const ctx={...context(),created_epoch:1791220000,match_slot:1};
 assert.equal(chaseMatchBinding(ctx),'a505939db13ac6d92817faf876b3fa3969607f90bbe7f2b1a112d6859175b773');
});
