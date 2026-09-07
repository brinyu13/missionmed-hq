import test from 'node:test';
import assert from 'node:assert/strict';
import {qualitySourceSha022,persistQualityReport022,recordCompletedExport022} from '../web/js/production/quality-state-022.js';

function store(){return{document:{id:'synthetic-022',events:[{id:'a',title:'Synthetic event',startDate:'2024-01'}],advanced:{media:[],textBlocks:[]},metadata:{}},saveStatus:'saved',adapter:{remoteSyncConsent:true,async flush(){return{synced:1,pending:0};}},mutate(label,callback){callback(this.document);},async saveNow(){this.saved=true;}};}
test('Guardian freshness changes for facts and geometry, not saves or export history',async()=>{
  const value=store();const before=await qualitySourceSha022(value.document);
  value.document.revision=6;value.document.metadata.lastExport022={completedAt:new Date().toISOString()};assert.equal(await qualitySourceSha022(value.document),before);
  value.document.events[0].startDate='2023-01';assert.notEqual(await qualitySourceSha022(value.document),before);
  value.document.events[0].startDate='2024-01';value.document.advanced.textBlocks.push({id:'text',x:20,y:30,text:'Heading'});assert.notEqual(await qualitySourceSha022(value.document),before);
});
test('Guardian record preserves the full review and only marks AI after a receipt',async()=>{
  const value=store();await persistQualityReport022(value,{findings:[],findingCount:0,exportReady:true});assert.equal(value.document.metadata.qualitySummary022.aiReview,false);assert.equal(value.saved,true);
  await persistQualityReport022(value,{findings:[],findingCount:0,exportReady:true,ai:{status:'COMPLETE',providerReceipt:{responseId:'synthetic-proof'}}});assert.equal(value.document.metadata.qualitySummary022.aiReview,true);
});
test('history only records a verified download and exposes pending server synchronization',async()=>{
  const value=store();await assert.rejects(recordCompletedExport022(value,{completed:false}),/not confirmed/);assert.equal(value.document.metadata.lastExport022,undefined);
  const result={completed:true,filename:'synthetic.png',metadata:{downloaded:true}};
  await recordCompletedExport022(value,result);assert.equal(value.document.metadata.exportHistory022[0].filename,'synthetic.png');
  value.adapter.flush=async()=>({pending:1,conflict:true});await assert.rejects(recordCompletedExport022(value,result),/waiting to sync/);assert.equal(value.document.metadata.exportHistory022.length,2);
});
