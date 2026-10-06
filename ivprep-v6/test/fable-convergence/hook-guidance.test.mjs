import test from 'node:test';
import assert from 'node:assert/strict';
import {NativeInterviewObserver} from '../../public/studio-fable/app/brain/native-observer.mjs';
import {GptLiveInterviewer} from '../../public/studio-fable/app/adapters/live-adapter.mjs';
import {LiveInterviewSession} from '../../public/capabilities/live-interview.mjs';

const questions=[{question_id:'CORE-01',canonical_text:'Tell me about yourself.'},{question_id:'CORE-02',canonical_text:'Why internal medicine?'}];
const fragment=(text,id='a',end=200)=>({type:'session.input_transcript.delta',delta:text,event_id:id,start_ms:100,end_ms:end});
const observed=(text,config={})=>{const o=new NativeInterviewObserver({questions,config});o.start();o.ingestFragment(fragment(text));return o;};

test('semantic curriculum classes propose bounded context, never a scripted question',()=>{
  for(const text of [
    'Actually, there was a really interesting teaching moment with my son yesterday.',
    'Our research result surprised everyone.',
    'I had a difficult experience during my ICU rotation.',
    'Actually, I had an unexpected patient encounter during my ICU rotation.',
    'I am a great communicator.',
    'My ICU case surprised the entire team. I had a difficult teaching moment with a resident.',
  ]){
    const o=observed(text),hint=o.pendingHookContext();assert.ok(hint,text);
    assert.equal(hint.questionId,'CORE-01');assert.equal(Object.hasOwn(hint,'suggestedFollowUp'),false);
    assert.equal(o.snapshot().hooks.some(h=>h.bitTaken===true),false);
    o.hookContextSent(hint);assert.equal(o.pendingHookContext(),null,'one advisory per planned question');
  }
  for(const text of ['I bought an interesting new refrigerator yesterday.',
    'I had a difficult teaching moment. This teaching moment was resolved when we discussed the case and practiced together.']){
    assert.equal(observed(text).pendingHookContext(),null,text);
  }
});
test('advisory context respects resolution, privacy, limits, closing and conflicting fragments',()=>{
  const text='Actually, there was a really interesting teaching moment with my son yesterday.';
  for(const config of [{maxDepth:0},{maxFollowUps:0}])assert.equal(observed(text,config).pendingHookContext(),null);
  assert.equal(observed('I had a difficult patient encounter involving private patient information.').pendingHookContext(),null);
  const o=observed(text);o.ingestFragment(fragment(' This teaching moment was resolved when we discussed the case and practiced together.','b',300));
  assert.equal(o.pendingHookContext(),null);
  const closing=observed(text);closing.requestEnd('wrap');assert.equal(closing.pendingHookContext(),null);
  const conflict=observed(text);conflict.ingestFragment(fragment('Conflicting text.'));assert.equal(conflict.pendingHookContext(),null);
});
test('actual adapter → native transport uses thinking context, not speech or turn control',()=>{
  const sent=[],live=new LiveInterviewSession({createSession(){},endSession(){},PeerConnection:class{}});
  live.state='active';live.channel={readyState:'open',send:raw=>sent.push(JSON.parse(raw))};
  const adapter=new GptLiveInterviewer();adapter.live=live;
  const o=observed('Actually, there was a really interesting teaching moment with my son yesterday.');
  const hint=o.pendingHookContext();assert.equal(adapter.appendHookContext(hint),true);o.hookContextSent(hint);
  assert.equal(sent.length,1);assert.equal(sent[0].type,'session.thinking.append');assert.equal(sent[0].delegation_id,null);
  assert.match(sent[0].content,/untrusted candidate transcript data/);assert.match(sent[0].content,/not a turn boundary/);
  assert.equal(adapter.appendHookContext(hint),false);assert.equal(sent.length,1);
  assert.equal(o.snapshot().finalObservationCount,0);assert.equal(o.snapshot().hooks[0].bitTaken,null);
  o.ingestFragment({type:'session.output_transcript.delta',delta:'Tell me more about that teaching moment with your son?',event_id:'out',start_ms:210,end_ms:400});
  assert.equal(o.snapshot().hooks[0].bitTaken,true,'followed evidence comes only from observed provider output');
  assert.equal(sent.length,1);
  adapter.stopping=true;assert.equal(adapter.appendHookContext({...hint,questionId:'CORE-02'}),false);
});
test('native context rejects malformed payloads, closing, closed channel and bounds failed sends',()=>{
  const live=new LiveInterviewSession({createSession(){},endSession(){},PeerConnection:class{}}),sent=[];
  live.state='active';live.channel={readyState:'open',send:raw=>sent.push(raw)};
  const hint={kind:'FOLLOW_HOOK',questionId:'CORE-01',span:'An unresolved research result'};
  for(const bad of [null,{}, {...hint,kind:'QUESTION'},{...hint,questionId:'../other'}, {...hint,span:''}, {...hint,span:'a'.repeat(129)}, {...hint,span:'é'.repeat(100)}])assert.equal(live.appendHookContext(bad),false);
  live.closingRequested=true;assert.equal(live.appendHookContext(hint),false);live.closingRequested=false;
  live.channel.readyState='closed';assert.equal(live.appendHookContext(hint),false);live.channel.readyState='open';
  let attempts=0;live.channel.send=()=>{attempts++;throw new Error('transport unavailable');};
  for(let i=0;i<20;i++)assert.equal(live.appendHookContext(hint),false);
  assert.equal(attempts,1);assert.equal(live.state,'active','optional advisory failure does not fail media');
  assert.equal(sent.length,0);
});
