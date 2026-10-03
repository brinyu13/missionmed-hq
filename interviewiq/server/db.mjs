import pg from 'pg';
import { AppError } from './errors.mjs';
import { UUID } from './auth.mjs';

// A date-only deadline or undated-time calendar entry must not be converted
// through the API host's local timezone by pg's Date parser.
pg.types.setTypeParser(1082, value => value);

export function createDatabase(config) {
  const pool=new pg.Pool({connectionString:config.databaseUrl,max:10,idleTimeoutMillis:30000,connectionTimeoutMillis:5000});
  return {
    pool,
    async verifyRuntimeRole() {
      // The login is NOINHERIT, but every request explicitly SET ROLEs. Checking
      // only the login would miss privilege drift on that effective role.
      const {rows:roles}=await pool.query(`SELECT r.rolname AS name,r.rolsuper,r.rolbypassrls,r.rolinherit,
        r.rolcreatedb,r.rolcreaterole,r.rolreplication,r.rolcanlogin,r.rolname=current_user AS login,
        pg_has_role(current_user,r.oid,'MEMBER') AS member,pg_has_role(current_user,r.oid,'SET') AS can_set
        FROM pg_roles r WHERE r.rolname IN (current_user,'iiq_authenticated','iiq_owner','iiq_worker')
          OR pg_has_role(current_user,r.oid,'MEMBER')`);
      const login=roles.find(r=>r.login),effective=roles.find(r=>r.name==='iiq_authenticated');
      const unsafe=r=>r.rolsuper||r.rolbypassrls||r.rolinherit||r.rolcreatedb||r.rolcreaterole||r.rolreplication;
      if(!login || !login.rolcanlogin || unsafe(login) || !effective || effective.login ||
        !effective.member || !effective.can_set || effective.rolcanlogin || unsafe(effective) ||
        roles.some(r=>!r.login && r.name!=='iiq_authenticated' && (r.member||r.can_set)) ||
        ['iiq_owner','iiq_worker'].some(name=>{const r=roles.find(v=>v.name===name);return !r||r.rolcanlogin||unsafe(r);}))
        throw new AppError(503,'unsafe_database_role','The database runtime role is not qualified.');
      const {rows:[custody]}=await pool.query(`SELECT
        (SELECT nspowner::regrole::text='iiq_owner' AND
          NOT has_schema_privilege(current_user,oid,'CREATE') AND
          NOT has_schema_privilege('iiq_authenticated',oid,'CREATE') AND
          NOT EXISTS(SELECT 1 FROM aclexplode(coalesce(nspacl,acldefault('n',nspowner))) a
            WHERE a.grantee=0 AND a.privilege_type IN ('CREATE','USAGE'))
          FROM pg_namespace WHERE nspname='iiq') AS schema_safe,
        (SELECT count(*)>=28 AND bool_and(c.relowner::regrole::text='iiq_owner' AND c.relrowsecurity AND c.relforcerowsecurity
          AND NOT has_table_privilege('iiq_authenticated',c.oid,'DELETE,TRUNCATE,TRIGGER,REFERENCES')
          AND NOT has_table_privilege(current_user,c.oid,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,TRIGGER,REFERENCES'))
          FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
          WHERE n.nspname='iiq' AND c.relkind IN ('r','p')) AS tables_safe,
        (SELECT count(*)>0 AND bool_and(p.proowner::regrole::text='iiq_owner' AND
          NOT EXISTS(SELECT 1 FROM aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a
            WHERE a.grantee=0 AND a.privilege_type='EXECUTE'))
          FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='iiq') AS functions_safe`);
      if(!custody?.schema_safe || !custody.tables_safe || !custody.functions_safe)
        throw new AppError(503,'unsafe_database_custody','The database object ownership and permissions are not qualified.');
      return true;
    },
    async health() { const result=await pool.query('SELECT 1 AS ok'); return result.rows[0]?.ok===1; },
    async withActor(actor,operation,{write=false}={}) {
      if(!actor?.eligible || !UUID.test(actor.id) || !['student','mentor','admin'].includes(actor.role) ||
          !Number.isSafeInteger(actor.wpUserId) || actor.wpUserId<=0 || !Array.isArray(actor.assignments) ||
          !actor.assignments.every(id=>UUID.test(id))) throw new AppError(401,'identity_required','A current verified identity is required.');
      const client=await pool.connect();
      try {
        await client.query('BEGIN');
        await client.query('SET LOCAL ROLE iiq_authenticated');
        await client.query(`SELECT set_config('iiq.actor_id',$1,true),set_config('iiq.wp_user_id',$2,true),
          set_config('iiq.role',$3,true),set_config('iiq.tier',$4,true),set_config('iiq.assignments',$5,true),
          set_config('statement_timeout','10000',true),set_config('lock_timeout','5000',true)`,
          [actor.id,String(actor.wpUserId),actor.role,actor.tier,JSON.stringify(actor.assignments)]);
        // Serialize one actor's commands so optimistic version checks, duplicate
        // request handling and private draft writes commit together.
        if(write) await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[actor.id]);
        const value=await operation(client);
        await client.query('COMMIT');return value;
      } catch(error) { await client.query('ROLLBACK').catch(()=>{});throw error; }
      finally {client.release();}
    },
    close:()=>pool.end(),
  };
}
