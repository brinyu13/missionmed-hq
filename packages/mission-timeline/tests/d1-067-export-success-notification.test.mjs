import test from 'node:test';
import assert from 'node:assert/strict';
import {executeExportRequest} from '../web/js/uxr-002/export-screen.js';
import {studentMessage} from '../web/js/uxr-002/student-language.js';

for(const extension of ['pdf','pptx','png']){
  for(const verification of ['browser-download-dispatched','saved-file-verified']){
    test(`${extension}: successful ${verification} survives student-language filtering`,async()=>{
      let versions=0;const notices=[];
      const result=await executeExportRequest({
        contract:'D1-UXR-002-EXPORT-REQUEST-V1',
        filename:`Acceptance_AAA_Timeline_2026-10-15_Editable.${extension}`,
        format:{id:extension},version:{label:'Export',kind:'export'}
      },{
        adapter:{executionMode:'local',generate:async()=>({}),download:async()=>({downloaded:true,verification})},
        authorize:async()=>true,requestVersion:async()=>{versions++;},
        toast:(message,options)=>notices.push({message:studentMessage(message,{context:'export'}),...options})
      });
      assert.equal(result.completed,true);assert.equal(versions,1);
      assert.deepEqual(notices,[{message:verification==='browser-download-dispatched'
        ?'Download requested. Check your downloads.':'File exported. Check your downloads.',tone:'success'}]);
      assert.equal(result.metadata.savedFileVerified,verification==='saved-file-verified');
    });
  }
}

test('actual generation and download failures never emit a success notice',async()=>{
  for(const stage of ['generate','download']){
    const notices=[];
    await assert.rejects(executeExportRequest({contract:'D1-UXR-002-EXPORT-REQUEST-V1',filename:'AAA_TEST.pdf',format:{id:'pdf'},version:{label:'Export',kind:'export'}},{
      adapter:{executionMode:'local',generate:async()=>{if(stage==='generate')throw Error('broken');return{};},download:async()=>{throw Error('broken');}},
      authorize:async()=>true,requestVersion:async()=>{throw Error('must not run');},toast:m=>notices.push(m)
    }),{code:stage==='generate'?'EXPORT_GENERATION_FAILED':'EXPORT_DOWNLOAD_FAILED'});
    assert.deepEqual(notices,[]);
  }
});

test('failed automatic version keeps downloaded metadata and emits no success notice',async()=>{
  const notices=[];
  await assert.rejects(executeExportRequest({contract:'D1-UXR-002-EXPORT-REQUEST-V1',filename:'AAA_TEST.pptx',format:{id:'pptx'},version:{label:'Export',kind:'export'}},{
    adapter:{executionMode:'local',generate:async()=>({}),download:async()=>({downloaded:true,verification:'browser-download-dispatched'})},
    authorize:async()=>true,requestVersion:async()=>{throw Error('save failed');},toast:m=>notices.push(m)
  }),error=>error.code==='EXPORT_VERSION_REQUEST_FAILED'&&error.partial.downloaded===true);
  assert.deepEqual(notices,[]);
});

test('version/history warnings and explicit error codes remain errors or warnings',()=>{
  for(const notice of ['File downloaded. Export history could not sync.','File downloaded. Its saved version needs attention.']){
    assert.equal(studentMessage(notice,{context:'export'}),notice);
  }
  assert.match(studentMessage({code:'EXPORT_GENERATION_FAILED',message:'Download requested · AAA_TEST.pdf'},{context:'export'}),/couldn't/);
  assert.match(studentMessage('Export failed — try again',{context:'export'}),/failed/);
});

test('recognition is bounded to export context, complete known format and one-line notices',()=>{
  for(const [message,context] of [
    ['Download requested · AAA_TEST.pdf','document'],
    ['Download requested · AAA_TEST.exe','export'],
    ['Download requested · AAA_TEST\nERROR.pdf','export'],
    ['Unknown failure · AAA_TEST.pdf','export']
  ]) assert.doesNotMatch(studentMessage(message,{context}),/Check your downloads/);
});
