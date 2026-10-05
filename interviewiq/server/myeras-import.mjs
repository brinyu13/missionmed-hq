import {randomUUID} from 'node:crypto';
import {AppError,requireValue} from './errors.mjs';
import * as v from './validation.mjs';
import {parseMyerasCsv} from './myeras-csv.mjs';
import {targetsEnabled,requireTargets,canonicalProgram,targetView} from './loi-targets.mjs';
export const myerasCommands=new Set(['myeras.preview','myeras.import']);
export const myerasEnabled=(config,actor)=>targetsEnabled(config,actor)&&config.loi?.myerasEnabled===true;
export function requireMyeras(config,actor){requireTargets(config,actor);requireValue(myerasEnabled(config,actor),'myeras_unavailable','MyERAS import is unavailable for this workspace.',403);}
const normal=s=>s.trim().normalize('NFKC').replace(/\s+/g,' ').toLocaleLowerCase('en-US');
const canonicalId=s=>/^rise_[A-Za-z0-9._:-]{1,174}$/.test(s);
const binding=p=>Object.fromEntries(['id','name','track','registryReleaseId','specialty','acgmeId'].filter(k=>Object.hasOwn(p,k)).map(k=>[k,p[k]]));
export function parseImport(data,preview=false){
 v.onlyKeys(data,preview?['csvText']:['csvText','expectedPreviewDigest','decisions']);
 requireValue(typeof data.csvText==='string'&&!/[\ud800-\udbff](?![\udc00-\udfff])|(?<![\ud800-\udbff])[\udc00-\udfff]/u.test(data.csvText),'invalid_csv_utf8','Upload a valid UTF-8 CSV file.');
 try{return parseMyerasCsv(data.csvText);}catch(e){throw new AppError(422,typeof e.code==='string'?e.code:'invalid_csv','This CSV could not be imported. Check the exact template, safe cells and file limits.');}
}
export const rowKey=original=>v.digest(Object.fromEntries(Object.entries(original).filter(([k])=>k!=='exported_at')));
async function resolveRow(ctx,row,cache){
 const {actor,owners,config}=ctx,o=row.original,key=rowKey(o),id=o.program_identifier.trim();let candidates=[],complete=true,release=null;
 if(canonicalId(id)){
  try{const p=await canonicalProgram(owners,actor,id,config);return {rowKey:key,original:o,exportedAt:row.exportedAt,resolutionState:'MATCHED',program:p,candidates:[p],lookupComplete:true,matchBasis:'CANONICAL_ID'};}catch(e){if(!['loi_program_unavailable','not_found'].includes(e.code))throw e;}
 }
 const q=(/^\d{10}$/.test(id)?id:o.program_name.trim()).slice(0,256),cacheKey=q;
 if(!cache.has(cacheKey)){
  const first=await owners.searchPrograms(actor,{q,page:1,pageSize:20});
  requireValue(typeof first.registryReleaseId==='string'&&Array.isArray(first.programs)&&Number.isSafeInteger(first.total)&&first.total>=first.programs.length&&first.page===1,'invalid_owner_response','Current canonical search could not be verified.',503);
  // Exact completeness, never a unique conclusion from a partial/truncated result.
  let list=first.programs,exhaustive=first.total<=20&&list.length===first.total;
  if(first.total>20&&first.total<=40){const second=await owners.searchPrograms(actor,{q,page:2,pageSize:20});requireValue(second.registryReleaseId===first.registryReleaseId&&second.total===first.total&&second.page===2,'loi_binding_changed','Canonical registry changed. Review the file again.',409);list=[...list,...second.programs];exhaustive=list.length===first.total;}
  requireValue(list.length<=40&&new Set(list.map(p=>p.id)).size===list.length,'invalid_owner_response','Current canonical search could not be verified.',503);
  cache.set(cacheKey,{list,complete:exhaustive,release:first.registryReleaseId});
 }
 const lookup=cache.get(cacheKey);complete=lookup.complete;release=lookup.release;
 candidates=lookup.list.filter(p=>(!config.loi.programId||p.id===config.loi.programId)&&(/^\d{10}$/.test(id)?p.acgmeId===id:normal(p.name)===normal(o.program_name))&&(!o.specialty.trim()||typeof p.specialty==='string'&&normal(p.specialty)===normal(o.specialty))&&(!o.track.trim()||normal(p.track)===normal(o.track))).map(binding);
 const strongest=/^\d{10}$/.test(id),unverifiedIdentifier=id&&!strongest,unverifiedLabels=!strongest&&[o.institution,o.city,o.state].some(x=>x.trim());
 let state=complete&&candidates.length===1&&!unverifiedIdentifier&&!unverifiedLabels?'MATCHED':candidates.length||!complete?'NEEDS_CONFIRMATION':'NOT_FOUND';let program=null;
 if(state==='MATCHED'){program=await canonicalProgram(owners,actor,candidates[0].id,config);requireValue(program.registryReleaseId===release&&program.name===candidates[0].name&&program.track===candidates[0].track,'loi_binding_changed','Canonical identity changed. Review the file again.',409);}
 return {rowKey:key,original:o,exportedAt:row.exportedAt,resolutionState:state,program,candidates:candidates.slice(0,40),lookupComplete:complete,registryReleaseId:release,matchBasis:strongest?'ACGME_ID':'VERIFIED_NAME_LABELS'};
}
export async function previewImport(ctx,parsed=parseImport(ctx.data,true)){
 requireMyeras(ctx.config,ctx.actor);requireValue(typeof ctx.owners.searchPrograms==='function','owner_service_unavailable','Canonical matching is temporarily unavailable.',503);
 const cache=new Map(),rows=[];for(const row of parsed.programs)rows.push(await resolveRow(ctx,row,cache));
 const {rows:existing}=await ctx.db.query('SELECT * FROM iiq.loi_targets WHERE owner_id=$1 AND merged_into_id IS NULL ORDER BY created_at,id LIMIT 2001',[ctx.actor.id]);requireValue(existing.length<=2000,'loi_target_limit','This workspace needs a paginated reader.',413);
 for(const row of rows){const prior=existing.find(t=>t.sources.some(s=>s.source==='MYERAS'&&s.sourceId===row.rowKey))||existing.find(t=>row.program&&t.program_id===row.program.id);row.existingTarget=prior?{targetId:prior.id,version:Number(prior.version),choice:prior.target_choice,program:prior.program_id?{id:prior.program_id,name:prior.program_name,track:prior.program_track,registryReleaseId:prior.registry_release_id}:null}:null;row.choice=prior?.target_choice??'MAYBE_LATER';}
 const counts={imported:parsed.rowCount,unique:rows.length,duplicates:parsed.duplicateCount,MATCHED:rows.filter(r=>r.resolutionState==='MATCHED').length,NEEDS_CONFIRMATION:rows.filter(r=>r.resolutionState==='NEEDS_CONFIRMATION').length,NOT_FOUND:rows.filter(r=>r.resolutionState==='NOT_FOUND').length};
 const previewDigest=v.digest({rows,counts});return {type:'myeras_preview',preview:{schema:'iiq-myeras-review-v1',previewDigest,counts,rows,lookupBounds:{maxResultsPerQuery:40,maxQueries:2000,partialNeverUnique:true},evidenceState:'UNKNOWN'}};
}
export async function importPrograms(ctx){
 const parsed=parseImport(ctx.data),{preview}=await previewImport(ctx,parsed),{db,actor,data,clock=()=>new Date()}=ctx;
 requireValue(typeof data.expectedPreviewDigest==='string'&&/^[a-f0-9]{64}$/.test(data.expectedPreviewDigest)&&data.expectedPreviewDigest===preview.previewDigest,'myeras_preview_changed','The file, program registry or your saved targets changed. Review them again.',409);
 v.array(data.decisions,'Program choices',2000);const decisions=new Map();for(const d of data.decisions){v.onlyKeys(d,['rowKey','programId','confirmed','choice','expectedTargetVersion']);requireValue(typeof d.rowKey==='string'&&/^[a-f0-9]{64}$/.test(d.rowKey)&&preview.rows.some(r=>r.rowKey===d.rowKey)&&!decisions.has(d.rowKey),'invalid_import_choice','Review each program once.');if(d.choice!==undefined)v.choice(d.choice,['CREATE_LETTER','MAYBE_LATER','SKIP'],'Target choice');if(d.programId!==undefined){v.text(d.programId,'Canonical program',180,{empty:false});requireValue(d.confirmed===true,'myeras_confirmation_required','Confirm the actual program explicitly.');}else requireValue(d.confirmed===undefined,'invalid_import_choice','Choose a verified program to confirm.');if(d.expectedTargetVersion!==undefined)v.integer(d.expectedTargetVersion,'Target version',1,Number.MAX_SAFE_INTEGER);decisions.set(d.rowKey,d);}
 const targets=[],resolved=new Map();
 for(const row of preview.rows){
  const d=decisions.get(row.rowKey)||{};let p=row.program;
  if(d.programId!==undefined){requireValue(row.candidates.some(c=>c.id===d.programId),'myeras_confirmation_required','Choose a current verified candidate from this review.');p=await canonicalProgram(ctx.owners,actor,d.programId,ctx.config);const c=row.candidates.find(c=>c.id===p.id);requireValue(p.registryReleaseId===c.registryReleaseId&&p.name===c.name&&p.track===c.track,'loi_binding_changed','The program changed. Review again.',409);}
  let prior=(await db.query("SELECT * FROM iiq.loi_targets WHERE owner_id=$1 AND merged_into_id IS NULL AND (sources @> $2::jsonb OR ($3::text IS NOT NULL AND program_id=$3)) ORDER BY CASE WHEN sources @> $2::jsonb THEN 0 ELSE 1 END,id FOR UPDATE",[actor.id,JSON.stringify([{source:'MYERAS',sourceId:row.rowKey}]),p?.id??null])).rows;
  requireValue(prior.length<=1,'myeras_merge_required','This imported row and canonical program already have separate targets. Keep both and resolve them explicitly; no history was merged.',409);prior=prior[0];
  if(prior){
   if(d.choice!==undefined||d.programId!==undefined)requireValue(d.expectedTargetVersion===(p&&resolved.has(p.id)?resolved.get(p.id).baselineVersion:Number(prior.version)),'loi_target_conflict','This target changed. Review its current version.',409);
   if(prior.program_id){requireValue(!p||p.id===prior.program_id&&p.registryReleaseId===prior.registry_release_id&&p.name===prior.program_name&&p.track===prior.program_track,'loi_binding_changed','An existing canonical binding changed. Update it explicitly.',409);p={id:prior.program_id,name:prior.program_name,track:prior.program_track,registryReleaseId:prior.registry_release_id};}
   else if(p&&d.programId===undefined&&row.existingTarget) p=null; // existing unresolved binding never silently changes on reimport
  }
  const source={source:'MYERAS',schema:'iiq-myeras-source-v1',sourceId:row.rowKey,original:row.original,exportedAt:row.exportedAt};source.eventId=v.digest(source);
  const choice=d.choice??prior?.target_choice??'MAYBE_LATER',state=p?'MATCHED':row.resolutionState==='MATCHED'?'NOT_FOUND':row.resolutionState;
  // Two source rows resolving to one canonical target preserve every original. Explicit contradictory choices reject atomically.
  if(p&&resolved.has(p.id)){const before=resolved.get(p.id);requireValue(d.choice===undefined||before.choice===d.choice,'invalid_import_choice','Rows for the same canonical program need one consistent explicit choice.');}
  if(prior){const extra=prior.sources.some(s=>s.eventId===source.eventId)?[]:[source];if(extra.length||d.choice!==undefined||d.programId!==undefined){const audit=(d.choice!==undefined||d.programId!==undefined)?[{source:'MYERAS_REVIEW',schema:'iiq-myeras-review-v1',sourceId:row.rowKey,choice,programId:p?.id??null,previousVersion:Number(prior.version),reviewedAt:clock().toISOString()}]:[];const {rows:[saved]}=await db.query('UPDATE iiq.loi_targets SET sources=sources||$3::jsonb,target_choice=$4,program_id=$5,program_name=$6,program_track=$7,registry_release_id=$8,resolution_state=$9,version=version+1,updated_at=$10 WHERE owner_id=$1 AND id=$2 RETURNING *',[actor.id,prior.id,JSON.stringify([...extra,...audit]),choice,p?.id??null,p?.name??prior.program_name,p?.track??'',p?.registryReleaseId??null,p?'MATCHED':prior.resolution_state,clock()]);prior=saved;}}
  else{const {rows:[saved]}=await db.query(`INSERT INTO iiq.loi_targets(id,owner_id,program_id,program_name,program_track,registry_release_id,resolution_state,target_choice,source_fingerprint,sources,created_at,updated_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb,$11,$11) RETURNING *`,[randomUUID(),actor.id,p?.id??null,p?.name??row.original.program_name,p?.track??'',p?.registryReleaseId??null,state,choice,row.rowKey,JSON.stringify([source]),clock()]);prior=saved;}
  targets.push({rowKey:row.rowKey,targetId:prior.id,choice:prior.target_choice,resolutionState:prior.resolution_state});if(p)resolved.set(p.id,{choice:prior.target_choice,baselineVersion:resolved.get(p.id)?.baselineVersion??row.existingTarget?.version});
 }
 const {rows:[total]}=await db.query('SELECT count(*)::int AS n FROM iiq.loi_targets WHERE owner_id=$1',[actor.id]);requireValue(total.n<=2000,'loi_target_limit','The target reader is bounded to 2000 programs.',413);
 return {type:'myeras_import',id:targets[0]?.targetId??null,importSummary:{...preview.counts,MATCHED:targets.filter(t=>t.resolutionState==='MATCHED').length,NEEDS_CONFIRMATION:targets.filter(t=>t.resolutionState==='NEEDS_CONFIRMATION').length,NOT_FOUND:targets.filter(t=>t.resolutionState==='NOT_FOUND').length,targets}};
}
