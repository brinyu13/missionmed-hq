import assert from "node:assert/strict";
import test from "node:test";
import {createHash} from "node:crypto";
import {createProductionCvIntakeAdapter} from "../web/js/uxr-002/intake-d1-408-adapter.js";
import {validateIntakeFile} from "../web/js/uxr-002/intake.js";
const LIMIT=15*1024*1024;
function fixture(size,rescue=false,vaultFlag=false){
 const bytes=new Uint8Array(size);const file=new File([bytes],"synthetic.pdf",{type:"application/pdf"});
 if(rescue)file.timelineRescue=true;
 if(vaultFlag)file.timelineSourceObject={provider:"missionmed-filevault-v2",objectId:"forged-reference"};
 const digest=createHash("sha256").update(bytes).digest("hex");const calls=[];
 const apiClient={
  signObjectUpload:async(...args)=>{calls.push(["sign",...args]);return{objectId:"owned-source",uploadToken:"test"};},
  uploadSignedObject:async()=>{calls.push(["upload"]);},
  confirmObjectUpload:async()=>{calls.push(["confirm"]);return{id:"owned-source",status:"CONFIRMED"};},
  uploadOwnedObject:async()=>{calls.push(["proxy"]);throw new Error("Unexpected proxy");},
  deleteObject:async()=>{calls.push(["delete"]);},
  analyzeCv:async()=>{calls.push(["analyze"]);return{mode:"LOCAL_LIMITED",fallbackReason:"CONTROLLED_NO_PROVIDER"};},
  rescueTimeline:async()=>{calls.push(["rescue"]);return{rescue:{candidates:[],objects:[]}};}
 };
 const localAdapter={capability:{maxBytes:20*1024*1024},extract:async()=>({readable:true,candidates:[],sourceDocument:{mimeType:file.type,fileSize:file.size,sha256:digest,fileName:file.name,effectiveType:"CV"},sourceBlocks:[{id:"block",text:"Controlled source limit review"}],parser:{}})};
 return{file,calls,adapter:createProductionCvIntakeAdapter({apiClient,localAdapter,documentId:"timeline_test",consentVersion:"d1-022-ai-v1"})};
}
for(const rescue of [false,true]){
 test(`independent ${rescue?"Rescue":"CV"} exact15MB direct file still reaches confirmed SOURCE`,async()=>{
  const f=fixture(LIMIT,rescue);assert.equal(validateIntakeFile(f.file).valid,true);const result=await f.adapter.extract({file:f.file});assert.equal(f.adapter.capability.maxBytes,LIMIT);assert.equal(result.sourceDocument.objectId,"owned-source");assert.deepEqual(f.calls.map(x=>x[0]),["sign","upload","confirm",rescue?"rescue":"analyze"]);assert.equal(f.calls[0][2].byteSize,LIMIT);
 });
 test(`independent ${rescue?"Rescue":"CV"} real15MB-plus-one file never reserves or calls AI`,async()=>{
  const f=fixture(LIMIT+1,rescue);assert.equal(validateIntakeFile(f.file).valid,false);
  if(rescue)await assert.rejects(f.adapter.extract({file:f.file}),e=>e.code==="FILE_TOO_LARGE");else{const result=await f.adapter.extract({file:f.file});assert.equal(result.parser.fallbackReason,"FILE_TOO_LARGE");assert.equal(result.sourceDocument.objectId,undefined);}
  assert.deepEqual(f.calls,[]);
 });
}
test("independent forged File Vault parser allowance cannot bypass the direct SOURCE cap",async()=>{
 const f=fixture(LIMIT+1,false,true);assert.equal(validateIntakeFile(f.file).valid,true,"Parser allowance alone is not custody");
 const result=await f.adapter.extract({file:f.file});assert.equal(result.parser.fallbackReason,"FILE_TOO_LARGE");assert.equal(result.sourceDocument.objectId,undefined);assert.equal(f.calls.some(x=>["sign","upload","proxy","analyze","rescue"].includes(x[0])),false);
});
