import {createHash} from 'node:crypto';
import {isIP} from 'node:net';
import {AppError} from './errors.mjs';
import {createRiseReadTransport,validProgramId} from './owner-wire.mjs';
import {projectResearchCoverage} from './research-standard.mjs';

const invalid=()=>new AppError(503,'invalid_owner_response','Current program identity could not be verified.');
const text=(x,max,empty=false)=>typeof x==='string' && x.length<=max && (empty||x.trim().length>0) && !/[\u0000-\u001f\u007f]/.test(x);
function identity(value,release,labels=false) {
  if(!value || Object.getPrototypeOf(value)!==Object.prototype || !validProgramId(value.id) ||
    !text(value.name,500) || !text(value.track,300,true) || !text(value.registryReleaseId,180) ||
    release && value.registryReleaseId!==release)throw invalid();
  // Only the reviewed optional public registry labels cross search results.
  // Detail stays four fields: retained LOI program snapshots/digests are unchanged.
  const publicLabels={specialty:null,acgmeId:null};
  for(const key of ['specialty','acgmeId'])if(Object.hasOwn(value,key)){
    const item=value[key];
    if(item!==null&&(key==='specialty'?!text(item,180):typeof item!=='string'||!/^\d{10}$(?![\s\S])/.test(item)))throw invalid();
    publicLabels[key]=item;
  }
  return {id:value.id,name:value.name,track:value.track,registryReleaseId:value.registryReleaseId,...(labels?publicLabels:{})};
}
export function createRiseOwner(config={},dependencies={}) {
  const request=createRiseReadTransport(config,dependencies);
  const now=dependencies.now??Date.now;
  return Object.freeze({
    async getProgram(actor,id) {
      const result=identity(await request(actor,{kind:'detail',id}));
      if(result.id!==id)throw invalid();return result;
    },
    async getResearchCoverage(actor,id) {
      const unavailable=()=>new AppError(503,'research_coverage_unavailable','Current research coverage is unavailable. Your saved work is unchanged.');
      if(config.researchCoverageEnabled!==true)throw unavailable();
      // One authenticated snapshot supplies both registry identity and coverage.
      // Do not combine identities or timestamps from separate owner requests.
      const result=await request(actor,{kind:'detail',id});
      try{
        const program=identity(result);
        if(program.id!==id)throw invalid();
        return projectResearchCoverage({program,coverage:result.researchCoverage,now:now()});
      }catch{throw unavailable();}
    },
    async getProgramResearch(actor,id){
      if(config.researchResultsEnabled!==true)throw invalid();
      const result=await request(actor,{kind:'detail',id}),program=identity(result);
      if(program.id!==id)throw invalid();
      return projectProgramResearch(result.researchResults,program,now());
    },
    async searchPrograms(actor,query={}) {
      const result=await request(actor,{kind:'search',query});
      if(!result || !text(result.registryReleaseId,180) || !Array.isArray(result.programs) ||
        result.programs.length>(query.pageSize??20) || result.page!==(query.page??1) ||
        !Number.isSafeInteger(result.total) || result.total<result.programs.length || result.total>10000000)throw invalid();
      const programs=result.programs.map(p=>identity(p,result.registryReleaseId,true));
      if(new Set(programs.map(p=>p.id)).size!==programs.length)throw invalid();
      return {registryReleaseId:result.registryReleaseId,programs,page:result.page,total:result.total};
    },
  });
}

