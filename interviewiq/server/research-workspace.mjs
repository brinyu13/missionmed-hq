import {readMRX} from './mrx-publication.mjs';
import {notFound,requireValue} from './errors.mjs';
import * as v from './validation.mjs';
import {MRX_VERSION,MRX_SCHEMA} from './research-standard.mjs';

export const researchCommands=new Set(['mission.create','submission.upload','submission.repair','submission.withdraw','submission.decide','research.read']);
export const researchEnabled=(config,actor)=>config?.researchMissionsEnabled===true&&actor?.eligible===true&&
  (actor.role==='admin'&&actor.tier==='admin'||actor.role==='student'&&['360','ivprep_complete'].includes(actor.tier));
export function requireResearch(config,actor){
  requireValue(config?.researchMissionsEnabled===true,'coming_soon','Research missions are not active in this release.',503);
  requireValue(researchEnabled(config,actor),'research_access_required','Current InterviewIQ research access is required.',403);
}
export const provisionalMission=m=>m?.standard_version===MRX_VERSION||m?.public_payload?.kind===MRX_VERSION||m?.public_payload?.schema===MRX_SCHEMA;
// Fixed SQL fragment used only with the constant alias m and bound version/schema.
export const provisionalSQL="(m.standard_version=$1 OR COALESCE(m.public_payload->>'kind'=$1,false) OR COALESCE(m.public_payload->>'schema'=$2,false))";
export const provisionalValues=[MRX_VERSION,MRX_SCHEMA];
const iso=x=>x instanceof Date?x.toISOString():x||null;
const liveReview="r.source_kind='research' AND r.permitted_use AND r.status IN ('pending','approved','repair_requested') AND s.parsed_package#>'{_iiq,eligibleForReview}'='true'::jsonb";
const joins='JOIN iiq.research_missions m ON m.id=s.mission_id AND m.owner_id=s.owner_id';
const reviewJoins=`JOIN iiq.research_submissions s ON s.id=r.submission_id AND s.owner_id=r.owner_id ${joins}`;
const ownReview="LEFT JOIN LATERAL (SELECT * FROM iiq.review_items x WHERE x.submission_id=s.id AND x.owner_id=s.owner_id AND x.source_kind='research' ORDER BY x.created_at DESC,x.id DESC LIMIT 1) r ON true";
const subColumns=`s.id,s.mission_id,s.repair_parent_id,s.sha256,s.created_at,m.program_id,
  s.parsed_package#>>'{_iiq,status}' AS structural_status,s.parsed_package#>'{_iiq,reasons}' AS reasons,
  s.parsed_package#>'{_iiq,eligibleForReview}' AS eligible_for_review,s.parsed_package#>>'{_iiq,version}' AS package_version,
  r.id AS review_id,r.version AS review_version,r.status AS review_status,r.execution_status,r.quality_status,r.publication_status,r.credit_status`;
const timestamp=alias=>`to_char(${alias}.created_at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS cursor_at`;
function cursor(value){
  if(value===undefined||value===null)return [null,null];
  v.onlyKeys(value,['at','id']);v.uuid(value.id,'Page');
  requireValue(typeof value.at==='string'&&/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{6}Z$/.test(value.at)&&
    Number.isFinite(Date.parse(value.at))&&new Date(value.at).toISOString().slice(0,19)===value.at.slice(0,19),'invalid_cursor','This research page cursor is invalid.');
  return [value.at,value.id];
}
const missionMeta=row=>({id:row.id,program:row.program_id,name:row.program_name||row.public_payload?.program?.name||'',track:row.program_track||row.public_payload?.program?.track||'',policy:row.standard_version,status:row.status,at:iso(row.created_at),expiresAt:iso(row.expires_at)});
const submissionMeta=row=>({id:row.id,mission:row.mission_id,parent:row.repair_parent_id,program:row.program_id,at:iso(row.created_at),sha256:row.sha256,
  status:row.structural_status||'quarantined',eligibleForReview:row.eligible_for_review===true,reasons:Array.isArray(row.reasons)?row.reasons:[],version:Number(row.package_version)||1,
  reviewId:row.review_id||null,reviewVersion:Number(row.review_version)||null,reviewStatus:row.review_status||null,
  decisions:{execution:row.execution_status||'unverified',quality:row.quality_status||'pending',publication:row.publication_status||'unpublished',credit:row.credit_status||'none'}});
