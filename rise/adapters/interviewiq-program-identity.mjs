import {createHash} from 'node:crypto';
import {programIdentity,programSpecialtyIdentity,canonicalProgramSpecialtyIdentity} from '../src/identity.mjs';

const fail=()=>{throw Object.assign(Error('InterviewIQ program identity unavailable'),{code:'IIQ_EXECUTION_IDENTITY_CHANGED'});};
const need=x=>{if(!x)fail();};
const stable=x=>Array.isArray(x)?x.map(stable):x&&typeof x==='object'?Object.fromEntries(Object.keys(x).sort().map(k=>[k,stable(x[k])])):x;
const digest=x=>createHash('sha256').update(JSON.stringify(stable(x))).digest('hex');
const frozen=x=>{if(x&&typeof x==='object'){Object.values(x).forEach(frozen);Object.freeze(x);}return x;};
// One reviewed namespace relationship, not an ACGME/name fallback. The content
// fingerprint preserves the historical 2026 Preliminary/P/1405140P0/2 record;
// nothing here interprets that record as a current categorical track.
export const INTERVIEWIQ_IDENTITY_RELATIONSHIP=frozen({
 registryReleaseId:'rise_registry_acgme_2026-09-20_50d08ea6f2da',
 registrySha256:'6d1f8aa306012f7eea1f7c7a0af4f04be3d60f2c435d297a584a25e98923f989',
 programId:'rise_ps_d0382fec-f389-5cf8-8b25-ac0e256f710e',acgmeId:'1401611122',specialty:'Internal Medicine',
 identitySha256:'704e27f68cf8a5a983d23a24e5b18570c5fe6fe784de964b8f26f677fe6f542f',
 sourceTupleSha256:'293443e97693ad2740b543cb4f7230fb68d8d2cda550b414024a8ce33143035f',
});
function descriptor({registryIndex,registrySha256,programId,registryReleaseId}){
 need(registryIndex?.registryReleaseId===registryReleaseId&&Array.isArray(registryIndex.programs));
 const programs=registryIndex.programs.filter(p=>p.programSpecialtyId===programId);need(programs.length===1);
 const program=programs[0],ids=program.identifiers?.filter(i=>i.namespace==='ACGME_PROGRAM');
 need(ids?.length===1&&/^[0-9]{10}$/.test(ids[0].value)&&typeof program.designation==='string'&&program.designation.trim()===program.designation);
 return {program,acgmeId:ids[0].value,specialty:program.designation,registryIndex,registrySha256,programId,registryReleaseId};
}
export function resolveInterviewiqProgramIdentity(context,row){
 const d=descriptor(context),i=row?.identity,s=row?.source;
 need(i&&s&&i.acgme_id===d.acgmeId&&i.specialty===d.specialty&&i.reconciliation_status==='EXACT_ACGME_MATCH'&&i.exposure_state==='PRIVATE_BETA'&&i.source_id===s.source_id);
 if(i.program_specialty_id===d.programId){need(typeof i.program_identity_id==='string'&&i.program_identity_id.length>0);return frozen({mode:'DIRECT',acgmeId:d.acgmeId,canonicalSubjectId:i.program_identity_id,subjects:[...new Set([d.programId,i.program_identity_id])]});}
 const binding=INTERVIEWIQ_IDENTITY_RELATIONSHIP,current=programIdentity(d.acgmeId),retained=canonicalProgramSpecialtyIdentity(d.acgmeId,d.specialty);
 need(d.registryReleaseId===binding.registryReleaseId&&d.registrySha256===binding.registrySha256&&d.programId===binding.programId&&d.acgmeId===binding.acgmeId&&d.specialty===binding.specialty);
 need(d.registryIndex.activationStatus==='active'&&d.registryIndex.activationReceipt?.verified===true&&d.registryIndex.activationReceipt.apiIndexSha256===binding.registrySha256&&d.registryIndex.releaseGate?.sourceRightsApproved===true);
 const freida=d.program.identifiers.filter(x=>x.namespace==='FREIDA_PROGRAM');
 need(freida.length===1&&freida[0].value===d.acgmeId&&d.program.identifiers.length===2&&d.program.id===current.id&&programSpecialtyIdentity(current.id,d.specialty).id===d.programId&&i.program_identity_id===retained.program.id&&i.program_specialty_id===retained.id);
 need(d.program.entryFormat==='unknown'&&d.program.display?.state==='IL'&&d.program.display?.city==='Chicago'&&d.program.display?.programName==='Ascension Illinois/Saint Joseph (Chicago) Program');
 need(digest(i)===binding.identitySha256&&digest(s)===binding.sourceTupleSha256);
 return frozen({mode:'VERIFIED_NAMESPACE',acgmeId:d.acgmeId,canonicalSubjectId:i.program_identity_id,subjects:[d.programId,i.program_specialty_id,i.program_identity_id]});
}
// Sources have no runtime UPDATE privilege, so FOR SHARE OF s is not legal.
// Qualify their existing unconditional append-only enforcement instead. A normal
// execution lease excludes legitimate competing owner DDL; privileged bypass is
// outside this ordinary-role guarantee. The joined identity row is locked.
export async function qualifyInterviewiqSourceImmutability(client){
 const {rows}=await client.query(`SELECT c.relowner::regrole::text AS owner,n.nspowner::regrole::text AS schema_owner,c.relkind,c.relrowsecurity,c.relforcerowsecurity,
  current_setting('session_replication_role') AS replication_role,
  pg_has_role(current_user,c.relowner,'MEMBER') AS owns_table,
  has_parameter_privilege(current_user,'session_replication_role','SET') AS bypass,
  has_table_privilege(current_user,c.oid,'UPDATE') AS update_allowed,has_table_privilege(current_user,c.oid,'DELETE') AS delete_allowed,
  has_table_privilege(current_user,c.oid,'TRUNCATE') AS truncate_allowed,has_table_privilege(current_user,c.oid,'TRIGGER') AS trigger_allowed,
  t.tgname,t.tgenabled,t.tgtype,t.tgqual,t.tgnargs,octet_length(t.tgargs) AS args_length,
  p.proowner::regrole::text AS function_owner,p.prosecdef,p.proconfig,p.prosrc,p.pronargs,p.provolatile,p.prokind,p.prorettype::regtype::text AS return_type,(SELECT lanname FROM pg_language WHERE oid=p.prolang) AS language,
  p.pronamespace::regnamespace::text AS function_schema,p.proname,
  pg_has_role(current_user,p.proowner,'MEMBER') AS owns_function
  FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
  JOIN pg_trigger t ON t.tgrelid=c.oid AND NOT t.tgisinternal JOIN pg_proc p ON p.oid=t.tgfoid
  WHERE n.nspname='rise_runtime' AND c.relname='canonical_evidence_sources'`);
 need(rows.length===1);const r=rows[0];
 need(r.owner==='postgres'&&r.schema_owner==='postgres'&&r.relkind==='r'&&r.relrowsecurity&&r.relforcerowsecurity&&r.replication_role==='origin'&&!r.owns_table&&!r.owns_function&&!r.bypass&&!r.update_allowed&&!r.delete_allowed&&!r.truncate_allowed&&!r.trigger_allowed);
 need(r.tgname==='rise_canonical_sources_immutable'&&r.tgenabled==='O'&&r.tgtype===27&&r.tgqual===null&&r.tgnargs===0&&r.args_length===0&&r.function_owner==='postgres'&&r.function_schema==='rise_runtime'&&r.proname==='reject_canonical_evidence_mutation'&&r.pronargs===0&&r.provolatile==='v'&&r.prokind==='f'&&r.return_type==='trigger'&&r.language==='plpgsql'&&r.prosecdef&&JSON.stringify(r.proconfig)==='["search_path=pg_catalog, rise_runtime"]');
 need(createHash('sha256').update(r.prosrc).digest('hex')==='dc5b112d89c75c0c57a0f34f226d106e9b8d632b305449057c562e5391151d32');
}
export async function readInterviewiqProgramIdentity(client,context,{lock=false,required=true}={}){
 const d=descriptor(context);
 if(lock)await qualifyInterviewiqSourceImmutability(client);
 const {rows}=await client.query(`SELECT jsonb_build_object(
  'program_identity_id',i.program_identity_id,'program_specialty_id',i.program_specialty_id,'acgme_id',i.acgme_id,
  'reconciliation_status',i.reconciliation_status,'exposure_state',i.exposure_state,'source_id',i.source_id,
  'content_sha256',i.content_sha256,'program_name',i.program_name,'institution',i.institution,'city',i.city,'state',i.state,'specialty',i.specialty) AS identity,
  jsonb_build_object('source_id',s.source_id,'provider',s.provider,'provider_run_id',s.provider_run_id,'source_type',s.source_type,
   'source_file_sha256',s.source_file_sha256,'rights_state',s.rights_state,'exposure_state',s.exposure_state) AS source
  FROM rise_runtime.canonical_program_identities i JOIN rise_runtime.canonical_evidence_sources s USING(source_id)
  WHERE i.acgme_id=$1${lock?' FOR SHARE OF i':''}`,[d.acgmeId]);
 if(!rows.length&&!required&&d.programId!==INTERVIEWIQ_IDENTITY_RELATIONSHIP.programId)return frozen({mode:'UNMAPPED',subjects:[d.programId]});
 need(rows.length===1);return resolveInterviewiqProgramIdentity(context,rows[0]);
}