// Consumer reconstruction: only the reviewed public result fields cross into IIQ.
export function projectProgramResearch(input,program,now=Date.now()){
 const need=x=>{if(!x)throw invalid();},sha=x=>createHash('sha256').update(x).digest('hex');
 const plain=x=>x&&Object.getPrototypeOf(x)===Object.prototype;
 const instant=x=>{need(typeof x==='string'&&Number.isFinite(Date.parse(x))&&new Date(x).toISOString()===x);return x;};
 const ref=x=>typeof x==='string'&&/^rise-(?:claim|review):[a-f0-9]{64}$(?![\s\S])/.test(x);
 const url=x=>{need(text(x,2048)&&!/[\u0000-\u0020\u007f]/.test(x));let u;try{u=new URL(x);}catch{throw invalid();}const host=u.hostname.replace(/^\[|\]$/g,'').toLowerCase();need(u.protocol==='https:'&&!u.username&&!u.password&&!isIP(host)&&host.includes('.')&&!host.endsWith('.')&&(!u.port||u.port==='443')&&!/(^|\.)(localhost|localdomain|local|internal|test|invalid|example|lan|home|private|home\.arpa)$/.test(host));return x;};
 function value(x,depth=0){need(depth<=6);if(x===null||typeof x==='boolean')return x;if(typeof x==='number'){need(Number.isFinite(x));return x;}if(typeof x==='string'){need(text(x,8000,true));return x;}if(Array.isArray(x)){need(x.length<=100);return x.map(v=>value(v,depth+1));}need(plain(x)&&Object.keys(x).length<=60);return Object.fromEntries(Object.entries(x).map(([k,v])=>{const n=k.replace(/([A-Z]+)([A-Z][a-z])/g,'$1_$2').replace(/([a-z0-9])([A-Z])/g,'$1_$2').replace(/[^A-Za-z0-9]+/g,'_');need(text(k,100,true)&&!['__proto__','constructor','prototype'].includes(k)&&!/(?:^|_)(?:private|secret|token|password|prompt|raw|owner|student_id|wp_user_id|subject_key|metadata)(?:_|$)/i.test(n));return [k,value(v,depth+1)];}));}
 need(plain(input)&&input.schema==='rise-interviewiq-research-results-v1');
 const validated=projectResearchCoverage({program:{...program,track:program.track||'unspecified'},coverage:input.coverage,now}).coverage;
 // Preserve the wire's canonical key order when checking the result digest.
 const coverage={programId:validated.programId,registryReleaseId:validated.registryReleaseId,observedAt:validated.observedAt,fields:validated.fields,receipt:{sha256:validated.receipt.sha256,publicRef:validated.receipt.publicRef}};
 const observed=Date.parse(coverage.observedAt);need(Array.isArray(input.facts)&&input.facts.length<=21);const seen=new Set();
 const facts=input.facts.map(f=>{need(plain(f)&&!seen.has(f.field));seen.add(f.field);const field=coverage.fields.find(r=>r.field===f.field);need(field?.state==='SUPPORTED'&&f.state==='SUPPORTED'&&f.area===field.area&&ref(f.claimRef)&&Array.isArray(f.sources)&&f.sources.length>0&&f.sources.length<=16);const v=value(f.value);need(v!==null&&Buffer.byteLength(JSON.stringify(v))<=16384);const retrievedAt=instant(f.retrievedAt);need(Date.parse(retrievedAt)<=observed);let asOf=null;if(f.asOf!==null){need(plain(f.asOf)&&text(f.asOf.kind,80,true)&&text(f.asOf.label,120,true));asOf={kind:f.asOf.kind,label:f.asOf.label};}
  const sources=f.sources.map(s=>{need(plain(s)&&ref(s.claimRef)&&(s.reviewRef===null||ref(s.reviewRef))&&Array.isArray(s.urls)&&s.urls.length>0&&s.urls.length<=8);const urls=[...new Set(s.urls.map(url))],retrievedAt=instant(s.retrievedAt),reviewedAt=s.reviewedAt===null?null:instant(s.reviewedAt);need(Date.parse(retrievedAt)<=observed&&(reviewedAt===null||Date.parse(reviewedAt)<=observed));return {claimRef:s.claimRef,reviewRef:s.reviewRef,urls,retrievedAt,reviewedAt};});
  return {area:field.area,field:field.field,state:'SUPPORTED',claimRef:f.claimRef,value:v,retrievedAt,asOf,sources};});
 const body={schema:input.schema,coverage,facts};need(Buffer.byteLength(JSON.stringify(body))<=196608&&input.receipt?.publicRef==='rise-results-v1'&&input.receipt.sha256===sha(JSON.stringify(body)));return {...body,receipt:{publicRef:'rise-results-v1',sha256:input.receipt.sha256}};
}
