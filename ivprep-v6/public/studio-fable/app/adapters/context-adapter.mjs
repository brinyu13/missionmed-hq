// RISE owns program identities/intelligence. IVOC consumes its authorized projection.
const ENGINE='/iv-prep-on-call/assets';
export async function searchPrograms(account,{q='',specialty='',jurisdiction='',programType='',page=1}={}) {
  if(account?.mode!=='REAL'||!account.durable?.ready) throw new Error('Sign in through Matrix to search programs.');
  const result=await account.durable.programs({q,specialty,jurisdiction,programType,page});
  const release=result.registryReleaseId;
  const rows=(result.records||[]).map(p=>({
    id:p.programId||p.id,programId:p.programId||p.id,programReleaseId:release,
    name:p.name||p.programName,city:[p.city,p.state].filter(Boolean).join(', '),specialty:p.specialty||'',
    verified:Boolean((p.programId||p.id)&&release),fixture:false,matters:p.highlights||[],attention:[],facts:[],provenance:'RISE',raw:p
  }));
  return {source:'rise',rows,total:result.total??rows.length,page:result.page||page,totalPages:result.totalPages||1};
}
export async function liveContext(options) {
  const {createLiveContext}=await import(ENGINE+'/studio/live-context-adapter.mjs');
  return createLiveContext(options);
}
