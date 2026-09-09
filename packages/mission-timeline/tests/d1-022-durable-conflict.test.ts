import assert from "node:assert/strict";
import test from "node:test";
import "fake-indexeddb/auto";
import { SignJWT } from "jose";
import { WordPressTimelineJwtVerifier } from "../src/identity/wordpress-timeline-jwt.js";
import { TimelineService } from "../src/domain/timeline-service.js";
import { InMemoryTimelineRepository } from "../src/persistence/repository.js";
import { TimelineHttpApi } from "../src/api/http-api.js";
import { InMemoryPrincipalDirectory, MatrixSessionExchange } from "../src/identity/matrix-identity.js";
import { InMemoryPrivateObjectStore } from "../src/storage/private-object-store.js";
import { InMemoryTelemetrySink, PrivacySafeTelemetry } from "../src/telemetry/telemetry.js";
import { canonicalDocumentHash } from "../src/core/canonical.js";
import { context, document, fixedClock, student, otherStudent, programAdmin } from "./fixtures.js";
import type { TimelineDocument } from "../src/contracts/types.js";
const { HybridIndexedDbAdapter } = await import(new URL("../matrix/hybrid-indexeddb-adapter.js", import.meta.url).href);

async function setup(owner=student) {
  const repository = new InMemoryTimelineRepository();
  const service = new TimelineService(repository, fixedClock);
  const input = document({theme:"missionnavy", advanced:{media:[{id:"synthetic",frame:{x:12,y:34}}]},intake:{lastImport:{source:"synthetic"}}});
  await service.createDocument(owner,{id:input.id,programId:input.programId,title:input.title,document:input,theme:input.theme});
  await service.createVersion(owner,input.id,0,input,"Baseline");
  const server=(await repository.getDocument(input.id))!.document;
  const local:TimelineDocument={...structuredClone(server),theme:"horizon",title:"Synthetic unsynced copy"};
  const client={configured:true,
    recoverConflict:(id:string,request:Parameters<TimelineService["recoverConflict"]>[2])=>service.recoverConflict(owner,id,request),
    getDocument:(id:string)=>service.getDocument(owner,id),
    listVersions:async(id:string)=>({versions:await service.listDocumentVersions(owner,id)}),
    getVersion:(id:string,versionId:string)=>service.getDocumentVersion(owner,id,versionId)};
  const createAdapter=async(name=`durable-${crypto.randomUUID()}`,api=client)=>{
    const adapter=new HybridIndexedDbAdapter({name,apiClient:api,remoteSyncConsent:true});await adapter.open();return adapter;
  };
  const adapter=await createAdapter();
  await adapter.put("settings",{id:`remote-revision:${input.id}`,documentId:input.id,revision:0});
  await adapter.atomicPut([{store:"documents",key:input.id,value:{id:input.id,document:local,sequence:1}}]);
  await adapter.reconcileAuthoritative([],{documentId:input.id,serverRevision:server.revision,serverSnapshot:server});
  return{repository,service,server,local,client,adapter,createAdapter,id:input.id};
}
function presentation(value:TimelineDocument){const copy=structuredClone(value);delete(copy as Partial<TimelineDocument>).revision;if(copy.metadata){delete copy.metadata.conflictRecovery022;delete copy.metadata.qualityReport022;delete copy.metadata.qualitySummary022;}return copy;}
const inputFor=(local:TimelineDocument,strategy:"USE_SERVER"|"KEEP_LOCAL"="USE_SERVER")=>({requestId:crypto.randomUUID(),baseRevision:1,strategy,snapshot:structuredClone(local)});

