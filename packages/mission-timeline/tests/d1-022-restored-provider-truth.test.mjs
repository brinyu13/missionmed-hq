import test from 'node:test';
import assert from 'node:assert/strict';
import {reconcileRestoredProviderTruth022} from '../web/js/production/provider-receipt-022.js';
import {restoreServerGuardian022,qualitySourceSha022} from '../web/js/production/quality-state-022.js';
const receipt={responseId:'resp_controlled_fixture',model:'controlled-test',store:false,inputSha256:'a'.repeat(64),outputSha256:'b'.repeat(64)};
const doc=()=>({id:'timeline-test',studentOwnerId:'student-test',events:[],metadata:{},intake:{}});
const envelope=(workflow='CV')=>({workflow,documentId:'timeline-test',ownerPrincipalId:'student-test',signature:'c'.repeat(64),serverVerified:true,payload:{status:'COMPLETE',mode:'SERVER_AI',providerReceipt:receipt,findings:[]}});
test('cached marker cannot restore an AI claim without fresh server verification',()=>{
  const local=doc();local.intake.analysis={intelligenceMode:'SERVER_AI',providerReceipt:receipt,providerAuthenticity:envelope()};
  reconcileRestoredProviderTruth022(local,null);
  assert.equal(local.intake.analysis.intelligenceMode,'LOCAL_LIMITED');assert.equal(local.intake.analysis.providerReceipt,undefined);
});
test('fresh authenticated server receipt survives local restore while client receipt edits do not',()=>{
  const server=doc();server.intake.analysis={intelligenceMode:'SERVER_AI',providerReceipt:receipt,providerAuthenticity:envelope()};
  const local=structuredClone(server);local.intake.analysis.providerReceipt.responseId='resp_forged';
  reconcileRestoredProviderTruth022(local,server);
  assert.equal(local.intake.analysis.providerReceipt.responseId,receipt.responseId);
  assert.equal(server.intake.analysis.providerReceipt.responseId,receipt.responseId);
});
test('Guardian restoration uses signed server findings and current content, not cached merged report',async()=>{
  const local=doc(),server=doc(),proof=envelope('GUARDIAN');proof.sourceSha256=await qualitySourceSha022(local);
  server.metadata.qualityReport022={ai:{providerAuthenticity:proof},findings:[{message:'untrusted merged field'}]};
  const restored=await restoreServerGuardian022(local,server,{analyze:()=>({freshRules:true}),merge:(rules,analysis)=>({rules,analysis})});
  assert.equal(restored.report.rules.freshRules,true);assert.deepEqual(restored.report.analysis.findings,[]);
  local.events.push({id:'new-event'});
  assert.equal(await restoreServerGuardian022(local,server,{analyze:()=>{throw Error('stale review used');},merge:()=>{}}),null);
});
