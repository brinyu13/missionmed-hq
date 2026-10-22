import {performance} from 'node:perf_hooks';
import {createCalendarDirectory,readCalendarRoster,readCalendarStudent,readCalendarOverview} from './calendar-directory.mjs';
import {calendarEnabled,requireCalendar,createCalendarAdmission} from './calendar-admission.mjs';
import {readCohort,cohortRange} from './calendar-cohort.mjs';
import {readOwnerSession} from './owner-session.mjs';
import {readAdminLogistics,writeAdminLogistics} from './calendar-admin.mjs';
import {uploadItinerary,listItineraries,downloadItinerary,withdrawItinerary} from './calendar-itinerary.mjs';
import {emptyStudentPreview} from './calendar-preview.mjs';
import {intakeEnabled} from './interview-intake.mjs';
import {MRX_PROOF_PATH} from './mrx-contract.mjs';
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
export function createHandler({config,database,authorize,commands,owners,recordings=null,researchProof=null,ownerReadReceipts=null,logger=()=>{},calendarAdmission=null,calendarDirectory=null}) {
  const admit=calendarAdmission||createCalendarAdmission(config),directory=calendarDirectory||createCalendarDirectory(config);
  return async function handle(req,res) {
    const requestId=randomUUID(),requestStarted=performance.now();
    let calendarTimings=null;
    const measure=async(stage,operation)=>{
      if(!calendarTimings)return operation();
      const started=performance.now();
      try{return await operation();}finally{calendarTimings[stage].count++;calendarTimings[stage].ms+=performance.now()-started;}
    };
    const send=(status,value)=>{
      if(res.destroyed || res.writableEnded)return;
      const body=JSON.stringify(value);
      const stages=calendarTimings?Object.fromEntries(Object.entries(calendarTimings).map(([stage,value])=>[stage,{count:value.count,ms:Math.round(value.ms*10)/10}])):null;
      const totalMs=stages?Math.round((performance.now()-requestStarted)*10)/10:null;
      const headers={'Content-Type':'application/json; charset=utf-8','Content-Length':Buffer.byteLength(body),
        'Cache-Control':'private, no-store','Pragma':'no-cache','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer',
        'Content-Security-Policy':"default-src 'none'; frame-ancestors 'none'",'X-Request-ID':requestId};
      // Fixed aggregate spans only. Nested spans overlap; they are not additive.
      if(status===200&&stages&&[totalMs,...Object.values(stages).map(x=>x.ms)].every(ms=>Number.isFinite(ms)&&ms>=0&&ms<=99999.9)){
        headers['Server-Timing']=[...Object.entries(stages).map(([stage,value])=>`iiq_${stage};dur=${value.ms.toFixed(1)}`),`iiq_total;dur=${totalMs.toFixed(1)}`].join(', ');
      }
      res.writeHead(status,headers);
      res.end(body);
      if(calendarTimings){
        calendarTimings=null;
        // Fixed names/durations only; no identity, range, payload, headers or SQL.
        try{logger({event:path==='/api/bootstrap'?'calendar_bootstrap_timing':'calendar_read_timing',requestId,method:'GET',path,status,totalMs,stages});}catch{}
      }
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
      if([RESEARCH_PROOF_PATH,MRX_PROOF_PATH].includes(path)){if(!researchProof||req.method!=='POST'||req.url!==path)return send(503,{error:'research_authority_unavailable'});const result=await researchProof.handle(req);return send(result.status,result.body);}
      requireValue(secretEquals(req.headers['x-mmed-iiq-gateway'],config.gatewaySecret),'gateway_required','Use the MissionMed InterviewIQ entry.',403);
      requireValue(req.headers.origin===config.publicOrigin && !req.headers.cookie,'origin_denied','This request did not come through the authorized entry.',403);
      const route=resolveRoute(req.method,path,url);
      if(route==='bootstrap'&&url.searchParams.has('start')||route==='calendar-overview'||route==='calendar-cohort')calendarTimings=Object.fromEntries(['owner','cohort','own','admission','directory'].map(stage=>[stage,{count:0,ms:0}]));
      const actor=await measure('owner',()=>authorize(req,`${req.method} ${path}`));
      if(config.coreOnly) {
        requireValue(actor.role==='admin' || (actor.role==='student' && ['360','ivprep_complete'].includes(actor.tier)), 'core_access_required','InterviewIQ is not available for your current access.',403);
        requireValue(route==='bootstrap' || route==='commands'||route==='student-preview'||route.startsWith('calendar-')&&calendarEnabled(config,actor)||route.startsWith('itinerary-')&&calendarEnabled(config,actor)||route==='programs'&&(researchEnabled(config,actor)||deepResearchEnabled(config,actor)||loiCanonicalLookup(config,actor)||intakeEnabled(config,actor)),'coming_soon','COMING SOON — this integration is not active. Your saved calendar is unchanged.',503);
      }
      requireValue(!req.headers['x-iiq-student-preview']||route==='student-preview','student_preview_restricted','Student Preview cannot read or save private work.',403);
      if(route==='student-preview'){requireCalendar(config,actor);return send(200,emptyStudentPreview(actor));}
      const calendarContext={database,actor,config,owners,admit:(...args)=>measure('admission',()=>admit(...args)),directory:(...args)=>measure('directory',()=>directory(...args)),eventRef:path.split('/')[4],interviewId:path.split('/')[3],attachmentId:path.split('/')[5],targetRef:req.headers['x-iiq-calendar-target']};
      if(route==='calendar-roster')return send(200,await readCalendarRoster(calendarContext,Object.fromEntries(url.searchParams)));
      if(route==='calendar-student')return send(200,await readCalendarStudent(calendarContext,path.split('/')[4]));
      if(route==='calendar-overview')return send(200,await measure('cohort',()=>readCalendarOverview(calendarContext,Object.fromEntries(url.searchParams))));
      if(route==='calendar-cohort')return send(200,await measure('cohort',()=>readCohort({...calendarContext,input:Object.fromEntries(url.searchParams)})));
      if(route==='calendar-admin-read')return send(200,await readAdminLogistics(calendarContext));
      if(route==='calendar-admin-write')return send(200,await writeAdminLogistics(calendarContext,await jsonBody(req,config.maxBodyBytes)));
      if(route==='itinerary-upload')return send(200,await uploadItinerary(calendarContext,req));
      if(route==='itinerary-list')return send(200,await listItineraries(calendarContext));
      if(route==='itinerary-withdraw')return send(200,await withdrawItinerary(calendarContext,await jsonBody(req,16384)));
      if(route==='itinerary-download'){const f=await downloadItinerary(calendarContext);res.writeHead(200,f.headers);return res.end(f.bytes);}
      if(route==='bootstrap'){
        const options={calendarOnly:url.searchParams.get('view')==='calendar'},bootstrap=who=>ownerReadReceipts?ownerReadReceipts.run(who,req,()=>commands.bootstrap(who,options)):commands.bootstrap(who,options);
        if(!url.searchParams.has('start'))return send(200,await bootstrap(actor));
        requireValue(config.coreOnly&&calendarEnabled(config,actor),'calendar_unavailable','Calendar startup is unavailable.',503);requireCalendar(config,actor);const {start,end}=cohortRange({start:url.searchParams.get('start'),end:url.searchParams.get('end')}),range={start,end},kind=actor.role==='admin'?'overview':'cohort';
        let page;
        try{page=await measure('cohort',()=>kind==='overview'?readCalendarOverview(calendarContext,range):readCohort({...calendarContext,input:range}));}
        catch(error){
          const safe=publicError(error);if(safe.status===401||safe.status===403)throw safe;
          // Admission-unavailable may include revocation. Prove current owner access again
          // before returning any own-only fallback; never retry the failed cohort operation.
          const fresh=await measure('owner',()=>authorize(req,`${req.method} ${path}`));
          requireValue(['id','role','tier','wpUserId'].every(k=>fresh[k]===actor[k])&&readOwnerSession(fresh),'session_unavailable','Your current access changed. Reopen your workspace.',401);
          const own=await measure('own',()=>bootstrap(fresh));requireValue(readOwnerSession(fresh),'session_unavailable','Your current access expired. Reopen your workspace.',401);
          return send(200,{...own,calendarBundle:{kind,start:range.start,end:range.end,actor:{id:fresh.id,role:fresh.role,tier:fresh.tier},error:{code:'calendar_bundle_partial',message:'The shared Calendar did not finish loading. Your personal interviews are available.'}}});
        }
        requireValue(readOwnerSession(actor),'session_unavailable','Your current access expired. Reopen your workspace.',401);
        const own=await measure('own',()=>bootstrap(actor));requireValue(readOwnerSession(actor),'session_unavailable','Your current access expired. Reopen your workspace.',401);
        return send(200,{...own,calendarBundle:{kind,start:range.start,end:range.end,actor:{id:actor.id,role:actor.role,tier:actor.tier},page}});
      }
      if(route==='programs'){
        const loiLookup=loiCanonicalLookup(config,actor);
        if(config.researchMissionsEnabled===true&&!loiLookup&&!intakeEnabled(config,actor))requireResearch(config,actor);
        const search=()=>owners.searchPrograms(actor,{q:url.searchParams.get('q')||''});
        const result=await (ownerReadReceipts?ownerReadReceipts.run(actor,req,search):search());
        // LOI-only registry access cannot expose a configured-out program.
        if(!intakeEnabled(config,actor)&&loiLookup&&!researchEnabled(config,actor)&&!deepResearchEnabled(config,actor)&&config.loi.programId){const programs=result.programs.filter(p=>loiProgramAllowed(config,actor,p.id));return send(200,{...result,programs,total:programs.length});}
        return send(200,result);
      }
      if(route==='commands'){
        const maximum=config.maxBodyBytes,large=['myeras.preview','myeras.import'];
        // Count the actual raw bytes even after JSON decoding; non-import ceilings stay exact.
        let rawBytes=0;const counted={headers:req.headers,async *[Symbol.asyncIterator](){for await(const chunk of req){rawBytes+=chunk.length;yield chunk;}}};
        let body;try{body=await jsonBody(counted,1600000);}catch(error){if(error?.code==='invalid_json'&&(rawBytes>maximum||Number(req.headers['content-length'])>maximum))throw new AppError(413,'payload_too_large','This request is too large.');throw error;}
        requireValue(large.includes(body.command)||rawBytes<=maximum,'payload_too_large','This request is too large.',413);
        const execute=()=>commands.execute(actor,body,{ownerReadReceiptsActive:ownerReadReceipts?.activeFor(actor)===true,revalidateActor:()=>authorize(req,`${req.method} ${path}`)});
        return send(200,await (ownerReadReceipts?ownerReadReceipts.run(actor,req,execute,body.command):execute()));
      }
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
  if(method==='GET'&&['/api/calendar/roster','/api/calendar/overview'].includes(path)){const keys=[...url.searchParams.keys()],allowed=path.endsWith('/overview')?['start','end','after']:['after','q','tier'];requireValue(new Set(keys).size===keys.length&&keys.every(k=>allowed.includes(k)),'invalid_query','Choose a bounded student scope.',400);return path.endsWith('/overview')?'calendar-overview':'calendar-roster';}
  if(method==='GET'&&/^\/api\/calendar\/student\/[1-9][0-9]{0,15}$/.test(path)){requireValue(!url.search,'invalid_query','This endpoint does not accept a query.',400);return 'calendar-student';}
  if(method==='GET'&&path==='/api/calendar/cohort'){const keys=[...url.searchParams.keys()];requireValue(keys.length>=2&&keys.length<=3&&new Set(keys).size===keys.length&&keys.every(k=>['start','end','cursor'].includes(k)),'invalid_query','Choose a bounded Calendar range.',400);return 'calendar-cohort';}
  if(method==='GET'&&path==='/api/bootstrap'){
    const keys=[...url.searchParams.keys()];
    requireValue(!url.search||url.search==='?view=calendar'||keys.length===3&&new Set(keys).size===3&&keys.every(k=>['view','start','end'].includes(k))&&url.searchParams.get('view')==='calendar','invalid_query','Choose the supported workspace view.',400);
    if(keys.length===3)cohortRange({start:url.searchParams.get('start'),end:url.searchParams.get('end')});return 'bootstrap';
  }
  requireValue(!url.search,'invalid_query','This endpoint does not accept a query.',400);
  if(method==='GET'&&path==='/api/calendar/student-preview')return 'student-preview';
  const calendarAdmin=/^\/api\/calendar\/admin\/([a-f0-9-]{36})$/.exec(path);if(calendarAdmin&&UUID.test(calendarAdmin[1])&&['GET','POST'].includes(method))return method==='GET'?'calendar-admin-read':'calendar-admin-write';
  const itinerary=/^\/api\/interviews\/([a-f0-9-]{36})\/itinerary(?:\/([a-f0-9-]{36}|withdraw))?$/.exec(path);if(itinerary&&UUID.test(itinerary[1])){if(method==='GET'&&!itinerary[2])return 'itinerary-list';if(method==='POST'&&!itinerary[2])return 'itinerary-upload';if(method==='POST'&&itinerary[2]==='withdraw')return 'itinerary-withdraw';if(method==='GET'&&UUID.test(itinerary[2]||''))return 'itinerary-download';}
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