for(const strategy of ["USE_SERVER","KEEP_LOCAL"] as const)test(`${strategy}: both immutable copies survive in second-browser History, chosen state stays exact`,async()=>{
 const s=await setup();let second;
 try {
  const result=await s.adapter.resolveConflict(s.id,strategy);assert.equal(result.pending,0);assert.equal(result.durable,true);
  const record=(await s.repository.getDocument(s.id))!;assert.equal(record.document.revision,3);
  assert.deepEqual(presentation(record.document),presentation(strategy==="USE_SERVER"?s.server:s.local));
  const recovery=await s.service.getDocumentVersion(student,s.id,result.recoveryVersionId);
  assert.deepEqual(presentation(recovery.snapshot),presentation(strategy==="USE_SERVER"?s.local:s.server));
  second=await s.createAdapter();await second.hydrateAuthoritative([{store:"documents",key:s.id,value:{id:s.id,document:record.document}}]);
  const before=(await s.repository.listVersions(s.id)).length;const history=await second.listDocumentVersions(s.id);
  assert.equal(history.length,2);assert.equal(history.find((v:{id:string})=>v.id===result.recoveryVersionId).remoteVersion,true);
  assert.deepEqual((await second.get("versions",result.recoveryVersionId)).documentSnapshot,recovery.snapshot);
  assert.equal((await s.repository.listVersions(s.id)).length,before);assert.equal((await second.pending()).length,0);
  await assert.rejects(second.delete("versions",result.recoveryVersionId),{code:"REMOTE_VERSION_IMMUTABLE"});
  await assert.rejects(second.put("versions",{...history[0],name:"Rewritten immutable record"}),{code:"REMOTE_VERSION_IMMUTABLE"});
 }finally{s.adapter.close();second?.close();}
});

test("recovery never reports SYNCED before the server receipt is acknowledged",async()=>{
 const s=await setup();let release!:()=>void,started!:()=>void;const wait=new Promise<void>(r=>release=r),signal=new Promise<void>(r=>started=r);
 const original=s.client.recoverConflict;s.client.recoverConflict=async(...args)=>{const receipt=await original(...args);started();await wait;return receipt;};
 try{const work=s.adapter.resolveConflict(s.id,"USE_SERVER");await signal;
  assert.equal(s.adapter.getSyncStatus().state,"CONFLICT");assert.equal((await s.adapter.pending()).length,1);
  assert.equal((await s.adapter.get("documents",s.id)).document.theme,"horizon");assert.ok(await s.adapter.get("settings",`conflict-recovery-intent:${s.id}`));
  assert.equal((await s.adapter.flush()).conflict,true);release();assert.equal((await work).pending,0);
 }finally{release();s.adapter.close();}
});

test("lost ACK survives adapter reload and retries the exact request without duplicating versions or audit",async()=>{
 const s=await setup();const original=s.client.recoverConflict;let calls=0,firstId="";
 s.client.recoverConflict=async(id,input)=>{calls++;if(calls===1)firstId=input.requestId;else assert.equal(input.requestId,firstId);const receipt=await original(id,input);if(calls===1)throw Object.assign(new Error("Synthetic lost ACK"),{code:"NETWORK_ERROR"});return receipt;};
 let reopened;
 try{await assert.rejects(s.adapter.resolveConflict(s.id,"USE_SERVER"),{code:"NETWORK_ERROR"});
  assert.equal((await s.repository.listVersions(s.id)).length,3);assert.equal(s.adapter.getSyncStatus().state,"CONFLICT");
  assert.equal((await s.adapter.get("documents",s.id)).document.theme,"horizon");
  const name=s.adapter.name;s.adapter.close();reopened=await s.createAdapter(name);
  await assert.rejects(reopened.resolveConflict(s.id,"KEEP_LOCAL"),{code:"CONFLICT_RECOVERY_RETRY_SAME_CHOICE"});
  assert.equal((await reopened.resolveConflict(s.id,"USE_SERVER")).pending,0);
  assert.equal((await s.repository.listVersions(s.id)).length,3);assert.equal(calls,2);
  assert.equal((await s.repository.listAudit()).filter(v=>v.metadata.reason==="CONFLICT_RECOVERY_PRESERVED").length,1);
 }finally{s.adapter.close();reopened?.close();}
});

