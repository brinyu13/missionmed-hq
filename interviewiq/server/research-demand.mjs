import {randomUUID} from 'node:crypto';
import {notFound} from './errors.mjs';
import {researchJobBody,researchJobDigest} from './research-job-store.mjs';

// Call inside an actor write transaction. Always lock interview, then demand;
// reconciliation workers must use the same order and recheck the generation.
export async function ensureDemand(db,row,{refresh=false,registryReleaseId}={}) {
  if(registryReleaseId!==undefined&&(typeof registryReleaseId!=='string'||!/^[A-Za-z0-9][A-Za-z0-9._:-]{0,179}$(?![\s\S])/.test(registryReleaseId)))
    throw Error('invalid_registry_release');
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
  let grantChanged=false;
  if(existing&&program&&registryReleaseId!==undefined) {
    const {rows:[grant]}=await db.query(`SELECT registry_release_id FROM iiq.research_job_grants
      WHERE request_id::text=$1 AND demand_id=$2 AND owner_id=$3`,[existing.external_request_id,existing.id,current.owner_id]);
    grantChanged=!grant||grant.registry_release_id!==registryReleaseId;
  }
  // A save/refresh while work is pending must not advance version or timestamps.
  if(existing && !changed && !legacy && !retry && !unresolvedRepair && !grantChanged)return existing;

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
    let payload={demandId:demand.id,interviewId:current.id,ownerId:current.owner_id,programId:program,requestId};
    if(registryReleaseId!==undefined) {
      payload={requestId,demandId:demand.id,interviewId:current.id,ownerId:current.owner_id,programId:program,registryReleaseId};
      await db.query(`INSERT INTO iiq.research_job_grants(request_id,demand_id,interview_id,owner_id,program_id,registry_release_id,request_sha256)
        VALUES($1,$2,$3,$4,$5,$6,$7)`,[requestId,demand.id,current.id,current.owner_id,program,registryReleaseId,researchJobDigest(payload)]);
    }
    // Old outbox entries remain immutable history. A dispatcher must reject
    // mismatched current request/program identities before effect and readback.
    await db.query(`INSERT INTO iiq.outbox_events(owner_id,topic,dedupe_key,payload)
      VALUES($1,'rise.research_requested',$2,$3::jsonb)`,[current.owner_id,`research:${requestId}`,
      registryReleaseId===undefined?JSON.stringify(payload):researchJobBody(payload)]);
  }
  return demand;
}
