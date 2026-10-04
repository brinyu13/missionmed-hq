import {AppError} from './errors.mjs';
import {createRiseReadTransport,validProgramId} from './owner-wire.mjs';

const invalid=()=>new AppError(503,'invalid_owner_response','Current program identity could not be verified.');
const text=(x,max,empty=false)=>typeof x==='string' && x.length<=max && (empty||x.trim().length>0) && !/[\u0000-\u001f\u007f]/.test(x);
function identity(value,release) {
  if(!value || Object.getPrototypeOf(value)!==Object.prototype || !validProgramId(value.id) ||
    !text(value.name,500) || !text(value.track,300,true) || !text(value.registryReleaseId,180) ||
    release && value.registryReleaseId!==release)throw invalid();
  // Evidence and arbitrary owner metadata are intentionally excluded until the
  // separately reviewed provenance/publication projection is wired.
  return {id:value.id,name:value.name,track:value.track,registryReleaseId:value.registryReleaseId};
}
export function createRiseOwner(config={},dependencies={}) {
  const request=createRiseReadTransport(config,dependencies);
  return Object.freeze({
    async getProgram(actor,id) {
      const result=identity(await request(actor,{kind:'detail',id}));
      if(result.id!==id)throw invalid();return result;
    },
    async searchPrograms(actor,query={}) {
      const result=await request(actor,{kind:'search',query});
      if(!result || !text(result.registryReleaseId,180) || !Array.isArray(result.programs) ||
        result.programs.length>(query.pageSize??20) || result.page!==(query.page??1) ||
        !Number.isSafeInteger(result.total) || result.total<result.programs.length || result.total>10000000)throw invalid();
      const programs=result.programs.map(p=>identity(p,result.registryReleaseId));
      if(new Set(programs.map(p=>p.id)).size!==programs.length)throw invalid();
      return {registryReleaseId:result.registryReleaseId,programs,page:result.page,total:result.total};
    },
  });
}