test("a newer server save after an uncertain committed recovery remains an explicit conflict",async()=>{
 const s=await setup();const original=s.client.recoverConflict;let first=true;
 s.client.recoverConflict=async(...args)=>{const receipt=await original(...args);if(first){first=false;throw new Error("Lost ACK");}return receipt;};
 try{await assert.rejects(s.adapter.resolveConflict(s.id,"USE_SERVER"));
  const latest=(await s.repository.getDocument(s.id))!.document;
  await s.service.createVersion(student,s.id,3,{...latest,title:"Other browser new edit"},"Other browser");
  const result=await s.adapter.resolveConflict(s.id,"USE_SERVER");assert.equal(result.conflict,true);assert.equal(result.pending,1);
  assert.equal((await s.repository.getDocument(s.id))!.document.title,"Other browser new edit");
  assert.equal((await s.adapter.get("documents",s.id)).document.title,s.local.title);assert.equal(s.adapter.getSyncStatus().state,"CONFLICT");
 }finally{s.adapter.close();}
});

test("a local edit during recovery is retained and cannot be silently replaced by the ACK",async()=>{
 const s=await setup();let release!:()=>void,started!:()=>void;const wait=new Promise<void>(r=>release=r),signal=new Promise<void>(r=>started=r);
 const original=s.client.recoverConflict;s.client.recoverConflict=async(...args)=>{const receipt=await original(...args);started();await wait;return receipt;};
 try{const work=s.adapter.resolveConflict(s.id,"USE_SERVER");await signal;
  await s.adapter.atomicPut([{store:"documents",key:s.id,value:{id:s.id,document:{...s.local,title:"New local edit"},sequence:2}}]);
  release();const result=await work;assert.equal(result.conflict,true);assert.ok(result.pending>0);
  assert.equal((await s.adapter.get("documents",s.id)).document.title,"New local edit");assert.equal(s.adapter.getSyncStatus().state,"CONFLICT");
 }finally{release();s.adapter.close();}
});

test("stable identity rejects different content and replay is authorized again",async()=>{
 const s=await setup();try{const input=inputFor(s.local);const first=await s.service.recoverConflict(student,s.id,input);
  assert.equal(first.replayed,false);assert.equal((await s.service.recoverConflict(student,s.id,input)).replayed,true);
  await assert.rejects(s.service.recoverConflict(student,s.id,{...input,snapshot:{...input.snapshot,title:"Different content"}}),{code:"CONFLICT_RECOVERY_IDENTITY_MISMATCH"});
  for(const actor of [otherStudent,{...student,principalId:"spoof",role:"PROGRAM_ADMIN" as const}]){
   await assert.rejects(s.service.recoverConflict(actor,s.id,input),{code:"FORBIDDEN"});
   await assert.rejects(s.service.listDocumentVersions(actor,s.id),{code:"FORBIDDEN"});
   await assert.rejects(s.service.getDocumentVersion(actor,s.id,first.recoveryVersion.id),{code:"FORBIDDEN"});
  }
  assert.equal((await s.service.getDocumentVersion(programAdmin,s.id,first.recoveryVersion.id)).id,first.recoveryVersion.id);
  await s.service.createDocument(otherStudent,{id:"other-doc",programId:s.local.programId,title:"Other owner"});
  await assert.rejects(s.service.getDocumentVersion(otherStudent,"other-doc",first.recoveryVersion.id),{code:"VERSION_NOT_FOUND"});
 }finally{s.adapter.close();}
});

