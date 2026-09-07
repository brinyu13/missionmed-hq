import assert from "node:assert/strict";
import test from "node:test";
import { TimelineHttpApi } from "../src/api/http-api.js";
import { TimelineService } from "../src/domain/timeline-service.js";
import { TimelineError } from "../src/core/errors.js";
import { sha256 } from "../src/core/canonical.js";
import { InMemoryTimelineRepository } from "../src/persistence/repository.js";
import { InMemoryPrivateObjectStore } from "../src/storage/private-object-store.js";
import { InMemoryTelemetrySink, PrivacySafeTelemetry } from "../src/telemetry/telemetry.js";
import { document, fixedClock, student, otherStudent, programAdmin } from "./fixtures.js";

const bytes = new TextEncoder().encode("%PDF-1.7\nCONTROLLED SOURCE REVIEW ONLY\n%%EOF");
const types = ["application/pdf", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "application/vnd.openxmlformats-officedocument.presentationml.presentation", "image/png", "image/jpeg"];
async function fixture() {
 const repository = new InMemoryTimelineRepository();
 const service = new TimelineService(repository, fixedClock);
 await service.createDocument(student, {id:"timeline_test", programId:student.programIds[0]!, title:"Synthetic source review", document:document()});
 const store = new InMemoryPrivateObjectStore("test", "independent-local-test-secret-022-0000000000", fixedClock);
 let writes=0; const original=store.putOwnedObject.bind(store);
 store.putOwnedObject=async(...args)=>{writes++; return original(...args);};
 const contexts = {owner:student, other:otherStudent, admin:programAdmin, owner_admin:{...student,role:"PROGRAM_ADMIN" as const,facultyGrants:programAdmin.facultyGrants}};
 const api = new TimelineHttpApi(service,{verify:async(token)=>{const value=contexts[token as keyof typeof contexts]; if(!value)throw new TimelineError("SESSION_TOKEN_INVALID","Invalid session",401); return value;}},store,new PrivacySafeTelemetry(new InMemoryTelemetrySink(),"test",fixedClock));
 const upload=(overrides:Record<string,string>={}, data:Uint8Array=bytes, query="")=>api.handle(new Request("https://timeline.local/v1/objects/upload"+query,{method:"POST", headers:{authorization:"Bearer owner","content-type":"application/pdf","content-length":String(data.byteLength),"x-content-sha256":sha256(data),"x-timeline-document-id":"timeline_test","x-timeline-object-class":"SOURCE",...overrides},body:new Uint8Array(data)}));
 return {api,store,upload,writes:()=>writes};
}
for(const type of types)test(`independent SOURCE route accepts only confirmed owner custody: ${type}`, async()=>{
 const f=await fixture(); const response=await f.upload({"content-type":type}); assert.equal(response.status,201); const result=await response.json();
 assert.deepEqual(Object.keys(result).sort(),["byteSize","confirmedAt","id","mimeType","objectClass","status"]);
 assert.equal(result.status,"CONFIRMED"); assert.equal(result.mimeType,type); assert.equal(result.objectClass,"SOURCE");
 const stored=await f.store.getAuthorizedObjectBytes(student,result.id); assert.equal(stored.record.ownerPrincipalId,student.principalId); assert.equal(stored.record.documentId,"timeline_test"); assert.equal(stored.record.expectedSha256,sha256(bytes)); assert.deepEqual(stored.bytes,bytes);
 assert.doesNotMatch(JSON.stringify(result),/storageKey|uploadToken|https:|downloadUrl/);
});
for(const [name,headers,status,code] of [
 ["anonymous",{authorization:""},401,"SESSION_REQUIRED"],
 ["invalid session",{authorization:"Bearer invalid"},401,"SESSION_TOKEN_INVALID"],
 ["other owner",{authorization:"Bearer other"},403,"FORBIDDEN"],
 ["authorized administrator",{authorization:"Bearer admin"},403,"OBJECT_UPLOAD_OWNER_REQUIRED"],
 ["admin role on matching principal",{authorization:"Bearer owner_admin"},403,"OBJECT_UPLOAD_OWNER_REQUIRED"],
 ["missing document",{"x-timeline-document-id":"timeline_missing"},404,"DOCUMENT_NOT_FOUND"],
 ["URL in document field",{"x-timeline-document-id":"https://arbitrary.invalid/file"},404,"DOCUMENT_NOT_FOUND"],
 ["EXPORT class",{"x-timeline-object-class":"EXPORT"},415,"OBJECT_UPLOAD_CLASS_DENIED"],
 ["TEMP class",{"x-timeline-object-class":"TEMP"},415,"OBJECT_UPLOAD_CLASS_DENIED"],
 ["SOURCE HTML",{"content-type":"text/html"},415,"OBJECT_UPLOAD_TYPE_DENIED"],
 ["SOURCE ZIP",{"content-type":"application/zip"},415,"OBJECT_UPLOAD_TYPE_DENIED"],
 ["SOURCE WEBP",{"content-type":"image/webp"},415,"OBJECT_UPLOAD_TYPE_DENIED"],
 ["SOURCE GIF",{"content-type":"image/gif"},415,"OBJECT_UPLOAD_TYPE_DENIED"],
 ["MEDIA PDF",{"x-timeline-object-class":"MEDIA"},415,"OBJECT_UPLOAD_TYPE_DENIED"],
 ["zero size",{"content-length":"0"},413,"OBJECT_UPLOAD_SIZE_DENIED"],
 ["fractional size",{"content-length":"1.5"},413,"OBJECT_UPLOAD_SIZE_DENIED"],
 ["negative size",{"content-length":"-1"},413,"OBJECT_UPLOAD_SIZE_DENIED"],
 ["SOURCE over 25 MB",{"content-length":String(25*1024*1024+1)},413,"OBJECT_UPLOAD_SIZE_DENIED"],
 ["MEDIA over 15 MB",{"content-type":"image/png","x-timeline-object-class":"MEDIA","content-length":String(15*1024*1024+1)},413,"OBJECT_UPLOAD_SIZE_DENIED"],
 ["actual size differs",{"content-length":String(bytes.length+1)},409,"OBJECT_UPLOAD_SIZE_MISMATCH"],
] as const)test(`independent SOURCE route denies ${name} before reservation`,async()=>{
 const f=await fixture(); const r=await f.upload(headers as Record<string,string>); assert.equal(r.status,status); assert.equal((await r.json()).error.code,code); assert.equal(f.writes(),0);
});
test("independent SOURCE checksum mismatch cannot create an object",async()=>{
 const f=await fixture(); let reservations=0; const original=f.store.signUpload.bind(f.store); f.store.signUpload=async(...args)=>{reservations++;return original(...args);};
 for(const hash of ["f".repeat(64),"", "not-a-hash"]){const r=await f.upload({"x-content-sha256":hash}); assert.equal(r.status,400); assert.equal((await r.json()).error.code,"OBJECT_OWNED_BYTES_INVALID");}
 assert.equal(reservations,0);
});
test("independent SOURCE endpoint ignores role, owner, URL and subject client flags",async()=>{
 const f=await fixture(); const r=await f.upload({"x-timeline-role":"PROGRAM_ADMIN","x-timeline-subject-wp-user-id":"1317","x-owner-principal-id":otherStudent.principalId,"x-upload-url":"https://arbitrary.invalid/file"},bytes,"?role=PROGRAM_ADMIN&ownerPrincipalId=principal_other_student&url=https://arbitrary.invalid/");
 assert.equal(r.status,201); const result=await r.json(); const record=await f.store.getAuthorizedObject(student,result.id); assert.equal(record?.ownerPrincipalId,student.principalId);
 const denied=await f.upload({authorization:"Bearer other","x-timeline-role":"PROGRAM_ADMIN","x-timeline-subject-wp-user-id":"1317"}); assert.equal(denied.status,403); assert.equal(f.writes(),1);
});
test("independent SOURCE direct ID download and delete remain owner scoped",async()=>{
 const f=await fixture(); const created=await (await f.upload()).json();
 for(const who of ["other","admin"]){
  const download=await f.api.handle(new Request(`https://timeline.local/v1/objects/${created.id}/download`,{method:"POST",headers:{authorization:`Bearer ${who}`}})); assert.equal(download.status,403);
  const remove=await f.api.handle(new Request(`https://timeline.local/v1/objects/${created.id}`,{method:"DELETE",headers:{authorization:`Bearer ${who}`}})); assert.equal(remove.status,404);
 }
 assert.equal((await f.store.getAuthorizedObjectBytes(student,created.id)).record.status,"CONFIRMED");
});
test("independent SOURCE max-size boundary is inclusive and hash bound",async()=>{
 const f=await fixture(); const data=new Uint8Array(25*1024*1024); const r=await f.upload({},data); assert.equal(r.status,201); const value=await r.json(); assert.equal(value.byteSize,data.byteLength); assert.equal((await f.store.getAuthorizedObject(student,value.id))?.expectedSha256,sha256(data));
});

