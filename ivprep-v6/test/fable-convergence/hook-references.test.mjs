import test from 'node:test';
import assert from 'node:assert/strict';
import {hookReplayBinding} from '../../public/studio-fable/app/adapters/saved-review.mjs';
import {sealDerivedEvidence} from '../../public/studio-fable/app/adapters/derived-evidence.mjs';
import {NativeInterviewObserver} from '../../public/studio-fable/app/brain/native-observer.mjs';
import {hookLedger} from '../../public/studio-fable/app/model/teaching.mjs';
const sessionId='f13869aa-2b3e-4b65-9f66-1288fb459444';
test('exact hook identity/range survives observer -> ledger -> seal without fabricating a final',()=>{
  const observer=new NativeInterviewObserver({questions:[{question_id:'CORE-01',canonical_text:'Tell me about yourself.',tags:['CORE']}]});observer.start();
  observer.ingestFinal({speaker:'applicant',identity:'native:1',sessionId,text:"I trained in Lagos. Actually, there was a really interesting teaching moment with my son yesterday."});
  const hooks=hookLedger(observer.snapshot());assert.equal(hooks.length,1);assert.equal(hooks[0].reference.turnId,'native:1');
  const sealed=sealDerivedEvidence({hooks});assert.deepEqual(sealed.hooks[0].reference,hooks[0].reference);
  assert.deepEqual(sealed.turns,[]);
});
test('hook replay requires one exact reference, same session, speaker, span and bounded receipt',()=>{
  const turn={id:'native:1',speaker:'student',text:'Duplicate words. Exact hook.',startMs:5000,endMs:7000};
  const hook={span:'Exact hook.',reference:{sessionId,turnId:'native:1',startChar:17,endChar:28,basis:'PROVISIONAL_TRANSCRIPT'}};
  // Use explicit offsets, never search for text to make a mismatched ID succeed.
  const conversation={sessionId,clock:'recording-observed',timingBasis:'MESSAGE_RECEIPT',turns:[turn]};
  const detail={id:sessionId,results:{payload:{liveConversation:conversation}}};
  assert.equal(hookReplayBinding(hook,detail,10000)?.at,5);
  assert.equal(hookReplayBinding({...hook,reference:{...hook.reference,turnId:'absent'}},detail,10000),null);
  assert.equal(hookReplayBinding({...hook,reference:{...hook.reference,sessionId:'wrong'}},detail,10000),null);
  assert.equal(hookReplayBinding({...hook,span:'Wrong text'},detail,10000),null);
  assert.equal(hookReplayBinding(hook,detail,4000),null);
  conversation.turns=[turn,{...turn}];assert.equal(hookReplayBinding(hook,detail,10000),null);
  conversation.turns=[{...turn,speaker:'interviewer'}];assert.equal(hookReplayBinding(hook,detail,10000),null);
});
