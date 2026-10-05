import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { createPartnerCostRouter } from '../src/partner-cost-sharing/router.mjs';
import { PartnerLedger } from '../src/partner-cost-sharing/ledger.mjs';
import { LocalPartnerStore,environmentPartnerStore } from '../src/partner-cost-sharing/store.mjs';
import { PartnerAccountingWorker } from '../src/partner-cost-sharing/worker.mjs';
import { PartnerVendorAdapter,PartnerGmailAdapter } from '../src/partner-cost-sharing/providers.mjs';
const proof='a'.repeat(64);
test('native partner assets traverse extensionless gateway paths with correct MIME and exact source bytes',async()=>{
 const {createMissionAccountsServer}=await import('../src/server.mjs');
 const {readFile}=await import('node:fs/promises');
 const server=createMissionAccountsServer({config:{production:true,localAuth:false,features:{},partnerCostSharing:{enabled:false}},store:{}});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 try{
  const origin='http://127.0.0.1:'+server.address().port;
  for(const [alias,file,type] of [['partner-cost-sharing','ui.js','application/javascript'],['partner-cost-sharing-style','ui.css','text/css']]){
   const expected=await readFile(new URL('../public/partner-cost-sharing/'+file,import.meta.url));
   for(const mount of ['/','/missionaccounts/']){
    const response=await fetch(origin+mount+'assets/'+alias);
    assert.equal(response.status,200);assert.ok(response.headers.get('content-type').startsWith(type));
    assert.equal(response.headers.get('x-content-type-options'),'nosniff');
    assert.deepEqual(Buffer.from(await response.arrayBuffer()),expected);
   }
  }
  assert.equal((await fetch(origin+'/assets/partner-cost-sharing-unknown')).status,404);
 }finally{await new Promise(resolve=>server.close(resolve));}
});
async function harness({enabled=true,brianOnly=false,prototype=false}={}){
 const ledger=new PartnerLedger(),local=new LocalPartnerStore(ledger);
 const store={memberForPrincipal:async id=>['brian','drj','phil'].includes(id)?{key:id,active:true}:null,view:actor=>ledger.view({...actor,active:true}),execute:(actor,...args)=>local.execute({...actor,prototype:true},...args)};
 const router=createPartnerCostRouter({config:{localAuth:true,production:false,partnerCostSharing:{enabled,brianOnly,prototype}},authenticate:async req=>{const id=req.headers.authorization?.replace('Bearer ','');if(!id)throw Object.assign(new Error('Authentication required'),{status:401});return {userId:id,wpUserId:1};},memberStore:store});
 const server=createServer(async(req,res)=>{try{if(!await router(req,res,new URL(req.url,'http://fixture.local'))){res.writeHead(404);res.end();}}catch(e){res.writeHead(e.status||409,{'content-type':'application/json'});res.end(JSON.stringify({error:e.message}));}});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const origin='http://127.0.0.1:'+server.address().port;
 const call=(route,{actor='brian',method='GET',payload,key='fixture-request-1',headers={}}={})=>fetch(origin+'/api/partner-cost-sharing/'+route,{method,headers:{...(actor?{Authorization:'Bearer '+actor}:{}),...(method==='POST'?{'content-type':'application/json','Idempotency-Key':key}:{}),...headers},...(payload?{body:JSON.stringify(payload)}:{})});
 return {ledger,store,call,origin,close:()=>new Promise(resolve=>server.close(resolve))};
}
test('HTTP gates deny anonymous, unrelated roles, disabled module and closed partner acceptance',async()=>{
 const h=await harness();try{assert.equal((await h.call('bootstrap',{actor:null})).status,401);assert.equal((await h.call('bootstrap',{actor:'founder-role-only'})).status,404);assert.equal((await h.call('bootstrap',{actor:'drj'})).status,200);assert.equal((await h.call('admin',{actor:'drj'})).status,403);assert.equal((await h.call('invoices/unknown/document',{actor:'phil'})).status,404);}finally{await h.close();}
 const off=await harness({enabled:false});try{assert.equal((await off.call('bootstrap')).status,404);}finally{await off.close();}
 const brian=await harness({brianOnly:true});try{assert.equal((await brian.call('bootstrap',{actor:'phil'})).status,404);assert.equal((await brian.call('bootstrap')).status,200);}finally{await brian.close();}
});
test('HTTP mutation boundaries reject cross-origin, missing key, provider assertions and card spoofing',async()=>{
 const h=await harness();try{
 const report={obligationId:'unknown',amountCents:100};
 assert.equal((await h.call('commands/reportSent',{actor:'drj',method:'POST',payload:report,headers:{Origin:'https://outsider.example'}})).status,403);
 assert.equal((await h.call('commands/reportSent',{actor:'drj',method:'POST',payload:report,key:''})).status,400);
 assert.equal((await h.call('commands/ingest',{actor:'phil',method:'POST',payload:{}})).status,403);
 for(const payload of [{method:'stripe_webhook',signatureVerified:true},{method:'authenticated_chase_gmail',transportVerified:true}])assert.equal((await h.call('commands/verifyPayment',{method:'POST',payload})).status,400);
 assert.equal((await h.call('commands/method',{actor:'drj',method:'POST',payload:{providerVerified:true,reference:'pm_forged'}})).status,503);
 assert.equal((await h.call('prototype/lens',{method:'POST',payload:{partner:'phil'}})).status,404);
 assert.equal(h.ledger.state.payments.length,0);
 }finally{await h.close();}
});
test('authenticated HTTP journal projection and exports keep unknown balances and own history',async()=>{
 const h=await harness();try{
 const response=await h.call('bootstrap',{actor:'phil'}),body=await response.json();assert.equal(response.headers.get('cache-control'),'no-store, private');assert.equal(body.currentBalanceCents,null);assert.equal(body.ledger.partner.key,'phil');assert.equal(body.ledger.admin,undefined);assert.ok(body.ownPayments.every(x=>x.amountCents===90000));assert.equal(JSON.stringify(body).includes('89300'),false);
 const exported=await h.call('statement-export?year=2026',{actor:'drj'}),statement=await exported.json();assert.equal(statement.record.openingBalanceCents,null);assert.equal(statement.record.closingBalanceCents,null);assert.equal(statement.record.partner.key,'drj');assert.match(statement.csv,/DRAFT - BALANCES UNKNOWN/);
 assert.equal((await h.call('statement-export?start=2026-02-30&end=2026-12-31',{actor:'drj'})).status,400);
 }finally{await h.close();}
});
test('production fixture refuses activation and missing private config cannot crash the neighboring host',()=>{
 assert.throws(()=>createPartnerCostRouter({config:{production:true,localAuth:true,partnerCostSharing:{enabled:true,prototype:true}},authenticate:()=>null}));
 assert.equal(environmentPartnerStore({MISSIONACCOUNTS_PARTNER_COST_SHARING:'1'}),null);
});
test('shadow discovery stages evidence and isolates provider outages without certifying or paying',async()=>{
 const h=await harness({prototype:true});try{
 const actor={key:'brian',active:true,prototype:true},local=new LocalPartnerStore(h.ledger);
 const worker=new PartnerAccountingWorker({mode:'shadow',store:local,vendor:new PartnerVendorAdapter({mode:'shadow',readInvoices:async()=>[{vendor:'Fixture Vendor',invoiceNumber:'SHADOW-1',amountCents:300,currency:'USD',periodStart:'2026-09-01',periodEnd:'2026-09-30',category:'Hosting',description:'Synthetic fixture only'}],custody:async()=>({sha256:proof,assetId:'fixture:private',sourceKind:'fixture_export'})}),gmail:{receipts:async()=>{throw Error('Synthetic outage');}}});
 const result=await worker.run(actor,'fixture-shadow-run');assert.equal(result.moneyMoved,false);assert.equal(result.posted,false);assert.equal(result.expenses.length,1);assert.ok(result.exceptions.some(x=>x.kind==='RECEIPT_BRIDGE_UNAVAILABLE'));assert.equal(h.ledger.state.expenses[0].state,'NEEDS_VERIFICATION');assert.equal(h.ledger.view({key:'drj',active:true}).currentBalanceCents,null);assert.equal(h.ledger.state.payments.length,0);
 await worker.run(actor,'fixture-shadow-retry');assert.equal(h.ledger.state.expenses.length,1);await assert.rejects(worker.run({key:'phil',active:true},'denied-shadow-run'));
 const off=new PartnerAccountingWorker({mode:'disabled',store:local});assert.equal((await off.run(actor,'disabled')).state,'DISABLED');
 }finally{await h.close();}
});
