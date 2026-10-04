import {createHash} from 'node:crypto';

const ROLE='iiq_research_proof';
const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$(?![\s\S])/;
const ID=/^[A-Za-z0-9][A-Za-z0-9._:-]{0,179}$(?![\s\S])/,HASH=/^[a-f0-9]{64}$(?![\s\S])/;
const KEYS=['requestId','demandId','interviewId','ownerId','programId','registryReleaseId'];
const SHA=bytes=>createHash('sha256').update(bytes).digest('hex');
const fail=()=>{throw Error('research_store_unavailable');};
const bindingValid=v=>v&&KEYS.every((k,i)=>typeof v[k]==='string'&&(i<4?UUID:ID).test(v[k]));

// A jsonb object's retrieved key order is never the original wire order.
export function researchJobBody(binding) {
  if(!bindingValid(binding))fail();
  return JSON.stringify(Object.fromEntries([...KEYS.map(k=>[k,binding[k]]),['kind','program-gaps']]));
}
export const researchJobDigest=binding=>SHA(researchJobBody(binding));

const SELECT={actors:['id','wp_user_id'],interviews:['id','owner_id','program_id','status'],
  research_demands:['id','owner_id','interview_id','program_id','external_request_id'],
  research_job_grants:['request_id','owner_id','demand_id','interview_id','program_id','registry_release_id','request_sha256'],
  research_proof_nonces:['nonce']};
const INSERT={research_proof_nonces:['issuer','nonce','request_sha256','created_at','expires_at']};
const unsafe=r=>r.rolsuper||r.rolbypassrls||r.rolinherit||r.rolcreatedb||r.rolcreaterole||r.rolreplication;
async function qualify(client) {
  const {rows:roles}=await client.query(`SELECT r.rolname AS name,r.rolsuper,r.rolbypassrls,r.rolinherit,
    r.rolcreatedb,r.rolcreaterole,r.rolreplication,r.rolcanlogin,r.rolname=current_user AS login,
    pg_has_role(current_user,r.oid,'MEMBER') AS member,pg_has_role(current_user,r.oid,'SET') AS can_set,
    pg_has_role('${ROLE}',r.oid,'MEMBER') AS proof_member
    FROM pg_roles r WHERE r.rolname IN(current_user,'${ROLE}') OR pg_has_role(current_user,r.oid,'MEMBER')
      OR pg_has_role('${ROLE}',r.oid,'MEMBER')`);
  const login=roles.find(r=>r.login),proof=roles.find(r=>r.name===ROLE);
  if(!login||!login.rolcanlogin||unsafe(login)||!proof||proof.login||proof.rolcanlogin||unsafe(proof)||
    !proof.member||!proof.can_set||roles.some(r=>!r.login&&r.name!==ROLE&&(r.member||r.can_set))||
    roles.some(r=>r.name!==ROLE&&r.proof_member))fail();
  const {rows:memberships}=await client.query(`SELECT roleid::regrole::text AS role,member::regrole::text AS member,
    admin_option,inherit_option,set_option FROM pg_auth_members
    WHERE member=current_user::regrole OR member='${ROLE}'::regrole`);
  if(memberships.length!==1||memberships[0].role!==ROLE||memberships[0].member!==login.name||
    memberships[0].admin_option||memberships[0].inherit_option||!memberships[0].set_option)fail();
  const {rows:[schema]}=await client.query(`SELECT nspowner::regrole::text='iiq_owner' AS owned,
    has_schema_privilege('${ROLE}',oid,'USAGE') AS usable,
    has_schema_privilege('${ROLE}',oid,'CREATE') OR has_schema_privilege(current_user,oid,'CREATE') AS writable,
    EXISTS(SELECT 1 FROM aclexplode(coalesce(nspacl,acldefault('n',nspowner))) a
      WHERE a.grantee=0 AND a.privilege_type IN('CREATE','USAGE')) AS public
    FROM pg_namespace WHERE nspname='iiq'`);
  if(!schema?.owned||!schema.usable||schema.writable||schema.public)fail();
  const {rows:columns}=await client.query(`SELECT c.relname AS table_name,a.attname AS column_name,
    c.relowner::regrole::text AS owner,c.relkind AS kind,c.relrowsecurity AS rls,c.relforcerowsecurity AS forced,c.relpersistence AS persistence,
    has_column_privilege('${ROLE}',c.oid,a.attnum,'SELECT') AS readable,
    has_column_privilege('${ROLE}',c.oid,a.attnum,'INSERT') AS insertable,
    has_column_privilege('${ROLE}',c.oid,a.attnum,'UPDATE,REFERENCES') OR
      has_table_privilege('${ROLE}',c.oid,'DELETE,TRUNCATE,TRIGGER') AS mutable,
    has_column_privilege(current_user,c.oid,a.attnum,'SELECT,INSERT,UPDATE,REFERENCES') OR
      has_table_privilege(current_user,c.oid,'DELETE,TRUNCATE,TRIGGER') AS direct
    FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace JOIN pg_attribute a ON a.attrelid=c.oid
    WHERE n.nspname='iiq' AND c.relkind IN('r','p','v','m','f') AND a.attnum>0 AND NOT a.attisdropped`);
  if(!columns.length||columns.some(c=>c.owner!=='iiq_owner'||(SELECT[c.table_name]&&c.kind!=='r')||
    (['r','p'].includes(c.kind)&&(!c.rls||!c.forced))||c.persistence!=='p'||c.mutable||c.direct||
    c.readable!==Boolean(SELECT[c.table_name]?.includes(c.column_name))||
    c.insertable!==Boolean(INSERT[c.table_name]?.includes(c.column_name))))fail();
  for(const [table,names] of [...Object.entries(SELECT),...Object.entries(INSERT)])for(const column of names)
    if(!columns.some(c=>c.table_name===table&&c.column_name===column))fail();
  const {rows:[functions]}=await client.query(`SELECT NOT EXISTS(SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname='iiq' AND (has_function_privilege('${ROLE}',p.oid,'EXECUTE') OR has_function_privilege(current_user,p.oid,'EXECUTE'))) AS safe`);
  if(!functions?.safe)fail();
}