test("faculty version grants expose only the exact immutable version",async()=>{
 const s=await setup();try{
  const receipt=await s.service.recoverConflict(student,s.id,inputFor(s.local));
  const scopedFaculty=context("FACULTY","principal_scoped_faculty",{facultyGrants:[{
   documentId:s.id,versionId:receipt.chosenVersion.id,actions:["document:read"],expiresAt:"2027-01-01T00:00:00.000Z"
  }]});
  const history=await s.service.listDocumentVersions(scopedFaculty,s.id);
  assert.deepEqual(history.map(version=>version.id),[receipt.chosenVersion.id]);
  assert.equal(Object.hasOwn(history[0]!,"snapshot"),false);
  assert.equal((await s.service.getDocumentVersion(scopedFaculty,s.id,receipt.chosenVersion.id)).id,receipt.chosenVersion.id);
  await assert.rejects(
   s.service.getDocumentVersion(scopedFaculty,s.id,receipt.recoveryVersion.id),
   {code:"FORBIDDEN"},
  );
  const olderOnly={...scopedFaculty,principalId:"principal_older_faculty",facultyGrants:[{
   documentId:s.id,versionId:receipt.recoveryVersion.id,actions:["document:read" as const],expiresAt:"2027-01-01T00:00:00.000Z"
  }]};
  assert.deepEqual((await s.service.listDocumentVersions(olderOnly,s.id)).map(version=>version.id),[receipt.recoveryVersion.id]);
  await assert.rejects(s.service.getDocument(olderOnly,s.id),{code:"FORBIDDEN"});
  const record=(await s.repository.getDocument(s.id))!;
  const repositoryReturningCurrent=new Proxy(s.repository,{
   get(target,key){
    if(key==="listAccessibleDocuments")return async()=>[structuredClone(record)];
    const value=target[key as keyof typeof target];
    return typeof value==="function"?value.bind(target):value;
   },
  });
  const defensiveService=new TimelineService(repositoryReturningCurrent,fixedClock);
  assert.deepEqual(await defensiveService.listOwnDocuments(olderOnly),[]);
  assert.equal((await defensiveService.listOwnDocuments(scopedFaculty)).length,1);
  const documentWide={...olderOnly,principalId:"principal_document_wide_faculty",facultyGrants:[{
   documentId:s.id,actions:["document:read" as const],expiresAt:"2027-01-01T00:00:00.000Z"
  }]};
  assert.equal((await defensiveService.listOwnDocuments(documentWide)).length,1);
 }finally{s.adapter.close();}
});

test("failure between the two inserts rolls back both versions and keeps the current document",async()=>{
 const s=await setup();const before=await s.repository.getDocument(s.id),original=s.repository.saveVersion.bind(s.repository);let inserts=0;
 s.repository.saveVersion=async(...args)=>{if(++inserts===2)throw new Error("Synthetic second insert failure");return original(...args);};
 try{await assert.rejects(s.service.recoverConflict(student,s.id,inputFor(s.local)),/second insert/);
  assert.deepEqual(await s.repository.getDocument(s.id),before);assert.equal((await s.repository.listVersions(s.id)).length,1);
  assert.equal((await s.repository.listAudit()).some(v=>v.metadata.reason==="CONFLICT_RECOVERY_PRESERVED"),false);
 }finally{s.adapter.close();}
});

test("CAS denial refreshes the conflict but leaves the local copy and queue intact",async()=>{
 const s=await setup();try{await s.service.createVersion(student,s.id,1,{...s.server,title:"New concurrent winner"},"Newer");
  await assert.rejects(s.adapter.resolveConflict(s.id,"USE_SERVER"),{code:"REVISION_CONFLICT"});
  assert.equal((await s.adapter.getConflict(s.id)).serverDocument.title,"New concurrent winner");
  assert.equal((await s.adapter.pending()).length,1);assert.equal((await s.adapter.get("documents",s.id)).document.title,s.local.title);
  assert.equal(await s.adapter.get("settings",`conflict-recovery-intent:${s.id}`),undefined);
 }finally{s.adapter.close();}
});

for(const change of ["request","owner","hash","parent","missing","revision"])test(`malformed ${change} receipt cannot erase either copy or claim SYNCED`,async()=>{
 const s=await setup(),original=s.client.recoverConflict;
 s.client.recoverConflict=async(...args)=>{const receipt=structuredClone(await original(...args));
  if(change==="request")receipt.requestId=crypto.randomUUID();if(change==="owner")receipt.document.studentOwnerId="another-owner";
  if(change==="hash")receipt.recoveryVersion.contentSha256="0".repeat(64);if(change==="parent")receipt.chosenVersion.parentVersionId="wrong";
  if(change==="revision"){receipt.chosenVersion.revision=8;receipt.chosenVersion.snapshot.revision=8;receipt.chosenVersion.contentSha256=canonicalDocumentHash(receipt.chosenVersion.snapshot);}
  if(change==="missing")return {} as typeof receipt;return receipt;};
 try{await assert.rejects(s.adapter.resolveConflict(s.id,"USE_SERVER"));assert.equal((await s.adapter.pending()).length,1);
  assert.equal((await s.adapter.get("documents",s.id)).document.title,s.local.title);assert.equal(s.adapter.getSyncStatus().state,"CONFLICT");
  assert.ok(await s.adapter.get("settings",`conflict-recovery-intent:${s.id}`));
 }finally{s.adapter.close();}
});


