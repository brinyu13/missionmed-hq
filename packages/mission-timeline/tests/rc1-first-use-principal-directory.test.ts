import assert from "node:assert/strict";
import test from "node:test";

import {PostgresTimelinePrincipalDirectory} from "../src/identity/postgres-principal-directory.js";

const principalId="9d8d7a7a-c915-5d36-a657-910ad2221001";

class FirstUseClient {
  calls:{sql:string;parameters:unknown[]|undefined}[]=[];
  principalExists=false;
  programExists=false;
  released=false;

  async query<T=unknown>(sql:string,parameters?:unknown[]){
    const normalized=sql.replace(/\s+/g," ").trim();
    this.calls.push({sql:normalized,parameters});
    if(normalized.startsWith("select id, wp_user_id, role, status from timeline.principals where id = $1 and wp_user_id = $2")){
      return {rows:(this.principalExists?[{id:principalId,wp_user_id:143,role:"STUDENT",status:"ACTIVE"}]:[]) as T[]};
    }
    if(normalized.includes("where id = $1 or wp_user_id = $2"))return {rows:[] as T[]};
    if(normalized.startsWith("insert into timeline.principals")){this.principalExists=true;return {rows:[] as T[]};}
    if(normalized.startsWith("select program_id as value from timeline.principal_programs")){
      return {rows:(this.programExists?[{value:"missionmed-360:3893"}]:[]) as T[]};
    }
    if(normalized.startsWith("insert into timeline.principal_programs")){this.programExists=true;return {rows:[] as T[]};}
    if(normalized.startsWith("select distinct document_id as value from timeline.advisor_assignments"))return {rows:[] as T[]};
    if(normalized.startsWith("select document_id, actions, expires_at from timeline.admin_resource_grants"))return {rows:[] as T[]};
    return {rows:[] as T[]};
  }
  release(){this.released=true;}
}

class ConcurrentQueryGuardClient extends FirstUseClient {
  inFlight=0;
  maxInFlight=0;

  override async query<T=unknown>(sql:string,parameters?:unknown[]){
    this.inFlight+=1;
    this.maxInFlight=Math.max(this.maxInFlight,this.inFlight);
    try{
      await new Promise<void>((resolve)=>setImmediate(resolve));
      return await super.query<T>(sql,parameters);
    }finally{
      this.inFlight-=1;
    }
  }
}

test("missing eligible student principals are provisioned under the isolated role then re-read under authenticated RLS",async()=>{
  const client=new FirstUseClient();
  const directory=new PostgresTimelinePrincipalDirectory({connect:async()=>client} as never);
  const resolved=await directory.resolve(principalId,143,"STUDENT",{
    isWordpressAdministrator:false,hasLearndash3893Access:true,
  },"2026-08-05T22:30:00.000Z");
  assert.equal(resolved?.principalId,principalId);
  assert.deepEqual(resolved?.programIds,["missionmed-360:3893"]);
  assert.equal(client.principalExists,true);
  assert.equal(client.programExists,true);
  assert.equal(client.released,true);
  const roles=client.calls.filter(({sql})=>sql.startsWith("SET LOCAL ROLE")).map(({sql})=>sql);
  assert.deepEqual(roles,[
    "SET LOCAL ROLE timeline_authenticated",
    "SET LOCAL ROLE timeline_identity_sync",
    "SET LOCAL ROLE timeline_authenticated",
  ]);
  assert.equal(client.calls.some(({sql})=>sql.includes("PRINCIPAL_PROVISIONED_FIRST_USE")),true);
  assert.equal(client.calls.at(-1)?.sql,"COMMIT");
});

test("first-use provisioning remains fail-closed for an ineligible student",async()=>{
  const client=new FirstUseClient();
  const directory=new PostgresTimelinePrincipalDirectory({connect:async()=>client} as never);
  const resolved=await directory.resolve(principalId,143,"STUDENT",{
    isWordpressAdministrator:false,hasLearndash3893Access:false,
  },"2026-08-05T22:30:00.000Z");
  assert.equal(resolved,null);
  assert.equal(client.principalExists,false);
  assert.equal(client.calls.some(({sql})=>sql.startsWith("insert into timeline.principals")),false);
  assert.equal(client.calls.at(-1)?.sql,"COMMIT");
});

test("principal reads never overlap queries on one checked-out PostgreSQL client",async()=>{
  const client=new ConcurrentQueryGuardClient();
  client.principalExists=true;
  client.programExists=true;
  const directory=new PostgresTimelinePrincipalDirectory({connect:async()=>client} as never);
  const resolved=await directory.resolve(principalId,143,"STUDENT",{
    isWordpressAdministrator:false,hasLearndash3893Access:true,
  },"2026-08-05T23:30:00.000Z");
  assert.equal(resolved?.principalId,principalId);
  assert.equal(client.maxInFlight,1);
  assert.equal(client.calls.at(-1)?.sql,"COMMIT");
});
