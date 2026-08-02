import assert from "node:assert/strict";
import test from "node:test";

import "fake-indexeddb/auto";

import {prepareTimelineProductionRuntime} from "../web/js/production/timeline-production-runtime.js";

const principalId="9d8d7a7a-c915-4d36-a657-910ad2221001";
const jti="9d8d7a7a-c915-4d36-a657-910ad2221002";
const encode=(value)=>btoa(JSON.stringify(value)).replace(/=/g,"").replace(/\+/g,"-").replace(/\//g,"_");
const token=()=>`${encode({alg:"HS256",typ:"JWT",kid:"timeline-v1"})}.${encode({
  iss:"https://missionmed.example/timeline/",aud:"mission-timeline",sub:principalId,
  wp_user_id:42,timeline_role:"STUDENT",is_wordpress_administrator:false,
  has_learndash_3893_access:true,iat:Math.floor(Date.now()/1000),exp:Math.floor(Date.now()/1000)+120,jti
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

test("authenticated runtime uses a principal-and-resource scoped recovery cache and server hydration",async()=>{
  const requests=[];
  const document={id:"timeline_server_1",schemaVersion:"d1-timeline-document-409.1",studentOwnerId:principalId,programId:"missionmed-360:3893",title:"Server timeline",theme:"keynote",revision:2,events:[],metadata:{}};
  const fetchImpl=async(url,options={})=>{
    requests.push({url:String(url),method:options.method||"GET"});
    if(String(url).includes("admin-ajax.php"))return new Response(JSON.stringify({success:true,data:{
      nonce:"nonce",token_endpoint:"https://missionmed.example/wp-json/missionmed-timeline/v1/token",
      api_base:"https://missionmed.example/timeline/api/v1",matrix_url:"https://missionmed.example/member-dashboard/",
      user:{wp_user_id:42,principal_id:principalId,role:"STUDENT"}
    }}),{status:200,headers:{"content-type":"application/json"}});
    if(String(url).includes("/token"))return new Response(JSON.stringify({token:token(),nonce:"next"}),{status:200,headers:{"content-type":"application/json"}});
    if(String(url).endsWith("/documents"))return new Response(JSON.stringify({documents:[{document,updatedAt:new Date().toISOString()}]}),{status:200,headers:{"content-type":"application/json"}});
    throw new Error(`unexpected request ${url}`);
  };
  const runtime=await prepareTimelineProductionRuntime({fetchImpl,locationObject:locationObject()});
  assert.match(runtime.adapter.name,new RegExp(`principal:${principalId}:resource:timeline_server_1`));
  const hydrated=await runtime.adapter.get("documents","timeline_server_1");
  assert.equal(hydrated.document.revision,2);
  assert.equal((await runtime.adapter.pending()).length,0);
  assert.deepEqual(requests.map(({method})=>method),["GET","POST","GET"]);
  runtime.adapter.close();
});
