// Synthetic, local PG18 integration only. No provider or production proof.
import assert from 'node:assert/strict';
import {randomUUID,randomInt} from 'node:crypto';
import {createDatabase} from '../../server/db.mjs';
import {syncActor,writeInterview} from '../../server/records.mjs';
import {ensureDemand} from '../../server/research-demand.mjs';
import {assertDisposableTarget,qualifyDisposableConnection,readDisposableConnectionFile} from '../../scripts/disposable-db-guard.mjs';

const url=process.argv[2]?readDisposableConnectionFile(process.argv[2]).databaseUrl:process.env.IIQ_TEST_DATABASE_URL;
assertDisposableTarget(url,{role:'iiq_runtime_test'});
const database=createDatabase({databaseUrl:url});
await qualifyDisposableConnection(database.pool,url,{role:'iiq_runtime_test'});
const base=randomInt(1000000,1000000000);
const actor=n=>({id:randomUUID(),wpUserId:base+n,displayName:'Synthetic demand test',eligible:true,role:'student',tier:'360',zone:'America/New_York',assignments:[]});
const a=actor(1),b=actor(2);
const tx=(who,fn)=>database.withActor(who,fn,{write:true});
const q=(sql,params=[])=>tx(a,db=>db.query(sql,params));
const create=program=>tx(a,async db=>(await db.query(`INSERT INTO iiq.interviews(owner_id,program_id,program_name)
  VALUES($1,$2,'Synthetic public program') RETURNING *`,[a.id,program])).rows[0]);
