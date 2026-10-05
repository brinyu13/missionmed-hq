import {RESEARCH_PROOF_PATH} from './research-job-runtime.mjs';
import {deepResearchEnabled} from './research-dispatch.mjs';
import {createHash,randomUUID,timingSafeEqual} from 'node:crypto';
import {AppError,requireValue} from './errors.mjs';
import {jsonBody} from './validation.mjs';
import {UUID} from './auth.mjs';
import {researchEnabled,requireResearch} from './research-workspace.mjs';
import {loiCanonicalLookup,loiProgramAllowed} from './private-commands.mjs';

function secretEquals(a,b) {
  if(typeof a!=='string' || typeof b!=='string' || b.length<32 || a.length>1024)return false;
  return timingSafeEqual(createHash('sha256').update(a).digest(),createHash('sha256').update(b).digest());
}
export function publicError(error) {
  if(error instanceof AppError)return error;
  if(['23505','40001','40P01','55P03'].includes(error?.code))return new AppError(409,'write_conflict','This record changed. Refresh and try again; your unsaved text is kept.');
  if(['23503','23514','22P02','22007','22008'].includes(error?.code))return new AppError(422,'invalid_record','This change does not satisfy the record requirements. Review the submitted values.');
  if(error?.code==='42501')return new AppError(403,'access_denied','This action is not available for your current access.');
  return new AppError(503,'service_unavailable','This operation could not be completed. Your unsaved text is kept. Please retry.');
}
export function createHandler({config,database,authorize,commands,owners,recordings=null,researchProof=null,logger=()=>{}}) {
  return async function handle(req,res) {
    const requestId=randomUUID();
    const send=(status,value)=>{
      if(res.destroyed || res.writableEnded)return;
      const body=JSON.stringify(value);
      res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Content-Length':Buffer.byteLength(body),
        'Cache-Control':'private, no-store','Pragma':'no-cache','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer',
        'Content-Security-Policy':"default-src 'none'; frame-ancestors 'none'",'X-Request-ID':requestId});
      res.end(body);
    };
    let path='unparsed';
    try {
      requireValue(typeof req.url==='string' && req.url.startsWith('/') && !req.url.startsWith('//') && req.url.length<=2048,'invalid_path','This path is invalid.',400);
      const url=new URL(req.url,'http://localhost');path=url.pathname;
      requireValue(!/%|\\|\.\./.test(path) && !path.includes('//'),'invalid_path','This path is invalid.',400);
      if(req.method==='GET' && (path==='/healthz'||path==='/readyz')) {
        requireValue(!url.search,'invalid_query','This query is invalid.',400);
        if(path==='/readyz' && (!config.enabled || !database || !await database.health()))throw new AppError(503,'not_ready','InterviewIQ is not ready.');
        return send(200,{service:'interviewiq',status:config.enabled?'ready':'disabled',release:config.release});
      }
      if(!config.enabled)throw new AppError(503,'feature_unavailable','InterviewIQ is not available yet.');
      if(path===RESEARCH_PROOF_PATH){if(!researchProof||req.method!=='POST'||req.url!==RESEARCH_PROOF_PATH)return send(503,{error:'research_authority_unavailable'});const result=await researchProof.handle(req);return send(result.status,result.body);}
      requireValue(secretEquals(req.headers['x-mmed-iiq-gateway'],config.gatewaySecret),'gateway_required','Use the MissionMed InterviewIQ entry.',403);
      requireValue(req.headers.origin===config.publicOrigin && !req.headers.cookie,'origin_denied','This request did not come through the authorized entry.',403);
      const route=resolveRoute(req.method,path,url);
      const actor=await authorize(req,`${req.method} ${path}`);
      if(config.coreOnly) {
        requireValue(actor.role==='admin' || (actor.role==='student' && ['360','ivprep_complete'].includes(actor.tier)), 'core_access_required','InterviewIQ is not available for your current access.',403);
        requireValue(route==='bootstrap' || route==='commands'||route==='programs'&&(researchEnabled(config,actor)||deepResearchEnabled(config,actor)||loiCanonicalLookup(config,actor)),'coming_soon','COMING SOON — this integration is not active. Your saved calendar is unchanged.',503);
      }
      if(route==='bootstrap')return send(200,await commands.bootstrap(actor));
      if(route==='programs'){
        const loiLookup=loiCanonicalLookup(config,actor);
        if(config.researchMissionsEnabled===true&&!loiLookup)requireResearch(config,actor);
        const result=await owners.searchPrograms(actor,{q:url.searchParams.get('q')||''});
        // LOI-only registry access cannot expose a configured-out program.
        if(loiLookup&&!researchEnabled(config,actor)&&!deepResearchEnabled(config,actor)&&config.loi.programId){const programs=result.programs.filter(p=>loiProgramAllowed(config,actor,p.id));return send(200,{...result,programs,total:programs.length});}
        return send(200,result);
      }
      if(route==='commands')return send(200,await commands.execute(actor,await jsonBody(req,config.maxBodyBytes),{revalidateActor:()=>authorize(req,`${req.method} ${path}`)}));
      if(!recordings)throw new AppError(503,'speech_unavailable','Speech capture is unavailable. You can keep typing your private debrief.');
      const id=path.split('/')[3];
      if(route==='recording-status')return send(200,await recordings.status(actor,id));
      const body=await jsonBody(req,route==='recording-segment'?1572864:16384);
      if(route==='recording-start')return send(200,await recordings.create(actor,body));
      const freshness={revalidateActor:()=>authorize(req,`${req.method} ${path}`)};
      if(route==='recording-segment')return send(200,await recordings.segment(actor,id,body,freshness));
      return send(200,await recordings.action(actor,id,route.slice('recording-'.length),body,freshness));
    } catch(error) {
      const safe=publicError(error);
      // Never log request bodies, authorization, SQL detail or provider content.
      logger({requestId,method:req.method,path,status:safe.status,code:safe.code});
      send(safe.status,{error:{code:safe.code,message:safe.message,...(safe.details?{details:safe.details}:{})},requestId});
    }
  };
}
function resolveRoute(method,path,url) {
  if(method==='GET' && path==='/api/programs') {
    const keys=[...url.searchParams.keys()];
    requireValue(keys.length<=1 && keys.every(k=>k==='q') && (url.searchParams.get('q')||'').length<=256,'invalid_query','Enter a program search of up to 256 characters.',400);
    return 'programs';
  }
  requireValue(!url.search,'invalid_query','This endpoint does not accept a query.',400);
  if(method==='GET' && path==='/api/bootstrap')return 'bootstrap';
  if(method==='POST' && path==='/api/commands')return 'commands';
  if(method==='POST' && path==='/api/recordings')return 'recording-start';
  const parts=path.split('/');
  if(parts.length>=4 && parts[1]==='api' && parts[2]==='recordings' && UUID.test(parts[3])) {
    if(method==='GET' && parts.length===4)return 'recording-status';
    if(method==='POST' && parts.length===5 && ['segments','pause','resume','finish','cancel','retry'].includes(parts[4]))return parts[4]==='segments'?'recording-segment':`recording-${parts[4]}`;
  }
  throw new AppError(404,'not_found','This endpoint is not available.');
}
