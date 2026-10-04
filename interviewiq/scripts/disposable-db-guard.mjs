// Destructive/fixture tooling may use only a private, live, disposable PG18 harness.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
import pg from 'pg';

const RUN=/^\/tmp\/iiq-pg18\.[A-Za-z0-9]+$/;
const USERS=new Set(['iiq_test_admin','iiq_runtime_test','iiq_queue_test','iiq_proof_test']);
const DATABASES=new Set(['iiq_test','iiq_test_restore']);
const denied=()=>{throw Error('Disposable harness required: production, ambiguous, or unqualified database target refused.');};
export function refuseProductionEnvironment(environment=process.env) {
  if(String(environment.NODE_ENV||'').toLowerCase()==='production' ||
    ['RAILWAY_PROJECT_ID','RAILWAY_SERVICE_ID','RAILWAY_ENVIRONMENT_ID','INTERVIEWIQ_DATABASE_URL','DATABASE_URL','PGPASSWORD','PGOPTIONS'].some(key=>Boolean(environment[key])))denied();
  // libpq honors hostaddr/service files independently of pg's URL parser. Never
  // let inherited routing, credentials or startup options reach fixture tools.
  for(const [key,value] of Object.entries(environment))if(value&&/^PG/i.test(key)&&!['PGHOST','PGPORT','PGUSER','PGDATABASE'].includes(key))denied();
  if(environment.PGHOST&&!/^\/tmp\/iiq-pg18\.[A-Za-z0-9]+\/socket$/.test(environment.PGHOST))denied();
  if(environment.PGPORT&&String(environment.PGPORT)!=='55432')denied();
  if(environment.PGUSER&&!USERS.has(environment.PGUSER))denied();
  if(environment.PGDATABASE&&!DATABASES.has(environment.PGDATABASE))denied();
}
export function localToolEnvironment(environment=process.env) {
  refuseProductionEnvironment(environment);
  return {...Object.fromEntries(Object.entries(environment).filter(([key])=>!/^PG/i.test(key))),LC_ALL:'C',LANG:'C'};
}
function privatePath(filename,kind) {
  let stat;try{stat=fs.lstatSync(filename);}catch{denied();}
  if(stat.isSymbolicLink() || (kind==='file'?!stat.isFile():kind==='socket'?!stat.isSocket():!stat.isDirectory()) ||
    typeof process.getuid!=='function' || stat.uid!==process.getuid())denied();
  if(kind!=='socket' && (stat.mode & 0o077)!==0)denied();
  return stat;
}
export function validateDisposableURL(connectionString,{role,database='iiq_test',environment=process.env}={}) {
  refuseProductionEnvironment(environment);
  let url;try{url=new URL(connectionString);}catch{denied();}
  const keys=[...url.searchParams.keys()];
  if(!['postgresql:','postgres:'].includes(url.protocol) || url.hostname!=='localhost' || url.port || url.hash ||
    url.password || !USERS.has(decodeURIComponent(url.username)) || (role&&decodeURIComponent(url.username)!==role) ||
    !DATABASES.has(database) || url.pathname!=='/'+database || keys.length!==2 ||
    new Set(keys).size!==2 || keys.some(key=>!['host','port'].includes(key)) ||
    url.searchParams.get('port')!=='55432')denied();
  const socket=url.searchParams.get('host'),directory=socket?.endsWith('/socket')?socket.slice(0,-7):'';
  if(!RUN.test(directory||''))denied();
  // pg's actual parser must agree; URLSearchParams.get alone can accept a first
  // duplicate host while pg selects its last value.
  const effective=new pg.Client({connectionString}).connectionParameters;
  if(effective.host!==socket || Number(effective.port)!==55432 ||
    effective.database!==database || effective.user!==decodeURIComponent(url.username) ||
    effective.password || effective.options)denied();
  return {connectionString,directory,socket,database,role:effective.user};
}
export function assertDisposableTarget(connectionString,options={}) {
  const target=validateDisposableURL(connectionString,options);
  privatePath(target.directory,'directory');
  const expected=path.join(fs.realpathSync('/tmp'),path.basename(target.directory));
  if(fs.realpathSync(target.directory)!==expected)denied();
  privatePath(target.socket,'directory');
  if(fs.realpathSync(target.socket)!==path.join(expected,'socket'))denied();
  const markerPath=path.join(target.directory,'harness.json');privatePath(markerPath,'file');
  let marker;try{marker=JSON.parse(fs.readFileSync(markerPath,'utf8'));}catch{denied();}
  if(marker.schema!=='missionmed.interviewiq.disposable-harness.v1' || marker.directory!==target.directory ||
    marker.ownerUid!==process.getuid() || !/^iiq_disposable_[a-f0-9]{32}$/.test(marker.clusterName||''))denied();
  privatePath(path.join(target.directory,'data'),'directory');
  privatePath(path.join(target.socket,'.s.PGSQL.55432'),'socket');
  const pidFile=path.join(target.directory,'data/postmaster.pid');privatePath(pidFile,'file');
  const pid=Number(fs.readFileSync(pidFile,'utf8').split('\n')[0]);
  if(!Number.isSafeInteger(pid)||pid<=1)denied();
  try{process.kill(pid,0);}catch{denied();}
  return {...target,clusterName:marker.clusterName};
}
export async function qualifyDisposableConnection(client,connectionString,options={}) {
  const target=assertDisposableTarget(connectionString,options);
  const {rows:[actual]}=await client.query("SELECT current_database() AS database,current_user AS username,current_setting('server_version_num')::integer/10000 AS major,current_setting('cluster_name') AS cluster,inet_server_addr() IS NULL AS unix_socket");
  if(actual?.database!==target.database || actual.username!==target.role ||
    actual.major!==18 || actual.cluster!==target.clusterName || actual.unix_socket!==true)denied();
  return target;
}
export function readDisposableConnectionFile(filename) {
  refuseProductionEnvironment();
  if(typeof filename!=='string'||!/^\/tmp\/iiq-pg18\.[A-Za-z0-9]+\/connection\.json$/.test(filename))denied();
  privatePath(path.dirname(filename),'directory');privatePath(filename,'file');
  let connection;try{connection=JSON.parse(fs.readFileSync(filename,'utf8'));}catch{denied();}
  if(connection.syntheticOnly!==true || connection.unixSocketOnly!==true || connection.directory!==path.dirname(filename))denied();
  for(const [key,role] of [['databaseUrl','iiq_runtime_test'],['adminDatabaseUrl','iiq_test_admin'],['queueDatabaseUrl','iiq_queue_test']]) {
    if(assertDisposableTarget(connection[key],{role}).directory!==connection.directory)denied();
  }
  return connection;
}
export function initializeHarness(directory) {
  refuseProductionEnvironment();
  if(!RUN.test(directory||''))denied();
  privatePath(directory,'directory');
  if(fs.realpathSync(directory)!==path.join(fs.realpathSync('/tmp'),path.basename(directory)))denied();
  const clusterName='iiq_disposable_'+crypto.randomBytes(16).toString('hex');
  fs.writeFileSync(path.join(directory,'harness.json'),JSON.stringify({schema:'missionmed.interviewiq.disposable-harness.v1',directory,ownerUid:process.getuid(),clusterName,createdAt:new Date().toISOString()})+'\n',{flag:'wx',mode:0o600});
  return clusterName;
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  if(process.argv.length!==4||process.argv[2]!=='--initialize')throw Error('Only --initialize <new-private-harness-directory> is supported.');
  console.log(initializeHarness(process.argv[3]));
}