async function productionFixture(mismatch="", failPut=false, maxUploadBytes=50*1024*1024) {
 const {R2PrivateObjectStore}=await import("../src/storage/production/r2-private-object-store.js");
 const {PutObjectCommand,HeadObjectCommand,DeleteObjectCommand}=await import("@aws-sdk/client-s3");
 const records=new Map<string,any>(); const objects=new Map<string,any>(); const commands:string[]=[];
 const repository={
  async insertPending(_context:any,record:any){records.set(record.id,structuredClone(record));return structuredClone(record);},
  async getAuthorized(_context:any,id:string){return structuredClone(records.get(id)??null);},
  async transition(_context:any,id:string,from:string,to:string,at:string){const value=records.get(id); if(!value||value.status!==from)return null; value.status=to; if(to==="CONFIRMED")value.confirmedAt=at;return structuredClone(value);}
 };
 const client={async send(command:any){
  commands.push(command.constructor.name); const input=command.input;
  if(command instanceof PutObjectCommand){if(failPut)throw new Error("CONTROLLED_PUT_FAILURE");objects.set(input.Key,{ContentType:input.ContentType,ContentLength:input.ContentLength,ChecksumSHA256:input.ChecksumSHA256,Metadata:input.Metadata});return{};}
  if(command instanceof HeadObjectCommand){const head=structuredClone(objects.get(input.Key)); if(mismatch==="size")head.ContentLength++; if(mismatch==="mime")head.ContentType="text/html";if(mismatch==="hash")head.ChecksumSHA256=Buffer.alloc(32).toString("base64");if(mismatch==="metadata")head.Metadata["object-class"]="MEDIA";return head;}
  if(command instanceof DeleteObjectCommand){objects.delete(input.Key);return{};}
  throw new Error("UNEXPECTED_COMMAND");
 }};
 const store=new R2PrivateObjectStore({client:client as any,repository,bucket:"controlled-local-source",environment:"test",maxUploadBytes,tokenSecret:"independent-r2-local-secret-022-000000000000",clock:fixedClock,presign:async()=>"https://private-signed.invalid/controlled"});
 const input={documentId:"timeline_test",objectClass:"SOURCE" as const,mimeType:"application/pdf",byteSize:bytes.length,sha256:sha256(bytes)};
 return{store,input,records,objects,commands};
}
test("independent production R2 SOURCE confirms exact checksum metadata and rejects a readable administrator",async()=>{
 const f=await productionFixture();const result=await f.store.putOwnedObject(student,f.input,bytes);assert.equal(result.status,"CONFIRMED");assert.deepEqual(f.commands,["PutObjectCommand","HeadObjectCommand"]);
 const payload=[...f.objects.values()][0]; assert.equal(payload.Metadata["object-class"],"SOURCE");assert.equal(payload.Metadata["expected-sha256"],sha256(bytes));assert.equal(payload.ChecksumSHA256,Buffer.from(sha256(bytes),"hex").toString("base64"));
 // The repository intentionally grants reads to everyone. SOURCE ownership must still win.
 for(const actor of [otherStudent,programAdmin]){
  await assert.rejects(f.store.signDownload(actor,result.id),(e:any)=>e.code==="OBJECT_ACCESS_DENIED");
  await assert.rejects(f.store.getAuthorizedObjectBytes(actor,result.id),(e:any)=>e.code==="OBJECT_ACCESS_DENIED");
  await assert.rejects(f.store.deleteObject(actor,result.id),(e:any)=>e.code==="OBJECT_ACCESS_DENIED");
 }
 assert.equal(f.objects.size,1); await f.store.deleteObject(student,result.id); assert.equal(f.objects.size,0);assert.equal(f.records.get(result.id).status,"DELETED");
});
test("independent production R2 SOURCE refuses owner and byte forgery before any reservation",async()=>{
 const f=await productionFixture();
 for(const actor of [programAdmin,{...student,role:"SERVICE" as const}])await assert.rejects(f.store.putOwnedObject(actor,f.input,bytes),(e:any)=>e.code==="OBJECT_OWNER_ROLE_REQUIRED");
 await assert.rejects(f.store.putOwnedObject(student,{...f.input,ownerPrincipalId:otherStudent.principalId},bytes),(e:any)=>e.code==="OBJECT_OWNER_MISMATCH");
 await assert.rejects(f.store.putOwnedObject(student,{...f.input,sha256:"f".repeat(64)},bytes),(e:any)=>e.code==="OBJECT_OWNED_BYTES_INVALID");
 assert.equal(f.records.size,0);assert.equal(f.commands.length,0);
});
for(const [mismatch,code] of [["size","OBJECT_SIZE_MISMATCH"],["mime","OBJECT_MIME_MISMATCH"],["hash","OBJECT_HASH_MISMATCH"],["metadata","OBJECT_HASH_MISMATCH"]])test(`independent production R2 SOURCE quarantines ${mismatch} instead of confirming custody`,async()=>{
 const f=await productionFixture(mismatch); await assert.rejects(f.store.putOwnedObject(student,f.input,bytes),(e:any)=>e.code===code);
 const record=[...f.records.values()][0];assert.equal(record.status,"QUARANTINED");
 await assert.rejects(f.store.signDownload(student,record.id),(e:any)=>e.code==="OBJECT_NOT_FOUND");
 await f.store.deleteObject(student,record.id);assert.equal(f.objects.size,0);assert.equal(f.records.get(record.id).status,"DELETED");
});
test("independent production R2 failed PUT never confirms or exposes pending SOURCE",async()=>{
 const f=await productionFixture("",true); await assert.rejects(f.store.putOwnedObject(student,f.input,bytes),(e:any)=>e.code==="PRIVATE_OBJECT_STORAGE_UNAVAILABLE");
 const record=[...f.records.values()][0];assert.equal(record.status,"PENDING");assert.equal(f.objects.size,0);assert.equal(f.commands.includes("HeadObjectCommand"),false);
 await assert.rejects(f.store.signDownload(student,record.id),(e:any)=>e.code==="OBJECT_NOT_FOUND");
});

test("independent production R2 retains the lower configured 15 MB ceiling for SOURCE",async()=>{
 const f=await productionFixture("",false,15*1024*1024);const data=new Uint8Array(15*1024*1024+1);
 await assert.rejects(f.store.putOwnedObject(student,{...f.input,byteSize:data.length,sha256:sha256(data)},data),(e:any)=>e.code==="OBJECT_SIZE_DENIED");
 assert.equal(f.records.size,0);assert.equal(f.commands.length,0);
});