test("authenticated HTTP recovery/history require exact owner or grant; no body/URL role flag grants access",async()=>{
 const s=await setup();const directory=new InMemoryPrincipalDirectory();
 for(const [principal,wpUserId] of [[student,42],[otherStudent,43]] as const)directory.register({principalId:principal.principalId,wpUserId,role:"STUDENT",programIds:principal.programIds,assignedDocumentIds:[],active:true});
 const identity=new MatrixSessionExchange(directory,{verify:async()=>true},"0123456789abcdef0123456789abcdef",600,fixedClock);
 const api=new TimelineHttpApi(s.service,identity,new InMemoryPrivateObjectStore("local","0123456789abcdef0123456789abcdef",fixedClock),new PrivacySafeTelemetry(new InMemoryTelemetrySink(),"local",fixedClock));
 const request=(path:string,method="GET",token="",payload?:unknown)=>new Request(`https://timeline.local/v1${path}`,{method,headers:{...(token?{authorization:`Bearer ${token}`}:{ }),...(payload?{"content-type":"application/json"}:{})},body:payload?JSON.stringify(payload):undefined});
 const tokenFor=async(wpUserId:number)=>(await(await api.handle(request("/session/exchange","POST"),{wpUserId,displayName:"Synthetic",nonceVerified:true,sessionId:`synthetic-${wpUserId}`})).json()).token;
 try{
  const a=await tokenFor(42),b=await tokenFor(43),input=inputFor(s.local);
  for(const token of ["",b])for(const path of [`/documents/${s.id}/conflict-recoveries`,`/documents/${s.id}/versions`]){
   const method=path.endsWith("recoveries")?"POST":"GET";
   const denied=await api.handle(request(path+"?role=PROGRAM_ADMIN&admin=true",method,token,method==="POST"?{...input,role:"PROGRAM_ADMIN"}:undefined));
   assert.equal(denied.status,token?403:401);assert.equal(JSON.stringify(await denied.json()).includes(s.local.title),false);
  }
  const saved=await api.handle(request(`/documents/${s.id}/conflict-recoveries`,"POST",a,input));assert.equal(saved.status,201);
  const receipt=await saved.json();const history=await api.handle(request(`/documents/${s.id}/versions`,"GET",a));assert.equal(history.status,200);
  const summary=await history.json();assert.equal(summary.versions.length,3);assert.equal(summary.versions.some((v:unknown)=>Object.hasOwn(v as object,"snapshot")),false);
  const versionPath=`/documents/${s.id}/versions/${receipt.recoveryVersion.id}`;
  const own=await api.handle(request(versionPath,"GET",a));assert.equal(own.status,200);assert.equal((await own.json()).snapshot.title,s.local.title);
  for(const token of ["",b]){const denied=await api.handle(request(versionPath,"GET",token));assert.equal(denied.status,token?403:401);assert.equal(JSON.stringify(await denied.json()).includes(s.local.title),false);}

 }finally{s.adapter.close();}
});

