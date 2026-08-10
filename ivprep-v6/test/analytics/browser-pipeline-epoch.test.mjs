import test from 'node:test';
import assert from 'node:assert/strict';

if (!globalThis.CustomEvent) globalThis.CustomEvent = class CustomEvent extends Event { constructor(type, init = {}) { super(type);this.detail=init.detail; } };
globalThis.document = {
  hidden: false,
  addEventListener() {},
  removeEventListener() {},
  getElementById() { return null; },
};

const { BrowserAnalyticsPipeline } = await import('../../public/analytics/browser-pipeline.mjs');

test('late worker geometry from a prior answer epoch is ignored',()=>{
  let now=0;
  const pipeline=new BrowserAnalyticsPipeline({bridge:{media:{}},now:()=>now});
  pipeline.beginAnswer({answerId:'first'});
  const firstEpoch=pipeline.answerEpoch;
  now=1_000;pipeline.endAnswer({endAt:now});
  now=1_100;pipeline.beginAnswer({answerId:'second'});
  assert.notEqual(pipeline.answerEpoch,firstEpoch);
  pipeline.onWorkerMessage({
    type:'geometry',generation:pipeline.generation,answerEpoch:firstEpoch,timestampMs:500,inferenceMs:10,
    geometry:{faceCount:1,face:{present:false},pose:{torsoPresent:false},hands:{}},
  },pipeline.generation);
  assert.equal(pipeline.session.vision.frames,0);
  pipeline.destroy();
});

test('diagnostics retain unavailable multi-face protection state',()=>{
  const pipeline=new BrowserAnalyticsPipeline({bridge:{media:{}},now:()=>0});
  pipeline.beginAnswer({answerId:'a'});
  pipeline.onWorkerMessage({type:'ready',generation:pipeline.generation,answerEpoch:pipeline.answerEpoch,multiFaceProtection:false},pipeline.generation);
  assert.equal(pipeline.diagnostics().multiFaceProtection,false);
  pipeline.destroy();
});

test('beginAnswer is transactional when a sampler throws',()=>{
  const track={readyState:'live',enabled:true};
  const bridge={media:{mic:true,AC:{state:'running'},stream:{getAudioTracks:()=>[track],getVideoTracks:()=>[]},data:new Float32Array(4),analyser:{getFloatTimeDomainData(){throw new Error('analyser failed')}}}};
  const pipeline=new BrowserAnalyticsPipeline({bridge,now:()=>0});
  assert.throws(()=>pipeline.beginAnswer({answerId:'a'}),/analyser failed/u);
  assert.equal(pipeline.answer,null);
  assert.equal(pipeline.session.active,null);
  pipeline.destroy();
});

test('blocked worker egress attempts are retained without a URL',()=>{
  const pipeline=new BrowserAnalyticsPipeline({bridge:{media:{}},now:()=>0});
  pipeline.beginAnswer({answerId:'a'});
  pipeline.onWorkerMessage({type:'egress-blocked',generation:pipeline.generation,count:1},pipeline.generation);
  assert.equal(pipeline.diagnostics().blockedEgressAttempts,1);
  assert.equal(JSON.stringify(pipeline.diagnostics()).includes('http'),false);
  pipeline.destroy();
});

test('muted media tracks are unavailable and a newly muted microphone creates a gap',()=>{
  const mutedVideo={readyState:'live',enabled:true,muted:true};
  const cameraPipeline=new BrowserAnalyticsPipeline({bridge:{media:{cam:true,stream:{getVideoTracks:()=>[mutedVideo],getAudioTracks:()=>[]}}},now:()=>0});
  cameraPipeline.beginAnswer({answerId:'camera',videoElement:{}});
  assert.equal(cameraPipeline.session.active.hasCamera,false);
  cameraPipeline.destroy();

  let now=0;let audioTick=null;const priorSetInterval=globalThis.setInterval;
  globalThis.setInterval=(callback)=>{audioTick=callback;return 1};
  try{
    const audioTrack={readyState:'live',enabled:true,muted:false};
    const bridge={media:{mic:true,AC:{state:'running'},stream:{getAudioTracks:()=>[audioTrack],getVideoTracks:()=>[]},data:new Float32Array([.1,.1,.1,.1]),analyser:{getFloatTimeDomainData(){}}}};
    const pipeline=new BrowserAnalyticsPipeline({bridge,now:()=>now});
    pipeline.beginAnswer({answerId:'audio'});
    audioTrack.muted=true;now=100;audioTick();now=1_000;
    const result=pipeline.endAnswer({endAt:now});
    assert.deepEqual(result.studentEvents.map((event)=>event.metric),['answer_duration_ms']);
    const gap=result.events.find((event)=>event.metric==='observation_gap'&&event.observation.qualifiers.includes('audio'));
    assert.deepEqual([gap.startMs,gap.endMs,gap.observation.value],[100,1_000,'microphone_or_audio_context_disconnected']);
    pipeline.destroy();
  }finally{globalThis.setInterval=priorSetInterval}
});
