// Conservative review gate, not a complete PostgreSQL parser or a substitute for human review.
import fs from 'node:fs/promises';
import {createReadStream} from 'node:fs';
import crypto from 'node:crypto';
const sha=x=>crypto.createHash('sha256').update(x).digest('hex');
const hex=x=>typeof x==='string'&&/^[a-f0-9]{64}$/.test(x);
const fail=message=>{throw Error('Preservation gate: '+message);};
const canonical=value=>JSON.stringify(value,Object.keys(value).sort());
export const targetMatches=(a,b)=>a&&b&&a.host===b.host&&String(a.port)===String(b.port)&&a.database===b.database&&Number(a.serverMajor)===Number(b.serverMajor);
export const BASELINE_TABLES=Object.freeze(('access_grants actors audit_events consents contribution_credits debriefs followups interview_history interviews learning_signals mentor_gaps mentor_notes outbox_events policies policy_authorities practice_attempts preparation recording_chunks recording_sessions related_events request_idempotency research_demands research_missions research_submissions review_items revisions shared_reports speech_segments').split(' ').map(name=>'iiq.'+name).concat('iiq_migrations.applied'));
function isolatedDestination(destination,productionDatabase) {
 return destination?.unixSocketOnly===true&&destination.disposable===true&&destination.serverMajor===18&&
  /^\/(?:private\/)?tmp\/[A-Za-z0-9._-]+\/socket$/.test(destination.host||'')&&
  /^[a-z_][a-z0-9_]*$/.test(destination.database||'')&&destination.database!==productionDatabase;
}

