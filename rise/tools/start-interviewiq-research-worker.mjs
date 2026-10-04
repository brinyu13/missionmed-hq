import {randomUUID} from 'node:crypto';

const failure=code=>Object.assign(Error('InterviewIQ research execution unavailable'),{code});
// Deliberately no automatic poller, followup or CLI activation. Production
// composition must supply the frozen one-job store and current proof capability.
export async function runInterviewiqResearchWorkerOnce({store,provider,getProof,workerId=randomUUID(),heartbeatMs=5000}={}) {
 if(typeof getProof!=='function'||!store||typeof store.claim!=='function')throw failure('IIQ_EXECUTION_UNAVAILABLE');
 const claim=await store.claim({proof:await getProof('start'),workerId});
 if(!claim||claim.mode==='BUSY'||claim.mode==='RECONCILIATION_REQUIRED'||claim.mode==='COMPLETED')return claim;
 if(!['SEND','RECOVER'].includes(claim.mode))throw failure('IIQ_EXECUTION_UNAVAILABLE');
 const controller=new AbortController();let timer,pending,heartbeatError;
 const stop=async()=>{clearInterval(timer);if(pending)await pending;if(heartbeatError)throw heartbeatError;};
 const heartbeat=()=>{
  if(pending||heartbeatError)return;
  pending=Promise.resolve().then(()=>store.heartbeat(claim)).catch(error=>{heartbeatError=error;controller.abort();}).finally(()=>{pending=null;});
 };
 try {
  await store.heartbeat(claim);
  timer=setInterval(heartbeat,Math.max(10,Math.min(10000,Number(heartbeatMs)||5000)));
  if(claim.mode==='SEND') {
   if(provider?.providerKey!==claim.job.providerKey||provider?.modelKey!==claim.job.modelKey||typeof provider.execute!=='function')throw failure('IIQ_PROVIDER_MISMATCH');
   // Only this invocation's freshly committed claim can return SEND. Any
   // re-entry sees retained DISPATCHED state and refuses another network call.
   await provider.execute({job:claim.job,recovery:{signal:controller.signal,checkpointResponse:record=>store.captureRaw(claim,record)}});
  }
  await stop();
  if(controller.signal.aborted)throw failure('IIQ_EXECUTION_LEASE_LOST');
  const proof=await getProof('publish');
  return await store.complete(claim,{proof});
 } catch(error) {
  controller.abort();try{await stop();}catch{}
  const code=typeof error?.code==='string'&&/^[A-Z0-9_]{1,64}$/.test(error.code)?error.code:'IIQ_EXECUTION_FAILED';
  try{await store.quarantine(claim,{code});}catch{}
  // No generic failJob, zero refund, retry, followup or raw provider error text.
  const safe=failure(code);if(Number.isInteger(error?.httpStatus))safe.httpStatus=error.httpStatus;throw safe;
 } finally {clearInterval(timer);controller.abort();}
}