const demand=(row,options)=>tx(a,db=>ensureDemand(db,row,options));
const events=row=>q('SELECT * FROM iiq.outbox_events WHERE payload->>\'interviewId\'=$1 ORDER BY created_at,id',[row.id]).then(r=>r.rows);
const current=row=>q('SELECT * FROM iiq.research_demands WHERE interview_id=$1',[row.id]).then(r=>r.rows[0]);
const retarget=(row,program)=>tx(a,async db=>{
  await db.query('UPDATE iiq.interviews SET program_id=$2 WHERE id=$1',[row.id,program]);
  // Pass the stale caller snapshot deliberately: locked canonical identity wins.
  return ensureDemand(db,row);
});
let count=0;
const check=async(name,fn)=>{await fn();console.log(`ok ${++count} - ${name}`);};
let row,first,second,third,unresolved,legacy;
try {
  await database.verifyRuntimeRole();
  for(const who of [a,b])await tx(who,db=>syncActor(db,who));
  await check('resolved undated interview creates one durable scoped demand and job',async()=>{
    row=await create('synthetic-program-a');first=await demand(row);
    assert.equal(row.local_date,null);assert.equal(first.owner_id,a.id);assert.equal(first.interview_id,row.id);
    assert.equal(first.status,'queued');assert.ok(first.external_request_id);
    const jobs=await events(row);assert.equal(jobs.length,1);
    assert.deepEqual(jobs[0].payload,{ownerId:a.id,interviewId:row.id,demandId:first.id,programId:row.program_id,requestId:first.external_request_id});
  });
  await check('identical saves and queued refresh preserve the entire demand and job',async()=>{
    const before=await events(row);
    assert.deepEqual(await demand(row),first);assert.deepEqual(await demand(row,{refresh:true}),first);
    assert.deepEqual(await events(row),before);
  });
  await check('concurrent replays serialize without duplicate work',async()=>{
    const results=await Promise.all(Array.from({length:8},()=>demand(row,{refresh:true})));
    for(const r of results)assert.deepEqual(r,first);
    assert.equal((await events(row)).length,1);
  });
  await check('reschedule changes Calendar while preserving demand generation',async()=>{
    await tx(a,db=>writeInterview({db,actor:a,command:'interview.schedule',interviewId:row.id,
      data:{date:'2026-11-02',time:'09:30',zone:'America/New_York',format:'virtual'},config:{coreOnly:true}}));
    assert.deepEqual(await current(row),first);
    const saved=(await q('SELECT * FROM iiq.interviews WHERE id=$1',[row.id])).rows[0];
    assert.equal(saved.local_date,'2026-11-02');assert.equal(saved.timezone,'America/New_York');
  });
  await check('A to B to A creates distinct generations with stable canonical ownership',async()=>{
    const before=await events(row);
    second=await retarget(row,'synthetic-program-b');third=await retarget(row,'synthetic-program-a');
    for(const d of [second,third]){assert.equal(d.id,first.id);assert.equal(d.owner_id,a.id);assert.equal(d.interview_id,row.id);}
    assert.equal(new Set([first,second,third].map(d=>d.external_request_id)).size,3);
    assert.equal((await events(row)).length,3);
    assert.deepEqual((await events(row)).filter(j=>j.id===before[0].id),before);
  });
  await check('unresolved identity invalidates current request without deleting old jobs',async()=>{
    const before=await events(row);unresolved=await retarget(row,null);
    assert.equal(unresolved.external_request_id,null);assert.equal(unresolved.status,'waiting_identity');
    assert.equal(unresolved.program_id,null);assert.equal(unresolved.id,first.id);
    assert.deepEqual(await events(row),before);assert.deepEqual(await demand(row),unresolved);
  });
  await check('new unresolved interviews wait without any dispatch',async()=>{
    const waiting=await create(null),d=await demand(waiting);
    assert.equal(d.status,'waiting_identity');assert.equal(d.external_request_id,null);
    assert.equal((await events(waiting)).length,0);assert.deepEqual(await demand(waiting,{refresh:true}),d);
  });
  await check('resolving again creates fresh work rather than reviving an old job',async()=>{
    const d=await retarget(row,'synthetic-program-a');
    assert.ok(![first,second,third].some(old=>old.external_request_id===d.external_request_id));
    assert.equal((await events(row)).length,4);
  });
  await check('researching refresh is a true no-op',async()=>{
    await q("UPDATE iiq.research_demands SET status='researching' WHERE interview_id=$1",[row.id]);
    const before=await current(row);assert.deepEqual(await demand(row,{refresh:true}),before);
    assert.equal((await events(row)).length,4);
  });
  await check('completed refresh creates exactly one new request and clears stale receipt state',async()=>{
    await q("UPDATE iiq.research_demands SET status='available',refreshed_at=now(),last_error_code='synthetic' WHERE interview_id=$1",[row.id]);
    const before=await current(row),after=await demand(row,{refresh:true});
    assert.notEqual(after.external_request_id,before.external_request_id);assert.equal(after.status,'queued');
    assert.equal(after.refreshed_at,null);assert.equal(after.last_error_code,null);
    assert.deepEqual(await demand(row,{refresh:true}),after);assert.equal((await events(row)).length,5);
  });
  await check('legacy null request identity is repaired once, preserving old outbox bytes',async()=>{
    legacy=await create('synthetic-program-legacy');
    await q("INSERT INTO iiq.research_demands(owner_id,interview_id,program_id,status) VALUES($1,$2,$3,'queued')",[a.id,legacy.id,legacy.program_id]);
    await q("INSERT INTO iiq.outbox_events(owner_id,topic,dedupe_key,payload) VALUES($1,'rise.research_requested',$2,$3)",[a.id,`synthetic-legacy:${legacy.id}`,JSON.stringify({programId:legacy.program_id,demandId:(await current(legacy)).id})]);
    const old=(await q('SELECT * FROM iiq.outbox_events WHERE dedupe_key=$1',[`synthetic-legacy:${legacy.id}`])).rows[0];
    const repaired=await demand(legacy);assert.ok(repaired.external_request_id);
    assert.deepEqual(await demand(legacy),repaired);assert.equal((await events(legacy)).length,1);
    assert.deepEqual((await q('SELECT * FROM iiq.outbox_events WHERE id=$1',[old.id])).rows[0],old);
  });
  await check('student B cannot read or mutate A demand, even with a forged snapshot',async()=>{
    assert.equal((await tx(b,db=>db.query('SELECT * FROM iiq.research_demands WHERE id=$1',[first.id]))).rowCount,0);
    await assert.rejects(tx(b,db=>ensureDemand(db,row,{refresh:true})),e=>e.code==='not_found');
    await assert.rejects(tx(b,db=>ensureDemand(db,{...row,owner_id:b.id})),e=>e.code==='not_found');
  });
  await check('transaction failure rolls back identity, demand and dispatch together',async()=>{
    const before=await current(row),jobs=await events(row);
    await assert.rejects(tx(a,async db=>{
      await db.query("UPDATE iiq.interviews SET program_id='synthetic-aborted' WHERE id=$1",[row.id]);
      await ensureDemand(db,row);throw Error('synthetic rollback');
    }),/synthetic rollback/);
    assert.deepEqual(await current(row),before);assert.deepEqual(await events(row),jobs);
    assert.equal((await q('SELECT program_id FROM iiq.interviews WHERE id=$1',[row.id])).rows[0].program_id,'synthetic-program-a');
  });
  await check('durable demand and outbox survive a fresh runtime connection',async()=>{
    const before=await current(row),jobs=await events(row),fresh=createDatabase({databaseUrl:url});
    try {
      await qualifyDisposableConnection(fresh.pool,url,{role:'iiq_runtime_test'});
      const saved=await fresh.withActor(a,db=>db.query('SELECT * FROM iiq.research_demands WHERE id=$1',[first.id]));
      assert.deepEqual(saved.rows[0],before);
      const savedJobs=await fresh.withActor(a,db=>db.query("SELECT * FROM iiq.outbox_events WHERE payload->>'interviewId'=$1 ORDER BY created_at,id",[row.id]));
      assert.deepEqual(savedJobs.rows,jobs);
    } finally {await fresh.close();}
  });
  await check('core-only creation still does not activate research',async()=>{
    const result=await tx(a,db=>writeInterview({db,actor:a,command:'interview.create',data:{programName:'Synthetic core only'},config:{coreOnly:true}}));
    assert.equal((await q('SELECT * FROM iiq.research_demands WHERE interview_id=$1',[result.id])).rowCount,0);
  });
  console.log(JSON.stringify({suite:'research-demand',passed:count,failed:0,syntheticOnly:true,providerCalls:0}));
} finally {await database.close();}
