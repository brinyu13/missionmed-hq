import {createInterviewiqAuthenticator,validProgramId} from '../adapters/interviewiq-auth.mjs';
import {projectInterviewiqResearchResults} from '../adapters/interviewiq-research-results.mjs';
import {projectInterviewiqCoverage} from '../adapters/interviewiq-coverage.mjs';

const clean=(x,max,empty=false)=>typeof x==='string'&&x.length<=max&&(empty||x.trim().length>0)&&!/[\u0000-\u001f\u007f]/.test(x);
function identity(record,release) {
  if(!validProgramId(record?.programSpecialtyId)||!clean(record?.display?.programName,500))throw new Error('invalid_registry');
  // Track is unknown unless the canonical registry explicitly supplies it.
  const track=record.display.track??'';
  if(!clean(track,300,true))throw new Error('invalid_registry');
  const specialty=record.designation??null;
  if(specialty!==null&&!clean(specialty,180))throw new Error('invalid_registry');
  if(record.identifiers!=null&&!Array.isArray(record.identifiers))throw new Error('invalid_registry');
  const codes=(record.identifiers??[]).filter(x=>x?.namespace==='ACGME_PROGRAM');
  if(codes.length>1)throw new Error('invalid_registry');
  const acgmeId=codes[0]?.value??null;
  if(codes.length&&!(typeof acgmeId==='string'&&/^[0-9]{10}$/.test(acgmeId)))throw new Error('invalid_registry');
  return {id:record.programSpecialtyId,name:record.display.programName,track,registryReleaseId:release,specialty,acgmeId};
}

// Intentionally unmounted. Composition must supply current canonical registry,
// strict current source-rights and a durable nonce store before enabling it.
export function createInterviewiqOwner(config={},dependencies={}) {
  const authenticate=createInterviewiqAuthenticator(config,dependencies);
  const {getRegistry,assertSourceRights,readCoverage,readResults,now=Date.now}=dependencies;
  return async request=>{
    try {
      if(typeof getRegistry!=='function'||typeof assertSourceRights!=='function')throw new Error('unavailable');
      if(![undefined,false,true].includes(config.coverageEnabled)||![undefined,false,true].includes(config.resultsEnabled))throw new Error('unavailable');
      const auth=await authenticate(request);
      if((await assertSourceRights())?.current!==true)throw new Error('rights_unavailable');
      const index=await getRegistry();
      if(!clean(index?.registryReleaseId,180)||!Array.isArray(index.programs))throw new Error('registry_unavailable');
      const programs=index.programs.map(p=>identity(p,index.registryReleaseId));
      if(new Set(programs.map(p=>p.id)).size!==programs.length)throw new Error('duplicate_registry_identity');
      let body,status=200;
      if(auth.route.kind==='detail') {
        body=programs.find(p=>p.id===auth.route.id);
        if(!body){status=404;body={error:'program_not_found'};}
        else if(config.coverageEnabled===true){
          if(typeof readCoverage!=='function')throw new Error('unavailable');
          let timer;
          try{
            const coverage=await Promise.race([readCoverage({programId:body.id,registryReleaseId:index.registryReleaseId}),
              new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error('unavailable')),5000);})]);
            body={...body,researchCoverage:projectInterviewiqCoverage(coverage,{programId:body.id,registryReleaseId:index.registryReleaseId,now:now()})};
          }finally{clearTimeout(timer);}
        }
        if(status===200&&config.resultsEnabled===true){
          if(typeof readResults!=='function')throw new Error('unavailable');let timer;
          try{const results=await Promise.race([readResults({programId:body.id,registryReleaseId:index.registryReleaseId}),new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error('unavailable')),5000);})]);
            body={...body,researchResults:projectInterviewiqResearchResults(results,{programId:body.id,registryReleaseId:index.registryReleaseId,now:now()})};
          }finally{clearTimeout(timer);}
        }
      } else {
        const {q,page,pageSize}=auth.route;
        const matches=programs.filter(p=>`${p.id} ${p.name} ${p.track} ${p.specialty??''} ${p.acgmeId??''}`.toLowerCase().includes(q.toLowerCase()))
          .sort((a,b)=>a.name.localeCompare(b.name)||a.id.localeCompare(b.id));
        body={registryReleaseId:index.registryReleaseId,page,total:matches.length,programs:matches.slice((page-1)*pageSize,page*pageSize)};
      }
      if((await assertSourceRights())?.current!==true)throw new Error('rights_unavailable');
      await auth.recheck();
      if((await assertSourceRights())?.current!==true)throw new Error('rights_unavailable');
      auth.assertFresh();
      return {status,headers:{'Cache-Control':'no-store'},body};
    } catch {return {status:503,headers:{'Cache-Control':'no-store'},body:{error:'interviewiq_owner_unavailable'}};}
  };
}
