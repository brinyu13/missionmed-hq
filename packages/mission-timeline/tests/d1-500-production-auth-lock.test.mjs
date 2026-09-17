import assert from "node:assert/strict";
import test from "node:test";

import {TimelineProductionAuthClient} from "../web/js/production/timeline-auth-client.js";

const principalId="9d8d7a7a-c915-4d36-a657-910ad2221001";
const otherPrincipalId="9d8d7a7a-c915-4d36-a657-910ad2221999";
const encode=(value)=>btoa(JSON.stringify(value)).replace(/=/g,"").replace(/\+/g,"-").replace(/\//g,"_");
const token=(subject=principalId,wpUserId=42,role="STUDENT")=>`${encode({alg:"HS256",typ:"JWT",kid:"timeline-v1"})}.${encode({
  iss:"https://missionmed.example/timeline/",aud:"mission-timeline",sub:subject,
  wp_user_id:wpUserId,timeline_role:role,iat:Math.floor(Date.now()/1000),
  exp:Math.floor(Date.now()/1000)+120,jti:"9d8d7a7a-c915-4d36-a657-910ad2221002"
})}.signature`;

const locationObject={origin:"https://missionmed.example",pathname:"/timeline/",search:"",hash:"",reload(){}};
const bootstrap=()=>new Response(JSON.stringify({success:true,data:{
  nonce:"nonce",token_endpoint:"https://missionmed.example/wp-json/missionmed-timeline/v1/token",
  api_base:"https://missionmed.example/timeline/api/v1",matrix_url:"https://missionmed.example/member-dashboard/",
  remote_sync_consent:true,consent_version:"d1-500-v1",
  user:{wp_user_id:42,principal_id:principalId,role:"STUDENT"}
}}),{status:200,headers:{"content-type":"application/json"}});
const tokenResponse=(value=token())=>new Response(JSON.stringify({token:value,nonce:"next"}),{status:200,headers:{"content-type":"application/json"}});

test("logout refresh locks the session and clears the configured client",async()=>{
  let tokenCalls=0;
  const locks=[];
  const client=new TimelineProductionAuthClient({locationObject,documentObject:null,onAccountSwitch:(reason)=>locks.push(reason),fetchImpl:async(url)=>{
    if(String(url).includes("admin-ajax.php"))return bootstrap();
    if(tokenCalls++===0)return tokenResponse();
    return new Response(JSON.stringify({code:"session_required",message:"Session required"}),{status:401,headers:{"content-type":"application/json"}});
  }});
  assert.equal(client.configured,false);
  await client.initialize();
  assert.equal(client.configured,true);
  await assert.rejects(client.refreshToken(),(error)=>error.code==="session_required"&&error.status===401);
  assert.equal(client.configured,false);
  assert.equal(client.token,"");
  assert.deepEqual(locks,["refresh_session_required"]);
  client.close();
});

test("a refreshed token for another account locks before the token can be reused",async()=>{
  let tokenCalls=0;
  const locks=[];
  const client=new TimelineProductionAuthClient({locationObject,documentObject:null,onAccountSwitch:(reason)=>locks.push(reason),fetchImpl:async(url)=>{
    if(String(url).includes("admin-ajax.php"))return bootstrap();
    tokenCalls+=1;
    return tokenResponse(tokenCalls===1?token():token(otherPrincipalId,99));
  }});
  await client.initialize();
  await assert.rejects(client.refreshToken(),(error)=>error.code==="TIMELINE_ACCOUNT_CHANGED");
  assert.equal(client.configured,false);
  assert.deepEqual(locks,["account_changed"]);
  client.close();
});

test("a refreshed token for another persona locks before its cache can be reused",async()=>{
  let tokenCalls=0;
  const locks=[];
  const client=new TimelineProductionAuthClient({locationObject,documentObject:null,onAccountSwitch:(reason)=>locks.push(reason),fetchImpl:async(url)=>{
    if(String(url).includes("admin-ajax.php"))return bootstrap();
    tokenCalls+=1;
    return tokenResponse(tokenCalls===1?token():token(principalId,42,"PROGRAM_ADMIN"));
  }});
  await client.initialize();
  await assert.rejects(client.refreshToken(),(error)=>error.code==="TIMELINE_ACCOUNT_CHANGED");
  assert.equal(client.configured,false);
  assert.deepEqual(locks,["account_changed"]);
  client.close();
});

test("a second API 401 after one refresh locks the session",async()=>{
  let tokenCalls=0;
  let apiCalls=0;
  const locks=[];
  const client=new TimelineProductionAuthClient({locationObject,documentObject:null,onAccountSwitch:(reason)=>locks.push(reason),fetchImpl:async(url)=>{
    if(String(url).includes("admin-ajax.php"))return bootstrap();
    if(String(url).includes("/token")){tokenCalls+=1;return tokenResponse();}
    apiCalls+=1;
    return new Response(JSON.stringify({error:{code:"SESSION_REQUIRED",message:"Session required"}}),{status:401,headers:{"content-type":"application/json"}});
  }});
  await client.initialize();
  await assert.rejects(client.listDocuments(),(error)=>error.code==="SESSION_REQUIRED"&&error.status===401);
  assert.equal(tokenCalls,2);
  assert.equal(apiCalls,2);
  assert.equal(client.configured,false);
  assert.deepEqual(locks,["api_session_invalid"]);
  client.close();
});

test("an ordinary resource 403 does not destroy a valid session",async()=>{
  const locks=[];
  const client=new TimelineProductionAuthClient({locationObject,documentObject:null,onAccountSwitch:(reason)=>locks.push(reason),fetchImpl:async(url)=>{
    if(String(url).includes("admin-ajax.php"))return bootstrap();
    if(String(url).includes("/token"))return tokenResponse();
    return new Response(JSON.stringify({error:{code:"FORBIDDEN",message:"Denied"}}),{status:403,headers:{"content-type":"application/json"}});
  }});
  await client.initialize();
  await assert.rejects(client.listDocuments(),(error)=>error.code==="FORBIDDEN"&&error.status===403);
  assert.equal(client.configured,true);
  assert.deepEqual(locks,[]);
  client.close();
});

for(const [code,status] of [
  ["canary_access_required",403],
  ["administrator_approval_required",403],
  ["eligibility_unverified",503],
  ["eligibility_required",403],
  ["timeline_disabled",403],
  ["remote_sync_consent_required",403],
  ["principal_unavailable",403],
  ["timeline_identity_unmapped",503],
  ["timeline_identity_conflict",503],
  ["timeline_identity_invalid",503],
])test(`an API ${code} response locks and clears the hydrated session`,async()=>{
  const locks=[];
  const client=new TimelineProductionAuthClient({locationObject,documentObject:null,onAccountSwitch:(reason)=>locks.push(reason),fetchImpl:async(url)=>{
    if(String(url).includes("admin-ajax.php"))return bootstrap();
    if(String(url).includes("/token"))return tokenResponse();
    return new Response(JSON.stringify({error:{code,message:"Access changed"}}),{status,headers:{"content-type":"application/json"}});
  }});
  await client.initialize();
  await assert.rejects(client.listDocuments(),(error)=>error.code===code&&error.status===status);
  assert.equal(client.configured,false);
  assert.equal(client.token,"");
  assert.deepEqual(locks,[`api_${code}`]);
  client.close();
});
