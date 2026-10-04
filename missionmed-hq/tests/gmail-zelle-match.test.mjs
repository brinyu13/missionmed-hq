import assert from 'node:assert/strict';
import test from 'node:test';
import {canonicalSignatureInput,findExactZelleMatch,normalizeMatchInput,normalizeAmount,normalizePayer,parseChaseZelleMessage} from '../routes/gmail-zelle-match.mjs';

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