// No connection URL, environment lookup or runtime pool fallback. The caller
// must qualify transport separately before supplying the dedicated pool.
export async function createResearchJobStore({enabled=false}={}, {pool,now=Date.now}={}) {
  if(enabled!==true)return Object.freeze({getCommittedDemand:async()=>null,consumeNonce:async()=>false});
  if(typeof pool?.connect!=='function')fail();
  async function transaction(operation) {
    const deadline=performance.now()+5000;
    let client,expired=false,broken=false;
    const remaining=()=>{
      const ms=Math.floor(deadline-performance.now());
      if(expired||ms<1){expired=true;fail();}return ms;
    };
    async function bounded(work) {
      const ms=remaining();let timer;
      try{return await Promise.race([Promise.resolve().then(work),new Promise((_,reject)=>{
        timer=setTimeout(()=>{expired=true;reject(Error('research_store_unavailable'));},ms);
      })]);}finally{clearTimeout(timer);}
    }
    const query=(text,values)=>bounded(()=>client.query({text,values,query_timeout:remaining()}));
    try {
      client=await bounded(async()=>{
        const acquired=await pool.connect();
        if(expired||performance.now()>=deadline){acquired.release(true);fail();}
        return acquired;
      });
      await query('BEGIN');
      await query('SET LOCAL search_path=pg_catalog');
      await query("SET LOCAL statement_timeout='3000'; SET LOCAL lock_timeout='1000'; SET LOCAL idle_in_transaction_session_timeout='5000'");
      await qualify({query});
      await query(`SET LOCAL ROLE ${ROLE}`);
      const result=await operation({query});
      await query('COMMIT');remaining();
      return result;
    } catch {
      // A timed-out query may still be unresolved: destroy its connection rather
      // than queueing an unbounded rollback behind it. Never reuse that socket.
      if(client&&!expired)try{await query('ROLLBACK');}catch{broken=true;}
      fail();
    } finally {if(client)client.release(broken||expired);}
  }
  await transaction(async()=>true);
  return Object.freeze({
    async getCommittedDemand(binding) {
      if(!bindingValid(binding)||Object.keys(binding).sort().join()!==[...KEYS].sort().join())return null;
      try{return await transaction(async client=>{
        const {rows:[row]}=await client.query(`SELECT g.request_id AS "requestId",g.demand_id AS "demandId",g.interview_id AS "interviewId",
          g.owner_id AS "ownerId",g.program_id AS "programId",g.registry_release_id AS "registryReleaseId",g.request_sha256 AS "requestSha256",
          a.wp_user_id AS "wpUserId",i.status AS lifecycle
          FROM iiq.research_job_grants g JOIN iiq.research_demands d ON d.id=g.demand_id AND d.owner_id=g.owner_id
          JOIN iiq.interviews i ON i.id=g.interview_id AND i.owner_id=g.owner_id
          JOIN iiq.actors a ON a.id=g.owner_id
          WHERE g.request_id=$1 AND g.demand_id=$2 AND g.interview_id=$3 AND g.owner_id=$4 AND g.program_id=$5 AND g.registry_release_id=$6
            AND d.external_request_id=g.request_id::text AND d.interview_id=g.interview_id AND d.program_id=g.program_id AND i.program_id=g.program_id`,KEYS.map(k=>binding[k]));
        if(!row||row.requestSha256!==researchJobDigest(binding))return null;
        const wpUserId=Number(row.wpUserId);
        if(!Number.isSafeInteger(wpUserId)||wpUserId<=0)return null;
        return {...row,wpUserId};
      });}catch{return null;}
    },
    async consumeNonce(value) {
      if(!value||Object.keys(value).sort().join()!=='expiresAt,issuer,nonce,requestHash'||value.issuer!=='rise-research-proof'||
        typeof value.nonce!=='string'||!UUID.test(value.nonce)||typeof value.requestHash!=='string'||!HASH.test(value.requestHash)||
        typeof value.expiresAt!=='string')return false;
      const time=now(),expiry=Date.parse(value.expiresAt);
      if(!Number.isSafeInteger(time)||!Number.isFinite(expiry)||new Date(expiry).toISOString()!==value.expiresAt||expiry-time<30000||expiry-time>120000)return false;
      try{return await transaction(async client=>{
        const {rows}=await client.query(`WITH clock AS MATERIALIZED(SELECT clock_timestamp() AS t)
          INSERT INTO iiq.research_proof_nonces(issuer,nonce,request_sha256,created_at,expires_at)
          SELECT $1,$2,$3,t,greatest($4::timestamptz,t+interval '90 seconds') FROM clock
          WHERE $4::timestamptz BETWEEN t+interval '20 seconds' AND t+interval '130 seconds'
          ON CONFLICT DO NOTHING RETURNING nonce`,[value.issuer,value.nonce,value.requestHash,value.expiresAt]);
        return rows.length===1;
      });}catch{return false;}
    },
  });
}
