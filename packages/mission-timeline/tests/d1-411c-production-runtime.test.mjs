import assert from "node:assert/strict";
import test from "node:test";

import "fake-indexeddb/auto";
import {IDBFactory} from "fake-indexeddb";

import {
  prepareTimelineProductionRuntime,
  productionRemotePersistenceAllowed,
} from "../web/js/production/timeline-production-runtime.js";
import {TimelineStore} from "../web/js/uxr-002/store.js";

const principalId="9d8d7a7a-c915-4d36-a657-910ad2221001";
const jti="9d8d7a7a-c915-4d36-a657-910ad2221002";
const encode=(value)=>btoa(JSON.stringify(value)).replace(/=/g,"").replace(/\+/g,"-").replace(/\//g,"_");
const token=()=>`${encode({alg:"HS256",typ:"JWT",kid:"timeline-v1"})}.${encode({
  iss:"https://missionmed.example/timeline/",aud:"mission-timeline",sub:principalId,
  wp_user_id:42,timeline_role:"STUDENT",is_wordpress_administrator:false,
  has_learndash_3893_access:true,iat:Math.floor(Date.now()/1000),exp:Math.floor(Date.now()/1000)+120,jti
})}.signature`;
const administratorToken=()=>`${encode({alg:"HS256",typ:"JWT",kid:"timeline-v1"})}.${encode({
  iss:"https://missionmed.example/timeline/",aud:"mission-timeline",sub:principalId,
  wp_user_id:42,timeline_role:"PROGRAM_ADMIN",is_wordpress_administrator:true,
  has_learndash_3893_access:false,iat:Math.floor(Date.now()/1000),exp:Math.floor(Date.now()/1000)+120,jti
})}.signature`;

function locationObject(){
  return{origin:"https://missionmed.example",pathname:"/timeline/",search:"",hash:"",reload(){}};
}

test("production bootstrap fails before IndexedDB opens when WordPress identity is unavailable",async()=>{
  const prior=indexedDB.open.bind(indexedDB);let opens=0;
  indexedDB.open=(...args)=>{opens+=1;return prior(...args);};
  try{
    await assert.rejects(prepareTimelineProductionRuntime({
      locationObject:locationObject(),
      fetchImpl:async()=>new Response(JSON.stringify({success:false,data:{code:"session_required",message:"Session required"}}),{status:401,headers:{"content-type":"application/json"}})
    }),/Session required/);
    assert.equal(opens,0);
  }finally{indexedDB.open=prior;}
});

test("approved administrators keep Timeline authoring device-local and never enqueue remote media or document writes",async()=>{
  const originalIndexedDb=globalThis.indexedDB;
  let writeRequests=0;
  const fetchImpl=async(url,options={})=>{
    const href=String(url);
    if(href.includes("admin-ajax.php"))return new Response(JSON.stringify({success:true,data:{
      nonce:"nonce",token_endpoint:"https://missionmed.example/wp-json/missionmed-timeline/v1/token",
      api_base:"https://missionmed.example/timeline/api/v1",matrix_url:"https://missionmed.example/member-dashboard/",
      remote_sync_allowed:true,remote_sync_consent:false,consent_version:"d1-500-v1",
      user:{wp_user_id:42,principal_id:principalId,role:"PROGRAM_ADMIN"}
    }}),{status:200,headers:{"content-type":"application/json"}});
    if(href.includes("/token"))return new Response(JSON.stringify({token:administratorToken(),nonce:"next"}),{status:200,headers:{"content-type":"application/json"}});
    if(href.endsWith("/documents")&&(options.method||"GET")==="GET")return new Response(JSON.stringify({documents:[]}),{status:200,headers:{"content-type":"application/json"}});
    writeRequests+=1;
    throw new Error(`unexpected administrator write ${href}`);
  };
  try{
    globalThis.indexedDB=new IDBFactory();
    const runtime=await prepareTimelineProductionRuntime({fetchImpl,locationObject:locationObject()});
    assert.equal(productionRemotePersistenceAllowed(runtime.identity),false);
    assert.equal(runtime.remotePersistenceAllowed,false);
    assert.equal(runtime.privateMediaStorageEnabled,false);
    assert.equal(runtime.adapter.remoteSyncConsent,false);
    assert.deepEqual(await runtime.adapter.flush(),{synced:0,pending:0,consentRequired:true});
    assert.equal(writeRequests,0);
    runtime.adapter.close();
  }finally{globalThis.indexedDB=originalIndexedDb;}
});

test("authenticated runtime uses a principal-and-resource scoped recovery cache and server hydration",async()=>{
  const requests=[];
  let issuedToken="";
  const document={id:"timeline_server_1",schemaVersion:"d1-timeline-document-409.1",studentOwnerId:principalId,programId:"missionmed-360:3893",title:"Server timeline",theme:"keynote",revision:2,events:[],metadata:{}};
  const fetchImpl=async(url,options={})=>{
    requests.push({url:String(url),method:options.method||"GET",headers:options.headers||{},body:options.body});
    if(String(url).includes("admin-ajax.php"))return new Response(JSON.stringify({success:true,data:{
      nonce:"nonce",token_endpoint:"https://missionmed.example/wp-json/missionmed-timeline/v1/token",
      api_base:"https://missionmed.example/timeline/api/v1",matrix_url:"https://missionmed.example/member-dashboard/",
      remote_sync_consent:true,consent_version:"d1-500-v1",
      user:{wp_user_id:42,principal_id:principalId,role:"STUDENT"}
    }}),{status:200,headers:{"content-type":"application/json"}});
    if(String(url).includes("/token")){
      issuedToken=token();
      return new Response(JSON.stringify({token:issuedToken,nonce:"next"}),{status:200,headers:{"content-type":"application/json"}});
    }
    if(String(url).endsWith("/documents"))return new Response(JSON.stringify({documents:[{document,updatedAt:new Date().toISOString()}]}),{status:200,headers:{"content-type":"application/json"}});
    if(String(url).endsWith("/documents/timeline_server_1/versions"))return new Response(JSON.stringify({revision:3}),{status:201,headers:{"content-type":"application/json"}});
    throw new Error(`unexpected request ${url}`);
  };
  const runtime=await prepareTimelineProductionRuntime({fetchImpl,locationObject:locationObject()});
  assert.match(runtime.adapter.name,new RegExp(`principal:${principalId}:persona:student:v3$`));
  const hydrated=await runtime.adapter.get("documents","timeline_server_1");
  assert.equal(hydrated.document.revision,2);
  assert.equal(runtime.authClient.configured,true);
  assert.equal((await runtime.adapter.pending()).length,0);
  const edited={...hydrated,sequence:3,document:{...hydrated.document,title:"Authoritative edit"}};
  await runtime.adapter.atomicPut([{store:"documents",key:"timeline_server_1",value:edited}]);
  const flushed=await runtime.adapter.flush();
  assert.deepEqual(flushed,{synced:1,pending:0});
  const versionRequest=requests.find(({url})=>url.endsWith("/documents/timeline_server_1/versions"));
  assert.equal(versionRequest.method,"POST");
  assert.equal(versionRequest.headers.authorization,`Bearer ${issuedToken}`);
  assert.equal(JSON.parse(versionRequest.body).baseRevision,2);
  assert.equal((await runtime.adapter.get("settings","remote-revision:timeline_server_1")).revision,3);
  assert.deepEqual(requests.map(({method})=>method),["GET","POST","GET","POST"]);
  runtime.adapter.close();
});

test("authoritative saves hydrate a clean second device and stale writes cannot replace the winner",async()=>{
  const originalIndexedDb=globalThis.indexedDB;
  let serverDocument={id:"timeline_cross_device",schemaVersion:"d1-timeline-document-409.1",studentOwnerId:principalId,programId:"missionmed-360:3893",title:"Initial",theme:"keynote",revision:0,events:[],metadata:{}};
  const fetchImpl=async(url,options={})=>{
    const href=String(url);
    if(href.includes("admin-ajax.php"))return new Response(JSON.stringify({success:true,data:{
      nonce:"nonce",token_endpoint:"https://missionmed.example/wp-json/missionmed-timeline/v1/token",
      api_base:"https://missionmed.example/timeline/api/v1",matrix_url:"https://missionmed.example/member-dashboard/",
      remote_sync_consent:true,consent_version:"d1-500-v1",
      user:{wp_user_id:42,principal_id:principalId,role:"STUDENT"}
    }}),{status:200,headers:{"content-type":"application/json"}});
    if(href.includes("/token"))return new Response(JSON.stringify({token:token(),nonce:"next"}),{status:200,headers:{"content-type":"application/json"}});
    if(href.endsWith("/documents")&&(options.method||"GET")==="GET")return new Response(JSON.stringify({documents:[{document:serverDocument,updatedAt:new Date().toISOString()}]}),{status:200,headers:{"content-type":"application/json"}});
    if(href.endsWith("/documents/timeline_cross_device/versions")){
      const body=JSON.parse(options.body);
      if(body.baseRevision!==serverDocument.revision)return new Response(JSON.stringify({error:{code:"REVISION_CONFLICT",message:"A newer document revision exists."}}),{status:409,headers:{"content-type":"application/json"}});
      serverDocument={...structuredClone(body.snapshot),revision:body.baseRevision+1};
      return new Response(JSON.stringify({revision:serverDocument.revision}),{status:201,headers:{"content-type":"application/json"}});
    }
    throw new Error(`unexpected request ${href}`);
  };
  try{
    globalThis.indexedDB=new IDBFactory();
    const deviceA=await prepareTimelineProductionRuntime({fetchImpl,locationObject:locationObject()});
    const local=await deviceA.adapter.get("documents",serverDocument.id);
    await deviceA.adapter.atomicPut([{store:"documents",key:serverDocument.id,value:{...local,sequence:1,document:{...local.document,title:"Saved on device A"}}}]);
    assert.deepEqual(await deviceA.adapter.flush(),{synced:1,pending:0});
    assert.equal(serverDocument.revision,1);
    deviceA.adapter.close();

    globalThis.indexedDB=new IDBFactory();
    const deviceB=await prepareTimelineProductionRuntime({fetchImpl,locationObject:locationObject()});
    const hydrated=await deviceB.adapter.get("documents",serverDocument.id);
    assert.equal(hydrated.document.title,"Saved on device A");
    assert.equal(hydrated.document.revision,1);
    await assert.rejects(
      deviceA.authClient.createVersion(serverDocument.id,0,{...serverDocument,revision:0,title:"Stale device"},"Stale device"),
      (error)=>error.code==="REVISION_CONFLICT"&&error.status===409
    );
    assert.equal(serverDocument.title,"Saved on device A");
    assert.equal(serverDocument.revision,1);
    deviceB.adapter.close();
  }finally{
    globalThis.indexedDB=originalIndexedDb;
  }
});

test("first production documents use unique IDs in a stable principal-scoped cache",async()=>{
  const originalIndexedDb=globalThis.indexedDB;
  const fetchImpl=async(url)=>{
    const href=String(url);
    if(href.includes("admin-ajax.php"))return new Response(JSON.stringify({success:true,data:{
      nonce:"nonce",token_endpoint:"https://missionmed.example/wp-json/missionmed-timeline/v1/token",
      api_base:"https://missionmed.example/timeline/api/v1",matrix_url:"https://missionmed.example/member-dashboard/",
      remote_sync_consent:true,consent_version:"d1-500-v1",
      user:{wp_user_id:42,principal_id:principalId,role:"STUDENT"}
    }}),{status:200,headers:{"content-type":"application/json"}});
    if(href.includes("/token"))return new Response(JSON.stringify({token:token(),nonce:"next"}),{status:200,headers:{"content-type":"application/json"}});
    if(href.endsWith("/documents"))return new Response(JSON.stringify({documents:[]}),{status:200,headers:{"content-type":"application/json"}});
    throw new Error(`unexpected request ${href}`);
  };
  try{
    globalThis.indexedDB=new IDBFactory();
    const first=await prepareTimelineProductionRuntime({fetchImpl,locationObject:locationObject()});
    const firstId=new TimelineStore({adapter:first.adapter}).document.id;
    first.adapter.close();
    globalThis.indexedDB=new IDBFactory();
    const second=await prepareTimelineProductionRuntime({fetchImpl,locationObject:locationObject()});
    const secondId=new TimelineStore({adapter:second.adapter}).document.id;
    assert.match(firstId,/^timeline_[a-f0-9-]{36}$/);
    assert.match(secondId,/^timeline_[a-f0-9-]{36}$/);
    assert.notEqual(firstId,secondId);
    assert.equal(first.adapter.name,second.adapter.name);
    assert.match(first.adapter.name,new RegExp(`principal:${principalId}:persona:student:v3$`));
    second.adapter.close();
  }finally{globalThis.indexedDB=originalIndexedDb;}
});
