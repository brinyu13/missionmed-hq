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

// Resolve the default from the authorized registry, never an invented identity.
// Explicit selection/opt-out and retries always win.
export async function resolveGeneralProgram(account,{selected=null,disabled=false,isCurrent=()=>true}={}) {
  if(disabled)return {program:null,state:'disabled'};
  if(selected?.verified&&selected.programId&&selected.programReleaseId)return {program:selected,state:'selected'};
  const result=await searchPrograms(account,{q:'SUNY Upstate',specialty:'Internal Medicine',jurisdiction:'NY'});
  if(!isCurrent())return {program:null,state:'cancelled'};
  // Reject ambiguity/truncation. The server re-resolves identity at session start.
  const matches=result.rows.filter(p=>p.verified&&/\bsuny\b/i.test(p.name)&&/\bupstate\b/i.test(p.name)&&
    !/\bdownstate\b/i.test(p.name)&&/^internal medicine$/i.test(p.specialty.trim())&&
    /^(NY|New York)$/i.test(String(p.raw?.state||'').trim()));
  const unique=new Map(matches.map(p=>[p.programId,p]));
  return unique.size===1&&result.totalPages===1
    ?{program:[...unique.values()][0],state:'default'}
    :{program:null,state:unique.size>1||result.totalPages>1?'ambiguous':'unavailable'};
}
