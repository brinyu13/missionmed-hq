import test from 'node:test';
import assert from 'node:assert/strict';

import { AnalyticsSession } from '../../analytics/analytics-session.mjs';
import { serializeAnalyticsEnvelope } from '../../analytics/event-contract.mjs';

function frame(index){
  const moving=index%8<4;return {
    faceCount:1,
    face:{present:true,box:{centerX:.5,centerY:.4,width:.3},yawProxyDeg:0,pitchProxyDeg:0,rollProxyDeg:0,movementRatePerSecond:0},
    pose:{torsoPresent:true,shoulderWidth:.2,centerX:.5+(index%16<8?.02:-.02),centerY:.45,lateralLeanDeg:index%20<8?15:0},
    hands:{left:{present:true,wristX:moving?(index%2?.45:.4):.4,wristY:.5,zone:'chest'},right:{present:false}},
  };
}

test('15-minute synthetic visual churn stays bounded',()=>{
  let now=0;const session=new AnalyticsSession({sessionId:'endurance',now:()=>now,wallClock:()=>0});
  session.beginAnswer({answerId:'a',hasCamera:true});
  const started=performance.now();
  for(let index=0;index<7_200;index++){now=index*125;session.ingestVision({atMs:now,geometry:frame(index),inferenceMs:20});}
  now=900_000;const result=session.endAnswer();
  const serialized=serializeAnalyticsEnvelope(result);
  assert.ok(result.events.length<=260,`events=${result.events.length}`);
  assert.ok(new TextEncoder().encode(serialized).byteLength<=256_000);
  assert.ok(performance.now()-started<3_000);
});

test('15-minute audio and pause churn stays bounded without withholding the result',()=>{
  let now=0;const session=new AnalyticsSession({sessionId:'audio-endurance',now:()=>now,wallClock:()=>0});
  session.beginAnswer({answerId:'a',hasMic:true});
  for(let index=0;index<18_000;index++){
    now=index*50;
    const cycle=now%2_200;
    const rms=cycle<1_000?.1:.001;
    session.ingestAudio({atMs:now,rms,peak:rms,clippedFraction:0});
  }
  now=900_000;const result=session.endAnswer();
  const serialized=serializeAnalyticsEnvelope(result);
  const pauses=result.events.filter((event)=>event.metric==='pause_episode');
  assert.ok(pauses.length<=40,`pauses=${pauses.length}`);
  assert.ok(pauses.some((event)=>event.quality.limitations.includes('pause_episode_timeline_capped')));
  assert.ok(new TextEncoder().encode(serialized).byteLength<=256_000);
});
