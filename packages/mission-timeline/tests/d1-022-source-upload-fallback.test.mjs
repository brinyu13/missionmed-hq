import assert from "node:assert/strict";
import test from "node:test";
import {createHash} from "node:crypto";
import {createProductionCvIntakeAdapter} from "../web/js/uxr-002/intake-d1-408-adapter.js";

function setup({rescue=false,uploadCode="OBJECT_UPLOAD_NETWORK_FAILED",uploadStatus=0,ownedStatus="CONFIRMED",ownedCode="",deleteCode="",proxy=true}={}){
  const file=new File(["Controlled synthetic source bytes"],rescue?"controlled-timeline.pdf":"controlled-cv.pdf",{type:"application/pdf"});
  if(rescue)file.timelineRescue=true;
  const sha256=createHash("sha256").update("Controlled synthetic source bytes").digest("hex");
  const calls=[];
  const localAdapter={capability:{},async extract(){return{
    readable:true,candidates:[],sourceDocument:{id:"local-source",mimeType:file.type,fileSize:file.size,fileName:file.name,sha256,effectiveType:"CV"},
    sourceBlocks:[{id:"block-1",text:"Controlled synthetic source bytes"}],parser:{version:"test"}
  };}};
  const apiClient={
    async signObjectUpload(documentId,input){calls.push(["sign",documentId,input]);return{objectId:"pending-source",uploadToken:"private-test-token"};},
    async uploadSignedObject(){calls.push(["signed-put"]);if(uploadCode)throw Object.assign(new Error("Controlled transport result"),{code:uploadCode,status:uploadStatus});},
    async confirmObjectUpload(id){calls.push(["confirm",id]);return{status:"CONFIRMED"};},
    async deleteObject(id){calls.push(["delete",id]);if(deleteCode)throw Object.assign(new Error("Controlled cleanup failure"),{code:deleteCode});},
    async analyzeCv(documentId,input){calls.push(["analyze",documentId,input]);return{mode:"LOCAL_LIMITED",fallbackReason:"PROVIDER_UNAVAILABLE"};},
    async rescueTimeline(documentId,input){calls.push(["rescue",documentId,input]);return{rescue:{candidates:[],objects:[]}};}
  };
  if(proxy)apiClient.uploadOwnedObject=async(documentId,blob,input)=>{
    calls.push(["owned",documentId,input,await blob.text()]);
    if(ownedCode)throw Object.assign(new Error("Controlled proxy failure"),{code:ownedCode});
    return{id:"confirmed-proxy-source",status:ownedStatus};
  };
  return{adapter:createProductionCvIntakeAdapter({localAdapter,apiClient,documentId:"timeline_owned",consentVersion:"d1-022-ai-v1"}),file,sha256,calls};
}

