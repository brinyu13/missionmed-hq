import {randomUUID} from 'node:crypto';
import {notFound} from './errors.mjs';

// Call inside an actor write transaction. Always lock interview, then demand;
// reconciliation workers must use the same order and recheck the generation.
export async function ensureDemand(db,row,{refresh=false}={}) {
  const {rows:[current]}=await db.query(`SELECT id,owner_id,program_id FROM iiq.interviews
    WHERE id=$1 AND owner_id=$2 FOR UPDATE`,[row.id,row.owner_id]);
  if(!current)throw notFound();
  const {rows:[existing]}=await db.query(`SELECT * FROM iiq.research_demands
    WHERE interview_id=$1 AND owner_id=$2 FOR UPDATE`,[current.id,current.owner_id]);
  const program=current.program_id||null;
  const changed=existing && existing.program_id!==program;
  const legacy=existing && program && !existing.external_request_id;
  const retry=existing && refresh && program && !['queued','researching'].includes(existing.status);
  const unresolvedRepair=existing && !program && (existing.external_request_id || existing.status!=='waiting_identity');
  // A save/refresh while work is pending must not advance version or timestamps.
  if(existing && !changed && !legacy && !retry && !unresolvedRepair)return existing;

  const requestId=program?randomUUID():null;
  const status=program?'queued':'waiting_identity';
  let demand;
  if(existing) {
    ({rows:[demand]}=await db.query(`UPDATE iiq.research_demands SET program_id=$3,status=$4,
      external_request_id=$5,requested_at=now(),refreshed_at=NULL,last_error_code=NULL
      WHERE id=$1 AND owner_id=$2 RETURNING *`,[existing.id,current.owner_id,program,status,requestId]));
  } else {
    ({rows:[demand]}=await db.query(`INSERT INTO iiq.research_demands
      (owner_id,interview_id,program_id,status,external_request_id) VALUES($1,$2,$3,$4,$5) RETURNING *`,
      [current.owner_id,current.id,program,status,requestId]));
  }
  if(requestId) {
    // Old outbox entries remain immutable history. A dispatcher must reject
    // mismatched current request/program identities before effect and readback.
    await db.query(`INSERT INTO iiq.outbox_events(owner_id,topic,dedupe_key,payload)
      VALUES($1,'rise.research_requested',$2,$3::jsonb)`,[current.owner_id,`research:${requestId}`,
      JSON.stringify({demandId:demand.id,interviewId:current.id,ownerId:current.owner_id,programId:program,requestId})]);
  }
  return demand;
}