test("recovery sanitizes forged owner/scope/provider markers while retaining source facts and presentation",async()=>{
 const s=await setup();try{
  const input=inputFor({...s.local,id:"forged-id",studentOwnerId:otherStudent.principalId,programId:"forged-program",metadata:{providerReceipt:{fake:true}},schemaVersion:"d1-uxr-002.1"},"KEEP_LOCAL");
  const receipt=await s.service.recoverConflict(student,s.id,input);
  assert.equal(receipt.chosenVersion.snapshot.id,s.id);assert.equal(receipt.chosenVersion.snapshot.studentOwnerId,student.principalId);
  assert.equal(receipt.chosenVersion.snapshot.programId,s.local.programId);assert.equal(receipt.chosenVersion.snapshot.metadata?.providerReceipt,undefined);
  assert.deepEqual(receipt.chosenVersion.snapshot.events,s.local.events);assert.deepEqual(receipt.chosenVersion.snapshot.advanced,s.local.advanced);
  assert.equal((await s.repository.getDocument(s.id))!.document.theme,"horizon");
 }finally{s.adapter.close();}
});

test("cached remote History rechecks authorization and rejects a mixed-document list before hydration",async()=>{
 const s=await setup();try{
  const result=await s.adapter.resolveConflict(s.id,"USE_SERVER");const before=await s.adapter.list("versions");
  s.client.listVersions=async()=>({versions:[{id:"wrong",documentId:"another-document",revision:1}] as never});
  await assert.rejects(s.adapter.listDocumentVersions(s.id),{code:"REMOTE_HISTORY_INVALID"});assert.deepEqual(await s.adapter.list("versions"),before);
  s.client.getVersion=async()=>{throw Object.assign(new Error("Access revoked"),{status:403,code:"FORBIDDEN"});};
  await assert.rejects(s.adapter.get("versions",result.recoveryVersionId),{code:"FORBIDDEN"});
 }finally{s.adapter.close();}
});


test("production WordPress JWT history/recovery denies a revoked directory identity even with its unexpired token",async()=>{
 const owner={...student,principalId:"90000000-0000-4000-8000-000000000042",wpUserId:42,hasLearndash3893Access:true};
 const s=await setup(owner);let active=true;
 const secret=new TextEncoder().encode("synthetic-local-recovery-jwt-proof-32-bytes"),issuer="https://timeline.local/";
 const identity=new WordPressTimelineJwtVerifier({issuer,secretsByKeyId:new Map([["local",secret]]),clock:fixedClock,
  principalDirectory:{resolve:async()=>({principalId:owner.principalId,wpUserId:42,role:"STUDENT",active,programIds:owner.programIds,assignedDocumentIds:[],resourceGrants:[]})}});
 const seconds=Math.floor(fixedClock().getTime()/1000);
 const token=await new SignJWT({wp_user_id:42,timeline_role:"STUDENT",timeline_eligible:true,is_wordpress_administrator:false,has_learndash_3893_access:true,course_id:3893})
  .setProtectedHeader({alg:"HS256",typ:"JWT",kid:"local"}).setIssuer(issuer).setAudience("mission-timeline").setSubject(owner.principalId)
  .setJti(crypto.randomUUID()).setIssuedAt(seconds).setNotBefore(seconds-1).setExpirationTime(seconds+120).sign(secret);
 const api=new TimelineHttpApi(s.service,identity,new InMemoryPrivateObjectStore("local","0123456789abcdef0123456789abcdef",fixedClock),new PrivacySafeTelemetry(new InMemoryTelemetrySink(),"local",fixedClock));
 const request=(path:string,payload?:unknown)=>new Request(`https://timeline.local/v1/documents/${s.id}/${path}`,{method:payload?"POST":"GET",headers:{authorization:`Bearer ${token}`,"content-type":"application/json"},body:payload?JSON.stringify(payload):undefined});
 try{const receipt=await s.service.recoverConflict(owner,s.id,inputFor(s.local));
  assert.equal((await api.handle(request(`versions/${receipt.recoveryVersion.id}`))).status,200);active=false;
  for(const req of [request("versions"),request(`versions/${receipt.recoveryVersion.id}`),request("conflict-recoveries",inputFor(s.local))]){
   const denied=await api.handle(req);assert.equal(denied.status,403);assert.equal((await denied.json()).error.code,"PRINCIPAL_UNAVAILABLE");
  }
 }finally{s.adapter.close();}
});
