import {createHash,randomUUID} from 'node:crypto';
import {AppError,requireValue,notFound} from './errors.mjs';
import {UUID} from './auth.mjs';
import {syncActor,revision} from './records.mjs';
import {audioMime,audioObjectKey,assertAudioSignature,MAX_AUDIO_BYTES} from './storage.mjs';
import {createOpenAIGpt4oTranscribeDriver} from './transcription/openai-gpt-4o-transcribe.mjs';
import {createOpenAIWhisper1Driver} from './transcription/openai-whisper1.mjs';

// Source lineage: StoryForge recordings orchestration at 3cffc77, ported to the
// isolated IIQ schema. No StoryForge DB/table/bucket writes or worker impersonation.
export const recordingLimits=Object.freeze({maxChunkBytes:MAX_AUDIO_BYTES,maxChunkDurationMs:30000,maxSessionDurationMs:20*60*1000,maxDailyDurationMs:60*60*1000,maxSegments:300,maxSessionBytes:50*1024*1024,maxProviderAttempts:3,claimTimeoutMs:90000});
const activeStatuses=['created','listening','paused','failed'];
function student(actor){requireValue(actor?.eligible===true&&actor.role==='student'&&UUID.test(actor.id),'recording_identity_required','A current student account is required.',403);}
function uuid(value,label){requireValue(typeof value==='string'&&UUID.test(value),'invalid_recording_request',`${label} must be a valid identifier.`);return value;}
function integer(value,min,max,label){requireValue(Number.isSafeInteger(value)&&value>=min&&value<=max,'invalid_recording_request',`${label} is outside the supported range.`);return value;}
const iso=value=>value instanceof Date?value.toISOString():value;
function publicSegment(row){return {id:row.client_segment_key||row.id,seq:Number(row.sequence),text:row.transcript??'',status:row.status,recordingId:row.recording_session_id,attempts:Number(row.provider_attempts||0),error:row.last_error_code||null};}
function normalizeSegment(input){
  requireValue(input&&typeof input==='object'&&!Array.isArray(input),'invalid_recording_request','A segment object is required.');
  const segmentId=uuid(input.segmentId,'Segment'),seq=integer(input.seq,0,10000,'Sequence'),durationMs=integer(input.durationMs,1,recordingLimits.maxChunkDurationMs,'Duration');
  requireValue(typeof input.audioBase64==='string'&&input.audioBase64.length<=Math.ceil(MAX_AUDIO_BYTES/3)*4&&/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(input.audioBase64),'invalid_audio_encoding','Audio must use bounded canonical base64.');
  const bytes=Buffer.from(input.audioBase64,'base64');requireValue(bytes.toString('base64')===input.audioBase64,'invalid_audio_encoding','Audio encoding is invalid.');
  const mimeType=assertAudioSignature(bytes,input.contentType),sha256=createHash('sha256').update(bytes).digest('hex');
  return {segmentId,seq,durationMs,mimeType,sha256,bytes,byteCount:bytes.length};
}
function safeProviderCode(error){return ['transcribe_unavailable','transcribe_timeout','transcribe_rejected_format','transcribe_failed_permanent','audio_storage_unavailable','recording_context_expired'].includes(error?.code)?error.code:'transcribe_unavailable';}

