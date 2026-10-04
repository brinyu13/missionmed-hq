import {createInterviewiqJobAuthenticator,createCommittedResearchProof,exactJobId,jobBounded} from '../adapters/interviewiq-job-auth.mjs';

const STATUSES=new Set(['QUEUED','LEASED','RUNNING','NORMALIZING','PROMOTING','NEEDS_REVIEW','COMPLETED','PARTIAL','FAILED','REFUNDED','CANCELLED','PAUSED','NO_OP']);
const deny=()=>{throw Error('interviewiq_job_unavailable');};

// Intentionally unmounted. No default store, fake actor, quota bypass or provider
// adapter. Production must supply independently qualified atomic acceptance.
export function createInterviewiqResearchJobs(config={},dependencies={}) {
  const authenticate=createInterviewiqJobAuthenticator(config,dependencies);
  const prove=createCommittedResearchProof(config,dependencies);
  const {getRegistry,assertSourceRights,acceptJob}=dependencies;
  return async request=>{
    const deadline=performance.now()+10000;
    const current=()=>{if(performance.now()>=deadline)deny();};
    async function registry(binding) {
      current();const before=await assertSourceRights();current();if(before?.current!==true)deny();
      const index=await getRegistry();current();
      if(index?.registryReleaseId!==binding.registryReleaseId||!Array.isArray(index.programs)||
        index.programs.filter(p=>p?.programSpecialtyId===binding.programId).length!==1)deny();
      const after=await assertSourceRights();current();if(after?.current!==true)deny();
    }
    try {
      if(config.enabled!==true||[getRegistry,assertSourceRights,acceptJob].some(x=>typeof x!=='function'))deny();
      return await jobBounded(async()=>{
        const auth=await authenticate(request);current();
        await registry(auth.binding);auth.assertFresh();
        const proof=await prove({binding:auth.binding,bodyHash:auth.bodyHash,phase:'reserve'});current();
        await registry(auth.binding);proof.assertFresh();auth.assertFresh();current();
        const result=await acceptJob({ownerId:auth.binding.ownerId,requestId:auth.binding.requestId,bodyHash:auth.bodyHash,binding:auth.binding});
        current();await registry(auth.binding);proof.assertFresh();auth.assertFresh();current();
        if(!result||!STATUSES.has(result.status)||!(exactJobId(result.jobId)||result.status==='NO_OP'&&result.jobId===null))deny();
        const body=auth.signReceipt({status:result.status,jobId:result.jobId,proofExpiresAt:proof.expiresAt});
        return {status:200,headers:{'Cache-Control':'no-store'},body};
      },10000);
    } catch {return {status:503,headers:{'Cache-Control':'no-store'},body:{error:'interviewiq_job_unavailable'}};}
  };
}
