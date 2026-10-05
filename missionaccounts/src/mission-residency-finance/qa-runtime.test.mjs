import test, { before, after } from 'node:test';
const originalFetch = globalThis.fetch;
before(() => { globalThis.fetch = async () => { throw new Error('Network is forbidden in isolated QA unit tests'); }; });
after(() => { globalThis.fetch = originalFetch; });
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createFinancialQaRuntime, assertFinancialQaProvider, FINANCIAL_QA_SCHEMA, FINANCIAL_QA_SUBJECT } from './qa-runtime.mjs';
import { composeFinancialQaMigration, QA_FINANCE_MIGRATIONS } from './qa-migration.mjs';
const founder = { username: 'brinyu', wpUserId: 1, userId: '11111111-1111-4111-8111-111111111111' };
const qaSubject = { username: 'brinyu2', wpUserId: 22, userId: '22222222-2222-4222-8222-222222222222' };
// Synthetic non-provider credentials are confined to mocks; no real credentials enter test artifacts.
const provider = { mode: 'test', secretKey: ['sk','test','fixture'].join('_'), publishableKey: ['pk','test','fixture'].join('_'), accountId: 'acct_QA' };
const calls = [];
class Store {
 constructor(config) { calls.push(config); }
 async rpc(name, body) { assert.equal(name,'api_financial_qa_identity'); calls.push(body); return {kind: body.p_wp_user_id===1?'founder':'qa_subject',username:body.p_wp_user_id===1?'brinyu':'brinyu2',subject_key:FINANCIAL_QA_SUBJECT}; }
}
const build = options => createFinancialQaRuntime({enabled:true,database:{url:'https://db.invalid',serviceKey:'fixture'},founder,qaSubject,provider,Store,...options});
test('QA store uses hard-coded isolated schema and verified synthetic identity only', async () => {
 calls.length=0; const runtime=build(); assert.equal(calls[0].schema,FINANCIAL_QA_SCHEMA);
 for (const identity of [null,{...qaSubject,userId:founder.userId},{...qaSubject,wpUserId:99},{...founder,wpUserId:7},{userId:'33333333-3333-4333-8333-333333333333',wpUserId:3,roles:['missionaccounts_admin']}]) assert.equal(await runtime.resolve(identity),null);
 assert.equal(calls.length,1);
 const subject=await runtime.resolve({...qaSubject,roles:['registered']}); assert.equal(subject.kind,'qa_subject'); assert.deepEqual(subject.identity.roles,['student']);
 assert.equal(subject.operations.store.schema,undefined); assert.equal(subject.operations.config.zelleMatcher,false); assert.equal(subject.operations.config.providerEvents,false);
 const admin=await runtime.resolve(founder); assert.equal(admin.kind,'founder'); assert.deepEqual(admin.identity.roles,['founder']);
});
test('QA private binding unavailable or mismatched never grants a runtime', async () => {
 class WrongStore extends Store { async rpc(){return {kind:'qa_subject',username:'other',subject_key:FINANCIAL_QA_SUBJECT};} }
 assert.equal(await build({Store:WrongStore}).resolve(qaSubject),null);
 class DownStore extends Store {async rpc(){throw new Error('unavailable');}}
 await assert.rejects(build({Store:DownStore}).resolve(qaSubject),/unavailable/);
});
test('QA rejects live mode, live/restricted keys, live publishable key and mixed configuration', () => {
 for(const overrides of [{mode:'live'},{mode:'disabled'},{secretKey:['sk','live','fixture'].join('_')},{secretKey:['rk','live','fixture'].join('_')},{publishableKey:['pk','live','fixture'].join('_')},{liveMutationsEnabled:true}]) assert.throws(()=>assertFinancialQaProvider({...provider,...overrides}),/exclusive Stripe TEST/);
 assert.throws(()=>build({qaSubject:{...qaSubject,username:'admin'}}),/custody/);
 assert.throws(()=>build({founder:{...founder,wpUserId:2}}),/custody/);
 assert.equal(createFinancialQaRuntime({enabled:false}),null);
});
test('QA provider fails closed if mutated to live after construction', async () => {
 const result=await build().resolve(qaSubject);result.operations.stripe.mode='live';
 await assert.rejects(result.operations.stripe.retrieve('account'),/exclusive Stripe TEST/);
});
test('QA migration is deterministic finance-only composition with forced RLS and no shared account references', () => {
 const sql=composeFinancialQaMigration();
 assert.equal(sql,readFileSync(new URL('../../supabase/migrations/20261005190000_mission_residency_financial_qa_isolation.sql',import.meta.url),'utf8'));
 assert.equal(QA_FINANCE_MIGRATIONS.length,7);assert.equal(sql.match(/^begin;/gm).length,1);assert.equal(sql.match(/^commit;/gm).length,1);
 assert.doesNotMatch(sql,/\bmissionaccounts\./);assert.doesNotMatch(sql,/create table missionaccounts_finance_qa\.users/);
 assert.match(sql,/force row level security/); assert.match(sql,/revoke all on all tables in schema missionaccounts_finance_qa from public,anon,authenticated,service_role/);
 assert.match(sql,/api_financial_record_refund/); assert.match(sql,/qa_synthetic_subject/);assert.match(sql,/DR-389:TEST-ONLY-EXACT-REQUEST-v1/);
});

test('QA rejects provider live objects even with a TEST configuration', async () => {
 const result=await build().resolve(qaSubject);const blockedFetch=globalThis.fetch;
 globalThis.fetch=async()=>({ok:true,json:async()=>({id:'pi_Synthetic',livemode:true})});
 try {await assert.rejects(result.operations.stripe.retrieve('payment_intents/pi_Synthetic'),/Live provider objects are forbidden/);}
 finally {globalThis.fetch=blockedFetch;}
});