export function createPostgresRecordingStore({database,limits={},clock=()=>Date.now()}){
  const caps={...recordingLimits,...limits};
  async function write(actor,fn){student(actor);return database.withActor(actor,async db=>{await syncActor(db,actor);return fn(db);},{write:true});}
  async function session(db,actor,id,{lock=false,context=false}={}){
    const {rows:[row]}=await db.query(`SELECT s.* FROM iiq.recording_sessions s WHERE s.id=$1 AND s.owner_id=$2${lock?' FOR UPDATE':''}`,[id,actor.id]);if(!row)throw notFound();
    if(context)await captureContext(db,actor,row.interview_id);return row;
  }
  async function captureContext(db,actor,interviewId){
    const {rows:[row]}=await db.query(`SELECT i.status,i.confirmed_occurred,d.occurrence FROM iiq.interviews i JOIN iiq.debriefs d ON d.interview_id=i.id AND d.owner_id=i.owner_id WHERE i.id=$1 AND i.owner_id=$2`,[interviewId,actor.id]);
    if(!row)throw notFound();requireValue(!['cancelled','declined','postponed','no_show'].includes(row.status)&&row.occurrence==='happened'&&row.confirmed_occurred===true,'recording_context_unavailable','Confirm that the interview happened before recording its debrief.',409);
  }
  async function bump(db,actor,event,id,metadata={}){
    const version=await revision(db,actor);await db.query('INSERT INTO iiq.revisions(owner_id,revision,reason,request_key) VALUES($1,$2,$3,$4)',[actor.id,version+1,event,randomUUID()]);
    await db.query('INSERT INTO iiq.audit_events(owner_id,actor_id,event_type,object_type,object_id,metadata) VALUES($1,$1,$2,$3,$4,$5::jsonb)',[actor.id,event,'recording',id,JSON.stringify(metadata)]);
  }
  async function create(actor,input){return write(actor,async db=>{
    await captureContext(db,actor,input.interviewId);
    const {rows:[prior]}=await db.query('SELECT * FROM iiq.recording_sessions WHERE owner_id=$1 AND client_session_key=$2',[actor.id,input.requestId]);
    if(prior){requireValue(prior.interview_id===input.interviewId&&prior.mime_type===input.mimeType,'recording_request_reused','This recording request was already used with different input.',409);return prior;}
    const {rows:[row]}=await db.query(`INSERT INTO iiq.recording_sessions(owner_id,interview_id,mime_type,client_session_key,status) VALUES($1,$2,$3,$4,'listening') RETURNING *`,[actor.id,input.interviewId,input.mimeType,input.requestId]);
    await bump(db,actor,'recording.created',row.id);return row;
  });}
  async function reserve(actor,id,input){return write(actor,async db=>{
    const s=await session(db,actor,id,{lock:true,context:true});
    const {rows:[prior]}=await db.query(`SELECT * FROM iiq.recording_chunks WHERE owner_id=$1 AND (client_segment_key=$2 OR (recording_session_id=$3 AND sequence=$4))`,[actor.id,input.segmentId,id,input.seq]);
    if(prior){requireValue(prior.recording_session_id===id&&prior.sequence===input.seq&&prior.client_segment_key===input.segmentId&&prior.sha256===input.sha256&&prior.mime_type===input.mimeType&&prior.duration_ms===input.durationMs,'recording_segment_reused','This segment identity has different audio or timing.',409);return {chunk:prior,created:false};}
    requireValue(activeStatuses.includes(s.status),'recording_not_active','This recording no longer accepts new audio.',409);
    requireValue(s.mime_type===input.mimeType,'recording_format_changed','Resume using the original recording format.',409);
    requireValue(Number(s.next_sequence)===input.seq,'recording_sequence_gap','Upload the earlier segment before this one.',409,{nextSeq:Number(s.next_sequence)});
    const {rows:[usage]}=await db.query(`SELECT count(*)::integer AS count,coalesce(sum(duration_ms),0)::bigint AS duration,coalesce(sum(byte_count),0)::bigint AS bytes FROM iiq.recording_chunks WHERE recording_session_id=$1 AND owner_id=$2`,[id,actor.id]);
    const {rows:[daily]}=await db.query(`SELECT coalesce(sum(greatest(duration_ms,4000)),0)::bigint AS duration FROM iiq.recording_chunks WHERE owner_id=$1 AND created_at>=date_trunc('day',now() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC'`,[actor.id]);
    requireValue(Number(usage.count)<caps.maxSegments&&Number(usage.duration)+input.durationMs<=caps.maxSessionDurationMs&&Number(usage.bytes)+input.byteCount<=caps.maxSessionBytes,'recording_limit','This recording reached its capture limit. Save it and continue with typed notes.',429);
    requireValue(Number(daily.duration)+Math.max(input.durationMs,4000)<=caps.maxDailyDurationMs,'recording_daily_limit','The daily capture limit has been reached. Typed notes remain available.',429);
    const {rows:[chunk]}=await db.query(`INSERT INTO iiq.recording_chunks(owner_id,interview_id,recording_session_id,sequence,client_segment_key,sha256,mime_type,byte_count,duration_ms,object_key) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,[actor.id,s.interview_id,id,input.seq,input.segmentId,input.sha256,input.mimeType,input.byteCount,input.durationMs,input.objectKey]);
    await db.query('UPDATE iiq.recording_sessions SET next_sequence=$2,last_error_code=null WHERE id=$1',[id,input.seq+1]);
    await bump(db,actor,'recording.segment_reserved',id,{sequence:input.seq,byteCount:input.byteCount});return {chunk,created:true};
  });}
  async function claim(actor,id,sequence){return write(actor,async db=>{
    const s=await session(db,actor,id,{lock:true,context:true});if(!activeStatuses.includes(s.status))return null;
    const {rows:[row]}=await db.query('SELECT * FROM iiq.recording_chunks WHERE recording_session_id=$1 AND owner_id=$2 AND sequence=$3 FOR UPDATE',[id,actor.id,sequence]);if(!row||row.status==='complete')return null;
    if(row.status==='transcribing'&&Number(clock())-new Date(row.updated_at).getTime()<caps.claimTimeoutMs)return null;
    if(Number(row.provider_attempts)>=caps.maxProviderAttempts)throw new AppError(429,'recording_retry_limit','This segment reached its transcription retry limit. Its uploaded audio remains private.');
    const {rows:[claimed]}=await db.query(`UPDATE iiq.recording_chunks SET status='transcribing',provider_attempts=provider_attempts+1,last_error_code=null WHERE id=$1 RETURNING *`,[row.id]);return claimed;
  });}
  async function claimValid(actor,claim){return database.withActor(actor,async db=>{student(actor);const s=await session(db,actor,claim.recording_session_id,{context:true});if(!activeStatuses.includes(s.status))return false;const {rows:[row]}=await db.query(`SELECT id FROM iiq.recording_chunks WHERE id=$1 AND owner_id=$2 AND version=$3 AND status='transcribing'`,[claim.id,actor.id,claim.version]);return Boolean(row);});}
  async function complete(actor,claim,result){return write(actor,async db=>{
    const s=await session(db,actor,claim.recording_session_id,{lock:true,context:true});if(!activeStatuses.includes(s.status))return false;
    const {rows:[current]}=await db.query(`SELECT * FROM iiq.recording_chunks WHERE id=$1 AND owner_id=$2 AND version=$3 AND status='transcribing' FOR UPDATE`,[claim.id,actor.id,claim.version]);if(!current)return false;
    await db.query(`INSERT INTO iiq.speech_segments(owner_id,interview_id,recording_session_id,chunk_id,sequence,client_segment_key,transcript,audio_object_key,sha256,provider,model,started_at,ended_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,now())`,[actor.id,current.interview_id,current.recording_session_id,current.id,current.sequence,current.client_segment_key,result.text,current.object_key,current.sha256,result.providerId,result.modelId,current.created_at]);
    await db.query(`UPDATE iiq.recording_chunks SET status='complete',last_error_code=null WHERE id=$1`,[current.id]);
    await db.query('UPDATE iiq.recording_sessions SET provider=$2,last_error_code=null WHERE id=$1',[s.id,result.providerId+':'+result.modelId]);
    await bump(db,actor,'recording.segment_transcribed',s.id,{sequence:current.sequence,provider:result.providerId,model:result.modelId,latencyMs:result.latencyMs});return true;
  });}
  async function fail(actor,claim,code){return write(actor,async db=>{
    const result=await db.query(`UPDATE iiq.recording_chunks SET status='failed',last_error_code=$4 WHERE id=$1 AND owner_id=$2 AND version=$3 AND status='transcribing' RETURNING id`,[claim.id,actor.id,claim.version,code]);
    if(result.rowCount)await db.query('UPDATE iiq.recording_sessions SET last_error_code=$3 WHERE id=$1 AND owner_id=$2',[claim.recording_session_id,actor.id,code]);return result.rowCount>0;
  });}
  async function status(actor,id){student(actor);return database.withActor(actor,async db=>{const s=await session(db,actor,id);const {rows}=await db.query(`SELECT c.*,p.transcript FROM iiq.recording_chunks c LEFT JOIN iiq.speech_segments p ON p.chunk_id=c.id AND p.owner_id=c.owner_id WHERE c.recording_session_id=$1 AND c.owner_id=$2 ORDER BY c.sequence`,[id,actor.id]);return {session:s,chunks:rows};});}
  async function transition(actor,id,action){return write(actor,async db=>{
    const s=await session(db,actor,id,{lock:true,context:action!=='cancel'});let target;
    if(action==='cancel')target='abandoned';
    else if(action==='pause'){requireValue(activeStatuses.includes(s.status),'recording_not_active','This recording cannot be paused.',409);target='paused';}
    else if(action==='resume'){requireValue(activeStatuses.includes(s.status),'recording_not_active','This recording cannot resume.',409);target='listening';}
    else if(action==='finish'){requireValue(activeStatuses.includes(s.status)||s.status==='completed','recording_not_active','This recording cannot be finished.',409);const {rows:[pending]}=await db.query(`SELECT count(*)::integer AS count FROM iiq.recording_chunks WHERE recording_session_id=$1 AND owner_id=$2 AND status<>'complete'`,[id,actor.id]);requireValue(pending.count===0,'recording_pending','Some segments still need transcription. Retry before finishing.',409);target='completed';}
    else throw new AppError(422,'invalid_recording_action','Unknown recording action.');
    if(s.status===target)return s;
    const {rows:[row]}=await db.query('UPDATE iiq.recording_sessions SET status=$3 WHERE id=$1 AND owner_id=$2 RETURNING *',[id,actor.id,target]);await bump(db,actor,'recording.'+action,id);return row;
  });}
  return Object.freeze({create,reserve,claim,claimValid,complete,fail,status,transition});
}

export function createRecordingTranscription({apiKey,fetchImpl=fetch,timeoutMs=15000}={}){
  if(!apiKey)return null;
  const primary=createOpenAIGpt4oTranscribeDriver({apiKey,fetchImpl,timeoutMs}),fallback=createOpenAIWhisper1Driver({apiKey,fetchImpl,timeoutMs});
  return Object.freeze({async transcribeSegment(input,{beforeAttempt=async()=>{}}={}){
    try{return await primary.transcribeSegment(input);}catch(error){if(!['transcribe_unavailable','transcribe_timeout'].includes(error?.code)||error.providerFailure==='hard')throw error;await beforeAttempt();return fallback.transcribeSegment(input);}
  }});
}
export function createRecordingsService({store,storage,transcription,bootstrap,clock=()=>Date.now()}){
  requireValue(store&&typeof bootstrap==='function','invalid_recording_service','Recording service dependencies are unavailable.',503);
  const available=Boolean(storage?.configured&&transcription?.transcribeSegment);
  function enabled(){requireValue(available,'speech_unavailable','Speech capture is not configured. Typed notes remain available.',503);}
  async function read(actor,id){const result=await store.status(actor,id);return {recordingId:result.session.id,status:result.session.status,mimeType:result.session.mime_type,nextSeq:Number(result.session.next_sequence),segments:result.chunks.map(publicSegment)};}
  async function result(actor,id,extra={}){return {...await read(actor,id),...extra,bootstrap:await bootstrap(actor)};}
  async function processChunk(actor,id,sequence,context={}){
    const receivedAt=Number(clock());let current=actor,claim;
    async function currentActor(){
      if(context.revalidateActor){const refreshed=await context.revalidateActor();student(refreshed);requireValue(refreshed.id===actor.id&&refreshed.wpUserId===actor.wpUserId,'recording_identity_changed','The current account changed before transcription.',401);current=refreshed;}
      else requireValue(Number(clock())-receivedAt<=15000,'recording_context_expired','Reopen capture to verify current access before transcription.',401);
      student(current);
    }
    await currentActor();claim=await store.claim(current,id,sequence);if(!claim)return null;
    try{
      const buffer=await storage.get({objectKey:claim.object_key,ownerId:current.id,recordingId:id});
      requireValue(buffer.length===claim.byte_count&&createHash('sha256').update(buffer).digest('hex')===claim.sha256,'audio_digest_mismatch','Stored audio failed integrity verification.',503);
      const beforeAttempt=async()=>{await currentActor();requireValue(await store.claimValid(current,claim),'recording_context_unavailable','This recording changed or is no longer available.',409);};
      await beforeAttempt();
      const raw=await transcription.transcribeSegment({buffer,mimeType:claim.mime_type,seq:claim.sequence,languageHint:'en',keywords:[],promptTail:''},{beforeAttempt});
      requireValue(typeof raw?.text==='string'&&raw.text.length<=100000&&raw.providerId==='openai'&&['gpt-4o-transcribe','whisper-1'].includes(raw.modelId),'invalid_transcription_response','The transcription provider returned an invalid result.',503);
      // Reauthorize again before immutable transcript commit; a logout/cancel during
      // provider work must not publish even to a now-invalid browser context.
      await currentActor();requireValue(await store.claimValid(current,claim),'recording_context_unavailable','This recording changed while transcription was in progress.',409);
      const completed=await store.complete(current,claim,{text:raw.text,providerId:raw.providerId,modelId:raw.modelId,latencyMs:Math.max(0,Math.round(raw.latencyMs||0))});
      requireValue(completed,'recording_claim_superseded','This transcription was superseded by another recording state.',409);
      return {provider:raw.providerId,model:raw.modelId,latencyMs:Math.max(0,Math.round(raw.latencyMs||0)),flaggedTerms:Array.isArray(raw.flaggedTerms)?raw.flaggedTerms:[]};
    }catch(error){await store.fail(current,claim,safeProviderCode(error)).catch(()=>{});if(error instanceof AppError)throw error;throw new AppError(503,safeProviderCode(error),'The uploaded segment is saved privately, but transcription needs a retry. Your edited account is unchanged.');}
  }
  async function create(actor,input){student(actor);enabled();const data={interviewId:uuid(input?.interviewId,'Interview'),requestId:uuid(input?.requestId,'Request'),mimeType:audioMime(input?.mimeType)};const row=await store.create(actor,data);return result(actor,row.id);}
  async function segment(actor,id,input,context={}){
    student(actor);enabled();uuid(id,'Recording');const data=normalizeSegment(input);
    data.objectKey=audioObjectKey({prefix:storage.prefix,ownerId:actor.id,recordingId:id,segmentId:data.segmentId,seq:data.seq,contentType:data.mimeType});
    const {chunk}=await store.reserve(actor,id,data);
    let provider;
    if(chunk.status!=='complete'){
      await storage.put({objectKey:chunk.object_key,ownerId:actor.id,recordingId:id,body:data.bytes,contentType:data.mimeType,sha256:data.sha256});
      provider=await processChunk(actor,id,data.seq,context);
    }
    const response=await result(actor,id,provider?{transcription:provider}:{});response.segment=response.segments.find(s=>s.seq===data.seq);return response;
  }
  async function status(actor,id){student(actor);uuid(id,'Recording');return result(actor,id);}
  async function action(actor,id,name,input={},context={}){
    student(actor);uuid(id,'Recording');uuid(input.requestId,'Request');
    requireValue(['pause','resume','finish','cancel','retry'].includes(name),'invalid_recording_action','Unknown recording action.');
    if(name==='retry'){enabled();const snapshot=await store.status(actor,id);for(const chunk of snapshot.chunks.filter(x=>x.status!=='complete'))await processChunk(actor,id,chunk.sequence,context);}
    else{if(name==='resume')enabled();await store.transition(actor,id,name);}
    return result(actor,id);
  }
  return Object.freeze({available,create,segment,status,action});
}
