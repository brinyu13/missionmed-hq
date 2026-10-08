import {randomUUID} from 'node:crypto';
import {requireValue} from './errors.mjs';
import * as v from './validation.mjs';
import {interview,updateGap} from './records.mjs';
import {projectProgramResearch} from './rise-owner.mjs';

export const THREEBOX_CATEGORIES=Object.freeze(['Didactics','Fellowship opportunities','Exposure','Location','Research','Resident feedback','Teaching opportunities','Faculty / leadership','Program-specific opportunity']);
export const THREEBOX_TEACHING='missionmed-threebox-2025-2026-v1';
export const threeboxCommands=new Set(['threebox.read','threebox.evidence','threebox.save','threebox.assemble']);
const type='iiq.threebox.revision';
export function threeboxEnabled(config,actor){return config.threebox?.enabled===true&&actor?.role==='student'&&actor.eligible===true&&['360','ivprep_complete'].includes(actor.tier)&&(!config.threebox.ownerId||config.threebox.ownerId===actor.id);}
export function requireThreebox(config,actor){requireValue(threeboxEnabled(config,actor),'threebox_unavailable','The Three-Box builder is unavailable for this workspace.',403);}
function allowed(config,actor,row){return row?.owner_id===actor.id&&(!config.threebox?.programId||config.threebox.programId===row.program_id);}
function known(entry){return entry?.type===type&&entry.schemaVersion===1&&typeof entry.revisionId==='string'&&Number.isSafeInteger(entry.answerVersion)&&entry.answerVersion>0&&typeof entry.interviewId==='string'&&entry.program&&typeof entry.program.name==='string'&&typeof entry.program.track==='string'&&Array.isArray(entry.reasons)&&entry.answers&&typeof entry.contentHash==='string';}
export function threeboxHistory(prep,row){
  const entries=(prep?.anchors||[]).filter(x=>x?.type===type),history=entries.map(x=>known(x)?x:{type,schemaVersion:x.schemaVersion,unavailable:true}),current=history.filter(known).at(-1)||null;
  const bindingValid=Boolean(current&&current.interviewId===row.id&&current.program.id===row.program_id&&current.program.name===row.program_name&&current.program.track===(row.program_track||''));
  const text=prep?.why_program||'',manualEdit=Boolean(current&&v.digest(text)!==current.contentHash);
  const futureSchema=entries.some(x=>!known(x));
  return {text,basis:null,edited:Boolean(text),threebox:{history,current,bindingValid,manualEdit,futureSchema,ready:Boolean(current?.state==='assembled'&&bindingValid&&!manualEdit&&!futureSchema)}};
}
export function normalizeReasons(input){
  const reasons=v.array(input,'Candidate reasons',8).map(r=>{
    v.onlyKeys(r,['id','general','details','personal','selected','rank','followUpDefense','intel']);
    v.onlyKeys(r.general,['category']);v.onlyKeys(r.personal,['enabled','text','confirmed']);
    const personal={enabled:v.boolean(r.personal.enabled,'Personal connection'),text:v.text(r.personal.text,'Personal meaning',2000),confirmed:v.boolean(r.personal.confirmed,'Personal confirmation')};
    requireValue(!personal.confirmed||personal.enabled&&personal.text.trim(),'threebox_personal_confirmation','Confirm only an enabled personal connection with your own words.');
    const details=v.array(r.details,'Evidence details',12).map(d=>{v.onlyKeys(d,['field','claimRef','selectionHash']);return {field:v.text(d.field,'Evidence field',100,{empty:false}),claimRef:v.text(d.claimRef,'Evidence reference',100,{empty:false}),selectionHash:d.selectionHash===undefined?null:v.text(d.selectionHash,'Reviewed evidence binding',64,{empty:false})};});
    requireValue(new Set(details.map(x=>x.field+'|'+x.claimRef)).size===details.length,'threebox_duplicate_detail','Select a detail once per reason.');
    const intel=v.array(r.intel||[],'Interview-day observations',8).map(x=>{v.onlyKeys(x,['id','speaker','role','text','confirmed']);return {id:v.uuid(x.id,'Observation'),speaker:v.text(x.speaker,'Speaker',200),role:v.text(x.role,'Speaker role',200),text:v.text(x.text,'Observation',2000),confirmed:v.boolean(x.confirmed,'Observation confirmation'),sourceKind:'student_interview_day',verification:'NEEDS_VERIFICATION'};});
    return {id:v.uuid(r.id,'Reason'),general:{category:v.choice(r.general.category,THREEBOX_CATEGORIES,'General category')},details,personal,selected:v.boolean(r.selected,'Selected reason'),rank:v.integer(r.rank,'Reason order',1,8),followUpDefense:v.text(r.followUpDefense,'Follow-up support',2000),intel};
  });
  requireValue(new Set(reasons.map(x=>x.id)).size===reasons.length,'threebox_duplicate_reason','Each reason needs a distinct identifier.');
  const selected=reasons.filter(x=>x.selected);requireValue(new Set(selected.map(x=>x.rank)).size===selected.length,'threebox_duplicate_rank','Give each selected reason a distinct order.');return reasons;
}
export function detailText(value){
  if(value===null)return '';if(typeof value==='string'||typeof value==='number'||typeof value==='boolean')return String(value);
  if(Array.isArray(value))return value.map(detailText).filter(Boolean).join('; ');
  return Object.entries(value).map(([key,x])=>`${key.replaceAll('_',' ')}: ${detailText(x)}`).join('; ');
}
function genericDetail(value){
  if(typeof value==='number')return false;
  if(Array.isArray(value))return !value.length||value.every(genericDetail);
  if(value&&typeof value==='object')return !Object.keys(value).length||Object.values(value).every(genericDetail);
  const words=String(value??'').toLowerCase().match(/[a-z]+/g)||[];
  const generic=new Set('a an the and of your our is has with great excellent strong outstanding good diverse patient population family atmosphere didactics fellowship fellowships opportunities opportunity research teaching faculty leadership program residency exposure location culture training best unique supportive residents resident'.split(' '));
  return !words.length||words.every(w=>generic.has(w));
}
export function checkThreebox(reasons,evidence,{specificityConfirmed=false,factualConfirmed=false,locationException=false}={}){
  const errors=[],warnings=[],selected=reasons.filter(x=>x.selected).sort((a,b)=>a.rank-b.rank);
  if(!selected.length)errors.push('Select your strongest reasons.');
  for(const r of selected){
    if(!r.details.length)errors.push(`${r.general.category}: select at least one verified concrete Detail.`);
    for(const d of r.details)if(!evidence.some(e=>e.field===d.field&&e.claimRef===d.claimRef&&e.state==='SUPPORTED'&&d.selectionHash===e.selectionHash))errors.push(`${r.general.category}: RESEARCH NEEDED — a selected Detail is unavailable or changed.`);
    if(r.details.length&&r.details.every(d=>{const e=evidence.find(e=>e.field===d.field&&e.claimRef===d.claimRef);return !e||genericDetail(e.value);}))errors.push(`${r.general.category}: generic praise is not a concrete Detail. Return to the boxes for names, sites, numbers or a specific feature.`);
    if(r.personal.enabled&&(!r.personal.text.trim()||!r.personal.confirmed))errors.push(`${r.general.category}: confirm your exact personal meaning or leave Personal off.`);
    if(!r.followUpDefense.trim())warnings.push(`${r.general.category}: authenticity risk — prepare follow-up support or remove this reason.`);
    if(r.intel.length)warnings.push(`${r.general.category}: interview-day observations remain attributed private notes; they are not verified program Details.`);
  }
  const detailKeys=selected.flatMap(r=>r.details.map(d=>d.field+'|'+d.claimRef));if(detailKeys.length&&new Set(detailKeys).size<selected.length)errors.push('Several reasons repeat the same Detail. Choose distinct program-specific proof.');
  if(selected.length!==3)warnings.push('Aim for about three strong reasons; quality matters more than the count.');
  if(reasons.length<5)warnings.push('Consider overbuilding about five candidates before narrowing.');
  if(selected.length>1&&[selected[0],selected.at(-1)].some(r=>r.general.category==='Location')&&!locationException)warnings.push('Location usually belongs in the middle. Move it or confirm an unusually strong connection.');
  if(!factualConfirmed)errors.push('Review the selected sources and confirm factual accuracy.');
  if(!specificityConfirmed)errors.push('Stress test: could this answer work unchanged at another program? Return to the boxes until you can confirm it would change.');
  return {errors,warnings,ready:errors.length===0};
}
function leadershipDetail(value){
  const denied=()=>requireValue(false,'threebox_rendering_review_required','Review the program leadership names and roles before assembling this answer.');
  if(!Array.isArray(value)||!value.length)return denied();
  if(value.some(x=>!x||typeof x!=='object'||Array.isArray(x)||typeof x.name!=='string'||!x.name.trim()||typeof x.role!=='string'||!x.role.trim()))return denied();
  const directors=value.filter(x=>/^Program Director(?:[,;]|$)/i.test(x.role.trim()));
  const associates=value.filter(x=>/^Associate Program Director(?:[,;]|$)/i.test(x.role.trim()));
  const selected=[...directors,...associates];
  if(!selected.length||new Set(selected.map(x=>x.name.trim())).size!==selected.length)return denied();
  const names=rows=>{const xs=rows.map(x=>x.name.trim());return xs.length===1?xs[0]:xs.length===2?xs.join(' and '):xs.slice(0,-1).join('; ')+'; and '+xs.at(-1);};
  const parts=[];
  if(directors.length)parts.push(`The program lists ${names(directors)} as Program Director${directors.length===1?'':'s'}`);
  if(associates.length){
    const role='Associate Program Director'+(associates.length===1?'':'s');
    parts.push(parts.length?`the listed ${role} ${associates.length===1?'is':'are'} ${names(associates)}`:`The program lists ${names(associates)} as ${role}`);
  }
  return parts.join('; ');
}
export function spokenDetail(evidence){return evidence.field==='research.leadership'?leadershipDetail(evidence.value):detailText(evidence.value);}
export function assembleThreebox(program,reasons,evidence,delivery='STANDARD'){
  const selected=reasons.filter(r=>r.selected).sort((a,b)=>a.rank-b.rank);
  const ordered=delivery==='RELATIONSHIP'?[...selected].sort((a,b)=>Number(b.personal.enabled)-Number(a.personal.enabled)):delivery==='RESEARCH'?[...selected].sort((a,b)=>Number(/Research|Faculty/.test(b.general.category))-Number(/Research|Faculty/.test(a.general.category))):selected;
  const clauses=ordered.map(r=>{const details=r.details.map(d=>spokenDetail(evidence.find(e=>e.field===d.field&&e.claimRef===d.claimRef)));return {category:r.general.category,details,personal:r.personal.enabled?r.personal.text.trim():''};});
  const sentence=(c,concise)=>`${c.category}: ${(concise?c.details.slice(0,1):c.details).join('; ')}.${c.personal?' This matters to me because '+c.personal.replace(/[.!?]+$/,'')+'.':''}`;
  return {standard:`I’m interested in ${program.name} for several reasons.\n\n${clauses.map(c=>sentence(c,delivery==='CONCISE')).join('\n\n')}\n\nI’m enthusiastic about the opportunity to learn and contribute in your program.`,concise:`What draws me to ${program.name} is:\n${clauses.map(c=>sentence(c,true)).join('\n')}`,bullets:clauses.map(c=>`${c.category} → ${c.details.join('; ')}${c.personal?' → '+c.personal:''}`).join('\n'),delivery};
}
export async function threeboxEvidence(ctx){
  const {db,actor,config,owners,clock=()=>new Date()}=ctx;requireThreebox(config,actor);const row=await interview(db,actor,ctx.interviewId);
  requireValue(allowed(config,actor,row),'threebox_scope','This interview is outside the enabled builder scope.',403);
  requireValue(row.program_id,'threebox_identity','Confirm the canonical program before selecting evidence.',409);
  const program=await owners.getProgram(actor,row.program_id);
  requireValue(program.id===row.program_id&&program.name===row.program_name&&program.track===(row.program_track||''),'threebox_binding_changed','Program identity changed. Reconfirm it before building an answer.',409);
  const research=projectProgramResearch(await owners.getProgramResearch(actor,row.program_id),program,clock().getTime());return {type:'threebox_evidence',program,research,evidenceBindings:research.facts.map(f=>({field:f.field,claimRef:f.claimRef,selectionHash:v.digest({program,fact:f})}))};
}
export async function readThreebox(ctx){requireThreebox(ctx.config,ctx.actor);const row=await interview(ctx.db,ctx.actor,ctx.interviewId);requireValue(allowed(ctx.config,ctx.actor,row),'threebox_scope','This interview is outside the enabled builder scope.',403);const {rows:[prep]}=await ctx.db.query('SELECT * FROM iiq.preparation WHERE owner_id=$1 AND interview_id=$2',[ctx.actor.id,row.id]);return {type:'threebox_read',interviewId:row.id,...threeboxHistory(prep,row)};}
export async function writeThreebox(ctx){
  const {db,actor,config,data,command,clock=()=>new Date()}=ctx;requireThreebox(config,actor);
  v.onlyKeys(data,['expectedHead','expectedAnswerVersion','reasons','delivery','factualConfirmed','specificityConfirmed','locationException','editedAnswer']);
  const row=await interview(db,actor,ctx.interviewId,{lock:true});requireValue(allowed(config,actor,row),'threebox_scope','This interview is outside the enabled builder scope.',403);
  const {rows:[prep]}=await db.query('SELECT * FROM iiq.preparation WHERE owner_id=$1 AND interview_id=$2 FOR UPDATE',[actor.id,row.id]);const projection=threeboxHistory(prep,row),head=projection.threebox.current;
  requireValue(!projection.threebox.futureSchema,'threebox_future_schema','A newer answer history needs a compatible application before editing.',409);
  requireValue(data.expectedHead===(head?.revisionId??null)&&data.expectedAnswerVersion===(head?.answerVersion??0),'threebox_head_conflict','This answer changed. Your draft is kept; review its latest version.',409);
  const reasons=normalizeReasons(data.reasons),delivery=v.choice(data.delivery,['STANDARD','CONCISE','DETAIL_ORIENTED','RELATIONSHIP','RESEARCH'],'Delivery'),confirmations={factualConfirmed:v.boolean(data.factualConfirmed,'Factual review'),specificityConfirmed:v.boolean(data.specificityConfirmed,'Specificity review'),locationException:v.boolean(data.locationException,'Location exception')};
  for(const reason of reasons)for(const intel of reason.intel){const previous=head?.reasons.flatMap(r=>r.intel||[]).find(x=>x.id===intel.id);intel.capturedAt=previous&&previous.text===intel.text&&previous.speaker===intel.speaker&&previous.role===intel.role?previous.capturedAt:clock().toISOString();intel.confirmedAt=intel.confirmed?clock().toISOString():null;}
  let verified=null;try{verified=await threeboxEvidence(ctx);}catch(error){if(command==='threebox.assemble')throw error;}
  const program=verified?.program||{id:row.program_id,name:row.program_name,track:row.program_track||'',registryReleaseId:null};
  const selected=reasons.flatMap(r=>r.details),evidence=(verified?.research.facts||[]).filter(e=>selected.some(d=>d.field===e.field&&d.claimRef===e.claimRef)).map(e=>({...e,selectionHash:v.digest({program,fact:e})}));
  const checks=checkThreebox(reasons,evidence,confirmations),edited=data.editedAnswer===undefined?null:v.text(data.editedAnswer,'Edited answer',20000);
  let answers=head?.answers||{standard:'',concise:'',bullets:''},text=prep?.why_program||'';
  if(command==='threebox.assemble'){
    requireValue(checks.ready,'threebox_review_required',checks.errors.join(' '));answers=assembleThreebox(program,reasons,evidence,delivery);text=answers.standard;
  }else if(edited!==null){text=edited;checks.ready=false;checks.warnings.push('Edited wording is retained privately. Reassemble from the reviewed boxes for evidence-bound forms.');}
  const entry={type,schemaVersion:1,teachingVersion:THREEBOX_TEACHING,revisionId:randomUUID(),parentRevisionId:head?.revisionId??null,answerVersion:(head?.answerVersion??0)+1,interviewId:row.id,program,createdAt:clock().toISOString(),state:command==='threebox.assemble'?'assembled':'draft',text,answersVersion:command==='threebox.assemble'?(head?.answerVersion??0)+1:head?.answersVersion??null,reasons,delivery,confirmations,answers,checks,contentHash:v.digest(text),evidence,evidenceDigest:v.digest({program,evidence}),resultDigest:verified?.research.receipt.sha256??null,coverageDigest:verified?.research.coverage.receipt.sha256??null,observedAt:verified?.research.coverage.observedAt??null,...((!head||projection.threebox.manualEdit)&&prep?.why_program?{legacyText:prep.why_program}:{})};
  requireValue(Buffer.byteLength(JSON.stringify(entry))<=131072,'threebox_too_large','This worksheet is too large. Nothing was truncated.',413);
  const {rows:[saved]}=await db.query(`INSERT INTO iiq.preparation(owner_id,interview_id,anchors,why_program,context_revision) VALUES($1,$2,$3::jsonb,$4,1)
    ON CONFLICT(interview_id) DO UPDATE SET anchors=iiq.preparation.anchors||$3::jsonb,why_program=$4,context_revision=iiq.preparation.context_revision+1 WHERE preparation.owner_id=$1 RETURNING id`,[actor.id,row.id,JSON.stringify([entry]),text]);
  requireValue(saved,'threebox_save_failed','The answer could not be saved.');await updateGap(db,row);return {type:'threebox',id:entry.revisionId,interviewId:row.id};
}
export async function attachThreebox(db,actor,config,state){
  if(!threeboxEnabled(config,actor))return;
  const {rows}=await db.query('SELECT * FROM iiq.preparation WHERE owner_id=$1',[actor.id]);
  for(const prep of rows){const i=state.interviews.find(x=>x.id===prep.interview_id&&x.owner===actor.id);if(i&&(!config.threebox.programId||i.program===config.threebox.programId))state.why[i.id]=threeboxHistory(prep,{id:i.id,program_id:i.program,program_name:i.programName,program_track:i.track});}
}