// Split executable top-level statements, treating quoted bodies as opaque. Reject
// malformed quotes/comments. Unknown forms never become implicitly additive.
export function sqlStatements(sql) {
 const statements=[];let current='',i=0;
 while(i<sql.length){
  if(sql.startsWith('--',i)){const end=sql.indexOf('\n',i+2);i=end<0?sql.length:end;current+=' ';continue;}
  if(sql.startsWith('/*',i)){let level=1;i+=2;while(i<sql.length&&level){if(sql.startsWith('/*',i)){level++;i+=2;}else if(sql.startsWith('*/',i)){level--;i+=2;}else i++;}if(level)fail('unterminated SQL comment');current+=' ';continue;}
  const c=sql[i];
  if(c==="'"||c==='"'){
   const quote=c;let fragment=c;i++;let closed=false;
   while(i<sql.length){const next=sql[i++];fragment+=next;if(next==='\\')fail('backslash SQL quoting requires separate parser review');if(next===quote){if(sql[i]===quote){fragment+=sql[i++];}else{closed=true;break;}}}
   if(!closed)fail('unterminated SQL quote');current+=fragment;continue;
  }
  if(c==='$'){
   const delimiter=sql.slice(i).match(/^\$(?:[A-Za-z_][A-Za-z0-9_]*)?\$/)?.[0];
   if(delimiter){const end=sql.indexOf(delimiter,i+delimiter.length);if(end<0)fail('unterminated SQL body');current+=sql.slice(i,end+delimiter.length);i=end+delimiter.length;continue;}
  }
  if(c===';'){if(current.trim())statements.push(current.trim());current='';i++;continue;}
  current+=c;i++;
 }
 if(current.trim())statements.push(current.trim());return statements;
}
export function assertNoTransactionEscape(body) {
 for(const statement of sqlStatements(body))if(/^(?:BEGIN|COMMIT|END|ABORT|ROLLBACK|SAVEPOINT|RELEASE|START\s+TRANSACTION|PREPARE\s+TRANSACTION|SET\s+(?:LOCAL\s+)?TRANSACTION)\b/i.test(statement))fail('embedded transaction control is forbidden');
}
export function classifyAdditive(body) {
 assertNoTransactionEscape(body);
 const statements=sqlStatements(body),unknown=[];
 if(!statements.length)fail('empty migration');
 for(const statement of statements){
  const normalized=statement.replace(/\s+/g,' ').trim();
  if(/^SET LOCAL ROLE iiq_owner$/i.test(normalized)||/^SET LOCAL search_path ?= ?pg_catalog$/i.test(normalized))continue;
  // Narrow initial policy: a new nullable column without data-changing defaults,
  // expressions, constraints, renames, dynamic SQL, permissions, or row rewrites.
  if(/^ALTER TABLE iiq\.[a-z_][a-z0-9_]* ADD COLUMN [a-z_][a-z0-9_]* (?:text|uuid|boolean|integer|bigint|smallint|jsonb|date|timestamptz|timestamp with time zone|timestamp without time zone|time without time zone)(?: NULL| DEFAULT NULL)?$/i.test(normalized))continue;
  unknown.push({statementSha256:sha(statement),kind:normalized.match(/^[A-Za-z]+(?: [A-Za-z]+)?/)?.[0]||'unknown'});
 }
 return {additiveOnly:unknown.length===0,unclassified:unknown};
}
async function reviewedFile(reference,label) {
 if(!reference||typeof reference.path!=='string'||!hex(reference.sha256))fail(label+' exact file/hash required');
 const stat=await fs.lstat(reference.path);if(!stat.isFile()||stat.isSymbolicLink()||stat.size>1024*1024)fail(label+' is not a bounded regular file');
 const bytes=await fs.readFile(reference.path);if(sha(bytes)!==reference.sha256)fail(label+' checksum mismatch');
 try{return JSON.parse(bytes);}catch{fail(label+' JSON invalid');}
}
function fresh(value,now,label) {const timestamp=Date.parse(value);if(!Number.isFinite(timestamp)||timestamp>now+60000||now-timestamp>86400000)fail(label+' must be current (maximum 24 hours)');return timestamp;}
export async function verifyPreservationEvidence(approval,{now=Date.now()}={}) {
 const evidence=await reviewedFile(approval.preservationEvidence,'preservation evidence');
 if(evidence.schema!=='missionmed.interviewiq.preservation-evidence.v1'||evidence.status!=='PASS'||!targetMatches(evidence.target,approval.target))fail('evidence target/status mismatch');
 const backup=evidence.backup,restore=evidence.restore;
 if(!backup||backup.format!=='custom'||backup.snapshotConsistent!==true||!hex(backup.sha256)||!Number.isSafeInteger(backup.bytes)||backup.bytes<5||typeof backup.path!=='string')fail('verified consistent custom backup required');
 const captured=fresh(backup.capturedAt,now,'backup');
 const stat=await fs.lstat(backup.path);if(!stat.isFile()||stat.isSymbolicLink()||stat.size!==backup.bytes||(stat.mode&0o077)!==0)fail('private backup file/size mismatch');
 const stream=createReadStream(backup.path),digest=crypto.createHash('sha256');let first=Buffer.alloc(0);
 for await(const chunk of stream){digest.update(chunk);if(first.length<5)first=Buffer.concat([first,chunk]).subarray(0,5);}
 if(first.toString()!=='PGDMP'||digest.digest('hex')!==backup.sha256)fail('backup bytes/checksum mismatch');
 if(!restore||restore.sourceBackupSha256!==backup.sha256||restore.recordsPreserved!==true||restore.migrationLedgerPreserved!==true||
   !isolatedDestination(restore.destination,approval.target.database))fail('successful isolated restore of this exact backup and ledger required');
 if(fresh(restore.completedAt,now,'restore')<captured)fail('restore predates backup');
 if(!hex(restore.sourceFingerprint)||restore.sourceFingerprint!==restore.restoredFingerprint)fail('restore data fingerprint mismatch');
 const counts=restore.sourceCounts;
 if(!counts||Array.isArray(counts)||!Object.keys(counts).length||Object.values(counts).some(n=>!Number.isSafeInteger(n)||n<0)||canonical(counts)!==canonical(restore.restoredCounts||{}))fail('restore count mismatch');
 if(BASELINE_TABLES.some(name=>!Object.hasOwn(counts,name))||counts['iiq_migrations.applied']<1||Object.keys(counts).some(name=>!/^iiq\.[a-z_][a-z0-9_]*$/.test(name)&&name!=='iiq_migrations.applied'))fail('complete domain and migration ledger counts required');
 const fingerprints=restore.tableFingerprints;
 if(!Array.isArray(fingerprints)||fingerprints.length!==Object.keys(counts).length||new Set(fingerprints.map(t=>t.table)).size!==fingerprints.length||
   fingerprints.some(t=>!Object.hasOwn(counts,t.table)||t.row_count!==counts[t.table]||!hex(t.aggregate_sha256)))fail('complete matching table fingerprint inventory required');
 if(!restore.integrity||['orphan_interviews','orphan_events','orphan_history','unvalidated_constraints'].some(key=>restore.integrity[key]!==0)||Object.values(restore.integrity).some(n=>n!==0))fail('zero orphan and constraint integrity counters required');
 return evidence;
}
export async function verifyMigrationPolicy(approval,pending,{bodyOf,now=Date.now()}={}) {
 if(approval.policy!=='additive-only')fail('additive-only policy must be explicit');
 const requiring=[];
 for(const migration of pending){
  const body=bodyOf(migration.sql),classified=classifyAdditive(body);
  // DR-373 / A14 independently reviewed expansion: fresh NOLOGIN proof role,
  // new private tables and new-role-only policies. Recognize only immutable
  // reviewed bytes; this does not generalize the conservative SQL classifier.
  const reviewedExpansion=migration.name==='20261004073823_iiq_1204_committed_research_grants.sql'&&
   migration.sha256==='ac686850e55656ed7204ee56d3101db94ca932495153f0b1ca7e293f46fa35e0'&&
   sha(migration.sql)===migration.sha256&&sha(body)==='685a8bf65982e77fb86b2a27a7862992d938ab5c2007fb37af5fd1fadbdc5789' ||
   // DR-383 reviewed expansion: exact new owned LOI tables only, never a generic DDL allowance.
   migration.name==='20261005130100_iiq_1204_loi_targets.sql'&&
   migration.sha256==='2dcd407d4f4a73b5d2b4e119c1165321336617f93da58f8f0388777517963915'&&
   sha(migration.sql)===migration.sha256&&sha(body)==='dc1348b85456a5d5218aa1f192dec4e4544a14f1607533fa634d573d95233c89' ||
   // DR-390 independently reviewed exact additive intake/Calendar bytes; no generic DDL allowance.
   migration.name==="20261005221500_iiq_1204_interview_intake_v2.sql"&&
   migration.sha256==="d58ad6e51bf618b536ae5818ec9ea797965e9c94813216fff56246626922fd2e"&&
   sha(migration.sql)===migration.sha256&&sha(body)==="8b3c6b14410505339d21d96f0d3f2bdaab32e131c9aced38b2761ef7a4921c58" ||
   // DR-390 independently reviewed exact additive intake/Calendar bytes; no generic DDL allowance.
   migration.name==="20261005221501_iiq_1204_calendar_projection_itinerary.sql"&&
   migration.sha256==="3af3b280f00c652572aba98ec631656389a40b96b5f948b12b372d4f242a43ca"&&
   sha(migration.sql)===migration.sha256&&sha(body)==="0aa5048dba10676bdf64e17903670e2e487b8af14ef019570c3009329d981bb3";
  if(!classified.additiveOnly&&!reviewedExpansion)requiring.push({name:migration.name,sha256:migration.sha256});
 }
 if(!requiring.length)return {additiveOnly:true,requiresFounder:[]};
 const permission=await reviewedFile(approval.founderAuthorization,'explicit Founder authorization');
 if(permission.schema!=='missionmed.interviewiq.destructive-migration-authorization.v1'||permission.status!=='APPROVED'||
  permission.authorizedBy!=='Brian'||permission.explicitPermission!=='DESTRUCTIVE_MIGRATION_AUTHORIZED'||
  !permission.authorityRef||!targetMatches(permission.target,approval.target)||
  permission.preservationEvidenceSha256!==approval.preservationEvidence.sha256||
  JSON.stringify(permission.migrations)!==JSON.stringify(requiring))fail('Founder authorization does not bind exact proposed operations and recovery evidence');
 fresh(permission.authorizedAt,now,'Founder authorization');
 for(const kind of ['inventory','rationale','alternatives','rollbackForwardRepair','dryRun']){
  const material=await reviewedFile(permission.materials?.[kind],'Founder '+kind+' material');
  if(material.schema!=='missionmed.interviewiq.destructive-migration-material.v1'||material.kind!==kind||
    !targetMatches(material.target,approval.target)||material.preservationEvidenceSha256!==approval.preservationEvidence.sha256||
    JSON.stringify(material.migrations)!==JSON.stringify(requiring)||typeof material.details!=='string'||!material.details.trim())fail('Founder protocol materials must bind the exact operation and recovery evidence');
  if(kind==='dryRun'){
   if(material.status!=='PASS'||!isolatedDestination(material.destination,approval.target.database))fail('successful isolated exact-operation dry run required');
   fresh(material.completedAt,now,'Founder dry run');
  }
 }
 // This is a hash-bound review receipt, not cryptographic proof of a human's
 // intent. The independent operator must verify the original Founder instruction.
 return {additiveOnly:false,requiresFounder:requiring};
}