for(const rescue of [false,true])test(`${rescue?"Rescue":"CV"} retries only browser transport through owner-scoped SOURCE upload`,async()=>{
  const x=setup({rescue});const result=await x.adapter.extract({file:x.file});
  assert.equal(result.sourceDocument.objectId,"confirmed-proxy-source");
  assert.equal(result.sourceDocument.custody,"TIMELINE_PRIVATE_SOURCE");
  assert.deepEqual(x.calls.map(x=>x[0]),["sign","signed-put","delete","owned",rescue?"rescue":"analyze"]);
  assert.deepEqual(x.calls.find(x=>x[0]==="owned").slice(1),["timeline_owned",{sha256:x.sha256,objectClass:"SOURCE"},"Controlled synthetic source bytes"]);
  const analysis=x.calls.at(-1)[2];assert.equal(analysis.source.objectId,"confirmed-proxy-source");assert.equal(analysis.source.sha256,x.sha256);
  await x.adapter.deleteSource();assert.deepEqual(x.calls.at(-1),["delete","confirmed-proxy-source"]);
});
for(const [code,status] of [["OBJECT_UPLOAD_FAILED",403],["OBJECT_UPLOAD_FAILED",401],["OBJECT_UPLOAD_EXPIRED",401],["PRIVATE_OBJECT_URL_INVALID",0],["UNKNOWN_NETWORK_ERROR",0]]){
  for(const rescue of [false,true])test(`${rescue?"Rescue":"CV"} does not bypass ${code}/${status}`,async()=>{
    const x=setup({rescue,uploadCode:code,uploadStatus:status});
    if(rescue)await assert.rejects(x.adapter.extract({file:x.file}),e=>e.code===code);
    else{const result=await x.adapter.extract({file:x.file});assert.equal(result.parser.fallbackReason,code);assert.equal(result.sourceDocument.objectId,undefined);}
    assert.equal(x.calls.some(x=>x[0]==="owned"||x[0]==="analyze"||x[0]==="rescue"),false);
    assert.deepEqual(x.calls.at(-1),["delete","pending-source"]);
  });
}
test("a failed reservation retirement prevents a second upload",async()=>{
  const x=setup({deleteCode:"SESSION_REQUIRED"});const result=await x.adapter.extract({file:x.file});
  assert.equal(result.parser.fallbackReason,"SESSION_REQUIRED");assert.equal(x.calls.some(x=>x[0]==="owned"),false);
});
test("unconfirmed proxy object is retired and never reaches CV AI",async()=>{
  const x=setup({ownedStatus:"PENDING"});const result=await x.adapter.extract({file:x.file});
  assert.equal(result.sourceDocument.objectId,undefined);assert.deepEqual(x.calls.at(-1),["delete","confirmed-proxy-source"]);
  assert.equal(x.calls.some(x=>x[0]==="analyze"),false);
});
test("proxy failure never claims durable source custody or AI review",async()=>{
  const x=setup({ownedCode:"OBJECT_OWNED_BYTES_INVALID"});const result=await x.adapter.extract({file:x.file});
  assert.equal(result.parser.fallbackReason,"OBJECT_OWNED_BYTES_INVALID");assert.equal(result.parser.intelligenceMode,"LOCAL_LIMITED");assert.equal(result.sourceDocument.objectId,undefined);
});
test("old API clients degrade without inventing an available proxy",async()=>{
  const x=setup({proxy:false});const result=await x.adapter.extract({file:x.file});
  assert.equal(result.parser.fallbackReason,"OBJECT_UPLOAD_NETWORK_FAILED");assert.deepEqual(x.calls.at(-1),["delete","pending-source"]);
});

// Boundary behavior is checked through the real intake validator and production
// adapter, not by comparing implementation text or changing the File Vault contract.
import {validateIntakeFile,MAX_DOCUMENT_BYTES} from "../web/js/uxr-002/intake.js";
import {MAX_DIRECT_SOURCE_BYTES,MAX_FILE_BYTES} from "../web/js/ingestion/file-inspector.js";
for(const rescue of [false,true])test(`${rescue?"Rescue":"CV"} direct upload cap is exactly 15 MB`,()=>{
  assert.equal(MAX_DOCUMENT_BYTES,15*1024*1024);assert.equal(MAX_DIRECT_SOURCE_BYTES,MAX_DOCUMENT_BYTES);
  const file={name:"controlled.pdf",type:"application/pdf",size:MAX_DIRECT_SOURCE_BYTES,timelineRescue:rescue};
  assert.equal(validateIntakeFile(file).valid,true);
  assert.equal(validateIntakeFile({...file,size:MAX_DIRECT_SOURCE_BYTES+1}).valid,false);
  assert.match(validateIntakeFile({...file,size:MAX_DIRECT_SOURCE_BYTES+1}).error,/15MB/);
});
test("File Vault retains its separate 20 MB parser allowance",()=>{
  assert.equal(MAX_FILE_BYTES,20*1024*1024);
  const file={name:"owned-vault-version.pdf",type:"application/pdf",size:MAX_FILE_BYTES,
    timelineSourceObject:{provider:"missionmed-filevault-v2",objectId:"owned-vault-source"}};
  assert.equal(validateIntakeFile(file).valid,true);
  assert.equal(validateIntakeFile({...file,size:MAX_FILE_BYTES+1}).valid,false);
});
for(const rescue of [false,true])test(`${rescue?"Rescue":"CV"} oversized direct source creates no storage reservation`,async()=>{
  const x=setup({rescue});Object.defineProperty(x.file,"size",{value:MAX_DIRECT_SOURCE_BYTES+1});
  if(rescue)await assert.rejects(x.adapter.extract({file:x.file}),e=>e.code==="FILE_TOO_LARGE");
  else{const result=await x.adapter.extract({file:x.file});assert.equal(result.parser.fallbackReason,"FILE_TOO_LARGE");}
  assert.equal(x.calls.length,0);
});
