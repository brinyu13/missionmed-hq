import {createHash} from 'node:crypto';

export const LINK_CATALOG_SHA='e10f72020ce0c5e9fab1734bc397e9416d510e32fa8474e71f47453813d626ef';

export async function researchLinkCatalog(client) {
  return (await client.query(`SELECT c.relname,c.relkind,c.relpersistence,c.relowner::regrole::text AS owner,c.relrowsecurity,c.relforcerowsecurity,
    n.nspowner::regrole::text AS schema_owner,
    (SELECT jsonb_agg(jsonb_build_object('column',a.attname,'type',format_type(a.atttypid,a.atttypmod),'required',a.attnotnull,'identity',a.attidentity,'generated',a.attgenerated,'acl',a.attacl,'default',pg_get_expr(d.adbin,d.adrelid)) ORDER BY a.attnum)
      FROM pg_attribute a LEFT JOIN pg_attrdef d ON d.adrelid=a.attrelid AND d.adnum=a.attnum WHERE a.attrelid=c.oid AND a.attnum>0 AND NOT a.attisdropped) AS columns,
    (SELECT jsonb_agg(jsonb_build_object('grantee',CASE WHEN a.grantee=0 THEN 'PUBLIC' ELSE a.grantee::regrole::text END,'privilege',a.privilege_type,'grantable',a.is_grantable)
      ORDER BY a.grantee::regrole::text COLLATE "C",a.privilege_type COLLATE "C") FROM aclexplode(coalesce(c.relacl,acldefault('r',c.relowner))) a) AS acl,
    (SELECT jsonb_agg(jsonb_build_object('name',p.polname,'command',p.polcmd,'permissive',p.polpermissive,'roles',(SELECT jsonb_agg(r::regrole::text ORDER BY r::regrole::text COLLATE "C") FROM unnest(p.polroles) r),
      'using',pg_get_expr(p.polqual,p.polrelid),'check',pg_get_expr(p.polwithcheck,p.polrelid)) ORDER BY p.polname COLLATE "C") FROM pg_policy p WHERE p.polrelid=c.oid) AS policies,
    (SELECT jsonb_agg(jsonb_build_object('name',conname,'validated',convalidated,'definition',pg_get_constraintdef(oid)) ORDER BY conname COLLATE "C") FROM pg_constraint WHERE conrelid=c.oid) AS constraints,
    (SELECT jsonb_agg(pg_get_indexdef(indexrelid) ORDER BY pg_get_indexdef(indexrelid) COLLATE "C") FROM pg_index WHERE indrelid=c.oid) AS indexes,
    (SELECT jsonb_agg(pg_get_ruledef(oid) ORDER BY rulename COLLATE "C") FROM pg_rewrite WHERE ev_class=c.oid) AS rules,
    (SELECT jsonb_agg(pg_get_triggerdef(oid) ORDER BY tgname COLLATE "C") FROM pg_trigger WHERE tgrelid=c.oid AND NOT tgisinternal) AS triggers
    FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='rise_runtime'
      AND c.relname IN ('iiq_research_job_links','iiq_research_link_migrations') ORDER BY c.relname COLLATE "C"`)).rows;
}

const BODY_SHA='cd3f2d0354792a954ffba7e4a2adcdd5af2f5ae97f1ba58ee2d9cbfbbb05ad5e';
const fail=()=>{throw Object.assign(Error('InterviewIQ job origin is unavailable'),{code:'IIQ_JOB_ORIGIN_UNAVAILABLE'});};

// Internal SQL fragments are constants; never accept an identifier from a client.
// Missing old IIQ schema preserves generic deployments. Partial/drifted schema
// stops the transaction before the generic reaper can erase uncertain costs.
export async function genericResearchOriginPredicates(client) {
  const {rows:[presence]}=await client.query(`SELECT to_regclass('rise_runtime.iiq_research_job_links') IS NOT NULL AS links,
    to_regclass('rise_runtime.iiq_research_link_migrations') IS NOT NULL AS ledger,
    to_regprocedure('rise_runtime.iiq_research_origin_class(uuid)') IS NOT NULL AS classifier`);
  if(presence?.links===false&&presence.classifier===false&&presence.ledger===false)return Object.freeze({expired:'TRUE',queued:'TRUE'});
  if(presence?.links!==true||presence.classifier!==true||presence.ledger!==true)fail();
  if(createHash('sha256').update(JSON.stringify(await researchLinkCatalog(client))).digest('hex')!==LINK_CATALOG_SHA)fail();
  const {rows:[fn]}=await client.query(`SELECT p.proowner::regrole::text AS owner,p.prosecdef,p.provolatile,p.proconfig,p.prosrc,
    l.lanname,p.prorettype::regtype::text AS result_type,
    (SELECT jsonb_agg(jsonb_build_object('grantee',CASE WHEN a.grantee=0 THEN 'PUBLIC' ELSE a.grantee::regrole::text END,
      'privilege',a.privilege_type,'grantable',a.is_grantable) ORDER BY a.grantee::regrole::text)
      FROM aclexplode(p.proacl) a WHERE a.grantee<>p.proowner) AS acl
    FROM pg_proc p JOIN pg_language l ON l.oid=p.prolang
    WHERE p.oid=to_regprocedure('rise_runtime.iiq_research_origin_class(uuid)')`);
  if(!fn||fn.owner!=='postgres'||!fn.prosecdef||fn.provolatile!=='s'||fn.lanname!=='plpgsql'||fn.result_type!=='text'||
    JSON.stringify(fn.proconfig)!=='["search_path=pg_catalog"]'||createHash('sha256').update(fn.prosrc).digest('hex')!==BODY_SHA||
    fn.acl?.length!==1||fn.acl[0].grantee!=='rise_app_runtime'||fn.acl[0].privilege!=='EXECUTE'||fn.acl[0].grantable!==false)fail();
  return Object.freeze({expired:"rise_runtime.iiq_research_origin_class(job_id)='GENERIC'",queued:"rise_runtime.iiq_research_origin_class(j.job_id)='GENERIC'"});
}
