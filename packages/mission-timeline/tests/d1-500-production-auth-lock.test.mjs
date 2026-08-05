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

test("concurrent near-expiry callers share one refresh and publish the renewed claims",async()=>{
  let tokenCalls=0;
  let apiCalls=0;
  const renewed=[];
  const client=new TimelineProductionAuthClient({locationObject,documentObject:null,fetchImpl:async(url)=>{
    if(String(url).includes("admin-ajax.php"))return bootstrap();
    if(String(url).includes("/token")){
      tokenCalls+=1;
      await new Promise((resolve)=>setTimeout(resolve,5));
      return tokenResponse();
    }
    apiCalls+=1;
    return new Response(JSON.stringify({documents:[]}),{status:200,headers:{"content-type":"application/json"}});
  }});
  await client.initialize();
  const unsubscribe=client.subscribeClaims((claims)=>renewed.push(claims));
  client.claims={...client.claims,exp:Math.floor(Date.now()/1000)+1};
  await Promise.all(Array.from({length:25},()=>client.listDocuments()));
  assert.equal(tokenCalls,2,"initialize plus exactly one shared renewal");
  assert.equal(apiCalls,25);
  assert.equal(renewed.length,1);
  assert.ok(Number(renewed[0].exp)*1000>Date.now());
  unsubscribe();
  client.close();
});

test("private media uses authenticated API grants and direct private R2 transfers without bearer leakage",async()=>{
  const calls=[];
  const objectId="object_11111111-1111-4111-8111-111111111111";
  const expiresAt=new Date(Date.now()+60_000).toISOString();
  const r2Origin="https://0123456789abcdef.r2.cloudflarestorage.com";
  const client=new TimelineProductionAuthClient({locationObject,documentObject:null,fetchImpl:async(url,options={})=>{
    calls.push({url:String(url),options});
    if(String(url).includes("admin-ajax.php"))return bootstrap();
    if(String(url).includes("/token"))return tokenResponse();
    if(String(url).endsWith("/objects/sign"))return new Response(JSON.stringify({
      objectId,uploadUrl:`${r2Origin}/private-upload`,uploadToken:"one-time-token",expiresAt,
      requiredHeaders:{"content-type":"image/png","content-length":"3"}
    }),{status:201,headers:{"content-type":"application/json"}});
    if(String(url).includes("/confirm"))return new Response(JSON.stringify({id:objectId,status:"CONFIRMED"}),{status:200,headers:{"content-type":"application/json"}});
    if(String(url).includes("/download"))return new Response(JSON.stringify({downloadUrl:`${r2Origin}/private-download`,expiresAt}),{status:200,headers:{"content-type":"application/json"}});
    if(String(url)===`${r2Origin}/private-upload`)return new Response(null,{status:200});
    if(String(url)===`${r2Origin}/private-download`)return new Response(new Uint8Array([1,2,3]),{status:200,headers:{"content-type":"image/png"}});
    return new Response(null,{status:204});
  }});
  await client.initialize();
  const grant=await client.signObjectUpload("timeline_test",{mimeType:"image/png",byteSize:3,sha256:"a".repeat(64)});
  await client.uploadSignedObject(grant,new Blob([new Uint8Array([1,2,3])],{type:"image/png"}));
  await client.confirmObjectUpload(grant.objectId,grant.uploadToken);
  const downloaded=await client.downloadPrivateObject(grant.objectId);
  assert.equal(downloaded.size,3);
  await client.deleteObject(grant.objectId);
  const directCalls=calls.filter(({url})=>url.startsWith(r2Origin));
  assert.equal(directCalls.length,2);
  assert.equal(directCalls.every(({options})=>options.credentials==="omit"),true);
  assert.equal(directCalls.every(({options})=>!new Headers(options.headers).has("authorization")),true);
  assert.equal(new Headers(directCalls[0].options.headers).has("content-length"),false);
  client.close();
});

test("private media rejects a signed transfer URL outside the private R2 endpoint",async()=>{
  const client=new TimelineProductionAuthClient({locationObject,documentObject:null,fetchImpl:async()=>new Response(null,{status:200})});
  await assert.rejects(
    client.uploadSignedObject({uploadUrl:"https://public.example/upload",expiresAt:new Date(Date.now()+60_000).toISOString()},new Blob(["x"])),
    (error)=>error.code==="PRIVATE_OBJECT_URL_INVALID"
  );
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
