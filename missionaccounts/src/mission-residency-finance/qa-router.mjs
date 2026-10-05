import { readJsonBody } from '../http/body.mjs';
import { financialCommandProjection, financialReadIdentity } from './read-model.mjs';
import { fail } from './operations-domain.mjs';
export function createFinancialQaRouter({runtime,authenticate,config}) {
 const prefix='/api/mission-residency-finance/qa';
 return async(request,response,url)=>{
  if(!(url.pathname===prefix||url.pathname.startsWith(prefix+'/')))return false;
  if(!runtime)throw fail('Financial QA is not enabled',404);
  const session=await authenticate(request,config),ctx=await runtime.resolve(session);
  if(!ctx)throw fail('Explicit private financial QA authority is required',403);
  const path=url.pathname.slice(prefix.length),id=request.headers['idempotency-key'];
  let result,body;
  if(request.method==='GET'&&path==='')result={kind:ctx.kind,synthetic:true,test_only:true,consent:ctx.consent,terms_version:ctx.terms_version};
  else if(path.startsWith('/admin')){
   if(ctx.kind!=='founder')throw fail('Founder finance authority is required',403);
   if(request.method==='GET'&&path==='/admin/command')result=financialCommandProjection(await ctx.operations.store.rpc('api_read_financial_command',financialReadIdentity(ctx.identity)));
   else if(request.method==='GET'&&path==='/admin')result=await ctx.operations.command(ctx.identity);
   else if(request.method==='POST'&&path==='/admin'){body=await readJsonBody(request,{limitBytes:32768});result=await ctx.operations.operate(ctx.identity,body.subject_key,body.operation,body,id);}
   else if(request.method==='POST'&&path==='/admin/card')result=await ctx.operations.startCard(ctx.identity,await readJsonBody(request,{limitBytes:8192}),id,true);
   else if(request.method==='POST'&&path==='/admin/card/reconcile')result=await ctx.operations.reconcileCard(ctx.identity,(await readJsonBody(request,{limitBytes:8192})).attempt_id,true);
   else if(request.method==='POST'&&path==='/admin/refund-record'){body=await readJsonBody(request,{limitBytes:16384});result=await ctx.receipts.refund(ctx.identity,body.payment_id,body,id);}
   else if(request.method==='GET'&&path==='/admin/history')result=await ctx.receipts.founderHistory(ctx.identity,'match360:phase3_qa_brinyu2');
   else throw fail('QA action unavailable',404);
  }else{
   if(ctx.kind!=='qa_subject')throw fail('Private synthetic QA identity is required',403);
   if(request.method==='GET'&&path==='/own/onboarding')result=await ctx.operations.onboarding(ctx.identity);
   else if(request.method==='POST'&&path==='/own/onboarding')result=await ctx.operations.saveOnboarding(ctx.identity,await readJsonBody(request,{limitBytes:8192}),id);
   else if(request.method==='POST'&&path==='/own/setup')result=await ctx.operations.setup(ctx.identity,id);
   else if(request.method==='POST'&&path==='/own/setup/confirm')result=await ctx.operations.confirmSetup(ctx.identity,(await readJsonBody(request,{limitBytes:8192})).request_id);
   else if(request.method==='GET'&&path==='/own')result=await ctx.operations.account(ctx.identity);
   else if(request.method==='GET'&&path==='/own/history')result=await ctx.receipts.ownHistory(ctx.identity);
   else if(request.method==='POST'&&path==='/own/authorize')result=await ctx.operations.authorizeCharge(ctx.identity,await readJsonBody(request,{limitBytes:8192}),id);
   else if(request.method==='POST'&&path==='/own/card')result=await ctx.operations.startCard(ctx.identity,await readJsonBody(request,{limitBytes:8192}),id);
   else if(request.method==='POST'&&path==='/own/card/reconcile')result=await ctx.operations.reconcileCard(ctx.identity,(await readJsonBody(request,{limitBytes:8192})).attempt_id);
   else if(request.method==='POST'&&path==='/own/card/resume')result=await ctx.operations.resumeCard(ctx.identity,(await readJsonBody(request,{limitBytes:8192})).attempt_id);
   else if(request.method==='POST'&&path==='/own/zelle/report')result=await ctx.operations.reportZelle(ctx.identity,await readJsonBody(request,{limitBytes:8192}),id);
   else throw fail('QA action unavailable',404);
  }
  response.writeHead(200,{'content-type':'application/json; charset=utf-8','cache-control':'no-store, private',vary:'Authorization, Cookie','x-content-type-options':'nosniff'});response.end(JSON.stringify(result));return true;
 };
}
