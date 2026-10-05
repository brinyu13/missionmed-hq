import {subjectKey} from './postgres-runtime.mjs';
const deny=()=>new Error('interviewiq_saved_programs_unavailable');
// Domain rows are read-only. Existing owner request/proof nonces remain durable.
export function createInterviewiqSavedProgramsReader({pool,subjectHmacKey}={}){
 return async ({verifiedWpUserId,page,pageSize}={})=>{
  if(typeof pool?.connect!=='function'||typeof subjectHmacKey!=='string'||Buffer.byteLength(subjectHmacKey)<32||
    !Number.isSafeInteger(verifiedWpUserId)||verifiedWpUserId<1||!Number.isSafeInteger(page)||page<1||
    !Number.isSafeInteger(pageSize)||pageSize<1||pageSize>100||(page-1)*pageSize>=2000)throw deny();
  const key=subjectKey(`wp:${verifiedWpUserId}`,subjectHmacKey),client=await pool.connect();let discard=false;
  try{
   await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
   const role=(await client.query("SELECT current_user,rolsuper,rolbypassrls FROM pg_roles WHERE rolname=current_user")).rows[0];
   if(role?.current_user!=='rise_app_login'||role.rolsuper!==false||role.rolbypassrls!==false)throw deny();
   await client.query("SELECT set_config('rise.subject_key',$1,true),set_config('rise.is_admin','false',true)",[key]);
   const total=Number((await client.query('SELECT count(*)::text AS total FROM rise_runtime.student_program_states WHERE subject_key=$1',[key])).rows[0]?.total);
   if(!Number.isSafeInteger(total)||total<0||total>10000000)throw deny();
   const rows=(await client.query(`SELECT program_specialty_id AS "programRef",state,priority_position AS priority,updated_at AS "updatedAt"
     FROM rise_runtime.student_program_states WHERE subject_key=$1 ORDER BY priority_position NULLS LAST,program_specialty_id
     LIMIT $2 OFFSET $3`,[key,Math.min(pageSize,2000-(page-1)*pageSize),(page-1)*pageSize])).rows;
   return {total,rows:rows.map(row=>({programRef:row.programRef,state:row.state,priority:row.priority,updatedAt:row.updatedAt instanceof Date?row.updatedAt.toISOString():row.updatedAt}))};
  }catch{discard=true;throw deny();}finally{try{await client.query('ROLLBACK');}catch{discard=true;}client.release(discard);}
 };
}