async function list(db,actor,kind,pageCursor){
  const [at,id]=cursor(pageCursor);let sql;
  if(kind==='missions')sql=`SELECT m.id,m.program_id,m.standard_version,m.status,m.created_at,m.expires_at,
    left(m.public_payload#>>'{program,name}',500) AS program_name,left(m.public_payload#>>'{program,track}',300) AS program_track,${timestamp('m')}
    FROM iiq.research_missions m WHERE m.owner_id=$1 AND m.standard_version=$4
    AND ($2::timestamptz IS NULL OR (m.created_at,m.id)<($2::timestamptz,$3::uuid)) ORDER BY m.created_at DESC,m.id DESC LIMIT 21`;
  else if(kind==='submissions')sql=`SELECT ${subColumns},${timestamp('s')}
    FROM iiq.research_submissions s ${joins} ${ownReview} WHERE s.owner_id=$1 AND m.standard_version=$4
    AND ($2::timestamptz IS NULL OR (s.created_at,s.id)<($2::timestamptz,$3::uuid)) ORDER BY s.created_at DESC,s.id DESC LIMIT 21`;
  else {
    requireValue(actor.role==='admin','admin_required','Administrator review is required.',403);
    // Consent revocation synchronously sets review.status=withdrawn in the
    // qualified applied schema. No access to another owner's consents is added.
    sql=`SELECT ${subColumns},${timestamp('r')} FROM iiq.review_items r ${reviewJoins}
      WHERE $1::uuid IS NOT NULL AND m.standard_version=$4 AND r.program_id=m.program_id AND ${liveReview}
      AND ($2::timestamptz IS NULL OR (r.created_at,r.id)<($2::timestamptz,$3::uuid)) ORDER BY r.created_at DESC,r.id DESC LIMIT 21`;
  }
  const {rows}=await db.query(sql,[actor.id,at,id,MRX_VERSION]),visible=rows.slice(0,20),last=visible.at(-1);
  return {items:visible.map(kind==='missions'?missionMeta:submissionMeta),nextCursor:rows.length>20?{at:last.cursor_at,id:kind==='reviews'?last.review_id:last.id}:null};
}
export async function readResearchSummary(db,actor,config){
  if(!researchEnabled(config,actor))return null;
  const missions=await list(db,actor,'missions'),submissions=await list(db,actor,'submissions');
  const reviews=actor.role==='admin'?await list(db,actor,'reviews'):null;
  const publicationQueue=config?.mrxPublication?.enabled===true&&actor.role==='admin'?(await db.query("SELECT i.id,i.operation,d.submission_id,d.program_id FROM iiq.mrx_intents i JOIN iiq.mrx_decisions d ON d.id=i.decision_id LEFT JOIN iiq.mrx_receipts r ON r.intent_id=i.id WHERE r.intent_id IS NULL ORDER BY i.created_at,i.id LIMIT 40")).rows:[];
  return {missions,submissions,reviews,publicationQueue,policyVersion:MRX_VERSION,publicationAvailable:config?.mrxPublication?.enabled===true,executionVerificationAvailable:false,creditAvailable:false};
}
export async function readResearch({db,actor,config,data}){
  requireResearch(config,actor);v.onlyKeys(data,['kind','id','cursor']);
  const kind=v.choice(data.kind,['missions','submissions','reviews','mission','submission','review'],'research view');
  if(['missions','submissions','reviews'].includes(kind)){
    requireValue(data.id===undefined,'unexpected_fields','A list does not accept a record identifier.');
    return {kind,...await list(db,actor,kind,data.cursor)};
  }
  requireValue(data.cursor===undefined,'unexpected_fields','A detail does not accept a page cursor.');const id=v.uuid(data.id,'Research record');
  if(kind==='mission'){
    const {rows:[row]}=await db.query('SELECT id,owner_id,program_id,standard_version,status,expires_at,created_at,public_payload FROM iiq.research_missions WHERE id=$1 AND owner_id=$2 AND standard_version=$3',[id,actor.id,MRX_VERSION]);
    if(!row)throw notFound();return {kind,mission:{...missionMeta(row),payload:row.public_payload}};
  }
  let sql,values;
  if(kind==='review'){
    requireValue(actor.role==='admin','admin_required','Administrator review is required.',403);
    sql=`SELECT ${subColumns},s.parsed_package,m.public_payload FROM iiq.review_items r ${reviewJoins}
      WHERE r.id=$1 AND m.standard_version=$2 AND r.program_id=m.program_id AND ${liveReview}`;values=[id,MRX_VERSION];
  }else{
    sql=`SELECT ${subColumns},s.parsed_package,m.public_payload FROM iiq.research_submissions s ${joins} ${ownReview}
      WHERE s.id=$1 AND s.owner_id=$2 AND m.standard_version=$3`;values=[id,actor.id,MRX_VERSION];
  }
  const {rows:[row]}=await db.query(sql,values);if(!row)throw notFound();
  const {rows:audit}=await db.query(`SELECT event_type,created_at,metadata FROM iiq.audit_events
    WHERE object_id=ANY($1::uuid[]) AND event_type IN ('submission.quality','submission.withdraw')
    ORDER BY created_at DESC,id DESC LIMIT 50`,[[row.id,row.review_id].filter(Boolean)]);
  return {kind,submission:{...submissionMeta(row),original:row.parsed_package?._iiq?.original||'',package:row.parsed_package?.package||null,
    mission:row.public_payload,mrx:await readMRX(db,actor,config,row.id),audit:audit.map(x=>({event:x.event_type,at:iso(x.created_at),decision:x.metadata?.decision||null,value:x.metadata?.value||null,reason:x.metadata?.reason||''}))}};
}
