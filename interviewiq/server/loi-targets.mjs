import {randomUUID} from 'node:crypto';
import {requireValue,notFound} from './errors.mjs';
import * as v from './validation.mjs';
export const targetCommands=new Set(['loitarget.create','loitarget.update','loitarget.read','loitarget.list','loitarget.saved','myeras.preview','myeras.import']);
const letters=new Set(['loi.save','loi.approve','loi.evidence','loi.export','loi.handoff','loi.mark_sent','loi.generate','loi.generation_read','loi.generation_select']);
export function targetsEnabled(config,actor){const l=config.loi;return l?.targetsEnabled===true&&l.enabled===true&&['CANARY','ELIGIBLE'].includes(l.mode??'CANARY')&&actor.role==='student'&&actor.eligible===true&&['360','ivprep_complete'].includes(actor.tier)&&(!l.ownerId||l.ownerId===actor.id)&&(!l.targetsOwnerId||l.targetsOwnerId===actor.id)&&((l.mode??'CANARY')!=='CANARY'||Boolean(l.ownerId&&l.programId));}
export function requireTargets(config,actor){requireValue(targetsEnabled(config,actor),'loi_targets_unavailable','Program letters are unavailable for this workspace.',403);}
export function targetEnvelope(body){
 if(!Object.hasOwn(body,'targetKind')&&!Object.hasOwn(body,'targetId'))return v.commandEnvelope(body);
 v.onlyKeys(body,['command','targetKind','targetId','data','requestId','expectedVersion']);
 requireValue(body.targetKind==='program'&&(letters.has(body.command)||targetCommands.has(body.command)),'invalid_loi_target','Use an explicit program letter target.');
 v.uuid(body.requestId,'Request');v.integer(body.expectedVersion,'Version',0,Number.MAX_SAFE_INTEGER);v.object(body.data??{},'Command data');
 const noId=['loitarget.create','loitarget.list','loitarget.saved','myeras.preview','myeras.import'].includes(body.command);
 if(noId)requireValue(body.targetId===null,'invalid_loi_target','This action has no existing target.');else v.uuid(body.targetId,'Program letter target');
 const canonicalBody={command:body.command,targetKind:'program',targetId:body.targetId,data:body.data??{}};
 return {...canonicalBody,requestId:body.requestId,expectedVersion:body.expectedVersion,bodyHash:v.digest(canonicalBody)};
}
export async function ownedTarget({db,actor,targetId,config},lock=false){requireTargets(config,actor);v.uuid(targetId,'Program letter target');const {rows:[row]}=await db.query('SELECT * FROM iiq.loi_targets WHERE owner_id=$1 AND id=$2'+(lock?' FOR UPDATE':''),[actor.id,targetId]);if(!row)throw notFound();requireValue(row.merged_into_id===null,'loi_target_unavailable','This target is unavailable.',409);return row;}
export function targetLetterAllowed(config,actor,row){return targetsEnabled(config,actor)&&row.owner_id===actor.id&&row.resolution_state==='MATCHED'&&row.program_id&&(!config.loi.programId||config.loi.programId===row.program_id);}
export async function canonicalProgram(owners,actor,id,config){
 v.text(id,'Canonical program',180,{empty:false});requireValue(/^[A-Za-z0-9][A-Za-z0-9._:-]{0,179}$/.test(id)&&(!config.loi.programId||id===config.loi.programId),'loi_program_unavailable','Choose an enabled canonical program.',403);
 const p=await owners.getProgram(actor,id);requireValue(p?.id===id&&typeof p.name==='string'&&p.name.length>0&&p.name.length<=500&&typeof p.track==='string'&&p.track.length<=300&&typeof p.registryReleaseId==='string'&&p.registryReleaseId.length>0&&p.registryReleaseId.length<=180,'loi_binding_changed','Current canonical identity could not be verified.',409);return Object.fromEntries(['id','name','track','registryReleaseId'].map(k=>[k,p[k]]));
}
const iso=x=>x instanceof Date?x.toISOString():x;
export function targetView(row,history){return {targetKind:'program',targetId:row.id,program:row.program_id?{id:row.program_id,name:row.program_name,track:row.program_track,registryReleaseId:row.registry_release_id}:null,programName:row.program_name,resolutionState:row.resolution_state,choice:row.target_choice,version:Number(row.version),sources:row.sources,createdAt:iso(row.created_at),updatedAt:iso(row.updated_at),evidenceState:'UNKNOWN',...(history?{loi:history}:{})};}
export async function savedPrograms({actor,owners,config,data={}}){requireTargets(config,actor);v.onlyKeys(data,['page','pageSize']);const page=data.page??1,pageSize=data.pageSize??100;v.integer(page,'Page',1,2000);v.integer(pageSize,'Page size',1,100);requireValue((page-1)*pageSize<2000,'invalid_pagination','Choose a bounded page.');requireValue(typeof owners.rise?.savedPrograms==='function','owner_service_unavailable','Saved Programs is temporarily unavailable.',503);return owners.rise.savedPrograms(actor,{page,pageSize});}
export async function readTargets({db,actor,config,owners},history){
 if(!targetsEnabled(config,actor))return null;
 const {rows}=await db.query('SELECT * FROM iiq.loi_targets WHERE owner_id=$1 ORDER BY created_at,id LIMIT 2001',[actor.id]);requireValue(rows.length<=2000,'loi_target_limit','This workspace needs a paginated target reader.',413);
 const {rows:consents}=await db.query("SELECT subject_ref,status FROM iiq.consents WHERE owner_id=$1 AND scope='storyforge'",[actor.id]);
 let saved=null,savedStatus='unavailable';try{saved=await savedPrograms({actor,owners,config});savedStatus='available';}catch{}
 return {targets:rows.map(r=>targetView(r,history(r.anchors,{...r,targetKind:'program'},consents))),savedPrograms:saved,savedStatus};
}
export async function writeTarget(ctx){
 const {db,actor,config,owners,command,data,targetId,clock=()=>new Date()}=ctx;requireTargets(config,actor);
 if(command==='loitarget.update'){
  v.onlyKeys(data,['expectedTargetVersion','choice','program']);const row=await ownedTarget(ctx,true);v.integer(data.expectedTargetVersion,'Target version',1,Number.MAX_SAFE_INTEGER);requireValue(Number(row.version)===data.expectedTargetVersion,'loi_target_conflict','This target changed. Reload its current binding.',409);
  const choice=data.choice===undefined?row.target_choice:v.choice(data.choice,['CREATE_LETTER','MAYBE_LATER','SKIP'],'Target choice');
  const p=data.program===undefined?null:await canonicalProgram(owners,actor,data.program,config);
  const {rows:[updated]}=await db.query(`UPDATE iiq.loi_targets SET target_choice=$3,program_id=$4,program_name=$5,program_track=$6,registry_release_id=$7,resolution_state=$8,version=version+1,updated_at=$9 WHERE owner_id=$1 AND id=$2 RETURNING *`,[actor.id,row.id,choice,p?.id??row.program_id,p?.name??row.program_name,p?.track??row.program_track,p?.registryReleaseId??row.registry_release_id,p?'MATCHED':row.resolution_state,clock()]);return {type:'loi_target',id:row.id,targetId:row.id,target:targetView(updated)};
 }
 requireValue(command==='loitarget.create','invalid_command','Use a target creation action.');v.onlyKeys(data,['program','programName','choice','source']);v.onlyKeys(data.source,['kind','original']);const kind=v.choice(data.source.kind,['RISE_SAVED','MANUAL','MYERAS'],'Target source');const original=v.text(data.source.original??'','Original source',20000);
 const choice=v.choice(data.choice,['CREATE_LETTER','MAYBE_LATER','SKIP'],'Target choice');let p=null,source;
 if(kind==='RISE_SAVED'){
  v.text(data.program,'Saved program reference',180,{empty:false});let found;let release;
  for(let page=1;page<=20;page++){const saved=await savedPrograms({actor,owners,config,data:{page,pageSize:100}});requireValue(!release||release===saved.registryReleaseId,'loi_binding_changed','Saved registry changed while reading.',409);release=saved.registryReleaseId;found=saved.records.find(r=>r.programRef===data.program);if(found||!saved.hasMore)break;}
  requireValue(found,'saved_program_unavailable','Choose a current own saved program.',404);if(found.identityState==='CANONICAL'){p=await canonicalProgram(owners,actor,found.program.id,config);requireValue(v.digest(p)===v.digest(Object.fromEntries(['id','name','track','registryReleaseId'].map(k=>[k,found.program[k]]))),'loi_binding_changed','Saved canonical identity changed.',409);}
  source={source:'RISE_SAVED',...found};
 }else {if(data.program!==undefined&&data.program!==null)p=await canonicalProgram(owners,actor,data.program,config);source={source:kind,original};}
 const name=p?.name??v.text(data.programName??'','Program name',500,{empty:kind==='RISE_SAVED'});const fingerprint=v.digest({kind,program:p?.id??data.program??null,original,name});
 const {rows:[existing]}=await db.query('SELECT * FROM iiq.loi_targets WHERE owner_id=$1 AND (source_fingerprint=$2 OR ($3::text IS NOT NULL AND program_id=$3 AND merged_into_id IS NULL)) FOR UPDATE',[actor.id,fingerprint,p?.id??null]);
 if(existing){requireValue(!p||existing.registry_release_id===p.registryReleaseId&&existing.program_name===p.name&&existing.program_track===p.track,'loi_binding_changed','Existing binding changed; update it explicitly.',409);const extra=existing.sources.some(s=>v.digest(s)===v.digest(source))?[]:[source];const {rows:[row]}=await db.query('UPDATE iiq.loi_targets SET sources=sources||$3::jsonb,target_choice=$4,version=version+1,updated_at=$5 WHERE owner_id=$1 AND id=$2 RETURNING *',[actor.id,existing.id,JSON.stringify(extra),choice,clock()]);return {type:'loi_target',id:row.id,targetId:row.id,target:targetView(row)};}
 const id=randomUUID();const {rows:[row]}=await db.query(`INSERT INTO iiq.loi_targets(id,owner_id,program_id,program_name,program_track,registry_release_id,resolution_state,target_choice,source_fingerprint,sources,created_at,updated_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb,$11,$11) RETURNING *`,[id,actor.id,p?.id??null,name,p?.track??'',p?.registryReleaseId??null,p?'MATCHED':'NOT_FOUND',choice,fingerprint,JSON.stringify([source]),clock()]);return {type:'loi_target',id,targetId:id,target:targetView(row)};
}
