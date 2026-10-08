// Default-off, request-local diagnostics for the existing synthetic canary only.
// No session/proof/signature/credential/raw nonce is retained or emitted.
import {AsyncLocalStorage} from 'node:async_hooks';
const OWNER='c94abcfb-dfda-4c74-9a27-f58fcf56f9b2',uuid=x=>typeof x==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(x),hex=x=>typeof x==='string'&&/^[a-f0-9]{64}$/.test(x);
export function createOwnerReadReceipts({enabled=false}={}){
 const local=new AsyncLocalStorage();
 return Object.freeze({
  async run(actor,req,operation,command=null){const trace=req.headers?.['x-iiq-request-id'];if(enabled!==true||actor?.id!==OWNER||actor.wpUserId!==1397||actor.role!=='student'||actor.tier!=='ivprep_complete'||actor.eligible!==true||!(req.method==='GET'&&command===null&&['/api/bootstrap','/api/programs'].includes(new URL(req.url,'http://localhost').pathname)||req.method==='POST'&&new URL(req.url,'http://localhost').pathname==='/api/commands'&&['interview.create','research.check'].includes(command))||!uuid(trace))return operation();
   const context={actor,trace,command,apiPath:new URL(req.url,'http://localhost').pathname,requests:[]};return local.run(context,async()=>{const value=await operation();return {...value,ownerReadReceipts:{schema:'iiq-owner-read-receipts-v1',callerTrace:trace,apiPath:context.apiPath,command:context.command,actorId:actor.id,wpUserId:1397,requests:context.requests}};});
  },
  activeFor(actor){return local.getStore()?.actor===actor;},
  record(actor,{nonceSha256,requestSha256,method,path}){const c=local.getStore();if(!c)return;if(actor?.id!==c.actor.id||actor.wpUserId!==c.actor.wpUserId||actor.role!==c.actor.role||actor.tier!==c.actor.tier||actor.eligible!==true||!hex(nonceSha256)||!hex(requestSha256)||method!=='GET'||typeof path!=='string'||path.length>2048||!/^\/api\/rise\/v1\/interviewiq\/(?:programs(?:\?|\/)|saved-programs\?)/.test(path)||c.requests.length>=(c.command==='interview.create'?4:c.command==='research.check'?3:1))throw Error('owner_read_receipt_unavailable');c.requests.push({issuer:'interviewiq',nonceSha256,requestSha256,method,path});}
 });
}
